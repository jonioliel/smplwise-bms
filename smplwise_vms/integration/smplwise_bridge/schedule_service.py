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
import contextlib
import logging
import math
import re
import time
import weakref
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

# After an add / copy whose new id could not be learned the component may still register that switch a moment later;
# a following create would then see it as its own. For this long every learned id is answered id_unknown instead.
SUSPECT_WINDOW_S = 30.0


class _CreateState:
    """Per Home Assistant instance: one lock for the whole add / copy (snapshot -> component call -> id learning), so two
    creates can never interleave, and the moment of the last unresolved create."""

    def __init__(self) -> None:
        self.lock = asyncio.Lock()
        self.unresolved_at: float | None = None


_STATES: "weakref.WeakKeyDictionary[Any, _CreateState]" = weakref.WeakKeyDictionary()
_STATES_BY_ID: dict[int, _CreateState] = {}  # only for a hass object that cannot be weakly referenced


def _create_state(hass: Any) -> _CreateState:
    try:
        state = _STATES.get(hass)
        if state is None:
            state = _STATES[hass] = _CreateState()
        return state
    except TypeError:
        return _STATES_BY_ID.setdefault(id(hass), _CreateState())


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


_CLOCK_RE = re.compile(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$")
_SUN_RE = re.compile(r"^(sunrise|sunset)([+-])(\d{1,2}):(\d{2})(?::(\d{2}))?$")
_NO_STOP = {"", "none", "null"}


def _norm_time(value: Any) -> str:
    """One spelling for a time: HH:MM and HH:MM:SS are the same, so are sunset+00:30 and sunset+00:30:00."""
    v = str(value).strip().lower()
    m = _CLOCK_RE.match(v)
    if m:
        return f"{int(m.group(1)):02d}:{m.group(2)}:{m.group(3) or '00'}"
    m = _SUN_RE.match(v)
    if m:
        return f"{m.group(1)}{m.group(2)}{int(m.group(3)):02d}:{m.group(4)}:{m.group(5) or '00'}"
    return v


def _slot_times(start: Any, stop: Any) -> tuple[str, str | None]:
    no_stop = stop is None or str(stop).strip().lower() in _NO_STOP
    return _norm_time(start), None if no_stop else _norm_time(stop)


def payload_fingerprint(payload: Mapping[str, Any]) -> dict[str, Any]:
    """What the new switch's state attributes must say about a schedule created from `payload`: the weekdays, each slot's
    (start, stop) - a slot without a stop is a point action - and the service of each slot's first action (the
    `actions` attribute). None of it is a name: the switch's friendly name is "Scheduler " + name, not the name."""
    slots = payload.get("timeslots") or []
    return {
        "weekdays": sorted(str(d) for d in (payload.get("weekdays") or [])),
        "timeslots": [_slot_times(t.get("start"), t.get("stop")) for t in slots],
        "actions": [str(((t.get("actions") or [{}])[0]).get("service")) for t in slots],
    }


def attributes_fingerprint(attributes: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """The same three facts read from a schedule switch's state attributes; None when they are not all there."""
    a = attributes or {}
    weekdays, timeslots, actions = a.get("weekdays"), a.get("timeslots"), a.get("actions")
    if not isinstance(weekdays, (list, tuple)) or not isinstance(timeslots, (list, tuple)) or not isinstance(actions, (list, tuple)):
        return None
    services = [str(x.get("service")) if isinstance(x, Mapping) else "None" for x in actions]
    slots: list[tuple[str, str | None]] = []
    for t in timeslots:  # "HH:MM:SS - HH:MM:SS", or "HH:MM:SS" alone for a point action
        start, _sep, stop = str(t).partition(" - ")
        slots.append(_slot_times(start, stop))
    return {"weekdays": sorted(str(d) for d in weekdays), "timeslots": slots, "actions": services}


async def _learn_new_id(hass: Any, registry: Any, before: dict[str, str], expected: dict[str, Any] | None) -> tuple[str | None, str | None]:
    """The one schedule that appeared in the registry since `before` and whose switch says what was created ->
    (schedule_id, entity_id); (None, None) when none, more than one, or one whose content does not match `expected` appears
    within the window (never guess: a create of another person may be registering at the same time)."""
    attempts = max(1, math.ceil(ID_POLL_TIMEOUT_S / ID_POLL_INTERVAL_S)) if ID_POLL_INTERVAL_S > 0 else 1
    for attempt in range(attempts + 1):
        now = _scheduler_entries(registry)
        new = {sid: eid for sid, eid in now.items() if sid not in before}
        if len(new) > 1:
            return None, None
        if len(new) == 1:
            sid, eid = next(iter(new.items()))
            state = hass.states.get(eid)
            if state is not None:  # a registered switch whose state is not there yet is waited for
                seen = attributes_fingerprint(getattr(state, "attributes", None))
                return (sid, eid) if (expected is not None and seen == expected) else (None, None)
        if attempt < attempts:
            await asyncio.sleep(ID_POLL_INTERVAL_S)
    return None, None


def _component_data(msg: Mapping[str, Any], op: str) -> dict[str, Any]:
    """The service data of the one component call. Built from the validated message only."""
    payload = policy.normalize_payload(msg.get("payload") or {}) if op in ("add", "edit") else {}
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

    context = ha.Context(user_id=user.id)
    creating = op in ("add", "copy")
    state = _create_state(hass)
    # add / copy: one at a time per instance, from the snapshot to the learned id (the component registers the new
    # switch AFTER its service returns, so an interleaved create would otherwise be mistaken for ours)
    async with (state.lock if creating else contextlib.nullcontext()):
        before = _scheduler_entries(registry) if creating else {}
        if op == "add":
            expected: dict[str, Any] | None = payload_fingerprint(msg["payload"])
        elif op == "copy":
            source = hass.states.get(schedule_entity)
            expected = attributes_fingerprint(getattr(source, "attributes", None)) if source is not None else None
        else:
            expected = None
        try:
            await hass.services.async_call(domain, service, _component_data(msg, op), blocking=True, context=context)
        except ha.Unauthorized:
            return _refuse(msg, "unauthorized")
        except Exception as exc:  # noqa: BLE001 - class name only: the text may carry names or values
            _LOGGER.warning("smplwise_bridge.schedule %s failed: %s", op, type(exc).__name__)
            return _refuse(msg, type(exc).__name__)

        out: dict[str, Any] = {"ok": True, "request_id": msg["request_id"], "context_id": context.id, "schedule_id": msg.get("schedule_id"), "entity_id": schedule_entity}
        if creating:
            sid, eid = await _learn_new_id(hass, registry, before, expected)
            if sid is None:
                state.unresolved_at = time.monotonic()  # only a create whose own id could not be learned opens (or renews) the window
            elif state.unresolved_at is not None and time.monotonic() - state.unresolved_at < SUSPECT_WINDOW_S:
                sid = eid = None  # learned and matching, but the earlier create's switch may still be arriving: withheld, window NOT renewed
            out["schedule_id"], out["entity_id"] = sid, eid
            if sid is None:
                out["error"] = "id_unknown"
    return out


_PLAIN_ENTITY_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
# Home Assistant service targets other than entity_id: each reaches every entity of an area / label / device / floor,
# scheduler switches included (not filtered for an administrator). The add-on never sends them; the bridge refuses them.
FORBIDDEN_EXECUTE_TARGET_KEYS = frozenset({"area_id", "label_id", "device_id", "floor_id"})
GROUP_DEPTH = 5


def _is_scheduler_switch(registry: Any, entity_id: str) -> bool:
    entry = registry.async_get(entity_id)
    if entry is None:
        return entity_id.startswith("switch.schedule_")
    return getattr(entry, "platform", None) == SCHEDULER_PLATFORM


def _members_refusal(hass: Any, registry: Any, entity_id: str, depth: int, seen: set[str]) -> str | None:
    """Refusal when `entity_id` is, or is a group (a state carrying an `entity_id` member list) containing, a scheduler
    switch. A group that cannot be read (members of a type we do not understand, nesting too deep, a cycle we cannot
    finish) is refused too: closed."""
    if _is_scheduler_switch(registry, entity_id):
        return "scheduler_switch_not_allowed"
    if entity_id in seen:
        return None
    seen.add(entity_id)
    state = hass.states.get(entity_id)
    members = (getattr(state, "attributes", None) or {}).get("entity_id") if state is not None else None
    if members is None:
        return None
    if isinstance(members, str):
        members = [members]
    if not isinstance(members, (list, tuple)):
        return "scheduler_group_unverifiable"
    if depth >= GROUP_DEPTH:
        return "scheduler_group_unverifiable"
    for member in members:
        if not isinstance(member, str) or not _PLAIN_ENTITY_RE.match(member):
            return "scheduler_group_unverifiable"
        refusal = _members_refusal(hass, registry, member, depth + 1, seen)
        if refusal:
            return refusal
    return None


def execute_refusal(hass: Any, data: Any) -> str | None:
    """Defence in depth for `smplwise_bridge.execute`: the Scheduler component's own switches are operated only through
    the schedule service. `data` is the service data of the signed call. Returns the refusal code, or None when the call
    may go on. Refuses: an area / label / device / floor target; an entity that is a scheduler switch (registry platform,
    or a state-only `switch.schedule_*` id) or a group with one among its members; a target that is not a plain entity id
    ("all", a template, a nested value). Fails closed when the registry cannot be read."""
    if not isinstance(data, Mapping):
        return "invalid_entity_id"
    if FORBIDDEN_EXECUTE_TARGET_KEYS & set(map(str, data)):
        return "target_not_allowed"
    entity_id = data.get("entity_id")
    if isinstance(entity_id, str):
        targets: list[Any] = [x.strip() for x in entity_id.split(",")]
    elif isinstance(entity_id, (list, tuple)):
        targets = list(entity_id)
    else:
        return "invalid_entity_id"
    if not targets:
        return "invalid_entity_id"
    try:
        registry = _registry(hass)
    except Exception:  # noqa: BLE001
        return "entity_registry_unavailable"
    for target in targets:
        if not isinstance(target, str) or not _PLAIN_ENTITY_RE.match(target):
            return "invalid_entity_id"
        try:
            refusal = _members_refusal(hass, registry, target, 0, set())
        except Exception:  # noqa: BLE001 - a state or registry we cannot read is a refusal
            return "scheduler_group_unverifiable"
        if refusal:
            return refusal
    return None
