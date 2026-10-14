"""CR-038 section 13: the SLA thresholds of a department x priority and the DUE times of a ticket.

Slice 2 computes the dues at every change of a ticket (create, edit, status, assign, return, note, ETA, photo) and when a rule or a
department's automatic close changes; nothing acts on them yet. Slice 6 adds the monitor (`tick`) to this module: it reads open
tickets with `next_check_at <= now` and walks the reminder ladder of 13.3.

The four columns of `tickets` (one row = one ticket; NULL = no threshold applies now or the threshold is off):

    ack_due_at      the FIRST-RESPONSE due: `unassigned_after_min` from the moment the ticket became unassigned (new / returned),
                    or `ack_within_min` from the assignment while it waits for "received" (assigned)
    stuck_due_at    `stuck_after_min` from the last progress while acknowledged / in progress, `stuck_waiting_min` while waiting
                    for a part; a future ETA moves it to the ETA (13.2: the ETA suppresses "stuck", not "overdue")
    resolve_due_at  `resolve_within_min` from creation, until "done"
    next_check_at   the earliest of the above and, for a "done" ticket of a department with an automatic close (D10), the close time

`due_kind()` names the threshold each column carries for a status. "Link not opened" (`link_unopened_min`) applies only to an
external assignment (a handler link, slice 4): slice 6's monitor measures it from the link's send time, which this slice does not
have. Calendar time (D7). Every threshold is editable per department x priority; NULL turns it off (13.1)."""
from __future__ import annotations

import datetime as dt
import sqlite3
from dataclasses import dataclass
from typing import Any

from . import model, policy, store

THRESHOLDS: tuple[str, ...] = (
    "unassigned_after_min", "link_unopened_min", "ack_within_min", "stuck_after_min", "stuck_waiting_min", "resolve_within_min",
    "remind_every_min",
)
COUNTERS: dict[str, tuple[int, int]] = {"max_reminders": (0, 10), "manager_alert_after_steps": (0, 10)}
MINUTES_MAX = 365 * 24 * 60  # one year


@dataclass(frozen=True)
class Dues:
    ack_due_at: str | None
    stuck_due_at: str | None
    resolve_due_at: str | None
    next_check_at: str | None

    def as_dict(self) -> dict[str, str | None]:
        return {"ack_due_at": self.ack_due_at, "stuck_due_at": self.stuck_due_at, "resolve_due_at": self.resolve_due_at,
                "next_check_at": self.next_check_at}


NONE = Dues(None, None, None, None)


def _parse(at: str | None) -> dt.datetime | None:
    if not at:
        return None
    try:
        return dt.datetime.fromisoformat(at.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
    except ValueError:
        return None


def _iso(at: dt.datetime | None) -> str | None:
    return None if at is None else at.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _plus(at: str | None, minutes: Any) -> dt.datetime | None:
    base = _parse(at)
    if base is None or minutes is None:
        return None
    return base + dt.timedelta(minutes=int(minutes))


def due_kind(status: str, column: str) -> str | None:
    """The threshold a due column carries for a status (slice 6 writes it to `stuck_kind` when crossed)."""
    if column == "ack_due_at":
        return "unassigned" if status in ("new", "returned") else "ack" if status == "assigned" else None
    if column == "stuck_due_at":
        return "waiting" if status == "waiting_part" else "stuck" if status in ("acknowledged", "in_progress") else None
    if column == "resolve_due_at":
        return "overdue" if status in model.OPEN and status != "done" else None
    return None


def compute(*, status: str, created_at: str, last_activity_at: str, unassigned_since: str | None, assigned_at: str | None,
            eta_at: str | None, done_at: str | None, rule: dict[str, Any] | None, auto_close_after_days: int | None) -> Dues:
    """The dues of one ticket (pure). `unassigned_since`: when the ticket last became unassigned (creation, a return, a reopen)."""
    if status in model.FINAL:
        return NONE
    r = rule or {}
    ack = stuck = resolve = None
    if status in ("new", "returned"):
        ack = _plus(unassigned_since or created_at, r.get("unassigned_after_min"))
    elif status == "assigned":
        ack = _plus(assigned_at or last_activity_at, r.get("ack_within_min"))
    if status in ("acknowledged", "in_progress", "waiting_part"):
        stuck = _plus(last_activity_at, r.get("stuck_waiting_min" if status == "waiting_part" else "stuck_after_min"))
        eta = _parse(eta_at)
        if stuck is not None and eta is not None and eta > stuck:
            stuck = eta
    if status != "done":
        resolve = _plus(created_at, r.get("resolve_within_min"))
    auto_close = _plus(done_at, auto_close_after_days * 1440) if status == "done" and auto_close_after_days else None
    candidates = [x for x in (ack, stuck, resolve, auto_close) if x is not None]
    return Dues(_iso(ack), _iso(stuck), _iso(resolve), _iso(min(candidates)) if candidates else None)


def refresh(conn: sqlite3.Connection, ticket_id: str) -> Dues:
    """Recompute and store the dues of one ticket (inside the caller's write transaction). The revision does not move: a due is
    derived from the row, not an edit of it."""
    inputs = store.sla_inputs(conn, ticket_id)
    if inputs is None:
        return NONE
    dept = store.department_any(conn, inputs["department_id"]) or {}
    rule = store.sla_rule(conn, inputs["department_id"], inputs["priority_id"])
    dues = compute(
        status=inputs["status"], created_at=inputs["created_at"], last_activity_at=inputs["last_activity_at"],
        unassigned_since=inputs["unassigned_since"], assigned_at=inputs["assigned_at"], eta_at=inputs["eta_at"], done_at=inputs["done_at"],
        rule=rule, auto_close_after_days=policy.effective(conn, dept).auto_close_after_days if dept else None,
    )
    store.set_sla_dues(conn, ticket_id, dues.as_dict())
    return dues


def refresh_many(conn: sqlite3.Connection, ticket_ids: list[str]) -> int:
    for tid in ticket_ids:
        refresh(conn, tid)
    return len(ticket_ids)


def validate_rule(values: dict[str, Any]) -> dict[str, Any]:
    """The editable fields of one SLA row: every threshold in minutes (1 minute - 1 year) or None (off); the two counters 0-10.
    Raises model.Invalid with one problem per bad field."""
    problems: list[model.Problem] = []
    out: dict[str, Any] = {}
    for key, value in values.items():
        if key in THRESHOLDS:
            if value is None:
                out[key] = None
            elif isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= MINUTES_MAX:
                problems.append(model.Problem(key, "range"))
            else:
                out[key] = value
        elif key in COUNTERS:
            lo, hi = COUNTERS[key]
            if value is None:
                problems.append(model.Problem(key, "required"))  # NOT NULL columns: a counter is never "off"
            elif isinstance(value, bool) or not isinstance(value, int) or not lo <= value <= hi:
                problems.append(model.Problem(key, "range"))
            else:
                out[key] = value
        else:
            problems.append(model.Problem(key, "unknown"))
    if problems:
        raise model.Invalid(problems)
    return out
