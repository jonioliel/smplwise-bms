"""The SQL of the offline field router (routers/offline_field.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def devices(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """The offline devices, last seen first (at most 500)."""
    return conn.execute("SELECT * FROM offline_devices ORDER BY last_seen_at DESC LIMIT 500").fetchall()


def round_points(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM offline_round_points ORDER BY name").fetchall()


def round_point_row(conn: sqlite3.Connection, point_id: str) -> sqlite3.Row | None:
    """A row when the round point exists, else None."""
    return conn.execute("SELECT 1 FROM offline_round_points WHERE id = ?", (point_id,)).fetchone()
