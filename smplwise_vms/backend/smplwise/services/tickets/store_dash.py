"""MGRDASH phase 2 (docs/design/MANAGER_DASHBOARD_SPEC_HE.md section 7): ALL SQL of the manager overview's summary route, beside
store.py / store_costs.py / store_quotes.py / store_rfq.py. Read-only.

Nothing here decides who may see what: every function returns ids and the few columns a count needs, and services/tickets/dashboard.py
keeps a row only after the ticket passed access.visible() (and the caller manages it) or the request passed rfq.visible(). The reads
use the indexes of migration 0120 (ticket_events (to_status, at), tickets (done_at)) and the existing ones of 0083 / 0088 / 0089."""
from __future__ import annotations

import sqlite3
from typing import Any, Iterable


def status_moves(conn: sqlite3.Connection, to_statuses: Iterable[str], since: str, until: str) -> list[dict[str, Any]]:
    """Timeline rows that moved a ticket TO one of `to_statuses` between `since` and `until` (inclusive), oldest first."""
    st = list(to_statuses)
    if not st:
        return []
    return [dict(r) for r in conn.execute(
        "SELECT id, ticket_id, at, kind, from_status, to_status, assignment_id FROM ticket_events "
        f"WHERE to_status IN ({', '.join('?' * len(st))}) AND at >= ? AND at <= ? ORDER BY at, id", (*st, since, until)).fetchall()]


def done_between(conn: sqlite3.Connection, since: str, until: str) -> list[dict[str, Any]]:
    """(id, done_at) of the requests whose completion time lies in the period and that are still done or closed (handler_load's rule)."""
    return [dict(r) for r in conn.execute(
        "SELECT id, done_at FROM tickets WHERE done_at >= ? AND done_at <= ? AND status IN ('done', 'closed') ORDER BY done_at, id",
        (since, until)).fetchall()]


def assignment_at(conn: sqlite3.Connection, ticket_id: str, at: str) -> dict[str, Any] | None:
    """The assignment that held the ticket AT that instant: the latest one assigned at or before it that had not ended before it."""
    row = conn.execute(
        "SELECT id, assignee_kind, user_id, contact_id, assignee_name, assigned_at FROM ticket_assignments WHERE ticket_id = ? AND assigned_at <= ? "
        "AND (ended_at IS NULL OR ended_at >= ?) ORDER BY assigned_at DESC, rowid DESC LIMIT 1", (ticket_id, at, at)).fetchone()
    return dict(row) if row is not None else None


ASSIGNMENT_COLUMNS = ("id", "assignee_kind", "user_id", "contact_id", "assignee_name", "assigned_at")  # assignment_at()'s answer, in order
BATCH_IDS = 500


def assignments_of(conn: sqlite3.Connection, ticket_ids: Iterable[str]) -> dict[str, list[dict[str, Any]]]:
    """Every assignment of many tickets in IN batches (ticket id -> rows with `_rowid` and `ended_at`), for pick_assignment() - the
    batched form of assignment_at() (MGRDASH speed fix, docs/design/evidence/dash3/speed_fix.md)."""
    ids = list(dict.fromkeys(i for i in ticket_ids if i))
    out: dict[str, list[dict[str, Any]]] = {}
    for k in range(0, len(ids), BATCH_IDS):
        chunk = ids[k:k + BATCH_IDS]
        for r in conn.execute(
                "SELECT rowid AS _rowid, ticket_id, id, assignee_kind, user_id, contact_id, assignee_name, assigned_at, ended_at "
                f"FROM ticket_assignments WHERE ticket_id IN ({', '.join('?' * len(chunk))})", tuple(chunk)).fetchall():
            out.setdefault(r["ticket_id"], []).append(dict(r))
    return out


class NotComparable(Exception):
    """A value pick_assignment() cannot order exactly like SQLite (not text): the caller asks assignment_at() instead."""


def pick_assignment(rows: list[dict[str, Any]], at: Any) -> dict[str, Any] | None:
    """assignment_at() over rows read by assignments_of(), in Python: the latest assignment (assigned_at, then rowid) assigned at or before
    `at` that had not ended before it. Text compares like SQLite's BINARY collation (code point order = UTF-8 byte order); anything that
    is not text raises NotComparable rather than guess SQLite's cross-type order."""
    if not isinstance(at, str):
        raise NotComparable()
    best: dict[str, Any] | None = None
    for r in rows:
        a, e = r["assigned_at"], r["ended_at"]
        if not isinstance(a, str) or (e is not None and not isinstance(e, str)):
            raise NotComparable()
        if a > at or (e is not None and e < at):
            continue
        if best is None or (a, r["_rowid"]) > (best["assigned_at"], best["_rowid"]):
            best = r
    return {k: best[k] for k in ASSIGNMENT_COLUMNS} if best is not None else None


def last_done_before(conn: sqlite3.Connection, ticket_id: str, event_id: int) -> str | None:
    """The time of the ticket's latest move to `done` before that timeline row (the work a manager sent back or reopened), else None."""
    row = conn.execute("SELECT at FROM ticket_events WHERE ticket_id = ? AND to_status = 'done' AND id < ? ORDER BY id DESC LIMIT 1",
                       (ticket_id, int(event_id))).fetchone()
    return row[0] if row is not None else None


def submitted_ticket_quotes(conn: sqlite3.Connection, limit: int = 2000) -> list[dict[str, Any]]:
    """Quotes on tickets waiting for a manager's decision (state `submitted`), oldest first. Never an RFQ quote (no ticket)."""
    return [dict(r) for r in conn.execute(
        "SELECT id, ticket_id, contact_id, currency, total_minor, created_at FROM ticket_quotes "
        "WHERE state = 'submitted' AND ticket_id IS NOT NULL ORDER BY created_at, rowid LIMIT ?", (int(limit),)).fetchall()]


def submitted_claims(conn: sqlite3.Connection, limit: int = 2000) -> list[dict[str, Any]]:
    """Payment demands waiting for approval (status `submitted`) with the total of their current revision, oldest first."""
    return [dict(r) for r in conn.execute(
        "SELECT c.id, c.ticket_id, c.contact_id, c.currency, c.updated_at, r.total_minor FROM ticket_cost_claims c "
        "LEFT JOIN ticket_cost_revisions r ON r.id = c.current_revision_id "
        "WHERE c.status = 'submitted' AND c.ticket_id IS NOT NULL ORDER BY c.updated_at, c.rowid LIMIT ?", (int(limit),)).fetchall()]


def pending_second_awards(conn: sqlite3.Connection, limit: int = 500) -> list[dict[str, Any]]:
    """RFQ awards waiting for a second approval, oldest first."""
    return [dict(r) for r in conn.execute(
        "SELECT id, rfq_id, rfq_vendor_id, quote_id, first_by, first_at, currency, approved_total_minor FROM ticket_rfq_awards "
        "WHERE state = 'pending_second' ORDER BY first_at, rowid LIMIT ?", (int(limit),)).fetchall()]


def pending_second_rfqs(conn: sqlite3.Connection, rfq_ids: Iterable[str]) -> set[str]:
    """Which of these requests hold an award waiting for its second approval."""
    ids = list(rfq_ids)
    out: set[str] = set()
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        out.update(r[0] for r in conn.execute(
            f"SELECT DISTINCT rfq_id FROM ticket_rfq_awards WHERE state = 'pending_second' AND rfq_id IN ({', '.join('?' * len(chunk))})",
            chunk).fetchall())
    return out
