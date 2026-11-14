"""XSCENARIO109-295 (CR-SCENARIO109 sections 3.1, 8 and 17): the signal catalogue and its providers.

A provider READS state a module already holds (the Home Assistant state mirror, the temperature module's own tables, the people-count
module, the scenario flags). It never polls a device, never calls the network and never writes. Every reading is three-valued at the
model: a module that is off, a sensor with no live value, a disconnected state mirror or a stale reading is UNKNOWN, never FALSE.

Visibility (section 8, the reference rule): `can_reference(conn, principal, signal, subject)` answers whether a person may build a leaf on
it; the engine asks the same question for the AUTHOR at every run (owner Q4 = 270 a). Presence is counts per area only, never names
(owner Q5 = 214 a), and needs the people-count permission (`occupancy.view`) and its module switch."""
from __future__ import annotations

import datetime as dt
import logging
import sqlite3
from typing import Any, Callable, Mapping

from ..rbac import INSTALLATION, Principal, authorize
from . import ha_scope
from .scenario_model import Reading, SignalSpec, in_window, iso

log = logging.getLogger("smplwise.scenarios")

DOOR_CLASSES = ("door", "window", "garage_door", "opening")

CATALOGUE: dict[str, SignalSpec] = {s.id: s for s in (
    SignalSpec("time.in_window", "time", "bool", "בתוך חלון זמן", subject="window", max_age_s=86400, label_en="Inside a time window"),
    SignalSpec("time.after_hours", "time", "bool", "מחוץ לשעות הפעילות", max_age_s=86400, label_en="After working hours"),
    SignalSpec("temperature.value", "temperature", "number", "טמפרטורה", unit="°C", max_age_s=900, subject="temperature_unit",
               value_range=(-80.0, 150.0), default_margin=0.5, label_en="Temperature"),
    SignalSpec("temperature.out_of_range", "temperature", "bool", "טמפרטורה מחוץ לטווח", max_age_s=900, subject="temperature_unit", label_en="Temperature out of range"),
    SignalSpec("temperature.door_open", "temperature", "bool", "דלת היחידה פתוחה", max_age_s=900, subject="temperature_unit", default_debounce_s=10,
               label_en="Unit door open"),
    SignalSpec("temperature.sensor_offline", "temperature", "bool", "חיישן טמפרטורה לא מדווח", max_age_s=900, subject="temperature_unit",
               label_en="Temperature sensor not reporting"),
    SignalSpec("door.is_open", "doors", "bool", "חיישן דלת פתוח", max_age_s=3600, subject="door_sensor", default_debounce_s=10, label_en="Door sensor open"),
    SignalSpec("door.open_for_s", "doors", "number", "דלת פתוחה (שניות)", unit="s", max_age_s=3600, subject="door_sensor", value_range=(0.0, 7 * 86400.0),
               label_en="Door open for (seconds)"),
    SignalSpec("presence.count", "presence", "count", "מספר אנשים באזור", max_age_s=600, subject="area", value_range=(0.0, 1000.0), default_margin=0.0,
               label_en="People in area"),
    SignalSpec("presence.anyone", "presence", "bool", "יש אנשים באזור", max_age_s=600, subject="area", label_en="Anyone in area"),
    SignalSpec("flag.value", "flags", "bool", "סימון תרחיש", max_age_s=365 * 86400, subject="flag", label_en="Scenario flag"),
)}
MODULE_LABELS = {"time": "זמן", "temperature": "טמפרטורות", "doors": "חיישני דלת (קריאה בלבד)", "presence": "נוכחות (ספירה בלבד)", "flags": "סימונים"}


# ---------------------------------------------------------------- module switches and the HA mirror

def _mirror_connected() -> bool:
    try:
        from . import ha_sync

        return bool(ha_sync.STATE.connected)
    except Exception:  # noqa: BLE001
        return False


def temperature_on(conn: sqlite3.Connection) -> bool:
    try:
        return conn.execute("SELECT 1 FROM infra_temp_units WHERE enabled = 1 LIMIT 1").fetchone() is not None
    except sqlite3.Error:
        return False


def presence_on(conn: sqlite3.Connection) -> bool:
    try:
        from . import zone_counts

        return zone_counts.enabled(conn)
    except Exception:  # noqa: BLE001
        return False


def site_zone(conn: sqlite3.Connection):
    from . import temperature

    return temperature.site_zone(conn)


# ---------------------------------------------------------------- visibility (the reference rule)

class Reach:
    """What one person may reference: computed once per request / per rule run."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal) -> None:
        self.conn, self.principal = conn, principal
        self._dev: tuple[bool, Any] | None = None
        self._placed: Any = None

    def sees_entity(self, entity_id: str | None) -> bool:
        if not entity_id:
            return False
        if self._dev is None:
            self._dev = ha_scope.visible_floors(self.conn, self.principal, "devices.read")
        wide, floors = self._dev
        if wide:
            return True
        if not floors:
            return False
        if self._placed is None:
            self._placed = ha_scope.placements(self.conn)
        return ha_scope.entity_visible(False, floors, self._placed, entity_id)

    def occupancy(self) -> bool:
        return authorize(self.conn, self.principal, "occupancy.view", INSTALLATION).allowed

    def module_visible(self, module: str) -> bool:
        if module in ("time", "flags"):
            return True
        if module in ("temperature", "doors"):
            if self._dev is None:
                self._dev = ha_scope.visible_floors(self.conn, self.principal, "devices.read")
            return bool(self._dev[0] or self._dev[1])
        if module == "presence":
            return self.occupancy()
        return False


def _unit(conn: sqlite3.Connection, unit_id: str) -> sqlite3.Row | None:
    try:
        return conn.execute("SELECT * FROM infra_temp_units WHERE id = ? AND enabled = 1", (unit_id,)).fetchone()
    except sqlite3.Error:
        return None


def _door_entity(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    r = conn.execute("SELECT * FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()
    if r is None or r["domain"] != "binary_sensor" or (r["device_class"] or "") not in DOOR_CLASSES:
        return None
    return r


def can_reference(reach: Reach, signal_id: str, subject: str | None) -> bool:
    spec = CATALOGUE.get(signal_id)
    if spec is None or not reach.module_visible(spec.module):
        return False
    if spec.subject in ("none", "window", "flag"):
        return True
    if spec.subject == "temperature_unit":
        u = _unit(reach.conn, subject or "")
        if u is None or not reach.sees_entity(u["temp_entity_id"]):
            return False
        if signal_id == "temperature.door_open":
            return bool(u["door_entity_id"]) and reach.sees_entity(u["door_entity_id"])
        return True
    if spec.subject == "door_sensor":
        return _door_entity(reach.conn, subject or "") is not None and reach.sees_entity(subject)
    if spec.subject == "area":
        return reach.occupancy() and bool(subject) and reach.conn.execute("SELECT 1 FROM ha_areas WHERE area_id = ?", (subject,)).fetchone() is not None
    return False


def subjects(reach: Reach, signal_id: str) -> list[dict[str, str]]:
    """The subjects the person may pick for a signal (friendly names, never entity ids for the temperature units)."""
    spec = CATALOGUE[signal_id]
    conn = reach.conn
    if spec.subject == "temperature_unit":
        try:
            rows = conn.execute("SELECT id, name, temp_entity_id, door_entity_id FROM infra_temp_units WHERE enabled = 1 ORDER BY sort_order, name_key").fetchall()
        except sqlite3.Error:
            return []
        return [{"id": r["id"], "name": r["name"]} for r in rows if reach.sees_entity(r["temp_entity_id"])
                and (signal_id != "temperature.door_open" or (r["door_entity_id"] and reach.sees_entity(r["door_entity_id"])))]
    if spec.subject == "door_sensor":
        rows = conn.execute("SELECT entity_id, name, original_name FROM ha_entities WHERE removed_at IS NULL AND domain = 'binary_sensor' AND device_class IN "
                            f"({','.join('?' * len(DOOR_CLASSES))}) ORDER BY name", DOOR_CLASSES).fetchall()
        return [{"id": r["entity_id"], "name": r["name"] or r["original_name"] or r["entity_id"]} for r in rows if reach.sees_entity(r["entity_id"])][:500]
    if spec.subject == "area":
        if not reach.occupancy():
            return []
        try:
            mapped = {r["area_id"] for r in conn.execute("SELECT DISTINCT area_id FROM zone_count_map").fetchall()}
        except sqlite3.Error:
            mapped = set()
        rows = conn.execute("SELECT area_id, name FROM ha_areas ORDER BY position, name").fetchall()
        return [{"id": r["area_id"], "name": r["name"]} for r in rows if r["area_id"] in mapped]
    if spec.subject == "flag":
        try:
            return [{"id": r["name"], "name": r["name"]} for r in conn.execute("SELECT name FROM scenario_flags ORDER BY name").fetchall()]
        except sqlite3.Error:
            return []
    return []


def catalogue_view(reach: Reach) -> list[dict[str, Any]]:
    out = []
    for s in CATALOGUE.values():
        if not reach.module_visible(s.module):
            continue
        out.append({"id": s.id, "module": s.module, "module_label": MODULE_LABELS[s.module], "kind": s.kind, "label": s.label, "label_en": s.label_en,
                    "unit": s.unit, "max_age_s": s.max_age_s, "subject": s.subject, "enum_values": list(s.enum_values),
                    "range": list(s.value_range) if s.value_range else None, "default_margin": s.default_margin, "default_debounce_s": s.default_debounce_s,
                    "subjects": subjects(reach, s.id) if s.subject not in ("none", "window") else []})
    return out


# ---------------------------------------------------------------- providers

def _entity_reading(r: sqlite3.Row | None, value: Any) -> Reading:
    if r is None:
        return Reading(None, "unavailable", None, "no_subject")
    if not _mirror_connected():
        return Reading(None, "unknown", None, "mirror_disconnected")
    if r["disabled"] or not r["available"] or value is None:
        return Reading(None, "unavailable", r["state_seen_at"], "no_value")
    return Reading(value, "ok", r["state_seen_at"] or r["last_updated"], None)


class Ctx:
    """One evaluation pass: the connection, the clock reading and the settings the providers need, read once."""

    def __init__(self, conn: sqlite3.Connection, now: dt.datetime, work_window: Mapping[str, Any] | None = None, after_hours_source: str = "window") -> None:
        self.conn, self.now = conn, now
        self.tz = site_zone(conn)
        self.work_window = work_window or {"days": [6, 0, 1, 2, 3], "from": "08:00", "to": "17:00"}
        self.after_hours_source = after_hours_source
        self._counts: dict[str, int | None] | None = None


def _p_in_window(ctx: Ctx, leaf: Mapping[str, Any]) -> Reading:
    w = leaf["window"]
    local = ctx.now.astimezone(ctx.tz)
    return Reading(in_window(local, w["days"], w["from"], w["to"]), "ok", iso(ctx.now))


def _p_after_hours(ctx: Ctx, leaf: Mapping[str, Any]) -> Reading:
    if ctx.after_hours_source == "calendar":
        from .tickets import work_calendar

        cal = work_calendar.load(ctx.conn)
        return Reading(not work_calendar.is_working(ctx.now, cal), "ok", iso(ctx.now))
    w = ctx.work_window
    return Reading(not in_window(ctx.now.astimezone(ctx.tz), w["days"], w["from"], w["to"]), "ok", iso(ctx.now))


def _temp_unit(ctx: Ctx, leaf: Mapping[str, Any]) -> tuple[sqlite3.Row | None, Reading | None]:
    if not temperature_on(ctx.conn):
        return None, Reading(None, "unknown", None, "module_off")
    u = _unit(ctx.conn, str(leaf.get("subject") or ""))
    if u is None:
        return None, Reading(None, "unavailable", None, "no_subject")
    return u, None


def _p_temp_value(ctx: Ctx, leaf: Mapping[str, Any]) -> Reading:
    from . import temperature

    u, bad = _temp_unit(ctx, leaf)
    if bad:
        return bad
    r = ctx.conn.execute("SELECT * FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (u["temp_entity_id"],)).fetchone()
    value = temperature.reading_of(r, connected=_mirror_connected())["value"] if r is not None else None
    return _entity_reading(r, value)


def _open_event(ctx: Ctx, unit_id: str, kinds: tuple[str, ...]) -> bool:
    q = f"SELECT 1 FROM infra_temp_events WHERE unit_id = ? AND ended_at IS NULL AND kind IN ({','.join('?' * len(kinds))}) LIMIT 1"
    return ctx.conn.execute(q, (unit_id, *kinds)).fetchone() is not None


def _p_temp_event(kinds: tuple[str, ...]) -> Callable[[Ctx, Mapping[str, Any]], Reading]:
    def read(ctx: Ctx, leaf: Mapping[str, Any]) -> Reading:
        u, bad = _temp_unit(ctx, leaf)
        if bad:
            return bad
        if not _mirror_connected():
            return Reading(None, "unknown", None, "mirror_disconnected")
        if kinds != ("offline",) and _open_event(ctx, u["id"], ("offline",)):
            return Reading(None, "unavailable", iso(ctx.now), "sensor_offline")  # an offline sensor is not "in range"
        return Reading(_open_event(ctx, u["id"], kinds), "ok", iso(ctx.now))
    return read


def _p_temp_door(ctx: Ctx, leaf: Mapping[str, Any]) -> Reading:
    from . import temperature

    u, bad = _temp_unit(ctx, leaf)
    if bad:
        return bad
    if not u["door_entity_id"]:
        return Reading(None, "unavailable", None, "no_door_sensor")
    r = ctx.conn.execute("SELECT * FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (u["door_entity_id"],)).fetchone()
    value = temperature.door_of(r["state"], invert=bool(u["door_invert"]), available=r["available"], removed=r["removed_at"], disabled=r["disabled"],
                                connected=_mirror_connected()) if r is not None else None
    return _entity_reading(r, value)


def _door_open(ctx: Ctx, leaf: Mapping[str, Any]) -> tuple[sqlite3.Row | None, bool | None]:
    r = _door_entity(ctx.conn, str(leaf.get("subject") or ""))
    if r is None:
        return None, None
    s = str(r["state"] or "").strip().lower()
    return r, (True if s == "on" else False if s == "off" else None)


def _p_door_is_open(ctx: Ctx, leaf: Mapping[str, Any]) -> Reading:
    r, v = _door_open(ctx, leaf)
    return _entity_reading(r, v)


def _p_door_open_for(ctx: Ctx, leaf: Mapping[str, Any]) -> Reading:
    from .scenario_model import parse

    r, v = _door_open(ctx, leaf)
    if v is None:
        return _entity_reading(r, None)
    if not v:
        return _entity_reading(r, 0)
    since = parse(r["last_changed"])
    if since is None:
        return Reading(None, "unknown", r["state_seen_at"], "no_value")
    return _entity_reading(r, max(0, int((ctx.now - since).total_seconds())))


def _p_presence(as_bool: bool) -> Callable[[Ctx, Mapping[str, Any]], Reading]:
    def read(ctx: Ctx, leaf: Mapping[str, Any]) -> Reading:
        if not presence_on(ctx.conn):
            return Reading(None, "unknown", None, "module_off")
        if ctx._counts is None:
            from . import zone_counts

            ctx._counts = zone_counts.current_counts(ctx.conn, ctx.now)
        n = ctx._counts.get(str(leaf.get("subject") or ""))
        if n is None:
            return Reading(None, "unknown", None, "no_value")
        return Reading((n > 0) if as_bool else int(n), "ok", iso(ctx.now))
    return read


def _p_flag(ctx: Ctx, leaf: Mapping[str, Any]) -> Reading:
    r = ctx.conn.execute("SELECT value, set_at FROM scenario_flags WHERE name = ?", (str(leaf.get("subject") or ""),)).fetchone()
    if r is None or r["value"] is None:
        return Reading(False, "ok", iso(ctx.now))  # a flag never set reads false (it is ours; there is nothing unknown about it)
    return Reading(r["value"] == "true", "ok", iso(ctx.now))


PROVIDERS: dict[str, Callable[[Ctx, Mapping[str, Any]], Reading]] = {
    "time.in_window": _p_in_window,
    "time.after_hours": _p_after_hours,
    "temperature.value": _p_temp_value,
    "temperature.out_of_range": _p_temp_event(("high", "low")),
    "temperature.door_open": _p_temp_door,
    "temperature.sensor_offline": _p_temp_event(("offline",)),
    "door.is_open": _p_door_is_open,
    "door.open_for_s": _p_door_open_for,
    "presence.count": _p_presence(False),
    "presence.anyone": _p_presence(True),
    "flag.value": _p_flag,
}
assert set(PROVIDERS) == set(CATALOGUE)


def read(ctx: Ctx, leaf: Mapping[str, Any]) -> Reading:
    """One leaf's reading. A raising provider is isolated: its leaf is UNKNOWN for this pass (section 10)."""
    try:
        return PROVIDERS[leaf["signal"]](ctx, leaf)
    except Exception:  # noqa: BLE001
        log.warning("scenario signal provider failed: %s", leaf.get("signal"), exc_info=True)
        return Reading(None, "unknown", None, "provider_error")


def subject_name(conn: sqlite3.Connection, signal_id: str, subject: str | None) -> str:
    spec = CATALOGUE.get(signal_id)
    if spec is None or not subject:
        return ""
    try:
        if spec.subject == "temperature_unit":
            r = conn.execute("SELECT name FROM infra_temp_units WHERE id = ?", (subject,)).fetchone()
            return r["name"] if r else ""
        if spec.subject == "door_sensor":
            r = conn.execute("SELECT name, original_name FROM ha_entities WHERE entity_id = ?", (subject,)).fetchone()
            return (r["name"] or r["original_name"] or "") if r else ""
        if spec.subject == "area":
            r = conn.execute("SELECT name FROM ha_areas WHERE area_id = ?", (subject,)).fetchone()
            return r["name"] if r else ""
    except sqlite3.Error:
        return ""
    return subject

