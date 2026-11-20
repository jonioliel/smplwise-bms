"""SQL of the water meters API (routers/water.py held it inline: the manual readings, the alert log rows, acknowledge / snooze / mute;
moved here by CR-RESPONSE-MODELS-CONSUMPTION-2450, review 05 SQL boundary / MASTER_PLAN 3.6). The statements are unchanged; the router
keeps the permission checks, the audit and the answers."""
from __future__ import annotations

import sqlite3
from typing import Any

# the alert log row with the meter's name, kind and place and the acknowledging user's display name
EVENTS_SQL = """SELECT e.*, m.display_name, m.kind AS meter_kind, m.source_ref, COALESCE(a.name, x.area_name) AS area_name,
                       CASE WHEN a.area_id IS NOT NULL THEN f.name ELSE x.ha_floor_name END AS floor_name,
                       COALESCE(NULLIF(u.display_name, ''), u.username) AS ack_by_display
                FROM water_alert_events e JOIN water_meters m ON m.id = e.meter_id
                LEFT JOIN ha_entities x ON x.entity_id = m.source_ref
                LEFT JOIN ha_areas a ON a.area_id = COALESCE(m.area_id, x.area_id)
                LEFT JOIN ha_floors f ON f.floor_id = a.floor_id
                LEFT JOIN users u ON u.id = e.ack_by"""


# ---------------------------------------------------------------- manual readings

def manual_readings(conn: sqlite3.Connection, meter_id: str) -> list[sqlite3.Row]:
    """The meter's typed readings, newest first (undone ones included)."""
    return conn.execute("SELECT * FROM water_meter_manual_readings WHERE meter_id = ? ORDER BY read_at DESC, created_at DESC", (meter_id,)).fetchall()


def manual_reading(conn: sqlite3.Connection, reading_id: str, meter_id: str | None = None) -> sqlite3.Row | None:
    """One typed reading by id (of that meter when `meter_id` is given)."""
    if meter_id is None:
        return conn.execute("SELECT * FROM water_meter_manual_readings WHERE id = ?", (reading_id,)).fetchone()
    return conn.execute("SELECT * FROM water_meter_manual_readings WHERE id = ? AND meter_id = ?", (reading_id, meter_id)).fetchone()


def insert_manual_reading(conn: sqlite3.Connection, *, reading_id: str, meter_id: str, epoch_id: str, read_at: str | None, value_ml: int,
                          typed_value: str, typed_unit: str, effect: str, effect_reason: Any, note: str | None, created_by: str | None,
                          created_at: str) -> None:
    conn.execute("""INSERT INTO water_meter_manual_readings(id, meter_id, epoch_id, read_at, value_ml, typed_value, typed_unit, effect, effect_reason, note, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 (reading_id, meter_id, epoch_id, read_at, value_ml, typed_value, typed_unit, effect, effect_reason, note, created_by, created_at))


def void_manual_reading(conn: sqlite3.Connection, reading_id: str, *, at: str, by: str | None, reason: str | None) -> None:
    conn.execute("UPDATE water_meter_manual_readings SET voided_at = ?, voided_by = ?, void_reason = ? WHERE id = ?", (at, by, reason, reading_id))


# ---------------------------------------------------------------- the alert log

def events(conn: sqlite3.Connection, *, open_only: bool, kind: str | None, meter_id: str | None) -> list[sqlite3.Row]:
    """The alert log rows of every meter (the caller filters by what the user may see), newest first."""
    where: list[str] = []
    args: list[Any] = []
    if open_only:
        where.append("e.closed_at IS NULL")
    if kind:
        where.append("e.kind = ?")
        args.append(kind)
    if meter_id:
        where.append("e.meter_id = ?")
        args.append(meter_id)
    sql = EVENTS_SQL + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY e.opened_at DESC, e.id"
    return conn.execute(sql, args).fetchall()


def event(conn: sqlite3.Connection, event_id: str) -> sqlite3.Row | None:
    return conn.execute(EVENTS_SQL + " WHERE e.id = ?", (event_id,)).fetchone()


def ack_event(conn: sqlite3.Connection, event_id: str, *, by: str | None, at: str) -> None:
    conn.execute("UPDATE water_alert_events SET ack_by = ?, ack_at = ? WHERE id = ?", (by, at, event_id))


def set_event_snooze(conn: sqlite3.Connection, event_id: str, *, until: str | None, by: str | None) -> None:
    """Snooze one alert row until `until`, or end the snooze (both None)."""
    conn.execute("UPDATE water_alert_events SET snoozed_until = ?, snoozed_by = ? WHERE id = ?", (until, by, event_id))


def set_meter_mute(conn: sqlite3.Connection, meter_id: str, *, until: str | None, by: str | None) -> None:
    """Hold the meter's warnings until `until`, or end the hold (both None)."""
    conn.execute("UPDATE water_meters SET muted_until = ?, muted_by = ? WHERE id = ?", (until, by, meter_id))
