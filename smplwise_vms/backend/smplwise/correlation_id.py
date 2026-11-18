"""SX-17 (session-exchange client contract, 2026-10-25): the request correlation id.

A client may send `X-Correlation-Id`; the server accepts it ONLY when it is a single header value of 8-64 characters from
`[A-Za-z0-9_-]` (the apps send 12-32 hex characters; a UUID with hyphens also fits). Anything else - too short, too long, another
character (spaces, quotes, CR/LF, `%`, non-ASCII), or the header sent more than once - is dropped and a fresh server id
(12 lowercase hex) is used instead. The client's raw value is never reflected: not into the response header, not into an error
body, not into an audit row (`request_id`), not into a log line. Nothing here logs the refused value either.

CR-BE-SMALL-2440: `of(request)` is THE way code reads a request's correlation id (it replaced ~30 hand-rolled
`getattr(request.state, "correlation_id", None)` copies; `routers/_common.rid` and the services call it), and `CURRENT` carries the
id of the request being served to code that has no request object - the log ring of the redacted log export (T033) stamps every
log line with it. The middleware (`main.CorrelationId`) sets both."""
from __future__ import annotations

import contextvars
import re
import uuid
from collections.abc import Iterable
from typing import Any

HEADER = "x-correlation-id"
MIN_LEN = 8
MAX_LEN = 64
PATTERN = re.compile(r"^[A-Za-z0-9_-]{%d,%d}$" % (MIN_LEN, MAX_LEN))


def new() -> str:
    """A fresh server-side correlation id: 12 lowercase hex characters."""
    return uuid.uuid4().hex[:12]


def accepted(value: object) -> str | None:
    """The value itself when it is an acceptable correlation id, else None. Pure."""
    if isinstance(value, bytes):
        try:
            value = value.decode("ascii")
        except UnicodeDecodeError:
            return None
    if not isinstance(value, str) or not PATTERN.fullmatch(value):
        return None
    return value


def resolve(values: Iterable[object]) -> str:
    """The correlation id of a request from all of its `X-Correlation-Id` header values: the one value when it is acceptable,
    otherwise a fresh server id (no header, an unacceptable value, or more than one header)."""
    vals = list(values)
    if len(vals) == 1:
        ok = accepted(vals[0])
        if ok is not None:
            return ok
    return new()


def from_asgi_headers(headers: Iterable[tuple[bytes, bytes]]) -> str:
    """`resolve` over raw ASGI header pairs (the pure-ASGI middlewares that answer before FastAPI runs)."""
    return resolve(v for k, v in headers if k.lower() == HEADER.encode())


# The correlation id of the request this code runs for (None outside a request). Set and reset by `main.CorrelationId`; copied into
# the worker thread of a sync route (Starlette's threadpool runs it in a copy of the context).
CURRENT: contextvars.ContextVar[str | None] = contextvars.ContextVar("smplwise_correlation_id", default=None)


def of(request: Any) -> str | None:
    """The correlation id the middleware gave this request (`request.state.correlation_id`), None when it has none (a request built
    outside the middleware, as some tests do). For audit rows (`request_id`) and error envelopes; never the raw client header."""
    return getattr(request.state, "correlation_id", None)


def current() -> str | None:
    """The correlation id of the request being served right now, None outside a request."""
    return CURRENT.get()
