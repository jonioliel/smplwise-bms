"""CR-038 slice 4, spec 10.3: the ticket routes of the public app - `GET /t/api/ticket`, `GET /t/api/map-image` (TKMAP1), `POST /t/api/status`, `/note`, `/eta`,
`/return` - added to public_app through `PublicDeps.extra_routers` (the edge's ROUTES already carry their limits, kinds and
deadlines; the photo, code and redeem routes are the public-core library's).

Every route follows the wiring rules of the code review (section 3):
- the token is resolved by `link_context()` ONLY (one lookup after the rate gate, W1); writes use `link_context(write=True)`
  (read-only grace -> 409, a code-protected link without a code session -> 403);
- bodies are read with `read_json()` into strict models (`extra = forbid`, `clean_str` fields: Cc / Cf stripped before the
  length checks) - never FastAPI's Body / Form / File (W17), so nothing is parsed before `link_context` ran and a 422 never
  echoes the input;
- `client_request_id` is mandatory (`parse_client_request_id`), replayed by `Idempotency.run`, and the effect's own
  transaction writes the request row (handler_actions, W5);
- `spend_budget(request)` is called once a NEW effect is stored - never for a refusal, a replay or a failure (W18);
- the answers are `{"code": ...}`-shaped JSON; the page holds the words in its four languages."""
from __future__ import annotations

import datetime as dt
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from ...db import Database
from . import handler_actions, links, map_element, rfq_attach, rfq_files, store_links
from .handler_actions import ActionRefused, LinkGone
from .keyring import KEYS
from .module_key import ModuleKeyError
from .public_app import (Idempotency, LinkContext, PublicError, idempotency_scope, link_context, parse_client_request_id, read_json,
                         spend_budget)
from .text_hygiene import clean_str

UTC = dt.timezone.utc
_ID = r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$"


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class StatusIn(_Strict):
    status: Literal["acknowledged", "in_progress", "waiting_part", "done"]
    note: clean_str(handler_actions.NOTE_MAX, multiline=True, required=False) | None = None  # type: ignore[valid-type]
    client_request_id: str = Field(max_length=64)


class NoteIn(_Strict):
    text: clean_str(handler_actions.NOTE_MAX, multiline=True)  # type: ignore[valid-type]
    ask: bool = False  # CR-038 18A: the note is a question to the manager
    client_request_id: str = Field(max_length=64)


class EtaIn(_Strict):
    eta_at: str | None = Field(default=None, max_length=40)
    client_request_id: str = Field(max_length=64)


class ArrivedIn(_Strict):
    """VENDORARRIVAL126-295: the vendor's one tap "I have arrived" - nothing but the request id."""
    client_request_id: str = Field(max_length=64)


class ReturnIn(_Strict):
    kind: Literal["cannot_handle", "not_mine"]
    reason: clean_str(handler_actions.REASON_MAX, multiline=True)  # type: ignore[valid-type]
    client_request_id: str = Field(max_length=64)


def _refusal(exc: ActionRefused) -> PublicError:
    if exc.status == 404:
        return PublicError(404, "link_unavailable")
    return PublicError(exc.status, exc.code, **exc.extra)


def build_router(db: Database, *, clock: Callable[[], float] | None = None) -> APIRouter:
    """The ticket routes over the real store. `clock` (epoch seconds) is the public app's clock in tests."""
    r = APIRouter()
    idem = Idempotency(None)  # in-process duplicate claims only: the request rows are written by the effects themselves

    def now() -> dt.datetime:
        t = clock() if clock is not None else dt.datetime.now(UTC).timestamp()
        return dt.datetime.fromtimestamp(t, UTC).replace(microsecond=0)

    def client_key(ctx: LinkContext) -> str:
        try:
            key = KEYS.get(getattr(ctx.link, "key_id", None))
        except ModuleKeyError:
            raise PublicError(404, "link_unavailable") from None  # no key (a /data restored without secrets/): fail closed
        return links.client_key(key, ctx.request.net, links.ua_family(ctx.request.user_agent))

    def tx(fn: Callable[..., tuple[int, dict[str, Any]]], ctx: LinkContext, **kw: Any) -> tuple[int, dict[str, Any], bool]:
        """One write transaction; (status, answer, new) - `new` is False for a replay found inside the transaction."""
        with db.connection(label="tickets.public.write") as conn:
            before = conn.total_changes
            status, answer = fn(conn, ctx.link, now=now(), **kw)
            return status, answer, conn.total_changes != before

    async def write(request: Request, ctx: LinkContext, route: str, crid: str, fn: Callable[..., tuple[int, dict[str, Any]]], **kw: Any) -> JSONResponse:
        ck = client_key(ctx)

        async def work() -> tuple[int, dict[str, Any]]:
            try:
                status, answer, new = await run_in_threadpool(tx, fn, ctx, crid=crid, client_key=ck, **kw)
            except LinkGone:
                raise PublicError(404, "link_unavailable") from None
            except ActionRefused as exc:
                raise _refusal(exc) from None
            if new:
                spend_budget(request)  # W18: a stored effect spends one unit of the token's write budget, nothing else does
            return status, answer

        return await idem.run(idempotency_scope(ctx.link), crid, route, work)

    @r.get("/t/api/ticket")
    async def ticket(request: Request, ctx: LinkContext = Depends(link_context(allow_claim=True))) -> JSONResponse:
        ck = client_key(ctx)

        def read() -> dict[str, Any]:
            from . import costs, public_claims  # slice 9 (11A.5): the claim step

            if ctx.claim_mode:  # the page no longer serves this link: the minimal card + the claim until `claim_until`
                with db.connection(mode="read", label="tickets.public.claim") as conn:
                    return public_claims.claim_card(conn, ctx.link, code_ok=ctx.code_ok, now=now())
            with db.connection(label="tickets.public.open") as conn:
                when = now()
                if ctx.code_ok:  # PUB-02: like the RFQ page (review F1), an open counts only past the code gate - a forwarded link alone forges no "opened"
                    handler_actions.record_open(conn, ctx.link, when, ck)
                data = handler_actions.view(conn, ctx.link, code_ok=ctx.code_ok, read_only=ctx.read_only, now=when)
                if (ctx.code_ok or not ctx.link.require_code) and not ctx.link.no_money:  # TKSTAFF1 (R2): never on a staff link
                    data["claim"] = costs.public_summary(conn, ctx.link.assignment_id, when)
                    from . import quotes  # TKDETAILBE (contract 4.5): the quote card's state

                    data["quote"] = quotes.public_summary(conn, ctx.link.assignment_id)
                    if data["quote"] is not None and ctx.read_only:
                        data["quote"]["writable"] = False
                if ctx.code_ok or not ctx.link.require_code:  # TKMAP1: the map element's SNAPSHOT text + whether a picture exists
                    block = map_element.public_block(conn, ctx.link.ticket_id)
                    if block is not None:
                        data["map_element"] = block
                    files = rfq_attach.ticket_list(conn, ctx.link.ticket_id)  # RFQATT (contract 19.6): the order's request files
                    if files:
                        data["rfq_files"] = files
                if (ctx.code_ok or not ctx.link.require_code) and not ctx.read_only and not ctx.link.no_money:
                    from .. import access_arrival  # GRANTS3-295: announce the arrival step, so the page fetches its lazy chunk only then

                    if access_arrival.available(conn, ctx.link):
                        data["arrival"] = True
                    from . import vendor_arrival  # VENDORARRIVAL126-295: the "I have arrived" card (None while the switch is off)

                    block = vendor_arrival.page_block(conn, ctx.link, when)
                    if block is not None:
                        data["vendor_arrival"] = block
                return data

        try:
            data = await run_in_threadpool(read)
        except LinkGone:
            raise PublicError(404, "link_unavailable") from None
        engine = request.app.state.deps.codes
        if ctx.link.require_code and not ctx.code_ok and engine is not None:
            data["code_locked_s"] = int(await run_in_threadpool(engine.locked_for, ctx.link) + 0.999)
        return JSONResponse(data)

    @r.get("/t/api/map-image")
    async def map_picture(ctx: LinkContext = Depends(link_context())) -> Response:
        """TKMAP1: the request's map element drawn on the server (map_image.py: structure, doors / windows, room names and the marked
        element only - no other object, no id, no plan document). A live, available link only (link_context: unknown / expired /
        revoked / claim-mode -> the uniform 404); a code-protected link needs its code session; nothing attached, or the element left
        the map -> the uniform 404 (the page shows the stored text). Never cached (private, no-store)."""
        if not ctx.code_ok:
            raise PublicError(403, "code_required")

        def read() -> str | None:
            with db.connection(mode="read", label="tickets.public.map_image") as conn:
                if store_links.ticket_of_link(conn, ctx.link.link_id) is None:
                    raise LinkGone()
                return map_element.picture(conn, ctx.link.ticket_id)

        try:
            svg = await run_in_threadpool(read)
        except LinkGone:
            raise PublicError(404, "link_unavailable") from None
        if svg is None:
            raise PublicError(404, "link_unavailable")
        return Response(svg.encode("utf-8"), media_type="image/svg+xml; charset=utf-8",
                        headers={"Cache-Control": "private, no-store", "Content-Disposition": 'inline; filename="map.svg"'})

    async def rfq_file(request: Request, attachment_id: str, ctx: LinkContext, thumb: bool) -> FileResponse:
        """RFQATT (contract 19.6): a request file the work order's service request REFERENCES - this link's ticket only, past the code
        gate; unknown / another ticket's / removed / internal-only -> the uniform 404."""
        if not ctx.code_ok:
            raise PublicError(403, "code_required")
        root = getattr(request.app.state.deps, "attachments_root", None)
        if root is None:
            raise PublicError(404, "link_unavailable")

        def read() -> tuple[dict[str, Any], int] | None:
            with db.connection(mode="read", label="tickets.public.rfq_file") as conn:
                t = store_links.ticket_of_link(conn, ctx.link.link_id)
                if t is None:
                    raise LinkGone()
                a = rfq_attach.for_ticket(conn, ctx.link.ticket_id, attachment_id)
                return (a, int(t.get("number") or 0)) if a is not None else None

        try:
            got = await run_in_threadpool(read)
        except LinkGone:
            raise PublicError(404, "link_unavailable") from None
        if got is None:
            raise PublicError(404, "link_unavailable")
        a, number = got
        path = rfq_attach.file_path(root, a, thumb)
        if path is None:
            raise PublicError(404, "link_unavailable")
        h = rfq_files.headers("image" if thumb else a["kind"], ref_number=number, file_id=a["id"], name=a["name"])
        media = h.pop("Content-Type")
        return FileResponse(path, media_type=media, headers=h)

    @r.get("/t/api/ticket/rfq-file/{attachment_id}")
    async def ticket_rfq_file(request: Request, attachment_id: str = Path(..., pattern=_ID), ctx: LinkContext = Depends(link_context())) -> FileResponse:
        return await rfq_file(request, attachment_id, ctx, False)

    @r.get("/t/api/ticket/rfq-file/{attachment_id}/thumb")
    async def ticket_rfq_thumb(request: Request, attachment_id: str = Path(..., pattern=_ID), ctx: LinkContext = Depends(link_context())) -> FileResponse:
        return await rfq_file(request, attachment_id, ctx, True)

    @r.post("/t/api/status")
    async def status(request: Request, ctx: LinkContext = Depends(link_context(write=True))) -> JSONResponse:
        body: StatusIn = await read_json(request, StatusIn)
        crid = parse_client_request_id(body.client_request_id)
        return await write(request, ctx, "/t/api/status", crid, handler_actions.set_status, to=body.status, note=body.note or None)

    @r.post("/t/api/note")
    async def note(request: Request, ctx: LinkContext = Depends(link_context(write=True))) -> JSONResponse:
        body: NoteIn = await read_json(request, NoteIn)
        crid = parse_client_request_id(body.client_request_id)
        return await write(request, ctx, "/t/api/note", crid, handler_actions.add_note, text=body.text, ask=body.ask)

    @r.post("/t/api/eta")
    async def eta(request: Request, ctx: LinkContext = Depends(link_context(write=True))) -> JSONResponse:
        body: EtaIn = await read_json(request, EtaIn)
        crid = parse_client_request_id(body.client_request_id)
        return await write(request, ctx, "/t/api/eta", crid, handler_actions.set_eta, eta_at=body.eta_at)

    @r.post("/t/api/return")
    async def give_back(request: Request, ctx: LinkContext = Depends(link_context(write=True))) -> JSONResponse:
        body: ReturnIn = await read_json(request, ReturnIn)
        crid = parse_client_request_id(body.client_request_id)
        return await write(request, ctx, "/t/api/return", crid, handler_actions.give_back, kind=body.kind, reason=body.reason)

    @r.post("/t/api/arrived")
    async def arrived(request: Request, ctx: LinkContext = Depends(link_context(write=True))) -> JSONResponse:
        """VENDORARRIVAL126-295: "I have arrived" - one tap, the link's token, the `token_write` window of the edge, idempotent. The uniform
        404 while `vendor_arrival.enabled` is off (the default), on a staff link, or when the request is no longer open."""
        from . import vendor_arrival

        body: ArrivedIn = await read_json(request, ArrivedIn)
        crid = parse_client_request_id(body.client_request_id)
        return await write(request, ctx, vendor_arrival.ROUTE, crid, vendor_arrival.signal)

    @r.get("/t/api/arrival")
    async def arrival_view(request: Request, ctx: LinkContext = Depends(link_context())) -> JSONResponse:
        """CR-ARX-WISKEY-SHARED-IDENTITY 5: the arrival step's data (his persons by first name + ····NN, the order window, the fixed
        hours, the privacy notice). A code-protected link needs its code session; switched off / not an RFQ order -> the uniform 404."""
        from .. import access_arrival

        if ctx.link.require_code and not ctx.code_ok:
            raise PublicError(403, "code_required")

        def read() -> dict[str, Any]:
            with db.connection(mode="read", label="tickets.public.arrival") as conn:
                return access_arrival.view(conn, ctx.link, now=now())

        try:
            data = await run_in_threadpool(read)
        except access_arrival.Refused as exc:
            raise PublicError(exc.status, exc.code, **exc.extra) from None
        return JSONResponse(data, headers={"Cache-Control": "private, no-store"})

    @r.post("/t/api/arrival")
    async def arrival(request: Request, ctx: LinkContext = Depends(link_context(write=True))) -> JSONResponse:
        from .. import access_arrival

        body: ArrivalIn = await read_json(request, ArrivalIn)
        crid = parse_client_request_id(body.client_request_id)

        def effect(conn, link, *, now: dt.datetime, crid: str, client_key: str) -> tuple[int, dict[str, Any]]:
            try:
                return access_arrival.request(conn, link, body=body.model_dump(), crid=crid, now=now, client_key=client_key)
            except access_arrival.Refused as exc:
                raise ActionRefused(exc.status, exc.code, **exc.extra) from None

        return await write(request, ctx, "/t/api/arrival", crid, effect)

    return r


class NewPersonIn(_Strict):
    name: clean_str(60) = Field()  # type: ignore[valid-type]
    phone: str = Field(max_length=32)


class ArrivalIn(_Strict):
    """CR-ARX-WISKEY-SHARED-IDENTITY 5: exactly one of `person_id` / `new_person`; dates in the installation's zone; hours from the
    fixed list; the notice acknowledged with its version."""
    person_id: str | None = Field(default=None, max_length=64, pattern=_ID)
    new_person: NewPersonIn | None = None
    date_from: str = Field(max_length=10, pattern=r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
    date_to: str = Field(max_length=10, pattern=r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
    hours: str = Field(max_length=11)
    notice_ack: bool
    notice_version: str = Field(max_length=16)
    client_request_id: str = Field(max_length=64)
