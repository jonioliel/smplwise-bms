"""CR-038 slice 4, spec 10.3: the ticket routes of the public app - `GET /t/api/ticket`, `POST /t/api/status`, `/note`, `/eta`,
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

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from ...db import Database
from . import handler_actions, links
from .handler_actions import ActionRefused, LinkGone
from .keyring import KEYS
from .module_key import ModuleKeyError
from .public_app import (Idempotency, LinkContext, PublicError, idempotency_scope, link_context, parse_client_request_id, read_json,
                         spend_budget)
from .text_hygiene import clean_str

UTC = dt.timezone.utc


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class StatusIn(_Strict):
    status: Literal["acknowledged", "in_progress", "waiting_part", "done"]
    note: clean_str(handler_actions.NOTE_MAX, multiline=True, required=False) | None = None  # type: ignore[valid-type]
    client_request_id: str = Field(max_length=64)


class NoteIn(_Strict):
    text: clean_str(handler_actions.NOTE_MAX, multiline=True)  # type: ignore[valid-type]
    client_request_id: str = Field(max_length=64)


class EtaIn(_Strict):
    eta_at: str | None = Field(default=None, max_length=40)
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
    async def ticket(request: Request, ctx: LinkContext = Depends(link_context())) -> JSONResponse:
        ck = client_key(ctx)

        def read() -> dict[str, Any]:
            with db.connection(label="tickets.public.open") as conn:
                when = now()
                handler_actions.record_open(conn, ctx.link, when, ck)
                return handler_actions.view(conn, ctx.link, code_ok=ctx.code_ok, read_only=ctx.read_only, now=when)

        try:
            data = await run_in_threadpool(read)
        except LinkGone:
            raise PublicError(404, "link_unavailable") from None
        engine = request.app.state.deps.codes
        if ctx.link.require_code and not ctx.code_ok and engine is not None:
            data["code_locked_s"] = int(await run_in_threadpool(engine.locked_for, ctx.link) + 0.999)
        return JSONResponse(data)

    @r.post("/t/api/status")
    async def status(request: Request, ctx: LinkContext = Depends(link_context(write=True))) -> JSONResponse:
        body: StatusIn = await read_json(request, StatusIn)
        crid = parse_client_request_id(body.client_request_id)
        return await write(request, ctx, "/t/api/status", crid, handler_actions.set_status, to=body.status, note=body.note or None)

    @r.post("/t/api/note")
    async def note(request: Request, ctx: LinkContext = Depends(link_context(write=True))) -> JSONResponse:
        body: NoteIn = await read_json(request, NoteIn)
        crid = parse_client_request_id(body.client_request_id)
        return await write(request, ctx, "/t/api/note", crid, handler_actions.add_note, text=body.text)

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

    return r
