"""MGRDASH phases 4-5 (docs/design/MANAGER_DASHBOARD_SPEC_HE.md section 9): the manager overview's alerts, raised by the janitor
(costs_retention.janitor -> tick(), every 10 minutes) through the existing notification centre. Every source is OFF by default (its
policy row); nothing is computed for a source that is off. No person and no amount is ever in the text.

    rfq.instalment_due_tomorrow   (phase 4) approved instalments due TOMORROW (the installation's day) and not marked paid: one row per
                                  award and day (`rfqpaydue:<rfq>:<award>:<day>`), raised once (a row that ever existed is not raised
                                  again), to the RFQ managers who may mark the payment; resolved when nothing of it is due tomorrow any
                                  more (paid, moved, or the day came - the overdue signal takes over from there).
    ticket.dash_digest            (phase 5) each manager's morning summary on working days (Sunday - Thursday) from `ui.dash_digest_hour`
                                  (within 3 hours of it - a janitor that was down all morning does not send it at noon): ONE line of
                                  his own numbers - stuck, waiting for his approval, arrivals today - counted from what he manages (the
                                  board's rule), to him only (subject `session` = the user); once per manager and day; not sent when all
                                  three are 0. Opens the overview.
    ticket.dash_busy_department   (phase 5) a department's stuck requests reached `ui.dash_dept_stuck` (default 10): to each of its
                                  manager members, counted from what HE manages there (a place he cannot see is not counted); once,
                                  until his number drops below the threshold (then resolved). Opens the overview filtered to it.

Who counts as a manager: the board's gate (tickets.manage somewhere AND a manager member of a department or tickets.all_departments).
Each manager's numbers come from one board scan (access.visible_page - the single visibility rule) and one batched visibility read of
the approvals (access.visible_by_ids / rfq.visible_by_ids), computed only when a phase 5 source is on."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Any

from ...services import notify_policy
from . import access, board, dashboard_pay, notify_bridge, rfq, rfq_notify, settings_doc, store, store_dash, store_dash_extra, stuck
from .access import Viewer

log = logging.getLogger("smplwise.tickets.dashboard_alerts")


def source_on(conn, source: str) -> bool:
    policy = notify_policy.get_policy(conn, source)
    return bool(policy and policy.get("enabled"))


def _tz(conn):
    from .messaging import time_zone

    return time_zone(conn)


def payments_tick(conn, now: dt.datetime) -> dict[str, int]:
    """Phase 4: raise / resolve the "payment due tomorrow" rows."""
    out = {"raised": 0, "resolved": 0}
    tz = _tz(conn)
    today = now.astimezone(tz).date()
    tomorrow = today + dt.timedelta(days=1)
    due: dict[str, dict[str, Any]] = {}
    if source_on(conn, "rfq.instalment_due_tomorrow"):
        for it in dashboard_pay.instalments(conn, today=today, tz=tz, until=tomorrow + dt.timedelta(days=1)):
            if it["due_date"] != tomorrow:
                continue
            key = f"{rfq_notify.DUE_PREFIX}:{it['rfq_id']}:{it['award_id']}:{tomorrow.isoformat()}"
            due.setdefault(key, {**it, "count": 0})["count"] += 1
    for key in store_dash_extra.open_notification_keys(conn, f"{rfq_notify.DUE_PREFIX}:"):
        if key not in due:
            rfq_notify.instalment_due_over(conn, key)
            out["resolved"] += 1
    for key, it in due.items():
        if store_dash_extra.notification_key_seen(conn, key):
            continue  # raised once (open, acknowledged or already over) - never folded again
        row = rfq.system_row(conn, it["rfq_id"])
        if row is None:
            continue
        if rfq_notify.instalment_due_tomorrow(conn, row, it["award_id"], it["rfq_vendor_id"], count=it["count"], day=tomorrow.isoformat()):
            out["raised"] += 1
    return out


# ---------------------------------------------------------------- phase 5: the managers' numbers

DIGEST_DAYS = frozenset({6, 0, 1, 2, 3})  # Sunday - Thursday (date.weekday(): Monday = 0)
DIGEST_WINDOW_HOURS = 3
DIGEST_PREFIX = "tdash:digest"
BUSY_PREFIX = "tdash:busy"
T_DIGEST = ("סיכום בוקר", "{stuck} {f:תקועות|m:תקועים} · {approvals} לאישורך · {arrivals} הגעות היום")
T_BUSY = ("מחלקה עמוסה: {department}", "{stuck} {f:תקועות|m:תקועים} · הסף {threshold}")


def managers(conn) -> list[Viewer]:
    """Every active user who passes the board's manager gate, as a Viewer."""
    from ..notify_visibility import principal_of

    out: list[Viewer] = []
    for uid in sorted(store.active_user_ids(conn)):
        p = principal_of(conn, uid)
        if p is None:
            continue
        v = Viewer(conn, p)
        if access.MANAGE in v.anywhere and (any(r == "manager" for r in v.roles.values()) or access.ALL_DEPARTMENTS in v.anywhere):
            out.append(v)
    return out


def numbers(conn, v: Viewer, now: dt.datetime, tz: dt.tzinfo) -> dict[str, Any]:
    """One manager's numbers: stuck per department and in all, arrivals today, waiting for his approval - only what he manages."""
    scope = "all" if access.ALL_DEPARTMENTS in v.anywhere else "department"  # the board's own choice (board.board)
    sc = board.scan(v, scope=scope, statuses=board.model_open(), department_id=None, query="")
    today = now.astimezone(tz).date()
    stuck_by: dict[str, int] = {}
    arrivals = 0
    for s in sc.rows:
        if not s.manager:
            continue
        r = s.row
        if r.get("stuck_kind"):
            stuck_by[r["department_id"]] = stuck_by.get(r["department_id"], 0) + 1
        eta = stuck.parse(r.get("eta_at"))
        if eta is not None and r["status"] != "done" and eta >= now and eta.astimezone(tz).date() == today:
            arrivals += 1
    quotes = store_dash.submitted_ticket_quotes(conn)
    claims = store_dash.submitted_claims(conn)
    seen = access.visible_by_ids(v, [q["ticket_id"] for q in quotes] + [c["ticket_id"] for c in claims])
    approvals = sum(1 for x in quotes + claims if (s := seen.get(x["ticket_id"])) is not None and s.manager)
    awards = store_dash.pending_second_awards(conn)
    if awards:
        from .store_quotes import quote as quote_row

        rseen = rfq.visible_by_ids(v, [a["rfq_id"] for a in awards])
        for a in awards:
            rs = rseen.get(a["rfq_id"])
            if rs is not None and v.uid in rfq.second_approvers(conn, rs.row, a["first_by"], quote_row(conn, a["quote_id"])):
                approvals += 1
    return {"stuck_by": stuck_by, "stuck": sum(stuck_by.values()), "arrivals": arrivals, "approvals": approvals}


def _emit_personal(conn, source: str, uid: str, key: str, tpl: tuple[str, str], link: str, **values: Any) -> bool:
    from .. import notify

    try:
        res = notify.emit_full(conn, notify.Signal(
            source=source, subject_kind="session", subject_id=uid, dedupe_key=key, initiator_user_id=uid, link=link,
            params={"title": notify_bridge.text(conn, tpl[0], **values), "body": notify_bridge.text(conn, tpl[1], **values)}))
        return res.action == "created"
    except Exception:  # noqa: BLE001 - a notification never fails the janitor
        log.warning("dashboard alert %s failed", source, exc_info=True)
        return False


def _resolve(conn, source: str, key: str) -> None:
    from .. import notify

    try:
        notify.emit_full(conn, notify.Signal(source=source, subject_kind="session", subject_id=None, dedupe_key=key, resolve=True))
    except Exception:  # noqa: BLE001
        log.warning("dashboard alert resolve %s failed", source, exc_info=True)


def managers_tick(conn, now: dt.datetime) -> dict[str, int]:
    """Phase 5: the morning summary and the busy-department alert (nothing is computed while both are off)."""
    out = {"digests": 0, "busy_raised": 0, "busy_resolved": 0}
    digest_on, busy_on = source_on(conn, "ticket.dash_digest"), source_on(conn, "ticket.dash_busy_department")
    if not busy_on:
        for key in store_dash_extra.open_notification_keys(conn, f"{BUSY_PREFIX}:"):
            _resolve(conn, "ticket.dash_busy_department", key)
            out["busy_resolved"] += 1
    if not (digest_on or busy_on):
        return out
    tz = _tz(conn)
    local = now.astimezone(tz)
    ui = settings_doc.read(conn)["ui"]
    hour = int(ui.get("dash_digest_hour", 8))
    digest_due = digest_on and local.weekday() in DIGEST_DAYS and hour <= local.hour < hour + DIGEST_WINDOW_HOURS
    threshold = int(ui.get("dash_dept_stuck") or 10)
    open_busy = set(store_dash_extra.open_notification_keys(conn, f"{BUSY_PREFIX}:")) if busy_on else set()
    for v in managers(conn):
        dkey = f"{DIGEST_PREFIX}:{v.uid}:{local.date().isoformat()}"
        want_digest = digest_due and not store_dash_extra.notification_key_seen(conn, dkey)
        if not (want_digest or busy_on):
            continue
        n = numbers(conn, v, now, tz)
        if want_digest and (n["stuck"] or n["approvals"] or n["arrivals"]):
            if _emit_personal(conn, "ticket.dash_digest", v.uid, dkey, T_DIGEST, "#/tickets/overview", stuck=n["stuck"],
                              approvals=n["approvals"], arrivals=n["arrivals"]):
                out["digests"] += 1
        if not busy_on:
            continue
        for dept_id, role in v.roles.items():
            if role != "manager":
                continue
            key = f"{BUSY_PREFIX}:{v.uid}:{dept_id}"
            count = n["stuck_by"].get(dept_id, 0)
            if count >= threshold:
                if key not in open_busy:
                    d = store.department_any(conn, dept_id) or {}
                    if _emit_personal(conn, "ticket.dash_busy_department", v.uid, key, T_BUSY, f"#/tickets/overview?dept={dept_id}",
                                      department=d.get("name") or "", stuck=count, threshold=threshold):
                        out["busy_raised"] += 1
                open_busy.discard(key)
            elif key in open_busy:
                _resolve(conn, "ticket.dash_busy_department", key)
                open_busy.discard(key)
                out["busy_resolved"] += 1
    for key in open_busy:  # a manager who is no longer one (or no longer manages that department): his row is over
        _resolve(conn, "ticket.dash_busy_department", key)
        out["busy_resolved"] += 1
    return out


def tick(conn, now: dt.datetime) -> dict[str, Any]:
    """The janitor step (its own write transaction; each part fails on its own, inside a savepoint)."""
    out: dict[str, Any] = {}
    for name, fn in (("payments", payments_tick), ("managers", managers_tick)):
        conn.execute(f"SAVEPOINT dash_{name}")
        try:
            out[name] = fn(conn, now)
            conn.execute(f"RELEASE dash_{name}")
        except Exception as exc:  # noqa: BLE001 - an alert never stops the janitor
            conn.execute(f"ROLLBACK TO dash_{name}")
            conn.execute(f"RELEASE dash_{name}")
            log.warning("dashboard alerts %s failed (%s)", name, type(exc).__name__, exc_info=True)
    return out
