"""The SQL of the home wall events router (routers/home_wall_events.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def family_calendar_ids(conn: sqlite3.Connection, family_types: tuple[str, str]) -> list[sqlite3.Row]:
    """The live calendars of the two family types, by name key."""
    return conn.execute("SELECT id FROM cal_calendars WHERE archived_at IS NULL AND type IN (?, ?) ORDER BY name_key", family_types).fetchall()
