"""CR-MAINT215 section 5: reminders before a due date / an expiry, and service requests on schedule - one pass of the existing
janitor loop (main.janitor_tick, every 30 s), throttled here to one pass every 15 minutes per process. `tick(conn, at)` is the
whole decision with an explicit instant (tests inject it; nothing sleeps).

Per active task with a due date, on the installation's local date:
  * due soon (D - lead <= today <= D): ONE notification `maintenance.due_soon` for that due date;
  * overdue (today > D): ONE notification `maintenance.overdue` (the "due soon" row of the same date is resolved);
  * `auto_ticket` and a department, from the "due soon" day on: ONE service request through the tickets module's system path
    (services/tickets/create.create_by_rule: placeless, unassigned, author "system", dedupe key `maint:<task>:<due date>`) - only
    while the tickets module is on; otherwise nothing (and `ticket_error` = tickets_off, so Settings can say why).
Idempotent: the level reached for a due date (`reminded_due` / `reminded_level`) and the due date a request was opened for
(`ticket_due`) are written in the same transaction as the notification / the request. Completing, rescheduling, pausing or
deleting a task resolves its open reminder rows (`resolve_for`). Nothing runs while `maintenance.enabled` is off. The
notifications carry the task's title and a date - never a person, a phone number or a file."""
from __future__ import annotations

import json
import logging
import sqlite3
import threading
import time
from datetime import date, datetime
from typing import Any

from . import access, model

log = logging.getLogger(__name__)

SOURCE_SOON, SOURCE_OVERDUE = "maintenance.due_soon", "maintenance.overdue"
SUBJECT = "maintenance"
_CHECK_EVERY_S = 900.0
DUE_TEXT = {"certificate": "בתוקף עד", "vendor_document": "בתוקף עד", "preventive": "לביצוע עד", "round": "לביצוע עד"}
LATE_TEXT = {"certificate": "התוקף פג ב־", "vendor_document": "התוקף פג ב־", "preventive": "היה לביצוע ב־", "round": "היה לביצוע ב־"}


def _key(task_id: str, due: str, level: str) -> str:
    return f"maint:{task_id}:{due}:{level}"


def _fmt(d: date) -> str:
    return d.strftime("%d.%m.%Y")


def _signal(row: Any, due: date, level: str, *, resolve: bool = False):
    from .. import notify

    return notify.Signal(source=SOURCE_OVERDUE if level == "overdue" else SOURCE_SOON, subject_kind=SUBJECT, subject_id=row["id"],
                         dedupe_key=_key(row["id"], due.isoformat(), level), resolve=resolve, link=f"#/tickets/maintenance?task={row['id']}",
                         params={"name": row["title"], "date": _fmt(due), "what": (LATE_TEXT if level == "overdue" else DUE_TEXT)[row["kind"]]},
                         origin={"maintenance_task_id": row["id"]})


def resolve_for(conn: sqlite3.Connection, task_id: str, due_text: str | None, reason: str) -> None:
    """Close the open reminder rows of a task's due date (completed / rescheduled / paused / deleted). Never raises into a write."""
    if not due_text:
        return
    from .. import notify

    for level in ("soon", "overdue"):
        try:
            notify.emit_full(conn, notify.Signal(source=SOURCE_OVERDUE if level == "overdue" else SOURCE_SOON, subject_kind=SUBJECT, subject_id=task_id,
                                                 dedupe_key=_key(task_id, due_text, level), resolve=True, params={"resolution": reason}))
        except Exception:  # noqa: BLE001 - a notification problem never blocks the maintenance write
            log.warning("could not resolve a maintenance reminder", exc_info=True)


def _open_ticket(conn: sqlite3.Connection, row: Any, due: date) -> str | None:
    """One service request for this due date through the tickets module's system path; returns an error code or None."""
    from ...errors import ApiError
    from ..tickets import access as taccess
    from ..tickets import create as tcreate

    if not taccess.module_on(conn):
        return "tickets_off"
    items = json.loads(row["checklist_json"] or "[]")
    lines = [f"{DUE_TEXT[row['kind']]} {_fmt(due)}"] + [f"- {i['label']}" for i in items]
    if row["notes"]:
        lines += ["", row["notes"]]
    spec = tcreate.TicketSpec(department_id=row["department_id"], title=row["title"][:120], description="\n".join(lines)[:4000], origin="rule",
                              rule_ref=f"maint:{row['id']}", dedupe_key=f"maint:{row['id']}:{due.isoformat()}")
    conn.execute("SAVEPOINT maint_ticket")
    try:
        res = tcreate.create_by_rule(conn, spec, source_note="נפתח אוטומטית מתוכנית אחזקה.", absorb_note="תזכורת נוספת מתוכנית האחזקה.",
                                     data={"maintenance_task": row["id"], "due": due.isoformat()})
    except ApiError as exc:
        conn.execute("ROLLBACK TO maint_ticket")
        conn.execute("RELEASE maint_ticket")
        return "department_unavailable" if exc.status == 422 else exc.code
    except Exception:
        conn.execute("ROLLBACK TO maint_ticket")
        conn.execute("RELEASE maint_ticket")
        raise
    conn.execute("RELEASE maint_ticket")
    conn.execute("UPDATE maint_tasks SET ticket_due = ?, ticket_id = ?, ticket_error = NULL WHERE id = ?", (due.isoformat(), res.ticket_id, row["id"]))
    from ...audit import audit

    audit(conn, actor=None, action="maintenance.ticket.open", decision="allowed", resource_type="maint_task", resource_id=row["id"],
          details={"ticket_id": res.ticket_id, "kind": res.kind, "due": due.isoformat(), "actor": "system"})
    return None


def tick(conn: sqlite3.Connection, at: datetime | None = None) -> dict[str, int]:
    """One pass at instant `at` (default: the module clock). Returns counters for the tests and the log."""
    from .. import notify

    stats = {"tasks": 0, "soon": 0, "overdue": 0, "tickets": 0, "ticket_errors": 0}
    if not access.module_on(conn):
        return stats
    today = access.today(conn, at)
    rows = conn.execute("SELECT * FROM maint_tasks WHERE deleted_at IS NULL AND active = 1 AND due_date IS NOT NULL").fetchall()
    for row in rows:
        stats["tasks"] += 1
        due = date.fromisoformat(row["due_date"])
        st = model.due_state(due, row["lead_days"], today)
        level = 2 if st.state == "overdue" else 1 if st.state == "due_soon" else 0
        reached = row["reminded_level"] if row["reminded_due"] == row["due_date"] else 0
        if level > reached:
            if level == 2:
                notify.emit_full(conn, _signal(row, due, "soon", resolve=True))
                notify.emit_full(conn, _signal(row, due, "overdue"))
                stats["overdue"] += 1
            else:
                notify.emit_full(conn, _signal(row, due, "soon"))
                stats["soon"] += 1
            conn.execute("UPDATE maint_tasks SET reminded_due = ?, reminded_level = ? WHERE id = ?", (row["due_date"], level, row["id"]))
        if level >= 1 and row["auto_ticket"] and row["department_id"] and row["ticket_due"] != row["due_date"]:
            err = _open_ticket(conn, row, due)
            if err is None:
                stats["tickets"] += 1
            else:
                stats["ticket_errors"] += 1
                if row["ticket_error"] != err:
                    conn.execute("UPDATE maint_tasks SET ticket_error = ? WHERE id = ?", (err, row["id"]))
    return stats


# ---------------------------------------------------------------- the notification centre's two hooks

def recipient_users(conn: sqlite3.Connection, n: dict[str, Any]) -> list[str]:
    """Recipient rule `maintenance`: the task's responsible person and the holders of maintenance.manage on the task's place
    (the centre then intersects with visibility - maintenance.view there - like every rule)."""
    from ...rbac import authorize
    from ..notify_visibility import principal_of

    row = conn.execute("SELECT * FROM maint_tasks WHERE id = ?", (n.get("subject_id"),)).fetchone()
    if row is None or row["deleted_at"]:
        return []
    from ...rbac import INSTALLATION, permissions_anywhere

    target = access.target_of(row)
    out = [row["owner_user_id"]] if row["owner_user_id"] else []
    for (uid,) in conn.execute("SELECT id FROM users WHERE active = 1 ORDER BY id").fetchall():
        p = principal_of(conn, uid)
        if p is None:
            continue
        # a placeless task: maintenance.manage at any scope (owner answer 24.10 q15, like a placeless ticket)
        if (access.MANAGE in permissions_anywhere(conn, p)) if target == INSTALLATION else authorize(conn, p, access.MANAGE, target).allowed:
            out.append(uid)
    return list(dict.fromkeys(out))


# ---------------------------------------------------------------- the janitor hook

_last_check = 0.0
_check_lock = threading.Lock()


def janitor(db: Any) -> None:
    """From main.janitor_tick: at most one pass every 15 minutes in this process; never raises."""
    global _last_check
    with _check_lock:
        mono = time.monotonic()
        if _last_check and mono - _last_check < _CHECK_EVERY_S:
            return
        _last_check = mono
    try:
        with db.connection(label="maintenance.reminders") as conn:
            if not access.module_on(conn):
                return
            stats = tick(conn)
        if stats["soon"] or stats["overdue"] or stats["tickets"] or stats["ticket_errors"]:
            log.info("maintenance reminders: %s", stats)
    except Exception:  # noqa: BLE001 - housekeeping never stops the janitor
        log.warning("maintenance reminder pass failed", exc_info=True)


def reset_for_tests() -> None:
    global _last_check
    _last_check = 0.0
