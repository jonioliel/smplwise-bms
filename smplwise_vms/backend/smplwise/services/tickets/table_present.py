"""CR-038 slice 6b (D24): what one row of the board TABLE carries - the list item of present.ticket_item plus the table's own columns
(stuck reason, SLA) and what THIS caller may do inline (the status moves of section 11.2, assign). Columns that need more than view
rights are blank for a limited viewer (a creator or internal assignee who is not a member, section 8 / 13.6): the stuck reason and
the SLA are management information."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from ..timeutil import parse_utc
from . import model, present
from .access import Seen, Viewer

# which due a stuck kind was measured against (the "since" of the stuck column)
_STUCK_DUE = {"ack": "ack_due_at", "stuck": "stuck_due_at", "waiting": "stuck_due_at", "overdue": "resolve_due_at"}


def sla_of(row: dict[str, Any], now: dt.datetime | None = None) -> dict[str, Any] | None:
    """The nearest due of an open ticket (acknowledge / stuck / resolve - sla.py computes them) and whether it passed; None when the
    ticket is final or has no due."""
    if row.get("status") in model.FINAL:
        return None
    dues: list[tuple[str, str]] = [(k, row[f"{k}_due_at"]) for k in ("ack", "stuck", "resolve") if row.get(f"{k}_due_at")]
    if not dues:
        return None
    kind, at = min(dues, key=lambda kv: kv[1])
    try:
        overdue = parse_utc(at) <= (now or dt.datetime.now(dt.timezone.utc))
    except ValueError:
        return None
    return {"kind": kind, "due_at": at, "overdue": overdue}


def stuck_of(row: dict[str, Any]) -> dict[str, Any] | None:
    kind = row.get("stuck_kind")
    if not kind or row.get("status") in model.FINAL:
        return None
    return {"kind": kind, "level": int(row.get("stuck_level") or 0), "since": row.get(_STUCK_DUE.get(kind, "")) if kind in _STUCK_DUE else None,
            "reminders": int(row.get("reminders_sent") or 0)}


def table_row(conn: sqlite3.Connection, viewer: Viewer, seen: Seen, lk: present.Lookups, last_names: dict[str, str], now: dt.datetime) -> dict[str, Any]:
    row = seen.row
    out = present.ticket_item(conn, seen, lk, last_names)
    out.pop("excerpt", None)
    dept = lk.department(row["department_id"])
    can = present.can_block(viewer, seen, dept)
    out.update({
        "stuck": stuck_of(row) if seen.full else None,
        "sla": sla_of(row, now) if seen.full else None,
        "transitions": present.transitions(viewer, seen, dept),
        "can": {"manage": seen.manager, "assign": bool(can["assign"]), "assign_external": bool(can["assign_external"])},
    })
    # slice 9 (11A.9): "עלות" (approved total, else the submitted one - `approved` says which) and "סטטוס עלות", for
    # tickets.costs.view holders on the ticket's place only; blank (None) for everyone else
    costs_ok = seen.full and viewer.holds("tickets.costs.view", row)
    out["cost"] = ({"total_minor": row.get("cost_total_minor"), "currency": row.get("cost_currency"),
                    "approved": row.get("cost_status") in ("approved", "paid")} if costs_ok and row.get("cost_total_minor") is not None else None)
    out["cost_status"] = (row.get("cost_status") or "not_required") if costs_ok else None
    return out
