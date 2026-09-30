"""The `smplwise_bridge.stream_source` service (bridge 0.3.1): a signed, READ-ONLY question "what is the stream source of this
camera entity?", asked by the add-on for ONE camera the owner explicitly chose to show as live video
(docs/design/CAMERA_CARD_HA_SOURCE.md, option (b)).

The answer is the URL Home Assistant's own camera API reports (`camera.async_get_stream_source`, in-process; nothing is
fetched over the network from here). Such a URL routinely carries the camera's credentials (`rtsp://user:pass@host/...`), so:

- the URL is returned ONLY in the service response to the add-on, which puts it into go2rtc's source and nowhere else;
- it is never logged, never put in an exception text, never echoed in an error, never stored here;
- every refusal is a fixed code or an exception CLASS NAME; a url-bearing exception text is never forwarded;
- only a plain streaming scheme is accepted (rtsp / rtsps / http / https), no whitespace, control character or `#` (go2rtc
  reads `exec:`, `ffmpeg:` and `#option` sources as instructions - a value like that is refused, not passed on), at most
  MAX_SOURCE_LEN characters; anything else is `source_not_supported`.

The order of the checks: signature / replay window -> the shape of the request -> rate limit -> active HA administrator
(a raw camera source is a credential; Home Assistant itself shows it to nobody but the administrator) -> the entity is a
camera that exists -> the read (bounded by a timeout) -> the shape of the answer. Fails closed at every step.

Kept apart from `__init__.py` so it can be tested without Home Assistant installed: Home Assistant is imported lazily
(`_ha()`), everything else is duck-typed."""
from __future__ import annotations

import asyncio
import logging
import re
import time
from collections import deque
from types import SimpleNamespace
from typing import Any, Mapping

_LOGGER = logging.getLogger(__name__)

ENTITY_RE = re.compile(r"^camera\.[a-z0-9_]{1,100}$")
ALLOWED_SCHEMES = ("rtsp://", "rtsps://", "http://", "https://")
MAX_SOURCE_LEN = 2048
READ_TIMEOUT_S = 10.0
RATE_WINDOW_S = 60.0
RATE_MAX = 20
_BAD_CHARS_RE = re.compile(r"[\s\x00-\x1f\x7f#]")
REQUEST_KEYS = frozenset({"user_id", "entity_id", "request_id", "ts", "nonce", "sig"})

_calls: deque[float] = deque()


def _refuse(msg: Mapping[str, Any], error: str) -> dict[str, Any]:
    request_id = msg.get("request_id")
    return {"ok": False, "request_id": request_id if isinstance(request_id, str) else None, "error": error}


def _ha() -> SimpleNamespace:
    """Home Assistant's camera API, imported on first use so this module imports without Home Assistant (unit tests
    monkeypatch this function). `get_stream_source(hass, entity_id)` is an awaitable returning the source URL or None."""
    from homeassistant.components import camera as camera_component

    getter = getattr(camera_component, "async_get_stream_source", None)
    if getter is None:  # a core that keeps it on the entity only

        async def getter(hass: Any, entity_id: str) -> str | None:  # type: ignore[misc]
            return await camera_component.get_camera_from_entity_id(hass, entity_id).stream_source()

    return SimpleNamespace(get_stream_source=getter)


def source_shape_error(value: Any) -> str | None:
    """None when `value` may be handed to go2rtc, else the refusal code. Never includes the value."""
    if not isinstance(value, str) or not value:
        return "no_stream_source"
    if len(value) > MAX_SOURCE_LEN:
        return "source_not_supported"
    if _BAD_CHARS_RE.search(value) or not value.lower().startswith(ALLOWED_SCHEMES):
        return "source_not_supported"
    return None


def _rate_limited(now: float) -> bool:
    while _calls and now - _calls[0] > RATE_WINDOW_S:
        _calls.popleft()
    if len(_calls) >= RATE_MAX:
        return True
    _calls.append(now)
    return False


async def async_handle_stream_source(hass: Any, verifier: Any, msg: dict[str, Any]) -> dict[str, Any]:
    """Run one signed `stream_source` request. Always answers a dict, never raises for a refusal."""
    reason = verifier.verify(msg)
    if reason:
        _LOGGER.warning("smplwise_bridge.stream_source refused: %s", reason)
        return _refuse(msg, reason)
    entity_id = msg.get("entity_id")
    if set(msg) != REQUEST_KEYS or not isinstance(entity_id, str) or not ENTITY_RE.fullmatch(entity_id) or not isinstance(msg.get("user_id"), str):
        return _refuse(msg, "invalid_request")
    if _rate_limited(time.monotonic()):
        _LOGGER.warning("smplwise_bridge.stream_source refused: rate_limited")
        return _refuse(msg, "rate_limited")
    user = await hass.auth.async_get_user(msg["user_id"])
    if user is None or not user.is_active:
        return _refuse(msg, "unknown_user")
    if not getattr(user, "is_admin", False):
        _LOGGER.warning("smplwise_bridge.stream_source refused: admin_required")
        return _refuse(msg, "admin_required")
    if hass.states.get(entity_id) is None:
        return _refuse(msg, "entity_not_found")
    try:
        ha = _ha()
        source = await asyncio.wait_for(ha.get_stream_source(hass, entity_id), READ_TIMEOUT_S)
    except Exception as exc:  # noqa: BLE001 - class name only: the text of a camera exception may carry the URL
        _LOGGER.warning("smplwise_bridge.stream_source failed: %s", type(exc).__name__)
        return _refuse(msg, type(exc).__name__)
    error = source_shape_error(source)
    if error:
        _LOGGER.warning("smplwise_bridge.stream_source refused: %s", error)
        return _refuse(msg, error)
    return {"ok": True, "request_id": msg["request_id"], "stream_source": source}
