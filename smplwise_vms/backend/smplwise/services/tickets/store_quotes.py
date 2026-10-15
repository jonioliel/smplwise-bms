"""TK257: ALL SQL of the vendor's quotes before the work (migration 0085, `ticket_cost_quotes`) - the storage layer beside store_costs.py.
Every function takes ids the caller already resolved (the link's assignment / ticket for the public routes, a visible ticket for the
manager's routes); nothing here finds tickets."""
from __future__ import annotations

import sqlite3
from typing import Any, Mapping


def of_assignment(conn: sqlite3.Connection, assignment_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_cost_quotes WHERE assignment_id = ? ORDER BY seq", (assignment_id,)).fetchall()]


def of_ticket(conn: sqlite3.Connection, ticket_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_cost_quotes WHERE ticket_id = ? ORDER BY created_at, seq", (ticket_id,)).fetchall()]


def get(conn: sqlite3.Connection, quote_id: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM ticket_cost_quotes WHERE id = ?", (quote_id,)).fetchone()
    return dict(row) if row is not None else None


def next_seq(conn: sqlite3.Connection, assignment_id: str) -> int:
    return int(conn.execute("SELECT COALESCE(MAX(seq), 0) + 1 FROM ticket_cost_quotes WHERE assignment_id = ?", (assignment_id,)).fetchone()[0])


def supersede(conn: sqlite3.Connection, quote_id: str) -> None:
    conn.execute("UPDATE ticket_cost_quotes SET state = 'superseded' WHERE id = ?", (quote_id,))


def insert(conn: sqlite3.Connection, row: Mapping[str, Any]) -> None:
    cols = list(row)
    conn.execute(f"INSERT INTO ticket_cost_quotes({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", tuple(row[c] for c in cols))


def decide(conn: sqlite3.Connection, quote_id: str, state: str, reason: str | None, by: str, at: str) -> None:
    conn.execute("UPDATE ticket_cost_quotes SET state = ?, reason = ?, decided_by = ?, decided_at = ? WHERE id = ?", (state, reason, by, at, quote_id))
