"""0.10.3 (BRIDGE-STALE-DISCOVERY-2383): the health of the bridge's own signed directory pushes, so a refusal by the add-on is SEEN.

Until 0.10.2 a refused push was logged at debug level only: a bridge signing with a code the add-on no longer holds (a re-pair whose new
code never arrived, or an old code a Supervisor discovery put back) failed silently every 60 s. Now the first refusal is a WARNING with the
fix, the recovery an INFO line, and the state is part of the entry's diagnostics (`diagnostics.py`). Dependency-free (no Home Assistant
import) so it is unit-tested directly. Never holds or logs a code, a key, a signature or an address.

Reasons: `ok` | `addon_refused_signature` (401: the add-on does not accept this bridge's key) | `addon_error` (another HTTP status) |
`addon_unreachable` (no answer) | `no_signing_key` (CR-BRIDGE-GAPS-2436, review 05 P2-21: this bridge holds no key to sign with, so
nothing was sent - until then reported as `addon_unreachable`) | `unknown` (no push yet).

`Coalescer` (same branch): the `sync_directory` service - the add-on's "sync users" button - runs at most one push per COALESCE_S;
presses that arrive during a push or within COALESCE_S of the last one share ONE later push (each answer still comes from a push that
started after its press)."""
from __future__ import annotations

import asyncio
import datetime as dt
import logging
import time
from typing import Any, Callable

REMIND_S = 3600  # while refusals go on, the warning is repeated at most once an hour
COALESCE_S = 2.0  # sync_directory: one push per this many seconds at most
NO_SIGNING_KEY = "no_signing_key"  # the `error` of `note(None, ...)` when nothing was sent because no key can sign

# 0.10.6 (WXH4-EMERGENCY-REVOKE-2407): the manual fix is Reconfigure (config_flow.async_step_reconfigure), no longer delete-and-add
REFUSED_TEXT = ("SMPLWISE Bridge: the add-on refuses this bridge's signed updates (401) - the pairing code in this entry is not the add-on's "
                "current one (a re-pair, or an emergency revocation of the bridge key in the add-on). The new code normally arrives by itself; "
                "if it does not, open Settings > Devices & services > SMPLWISE Bridge > Reconfigure and enter the address and the new code the "
                "add-on shows on its bridge-key screen.")

NO_KEY_TEXT = ("SMPLWISE Bridge: this bridge holds no key to sign its updates with, so nothing is sent to the add-on. Open Settings > Devices & "
               "services > SMPLWISE Bridge > Reconfigure and enter the address and the code the add-on shows on its bridge-key screen.")


def _iso(at: float) -> str:
    return dt.datetime.fromtimestamp(at, dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class PushHealth:
    def __init__(self, logger: logging.Logger, now: Callable[[], float] = time.time) -> None:
        self._log, self._now = logger, now
        self.reason = "unknown"
        self.status: int | None = None
        self.since: float | None = None      # when the current non-ok reason started
        self.count = 0                       # consecutive non-ok pushes
        self.last_ok: float | None = None
        self._warned_at: float | None = None
        self._key_warned_at: float | None = None

    def note(self, status: int | None, error: str | None = None) -> None:
        """One push finished: its HTTP status, or None with the exception class name when there was no answer."""
        now = self._now()
        reason = ("ok" if status == 200 else "addon_refused_signature" if status == 401 else "addon_error" if status is not None
                  else NO_SIGNING_KEY if error == NO_SIGNING_KEY else "addon_unreachable")
        if reason == "ok":
            if self.reason == "addon_refused_signature":
                self._log.info("SMPLWISE Bridge: the add-on accepts this bridge's signed updates again (after %d refused)", self.count)
            self.reason, self.status, self.since, self.count, self.last_ok, self._warned_at = "ok", status, None, 0, now, None
            self._key_warned_at = None
            return
        if reason != self.reason:
            self.since, self.count = now, 0
        self.reason, self.status = reason, status
        self.count += 1
        if reason == "addon_refused_signature":
            if self._warned_at is None or now - self._warned_at >= REMIND_S:
                self._log.warning("%s (%d refused since %s)", REFUSED_TEXT, self.count, _iso(self.since or now))
                self._warned_at = now
        elif reason == NO_SIGNING_KEY:
            if self._key_warned_at is None or now - self._key_warned_at >= REMIND_S:
                self._log.warning("%s (%d pushes not sent since %s)", NO_KEY_TEXT, self.count, _iso(self.since or now))
                self._key_warned_at = now
        else:
            self._log.debug("directory push %s: %s", reason, status if status is not None else (error or "-"))

    def state(self) -> dict[str, Any]:
        return {"reason": self.reason, "status": self.status, "since": _iso(self.since) if self.since else None, "count": self.count,
                "last_ok": _iso(self.last_ok) if self.last_ok else None}


class Coalescer:
    """Runs `push()` (an async callable returning a value) at most once per `window_s`, never answering with data older than the call:

    - a caller whose call arrived before a push STARTED gets that push's result (presses during a push, or queued behind it, share the
      next push that starts after them - one push for all of them);
    - otherwise the push starts once `window_s` has passed since the previous one finished (the caller waits for it).
    So a burst of presses becomes one push per window, and every caller's answer comes from a push that started after it asked (a
    sync requested right after a change still carries the change). `now` is a monotonic clock, `sleep` asyncio.sleep (tests pass their own)."""

    def __init__(self, push: Callable[[], Any], window_s: float = COALESCE_S, now: Callable[[], float] = time.monotonic,
                 sleep: Callable[[float], Any] = asyncio.sleep) -> None:
        self._push, self._window, self._now, self._sleep = push, window_s, now, sleep
        self._lock: asyncio.Lock | None = None
        self._started: float | None = None   # when the last successful push started
        self._finished: float | None = None  # when the last push (successful or not) finished
        self._last: Any = None
        self.pushes = 0

    async def __call__(self) -> Any:
        asked = self._now()
        if self._lock is None:  # created on first use, inside the running loop
            self._lock = asyncio.Lock()
        async with self._lock:
            if self._started is not None and self._started >= asked:
                return self._last  # a push that started after this call asked: its answer is fresh for this caller
            if self._finished is not None:
                wait = self._window - (self._now() - self._finished)
                if wait > 0:
                    await self._sleep(wait)
            started = self._now()
            try:
                result = await self._push()
            finally:
                self._finished = self._now()
            self.pushes += 1
            self._started, self._last = started, result
            return result
