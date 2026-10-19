"""MGRDASH phase 4 (docs/design/MANAGER_DASHBOARD_SPEC_HE.md sections 3 cards 9-10, 9 "payment due tomorrow", 10 phase 4): the manager
overview's payments board, GET /tickets/dashboard/payments - what is waiting for MY payment decision:

    overdue    approved instalments (CR-RFQ-PAYMENT-SCHEDULE, RFQPAY2) whose due day passed (strictly before today, the installation's
               time zone) and that are not marked paid - exactly rfq_terms._overdue(), the rule of the `rfq.instalment_overdue` signal
    upcoming   approved instalments due today .. today + 13 days, not marked paid (the "next two weeks" card's payment dates)
    claims     payment demands of service requests that a manager approved and nobody marked paid yet (`approved`; owner question 10 b)

An instalment due on / after completion has a day only once its work order is done (review F2) - before that it is in neither list. An
instalment of 0 is never listed. A cancelled demand does not settle the instalment (the money is still owed), exactly as the overdue rule.

WHO (section 4): a row is listed only to a caller who may ACT on it, by the rule of the act itself:
  - an instalment: the request passes rfq.visible() and the caller holds tickets.costs + tickets.costs.view where it lies (rfq.can_decide,
    the rule of the demand / paid / move-date routes, rfq_terms._payable);
  - a claim: the ticket passes access.visible(), the caller MANAGES it (the board's rule) and holds tickets.costs + view where it lies
    (the mark-paid rule).
The visibility is read in ONE batch per answer (access.visible_by_ids / rfq.visible_by_ids - a few SQL reads, the permissions cached per
place target), never one check per row. A department filter keeps the rows of that department only (the route refuses a department the
caller does not manage). Amounts: every listed row's caller holds tickets.costs.view where it lies, so amounts are shown; never summed.
The answer is kept 30 seconds per caller, department and permission revision (the summary route's cache rule)."""
from __future__ import annotations

import datetime as dt
from typing import Any

from ...db import permission_revision
from . import access, rfq, rfq_terms, store_dash_extra, stuck
from .access import Viewer
from .costs import COSTS, COSTS_VIEW
from .dashboard import _Cache, _contact_label, db_key

UPCOMING_DAYS = 14
ITEMS_MAX = 50  # rows per list (the counts are always complete)


def local_day(at: str | None, tz: dt.tzinfo) -> dt.date | None:
    d = stuck.parse(at)
    return d.astimezone(tz).date() if d is not None else None


def instalments(conn, *, today: dt.date, tz: dt.tzinfo, until: dt.date | None = None) -> list[dict[str, Any]]:
    """Every unpaid approved instalment with a due day before `until` (default: today + 14), system-wide and WITHOUT any visibility (the
    callers filter: payments() by the caller's rights, the alerts by the notification engine's recipients). Nothing while the
    installation switch `rfq.schedule_arrival` is off (the schedule feature then reads nothing)."""
    if not rfq_terms.enabled(conn):
        return []
    until = until or today + dt.timedelta(days=UPCOMING_DAYS)
    terms = store_dash_extra.payable_terms(conn, rfq_terms.PAYMENT_RFQ)
    quote_ids = [t["quote_id"] for t in terms]
    demands = store_dash_extra.demands_of_quotes(conn, quote_ids)
    done = store_dash_extra.quotes_done_at(conn, quote_ids)
    out: list[dict[str, Any]] = []
    for t in terms:
        sched = rfq_terms.loads(t["schedule_json"]) or {"items": []}
        completed = local_day(done.get(t["quote_id"]), tz)
        ds = demands.get(t["quote_id"], {})
        for it in sched.get("items") or []:
            if int(it.get("amount_minor") or 0) <= 0:
                continue
            day = rfq_terms._due_day(None, it, completed)
            if day is None or day >= until:
                continue
            d = ds.get(int(it["index"]))
            if d is not None and d["status"] == "paid":
                continue
            out.append({"award_id": t["award_id"], "rfq_id": t["rfq_id"], "rfq_vendor_id": t["rfq_vendor_id"], "department_id": t["department_id"],
                        "index": int(it["index"]), "kind": it.get("kind"), "due": it.get("due"), "due_date": day,
                        "amount_minor": int(it["amount_minor"]), "currency": sched.get("currency") or t["currency"],
                        "demand": d["status"] if d is not None else "none", "moved": bool(it.get("date_changed_at"))})
    return out


def payments(conn, viewer: Viewer, *, department_id: str | None, now: dt.datetime, tz: dt.tzinfo) -> dict[str, Any]:
    today = now.astimezone(tz).date()
    rows = instalments(conn, today=today, tz=tz)
    seen_rfq = rfq.visible_by_ids(viewer, [r["rfq_id"] for r in rows])
    vendor_names: dict[str, str] = {}

    def vendor_of(rfq_vendor_id: str) -> str:
        if rfq_vendor_id not in vendor_names:
            from .store_rfq import vendor

            vendor_names[rfq_vendor_id] = _contact_label(conn, (vendor(conn, rfq_vendor_id) or {}).get("contact_id"))
        return vendor_names[rfq_vendor_id]

    overdue: list[dict[str, Any]] = []
    upcoming: list[dict[str, Any]] = []
    for r in rows:
        s = seen_rfq.get(r["rfq_id"])
        if s is None or not rfq.can_decide(viewer, s) or (department_id and s.row["department_id"] != department_id):
            continue
        item = {"id": f"{r['award_id']}:{r['index']}", "kind": "instalment", "award_id": r["award_id"], "index": r["index"],
                "instalment_kind": r["kind"], "rfq": {"id": s.row["id"], "number": s.row["number"], "ref": rfq.ref(s.row["number"]),
                                                       "title": s.row.get("title") or ""},
                "department_id": s.row["department_id"], "rfq_vendor_id": r["rfq_vendor_id"], "due_date": r["due_date"].isoformat(),
                "days": (r["due_date"] - today).days, "demand": r["demand"], "moved": r["moved"],
                "amount_minor": r["amount_minor"], "currency": r["currency"]}
        (overdue if r["due_date"] < today else upcoming).append(item)
    overdue.sort(key=lambda x: (x["due_date"], x["rfq"]["number"], x["index"]))
    upcoming.sort(key=lambda x: (x["due_date"], x["rfq"]["number"], x["index"]))

    claim_rows = store_dash_extra.approved_unpaid_claims(conn)
    seen_t = access.visible_by_ids(viewer, [c["ticket_id"] for c in claim_rows])
    claims: list[dict[str, Any]] = []
    for c in claim_rows:
        s = seen_t.get(c["ticket_id"])
        if s is None or not s.manager or (department_id and s.row["department_id"] != department_id):
            continue
        if not (viewer.holds(COSTS_VIEW, s.row) and viewer.holds(COSTS, s.row)):
            continue
        claims.append({"id": c["id"], "kind": "claim", "ticket": {"id": s.row["id"], "number": s.row["number"], "title": s.row.get("title") or ""},
                       "department_id": s.row["department_id"], "contact_id": c["contact_id"], "since": c["approved_at"],
                       "instalment_index": c["instalment_index"],
                       "amount_minor": int(c["approved_total_minor"]) if c["approved_total_minor"] is not None else None, "currency": c["currency"]})
    for lst in (overdue, upcoming):
        for x in lst[:ITEMS_MAX]:
            x["vendor"] = vendor_of(x.pop("rfq_vendor_id"))
        for x in lst[ITEMS_MAX:]:
            x.pop("rfq_vendor_id", None)
    for x in claims[:ITEMS_MAX]:
        x["vendor"] = _contact_label(conn, x.pop("contact_id"))
    tomorrow = (today + dt.timedelta(days=1)).isoformat()
    return {
        "schedule_on": rfq_terms.enabled(conn), "today": today.isoformat(), "department_id": department_id,
        "overdue": {"count": len(overdue), "items": overdue[:ITEMS_MAX]},
        "upcoming": {"count": len(upcoming), "tomorrow": sum(1 for x in upcoming if x["due_date"] == tomorrow), "items": upcoming[:ITEMS_MAX]},
        "claims": {"count": len(claims), "items": claims[:ITEMS_MAX]},
    }


def may_pay_somewhere(viewer: Viewer) -> bool:
    """The route's gate on top of the board's: the payment permissions at SOME scope (else the card is not shown and the route refuses)."""
    return COSTS_VIEW in viewer.anywhere and COSTS in viewer.anywhere


CACHE = _Cache()


def cached_payments(conn, viewer: Viewer, *, department_id: str | None, now: dt.datetime, tz: dt.tzinfo) -> dict[str, Any]:
    key = (db_key(conn), viewer.uid, permission_revision(conn), department_id or "", "payments")
    return CACHE.get_or_build(key, lambda: {**payments(conn, viewer, department_id=department_id, now=now, tz=tz), "generated_at": stuck.iso(now)})
