"""CR-038 log hygiene of the public listener (spec 10.4 / 17, review T16) and its health counters.

What the public listener writes to the add-on log, and nothing else:
- `smplwise.tickets.public` - one line per request: method, ROUTE TEMPLATE (`/t/r/{rid}`, never the path: the redeem id is in
  the path), status, duration. DEBUG for answers below 500, WARNING for a 5xx. Never a header, a body, a query string, a
  client address, a token, a code, a session value or a phone number.
- `smplwise.tickets.public.http` - what uvicorn's protocol layer of THIS listener reports, through `ProtocolLog`, which the
  listener's protocol class uses instead of the process-wide `uvicorn.error` logger:
  * "Invalid HTTP request received." is dropped and counted (other uvicorn versions attach raw request bytes to it);
  * "Exceeded concurrency limit." is counted and written at most once a minute, with the count;
  * WebSocket / upgrade notices are dropped and counted;
  * "Exception in ASGI application" is written as the exception TYPE and its innermost frame only - never the message, never
    the traceback text (an exception message can quote a value);
  * any other record is written as its fixed template WITHOUT its arguments, and only at WARNING or above (uvicorn's TRACE
    lines carry client addresses).
- uvicorn's access log is never involved: the listener's protocol does not log access lines at all (public_server), and the
  process-wide `uvicorn.access` / `uvicorn.error` loggers are left exactly as the main app configured them (setting
  `access_log=False` on a uvicorn Config would have switched off the MAIN app's access log too - uvicorn 0.53
  `Config.configure_logging` changes the shared logger).

`PublicStats` is what the health route (spec 17: "public listener running + last request + last 5xx + rate-limit trips last
24 h + dropped invalid-request records") reads; one instance per listener."""
from __future__ import annotations

import collections
import logging
import os
import threading
import time
import traceback
from typing import Any, Callable

from .ratelimit import MinuteCounter

REQUEST_LOG = logging.getLogger("smplwise.tickets.public")
SERVER_LOG = logging.getLogger("smplwise.tickets.public.http")

INVALID_REQUEST = "Invalid HTTP request received."
CONCURRENCY = "Exceeded concurrency limit."
EXCEPTION = "Exception in ASGI application"
UPGRADE_NOTICES = ("Unsupported upgrade request.", "No supported WebSocket library detected")
CONCURRENCY_NOTE_EVERY_S = 60.0


def exception_summary(exc: BaseException | None) -> str:
    """`TypeName at file.py:123` - the type and the innermost frame of an exception, never its message."""
    if exc is None:
        return "unknown error"
    frames = traceback.extract_tb(exc.__traceback__) if exc.__traceback__ else []
    where = f" at {os.path.basename(frames[-1].filename)}:{frames[-1].lineno}" if frames else ""
    return f"{type(exc).__name__}{where}"


class PublicStats:
    """Health counters of one public listener. Thread safe."""

    def __init__(self, clock: Callable[[], float] = time.time) -> None:
        self._clock = clock
        self._lock = threading.Lock()
        self.requests = 0
        self.by_class: collections.Counter[str] = collections.Counter()
        self.counters: collections.Counter[str] = collections.Counter()
        self.last_request_at: float | None = None
        self.last_5xx_at: float | None = None
        self.started_at: float | None = None
        self.rate_limited = MinuteCounter(clock)

    def request(self, status: int) -> None:
        now = self._clock()
        with self._lock:
            self.requests += 1
            self.by_class[f"{status // 100}xx"] += 1
            self.last_request_at = now
            if status >= 500:
                self.last_5xx_at = now
        if status == 429:
            self.rate_limited.add()

    def bump(self, name: str, n: int = 1) -> None:
        with self._lock:
            self.counters[name] += n

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {"requests": self.requests, "by_class": dict(self.by_class), "counters": dict(self.counters),
                    "last_request_at": self.last_request_at, "last_5xx_at": self.last_5xx_at, "started_at": self.started_at,
                    "rate_limited_24h": self.rate_limited.total()}


def log_request(method: str, template: str, status: int, duration_ms: float) -> None:
    level = logging.WARNING if status >= 500 else logging.DEBUG
    if REQUEST_LOG.isEnabledFor(level):
        REQUEST_LOG.log(level, "public %s %s -> %d (%d ms)", method, template, status, int(duration_ms))


class ProtocolLog:
    """Stands in for the `logging.Logger` uvicorn's H11Protocol / RequestResponseCycle use (`level`, `log`, `warning`, `error`,
    `info`, `debug`, `exception`, `isEnabledFor`). See the module docstring for what passes."""

    level = logging.WARNING  # the protocol's TRACE branches test `logger.level <= TRACE`; this keeps them off

    def __init__(self, stats: PublicStats, logger: logging.Logger = SERVER_LOG, clock: Callable[[], float] = time.monotonic) -> None:
        self.stats = stats
        self.logger = logger
        self._clock = clock
        self._lock = threading.Lock()
        self._concurrency_pending = 0
        self._concurrency_noted_at: float | None = None

    def isEnabledFor(self, level: int) -> bool:  # noqa: N802 - the Logger API
        return level >= logging.WARNING and self.logger.isEnabledFor(level)

    def log(self, level: int, msg: object, *args: Any, exc_info: Any = None, **_kw: Any) -> None:
        text = str(msg)
        if text.startswith(INVALID_REQUEST):
            self.stats.bump("invalid_requests")
            return
        if text.startswith(UPGRADE_NOTICES):
            self.stats.bump("upgrade_refused")
            return
        if text.startswith(CONCURRENCY):
            self.stats.bump("concurrency_refusals")
            with self._lock:
                self._concurrency_pending += 1
                now = self._clock()
                if self._concurrency_noted_at is not None and now - self._concurrency_noted_at < CONCURRENCY_NOTE_EVERY_S:
                    return
                n, self._concurrency_pending, self._concurrency_noted_at = self._concurrency_pending, 0, now
            self.logger.warning("public listener: %d request(s) refused at the concurrency limit", n)
            return
        if level < logging.WARNING:
            return
        if text.startswith(EXCEPTION):
            self.stats.bump("unhandled_errors")
            exc = exc_info if isinstance(exc_info, BaseException) else None
            self.logger.error("public listener: unhandled error (%s)", exception_summary(exc))
            return
        self.logger.log(level, "public listener: %s", text[:200])  # the template only, never its arguments

    def debug(self, msg: object, *args: Any, **kw: Any) -> None:
        self.log(logging.DEBUG, msg, *args, **kw)

    def info(self, msg: object, *args: Any, **kw: Any) -> None:
        self.log(logging.INFO, msg, *args, **kw)

    def warning(self, msg: object, *args: Any, **kw: Any) -> None:
        self.log(logging.WARNING, msg, *args, **kw)

    def error(self, msg: object, *args: Any, **kw: Any) -> None:
        self.log(logging.ERROR, msg, *args, **kw)

    def exception(self, msg: object, *args: Any, **kw: Any) -> None:
        kw.setdefault("exc_info", None)
        self.log(logging.ERROR, msg, *args, **kw)

    def critical(self, msg: object, *args: Any, **kw: Any) -> None:
        self.log(logging.CRITICAL, msg, *args, **kw)
