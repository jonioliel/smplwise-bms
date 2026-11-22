"""The SQL of the elevators router (routers/elevators.py; CR-ROUTER-SQL-2450, review 05:P2-07): every statement the router ran inline,
moved here unchanged (same text, same arguments, same order of calls). The router keeps the scope checks, the validation and the
audit; each function runs on the connection the route hands it. services/elevators.py stays the elevator model."""
from __future__ import annotations

import sqlite3

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- the platform mirror

def area_name(conn: sqlite3.Connection, area_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT name FROM ha_areas WHERE area_id = ?", (area_id,)).fetchone()


def area_exists(conn: sqlite3.Connection, area_id: str) -> bool:
    return conn.execute("SELECT 1 FROM ha_areas WHERE area_id = ?", (area_id,)).fetchone() is not None


def binary_sensor_candidates(conn: sqlite3.Connection) -> Rows:
    return conn.execute(
        "SELECT entity_id, name, original_name, device_class, area_name FROM ha_entities WHERE domain = 'binary_sensor' AND removed_at IS NULL AND disabled = 0 ORDER BY name, entity_id"
    ).fetchall()


def live_binary_sensor(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT 1 FROM ha_entities WHERE entity_id = ? AND domain = 'binary_sensor' AND removed_at IS NULL", (entity_id,)).fetchone()


# ---------------------------------------------------------------- infra_elevators

def enabled_elevators(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM infra_elevators WHERE enabled = 1 ORDER BY sort_order, name_key, id").fetchall()


def elevators(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM infra_elevators ORDER BY sort_order, name_key, id").fetchall()


def elevator(conn: sqlite3.Connection, elevator_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM infra_elevators WHERE id = ?", (elevator_id,)).fetchone()


def elevator_by_name_key(conn: sqlite3.Connection, name_key: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id FROM infra_elevators WHERE name_key = ?", (name_key,)).fetchone()


def elevator_ids(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute("SELECT id FROM infra_elevators").fetchall()}


def next_sort_order(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM infra_elevators").fetchone()[0]


def insert_elevator(conn: sqlite3.Connection, elevator_id: str, name: str, name_key: str, area_id: str | None, sort_order: int, enabled: int, show_travel: int, at: str) -> None:
    conn.execute("INSERT INTO infra_elevators (id, name, name_key, area_id, sort_order, enabled, show_travel, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
                 (elevator_id, name, name_key, area_id, sort_order, enabled, show_travel, at, at))


def update_elevator(conn: sqlite3.Connection, elevator_id: str, name: str, name_key: str, area_id: str | None, enabled: int, show_travel: int, at: str) -> None:
    conn.execute("UPDATE infra_elevators SET name = ?, name_key = ?, area_id = ?, enabled = ?, show_travel = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
                 (name, name_key, area_id, enabled, show_travel, at, elevator_id))


def reorder(conn: sqlite3.Connection, ids: list[str]) -> None:
    conn.executemany("UPDATE infra_elevators SET sort_order = ? WHERE id = ?", [(i, x) for i, x in enumerate(ids)])


def write_sensors(conn: sqlite3.Connection, elevator_id: str, sensors: list[tuple[str, int, str, str | None]]) -> None:
    """Replace the elevator's sensor rows with (role, position, entity_id, label)."""
    conn.execute("DELETE FROM infra_elevator_sensors WHERE elevator_id = ?", (elevator_id,))
    conn.executemany("INSERT INTO infra_elevator_sensors (elevator_id, role, position, entity_id, label) VALUES (?, ?, ?, ?, ?)",
                     [(elevator_id, role, pos, eid, label) for role, pos, eid, label in sensors])


def delete_states(conn: sqlite3.Connection, elevator_id: str) -> None:
    """Raises sqlite3.Error before migration 0119 (the caller ignores it, as before)."""
    conn.execute("DELETE FROM infra_elevator_states WHERE elevator_id = ?", (elevator_id,))


def delete_elevator(conn: sqlite3.Connection, elevator_id: str) -> None:
    """The sensor rows, then the elevator."""
    conn.execute("DELETE FROM infra_elevator_sensors WHERE elevator_id = ?", (elevator_id,))
    conn.execute("DELETE FROM infra_elevators WHERE id = ?", (elevator_id,))
