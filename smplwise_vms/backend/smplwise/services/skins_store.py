"""The SQL of the plan skins router (routers/skins.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def last_test_render(conn: sqlite3.Connection) -> sqlite3.Row | None:
    """The newest test render (by time, then row id)."""
    return conn.execute("SELECT created_at, status, http_status, error_code, model FROM plan_skin_renders WHERE test = 1 ORDER BY created_at DESC, rowid DESC LIMIT 1").fetchone()
