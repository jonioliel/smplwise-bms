"""Is the video service (go2rtc) reachable right now? (HEALTH-GO2RTC-2430)

Lab finding 11.11: the go2rtc add-on had been stopped for two days. Every Arx call to it failed (DNS / connect error), yet
`GET /health` said `status: ok` and `go2rtc_configured: true` - "configured" was all it knew. This module keeps the one fact
that was missing: the outcome of the last contact with go2rtc, and since when it has been so.

- Every go2rtc HTTP call already made by the add-on feeds it for free: any HTTP answer (whatever its status) is `record_ok`, a
  connection failure (DNS, refused, connect timeout) is `record_failure` (services/go2rtc.Go2rtc). A slow answer (a read
  timeout of a frame grab) says nothing about reachability and is not counted either way.
- `tick(settings)` is the light periodic check (the janitor loop, every 30 s; and `GET /media/service`): it probes `GET /api`
  only when nothing touched go2rtc recently - every OK_REFRESH_S while reachable, and while unreachable on a backoff of
  BACKOFF_BASE_S doubling up to BACKOFF_MAX_S. One probe at a time; never more often than that, whoever asks.
- `view(settings)` is what /health, /health/summary and the UI read: `state` reachable | unreachable | not_configured | unknown
  (no contact yet since start), `since` (when the current state began), the last success / failure instants, the error CLASS
  name (never an address) and the consecutive failure count.

Process memory only (no migration): a restart starts at `unknown` and the first probe or stream sync settles it.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Any

from .timeutil import iso_utc

log = logging.getLogger("smplwise.media_reach")

OK_REFRESH_S = 60.0  # reachable: re-probe only when no call reached go2rtc for this long
BACKOFF_BASE_S = 10.0  # unreachable: the first re-probe after this, then doubling ...
BACKOFF_MAX_S = 60.0  # ... up to this
ATTENTION_AFTER_S = 300  # the administrators' notice (system.health "video_service") once unreachable this long - the policy's after_s

REACHABLE, UNREACHABLE, NOT_CONFIGURED, UNKNOWN = "reachable", "unreachable", "not_configured", "unknown"


def _iso(ts: float | None) -> str | None:
    if ts is None:
        return None
    import datetime as dt

    return iso_utc(dt.datetime.fromtimestamp(ts, dt.timezone.utc))


class Reach:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._probe_lock = threading.Lock()
        self.reset()

    def reset(self) -> None:
        with self._lock:
            self.state = UNKNOWN
            self.since: float | None = None
            self.last_ok_at: float | None = None
            self.last_error_at: float | None = None
            self.last_error: str | None = None
            self.failures = 0
            self.last_contact: float | None = None  # wall clock of the last outcome of either kind
            # FLAKY-G2R-BACKOFF-2437: outcomes recorded so far; `tick` compares this, not `last_contact` - on Windows `time.time()` can
            # return the same value for a failed contact and the answer right after it (~15 ms clock), which looked like "no outcome"
            self.outcomes = 0
            self.next_probe_at = 0.0
            self.probes = 0

    # ------------------------------------------------------------ outcomes

    def record_ok(self, now: float | None = None) -> None:
        now = time.time() if now is None else now
        with self._lock:
            if self.state != REACHABLE:
                if self.state == UNREACHABLE:
                    log.info("video service reachable again after %d failed contacts", self.failures)
                self.state, self.since = REACHABLE, now
            self.last_ok_at = self.last_contact = now
            self.outcomes += 1
            self.failures = 0
            self.next_probe_at = now + OK_REFRESH_S

    def record_failure(self, error: str, now: float | None = None) -> None:
        now = time.time() if now is None else now
        with self._lock:
            if self.state != UNREACHABLE:
                log.warning("video service unreachable (%s)", error)
                self.state, self.since = UNREACHABLE, now
            self.failures += 1
            self.last_error, self.last_error_at, self.last_contact = error, now, now
            self.outcomes += 1
            self.next_probe_at = now + self.backoff_s()

    def backoff_s(self) -> float:
        """The wait before the next probe while unreachable: 10, 20, 40, 60, 60 ... s (by consecutive failures)."""
        n = max(1, self.failures)
        return min(BACKOFF_MAX_S, BACKOFF_BASE_S * 2 ** min(n - 1, 8))

    # ------------------------------------------------------------ the light check

    def due(self, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        with self._lock:
            return now >= self.next_probe_at  # 0 at start: the first check probes at once

    def tick(self, settings: Any, now: float | None = None) -> bool:
        """Probe go2rtc once when due (see the module docstring). Returns whether a probe ran. Never raises."""
        if not getattr(settings, "go2rtc_url", None) or not self.due(now):
            return False
        if not self._probe_lock.acquire(blocking=False):
            return False  # a probe is already on its way; its outcome is what the caller would get
        try:
            if not self.due(now):
                return False
            from .go2rtc import Go2rtc

            self.probes += 1
            with self._lock:
                before = self.outcomes
            try:
                Go2rtc(settings).info()  # its outcome is recorded by the client itself (any answer = reachable)
            except Exception:  # noqa: BLE001 - a probe never raises
                pass
            with self._lock:
                if self.outcomes == before:  # neither an answer nor a connection failure (a slow answer): try again later
                    self.next_probe_at = (time.time() if now is None else now) + BACKOFF_BASE_S
            return True
        finally:
            self._probe_lock.release()

    # ------------------------------------------------------------ what readers see

    def view(self, settings: Any, now: float | None = None) -> dict[str, Any]:
        now = time.time() if now is None else now
        configured = bool(getattr(settings, "go2rtc_url", None))
        with self._lock:
            state = self.state if configured else NOT_CONFIGURED
            down_for = int(now - self.since) if (configured and self.state == UNREACHABLE and self.since is not None) else None
            return {
                "state": state,
                "configured": configured,
                "since": _iso(self.since) if configured else None,
                "down_for_s": down_for,
                "last_ok_at": _iso(self.last_ok_at),
                "last_error_at": _iso(self.last_error_at),
                "last_error": self.last_error,
                "failures": self.failures,
                "retry_in_s": max(0, int(round(self.next_probe_at - now))) if (configured and self.state == UNREACHABLE) else None,
            }

    def unreachable(self, settings: Any) -> bool:
        return bool(getattr(settings, "go2rtc_url", None)) and self.state == UNREACHABLE


REACH = Reach()


def is_connection_failure(exc: BaseException) -> bool:
    """A failure that means go2rtc could not be reached at all (DNS, refused, connect timeout) - not a slow answer."""
    import httpx

    return isinstance(exc, (httpx.ConnectError, httpx.ConnectTimeout, httpx.UnsupportedProtocol))
