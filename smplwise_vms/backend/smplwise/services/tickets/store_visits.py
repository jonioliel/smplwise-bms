"""CR-SVC215 slice 1: the SQL of the visits (`ticket_visits`, migration 0155) and of the two department columns `visit_grace_min` /
`visit_detect` - a store module of its own (tests/test_tickets_visibility.test_ticket_sql_lives_in_the_store). No rule lives here:
services/tickets/visits.py decides; every person's read of a visit goes through the ticket's visibility first (the caller passes
a ticket the person may see)."""
from __future__ import annotations

import sqlite3
from typing import Any

from ...db import new_id, now_iso

COLUMNS = ("id", "ticket_id", "assignment_id", "department_id", "contact_id", "vendor_id", "planned_from", "planned_to", "source", "grace_min",
           "state", "claimed_at", "arrived_at", "arrived_by", "arrived_actor", "late", "claim_undone_at", "claim_undone_by", "missed_at",
           "missed_notified_at", "vendor_messaged_at", "rescheduled_to", "cancelled_at", "cancelled_by", "created_by_kind", "created_by",
           "revision", "created_at", "updated_at")
MUTABLE = frozenset(COLUMNS) - {"id", "ticket_id", "created_at", "created_by_kind", "created_by", "revision"}


def _d(row: Any) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def insert_visit(conn: sqlite3.Connection, fields: dict[str, Any]) -> dict[str, Any]:
    now = now_iso()
    row = {"id": fields.get("id") or new_id(), "revision": 1, "created_at": now, "updated_at": now, "late": 0, **fields}
    cols = [c for c in COLUMNS if c in row]
    conn.execute(f"INSERT INTO ticket_visits({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", [row[c] for c in cols])
    return visit(conn, row["id"]) or row


def visit(conn: sqlite3.Connection, visit_id: str) -> dict[str, Any] | None:
    return _d(conn.execute("SELECT * FROM ticket_visits WHERE id = ?", (visit_id,)).fetchone())


def visits_of_ticket(conn: sqlite3.Connection, ticket_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_visits WHERE ticket_id = ? ORDER BY planned_from, created_at, rowid",
                                          (ticket_id,)).fetchall()]


def planned_for_assignment(conn: sqlite3.Connection, assignment_id: str | None) -> dict[str, Any] | None:
    if not assignment_id:
        return None
    return _d(conn.execute("SELECT * FROM ticket_visits WHERE assignment_id = ? AND state = 'planned'", (assignment_id,)).fetchone())


def latest_for_assignment(conn: sqlite3.Connection, assignment_id: str | None) -> dict[str, Any] | None:
    """The assignment's most relevant visit for the public page: the planned one, else the newest one."""
    if not assignment_id:
        return None
    return planned_for_assignment(conn, assignment_id) or _d(conn.execute(
        "SELECT * FROM ticket_visits WHERE assignment_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1", (assignment_id,)).fetchone())


def update_visit(conn: sqlite3.Connection, visit_id: str, fields: dict[str, Any], *, expect_revision: int | None = None) -> bool:
    bad = set(fields) - MUTABLE
    if bad:
        raise ValueError(f"not a mutable visit column: {sorted(bad)}")
    cols = list(fields)
    sets = "".join(f"{c} = ?, " for c in cols)
    sql = f"UPDATE ticket_visits SET {sets}revision = revision + 1, updated_at = ? WHERE id = ?"
    args: list[Any] = [*[fields[c] for c in cols], now_iso(), visit_id]
    if expect_revision is not None:
        sql += " AND revision = ?"
        args.append(int(expect_revision))
    return conn.execute(sql, args).rowcount == 1


def due_planned(conn: sqlite3.Connection, upto: str, limit: int) -> list[dict[str, Any]]:
    """The detector's candidates: planned visits whose window ended by `upto` (the stored instants are all `YYYY-MM-DDTHH:MM:SSZ`, so
    the text order is the time order), oldest window first. The caller adds the grace and decides (visits.look)."""
    sql = "SELECT id, ticket_id, planned_to, grace_min FROM ticket_visits WHERE state = 'planned' AND planned_to <= ? ORDER BY planned_to, id LIMIT ?"
    return [dict(r) for r in conn.execute(sql, (upto, int(limit))).fetchall()]


def latest_missed(conn: sqlite3.Connection, assignment_id: str | None, exclude_id: str) -> dict[str, Any] | None:
    """The assignment's newest missed visit not yet rescheduled (a new visit reschedules it)."""
    if not assignment_id:
        return None
    return _d(conn.execute("SELECT * FROM ticket_visits WHERE assignment_id = ? AND state = 'missed' AND rescheduled_to IS NULL AND id != ? "
                           "ORDER BY planned_to DESC, rowid DESC LIMIT 1", (assignment_id, exclude_id)).fetchone())


def visits_of_vendor(conn: sqlite3.Connection, vendor_id: str, since: str) -> list[dict[str, Any]]:
    """Every visit of a vendor company (its technicians included - `vendor_id` is the company) planned since `since` (vendor stats)."""
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_visits WHERE vendor_id = ? AND planned_from >= ? ORDER BY planned_from",
                                          (vendor_id, since)).fetchall()]


def ticket_state(conn: sqlite3.Connection, ticket_id: str) -> dict[str, Any] | None:
    """The status / department / number / assignment of a ticket for the visits logic - never shown to a person (a person's read went
    through access.visible before the visit logic runs)."""
    return _d(conn.execute("SELECT id, number, status, department_id, current_assignment_id, internal_owner_user_id FROM tickets WHERE id = ?",
                           (ticket_id,)).fetchone())


def department_visit_settings(conn: sqlite3.Connection, department_id: str) -> tuple[int | None, bool]:
    row = conn.execute("SELECT visit_grace_min, visit_detect FROM ticket_departments WHERE id = ?", (department_id,)).fetchone()
    if row is None:
        return None, True
    return (int(row[0]) if row[0] is not None else None), bool(row[1])


def set_department_visit_settings(conn: sqlite3.Connection, department_id: str, grace_min: int | None, detect: bool) -> bool:
    return conn.execute("UPDATE ticket_departments SET visit_grace_min = ?, visit_detect = ?, revision = revision + 1, updated_at = ? "
                        "WHERE id = ? AND deleted_at IS NULL", (grace_min, 1 if detect else 0, now_iso(), department_id)).rowcount == 1


def contact_unit(conn: sqlite3.Connection, contact_id: str | None) -> tuple[str | None, str | None]:
    """(contact id, the vendor company it counts for): a technician counts for his `vendor_id`, a vendor or a freelancer for himself."""
    if not contact_id:
        return None, None
    row = conn.execute("SELECT id, kind, vendor_id FROM ticket_contacts WHERE id = ?", (contact_id,)).fetchone()
    if row is None:
        return contact_id, None
    return row["id"], (row["vendor_id"] or row["id"])
