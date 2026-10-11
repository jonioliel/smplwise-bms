"""The run guard for Arx-started runs of saved items (CR-033 slice D9, closed rule R-17).

Every run that Arx starts - an automation's "run now" (`trigger`), a script run, a scene activation (the automations
screen and the home screen's launcher), a schedule's "run now", and a script / scene / button / lock pressed on a device
tile or a map card - is judged here BEFORE anything reaches the bridge, with the same static resolver as the inventory
(services/door_path.py):

| the item | result |
|---|---|
| no WisKey door step | unchanged |
| converted (its door steps are Arx door steps, recorded for the item and its live revision) | the item runs without door steps in Home Assistant; then every door is opened through the one door path (routers/access_control.open_door: the one door authority with the REAL operator, the trusted door transport, never `execute` / `lock.unlock`), each with its own request id and audit pair; one confirmation covers the run |
| a door step that was not converted | refused: "לא ניתן להריץ: יש בפריט פתיחת דלת שלא הוסבה" (listed in the inventory) |
| a door step that cannot be resolved statically | refused: "לא ניתן להריץ: לא ניתן לזהות את הדלתות בפריט" (listed in the inventory) |

Conversion itself is slice D10a (owner decision 19: only for what the inventory finds). Until it exists no item is
converted (`CONVERSIONS` is None), so every item with a WisKey door step is refused and no inner `lock.unlock` ever
reaches a WisKey lock on an Arx-started path. The schedules' "run now" never takes the converted path: recurring
schedules move to WisKey hold-open programs (M3), whose door steps leave the schedule.

Not an Arx path and not judged here (DR-7): runs Home Assistant starts on its own (triggers, the scheduler's timer),
the WisKey panel, Home Assistant's own screens. The inventory lists the autonomous items; disabling them is an
owner-approved write run (CR-033 6.4), never done by this guard."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol

from ..errors import ApiError
from ..rbac import Principal
from . import door_authority, door_path, intercom_sync

NOT_CONVERTED = "לא ניתן להריץ: יש בפריט פתיחת דלת שלא הוסבה"
UNRESOLVABLE = "לא ניתן להריץ: לא ניתן לזהות את הדלתות בפריט"
NO_PERMISSION = "אין הרשאה לפתוח דלת זו"
USE_AUTOMATIONS = "הפריט כולל פתיחת דלת; מפעילים אותו ממסך האוטומציות."


@dataclass(frozen=True)
class ConvertedDoor:
    """One door step of a converted item: the door (station config entry id + relay) and, when known, its lock entity."""

    station_id: str
    relay: int
    entity_id: str | None = None
    path: str = ""


class ConversionSource(Protocol):
    def doors(self, conn: sqlite3.Connection, kind: str, item_id: str, revision: str | None) -> list[ConvertedDoor] | None:
        """The Arx door steps of a converted item at exactly this live revision, or None when it is not converted."""


# D10a installs the store of converted items here. None: nothing is converted yet (fail closed).
CONVERSIONS: ConversionSource | None = None


def set_conversion_source(source: ConversionSource | None) -> None:
    global CONVERSIONS
    CONVERSIONS = source


@dataclass
class RunPlan:
    """A converted item's run: the doors Arx opens itself after the item ran in the infrastructure."""

    kind: str
    item_id: str
    revision: str | None
    doors: list[ConvertedDoor] = field(default_factory=list)
    decisions: list[door_authority.DoorDecision] = field(default_factory=list)


def refusal(code: str, message: str, res: door_path.Resolution | None = None) -> ApiError:
    details: dict[str, Any] = {"listed": True}
    if res is not None:
        details["door_steps"] = len(res.door_steps)
    return ApiError(409, code, message, details=details)


def _decide(conn: sqlite3.Connection, kind: str, item_id: str, revision: str | None, res: door_path.Resolution, present: bool) -> RunPlan | None:
    converted = CONVERSIONS.doors(conn, kind, item_id, revision) if CONVERSIONS is not None else None
    if converted is not None:
        if res.has_door:
            # a door step is back in the item (edited after the conversion): the conversion no longer describes it
            raise refusal("door_step_not_converted", NOT_CONVERTED, res)
        return RunPlan(kind, item_id, revision, list(converted))
    if not present or not res.has_door:
        return None
    if not res.resolvable:
        raise refusal("door_steps_unresolvable", UNRESOLVABLE, res)
    raise refusal("door_step_not_converted", NOT_CONVERTED, res)


def judge_item(conn: sqlite3.Connection, kind: str, item_id: str) -> RunPlan | None:
    """An automation / script / scene run from Arx: None (no door: run as before), a RunPlan (converted: run, then open its
    doors), or the refusal (raised)."""
    r = door_path.Resolver(conn)
    res, row = r.resolve_item(kind, item_id)
    return _decide(conn, kind, item_id, row["revision"] if row is not None else None, res, r.present())


def judge_schedule_slot(conn: sqlite3.Connection, schedule_id: str, item: dict[str, Any], slot_index: int) -> None:
    """A schedule's "run now" of one slot: refused when that slot holds a WisKey door step (converted schedules carry none)."""
    r = door_path.Resolver(conn)
    if not r.present():
        return
    res = r.resolve_schedule_slots(item, [slot_index])
    if not res.has_door:
        return
    raise refusal("door_steps_unresolvable" if not res.resolvable else "door_step_not_converted", UNRESOLVABLE if not res.resolvable else NOT_CONVERTED, res)


def judge_entity_action(conn: sqlite3.Connection, entity_id: str, action_id: str) -> None:
    """A device tile / map card action that may run a chain: a script, a scene, a button, or a lock that is not itself a
    WisKey lock (a lock group, a template lock). Refused when it reaches a WisKey door (statically or possibly); a
    converted script or scene is run from the automations screen, where its doors are opened through the door path."""
    r = door_path.Resolver(conn)
    present = r.present()
    domain = entity_id.split(".", 1)[0]
    if action_id in ("script.turn_on", "scene.turn_on") and domain in ("script", "scene"):
        row = r.item_row(entity_id)
        if row is not None:
            plan = judge_item(conn, row["kind"], row["item_id"])
            if plan is not None:
                raise ApiError(409, "use_automations_screen", USE_AUTOMATIONS, details={"route": "/devices/automations"})
            return
        if not present:
            return
        res = door_path.Resolution()
        r.resolve_entity_item(entity_id, domain, "", (entity_id,), 1, res, frozenset({entity_id}), explicit=False)
        if res.has_door:
            raise refusal("door_steps_unresolvable" if not res.resolvable else "door_step_not_converted", UNRESOLVABLE if not res.resolvable else NOT_CONVERTED, res)
        return
    if not present or action_id not in ("button.press", "lock.unlock", "lock.open"):
        return
    res = r.resolve_actions([{"action": action_id, "target": {"entity_id": entity_id}}], "tile")
    if res.has_door:
        raise refusal("door_steps_unresolvable" if not res.resolvable else "door_step_not_converted", UNRESOLVABLE if not res.resolvable else NOT_CONVERTED, res)


def authorize_plan(conn: sqlite3.Connection, principal: Principal, plan: RunPlan, *, dev_mode: bool) -> None:
    """Every door of a converted run, judged by the one door authority with the real operator, BEFORE the run starts: one
    door the operator may not open refuses the whole run (403), nothing is sent."""
    plan.decisions = []
    for d in plan.doors:
        decision = door_authority.check(conn, principal, d.station_id, d.relay, entity_id=d.entity_id, dev_mode=dev_mode)
        if not decision.allowed:
            raise ApiError(403, "forbidden", NO_PERMISSION, details={"reason": decision.reason})
        plan.decisions.append(decision)


def open_plan_doors(request: Any, conn: sqlite3.Connection, principal: Principal, plan: RunPlan, *, origin: str, op_id: str | None, dev_mode: bool) -> list[dict[str, Any]]:
    """Open every door of a converted run that ran: each through routers/access_control.open_door (relay guard, attempt row
    committed before sending, the trusted door transport, the outcome row) with `entry_point = run`, its own request id,
    `origin` and the item's revision in the audit. Never retried; one door's refusal or unknown outcome does not stop the
    next one and is reported per door. The door authority is asked again right before each send."""
    from ..routers import access_control as ac

    out: list[dict[str, Any]] = []
    for d in plan.doors:
        station = intercom_sync.SYNC.station(d.station_id)
        name = station["name"] if station else ""
        act = ac._Action(request, conn, principal, "intercom.release", d.station_id)
        act.details.update(origin=origin, item_revision=plan.revision, run_kind=plan.kind, run_item=plan.item_id, **({"run_op_id": op_id} if op_id else {}))
        try:
            if station is None and intercom_sync.SYNC.has_copy():
                raise act.refuse(ApiError(404, "intercom_station_not_found", "התחנה לא זמינה"))
            if station is not None:
                act.details["station_name"] = station["name"]
            lock = ac._relay_of(act, station, d.relay)
            act.details["lock"] = lock
            decision = door_authority.check(conn, principal, d.station_id, lock, entity_id=d.entity_id, dev_mode=dev_mode)
            if not decision.allowed:
                raise act.refuse(ApiError(403, "forbidden", NO_PERMISSION, details={"reason": decision.reason}))
            not_after = datetime.now(timezone.utc) + timedelta(seconds=ac.SEND_WITHIN_S)
            reply = ac.open_door(act, d.station_id, lock, "run", not_after, decision)
            out.append({"door": name, "outcome": "sent", "door_request_id": reply.get("door_request_id")})
        except ApiError as exc:
            out.append({"door": name, "outcome": str(exc.details.get("outcome") or "not_sent"), "message": exc.user_message, "door_request_id": exc.details.get("door_request_id")})
    return out
