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
