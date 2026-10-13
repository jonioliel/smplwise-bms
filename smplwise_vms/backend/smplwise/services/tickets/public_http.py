"""CR-038 public listener: the edge - a pure ASGI layer in front of the public FastAPI app (public_app), outside everything else.

Per request, before any database read and before one byte of the body is read:
1. module off -> the uniform 404 (spec 6 / C8: the listener runs on the add-on option alone and answers 404 to everything);
2. (method, path) must match one rule of ROUTES - the spec's public routes and nothing else - or the uniform 404 (no route
   enumeration: an unknown path, a known path with another method, OPTIONS, HEAD all answer the same bytes);
3. the client network (/24 or /64; CF-Connecting-IP only from a trusted peer - ratelimit.client_network);
4. the token header (`X-Ticket-Token`) of a token route, strictly parsed, hashed - never stored, never logged;
5. the rate gate (ratelimit.PublicRateGate): 429 with `Retry-After`, or - a token route without a usable token - a counted
   failure and the uniform 404, with no lookup at all;
6. the body rules of the route: none (a GET with a body is 413), JSON (`Content-Type: application/json` or 415; 16 KiB) or
   multipart (`multipart/form-data` or 415; 8 MiB + 64 KiB for a photo, 10 MiB + 64 KiB for an invoice file); a declared
   Content-Length over the cap is 413 before anything is read; a chunked body is counted as it streams;
7. a body READ DEADLINE from the start of the request - 10 s for JSON, 60 s for an upload: a 1 KB/s upload cannot hold a parser
   (spec 10.1); past it, 408 and the connection closes;
8. the request's `Cookie` header is removed before the app sees it; the app never sets one (any `Set-Cookie` is dropped);
9. every response carries the headers of spec 10.4 (CSP without 'unsafe-inline', frame / referrer / sniffing / opener /
   resource / permissions policies, `X-Robots-Tag`), `Cache-Control: no-store` unless the route set its own, no `Server`, no
   CORS headers; an answer sent before the request body was fully read closes the connection (an unread body is never
   parsed as the next request, and a client trickling one cannot keep the connection);
10. an unhandled error is answered 500 `{"code": "server_error"}` and logged as its type and innermost frame only.
The route's facts travel to the app in `scope["state"]["sw_public"]` (PublicRequest)."""
from __future__ import annotations

import asyncio
import json
import re
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Sequence

from . import image_intake, links
from .cost_files import PDF_MAX_BYTES
from .public_log import SERVER_LOG, PublicStats, exception_summary, log_request
from .public_ports import ModuleSwitch
from .ratelimit import TOKEN_KINDS, Network, PublicRateGate, client_network

KiB = 1024
MULTIPART_SLACK = 64 * KiB
JSON_MAX = 16 * KiB
CLAIM_JSON_MAX = 32 * KiB
PHOTO_MAX = image_intake.MAX_BYTES + MULTIPART_SLACK
CLAIM_FILE_MAX = PDF_MAX_BYTES + MULTIPART_SLACK
JSON_DEADLINE_S = 10.0
UPLOAD_DEADLINE_S = 60.0
STATE_KEY = "sw_public"

CSP = ("default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; form-action 'none'; "
       "frame-ancestors 'none'; base-uri 'none'; manifest-src 'none'")
SECURITY_HEADERS: tuple[tuple[bytes, bytes], ...] = (
    (b"content-security-policy", CSP.encode("ascii")),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"no-referrer"),
    (b"x-content-type-options", b"nosniff"),
    (b"cross-origin-opener-policy", b"same-origin"),
    (b"cross-origin-resource-policy", b"same-origin"),
    (b"permissions-policy", b"camera=(), microphone=(), geolocation=(), payment=(), usb=()"),
    (b"x-robots-tag", b"noindex, nofollow"),
)
_OURS = frozenset(k for k, _ in SECURITY_HEADERS)
_DROPPED_RESPONSE = frozenset({b"set-cookie", b"server", b"x-powered-by", b"connection"}) | _OURS
UNIFORM_404 = b'{"code":"link_unavailable"}'
_ID = r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}"


@dataclass(frozen=True)
class RouteRule:
    method: str
    pattern: str
    template: str
    kind: str
    body: str = "none"  # none | json | multipart
    max_body: int = 0
    deadline_s: float = JSON_DEADLINE_S
    regex: re.Pattern[str] = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "regex", re.compile(self.pattern))


def _json(path: str, kind: str, max_body: int = JSON_MAX) -> RouteRule:
    return RouteRule("POST", re.escape(path), path, kind, "json", max_body)


# Spec 10.3 + 11A.12: the whole public surface. Routes of later slices are listed here so the edge (limits, kinds, deadlines)
# is defined once; a rule without a handler answers the uniform 404 like any unknown path.
ROUTES: tuple[RouteRule, ...] = (
    RouteRule("GET", r"/t/", "/t/", "static"),
    RouteRule("GET", r"/t/r/[A-Za-z0-9_-]{1,64}", "/t/r/{rid}", "static"),
    RouteRule("GET", r"/t/assets/[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", "/t/assets/{name}", "static"),
    RouteRule("GET", r"/t/healthz", "/t/healthz", "health"),
    _json("/t/api/redeem", "redeem"),
    RouteRule("GET", r"/t/api/ticket", "/t/api/ticket", "token_read"),
    _json("/t/api/status", "token_write"),
    _json("/t/api/note", "token_write"),
    _json("/t/api/eta", "token_write"),
    _json("/t/api/return", "token_write"),
    RouteRule("POST", r"/t/api/photo", "/t/api/photo", "photo", "multipart", PHOTO_MAX, UPLOAD_DEADLINE_S),
    RouteRule("GET", rf"/t/api/photo/{_ID}", "/t/api/photo/{attachment_id}", "token_read"),
    _json("/t/api/code/send", "code"),
    _json("/t/api/code/verify", "code"),
    RouteRule("GET", r"/t/api/claim", "/t/api/claim", "token_read"),
    _json("/t/api/claim", "token_write", CLAIM_JSON_MAX),
    RouteRule("POST", r"/t/api/claim/file", "/t/api/claim/file", "claim_file", "multipart", CLAIM_FILE_MAX, UPLOAD_DEADLINE_S),
)


@dataclass(frozen=True)
class PublicRequest:
    """What the edge learned about a request, for the app (scope["state"]["sw_public"])."""

    rule: RouteRule
    net: str
    token_hash: str | None
    token_key: str | None
    session: str | None  # the raw X-Ticket-Session value (codes.CodeEngine.session_ok parses it strictly)
    user_agent: str
    content_type: str
    content_length: int | None
    started: float


class BodyTooLarge(Exception):
    pass


class BodyDeadline(Exception):
    pass


def payload(code: str, **extra: Any) -> bytes:
    return json.dumps({"code": code, **extra}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


_RANK = {b"content-type": 0, b"content-length": 1}


def final_headers(headers: Sequence[tuple[bytes, bytes]], *, close: bool) -> list[tuple[bytes, bytes]]:
    """Every response's header list, in ONE canonical order whoever built it (the edge or a route): the route's own headers
    minus what the public surface never sends (cookies, a server banner, CORS, a connection header, our security headers in
    another spelling), sorted (content-type, content-length, then by name), `cache-control: no-store` unless the route chose,
    then the security headers, then `connection: close` when the request body was not read to its end. Two answers with the
    same status and body are therefore byte-identical (the uniform 404)."""
    kept = [(k.lower(), v) for k, v in headers
            if k.lower() not in _DROPPED_RESPONSE and not k.lower().startswith(b"access-control-")]
    if not any(k == b"cache-control" for k, _ in kept):
        kept.append((b"cache-control", b"no-store"))
    kept.sort(key=lambda kv: (_RANK.get(kv[0], 2), kv[0]))
    out = kept + list(SECURITY_HEADERS)
    if close:
        out.append((b"connection", b"close"))
    return out


def _single(values: list[bytes]) -> str | None:
    if len(values) != 1:
        return None
    try:
        return values[0].decode("latin-1")
    except UnicodeDecodeError:  # pragma: no cover - latin-1 decodes every byte
        return None


def is_json_type(value: str | None) -> bool:
    if not value:
        return False
    media, _, params = value.partition(";")
    if media.strip().lower() != "application/json":
        return False
    params = params.strip().lower().replace(" ", "")
    return params in ("", "charset=utf-8")


class PublicEdge:
    """The ASGI app uvicorn runs for the public listener. `app` is the public FastAPI app."""

    def __init__(self, app: Any, *, switch: ModuleSwitch, gate: PublicRateGate, trusted: Sequence[Network], stats: PublicStats,
                 rules: Sequence[RouteRule] = ROUTES, monotonic: Callable[[], float] = time.monotonic) -> None:
        self.app = app
        self.switch = switch
        self.gate = gate
        self.trusted = tuple(trusted)
        self.stats = stats
        self.rules = tuple(rules)
        self._mono = monotonic

    def match(self, method: str, path: str) -> RouteRule | None:
        for rule in self.rules:
            if rule.method == method and rule.regex.fullmatch(path):
                return rule
        return None

    async def __call__(self, scope: dict[str, Any], receive: Callable, send: Callable) -> None:
        kind = scope.get("type")
        if kind == "lifespan":
            await self.app(scope, receive, send)
            return
        if kind == "websocket":
            await send({"type": "websocket.close", "code": 4404})
            return
        if kind != "http":
            return
        started = self._mono()
        box = {"status": 0, "template": "unmatched"}
        try:
            await self._handle(scope, receive, send, started, box)
        finally:
            status = box["status"] or 499  # nothing sent: the client went away
            self.stats.request(status)
            log_request(str(scope.get("method", "?"))[:8], box["template"], status, (self._mono() - started) * 1000)

    async def _plain(self, send: Callable, box: dict[str, Any], status: int, body: bytes, *, close: bool = False,
                     extra: Sequence[tuple[bytes, bytes]] = ()) -> None:
        headers = final_headers([(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode("ascii")),
                                 *extra], close=close)
        box["status"] = status
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})

    async def _handle(self, scope: dict[str, Any], receive: Callable, send: Callable, started: float, box: dict[str, Any]) -> None:
        method = scope.get("method") or ""
        path = scope.get("path") or ""
        raw_headers: list[tuple[bytes, bytes]] = list(scope.get("headers") or [])
        wanted: dict[bytes, list[bytes]] = {k: [] for k in (b"content-length", b"transfer-encoding", b"content-type", b"x-ticket-token",
                                                            b"x-ticket-session", b"cf-connecting-ip", b"user-agent")}
        for k, v in raw_headers:
            lk = k.lower()
            if lk in wanted:
                wanted[lk].append(v)
        declared: int | None = None
        cl = _single(wanted[b"content-length"])
        if cl is not None:
            try:
                declared = int(cl.strip())
            except ValueError:
                declared = None
        has_body = bool(wanted[b"transfer-encoding"]) or (declared or 0) > 0

        if not self.switch.module_on():
            await self._plain(send, box, 404, UNIFORM_404, close=has_body)
            return
        rule = self.match(method, path)
        if rule is None:
            self.stats.bump("unmatched")
            await self._plain(send, box, 404, UNIFORM_404, close=has_body)
            return
        box["template"] = rule.template
        client = scope.get("client")
        peer = client[0] if isinstance(client, (list, tuple)) and client else None
        forwarded = [v.decode("latin-1") for v in wanted[b"cf-connecting-ip"]]
        net = client_network(peer, forwarded, self.trusted)
        token_hash = token_key = None
        if rule.kind in TOKEN_KINDS:
            token = links.parse_token(_single(wanted[b"x-ticket-token"]))
            if token is not None:
                token_hash = links.token_hash(token)
                token_key = links.limiter_key(token_hash)
        decision = self.gate.admit(rule.kind, net, token_key)
        if not decision.ok:
            if decision.reason == "no_token":
                self.gate.failure(net, None)
                await self._plain(send, box, 404, UNIFORM_404, close=has_body)
                return
            await self._plain(send, box, 429, payload("rate_limited", retry_after_s=decision.retry_after_s), close=has_body,
                              extra=[(b"retry-after", str(decision.retry_after_s).encode("ascii"))])
            return
        content_type = _single(wanted[b"content-type"]) or ""
        if rule.body == "none":
            if has_body:
                self.stats.bump("too_large")
                await self._plain(send, box, 413, payload("too_large", max_bytes=0), close=True)
                return
        else:
            if rule.body == "json" and not is_json_type(content_type):
                await self._plain(send, box, 415, payload("unsupported_media_type"), close=has_body)
                return
            if rule.body == "multipart" and not content_type.lower().lstrip().startswith("multipart/form-data"):
                await self._plain(send, box, 415, payload("unsupported_media_type"), close=has_body)
                return
            if declared is not None and declared > rule.max_body:
                self.stats.bump("too_large")
                await self._plain(send, box, 413, payload("too_large", max_bytes=rule.max_body), close=True)
                return

        child = dict(scope)
        child["headers"] = [(k, v) for k, v in raw_headers if k.lower() != b"cookie"]
        state = dict(scope.get("state") or {})
        state[STATE_KEY] = PublicRequest(rule=rule, net=net, token_hash=token_hash, token_key=token_key,
                                         session=_single(wanted[b"x-ticket-session"]),
                                         user_agent=(_single(wanted[b"user-agent"]) or "")[:512],
                                         content_type=content_type, content_length=declared, started=started)
        child["state"] = state

        deadline = started + rule.deadline_s
        flags = {"received": 0, "complete": not has_body, "tripped": None, "response_started": False}

        async def limited_receive() -> dict[str, Any]:
            if flags["tripped"]:
                return {"type": "http.disconnect"}
            remaining = deadline - self._mono()
            if remaining <= 0:
                flags["tripped"] = "deadline"
                raise BodyDeadline()
            try:
                message = await asyncio.wait_for(receive(), remaining)
            except asyncio.TimeoutError:
                flags["tripped"] = "deadline"
                raise BodyDeadline() from None
            if message.get("type") == "http.request":
                flags["received"] += len(message.get("body") or b"")
                if flags["received"] > rule.max_body:
                    flags["tripped"] = "size"
                    raise BodyTooLarge()
                if not message.get("more_body", False):
                    flags["complete"] = True
            return message

        async def guarded_send(message: dict[str, Any]) -> None:
            if message.get("type") == "http.response.start":
                if flags["response_started"]:
                    return
                flags["response_started"] = True
                box["status"] = int(message.get("status") or 500)
                message = {**message, "headers": final_headers(message.get("headers") or [], close=not flags["complete"])}
            await send(message)

        # The public app maps BodyTooLarge / BodyDeadline to 413 / 408 itself (its exception handlers) and answers any other
        # error with its own 500 before Starlette re-raises it here; the branches below are the fallback when nothing was
        # sent yet, and the place where an unhandled error is logged - once, as its type and innermost frame.
        try:
            await self.app(child, limited_receive, guarded_send)
        except (BodyTooLarge, BodyDeadline) as exc:
            if not flags["response_started"]:
                flags["response_started"] = True
                if isinstance(exc, BodyTooLarge):
                    await self._plain(send, box, 413, payload("too_large", max_bytes=rule.max_body), close=True)
                else:
                    await self._plain(send, box, 408, payload("body_timeout"), close=True)
        except Exception as exc:  # noqa: BLE001 - one answer, one sanitised line
            self.stats.bump("unhandled_errors")
            SERVER_LOG.error("public listener: unhandled error in %s (%s)", rule.template, exception_summary(exc))
            if not flags["response_started"]:
                flags["response_started"] = True
                await self._plain(send, box, 500, payload("server_error"), close=True)
        if flags["tripped"] == "size":
            self.stats.bump("too_large")
        elif flags["tripped"] == "deadline":
            self.stats.bump("body_timeouts")
