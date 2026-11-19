"""The SQL of the site settings patch router (routers/settings_patch/site.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def live_entity(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT entity_id, platform FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()


def live_floor_row(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    """A row when the floor exists and is not deleted, else None."""
    return conn.execute("SELECT 1 FROM floors WHERE id = ? AND deleted_at IS NULL", (floor_id,)).fetchone()
