"""The SQL of the recorders router (routers/recorders.py, multi-NVR; CR-ROUTER-SQL-B-2450, review 05:P2-07): every statement the router
ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the permission checks, the connection
tests, the destination rule and the audit; each function runs on the connection the route (or the caller of create_recorder_row /
destination_taken) hands it. services/connection_store.py stays the recorder connection rows."""
from __future__ import annotations

import sqlite3
from typing import Any

Rows = list[sqlite3.Row]


def recorder(conn: sqlite3.Connection, rid: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM recorders WHERE id = ?", (rid,)).fetchone()


def recorders(conn: sqlite3.Connection, include_removed: bool) -> Rows:
    """Every recorder row (live ones only unless `include_removed`), by sort order then id."""
    sql = "SELECT * FROM recorders" + ("" if include_removed else " WHERE removed_at IS NULL") + " ORDER BY sort_order, id"
    return conn.execute(sql).fetchall()


def camera_counts(conn: sqlite3.Connection, rid: str) -> sqlite3.Row:
    """`n` cameras of the recorder, `on_` of them enabled."""
    return conn.execute("SELECT COUNT(*) AS n, COALESCE(SUM(enabled), 0) AS on_ FROM cameras WHERE recorder_id = ?", (rid,)).fetchone()


def other_active_destinations(conn: sqlite3.Connection, rid: str) -> Rows:
    """Host and HTTP port of every other recorder's connection that is not "no NVR" and whose recorder is not removed."""
    return conn.execute("SELECT rc.recorder_id, rc.host, rc.http_port FROM recorder_connections rc LEFT JOIN recorders r ON r.id = rc.recorder_id "
                        "WHERE rc.vendor <> 'none' AND rc.recorder_id <> ? AND (r.removed_at IS NULL)", (rid,)).fetchall()


def other_recorder_in_use(conn: sqlite3.Connection, primary: str) -> bool:
    row = conn.execute("""SELECT 1 FROM recorder_connections rc LEFT JOIN recorders r ON r.id = rc.recorder_id
                          WHERE rc.recorder_id <> ? AND rc.vendor <> 'none' AND r.removed_at IS NULL LIMIT 1""", (primary,)).fetchone()
    return row is not None


def next_sort_order(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM recorders").fetchone()[0]


def upsert_recorder(conn: sqlite3.Connection, rid: str, name: str, created_at: str, vendor: str, sort_order: int) -> None:
    """A recorder being added, or revived (enabled again, removed_at cleared)."""
    conn.execute("""INSERT INTO recorders(id, name, model, firmware, last_seen_at, created_at, vendor, enabled, sort_order)
                    VALUES (?, ?, NULL, NULL, NULL, ?, ?, 1, ?)
                    ON CONFLICT(id) DO UPDATE SET name = excluded.name, vendor = excluded.vendor, enabled = 1, removed_at = NULL""",
                 (rid, name, created_at, vendor, sort_order))


def recorder_ids(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id FROM recorders").fetchall()


def connection_recorder_ids(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT recorder_id FROM recorder_connections").fetchall()


def update_recorder(conn: sqlite3.Connection, recorder_id: str, changes: dict[str, Any]) -> None:
    """`changes` maps column -> value; its keys are the router's fixed set (name, enabled, sort_order, time_zone), never request input."""
    sets = ", ".join(f"{k} = ?" for k in changes)
    conn.execute(f"UPDATE recorders SET {sets} WHERE id = ?", (*changes.values(), recorder_id))
