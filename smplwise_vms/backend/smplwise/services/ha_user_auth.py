"""CR-008 SmplWise Arx: identity on the remote channel (`/arx`), from a Home Assistant user access token.

The browser signs in with HA's own login flow on the same origin (the password never reaches the add-on) and holds an
HA access token. It exchanges that token here for an opaque session cookie (`POST /arx/api/v1/auth/session`); images,
downloads and WebSockets then carry the cookie, API clients may send the bearer itself. Either way the principal is the
SAME model as Ingress (HA user id; VMS roles bound to it), with `source = "remote"`.

- **Validation:** a local structural pre-check first (a JWT whose unverified `exp` lies ahead - garbage and expired
  tokens never reach HA), then HA core's WebSocket API (`auth` + `auth/current_user`) on the Supervisor network. User
  tokens go to HA core directly (`http://homeassistant:<port>`, port / TLS from the Supervisor's `/core/info`): the
  Supervisor's `/core` proxy authenticates only the add-on's own SUPERVISOR_TOKEN, which never leaves the server.
  The caller's address goes along as `X-Forwarded-For`, so HA attributes an invalid token to the caller, never to the
  add-on (a token spray must not make HA ban the add-on once a ban threshold is set).
- **Sessions:** in memory only (a restart signs everyone in again with their refresh token, silently), a random
  256-bit id per exchange (rotation: the client re-exchanges after every token refresh), never longer than the access
  token it was made from (<= 30 min). A background task re-validates every session used in the last 2 minutes at most
  every 60 s: a token HA no longer accepts (refresh token deleted in the HA profile, user disabled or deleted) or a
  user the remote policy no longer admits drops the session and closes its WebSockets.
- **Policy:** `remote.policy` = `flag` (only users with the per-user remote-access flag, table remote_access_users) or
  `any_role` (every HA user holding any Arx role); `remote.require_mfa_admin` (default off, D8) refuses users holding an
  administrative permission whose HA account has no MFA module enabled. Inactive users (HA directory or VMS) are refused.
- **Rate limits:** the exchange and logout endpoints, per client address and per user; a negative cache of rejected
  token hashes. **Audit:** `auth.remote_session.created | .rejected | .revoked | .logout` (ids, address, country and
  user agent; never a token or a cookie).
"""
from __future__ import annotations

import asyncio
import base64
import collections
import hashlib
import json
import logging
import secrets
import ssl
import threading
import time
import weakref
from dataclasses import dataclass, field
from typing import Any, Callable
from urllib.parse import urlparse

from ..config import Settings
from ..errors import ApiError, unauthenticated
from ..rbac import Principal

log = logging.getLogger("smplwise.remote")

LOGIN_REQUIRED_HE = "נדרשת כניסה ל־SmplWise Arx."
NOT_ALLOWED_FLAG_HE = "הגישה מרחוק לא הופעלה עבור המשתמש שלך. מנהל המערכת יכול להפעיל אותה בהגדרות › משתמשים והרשאות."
NOT_ALLOWED_ROLE_HE = "למשתמש שלך אין תפקיד ב־SmplWise Arx, ולכן אין גישה מרחוק. פנה למנהל המערכת."
INACTIVE_HE = "המשתמש שלך אינו פעיל במערכת."
MFA_REQUIRED_HE = "למשתמשים עם הרשאות ניהול נדרש אימות דו־שלבי (MFA) לפני גישה מרחוק. הפעל אותו בפרופיל שלך."
TOKEN_INVALID_HE = "ההזדהות פגה או בוטלה. יש להיכנס מחדש."
HA_UNAVAILABLE_HE = "תשתית המערכת אינה זמינה כרגע לאימות הכניסה. נסה שוב בעוד רגע."
RATE_LIMITED_HE = "יותר מדי ניסיונות כניסה. נסה שוב בעוד כמה דקות."
ORIGIN_HE = "חיבור ממקור לא מורשה."

COOKIE_SECURE = "__Secure-arx_session"
COOKIE_PLAIN = "arx_session"  # only outside the add-on over plain http (a developer / Playwright backend)

REVALIDATE_EVERY_S = 60.0
ACTIVE_WINDOW_S = 120.0
LOOP_TICK_S = 5.0
BEARER_CACHE_S = 60.0
MAX_SESSIONS_PER_USER = 20
ADMIN_PERMISSIONS = frozenset({"system.configure", "rbac.assign", "identity.directory.read"})

# rate limits: (window seconds, max hits); per client address and per user
IP_LIMITS: list[tuple[float, int]] = [(60.0, 10), (3600.0, 50)]
USER_LIMITS: list[tuple[float, int]] = [(60.0, 20), (3600.0, 200)]


# ---------------------------------------------------------------- HA user, token pre-check

@dataclass(frozen=True)
class HaUser:
    id: str
    name: str
    is_owner: bool
    is_admin: bool
    mfa: bool


class TokenInvalid(Exception):
    """HA says no (auth_invalid) or the token fails the local pre-check."""


class HaUnavailable(Exception):
    """HA core could not be asked (network, timeout, unexpected answer)."""


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8", "replace")).hexdigest()


def jwt_exp(token: str) -> float | None:
    """The unverified `exp` of an HA access token (a JWT), or None when the string is not shaped like one. Only a
    pre-check: HA verifies the signature when we ask it."""
    parts = token.split(".")
    if len(parts) != 3 or not all(parts) or len(token) > 4096:
        return None
    try:
        raw = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(raw.encode("ascii")))
        exp = payload.get("exp") if isinstance(payload, dict) else None
        return float(exp) if isinstance(exp, (int, float)) else None
    except (ValueError, UnicodeError):
        return None


# ---------------------------------------------------------------- HA core: where and how

_core_base: dict[str, str] = {}


def _supervisor_core_base() -> str:
    """`http(s)://homeassistant:<port>` from the Supervisor's /core/info (the add-on's own token, server-side only);
    `http://homeassistant:8123` when the Supervisor does not answer."""
    import os

    import httpx

    token = os.environ.get("SUPERVISOR_TOKEN")
    port, tls = 8123, False
    if token:
        try:
            r = httpx.get("http://supervisor/core/info", headers={"Authorization": f"Bearer {token}"}, timeout=5)
            data = (r.json() or {}).get("data") or {}
            port = int(data.get("port") or 8123)
            tls = bool(data.get("ssl"))
        except Exception as exc:  # noqa: BLE001 - fall back to HA's default port
            log.warning("could not read the core info from the Supervisor (%s); assuming http://homeassistant:8123", type(exc).__name__)
    return f"{'https' if tls else 'http'}://homeassistant:{port}"


def core_ws_url(settings: Settings) -> str:
    base = settings.ha_core_url
    if not base:
        base = _core_base.get("base")
        if not base:
            if not settings.in_addon:
                raise HaUnavailable("no HA core URL (HA_CORE_URL) outside the add-on")
            base = _core_base["base"] = _supervisor_core_base()
    base = base.rstrip("/")
    if base.endswith("/core"):  # a Supervisor proxy URL never validates a user token
        raise HaUnavailable("the Supervisor proxy cannot validate user tokens")
    if base.startswith("https://"):
        return "wss://" + base[len("https://"):] + "/api/websocket"
    return "ws://" + base[len("http://"):] + "/api/websocket"


_xff_refused: dict[str, bool] = {}


async def _dial(url: str, headers: dict[str, str]):
    """Open the HA WebSocket (a seam the tests replace). HA's own TLS on the internal network is not verified by name
    (the certificate is for the public hostname) - the same "No TLS Verify" the Cloudflared route uses."""
    import websockets

    kw: dict[str, Any] = {"open_timeout": 10, "close_timeout": 2, "max_size": 2**20}
    if headers:
        kw["additional_headers"] = headers
    if url.startswith("wss://"):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kw["ssl"] = ctx
    return await websockets.connect(url, **kw)


async def validate_token(settings: Settings, token: str, client_ip: str | None = None) -> HaUser:
    """Ask HA core who owns `token`. TokenInvalid for a token HA refuses (or that fails the pre-check), HaUnavailable
    when HA could not be asked."""
    exp = jwt_exp(token)
    if exp is None or exp <= time.time():
        raise TokenInvalid("pre-check")
    url = core_ws_url(settings)
    headers = {"X-Forwarded-For": client_ip} if client_ip and not _xff_refused.get(url) else {}
    try:
        ws = await _dial(url, headers)
    except TokenInvalid:
        raise
    except Exception as exc:  # noqa: BLE001
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status == 400 and headers:
            # HA refuses X-Forwarded-For from a proxy it does not trust: carry on without it (logged once)
            _xff_refused[url] = True
            log.warning("Home Assistant refuses X-Forwarded-For from the add-on; validating without it (see DOCS: trusted_proxies)")
            return await validate_token(settings, token, None)
        raise HaUnavailable(type(exc).__name__) from exc
    try:
        async with asyncio.timeout(10):
            hello = json.loads(await ws.recv())
            if hello.get("type") != "auth_required":
                raise HaUnavailable("unexpected hello")
            await ws.send(json.dumps({"type": "auth", "access_token": token}))
            auth = json.loads(await ws.recv())
            if auth.get("type") == "auth_invalid":
                raise TokenInvalid("auth_invalid")
            if auth.get("type") != "auth_ok":
                raise HaUnavailable("unexpected auth answer")
            await ws.send(json.dumps({"id": 1, "type": "auth/current_user"}))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("id") == 1 and msg.get("type") == "result":
                    break
            if not msg.get("success") or not isinstance(msg.get("result"), dict):
                raise HaUnavailable("auth/current_user failed")
            r = msg["result"]
            uid = r.get("id")
            if not isinstance(uid, str) or not uid:
                raise HaUnavailable("auth/current_user without an id")
            mfa = any(isinstance(m, dict) and m.get("enabled") for m in (r.get("mfa_modules") or []))
            return HaUser(id=uid, name=str(r.get("name") or ""), is_owner=bool(r.get("is_owner")), is_admin=bool(r.get("is_admin")), mfa=mfa)
    except (TokenInvalid, HaUnavailable):
        raise
    except Exception as exc:  # noqa: BLE001 - a dropped socket, a timeout, a malformed frame
        raise HaUnavailable(type(exc).__name__) from exc
    finally:
        try:
            await ws.close()
        except Exception:  # noqa: BLE001
            pass


# ---------------------------------------------------------------- sessions

@dataclass
class RemoteSession:
    sid: str
    principal: Principal
    token: str = field(repr=False)
    token_exp: float
    ha_user: HaUser
    client_ip: str
    created_at: float
    last_used: float
    last_validated: float
    chain: str = ""  # one browser's sign-in: every rotation keeps it; sign-out ends the whole chain


class SessionStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions: dict[str, RemoteSession] = {}
        self._sockets: dict[str, weakref.WeakSet] = {}
        self._to_close: list[Any] = []

    def create(self, principal: Principal, ha_user: HaUser, token: str, token_exp: float, client_ip: str, replaces: str | None = None) -> RemoteSession:
        """A new session; `replaces` = the sid the browser presented (a rotation after a token refresh): that session
        ends now (security review M2) and its open WebSockets move to the new one instead of being closed."""
        now = time.time()
        s = RemoteSession(sid=secrets.token_urlsafe(32), principal=principal, token=token, token_exp=token_exp, ha_user=ha_user,
                          client_ip=client_ip, created_at=now, last_used=now, last_validated=now)
        s.chain = s.sid
        with self._lock:
            old = self._sessions.get(replaces) if replaces else None
            if old is not None and old.principal.user_id == principal.user_id:
                s.chain = old.chain or old.sid
                self._sessions.pop(old.sid, None)
                socks = self._sockets.pop(old.sid, None)
                if socks:
                    self._sockets.setdefault(s.sid, weakref.WeakSet()).update(socks)
            self._sessions[s.sid] = s
            mine = sorted((x for x in self._sessions.values() if x.principal.user_id == principal.user_id), key=lambda x: x.created_at)
            for old in mine[:-MAX_SESSIONS_PER_USER]:
                self._drop_locked(old.sid)
        return s

    def get(self, sid: str | None) -> RemoteSession | None:
        if not sid:
            return None
        now = time.time()
        with self._lock:
            s = self._sessions.get(sid)
            if s is None:
                return None
            if s.token_exp <= now:
                self._drop_locked(sid)
                return None
            s.last_used = now
            return s

    def _drop_locked(self, sid: str) -> RemoteSession | None:
        s = self._sessions.pop(sid, None)
        socks = self._sockets.pop(sid, None)
        if socks:
            self._to_close.extend(list(socks))
        return s

    def peek(self, sid: str | None) -> RemoteSession | None:
        """The session without touching it (the audit of a refused request)."""
        if not sid:
            return None
        with self._lock:
            return self._sessions.get(sid)

    def drop(self, sid: str) -> RemoteSession | None:
        with self._lock:
            return self._drop_locked(sid)

    def drop_chain(self, sid: str) -> RemoteSession | None:
        """Sign-out: the presented session and every other session of the same browser's chain."""
        with self._lock:
            s = self._sessions.get(sid)
            if s is None:
                return None
            chain = s.chain or s.sid
            for other in [x for x, v in self._sessions.items() if (v.chain or v.sid) == chain]:
                self._drop_locked(other)
            return s

    def drop_user(self, user_id: str) -> list[RemoteSession]:
        with self._lock:
            sids = [sid for sid, s in self._sessions.items() if s.principal.user_id == user_id]
            dropped = [s for s in (self._drop_locked(sid) for sid in sids) if s is not None]
        forget_bearer_user(user_id)  # security review M3: the bearer cache follows at once, not after 60 s
        return dropped

    def attach_socket(self, sid: str, websocket: Any) -> None:
        with self._lock:
            if sid in self._sessions:
                self._sockets.setdefault(sid, weakref.WeakSet()).add(websocket)

    def take_sockets_to_close(self) -> list[Any]:
        with self._lock:
            out, self._to_close = self._to_close, []
        return out

    def due_for_revalidation(self) -> list[RemoteSession]:
        now = time.time()
        with self._lock:
            expired = [sid for sid, s in self._sessions.items() if s.token_exp <= now]
            for sid in expired:
                self._drop_locked(sid)
            return [s for s in self._sessions.values() if now - s.last_used <= ACTIVE_WINDOW_S and now - s.last_validated >= REVALIDATE_EVERY_S]

    def count(self) -> int:
        with self._lock:
            return len(self._sessions)

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()
            self._sockets.clear()
            self._to_close.clear()


STORE = SessionStore()

# bearer requests (API clients, the future native app): validated principals by token hash, <= BEARER_CACHE_S old
_bearer_cache: dict[str, tuple[Principal, float, float]] = {}
_rejected: dict[str, float] = {}  # token hash -> until (negative cache)
_cache_lock = threading.Lock()


def forget_bearer_user(user_id: str) -> None:
    with _cache_lock:
        for key in [k for k, v in _bearer_cache.items() if v[0].user_id == user_id]:
            _bearer_cache.pop(key, None)


def _remember_rejected(token: str) -> None:
    until = min(jwt_exp(token) or 0.0, time.time() + 3600.0) or time.time() + 300.0
    with _cache_lock:
        if len(_rejected) > 10000:
            now = time.time()
            for k in [k for k, v in _rejected.items() if v <= now]:
                _rejected.pop(k, None)
        _rejected[token_hash(token)] = max(until, time.time() + 60.0)


def was_rejected(token: str) -> bool:
    with _cache_lock:
        until = _rejected.get(token_hash(token))
    return until is not None and until > time.time()


# ---------------------------------------------------------------- rate limits

class RateLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hits: dict[str, collections.deque] = {}

    def hit(self, key: str, limits: list[tuple[float, int]]) -> bool:
        """Record one attempt; False when any window is already full (the attempt is then not counted)."""
        now = time.time()
        longest = max(w for w, _ in limits)
        with self._lock:
            q = self._hits.setdefault(key, collections.deque())
            while q and now - q[0] > longest:
                q.popleft()
            for window, cap in limits:
                if sum(1 for t in q if now - t <= window) >= cap:
                    return False
            q.append(now)
            if len(self._hits) > 20000:
                for k in [k for k, v in self._hits.items() if not v or now - v[-1] > longest]:
                    self._hits.pop(k, None)
            return True

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()


LIMITER = RateLimiter()


# ---------------------------------------------------------------- request helpers

def client_ip(conn: Any) -> str:
    """The caller's address for the audit and the rate limits: Cloudflare's `CF-Connecting-IP`, else the first
    `X-Forwarded-For` hop, else the peer. Used on the remote channel only (the tunnel sets these); never an identity."""
    h = conn.headers
    ip = (h.get("cf-connecting-ip") or "").strip()
    if not ip:
        ip = (h.get("x-forwarded-for") or "").split(",")[0].strip()
    if not ip and getattr(conn, "client", None):
        ip = conn.client.host
    return ip[:64]


def request_meta(conn: Any) -> dict[str, str]:
    h = conn.headers
    meta = {"client_ip": client_ip(conn)}
    if h.get("cf-ipcountry"):
        meta["country"] = h.get("cf-ipcountry", "")[:8]
    if h.get("user-agent"):
        meta["user_agent"] = h.get("user-agent", "")[:200]
    return meta


def cookie_name(settings: Settings, conn: Any) -> str:
    if settings.in_addon:
        return COOKIE_SECURE  # the browser always reaches the add-on's remote channel over https (the tunnel)
    proto = (conn.headers.get("x-forwarded-proto") or conn.url.scheme or "").lower()
    return COOKIE_SECURE if proto in ("https", "wss") else COOKIE_PLAIN


def session_id_of(settings: Settings, conn: Any) -> str | None:
    cookies = conn.cookies
    sid = cookies.get(COOKIE_SECURE)
    if not sid and not settings.in_addon:
        sid = cookies.get(COOKIE_PLAIN)
    return sid or None


def bearer_of(conn: Any) -> str | None:
    auth = conn.headers.get("authorization") or ""
    if auth[:7].lower() == "bearer ":
        token = auth[7:].strip()
        return token or None
    return None


def origin_ok(conn: Any) -> bool:
    """A browser WebSocket handshake must come from a page on this very host (CR-008 §3e.4)."""
    origin = conn.headers.get("origin")
    host = conn.headers.get("host")
    if not origin or not host:
        return False
    try:
        return urlparse(origin).netloc.lower() == host.lower()
    except ValueError:
        return False


# ---------------------------------------------------------------- policy (database side)

def remote_settings(conn) -> dict[str, Any]:
    from ..routers.settings import read_settings

    s = read_settings(conn)
    return {k: v for k, v in s.items() if k.startswith("remote.")}


def has_flag(conn, user_id: str) -> bool:
    try:
        return conn.execute("SELECT 1 FROM remote_access_users WHERE user_id = ?", (user_id,)).fetchone() is not None
    except Exception:  # noqa: BLE001 - before migration 0033
        return False


def build_principal(conn, ha_user: HaUser) -> Principal:
    """The same Principal model as Ingress: HA user id, the HA username from the directory (the token's user info has
    none) or from the users row, the HA display name."""
    username = ""
    row = conn.execute("SELECT username FROM ha_users WHERE id = ?", (ha_user.id,)).fetchone()
    if row and row["username"]:
        username = row["username"]
    else:
        row = conn.execute("SELECT username FROM users WHERE id = ?", (ha_user.id,)).fetchone()
        if row and row["username"]:
            username = row["username"]
    return Principal(user_id=ha_user.id, username=username, display_name=ha_user.name or username, source="remote")


def policy_refusal(conn, principal: Principal, ha_user: HaUser) -> ApiError | None:
    """Why this user may not use the remote channel now, or None."""
    from ..rbac import has_any_binding, permissions_anywhere

    ha_row = conn.execute("SELECT is_active FROM ha_users WHERE id = ?", (principal.user_id,)).fetchone()
    vms_row = conn.execute("SELECT active FROM users WHERE id = ?", (principal.user_id,)).fetchone()
    if (ha_row is not None and not ha_row["is_active"]) or (vms_row is not None and not vms_row["active"]):
        return ApiError(403, "remote_user_inactive", INACTIVE_HE)
    rs = remote_settings(conn)
    if rs.get("remote.policy", "flag") == "any_role":
        if not has_any_binding(conn, principal):
            return ApiError(403, "remote_not_allowed", NOT_ALLOWED_ROLE_HE, details={"policy": "any_role"})
    elif not has_flag(conn, principal.user_id):
        return ApiError(403, "remote_not_allowed", NOT_ALLOWED_FLAG_HE, details={"policy": "flag"})
    if str(rs.get("remote.require_mfa_admin", "false")) == "true" and not ha_user.mfa:
        if set(permissions_anywhere(conn, principal)) & ADMIN_PERMISSIONS:
            return ApiError(403, "remote_mfa_required", MFA_REQUIRED_HE)
    return None


def _audit(db, *, actor: Principal | None, action: str, decision: str, reason: str | None, meta: dict[str, Any], resource_id: str | None = None) -> None:
    from ..audit import audit

    try:
        with db.connection(label=action) as conn:
            audit(conn, actor=actor, action=action, decision=decision, resource_type="user", resource_id=resource_id or (actor.user_id if actor else None),
                  reason=reason, details=meta)
    except Exception:  # noqa: BLE001 - an audit failure never breaks a login or a logout
        log.exception("could not write the %s audit row", action)


# ---------------------------------------------------------------- the exchange (POST / DELETE auth/session)

async def exchange(app_state: Any, settings: Settings, conn_like: Any, token: str) -> tuple[RemoteSession, int]:
    """Bearer → session. Raises ApiError (401 / 403 / 429 / 503); every refusal is audited."""
    from starlette.concurrency import run_in_threadpool

    db = app_state.db
    meta = request_meta(conn_like)
    ip = meta["client_ip"]

    async def rejected(reason: str, err: ApiError, actor: Principal | None = None) -> ApiError:
        await run_in_threadpool(_audit, db, actor=actor, action="auth.remote_session.rejected", decision="denied", reason=reason, meta=meta)
        return err

    if not LIMITER.hit(f"ip:{ip}", IP_LIMITS):
        raise await rejected("rate_limited_ip", ApiError(429, "rate_limited", RATE_LIMITED_HE, retryable=True))
    exp = jwt_exp(token)
    if exp is None or exp <= time.time() or was_rejected(token):
        raise await rejected("token_invalid", unauthenticated("remote_token_invalid", TOKEN_INVALID_HE))
    try:
        ha_user = await validate_token(settings, token, ip)
    except TokenInvalid:
        _remember_rejected(token)
        raise await rejected("token_invalid", unauthenticated("remote_token_invalid", TOKEN_INVALID_HE))
    except HaUnavailable as exc:
        log.warning("remote sign-in: HA core could not validate the token (%s)", exc)
        raise ApiError(503, "ha_unavailable", HA_UNAVAILABLE_HE, retryable=True)
    if not LIMITER.hit(f"user:{ha_user.id}", USER_LIMITS):
        raise await rejected("rate_limited_user", ApiError(429, "rate_limited", RATE_LIMITED_HE, retryable=True))

    def decide() -> tuple[Principal, ApiError | None]:
        with db.connection(mode="read", label="auth/session") as conn:
            principal = build_principal(conn, ha_user)
            return principal, policy_refusal(conn, principal, ha_user)

    principal, refusal = await run_in_threadpool(decide)
    if refusal is not None:
        raise await rejected(refusal.code, refusal, principal)
    session = STORE.create(principal, ha_user, token, exp, ip, replaces=session_id_of(settings, conn_like))

    def touch_and_audit() -> None:
        from ..auth import touch_user

        with db.connection(label="auth/session") as conn:
            touch_user(conn, principal, force=True)
        _audit(db, actor=principal, action="auth.remote_session.created", decision="allowed", reason=None, meta=meta)

    await run_in_threadpool(touch_and_audit)
    return session, max(1, int(exp - time.time()))


def logout(app_state: Any, settings: Settings, conn_like: Any) -> bool:
    """Drop the caller's session and every other session of its chain (this browser's earlier rotations). Audited
    when one existed. A bearer-only client has no session to drop; its tokens die when HA revokes them."""
    sid = session_id_of(settings, conn_like)
    s = STORE.drop_chain(sid) if sid else None
    if s is not None:
        _audit(app_state.db, actor=s.principal, action="auth.remote_session.logout", decision="allowed", reason=None, meta=request_meta(conn_like))
    return s is not None


# ---------------------------------------------------------------- per request (resolve_principal's remote branch)

def _bearer_principal(request: Any, settings: Settings, token: str) -> Principal:
    key = token_hash(token)
    now = time.time()
    with _cache_lock:
        hit = _bearer_cache.get(key)
    if hit and now - hit[1] < BEARER_CACHE_S and hit[2] > now:
        return hit[0]
    exp = jwt_exp(token)
    if exp is None or exp <= now or was_rejected(token):
        raise unauthenticated("remote_token_invalid", TOKEN_INVALID_HE)
    try:
        asyncio.get_running_loop()
        # on the event loop (never expected: HTTP dependencies run in the thread pool) a blocking call is not allowed
        raise unauthenticated("remote_login_required", LOGIN_REQUIRED_HE)
    except RuntimeError:
        pass
    ip = client_ip(request)
    db = request.app.state.db
    meta = {**request_meta(request), "via": "bearer"}

    def rejected(reason: str, err: ApiError, actor: Principal | None = None) -> ApiError:
        _audit(db, actor=actor, action="auth.remote_session.rejected", decision="denied", reason=reason, meta=meta)
        return err

    if not LIMITER.hit(f"ip:{ip}", IP_LIMITS):
        raise rejected("rate_limited_ip", ApiError(429, "rate_limited", RATE_LIMITED_HE, retryable=True))
    try:
        ha_user = asyncio.run(validate_token(settings, token, ip))
    except TokenInvalid:
        _remember_rejected(token)
        raise rejected("token_invalid", unauthenticated("remote_token_invalid", TOKEN_INVALID_HE))
    except HaUnavailable:
        raise ApiError(503, "ha_unavailable", HA_UNAVAILABLE_HE, retryable=True)
    if not LIMITER.hit(f"user:{ha_user.id}", USER_LIMITS):
        raise rejected("rate_limited_user", ApiError(429, "rate_limited", RATE_LIMITED_HE, retryable=True))
    with db.connection(mode="read", label="remote bearer") as conn:
        principal = build_principal(conn, ha_user)
        refusal = policy_refusal(conn, principal, ha_user)
    if refusal is not None:
        raise rejected(refusal.code, refusal, principal)
    with _cache_lock:
        if len(_bearer_cache) > 5000:
            _bearer_cache.clear()
        _bearer_cache[key] = (principal, now, exp)
    return principal


def remote_resolves_in_memory(request: Any, settings: Settings) -> bool:
    """True when remote_principal will answer from memory - a live session cookie, or a bearer token still in the
    validation cache - so the caller need not give up its write lock for it (auth._principal). A peek only: it
    touches neither the session's last use nor the cache."""
    sid = session_id_of(settings, request)
    now = time.time()
    if sid:
        with STORE._lock:
            s = STORE._sessions.get(sid)
            if s is not None and s.token_exp > now:
                return True
    token = bearer_of(request)
    if not token:
        return True  # no credential: refused at once, nothing to call
    with _cache_lock:
        hit = _bearer_cache.get(token_hash(token))
    return bool(hit and now - hit[1] < BEARER_CACHE_S and hit[2] > now)


def remote_principal(request: Any, settings: Settings) -> Principal:
    s = STORE.get(session_id_of(settings, request))
    if s is not None:
        return s.principal
    token = bearer_of(request)
    if token:
        return _bearer_principal(request, settings, token)
    raise unauthenticated("remote_login_required", LOGIN_REQUIRED_HE)


async def remote_principal_ws(websocket: Any, settings: Settings) -> Principal | None:
    """A remote WebSocket handshake. A browser (the session cookie): Origin must be this host; the socket is attached
    to its session, so revoking the session closes it. A client with `Authorization: Bearer` and no cookie (the future
    native app, which cannot be driven cross-site by a page): the token is validated like any bearer request, without
    blocking the event loop."""
    sid = session_id_of(settings, websocket)
    if sid:
        if not origin_ok(websocket):
            return None
        s = STORE.get(sid)
        if s is None:
            return None
        STORE.attach_socket(s.sid, websocket)
        return s.principal
    token = bearer_of(websocket)
    if not token:
        return None
    from starlette.concurrency import run_in_threadpool

    try:
        return await run_in_threadpool(_bearer_principal, websocket, settings, token)
    except ApiError:
        return None


# ---------------------------------------------------------------- background revalidation

async def _close_sockets() -> None:
    for ws in STORE.take_sockets_to_close():
        try:
            await ws.close(code=4401)
        except Exception:  # noqa: BLE001 - already closed
            pass


async def revalidate_once(db: Any, settings: Settings, validate: Callable[..., Any] | None = None) -> int:
    """One pass: re-ask HA for every recently used session not validated for REVALIDATE_EVERY_S, re-check the policy,
    drop what fails. Returns the number of sessions dropped."""
    from starlette.concurrency import run_in_threadpool

    validate = validate or validate_token
    dropped = 0
    for s in STORE.due_for_revalidation():
        reason: str | None = None
        ha_user = s.ha_user
        try:
            ha_user = await validate(settings, s.token, s.client_ip)
        except TokenInvalid:
            reason = "token_revoked"
        except HaUnavailable:
            continue  # HA briefly away: keep the session (it ends with its access token anyway)
        if reason is None:
            def check() -> ApiError | None:
                with db.connection(mode="read", label="remote revalidate") as conn:
                    return policy_refusal(conn, s.principal, ha_user)

            refusal = await run_in_threadpool(check)
            reason = refusal.code if refusal is not None else None
        if reason is None:
            s.last_validated = time.time()
            s.ha_user = ha_user
            continue
        STORE.drop(s.sid)
        dropped += 1
        await run_in_threadpool(_audit, db, actor=s.principal, action="auth.remote_session.revoked", decision="denied", reason=reason,
                                meta={"client_ip": s.client_ip})
    await _close_sockets()
    return dropped


async def revalidate_loop(db: Any, settings: Settings) -> None:
    while True:
        await asyncio.sleep(LOOP_TICK_S)
        try:
            await revalidate_once(db, settings)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - never let the loop die
            log.warning("remote session revalidation failed", exc_info=True)


def reset_for_tests() -> None:
    STORE.clear()
    LIMITER.clear()
    with _cache_lock:
        _bearer_cache.clear()
        _rejected.clear()
    _core_base.clear()
    _xff_refused.clear()
