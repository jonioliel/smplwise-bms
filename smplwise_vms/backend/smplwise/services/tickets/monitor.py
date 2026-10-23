"""CR-038 section 13.3 (slice 6): the SLA monitor - a guarded step of the janitor (main.janitor_tick -> retention.janitor every 30 s;
this step self-throttles to once a minute).

One look at a ticket, in ONE write transaction of its own:
  - stuck.evaluate(): which threshold is crossed (the reason the manager sees) and when the next one falls due;
  - stuck.plan(): the ladder - remind the assignee (internal: CR-018 `ticket.reminder`; an outside contact: the reminder message of
    slice 5b through `EXTERNAL_REMINDER`, held to the vendor send window), alert the department's managers (`ticket.stuck`), or end
    a crossing that progress removed (its notifications are resolved);
  - the timeline: 'stuck' (with the crossing, the ladder's memory), 'reminder', 'manager_alerted', 'auto_closed', 'link_expired';
  - the bookkeeping columns stuck_kind / stuck_level / reminders_sent / next_check_at (store.set_sla_state: no revision move, so a person
    editing the ticket never meets a 409 because of the monitor).
The same tick closes `done` tickets of departments with an automatic close (D10: done_at + auto_close_after_days, actor system,
timeline `auto_closed`) and marks open tickets whose handler link expired (`waiting_reason = link_expired`).

Which tickets are looked at: never looked at, due (`next_check_at <= now`), or changed since the previous run (every action moves
`updated_at`; the monitor's own writes do not) - so progress ends a crossing within a minute and nothing is ever missed. At most
`BATCH` tickets per run (the rest the next minute). Idempotent: a crossing's steps are stored, so a repeated run does nothing twice.
While the module is off the monitor idles (6: queued work waits, nothing is sent)."""
from __future__ import annotations

import datetime as dt
import logging
import time
from typing import Any, Callable

from ...audit import audit
from ...db import Database, get_setting
from . import notify_bridge, policy, settings_doc, sla, store, stuck, work_calendar

log = logging.getLogger("smplwise.tickets.monitor")

EVERY_S = 60
BATCH = 200
_LAST: dict[str, float] = {}
_LAST_RUN: dict[str, str] = {}
STATS: dict[str, Any] = {"last_run_at": None, "last_duration_ms": None, "looked": 0, "reminders": 0, "alerts": 0, "auto_closed": 0, "errors": 0}

# Slice 5b registers the outside reminder here: fn(conn, ticket_row, reminder_number, now) -> bool (True = queued; the outbox keeps the
# send window, pacing and the link's sliding expiry). None = no message channel yet: an outside assignee cannot be reminded, so the
# managers are alerted at the crossing instead (never a silent nothing).
EXTERNAL_REMINDER: Callable[[Any, dict[str, Any], int, dt.datetime], bool] | None = None


def utcnow() -> dt.datetime:
    """The monitor's clock (tests replace it)."""
    return dt.datetime.now(dt.timezone.utc)


def tick(db: Database, *, force: bool = False) -> int:
    """The janitor step. Returns how many tickets were looked at (0 when throttled or the module is off)."""
    key = str(db.path)
    mono = time.monotonic()
    if not force and mono - _LAST.get(key, -EVERY_S) < EVERY_S:
        return 0
    _LAST[key] = mono
    started = time.monotonic()
    now = utcnow()
    looked = 0
    try:
        with db.connection(label="tickets.monitor") as conn:
            from .access import module_on

            if not module_on(conn):
                return 0
            from . import staff_links  # TKSTAFF1 (R7 a / b): the safety net for group and binding changes made on other screens

            try:
                staff_links.recheck(conn, now)
            except Exception:  # noqa: BLE001 - never stops the monitor
                STATS["errors"] += 1
                log.warning("tickets staff link recheck failed", exc_info=True)
            # after a restart, the changes of the last day are looked at once more (the in-memory "previous run" is gone)
            since = _LAST_RUN.get(key) or stuck.iso(now - dt.timedelta(days=1))
            ids = [r["id"] for r in store.monitor_rows_system(conn, stuck.iso(now) or "", since, BATCH)]
            closing = [r["id"] for r in store.done_rows_system(conn, BATCH)]
        for tid in ids:
            try:
                with db.connection(label="tickets.monitor") as conn:
                    look(conn, tid, now)
                looked += 1
            except Exception:  # noqa: BLE001 - one bad ticket never stops the others
                STATS["errors"] += 1
                log.warning("tickets monitor failed on %s", tid, exc_info=True)
        for tid in closing:
            try:
                with db.connection(label="tickets.monitor") as conn:
                    auto_close(conn, tid, now)
            except Exception:  # noqa: BLE001
                STATS["errors"] += 1
                log.warning("tickets automatic close failed on %s", tid, exc_info=True)
        _LAST_RUN[key] = stuck.iso(now) or ""
        from . import acceptance  # ACCEPT102: the sensor verification of finished work (default off, never fails the tick)

        acceptance.run(db, now)
        from . import vendor_arrival  # VENDORARRIVAL126-295: the missed-arrival alert (default off, never fails the tick)

        vendor_arrival.run(db, now)
    except Exception:  # noqa: BLE001 - a housekeeping step never fails the tick
        STATS["errors"] += 1
        log.warning("tickets monitor step failed", exc_info=True)
    STATS.update({"last_run_at": stuck.iso(now), "last_duration_ms": int((time.monotonic() - started) * 1000), "looked": looked})
    return looked


def _link_info(conn, row: dict[str, Any]) -> stuck.LinkInfo | None:
    if row.get("asg_kind") != "contact":
        return None
    link = store.current_link(conn, row.get("current_assignment_id"))
    if link is None:
        return None
    # TK251: "link not opened" counts from the current generation (a "new link" restarts it; first_opened_at is per generation)
    return stuck.LinkInfo(sent_at=link.get("generation_at") or link.get("created_at"), first_opened_at=link.get("first_opened_at"),
                          expires_at=link.get("expires_at"),
                          cap_at=link.get("cap_at"), revoked=bool(link.get("revoked_at")))


def _window(conn, row: dict[str, Any], now: dt.datetime) -> tuple[bool, dt.datetime]:
    """D4: the department's effective vendor send window (slice 2's policy: the override, else the installation's) in the zone."""
    dept = store.department_any(conn, row["department_id"]) or {}
    hours = policy.effective(conn, dept).send_hours
    return stuck.window_state(now, (hours["from"], hours["to"]), get_setting(conn, "time.zone", None))


def evaluate(conn, row: dict[str, Any], now: dt.datetime) -> stuck.Evaluation:
    """The crossing of one ticket now (also used by the board for its SLA cell)."""
    rule = store.sla_rule(conn, row["department_id"], row["priority_id"])
    since = store.unassigned_since(conn, row) if row["status"] in ("new", "returned") else None
    return stuck.evaluate(row, rule, now, unassigned_since=since, link=_link_info(conn, row), cal=work_calendar.load(conn, row["department_id"]))


def look(conn, ticket_id: str, now: dt.datetime) -> stuck.Plan | None:
    """One look at one ticket (inside the caller's write transaction). Returns the plan that was carried out."""
    row = store.ticket_row_system(conn, ticket_id)
    if row is None or row["status"] not in stuck.OPEN_STATUSES:
        return None
    rule = store.sla_rule(conn, row["department_id"], row["priority_id"])
    link = _link_info(conn, row)
    since = store.unassigned_since(conn, row) if row["status"] in ("new", "returned") else None
    cal = work_calendar.load(conn, row["department_id"])  # SLACAL: wall-clock unless the installation set working hours
    ev = stuck.evaluate(row, rule, now, unassigned_since=since, link=link, cal=cal)
    _link_expiry(conn, row, link, now)
    marks, last_rem = store.ladder_marks(conn, ticket_id)
    state = stuck.LadderState()
    if row.get("stuck_kind"):
        state = stuck.LadderState(kind=row["stuck_kind"], level=int(row.get("stuck_level") or 0), reminders=int(row.get("reminders_sent") or 0),
                                  due=(marks or {}).get("due") if (marks or {}).get("kind") == row["stuck_kind"] else None,
                                  last_reminder_at=last_rem)
    held = bool(row.get("current_assignment_id")) and not row.get("asg_ended_at")
    assignee = row.get("asg_kind") if held else None
    can_remind = assignee == "user" or (assignee == "contact" and EXTERNAL_REMINDER is not None)
    window_open, next_window = (True, None)
    if assignee == "contact":
        window_open, next_window = _window(conn, row, now)
    p = stuck.plan(state, ev, rule, now, assignee=assignee, can_remind=can_remind, window_open=window_open, next_window=next_window, cal=cal)
    if p.ended_kind:
        notify_bridge.resolve_stuck(conn, ticket_id)
    if p.started is not None:
        store.insert_event(conn, ticket_id, "stuck", actor_kind="system", via="system", at=stuck.iso(now),
                           data={"kind": p.started.kind, "due": stuck.iso(p.started.due)})
    if p.remind:
        n = p.state.reminders
        sent = False
        if assignee == "user":
            sent = notify_bridge.remind_assignee(conn, row, p.state.kind or "", n)
        elif assignee == "contact" and EXTERNAL_REMINDER is not None:
            sent = bool(EXTERNAL_REMINDER(conn, row, n, now))
        store.insert_event(conn, ticket_id, "reminder", actor_kind="system", via="system", assignment_id=row.get("current_assignment_id"), at=stuck.iso(now),
                           data={"n": n, "kind": p.state.kind, "channel": "inapp" if assignee == "user" else "message", "queued": sent})
        STATS["reminders"] += 1
    if p.alert:
        notify_bridge.alert_managers(conn, row, p.state.kind or "")
        store.insert_event(conn, ticket_id, "manager_alerted", actor_kind="system", via="system", at=stuck.iso(now), data={"kind": p.state.kind})
        STATS["alerts"] += 1
    store.set_sla_state(conn, ticket_id, {"stuck_kind": p.state.kind, "stuck_level": p.state.level, "reminders_sent": p.state.reminders,
                                          "next_check_at": stuck.iso(p.next_check)})
    return p


def _link_expiry(conn, row: dict[str, Any], link: stuck.LinkInfo | None, now: dt.datetime) -> None:
    """13.3: an open ticket whose current handler link passed its expiry or cap waits for the manager (`link_expired`), once."""
    if link is None or link.revoked or row["status"] in ("done",):
        return
    ends = [t for t in (stuck.parse(link.expires_at), stuck.parse(link.cap_at)) if t is not None]
    if not ends or min(ends) > now or row.get("waiting_reason") == "link_expired":
        return
    store.set_sla_state(conn, row["id"], {"waiting_on": "manager", "waiting_reason": "link_expired"})
    store.insert_event(conn, row["id"], "link_expired", actor_kind="system", via="system", assignment_id=row.get("current_assignment_id"), at=stuck.iso(now))


def auto_close(conn, ticket_id: str, now: dt.datetime) -> bool:
    """D10: close a `done` ticket once done_at + the department's auto_close_after_days passed (the value at this moment; a manager's
    move first - "done" back to handling, a close - wins because the row is no longer `done`). Actor `system`, timeline `auto_closed`."""
    row = store.ticket_row_system(conn, ticket_id)
    if row is None or row["status"] != "done" or not row.get("done_at"):
        return False
    dept = store.department_any(conn, row["department_id"]) or {}
    days = policy.effective(conn, dept).auto_close_after_days  # slice 2's policy: 1-30 days or None (two-step)
    done_at = stuck.parse(row["done_at"])
    if not days or int(days) <= 0 or done_at is None or work_calendar.auto_close_at(done_at, int(days), work_calendar.load(conn, row["department_id"])) > now:
        return False
    from . import acceptance, costs  # slice 9 (11A.3): a REQUIRED cost claim not yet approved keeps the ticket open (it stays "waiting for me")

    if costs.blocks_close(conn, ticket_id):
        return False
    if acceptance.blocks_auto_close(conn, ticket_id):  # ACCEPT102: the sensor verification decides (a running hold or a flag keeps it for a person)
        return False
    return close_done(conn, row, now, "auto_closed", {"after_days": int(days)}, {"auto": True})


def close_done(conn, row: dict[str, Any], now: dt.datetime, event_kind: str, event_data: dict[str, Any], audit_extra: dict[str, Any]) -> bool:
    """The system's close of a `done` ticket (D10 and the ACCEPT102 acceptance share it): actor `system`, one timeline row, one audit row."""
    ticket_id = row["id"]
    stamp = stuck.iso(now) or ""
    purge = stuck.iso(now + dt.timedelta(days=_purge_days(conn)))
    fields: dict[str, Any] = {"status": "closed", "closed_at": stamp, "closed_by": None, "current_assignment_id": None, "purge_after": purge,
                              "waiting_on": "none", "waiting_reason": None, "last_activity_at": stamp}
    asg = row.get("current_assignment_id") if not row.get("asg_ended_at") else None
    if not store.update_ticket(conn, ticket_id, fields, expect_revision=row["revision"]):
        return False
    if asg:
        store.update_assignment(conn, asg, {"ended_at": stamp, "end_reason": "closed"})
    sla.refresh(conn, ticket_id)  # slice 2's dues: none for a closed ticket
    store.set_sla_state(conn, ticket_id, {"stuck_kind": None, "stuck_level": 0, "reminders_sent": 0, "next_check_at": None})
    store.insert_event(conn, ticket_id, event_kind, actor_kind="system", via="system", from_status="done", to_status="closed", at=stamp, data=event_data)
    audit(conn, actor=None, action="ticket.close", decision="allowed", resource_type="ticket", resource_id=ticket_id,
          details={"number": row["number"], "from": "done", "to": "closed", "actor": "system", **audit_extra})
    notify_bridge.ticket_status(conn, ticket_id, "done", "closed")
    STATS["auto_closed"] += 1
    return True


def _purge_days(conn) -> int:
    ret = settings_doc._stored(conn).get("retention")
    try:
        days = int((ret or {}).get("closed_days", 730))
    except (TypeError, ValueError, AttributeError):
        days = 730
    return max(90, min(3650, days))
