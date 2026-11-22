"""The SQL of the triage router (routers/access_control_triage.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def triage_rows(conn: sqlite3.Connection, since: str, resolve: str, deletion: str, alert: str) -> list[sqlite3.Row]:
    """The triage audit rows (the three actions) at or after `since`, newest first, at most 400."""
    return conn.execute(
        "SELECT at, action, resource_id, reason, details_json FROM audit_log WHERE at >= ? AND action IN (?, ?, ?) ORDER BY id DESC LIMIT 400",
        (since, resolve, deletion, alert),
    ).fetchall()
