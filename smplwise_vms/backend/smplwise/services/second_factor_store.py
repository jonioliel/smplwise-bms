"""The SQL of the second factor router (routers/second_factor.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def user_row(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    """A row when the user exists, else None."""
    return conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone()
