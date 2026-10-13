"""CR-038 section 13.4: the bridge to the CR-018 notification engine.

Slice 1 calls these hooks at the moments the spec names (a new unassigned ticket, an assignment to an internal user, a status
change, a return); they do NOTHING yet. Slice 6 owns the CR-018 files (notify_policy / notify / notify_visibility: the `tickets`
category, the `ticket` subject kind, the `ticket_managers` / `ticket_assignee` recipient rules, the visibility branch that calls
access.visible) and fills these bodies with `notify.emit(...)` - the call sites stay as they are. Every hook runs inside the
caller's write transaction, after the ticket row and its timeline row are written; a hook must never raise for a delivery problem."""
from __future__ import annotations

import sqlite3


def ticket_created(conn: sqlite3.Connection, ticket_id: str) -> None:
    """A new ticket (slice 6: `ticket.new_unassigned` to the department's managers with notify_new, when nobody is assigned)."""
    return None


def ticket_assigned(conn: sqlite3.Connection, ticket_id: str, assignment_id: str) -> None:
    """An assignment to an internal user (slice 6: `ticket.assigned` to the assignee; its deep link lands on the one-tap "received")."""
    return None


def ticket_status(conn: sqlite3.Connection, ticket_id: str, from_status: str, to_status: str) -> None:
    """A status change (slice 6: `ticket.done` to the managers, resolving `ticket.assigned` on acknowledge, ...)."""
    return None


def ticket_returned(conn: sqlite3.Connection, ticket_id: str, kind: str) -> None:
    """The assignee handed the ticket back (slice 6: `ticket.returned` to the department's managers)."""
    return None


def contact_changed(conn: sqlite3.Connection, ticket_id: str) -> None:
    """Slice 4: a contact's phone / e-mail changed (or its row was linked to a user) while it held a live link of this ticket -
    the link is already revoked (slice 6: `ticket.contact_changed` to the department's managers, section 13.4)."""
    return None


def cost_submitted(conn: sqlite3.Connection, ticket_id: str, claim_id: str) -> None:
    """Slice 9 (11A.7): a vendor's claim (or one entered on its behalf) waits for review (slice 6: `ticket.cost_submitted` to the
    holders of tickets.costs who can see the ticket; category tickets, severity info)."""
    return None


def cost_missing(conn: sqlite3.Connection, ticket_id: str, claim_id: str) -> None:
    """Slice 9 (11A.5 / 11A.7): the window of a REQUIRED claim passed without a submission (slice 6: `ticket.cost_missing` to the
    department's managers who hold tickets.costs.view). Raised once per claim window."""
    return None
