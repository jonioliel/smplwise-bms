"""The SQL of the access directory router (routers/access_directory.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved
here unchanged (same text, same arguments). It runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def ha_user_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM ha_users").fetchone()[0]
