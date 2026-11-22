"""The SQL of the push router (routers/push.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def subscription(conn: sqlite3.Connection, sub_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id, user_id, endpoint FROM push_subscriptions WHERE id = ?", (sub_id,)).fetchone()


def delete_subscription(conn: sqlite3.Connection, sub_id: str) -> None:
    conn.execute("DELETE FROM push_subscriptions WHERE id = ?", (sub_id,))


def user_subscription_row(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    """A row when the user has any push subscription, else None."""
    return conn.execute("SELECT 1 FROM push_subscriptions WHERE user_id = ?", (user_id,)).fetchone()
