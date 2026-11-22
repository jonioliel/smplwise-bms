"""The SQL of the health router (routers/health.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def push_subscription_counts(conn: sqlite3.Connection) -> sqlite3.Row:
    """(subscriptions, distinct users)."""
    return conn.execute("SELECT COUNT(*), COUNT(DISTINCT user_id) FROM push_subscriptions").fetchone()


def push_key_row(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute("SELECT 1 FROM push_vapid WHERE id = 1").fetchone()


def event_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]


def select_one(conn: sqlite3.Connection) -> int:
    """The database answers: `SELECT 1`."""
    return conn.execute("SELECT 1").fetchone()[0]


def camera_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM cameras").fetchone()[0]
