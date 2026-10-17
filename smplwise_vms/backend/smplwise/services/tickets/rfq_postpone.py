"""CR-AWARD-NOTICE (docs/changes/CR-AWARD-NOTICE.md; RFQ contract 20.17): the awarded vendor's POSTPONEMENT NOTICE through his link.

The award notice (rfq_award_notice) tells the vendor his quote is binding and that he must give notice IN ADVANCE if he postpones the
work. This module is that notice: on his own RFQ page, after HIS award is final and before the work is done, he reports a proposed new
date and a short reason.

    record     `ticket_rfq_postponements` (migration 0115): the proposed window, the reason (<= 500 after text hygiene), the time of the
               notice, the date that was scheduled then (`scheduled_from`: the planned arrival of the terms, else the work order's window,
               else the awarded quote's / the request's) and how far in advance it was given (`lead_seconds` = scheduled - notice time,
               negative when given after the scheduled start). A fact, no judgement: nothing is flagged as late (an open owner question).
    effect     NONE on the agreed date. The RFQ managers are notified (source `rfq.vendor_postponement`, the reference and the place only)
               and the timeline gets `vendor_postponement`. A manager either moves the arrival window through the existing route (20.14,
               which can notify the vendor) - that closes the notice as `rescheduled` - or acknowledges it (`acknowledged`). A close /
               cancel / delete of the request ends it.
    limits     one OPEN notice per award (a unique index + 409 `postponement_open`), at most POSTPONE_MAX notices per award
               (409 `postponement_limit`), the edge's per-token write budget (the route is a `token_write` of the public edge: a replay
               or a refusal spends nothing), the link re-read inside the transaction, the uniform 404 for a bad token.
    public     the route is POST /t/api/rfq/arrival `{action: "postpone", work_from, work_to?, reason, client_request_id}` (the arrival route
               of 20.5 - the vendor's work-order / arrival page; the confirm / propose rules are untouched). Every case where no
               postponement may be given (no approved award of HIS, a pending second approval, a request that ended, the work done) is ONE
               answer: 409 `postpone_closed` - nothing tells a vendor about anyone else's award.
Audit `ticket.rfq.vendor_postponement` / `ticket.rfq.postponement_ack`: ids, lead seconds, flags - never the reason text."""
from __future__ import annotations

import datetime as dt
from typing import Any, Mapping

from . import rfq_notify, rfq_terms, store, store_quotes, store_rfq
from .costs import CostRefused, iso, parse

REASON_MAX = 500
POSTPONE_MAX = 10  # notices per award in its whole life (one open at a time)
OPEN_RFQ = ("awarded", "ordered")
SHOWN = 10  # the managers' detail lists the latest notices of an award


def _approved(conn, row: Mapping[str, Any], v: Mapping[str, Any]) -> dict[str, Any] | None:
    return next((a for a in store_rfq.awards_of(conn, row["id"]) if a["rfq_vendor_id"] == v["id"] and a["state"] == "approved"), None)


def _quote(conn, award: Mapping[str, Any]) -> dict[str, Any]:
    return store_quotes.quote(conn, award["quote_id"]) or {}


def scheduled(conn, row: Mapping[str, Any], award: Mapping[str, Any]) -> tuple[str | None, str | None]:
    """The window scheduled for the work right now: the terms' planned arrival (20.4), else the work order's window (18 / 20.15), else the
    awarded quote's work window, else the request's wanted window."""
    from . import rfq_orders

    t = store_rfq.terms(conn, award["id"])
    if t is not None and t.get("planned_from"):
        return t["planned_from"], t.get("planned_to")
    o = rfq_orders.order_of(conn, award)
    if o is not None and o.get("work_from"):
        return o["work_from"], o.get("work_to")
    d = rfq_orders.defaults(conn, row, award)
    return d.get("work_from"), d.get("work_to")


def _open_for_notice(conn, row: Mapping[str, Any], v: Mapping[str, Any], award: Mapping[str, Any] | None, *, read_only: bool) -> bool:
    return bool(award is not None and not read_only and row["state"] in OPEN_RFQ and v["state"] == "awarded"
                and rfq_terms._completed(conn, _quote(conn, award)) is None)


def _present_vendor(p: Mapping[str, Any]) -> dict[str, Any]:
    return {"proposed_from": p["proposed_from"], "proposed_to": p.get("proposed_to"), "at": p["created_at"], "state": p["state"]}


def vendor_block(conn, row: Mapping[str, Any], v: Mapping[str, Any], *, read_only: bool) -> dict[str, Any] | None:
    """`binding` of GET /t/api/rfq - only for the vendor whose APPROVED award it is (page_state `awarded`): the page then shows the
    binding / advance-notice sentence, the scheduled window, his latest notice (never its reason or the managers' handling beyond its
    state) and whether he may give one now."""
    from . import rfq_award_notice, store_links

    a = _approved(conn, row, v)
    if a is None:
        return None
    wf, wt = scheduled(conn, row, a)
    mine = store_rfq.postponements_of_award(conn, a["id"])
    last = mine[-1] if mine else None
    may = _open_for_notice(conn, row, v, a, read_only=read_only)
    lang = (store_links.contact(conn, v["contact_id"]) or {}).get("lang")
    return {"text": rfq_award_notice.page_text(lang), "scheduled_from": wf, "scheduled_to": wt, "postponement": _present_vendor(last) if last else None,
            "can": {"postpone": bool(may and not any(p["state"] == "open" for p in mine) and len(mine) < POSTPONE_MAX)}}


def vendor_postpone(conn, link: Any, body: Mapping[str, Any], now: dt.datetime) -> dict[str, Any]:
    """POST /t/api/rfq/arrival `{action: "postpone", ...}` - checks first, then one row, one timeline row, one audit row, one notification."""
    from .quotes import _instant
    from .rfq_vendor import VendorRefused, _audit, _clean, _fresh, _name

    row, v = _fresh(conn, link)
    a = _approved(conn, row, v)
    if not _open_for_notice(conn, row, v, a, read_only=False):
        raise VendorRefused(409, "postpone_closed")
    assert a is not None
    for key in ("acknowledge_schedule", "schedule_hash"):
        if body.get(key) is not None:
            raise VendorRefused(422, "invalid", fields=[{"field": key, "code": "not_allowed"}])
    try:
        wf = _instant(body.get("work_from"), "work_from", now)
        wt = _instant(body.get("work_to"), "work_to", now)
    except CostRefused as exc:
        raise VendorRefused(422, "invalid", fields=[{"field": exc.field or "work_from", "code": exc.code}]) from None
    if wf is None:
        raise VendorRefused(422, "invalid", fields=[{"field": "work_from", "code": "required"}])
    first, day0 = rfq_terms.local_day(conn, wf), rfq_terms.today(conn, now)
    if first is None or first < day0 or first > day0 + dt.timedelta(days=rfq_terms.HORIZON_DAYS):
        raise VendorRefused(422, "invalid", fields=[{"field": "work_from", "code": "range"}])
    if wt and wt < wf:
        raise VendorRefused(422, "invalid", fields=[{"field": "work_to", "code": "order"}])
    reason = _clean(body.get("reason"), "reason", REASON_MAX, required=True)
    mine = store_rfq.postponements_of_award(conn, a["id"])
    if any(p["state"] == "open" for p in mine):
        raise VendorRefused(409, "postponement_open")  # one open notice per award: the organisation has not acted on the last one
    if len(mine) >= POSTPONE_MAX:
        raise VendorRefused(409, "postponement_limit")
    at = iso(now)
    sf, _st = scheduled(conn, row, a)
    start = parse(sf) if sf else None
    lead = int((start - now).total_seconds()) if start is not None else None
    pid = store_rfq.insert_postponement(conn, {
        "rfq_id": row["id"], "award_id": a["id"], "rfq_vendor_id": v["id"], "link_id": link.link_id, "proposed_from": wf, "proposed_to": wt,
        "reason": reason, "scheduled_from": sf, "lead_seconds": lead, "created_at": at, "state": "open"})
    store_rfq.update_rfq(conn, row["id"], {"updated_at": at})  # the managers' copies go stale
    store_rfq.insert_event(conn, row["id"], "vendor_postponement", actor_kind="contact", actor_name=_name(conn, v), rfq_vendor_id=v["id"],
                           data={"award_id": a["id"], "postponement_id": pid, "proposed_from": wf, "proposed_to": wt, "scheduled_from": sf,
                                 "lead_seconds": lead}, at=at)
    _audit(conn, link, "ticket.rfq.vendor_postponement", row, vendor_id=v["id"], award_id=a["id"], postponement_id=pid,
           lead_seconds=lead, has_scheduled=sf is not None)  # ids and numbers only - never the reason
    rfq_notify.postponement(conn, row, a["id"], v["id"])
    return vendor_block(conn, row, store_rfq.vendor(conn, v["id"]) or v, read_only=False) or {}


# ---------------------------------------------------------------- the managers' side

def acknowledge(conn, viewer: Any, seen: Any, award_id: str, postponement_id: str, rid: str | None = None) -> None:
    """POST /tickets/rfqs/{id}/awards/{award_id}/postponement/ack `{postponement_id}` - an RFQ manager marks the open notice as seen and
    handled without moving the date (e.g. agreed by phone, or the installation does not use the arrival terms). Sends nothing."""
    from . import rfq

    now = rfq.now_utc()
    rfq.need_manager(conn, viewer, seen, "ticket.rfq.postponement_ack", rid)
    a = rfq.award_of(conn, seen, award_id)
    p = store_rfq.open_postponement(conn, a["id"])
    if p is None or p["id"] != postponement_id:
        raise rfq._err(conn, 404, "postponement_not_found")
    at = iso(now)
    store_rfq.resolve_postponements(conn, award_id=a["id"], state="acknowledged", by=viewer.uid, at=at)
    rfq._touch(conn, seen.row, {}, None, now)
    store_rfq.insert_event(conn, seen.row["id"], "postponement_acknowledged", actor_kind="user", actor_user_id=viewer.uid,
                           actor_name=rfq.actor_name(viewer), rfq_vendor_id=a["rfq_vendor_id"],
                           data={"award_id": a["id"], "postponement_id": p["id"]}, at=at)
    rfq._audit(conn, viewer, "ticket.rfq.postponement_ack", seen.row, rid, award_id=a["id"], postponement_id=p["id"])
    rfq_notify.postponement_done(conn, seen.row["id"], a["id"])


def on_rescheduled(conn, viewer: Any, row: Mapping[str, Any], award_id: str, at: str) -> str | None:
    """The arrival window was moved by a manager (20.14): an open notice of that award is answered by it. Returns its id (or None)."""
    rows = store_rfq.resolve_postponements(conn, award_id=award_id, state="rescheduled", by=viewer.uid, at=at)
    if rows:
        rfq_notify.postponement_done(conn, row["id"], award_id)
        return rows[0]["id"]
    return None


def on_ended(conn, rfq_id: str, at: str) -> None:
    """Close / cancel of the request: every open notice ends (its notification too)."""
    store_rfq.resolve_postponements(conn, rfq_id=rfq_id, state="ended", by=None, at=at)
    rfq_notify.postponements_ended(conn, rfq_id)


def present(conn, viewer: Any, seen: Any, award: Mapping[str, Any]) -> dict[str, Any] | None:
    """`awards[].postponement` of the detail (every viewer of the request - the reason is the vendor's own words to the organisation, like
    his thread): the latest notices, newest last, with the lead time as stored; `can.acknowledge` for an RFQ manager on an open one."""
    from . import rfq

    if award["state"] != "approved":
        return None
    rows = store_rfq.postponements_of_award(conn, award["id"])
    if not rows:
        return None
    manager = rfq.is_manager(viewer, seen)
    items = [{"id": p["id"], "proposed_from": p["proposed_from"], "proposed_to": p.get("proposed_to"), "reason": p["reason"],
              "scheduled_from": p.get("scheduled_from"), "lead_seconds": p.get("lead_seconds"), "at": p["created_at"], "state": p["state"],
              "resolved_at": p.get("resolved_at"), "resolved_by": store.display_name(conn, p.get("resolved_by")) if p.get("resolved_by") else None}
             for p in rows[-SHOWN:]]
    open_ = next((x for x in items if x["state"] == "open"), None)
    return {"open": open_, "items": items, "count": len(rows),
            "can": {"acknowledge": bool(manager and open_ is not None)}}
