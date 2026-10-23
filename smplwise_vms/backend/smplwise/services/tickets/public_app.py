"""CR-038 section 10: the public app - a SECOND, minimal FastAPI app that holds only the `/t/*` routes, served by its own
listener (public_server) on container port 18093, behind the edge (public_http.PublicEdge). It shares nothing with the main
app: no routers, no middleware, no exception handlers, no static mount, no session, no cookie, no CORS.

Built here (the parts that need no ticket table; slice 4 implements the ports of public_ports.py and adds the ticket routes):
- the static shell (`GET /t/`, `GET /t/r/<rid>` - the same bytes for everyone, no lookup, no side effect; a link-preview fetch
  learns and changes nothing), the bundle's assets (`/t/assets/<name>`), `GET /t/healthz`;
- `POST /t/api/redeem` (the e-mail form of a link: at most 3 token releases per redeem id within 24 h);
- `POST /t/api/code/send`, `POST /t/api/code/verify` (option B, codes.CodeEngine);
- `POST /t/api/photo` (the hostile-image pipeline, one upload in flight per link, the photo quotas, the storage cap BEFORE the
  body is read, idempotent by `client_request_id`) and `GET /t/api/photo/<id>` (a re-encoded photo of the link's ticket).
  Upload resources (code review V2): the memory bound is BYTES - UPLOAD_MEMORY_BYTES (32 MiB) shared by the declared bodies
  in flight (a chunked body counts as the cap) - taken before the body is read, refused `busy` after UPLOAD_SLOT_WAIT_S
  without cost; once the body phase starts, the upload pays one unit of the link's photo budget whatever follows (a trickle
  cut at 408, a 413, a disconnect, a replay, a refusal - RequestCost.body_phase), so a link holder trickling bodies spends
  10 attempts an hour, not nothing; and at most PROCESSING_SLOTS (2) uploads use worker threads at once (quota read,
  decode, store, record), so with THREADPOOL_TOKENS (6) at least four threads always remain for token lookups;
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
import dataclasses
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
from starlette.requests import ClientDisconnect

from . import cost_files, image_intake, links
from .codes import CodeEngine, CodeRefused
from .cost_files import photo_headers
from .image_intake import InFlight, IntakeError, StorageMeter
from .module_key import ModuleKeyError
from .public_http import (PHOTO_MAX, ROUTES, STATE_KEY, UNIFORM_404, BodyDeadline, BodyTooLarge, PublicEdge, PublicRequest,
                          RouteRule)
from .public_log import SERVER_LOG, PublicStats, exception_summary
from .public_multipart import FieldRule, MultipartError, boundary_of, parse_form
from .public_ports import CodeEvents, CodeSender, LinkRecord, LinkStore, ModuleSwitch, PhotoSink, RedeemStore, RequestLog
from .ratelimit import DEFAULT_TRUSTED_PROXY_CIDRS, Network, PublicLimits, PublicRateGate, ScopedRateLimiter, new_public_limiter, parse_trusted_cidrs

REDEEM_MAX_USES = 3
CRID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
# upload bodies held in memory at once, in BYTES of their declared length (a chunked body counts as PHOTO_MAX): four
# full-size photos. Taken before the body is read; waiting for it costs nothing and ends `busy` after UPLOAD_SLOT_WAIT_S.
UPLOAD_MEMORY_BYTES = 32 * 1024 * 1024
UPLOAD_SLOT_WAIT_S = 5.0
# uploads using worker threads at once (quota read, decode, store, record). Fewer than the listener's THREADPOOL_TOKENS (6):
# uploads blocked on a slow disk (fsync), the shared SQLite write gate or the decoder can never take the threads a token
# lookup needs (four always remain).
PROCESSING_SLOTS = 2
PROCESSING_WAIT_S = 30.0
PROBE_RE = re.compile(r"[A-Za-z0-9_-]{16,64}")
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
# slice 9: an invoice page or PDF of a cost claim (11A.6) with its optional document grouping and the vendor's own file label
CLAIM_FILE_FIELDS = {"file": FieldRule(file=True, max_bytes=cost_files.PDF_MAX_BYTES), "client_request_id": FieldRule(file=False, max_bytes=64),
                     "document_key": FieldRule(file=False, max_bytes=32, required=False), "page_no": FieldRule(file=False, max_bytes=2, required=False),
                     "name": FieldRule(file=False, max_bytes=240, required=False)}


class PublicError(Exception):
    """An answer of the public app: status + code (+ small extra fields such as retry_after_s / attempts_left / fields)."""

    def __init__(self, status: int, code: str, **extra: Any) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.extra = extra


def unavailable() -> PublicError:
    return PublicError(404, "link_unavailable")


class ClaimFileSink:
    """Slice 9's port for the invoice files of a claim (public_claims.SqlClaimFileSink implements it): `check_open` (the claim of
    the link's assignment accepts uploads now - else PublicError 409), `check_quota` (30 pending files per link - 409
    `file_limit`), `record` (the pending `ticket_cost_files` row + the request row in ONE transaction, W5; raising makes the route
    delete the stored file; a duplicate file of the same claim is 409 `duplicate_file`)."""

    def check_open(self, link: LinkRecord) -> None:  # pragma: no cover - interface
        raise NotImplementedError

    def check_quota(self, link: LinkRecord) -> None:  # pragma: no cover - interface
        raise NotImplementedError

    def record(self, link: LinkRecord, stored: Any, crid: str, document_key: str | None, page_no: int | None,
               name: str) -> Mapping[str, Any]:  # pragma: no cover - interface
        raise NotImplementedError


def _opt_text(form: Mapping[str, Any], key: str) -> str | None:
    part = form.get(key)
    if part is None:
        return None
    try:
        return part.text()
    except Exception:  # noqa: BLE001 - an undecodable field is an invalid field
        raise PublicError(422, "invalid", fields=[{"field": key, "code": "encoding"}]) from None


# ---------------------------------------------------------------- the dependencies of one public app


@dataclass
class PublicDeps:
    """Everything the public app needs. Slice 4 builds it from the module's SQL store and the add-on settings (wiring checklist
    in docs/changes/CR-038-PUBLIC-CORE-NOTES.md); tests build it from fakes."""

    links: LinkStore
    switch: ModuleSwitch
    key: Callable[[str | None], bytes]  # ModuleKey: the key of a row's key_id (None = the current key)
    trusted_proxies: Sequence[Network] = field(default_factory=lambda: parse_trusted_cidrs(DEFAULT_TRUSTED_PROXY_CIDRS))
    requests: RequestLog | None = None
    redeems: RedeemStore | None = None
    codes: CodeEngine | None = None
    code_sender: CodeSender | None = None
    code_events: CodeEvents | None = None
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
    upload_memory_bytes: int = UPLOAD_MEMORY_BYTES
    upload_slot_wait_s: float = UPLOAD_SLOT_WAIT_S
    processing_slots: int = PROCESSING_SLOTS
    processing_wait_s: float = PROCESSING_WAIT_S
    # where a TRUSTED proxy puts the client address (V3): cf-connecting-ip (cloudflared) or x-forwarded-for (last hop)
    client_ip_header: str = "cf-connecting-ip"
    # TK255: the public path prefix the listener serves itself under (`/t` routes stay the internal names) and whether the
    # old `/t/...` links still work; the default keeps `/t` alone (what every existing test and caller meant)
    path_prefix: str = "t"
    legacy_t_paths: bool = True
    # slice 9 (11A.5): a link that no longer serves the page may still open the CLAIM step until the claim's own window ends -
    # `claim_window(link, now)` answers that window's end (epoch seconds) or None; asked ONLY for a token that matched a row
    claim_window: Callable[[LinkRecord, float], float | None] | None = None
    claim_files: "ClaimFileSink | None" = None
    # TKRFQVP (RFQ contract 15.1): the e-mail form of an RFQ vendor link shares `/t/r/<rid>` and this redeem route - asked ONLY when the id
    # is not a ticket redeem id: `rfq_redeem(rid_hash, now, max_uses)` answers the RFQ token (domain `rfq`) or None
    rfq_redeem: Callable[[str, float, int], str | None] | None = None


@dataclass(frozen=True)
class UploadGuards:
    """The upload protections of one public app (create_public_app's own objects), for an extra router's upload route:
    `in_flight.claim(link_id)` (one upload per link, 429 `busy`), `memory(need, link_id)` (the upload memory budget),
    `processing()` (the worker-thread slots) and `decode()` (one upload waiting for the decoder)."""

    in_flight: InFlight
    memory: Callable[[int, str], Any]
    processing: Callable[[], Any]
    decode: Callable[[], Any]


@dataclass(frozen=True)
class LinkContext:
    link: LinkRecord
    request: PublicRequest
    read_only: bool
    code_ok: bool
    now: float
    claim_mode: bool = False  # slice 9: the link serves the claim step only (its `expires_at` is the claim window's end)


def public_request(request: Request) -> PublicRequest:
    pr = (request.scope.get("state") or {}).get(STATE_KEY)
    if not isinstance(pr, PublicRequest):
        raise unavailable()  # not routed through the edge: never served
    return pr


def spend_budget(request: Request) -> None:
    """For a route of slice 4 / 9 once its effect is stored (a status, a note, an ETA, a return, a claim): spend one unit of the
    per-token budget of the route's kind (writes 20 / hour). The edge only CHECKED the budget; a refused, replayed or failed
    JSON write never spends it. An UPLOAD route (claim file) calls `begin_body(request)` instead, before reading its body."""
    public_request(request).cost.effect()


def begin_body(request: Request) -> None:
    """An upload route (photo, invoice file) is about to read its body: from here on the upload costs one unit of its budget
    whatever happens (code review V2; RequestCost.body_phase). Call it AFTER the slot / memory wait (a `busy` refusal costs
    nothing) and BEFORE the first read."""
    public_request(request).cost.body_phase()


def link_context(*, write: bool = False, need_code: bool = True, allow_claim: bool = False,
                 claim_surface: bool = False) -> Callable[[Request], Awaitable[LinkContext]]:
    """The dependency of every token route (see the module docstring). `write`: refuse during the read-only grace (409
    `read_only`); `need_code`: a link that requires a code needs a valid code session (403 `code_required`) - for writes; a
    read route checks `code_ok` itself to decide what it may show (spec 10.5: number, department, organisation only).
    `claim_surface` (TKSTAFF1, security design R2): a route of the cost-claim step - a STAFF link (an internal employee's no-login
    link) answers the uniform 404 there, whatever claim row exists; a staff link never enters claim mode either."""

    async def dep(request: Request) -> LinkContext:
        deps: PublicDeps = request.app.state.deps
        pr = public_request(request)
        if pr.token_hash is None or pr.token_key is None:
            raise unavailable()
        link = await run_in_threadpool(deps.links.lookup, pr.token_hash)
        now = deps.clock()
        claim_mode = False
        staff = link is not None and bool(getattr(link, "no_money", getattr(link, "kind", "external") == "staff"))  # + review F4
        if link is not None and not link.available(now) and allow_claim and deps.claim_window is not None and not staff:
            # slice 9 (11A.5): one more read, only for a token that matched a link row - nothing is learned without a real token
            until = await run_in_threadpool(deps.claim_window, link, now)
            if until is not None and now < until:
                link = dataclasses.replace(link, expires_at=until, grace_until=None, revoked=False)
                claim_mode = True
        if link is None or not link.available(now):
            pr.cost.unknown()
            raise unavailable()
        if claim_surface and staff:
            raise unavailable()  # R2: byte-identical to an unknown token (no budget spent: nothing was stored)
        pr.cost.proved(link.link_id)
        read_only = link.read_only(now) or claim_mode
        code_ok = not link.require_code
        if link.require_code and deps.codes is not None and pr.session:
            code_ok = await run_in_threadpool(deps.codes.session_ok, link, pr.session)
        if write and read_only:
            raise PublicError(409, "read_only")
        if write and need_code and not code_ok:
            raise PublicError(403, "code_required")
        return LinkContext(link=link, request=pr, read_only=read_only, code_ok=code_ok, now=now, claim_mode=claim_mode)

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


def validation_fields(exc: ValidationError | RequestValidationError, model: type[BaseModel] | None = None) -> list[dict[str, str]]:
    """`{field, code}` pairs only - never the input, the context or a documentation URL (review T16-2). A field name is
    reported only when it is one the model declares: an unknown key (`extra_forbidden`) is the CLIENT's text and is reported
    as `body`, so nothing the client sent is echoed back."""
    errors = exc.errors(include_url=False, include_context=False, include_input=False) if isinstance(exc, ValidationError) else exc.errors()
    declared = set(model.model_fields) if model is not None else None
    out: list[dict[str, str]] = []
    for e in errors[:20]:
        kind = str(e.get("type", "invalid"))[:40]
        loc = [str(p) for p in e.get("loc", ()) if p not in ("body", "query", "path", "header")]
        if kind == "extra_forbidden" or not loc or (declared is not None and loc[0] not in declared):
            field_name = "body"
        else:
            field_name = ".".join(p if (p.isascii() and p.replace("_", "").isalnum()) else "?" for p in loc)[:64]
        out.append({"field": field_name, "code": kind})
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
        raise PublicError(422, "invalid", fields=validation_fields(exc, model)) from None


def parse_client_request_id(value: object) -> str:
    """A UUID (any case) -> lower case; else 422 for the field `client_request_id`."""
    if isinstance(value, str) and len(value) == 36 and CRID_RE.fullmatch(value.lower()):
        return value.lower()
    raise PublicError(422, "invalid", fields=[{"field": "client_request_id", "code": "uuid"}])


def idempotency_scope(link: LinkRecord) -> str:
    """Spec 10.3: `client_request_id` is unique per link GENERATION (`link:<link_id>:<generation>`, code review V19): an id
    reused after "new link" is a new request, not a replay of the old message's answer."""
    return f"link:{link.link_id}:{link.generation}"


class Idempotency:
    """Spec 10.3: `client_request_id` per link generation (idempotency_scope), stored 24 h by the RequestLog."""

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
        """Claim (scope, id) in this process FIRST, then look for a stored answer, then work: a duplicate that arrives while
        the first runs is 409 `request_in_progress` (the page retries), one that arrives after it is the replay - never a
        second effect. Only 2xx answers are stored (a 429 / 409 must not be replayed forever)."""
        with self._claim((scope, crid)):
            if self.log is not None:
                prior = await run_in_threadpool(self.log.get, scope, crid)
                if prior is not None:
                    if prior.route != route:
                        raise PublicError(409, "request_id_reused")
                    return JSONResponse(dict(prior.body), status_code=prior.status, headers={"x-idempotent-replay": "1"})
            status, body = await work()
            if self.log is not None and 200 <= status < 300:
                try:
                    await run_in_threadpool(self.log.put, scope, crid, route, status, body)
                except Exception as exc:  # noqa: BLE001 - the effect happened: the client must get its success, not a 500 to retry into a duplicate
                    SERVER_LOG.warning("public listener: request id not stored for %s (%s)", route, exception_summary(exc))
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
        self.partner: Any = None  # PARTNERAPI113-295: the /p/v1 partner app (services/partner/api_app.py), attached by public_runtime

    @property
    def trusted(self) -> tuple[Network, ...]:
        """The trusted proxy networks (public_server's per-network connection budget exempts them: cloudflared carries every
        client over its own connections)."""
        return tuple(self.deps.trusted_proxies)

    async def __call__(self, scope: dict[str, Any], receive: Callable, send: Callable) -> None:
        # PARTNERAPI113-295 (owner answer 164): `/p/...` belongs to the partner app - its own guard, credential, limits and answers; the
        # tickets edge (and its module switch) never sees it. Without a partner app the path falls through to the edge's uniform 404.
        if self.partner is not None and scope.get("type") in ("http", "websocket") and str(scope.get("path") or "").startswith("/p/"):
            await self.partner(scope, receive, send)
            return
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
    slots: dict[str, Any] = {}  # per running loop (the listener has one; tests may run several)

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

    @api.exception_handler(ClientDisconnect)
    async def _gone(_request: Request, _exc: ClientDisconnect) -> Response:
        # the client went away while its body was read: nothing can be answered, and it is not a server error (no 5xx in
        # the health counters, no error line a client could produce at will)
        return Response(status_code=499)

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

    def shell(request: Request) -> Response:
        # TK255: the built page names its assets `/t/assets/...`; under another prefix they must name that prefix (the page's own
        # API calls and address bar follow the path it was opened on - frontend/src/public-ticket/base.ts)
        body = shell_bytes()
        prefix = public_request(request).prefix
        if prefix != "t":
            body = body.replace(b"/t/assets/", b"/" + prefix.encode("ascii") + b"/assets/")
        return Response(body, media_type="text/html; charset=utf-8", headers={"Cache-Control": "no-store"})

    @api.get("/t/")
    async def page(request: Request) -> Response:
        return shell(request)

    @api.get("/t/r/{rid}")
    async def redeem_page(rid: str, request: Request) -> Response:  # the same shell; the id is read by the page script, never looked up here
        return shell(request)

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
    async def healthz(request: Request) -> dict[str, bool]:
        pr = public_request(request)
        client = request.scope.get("client")
        nonce = request.headers.get("x-ticket-probe")
        stats.note_probe(peer=client[0] if isinstance(client, (list, tuple)) and client else None, source=pr.source,
                         nonce=nonce if nonce is not None and PROBE_RE.fullmatch(nonce) else None)
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
        if (released is not None and link is not None and link.generation == released[1] and not link.available(now)
                and deps.claim_window is not None and not getattr(link, "no_money", getattr(link, "kind", "external") == "staff")):
            # TK251 review R2 A-2: the e-mail form of a cost message (cost_rejected / cost_reopened) - a link that no longer serves
            # the page may still open the CLAIM step, exactly as link_context decides it (same generation, claim window open)
            until = await run_in_threadpool(deps.claim_window, link, now)
            if until is not None and now < until:
                link = dataclasses.replace(link, expires_at=until, grace_until=None, revoked=False)
        if released is None and rid is not None and deps.rfq_redeem is not None:
            # TKRFQVP: not a ticket redeem id - maybe an RFQ one (one more indexed read; ONE failure is still counted when neither)
            rfq_token = await run_in_threadpool(deps.rfq_redeem, links.redeem_hash(rid), now, REDEEM_MAX_USES)
            if rfq_token is not None:
                gate.success(links.limiter_key(links.token_hash(rfq_token)), counted=True)
                return JSONResponse({"token": rfq_token, "kind": "rfq"})
        if released is None or link is None or link.generation != released[1] or not link.available(now):
            gate.failure(pr.net, kind="redeem", lookup=rid is not None)  # the redeem route's own exit cost
            raise unavailable()
        try:
            token = links.derive_token(deps.key(link.key_id), link.link_id, link.generation)
        except ModuleKeyError:
            raise unavailable() from None  # no key (a /data restored without secrets/): fail closed, say nothing
        gate.success(links.limiter_key(links.token_hash(token)), counted=True)  # its first API call passes a flood
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
    async def code_send(request: Request, ctx: LinkContext = Depends(link_context(need_code=False, allow_claim=True))) -> Response:
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
        except ModuleKeyError:
            raise PublicError(503, "code_unavailable") from None
        if not await run_in_threadpool(sender.send, ctx.link, issued.code_id, channel):
            await run_in_threadpool(engine.withdraw, ctx.link, issued.code_id)
            raise PublicError(503, "code_unavailable")
        return JSONResponse({"sent": True, "channel": channel, "expires_in_s": int(issued.expires_at - deps.clock())})

    def _client_key(ctx: LinkContext) -> str:
        """The access-row device key (links.client_key: network + UA family under the module key) - "how many devices", nothing
        more. Empty when the key is unusable (the event rows then go without a device)."""
        try:
            return links.client_key(deps.key(ctx.link.key_id), ctx.request.net, links.ua_family(ctx.request.user_agent))
        except ModuleKeyError:
            return ""

    async def _record(fn: Callable[..., None], *args: Any, **kw: Any) -> None:
        """A CodeEvents call: the engine already decided the answer, so a failure to record is logged (type only) and never
        turns the answer into a 500."""
        try:
            await run_in_threadpool(fn, *args, **kw)
        except Exception as exc:  # noqa: BLE001
            SERVER_LOG.warning("public listener: code event not recorded (%s)", exception_summary(exc))

    @api.post("/t/api/code/verify")
    async def code_verify(request: Request, ctx: LinkContext = Depends(link_context(need_code=False, allow_claim=True))) -> Response:
        body: CodeVerifyIn = await read_json(request, CodeVerifyIn)
        if deps.codes is None:
            raise PublicError(503, "code_unavailable")
        if not ctx.link.require_code:
            raise PublicError(409, "code_not_required")
        events = deps.code_events
        try:
            verified = await run_in_threadpool(deps.codes.verify, ctx.link, body.code)
        except CodeRefused as exc:
            if events is not None and (exc.reason == "invalid" or exc.just_locked):
                until = deps.clock() + exc.retry_after_s if exc.just_locked else None
                await _record(events.refused, ctx.link, exc.reason, _client_key(ctx), just_locked=exc.just_locked, locked_until=until)
            raise _code_refused(exc) from None
        except ModuleKeyError:
            raise PublicError(503, "code_unavailable") from None
        if events is not None:
            await _record(events.verified, ctx.link, _client_key(ctx))
        return JSONResponse({"session": verified.session, "expires_in_s": int(verified.expires_at - deps.clock())})

    # ---------------------------------------------------------------- photos (spec 10.6)

    def _per_loop(name: str, make: Callable[[], Any]) -> Any:
        key = f"{name}:{id(asyncio.get_running_loop())}"
        obj = slots.get(key)
        if obj is None:
            obj = slots.setdefault(key, make())
        return obj

    @contextlib.asynccontextmanager
    async def loop_slot(name: str, size: int, wait_s: float, *, status: int = 429):
        """An asyncio semaphore of this app on the running loop: `processing` bounds the uploads using worker threads,
        `decode` lets at most one upload at a time wait for the decoder IN A WORKER THREAD - without it, uploads waiting for
        the (process-wide) decode slot could hold every worker thread and stall every token lookup meanwhile."""
        sem = _per_loop(name, lambda: asyncio.Semaphore(max(1, size)))
        try:
            await asyncio.wait_for(sem.acquire(), wait_s)
        except asyncio.TimeoutError:
            raise IntakeError("busy", status, retry_after_s=5) from None
        try:
            yield
        finally:
            sem.release()

    @contextlib.asynccontextmanager
    async def upload_memory(need: int, link_id: str):
        """`need` bytes of the upload memory budget (UPLOAD_MEMORY_BYTES) for the request's life; `busy` after the wait."""
        budget: _ByteBudget = _per_loop("memory", lambda: _ByteBudget(deps.upload_memory_bytes))
        n = max(1, min(int(need), budget.total))
        if not await budget.acquire(n, deps.upload_slot_wait_s):
            stats.note_link(link_id, "busy")
            raise IntakeError("busy", 429, retry_after_s=5)
        try:
            yield
        finally:
            await budget.release(n)

    def processing():
        return loop_slot("processing", deps.processing_slots, deps.processing_wait_s, status=503)

    def decode_admission():
        return loop_slot("decode", 1, deps.decode_wait_s)

    # RFQ-VENDOR-UPLOAD (RFQ contract 19.10): the RFQ router's upload route (public_rfq, an extra router) takes the SAME protections
    # as the photo / invoice-file uploads - one upload in flight per link, the upload memory budget, the processing and decoder
    # admission - through this handle, never a copy of them
    api.state.uploads = UploadGuards(in_flight=in_flight, memory=upload_memory, processing=processing, decode=decode_admission)

    @api.post("/t/api/photo")
    async def photo_upload(request: Request, ctx: LinkContext = Depends(link_context(write=True))) -> Response:
        photos, root = deps.photos, deps.attachments_root
        if photos is None or root is None:
            raise unavailable()
        link = ctx.link
        with in_flight.claim(link.link_id, on_busy=lambda: stats.note_link(link.link_id, "busy")):
            async with upload_memory(ctx.request.content_length or PHOTO_MAX, link.link_id):
                if deps.storage is not None:  # spec 10.6: the installation cap BEFORE the body is read
                    await run_in_threadpool(deps.storage.admit, ctx.request.content_length or PHOTO_MAX)
                begin_body(request)  # V2: from here on this upload costs one unit of the photo budget, whatever follows
                # the body into ONE buffer of ours (request.body() would keep a second, cached copy for the request's life);
                # the edge bounds its size, the time it may take and the pauses between its chunks
                raw = bytearray()
                async for chunk in request.stream():
                    raw += chunk
                try:
                    form = parse_form(raw, boundary_of(ctx.request.content_type), PHOTO_FIELDS)
                except MultipartError as exc:
                    raise PublicError(422, "invalid", fields=[{"field": "form", "code": exc.code}]) from None
                finally:
                    del raw
                crid = parse_client_request_id(form["client_request_id"].text())
                data = form["file"].data
                del form

                async def work() -> tuple[int, Mapping[str, Any]]:
                    async with processing():
                        # the quotas inside the idempotent part: a retry of an upload that reached the 30th photo is its replay
                        image_intake.check_photo_quota(await run_in_threadpool(photos.counts, link))
                        async with decode_admission():
                            image = await run_in_threadpool(image_intake.reencode, data, wait_s=deps.decode_wait_s)
                        stats.observe_decode(image.decode_ms)
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

                return await idempotency.run(idempotency_scope(link), crid, "/t/api/photo", work)

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

    # ---------------------------------------------------------------- invoice files of a cost claim (slice 9, spec 11A.6 / 11A.6A)

    @api.post("/t/api/claim/file")
    async def claim_file(request: Request, ctx: LinkContext = Depends(link_context(allow_claim=True, claim_surface=True))) -> Response:
        """One photographed page or one PDF of the vendor's claim, stored as a PENDING file (24 h) - the submission references it.
        The photo route's protections apply (one upload in flight per link, the upload memory budget, the storage cap before
        the body, V2's body-phase cost, the processing and decoder admission, idempotent by `client_request_id`); a
        code-protected link needs its code session."""
        sink, root = deps.claim_files, deps.attachments_root
        if sink is None or root is None:
            raise unavailable()
        if not ctx.code_ok:
            raise PublicError(403, "code_required")
        link = ctx.link
        await run_in_threadpool(sink.check_open, link)
        with in_flight.claim(link.link_id, on_busy=lambda: stats.note_link(link.link_id, "busy")):
            need = ctx.request.content_length or ctx.request.rule.max_body
            async with upload_memory(need, link.link_id):
                if deps.storage is not None:
                    await run_in_threadpool(deps.storage.admit, need)
                begin_body(request)  # V2: from here on this upload costs one unit of the invoice-file budget
                raw = bytearray()
                async for chunk in request.stream():
                    raw += chunk
                try:
                    form = parse_form(raw, boundary_of(ctx.request.content_type), CLAIM_FILE_FIELDS)
                except MultipartError as exc:
                    raise PublicError(422, "invalid", fields=[{"field": "form", "code": exc.code}]) from None
                finally:
                    del raw
                crid = parse_client_request_id(form["client_request_id"].text())
                try:
                    doc_key, page_no = cost_files.page_fields(_opt_text(form, "document_key"), _opt_text(form, "page_no"))
                except ValueError as exc:
                    raise PublicError(422, "invalid", fields=[{"field": str(exc), "code": "invalid"}]) from None
                name = _opt_text(form, "name") or ""
                data = form["file"].data
                del form

                async def work() -> tuple[int, Mapping[str, Any]]:
                    from . import cost_storage

                    async with processing():
                        kind = cost_storage.check(data)
                        await run_in_threadpool(sink.check_quota, link)
                        if kind == "photo":
                            async with decode_admission():
                                stored = await run_in_threadpool(cost_storage.store_photo, root, link.ticket_id, data, wait_s=deps.decode_wait_s)
                        else:
                            stored = await run_in_threadpool(cost_storage.store_pdf, root, link.ticket_id, data)
                        if deps.storage is not None:
                            deps.storage.note(stored.bytes)
                        try:
                            answer = await run_in_threadpool(sink.record, link, stored, crid, doc_key, page_no, name)
                        except Exception:
                            cost_storage.remove(root, stored.rel_path)
                            if deps.storage is not None:
                                deps.storage.note(-stored.bytes)
                            raise
                    return 201, answer

                return await idempotency.run(idempotency_scope(link), crid, "/t/api/claim/file", work)

    for router in deps.extra_routers:
        api.include_router(router)

    edge = PublicEdge(api, switch=deps.switch, gate=gate, trusted=deps.trusted_proxies, stats=stats, rules=deps.rules,
                      client_ip_header=deps.client_ip_header, path_prefix=deps.path_prefix, legacy_t=deps.legacy_t_paths)
    return PublicApp(edge, api, deps, gate, stats)


class _ByteBudget:
    """An asyncio byte semaphore (code review 5.3: bytes, not slots, for upload memory). One per loop."""

    def __init__(self, total: int) -> None:
        self.total = max(1, int(total))
        self.free = self.total
        self._cond = asyncio.Condition()

    async def acquire(self, n: int, wait_s: float) -> bool:
        async with self._cond:
            try:
                await asyncio.wait_for(self._cond.wait_for(lambda: self.free >= n), wait_s)
            except asyncio.TimeoutError:
                return False
            self.free -= n
            return True

    async def release(self, n: int) -> None:
        async with self._cond:
            self.free += n
            self._cond.notify_all()
