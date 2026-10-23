"""CR-SVC215 slice 1: the read-only SQL behind the computed vendor card (services/tickets/vendor_stats.py) - a store module of its own
(tests/test_tickets_visibility.test_ticket_sql_lives_in_the_store). Nothing is stored; every query is bounded by the unit's contact ids
and the window."""
from __future__ import annotations

import sqlite3
from typing import Any


def _marks(ids: list[str]) -> str:
    return ",".join("?" * len(ids))


def contact(conn: sqlite3.Connection, contact_id: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT id, kind, vendor_id, user_id, employee, erased_at, display_name FROM ticket_contacts WHERE id = ?", (contact_id,)).fetchone()
    return dict(row) if row else None


def unit_contact_ids(conn: sqlite3.Connection, unit_id: str) -> list[str]:
    """The company and its technicians (a freelancer: himself), erased rows excluded (section 10: not attributed to anyone)."""
    rows = conn.execute("SELECT id FROM ticket_contacts WHERE (id = ? OR vendor_id = ?) AND erased_at IS NULL AND employee = 0 AND user_id IS NULL",
                        (unit_id, unit_id)).fetchall()
    return [r[0] for r in rows]


def assignments(conn: sqlite3.Connection, contact_ids: list[str], since: str, until: str) -> list[dict[str, Any]]:
    if not contact_ids:
        return []
    sql = (f"SELECT a.id, a.ticket_id, a.contact_id, a.assigned_at, a.acknowledged_at, a.ended_at, a.return_kind FROM ticket_assignments a "
           f"WHERE a.assignee_kind = 'contact' AND a.contact_id IN ({_marks(contact_ids)}) AND a.assigned_at >= ? AND a.assigned_at < ? ORDER BY a.assigned_at")
    return [dict(r) for r in conn.execute(sql, [*contact_ids, since, until]).fetchall()]


def first_link_signals(conn: sqlite3.Connection, assignment_ids: list[str]) -> dict[str, str]:
    """assignment id -> the earliest vendor signal through his link: the first open of any of its links, or the first event written
    through the link (`via = 'link'`)."""
    out: dict[str, str] = {}
    if not assignment_ids:
        return out
    for k in range(0, len(assignment_ids), 400):
        part = assignment_ids[k:k + 400]
        for r in conn.execute(f"SELECT assignment_id, MIN(first_opened_at) FROM ticket_links WHERE assignment_id IN ({_marks(part)}) "
                              "AND first_opened_at IS NOT NULL GROUP BY assignment_id", part).fetchall():
            out[r[0]] = r[1]
        for r in conn.execute(f"SELECT assignment_id, MIN(at) FROM ticket_events WHERE assignment_id IN ({_marks(part)}) AND via = 'link' "
                              "GROUP BY assignment_id", part).fetchall():
            if r[1] and (r[0] not in out or r[1] < out[r[0]]):
                out[r[0]] = r[1]
    return out


def done_events(conn: sqlite3.Connection, assignment_ids: list[str], since: str, until: str) -> list[dict[str, Any]]:
    """The first move to `done` of each ticket by one of these assignments inside the window (the base of "repeat visits")."""
    if not assignment_ids:
        return []
    out: dict[str, dict[str, Any]] = {}
    for k in range(0, len(assignment_ids), 400):
        part = assignment_ids[k:k + 400]
        sql = (f"SELECT e.ticket_id, MIN(e.at) AS at, t.entity_id FROM ticket_events e JOIN tickets t ON t.id = e.ticket_id "
               f"WHERE e.assignment_id IN ({_marks(part)}) AND e.kind = 'status' AND e.to_status = 'done' AND e.at >= ? AND e.at < ? GROUP BY e.ticket_id")
        for r in conn.execute(sql, [*part, since, until]).fetchall():
            if r["ticket_id"] not in out or r["at"] < out[r["ticket_id"]]["at"]:
                out[r["ticket_id"]] = dict(r)
    return sorted(out.values(), key=lambda x: x["at"])


def reopened_between(conn: sqlite3.Connection, ticket_id: str, start: str, end: str) -> bool:
    row = conn.execute("SELECT 1 FROM ticket_events WHERE ticket_id = ? AND at > ? AND at <= ? AND (kind = 'reopened' OR (kind = 'status' "
                       "AND from_status IN ('done', 'closed') AND to_status NOT IN ('done', 'closed', 'cancelled'))) LIMIT 1",
                       (ticket_id, start, end)).fetchone()
    return row is not None


def same_device_followup(conn: sqlite3.Connection, ticket_id: str, entity_id: str, contact_ids: list[str], start: str, end: str) -> bool:
    """Another ticket on the same device created after `start` (up to `end`) and assigned to the same vendor."""
    if not entity_id or not contact_ids:
        return False
    sql = (f"SELECT 1 FROM tickets t JOIN ticket_assignments a ON a.ticket_id = t.id WHERE t.entity_id = ? AND t.id != ? AND t.created_at > ? "
           f"AND t.created_at <= ? AND a.assignee_kind = 'contact' AND a.contact_id IN ({_marks(contact_ids)}) LIMIT 1")
    return conn.execute(sql, [entity_id, ticket_id, start, end, *contact_ids]).fetchone() is not None


def open_tickets(conn: sqlite3.Connection, contact_ids: list[str]) -> list[dict[str, Any]]:
    """The requests open with the unit now (slice 2: the list behind the "open now" number), newest assignment first."""
    if not contact_ids:
        return []
    sql = (f"SELECT a.ticket_id, MAX(a.assigned_at) AS at FROM ticket_assignments a JOIN tickets t ON t.id = a.ticket_id WHERE a.assignee_kind = 'contact' "
           f"AND a.contact_id IN ({_marks(contact_ids)}) AND a.ended_at IS NULL AND t.status NOT IN ('closed', 'cancelled') GROUP BY a.ticket_id ORDER BY at DESC")
    return [dict(r) for r in conn.execute(sql, contact_ids).fetchall()]


def open_now(conn: sqlite3.Connection, contact_ids: list[str]) -> int:
    return len(open_tickets(conn, contact_ids))


def settled_claims_with_basis(conn: sqlite3.Connection, contact_ids: list[str], since: str, until: str) -> list[dict[str, Any]]:
    """Approved / paid demands of the unit approved in the window, each with its latest VENDOR revision that named a quote basis."""
    if not contact_ids:
        return []
    sql = (f"SELECT c.id AS claim_id, c.ticket_id, c.approved_at, r.total_minor, r.currency, r.basis_json FROM ticket_cost_claims c "
           f"JOIN ticket_cost_revisions r ON r.claim_id = c.id WHERE c.contact_id IN ({_marks(contact_ids)}) AND c.status IN ('approved', 'paid') "
           "AND c.approved_at >= ? AND c.approved_at < ? AND r.source = 'vendor' AND r.basis_json IS NOT NULL AND r.basis_json != 'null' "
           "AND r.seq = (SELECT MAX(r2.seq) FROM ticket_cost_revisions r2 WHERE r2.claim_id = c.id AND r2.source = 'vendor' "
           "AND r2.basis_json IS NOT NULL AND r2.basis_json != 'null')")
    return [dict(r) for r in conn.execute(sql, [*contact_ids, since, until]).fetchall()]


def visits(conn: sqlite3.Connection, unit_id: str, since: str, until: str) -> list[dict[str, Any]]:
    try:
        return [dict(r) for r in conn.execute("SELECT id, ticket_id, state, late, planned_from FROM ticket_visits WHERE vendor_id = ? AND planned_from >= ? "
                                              "AND planned_from < ? ORDER BY planned_from DESC", (unit_id, since, until)).fetchall()]
    except sqlite3.Error:
        return []
