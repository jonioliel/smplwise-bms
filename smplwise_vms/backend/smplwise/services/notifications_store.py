"""The SQL of the notification centre router (routers/notifications.py, CR-018; CR-ROUTER-SQL-B-2450, review 05:P2-07): every statement the
router ran inline, moved here unchanged (same text, same arguments, same order of calls). The two delivery lists keep their builders. The
router keeps the permission checks (`notify.manage`, the caller's reach), the validation and the audit; each function runs on the
connection the route hands it. services/notify*.py stay the notification engine."""
from __future__ import annotations

import sqlite3
from typing import Any

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- deliveries

def own_deliveries(conn: sqlite3.Connection, user_id: str, notification_id: str | None) -> Rows:
    """The user's own delivery rows with the notification's title and source, newest first, at most 400 (optionally of one notification)."""
    sql = "SELECT d.*, n.title, n.source FROM notification_deliveries d JOIN notifications n ON n.id = d.notification_id WHERE d.user_id = ?"
    params: list[Any] = [user_id]
    if notification_id:
        sql += " AND d.notification_id = ?"
        params.append(notification_id)
    return conn.execute(sql + " ORDER BY d.created_at DESC, d.id DESC LIMIT 400", params).fetchall()


def all_deliveries(conn: sqlite3.Connection, status: str | None, channel: str | None, since: str | None, limit: int) -> Rows:
    """Everyone's delivery rows, newest first: `status` "failures" = failed or gone, another status exactly; `since` an already validated
    UTC instant."""
    sql = "SELECT d.*, n.title, n.source FROM notification_deliveries d JOIN notifications n ON n.id = d.notification_id WHERE 1 = 1"
    params: list[Any] = []
    if status == "failures":
        sql += " AND d.status IN ('failed', 'gone')"
    elif status:
        sql += " AND d.status = ?"
        params.append(status)
    if channel:
        sql += " AND d.channel = ?"
        params.append(channel)
    if since:
        sql += " AND d.created_at >= ?"
        params.append(since)
    return conn.execute(sql + " ORDER BY d.created_at DESC, d.id DESC LIMIT ?", (*params, limit)).fetchall()


def delivery_counts_since(conn: sqlite3.Connection, since: str) -> Rows:
    return conn.execute("SELECT channel, status, COALESCE(reason, '') AS reason, COUNT(*) AS n FROM notification_deliveries WHERE created_at >= ? GROUP BY channel, status, reason", (since,)).fetchall()


# ---------------------------------------------------------------- notifications, users, push devices

def notification(conn: sqlite3.Connection, nid: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM notifications WHERE id = ?", (nid,)).fetchone()


def notification_counts_by_source_since(conn: sqlite3.Connection, since: str) -> Rows:
    return conn.execute("SELECT source, COUNT(*) AS n FROM notifications WHERE created_at >= ? GROUP BY source ORDER BY n DESC", (since,)).fetchall()


def user_names(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,)).fetchone()


def has_push_subscription(conn: sqlite3.Connection, user_id: str) -> bool:
    return conn.execute("SELECT 1 FROM push_subscriptions WHERE user_id = ?", (user_id,)).fetchone() is not None


def push_subscription_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM push_subscriptions").fetchone()[0]


# ---------------------------------------------------------------- policies

def policy_exists(conn: sqlite3.Connection, source: str) -> bool:
    return conn.execute("SELECT 1 FROM notify_policies WHERE source = ?", (source,)).fetchone() is not None


def update_policy(conn: sqlite3.Connection, source: str, cols: dict[str, Any], updated_by: str, updated_at: str) -> None:
    """`cols` = notify_policy.validate_update(...) (validated column names); the revision moves."""
    conn.execute(f"UPDATE notify_policies SET {', '.join(f'{k} = ?' for k in cols)}, revision = revision + 1, updated_by = ?, updated_at = ? WHERE source = ?",
                 (*cols.values(), updated_by, updated_at, source))
