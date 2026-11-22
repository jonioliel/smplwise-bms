"""The SQL of the automation extensions router (routers/automation_ext.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def live_device_row(conn: sqlite3.Connection, device_id: str) -> sqlite3.Row | None:
    """A row when the device is known and not removed, else None."""
    return conn.execute("SELECT 1 FROM ha_devices WHERE device_id = ? AND removed_at IS NULL", (device_id,)).fetchone()
