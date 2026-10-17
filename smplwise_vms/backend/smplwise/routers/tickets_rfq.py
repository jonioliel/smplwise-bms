"""TKRFQ1 - requests for quotation, stage C1: the manager API (docs/tickets/RFQ_BACKEND_CONTRACT.md section 9).

    GET    /tickets/rfqs/meta                                          tickets.view: settings, departments, vendor page readiness
    GET    /tickets/rfqs                                               visible requests (board / list data)
    POST   /tickets/rfqs                                               create a draft (idempotent by client_request_id)
    PUT    /tickets/rfqs/departments/{dept_id}                         tickets.configure: the second-approval threshold
    GET    /tickets/rfqs/{id}                                          the detail (vendors, KPIs, awards, timeline)
    PATCH  /tickets/rfqs/{id}                                          RFQ manager: edit (fields by state)
    DELETE /tickets/rfqs/{id}                                          tickets.delete: full deletion
    POST   /tickets/rfqs/{id}/vendors                                  RFQ manager: invite one more vendor (draft)
    POST   /tickets/rfqs/{id}/vendors/{rv}/remove                      RFQ manager
    POST   /tickets/rfqs/{id}/vendors/{rv}/options                     RFQ manager: the verification code / channel of one vendor (C2)
    POST   /tickets/rfqs/{id}/vendors/{rv}/link/revoke                 RFQ manager
    POST   /tickets/rfqs/{id}/vendors/{rv}/quotes                      on behalf (tickets.costs + view)
    POST   /tickets/rfqs/{id}/vendors/{rv}/quotes/{quote_id}/withdraw  on behalf
    POST   /tickets/rfqs/{id}/vendors/{rv}/decline                     on behalf
    GET    /tickets/rfqs/{id}/vendors/{rv}/messages                    visible
    POST   /tickets/rfqs/{id}/vendors/{rv}/messages                    RFQ manager (templated notice only; the text stays in the thread)
    POST   /tickets/rfqs/{id}/send | remind | cancel | close            RFQ manager
    GET    /tickets/rfqs/questions/summary                             RFQQUESTIONS: the navigation badge (requests the caller manages)
    POST   /tickets/rfqs/{id}/vendors/{rv}/messages/read               RFQQUESTIONS: an RFQ manager opened the thread (no longer new)
    POST   /tickets/rfqs/{id}/questions/{mid}/preview | answer | resolve  RFQQUESTIONS: answer one vendor / every vendor, or mark handled
    GET    /tickets/rfqs/{id}/comparison                               + tickets.costs.view
    POST   /tickets/rfqs/{id}/awards                                 tickets.costs + view (+ message_draft; nothing is sent)
    POST   /tickets/rfqs/{id}/awards/{award_id}/confirm | decline      the second approver
    POST   /tickets/rfqs/{id}/awards/{award_id}/arrival                CR-RFQ-PAYMENT-SCHEDULE: accept / reject the vendor's proposed date
    POST   /tickets/rfqs/{id}/awards/{award_id}/instalments/{i}/date   RFQPAY2: move a dated instalment's day (tickets.costs + view)
    POST   /tickets/rfqs/{id}/awards/{award_id}/instalments/{i}/demand RFQPAY2: the instalment's payment demand - create / paid / cancel
    POST   /tickets/rfqs/{id}/awards/{award_id}/arrival/date           RFQPAY2: move the planned arrival window (tickets.costs + view)
    POST   /tickets/rfqs/{id}/awards/{award_id}/order                  TKRFQ4: open the vendor's service request (idempotent; sends nothing)
    GET    /tickets/rfqs/{id}/awards/{award_id}/order/preview          TKRFQ4: the exact order message, its channel, the refusals
    POST   /tickets/rfqs/{id}/awards/{award_id}/order/send             TKRFQ4: the explicit send of the order message
    POST   /tickets/rfqs/{id}/attachments                              RFQATT: RFQ manager - one file (multipart: file, caption?, visible?)
    PATCH  /tickets/rfqs/{id}/attachments/{aid}                        RFQATT: RFQ manager - caption / visible to vendors
    DELETE /tickets/rfqs/{id}/attachments/{aid}                        RFQATT: RFQ manager - remove (marked only once a quote arrived)
    GET    /tickets/rfqs/{id}/attachments/{aid}[/thumb]                RFQATT: visible - the file (a picture inline, a document as a download)
    GET    /tickets/{ticket_id}/rfq-attachments/{aid}[/thumb]          RFQATT: the ticket's viewers - a request file a work order referenced

Order of every route: signed in -> the module switch (router dependency) -> the request's visibility (the uniform 404) -> the role /
permission (an audited 403). Every write is one transaction with its RFQ timeline row and an audit row (ids, states, totals). Registered
BEFORE /tickets/{ticket_id}."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, Path, Query, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import commit_now, unlocked
from ..errors import ApiError
from ..rbac import Principal
from ..services.tickets import access, attachments, model, rfq, rfq_attach, rfq_files, rfq_orders, rfq_questions, rfq_terms, store, store_rfq
from ..services.tickets.image_intake import IntakeError, StorePathError
from ..services.tickets.access import Viewer, text
from .tickets import ID, module_gate
from .tickets_detail import QuoteLine, quote_payload

router = APIRouter(dependencies=[Depends(module_gate)])

STATE_FILTER = r"^(open|all|draft|sent|collecting|due_passed|awarded|ordered|closed|cancelled)$"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _detail(conn: sqlite3.Connection, viewer: Viewer, rfq_id: str) -> dict[str, Any]:
    return rfq.detail(conn, viewer, rfq.require_visible(viewer, rfq_id))


def _need_view(conn: sqlite3.Connection, viewer: Viewer) -> None:
    if access.VIEW not in viewer.anywhere:
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"permission": access.VIEW})


# ---------------------------------------------------------------- list, meta, create

@router.get("/tickets/rfqs/meta")
def get_meta(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    _need_view(conn, viewer)
    return rfq.meta(conn, viewer)


@router.get("/tickets/rfqs")
def list_rfqs(state: str = Query("open", pattern=STATE_FILTER), department_id: str | None = Query(None, pattern=ID),
              q: str = Query("", max_length=120), cursor: str | None = Query(None, max_length=200), limit: int = Query(50, ge=1, le=200),
              principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    _need_view(conn, viewer)
    page, nxt = rfq.visible_page(viewer, state=state, department_id=department_id, query=q, cursor=cursor, limit=limit)
    now = rfq.now_utc()
    return {"items": [rfq.summary(conn, viewer, s, now) for s in page], "next_cursor": nxt}


Channel = Literal["auto", "whatsapp", "email", "manual"]


class VendorRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contact_id: str = Field(min_length=1, max_length=64, pattern=ID)
    channel: Channel | None = None  # TKRFQVP (contract 15.6): the manager's per-vendor choice (meta.vendor_options)
    require_code: bool | None = None  # TKRFQVP: the optional verification code (off by default; the directory may demand it)


class CreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    department_id: str = Field(min_length=1, max_length=64, pattern=ID)
    title: str = Field(max_length=2000)
    description: str | None = Field(default=None, max_length=20000)
    place_text: str | None = Field(default=None, max_length=2000)
    location_id: str | None = Field(default=None, max_length=64, pattern=ID)  # CR-ORG-LOCATIONS: an active organisation location
    location_nav: bool | None = None  # CR-ORG-LOCATIONS: the map link in this request's vendor messages (default off)
    floor_id: str | None = Field(default=None, max_length=64, pattern=ID)
    source_ticket_id: str | None = Field(default=None, max_length=64, pattern=ID)
    due_at: str | None = Field(default=None, max_length=40)
    work_from: str | None = Field(default=None, max_length=40)
    work_to: str | None = Field(default=None, max_length=40)
    allowed_line_kinds: list[Literal["labor", "parts", "travel", "other"]] | None = Field(default=None, max_length=4)
    internal_owner_user_id: str | None = Field(default=None, max_length=64)
    vendors: list[VendorRef] = Field(default_factory=list, max_length=30)
    client_request_id: str = Field(min_length=8, max_length=64, pattern=model.CLIENT_REQUEST_RE.pattern)


@router.post("/tickets/rfqs", status_code=201)
def create_rfq(body: CreateBody, request: Request, principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    scope = f"rfq:{viewer.uid}"
    prior = store.request_get(conn, scope, body.client_request_id)
    if prior is not None:
        import json

        rfq_id = json.loads(prior["response_json"]).get("id")
        return _detail(conn, viewer, rfq_id)
    payload = body.model_dump(exclude={"client_request_id"}, exclude_none=True)
    payload["vendors"] = [v.model_dump(exclude_none=True) for v in body.vendors]
    rfq_id = rfq.create(conn, viewer, payload, _rid(request))
    store.request_put(conn, scope, body.client_request_id, "rfq.create", 201, {"id": rfq_id})
    return _detail(conn, viewer, rfq_id)


class ThresholdBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    second_approval_minor: int | None = Field(default=None, ge=0, le=rfq.THRESHOLD_MAX)


@router.get("/tickets/rfqs/questions/summary")
def get_questions_summary(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """RFQQUESTIONS: the navigation badge - unanswered vendor questions of the open requests the caller manages."""
    viewer = Viewer(conn, principal)
    _need_view(conn, viewer)
    return rfq_questions.nav_summary(conn, viewer)


@router.put("/tickets/rfqs/departments/{dept_id}")
def put_threshold(body: ThresholdBody, request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    value = rfq.set_threshold(conn, viewer, dept_id, body.second_approval_minor, _rid(request))
    return {"department_id": dept_id, "second_approval_minor": value}


# ---------------------------------------------------------------- one request

@router.get("/tickets/rfqs/{rfq_id}")
def get_rfq(rfq_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro),
            conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return _detail(conn, Viewer(conn, principal), rfq_id)


class EditBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    title: str | None = Field(default=None, max_length=2000)
    description: str | None = Field(default=None, max_length=20000)
    place_text: str | None = Field(default=None, max_length=2000)
    location_id: str | None = Field(default=None, max_length=64, pattern=ID)  # CR-ORG-LOCATIONS (draft only); null clears
    location_nav: bool | None = None
    floor_id: str | None = Field(default=None, max_length=64, pattern=ID)
    due_at: str | None = Field(default=None, max_length=40)
    work_from: str | None = Field(default=None, max_length=40)
    work_to: str | None = Field(default=None, max_length=40)
    allowed_line_kinds: list[Literal["labor", "parts", "travel", "other"]] | None = Field(default=None, max_length=4)
    internal_owner_user_id: str | None = Field(default=None, max_length=64)


@router.patch("/tickets/rfqs/{rfq_id}")
def patch_rfq(body: EditBody, request: Request, rfq_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
              conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    patch = body.model_dump(exclude={"revision"}, exclude_unset=True)
    changed = rfq.edit(conn, viewer, seen, patch, body.revision, _rid(request))
    out = _detail(conn, viewer, rfq_id)
    out["changed"] = changed
    return out


@router.delete("/tickets/rfqs/{rfq_id}")
def delete_rfq(request: Request, rfq_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    doomed: list[str] = []
    rows = rfq.purge(conn, viewer, seen, _rid(request), files_out=doomed)
    if doomed:  # RFQATT: the files go only after the rows are gone for good (the orphan sweep retries a failure)
        commit_now(conn, keep_reading=False)
        _remove_files(request, doomed)
    return {"deleted": True, "rows": rows}


class RevisionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)


class AddVendorBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contact_id: str = Field(min_length=1, max_length=64, pattern=ID)
    revision: int = Field(ge=1)
    channel: Channel | None = None
    require_code: bool | None = None


class VendorOptionsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    channel: Channel | None = None
    require_code: bool | None = None


@router.post("/tickets/rfqs/{rfq_id}/vendors", status_code=201)
def post_vendor(body: AddVendorBody, request: Request, rfq_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    vid = rfq.add_vendor_route(conn, viewer, seen, body.contact_id, body.revision, _rid(request), channel=body.channel,
                               require_code=body.require_code)
    out = _detail(conn, viewer, rfq_id)
    out["vendor_id"] = vid
    return out


@router.post("/tickets/rfqs/{rfq_id}/vendors/{vendor_id}/remove")
def post_vendor_remove(body: RevisionBody, request: Request, rfq_id: str = Path(..., pattern=ID), vendor_id: str = Path(..., pattern=ID),
                       principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    rfq.remove_vendor(conn, viewer, seen, vendor_id, body.revision, _rid(request))
    return _detail(conn, viewer, rfq_id)


@router.post("/tickets/rfqs/{rfq_id}/vendors/{vendor_id}/options")
def post_vendor_options(body: VendorOptionsBody, request: Request, rfq_id: str = Path(..., pattern=ID), vendor_id: str = Path(..., pattern=ID),
                        principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """TKRFQVP (contract 15.6): the per-vendor verification code / invitation channel after creation."""
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    changed = rfq.vendor_options(conn, viewer, seen, vendor_id, body.revision, require_code=body.require_code, channel=body.channel,
                                 rid=_rid(request))
    out = _detail(conn, viewer, rfq_id)
    out["changed"] = changed
    return out


@router.post("/tickets/rfqs/{rfq_id}/vendors/{vendor_id}/link/revoke")
def post_link_revoke(request: Request, rfq_id: str = Path(..., pattern=ID), vendor_id: str = Path(..., pattern=ID),
                     principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    revoked = rfq.revoke_link(conn, viewer, seen, vendor_id, _rid(request))
    out = _detail(conn, viewer, rfq_id)
    out["revoked"] = revoked
    return out


class SendBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    channel: Literal["auto", "manual"] = "auto"
    location_nav: bool | None = None  # CR-ORG-LOCATIONS: the preview dialog's "add the navigation link" switch (default off)
    client_request_id: str = Field(min_length=8, max_length=64, pattern=model.CLIENT_REQUEST_RE.pattern)


@router.post("/tickets/rfqs/{rfq_id}/send")
def post_send(body: SendBody, request: Request, rfq_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
              conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    scope = f"rfqsend:{rfq_id}"
    prior = store.request_get(conn, scope, body.client_request_id)
    if prior is not None:  # a repeated press: the same answer, no second invitation
        out = _detail(conn, viewer, rfq_id)
        import json

        out["sent"] = json.loads(prior["response_json"])
        return out
    sent = rfq.send(conn, viewer, seen, body.revision, body.channel, _rid(request), location_nav=body.location_nav)
    store.request_put(conn, scope, body.client_request_id, "rfq.send", 200, sent)
    out = _detail(conn, viewer, rfq_id)
    out["sent"] = sent
    return out


class RemindBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vendor_ids: list[str] | None = Field(default=None, max_length=60)


@router.post("/tickets/rfqs/{rfq_id}/remind")
def post_remind(body: RemindBody, request: Request, rfq_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    res = rfq.remind(conn, viewer, seen, body.vendor_ids, _rid(request))
    out = _detail(conn, viewer, rfq_id)
    out["reminded"] = res
    return out


class PaymentItem(BaseModel):
    """CR-RFQ-PAYMENT-SCHEDULE (contract 20.2): one instalment - amounts and dates only (never bank data)."""
    model_config = ConfigDict(extra="forbid")
    kind: Literal["advance", "progress", "final"]
    percent: str | None = Field(default=None, max_length=8)
    amount: str | None = Field(default=None, max_length=16)
    due: Literal["date", "completion", "after_completion"]
    date: str | None = Field(default=None, max_length=10)
    days: int | None = Field(default=None, ge=0, le=180)


class PaymentBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[PaymentItem] = Field(min_length=1, max_length=6)


class ArrivalWindow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    work_from: str = Field(max_length=40)
    work_to: str | None = Field(default=None, max_length=40)


class QuoteBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    payment: PaymentBody | None = None
    lines: list[QuoteLine] = Field(default_factory=list, max_length=30)
    currency: str | None = Field(default=None, max_length=3)
    amounts_include_vat: bool | None = None
    work_from: str | None = Field(default=None, max_length=40)
    work_to: str | None = Field(default=None, max_length=40)
    note: str | None = Field(default=None, max_length=5000)
    vendor_ref: str | None = Field(default=None, max_length=500)


@router.post("/tickets/rfqs/{rfq_id}/vendors/{vendor_id}/quotes", status_code=201)
def post_quote(body: QuoteBody, request: Request, rfq_id: str = Path(..., pattern=ID), vendor_id: str = Path(..., pattern=ID),
               principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    q = rfq.submit_quote(conn, viewer, seen, vendor_id, quote_payload(body, set()), _rid(request))
    out = _detail(conn, viewer, rfq_id)
    out["quote_id"] = q.get("id")
    return out


@router.post("/tickets/rfqs/{rfq_id}/vendors/{vendor_id}/quotes/{quote_id}/withdraw")
def post_quote_withdraw(body: RevisionBody, request: Request, rfq_id: str = Path(..., pattern=ID), vendor_id: str = Path(..., pattern=ID),
                        quote_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    rfq.withdraw_quote(conn, viewer, seen, vendor_id, quote_id, body.revision, _rid(request))
    return _detail(conn, viewer, rfq_id)


class DeclineBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str | None = Field(default=None, max_length=2000)


@router.post("/tickets/rfqs/{rfq_id}/vendors/{vendor_id}/decline")
def post_decline(body: DeclineBody, request: Request, rfq_id: str = Path(..., pattern=ID), vendor_id: str = Path(..., pattern=ID),
                 principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    rfq.decline(conn, viewer, seen, vendor_id, body.reason, _rid(request))
    return _detail(conn, viewer, rfq_id)


@router.get("/tickets/rfqs/{rfq_id}/vendors/{vendor_id}/messages")
def get_messages(rfq_id: str = Path(..., pattern=ID), vendor_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro),
                 conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    v = rfq.vendor_of(conn, seen, vendor_id)
    return {"items": [rfq.present_message(conn, m) for m in store_rfq.messages_of_vendor(conn, v["id"])]}


class SourceRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["award"]
    id: str = Field(min_length=1, max_length=64, pattern=ID)


class MessageBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(max_length=5000)
    notify: bool = True
    source: SourceRef | None = None


@router.post("/tickets/rfqs/{rfq_id}/vendors/{vendor_id}/messages", status_code=201)
def post_message(body: MessageBody, request: Request, rfq_id: str = Path(..., pattern=ID), vendor_id: str = Path(..., pattern=ID),
                 principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    return rfq.write_message(conn, viewer, seen, vendor_id, body.text, body.notify, body.source.model_dump() if body.source else None, _rid(request))


# ---------------------------------------------------------------- RFQQUESTIONS: a vendor's question (contract section 21)

@router.post("/tickets/rfqs/{rfq_id}/vendors/{vendor_id}/messages/read")
def post_messages_read(request: Request, rfq_id: str = Path(..., pattern=ID), vendor_id: str = Path(..., pattern=ID),
                       principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """An RFQ manager opened the vendor's thread: his questions are no longer new (they stay pending until answered)."""
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    return {"read": rfq_questions.mark_read(conn, viewer, seen, vendor_id, _rid(request))}


class AnswerPlanBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(max_length=5000)
    scope: Literal["vendor", "all"] = "vendor"
    question_text: str | None = Field(default=None, max_length=5000)
    name_asker: bool = False
    notify: bool = True


class AnswerBody(AnswerPlanBody):
    client_request_id: str = Field(min_length=8, max_length=64, pattern=model.CLIENT_REQUEST_RE.pattern)


@router.post("/tickets/rfqs/{rfq_id}/questions/{message_id}/preview")
def post_answer_preview(body: AnswerPlanBody, request: Request, rfq_id: str = Path(..., pattern=ID), message_id: str = Path(..., pattern=ID),
                        principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The exact text each recipient would get and whether a notice would go - nothing is stored (a refusal of the role is audited)."""
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    p = rfq_questions.plan(conn, viewer, seen, message_id, body.model_dump(), _rid(request), action="ticket.rfq.answer_preview")
    return rfq_questions.present_plan(conn, p, body.notify)


@router.post("/tickets/rfqs/{rfq_id}/questions/{message_id}/answer", status_code=201)
def post_answer(body: AnswerBody, request: Request, rfq_id: str = Path(..., pattern=ID), message_id: str = Path(..., pattern=ID),
                principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The manager's explicit send of an answer: to the asking vendor only (default) or to every invited vendor (`scope: all`)."""
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    scope = f"rfqanswer:{rfq_id}"
    prior = store.request_get(conn, scope, body.client_request_id)
    if prior is not None:  # a repeated press: the first answer, nothing stored twice
        import json

        return {"rfq": _detail(conn, viewer, rfq_id), "answer": json.loads(prior["response_json"]), "replayed": True}
    res = rfq_questions.answer(conn, viewer, seen, message_id, body.model_dump(exclude={"client_request_id"}), _rid(request))
    store.request_put(conn, scope, body.client_request_id, "rfq.answer", 201, res)
    return {"rfq": _detail(conn, viewer, rfq_id), "answer": res, "replayed": False}


@router.post("/tickets/rfqs/{rfq_id}/questions/{message_id}/resolve")
def post_question_resolve(request: Request, rfq_id: str = Path(..., pattern=ID), message_id: str = Path(..., pattern=ID),
                          principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Handled without a reply (answered by phone): the question leaves the badges; nothing is sent."""
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    rfq_questions.resolve(conn, viewer, seen, message_id, _rid(request))
    return _detail(conn, viewer, rfq_id)


@router.get("/tickets/rfqs/{rfq_id}/comparison")
def get_comparison(request: Request, rfq_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro),
                   conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    if not rfq.sees_amounts(viewer, seen):
        raise rfq.refuse(conn, viewer, "ticket.rfq.comparison", seen.row, "costs_permission_missing", _rid(request), permission=rfq.COSTS_VIEW)
    return rfq.comparison(conn, viewer, seen)


class AwardBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    quote_id: str = Field(min_length=1, max_length=64, pattern=ID)
    revision: int = Field(ge=1)
    line_indexes: list[int] | None = Field(default=None, max_length=30)
    kinds: list[Literal["labor", "parts", "travel", "other"]] | None = Field(default=None, max_length=4)
    finalize: bool = True
    payment: PaymentBody | None = None  # CR-RFQ-PAYMENT-SCHEDULE: the manager's plan (contract 20.3)
    # review F1: the explicit choice when no plan is sent - "vendor" = the proposal as is, "default" = one final instalment; with a
    # vendor proposal one of payment / payment_source is REQUIRED (422 `payment` `required`)
    payment_source: Literal["vendor", "default"] | None = None
    arrival: ArrivalWindow | None = None  # the planned arrival window (omitted = the quote's / request's window)


def _award_answer(conn: sqlite3.Connection, viewer: Viewer, rfq_id: str, res: dict[str, Any]) -> dict[str, Any]:
    seen = rfq.require_visible(viewer, rfq_id)
    a = res["award"]
    item = {**rfq.present_award(conn, a, rfq.sees_amounts(viewer, seen)),
            "terms": rfq_terms.present(conn, a, amounts=rfq.sees_amounts(viewer, seen), manager=rfq.is_manager(viewer, seen),
                                       costs=rfq.can_decide(viewer, seen), rfq_state=seen.row["state"])}
    return {"rfq": rfq.detail(conn, viewer, seen), "award": item,
            "message_draft": rfq.award_draft(conn, seen.row, a) if a["state"] == "approved" else None}


@router.post("/tickets/rfqs/{rfq_id}/awards", status_code=201)
def post_award(body: AwardBody, request: Request, rfq_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    res = rfq.award(conn, viewer, seen, quote_id=body.quote_id, revision=body.revision, line_indexes=body.line_indexes, kinds=body.kinds,
                    finalize=body.finalize, rid=_rid(request), payment=body.payment.model_dump() if body.payment else None,
                    arrival=body.arrival.model_dump() if body.arrival else None, payment_source=body.payment_source)
    return _award_answer(conn, viewer, rfq_id, res)


@router.post("/tickets/rfqs/{rfq_id}/awards/{award_id}/confirm")
def post_award_confirm(body: RevisionBody, request: Request, rfq_id: str = Path(..., pattern=ID), award_id: str = Path(..., pattern=ID),
                       principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    res = rfq.confirm(conn, viewer, seen, award_id, body.revision, _rid(request))
    return _award_answer(conn, viewer, rfq_id, res)


class AwardDeclineBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    reason: str = Field(max_length=5000)


@router.post("/tickets/rfqs/{rfq_id}/awards/{award_id}/decline")
def post_award_decline(body: AwardDeclineBody, request: Request, rfq_id: str = Path(..., pattern=ID), award_id: str = Path(..., pattern=ID),
                       principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    rfq.decline_award(conn, viewer, seen, award_id, body.revision, body.reason, _rid(request))
    return _detail(conn, viewer, rfq_id)


class ArrivalDecisionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["accept", "reject"]
    revision: int = Field(ge=1)


@router.post("/tickets/rfqs/{rfq_id}/awards/{award_id}/arrival")
def post_arrival_decision(body: ArrivalDecisionBody, request: Request, rfq_id: str = Path(..., pattern=ID), award_id: str = Path(..., pattern=ID),
                          principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CR-RFQ-PAYMENT-SCHEDULE (contract 20.6): an RFQ manager accepts or rejects the arrival date the vendor proposed. Sends nothing."""
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    rfq_terms.decide(conn, viewer, seen, award_id, body.action, body.revision, _rid(request))
    return _detail(conn, viewer, rfq_id)


class InstalmentDateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: str = Field(min_length=1, max_length=10)
    reason: str | None = Field(default=None, max_length=rfq_terms.REASON_MAX)
    revision: int = Field(ge=1)
    notify_vendor: bool = False  # owner decision 2026-10-17: the manager chooses; default off
    message: str | None = Field(default=None, max_length=5000)  # the edited preview (terms.notice.*) - the vendor's thread only
    resend_order: bool = False  # 20.15: re-send the already-sent work order (default off)


@router.post("/tickets/rfqs/{rfq_id}/awards/{award_id}/instalments/{index}/date")
def post_instalment_date(body: InstalmentDateBody, request: Request, rfq_id: str = Path(..., pattern=ID), award_id: str = Path(..., pattern=ID),
                         index: int = Path(..., ge=0, le=5), principal: Principal = Depends(current_principal),
                         conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """RFQPAY2 (contract 20.13): tickets.costs + view moves a dated instalment's planned day after the award (audited, reason optional).
    The vendor's page shows the new day with a "changed" marker; he is told only with `notify_vendor` (the F7 notice path)."""
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    rfq_terms.reschedule(conn, viewer, seen, award_id, index, body.date, body.reason, body.revision, _rid(request),
                         notify=body.notify_vendor, message=body.message, resend_order=body.resend_order)
    return _detail(conn, viewer, rfq_id)


class ArrivalDateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    work_from: str = Field(min_length=1, max_length=40)
    work_to: str | None = Field(default=None, max_length=40)
    reason: str | None = Field(default=None, max_length=rfq_terms.REASON_MAX)
    revision: int = Field(ge=1)
    notify_vendor: bool = False
    message: str | None = Field(default=None, max_length=5000)
    resend_order: bool = False  # 20.15


@router.post("/tickets/rfqs/{rfq_id}/awards/{award_id}/arrival/date")
def post_arrival_date(body: ArrivalDateBody, request: Request, rfq_id: str = Path(..., pattern=ID), award_id: str = Path(..., pattern=ID),
                      principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """RFQPAY2 (contract 20.14, owner decision 2026-10-17): tickets.costs + view moves the planned ARRIVAL window after the award
    (audited, reason optional, not after the work was marked done); the vendor is told only with `notify_vendor`."""
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    rfq_terms.reschedule_arrival(conn, viewer, seen, award_id, body.work_from, body.work_to, body.reason, body.revision, _rid(request),
                                 notify=body.notify_vendor, message=body.message, resend_order=body.resend_order)
    return _detail(conn, viewer, rfq_id)


class InstalmentDemandBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["create", "paid", "cancel"]


@router.post("/tickets/rfqs/{rfq_id}/awards/{award_id}/instalments/{index}/demand")
def post_instalment_demand(body: InstalmentDemandBody, request: Request, rfq_id: str = Path(..., pattern=ID),
                           award_id: str = Path(..., pattern=ID), index: int = Path(..., ge=0, le=5),
                           principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """RFQPAY2 (contract 20.11): tickets.costs + view - the instalment's payment demand: create (idempotent), mark paid, cancel. Never
    automatic, never a payment, nothing is sent."""
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    res = rfq_terms.instalment_demand(conn, viewer, seen, award_id, index, body.action, _rid(request))
    return {"rfq": _detail(conn, viewer, rfq_id), **res}


# ---------------------------------------------------------------- the work order (TKRFQ4, stage C4 - contract section 18)

class OrderBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    work_from: str | None = Field(default=None, max_length=40)
    work_to: str | None = Field(default=None, max_length=40)
    documents: str | None = Field(default=None, max_length=5000)
    request_key: str = Field(min_length=8, max_length=64, pattern=model.CLIENT_REQUEST_RE.pattern)


def _order_answer(conn: sqlite3.Connection, viewer: Viewer, rfq_id: str, award_id: str, extra: dict[str, Any]) -> dict[str, Any]:
    d = _detail(conn, viewer, rfq_id)
    item = next((a for a in d["awards"] if a["id"] == award_id), None)
    return {"rfq": d, "award": item, **extra}


@router.post("/tickets/rfqs/{rfq_id}/awards/{award_id}/order", status_code=201)
def post_order(body: OrderBody, request: Request, rfq_id: str = Path(..., pattern=ID), award_id: str = Path(..., pattern=ID),
               principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Opens the service request of one awarded vendor (the baseline, the scope, the dates, the documents). Sends NOTHING."""
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    res = rfq_orders.create_order(conn, viewer, seen, award_id, body.model_dump(exclude={"request_key"}), body.request_key, _rid(request))
    ticket = {"id": res["ticket_id"], "number": res["number"]}
    return _order_answer(conn, viewer, rfq_id, award_id, {"ticket": ticket, "replayed": res["replayed"]})


@router.get("/tickets/rfqs/{rfq_id}/awards/{award_id}/order/preview")
def get_order_preview(request: Request, rfq_id: str = Path(..., pattern=ID), award_id: str = Path(..., pattern=ID),
                      work_from: str | None = Query(None, max_length=40), work_to: str | None = Query(None, max_length=40),
                      principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The exact text of the order message, its channel and every refusal - no side effect (a refusal of the role is audited)."""
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    return rfq_orders.preview(conn, viewer, seen, award_id, _rid(request), work_from=work_from, work_to=work_to)  # RFQPAY2 20.15: a window about to be saved


@router.post("/tickets/rfqs/{rfq_id}/awards/{award_id}/order/send")
def post_order_send(request: Request, rfq_id: str = Path(..., pattern=ID), award_id: str = Path(..., pattern=ID),
                    principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The manager's explicit click: ONE `rfq_order` message to the awarded vendor (a repeat answers the first send)."""
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    res = rfq_orders.send_order(conn, viewer, seen, award_id, _rid(request))
    return _order_answer(conn, viewer, rfq_id, award_id, {"notified": res})


class CancelBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    reason: str | None = Field(default=None, max_length=5000)
    notify: bool = True


@router.post("/tickets/rfqs/{rfq_id}/cancel")
def post_cancel(body: CancelBody, request: Request, rfq_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    res = rfq.cancel(conn, viewer, seen, body.revision, body.reason, body.notify, _rid(request))
    out = _detail(conn, viewer, rfq_id)
    out["cancelled"] = res
    return out


@router.post("/tickets/rfqs/{rfq_id}/close")
def post_close(body: RevisionBody, request: Request, rfq_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    res = rfq.close(conn, viewer, seen, body.revision, _rid(request))
    out = _detail(conn, viewer, rfq_id)
    out["closed"] = res
    return out


# ---------------------------------------------------------------- RFQATT: files and pictures on a request (contract section 19)

def _root(request: Request):
    return attachments.root(settings_of(request).data_dir)


def _bool_form(conn: sqlite3.Connection, value: str | None, default: bool) -> bool:
    if value is None or value == "":
        return default
    if value in ("true", "1", "on"):
        return True
    if value in ("false", "0", "off"):
        return False
    raise rfq.invalid(conn, "visible_vendors", "type")


@router.post("/tickets/rfqs/{rfq_id}/attachments", status_code=201)
def post_attachment(request: Request, rfq_id: str = Path(..., pattern=ID), file: UploadFile = File(...),
                    caption: str | None = Form(None, max_length=2000), visible_vendors: str | None = Form(None, max_length=8),
                    principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """One file: the role, the state and the quota BEFORE the body is decoded (an audited 403, 409, 413); the checks and the stored
    copy outside the write lock (rfq_files.store); everything re-checked in the write transaction before the row (rfq_attach.record).
    Answers the detail plus `attachment` (the new row)."""
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    seen = rfq.require_visible(viewer, rfq_id)
    data = file.file.read(rfq_files.DOCUMENT_MAX_BYTES + 1)
    name = file.filename or ""
    rfq_attach.check_add(conn, viewer, seen, len(data), rid)
    visible = _bool_form(conn, visible_vendors, True)  # review F9: the role / state / quota refusal comes first, as on every write
    allow_office = rfq_files.office_allowed(conn)  # rfq.attachments.allow_office (OFF by default): 422 office_disabled otherwise
    data_dir = settings_of(request).data_dir
    root = _root(request)
    try:
        attachments.check_capacity(data_dir, len(data))
    except attachments.Refused as exc:
        raise ApiError(exc.status, exc.code, exc.message, details=dict(exc.details)) from None
    try:
        with unlocked(conn):  # the decode / the scan never hold the database write lock
            stored = rfq_files.store(root, seen.row["id"], data, allow_office=allow_office)
    except IntakeError as exc:
        audit(conn, actor=principal, action="ticket.rfq.attachment_add", decision="denied", resource_type="ticket_rfq", resource_id=seen.row["id"],
              reason=exc.code, request_id=rid, details={"number": seen.row["number"]})
        raise rfq_attach.refused(conn, exc) from None
    except StorePathError:
        raise rfq_attach.not_found(conn) from None
    finally:
        del data
    try:
        seen = rfq.require_visible(viewer, rfq_id)  # the lock was released for the decode: read the request again
        aid = rfq_attach.record(conn, viewer, seen, stored, name=name, caption=caption, visible=visible, rid=rid)
    except BaseException:
        rfq_files.remove(root, stored.rel_path, stored.thumb_rel)
        raise
    attachments._account(data_dir, stored.stored_bytes)  # review F6: the storage cap's cached size knows the new file at once
    out = _detail(conn, viewer, rfq_id)
    out["attachment"] = next((a for a in out.get("attachments", []) if a["id"] == aid), None)
    return out


class AttachmentPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    caption: str | None = Field(default=None, max_length=2000)
    visible_vendors: bool | None = None


@router.patch("/tickets/rfqs/{rfq_id}/attachments/{attachment_id}")
def patch_attachment(body: AttachmentPatch, request: Request, rfq_id: str = Path(..., pattern=ID), attachment_id: str = Path(..., pattern=ID),
                     principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    given = body.model_dump(exclude_unset=True)
    changed = rfq_attach.update(conn, viewer, seen, attachment_id, caption=given.get("caption"), caption_given="caption" in given,
                                visible=given.get("visible_vendors"), rid=_rid(request))
    out = _detail(conn, viewer, rfq_id)
    out["changed"] = changed
    return out


@router.delete("/tickets/rfqs/{rfq_id}/attachments/{attachment_id}")
def delete_attachment(request: Request, rfq_id: str = Path(..., pattern=ID), attachment_id: str = Path(..., pattern=ID),
                      principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    doomed = rfq_attach.remove(conn, viewer, seen, attachment_id, _rid(request))
    out = _detail(conn, viewer, rfq_id)
    if doomed:
        commit_now(conn, keep_reading=False)  # the row is gone for good before the file is touched
        _remove_files(request, doomed)
    return out


def _remove_files(request: Request, paths: list[str]) -> None:
    """Delete stored files and credit the storage cap's cached size (review F6), as attachments.remove does."""
    data_dir = settings_of(request).data_dir
    root = attachments.root(data_dir)
    freed = rfq_files.size_of(root, *paths)
    rfq_files.remove(root, *paths)
    attachments._account(data_dir, -freed)


def _file_response(request: Request, a: dict[str, Any], number: int, thumb: bool, conn: sqlite3.Connection) -> FileResponse:
    path = rfq_attach.file_path(_root(request), a, thumb)
    if path is None:
        raise rfq_attach.not_found(conn)
    h = rfq_files.headers("image" if thumb else a["kind"], ref_number=number, file_id=a["id"], name=a["name"])
    media = h.pop("Content-Type")
    return FileResponse(path, media_type=media, headers=h)


@router.get("/tickets/rfqs/{rfq_id}/attachments/{attachment_id}")
def get_attachment(request: Request, rfq_id: str = Path(..., pattern=ID), attachment_id: str = Path(..., pattern=ID),
                   principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> FileResponse:
    seen = rfq.require_visible(Viewer(conn, principal), rfq_id)
    return _file_response(request, rfq_attach.for_manager(conn, seen, attachment_id), int(seen.row["number"]), False, conn)


@router.get("/tickets/rfqs/{rfq_id}/attachments/{attachment_id}/thumb")
def get_attachment_thumb(request: Request, rfq_id: str = Path(..., pattern=ID), attachment_id: str = Path(..., pattern=ID),
                         principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> FileResponse:
    seen = rfq.require_visible(Viewer(conn, principal), rfq_id)
    return _file_response(request, rfq_attach.for_manager(conn, seen, attachment_id), int(seen.row["number"]), True, conn)


def _ticket_file(request: Request, ticket_id: str, attachment_id: str, thumb: bool, principal: Principal, conn: sqlite3.Connection) -> FileResponse:
    seen = access.require_visible(Viewer(conn, principal), ticket_id)  # the ticket's own rule (the uniform 404)
    a = rfq_attach.for_ticket(conn, seen.row["id"], attachment_id)
    if a is None:
        raise rfq_attach.not_found(conn)
    q = store_rfq.rfq_quote_of_ticket(conn, seen.row["id"])
    v = store_rfq.vendor(conn, (q or {}).get("rfq_vendor_id")) or {}
    return _file_response(request, a, rfq.number_of(conn, v.get("rfq_id")) or 0, thumb, conn)


@router.get("/tickets/{ticket_id}/rfq-attachments/{attachment_id}")
def get_ticket_rfq_file(request: Request, ticket_id: str = Path(..., pattern=ID), attachment_id: str = Path(..., pattern=ID),
                        principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> FileResponse:
    return _ticket_file(request, ticket_id, attachment_id, False, principal, conn)


@router.get("/tickets/{ticket_id}/rfq-attachments/{attachment_id}/thumb")
def get_ticket_rfq_thumb(request: Request, ticket_id: str = Path(..., pattern=ID), attachment_id: str = Path(..., pattern=ID),
                         principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> FileResponse:
    return _ticket_file(request, ticket_id, attachment_id, True, principal, conn)
