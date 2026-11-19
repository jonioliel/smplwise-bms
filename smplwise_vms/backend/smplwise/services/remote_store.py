"""The SQL of the remote-channel router (routers/remote.py, CR-008; CR-ROUTER-SQL-D-2460, review 05:P2-07): every statement the
router ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the permission checks,
the row bound of the CSP counters, the audit and the sessions; each function runs on the connection the route (or the router's own
`db.connection(...)` block) hands it."""
from __future__ import annotations

import sqlite3

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- the per-user remote-access flag

def user_known(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    """A row when the id is a local user or a Home Assistant user."""
    return conn.execute("SELECT 1 FROM users WHERE id = ? UNION SELECT 1 FROM ha_users WHERE id = ?", (user_id, user_id)).fetchone()


def grant_remote_access(conn: sqlite3.Connection, user_id: str, granted_by: str, granted_at: str) -> None:
    conn.execute("INSERT OR IGNORE INTO remote_access_users(user_id, granted_by, granted_at) VALUES (?, ?, ?)", (user_id, granted_by, granted_at))


def revoke_remote_access(conn: sqlite3.Connection, user_id: str) -> None:
    conn.execute("DELETE FROM remote_access_users WHERE user_id = ?", (user_id,))


# ---------------------------------------------------------------- local sign-ins

def chain_user_agents(conn: sqlite3.Connection, chain_id: str) -> Rows:
    return conn.execute("SELECT user_agent FROM auth_local_sessions WHERE chain_id = ?", (chain_id,)).fetchall()


# ---------------------------------------------------------------- CSP counters

def csp_counter(conn: sqlite3.Connection, disposition: str, directive: str, blocked: str) -> sqlite3.Row | None:
    return conn.execute("SELECT 1 FROM csp_reports WHERE disposition = ? AND directive = ? AND blocked = ?", (disposition, directive, blocked)).fetchone()


def csp_row_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM csp_reports").fetchone()[0]


def count_csp(conn: sqlite3.Connection, disposition: str, directive: str, blocked: str, now: str) -> None:
    """Insert the counter at 1, or add one to it and move its last_at."""
    conn.execute(
        """INSERT INTO csp_reports(disposition, directive, blocked, count, first_at, last_at) VALUES (?, ?, ?, 1, ?, ?)
                   ON CONFLICT(disposition, directive, blocked) DO UPDATE SET count = count + 1, last_at = excluded.last_at""",
        (disposition, directive, blocked, now, now))


def csp_reports(conn: sqlite3.Connection) -> Rows:
    """Most counted first, then most recent."""
    return conn.execute("SELECT disposition, directive, blocked, count, first_at, last_at FROM csp_reports ORDER BY count DESC, last_at DESC").fetchall()


def clear_csp_reports(conn: sqlite3.Connection) -> int:
    """The number of rows deleted."""
    return conn.execute("DELETE FROM csp_reports").rowcount
