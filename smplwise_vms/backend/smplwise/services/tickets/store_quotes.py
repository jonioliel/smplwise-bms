"""TKDETAILBE (docs/tickets/DETAIL_BACKEND_CONTRACT.md, migration 0087): ALL SQL of the quotes, their decisions, the internal owner
history and the allowed line kinds - beside store.py / store_costs.py. No ticket is looked up here around the visibility rule: every
function takes a ticket id the caller already resolved through access.py (internal routes) or a handler link (public routes)."""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Mapping

from ...db import new_id


def _dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _insert(conn: sqlite3.Connection, table: str, row: Mapping[str, Any]) -> None:
    cols = list(row)
    conn.execute(f"INSERT INTO {table}({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", tuple(row[c] for c in cols))


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


# ---------------------------------------------------------------- quotes

def quote(conn: sqlite3.Connection, quote_id: str | None) -> dict[str, Any] | None:
    if not quote_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_quotes WHERE id = ?", (quote_id,)).fetchone())


def quotes_of_ticket(conn: sqlite3.Connection, ticket_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_quotes WHERE ticket_id = ? ORDER BY created_at, version, rowid",
                                          (ticket_id,)).fetchall()]


def quotes_of_assignment(conn: sqlite3.Connection, assignment_id: str | None) -> list[dict[str, Any]]:
    if not assignment_id:
        return []
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_quotes WHERE assignment_id = ? ORDER BY version, rowid",
                                          (assignment_id,)).fetchall()]


def next_version(conn: sqlite3.Connection, assignment_id: str) -> int:
    return int(conn.execute("SELECT COALESCE(MAX(version), 0) + 1 FROM ticket_quotes WHERE assignment_id = ?", (assignment_id,)).fetchone()[0])


def insert_quote(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    qid = row.get("id") or new_id()
    full = dict(row)
    full["id"] = qid
    if not isinstance(full.get("lines_json"), str):
        full["lines_json"] = dumps(full.get("lines_json") or [])
    _insert(conn, "ticket_quotes", full)
    return qid


def update_quote(conn: sqlite3.Connection, quote_id: str, fields: Mapping[str, Any], *, now: str, expect_revision: int | None = None) -> bool:
    cols = list(fields)
    sets = ", ".join(f"{c} = ?" for c in cols)
    sql = f"UPDATE ticket_quotes SET {sets + ', ' if sets else ''}revision = revision + 1, updated_at = ? WHERE id = ?"
    args: list[Any] = [*[fields[c] for c in cols], now, quote_id]
    if expect_revision is not None:
        sql += " AND revision = ?"
        args.append(expect_revision)
    return conn.execute(sql, args).rowcount == 1


def insert_decision(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    did = new_id()
    _insert(conn, "ticket_quote_decisions", {**row, "id": did})
    return did


def decisions(conn: sqlite3.Connection, quote_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_quote_decisions WHERE quote_id = ? ORDER BY at, rowid", (quote_id,)).fetchall()]


# ---------------------------------------------------------------- the internal owner

def owner_changes(conn: sqlite3.Connection, ticket_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_owner_changes WHERE ticket_id = ? ORDER BY id", (ticket_id,)).fetchall()]


def insert_owner_change(conn: sqlite3.Connection, row: Mapping[str, Any]) -> int:
    cols = list(row)
    cur = conn.execute(f"INSERT INTO ticket_owner_changes({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", tuple(row[c] for c in cols))
    return int(cur.lastrowid)


def last_owner_change_to(conn: sqlite3.Connection, ticket_id: str, user_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT at, source FROM ticket_owner_changes WHERE ticket_id = ? AND to_user_id = ? ORDER BY id DESC LIMIT 1",
                              (ticket_id, user_id)).fetchone())


def event_of_ticket(conn: sqlite3.Connection, ticket_id: str, event_id: int) -> dict[str, Any] | None:
    """One timeline row of a ticket the caller already resolved (the forward of an internal note)."""
    return _dict(conn.execute("SELECT * FROM ticket_events WHERE id = ? AND ticket_id = ?", (event_id, ticket_id)).fetchone())


def set_owner(conn: sqlite3.Connection, ticket_id: str, user_id: str | None) -> None:
    """The owner column only - never the ticket's revision (an owner is not an edit of the ticket's fields)."""
    conn.execute("UPDATE tickets SET internal_owner_user_id = ? WHERE id = ?", (user_id, ticket_id))


# ---------------------------------------------------------------- allowed line kinds

def set_ticket_kinds(conn: sqlite3.Connection, ticket_id: str, kinds: list[str] | None) -> None:
    conn.execute("UPDATE tickets SET allowed_line_kinds = ? WHERE id = ?", (dumps(kinds) if kinds is not None else None, ticket_id))


def set_department_kinds(conn: sqlite3.Connection, dept_id: str, kinds: list[str] | None) -> None:
    conn.execute("UPDATE ticket_departments SET allowed_line_kinds = ? WHERE id = ?", (dumps(kinds) if kinds is not None else None, dept_id))


def department_kinds(conn: sqlite3.Connection, dept_id: str | None) -> str | None:
    if not dept_id:
        return None
    row = conn.execute("SELECT allowed_line_kinds FROM ticket_departments WHERE id = ?", (dept_id,)).fetchone()
    return row[0] if row else None
