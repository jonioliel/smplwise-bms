"""CR-INFRA-ELEVATORS - elevators under Infrastructure: storage helpers, sensor validation and the derived state.

An elevator maps up to six binary-sensor ROLES (moving_up, moving_down, waiting, fault, door_open, out_of_service) and up to four free
labelled extras onto the state mirror (`ha_entities`). Nothing is stored about the live state: it is derived on every read.

Derived state, highest priority first (docs/changes/CR-INFRA-ELEVATORS.md section 3):

    fault > out_of_service > moving (up | down) > door_open > waiting > unknown

* A sensor counts only when its mirrored state is a live `on` / `off`; `unavailable`, `unknown`, empty, a removed or disabled entity,
  or a mirror that is not connected (stale) all count as NO information.
* moving_up and moving_down both `on` is a contradiction: the movement is `unknown` (reason `conflict`), never a guessed direction;
  fault and out_of_service still win over it.
* `waiting` is stated by the waiting sensor, or inferred when both movement sensors are live and `off` (and no higher role is on).
* `partial` is true when a higher-priority role is mapped but has no live value while a lower one decided the state.
* No live sensor at all (or none mapped / visible) = `unknown`. There is no `ok` state: the module never claims health it cannot see.

Visibility: a viewer sees an elevator only through the sensors he may see (`ha_scope`, devices.read); invisible sensors are dropped
before the derivation, and an elevator without a visible sensor does not exist for him (uniform 404)."""
from __future__ import annotations

import sqlite3
from typing import Any, Iterable

ROLES: tuple[str, ...] = ("moving_up", "moving_down", "waiting", "fault", "door_open", "out_of_service")
MAX_EXTRAS = 4
STATES: tuple[str, ...] = ("fault", "out_of_service", "moving_up", "moving_down", "door_open", "waiting", "unknown")
DEAD = {"", "unknown", "unavailable", "none", "null"}

MESSAGES: dict[str, dict[str, str]] = {
    "elevator_not_found": {"he": "המעלית לא נמצאה.", "en": "The elevator was not found."},
    "duplicate_name": {"he": "כבר יש מעלית בשם הזה.", "en": "An elevator with this name already exists."},
    "no_sensor": {"he": "יש לבחור לפחות חיישן אחד.", "en": "Choose at least one sensor."},
    "not_binary_sensor": {"he": "אפשר לבחור רק חיישן מצב (פתוח/סגור).", "en": "Only binary sensors can be linked."},
    "sensor_not_found": {"he": "החיישן לא נמצא.", "en": "The sensor was not found."},
    "duplicate_sensor": {"he": "אותו חיישן נבחר פעמיים.", "en": "The same sensor was chosen twice."},
    "too_many_extras": {"he": "אפשר עד ארבעה חיישנים נוספים.", "en": "Up to four extra sensors."},
    "extra_label": {"he": "לחיישן נוסף צריך שם.", "en": "An extra sensor needs a label."},
    "area_not_found": {"he": "האזור לא נמצא.", "en": "The area was not found."},
    "revision_conflict": {"he": "המעלית עודכנה בינתיים.", "en": "The elevator was changed meanwhile."},
    "order_mismatch": {"he": "הסדר חייב לכלול את כל המעליות.", "en": "The order must list every elevator."},
}


def name_key(name: str) -> str:
    return " ".join(name.split()).casefold()


def bool_of(raw: Any, *, available: Any = 1, removed: Any = None, disabled: Any = 0, connected: bool = True) -> bool | None:
    """True / False for a live on / off; None for anything that is not a live value."""
    if not connected or removed or disabled or not available or raw is None:
        return None
    s = str(raw).strip().lower()
    if s in DEAD:
        return None
    if s == "on":
        return True
    if s == "off":
        return False
    return None


def derive(values: dict[str, bool | None]) -> dict[str, Any]:
    """The documented priority over role -> True / False / None (None = mapped but no live value; a role that is not mapped is absent).
    Returns {state, reason, partial}. Pure: the unit tests drive it directly."""
    mapped = set(values)
    if not mapped or all(v is None for v in values.values()):
        return {"state": "unknown", "reason": "no_live_sensor", "partial": False}
    dead_above = False

    def take(role: str) -> bool | None:
        nonlocal dead_above
        if role not in mapped:
            return None
        v = values[role]
        if v is None:
            dead_above = True
        return v

    if take("fault"):
        return {"state": "fault", "reason": "fault", "partial": False}
    if take("out_of_service"):
        return {"state": "out_of_service", "reason": "out_of_service", "partial": dead_above}
    up, down = take("moving_up"), take("moving_down")
    if up and down:
        return {"state": "unknown", "reason": "conflict", "partial": dead_above}
    if up:
        return {"state": "moving_up", "reason": "moving_up", "partial": dead_above}
    if down:
        return {"state": "moving_down", "reason": "moving_down", "partial": dead_above}
    if take("door_open"):
        return {"state": "door_open", "reason": "door_open", "partial": dead_above}
    if take("waiting"):
        return {"state": "waiting", "reason": "waiting", "partial": dead_above}
    if up is False and down is False:
        return {"state": "waiting", "reason": "inferred_idle", "partial": dead_above}
    return {"state": "unknown", "reason": "insufficient", "partial": dead_above}


# ---------------------------------------------------------------- storage

def sensors_of(conn: sqlite3.Connection, elevator_ids: Iterable[str] | None = None) -> dict[str, list[sqlite3.Row]]:
    sql = """SELECT s.elevator_id, s.role, s.position, s.entity_id, s.label, e.state, e.available, e.removed_at, e.disabled, e.last_changed,
                    e.name AS e_name, e.original_name AS e_original, e.domain
             FROM infra_elevator_sensors s LEFT JOIN ha_entities e ON e.entity_id = s.entity_id"""
    args: list[str] = []
    if elevator_ids is not None:
        ids = list(elevator_ids)
        if not ids:
            return {}
        sql += f" WHERE s.elevator_id IN ({','.join('?' * len(ids))})"
        args = ids
    out: dict[str, list[sqlite3.Row]] = {}
    for r in conn.execute(sql + " ORDER BY s.role, s.position", args).fetchall():
        out.setdefault(r["elevator_id"], []).append(r)
    return out


def live_of(rows: list[sqlite3.Row], *, connected: bool) -> dict[str, Any]:
    """The derived state of ONE elevator from its (already visibility-filtered) sensor rows."""
    values: dict[str, bool | None] = {}
    changed: dict[str, str | None] = {}
    extras: list[dict[str, Any]] = []
    for r in rows:
        v = bool_of(r["state"], available=r["available"] if r["domain"] is not None else 0, removed=r["removed_at"], disabled=r["disabled"], connected=connected)
        if r["role"] == "extra":
            extras.append({"position": r["position"], "label": r["label"] or "", "on": v})
            continue
        values[r["role"]] = v
        changed[r["role"]] = r["last_changed"] if v is not None else None
    d = derive(values)
    st, reason = d["state"], d["reason"]
    if reason == "inferred_idle":
        stamps = [changed.get("moving_up"), changed.get("moving_down")]
    elif st != "unknown":
        stamps = [changed.get(st if st in values else reason)]
    else:
        stamps = []
    since = max((s for s in stamps if s), default=None)
    return {"state": st, "reason": reason, "partial": d["partial"], "stale": not connected, "since": since,
            "roles": sorted(values), "extras": sorted(extras, key=lambda x: x["position"])}


def mirror_connected() -> bool:
    from . import ha_sync

    return bool(ha_sync.STATE.connected)


def summary(states: list[str]) -> dict[str, int]:
    out = {s: 0 for s in STATES}
    for s in states:
        out[s] = out.get(s, 0) + 1
    return out
