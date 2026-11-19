"""The SQL of the access diagnostics router (routers/access_control_diag.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3
from typing import Any


def review_actor_rows(conn: sqlite3.Connection, ids: list[str]) -> list[sqlite3.Row]:
    """Arx's own record of who took each review decision (by receipt id)."""
    marks = ",".join("?" for _ in ids)
    return conn.execute(
        f"SELECT receipt_id, actor_user_id, actor_name FROM wiskey_access_review_decisions WHERE receipt_id IN ({marks})", ids).fetchall()


def record_review_decision(conn: sqlite3.Connection, values: tuple[Any, ...]) -> None:
    """INSERT OR IGNORE one review decision; `values` = the 14 columns in the statement's order."""
    conn.execute(
        "INSERT OR IGNORE INTO wiskey_access_review_decisions(receipt_id, user_id, station_id, lock_id, person_revision, decision, reason, cadence_days, "
        "decided_at, due_at, actor_user_id, actor_name, command_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        values,
    )
