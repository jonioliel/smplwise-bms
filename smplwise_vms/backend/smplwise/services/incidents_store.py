"""The SQL of the incidents router (routers/incidents.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def event(conn: sqlite3.Connection, event_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id, camera_id, type, occurred_at, source, details_json FROM events WHERE id = ?", (event_id,)).fetchone()


def entity_name_row(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT name FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()


def live_entity_row(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    """A row when the entity is known and not removed, else None."""
    return conn.execute("SELECT 1 FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()
