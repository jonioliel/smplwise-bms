"""CR-008 SmplWise Arx: the remote channel `https://<HA hostname><remote_path>/...` (default `/arx`).

A Cloudflare tunnel path route sends `/arx/...` unchanged to the add-on (`http://<addon host>:8099`). This pure ASGI
middleware sits in front of everything:

- the add-on option `remote_access` is off → every `/arx...` request is 404 (a WebSocket is refused), even when a tunnel
  route exists;
- `/arx` → `308 /arx/` (the only redirect; the query string is kept);
- `/arx/<rest>` → the ASGI `root_path` becomes `/arx` (Starlette routes the rest, `request.url` keeps the full path) and
  the request state carries `sw_channel = "remote"`. Every other request is `sw_channel = "local"` (Ingress or refused,
  exactly as before). The channel comes from the path alone and the Ingress trust from the peer address alone, so a
  request is never both: on the remote channel `auth.resolve_principal` accepts only an Arx session cookie or an HA
  bearer token, and the middleware DROPS any inbound `X-Remote-User-*`, `X-Ingress-*` and developer identity header
  before anything else sees them;
- remote responses get the security headers of CR-008 §3e (CSP with `frame-ancestors 'self'`, `X-Frame-Options:
  SAMEORIGIN` - the WisKey embed and Ingress framing are same-origin -, `Referrer-Policy`, `Permissions-Policy`,
  `nosniff`, and `Cache-Control: no-store` on the API). HSTS is left to Cloudflare (the tunnel terminates TLS);
- a state-changing request carrying the Arx session cookie must prove it comes from this origin (csrf_ok) or it is
  refused 403 `csrf_refused` and audited (security review B1).
"""
from __future__ import annotations

import json
from typing import Any

from .config import Settings

CHANNEL_KEY = "sw_channel"
REMOTE = "remote"
LOCAL = "local"

# identity / Ingress headers that only the Supervisor's Ingress proxy may set; never honoured on the remote channel
_DROPPED_PREFIXES = (b"x-remote-user-", b"x-ingress-", b"x-hass-")
_DROPPED = {b"x-sw-dev-user"}

# style-src needs 'unsafe-inline': Lit templates bind inline `style=` attributes throughout the product (no script is
# inline). connect-src 'self' covers the same-origin ws(s): sockets and HA's /auth endpoints; frame-src 'self' the
# WisKey panel (/hikvision-intercom); blob: the MSE player and exported frames.
CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
])
SECURITY_HEADERS: list[tuple[bytes, bytes]] = [
    (b"content-security-policy", CSP.encode()),
    (b"x-frame-options", b"SAMEORIGIN"),
    (b"referrer-policy", b"same-origin"),
    (b"permissions-policy", b"camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()"),
    (b"x-content-type-options", b"nosniff"),
    (b"cross-origin-opener-policy", b"same-origin"),
]


# machine-to-machine routes with no user identity (the HA bridge integration's signed calls on the internal network):
# never reachable through the tunnel
BLOCKED_ON_REMOTE = ("/api/v1/ha/bridge/ping", "/api/v1/ha/bridge/directory")


SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
SESSION_COOKIES = ("__Secure-arx_session", "arx_session")
CSRF_BODY = json.dumps({"code": "csrf_refused", "user_message": "הבקשה נדחתה: היא לא הגיעה מדף של SmplWise Arx.",
                        "retryable": False, "correlation_id": "", "details": {}}, ensure_ascii=False).encode("utf-8")


def _header(headers: list[tuple[bytes, bytes]], name: bytes) -> str | None:
    for k, v in headers:
        if k.lower() == name:
            return v.decode("latin-1")
    return None


def _session_cookie(headers: list[tuple[bytes, bytes]]) -> str | None:
    raw = ";".join(v.decode("latin-1") for k, v in headers if k.lower() == b"cookie")
    for part in raw.split(";"):
        name, _, value = part.strip().partition("=")
        if name in SESSION_COOKIES and value:
            return value
    return None


def csrf_ok(scope: dict, headers: list[tuple[bytes, bytes]]) -> bool:
    """A state-changing request that carries the Arx session cookie must come from an Arx page on this very origin
    (CR-008 security review B1). SameSite=Strict still sends the cookie on same-SITE requests (a sibling sub-domain of
    the zone), and ~35 POST routes take no JSON body, so neither the cookie flag nor the content type is enough.
    `Sec-Fetch-Site: same-origin` when the browser sends it (every current browser does); otherwise `Origin` equal to
    this request's scheme + host. Neither header → refused."""
    site = _header(headers, b"sec-fetch-site")
    if site is not None:
        return site == "same-origin"
    origin = _header(headers, b"origin")
    host = _header(headers, b"host")
    if not origin or not host or origin == "null":
        return False
    from urllib.parse import urlsplit

    try:
        o = urlsplit(origin)
    except ValueError:
        return False
    schemes = {"https", scope.get("scheme") or "http"}
    xfp = _header(headers, b"x-forwarded-proto")
    if xfp:
        schemes = {xfp.split(",")[0].strip().lower()}
    return o.netloc.lower() == host.lower() and o.scheme in schemes and not o.path.strip("/")


def _audit_csrf(scope: dict, headers: list[tuple[bytes, bytes]], sid: str | None) -> None:
    app = scope.get("app")
    db = getattr(getattr(app, "state", None), "db", None)
    if db is None:
        return
    from .audit import audit
    from .services import ha_user_auth as hua

    session = hua.STORE.peek(sid) if sid else None
    details = {"method": scope.get("method"), "path": scope.get("path"), "origin": (_header(headers, b"origin") or "")[:200],
               "sec_fetch_site": _header(headers, b"sec-fetch-site") or "",
               "client_ip": (_header(headers, b"cf-connecting-ip") or (_header(headers, b"x-forwarded-for") or "").split(",")[0]).strip()[:64]}
    try:
        with db.connection(label="csrf_refused") as conn:
            audit(conn, actor=session.principal if session else None, action="auth.remote_csrf_refused", decision="denied", resource_type="request",
                  resource_id=None, reason="csrf_refused", details=details)
    except Exception:  # noqa: BLE001 - the refusal stands even when the audit row cannot be written
        import logging

        logging.getLogger("smplwise.remote").exception("could not audit a refused cross-site request")


def channel_of(conn: Any) -> str:
    """`remote` or `local` for a Request / WebSocket (or anything with an ASGI scope)."""
    scope = getattr(conn, "scope", None) or {}
    return (scope.get("state") or {}).get(CHANNEL_KEY, LOCAL)


def is_remote(conn: Any) -> bool:
    return channel_of(conn) == REMOTE


def _clean_headers(headers: list[tuple[bytes, bytes]]) -> list[tuple[bytes, bytes]]:
    return [(k, v) for k, v in headers if k.lower() not in _DROPPED and not k.lower().startswith(_DROPPED_PREFIXES)]


async def _plain(send, status: int, body: bytes, extra: list[tuple[bytes, bytes]] | None = None) -> None:
    headers = [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()), *SECURITY_HEADERS, *(extra or [])]
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body})


class RemoteChannel:
    def __init__(self, app, settings: Settings) -> None:
        self.app = app
        self.settings = settings
        self.prefix = settings.remote_path

    async def __call__(self, scope, receive, send) -> None:
        kind = scope["type"]
        if kind not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return
        path: str = scope.get("path") or "/"
        prefix = self.prefix
        remote = path == prefix or path.startswith(prefix + "/")
        state = scope.setdefault("state", {})
        if not remote:
            state[CHANNEL_KEY] = LOCAL
            await self.app(scope, receive, send)
            return
        if not self.settings.remote_access:
            if kind == "websocket":
                await send({"type": "websocket.close", "code": 4404})
                return
            await _plain(send, 404, b'{"code":"not_found","user_message":"Not found","retryable":false,"correlation_id":"","details":{}}')
            return
        if path == prefix:
            if kind == "websocket":
                await send({"type": "websocket.close", "code": 4404})
                return
            qs = scope.get("query_string") or b""
            location = (prefix + "/").encode() + (b"?" + qs if qs else b"")
            await _plain(send, 308, b"", [(b"location", location)])
            return
        rest = path[len(prefix):]
        if any(rest == b or rest.startswith(b + "/") for b in BLOCKED_ON_REMOTE):
            await _plain(send, 404, b'{"code":"not_found","user_message":"Not found","retryable":false,"correlation_id":"","details":{}}')
            return
        headers = list(scope.get("headers") or [])
        if kind == "http" and (scope.get("method") or "GET").upper() not in SAFE_METHODS:
            sid = _session_cookie(headers)
            if sid is not None and not csrf_ok(scope, headers):  # a bearer-only request (no cookie) is exempt
                from starlette.concurrency import run_in_threadpool

                await run_in_threadpool(_audit_csrf, scope, headers, sid)
                await _plain(send, 403, CSRF_BODY)
                return
        child = dict(scope)
        child["root_path"] = (scope.get("root_path") or "") + prefix
        child["headers"] = _clean_headers(headers)
        state[CHANNEL_KEY] = REMOTE
        child["state"] = state
        if kind == "websocket":
            await self.app(child, receive, send)
            return
        api = path.startswith(prefix + "/api/")

        async def send_secured(message) -> None:
            if message["type"] == "http.response.start":
                headers = [(k, v) for k, v in (message.get("headers") or []) if k.lower() not in {h for h, _ in SECURITY_HEADERS}]
                headers.extend(SECURITY_HEADERS)
                if api and not any(k.lower() == b"cache-control" for k, _ in headers):
                    headers.append((b"cache-control", b"no-store"))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(child, receive, send_secured)


def install(app, settings: Settings) -> None:
    """Outermost middleware: nothing (not even the correlation id middleware) sees an un-stripped remote request."""
    app.add_middleware(RemoteChannel, settings=settings)
