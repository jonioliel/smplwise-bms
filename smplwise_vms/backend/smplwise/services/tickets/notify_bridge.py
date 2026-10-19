"""CR-038 section 13.4 (slice 6): the bridge to the CR-018 notification engine.

The catalogue of the module's sources is services/tickets/notify_sources.py (category `tickets`, subject kind `ticket`, recipient rules
`ticket_managers` / `ticket_assignee`); the engine's three hooks call back into this module:
  - notify.recipients_for -> `recipient_users(rule, n)`   who a ticket notification is FOR (before visibility),
  - notify_visibility.Reach.can_see -> `can_see()`       exactly access.visible() of the ticket (module on, place, department),
  - notify._default_link -> `#/tickets/<id>`              the ticket; its assignee gets the one-tap "received" there (8.1).

Slice 1 calls the four hooks below inside the action's write transaction, after the ticket row and its timeline row are written; the
SLA monitor (services/tickets/monitor.py) calls `remind_assignee` / `alert_managers` / `resolve_stuck`; slices 4 / 5a / 5b call
`send_failed`, `contact_changed`, `reply_unmatched` and `channel_state`. Nothing here ever raises for a delivery problem (a failure is
logged and the action commits without its notification - CR-018 emit() runs in its own savepoint).

Texts (D33) are rendered here with the module's configured Hebrew name and reach the engine as the `title` / `body` parameters. They name
the ticket number and the place only - never the title someone typed, a note, a reason, a phone or a reply (13.4: "Notification text
names the place and the ticket number only").

Severity (D28): the priority's `notify_severity`; `critical` (passes the managers' quiet hours and gets CR-018's escalation) only while
`urgent_is_critical` holds - the department's override, else the installation's setting (default true) - otherwise capped at `alert`."""
from __future__ import annotations

import logging
import sqlite3
from typing import Any

from ...rbac import Principal
from . import naming, policy, store
from .notify_sources import RULE_ASSIGNEE, RULE_MANAGERS, SUBJECT

log = logging.getLogger("smplwise.tickets.notify")

REASON_TEXT: dict[str, str] = {
    "unassigned": "אין מטפל",
    "overdue": "חריגה מזמן הטיפול",
    "unopened": "הקישור לא נפתח",
    "ack": "ממתין לאישור קבלה",
    "stuck": "אין עדכון מזה זמן",
    "waiting": "ממתין לחלק מזה זמן",
}
RETURN_TEXT = {"not_mine": "לא שלי", "cannot_handle": "לא אוכל לטפל"}

T_NEW = ("{ticket} {f:חדשה|m:חדש} #{number}", "{place} · ללא מטפל")
T_ASSIGNED = ("{ticket} #{number} {f:הועברה|m:הועבר} אליך", "{place}")
T_REMINDER = ("תזכורת: {ticket} #{number}", "{place} · {reason}")
T_STUCK = ("{ticket} #{number} {f:תקועה|m:תקוע}", "{place} · {reason}")
T_RETURNED = ("{ticket} #{number} {f:הוחזרה|m:הוחזר} למנהל", "{place} · {kind}")
T_DONE = ("{ticket} #{number}: הטיפול הסתיים", "{place} · ממתין לסגירה")
T_SEND_FAILED = ("ההודעה על {ticket} #{number} לא נשלחה", "{place}")
T_CONTACT = ("פרטי המטפל ב{ticket} #{number} השתנו", "{place} · הקישור בוטל")
T_UNMATCHED = ("תשובה שלא שויכה ל{ticket}", "לבדיקה בלוח המנהל")
# S9b (11A.7): no amounts, no vendor text - the number and the place only
T_COST_SUBMITTED = ("הוגשה דרישת תשלום ל{ticket} #{number}", "{place}")
T_COST_MISSING = ("לא הוגשה דרישת תשלום ל{ticket} #{number}", "{place} · חלון ההגשה נסגר")
T_CHANNEL = ("חשבון וואטסאפ מנותק", "{account} · הודעות {tickets} ממתינות")


# ---------------------------------------------------------------- engine callbacks

def _viewer(conn: sqlite3.Connection, user_id: str):
    from .access import Viewer

    u = conn.execute("SELECT username, display_name, source FROM users WHERE id = ?", (user_id,)).fetchone()
    return Viewer(conn, Principal(user_id=user_id, username=u["username"] if u else "", display_name=u["display_name"] if u else "",
                                  source=u["source"] if u else "push"))


def can_see(conn: sqlite3.Connection, principal: Principal, ticket_id: str | None) -> bool:
    """The visibility of a `ticket` notification: the ticket itself, now (a moved department or a revoked binding hides old rows)."""
    from . import access

    if not ticket_id:
        return False
    return access.visible_by_id(access.Viewer(conn, principal), str(ticket_id)) is not None


def department_managers(conn: sqlite3.Connection, row: dict[str, Any], *, notify_new_only: bool = False) -> list[str]:
    """The department's manager members who hold manager rights where the ticket lies (section 3). When a department has none,
    the holders of tickets.manage + tickets.all_departments there stand in (a stuck ticket never goes unseen) - except for the
    `notify_new` audience, which is exactly the flagged managers (review: notification fatigue)."""
    out = [uid for uid in store.manager_member_ids(conn, row["department_id"], notify_new_only=notify_new_only)
           if store.user_is_active(conn, uid) and _viewer(conn, uid).is_manager(row)]
    if out or notify_new_only:
        return out
    from . import access

    for uid in sorted(store.active_user_ids(conn)):
        v = _viewer(conn, uid)
        if v.holds(access.MANAGE, row) and v.holds(access.ALL_DEPARTMENTS, row):
            out.append(uid)
    return out


def recipient_users(conn: sqlite3.Connection, rule: str, n: dict[str, Any]) -> list[str]:
    """notify.recipients_for: the candidates of a ticket notification (the engine then keeps those who may see it)."""
    origin = n.get("origin") or {}
    tid = origin.get("ticket_id") or n.get("subject_id")
    row = store.ticket_row_system(conn, str(tid)) if tid else None
    if row is None:
        return []
    if rule == RULE_ASSIGNEE:
        uid = origin.get("user_id")
        return [uid] if isinstance(uid, str) and uid else []
    if rule == RULE_MANAGERS:
        managers = department_managers(conn, row, notify_new_only=origin.get("audience") == "notify_new")
        if origin.get("audience") == "costs":  # S9b: only the managers who may see the costs where the ticket lies
            managers = [uid for uid in managers if _viewer(conn, uid).holds("tickets.costs.view", row)]
        return managers
    return []


# ---------------------------------------------------------------- texts and severity

def open_ticket(conn: sqlite3.Connection, ticket_id: str) -> dict[str, Any] | None:
    """The ticket row while it is still open (not closed / cancelled), else None - for the digest (notify_matrix.flush)."""
    row = store.ticket_row_system(conn, ticket_id)
    return None if row is None or row["status"] in ("closed", "cancelled") else row


def place_of(conn: sqlite3.Connection, row: dict[str, Any]) -> str:
    if row.get("place_text"):
        return str(row["place_text"])
    dept = store.department_any(conn, row["department_id"]) or {}
    return str(dept.get("name") or "")


def text(conn: sqlite3.Connection, template: str, **values: Any) -> str:
    """A notification text: the module's name tokens first (D33), then the values (a value is never read as a token)."""
    out = naming.render_for(conn, template, "he")
    for k, v in values.items():
        out = out.replace("{" + k + "}", str(v))
    return out


def urgent_is_critical(conn: sqlite3.Connection, department: dict[str, Any] | None) -> bool:
    """D28: the department's override (NULL = follow), else the installation's `urgent_is_critical` (default true) - slice 2's
    effective policy (services/tickets/policy.py) is the one place that decides it."""
    return policy.effective(conn, department or {}).urgent_is_critical


def severity_of(conn: sqlite3.Connection, row: dict[str, Any]) -> str:
    prio = store.priority(conn, row["priority_id"]) or {}
    sev = policy.notify_severity(policy.effective(conn, store.department_any(conn, row["department_id"]) or {}), prio.get("notify_severity") or "alert")
    return sev if sev in ("info", "alert", "critical") else "alert"


def _module_on(conn: sqlite3.Connection) -> bool:
    from .access import module_on

    return module_on(conn)


def _emit(conn: sqlite3.Connection, source: str, row: dict[str, Any], tpl: tuple[str, str], *, dedupe: str, severity: str | None = None,
          origin: dict[str, Any] | None = None, **values: Any) -> str | None:
    """One ticket signal (never raises). Returns the engine's action ('created', 'folded', ... or None on a failure / module off)."""
    if not _module_on(conn):
        return None
    from . import notify_matrix

    mode = notify_matrix.decide(conn, row.get("department_id"), source)  # TKNOTIFMATRIX: "now" unless an administrator turned the matrix on
    if mode == "off":
        return None
    if mode == "digest" and notify_matrix.enqueue(conn, row["id"], row["department_id"], source):
        return "digested"
    from .. import notify

    vals = {"number": row["number"], "place": place_of(conn, row), **values}
    try:
        res = notify.emit_full(conn, notify.Signal(
            source=source, subject_kind=SUBJECT, subject_id=row["id"], severity=severity, dedupe_key=dedupe,
            params={"title": text(conn, tpl[0], **vals), "body": text(conn, tpl[1], **vals)},
            origin={"ticket_id": row["id"], "department_id": row["department_id"], **(origin or {})},
            place=vals["place"] or None,
        ))
        return res.action
    except Exception:  # noqa: BLE001 - a notification never fails the ticket action
        log.warning("ticket notification %s failed for %s", source, row["id"], exc_info=True)
        return None


def resolve(conn: sqlite3.Connection, source: str, dedupe: str) -> None:
    from .. import notify

    try:
        notify.emit_full(conn, notify.Signal(source=source, subject_kind=SUBJECT, subject_id=None, dedupe_key=dedupe, resolve=True))
    except Exception:  # noqa: BLE001
        log.warning("ticket notification resolve %s failed", source, exc_info=True)


def resolve_prefix(conn: sqlite3.Connection, ticket_id: str, part: str = "") -> None:
    """Resolve every open notification of a ticket whose key starts with `ticket:<id>:<part>` (each with its own source)."""
    for key in store.open_notification_keys(conn, f"ticket:{ticket_id}:{part}"):
        src = source_of_key(key)
        if src:
            resolve(conn, src, key)


def source_of_key(key: str) -> str | None:
    part = key.split(":")[2] if key.count(":") >= 2 else ""
    return {"unassigned": "ticket.new_unassigned", "assign": "ticket.assigned", "remind": "ticket.reminder", "stuck": "ticket.stuck",
            "returned": "ticket.returned", "done": "ticket.done", "send": "ticket.send_failed", "contact": "ticket.contact_changed",
            "costsub": "ticket.cost_submitted", "costmiss": "ticket.cost_missing"}.get(part)


# ---------------------------------------------------------------- the action hooks (slice 1 calls them)

def ticket_created(conn: sqlite3.Connection, ticket_id: str) -> None:
    """A new ticket: `ticket.new_unassigned` to the department's managers with notify_new, when nobody is assigned."""
    row = store.ticket_row_system(conn, ticket_id)
    if row is None or row.get("current_assignment_id") or row["status"] != "new":
        return
    _emit(conn, "ticket.new_unassigned", row, T_NEW, dedupe=f"ticket:{ticket_id}:unassigned", severity=severity_of(conn, row),
          origin={"audience": "notify_new"})


def ticket_assigned(conn: sqlite3.Connection, ticket_id: str, assignment_id: str) -> None:
    """An assignment to an internal user: `ticket.assigned` to the assignee (its deep link lands on the one-tap "received"); the
    managers' unassigned / returned rows and the previous assignee's row are resolved."""
    row = store.ticket_row_system(conn, ticket_id)
    if row is None:
        return
    for part in ("unassigned", "returned", "assign:"):
        resolve_prefix(conn, ticket_id, part)
    asg = store.assignment(conn, assignment_id)
    if asg and asg.get("assignee_kind") == "user" and asg.get("user_id"):
        _emit(conn, "ticket.assigned", row, T_ASSIGNED, dedupe=f"ticket:{ticket_id}:assign:{assignment_id}", severity=severity_of(conn, row),
              origin={"user_id": asg["user_id"], "assignment_id": assignment_id})


def ticket_status(conn: sqlite3.Connection, ticket_id: str, from_status: str, to_status: str) -> None:
    """A status change: leaving `assigned` resolves `ticket.assigned`; done tells the managers; closing / cancelling resolves every
    open row of the ticket; a reopen to `new` is a new unassigned ticket again."""
    row = store.ticket_row_system(conn, ticket_id)
    if row is None:
        return
    if to_status in ("closed", "cancelled"):
        resolve_prefix(conn, ticket_id)
        return
    if from_status == "assigned" and to_status != "assigned":
        resolve_prefix(conn, ticket_id, "assign:")
    if from_status == "done":
        resolve_prefix(conn, ticket_id, "done")
    if to_status == "done":
        _emit(conn, "ticket.done", row, T_DONE, dedupe=f"ticket:{ticket_id}:done", severity="info")
    if from_status == "closed" and to_status == "new":
        _emit(conn, "ticket.new_unassigned", row, T_NEW, dedupe=f"ticket:{ticket_id}:unassigned", severity=severity_of(conn, row),
              origin={"audience": "notify_new"})


def ticket_returned(conn: sqlite3.Connection, ticket_id: str, kind: str) -> None:
    """The assignee handed the ticket back: `ticket.returned` to the department's managers (the kind, never the free-text reason)."""
    row = store.ticket_row_system(conn, ticket_id)
    if row is None:
        return
    resolve_prefix(conn, ticket_id, "assign:")
    _emit(conn, "ticket.returned", row, T_RETURNED, dedupe=f"ticket:{ticket_id}:returned", severity="alert", kind=RETURN_TEXT.get(kind, ""))


# ---------------------------------------------------------------- the SLA monitor's ladder

def remind_assignee(conn: sqlite3.Connection, row: dict[str, Any], kind: str, n: int) -> bool:
    """An internal assignee's reminder (`ticket.reminder`, dedupe per reminder number). True when the engine took it."""
    uid = row.get("asg_user_id")
    if row.get("asg_kind") != "user" or not uid:
        return False
    action = _emit(conn, "ticket.reminder", row, T_REMINDER, dedupe=f"ticket:{row['id']}:remind:{n}", severity=severity_of(conn, row),
                   origin={"user_id": uid, "kind": kind}, reason=REASON_TEXT.get(kind, ""))
    return action is not None


def alert_managers(conn: sqlite3.Connection, row: dict[str, Any], kind: str) -> bool:
    action = _emit(conn, "ticket.stuck", row, T_STUCK, dedupe=f"ticket:{row['id']}:stuck:{kind}", severity=severity_of(conn, row),
                   origin={"kind": kind}, reason=REASON_TEXT.get(kind, ""))
    return action is not None


def resolve_stuck(conn: sqlite3.Connection, ticket_id: str) -> None:
    """Progress ended the crossing: its manager alert and the assignee's reminders are over."""
    resolve_prefix(conn, ticket_id, "stuck:")
    resolve_prefix(conn, ticket_id, "remind:")


# ---------------------------------------------------------------- hooks for the message slices (4 / 5a / 5b)

def send_failed(conn: sqlite3.Connection, ticket_id: str, *, resolved: bool = False) -> None:
    """A message to an outside contact could not go by WhatsApp (fallback used or nobody reachable); `resolved` on the next success."""
    if resolved:
        resolve(conn, "ticket.send_failed", f"ticket:{ticket_id}:send")
        return
    row = store.ticket_row_system(conn, ticket_id)
    if row is not None:
        _emit(conn, "ticket.send_failed", row, T_SEND_FAILED, dedupe=f"ticket:{ticket_id}:send", severity="alert")


def contact_changed(conn: sqlite3.Connection, ticket_id: str, *, resolved: bool = False) -> None:
    """A contact's phone / e-mail changed while it held a live link (the link was revoked); `resolved` on reassign / a new link."""
    if resolved:
        resolve(conn, "ticket.contact_changed", f"ticket:{ticket_id}:contact")
        return
    row = store.ticket_row_system(conn, ticket_id)
    if row is not None:
        _emit(conn, "ticket.contact_changed", row, T_CONTACT, dedupe=f"ticket:{ticket_id}:contact", severity="alert")


def reply_unmatched(conn: sqlite3.Connection, inbound_id: str, candidate_ticket_ids: list[str], *, resolved: bool = False) -> None:
    """An ambiguous or late WhatsApp reply: one row per candidate department (its managers), never the reply's text."""
    seen: set[str] = set()
    for tid in candidate_ticket_ids:
        row = store.ticket_row_system(conn, tid)
        if row is None or row["department_id"] in seen:
            continue
        seen.add(row["department_id"])
        key = f"ticket-inbound:{inbound_id}:{row['department_id']}"
        if resolved:
            resolve(conn, "ticket.reply_unmatched", key)
        else:
            _emit(conn, "ticket.reply_unmatched", row, T_UNMATCHED, dedupe=key, severity="info", origin={"inbound_id": inbound_id})


def channel_state(conn: sqlite3.Connection, account_key: str, account_label: str, *, down: bool) -> None:
    """A WhatsApp account mapped to a ticket use went disconnected / missing (or a required use is unmapped) - and back. Installation
    level: subject `system` (system.configure holders see it), recipients `managers` (13.4); dedupe per account."""
    from .. import notify

    key = f"ticket-channel:{account_key}"
    try:
        if not down:
            notify.emit_full(conn, notify.Signal(source="ticket.channel_down", subject_kind="system", subject_id=None, dedupe_key=key, resolve=True))
            return
        if not _module_on(conn):
            return
        notify.emit_full(conn, notify.Signal(
            source="ticket.channel_down", subject_kind="system", subject_id=f"whatsapp:{account_key}", dedupe_key=key,
            params={"title": text(conn, T_CHANNEL[0]), "body": text(conn, T_CHANNEL[1], account=account_label)}, link="#/system/tickets"))
    except Exception:  # noqa: BLE001
        log.warning("ticket channel notification failed", exc_info=True)


def cost_submitted(conn: sqlite3.Connection, ticket_id: str, claim_id: str) -> None:
    """Slice 9 (11A.7): a vendor's claim (or one entered on its behalf) waits for review: `ticket.cost_submitted` (info) to the
    department's managers who hold tickets.costs.view where the ticket lies. A "not submitted" row of the same claim is over."""
    row = store.ticket_row_system(conn, ticket_id)
    if row is None:
        return
    resolve(conn, "ticket.cost_missing", f"ticket:{ticket_id}:costmiss:{claim_id}")
    _emit(conn, "ticket.cost_submitted", row, T_COST_SUBMITTED, dedupe=f"ticket:{ticket_id}:costsub:{claim_id}", severity="info",
          origin={"audience": "costs", "claim_id": claim_id})


def cost_missing(conn: sqlite3.Connection, ticket_id: str, claim_id: str) -> None:
    """Slice 9 (11A.5 / 11A.7): the window of a REQUIRED claim passed without a submission: `ticket.cost_missing` (alert) to the
    department's managers who hold tickets.costs.view. Raised once per claim window (the caller's `missing_at`)."""
    row = store.ticket_row_system(conn, ticket_id)
    if row is None:
        return
    _emit(conn, "ticket.cost_missing", row, T_COST_MISSING, dedupe=f"ticket:{ticket_id}:costmiss:{claim_id}", severity="alert",
          origin={"audience": "costs", "claim_id": claim_id})


def cost_resolved(conn: sqlite3.Connection, ticket_id: str, claim_id: str) -> None:
    """A decision on the claim (approved / adjusted / rejected): the review row and the "not submitted" row are over."""
    resolve(conn, "ticket.cost_submitted", f"ticket:{ticket_id}:costsub:{claim_id}")
    resolve(conn, "ticket.cost_missing", f"ticket:{ticket_id}:costmiss:{claim_id}")
