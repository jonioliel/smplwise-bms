"""CR-038 slice 9, spec 11A.2 / 11A.5 / 11A.6 / 11A.12: the vendor's cost claim on the public handler page.

    GET  /t/api/claim        the claim of the link's assignment (status, the vendor's own revisions, the form settings)
    POST /t/api/claim/file   (public_app.claim_file) one photographed page or PDF -> a pending file id
    POST /t/api/claim        {lines[], currency, amounts_include_vat, vendor_ref?, notes?, no_charge?, documents: [{file_ids}],
                              client_request_id} -> the server-computed revision

Wiring rules (code review section 3, as public_routes): the token through `link_context(allow_claim=True)` only - CLAIM MODE lets a
link whose page no longer serves (closed past its grace, expired, a cannot-handle return) reach these routes and nothing else
until `claim_until` (`claim_window`); the code session applies exactly as on the page (403 `code_required`); bodies through
`read_json()` into strict models; `client_request_id` mandatory and stored in the effect's own transaction; the write budget is
spent once a NEW revision is stored. The vendor never sees internal notes, other assignments' claims, other vendors' costs or who
decided; amounts are the server's (client totals are not even accepted - `extra = forbid`)."""
from __future__ import annotations

import datetime as dt
from typing import Any, Callable, Literal, Mapping

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from ...db import Database
from . import cost_files, costs, store_costs, store_links
from .handler_actions import claim as claim_request, _finish as finish_request
from .public_app import ClaimFileSink, Idempotency, idempotency_scope, LinkContext, PublicError, link_context, parse_client_request_id, read_json, spend_budget
from .public_ports import LinkRecord
from .public_store import audit_link
from .text_hygiene import clean_text

UTC = dt.timezone.utc
CLAIM_ROUTE = "/t/api/claim"
FILE_ROUTE = "/t/api/claim/file"


def _when(t: float) -> dt.datetime:
    return dt.datetime.fromtimestamp(float(t), UTC).replace(microsecond=0)


def _error(exc: costs.CostRefused) -> PublicError:
    extra: dict[str, Any] = {}
    if exc.status == 422:
        extra["fields"] = [{"field": exc.field or "body", "code": exc.code}]
        return PublicError(422, "invalid", **extra)
    return PublicError(exc.status, exc.code)


# ---------------------------------------------------------------- claim mode (public_app.PublicDeps.claim_window)

def claim_window(db: Database) -> Callable[[LinkRecord, float], float | None]:
    def ask(link: LinkRecord, now: float) -> float | None:
        with db.connection(mode="read", label="tickets.public.claim_window") as conn:
            until = costs.claim_mode_ok(conn, link.link_id, link.generation, _when(now))
        return until.timestamp() if until else None

    return ask


# ---------------------------------------------------------------- files (public_app.ClaimFileSink)

class SqlClaimFileSink(ClaimFileSink):
    def __init__(self, db: Database, *, clock: Callable[[], float] | None = None) -> None:
        self.db = db
        self._clock = clock or (lambda: dt.datetime.now(UTC).timestamp())

    def _open_claim(self, conn, link: LinkRecord, now: dt.datetime) -> dict[str, Any]:
        claim = store_costs.claim_for_assignment(conn, link.assignment_id)
        if claim is None:
            raise PublicError(409, "claim_not_open")
        if claim["status"] in costs.SETTLED:
            raise PublicError(409, "claim_closed")
        if not costs.window_open(claim, now):
            raise PublicError(409, "claim_window_closed")
        return claim

    def check_open(self, link: LinkRecord) -> None:
        with self.db.connection(mode="read", label="tickets.public.claim") as conn:
            self._open_claim(conn, link, _when(self._clock()))

    def check_quota(self, link: LinkRecord) -> None:
        since = costs.iso(_when(self._clock()) - costs.PENDING_TTL)
        with self.db.connection(mode="read", label="tickets.public.claim") as conn:
            n, size = store_costs.pending_usage_for_link(conn, link.link_id, since)
        cost_files.check_pending_quota(n, size)  # IntakeError 409 `file_limit` (the public app's own handler answers it)

    def record(self, link: LinkRecord, stored: Any, crid: str, document_key: str | None, page_no: int | None, name: str) -> Mapping[str, Any]:
        now = _when(self._clock())
        label = clean_text(name or "")[:80]
        with self.db.connection(label="tickets.public.claim") as conn:
            claim = self._open_claim(conn, link, now)
            prior = store_links.request_row(conn, idempotency_scope(link), crid)
            if prior is not None:
                raise PublicError(409, "request_id_reused" if prior["route"] != FILE_ROUTE else "request_in_progress", retry_after_s=2)
            since = costs.iso(now - costs.PENDING_TTL)
            if store_costs.hash_in_claim_or_pending(conn, stored.sha256, claim_id=claim["id"], link_id=link.link_id, ticket_id=link.ticket_id,
                                                    user_id=None, since=since):
                raise PublicError(409, "duplicate_file")
            store_links.claim_request(conn, idempotency_scope(link), crid, FILE_ROUTE, costs.iso(now))
            fid = store_costs.insert_file(conn, {
                "ticket_id": link.ticket_id, "link_id": link.link_id, "kind": stored.kind, "document_key": document_key, "page_no": page_no,
                "name": label, "path": stored.rel_path, "sha256": stored.sha256, "bytes": stored.bytes, "width": stored.width,
                "height": stored.height, "uploaded_by_kind": "contact", "uploaded_by": link.contact_id, "created_at": costs.iso(now),
            })
            audit_link(conn, link, "ticket.cost.file_upload", file_id=fid, kind=stored.kind, bytes=stored.bytes)
            answer = {"id": fid, "kind": stored.kind, "bytes": stored.bytes, "name": label, "document_key": document_key, "page_no": page_no}
            store_links.finish_request(conn, idempotency_scope(link), crid, 201, answer)
            return answer


# ---------------------------------------------------------------- the JSON routes

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


class DocumentIn(_Strict):
    file_ids: list[str] = Field(min_length=1, max_length=10)


class ClaimIn(_Strict):
    lines: list[LineIn] = Field(default_factory=list, max_length=30)
    currency: str | None = Field(default=None, max_length=3)
    amounts_include_vat: bool | None = None
    vendor_ref: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=4000)
    no_charge: bool = False
    documents: list[DocumentIn] = Field(default_factory=list, max_length=3)
    client_request_id: str = Field(max_length=64)


def build_router(db: Database, *, clock: Callable[[], float] | None = None) -> APIRouter:
    r = APIRouter()
    idem = Idempotency(None)

    def now() -> dt.datetime:
        return _when(clock() if clock is not None else dt.datetime.now(UTC).timestamp())

    @r.get(CLAIM_ROUTE)
    async def get_claim(ctx: LinkContext = Depends(link_context(allow_claim=True))) -> JSONResponse:
        if not ctx.code_ok:
            raise PublicError(403, "code_required")

        def read() -> dict[str, Any]:
            with db.connection(mode="read", label="tickets.public.claim") as conn:
                out = costs.public_claim(conn, ctx.link.assignment_id, now())
            out["claim_mode"] = ctx.claim_mode
            return out

        return JSONResponse(await run_in_threadpool(read))

    @r.post(CLAIM_ROUTE)
    async def post_claim(request: Request, ctx: LinkContext = Depends(link_context(allow_claim=True))) -> JSONResponse:
        body: ClaimIn = await read_json(request, ClaimIn)
        crid = parse_client_request_id(body.client_request_id)
        if not ctx.code_ok:
            raise PublicError(403, "code_required")
        payload = body.model_dump(exclude={"client_request_id"}, exclude_none=True)
        payload["lines"] = [{k: v for k, v in ln.items() if v is not None} for ln in payload.get("lines", [])]

        def tx() -> tuple[int, dict[str, Any], bool]:
            when = now()
            with db.connection(label="tickets.public.claim") as conn:
                link = ctx.link
                replay = claim_request(conn, link, crid, CLAIM_ROUTE, when)
                if replay is not None:
                    return replay[0], replay[1], False
                claim = store_costs.claim_for_assignment(conn, link.assignment_id)
                if claim is None:
                    raise PublicError(409, "claim_not_open")
                asg = store_links.contact(conn, link.contact_id) or {}
                try:
                    fresh = costs.submit(conn, claim, payload, by_kind="contact", by_id=link.contact_id, link_id=link.link_id, at=when,
                                         actor_name=asg.get("display_name") or "")
                except costs.CostRefused as exc:
                    raise _error(exc) from None
                rev = store_costs.revision(conn, fresh["current_revision_id"]) or {}
                audit_link(conn, link, "ticket.cost.submit", claim_id=fresh["id"], revision=rev.get("seq"), total_minor=rev.get("total_minor"),
                           currency=rev.get("currency"))
                answer = {"ok": True, "status": fresh["status"],
                          "revision": costs.present_revision(conn, rev, for_vendor=True) if rev else None}
                return (*finish_request(conn, link, crid, 201, answer), True)

        async def work() -> tuple[int, dict[str, Any]]:
            status, answer, new = await run_in_threadpool(tx)
            if new:
                spend_budget(request)
            return status, answer

        return await idem.run(idempotency_scope(ctx.link), crid, CLAIM_ROUTE, work)

    return r


def claim_card(conn, link: LinkRecord, *, code_ok: bool, now: dt.datetime) -> dict[str, Any]:
    """GET /t/api/ticket in CLAIM MODE: the minimal ticket card + the claim (11A.5) - the number, the department, the organisation,
    the title and place (after the code when one is required) and the claim block; nothing of the handling timeline."""
    from . import handler_actions

    shown = code_ok or not link.require_code
    full = handler_actions.view(conn, link, code_ok=shown, read_only=True, now=now)
    keep = ["number", "department", "organization", "lang", "dir", "labels", "time_zone", "code_required", "code_ok"]
    if shown:
        keep += ["title", "place_text", "device_name", "assigned_by"]
    out = {k: full.get(k) for k in keep}
    out.update({"claim_mode": True, "status": "claim", "read_only": True, "expires_at": costs.iso(_when(link.expires_at)),
                "actions": {"statuses": [], "note": False, "eta": False, "photo": False, "return": False},
                "claim": costs.public_summary(conn, link.assignment_id, now) if shown else None})
    return out
