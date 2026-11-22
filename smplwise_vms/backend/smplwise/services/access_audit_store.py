"""The SQL of the access audit router (routers/access_audit.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3
from typing import Any

from ..auth import normalize_username


def user_row(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def audit_rows(conn: sqlite3.Connection, view: str | None, prefix: str, channel: str | None, actor_kind: str | None, actor: str | None,
               resource_id: str | None, limit: int) -> list[sqlite3.Row]:
    """The audit screen's rows, newest first: the statement built from the screen's filters exactly as the route built it (the
    filter values arrive as parameters; `view`, `channel` and `actor_kind` only pick fixed fragments)."""
    detail = "COALESCE(CASE WHEN json_valid(details_json) THEN json_extract(details_json, '$.{0}') END, '')"
    remote_row = f"({detail.format('channel')} = 'remote' OR action LIKE 'auth.remote%')"
    if view == "remote_sign_ins":
        sql = "SELECT * FROM audit_log WHERE action LIKE 'auth.remote%'"
        args: list[Any] = []
    elif view == "remote_refusals":
        sql = f"SELECT * FROM audit_log WHERE decision = 'denied' AND {remote_row}"
        args = []
    else:
        sql = "SELECT * FROM audit_log WHERE action LIKE ?"
        args = [prefix + "%"]
    if channel == "remote":
        sql += f" AND {remote_row}"
    elif channel == "bearer":
        sql += f" AND {detail.format('via')} = 'bearer'"
    elif channel == "local":
        sql += f" AND NOT {remote_row}"
    # CR-AUTODOORS-295: `automation` = the rows of the automation operators (actor `automation:<block id>`, e.g. a door an
    # automation opened); `person` = everything else
    if actor_kind == "automation":
        sql += " AND actor_user_id LIKE 'automation:%'"
    elif actor_kind == "person":
        sql += " AND (actor_user_id IS NULL OR actor_user_id NOT LIKE 'automation:%')"
    if actor:
        # HA 2026.10 normalises usernames (strip + casefold, core#175613): "Joni" finds the rows written as "joni" before
        # or after a rename. SQLite's LOWER() is ASCII-only, so the same Python normalisation runs on both sides.
        # A name that is empty once normalised matches nothing (never the rows without an actor).
        conn.create_function("sw_username_norm", 1, normalize_username, deterministic=True)
        sql += " AND actor_username IS NOT NULL AND sw_username_norm(actor_username) = ?"
        args.append(normalize_username(actor) or "\x00")
    if resource_id:
        sql += " AND resource_id = ?"
        args.append(resource_id)
    sql += " ORDER BY rowid DESC LIMIT ?"
    args.append(limit)
    return conn.execute(sql, args).fetchall()
