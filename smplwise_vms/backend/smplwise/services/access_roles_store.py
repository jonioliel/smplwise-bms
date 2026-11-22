"""The SQL of the access roles router (routers/access_roles.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved
here unchanged (same text, same arguments). It runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def live_custom_roles(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """The custom roles not deleted, oldest first."""
    return conn.execute("SELECT * FROM custom_roles WHERE deleted_at IS NULL ORDER BY created_at").fetchall()
