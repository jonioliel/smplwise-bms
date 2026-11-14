"""Durable pages over the original event store; explicit retention gaps/reset.

A page is returned only after its exact immutable image is persisted. Delivery
is at least once. Event IDs deduplicate; cursor order is original acceptance,
not device timestamps or recovery timestamps.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import weakref
from copy import deepcopy
from datetime import UTC, datetime

import voluptuous as vol
from homeassistant.components import websocket_api

from .access.models import AccessError
from .bridge_command_auth import host_for, send_bridge_result
from .const import DOMAIN
from .trusted_actions.validation import Refusal

COMMAND = "events/resume_v1"
CONTRACT = "wiskey-event-cursor.v1"
_REGISTERED = weakref.WeakKeyDictionary()


def restore_resume(manager, data):
    state = data.get("durable_resume") if data else None
    if state is None:
        for key in manager.cache.rows:
            manager.resume_sequence += 1
            manager.resume_positions[key] = manager.resume_sequence
        return
    if (
        type(state) is not dict
        or set(state) != {"schema_version", "source", "sequence", "positions"}
        or state["schema_version"] != 1
        or type(state["sequence"]) is not int
        or not 0 <= state["sequence"] < 2**53
        or not isinstance(state["source"], str)
        or re.fullmatch("[0-9a-f]{32}", state["source"]) is None
        or type(state["positions"]) is not dict
    ):
        raise AccessError("invalid_storage")
    positions = state["positions"]
    if (
        any(type(v) is not int or not 1 <= v <= state["sequence"] for v in positions.values())
        or len(set(positions.values())) != len(positions)
        or any(key not in positions for key in manager.cache.rows)
    ):
        raise AccessError("invalid_storage")
    manager.resume_source, manager.resume_sequence = state["source"], state["sequence"]
    manager.resume_positions = {key: positions[key] for key in manager.cache.rows}


def cursor(manager, sequence):
    prefix = f"{manager.resume_source}.{sequence}"
    return prefix + "." + hmac.new(manager.key, prefix.encode(), hashlib.sha256).hexdigest()


def decode(manager, value):
    if type(value) is not str or len(value) > 160:
        raise Refusal("invalid_cursor")
    parts = value.split(".")
    if len(parts) != 3 or not parts[1].isdigit() or len(parts[1]) > 16:
        raise Refusal("invalid_cursor")
    if parts[0] != manager.resume_source:
        return None
    sequence = int(parts[1])
    if not hmac.compare_digest(cursor(manager, sequence), value):
        raise Refusal("invalid_cursor")
    return sequence


async def resume(manager, value, limit):
    if type(limit) is not int or not 1 <= limit <= 500:
        raise Refusal("invalid_fields")
    position = 0 if value is None else decode(manager, value)
    async with manager._save_lock:
        if manager._closing:
            raise Refusal("event_source_closed")
        manager.cache.prune(datetime.now(UTC))
        data = deepcopy(manager._data())
        revision = manager._revision
        # No catch-and-return-success on a failed durable write.
        await manager.store.async_save(data)
        manager._saved = revision
        manager.storage_failed = False
    state = data["durable_resume"]
    high = state["sequence"]
    ordered = sorted((seq, key) for key, seq in state["positions"].items())
    rows = {row["id"]: row for row in data["records"]}
    retained = [seq for seq, _key in ordered]
    reset = (
        "source_replaced"
        if position is None
        else "cursor_ahead"
        if position > high
        else "retention_gap"
        if any(
            seq not in set(retained) for seq in range(position + 1, min(high, position + 501) + 1)
        )
        else None
    )
    if reset:
        return {
            "contract": CONTRACT,
            "schema_version": 1,
            "state": "reset_required",
            "reason": reset,
            "records": [],
            "cursor": value,
            "reset_cursor": cursor(manager, high),
            "has_more": False,
            "all_delivered": False,
            "source": state["source"],
        }
    page = [(seq, key) for seq, key in ordered if seq > position][:limit]
    end = page[-1][0] if page else position
    return {
        "contract": CONTRACT,
        "schema_version": 1,
        "state": "page",
        "reason": None,
        "records": [{"sequence": seq, "event": rows[key]} for seq, key in page],
        "cursor": cursor(manager, end),
        "reset_cursor": None,
        "has_more": end < high,
        "all_delivered": end == high,
        "source": state["source"],
    }


@websocket_api.websocket_command(
    vol.All(vol.Schema({"type": DOMAIN + "/" + COMMAND}, extra=vol.ALLOW_EXTRA))
)
@websocket_api.async_response
async def handle(hass, connection, message):
    try:
        principal = await host_for(hass).admit(connection, message, COMMAND)
        parameters = principal.parameters
        if set(parameters) != {"cursor", "limit"}:
            raise Refusal("invalid_fields")
        manager = hass.data[DOMAIN]["events"]
        result = await resume(manager, parameters["cursor"], parameters["limit"])
        principal.check()
        send_bridge_result(connection, message["id"], result)
    except (Refusal, AccessError) as error:
        connection.send_error(message["id"], error.code, "Event resume refused")


def register(hass):
    websocket_api.async_register_command(hass, handle)
    _REGISTERED[hass] = hass.data[websocket_api.DOMAIN][DOMAIN + "/" + COMMAND]


def registered(hass):
    original = _REGISTERED.get(hass)
    return (
        (COMMAND,)
        if original is not None
        and hass.data[websocket_api.DOMAIN].get(DOMAIN + "/" + COMMAND) is original
        else ()
    )
