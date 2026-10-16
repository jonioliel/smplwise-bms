"""TKDETAILBE (docs/tickets/DETAIL_BACKEND_CONTRACT.md section 4.5): the vendor's quote BEFORE the work on the public handler page.

    GET  /t/api/quote   the link's own quotes (state, lines, totals, the fix / reject reason, the approved part) and the form
    POST /t/api/quote   {lines[], currency?, amounts_include_vat?, work_from?, work_to?, note? (or notes?), vendor_ref?, client_request_id}

The answers keep the 2.5.7 (TK257) public contract the built vendor card reads (state none | submitted | approved | rejected,
enabled, writable, allowed_kinds, quote with seq / notes / reason, form; errors 409 quote_closed and 422 kind_not_allowed) and add this
design's fields (state_detail, mode, quotes, work window, the approved part).

Wiring rules (code review section 3, as public_routes / public_claims): the token through `link_context()` only (writes:
`write=True` - the read-only grace answers 409 and a code-protected link without a code session 403); bodies through `read_json()`
into strict models (client totals are not even accepted - `extra = forbid`); `client_request_id` mandatory and stored in the
effect's own transaction; the write budget is spent once a NEW quote is stored. No claim mode: a quote needs a live link and a
request in handling. The vendor never sees internal notes, other vendors' quotes or who decided."""
from __future__ import annotations

import datetime as dt
from typing import Any, Callable

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from ...db import Database
from . import costs, quotes, store, store_costs, store_links
from .handler_actions import _finish as finish_request, claim as claim_request
from .public_app import Idempotency, LinkContext, PublicError, idempotency_scope, link_context, parse_client_request_id, read_json, spend_budget
from .public_claims import LineIn, _error
from .public_store import audit_link

UTC = dt.timezone.utc
QUOTE_ROUTE = "/t/api/quote"


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class QuoteIn(_Strict):
    lines: list[LineIn] = Field(default_factory=list, max_length=30)
    currency: str | None = Field(default=None, max_length=3)
    amounts_include_vat: bool | None = None
    work_from: str | None = Field(default=None, max_length=40)
    work_to: str | None = Field(default=None, max_length=40)
    note: str | None = Field(default=None, max_length=4000)
    notes: str | None = Field(default=None, max_length=4000)  # the 2.5.7 (TK257) name of `note` - the built vendor card sends it
    vendor_ref: str | None = Field(default=None, max_length=200)
    client_request_id: str = Field(max_length=64)


# the 2.5.7 (TK257) public codes the built vendor card reacts to: every "no quote now" is `quote_closed` (the precise reason rides
# along as `reason`), a line kind the request does not allow is `kind_not_allowed`
_CLOSED = frozenset({"quote_not_open", "quote_off", "quote_already_approved"})


def _public_error(exc: costs.CostRefused) -> PublicError:
    if exc.status == 409 and exc.code in _CLOSED:
        return PublicError(409, "quote_closed", reason=exc.code)
    if exc.status == 422:
        code = "kind_not_allowed" if exc.code == "line_kind_not_allowed" else exc.code
        return PublicError(422, "invalid", fields=[{"field": exc.field or "body", "code": code}])
    return _error(exc)


def build_router(db: Database, *, clock: Callable[[], float] | None = None) -> APIRouter:
    r = APIRouter()
    idem = Idempotency(None)

    def now() -> dt.datetime:
        t = clock() if clock is not None else dt.datetime.now(UTC).timestamp()
        return dt.datetime.fromtimestamp(float(t), UTC).replace(microsecond=0)

    @r.get(QUOTE_ROUTE)
    async def get_quote(ctx: LinkContext = Depends(link_context())) -> JSONResponse:
        if not ctx.code_ok:
            raise PublicError(403, "code_required")

        def read() -> dict[str, Any]:
            with db.connection(mode="read", label="tickets.public.quote") as conn:
                out = quotes.public_quotes(conn, ctx.link.assignment_id)
            if ctx.read_only:
                out["writable"] = False
            return out

        return JSONResponse(await run_in_threadpool(read))

    @r.post(QUOTE_ROUTE)
    async def post_quote(request: Request, ctx: LinkContext = Depends(link_context(write=True))) -> JSONResponse:
        body: QuoteIn = await read_json(request, QuoteIn)
        crid = parse_client_request_id(body.client_request_id)
        payload = body.model_dump(exclude={"client_request_id"}, exclude_none=True)
        payload["lines"] = [{k: v for k, v in ln.items() if v is not None} for ln in payload.get("lines", [])]

        def tx() -> tuple[int, dict[str, Any], bool]:
            when = now()
            with db.connection(label="tickets.public.quote") as conn:
                link = ctx.link
                replay = claim_request(conn, link, crid, QUOTE_ROUTE, when)
                if replay is not None:
                    return replay[0], replay[1], False
                ticket = store_costs.ticket_row(conn, link.ticket_id)
                asg = store.assignment(conn, link.assignment_id)
                if ticket is None or asg is None:
                    raise PublicError(409, "quote_closed")
                contact = store_links.contact(conn, link.contact_id) or {}
                try:
                    q = quotes.submit(conn, ticket, asg, payload, by_kind="contact", by_id=link.contact_id, at=when,
                                      actor_name=contact.get("display_name") or "")
                except costs.CostRefused as exc:
                    raise _public_error(exc) from None
                audit_link(conn, link, "ticket.quote.submit", quote_id=q["id"], version=q["version"], total_minor=q["total_minor"],
                           currency=q["currency"])
                answer = {"ok": True, "quote": quotes.present_public(q)}
                return (*finish_request(conn, link, crid, 201, answer), True)

        async def work() -> tuple[int, dict[str, Any]]:
            status, answer, new = await run_in_threadpool(tx)
            if new:
                spend_budget(request)
            return status, answer

        return await idem.run(idempotency_scope(ctx.link), crid, QUOTE_ROUTE, work)

    return r
