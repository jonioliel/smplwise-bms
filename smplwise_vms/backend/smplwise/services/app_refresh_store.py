"""The SQL of the app refresh router (routers/app_refresh.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def live_family_devices(conn: sqlite3.Connection, user_id: str) -> list[sqlite3.Row]:
    """The devices of the user's refresh families not revoked."""
    return conn.execute("SELECT device_id FROM app_refresh_families WHERE user_id = ? AND revoked_at IS NULL", (user_id,)).fetchall()


def device_owner_row(conn: sqlite3.Connection, device_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT user_id FROM mobile_devices WHERE id = ?", (device_id,)).fetchone()
