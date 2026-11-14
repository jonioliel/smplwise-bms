"""CR-DEVICE-HTTP-2438 (code review 2026-11-13, finding 03:F15): the device-HTTP code the recorder adapters share, moved out of the
Hikvision module (services/nvr.py) where it used to live although go2rtc, Frigate and Provision-ISR import it too.

- `_ssl_context`: httpx's default verification context, built once (building it loads the CA bundle).
- The whole-operation deadline: `deadline`, `time_left`, `past_deadline`, `deadline_error`, `check_deadline`, `bounded_timeout`,
  `read_capped` (CR-020 S2C review, finding 2).
- `request` / `unavailable`: one ISAPI request whose transport failure becomes the shared 503 `source_unavailable` answer.
- `read_response_status`: the one reader of an ISAPI `ResponseStatus` body (it used to be read by two parsers, one in nvr.py and one
  in nvr_write.py); both of its readings are kept exactly (see `ResponseStatus`).

A pure move: every status, code, Hebrew message, `retryable` flag and details dictionary (keys in the same order) is what the old code
produced (tests/test_device_http_pins_2438.py was written green against the old code first). services/nvr.py re-exports the old
names, so no caller changes in this branch. Connection reuse toward devices (finding F16) is NOT part of this: every call still opens
its own client."""
from __future__ import annotations

import contextvars
import re
import time
import xml.etree.ElementTree as ET
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import httpx

from ..errors import ApiError
from . import xmlsafe

NVR_UNAVAILABLE = "ה־NVR אינו זמין כרגע."
NVR_TIMEOUT = "ה־NVR לא ענה בזמן."
NVR_TOO_LARGE = "תשובת ה־NVR גדולה מהצפוי."


# ---------------------------------------------------------------- TLS verification

_SSL_CONTEXT = None


def _ssl_context():
    """httpx's default verification context, built once: building it loads the CA bundle (about a second on the
    workstation) for every client, and the NVR is plain http - the discovery / wizard make several calls in a row."""
    global _SSL_CONTEXT
    if _SSL_CONTEXT is None:
        _SSL_CONTEXT = httpx.create_ssl_context()
    return _SSL_CONTEXT


# ---------------------------------------------------------------- the whole-operation deadline

# CR-020 S2C review (finding 2): a whole-operation wall-clock deadline. httpx timeouts are per network read, so a device
# that trickles one byte every few seconds could keep a 2 MB read going for hours. A caller (the batch runner, per item)
# opens `deadline(seconds)`; inside it every bounded read below checks the clock between network reads and caps each
# httpx timeout by the time left. A context variable: only the caller's own thread is bounded.
_DEADLINE: contextvars.ContextVar[float | None] = contextvars.ContextVar("nvr_deadline", default=None)


@contextmanager
def deadline(seconds: float) -> Iterator[None]:
    """Bound every device read / write of this thread inside the block to `seconds` in total (nested: the earlier wins)."""
    outer = _DEADLINE.get()
    at = time.monotonic() + max(0.0, seconds)
    token = _DEADLINE.set(at if outer is None else min(outer, at))
    try:
        yield
    finally:
        _DEADLINE.reset(token)


def time_left() -> float | None:
    """Seconds left of the current deadline (None: no deadline)."""
    at = _DEADLINE.get()
    return None if at is None else at - time.monotonic()


def past_deadline() -> bool:
    left = time_left()
    return left is not None and left <= 0


def deadline_error(op: str) -> ApiError:
    return ApiError(503, "source_timeout", NVR_TIMEOUT, retryable=False, details={"op": op, "error": "deadline"})


def check_deadline(op: str) -> None:
    if past_deadline():
        raise deadline_error(op)


def bounded_timeout(base: httpx.Timeout) -> httpx.Timeout:
    """`base` (the client's or the request's timeout) with every part capped by the time left of the deadline (a floor of
    50 ms keeps httpx valid). Without a deadline `base` unchanged."""
    left = time_left()
    if left is None:
        return base
    left = max(0.05, left)

    def cap(v: float | None) -> float:
        return left if v is None else min(v, left)

    return httpx.Timeout(connect=cap(base.connect), read=cap(base.read), write=cap(base.write), pool=cap(base.pool))


def read_capped(r: httpx.Response, max_bytes: int, op: str, *, path: str | None = None) -> bytes:
    """Read a streamed answer, at most `max_bytes`, checking the deadline between network reads (each read is bounded by
    the request timeout). Over the cap: `source_too_large`; past the deadline: `source_timeout`."""
    extra = {"path": path} if path else {}
    body = bytearray()
    for chunk in r.iter_bytes():  # no chunk size: a piece is yielded as it arrives, so the clock is checked per read
        body.extend(chunk)
        if len(body) > max_bytes:
            raise ApiError(503, "source_too_large", NVR_TOO_LARGE, details={**extra, "op": op})
        check_deadline(op)
    return bytes(body)


# ---------------------------------------------------------------- one request, one error mapping

def unavailable(exc: BaseException, **where: Any) -> ApiError:
    """The shared answer to a transport failure: 503 `source_unavailable`, retryable, details = `where` (in the caller's order)
    followed by `error`, the exception's class name (never its text: it can carry an address)."""
    return ApiError(503, "source_unavailable", NVR_UNAVAILABLE, retryable=True, details={**where, "error": type(exc).__name__})


def request(client: httpx.Client, method: str, path: str, *, where: dict[str, Any] | None = None, **kwargs: Any) -> httpx.Response:
    """`client.<method>(path, **kwargs)`; an `httpx.HTTPError` becomes `unavailable(exc, **where)` (default `where`: `{"path": path}`).
    The answer's status is the caller's to judge. Calls the client's own verb method, so a test double with only `get` / `put` works."""
    try:
        return getattr(client, method.lower())(path, **kwargs)
    except httpx.HTTPError as exc:
        raise unavailable(exc, **({"path": path} if where is None else where)) from exc


# ---------------------------------------------------------------- the ISAPI ResponseStatus body

_STATUS_CODE = re.compile(r"<statusCode>(\d+)</statusCode>")
_SUB_STATUS = re.compile(r"<subStatusCode>(.*?)</subStatusCode>")


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _text(el: ET.Element, name: str) -> str:
    for child in el.iter():
        if _local(child.tag) == name and child.text:
            return child.text.strip()
    return ""


class ResponseStatus:
    """One ISAPI answer body read as a Hikvision `ResponseStatus` (statusCode / statusString / subStatusCode, e.g. 4 / 'Invalid
    Operation' / 'notSupport'). Two readings, each exactly as its former parser did it:
    - `code`, `sub` (the write path's reading, formerly nvr_write.response_status): the first `<statusCode>` with digits and the first
      `<subStatusCode>` found anywhere in the text, as written - also in a body that is not well-formed XML; None when absent.
    - `document()` (the capability reader's, formerly nvr._response_status): `{"status", "sub"}` with stripped text when the body is a
      well-formed document whose root is ResponseStatus, else `{}`. Parsed only when asked for."""

    __slots__ = ("code", "sub", "_text")

    def __init__(self, text: str) -> None:
        code = _STATUS_CODE.search(text)
        sub = _SUB_STATUS.search(text)
        self.code: int | None = int(code.group(1)) if code else None
        self.sub: str | None = sub.group(1) if sub else None
        self._text = text

    def document(self) -> dict[str, str]:
        try:
            root = xmlsafe.parse(self._text)
            if _local(root.tag) != "ResponseStatus":
                return {}
            return {"status": _text(root, "statusString"), "sub": _text(root, "subStatusCode")}
        except Exception:  # noqa: BLE001
            return {}


def read_response_status(text: str) -> ResponseStatus:
    return ResponseStatus(text)
