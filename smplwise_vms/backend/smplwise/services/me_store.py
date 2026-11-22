"""The SQL of the me router (routers/me.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def local_credential(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT must_change, reset_mode FROM auth_local_credentials WHERE user_id = ?", (user_id,)).fetchone()
