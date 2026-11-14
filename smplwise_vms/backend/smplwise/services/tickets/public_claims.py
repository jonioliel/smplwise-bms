"""CR-038 slice 9, spec 11A.2 / 11A.5 / 11A.6 / 11A.12: the vendor's cost claim on the public handler page.

    GET  /t/api/claim        the claim of the link's assignment (status, the vendor's own revisions, the form settings)
    POST /t/api/claim/file   (public_app.claim_file) one photographed page or PDF -> a pending file id
    POST /t/api/claim        {lines[], currency, amounts_include_vat, vendor_ref?, notes?, no_charge?, documents: [{file_ids}],
                              instalment_index?, above_reason?, client_request_id} -> the server-computed revision
    CR-CLAIM-PREFILL: GET adds `prefill` (the link's OWN approved quote - claim_prefill.prefill), POST validates `instalment_index` /
    `above_reason` against it (claim_prefill.basis). No new route, no new rate kind.

Wiring rules (code review section 3, as public_routes): the token through `link_context(allow_claim=True)` only - CLAIM MODE lets a
link whose page no longer serves (closed past its grace, expired, a cannot-handle return) reach these routes and nothing else
until `claim_until` (`claim_window`); the code session applies exactly as on the page (403 `code_required`); bodies through
`read_json()` into strict models; `client_request_id` mandatory and stored in the effect's own transaction; the write budget is
spent once a NEW revision is stored. The vendor never sees internal notes, other assignments' claims, other vendors' costs or who
decided; amounts are the server's (client totals are not even accepted - `extra = forbid`).
TKFIX260 (public-surface review F3): inside the write transaction the link is read AGAIN (rule W2): a live / read-only link through
handler_actions.fresh, a claim-mode link through `costs.claim_mode_ok` - a link revoked or regenerated since the lookup is the
uniform 404. A stored revision on a link that still serves counts as the handler's progress (the update count and the access row;
the sliding expiry moves only outside the read-only grace). A claim keeps its total in the audit row (a financial record, 11A.12)."""
from __future__ import annotations

import datetime as dt
from typing import Any, Callable, Literal, Mapping

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from ...db import Database
from . import cost_files, costs, store_costs, store_links
from .handler_actions import ActionRefused, LinkGone, claim as claim_request, _finish as finish_request, _progress as link_progress, fresh as fresh_link
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
        if getattr(link, "no_money", getattr(link, "kind", "external") == "staff"):  # + review F4
            return None  # TKSTAFF1 (R2): a staff link never enters claim mode
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
        claim = costs.focus_claim(conn, link.assignment_id, now)  # CR-CLAIM-PREFILL (0117): a NEW instalment's claim takes files too
        if claim is None:
            raise PublicError(409, "claim_not_open")
        if claim["status"] in costs.SETTLED:
            raise PublicError(409, "claim_closed")
        if not costs.window_open(claim, now):
            raise PublicError(409, "claim_window_closed")
        return claim

    def check_open(self, link: LinkRecord) -> None:
        if getattr(link, "no_money", getattr(link, "kind", "external") == "staff"):  # + review F4
            raise PublicError(404, "link_unavailable")  # TKSTAFF1 (R2): defence in depth behind link_context(claim_surface=True)
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
    # CR-CLAIM-PREFILL: the instalment of the approved schedule this demand is for, and the short reason of a demand above the approved
    # total / instalment (claim_prefill.basis validates both against the link's own approved quote; the amount is never the client's)
    instalment_index: int | None = Field(default=None, ge=0, le=5)
    above_reason: str | None = Field(default=None, max_length=1000)
    client_request_id: str = Field(max_length=64)


def build_router(db: Database, *, clock: Callable[[], float] | None = None) -> APIRouter:
    r = APIRouter()
    idem = Idempotency(None)

    def now() -> dt.datetime:
        return _when(clock() if clock is not None else dt.datetime.now(UTC).timestamp())

    @r.get(CLAIM_ROUTE)
    async def get_claim(ctx: LinkContext = Depends(link_context(allow_claim=True, claim_surface=True))) -> JSONResponse:
        if not ctx.code_ok:
            raise PublicError(403, "code_required")

        def read() -> dict[str, Any]:
            with db.connection(mode="read", label="tickets.public.claim") as conn:
                out = costs.public_claim(conn, ctx.link.assignment_id, now())
            out["claim_mode"] = ctx.claim_mode
            return out

        return JSONResponse(await run_in_threadpool(read))

    @r.post(CLAIM_ROUTE)
    async def post_claim(request: Request, ctx: LinkContext = Depends(link_context(allow_claim=True, claim_surface=True))) -> JSONResponse:
        body: ClaimIn = await read_json(request, ClaimIn)
        crid = parse_client_request_id(body.client_request_id)
        if not ctx.code_ok:
            raise PublicError(403, "code_required")
        payload = body.model_dump(exclude={"client_request_id"}, exclude_none=True)
        payload["lines"] = [{k: v for k, v in ln.items() if v is not None} for ln in payload.get("lines", [])]
        from .public_quotes import client_key

        ck = client_key(ctx)

        def tx() -> tuple[int, dict[str, Any], bool]:
            when = now()
            with db.connection(label="tickets.public.claim") as conn:
                f = None
                try:
                    f = fresh_link(conn, ctx.link, when, write=False)  # W2: the link as it is NOW
                except LinkGone:
                    # claim mode (11A.5): the page no longer serves the link, the claim step may - re-checked here as well
                    if costs.claim_mode_ok(conn, ctx.link.link_id, ctx.link.generation, when) is None:
                        raise PublicError(404, "link_unavailable") from None
                if f is not None and f.link.no_money:
                    raise PublicError(404, "link_unavailable")  # TKSTAFF1 (R2): defence in depth
                link = f.link if f is not None else ctx.link
                replay = claim_request(conn, link, crid, CLAIM_ROUTE, when)
                if replay is not None:
                    return replay[0], replay[1], False
                try:  # CR-CLAIM-PREFILL (0117): the claim of the named instalment (a NEW one is written only after the submission validated)
                    claim = costs.claim_for_submission(conn, link.assignment_id, payload.get("instalment_index"), when)
                except costs.CostRefused as exc:
                    raise _error(exc) from None
                if claim is None:
                    raise PublicError(409, "claim_not_open")
                asg = store_links.contact(conn, link.contact_id) or {}
                try:
                    fresh = costs.submit(conn, claim, payload, by_kind="contact", by_id=link.contact_id, link_id=link.link_id, at=when,
                                         actor_name=asg.get("display_name") or "")
                except costs.CostRefused as exc:
                    raise _error(exc) from None
                rev = store_costs.revision(conn, fresh["current_revision_id"]) or {}
                if f is not None:  # a link that still serves: the handler's progress (no sliding expiry inside the read-only grace)
                    link_progress(conn, f, when, ck, extend=not f.link.read_only(when.timestamp()))
                audit_link(conn, link, "ticket.cost.submit", claim_id=fresh["id"], revision=rev.get("seq"), total_minor=rev.get("total_minor"),
                           currency=rev.get("currency"))
                answer = {"ok": True, "status": fresh["status"],
                          "revision": costs.present_revision(conn, rev, for_vendor=True) if rev else None}
                return (*finish_request(conn, link, crid, 201, answer), True)

        async def work() -> tuple[int, dict[str, Any]]:
            try:
                status, answer, new = await run_in_threadpool(tx)
            except ActionRefused as exc:  # claim_request: request_id_reused / request_in_progress
                raise PublicError(exc.status, exc.code, **exc.extra) from None
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
    keep = ["number", "department", "organization", "logo", "lang", "dir", "labels", "time_zone", "code_required", "code_ok", "theme"]  # + VPORTAL logo
    if shown:
        keep += ["title", "place_text", "location_text", "device_name", "assigned_by"]
    out = {k: full.get(k) for k in keep}
    out.update({"claim_mode": True, "status": "claim", "read_only": True, "expires_at": costs.iso(_when(link.expires_at)),
                "actions": {"statuses": [], "note": False, "eta": False, "photo": False, "return": False},
                "claim": costs.public_summary(conn, link.assignment_id, now) if shown else None})
    return out
