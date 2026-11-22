"""The SQL of the door automations router (routers/door_automations.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def automation_rows(conn: sqlite3.Connection, automation_id: str) -> list[sqlite3.Row]:
    """The live door automations of one automation item."""
    return conn.execute("SELECT * FROM door_automations WHERE deleted_at IS NULL AND automation_item_id = ?", (automation_id,)).fetchall()


def all_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """Every live door automation, oldest first."""
    return conn.execute("SELECT * FROM door_automations WHERE deleted_at IS NULL ORDER BY created_at").fetchall()
