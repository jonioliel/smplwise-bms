"""PARTNERAPI113-295: the partner read API at /p/v1 - a THIRD minimal app on the existing public listener (owner answer 164), sharing nothing
with the main app: no session, no cookie, no CORS, no router of /api/v1, no home-system identity. A pure ASGI callable; the public listener's
PublicApp hands it every `/p/` request before the tickets edge sees it.

Per request, in this order:
1. guard first: `partner.api` off (or not permitted in this build) -> the uniform 404, before any lookup and before one byte of the body;
2. (method, path) must match ROUTES, else the same 404 bytes;
3. the client address (the listener's trusted proxies and client-address header);
4. a cookie, a token in the query string, or anything but exactly one `Authorization: Bearer arxp_...` -> 401 (a failure counted against
   the address, no lookup); the failure window of the address (20 / minute per /24 or IPv6 /48) -> 429 with no lookup; the
   installation-wide failure window (300 / minute) only turns a FAILED answer into 429 - it never blocks a token that authenticates;
5. the token lookup (hash only): unknown / expired / revoked / partner disabled / another installation / outside the source CIDRs -> the
   SAME 401 bytes; the per-token windows -> 429 + Retry-After;
6. the scope (403 `forbidden_scope`, audited) and the module switch (tickets off -> 404 as if the route did not exist);
7. the body rules: GET has none (413), POST is `application/json`, at most 16 KiB, within 10 s.
Every answer carries the public surface's security headers and `Cache-Control: no-store`; errors use a fixed vocabulary."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import ipaddress
import json
import re
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Sequence

import anyio

from ...audit import audit
from ...db import Database, get_setting
from ...errors import ApiError
from ..tickets.public_http import final_headers, is_json_type
from ..tickets.ratelimit import ScopedRateLimiter, classify_client, client_address, forwarded_values
from . import core, reads

JSON_MAX = 16 * 1024
BODY_DEADLINE_S = 10.0
SWITCH_TTL_S = 5.0
NOT_FOUND = b'{"code":"not_found"}'
UNAUTHORIZED = b'{"code":"unauthorized"}'
FAIL_PER_NET = ((60.0, 20),)
FAIL_GLOBAL = ((60.0, 300),)
_TICKET_ID = r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}"
_IDEM_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}")
_QUERY_TOKEN = re.compile(r"(^|&)(token|access_token|api_key|key|auth|authorization)=|arxp_", re.IGNORECASE)


@dataclass(frozen=True)
class Route:
    method: str
    regex: re.Pattern[str]
    name: str
    scope: str | None  # None = any valid token (whoami)
    body: bool = False


ROUTES: tuple[Route, ...] = (
    Route("GET", re.compile(r"/p/v1/whoami"), "whoami", None),
    Route("GET", re.compile(r"/p/v1/tickets"), "tickets_list", "tickets.read"),
    Route("GET", re.compile(rf"/p/v1/tickets/(?P<id>{_TICKET_ID})"), "ticket_one", "tickets.read"),
    Route("POST", re.compile(r"/p/v1/tickets"), "ticket_create", "tickets.create", True),
    Route("GET", re.compile(r"/p/v1/temperature/units"), "temperature", "temperature.read"),
    Route("GET", re.compile(r"/p/v1/elevators"), "elevators", "elevators.read"),
)


class Answer(Exception):
    def __init__(self, status: int, body: dict[str, Any] | bytes, headers: Sequence[tuple[bytes, bytes]] = ()) -> None:
        super().__init__(status)
        self.status, self.body, self.headers = status, body, list(headers)


def _fail_key(addr: Any, net: str) -> str:
    """The failure bucket of a client: the listener's /24 key for IPv4; for IPv6 the /48 (not the /64 of the other windows) - a
    single /48 holds 65k /64s, so a /64 failure key would make the per-network failure limit ineffective (SEC217, finding 1.1)."""
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is None:
        return str(ipaddress.IPv6Network((int(addr) >> 80 << 80, 48)))
    return net


def _bytes(body: dict[str, Any] | bytes) -> bytes:
    return body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


class PartnerApp:
    """The /p/v1 ASGI app. `trusted` / `client_ip_header` are callables so a change of the listener's settings applies at once."""

    def __init__(self, db: Database, *, trusted: Callable[[], Sequence[Any]] = lambda: (), client_ip_header: Callable[[], str] = lambda: "cf-connecting-ip",
                 clock: Callable[[], float] = time.time, monotonic: Callable[[], float] = time.monotonic) -> None:
        self.db = db
        self.trusted = trusted
        self.client_ip_header = client_ip_header
        self.clock = clock
        self.mono = monotonic
        self.limiter = ScopedRateLimiter("partner_in", horizon_s=86400.0, clock=clock)
        self._switch: tuple[float, bool] = (-1e18, False)
        self._lock = threading.Lock()
        self.stats = {"requests": 0, "unauthorized": 0, "rate_limited": 0, "forbidden_scope": 0, "not_found": 0}

    # ---------------------------------------------------------------- the switch

    def api_on(self) -> bool:
        now = self.mono()
        with self._lock:
            at, value = self._switch
            if now - at < SWITCH_TTL_S:
                return value
        try:
            with self.db.connection(mode="read", label="partner.api.switch") as conn:
                value = core.switch_on(conn, core.API_KEY)
        except Exception:  # noqa: BLE001 - fail closed
            value = False
        with self._lock:
            self._switch = (now, value)
        return value

    def set_switch(self, on: bool) -> None:
        with self._lock:
            self._switch = (self.mono(), bool(on) and core.GO_LIVE_PERMITTED)

    # ---------------------------------------------------------------- ASGI

    async def __call__(self, scope: dict[str, Any], receive: Callable, send: Callable) -> None:
        if scope.get("type") == "websocket":
            await send({"type": "websocket.close", "code": 4404})
            return
        if scope.get("type") != "http":
            return
        self.stats["requests"] += 1
        headers: dict[bytes, list[bytes]] = {}
        for k, v in scope.get("headers") or []:
            headers.setdefault(k.lower(), []).append(v)
        chunked = bool(headers.get(b"transfer-encoding"))
        try:
            declared = int(headers.get(b"content-length", [b"0"])[0].strip() or 0) if not chunked else None
        except ValueError:
            declared = None
        has_body = chunked or (declared or 0) > 0
        state = {"read": not has_body}
        try:
            status, body, extra = await self._handle(scope, receive, headers, has_body, declared, state)
        except Answer as a:
            status, body, extra = a.status, _bytes(a.body), a.headers
        except Exception:  # noqa: BLE001 - one fixed answer, nothing about the error leaves
            status, body, extra = 500, b'{"code":"server_error"}', []
        out = final_headers([(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode("ascii")), *extra], close=not state["read"])
        await send({"type": "http.response.start", "status": status, "headers": out})
        await send({"type": "http.response.body", "body": body})

    async def _read_body(self, receive: Callable, declared: int | None, state: dict[str, Any]) -> bytes:
        if declared is not None and declared > JSON_MAX:
            raise Answer(413, {"code": "too_large", "max_bytes": JSON_MAX})
        buf = bytearray()
        deadline = self.mono() + BODY_DEADLINE_S
        while True:
            left = deadline - self.mono()
            if left <= 0:
                raise Answer(408, {"code": "body_timeout"})
            try:
                msg = await asyncio.wait_for(receive(), left)
            except asyncio.TimeoutError:
                raise Answer(408, {"code": "body_timeout"}) from None
            if msg.get("type") != "http.request":
                raise Answer(400, {"code": "bad_request"})
            buf += msg.get("body") or b""
            if len(buf) > JSON_MAX:
                raise Answer(413, {"code": "too_large", "max_bytes": JSON_MAX})
            if not msg.get("more_body", False):
                state["read"] = True
                return bytes(buf)

    async def _handle(self, scope: dict[str, Any], receive: Callable, headers: dict[bytes, list[bytes]], has_body: bool, declared: int | None,
                      state: dict[str, Any]) -> tuple[int, bytes, list[tuple[bytes, bytes]]]:
        if not await anyio.to_thread.run_sync(self.api_on):
            self.stats["not_found"] += 1
            raise Answer(404, NOT_FOUND)  # guard first: no lookup, no body read
        method = scope.get("method") or ""
        path = scope.get("path") or ""
        route, match = None, None
        for r in ROUTES:
            m = r.regex.fullmatch(path)
            if m and r.method == method:
                route, match = r, m
                break
        if route is None:
            self.stats["not_found"] += 1
            raise Answer(404, NOT_FOUND)
        client = scope.get("client")
        peer = client[0] if isinstance(client, (list, tuple)) and client else None
        header = (self.client_ip_header() or "cf-connecting-ip").lower()
        forwarded = forwarded_values(header, [v.decode("latin-1") for v in headers.get(header.encode("ascii"), [])])
        trusted = tuple(self.trusted() or ())
        net, _source = classify_client(peer, forwarded, trusted)
        addr = client_address(peer, forwarded, trusted)
        addr_text = str(addr) if addr is not None else None
        # 4. the credential's shape; failures counted against the address with no lookup. SEC217 (security review 2.16.0, finding 1.1):
        # only the PER-NETWORK window is checked before the lookup; the installation-wide window is consulted on the failure path
        # alone, so a flood of junk credentials from many networks can no longer lock out a partner whose token authenticates.
        fail_key = _fail_key(addr, net)
        wait = self.limiter.check(f"fail:{fail_key}", FAIL_PER_NET)
        if wait > 0:
            self.stats["rate_limited"] += 1
            raise Answer(429, {"code": "rate_limited", "retry_after_s": int(wait) + 1}, [(b"retry-after", str(int(wait) + 1).encode("ascii"))])
        auth = headers.get(b"authorization", [])
        query = (scope.get("query_string") or b"").decode("latin-1")
        token = core.parse_token(auth[0].decode("latin-1")) if len(auth) == 1 else None
        if token is None or headers.get(b"cookie") or _QUERY_TOKEN.search(query):
            self._refuse(fail_key)
        ctx, reason = await anyio.to_thread.run_sync(self._authenticate, token, addr_text)
        if ctx is None:
            if reason in ("installation_mismatch", "source_address"):
                await anyio.to_thread.run_sync(self._audit_denied, None, reason, route.name)
            self._refuse(fail_key)
        # 5. the token's own windows
        wait = self.limiter.check(f"t:{ctx.id}", ((60.0, ctx.rate_per_min), (3600.0, ctx.rate_per_hour)))
        if wait > 0:
            self.stats["rate_limited"] += 1
            raise Answer(429, {"code": "rate_limited", "retry_after_s": int(wait) + 1}, [(b"retry-after", str(int(wait) + 1).encode("ascii"))])
        self.limiter.record(f"t:{ctx.id}", ((60.0, ctx.rate_per_min), (3600.0, ctx.rate_per_hour)))
        await anyio.to_thread.run_sync(self._usage, ctx.id, addr_text)
        # 6. the scope and the module switch
        if route.scope is not None and route.scope not in ctx.scopes:
            self.stats["forbidden_scope"] += 1
            await anyio.to_thread.run_sync(self._audit_denied, ctx, "forbidden_scope", route.name)
            raise Answer(403, {"code": "forbidden_scope"})
        # 7. the body
        body = b""
        if route.body:
            ctype = headers.get(b"content-type", [b""])
            if len(ctype) != 1 or not is_json_type(ctype[0].decode("latin-1")):
                raise Answer(415, {"code": "unsupported_media_type"})
            body = await self._read_body(receive, declared, state)
        elif has_body:
            raise Answer(413, {"code": "too_large", "max_bytes": 0})
        params = _query(query)
        if route.name == "ticket_create":
            idem = headers.get(b"idempotency-key", [])
            key = idem[0].decode("latin-1").strip() if len(idem) == 1 else ""
            if not _IDEM_RE.fullmatch(key):
                raise Answer(422, {"code": "invalid", "fields": [{"field": "Idempotency-Key", "code": "required"}]})
            limits = ((3600.0, self._number("partner.create_per_hour")), (86400.0, self._number("partner.create_per_day")))
            wait = self.limiter.check(f"c:{ctx.id}", limits)
            if wait > 0:
                self.stats["rate_limited"] += 1
                raise Answer(429, {"code": "rate_limited", "retry_after_s": int(wait) + 1}, [(b"retry-after", str(int(wait) + 1).encode("ascii"))])
            status, out, created = await anyio.to_thread.run_sync(self._create, ctx, key, body)
            if created:
                self.limiter.record(f"c:{ctx.id}", limits)
            return status, _bytes(out), []
        status, out = await anyio.to_thread.run_sync(self._read, route.name, ctx, params, match.groupdict() if match else {})
        return status, _bytes(out), []

    # ---------------------------------------------------------------- worker-thread parts

    def _fail(self, net: str) -> None:
        self.stats["unauthorized"] += 1
        self.limiter.record(f"fail:{net}", FAIL_PER_NET)
        self.limiter.record("fail:*", FAIL_GLOBAL)

    def _refuse(self, fail_key: str) -> None:
        """The failure path: count the failure, then 429 while the installation-wide failure window is full, else the uniform 401.
        Never reached by a request whose token authenticates (SEC217, finding 1.1)."""
        wait = self.limiter.check("fail:*", FAIL_GLOBAL)
        self._fail(fail_key)
        if wait > 0:
            self.stats["rate_limited"] += 1
            raise Answer(429, {"code": "rate_limited", "retry_after_s": int(wait) + 1}, [(b"retry-after", str(int(wait) + 1).encode("ascii"))])
        raise Answer(401, UNAUTHORIZED)

    def _number(self, key: str) -> int:
        with self.db.connection(mode="read", label="partner.api.limits") as conn:
            return core.number(conn, key)

    def _authenticate(self, token: str, addr: str | None) -> tuple[core.TokenCtx | None, str]:
        with self.db.connection(mode="read", label="partner.api.auth") as conn:
            return core.authenticate(conn, token, addr)

    def _usage(self, token_id: str, addr: str | None) -> None:
        if core.USAGE.note(token_id, addr, core.iso(core.utcnow()), self.mono()):
            try:
                with self.db.connection(label="partner.api.usage") as conn:
                    core.USAGE.flush(conn, self.mono(), force=True)
            except Exception:  # noqa: BLE001 - counters are best effort; never the answer
                pass

    def _audit_denied(self, ctx: core.TokenCtx | None, reason: str, route: str) -> None:
        try:
            with self.db.connection(label="partner.api.denied") as conn:
                audit(conn, actor=None, action="partner.token.denied", decision="denied", resource_type="partner_token",
                      resource_id=ctx.id if ctx else "*", reason=reason, details={"route": route})
        except Exception:  # noqa: BLE001
            pass

    def _read(self, name: str, ctx: core.TokenCtx, params: dict[str, str], path: dict[str, str]) -> tuple[int, dict[str, Any]]:
        with self.db.connection(mode="read", label=f"partner.api.{name}") as conn:
            if name == "whoami":
                return 200, reads.whoami(ctx)
            if name in ("tickets_list", "ticket_one") and not reads.tickets_on(conn):
                raise Answer(404, NOT_FOUND)
            try:
                if name == "tickets_list":
                    return 200, reads.tickets_page(conn, ctx, params)
                if name == "ticket_one":
                    one = reads.ticket_one(conn, ctx, path.get("id") or "")
                    if one is None:
                        raise Answer(404, NOT_FOUND)
                    return 200, one
                if name == "temperature":
                    return 200, reads.temperature_units(conn, ctx)
                if name == "elevators":
                    return 200, reads.elevators(conn, ctx)
            except reads.Invalid as exc:
                raise Answer(422, {"code": "invalid", "fields": [{"field": exc.field, "code": exc.code}]}) from None
        raise Answer(404, NOT_FOUND)

    def _create(self, ctx: core.TokenCtx, key: str, raw: bytes) -> tuple[int, dict[str, Any], bool]:
        key_hash = hashlib.sha256(key.encode("utf-8")).hexdigest()
        body_hash = hashlib.sha256(raw).hexdigest()
        with self.db.connection(label="partner.api.ticket_create") as conn:
            if not reads.tickets_on(conn):
                raise Answer(404, NOT_FOUND)
            prior = conn.execute("SELECT status, response_json FROM partner_idempotency WHERE token_id = ? AND key_hash = ?", (ctx.id, key_hash)).fetchone()
            if prior is not None:
                stored = json.loads(prior["response_json"])
                if stored.get("body_hash") != body_hash:
                    raise Answer(409, {"code": "request_id_reused"})
                return int(prior["status"]), stored["answer"], False
            try:
                data = reads.parse_json(raw)
                status, answer = reads.create_ticket(conn, ctx, data)
            except reads.Invalid as exc:
                raise Answer(422, {"code": "invalid", "fields": [{"field": exc.field, "code": exc.code}]}) from None
            except ApiError as exc:
                fields = [{"field": str(p.get("field", "body"))[:64], "code": str(p.get("code", "invalid"))[:40]}
                          for p in ((exc.details or {}).get("fields") or []) if isinstance(p, dict)] if isinstance(getattr(exc, "details", None), dict) else []
                raise Answer(422, {"code": "invalid", "fields": fields or [{"field": "body", "code": "invalid"}]}) from None
            conn.execute("INSERT INTO partner_idempotency (token_id, key_hash, ticket_id, status, response_json, created_at) VALUES (?,?,?,?,?,?)",
                         (ctx.id, key_hash, answer.get("id"), status, json.dumps({"body_hash": body_hash, "answer": answer}), core.iso(core.utcnow())))
            return status, answer, True


def _query(query: str) -> dict[str, str]:
    from urllib.parse import parse_qsl

    out: dict[str, str] = {}
    try:
        pairs = parse_qsl(query, keep_blank_values=True, strict_parsing=False, max_num_fields=10)
    except ValueError:
        raise Answer(422, {"code": "invalid", "fields": [{"field": "query", "code": "too_many"}]}) from None
    for k, v in pairs:
        if k in out:
            raise Answer(422, {"code": "invalid", "fields": [{"field": k[:32], "code": "duplicate"}]})
        out[k] = v
    return out


def encode_cursor(updated_at: str, ticket_id: str) -> str:
    return base64.urlsafe_b64encode(f"{updated_at}|{ticket_id}".encode("utf-8")).decode("ascii").rstrip("=")


def decode_cursor(value: str) -> tuple[str, str] | None:
    try:
        raw = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)).decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return None
    at, sep, tid = raw.partition("|")
    return (at, tid) if sep and at and tid and len(raw) <= 200 else None
