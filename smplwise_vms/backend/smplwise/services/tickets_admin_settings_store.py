"""The SQL of the tickets admin settings router (routers/tickets_admin_settings.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def live_custom_role_names(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT id, name_he FROM custom_roles WHERE deleted_at IS NULL").fetchall()


def active_users(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """The active users by display name, then username."""
    return conn.execute("SELECT id, username, display_name FROM users WHERE active = 1 ORDER BY display_name, username").fetchall()
