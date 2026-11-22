"""The SQL of the door technician router (routers/access_control_door_tech.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def door_write_rows(conn: sqlite3.Connection, since: str, actions: tuple[str, ...], station_id: str) -> list[sqlite3.Row]:
    """The station's door-write audit rows (one of `actions`) at or after `since`, newest first, at most 120."""
    marks = ",".join("?" for _ in actions)
    return conn.execute(
        f"SELECT at, action, reason, details_json FROM audit_log WHERE at >= ? AND action IN ({marks}) AND resource_id = ? ORDER BY id DESC LIMIT 120",
        (since, *actions, station_id),
    ).fetchall()
