"""TK257: the vendor's quote on the public handler page - the part of the permanent "quote / payment demand" card that exists BEFORE the work.

    GET  /t/api/quote   the vendor's own quote state, its latest quote, the line kinds it may use (work + parts unless the request or the
                        department allows travel / other), the form settings
    POST /t/api/quote   {lines[], amounts_include_vat?, notes?, client_request_id} -> the server-computed quote

Wired like public_claims: the token through `link_context` (the POST is a `write`, so the read-only grace refuses it and a code-protected
link needs its code session), bodies through `read_json()` into a strict model, `client_request_id` stored in the effect's own
transaction. Everything is scoped to the link's assignment: a vendor never sees another vendor's quote. NOTHING here sends a message."""
from __future__ import annotations

import datetime as dt
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from ...db import Database
from . import costs, quotes, store, store_links
from .handler_actions import claim as claim_request, _finish as finish_request
from .public_app import Idempotency, idempotency_scope, LinkContext, PublicError, link_context, parse_client_request_id, read_json, spend_budget
from .public_store import audit_link

UTC = dt.timezone.utc
QUOTE_ROUTE = "/t/api/quote"


def _when(t: float) -> dt.datetime:
    return dt.datetime.fromtimestamp(float(t), UTC).replace(microsecond=0)


def _error(exc: costs.CostRefused) -> PublicError:
    if exc.status == 422:
        return PublicError(422, "invalid", fields=[{"field": exc.field or "body", "code": exc.code}])
    return PublicError(exc.status, exc.code)


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class LineIn(_Strict):
    kind: Literal["labor", "parts", "travel", "other"]
    description: str | None = Field(default=None, max_length=400)
    hours: str | None = Field(default=None, max_length=12)
    rate: str | None = Field(default=None, max_length=16)
    quantity: str | None = Field(default=None, max_length=16)
    unit_price: str | None = Field(default=None, max_length=16)
    amount: str | None = Field(default=None, max_length=16)


class QuoteIn(_Strict):
    lines: list[LineIn] = Field(default_factory=list, max_length=30)
    currency: str | None = Field(default=None, max_length=3)
    amounts_include_vat: bool | None = None
    notes: str | None = Field(default=None, max_length=4000)
    client_request_id: str = Field(max_length=64)


def build_router(db: Database, *, clock: Callable[[], float] | None = None) -> APIRouter:
    r = APIRouter()
    idem = Idempotency(None)

    def now() -> dt.datetime:
        return _when(clock() if clock is not None else dt.datetime.now(UTC).timestamp())

    @r.get(QUOTE_ROUTE)
    async def get_quote(ctx: LinkContext = Depends(link_context())) -> JSONResponse:
        if not ctx.code_ok:
            raise PublicError(403, "code_required")

        def read() -> dict[str, Any]:
            with db.connection(mode="read", label="tickets.public.quote") as conn:
                return quotes.public_quote(conn, ctx.link.assignment_id, ctx.link.ticket_id)

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
                asg = store.assignment(conn, link.assignment_id)
                ticket = store_links.ticket_of_link(conn, link.link_id)
                if asg is None or ticket is None:
                    raise PublicError(409, "quote_closed")
                try:
                    row = quotes.submit(conn, asg, dict(ticket), payload, at=when)
                except costs.CostRefused as exc:
                    raise _error(exc) from None
                audit_link(conn, link, "ticket.quote.submit", quote_id=row["id"], seq=row["seq"], total_minor=row["total_minor"], currency=row["currency"])
                answer = {"ok": True, "quote": quotes.present(row)}
                return (*finish_request(conn, link, crid, 201, answer), True)

        async def work() -> tuple[int, dict[str, Any]]:
            status, answer, new = await run_in_threadpool(tx)
            if new:
                spend_budget(request)
            return status, answer

        return await idem.run(idempotency_scope(ctx.link), crid, QUOTE_ROUTE, work)

    return r
