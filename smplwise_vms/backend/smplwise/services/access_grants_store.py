"""The SQL of the access grants router (routers/access_grants.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved
here unchanged (same text, same arguments). It runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def ticket_row(conn: sqlite3.Connection, ticket_id: str) -> sqlite3.Row | None:
    """A row when the ticket exists, else None."""
    return conn.execute("SELECT 1 FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
