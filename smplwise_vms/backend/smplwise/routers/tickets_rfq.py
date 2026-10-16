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
    POST   /tickets/rfqs/{id}/vendors/{rv}/link/revoke                 RFQ manager
    POST   /tickets/rfqs/{id}/vendors/{rv}/quotes                      on behalf (tickets.costs + view)
    POST   /tickets/rfqs/{id}/vendors/{rv}/quotes/{quote_id}/withdraw  on behalf
    POST   /tickets/rfqs/{id}/vendors/{rv}/decline                     on behalf
    GET    /tickets/rfqs/{id}/vendors/{rv}/messages                    visible
    POST   /tickets/rfqs/{id}/vendors/{rv}/messages                    RFQ manager (templated notice only; the text stays in the thread)
    POST   /tickets/rfqs/{id}/send | remind | cancel | close            RFQ manager
    GET    /tickets/rfqs/{id}/comparison                               + tickets.costs.view
    POST   /tickets/rfqs/{id}/awards                                   tickets.costs + view (+ message_draft; nothing is sent)
    POST   /tickets/rfqs/{id}/awards/{award_id}/confirm | decline      the second approver

Order of every route: signed in -> the module switch (router dependency) -> the request's visibility (the uniform 404) -> the role /
permission (an audited 403). Every write is one transaction with its RFQ timeline row and an audit row (ids, states, totals). Registered
BEFORE /tickets/{ticket_id}."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import Principal
from ..services.tickets import access, model, rfq, store, store_rfq
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


class VendorRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contact_id: str = Field(min_length=1, max_length=64, pattern=ID)


class CreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    department_id: str = Field(min_length=1, max_length=64, pattern=ID)
    title: str = Field(max_length=2000)
    description: str | None = Field(default=None, max_length=20000)
    place_text: str | None = Field(default=None, max_length=2000)
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
    payload["vendors"] = [v.model_dump() for v in body.vendors]
    rfq_id = rfq.create(conn, viewer, payload, _rid(request))
    store.request_put(conn, scope, body.client_request_id, "rfq.create", 201, {"id": rfq_id})
    return _detail(conn, viewer, rfq_id)


class ThresholdBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    second_approval_minor: int | None = Field(default=None, ge=0, le=rfq.THRESHOLD_MAX)


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
    return {"deleted": True, "rows": rfq.purge(conn, viewer, seen, _rid(request))}


class RevisionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)


class AddVendorBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contact_id: str = Field(min_length=1, max_length=64, pattern=ID)
    revision: int = Field(ge=1)


@router.post("/tickets/rfqs/{rfq_id}/vendors", status_code=201)
def post_vendor(body: AddVendorBody, request: Request, rfq_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    vid = rfq.add_vendor_route(conn, viewer, seen, body.contact_id, body.revision, _rid(request))
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
    sent = rfq.send(conn, viewer, seen, body.revision, body.channel, _rid(request))
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


class QuoteBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
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


def _award_answer(conn: sqlite3.Connection, viewer: Viewer, rfq_id: str, res: dict[str, Any]) -> dict[str, Any]:
    seen = rfq.require_visible(viewer, rfq_id)
    a = res["award"]
    return {"rfq": rfq.detail(conn, viewer, seen), "award": rfq.present_award(conn, a, rfq.sees_amounts(viewer, seen)),
            "message_draft": rfq.award_draft(conn, seen.row, a) if a["state"] == "approved" else None}


@router.post("/tickets/rfqs/{rfq_id}/awards", status_code=201)
def post_award(body: AwardBody, request: Request, rfq_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = rfq.require_visible(viewer, rfq_id)
    res = rfq.award(conn, viewer, seen, quote_id=body.quote_id, revision=body.revision, line_indexes=body.line_indexes, kinds=body.kinds,
                    finalize=body.finalize, rid=_rid(request))
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
