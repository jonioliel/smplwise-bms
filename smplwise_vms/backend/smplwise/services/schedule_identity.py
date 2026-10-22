"""SCHEDIMPACT-295 (Fable security review 4 of 2026-10-21, finding V-02): what an Arx-only (local) person may put into - or set going in - a
schedule, judged on the add-on side before anything is recorded or sent.

The `schedules` feature of the service identity is a BASIC-mode feature (services/service_identity.py FEATURES): its bridge item is the
schedule op (`add`, `edit`, `copy`, `run`, `enable`, ...), never the actions inside the schedule. Before this module a local person with the
`schedules` permission could therefore schedule `script.turn_on` / `scene.turn_on` of any script the schedule view classes as "ordinary" - and
the Scheduler component then runs it - under the service user, with neither the runnable allowlist nor the bridge's impact check: the reach the
extended-mode run fences were built to bound. The same door was open for the other never-list pairs (`lock.unlock`, `lock.open`,
`alarm_arm_custom_bypass`), which a local person may not call directly in the basic mode.

The rule, for a LOCAL principal only (a Home Assistant user's schedule is untouched, and so is `schedule_ops.mark_script`), applied to every
action of the content a write would make run - the draft of a create / update, the copied / split / restored content, the CURRENT content of
an enable or a run-now (never to a disable or a delete, which stop things):
1. every action is judged like a direct `execute` of its (domain, service) pair against the never-list of the current mode
   (service_identity.never_list): in the basic mode a script, a scene, a door unlock / open and arming with the bypass set are refused;
2. an action that runs a script / scene / automation (by its service domain OR by its entity's domain) must have the plain shape
   `script.turn_on` + `script.<id>` or `scene.turn_on` + `scene.<id>`; anything else (an automation, `script.<object id>` as a service, a
   service of another domain aimed at a script) is refused - fail closed;
3. in the extended mode such a run item needs exactly what a direct run needs: the add-on's runnable allowlist, the bridge's copy of it (as
   reported), the bridge's own copy of the extended switch, and a bridge that announced the schedule fences (`schedule_fences` in its signed
   directory push, see note_directory_push) - the bridge then applies its allowlist and the impact check (runnable.impact_refusal, one nested
   level) itself, independently of this module, when the schedule is written and when it is copied, run or enabled.
Refusals are ApiErrors with a closed code, audited `identity.service_identity.refused` (ids only); an allowed extended run item is audited
`identity.service_identity.extended` with the entity ids.
"""
from __future__ import annotations

import re
import sqlite3
from typing import Any, Iterable

from ..db import get_setting, set_setting
from ..audit import audit
from ..errors import ApiError
from ..rbac import Principal
from . import service_identity as si

# the bridge's signed directory push says it judges a local person's schedules (bridge schedule_fence.py); an older bridge sends no key
CAPABILITY_SETTING = "bridge.schedule_fences"
RUN_DOMAINS = frozenset({"script", "scene", "automation"})
SERVICE_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
ENTITY_RE = SERVICE_RE
FEATURE = "schedules"
BRIDGE_SERVICE = "schedule"

MESSAGES = {
    "service_identity_schedule_bridge_outdated": "נדרש עדכון של רכיב החיבור כדי שמשתמשי Arx יוכלו לתזמן סקריפטים וסצנות.",
}


def note_directory_push(conn: sqlite3.Connection, message: dict[str, Any]) -> None:
    """The bridge's signed directory push names whether it carries the schedule fences (`schedule_fences: true`). State only, never a
    request; a push without the key (an older bridge) = no fences = a local person's script / scene schedule is never sent."""
    if not isinstance(message, dict) or "service_identity" not in message:
        return
    new = "true" if message.get("schedule_fences") is True else "false"
    if new != (get_setting(conn, CAPABILITY_SETTING) or ""):
        set_setting(conn, CAPABILITY_SETTING, new)
        audit(conn, actor=None, action="bridge.schedule_fences_seen", decision="allowed", resource_type="installation", resource_id="service_identity",
              details={"schedule_fences": new == "true"})


def bridge_has_fences(conn: sqlite3.Connection) -> bool:
    try:
        return (get_setting(conn, CAPABILITY_SETTING) or "") == "true"
    except sqlite3.OperationalError:
        return False


def actions_of(content: dict[str, Any] | None) -> list[tuple[Any, Any]]:
    """(service, entity_id) of every action of a draft or a normalised schedule (both carry `slots[].actions[]`)."""
    out: list[tuple[Any, Any]] = []
    slots = (content or {}).get("slots") if isinstance(content, dict) else None
    for slot in slots if isinstance(slots, list) else []:
        actions = slot.get("actions") if isinstance(slot, dict) else None
        if not isinstance(actions, list):
            out.append((None, None))  # a shape this check cannot read: judged as an unknown action (refused for a local person)
            continue
        for a in actions:
            out.append((a.get("service"), a.get("entity_id")) if isinstance(a, dict) else (None, None))
    return out


def _refuse(conn: sqlite3.Connection, principal: Principal, code: str, status: int, *, op: str, reason: str, request_id: str | None) -> ApiError:
    err = si._refuse(conn, principal, principal.user_id, code, status, feature=FEATURE, bridge_service=BRIDGE_SERVICE, item=op, request_id=request_id, reason=reason)
    if code in MESSAGES:
        return ApiError(status, code, MESSAGES[code], details={"feature": FEATURE})
    return err


def run_items(actions: Iterable[tuple[Any, Any]], extended: bool) -> tuple[list[tuple[str, str]], str | None]:
    """The (kind, entity id) of every action that runs a script / scene / automation, or (_, the refusal reason) - pure, no I/O."""
    runs: list[tuple[str, str]] = []
    for service, entity in actions:
        svc = service.strip().lower() if isinstance(service, str) else ""
        if not SERVICE_RE.fullmatch(svc):
            return runs, "schedule_action_unknown"
        domain, name = svc.split(".", 1)
        if si.never_local("execute", (domain, name), extended):
            return runs, "schedule_never_local"
        ent = entity.strip().lower() if isinstance(entity, str) and entity.strip() else None
        if ent is not None and not ENTITY_RE.fullmatch(ent):
            return runs, "schedule_action_unknown"
        ent_kind = ent.split(".", 1)[0] if ent else None
        if domain in RUN_DOMAINS or ent_kind in RUN_DOMAINS:
            if (domain, name) not in si.SCRIPT_SCENE_PAIRS or ent_kind != domain:
                return runs, "schedule_run_shape"
            runs.append((domain, ent))  # type: ignore[arg-type]
    return runs, None


def check(conn: sqlite3.Connection, principal: Principal, content: dict[str, Any] | None, *, op: str, request_id: str | None) -> None:
    """Raise (audited) when a local principal's schedule content may not run; return for everyone else. See the module docstring."""
    if not si.is_local(principal):
        return
    extended = si.extended_on(conn)
    runs, why = run_items(actions_of(content), extended)
    if why:
        raise _refuse(conn, principal, "service_identity_refused", 403, op=op, reason=why, request_id=request_id)
    if not runs:
        return
    if not extended:  # unreachable while script.turn_on / scene.turn_on are on the basic never-list; kept so the rule never rests on the table
        raise _refuse(conn, principal, "service_identity_refused", 403, op=op, reason="schedule_run_basic", request_id=request_id)
    for kind, entity_id in runs:
        if si.runnable_refusal(conn, kind, entity_id) is not None:
            raise _refuse(conn, principal, "service_identity_not_runnable", 403, op=op, reason="not_runnable", request_id=request_id)
    if (get_setting(conn, si.BRIDGE_EXTENDED) or "") != "true":
        raise _refuse(conn, principal, "service_identity_extended_bridge_off", 503, op=op, reason="bridge_extended_off", request_id=request_id)
    bridge_ids = si.bridge_runnable_ids(conn)
    if any(entity_id not in bridge_ids for _kind, entity_id in runs):
        raise _refuse(conn, principal, "service_identity_runnable_bridge_missing", 503, op=op, reason="bridge_runnable_missing", request_id=request_id)
    if not bridge_has_fences(conn):
        raise _refuse(conn, principal, "service_identity_schedule_bridge_outdated", 503, op=op, reason="bridge_without_schedule_fences", request_id=request_id)
    audit(conn, actor=principal, action="identity.service_identity.extended", decision="allowed", resource_type="user", resource_id=principal.user_id,
          request_id=request_id, details={"feature": FEATURE, "bridge_service": BRIDGE_SERVICE, "item": op, "entity_ids": sorted({e for _k, e in runs})})
