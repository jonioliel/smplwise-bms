"""The SQL of the messaging accounts router (routers/messaging_accounts.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def ha_user_admin_row(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT is_admin FROM ha_users WHERE id = ?", (user_id,)).fetchone()
