"""The `smplwise_bridge.cast_stream` service (bridge 0.7.0, CR-028 phase 1): play the add-on's relay URL on ONE Google Cast media_player,
stop it, or switch it off - as the caller's own Home Assistant user, and only after cast_policy.py agreed independently of the add-on.

The cast origin comes from the paired add-on itself: its answer to every user-directory push carries `cast`, a message signed with the
pairing secret under the purpose `cast_origin` (`note_origin`); a missing, stale or forged one leaves the origin unknown and every
`play` is refused. The addresses of this host are read from Home Assistant's network integration (`_local_addresses`).

Order of the checks: signature / replay window -> rate limit -> the request's shape and the target (cast_policy) -> active user -> the
one service call with `Context(user_id)`. Nothing is logged but the refusal code; the URL (its path is the token) never is.

Kept apart from `__init__.py` so it can be tested without Home Assistant installed: Home Assistant is imported lazily."""
from __future__ import annotations

import logging
import time
from collections import deque
from typing import Any

from . import cast_policy

_LOGGER = logging.getLogger(__name__)

RATE_WINDOW_S = 60.0
RATE_MAX = 30  # all cast calls together, per minute (a start, a switch, a stop and an off per cast at most)
CALL_TIMEOUT_S = 20.0

STATE: dict[str, Any] = {"origin": None, "origin_at": None}
_calls: deque[float] = deque()


def note_origin(verifier: Any, block: Any) -> None:
    """The add-on's signed `cast` block from a directory answer: `{purpose: "cast_origin", cast_origin: str|null, ts, nonce, sig}`."""
    if not isinstance(block, dict) or block.get("purpose") != "cast_origin" or set(block) != {"purpose", "cast_origin", "ts", "nonce", "sig"}:
        return
    if verifier.verify(dict(block)):
        return
    origin = block.get("cast_origin")
    STATE["origin"] = origin if cast_policy.origin_netloc(origin) else None
    STATE["origin_at"] = time.time()


def _rate_limited(now: float) -> bool:
    while _calls and now - _calls[0] > RATE_WINDOW_S:
        _calls.popleft()
    if len(_calls) >= RATE_MAX:
        return True
    _calls.append(now)
    return False


async def _local_addresses(hass: Any) -> list[str] | None:
    """Every IP address of this host's network adapters (Home Assistant's network integration); None when it cannot be read."""
    try:
        from homeassistant.components import network

        adapters = await network.async_get_adapters(hass)
    except Exception as exc:  # noqa: BLE001
        _LOGGER.warning("smplwise_bridge.cast_stream: the host addresses could not be read (%s)", type(exc).__name__)
        return None
    out: list[str] = []
    for adapter in adapters or []:
        for key in ("ipv4", "ipv6"):
            for entry in adapter.get(key) or []:
                address = entry.get("address") if isinstance(entry, dict) else None
                if address:
                    out.append(str(address).split("%", 1)[0])
    return out


def _refuse(msg: dict[str, Any], error: str) -> dict[str, Any]:
    request_id = msg.get("request_id")
    return {"ok": False, "request_id": request_id if isinstance(request_id, str) else None, "error": error}


async def async_handle_cast_stream(hass: Any, verifier: Any, msg: dict[str, Any], platform_of: Any, call_service: Any = None) -> dict[str, Any]:
    """Run one signed cast_stream request. Always answers a dict, never raises for a refusal. `platform_of(entity_id)` is the registry
    platform; `call_service(domain, service, data, context)` (tests) defaults to hass.services.async_call."""
    reason = verifier.verify(msg)
    if reason:
        _LOGGER.warning("smplwise_bridge.cast_stream refused: %s", reason)
        return _refuse(msg, reason)
    if _rate_limited(time.monotonic()):
        _LOGGER.warning("smplwise_bridge.cast_stream refused: rate_limited")
        return _refuse(msg, "rate_limited")
    local = await _local_addresses(hass) if msg.get("op") == "play" else []
    blocked = cast_policy.refusal(msg, platform_of, STATE["origin"], local)
    if blocked:
        _LOGGER.warning("smplwise_bridge.cast_stream refused: %s", blocked)
        return _refuse(msg, blocked)
    user = await hass.auth.async_get_user(msg["user_id"])
    if user is None or not user.is_active:
        return _refuse(msg, "unknown_user")
    domain, service, data = cast_policy.service_call(msg)
    try:
        from homeassistant.core import Context

        context = Context(user_id=user.id)
    except ImportError:  # unit tests without Home Assistant
        context = None
    try:
        if call_service is not None:
            await call_service(domain, service, data, context)
        else:
            import asyncio

            await asyncio.wait_for(hass.services.async_call(domain, service, data, blocking=True, context=context), CALL_TIMEOUT_S)
    except Exception as exc:  # noqa: BLE001 - the class name only (an exception text could echo the URL)
        name = type(exc).__name__
        _LOGGER.warning("smplwise_bridge.cast_stream %s failed: %s", msg.get("op"), name)
        return _refuse(msg, "unauthorized" if name == "Unauthorized" else name)
    return {"ok": True, "request_id": msg["request_id"], "context_id": getattr(context, "id", None)}
