"""The SQL of the popup layout router (routers/popup_layout.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def area_floor(conn: sqlite3.Connection, area_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT floor_id FROM ha_areas WHERE area_id = ?", (area_id,)).fetchone()
