"""The SQL of the plan geometry router (routers/plan_geometry.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def floor_name_row(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT name FROM floors WHERE id = ?", (floor_id,)).fetchone()


def live_floor_row(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    """A row when the floor exists and is not deleted, else None."""
    return conn.execute("SELECT 1 FROM floors WHERE id = ? AND deleted_at IS NULL", (floor_id,)).fetchone()


def set_calibration(conn: sqlite3.Connection, version_id: str, scale: float | None, calibration_json: str) -> None:
    """The version's scale and calibration record; its revision goes up by one."""
    conn.execute("UPDATE plan_versions SET scale_m_per_px = ?, calibration_json = ?, revision = revision + 1 WHERE id = ?",
                 (scale, calibration_json, version_id))
