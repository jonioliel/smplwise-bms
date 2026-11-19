"""The SQL of the cold-room temperature router (routers/temperature.py; CR-ROUTER-SQL-2450, review 05:P2-07): every statement the
router ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the scope checks, the
validation, the runtime calls (services/temperature_runtime) and the audit; each function runs on the connection the route hands
it. services/temperature.py stays the rules / readings module."""
from __future__ import annotations

import sqlite3
from typing import Any

Rows = list[sqlite3.Row]

# the unit's own rows that go with it (phase 3 tables; the tickets themselves stay in the service module)
UNIT_TABLES = ("infra_temp_samples", "infra_temp_samples_5m", "infra_temp_doors", "infra_temp_events", "infra_temp_defrost_learned", "infra_temp_defrost_state",
               "infra_temp_insights", "infra_temp_tickets")


# ---------------------------------------------------------------- the platform mirror and users

def user_name_rows(conn: sqlite3.Connection, ids: set[str]) -> Rows:
    return conn.execute(f"SELECT id, username, display_name FROM users WHERE id IN ({','.join('?' * len(ids))})", list(ids)).fetchall()


def areas_with_floor(conn: sqlite3.Connection) -> Rows:
    """(area_id, name, floor_id, floor_name, floor_level) of every platform area."""
    return conn.execute("""SELECT a.area_id, a.name, a.floor_id, f.name AS floor_name, f.level AS floor_level FROM ha_areas a
                               LEFT JOIN ha_floors f ON f.floor_id = a.floor_id""").fetchall()


def area_choices(conn: sqlite3.Connection) -> Rows:
    """(area_id, name, floor_name) of every platform area, in the platform's order."""
    return conn.execute(
        "SELECT a.area_id, a.name, f.name AS floor_name FROM ha_areas a LEFT JOIN ha_floors f ON f.floor_id = a.floor_id ORDER BY a.position, a.name").fetchall()


def area_exists(conn: sqlite3.Connection, area_id: str) -> bool:
    return conn.execute("SELECT 1 FROM ha_areas WHERE area_id = ?", (area_id,)).fetchone() is not None


def candidate_entities(conn: sqlite3.Connection, doms: tuple[str, ...]) -> Rows:
    marks = ",".join("?" * len(doms))
    return conn.execute(f"""SELECT entity_id, name, original_name, domain, device_class, unit, state, available, removed_at, disabled, area_name, attributes_json
                            FROM ha_entities WHERE domain IN ({marks}) AND removed_at IS NULL AND disabled = 0 ORDER BY name, entity_id""", doms).fetchall()


def temp_entity(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT entity_id, domain, device_class, unit FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()


def door_entity(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT domain FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()


def power_entity(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT domain, device_class, unit FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()


# ---------------------------------------------------------------- samples and events

def last_sample(conn: sqlite3.Connection, unit_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT v FROM infra_temp_samples WHERE unit_id = ? ORDER BY ts DESC LIMIT 1", (unit_id,)).fetchone()


def events_window(conn: sqlite3.Connection, unit_ids: list[str], hi: str, lo: str, kinds: tuple[str, ...] | None, severity: str | None) -> Rows:
    """The events of the units that overlap [lo, hi], newest first; `kinds` / `severity` narrow them when given."""
    where = [f"unit_id IN ({','.join('?' * len(unit_ids))})", "started_at <= ?", "(ended_at IS NULL OR ended_at >= ?)"]
    args: list[Any] = [*unit_ids, hi, lo]
    if kinds is not None:
        where.append(f"kind IN ({','.join('?' * len(kinds))})")
        args += list(kinds)
    if severity:
        where.append("severity = ?")
        args.append(severity)
    sql = " AND ".join(where)
    return conn.execute(f"SELECT * FROM infra_temp_events WHERE {sql} ORDER BY started_at DESC, id", args).fetchall()


def unit_event(conn: sqlite3.Connection, unit_id: str, event_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM infra_temp_events WHERE id = ? AND unit_id = ?", (event_id, unit_id)).fetchone()


def ack_event(conn: sqlite3.Connection, event_id: str, by: str | None, at: str) -> None:
    conn.execute("UPDATE infra_temp_events SET ack_by = ?, ack_at = ? WHERE id = ?", (by, at, event_id))


# ---------------------------------------------------------------- report schedules and settings

def delete_report_schedule(conn: sqlite3.Connection, schedule_id: str) -> int:
    return conn.execute("DELETE FROM infra_temp_report_schedules WHERE id = ?", (schedule_id,)).rowcount


def settings_version(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute("SELECT row_version FROM infra_temp_settings WHERE id = 1").fetchone()


def settings_row(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute("SELECT row_version, rules_json FROM infra_temp_settings WHERE id = 1").fetchone()


def put_settings(conn: sqlite3.Connection, rules_json: str, by: str | None, at: str) -> None:
    conn.execute("""INSERT INTO infra_temp_settings(id, rules_json, row_version, updated_by, updated_at) VALUES (1, ?, 1, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET rules_json = excluded.rules_json, row_version = row_version + 1, updated_by = excluded.updated_by, updated_at = excluded.updated_at""",
                 (rules_json, by, at))


# ---------------------------------------------------------------- units

def unit_by_name_key(conn: sqlite3.Connection, name_key: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id FROM infra_temp_units WHERE name_key = ?", (name_key,)).fetchone()


def unit(conn: sqlite3.Connection, unit_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM infra_temp_units WHERE id = ?", (unit_id,)).fetchone()


def unit_ids(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute("SELECT id FROM infra_temp_units").fetchall()}


def next_sort_order(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM infra_temp_units").fetchone()[0]


def insert_unit(conn: sqlite3.Connection, values: tuple[Any, ...]) -> None:
    """(id, name, name_key, area_id, kind, temp_entity_id, door_entity_id, door_invert, power_entity_id, low, high, band_mode, rules_json, recipients_json,
    defrost_mode, defrost_json, sort_order, enabled, created_at, updated_at); revision starts at 1."""
    conn.execute("""INSERT INTO infra_temp_units(id, name, name_key, area_id, kind, temp_entity_id, door_entity_id, door_invert, power_entity_id, low, high, band_mode, rules_json,
                    recipients_json, defrost_mode, defrost_json, sort_order, enabled, revision, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)""",
                 values)


def update_unit(conn: sqlite3.Connection, values: tuple[Any, ...]) -> None:
    """(name, name_key, area_id, kind, temp_entity_id, door_entity_id, door_invert, power_entity_id, low, high, band_mode, rules_json, recipients_json,
    defrost_mode, defrost_json, enabled, updated_at, id); the revision goes up by one."""
    conn.execute("""UPDATE infra_temp_units SET name = ?, name_key = ?, area_id = ?, kind = ?, temp_entity_id = ?, door_entity_id = ?, door_invert = ?, power_entity_id = ?,
                    low = ?, high = ?, band_mode = ?, rules_json = ?, recipients_json = ?, defrost_mode = ?, defrost_json = ?, enabled = ?, revision = revision + 1, updated_at = ?
                    WHERE id = ?""",
                 values)


def reorder_units(conn: sqlite3.Connection, ids: list[str]) -> None:
    conn.executemany("UPDATE infra_temp_units SET sort_order = ? WHERE id = ?", [(i, x) for i, x in enumerate(ids)])


def delete_unit(conn: sqlite3.Connection, unit_id: str) -> None:
    """The unit's rows in every table of UNIT_TABLES, then the unit."""
    for tbl in UNIT_TABLES:
        conn.execute(f"DELETE FROM {tbl} WHERE unit_id = ?", (unit_id,))
    conn.execute("DELETE FROM infra_temp_units WHERE id = ?", (unit_id,))


def mute_unit(conn: sqlite3.Connection, unit_id: str, until: str, by: str | None) -> None:
    conn.execute("UPDATE infra_temp_units SET muted_until = ?, muted_by = ? WHERE id = ?", (until, by, unit_id))


def unmute_unit(conn: sqlite3.Connection, unit_id: str) -> None:
    conn.execute("UPDATE infra_temp_units SET muted_until = NULL, muted_by = NULL WHERE id = ?", (unit_id,))


def forget_learned_windows(conn: sqlite3.Connection, unit_id: str) -> None:
    """The learned (not confirmed or rejected) defrost windows of the unit."""
    conn.execute("DELETE FROM infra_temp_defrost_learned WHERE unit_id = ? AND status = 'learned'", (unit_id,))


def forget_insights(conn: sqlite3.Connection, unit_id: str) -> None:
    conn.execute("DELETE FROM infra_temp_insights WHERE unit_id = ?", (unit_id,))


# ---------------------------------------------------------------- learned defrost windows

def defrost_window_status(conn: sqlite3.Connection, unit_id: str, start_min: int) -> sqlite3.Row | None:
    return conn.execute("SELECT status FROM infra_temp_defrost_learned WHERE unit_id = ? AND start_min = ?", (unit_id, start_min)).fetchone()


def decide_defrost_window(conn: sqlite3.Connection, unit_id: str, start_min: int, status: str, by: str | None, at: str) -> None:
    conn.execute("UPDATE infra_temp_defrost_learned SET status = ?, decided_by = ?, decided_at = ? WHERE unit_id = ? AND start_min = ?",
                 (status, by, at, unit_id, start_min))


def defrost_windows(conn: sqlite3.Connection, unit_id: str) -> Rows:
    return conn.execute("SELECT start_min, minutes, repeats, status FROM infra_temp_defrost_learned WHERE unit_id = ? ORDER BY start_min", (unit_id,)).fetchall()


def clear_defrost(conn: sqlite3.Connection, unit_id: str) -> None:
    """Every learned, confirmed and rejected window of the unit, and the learner's state."""
    conn.execute("DELETE FROM infra_temp_defrost_learned WHERE unit_id = ?", (unit_id,))
    conn.execute("DELETE FROM infra_temp_defrost_state WHERE unit_id = ?", (unit_id,))
