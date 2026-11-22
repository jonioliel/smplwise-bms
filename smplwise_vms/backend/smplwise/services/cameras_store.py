"""The SQL of the cameras router (routers/cameras.py; CR-ROUTER-SQL-2450, review 05:P2-07): every statement the router ran inline,
moved here unchanged (same text, same arguments, same order of calls). The router keeps the scope checks, the NVR calls and the
audit; each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3
from typing import Any

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- recorders

def ensure_recorder(conn: sqlite3.Connection, recorder_id: str, name: str, model: str | None, firmware: str | None, last_seen_at: str, created_at: str) -> None:
    """The recorder row, created or refreshed (model / firmware only when known)."""
    conn.execute(
        """INSERT INTO recorders(id, name, model, firmware, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET model = COALESCE(excluded.model, recorders.model), firmware = COALESCE(excluded.firmware, recorders.firmware), last_seen_at = excluded.last_seen_at""",
        (recorder_id, name, model, firmware, last_seen_at, created_at),
    )


def removed_recorder_rows(conn: sqlite3.Connection) -> Rows:
    """Raises sqlite3.OperationalError on a database before 0055."""
    return conn.execute("SELECT id FROM recorders WHERE removed_at IS NOT NULL").fetchall()


def recorder_name_rows(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, name FROM recorders").fetchall()


def recorder_vendor_rows(conn: sqlite3.Connection) -> Rows:
    """Raises sqlite3.OperationalError on a database without the column."""
    return conn.execute("SELECT id, vendor FROM recorders").fetchall()


def recorder(conn: sqlite3.Connection, recorder_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM recorders WHERE id = ?", (recorder_id,)).fetchone()


# ---------------------------------------------------------------- cameras

def cameras_in_order(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM cameras ORDER BY sort_order, channel").fetchall()


def camera(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()


def camera_exists(conn: sqlite3.Connection, camera_id: str) -> bool:
    return conn.execute("SELECT 1 FROM cameras WHERE id = ?", (camera_id,)).fetchone() is not None


def patch_camera(conn: sqlite3.Connection, camera_id: str, fields: dict[str, Any], at: str) -> None:
    """UPDATE the given columns (names from the route's request model, never input text)."""
    sets = ", ".join(f"{k} = ?" for k in fields)
    conn.execute(f"UPDATE cameras SET {sets}, updated_at = ? WHERE id = ?", (*fields.values(), at, camera_id))


def camera_on_channel(conn: sqlite3.Connection, recorder_id: str, channel: int) -> sqlite3.Row | None:
    return conn.execute("SELECT id FROM cameras WHERE recorder_id = ? AND channel = ?", (recorder_id, channel)).fetchone()


def set_alias(conn: sqlite3.Connection, camera_id: str, alias: str, at: str) -> None:
    conn.execute("UPDATE cameras SET alias = ?, updated_at = ? WHERE id = ?", (alias, at, camera_id))


def insert_camera(conn: sqlite3.Connection, camera_id: str, recorder_id: str, channel: int, alias: str, sort_order: int, at: str) -> None:
    conn.execute("INSERT INTO cameras(id, recorder_id, channel, alias, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (camera_id, recorder_id, channel, alias, sort_order, at, at))


def set_source_ref(conn: sqlite3.Connection, camera_id: str, source_ref: str) -> None:
    """Raises sqlite3.OperationalError on a database without the column (the caller ignores it, as before)."""
    conn.execute("UPDATE cameras SET source_ref = ? WHERE id = ?", (source_ref, camera_id))
