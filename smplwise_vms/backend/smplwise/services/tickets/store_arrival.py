"""VENDORARRIVAL126-295: the SQL of the vendor-arrival signal (`ticket_vendor_arrivals`, migration 0190 PROVISIONAL) and the two reads of
the expected arrival window that no other module exposes (the awarded RFQ's planned window; the start of the vendor's own access
request). A store module of its own, like store_acceptance.py: services/tickets/vendor_arrival.py holds the logic, no SQL."""
from __future__ import annotations

import sqlite3
from typing import Any

WATCHED_STATUSES = ("assigned", "acknowledged")  # a vendor who started the work (in_progress and on) is evidently there
LIVE_GRANT_STATES = ("requested", "approved", "provisioning", "active")


def get(conn: sqlite3.Connection, assignment_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM ticket_vendor_arrivals WHERE assignment_id = ?", (assignment_id,)).fetchone()
    return dict(r) if r is not None else None


def record_arrival(conn: sqlite3.Connection, *, assignment_id: str, ticket_id: str, contact_id: str | None, at: str) -> bool:
    """The vendor's tap. True when this is the FIRST arrival of the assignment (a repeat changes nothing)."""
    row = get(conn, assignment_id)
    if row is None:
        conn.execute("INSERT INTO ticket_vendor_arrivals(assignment_id, ticket_id, contact_id, arrived_at, arrived_via, created_at) "
                     "VALUES (?, ?, ?, ?, 'vendor_tap', ?)", (assignment_id, ticket_id, contact_id, at, at))
        return True
    if row["arrived_at"]:
        return False
    conn.execute("UPDATE ticket_vendor_arrivals SET arrived_at = ?, arrived_via = 'vendor_tap' WHERE assignment_id = ?", (at, assignment_id))
    return True


def note_alert(conn: sqlite3.Connection, *, assignment_id: str, ticket_id: str, contact_id: str | None, at: str) -> int:
    """One more missed-arrival alert was sent; returns its number (1, 2, ...)."""
    if get(conn, assignment_id) is None:
        conn.execute("INSERT INTO ticket_vendor_arrivals(assignment_id, ticket_id, contact_id, created_at) VALUES (?, ?, ?, ?)",
                     (assignment_id, ticket_id, contact_id, at))
    conn.execute("UPDATE ticket_vendor_arrivals SET alerts_sent = alerts_sent + 1, last_alert_at = ?, missed_at = COALESCE(missed_at, ?) WHERE assignment_id = ?",
                 (at, at, assignment_id))
    return int(conn.execute("SELECT alerts_sent FROM ticket_vendor_arrivals WHERE assignment_id = ?", (assignment_id,)).fetchone()[0])


def clear_missed(conn: sqlite3.Connection, assignment_id: str) -> None:
    """The window moved (a new planned time): the alert ladder starts again."""
    conn.execute("UPDATE ticket_vendor_arrivals SET missed_at = NULL, alerts_sent = 0, last_alert_at = NULL WHERE assignment_id = ?", (assignment_id,))


def watched_ticket_ids(conn: sqlite3.Connection, limit: int) -> list[str]:
    """Open tickets held by an outside contact whose assignment has no arrival yet and whose status says the work did not start."""
    marks = ",".join("?" * len(WATCHED_STATUSES))
    return [r[0] for r in conn.execute(
        f"SELECT t.id FROM tickets t JOIN ticket_assignments a ON a.id = t.current_assignment_id "
        f"LEFT JOIN ticket_vendor_arrivals v ON v.assignment_id = a.id "
        f"WHERE a.assignee_kind = 'contact' AND a.ended_at IS NULL AND t.status IN ({marks}) AND (v.assignment_id IS NULL OR v.arrived_at IS NULL) "
        f"ORDER BY t.id LIMIT ?", (*WATCHED_STATUSES, int(limit))).fetchall()]


def planned_window(conn: sqlite3.Connection, assignment_id: str) -> tuple[str | None, str | None] | None:
    """The awarded RFQ's CURRENT planned arrival window of this assignment (it follows a manager's reschedule and a confirmed proposal),
    or None when the assignment is not an RFQ work order or the award has no planned time."""
    try:
        r = conn.execute(
            "SELECT t.planned_from, t.planned_to FROM ticket_quotes q JOIN ticket_rfq_awards a ON a.rfq_vendor_id = q.rfq_vendor_id AND a.state = 'approved' "
            "JOIN ticket_rfq_award_terms t ON t.award_id = a.id WHERE q.assignment_id = ? AND t.planned_from IS NOT NULL "
            "ORDER BY a.created_at DESC LIMIT 1", (assignment_id,)).fetchone()
    except sqlite3.Error:  # an installation without the RFQ tables
        return None
    return (r["planned_from"], r["planned_to"]) if r is not None else None


def request_start(conn: sqlite3.Connection, assignment_id: str) -> str | None:
    """The first valid-from instant of the vendor's own live door-access request on this assignment ("who arrives, when") - the time he
    said he would come. Read only; a regular assignment has no other planned arrival."""
    marks = ",".join("?" * len(LIVE_GRANT_STATES))
    try:
        r = conn.execute(f"SELECT valid_from FROM access_grants WHERE assignment_id = ? AND state IN ({marks}) AND valid_from IS NOT NULL "
                         f"ORDER BY created_at DESC LIMIT 1", (assignment_id, *LIVE_GRANT_STATES)).fetchone()
    except sqlite3.Error:
        return None
    return r["valid_from"] if r is not None else None
