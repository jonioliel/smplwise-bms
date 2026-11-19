"""The SQL of the automation blueprints router (routers/automation_blueprints.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def area_entity_rows(conn: sqlite3.Connection, by: str, ident: str) -> list[sqlite3.Row]:
    """The live entities of one floor (`by == "floor"`) or area (anything else); the column name is one of two constants."""
    col = "ha_floor_id" if by == "floor" else "area_id"
    return conn.execute(
        f"SELECT entity_id, domain FROM ha_entities WHERE removed_at IS NULL AND {col} = ? ORDER BY entity_id", (ident,)).fetchall()
