"""CR-038 public listener: the edge - a pure ASGI layer in front of the public FastAPI app (public_app), outside everything else.

Per request, before any database read and before one byte of the body is read:
00. more than MAX_IN_FLIGHT (16) requests in progress -> 503 `{"code": "busy"}` with the security headers and `Retry-After`
   (code review V5: the cap counts REQUESTS here, not connections - uvicorn's own cap counted idle keep-alive connections,
   cloudflared's pool among them, and answered a bare text/plain 503; connections are bounded in public_server instead);
0. a head of more than 64 headers or 16 KiB is 431 (h11's own 16 KiB cap only bounds a head that arrives slowly);
1. module off -> the uniform 404 (spec 6 / C8: the listener runs on the add-on option alone and answers 404 to everything);
2. (method, path) must match one rule of ROUTES - the spec's public routes and nothing else - or the uniform 404 (no route
   enumeration: an unknown path, a known path with another method, OPTIONS, HEAD all answer the same bytes);
3. the client network (/24 or /64; CF-Connecting-IP only from a trusted peer - ratelimit.client_network);
4. the token header (`X-Ticket-Token`) of a token route, strictly parsed, hashed - never stored, never logged;
5. the rate gate (ratelimit.PublicRateGate): 429 with `Retry-After`, or - a token route without a usable token - a failure
   counted against the client network only and the uniform 404, with no lookup at all; a request carrying both
   Transfer-Encoding and Content-Length is refused (400, the shape of request smuggling);
6. the body rules of the route: none (a GET with a body is 413), JSON (`Content-Type: application/json` or 415; 16 KiB) or
   multipart (`multipart/form-data` or 415; 8 MiB + 64 KiB for a photo, 10 MiB + 64 KiB for an invoice file); a declared
   Content-Length over the cap is 413 before anything is read; a chunked body is counted as it streams; at most
   MAX_BODY_REQUESTS_PER_TOKEN (2) requests WITH a body in progress per token (else 429 `busy`) - one link cannot occupy the
   request slots with trickled bodies;
7. a body READ DEADLINE from the start of the request - 10 s for JSON, 60 s for an upload: a 1 KB/s upload cannot hold a parser
   (spec 10.1) - and an IDLE limit between two chunks (BODY_IDLE_S, 5 s; code review V2): a trickle of one byte every few
   seconds is cut long before the deadline; past either, 408 and the connection closes;
8. the request's `Cookie`, `Range` and conditional headers are removed before the app sees them (no partial or 304 answers);
   the app never sets a cookie (any `Set-Cookie` is dropped), nor `ETag` / `Last-Modified` / `Accept-Ranges`. VPORTAL exception,
   narrow: the vendor portal's ONE session cookie (PORTAL_COOKIE) is read for PORTAL_SESSION_ROUTES (its strictly shaped value in
   PublicRequest.portal_session - the header itself still never reaches the app) and set only by PORTAL_COOKIE_SETTERS;
9. every response carries the headers of spec 10.4 (CSP without 'unsafe-inline', frame / referrer / sniffing / opener /
   resource / permissions policies, `X-Robots-Tag`, `Strict-Transport-Security`), `Cache-Control: no-store` unless the route
   set its own, no `Server`, no CORS headers, all in one canonical order (two answers with the same status and body are
   byte-identical). An answer given before the request body was read: ONLY when the request's token proved valid (known good,
   or its lookup succeeded in this request) is a small declared body (<= 64 KiB) read and discarded first - for at most 2 s,
   at most MAX_DRAINS (4) at once - so the answer is not lost to the TCP reset a socket closed on unread bytes produces, and
   the connection stays usable. Every other early answer (a 415 / 413 for a token that never proved valid, the module-off
   404, an unknown path, a dead token's 404, a 429) is sent at once and closes the connection (`connection: close`): such
   a request can never hold a connection for the drain (code review V1), and an unread body is never parsed as the next
   request;
10. an unhandled error is answered 500 `{"code": "server_error"}` and logged as its type and innermost frame only.
What each request costs is decided by its ratelimit.RequestCost (opened at admission, carried to the app): an early refusal
of a request whose token did not prove valid costs its network one failure (431, the smuggling shape, a body on a GET, 413,
415 - code review V1), an upload pays its budget when its body phase starts (V2).
The route's facts travel to the app in `scope["state"]["sw_public"]` (PublicRequest)."""
from __future__ import annotations

import asyncio
import json
import re
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Sequence

from starlette.requests import ClientDisconnect

from . import image_intake, links, public_prefix
from .cost_files import PDF_MAX_BYTES
from .public_log import SERVER_LOG, PublicStats, exception_summary, log_request
from .public_ports import ModuleSwitch
from .ratelimit import TOKEN_KINDS, Network, PublicRateGate, RequestCost, classify_client, forwarded_values

KiB = 1024
MULTIPART_SLACK = 64 * KiB
JSON_MAX = 16 * KiB
CLAIM_JSON_MAX = 32 * KiB
PHOTO_MAX = image_intake.MAX_BYTES + MULTIPART_SLACK
CLAIM_FILE_MAX = PDF_MAX_BYTES + MULTIPART_SLACK
RFQ_UPLOAD_MAX = 10 * 1024 * KiB + MULTIPART_SLACK  # RFQ-VENDOR-UPLOAD: a document's 10 MiB (rfq_files.DOCUMENT_MAX_BYTES) + framing
JSON_DEADLINE_S = 10.0
UPLOAD_DEADLINE_S = 60.0
BODY_IDLE_S = 5.0  # the longest pause between two body chunks (code review V2)
MAX_IN_FLIGHT = 16  # requests in progress at once (V5)
MAX_BODY_REQUESTS_PER_TOKEN = 2  # requests with a body in progress at once per token
MAX_DRAINS = 4  # early answers draining a small body at once (V1)
BUSY_RETRY_S = 1
STATE_KEY = "sw_public"
# h11's incomplete-event cap (public_server) bounds a head that arrives slowly; a complete head in one segment is parsed
# whatever its size, so the edge caps the parsed head too (431).
MAX_HEAD_BYTES = 16 * KiB
MAX_HEADERS = 64
# An answer sent before the request body was read: a socket closed with unread bytes is RESET by the kernel (Linux and
# Windows), and the client may lose the answer it was sent. For a request whose token PROVED VALID a small declared body
# (<= DRAIN_MAX) is therefore read and discarded first - for at most DRAIN_WAIT_S, MAX_DRAINS at once - and the connection
# stays usable; anything else is answered at once and cut (connection: close; code review V1).
DRAIN_MAX = 64 * KiB
DRAIN_WAIT_S = 2.0
# request headers a route never sees: no partial or conditional answers on the public surface (FileResponse would otherwise
# answer ranges, multipart byteranges, 304s and plain-text 400s outside the JSON vocabulary)
_DROPPED_REQUEST = frozenset({b"cookie", b"range", b"if-range", b"if-match", b"if-none-match", b"if-modified-since",
                              b"if-unmodified-since"})

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
    # the public hostname is HTTPS-only by construction (the tunnel); the origin does not rely on Cloudflare adding it (V24)
    (b"strict-transport-security", b"max-age=31536000; includeSubDomains"),
)
_OURS = frozenset(k for k, _ in SECURITY_HEADERS)
_DROPPED_RESPONSE = frozenset({b"set-cookie", b"server", b"x-powered-by", b"connection", b"etag", b"last-modified",
                               b"accept-ranges"}) | _OURS
UNIFORM_404 = b'{"code":"link_unavailable"}'
BUSY_503 = b'{"code":"busy","retry_after_s":1}'
_ID = r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}"
# a content-hashed bundle file (`index-3f9a1c2e.js`): immutable, cached by Cloudflare - its own, wider budget (V26)
HASHED_ASSET = r"[A-Za-z0-9][A-Za-z0-9_.-]{0,110}[-.][A-Za-z0-9_-]{8,}\.[a-z0-9]{1,8}"


@dataclass(frozen=True)
class RouteRule:
    method: str
    pattern: str
    template: str
    kind: str
    body: str = "none"  # none | json | multipart
    max_body: int = 0
    deadline_s: float = JSON_DEADLINE_S
    idle_s: float = BODY_IDLE_S
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
    RouteRule("GET", "/t/assets/" + HASHED_ASSET, "/t/assets/{name}", "asset"),
    RouteRule("GET", r"/t/assets/[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", "/t/assets/{name}", "static"),
    RouteRule("GET", r"/t/healthz", "/t/healthz", "health"),
    _json("/t/api/redeem", "redeem"),
    RouteRule("GET", r"/t/api/ticket", "/t/api/ticket", "token_read"),
    _json("/t/api/status", "token_write"),
    _json("/t/api/note", "token_write"),
    _json("/t/api/eta", "token_write"),
    _json("/t/api/return", "token_write"),
    # CR-ARX-WISKEY-SHARED-IDENTITY section 5: "who arrives, when" on an RFQ work order's handler page - a door-access REQUEST only
    # (services/access_arrival.py; the uniform 404 while `access.external_grants` is off)
    RouteRule("GET", r"/t/api/arrival", "/t/api/arrival", "token_read"),
    _json("/t/api/arrival", "token_write"),
    # VENDORARRIVAL126-295: the vendor's one-tap "I have arrived" (services/tickets/vendor_arrival.py; the uniform 404 while its switch is off)
    _json("/t/api/arrived", "token_write"),
    RouteRule("POST", r"/t/api/photo", "/t/api/photo", "photo", "multipart", PHOTO_MAX, UPLOAD_DEADLINE_S),
    RouteRule("GET", rf"/t/api/photo/{_ID}", "/t/api/photo/{attachment_id}", "photo_read"),
    # TKMAP1: the request's map element as a server-drawn picture (the photo read's own window; image/svg+xml, private, no-store)
    RouteRule("GET", r"/t/api/map-image", "/t/api/map-image", "photo_read"),
    _json("/t/api/code/send", "code"),
    _json("/t/api/code/verify", "code"),
    RouteRule("GET", r"/t/api/claim", "/t/api/claim", "token_read"),
    _json("/t/api/claim", "token_write", CLAIM_JSON_MAX),
    RouteRule("POST", r"/t/api/claim/file", "/t/api/claim/file", "claim_file", "multipart", CLAIM_FILE_MAX, UPLOAD_DEADLINE_S),
    # TKDETAILBE (contract 4.5): the vendor's quote before the work - the same limits and kinds as the claim's JSON routes
    RouteRule("GET", r"/t/api/quote", "/t/api/quote", "token_read"),
    _json("/t/api/quote", "token_write", CLAIM_JSON_MAX),
    # TKRFQVP (RFQ contract section 15): the vendor quote page of a request for quotation - the same kinds and limits as the quote
    # routes; the token is looked up in `ticket_rfq_links` only (public_rfq.py)
    RouteRule("GET", r"/t/api/rfq", "/t/api/rfq", "token_read"),
    _json("/t/api/rfq/quote", "token_write", CLAIM_JSON_MAX),
    _json("/t/api/rfq/withdraw", "token_write"),
    _json("/t/api/rfq/decline", "token_write"),
    _json("/t/api/rfq/message", "token_write"),
    _json("/t/api/rfq/arrival", "token_write"),  # CR-RFQ-PAYMENT-SCHEDULE: the awarded vendor's arrival confirmation
    _json("/t/api/rfq/code/send", "code"),
    _json("/t/api/rfq/code/verify", "code"),
    # RFQATT (RFQ contract section 19): the request's files - on the vendor's RFQ link, and (the reference copy of a work order) on
    # the handler link of the service request the order opened; never a body. The full files count in a window of their own
    # (`file_read`, review F4: up to 10 MiB each); the thumbnails in the photo read's window
    RouteRule("GET", rf"/t/api/rfq/file/{_ID}", "/t/api/rfq/file/{attachment_id}", "file_read"),
    RouteRule("GET", rf"/t/api/rfq/file/{_ID}/thumb", "/t/api/rfq/file/{attachment_id}/thumb", "photo_read"),
    RouteRule("GET", rf"/t/api/ticket/rfq-file/{_ID}", "/t/api/ticket/rfq-file/{attachment_id}", "file_read"),
    RouteRule("GET", rf"/t/api/ticket/rfq-file/{_ID}/thumb", "/t/api/ticket/rfq-file/{attachment_id}/thumb", "photo_read"),
    # RFQ-VENDOR-UPLOAD (RFQ contract 19.10): the vendor's OWN files on his quote - the one public upload of the RFQ page (kind
    # `rfq_upload`: per link and per client network, its body phase paid when it starts; a document's cap + the multipart framing; the
    # upload deadline), and his removal of one of them (a plain token write). Both answer the uniform 404 while the installation
    # setting `rfq.vendor_uploads.enabled` is off. There is NO public read of a vendor file (the managers read them on the internal API)
    RouteRule("POST", r"/t/api/rfq/upload", "/t/api/rfq/upload", "rfq_upload", "multipart", RFQ_UPLOAD_MAX, UPLOAD_DEADLINE_S),
    _json("/t/api/rfq/upload/remove", "token_write", 1024),
    # VPORTAL (services/tickets/vendor_portal.py, public_portal.py): the vendor portal - no token; per client network in the rate gate;
    # the session is the one cookie PORTAL_COOKIE, passed to the app on PORTAL_SESSION_ROUTES only. While the portal switch is off
    # every one of them answers the uniform 404 (the app's check)
    RouteRule("GET", r"/t/api/portal/config", "/t/api/portal/config", "portal_read"),
    _json("/t/api/portal/start", "portal_start", 1024),
    _json("/t/api/portal/verify", "portal_verify", 1024),
    RouteRule("GET", r"/t/api/portal/items", "/t/api/portal/items", "portal_read"),
    _json("/t/api/portal/open", "portal_read", 1024),
    _json("/t/api/portal/logout", "portal_read", 1024),
    # VPORTALRFQ (services/tickets/portal_more.py): the vendor's open requests for quotation (+ the hand-off to his RFQ page) and the
    # company technician requests - the same session cookie, each section behind its own switch (the uniform 404 while off)
    RouteRule("GET", r"/t/api/portal/rfqs", "/t/api/portal/rfqs", "portal_read"),
    _json("/t/api/portal/rfqs/open", "portal_read", 1024),
    RouteRule("GET", r"/t/api/portal/techs", "/t/api/portal/techs", "portal_read"),
    _json("/t/api/portal/techs", "portal_write", 1024),
    _json("/t/api/portal/techs/cancel", "portal_write", 1024),
    # VPORTAL: the organisation's logo (services/tickets/brand.py) - a separate image file, its name carries its stamp (immutable)
    RouteRule("GET", r"/t/brand/[0-9a-f]{16}\.jpg", "/t/brand/{name}", "asset"),
    # WA-CONSENT-LINK (services/intercom_consent.py, public_consent.py): the WhatsApp consent page - the token (`#c.<token>` in the
    # fragment) travels in X-Ticket-Token like every link; the token kinds give it the per-token windows (60 reads / minute, 20 answers /
    # hour, spent only once an answer is stored) and the failure caps (20 unknown tokens / minute per network, 300 installation-wide)
    RouteRule("GET", r"/t/api/consent", "/t/api/consent", "token_read"),
    _json("/t/api/consent", "token_write", 1024),
    # CR-VENDORQ-294 (services/tickets/out_documents.py, public_documents.py): a document sent by a temporary link (`#d.<token>` in the
    # fragment, the token in X-Ticket-Token): the metadata as a token read, the bytes as a file read (its own per-token window); both the
    # uniform 404 for every token that is not live (documents switched off included)
    RouteRule("GET", r"/t/api/doc", "/t/api/doc", "token_read"),
    RouteRule("GET", r"/t/api/doc/file", "/t/api/doc/file", "file_read"),
)
# VPORTAL: the portal session cookie. `__Secure-` (the browser keeps it only from an HTTPS answer and sends it only over HTTPS),
# HttpOnly (no script reads it), SameSite=Strict (no cross-site request carries it), Path = the portal's API path under the public
# prefix (no other route ever receives it). The edge passes ONLY this cookie, and only to these routes; any other cookie is dropped as
# before, and a `Set-Cookie` leaves only from the routes in PORTAL_COOKIE_SETTERS and only for this name.
PORTAL_COOKIE = "__Secure-arx_vp"
PORTAL_SESSION_ROUTES = frozenset({"/t/api/portal/items", "/t/api/portal/open", "/t/api/portal/logout",
                                   # VPORTALRFQ: the same cookie (its Path already covers them); never a setter
                                   "/t/api/portal/rfqs", "/t/api/portal/rfqs/open", "/t/api/portal/techs", "/t/api/portal/techs/cancel"})
PORTAL_COOKIE_SETTERS = frozenset({"/t/api/portal/verify", "/t/api/portal/logout"})
_PORTAL_VALUE = re.compile(r"[A-Za-z0-9_-]{43}")


def portal_cookie(values: Sequence[bytes]) -> str | None:
    """The portal session value of the request's Cookie header(s), or None: exactly one `__Secure-arx_vp` pair whose value is a
    session value's shape (43 base64url characters). Two of them (a planted second cookie) or any other shape is None."""
    found: list[str] = []
    for raw in values:
        try:
            text = raw.decode("latin-1")
        except UnicodeDecodeError:  # pragma: no cover - latin-1 decodes every byte
            return None
        for part in text.split(";"):
            name, sep, value = part.strip().partition("=")
            if sep and name == PORTAL_COOKIE:
                found.append(value.strip())
    if len(found) != 1 or _PORTAL_VALUE.fullmatch(found[0]) is None:
        return None
    return found[0]


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
    content_length: int | None  # None for a chunked body
    started: float
    cost: RequestCost  # what this request costs - every exit path decides through it (ratelimit part 4)
    source: str = "peer"  # where the client address came from: header | peer | trusted_no_header | unknown
    prefix: str = "t"  # TK255: the public prefix this request used (`support`, or `t` for a legacy link): the shell points its assets at it
    portal_session: str | None = None  # VPORTAL: the portal cookie's value (PORTAL_SESSION_ROUTES only; strictly shaped, never logged)


class BodyTooLarge(Exception):
    pass


class BodyDeadline(Exception):
    pass


def payload(code: str, **extra: Any) -> bytes:
    return json.dumps({"code": code, **extra}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


_RANK = {b"content-type": 0, b"content-length": 1}


def final_headers(headers: Sequence[tuple[bytes, bytes]], *, close: bool, portal_cookie_ok: bool = False) -> list[tuple[bytes, bytes]]:
    """Every response's header list, in ONE canonical order whoever built it (the edge or a route): the route's own headers
    minus what the public surface never sends (cookies, a server banner, CORS, a connection header, our security headers in
    another spelling), sorted (content-type, content-length, then by name), `cache-control: no-store` unless the route chose,
    then the security headers, then `connection: close` when the request body was not read to its end. Two answers with the
    same status and body are therefore byte-identical (the uniform 404)."""
    kept = [(k.lower(), v) for k, v in headers
            if k.lower() not in _DROPPED_RESPONSE and not k.lower().startswith(b"access-control-")]
    if portal_cookie_ok:  # VPORTAL: the portal session cookie, from PORTAL_COOKIE_SETTERS only, and never another name
        kept += [(b"set-cookie", v) for k, v in headers if k.lower() == b"set-cookie" and v.startswith(PORTAL_COOKIE.encode("ascii") + b"=")]
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
                 rules: Sequence[RouteRule] = ROUTES, monotonic: Callable[[], float] = time.monotonic,
                 client_ip_header: str = "cf-connecting-ip", max_in_flight: int = MAX_IN_FLIGHT,
                 max_drains: int = MAX_DRAINS, body_requests_per_token: int = MAX_BODY_REQUESTS_PER_TOKEN,
                 path_prefix: str = "t", legacy_t: bool = True) -> None:
        self.app = app
        self.switch = switch
        self.gate = gate
        self.trusted = tuple(trusted)
        self.stats = stats
        self.rules = tuple(rules)
        self._mono = monotonic
        header = client_ip_header.strip().lower()
        if header not in ("cf-connecting-ip", "x-forwarded-for"):
            raise ValueError("client_ip_header must be cf-connecting-ip or x-forwarded-for")
        self.client_ip_header = header.encode("ascii")
        self.max_in_flight = max_in_flight
        self.max_drains = max_drains
        self.body_requests_per_token = body_requests_per_token
        self._lock = threading.Lock()  # the listener has one loop; tests may drive the edge from several
        self._in_flight = 0
        self._drains = 0
        self._bodies: dict[str, int] = {}
        self.prefix = public_prefix.validate_prefix(path_prefix)
        self.legacy_t = bool(legacy_t)
        self.loose_root = False  # VPORTAL: the bare root in any letter case - only while the vendor portal is on (public_runtime)

    def set_portal(self, on: bool) -> None:
        """VPORTAL: the vendor portal's switch reaches the edge (the bare `/<prefix>` / `/Support` root is served only while it is on)."""
        self.loose_root = bool(on)

    def set_prefix(self, path_prefix: str, legacy_t: bool) -> None:
        """TK255: a changed `public.path_prefix` / `public.legacy_t_paths` reaches the running edge at once. An invalid prefix raises
        and changes nothing."""
        prefix = public_prefix.validate_prefix(path_prefix)
        self.prefix, self.legacy_t = prefix, bool(legacy_t)

    def match(self, method: str, path: str) -> RouteRule | None:
        for rule in self.rules:
            if rule.method == method and rule.regex.fullmatch(path):
                return rule
        return None

    @property
    def in_flight(self) -> int:
        return self._in_flight

    def _take(self, counter: str, cap: int) -> bool:
        with self._lock:
            n = getattr(self, counter)
            if n >= cap:
                return False
            setattr(self, counter, n + 1)
            return True

    def _give(self, counter: str) -> None:
        with self._lock:
            setattr(self, counter, getattr(self, counter) - 1)

    def _take_body(self, token_key: str) -> bool:
        with self._lock:
            n = self._bodies.get(token_key, 0)
            if n >= self.body_requests_per_token:
                return False
            self._bodies[token_key] = n + 1
            return True

    def _give_body(self, token_key: str) -> None:
        with self._lock:
            n = self._bodies.get(token_key, 0) - 1
            if n <= 0:
                self._bodies.pop(token_key, None)
            else:
                self._bodies[token_key] = n

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
        box: dict[str, Any] = {"status": 0, "template": "unmatched", "cost": None, "drain_ms": 0, "body_ms": 0}
        admitted = self._take("_in_flight", self.max_in_flight)
        try:
            if admitted:
                await self._handle(scope, receive, send, started, box)
            else:
                self.stats.bump("busy_refusals")
                box["template"] = "(busy)"  # not routed: refused before anything was looked at
                has_body = any(k.lower() in (b"content-length", b"transfer-encoding") and v.strip() not in (b"", b"0")
                               for k, v in scope.get("headers") or [])
                await self._plain(send, box, 503, BUSY_503, close=has_body,
                                  extra=[(b"retry-after", str(BUSY_RETRY_S).encode("ascii"))])
        finally:
            if admitted:
                self._give("_in_flight")
            status = box["status"] or 499  # nothing sent: the client went away
            self.stats.request(status)
            cost: RequestCost | None = box["cost"]
            if cost is not None and cost.body_spent and status != 201 and cost.link_id:
                self.stats.note_link(cost.link_id, "wasted")  # an upload paid for and stored nothing (health, V2)
            log_request(str(scope.get("method", "?"))[:8], box["template"], status, (self._mono() - started) * 1000,
                        cost=cost.charges if cost is not None else "none", drain_ms=box["drain_ms"], body_ms=box["body_ms"],
                        stats=self.stats)

    async def _plain(self, send: Callable, box: dict[str, Any], status: int, body: bytes, *, close: bool = False,
                     extra: Sequence[tuple[bytes, bytes]] = ()) -> None:
        headers = final_headers([(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode("ascii")),
                                 *extra], close=close)
        box["status"] = status
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})

    async def _drain(self, receive: Callable, flags: dict[str, Any], deadline: float, declared: int | None,
                     cost: RequestCost | None, box: dict[str, Any]) -> bool:
        """Read and discard what is left of a SMALL declared body (<= DRAIN_MAX) before an early answer, so the answer is not
        lost to a TCP reset; True when the body ended (the connection can stay open). Only for a request whose token proved
        valid (`cost.trusted`), for at most DRAIN_WAIT_S and never past the route's deadline, MAX_DRAINS at once - an unknown
        token, a module-off or unknown-path request is never waited for (code review V1). Never for a chunked or large body."""
        if flags["complete"]:
            return True
        if flags["tripped"] or declared is None or declared > DRAIN_MAX or cost is None or not cost.trusted:
            return False
        if not self._take("_drains", self.max_drains):
            self.stats.bump("drains_refused")
            return False
        t0 = self._mono()
        self.stats.bump("drains")
        try:
            deadline = min(deadline, t0 + DRAIN_WAIT_S)
            while not flags["complete"]:
                remaining = deadline - self._mono()
                if remaining <= 0:
                    self.stats.bump("drain_timeouts")
                    return False
                try:
                    message = await asyncio.wait_for(receive(), remaining)
                except asyncio.TimeoutError:
                    self.stats.bump("drain_timeouts")
                    return False
                if message.get("type") != "http.request":
                    return False
                flags["received"] += len(message.get("body") or b"")
                if flags["received"] > DRAIN_MAX:
                    return False
                if not message.get("more_body", False):
                    flags["complete"] = True
            return True
        finally:
            self._give("_drains")
            box["drain_ms"] = int((self._mono() - t0) * 1000)

    async def _handle(self, scope: dict[str, Any], receive: Callable, send: Callable, started: float, box: dict[str, Any]) -> None:
        method = scope.get("method") or ""
        path = scope.get("path") or ""
        raw_headers: list[tuple[bytes, bytes]] = list(scope.get("headers") or [])
        wanted: dict[bytes, list[bytes]] = {k: [] for k in (b"content-length", b"transfer-encoding", b"content-type", b"x-ticket-token",
                                                            b"x-ticket-session", self.client_ip_header, b"user-agent", b"cookie")}
        head_bytes = 0
        for k, v in raw_headers:
            head_bytes += len(k) + len(v) + 4
            lk = k.lower()
            if lk in wanted:
                wanted[lk].append(v)
        chunked = bool(wanted[b"transfer-encoding"])
        declared: int | None = None
        cl = _single(wanted[b"content-length"])
        if cl is not None and not chunked:  # with Transfer-Encoding the body is chunked (h11: TE wins) - its length is unknown
            try:
                declared = int(cl.strip())
            except ValueError:
                declared = None
        has_body = chunked or (declared or 0) > 0
        flags: dict[str, Any] = {"received": 0, "complete": not has_body, "tripped": None, "response_started": False}
        cost: RequestCost | None = None

        async def refuse(status: int, body: bytes, *, deadline_s: float = JSON_DEADLINE_S, close: bool = False,
                         extra: Sequence[tuple[bytes, bytes]] = ()) -> None:
            ended = await self._drain(receive, flags, started + deadline_s, declared, cost, box)
            flags["response_started"] = True
            await self._plain(send, box, status, body, close=close or not ended, extra=extra)

        # the client network first (cheap, no I/O): even the malformed shapes below are counted against it
        client = scope.get("client")
        peer = client[0] if isinstance(client, (list, tuple)) and client else None
        forwarded = forwarded_values(self.client_ip_header.decode("ascii"), [v.decode("latin-1") for v in wanted[self.client_ip_header]])
        net, source = classify_client(peer, forwarded, self.trusted)
        if source in ("trusted_no_header", "unknown"):
            self.stats.bump("client_" + source)  # health (V3): the proxy assumption is visible when it does not hold

        if len(raw_headers) > MAX_HEADERS or head_bytes > MAX_HEAD_BYTES:
            self.stats.bump("headers_too_large")
            self.gate.failure(net, None, lookup=False)
            await refuse(431, payload("headers_too_large"), close=True)
            return
        if chunked and wanted[b"content-length"]:
            # both framings at once (RFC 9112 6.3): the shape of request smuggling - refused, the connection closes
            self.stats.bump("invalid_requests")
            self.gate.failure(net, None, lookup=False)
            await refuse(400, payload("bad_request"), close=True)
            return
        if not self.switch.module_on():
            await refuse(404, UNIFORM_404)  # never waits for a body (V1); closes when one was announced
            return
        resolved = public_prefix.resolve_path(path, scope.get("raw_path"), self.prefix, self.legacy_t,  # TK255: `/<prefix>/x` -> `/t/x`
                                              self.loose_root)
        rule = self.match(method, resolved[0]) if resolved is not None else None
        if rule is None or resolved is None:
            # a path scan pays like a static request (120 / minute per network): a flood of guesses is not free
            self.stats.bump("unmatched")
            scanned = self.gate.admit("static", net)
            if not scanned.ok:
                await refuse(429, payload("rate_limited", retry_after_s=scanned.retry_after_s),
                             extra=[(b"retry-after", str(scanned.retry_after_s).encode("ascii"))])
                return
            await refuse(404, UNIFORM_404)
            return
        box["template"] = rule.template
        box["public_path"], box["public_prefix"] = resolved
        token_hash = token_key = None
        if rule.kind in TOKEN_KINDS:
            token = links.parse_token(_single(wanted[b"x-ticket-token"]))
            if token is not None:
                token_hash = links.token_hash(token)
                token_key = links.limiter_key(token_hash)
        cost = box["cost"] = self.gate.open(rule.kind, net, token_key)
        decision = cost.decision
        if not decision.ok:
            if decision.reason == "no_token":
                cost.refused_early()  # no lookup made: its network pays, not the installation budget
                await refuse(404, UNIFORM_404)
                return
            await refuse(429, payload("rate_limited", retry_after_s=decision.retry_after_s),
                         extra=[(b"retry-after", str(decision.retry_after_s).encode("ascii"))])
            return
        content_type = _single(wanted[b"content-type"]) or ""
        if rule.body == "none":
            if has_body:
                self.stats.bump("too_large")
                cost.refused_early()
                await refuse(413, payload("too_large", max_bytes=0), close=True)
                return
        else:
            if (rule.body == "json" and not is_json_type(content_type)) or (
                    rule.body == "multipart" and not content_type.lower().lstrip().startswith("multipart/form-data")):
                cost.refused_early()  # V1: a wrong content type costs a request that did not prove a valid token
                await refuse(415, payload("unsupported_media_type"), deadline_s=rule.deadline_s)
                return
            if declared is not None and declared > rule.max_body:
                self.stats.bump("too_large")
                cost.refused_early()
                await refuse(413, payload("too_large", max_bytes=rule.max_body), close=True)
                return
        body_slot = None
        if has_body and token_key is not None:
            if not self._take_body(token_key):
                self.stats.bump("token_bodies_refused")
                await refuse(429, payload("busy", retry_after_s=2), close=True, extra=[(b"retry-after", b"2")])
                return
            body_slot = token_key
        try:
            await self._forward(scope, receive, send, started, box, rule, raw_headers, wanted, flags, declared, cost, net, source,
                                token_hash, token_key, content_type)
        finally:
            if body_slot is not None:
                self._give_body(body_slot)

    async def _forward(self, scope: dict[str, Any], receive: Callable, send: Callable, started: float, box: dict[str, Any],
                       rule: RouteRule, raw_headers: list[tuple[bytes, bytes]], wanted: dict[bytes, list[bytes]],
                       flags: dict[str, Any], declared: int | None, cost: RequestCost, net: str, source: str,
                       token_hash: str | None, token_key: str | None, content_type: str) -> None:
        child = dict(scope)
        child["path"] = box["public_path"]  # the app only knows `/t/...`; the edge already proved the public spelling
        child["raw_path"] = box["public_path"].encode("ascii")
        child["headers"] = [(k, v) for k, v in raw_headers if k.lower() not in _DROPPED_REQUEST]
        state = dict(scope.get("state") or {})
        state[STATE_KEY] = PublicRequest(rule=rule, net=net, token_hash=token_hash, token_key=token_key,
                                         session=_single(wanted[b"x-ticket-session"]),
                                         user_agent=(_single(wanted[b"user-agent"]) or "")[:512],
                                         content_type=content_type, content_length=declared, started=started,
                                         cost=cost, source=source, prefix=box["public_prefix"],
                                         portal_session=portal_cookie(wanted[b"cookie"]) if rule.template in PORTAL_SESSION_ROUTES else None)
        child["state"] = state
        deadline = started + rule.deadline_s

        async def limited_receive() -> dict[str, Any]:
            if flags["tripped"]:
                return {"type": "http.disconnect"}
            if flags["complete"]:
                return await receive()  # the body is in: a later receive() only waits for a disconnect (streaming answers)
            now = self._mono()
            if "body_from" not in flags:
                flags["body_from"] = now  # the idle clock starts when the route starts reading, not while it waits for a slot
            idle_until = flags.get("last_chunk", now) + rule.idle_s
            remaining = min(deadline, idle_until) - now
            if remaining <= 0:
                flags["tripped"] = "deadline" if deadline <= idle_until else "idle"
                raise BodyDeadline()
            try:
                message = await asyncio.wait_for(receive(), remaining)
            except asyncio.TimeoutError:
                flags["tripped"] = "deadline" if deadline <= idle_until else "idle"
                raise BodyDeadline() from None
            flags["last_chunk"] = self._mono()
            if message.get("type") == "http.request":
                flags["received"] += len(message.get("body") or b"")
                if flags["received"] > rule.max_body:
                    flags["tripped"] = "size"
                    raise BodyTooLarge()
                if not message.get("more_body", False):
                    flags["complete"] = True
                    box["body_ms"] = int((flags["last_chunk"] - flags["body_from"]) * 1000)
            return message

        async def guarded_send(message: dict[str, Any]) -> None:
            if message.get("type") == "http.response.start":
                if flags["response_started"]:
                    return
                flags["response_started"] = True
                box["status"] = int(message.get("status") or 500)
                # an answer before the body was read (a dead link's 404, a 409, a busy 429): drained only for a proved token
                ended = await self._drain(receive, flags, deadline, declared, cost, box)
                message = {**message, "headers": final_headers(message.get("headers") or [], close=not ended,
                                                               portal_cookie_ok=rule.template in PORTAL_COOKIE_SETTERS)}
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
        except ClientDisconnect:
            box["status"] = 499  # the client went away mid-body: nothing to answer, not a server error, no log line
        except Exception as exc:  # noqa: BLE001 - one answer, one sanitised line
            self.stats.bump("unhandled_errors")
            SERVER_LOG.error("public listener: unhandled error in %s (%s)", rule.template, exception_summary(exc))
            if not flags["response_started"]:
                flags["response_started"] = True
                await self._plain(send, box, 500, payload("server_error"), close=True)
        if box["status"] == 499:
            self.stats.bump("client_disconnects")
        if flags["tripped"] == "size":
            self.stats.bump("too_large")
        elif flags["tripped"] == "deadline":
            self.stats.bump("body_timeouts")
        elif flags["tripped"] == "idle":
            self.stats.bump("body_idle_timeouts")
