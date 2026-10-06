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
- **Policy:** `remote.policy` = `flag` (only users with the per-user remote-access flag, table remote_access_users, or -
  while `remote.admins_default` is on, the default - an administrator: an active installation-wide `system_admin`
  binding, rbac.is_system_admin) or `any_role` (every HA user holding any Arx role); `remote.require_mfa_admin` (default
  off, D8) refuses users holding an administrative permission whose HA account has no MFA module enabled. Inactive users
  (HA directory or VMS) are refused. The deciding `basis` (flag | admin_default | any_role) goes on the created audit row.
- **Rate limits:** the exchange and logout endpoints, per client address and per user; a negative cache of rejected
  token hashes. **Audit:** `auth.remote_session.created | .rejected | .revoked | .logout` (ids, address, country and
  user agent; never a token or a cookie).
"""
from __future__ import annotations

import asyncio
import base64
import collections
import dataclasses
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
REVOKED_HE = "הכניסה הזו נותקה (מרשימת הכניסות מרחוק). יש להיכנס מחדש."
REMOTE_UNAVAILABLE_HE = "לא ניתן לאמת את הכניסה כרגע. נסה שוב בעוד רגע."

COOKIE_SECURE = "__Secure-arx_session"
COOKIE_PLAIN = "arx_session"  # only outside the add-on over plain http (a developer / Playwright backend)

REVALIDATE_EVERY_S = 60.0
ACTIVE_WINDOW_S = 120.0
LOOP_TICK_S = 5.0
BEARER_CACHE_S = 60.0
MAX_SESSIONS_PER_USER = 20
MAX_FACTOR_SIGN_INS = 10000  # SessionStore._factor_ok: bounded (the oldest tenth goes first)
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


def _jwt_payload(token: str) -> dict[str, Any] | None:
    parts = token.split(".")
    if len(parts) != 3 or not all(parts) or len(token) > 4096:
        return None
    try:
        raw = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(raw.encode("ascii")))
    except (ValueError, UnicodeError):
        return None
    return payload if isinstance(payload, dict) else None


def jwt_exp(token: str) -> float | None:
    """The unverified `exp` of an HA access token (a JWT), or None when the string is not shaped like one. Only a
    pre-check: HA verifies the signature when we ask it."""
    payload = _jwt_payload(token)
    exp = payload.get("exp") if payload else None
    return float(exp) if isinstance(exp, (int, float)) else None


def jwt_iss(token: str) -> str | None:
    """The unverified `iss` of an HA access token: HA puts the id of the refresh token that issued it there, so every
    access token of one sign-in (one browser, one app install) carries the same value."""
    payload = _jwt_payload(token)
    iss = payload.get("iss") if payload else None
    return iss if isinstance(iss, str) and iss else None


def iss_hash(token: str) -> str:
    """SHA-256 of the token's refresh-token id (never stored in clear); "" when the token carries none."""
    iss = jwt_iss(token)
    return hashlib.sha256(("iss:" + iss).encode("utf-8", "replace")).hexdigest() if iss else ""


def public_id(chain: str) -> str:
    """What the sessions list shows and the revoke endpoints take: a hash of the session chain, never the cookie value."""
    return hashlib.sha256(("chain:" + chain).encode("utf-8", "replace")).hexdigest()[:20]


def mask_address(ip: str) -> str:
    """An address for the sessions list: IPv4 to its /24, IPv6 to its /48; anything else is dropped."""
    import ipaddress

    try:
        addr = ipaddress.ip_address((ip or "").strip())
    except ValueError:
        return ""
    if addr.version == 4:
        return str(ipaddress.ip_network(f"{addr}/24", strict=False))
    return str(ipaddress.ip_network(f"{addr}/48", strict=False))


def agent_family(ua: str) -> str:
    """"Chrome · Android"-style family of a User-Agent (the list shows no full strings)."""
    ua = ua or ""
    if not ua:
        return ""
    browser = ("Edge" if "Edg/" in ua else "Samsung Internet" if "SamsungBrowser/" in ua else "Opera" if "OPR/" in ua
               else "Firefox" if ("Firefox/" in ua or "FxiOS/" in ua) else "Chrome" if ("Chrome/" in ua or "CriOS/" in ua)
               else "Safari" if "Safari/" in ua else "")
    osname = ("iOS" if ("iPhone" in ua or "iPad" in ua) else "Android" if "Android" in ua else "Windows" if "Windows" in ua
              else "macOS" if "Mac OS X" in ua else "Linux" if "Linux" in ua else "")
    if not browser and not osname:
        return ua.split("/", 1)[0][:40]
    return " · ".join(x for x in (browser, osname) if x)


# ---------------------------------------------------------------- HA core: where and how

_core_base: dict[str, str] = {}


def _supervisor_core_base() -> str:
    """`http(s)://homeassistant:<port>` from the Supervisor's /core/info (the add-on's own token, server-side only);
    `http://homeassistant:8123` when the Supervisor does not answer. Read through the single door of the add-on's infrastructure calls
    (`self_update.send`)."""
    import os

    from . import self_update

    token = os.environ.get("SUPERVISOR_TOKEN")
    port, tls = 8123, False
    if token:
        try:
            reply = self_update.send("GET", self_update.P_CORE_INFO, base=self_update.DEFAULT_BASE, token=token, timeout=5)
            if reply.kind != "ok":
                raise ConnectionError(reply.kind)
            data = reply.data or {}
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
    # CR-008 P2: what the sessions list shows and how it was made
    via: str = "cookie"  # cookie (an Arx session) | bearer (an HA access token on every request, a native client)
    chain_started: float = 0.0  # when this browser / client signed in (the chain's first session)
    last_ip: str = ""
    country: str = ""
    user_agent: str = ""
    iss_hash: str = ""  # SHA-256 of the refresh-token id the access token carries (remote_revoked_chains)
    token_key: str = ""  # token_hash of a bearer session's token (the lookup key of the bearer path)
    client_id: str = ""  # the Arx OAuth client id this sign-in was made from: `<origin><remote_path>/` (review M1)
    continued: bool = False  # the session continues an existing chain (a rotation, a native client's next token)
    # security review 2.2.0 H1: False only for a bearer session made while security.second_factor_bearer = off skipped a
    # check the user owed (a code or the admins policy); such a session never vouches for a later sign-in of its HA sign-in
    factor_checked: bool = True
    # review M3: one re-check against HA at a time per session, and none before this time after HA was unreachable
    recheck_after: float = 0.0
    recheck_lock: threading.Lock = field(default_factory=threading.Lock, repr=False, compare=False)

    def sign_in(self) -> str:
        """The sign-in this session belongs to - what the sessions list shows as one row, what a revoke ends and what the
        live-stream budget counts (review L1): the HA refresh token behind the access token (its hashed `iss`), so every
        cookie chain and every bearer session of one sign-in share it; the cookie chain when a token carries no `iss`."""
        return "i:" + self.iss_hash if self.iss_hash else (self.chain or self.sid)


class ChainRevoked(Exception):
    """STORE.create refused: the sign-in was ended from the sessions list (possibly while this exchange was running)."""


class SessionStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions: dict[str, RemoteSession] = {}
        self._sockets: dict[str, weakref.WeakSet] = {}
        self._by_token: dict[str, str] = {}  # bearer sessions: token_hash -> sid
        self._to_close: list[Any] = []
        # review M2: the revoked sign-ins (iss hashes) in memory - filled at the START of a revoke, before its sessions are
        # dropped, and loaded from remote_revoked_chains at start-up; consulted under the lock by create()
        self._revoked_iss: set[str] = set()
        # security review 2.2.0 H1: the HA sign-ins (iss hashes) whose bearer client showed the second factor -> user id.
        # A later access token of the same sign-in continues it without a new code (also after its earlier bearer
        # sessions expired with their tokens). Memory only: a restart asks again. Cleared by drop_user / a revoke.
        self._factor_ok: dict[str, str] = {}

    def mark_factor_verified(self, iss_hash_value: str, user_id: str) -> None:
        if not iss_hash_value:
            return
        with self._lock:
            if len(self._factor_ok) >= MAX_FACTOR_SIGN_INS:
                for k in list(self._factor_ok)[: MAX_FACTOR_SIGN_INS // 10]:
                    self._factor_ok.pop(k, None)
            self._factor_ok[iss_hash_value] = user_id

    def sign_in_verified(self, iss_hash_value: str, user_id: str) -> bool:
        """Did this HA sign-in already pass the remote sign-in checks of `user_id` in this process: a bearer client of it
        showed the second factor, or a live session (cookie or bearer) of the same user belongs to it?"""
        if not iss_hash_value:
            return False
        now = time.time()
        with self._lock:
            if self._factor_ok.get(iss_hash_value) == user_id:
                return True
            return any(s.iss_hash == iss_hash_value and s.principal.user_id == user_id and s.token_exp > now and s.factor_checked
                       for s in self._sessions.values())

    def revoke_sign_ins(self, hashes: set[str], sessions: list[RemoteSession]) -> list[RemoteSession]:
        """Mark these sign-ins revoked and drop, in the same critical section, the given sessions and every session of
        those sign-ins - including one an exchange created after the caller listed them."""
        with self._lock:
            self._revoked_iss.update(h for h in hashes if h)
            for h in hashes:
                self._factor_ok.pop(h, None)
            sids = {s.sid for s in sessions} | {sid for sid, s in self._sessions.items() if s.iss_hash and s.iss_hash in self._revoked_iss}
            return [x for x in (self._drop_locked(sid) for sid in sids) if x is not None]

    def is_revoked(self, iss_hash_value: str) -> bool:
        if not iss_hash_value:
            return False
        with self._lock:
            return iss_hash_value in self._revoked_iss

    def load_revoked(self, hashes: set[str]) -> None:
        with self._lock:
            self._revoked_iss.update(hashes)

    def create(self, principal: Principal, ha_user: HaUser, token: str, token_exp: float, client_ip: str, replaces: str | None = None,
               via: str = "cookie", meta: dict[str, str] | None = None, client_id: str = "") -> RemoteSession:
        """A new session. A cookie session with `replaces` = the sid the browser presented (a rotation after a token
        refresh): that session ends now (security review M2) and its open WebSockets move to the new one instead of
        being closed. A bearer session (CR-008 P2) joins the chain of the same sign-in (the token's refresh-token id), so
        a native client's successive access tokens are one entry of the sessions list and one live-stream budget; the
        earlier tokens' sessions simply end with their tokens."""
        now = time.time()
        meta = meta or {}
        s = RemoteSession(sid=secrets.token_urlsafe(32), principal=principal, token=token, token_exp=token_exp, ha_user=ha_user,
                          client_ip=client_ip, created_at=now, last_used=now, last_validated=now, via=via, chain_started=now,
                          last_ip=client_ip, country=meta.get("country", ""), user_agent=meta.get("user_agent", ""), iss_hash=iss_hash(token),
                          token_key=token_hash(token) if via == "bearer" else "", client_id=client_id)
        s.chain = s.sid if via == "cookie" else "b:" + (s.iss_hash or s.token_key)
        with self._lock:
            if s.iss_hash and s.iss_hash in self._revoked_iss:
                raise ChainRevoked()  # review M2: a revoke landed while this exchange was validating the token
            if via == "cookie":
                old = self._sessions.get(replaces) if replaces else None
                if old is not None and old.principal.user_id == principal.user_id and old.via == "cookie":
                    s.chain = old.chain or old.sid
                    s.chain_started = old.chain_started or old.created_at
                    s.continued = True
                    self._drop_quietly_locked(old.sid, move_sockets_to=s.sid)
            else:
                prior = [x for x in self._sessions.values() if x.via == "bearer" and x.chain == s.chain and x.principal.user_id == principal.user_id]
                if prior:
                    s.chain_started = min(x.chain_started or x.created_at for x in prior)
                    s.continued = True
            self._sessions[s.sid] = s
            if s.token_key:
                self._by_token[s.token_key] = s.sid
            mine = sorted((x for x in self._sessions.values() if x.principal.user_id == principal.user_id), key=lambda x: x.created_at)
            for old in mine[:-MAX_SESSIONS_PER_USER]:
                self._drop_locked(old.sid)
        return s

    def _drop_quietly_locked(self, sid: str, move_sockets_to: str) -> None:
        old = self._sessions.pop(sid, None)
        if old is not None and old.token_key:
            self._by_token.pop(old.token_key, None)
        socks = self._sockets.pop(sid, None)
        if socks:
            self._sockets.setdefault(move_sockets_to, weakref.WeakSet()).update(socks)

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

    def get_bearer(self, key: str) -> RemoteSession | None:
        with self._lock:
            sid = self._by_token.get(key)
        return self.get(sid)

    def _drop_locked(self, sid: str) -> RemoteSession | None:
        s = self._sessions.pop(sid, None)
        if s is not None and s.token_key:
            self._by_token.pop(s.token_key, None)
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

    def peek_bearer(self, key: str) -> RemoteSession | None:
        """The bearer session of a token hash without touching it (body_limit's credential tier)."""
        with self._lock:
            sid = self._by_token.get(key)
            return self._sessions.get(sid) if sid else None

    def drop(self, sid: str) -> RemoteSession | None:
        with self._lock:
            return self._drop_locked(sid)

    def drop_chain(self, sid: str) -> RemoteSession | None:
        """Sign-out: the presented session and every other session of the same sign-in (this browser's earlier
        rotations, and a cookie-less re-exchange of the same HA sign-in)."""
        with self._lock:
            s = self._sessions.get(sid)
            if s is None:
                return None
            key = s.sign_in()
            for other in [x for x, v in self._sessions.items() if v.sign_in() == key]:
                self._drop_locked(other)
            return s

    def drop_user(self, user_id: str) -> list[RemoteSession]:
        """Every remote session of the user, cookie and bearer alike (their WebSockets close on the next pass)."""
        with self._lock:
            sids = [sid for sid, s in self._sessions.items() if s.principal.user_id == user_id]
            for h in [h for h, uid in self._factor_ok.items() if uid == user_id]:
                self._factor_ok.pop(h, None)
            return [s for s in (self._drop_locked(sid) for sid in sids) if s is not None]

    def sessions_of(self, public_ids: set[str] | None = None, user_id: str | None = None) -> list[RemoteSession]:
        """The sessions of the given sign-ins (public ids) and / or of one user."""
        with self._lock:
            return [s for s in self._sessions.values()
                    if (public_ids is None or public_id(s.sign_in()) in public_ids) and (user_id is None or s.principal.user_id == user_id)]

    def drop_sessions(self, sessions: list[RemoteSession]) -> list[RemoteSession]:
        with self._lock:
            return [x for x in (self._drop_locked(s.sid) for s in sessions) if x is not None]

    def chains(self, user_id: str | None = None) -> list[dict[str, Any]]:
        """One entry per sign-in (a browser's chain of rotated cookie sessions, a native client's successive bearer
        sessions): the freshest session, the chain's start. Newest use first."""
        now = time.time()
        out: dict[str, dict[str, Any]] = {}
        with self._lock:
            for s in self._sessions.values():
                if s.token_exp <= now or (user_id is not None and s.principal.user_id != user_id):
                    continue
                chain = s.sign_in()
                start = s.chain_started or s.created_at
                cur = out.get(chain)
                if cur is None:
                    out[chain] = {"chain": chain, "session": s, "started": start}
                    continue
                cur["started"] = min(cur["started"], start)
                if s.last_used > cur["session"].last_used:
                    cur["session"] = s
        return sorted(out.values(), key=lambda e: -e["session"].last_used)

    def attach_socket(self, sid: str, websocket: Any) -> bool:
        """False when the session is gone (revoked or expired between the check and the attach, review M2): the caller
        refuses the socket rather than serve one nothing would ever close."""
        with self._lock:
            if sid not in self._sessions:
                return False
            self._sockets.setdefault(sid, weakref.WeakSet()).add(websocket)
            return True

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

    def stats(self) -> dict[str, int]:
        """For /health: sessions by kind, sign-ins (chains), distinct users and attached sockets; no ids."""
        now = time.time()
        with self._lock:
            live = [s for s in self._sessions.values() if s.token_exp > now]
            return {"sessions": len(live), "cookie": sum(1 for s in live if s.via == "cookie"), "bearer": sum(1 for s in live if s.via == "bearer"),
                    "sign_ins": len({s.sign_in() for s in live}), "users": len({s.principal.user_id for s in live}),
                    "sockets": sum(len(v) for v in self._sockets.values())}

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()
            self._sockets.clear()
            self._by_token.clear()
            self._to_close.clear()
            self._revoked_iss.clear()
            self._factor_ok.clear()


STORE = SessionStore()

_rejected: dict[str, float] = {}  # token hash -> until (negative cache)
_cache_lock = threading.Lock()


def forget_bearer_user(user_id: str) -> None:
    """The MVP's bearer cache is gone: bearer principals are bearer sessions in STORE (CR-008 P2), so drop_user covers
    them. Kept for callers."""
    STORE.drop_user(user_id)


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


class RefusalAudits:
    """At most one audit row per key (a refusal reason + who it concerns) per window, for the refusals an anonymous
    caller can repeat at will: a rate-limited sign-in or bearer request and a cross-site request carrying a cookie of no
    live session. Each such row is a write transaction - a turn in the database's write queue - so without this a flood
    from the internet took one turn per request (round-10 §6.1 follow-up, 2026-09-30). The first refusal of a window is
    written; the rest of the window is counted, and the count is never dropped (review, audit throttle): it travels with
    the next row of the same key, or - when the key stays quiet - it is written as an end-of-window summary row by
    `flush_refusal_summaries` (the next throttled refusal of any key, and the janitor pass)."""

    WINDOW_S = 60.0

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # key -> (window start, refusals suppressed since, what a summary row needs: {"reason", "meta", "resource_id"} or None)
        self._seen: dict[str, tuple[float, int, dict[str, Any] | None]] = {}

    def admit(self, key: str, info: dict[str, Any] | None = None) -> tuple[bool, int]:
        """(write this one?, how many were suppressed before it)."""
        now = time.time()
        with self._lock:
            start, suppressed, kept = self._seen.get(key, (0.0, 0, None))
            if now - start >= self.WINDOW_S:
                self._seen[key] = (now, 0, info)
                if len(self._seen) > 20000:  # only quiet, fully accounted keys go; a key holding a count waits for its summary
                    for k in [k for k, (t, n, _) in self._seen.items() if now - t >= self.WINDOW_S and n == 0]:
                        self._seen.pop(k, None)
                return True, suppressed
            self._seen[key] = (start, suppressed + 1, info or kept)
            return False, suppressed + 1

    def expired(self) -> list[tuple[str, int, dict[str, Any] | None]]:
        """The keys whose window has ended holding a suppressed count, removed from the table: (key, count, info)."""
        now = time.time()
        with self._lock:
            done = [(k, n, info) for k, (t, n, info) in self._seen.items() if n and now - t >= self.WINDOW_S]
            for k, _n, _i in done:
                self._seen.pop(k, None)
        return done

    def clear(self) -> None:
        with self._lock:
            self._seen.clear()


REFUSAL_AUDITS = RefusalAudits()
THROTTLED_REASONS = ("rate_limited_ip", "rate_limited_user", "second_factor_locked")


def _throttle_key(reason: str, meta: dict[str, Any], subject: str | None) -> str:
    """One row per reason and per WHO it concerns: a per-user limit is keyed by the user (many users behind one address
    each get their row, and one address walking through several users' tokens does not hide behind a single row); an
    address limit by the address."""
    if reason in ("rate_limited_user", "second_factor_locked") and subject:
        return f"{reason}|user:{subject}"
    return f"{reason}|{meta.get('client_ip', '')}"


def flush_refusal_summaries(db) -> int:
    """Write the end-of-window summary rows of throttled refusals that were counted but never followed by a row of
    their own key (review, audit throttle). Returns the number written; never raises (an audit failure breaks nothing)."""
    n = 0
    for key, count, info in REFUSAL_AUDITS.expired():
        if not info:
            continue  # a key admitted without a description (the CSRF sink) carries its count on its own next row
        _audit(db, actor=None, action=info.get("action", "auth.remote_session.rejected"), decision="denied", reason=info["reason"],
               meta={**info["meta"], "suppressed": count, "summary": "window_end"}, resource_id=info.get("resource_id"))
        n += 1
    return n


def _audit_refusal(db, *, actor: Principal | None, reason: str, meta: dict[str, Any], action: str = "auth.remote_session.rejected", subject: str | None = None) -> None:
    """_audit for a refusal; a rate-limited one at most once per reason and per address (per user for rate_limited_user)
    per minute (RefusalAudits), with the folded refusals counted, never dropped."""
    resource_id = subject
    if reason in THROTTLED_REASONS:
        write, suppressed = REFUSAL_AUDITS.admit(_throttle_key(reason, meta, subject), {"reason": reason, "meta": dict(meta), "action": action, "resource_id": subject})
        flush_refusal_summaries(db)  # other keys whose window ended quietly (this key was just re-admitted or counted)
        if not write:
            return
        if suppressed:
            meta = {**meta, "suppressed_since_last": suppressed}
    _audit(db, actor=actor, action=action, decision="denied", reason=reason, meta=meta, resource_id=resource_id)


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


def arx_client_id(settings: Settings, conn: Any) -> str:
    """The OAuth client id the Arx sign-in page used on this origin: `<scheme>://<host><remote_path>/` (arx/channel.ts
    clientId()). Behind the tunnel the scheme is cloudflared's X-Forwarded-Proto (https); the add-on itself always is."""
    host = (conn.headers.get("host") or "").strip()
    if not host:
        return ""
    proto = "https" if settings.in_addon else (conn.headers.get("x-forwarded-proto") or conn.url.scheme or "http").split(",")[0].strip().lower()
    return f"{proto}://{host}{settings.remote_path}/"


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


def holds_live_credential(settings: Settings, conn: Any) -> bool:
    """body_limit.py's tier on the remote channel: does the request name a session this process knows - an Arx cookie
    of a session in the store, or a bearer token whose bearer session is in the store - and whose access token has not
    expired? Memory only (no Home Assistant, no database, no last-used touch) and NOT an authentication: the request is
    still authenticated as usual; this only decides whether it may send more than the anonymous body cap."""
    now = time.time()
    s = STORE.peek(session_id_of(settings, conn))
    if s is not None and s.token_exp > now:
        return True
    token = bearer_of(conn)
    if not token:
        return False
    b = STORE.peek_bearer(token_hash(token))
    return b is not None and b.token_exp > now


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

BASIS_FLAG = "flag"
BASIS_ADMIN_DEFAULT = "admin_default"
BASIS_ANY_ROLE = "any_role"


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


def admin_default_applies(conn, user_id: str, rs: dict[str, Any] | None = None) -> bool:
    """CR-008 amendment (owner request 2026-10-01): `remote.admins_default` (default on) admits an administrator - a user
    with an active installation-wide `system_admin` binding (rbac.is_system_admin) - without a per-user flag. It only
    matters under `remote.policy = flag`."""
    from ..rbac import is_system_admin

    rs = rs if rs is not None else remote_settings(conn)
    return str(rs.get("remote.admins_default", "true")) == "true" and is_system_admin(conn, user_id)


def remote_basis(conn, user_id: str, rs: dict[str, Any] | None = None) -> str | None:
    """Why the policy admits this user (BASIS_*), or None. An explicit per-user flag is recorded as such even when the
    administrator default would admit the user too. The caller has checked the active flags."""
    from ..rbac import Principal, has_any_binding

    rs = rs if rs is not None else remote_settings(conn)
    if rs.get("remote.policy", "flag") == "any_role":
        return BASIS_ANY_ROLE if has_any_binding(conn, Principal(user_id=user_id, username="", display_name="", source="internal")) else None
    if has_flag(conn, user_id):
        return BASIS_FLAG
    return BASIS_ADMIN_DEFAULT if admin_default_applies(conn, user_id, rs) else None


def policy_refusal(conn, principal: Principal, ha_user: HaUser) -> ApiError | None:
    """Why this user may not use the remote channel now, or None."""
    from ..rbac import permissions_anywhere

    ha_row = conn.execute("SELECT is_active FROM ha_users WHERE id = ?", (principal.user_id,)).fetchone()
    vms_row = conn.execute("SELECT active FROM users WHERE id = ?", (principal.user_id,)).fetchone()
    if (ha_row is not None and not ha_row["is_active"]) or (vms_row is not None and not vms_row["active"]):
        return ApiError(403, "remote_user_inactive", INACTIVE_HE)
    from . import wall as wall_service  # CR-030: a wall user does not travel (remote_allowed, default off)

    if wall_service.remote_refusal_needed(conn, principal.user_id):
        return ApiError(403, "wall_user_remote_not_allowed", "משתמש מסך קיר לא מורשה להתחבר מרחוק.")
    rs = remote_settings(conn)
    if remote_basis(conn, principal.user_id, rs) is None:
        if rs.get("remote.policy", "flag") == "any_role":
            return ApiError(403, "remote_not_allowed", NOT_ALLOWED_ROLE_HE, details={"policy": "any_role"})
        return ApiError(403, "remote_not_allowed", NOT_ALLOWED_FLAG_HE, details={"policy": "flag"})
    if str(rs.get("remote.require_mfa_admin", "false")) == "true" and not ha_user.mfa:
        if set(permissions_anywhere(conn, principal)) & ADMIN_PERMISSIONS:
            return ApiError(403, "remote_mfa_required", MFA_REQUIRED_HE)
    return None


def chain_revoked(conn, token: str) -> bool:
    """CR-008 P2: this access token belongs to a sign-in that was ended from the sessions list (remote_revoked_chains)."""
    h = iss_hash(token)
    if not h:
        return False
    if STORE.is_revoked(h):
        return True
    try:
        found = conn.execute("SELECT 1 FROM remote_revoked_chains WHERE iss_hash = ?", (h,)).fetchone() is not None
    except Exception:  # noqa: BLE001
        # review L6: open only before migration 0035 (no table yet); once the table is known to exist, a database error
        # fails CLOSED - but as a retryable 503, never as "revoked": a transient error must not make the browser revoke
        # its own HA sign-in (arx/auth.ts does that on remote_session_revoked), and nothing is negatively cached
        if _REVOKED_TABLE["seen"]:
            log.warning("remote_revoked_chains could not be read; refusing the sign-in for now", exc_info=True)
            raise ApiError(503, "remote_unavailable", REMOTE_UNAVAILABLE_HE, retryable=True)
        return False
    _REVOKED_TABLE["seen"] = True
    if found:
        STORE.load_revoked({h})
    return found


_REVOKED_TABLE = {"seen": False}


def load_revoked(db: Any) -> int:
    """Start-up (review M2): the revoked sign-ins into memory, and whether migration 0035's table exists (L6)."""
    try:
        with db.connection(mode="read", label="remote revoked chains") as conn:
            if conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'remote_revoked_chains'").fetchone() is None:
                return 0
            _REVOKED_TABLE["seen"] = True
            hashes = {r[0] for r in conn.execute("SELECT iss_hash FROM remote_revoked_chains").fetchall()}
    except Exception:  # noqa: BLE001 - the per-exchange database check still applies
        log.warning("could not load the revoked remote sign-ins", exc_info=True)
        return 0
    STORE.load_revoked(hashes)
    return len(hashes)


def _record_sign_in(db, principal: Principal, meta: dict[str, str]) -> None:
    """The roles screen's "last remote sign-in" (remote_sign_ins; the address masked)."""
    from ..db import now_iso

    try:
        with db.connection(label="remote sign-in") as conn:
            conn.execute(
                """INSERT INTO remote_sign_ins(user_id, last_at, last_address, last_country, sign_ins) VALUES (?, ?, ?, ?, 1)
                   ON CONFLICT(user_id) DO UPDATE SET last_at = excluded.last_at, last_address = excluded.last_address,
                                                      last_country = excluded.last_country, sign_ins = sign_ins + 1""",
                (principal.user_id, now_iso(), mask_address(meta.get("client_ip", "")), meta.get("country") or None))
    except Exception:  # noqa: BLE001 - bookkeeping never breaks a sign-in (and a database before migration 0035)
        log.warning("could not record the remote sign-in", exc_info=True)
    from . import notify_sources  # CR-018: a sign-in from a device this account has not used before tells the account's own user

    notify_sources.remote_sign_in(db, principal.user_id, meta)


def _audit(db, *, actor: Principal | None, action: str, decision: str, reason: str | None, meta: dict[str, Any], resource_id: str | None = None) -> None:
    from ..audit import audit

    meta = {**meta, "channel": "remote"}  # CR-008 P2: the audit screen's channel filter finds refusals without an actor too
    try:
        with db.connection(label=action) as conn:
            audit(conn, actor=actor, action=action, decision=decision, resource_type="user", resource_id=resource_id or (actor.user_id if actor else None),
                  reason=reason, details=meta)
    except Exception:  # noqa: BLE001 - an audit failure never breaks a login or a logout
        log.exception("could not write the %s audit row", action)


# ---------------------------------------------------------------- the optional second factor (K11, services/second_factor.py)

SECOND_FACTOR_HEADER = "x-arx-second-factor"


def second_factor_need(conn, principal: Principal, replaces: str | None) -> str:
    """What a NEW remote sign-in must still show: `code` (the user enrolled a TOTP), `enroll` (the policy requires one - the
    user's own override, their roles' or `security.second_factor_policy = admins` for an administrator - and they have none), else `none`. The rotation of the caller's own live session (same user, cookie)
    is not a new sign-in: the factor was shown when that session began."""
    from . import second_factor as sf

    old = STORE.get(replaces) if replaces else None
    if old is not None and old.principal.user_id == principal.user_id and old.via == "cookie":
        return "none"
    if sf.is_enrolled(conn, principal.user_id):
        return "code"
    # TFA2: the per-user / per-role override on top of the global policy; `required` and no factor = the enrolment-required answer
    if sf.effective_policy(conn, principal, ADMIN_PERMISSIONS)[0] == "required":
        return "enroll"
    return "none"


BEARER_FACTOR_KEY = "security.second_factor_bearer"
BEARER_FACTOR_MODES = ("enforce", "off")


def bearer_factor_enforced(conn) -> bool:
    """security review 2.2.0 H1: `security.second_factor_bearer` = enforce (default) applies the second factor and the
    `admins` policy to a NEW sign-in on the bearer path too (HTTP and WebSocket); `off` is the pre-2.2.1 behaviour, for an
    installation whose phone app does not send X-Arx-Second-Factor yet (an owner decision, audited on every such sign-in)."""
    from ..db import get_setting

    try:
        return (get_setting(conn, BEARER_FACTOR_KEY, "enforce") or "enforce") != "off"
    except Exception:  # noqa: BLE001 - fail closed
        return True


def _check_second_factor_sync(db: Any, settings: Settings, conn_like: Any, principal: Principal, meta: dict[str, Any]) -> None:
    """The code of a new sign-in of an enrolled user, from the `X-Arx-Second-Factor` header: absent -> 401
    `second_factor_required` (the page asks for it and retries); wrong -> 401 `second_factor_invalid`; locked out -> 429.
    Failures are audited (the method and the reason only, never the code). Blocking (the database)."""
    from . import second_factor as sf

    code = (conn_like.headers.get(SECOND_FACTOR_HEADER) or "").strip()
    if not code:
        raise ApiError(401, "second_factor_required", sf.REQUIRED_HE)
    err: sf.SecondFactorError | None = None
    with db.connection(label="auth/session second factor") as conn:
        try:
            sf.verify(conn, settings, principal.user_id, code)
        except sf.SecondFactorError as exc:
            err = exc
    if err is None:
        return
    reason = {"locked": "second_factor_locked", "unreadable": "second_factor_unreadable"}.get(err.code, "second_factor_invalid")
    status = 429 if err.code == "locked" else 401
    _audit_refusal(db, actor=principal, reason=reason, meta={**meta, "method": "totp"}, action="auth.second_factor.failed", subject=principal.user_id)
    raise ApiError(status, reason, err.message, retryable=err.code == "locked")


async def _check_second_factor(app_state: Any, settings: Settings, conn_like: Any, principal: Principal, meta: dict[str, Any]) -> None:
    from starlette.concurrency import run_in_threadpool

    await run_in_threadpool(_check_second_factor_sync, app_state.db, settings, conn_like, principal, meta)


# ---------------------------------------------------------------- the exchange (POST / DELETE auth/session)

async def exchange(app_state: Any, settings: Settings, conn_like: Any, token: str) -> tuple[RemoteSession, int]:
    """Bearer → session. Raises ApiError (401 / 403 / 429 / 503); every refusal is audited."""
    from starlette.concurrency import run_in_threadpool

    db = app_state.db
    meta = request_meta(conn_like)
    ip = meta["client_ip"]

    async def rejected(reason: str, err: ApiError, actor: Principal | None = None, subject: str | None = None) -> ApiError:
        await run_in_threadpool(lambda: _audit_refusal(db, actor=actor, reason=reason, meta=meta, subject=subject))
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
        raise await rejected("rate_limited_user", ApiError(429, "rate_limited", RATE_LIMITED_HE, retryable=True), subject=ha_user.id)

    replaces = session_id_of(settings, conn_like)

    def decide() -> tuple[Principal, ApiError | None, str | None, str]:
        with db.connection(mode="read", label="auth/session") as conn:
            principal = dataclasses.replace(build_principal(conn, ha_user), via="cookie")
            if chain_revoked(conn, token):
                return principal, unauthenticated("remote_session_revoked", REVOKED_HE), None, "none"
            refusal = policy_refusal(conn, principal, ha_user)
            if refusal:
                return principal, refusal, None, "none"
            return principal, None, remote_basis(conn, principal.user_id), second_factor_need(conn, principal, replaces)

    principal, refusal, basis, factor = await run_in_threadpool(decide)
    if refusal is not None:
        if refusal.code == "remote_session_revoked":
            _remember_rejected(token)
        raise await rejected(refusal.code, refusal, principal)
    if factor == "enroll":
        from . import second_factor as sf

        raise await rejected("second_factor_enrollment_required", ApiError(403, "second_factor_enrollment_required", sf.ENROLL_REQUIRED_HE), principal)
    if factor == "code":
        await _check_second_factor(app_state, settings, conn_like, principal, meta)
    try:
        session = STORE.create(principal, ha_user, token, exp, ip, replaces=replaces, meta=meta,
                               client_id=arx_client_id(settings, conn_like))
    except ChainRevoked:  # review M2: a revoke of this sign-in landed while the token was being validated
        _remember_rejected(token)
        raise await rejected("remote_session_revoked", unauthenticated("remote_session_revoked", REVOKED_HE), principal)

    def touch_and_audit() -> None:
        from ..auth import touch_user

        with db.connection(label="auth/session") as conn:
            touch_user(conn, principal, force=True)
        if not session.continued:
            _record_sign_in(db, principal, meta)
        _audit(db, actor=principal, action="auth.remote_session.created", decision="allowed", reason=None, meta={**meta, "basis": basis})

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

class NeedsUnlock(Exception):
    """remote_principal(offline=True) cannot answer from memory: it would ask Home Assistant or write a row (a new or
    re-validated token, a stale session, a refusal to audit). The caller - holding the request's write lock - retries
    with offline=False after giving the lock up (auth._principal). Never reaches a client."""


def _bearer_session(request: Any, settings: Settings, token: str, offline: bool = False) -> RemoteSession:
    """A request (or a WebSocket) carrying `Authorization: Bearer <HA access token>` and no Arx cookie - an API client,
    the future native app. CR-008 P2 (review nit): the validated token becomes a bearer SESSION in the store, so it is
    listed, revocable, counted for the live-stream cap and re-validated by the background pass like a cookie session,
    and its WebSockets close when it is revoked. Validated against HA at most every BEARER_CACHE_S when the background
    pass is not running."""
    key = token_hash(token)
    now = time.time()
    s = STORE.get_bearer(key)
    if s is not None and now - s.last_validated < BEARER_CACHE_S:
        return s
    if offline:
        raise NeedsUnlock  # validation (HA) and its refusal / sign-in rows need the write lock given up first
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

    def rejected(reason: str, err: ApiError, actor: Principal | None = None, subject: str | None = None) -> ApiError:
        if s is not None:
            STORE.drop(s.sid)
        _audit_refusal(db, actor=actor, reason=reason, meta=meta, subject=subject)
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
        raise rejected("rate_limited_user", ApiError(429, "rate_limited", RATE_LIMITED_HE, retryable=True), subject=ha_user.id)
    factor, enforced = "none", True
    with db.connection(mode="read", label="remote bearer") as conn:
        principal = dataclasses.replace(build_principal(conn, ha_user), via="bearer")
        if chain_revoked(conn, token):
            basis, refusal = None, unauthenticated("remote_session_revoked", REVOKED_HE)
        else:
            refusal = policy_refusal(conn, principal, ha_user)
            basis = None if refusal else remote_basis(conn, principal.user_id)
        # security review 2.2.0 H1: a NEW sign-in on the bearer path owes the second factor (and the `admins` policy) like
        # the cookie exchange; the next access token of a sign-in that already passed it (same HA refresh token) does not
        if refusal is None and s is None and not STORE.sign_in_verified(iss_hash(token), principal.user_id):
            factor = second_factor_need(conn, principal, None)
            enforced = bearer_factor_enforced(conn)
    if refusal is not None:
        if refusal.code == "remote_session_revoked":
            _remember_rejected(token)
        raise rejected(refusal.code, refusal, principal)
    if s is not None:
        s.last_validated = time.time()
        s.ha_user = ha_user
        return s
    factor_meta: dict[str, Any] = {}
    if factor != "none" and not enforced:
        factor_meta = {"second_factor_skipped": factor}  # security.second_factor_bearer = off (the owner's choice)
    elif factor == "enroll":
        from . import second_factor as sf

        raise rejected("second_factor_enrollment_required", ApiError(403, "second_factor_enrollment_required", sf.ENROLL_REQUIRED_HE), principal)
    elif factor == "code":
        _check_second_factor_sync(db, settings, request, principal, meta)
        factor_meta = {"second_factor": "totp"}
    try:
        s = STORE.create(principal, ha_user, token, exp, ip, via="bearer", meta=meta, client_id=arx_client_id(settings, request))
    except ChainRevoked:  # review M2: revoked while this request was validating the token
        _remember_rejected(token)
        raise rejected("remote_session_revoked", unauthenticated("remote_session_revoked", REVOKED_HE), principal)
    if factor_meta.get("second_factor_skipped"):
        s.factor_checked = False
    elif factor == "code":
        STORE.mark_factor_verified(s.iss_hash, principal.user_id)
    if not s.continued:  # a new sign-in of a bearer client (not its next access token)
        _record_sign_in(db, principal, meta)
        _audit(db, actor=principal, action="auth.remote_session.created", decision="allowed", reason=None, meta={**meta, "basis": basis, **factor_meta})
    return s


def _bearer_principal(request: Any, settings: Settings, token: str) -> Principal:
    return _bearer_session(request, settings, token).principal


def _note_use(conn: Any, s: RemoteSession) -> None:
    """The sessions list's "last seen from" (address, country, user agent) and, for the handlers of this request, which
    remote session it runs under (the live-stream cap, the list's current-session marker)."""
    h = conn.headers
    ip = client_ip(conn)
    if ip:
        s.last_ip = ip
    if h.get("cf-ipcountry"):
        s.country = h.get("cf-ipcountry", "")[:8]
    ua = h.get("user-agent")
    if ua:
        s.user_agent = ua[:200]
    try:
        conn.state.sw_remote_session = s
    except AttributeError:
        pass


def session_of(conn: Any) -> RemoteSession | None:
    """The remote session the current request / WebSocket runs under (after the principal was resolved), or None."""
    state = (getattr(conn, "scope", None) or {}).get("state") or {}
    return state.get("sw_remote_session")


# An idle session is not re-validated by the background pass (it only re-checks sessions used in the last
# ACTIVE_WINDOW_S). When one comes back after longer than this, HA and the policy are asked again BEFORE the request is
# served, so a sign-in revoked at HA while the browser was idle never gets a single request through (CR-008 P2 - the
# "idle-revoked session reused before the next tick" path of the pen-test checklist).
STALE_AFTER_S = REVALIDATE_EVERY_S + ACTIVE_WINDOW_S


HA_BACKOFF_S = 30.0  # review M3: after HA could not be asked, no re-check of that session within this window
# a request waiting for another request's re-check of the same session: at most this long, then it is served with the
# last-known session (the re-check in flight settles the next one) - a slow HA must not hold worker threads
RECHECK_WAIT_S = 1.0


def _stale(s: RemoteSession) -> bool:
    now = time.time()
    return now - s.last_validated > STALE_AFTER_S and now >= s.recheck_after


def _reuse_refused(db: Any, s: RemoteSession, reason: str, ip: str) -> None:
    STORE.drop(s.sid)
    _audit(db, actor=s.principal, action="auth.remote_session.revoked", decision="denied", reason=reason,
           meta={"client_ip": ip, "on_reuse": True, **({"via": "bearer"} if s.via == "bearer" else {})})


def _recheck_sync(request: Any, settings: Settings, s: RemoteSession) -> RemoteSession:
    """An idle session coming back (see STALE_AFTER_S). Review M3: one re-check in flight per session - concurrent
    requests of the same session wait for it and reuse its outcome instead of each asking HA - and when HA cannot be
    asked, the session is served and not re-checked again for HA_BACKOFF_S (an HA outage must not turn every request into
    a 10 s HA call that fills the thread pool). While HA stays down such a session lives until its access token expires
    (<= 30 min), as in the background pass (CR-008 §3b.5)."""
    try:
        asyncio.get_running_loop()
        return s  # never expected on the event loop (HTTP dependencies run in the thread pool); the pass re-checks it
    except RuntimeError:
        pass
    db = request.app.state.db
    ip = client_ip(request)
    if not s.recheck_lock.acquire(timeout=RECHECK_WAIT_S):
        return s  # another request is still asking HA; the pass or the next request settles it
    try:
        if STORE.peek(s.sid) is None:  # the re-check we waited for refused it (or a revoke ended it meanwhile)
            raise unauthenticated("remote_token_invalid", TOKEN_INVALID_HE)
        if not _stale(s):
            return s  # the re-check we waited for passed (or HA is in its back-off window)
        if STORE.is_revoked(s.iss_hash):  # review M2
            _reuse_refused(db, s, "remote_session_revoked", ip)
            raise unauthenticated("remote_session_revoked", REVOKED_HE)
        try:
            ha_user = asyncio.run(validate_token(settings, s.token, ip))
        except TokenInvalid:
            _reuse_refused(db, s, "token_revoked", ip)
            raise unauthenticated("remote_token_invalid", TOKEN_INVALID_HE)
        except HaUnavailable:
            s.recheck_after = time.time() + HA_BACKOFF_S
            return s
        with db.connection(mode="read", label="remote reuse") as conn:
            refusal = policy_refusal(conn, s.principal, ha_user)
        if refusal is not None:
            _reuse_refused(db, s, refusal.code, ip)
            raise refusal
        s.last_validated = time.time()
        s.ha_user = ha_user
        return s
    finally:
        s.recheck_lock.release()


async def _recheck_async(websocket: Any, settings: Settings, s: RemoteSession) -> RemoteSession | None:
    """The WebSocket handshake's re-check: the same single flight and back-off as _recheck_sync, without blocking the
    event loop while another request holds the session's re-check."""
    from starlette.concurrency import run_in_threadpool

    db = websocket.app.state.db
    ip = client_ip(websocket)
    deadline = time.monotonic() + RECHECK_WAIT_S
    while not s.recheck_lock.acquire(blocking=False):
        if time.monotonic() > deadline:
            return s
        await asyncio.sleep(0.05)
    try:
        if STORE.peek(s.sid) is None:
            return None
        if not _stale(s):
            return s
        if STORE.is_revoked(s.iss_hash):
            await run_in_threadpool(_reuse_refused, db, s, "remote_session_revoked", ip)
            return None
        try:
            ha_user = await validate_token(settings, s.token, ip)
        except TokenInvalid:
            await run_in_threadpool(_reuse_refused, db, s, "token_revoked", ip)
            return None
        except HaUnavailable:
            s.recheck_after = time.time() + HA_BACKOFF_S
            return s

        def check() -> ApiError | None:
            with db.connection(mode="read", label="remote reuse") as conn:
                return policy_refusal(conn, s.principal, ha_user)

        refusal = await run_in_threadpool(check)
        if refusal is not None:
            await run_in_threadpool(_reuse_refused, db, s, refusal.code, ip)
            return None
        s.last_validated = time.time()
        s.ha_user = ha_user
        return s
    finally:
        s.recheck_lock.release()


def remote_principal(request: Any, settings: Settings, offline: bool = False) -> Principal:
    """The remote channel's principal: the Arx session cookie, else an HA bearer token. offline=True: answer only from
    memory (a live, not stale session; a bearer session validated within BEARER_CACHE_S) and raise NeedsUnlock where
    Home Assistant would be asked or a row written - one read of the session state, so nothing can change between a
    check and the use (a session crossing STALE_AFTER_S / BEARER_CACHE_S or revoked meanwhile)."""
    s = STORE.get(session_id_of(settings, request))
    if s is not None and _stale(s):
        if offline:
            raise NeedsUnlock
        s = _recheck_sync(request, settings, s)
    if s is None:
        token = bearer_of(request)
        if not token:
            raise unauthenticated("remote_login_required", LOGIN_REQUIRED_HE)
        s = _bearer_session(request, settings, token, offline=offline)
    _note_use(request, s)
    return s.principal


async def remote_principal_ws(websocket: Any, settings: Settings) -> Principal | None:
    """A remote WebSocket handshake. A browser (the session cookie): Origin must be this host. A client with
    `Authorization: Bearer` and no cookie (the future native app, which cannot be driven cross-site by a page): the
    token is validated like any bearer request, without blocking the event loop. Either way the socket is attached to
    its session, so revoking the session (sign-out, the sessions list, the background pass) closes it at once."""
    sid = session_id_of(settings, websocket)
    if sid:
        if not origin_ok(websocket):
            return None
        s = STORE.get(sid)
        if s is not None and _stale(s):
            s = await _recheck_async(websocket, settings, s)
        if s is None:
            return None
    else:
        token = bearer_of(websocket)
        if not token:
            return None
        from starlette.concurrency import run_in_threadpool

        try:
            s = await run_in_threadpool(_bearer_session, websocket, settings, token)
        except ApiError:
            return None
    if not STORE.attach_socket(s.sid, websocket):
        return None  # review M2: the session ended between the lookup and the attach - nothing would close this socket
    _note_use(websocket, s)
    return s.principal


# ---------------------------------------------------------------- the sessions list and its revocations (CR-008 P2)

def describe(entry: dict[str, Any], current_chain: str | None = None, live_by_chain: dict[str, int] | None = None) -> dict[str, Any]:
    """One row of GET auth/sessions: no cookie value, no token, no full address or user agent."""
    import datetime as dt

    s: RemoteSession = entry["session"]
    chain = entry["chain"]

    def iso(t: float) -> str:
        return dt.datetime.fromtimestamp(t, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    return {
        "id": public_id(chain),
        "user_id": s.principal.user_id,
        "username": s.principal.username,
        "display_name": s.principal.display_name,
        "created_at": iso(entry["started"]),
        "last_seen_at": iso(s.last_used),
        "address": mask_address(s.last_ip or s.client_ip),
        "country": s.country or None,
        "agent": agent_family(s.user_agent),
        "channel": s.via,
        "current": chain == current_chain,
        "live_streams": (live_by_chain or {}).get(chain, 0),
    }


HA_DELETE_TIMEOUT_S = 8.0  # review M1: every HA deletion of one revoke together, then the answer goes out regardless


async def delete_refresh_token_at_ha(settings: Settings, token: str, client_id: str) -> bool:
    """End the sign-in at HA as well, with the user's own access token (what HA's profile page does) - but only when HA
    confirms it is ONE OF OURS (review M1): `auth/refresh_tokens` lists the user's refresh tokens, and only the entry whose
    id is this token's `iss`, whose type is `normal` and whose client_id is this Arx address (`<origin><remote_path>/`)
    is deleted with `auth/delete_refresh_token`. A long-lived access token or a sign-in of another client (the Companion
    app, HA's own UI) used on the bearer path is never touched. Best effort, never raises; the caller bounds the time.
    Used only when users end their OWN sessions - an administrator's revoke ends the Arx access, not the user's HA
    sign-in."""
    iss = jwt_iss(token)
    if not iss or not client_id or (jwt_exp(token) or 0) <= time.time():
        return False
    try:
        ws = await _dial(core_ws_url(settings), {})
    except Exception:  # noqa: BLE001
        return False
    try:
        hello = json.loads(await ws.recv())
        if hello.get("type") != "auth_required":
            return False
        await ws.send(json.dumps({"type": "auth", "access_token": token}))
        if json.loads(await ws.recv()).get("type") != "auth_ok":
            return False

        async def call(msg_id: int, payload: dict[str, Any]) -> dict[str, Any]:
            await ws.send(json.dumps({"id": msg_id, **payload}))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("id") == msg_id and msg.get("type") == "result":
                    return msg

        listing = await call(1, {"type": "auth/refresh_tokens"})
        if not listing.get("success") or not isinstance(listing.get("result"), list):
            return False
        mine = next((t for t in listing["result"] if isinstance(t, dict) and t.get("id") == iss), None)
        if mine is None or mine.get("type") != "normal" or mine.get("client_id") != client_id:
            log.info("sign out everywhere: HA refresh token left alone (type %s, not this Arx client)", (mine or {}).get("type"))
            return False
        return bool((await call(2, {"type": "auth/delete_refresh_token", "refresh_token_id": iss})).get("success"))
    except Exception:  # noqa: BLE001 - HA away, a dropped socket: the local revocation stands anyway
        return False
    finally:
        try:
            await ws.close()
        except Exception:  # noqa: BLE001
            pass


async def revoke_sessions(app_state: Any, settings: Settings, sessions: list[RemoteSession], *, actor: Principal, reason: str,
                          target_user: str, also_at_ha: bool, request_id: str | None = None) -> dict[str, int]:
    """End these remote sessions now: their sign-ins marked revoked in memory FIRST (review M2 - an exchange of the same
    sign-in racing this revoke is refused inside STORE.create) and their sessions dropped in the same step, their
    WebSockets closed before this returns, the sign-ins recorded in remote_revoked_chains (the browser cannot re-exchange
    a fresh access token of the same sign-in, also after a restart), their exact tokens negatively cached, one audit row.
    `also_at_ha`: the user's own request - their Arx refresh tokens at HA are deleted too (only ours, see
    delete_refresh_token_at_ha), concurrently and within HA_DELETE_TIMEOUT_S in all."""
    from starlette.concurrency import run_in_threadpool

    from ..db import now_iso

    dropped = STORE.revoke_sign_ins({s.iss_hash for s in sessions if s.iss_hash}, sessions)
    for s in dropped:
        _remember_rejected(s.token)
    sign_ins = {s.sign_in() for s in dropped}
    hashes = {s.iss_hash: s.principal.user_id for s in dropped if s.iss_hash}

    def persist() -> None:
        from ..audit import audit

        with app_state.db.connection(label="auth/sessions revoke") as conn:
            now = now_iso()
            for h, uid in hashes.items():
                conn.execute("INSERT OR IGNORE INTO remote_revoked_chains(iss_hash, user_id, revoked_at, revoked_by, reason) VALUES (?, ?, ?, ?, ?)",
                             (h, uid, now, actor.user_id, reason))
            # a year after the revoke HA's sliding 90-day refresh token cannot still be alive unless used - and a used one is
            # refused here; keep the table small
            conn.execute("DELETE FROM remote_revoked_chains WHERE revoked_at < ?", (_days_ago(365),))
            # review L4: the channel is the ACTOR's (an administrator may revoke from inside the system); what was ended
            # is `ended_via` (cookie / bearer)
            audit(conn, actor=actor, action="auth.remote_session.revoked", decision="allowed", resource_type="user", resource_id=target_user,
                  reason=reason, request_id=request_id,
                  details={"sessions": len(sign_ins), "ids": sorted(public_id(c) for c in sign_ins)[:20],
                           "channel": "remote" if actor.source == "remote" else "local", "ended_via": sorted({s.via for s in dropped})})

    await run_in_threadpool(persist)
    await _close_sockets()
    at_ha = 0
    if also_at_ha:
        freshest: dict[str, RemoteSession] = {}
        for s in dropped:
            key = s.iss_hash or s.sid
            if key not in freshest or s.token_exp > freshest[key].token_exp:
                freshest[key] = s
        tasks = [asyncio.ensure_future(delete_refresh_token_at_ha(settings, s.token, s.client_id)) for s in freshest.values()]
        if tasks:
            done, pending = await asyncio.wait(tasks, timeout=HA_DELETE_TIMEOUT_S)
            for t in pending:
                t.cancel()
            at_ha = sum(1 for t in done if not t.cancelled() and t.exception() is None and t.result())
            if pending:
                log.warning("sign out everywhere: %d HA deletion(s) did not finish in %.0f s; the Arx revocation stands", len(pending), HA_DELETE_TIMEOUT_S)
    return {"sessions_ended": len(sign_ins), "ha_sign_ins_ended": at_ha}


def revoke_user_sign_ins(conn: Any, user_id: str, *, actor: Principal, reason: str, keep: RemoteSession | None = None,
                         request_id: str | None = None) -> int:
    """Security review 2.2.0 M4: end every remote sign-in of `user_id` except the HA sign-in of `keep` (the caller's own
    current session) - synchronously, on the caller's request connection: the sign-ins are marked revoked in memory and
    their sessions dropped at once (their WebSockets close on the background pass's next tick), recorded in
    remote_revoked_chains (the same HA sign-in cannot come back, also after a restart), their tokens negatively cached and
    one audit row written. A sign-in without an `iss` (no chain to record) is only dropped. Returns the sign-ins ended."""
    from ..audit import audit
    from ..db import now_iso

    keep_iss = keep.iss_hash if keep is not None else ""
    keep_sid = keep.sid if keep is not None else ""
    victims = [s for s in STORE.sessions_of(user_id=user_id) if s.sid != keep_sid and not (keep_iss and s.iss_hash == keep_iss)]
    if not victims:
        return 0
    dropped = STORE.revoke_sign_ins({s.iss_hash for s in victims if s.iss_hash}, victims)
    dropped = [s for s in dropped if s.sid != keep_sid]
    for s in dropped:
        _remember_rejected(s.token)
    sign_ins = {s.sign_in() for s in dropped}
    now = now_iso()
    try:
        for h in {s.iss_hash for s in dropped if s.iss_hash}:
            conn.execute("INSERT OR IGNORE INTO remote_revoked_chains(iss_hash, user_id, revoked_at, revoked_by, reason) VALUES (?, ?, ?, ?, ?)",
                         (h, user_id, now, actor.user_id, reason))
    except Exception:  # noqa: BLE001 - before migration 0035: the in-memory revocation stands
        log.warning("could not record the revoked remote sign-ins", exc_info=True)
    audit(conn, actor=actor, action="auth.remote_session.revoked", decision="allowed", resource_type="user", resource_id=user_id, reason=reason,
          request_id=request_id, details={"sessions": len(sign_ins), "ids": sorted(public_id(c) for c in sign_ins)[:20],
                                          "channel": "remote" if actor.source == "remote" else "local", "ended_via": sorted({s.via for s in dropped})})
    return len(sign_ins)


def _days_ago(days: int) -> str:
    import datetime as dt

    return (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")


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
        if STORE.is_revoked(s.iss_hash):  # review M2: a sign-in ended from the sessions list never survives a pass
            reason = "remote_session_revoked"
        else:
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
                                meta={"client_ip": s.client_ip, **({"via": "bearer"} if s.via == "bearer" else {})})
    await _close_sockets()
    return dropped


async def revalidate_loop(db: Any, settings: Settings) -> None:
    from starlette.concurrency import run_in_threadpool

    from .. import remote_channel

    await run_in_threadpool(remote_channel.load_csp_mode, db)
    await run_in_threadpool(load_revoked, db)  # review M2 / L6: the revoked sign-ins and the table's existence
    ticks = 0
    while True:
        await asyncio.sleep(LOOP_TICK_S)
        try:
            await revalidate_once(db, settings)
            ticks += 1
            if ticks % 6 == 0:  # every 30 s the CSP mode follows the database too (a restored backup, CR-008 P2)
                await run_in_threadpool(remote_channel.load_csp_mode, db)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - never let the loop die
            log.warning("remote session revalidation failed", exc_info=True)


def reset_for_tests() -> None:
    from .. import remote_channel

    remote_channel.set_csp_enforce(False)
    STORE.clear()
    LIMITER.clear()
    REFUSAL_AUDITS.clear()
    with _cache_lock:
        _rejected.clear()
    _core_base.clear()
    _xff_refused.clear()
    _REVOKED_TABLE["seen"] = False
