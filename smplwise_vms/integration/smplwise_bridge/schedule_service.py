"""The `smplwise_bridge.schedule` service (CR-014, bridge 0.3.0): writes to the Scheduler component on behalf of a VMS
user, after the add-on's own checks and independently of them.

Kept apart from `__init__.py` so it can be unit-tested without Home Assistant installed: Home Assistant is imported
lazily (`_ha()`), everything else is duck-typed (`hass.auth`, `hass.services`, `hass.states`, an entity registry).

The order of the checks (contract 8.3): signature / replay window -> active HA user -> op allow-list -> closed schema
and caps (schedule_policy.py) -> every action entity exists with the service's domain -> sensitive flag consistency ->
non-admin entity permission (control) -> for every op but `add` the registry entry of the schedule's own switch (platform
`scheduler`, unique_id == schedule_id) -> the component call with `Context(user_id)`.

Never called from here: the component's `enable_all`, `disable_all`, `reload_storage`, or its HTTP views. Errors are
class names or fixed codes; payloads, names, values and exception texts are never logged or returned.
"""
from __future__ import annotations

import asyncio
import logging
import math
from types import SimpleNamespace
from typing import Any, Mapping

from . import schedule_policy as policy

_LOGGER = logging.getLogger(__name__)

SCHEDULER_DOMAIN = "scheduler"
SCHEDULER_PLATFORM = "scheduler"

# op -> (domain, service) of the ONE component call it makes. Nothing else is ever called.
COMPONENT_CALLS: dict[str, tuple[str, str]] = {
    "add": (SCHEDULER_DOMAIN, "add"),
    "edit": (SCHEDULER_DOMAIN, "edit"),
    "remove": (SCHEDULER_DOMAIN, "remove"),
    "copy": (SCHEDULER_DOMAIN, "copy"),
    "run": (SCHEDULER_DOMAIN, "run_action"),
    "enable": ("switch", "turn_on"),
    "disable": ("switch", "turn_off"),
}

# how the new id of an add / copy is learned (the component's add / copy do not return it): registry diff (contract 8.4)
ID_POLL_INTERVAL_S = 0.25
ID_POLL_TIMEOUT_S = 5.0

_PERMISSION_UNAVAILABLE = "permission_check_unavailable"


def _ha() -> SimpleNamespace:
    """Home Assistant symbols, imported on first use so this module imports without Home Assistant (unit tests
    monkeypatch this function). A missing POLICY_CONTROL means the permission API changed: fail closed."""
    from homeassistant.core import Context
    from homeassistant.exceptions import ServiceValidationError, Unauthorized

    try:
        from homeassistant.auth.permissions.const import POLICY_CONTROL
    except ImportError:
        POLICY_CONTROL = None
    return SimpleNamespace(Context=Context, Unauthorized=Unauthorized, ServiceValidationError=ServiceValidationError, POLICY_CONTROL=POLICY_CONTROL)


def _registry(hass: Any) -> Any:
    from homeassistant.helpers import entity_registry as er

    return er.async_get(hass)


def _refuse(msg: Mapping[str, Any], error: str, path: str | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"ok": False, "request_id": msg.get("request_id"), "error": error}
    if path:
        out["path"] = path
    return out


def _scheduler_entries(registry: Any) -> dict[str, str]:
    """{unique_id (= schedule_id): entity_id} of every switch of the scheduler platform in the entity registry."""
    entries = getattr(registry, "entities", None)
    if entries is None:
        return {}
    return {
        str(e.unique_id): e.entity_id
        for e in list(entries.values())
        if getattr(e, "platform", None) == SCHEDULER_PLATFORM and str(getattr(e, "entity_id", "")).startswith("switch.")
    }


def _check_permissions(user: Any, ha: SimpleNamespace, entity_ids: list[str]) -> str | None:
    """None when the person may control every entity (an administrator always may), else the refusal code. The
    component's add / edit are plain services, not entity services, so Home Assistant would not check the entities
    named inside the payload: this check does, with the user's own policy (contract 8.3 item 6)."""
    if getattr(user, "is_admin", False):
        return None
    check = getattr(getattr(user, "permissions", None), "check_entity", None)
    if not callable(check) or ha.POLICY_CONTROL is None:
        return _PERMISSION_UNAVAILABLE
    for entity_id in entity_ids:
        try:
            allowed = check(entity_id, ha.POLICY_CONTROL)
        except Exception:  # noqa: BLE001 - an API that raises is an API we cannot rely on: closed
            return _PERMISSION_UNAVAILABLE
        if not allowed:
            return "unauthorized"
    return None


async def _learn_new_id(registry: Any, before: dict[str, str]) -> tuple[str | None, str | None]:
    """The one schedule that appeared in the registry since `before` -> (schedule_id, entity_id); (None, None) when none
    or more than one appeared within the window (another schedule may have been created at the same time: never guess)."""
    attempts = max(1, math.ceil(ID_POLL_TIMEOUT_S / ID_POLL_INTERVAL_S)) if ID_POLL_INTERVAL_S > 0 else 1
    for attempt in range(attempts + 1):
        now = _scheduler_entries(registry)
        new = {sid: eid for sid, eid in now.items() if sid not in before}
        if len(new) == 1:
            sid, eid = next(iter(new.items()))
            return sid, eid
        if len(new) > 1:
            return None, None
        if attempt < attempts:
            await asyncio.sleep(ID_POLL_INTERVAL_S)
    return None, None


def _component_data(msg: Mapping[str, Any], op: str) -> dict[str, Any]:
    """The service data of the one component call. Built from the validated message only."""
    payload = dict(msg.get("payload") or {})
    if op == "add":
        return payload
    entity_id = msg["schedule_entity_id"]
    if op == "edit":
        return {"entity_id": entity_id, **payload}
    if op == "copy":
        return {"entity_id": entity_id, "name": msg["name"]}
    if op == "run":
        data: dict[str, Any] = {"entity_id": entity_id, "skip_conditions": bool(msg.get("skip_conditions", False))}
        if msg.get("time") is not None:
            data["time"] = msg["time"]
        return data
    return {"entity_id": entity_id}  # remove, enable, disable


async def async_handle_schedule(hass: Any, verifier: Any, msg: dict[str, Any]) -> dict[str, Any]:
    """Run one signed `schedule` request. Always answers a dict, never raises for a refusal."""
    reason = verifier.verify(msg)
    if reason:
        _LOGGER.warning("smplwise_bridge.schedule refused: %s", reason)
        return _refuse(msg, reason)
    user = await hass.auth.async_get_user(msg["user_id"])
    if user is None or not user.is_active:
        return _refuse(msg, "unknown_user")
    op = msg.get("op")
    if op not in policy.OPS:
        return _refuse(msg, "op_not_allowed", "op")
    try:
        refs = policy.validate_message(msg)
    except policy.PolicyError as exc:
        _LOGGER.warning("smplwise_bridge.schedule %s refused: %s", op, exc.code)
        return _refuse(msg, exc.code, exc.path)

    # every action entity exists with its service's domain; sensitive actions carry the sensitive flag
    sensitive_flag = bool(msg.get("sensitive", False))
    for ref in refs:
        state = hass.states.get(ref.entity_id)
        if state is None:
            return _refuse(msg, "entity_not_found", f"{ref.path}.entity_id")
        if not sensitive_flag and policy.sensitive_required(ref.domain, ref.service, getattr(state, "attributes", None)):
            return _refuse(msg, "sensitive_flag_mismatch", ref.path)

    ha = _ha()
    registry = _registry(hass)

    # the schedule's own switch (every op but add): platform scheduler, unique_id == schedule_id
    schedule_entity = msg.get("schedule_entity_id")
    if op != "add":
        entry = registry.async_get(schedule_entity)
        if entry is None or getattr(entry, "platform", None) != SCHEDULER_PLATFORM or str(getattr(entry, "unique_id", "")) != msg["schedule_id"]:
            return _refuse(msg, "not_a_schedule", "schedule_entity_id")

    # permissions: the action entities of an add / edit, and the schedule's own switch for every op but add
    # (the switch check is stricter than the contract's minimum: enable / disable is an entity service anyway, and
    # remove / copy / run act on that switch, so a person who may not control it may not do these either)
    to_check = list(dict.fromkeys([r.entity_id for r in refs] + ([schedule_entity] if op != "add" else [])))
    refusal = _check_permissions(user, ha, to_check)
    if refusal:
        _LOGGER.warning("smplwise_bridge.schedule %s refused: %s", op, refusal)
        return _refuse(msg, refusal)

    domain, service = COMPONENT_CALLS[op]
    if not hass.services.has_service(domain, service):
        return _refuse(msg, "scheduler_missing")

    before = _scheduler_entries(registry) if op in ("add", "copy") else {}
    context = ha.Context(user_id=user.id)
    try:
        await hass.services.async_call(domain, service, _component_data(msg, op), blocking=True, context=context)
    except ha.Unauthorized:
        return _refuse(msg, "unauthorized")
    except Exception as exc:  # noqa: BLE001 - class name only: the text may carry names or values
        _LOGGER.warning("smplwise_bridge.schedule %s failed: %s", op, type(exc).__name__)
        return _refuse(msg, type(exc).__name__)

    out: dict[str, Any] = {"ok": True, "request_id": msg["request_id"], "context_id": context.id, "schedule_id": msg.get("schedule_id"), "entity_id": schedule_entity}
    if op in ("add", "copy"):
        sid, eid = await _learn_new_id(registry, before)
        out["schedule_id"], out["entity_id"] = sid, eid
        if sid is None:
            out["error"] = "id_unknown"
    return out
