"""VPORTAL: the vendor portal's routes on the public listener (services/tickets/vendor_portal.py has the rules; the edge's ROUTES carry
their limits and kinds; docs/changes/CR-VENDOR-PORTAL.md has the design and the threat model). Added to public_app through
`PublicDeps.extra_routers`.

- `GET  /t/api/portal/config`  - the sign-in screen's brand and look; the uniform 404 while the portal is off.
- `POST /t/api/portal/start`   - `{phone}`: ALWAYS `202 {"code": "sent_if_registered"}` for a well-formed number, whoever it belongs to;
  the lookup and the WhatsApp message run AFTER the answer was sent (a background task) - same bytes, same timing class for a known
  and an unknown number. A malformed number is 422 (that depends on the input only).
- `POST /t/api/portal/verify`  - `{phone, code}`: a correct code -> 200 + the session cookie (vendor_portal: 30 minutes, never
  extended); anything else -> the ONE refusal `422 {"code": "code_invalid"}`.
- `GET  /t/api/portal/items`   - the session's items (read-only); no / dead session -> the uniform 404.
- `POST /t/api/portal/open`    - `{item}`: the handler token of that item's live link (the page opens the existing handler page with
  it); anything out of the session's scope -> the uniform 404. The session is checked BEFORE the body is parsed (2.6.4 review F5:
  without a session every body is the same 404, never a 422).
- `POST /t/api/portal/logout`  - ends the session and clears the cookie; idempotent - the SAME answer (200 + the clearing cookie)
  with a live, a dead or no session (review F5: it reveals nothing; the route itself is visible through `config` while on).
- `GET  /t/brand/<stamp>.jpg`  - the organisation's logo (brand.py), only the current stamp; immutable.
- VPORTALRFQ (portal_more.py; CR-VENDOR-PORTAL section 12; each section OFF by default, the uniform 404 while off):
  `GET /t/api/portal/rfqs` + `POST /t/api/portal/rfqs/open` (his open invitations; his own RFQ link's token), `GET /t/api/portal/techs`
  + `POST /t/api/portal/techs` + `POST /t/api/portal/techs/cancel` (company technician requests). The session first, then the switch,
  then the body.
Bodies are read with `read_json()` into strict models (W17: never FastAPI's Body); every answer is `{"code": ...}`-shaped or the
uniform 404; no number, code or session value is ever logged."""
from __future__ import annotations

import datetime as dt
import logging
import queue
import threading
import time
from pathlib import Path
from typing import Any, Callable, Literal

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

from ...db import Database
from . import brand, portal_more, vendor_portal
from .public_app import PublicError, public_request, read_json
from .public_http import PORTAL_COOKIE

log = logging.getLogger("smplwise.tickets.vendor_portal")
UTC = dt.timezone.utc
SENT = {"code": "sent_if_registered"}


# ---------------------------------------------------------------- SECFIX2-295 / PUB-04: the listener's own start worker
#
# docs/security/PROPOSAL_PUB04_PORTAL_START_TIMING.md option A, behind `vendor_portal.start_worker` (default OFF = the BackgroundTask
# below, today's behaviour). With it on, `portal/start` only ENQUEUES the job and returns: the request's ASGI call, the edge's in-flight
# slot and the keep-alive connection are released at once and identically for a known and an unknown number. One daemon thread per
# database drains a bounded queue; a full queue drops the job silently with a counter (the answer must stay the same 202 - never a 429
# here); a job's exception is logged by type only (request_in_background never logs the number) and never stops the thread; the thread
# stops with the listener (public_server.PublicListener.stop -> stop_workers).

START_QUEUE_MAX = 64
WORKER_THREAD_NAME = "arx-portal-start"
_STOP = object()


class StartWorker:
    def __init__(self, maxsize: int) -> None:
        self.queue: queue.Queue[Any] = queue.Queue(maxsize=max(1, maxsize))
        self.accepted = 0
        self.dropped = 0
        self._count_lock = threading.Lock()
        self.thread = threading.Thread(target=self._loop, name=WORKER_THREAD_NAME, daemon=True)
        self.thread.start()

    def submit(self, job: Callable[[], None]) -> bool:
        """Queue one job; False (counted, nothing else) when the queue is full or the worker has stopped."""
        if not self.thread.is_alive():
            with self._count_lock:
                self.dropped += 1
            return False
        try:
            self.queue.put_nowait(job)
        except queue.Full:
            with self._count_lock:
                self.dropped += 1
            return False
        with self._count_lock:
            self.accepted += 1
        return True

    def _loop(self) -> None:
        while True:
            job = self.queue.get()
            try:
                if job is _STOP:
                    return
                job()
            except Exception as exc:  # noqa: BLE001 - one job never stops the worker; nothing about the job is logged
                log.warning("portal start worker: a job failed (%s)", type(exc).__name__)
            finally:
                self.queue.task_done()

    def wait_idle(self, timeout_s: float = 5.0) -> bool:
        """Tests / shutdown: True once every queued job has finished (False after `timeout_s`)."""
        end = time.monotonic() + timeout_s
        while time.monotonic() < end:
            if self.queue.unfinished_tasks == 0:
                return True
            time.sleep(0.01)
        return self.queue.unfinished_tasks == 0

    def stop(self, timeout_s: float = 5.0) -> None:
        if self.thread.is_alive():
            try:
                self.queue.put(_STOP, timeout=timeout_s)
            except queue.Full:
                log.warning("portal start worker: the queue stayed full; the thread ends with the process")
                return
            self.thread.join(timeout_s)


_workers: dict[int, tuple[Any, StartWorker]] = {}
_workers_lock = threading.Lock()


def worker_for(db: Any) -> StartWorker:
    with _workers_lock:
        entry = _workers.get(id(db))
        if entry is None or entry[0] is not db or not entry[1].thread.is_alive():
            entry = (db, StartWorker(START_QUEUE_MAX))
            _workers[id(db)] = entry
        return entry[1]


def worker_started(db: Any) -> bool:
    with _workers_lock:
        entry = _workers.get(id(db))
        return entry is not None and entry[0] is db


def stop_workers(timeout_s: float = 5.0) -> None:
    with _workers_lock:
        entries = list(_workers.values())
        _workers.clear()
    for _db, w in entries:
        w.stop(timeout_s)


def reset_workers_for_tests() -> None:
    stop_workers(timeout_s=2.0)


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class StartIn(_Strict):
    phone: str = Field(max_length=40)


class VerifyIn(_Strict):
    phone: str = Field(max_length=40)
    code: str = Field(max_length=32)


class OpenIn(_Strict):
    item: str = Field(max_length=64)


class EmptyIn(_Strict):
    pass


class TechIn(_Strict):
    """VPORTALRFQ: a technician request (portal_more.submit_tech judges every value again; the vendor sees one fixed refusal per field)."""
    company: str = Field(max_length=64)
    action: Literal["add", "replace"]
    name: str = Field(max_length=200)
    phone: str = Field(max_length=40)
    replaces: str | None = Field(default=None, max_length=64)


def cookie(prefix: str, value: str, max_age: int) -> str:
    """The portal session cookie (public_http.PORTAL_COOKIE): only the portal's API path under the public prefix receives it."""
    return f"{PORTAL_COOKIE}={value}; Path=/{prefix}/api/portal; Max-Age={max_age}; Secure; HttpOnly; SameSite=Strict"


def build_router(db: Database, *, clock: Callable[[], float] | None = None, data_dir: Path | None = None) -> APIRouter:
    r = APIRouter()

    def now() -> dt.datetime:
        t = clock() if clock is not None else dt.datetime.now(UTC).timestamp()
        return dt.datetime.fromtimestamp(t, UTC).replace(microsecond=0)

    def read(fn: Callable[..., Any], *args: Any) -> Any:
        with db.connection(mode="read", label="tickets.portal.read") as conn:
            return fn(conn, *args)

    def write(fn: Callable[..., Any], *args: Any) -> Any:
        with db.connection(label="tickets.portal.write") as conn:
            return fn(conn, *args)

    def on(conn) -> bool:
        return vendor_portal.enabled(conn)

    async def require_on() -> None:
        if not await run_in_threadpool(read, on):
            raise PublicError(404, "link_unavailable")

    @r.get("/t/api/portal/config")
    async def portal_config() -> JSONResponse:
        def go(conn) -> dict[str, Any] | None:
            return vendor_portal.config(conn) if on(conn) else None

        body = await run_in_threadpool(read, go)
        if body is None:
            raise PublicError(404, "link_unavailable")
        return JSONResponse(body)

    def request_in_background(digits: str, net: str) -> None:
        try:
            at = now()
            # 2.6.4 review F3: who the number belongs to is read on a READ connection first; the write transaction then walks the
            # same statements for every number until a message really leaves
            plan = read(vendor_portal.plan_request, digits, at)
            with db.connection(label="tickets.portal.write") as conn:
                vendor_portal.request_code(conn, digits, at, plan=plan, net=net)
        except Exception as exc:  # noqa: BLE001 - the answer already left; the number is never logged
            log.warning("portal code request failed (%s)", type(exc).__name__)

    def start_mode(conn) -> bool | None:
        """None = the portal is off; else whether the listener's worker takes the job (PUB-04). One read, before the number is parsed."""
        return vendor_portal.start_worker(conn) if on(conn) else None

    @r.post("/t/api/portal/start")
    async def portal_start(request: Request) -> JSONResponse:
        mode = await run_in_threadpool(read, start_mode)
        if mode is None:
            raise PublicError(404, "link_unavailable")
        body: StartIn = await read_json(request, StartIn)
        digits = vendor_portal.canonical_phone(body.phone)
        if digits is None:
            raise PublicError(422, "invalid", fields=[{"field": "phone", "code": "format"}])
        net = public_request(request).net
        if mode:
            # PUB-04 option A: enqueue and answer; the ASGI call ends now for every number (a full queue drops silently, same answer)
            worker_for(db).submit(lambda: request_in_background(digits, net))
            return JSONResponse(SENT, status_code=202)
        # the same answer for every well-formed number; who it belongs to is looked up only after this answer was sent
        return JSONResponse(SENT, status_code=202, background=BackgroundTask(request_in_background, digits, net))

    @r.post("/t/api/portal/verify")
    async def portal_verify(request: Request) -> JSONResponse:
        await require_on()
        body: VerifyIn = await read_json(request, VerifyIn)
        digits = vendor_portal.canonical_phone(body.phone)
        net = public_request(request).net  # review F6: a code answers only on the network that asked for it

        def go(conn) -> str | None:
            return vendor_portal.verify(conn, digits, body.code, now(), net=net)

        value = await run_in_threadpool(write, go)  # a wrong guess is committed
        if value is None:
            raise PublicError(422, "code_invalid")
        ttl = int(vendor_portal.SESSION_TTL.total_seconds())
        res = JSONResponse({"ok": True, "expires_in_s": ttl})
        res.headers.append("set-cookie", cookie(public_request(request).prefix, value, ttl))
        return res

    async def live_session(request: Request) -> vendor_portal.Session:
        value = public_request(request).portal_session

        def go(conn) -> vendor_portal.Session | None:
            if not on(conn) or value is None:
                return None
            return vendor_portal.session(conn, value, now())

        sess = await run_in_threadpool(read, go)
        if sess is None:
            raise PublicError(404, "link_unavailable")
        return sess

    @r.get("/t/api/portal/items")
    async def portal_items(request: Request) -> JSONResponse:
        sess = await live_session(request)
        return JSONResponse(await run_in_threadpool(read, vendor_portal.view, sess, now()))

    @r.post("/t/api/portal/open")
    async def portal_open(request: Request) -> JSONResponse:
        sess = await live_session(request)  # review F5: no session -> the uniform 404 before the body is even read
        body: OpenIn = await read_json(request, OpenIn)
        found = await run_in_threadpool(write, vendor_portal.open_item, sess, body.item, now())
        if found is None:
            raise PublicError(404, "link_unavailable")
        token, info = found
        return JSONResponse({"token": token, **info})

    @r.post("/t/api/portal/logout")
    async def portal_logout(request: Request) -> JSONResponse:
        await require_on()
        await read_json(request, EmptyIn)
        value = public_request(request).portal_session
        if value is not None:
            await run_in_threadpool(write, vendor_portal.logout, value, now())
        res = JSONResponse({"ok": True})
        res.headers.append("set-cookie", cookie(public_request(request).prefix, "", 0))
        return res

    # ---------------------------------------------------------------- VPORTALRFQ (portal_more.py): each behind its own switch.
    # Order on every route: the session first (no / dead session -> the uniform 404 before anything else is read), then the section's
    # switch (off -> the same uniform 404), then the body. Nothing out of the session's scope is ever told apart from "nothing".

    async def section(request: Request, on_fn: Callable[[Any], bool]) -> vendor_portal.Session:
        sess = await live_session(request)
        if not await run_in_threadpool(read, on_fn):
            raise PublicError(404, "link_unavailable")
        return sess

    def refused(exc: portal_more.PortalRefused) -> PublicError:
        if exc.status == 404:
            return PublicError(404, "link_unavailable")
        return PublicError(exc.status, exc.code, **({"fields": exc.fields} if exc.fields else {}))

    @r.get("/t/api/portal/rfqs")
    async def portal_rfqs(request: Request) -> JSONResponse:
        sess = await section(request, portal_more.rfqs_on)
        return JSONResponse(await run_in_threadpool(read, portal_more.rfq_view, sess, now()))

    @r.post("/t/api/portal/rfqs/open")
    async def portal_rfq_open(request: Request) -> JSONResponse:
        sess = await section(request, portal_more.rfqs_on)
        body: OpenIn = await read_json(request, OpenIn)
        found = await run_in_threadpool(write, portal_more.open_rfq, sess, body.item, now())
        if found is None:
            raise PublicError(404, "link_unavailable")
        token, info = found
        return JSONResponse({"token": token, "kind": "rfq", **info})

    @r.get("/t/api/portal/techs")
    async def portal_techs(request: Request) -> JSONResponse:
        sess = await section(request, portal_more.techs_on)
        return JSONResponse(await run_in_threadpool(read, portal_more.tech_view, sess, now()))

    @r.post("/t/api/portal/techs")
    async def portal_tech_submit(request: Request) -> JSONResponse:
        sess = await section(request, portal_more.techs_on)
        body: TechIn = await read_json(request, TechIn)
        try:
            item = await run_in_threadpool(write, portal_more.submit_tech, sess, body.model_dump(), now())
        except portal_more.PortalRefused as exc:
            raise refused(exc) from None
        return JSONResponse({"ok": True, "request": item}, status_code=201)

    @r.post("/t/api/portal/techs/cancel")
    async def portal_tech_cancel(request: Request) -> JSONResponse:
        sess = await section(request, portal_more.techs_on)
        body: OpenIn = await read_json(request, OpenIn)
        if not await run_in_threadpool(write, portal_more.cancel_tech, sess, body.item, now()):
            raise PublicError(404, "link_unavailable")
        return JSONResponse({"ok": True})

    @r.get("/t/brand/{name}")
    async def brand_logo(name: str) -> Response:
        current = await run_in_threadpool(read, brand.stamp)
        p = brand.resolve(data_dir, name, current)
        if p is None:
            raise PublicError(404, "link_unavailable")
        return FileResponse(p, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=31536000, immutable"})

    return r
