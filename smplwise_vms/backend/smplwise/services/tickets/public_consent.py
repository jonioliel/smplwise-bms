"""WA-CONSENT-LINK: the WhatsApp consent page's routes on the public listener (services/intercom_consent.py has the rules; the edge's ROUTES
carry their kinds and limits; docs/changes/CR-WA-CONSENT-LINK.md has the design and the threat model). Added to public_app through
`PublicDeps.extra_routers`.

- `GET  /t/api/consent` - the page: the organisation's name and logo, the look, the notice version and the request's language. NO personal
  data (no name, no number). Unknown / answered / expired / failed token, or no token: the uniform 404.
- `POST /t/api/consent` - `{choice: "approve" | "decline", notice_version}`: the answer, ONCE (compare-and-set). The token is resolved
  BEFORE the body is read (a request without a live token is the uniform 404 whatever it sent - never a 422 that would tell a live token
  from a dead one); a notice version that is not the current one is 409 `notice_changed` (the page reloads and shows the current text, so
  the version stored with the consent is the one the person saw).

CSRF: the token travels in the `X-Ticket-Token` HEADER (a cross-site form or image cannot set it, and the listener sends no CORS headers,
so no cross-site script can either), the body must be `application/json` (the edge: 415 otherwise), the listener never reads or sets a
cookie on these routes. Rate: the token kinds of the edge (token_read / token_write) - failures per client network and installation-wide,
per-token windows, the write budget spent only when an answer is stored. Bodies are read with `read_json()` into strict models; no token,
phone number or name is ever logged."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Any, Callable, Literal

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from ...db import Database
from .public_app import PublicError, public_request, read_json, spend_budget

log = logging.getLogger("smplwise.intercom.consent")
UTC = dt.timezone.utc


class ConsentIn(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    choice: Literal["approve", "decline"]
    notice_version: str = Field(max_length=64)


def build_router(db: Database, *, clock: Callable[[], float] | None = None) -> APIRouter:
    from .. import intercom_consent as C

    r = APIRouter()

    def now() -> dt.datetime:
        t = clock() if clock is not None else dt.datetime.now(UTC).timestamp()
        return dt.datetime.fromtimestamp(t, UTC)

    def read(fn: Callable[..., Any], *args: Any) -> Any:
        with db.connection(mode="read", label="intercom.consent.read") as conn:
            return fn(conn, *args)

    async def live(request: Request) -> dict[str, Any]:
        """The live request of the presented token - ONE indexed lookup by the token's hash - or the uniform 404 (counted as a failure
        against the client network and the installation by the edge's cost object)."""
        pr = public_request(request)
        if pr.token_hash is None or pr.token_key is None:
            raise PublicError(404, "link_unavailable")
        row = await run_in_threadpool(read, C.lookup, pr.token_hash, now())
        if row is None:
            pr.cost.unknown()
            raise PublicError(404, "link_unavailable")
        pr.cost.proved(row["id"])
        return row

    @r.get("/t/api/consent")
    async def consent_view(request: Request) -> JSONResponse:
        row = await live(request)
        return JSONResponse(await run_in_threadpool(read, C.page_view, row))

    @r.post("/t/api/consent")
    async def consent_answer(request: Request) -> JSONResponse:
        await live(request)  # before the body: without a live token every body is the same 404
        body: ConsentIn = await read_json(request, ConsentIn)
        if body.notice_version != C.NOTICE_VERSION:
            raise PublicError(409, "notice_changed")
        token_hash = public_request(request).token_hash

        def go() -> tuple[str, int] | None:
            with db.connection(label="intercom.consent.answer") as conn:
                got = C.answer(conn, token_hash, body.choice, now())
                if got is None:
                    return None
                state, dropped, released = got
                C.notify_dropped(conn, dropped)
                return state, released

        result = await run_in_threadpool(go)
        if result is None:  # answered meanwhile (a double tap on two devices): single use
            raise PublicError(404, "link_unavailable")
        spend_budget(request)  # an answer was stored: one unit of the token's write budget
        state, released = result
        if released:
            C.RELEASER.kick()  # the held messages are sent by the releaser thread - the public listener never waits for WisKey
        return JSONResponse({"ok": True, "answer": "approved" if state == "granted" else "declined"})

    return r
