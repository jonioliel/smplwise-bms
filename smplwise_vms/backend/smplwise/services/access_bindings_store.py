"""The SQL of the access bindings router (routers/access_bindings.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3

from .rbac_admin import _active_bindings_sql


def active_bindings(conn: sqlite3.Connection, now: str) -> list[sqlite3.Row]:
    """The bindings active at `now` (the statement services/rbac_admin builds)."""
    return conn.execute(_active_bindings_sql(), (now,)).fetchall()


def binding(conn: sqlite3.Connection, binding_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM bindings WHERE id = ?", (binding_id,)).fetchone()


def live_binding(conn: sqlite3.Connection, binding_id: str) -> sqlite3.Row | None:
    """The binding when it is not revoked, else None."""
    return conn.execute("SELECT * FROM bindings WHERE id = ? AND revoked_at IS NULL", (binding_id,)).fetchone()
