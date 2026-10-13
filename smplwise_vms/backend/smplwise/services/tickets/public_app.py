"""CR-038 section 10: the public app - a SECOND, minimal FastAPI app that holds only the `/t/*` routes, served by its own
listener (public_server) on container port 18093, behind the edge (public_http.PublicEdge). It shares nothing with the main
app: no routers, no middleware, no exception handlers, no static mount, no session, no cookie, no CORS.

Built here (the parts that need no ticket table; slice 4 implements the ports of public_ports.py and adds the ticket routes):
- the static shell (`GET /t/`, `GET /t/r/<rid>` - the same bytes for everyone, no lookup, no side effect; a link-preview fetch
  learns and changes nothing), the bundle's assets (`/t/assets/<name>`), `GET /t/healthz`;
- `POST /t/api/redeem` (the e-mail form of a link: at most 3 token releases per redeem id within 24 h);
- `POST /t/api/code/send`, `POST /t/api/code/verify` (option B, codes.CodeEngine);
- `POST /t/api/photo` (the hostile-image pipeline, one upload in flight per link, the photo quotas, the storage cap BEFORE the
  body is read, idempotent by `client_request_id`) and `GET /t/api/photo/<id>` (a re-encoded photo of the link's ticket);
- `link_context()`, the dependency every token route uses: ONE lookup by the token hash, after the edge's rate gate; unknown /
  expired / revoked / past the grace / ticket purged -> a counted failure and the uniform 404 (same bytes, same headers,
  same code path); read-only during the grace; the code session when the link requires one;
- `read_json()` (strict JSON: UTF-8, an object, no duplicate keys, no NaN, a pydantic model with `extra=forbid`) and the
  public 422 envelope: `{"code": "invalid", "fields": [{"field", "code"}]}` - never pydantic's `input`, `ctx` or `url`;
- `Idempotency.run()` (spec 10.3 / review T22): a repeat of `client_request_id` replays the first 2xx answer, the same id on
  another route is 409 `request_id_reused`, a concurrent duplicate is 409 `request_in_progress`.
Every answer is `{"code": ...}`-shaped JSON from a fixed vocabulary; the page holds the words, in four languages (D26)."""
from __future__ import annotations

import asyncio
import contextlib
import json
import re
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable, Mapping, Sequence

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import image_intake, links
from .codes import CodeEngine, CodeRefused
from .cost_files import photo_headers
from .image_intake import InFlight, IntakeError, StorageMeter
from .public_http import (PHOTO_MAX, ROUTES, STATE_KEY, UNIFORM_404, BodyDeadline, BodyTooLarge, PublicEdge, PublicRequest,
                          RouteRule)
from .public_log import PublicStats
from .public_multipart import FieldRule, MultipartError, boundary_of, parse_form
from .public_ports import CodeSender, LinkRecord, LinkStore, ModuleSwitch, PhotoSink, RedeemStore, RequestLog
from .ratelimit import DEFAULT_TRUSTED_PROXY_CIDRS, Network, PublicLimits, PublicRateGate, ScopedRateLimiter, new_public_limiter, parse_trusted_cidrs

REDEEM_MAX_USES = 3
CRID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
UPLOAD_SLOTS = 4  # upload bodies held in memory at once by this listener (each at most 8 MiB + 64 KiB)
UPLOAD_SLOT_WAIT_S = 5.0
SHELL_FILE = "index.html"
_ASSET_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)*\.(js|css|svg|png|ico)")
_HASHED_RE = re.compile(r".+[-.][A-Za-z0-9_-]{8,}\.[a-z0-9]+")
ASSET_TYPES = {"js": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8", "svg": "image/svg+xml", "png": "image/png",
               "ico": "image/x-icon"}
# What answers while the page bundle (slice 4's second Vite entry, smplwise_vms/www-public/) is not built: no script, no style.
FALLBACK_SHELL = ('<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">'
                  '<meta name="viewport" content="width=device-width, initial-scale=1">'
                  '<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><title></title></head>'
                  '<body><p>הדף אינו זמין כרגע.</p></body></html>').encode("utf-8")
PHOTO_FIELDS = {"file": FieldRule(file=True, max_bytes=image_intake.MAX_BYTES), "client_request_id": FieldRule(file=False, max_bytes=64)}


class PublicError(Exception):
    """An answer of the public app: status + code (+ small extra fields such as retry_after_s / attempts_left / fields)."""

    def __init__(self, status: int, code: str, **extra: Any) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.extra = extra


def unavailable() -> PublicError:
    return PublicError(404, "link_unavailable")


# ---------------------------------------------------------------- the dependencies of one public app


@dataclass
class PublicDeps:
    """Everything the public app needs. Slice 4 builds it from the module's SQL store and the add-on settings (wiring checklist
    in docs/changes/CR-038-PUBLIC-CORE-NOTES.md); tests build it from fakes."""

    links: LinkStore
    switch: ModuleSwitch
    key: Callable[[], bytes]
    trusted_proxies: Sequence[Network] = field(default_factory=lambda: parse_trusted_cidrs(DEFAULT_TRUSTED_PROXY_CIDRS))
    requests: RequestLog | None = None
    redeems: RedeemStore | None = None
    codes: CodeEngine | None = None
    code_sender: CodeSender | None = None
    photos: PhotoSink | None = None
    attachments_root: Path | None = None
    storage: StorageMeter | None = None
    shell_dir: Path | None = None
    limits: PublicLimits = field(default_factory=PublicLimits)
    limiter: ScopedRateLimiter | None = None
    clock: Callable[[], float] = time.time
    stats: PublicStats | None = None
    extra_routers: Sequence[APIRouter] = ()
    rules: Sequence[RouteRule] = ROUTES
    decode_wait_s: float = image_intake.DECODE_WAIT_S
    upload_slots: int = UPLOAD_SLOTS
    upload_slot_wait_s: float = UPLOAD_SLOT_WAIT_S


@dataclass(frozen=True)
class LinkContext:
    link: LinkRecord
    request: PublicRequest
    read_only: bool
    code_ok: bool
    now: float


def public_request(request: Request) -> PublicRequest:
    pr = (request.scope.get("state") or {}).get(STATE_KEY)
    if not isinstance(pr, PublicRequest):
        raise unavailable()  # not routed through the edge: never served
    return pr


def link_context(*, write: bool = False, need_code: bool = True) -> Callable[[Request], Awaitable[LinkContext]]:
    """The dependency of every token route (see the module docstring). `write`: refuse during the read-only grace (409
    `read_only`); `need_code`: a link that requires a code needs a valid code session (403 `code_required`) - for writes; a
    read route checks `code_ok` itself to decide what it may show (spec 10.5: number, department, organisation only)."""

    async def dep(request: Request) -> LinkContext:
        deps: PublicDeps = request.app.state.deps
        gate: PublicRateGate = request.app.state.gate
        pr = public_request(request)
        if pr.token_hash is None or pr.token_key is None:
            raise unavailable()
        link = await run_in_threadpool(deps.links.lookup, pr.token_hash)
        now = deps.clock()
        if link is None or not link.available(now):
            gate.failure(pr.net, pr.token_key)
            raise unavailable()
        gate.success(pr.token_key)
        read_only = link.read_only(now)
        code_ok = not link.require_code
        if link.require_code and deps.codes is not None and pr.session:
            code_ok = await run_in_threadpool(deps.codes.session_ok, link, pr.session)
        if write and read_only:
            raise PublicError(409, "read_only")
        if write and need_code and not code_ok:
            raise PublicError(403, "code_required")
        return LinkContext(link=link, request=pr, read_only=read_only, code_ok=code_ok, now=now)

    return dep


# ---------------------------------------------------------------- strict JSON and the 422 envelope


def _no_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in pairs:
        if k in out:
            raise ValueError("duplicate key")
        out[k] = v
    return out


def _no_constants(_name: str) -> Any:
    raise ValueError("NaN / Infinity")


def parse_json_object(raw: bytes) -> dict[str, Any]:
    """A JSON object from a request body, or ValueError: UTF-8 only, no BOM, no duplicate keys, no NaN / Infinity, an object at
    the top. Deep nesting fails as a ValueError too."""
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise ValueError("encoding") from None
    try:
        value = json.loads(text, object_pairs_hook=_no_duplicates, parse_constant=_no_constants)
    except RecursionError:
        raise ValueError("depth") from None
    if not isinstance(value, dict):
        raise ValueError("not an object")
    return value


def validation_fields(exc: ValidationError | RequestValidationError) -> list[dict[str, str]]:
    """`{field, code}` pairs only - never the input, the context or a documentation URL (review T16-2)."""
    errors = exc.errors(include_url=False, include_context=False, include_input=False) if isinstance(exc, ValidationError) else exc.errors()
    out: list[dict[str, str]] = []
    for e in errors[:20]:
        loc = [str(p) for p in e.get("loc", ()) if p not in ("body", "query", "path", "header")]
        out.append({"field": ".".join(loc)[:64] or "body", "code": str(e.get("type", "invalid"))[:40]})
    return out


async def read_json(request: Request, model: type[BaseModel]) -> Any:
    """The body as `model` (declare it with `model_config = ConfigDict(extra="forbid")`), or 422 `invalid`. The edge has
    already capped the body and bounded the time it may take to arrive."""
    raw = await request.body()
    try:
        data = parse_json_object(raw)
    except ValueError:
        raise PublicError(422, "invalid", fields=[{"field": "body", "code": "json"}]) from None
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        raise PublicError(422, "invalid", fields=validation_fields(exc)) from None


def parse_client_request_id(value: object) -> str:
    """A UUID (any case) -> lower case; else 422 for the field `client_request_id`."""
    if isinstance(value, str) and len(value) == 36 and CRID_RE.fullmatch(value.lower()):
        return value.lower()
    raise PublicError(422, "invalid", fields=[{"field": "client_request_id", "code": "uuid"}])


class Idempotency:
    """Spec 10.3: `client_request_id` per link (`scope = "link:<link_id>"`), stored 24 h by the RequestLog."""

    def __init__(self, log: RequestLog | None) -> None:
        self.log = log
        self._busy: set[tuple[str, str]] = set()
        self._lock = threading.Lock()

    @contextlib.contextmanager
    def _claim(self, key: tuple[str, str]):
        with self._lock:
            if key in self._busy:
                raise PublicError(409, "request_in_progress", retry_after_s=2)
            self._busy.add(key)
        try:
            yield
        finally:
            with self._lock:
                self._busy.discard(key)

    async def run(self, scope: str, crid: str, route: str, work: Callable[[], Awaitable[tuple[int, Mapping[str, Any]]]]) -> JSONResponse:
        if self.log is not None:
            prior = await run_in_threadpool(self.log.get, scope, crid)
            if prior is not None:
                if prior.route != route:
                    raise PublicError(409, "request_id_reused")
                return JSONResponse(dict(prior.body), status_code=prior.status, headers={"x-idempotent-replay": "1"})
        with self._claim((scope, crid)):
            status, body = await work()
            if self.log is not None and 200 <= status < 300:
                await run_in_threadpool(self.log.put, scope, crid, route, status, body)
        return JSONResponse(dict(body), status_code=status)


# ---------------------------------------------------------------- request models

class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class RedeemIn(_Strict):
    rid: str = Field(max_length=64)


class CodeSendIn(_Strict):
    pass


class CodeVerifyIn(_Strict):
    code: str = Field(max_length=32)


# ---------------------------------------------------------------- the app


class PublicApp:
    """The ASGI callable the listener serves (the edge around the FastAPI app), with handles for tests and the health route."""

    def __init__(self, edge: PublicEdge, api: FastAPI, deps: PublicDeps, gate: PublicRateGate, stats: PublicStats) -> None:
        self.edge = edge
        self.api = api
        self.deps = deps
        self.gate = gate
        self.stats = stats

    async def __call__(self, scope: dict[str, Any], receive: Callable, send: Callable) -> None:
        await self.edge(scope, receive, send)


def _error_response(status: int, code: str, extra: Mapping[str, Any] | None = None) -> JSONResponse:
    body: dict[str, Any] = {"code": code, **(extra or {})}
    headers: dict[str, str] = {}
    if "retry_after_s" in body:
        headers["Retry-After"] = str(int(body["retry_after_s"]))
    return JSONResponse(body, status_code=status, headers=headers)


def _uniform_404() -> Response:
    return Response(UNIFORM_404, status_code=404, media_type="application/json")


def create_public_app(deps: PublicDeps) -> PublicApp:
    limiter = deps.limiter or new_public_limiter(deps.clock, deps.limits)
    deps.limiter = limiter
    gate = PublicRateGate(limiter, deps.limits)
    stats = deps.stats or PublicStats(deps.clock)
    deps.stats = stats
    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    api.router.redirect_slashes = False  # never a redirect (the edge allows exact paths only anyway)
    api.state.deps = deps
    api.state.gate = gate
    in_flight = InFlight()
    idempotency = Idempotency(deps.requests)
    slots: dict[str, asyncio.Semaphore] = {}

    @api.exception_handler(PublicError)
    async def _public(_request: Request, exc: PublicError) -> Response:
        if exc.status == 404:
            return _uniform_404()
        return _error_response(exc.status, exc.code, exc.extra)

    @api.exception_handler(IntakeError)
    async def _intake(_request: Request, exc: IntakeError) -> Response:
        return _error_response(exc.status, exc.code, dict(exc.details))

    @api.exception_handler(RequestValidationError)
    async def _validation(_request: Request, exc: RequestValidationError) -> Response:
        return _error_response(422, "invalid", {"fields": validation_fields(exc)})

    @api.exception_handler(StarletteHTTPException)
    async def _http(_request: Request, exc: StarletteHTTPException) -> Response:
        if exc.status_code in (404, 405):
            return _uniform_404()
        return _error_response(exc.status_code, "http_error")

    @api.exception_handler(BodyTooLarge)
    async def _too_large(request: Request, _exc: BodyTooLarge) -> Response:
        pr = public_request(request)
        return _error_response(413, "too_large", {"max_bytes": pr.rule.max_body})

    @api.exception_handler(BodyDeadline)
    async def _deadline(_request: Request, _exc: BodyDeadline) -> Response:
        return _error_response(408, "body_timeout")

    @api.exception_handler(Exception)
    async def _server_error(_request: Request, _exc: Exception) -> Response:
        return _error_response(500, "server_error")  # Starlette re-raises; the edge logs the type and frame once

    # ---------------------------------------------------------------- the static shell and the health route

    shell_cache: dict[str, Any] = {}

    def shell_bytes() -> bytes:
        if deps.shell_dir is not None:
            p = Path(deps.shell_dir) / SHELL_FILE
            try:
                st = p.stat()
                if shell_cache.get("mtime") != st.st_mtime_ns:
                    shell_cache["bytes"], shell_cache["mtime"] = p.read_bytes(), st.st_mtime_ns
                return shell_cache["bytes"]
            except OSError:
                pass
        return FALLBACK_SHELL

    def shell() -> Response:
        return Response(shell_bytes(), media_type="text/html; charset=utf-8", headers={"Cache-Control": "no-store"})

    @api.get("/t/")
    async def page() -> Response:
        return shell()

    @api.get("/t/r/{rid}")
    async def redeem_page(rid: str) -> Response:  # the same shell; the id is read by the page script, never looked up here
        return shell()

    @api.get("/t/assets/{name}")
    async def asset(name: str) -> Response:
        m = _ASSET_RE.fullmatch(name)
        if deps.shell_dir is None or m is None:
            return _uniform_404()
        base = (Path(deps.shell_dir) / "assets").resolve()
        try:
            p = (base / name).resolve()
        except OSError:
            return _uniform_404()
        if p.parent != base or not p.is_file():
            return _uniform_404()
        cache = "public, max-age=31536000, immutable" if _HASHED_RE.fullmatch(name) else "no-cache"
        return FileResponse(p, media_type=ASSET_TYPES[m.group(1)], headers={"Cache-Control": cache})

    @api.get("/t/healthz")
    async def healthz() -> dict[str, bool]:
        return {"ok": True}

    # ---------------------------------------------------------------- the e-mail redeem link (spec 10.2)

    @api.post("/t/api/redeem")
    async def redeem(request: Request) -> Response:
        pr = public_request(request)
        if deps.redeems is None:
            raise unavailable()
        body: RedeemIn = await read_json(request, RedeemIn)
        rid = links.parse_redeem_id(body.rid)
        now = deps.clock()
        released = await run_in_threadpool(deps.redeems.release, links.redeem_hash(rid), now, REDEEM_MAX_USES) if rid else None
        link = await run_in_threadpool(deps.links.by_id, released[0]) if released else None
        if released is None or link is None or link.generation != released[1] or not link.available(now):
            gate.failure(pr.net)
            raise unavailable()
        token = links.derive_token(deps.key(), link.link_id, link.generation)
        gate.success(links.limiter_key(links.token_hash(token)))
        return JSONResponse({"token": token})

    # ---------------------------------------------------------------- option B: verification codes (spec 10.5)

    def _code_refused(exc: CodeRefused) -> PublicError:
        if exc.reason in ("locked", "rate_limited"):
            code = "code_locked" if exc.reason == "locked" else "rate_limited"
            return PublicError(429, code, retry_after_s=max(1, int(exc.retry_after_s + 0.999)))
        codes_map = {"malformed": "code_malformed", "no_code": "code_missing", "expired": "code_expired", "invalid": "code_invalid"}
        extra = {"attempts_left": exc.attempts_left} if exc.attempts_left is not None else {}
        return PublicError(422, codes_map.get(exc.reason, "code_invalid"), **extra)

    @api.post("/t/api/code/send")
    async def code_send(request: Request, ctx: LinkContext = Depends(link_context(need_code=False))) -> Response:
        await read_json(request, CodeSendIn)
        engine, sender = deps.codes, deps.code_sender
        if engine is None or sender is None:
            raise PublicError(503, "code_unavailable")
        if not ctx.link.require_code:
            raise PublicError(409, "code_not_required")
        channel = await run_in_threadpool(sender.channel_for, ctx.link)
        if channel not in ("whatsapp", "email"):
            raise PublicError(503, "code_unavailable")
        try:
            issued = await run_in_threadpool(engine.issue, ctx.link, channel)
        except CodeRefused as exc:
            raise _code_refused(exc) from None
        if not await run_in_threadpool(sender.send, ctx.link, issued.code_id, channel):
            await run_in_threadpool(engine.withdraw, ctx.link, issued.code_id)
            raise PublicError(503, "code_unavailable")
        return JSONResponse({"sent": True, "channel": channel, "expires_in_s": int(issued.expires_at - deps.clock())})

    @api.post("/t/api/code/verify")
    async def code_verify(request: Request, ctx: LinkContext = Depends(link_context(need_code=False))) -> Response:
        body: CodeVerifyIn = await read_json(request, CodeVerifyIn)
        if deps.codes is None:
            raise PublicError(503, "code_unavailable")
        if not ctx.link.require_code:
            raise PublicError(409, "code_not_required")
        try:
            verified = await run_in_threadpool(deps.codes.verify, ctx.link, body.code)
        except CodeRefused as exc:
            raise _code_refused(exc) from None
        return JSONResponse({"session": verified.session, "expires_in_s": int(verified.expires_at - deps.clock())})

    # ---------------------------------------------------------------- photos (spec 10.6)

    @contextlib.asynccontextmanager
    async def upload_slot():
        loop_key = str(id(asyncio.get_running_loop()))
        sem = slots.get(loop_key)
        if sem is None:
            sem = slots.setdefault(loop_key, asyncio.Semaphore(max(1, deps.upload_slots)))
        try:
            await asyncio.wait_for(sem.acquire(), deps.upload_slot_wait_s)
        except asyncio.TimeoutError:
            raise IntakeError("busy", 429, retry_after_s=5) from None
        try:
            yield
        finally:
            sem.release()

    @api.post("/t/api/photo")
    async def photo_upload(request: Request, ctx: LinkContext = Depends(link_context(write=True))) -> Response:
        photos, root = deps.photos, deps.attachments_root
        if photos is None or root is None:
            raise unavailable()
        link = ctx.link
        image_intake.check_photo_quota(await run_in_threadpool(photos.counts, link))
        if deps.storage is not None:
            await run_in_threadpool(deps.storage.admit, ctx.request.content_length or PHOTO_MAX)
        with in_flight.claim(link.link_id):
            async with upload_slot():
                raw = await request.body()
                try:
                    form = parse_form(raw, boundary_of(ctx.request.content_type), PHOTO_FIELDS)
                except MultipartError as exc:
                    raise PublicError(422, "invalid", fields=[{"field": "form", "code": exc.code}]) from None
                del raw
                crid = parse_client_request_id(form["client_request_id"].text())
                data = form["file"].data
                del form

                async def work() -> tuple[int, Mapping[str, Any]]:
                    image = await run_in_threadpool(image_intake.reencode, data, wait_s=deps.decode_wait_s)
                    stored = await run_in_threadpool(image_intake.store_image, root, link.ticket_id, image)
                    if deps.storage is not None:
                        deps.storage.note(stored.bytes)
                    try:
                        answer = await run_in_threadpool(photos.record, link, stored, crid)
                    except Exception:
                        image_intake.remove_stored(root, stored.rel_path)
                        if deps.storage is not None:
                            deps.storage.note(-stored.bytes)
                        raise
                    return 201, answer

                return await idempotency.run(f"link:{link.link_id}", crid, "/t/api/photo", work)

    @api.get("/t/api/photo/{attachment_id}")
    async def photo_get(attachment_id: str, ctx: LinkContext = Depends(link_context())) -> Response:
        photos, root = deps.photos, deps.attachments_root
        if photos is None or root is None:
            raise unavailable()
        if not ctx.code_ok:
            raise PublicError(403, "code_required")  # ticket content stays hidden until the code (spec 10.5)
        f = await run_in_threadpool(photos.open, ctx.link, attachment_id)
        if f is None:
            raise unavailable()
        try:
            path = image_intake.confine(root, f.path)
        except image_intake.StorePathError:
            raise unavailable() from None
        if not path.is_file():
            raise unavailable()
        headers = photo_headers(f.ticket_number)
        media = headers.pop("Content-Type")
        return FileResponse(path, media_type=media, headers=headers)

    for router in deps.extra_routers:
        api.include_router(router)

    edge = PublicEdge(api, switch=deps.switch, gate=gate, trusted=deps.trusted_proxies, stats=stats, rules=deps.rules)
    return PublicApp(edge, api, deps, gate, stats)
