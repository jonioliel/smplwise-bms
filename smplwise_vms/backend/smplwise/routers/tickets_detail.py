"""TKDETAILBE - the service-request detail API (docs/tickets/DETAIL_BACKEND_CONTRACT.md; owner decisions 15.10).

    GET  /tickets/{id}/timeline                       visible: messages, internal notes, status, quotes, demands, owner changes
    GET  /tickets/{id}/owner                          visible (full view): the internal owner, its history, the candidates
    PUT  /tickets/{id}/owner                          a manager of the ticket: {user_id|null, reason?, revision}
    GET  /tickets/{id}/quotes                         visible; amounts with tickets.costs.view
    POST /tickets/{id}/quotes                         tickets.costs + view: a quote entered on the vendor's behalf
    POST /tickets/{id}/quotes/requirement             a manager: {assignment_id, mode}
    POST /tickets/{id}/quotes/{quote_id}/{action}     tickets.costs + view: approve | request-fix | reject (+ message_draft)
    PUT  /tickets/{id}/allowed-line-kinds             tickets.costs + view: {kinds|null}
    POST /tickets/{id}/vendor-message                 a manager + tickets.external: {text, notify, source?}
    POST /tickets/{id}/notes/{event_id}/forward       a manager + tickets.external: an internal note to the vendor
    POST /tickets/{id}/message-drafts                 tickets.costs + view: the editable draft of a decision message

Order of every route: signed in -> the module switch (router dependency) -> the ticket's visibility (the uniform 404) -> the role /
permission on the ticket's place (an audited 403). Every write is one transaction with its timeline row and an audit row carrying ids
and states only. A decision NEVER sends a message: the manager confirms a draft through /vendor-message (owner 15.10 evening)."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import now_iso
from ..errors import ApiError
from ..rbac import Principal
from ..services.tickets import access, costs, model, owners, quotes, service, sla, store, store_costs, store_links, store_quotes, timeline
from ..services.tickets.access import Seen, Viewer, text
from .tickets import ID, module_gate
from .tickets_costs import _need as need_costs

router = APIRouter(dependencies=[Depends(module_gate)])
NOTIFY_WINDOW_S = 600  # TKFIX260 (review A F9): one "update" notification per assignment per 10 minutes

QUOTE_MESSAGES = {
    "quote_not_open": "אפשר להגיש הצעת מחיר רק כשהבקשה נמצאת אצל מטפל חיצוני ובטיפול.",
    "quote_off": "הצעת מחיר אינה נדרשת בשיוך הזה.",
    "quote_already_approved": "כבר אושרה הצעה בשיוך הזה.",
    "quote_stale": "ההצעה השתנתה בינתיים. טענו מחדש.",
    "quote_not_submitted": "אין הצעה שממתינה להחלטה.",
    "self_approval": "את ההצעה הזאת הזנת בעצמך: אדם אחר צריך לאשר אותה.",
    "not_external": "הצעת מחיר קיימת רק לשיוך לגורם חיצוני.",
    "nothing_left": "אחרי הסרת הסעיפים החריגים לא נשאר מה לאשר.",
    "demand_pending": "כבר הוגשה דרישת תשלום בשיוך הזה. החליטו עליה לפני אישור הצעת המחיר.",
}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _refused(conn: sqlite3.Connection, exc: costs.CostRefused) -> ApiError:
    if exc.code in QUOTE_MESSAGES and exc.status != 422:
        details = dict(exc.extra)
        if exc.field:
            details["field"] = exc.field
        return ApiError(exc.status, exc.code, text(conn, QUOTE_MESSAGES[exc.code]), details=details)
    if exc.status == 422 and exc.code in ("line_kind_not_allowed", "exceptional_description_required", "labor_required"):
        return ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": exc.field or "body", "code": exc.code}]})
    return service.cost_error(conn, exc)


def _costs_full(viewer: Viewer, seen: Seen) -> bool:
    return seen.full and viewer.holds(costs.COSTS_VIEW, seen.row)


def _quotes_answer(conn: sqlite3.Connection, viewer: Viewer, ticket_id: str) -> dict[str, Any]:
    seen = access.require_visible(viewer, ticket_id)
    full = _costs_full(viewer, seen)
    out = quotes.answer(conn, seen.row, full=full, can_decide=full and viewer.holds(costs.COSTS, seen.row))
    out.update({"ticket_id": ticket_id, "number": seen.row["number"]})
    return out


# ---------------------------------------------------------------- the timeline

@router.get("/tickets/{ticket_id}/timeline")
def get_timeline(ticket_id: str = Path(..., pattern=ID), flt: Literal["all", "messages", "notes", "status", "costs"] = Query("all", alias="filter"),
                 limit: int = Query(timeline.LIMIT_DEFAULT, ge=1, le=timeline.LIMIT_MAX), before: str | None = Query(None, max_length=120),
                 principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    return timeline.build(conn, viewer, seen, flt=flt, limit=limit, before=before)


# ---------------------------------------------------------------- the internal owner

def _owner_answer(conn: sqlite3.Connection, viewer: Viewer, seen: Seen) -> dict[str, Any]:
    full = seen.full  # TKFIX260 (review A F7): the owner is for the members' full view (contract section 2), like its history
    return {"ticket_id": seen.row["id"], "revision": seen.row["revision"], "owner": owners.owner_block(conn, seen.row) if full else None,
            "history": owners.history(conn, seen.row["id"]) if full else [],
            "candidates": [{"id": c["id"], "name": c["name"]} for c in service.eligible_assignees(conn, seen.row["department_id"], seen.row)]
            if seen.manager else [],
            "can": {"change": seen.manager and seen.row["status"] not in model.FINAL}}


@router.get("/tickets/{ticket_id}/owner")
def get_owner(ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro),
              conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    return _owner_answer(conn, viewer, access.require_visible(viewer, ticket_id))


class OwnerBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str | None = Field(default=None, max_length=64)
    reason: str | None = Field(default=None, max_length=2000)
    revision: int = Field(ge=1)


@router.put("/tickets/{ticket_id}/owner")
def put_owner(body: OwnerBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
              conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    if seen.row["status"] in model.FINAL:
        raise ApiError(409, "ticket_closed", text(conn, "{the_ticket} {f:סגורה|m:סגור}."))
    candidates = service.eligible_assignees(conn, seen.row["department_id"], seen.row) if seen.manager else []
    owners.change(conn, viewer, seen, body.user_id or None, body.reason, body.revision, candidates=candidates, rid=_rid(request))
    return _owner_answer(conn, viewer, access.require_visible(viewer, ticket_id))


# ---------------------------------------------------------------- quotes

@router.get("/tickets/{ticket_id}/quotes")
def get_quotes(ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro),
               conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return _quotes_answer(conn, Viewer(conn, principal), ticket_id)


class QuoteLine(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["labor", "parts", "travel", "other"]
    description: str | None = Field(default=None, max_length=400)
    hours: str | None = Field(default=None, max_length=12)
    rate: str | None = Field(default=None, max_length=16)
    quantity: str | None = Field(default=None, max_length=16)
    unit_price: str | None = Field(default=None, max_length=16)
    amount: str | None = Field(default=None, max_length=16)


class QuoteBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    assignment_id: str | None = Field(default=None, max_length=64, pattern=ID)
    lines: list[QuoteLine] = Field(default_factory=list, max_length=30)
    currency: str | None = Field(default=None, max_length=3)
    amounts_include_vat: bool | None = None
    work_from: str | None = Field(default=None, max_length=40)
    work_to: str | None = Field(default=None, max_length=40)
    note: str | None = Field(default=None, max_length=5000)
    vendor_ref: str | None = Field(default=None, max_length=500)


def quote_payload(body: BaseModel, exclude: set[str]) -> dict[str, Any]:
    payload = body.model_dump(exclude=exclude, exclude_none=True)
    payload["lines"] = [{k: v for k, v in ln.items() if v is not None} for ln in payload.get("lines", [])]
    return payload


@router.post("/tickets/{ticket_id}/quotes", status_code=201)
def post_quote(body: QuoteBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    seen = need_costs(conn, viewer, ticket_id, "ticket.quote.on_behalf", rid, decide=True)
    asg = quotes.active_external(conn, seen.row)
    if body.assignment_id and (asg is None or asg["id"] != body.assignment_id):
        raise _refused(conn, costs.CostRefused(409, "quote_not_open"))
    try:
        q = quotes.submit(conn, seen.row, asg, quote_payload(body, {"assignment_id"}), by_kind="user", by_id=viewer.uid, at=costs.now_utc(),
                          actor_name=service.actor_name(viewer))
    except costs.CostRefused as exc:
        raise _refused(conn, exc) from None
    audit(conn, actor=principal, action="ticket.quote.on_behalf", decision="allowed", resource_type="ticket", resource_id=ticket_id, request_id=rid,
          details={"number": seen.row["number"], "quote_id": q["id"], "version": q["version"], "currency": q["currency"]})  # TKFIX260: no amount
    return _quotes_answer(conn, viewer, ticket_id)


class QuoteModeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    assignment_id: str = Field(min_length=1, max_length=64, pattern=ID)
    mode: Literal["required", "optional", "off"]


@router.post("/tickets/{ticket_id}/quotes/requirement")
def post_quote_mode(body: QuoteModeBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    rid = _rid(request)
    if not seen.manager:
        raise service.refuse(conn, viewer, "ticket.quote.requirement", seen.row, "not_manager", rid)
    asg = store.assignment(conn, body.assignment_id)
    if asg is None or asg["ticket_id"] != ticket_id:
        raise ApiError(404, "assignment_not_found", text(conn, "השיוך לא נמצא."))
    try:
        quotes.set_mode(conn, seen.row, asg, body.mode)
    except costs.CostRefused as exc:
        raise _refused(conn, exc) from None
    audit(conn, actor=principal, action="ticket.quote.requirement", decision="allowed", resource_type="ticket", resource_id=ticket_id, request_id=rid,
          details={"number": seen.row["number"], "assignment_id": asg["id"], "mode": body.mode})
    return _quotes_answer(conn, viewer, ticket_id)


class QuoteDecisionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    line_indexes: list[int] | None = Field(default=None, max_length=30)
    reason: str | None = Field(default=None, max_length=5000)  # shown to the vendor (page + draft) for request-fix / reject
    internal_note: str | None = Field(default=None, max_length=5000)  # TKFIX260: internal only - never public, never in the draft


QUOTE_ACTIONS = {"approve": "approve", "request-fix": "request_fix", "reject": "reject"}
DRAFT_OF = {"approved": "approved", "partially_approved": "partially_approved", "fix_requested": "fix_requested", "rejected": "rejected"}


def _quote_of(conn: sqlite3.Connection, seen: Seen, quote_id: str) -> dict[str, Any]:
    q = store_quotes.quote(conn, quote_id)
    if q is None or q.get("ticket_id") != seen.row["id"]:
        raise ApiError(404, "quote_not_found", text(conn, "ההצעה לא נמצאה."))
    return q


@router.post("/tickets/{ticket_id}/quotes/{quote_id}/{action}")
def post_quote_decision(body: QuoteDecisionBody, request: Request, ticket_id: str = Path(..., pattern=ID), quote_id: str = Path(..., pattern=ID),
                        action: Literal["approve", "request-fix", "reject"] = Path(...), principal: Principal = Depends(current_principal),
                        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    act = QUOTE_ACTIONS[action]
    seen = need_costs(conn, viewer, ticket_id, f"ticket.quote.{act}", rid, decide=True)
    q = _quote_of(conn, seen, quote_id)
    try:
        fresh = quotes.decide(conn, q, act, by=viewer.uid, revision=body.revision, at=costs.now_utc(), line_indexes=body.line_indexes,
                              reason=body.reason, actor_name=service.actor_name(viewer), note=body.internal_note)
    except costs.CostRefused as exc:
        raise _refused(conn, exc) from None
    audit(conn, actor=principal, action=f"ticket.quote.{act}", decision="allowed", resource_type="ticket", resource_id=ticket_id, request_id=rid,
          details={"number": seen.row["number"], "quote_id": fresh["id"], "version": fresh["version"], "state": fresh["state"]})  # TKFIX260: no amount
    out = _quotes_answer(conn, viewer, ticket_id)
    out["message_draft"] = quotes.draft_message(conn, seen.row, subject="quote", obj=fresh, decision=DRAFT_OF[fresh["state"]])
    return out


class KindsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kinds: list[Literal["labor", "parts", "travel", "other"]] | None = Field(default=None, max_length=4)


@router.put("/tickets/{ticket_id}/allowed-line-kinds")
def put_kinds(body: KindsBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
              conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    seen = need_costs(conn, viewer, ticket_id, "ticket.allowed_kinds", rid, decide=True)
    try:
        kinds = quotes.parse_kinds(body.kinds)
    except costs.CostRefused as exc:
        raise _refused(conn, exc) from None
    store_quotes.set_ticket_kinds(conn, ticket_id, kinds)
    audit(conn, actor=principal, action="ticket.allowed_kinds", decision="allowed", resource_type="ticket", resource_id=ticket_id, request_id=rid,
          details={"number": seen.row["number"], "kinds": kinds})
    return _quotes_answer(conn, viewer, ticket_id)


# ---------------------------------------------------------------- writing to the vendor

def _need_vendor_writer(conn: sqlite3.Connection, viewer: Viewer, seen: Seen, action: str, rid: str | None) -> dict[str, Any]:
    row = seen.row
    if not seen.manager:
        raise service.refuse(conn, viewer, action, row, "not_manager", rid)
    if not viewer.holds(access.EXTERNAL, row):
        raise service.refuse(conn, viewer, action, row, "external_permission_missing", rid, permission=access.EXTERNAL)
    if row["status"] in model.FINAL:
        raise ApiError(409, "ticket_closed", text(conn, "{the_ticket} {f:סגורה|m:סגור}."))
    asg = quotes.active_external(conn, row)
    if asg is None:
        raise ApiError(409, "no_external_assignment", text(conn, "ל{ticket} אין שיוך פעיל לגורם חיצוני."))
    return asg


def _notify(conn: sqlite3.Connection, row: dict[str, Any], asg: dict[str, Any], requested_by: str) -> dict[str, Any]:
    """The existing templated "update" notification with the link (WhatsApp / e-mail, held by the send hours) - the free text never
    travels in it. A failure never fails the message itself.
    TKFIX260 (review A F9): ONE notification per assignment (and link generation) per NOTIFY_WINDOW_S - the idempotency key names
    the window, so five short messages in a minute queue one "there is an update" message (the outbox answers the existing row);
    every message is still on the vendor's page."""
    from ..services.tickets import handler_links, messaging

    out: dict[str, Any] = {"queued": False, "channel": None}
    link = store_links.link_for_assignment(conn, asg["id"])
    contact = store_links.contact(conn, asg["contact_id"])
    rt = messaging.RUNTIME
    if link is None or contact is None or contact.get("erased_at"):
        return out
    try:
        now = rt.clock()
        if handler_links.state(link, now) != "live":
            return out
        channel = messaging.plan_channel(conn, contact, rt.data_dir)
        out["channel"] = channel
        if channel != "manual" and rt.outbox is not None:
            queued = rt.enqueue(conn, purpose="update", contact_id=contact["id"], ticket_id=row["id"], assignment_id=asg["id"], link_id=link["id"],
                                department_id=row["department_id"], params=messaging.message_params(conn, row, contact), channel=channel,
                                requested_by=requested_by,
                                idempotency_key=f"vmsg:{asg['id']}:{int(link.get('generation') or 1)}:{int(now.timestamp()) // NOTIFY_WINDOW_S}")
            out.update({"queued": True, "outbox_id": getattr(queued, "id", None)})
    except Exception:  # noqa: BLE001 - the message is stored; the notification is best effort (the timeline shows its state)
        out["queued"] = False
    return out


def _write_vendor_message(conn: sqlite3.Connection, viewer: Viewer, seen: Seen, asg: dict[str, Any], body: str, notify: bool,
                          data: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    row = seen.row
    notified = _notify(conn, row, asg, viewer.uid) if notify else {"queued": False, "channel": None}
    at = now_iso()
    eid = store.insert_event(conn, row["id"], "note", actor_kind="user", actor_user_id=viewer.uid, actor_name=service.actor_name(viewer),
                             assignment_id=asg["id"], body=body, visible_external=True,
                             data={**data, "notified": bool(notified.get("queued")), "channel": notified.get("channel")}, at=at)
    store.update_ticket(conn, row["id"], {"last_activity_at": at}, bump=False)
    sla.refresh(conn, row["id"])
    return eid, notified


def _item_of(conn: sqlite3.Connection, viewer: Viewer, ticket_id: str, eid: int) -> dict[str, Any] | None:
    seen = access.require_visible(viewer, ticket_id)
    page = timeline.build(conn, viewer, seen, flt="all", limit=timeline.LIMIT_MAX)
    return next((i for i in page["items"] if i["id"] == f"ev:{eid}"), None)


class SourceRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["quote", "claim", "note"]
    id: str = Field(min_length=1, max_length=64, pattern=ID)


def _check_source(conn: sqlite3.Connection, seen: Seen, src: SourceRef) -> None:
    """TKFIX260 (review A F8): the decision / note a vendor message names must be one of THIS ticket's - else the uniform 404 of
    that object (the audit row never points at another ticket's quote, claim or note)."""
    if src.kind == "quote":
        _quote_of(conn, seen, src.id)
    elif src.kind == "claim":
        claim = store_costs.claim(conn, src.id)
        if claim is None or claim.get("ticket_id") != seen.row["id"]:
            raise ApiError(404, "claim_not_found", text(conn, "דרישת התשלום לא נמצאה."))
    else:
        ev = store_quotes.event_of_ticket(conn, seen.row["id"], int(src.id)) if src.id.isdigit() and len(src.id) <= 18 else None
        if ev is None or ev["kind"] != "note":
            raise ApiError(404, "note_not_found", text(conn, "ההערה לא נמצאה."))


class VendorMessageBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(max_length=5000)
    notify: bool = True
    source: SourceRef | None = None


@router.post("/tickets/{ticket_id}/vendor-message", status_code=201)
def post_vendor_message(body: VendorMessageBody, request: Request, ticket_id: str = Path(..., pattern=ID),
                        principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    seen = access.require_visible(viewer, ticket_id)
    asg = _need_vendor_writer(conn, viewer, seen, "ticket.vendor_message", rid)
    if body.source is not None:
        _check_source(conn, seen, body.source)
    try:
        msg = model.text_field(body.text, "text", required=True, max_len=model.NOTE_MAX, multiline=True)
    except model.Invalid as exc:
        raise service.invalid(conn, exc) from None
    data: dict[str, Any] = {"composer": "vendor_message"}
    if body.source is not None:
        data["source"] = {"kind": body.source.kind, "id": body.source.id}
    eid, notified = _write_vendor_message(conn, viewer, seen, asg, msg, body.notify, data)
    audit(conn, actor=principal, action="ticket.vendor_message", decision="allowed", resource_type="ticket", resource_id=ticket_id, request_id=rid,
          details={"number": seen.row["number"], "event_id": eid, "notified": bool(notified.get("queued")), "channel": notified.get("channel"),
                   **({"source": data["source"]} if "source" in data else {})})
    return {"item": _item_of(conn, viewer, ticket_id, eid), "notified": notified}


class ForwardBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str | None = Field(default=None, max_length=5000)
    notify: bool = True


@router.post("/tickets/{ticket_id}/notes/{event_id}/forward", status_code=201)
def post_forward(body: ForwardBody, request: Request, ticket_id: str = Path(..., pattern=ID), event_id: int = Path(..., ge=1),
                 principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Owner decision 3: an internal note may be sent to the vendor later - a NEW external row that names the note
    (`from_note_id`); the internal note itself stays internal."""
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    seen = access.require_visible(viewer, ticket_id)
    asg = _need_vendor_writer(conn, viewer, seen, "ticket.note.forward", rid)
    ev = store_quotes.event_of_ticket(conn, ticket_id, event_id)
    if ev is None or ev["kind"] != "note" or ev["actor_kind"] != "user":
        raise ApiError(404, "note_not_found", text(conn, "ההערה לא נמצאה."))
    if ev.get("visible_external"):
        raise ApiError(409, "note_already_external", text(conn, "ההערה כבר גלויה למטפל החיצוני."))
    try:
        msg = model.text_field(body.text if body.text is not None else ev.get("body"), "text", required=True, max_len=model.NOTE_MAX, multiline=True)
    except model.Invalid as exc:
        raise service.invalid(conn, exc) from None
    eid, notified = _write_vendor_message(conn, viewer, seen, asg, msg, body.notify, {"from_note_id": event_id, "edited": body.text is not None})
    audit(conn, actor=principal, action="ticket.note.forward", decision="allowed", resource_type="ticket", resource_id=ticket_id, request_id=rid,
          details={"number": seen.row["number"], "note_id": event_id, "event_id": eid, "notified": bool(notified.get("queued"))})
    return {"item": _item_of(conn, viewer, ticket_id, eid), "notified": notified}


# ---------------------------------------------------------------- decision drafts

class DraftBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject: Literal["quote", "claim"]
    id: str = Field(min_length=1, max_length=64, pattern=ID)
    decision: Literal["approved", "partially_approved", "fix_requested", "rejected", "approved_without_exceptional"]


def claim_draft_object(conn: sqlite3.Connection, claim: dict[str, Any]) -> dict[str, Any]:
    decisions = store_costs.decisions(conn, claim["id"])
    last = next((d for d in reversed(decisions) if d["action"] in ("reject", "adjust")), None)
    approved = store_costs.revision(conn, claim.get("approved_revision_id"))
    base = store_costs.revision(conn, (approved or {}).get("based_on")) if approved and approved.get("kind") == "adjustment" else None
    current = store_costs.revision(conn, claim.get("current_revision_id"))
    return {"id": claim["id"], "contact_id": claim["contact_id"], "reason": (last or {}).get("reason"),
            "exceptional": quotes.exceptional_of(base or current or {})}


@router.post("/tickets/{ticket_id}/message-drafts")
def post_draft(body: DraftBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = need_costs(conn, viewer, ticket_id, "ticket.message_draft", _rid(request), decide=True)
    if body.subject == "quote":
        obj = _quote_of(conn, seen, body.id)
        if body.decision == "approved_without_exceptional":
            raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "decision", "code": "unknown"}]})
    else:
        claim = store_costs.claim(conn, body.id)
        if claim is None or claim.get("ticket_id") != ticket_id:
            raise ApiError(404, "claim_not_found", text(conn, "דרישת התשלום לא נמצאה."))
        if body.decision in ("partially_approved", "fix_requested"):
            raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "decision", "code": "unknown"}]})
        obj = claim_draft_object(conn, claim)
    try:
        return quotes.draft_message(conn, seen.row, subject=body.subject, obj=obj, decision=body.decision)
    except costs.CostRefused as exc:
        raise _refused(conn, exc) from None
