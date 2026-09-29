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
  `nosniff`, and `Cache-Control: no-store` on the API). HSTS is left to Cloudflare (the tunnel terminates TLS).
"""
from __future__ import annotations

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
        child = dict(scope)
        child["root_path"] = (scope.get("root_path") or "") + prefix
        child["headers"] = _clean_headers(list(scope.get("headers") or []))
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
