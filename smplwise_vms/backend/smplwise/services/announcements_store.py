"""The SQL of the announcements router (routers/announcements.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def tts_engine_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """The speech engines the home system exposes (enabled, not removed), first 50 by entity id."""
    return conn.execute("SELECT entity_id, name, platform FROM ha_entities WHERE entity_id LIKE 'tts.%' AND disabled = 0 AND removed_at IS NULL ORDER BY entity_id LIMIT 50").fetchall()
