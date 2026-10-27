"""USR2 phase 1: Arx-only (local) identities - people who exist only in SmplWise Arx and never hold a Home Assistant account.

Design record: docs/design/USR2_ARX_ONLY_IDENTITY_SPEC.md; contract amendment: docs/changes/CR-USR2-ARX-ONLY-IDENTITY.md.
Everything here is inert while the setting `security.local_identity` is `off` (the default): no route mints anything, a cookie
with the local prefix resolves to nothing (the HA path then answers exactly as before) and the janitor finds no rows.

- Ids: `l_` + 26 Crockford base32 characters (time + randomness). Never an HA id (32 hex), never accepted from Ingress headers.
- Sessions: an opaque cookie `l.<43 base64url chars>` under the SAME cookie names and attributes as the HA sessions
  (`__Secure-arx_session` / `arx_session`, HttpOnly, Secure, SameSite=Strict, Path=<remote_path>/), so the CSRF middleware, the
  media / WebSocket readers and the shell work unchanged. Only SHA-256(cookie) is stored (auth_local_sessions). Persistent across
  restarts; a 15-second in-process cache keeps the hot path off the database, and every revoke empties the cache entry at once.
- Lifetimes (`security.local_session`): rolling_30d (absolute 30 d, idle 14 d, default) | rolling_90d (90 d / 30 d) |
  browser_session (no Max-Age; 12 h / 2 h). Holders of an administrative permission: absolute `security.local_admin_session_days`
  (7) and idle 24 h whatever the mode (owner answer Q3).
- Rotation (new cookie value, same chain; the old value keeps resolving to the new row for 60 s): at sign-in (always a new
  chain), every 24 h of use, on a password change, on second-factor enrolment and when the user's permissions fingerprint moved.
- Owner answer Q3 (the administrative-permission rule): a local principal can use a permission of LOCAL_ADMIN_PERMISSIONS
  (rbac.py) only when its session's sign-in presented a TOTP code (`factor_at`); otherwise rbac.authorize refuses it with the
  reason `second_factor_required` - fail closed until the user has enrolled and signed in with the code.
- A session whose TOTP policy is `required` but whose user has not enrolled yet (gate "enrol"), or whose password must be
  changed (a temporary link), reaches only the few routes needed to get out of that state (ENROL_PATHS / CHANGE_PATHS).
- Brute force (section 10, as amended by USR2-FIX F2): per (account, source network) in memory (delay doubling from the 5th
  failure in 15 min, 30 s .. 15 min - a guesser elsewhere never delays the person signing in from their own network), plus a
  per-account ceiling in the database (ACCOUNT_CEILING failures in one fixed 15-minute window, from all networks together, locks
  the account for ACCOUNT_LOCK_S - audited, cleared by an administrator's unlock or by time); per address (20 / min, 100 / h,
  300 / day; 429 + Retry-After), global (300 failures in 10 min from at least 5 distinct networks - phase 2, review F7: every
  sign-in waits 2 s and accounts without a success in 30 days are refused for the window). Phase 2: the storm, the 10th failure of
  one network and the ceiling lock also reach the managers through the notification centre (`_notify`). Unknown usernames follow exactly the same two schedules in memory, and every refusal is the
  same 401 `sign_in_failed` after the same kind of work (a dummy hash for unknown names). Hashing is admitted through a
  bounded waiting room (local_passwords.admit; USR2-FIX F3): beyond it the answer is the uniform 429 without hashing.
- Nothing here logs, audits or returns a password, a cookie value, a link token or a typed unknown username.
"""
from __future__ import annotations

import collections
import dataclasses
import datetime as dt
import hashlib
import logging
import re
import secrets
import threading
import time
import weakref
from dataclasses import dataclass, field
from typing import Any

from ..config import Settings
from ..errors import ApiError
from ..rbac import LOCAL_ADMIN_PERMISSIONS, Principal

log = logging.getLogger("smplwise.local_identity")

FEATURE_KEY = "security.local_identity"
ID_PREFIX = "l_"
COOKIE_PREFIX = "l."
PENDING_COOKIE_SECURE = "__Secure-arx_pending"
PENDING_COOKIE_PLAIN = "arx_pending"

SIGN_IN_FAILED_HE = "שם המשתמש או הסיסמה אינם נכונים."
LINK_INVALID_HE = "הקישור אינו בתוקף. בקש מהמנהל קישור חדש."
OFF_HE = "כניסת משתמשי Arx אינה מופעלת במערכת הזו."
RATE_LIMITED_HE = "יותר מדי ניסיונות כניסה. נסה שוב בעוד כמה דקות."
PENDING_EXPIRED_HE = "תהליך הכניסה פג. יש להיכנס מחדש."
ENROL_REQUIRED_HE = "החשבון הזה מחייב אימות דו־שלבי. הפעל אותו ב״החשבון שלי״ כדי להמשיך."
CHANGE_REQUIRED_HE = "יש לבחור סיסמה חדשה לפני שממשיכים."

SESSION_MODES = {"rolling_30d": (30 * 86400, 14 * 86400, True), "rolling_90d": (90 * 86400, 30 * 86400, True),
                 "browser_session": (12 * 3600, 2 * 3600, False)}
ADMIN_IDLE_S = 24 * 3600
ROTATE_EVERY_S = 24 * 3600
ROTATE_GRACE_S = 60.0
TOUCH_EVERY_S = 60.0
CACHE_TTL_S = 15.0
FLAG_TTL_S = 5.0
PENDING_TTL_S = 300.0
PENDING_MAX_ATTEMPTS = 5

# section 10 tiers
ACCOUNT_FREE_FAILURES = 5
ACCOUNT_WINDOW_S = 15 * 60
ACCOUNT_DELAY_FIRST_S = 30.0
ACCOUNT_DELAY_CAP_S = 15 * 60
ACCOUNT_NOTIFY_AT = 10
# USR2-FIX F2: the per-account delay above is keyed by (account, source network) in memory; the database keeps only a much
# higher installation-wide ceiling per account (fixed, clock-aligned windows) that genuinely locks for ACCOUNT_LOCK_S, is audited
# (`auth.local.account_locked`) and is cleared by an administrator (`POST identity/local-users/{id}/unlock`) or by time.
ACCOUNT_CEILING = 50
ACCOUNT_CEILING_WINDOW_S = 15 * 60
ACCOUNT_LOCK_S = 15 * 60
DELAY_SLEEP_CAP_S = 3.0
IP_WINDOWS: tuple[tuple[int, int], ...] = ((60, 20), (3600, 100), (86400, 300))
GLOBAL_WINDOW_S = 600
GLOBAL_STORM_AT = 300
GLOBAL_STORM_NETWORKS = 5  # USR2 phase 2 (security review F7): distinct source networks (IPv4 address / IPv6 /64) a storm needs
GLOBAL_WAIT_S = 2.0
STALE_ACCOUNT_DAYS = 30
SET_PASSWORD_LIMITS: list[tuple[float, int]] = [(60.0, 10)]

# the routes a gated session (enrolment required / password change required) may still reach, relative to the remote prefix
ENROL_PATHS = ("/api/v1/me", "/api/v1/auth/second-factor", "/api/v1/auth/session", "/api/v1/auth/sessions", "/api/v1/auth/local/password",
               "/api/v1/auth/remote-config", "/api/v1/auth/passkeys")  # USR2 phase 4: a passkey is an enrolment path too (owner answer Q3)
CHANGE_PATHS = ("/api/v1/me", "/api/v1/auth/session", "/api/v1/auth/sessions", "/api/v1/auth/local/password", "/api/v1/auth/remote-config")

USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,31}$")
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,189}\.[^@\s]{2,63}$")
_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


# ---------------------------------------------------------------- small helpers

def is_local_id(user_id: str | None) -> bool:
    return isinstance(user_id, str) and user_id.startswith(ID_PREFIX)


def new_local_id() -> str:
    """`l_` + a 26-character ULID (48-bit milliseconds + 80 random bits, Crockford base32)."""
    value = (int(time.time() * 1000) << 80) | secrets.randbits(80)
    chars = []
    for _ in range(26):
        chars.append(_CROCKFORD[value & 31])
        value >>= 5
    return ID_PREFIX + "".join(reversed(chars))


def iso(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def epoch(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        return dt.datetime.strptime(value[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=dt.timezone.utc).timestamp()
    except ValueError:
        return 0.0


def sid_hash_of(cookie_value: str) -> str:
    return hashlib.sha256(cookie_value.encode("utf-8", "replace")).hexdigest()


def token_hash(token: str) -> str:
    return hashlib.sha256(("link:" + token).encode("utf-8", "replace")).hexdigest()


def public_id(chain_id: str) -> str:
    """What the sessions list shows and the revoke routes take: a hash of the chain in its own namespace (never the cookie)."""
    return hashlib.sha256(("lchain:" + chain_id).encode("utf-8", "replace")).hexdigest()[:20]


def username_key(name: str | None) -> str:
    from ..auth import normalize_username

    return normalize_username(name)


def _uname_hash(name: str) -> str:
    return hashlib.sha256(("uname:" + username_key(name)).encode("utf-8", "replace")).hexdigest()[:32]


# ---------------------------------------------------------------- the feature switch

_flag: dict[str, Any] = {"value": None, "at": 0.0}
_flag_lock = threading.Lock()


def enabled(conn) -> bool:
    from ..db import get_setting

    try:
        return (get_setting(conn, FEATURE_KEY, "off") or "off") == "on"
    except Exception:  # noqa: BLE001 - fail closed
        return False


def enabled_db(db: Any) -> bool:
    """The switch through a short read (cached FLAG_TTL_S); PATCH settings clears the cache at once."""
    now = time.time()
    with _flag_lock:
        if _flag["value"] is not None and now - _flag["at"] < FLAG_TTL_S:
            return bool(_flag["value"])
    try:
        with db.connection(mode="read", label="local identity flag") as conn:
            value = enabled(conn)
    except Exception:  # noqa: BLE001 - fail closed
        value = False
    with _flag_lock:
        _flag["value"], _flag["at"] = value, now
    return value


def flag_changed() -> None:
    with _flag_lock:
        _flag["value"] = None
    CACHE.clear()


# ---------------------------------------------------------------- roles and the administrative rule

def role_refusal(conn, role_id: str) -> str | None:
    """Why a role can never be bound to a local identity (owner answer Q3: any role except system_admin - and so no role
    carrying a system permission, which only system_admin holds, or identity.local.manage); None when it may be."""
    from ..rbac import all_roles
    from ..routers.access import SYSTEM_PERMISSIONS

    roles = all_roles(conn)
    if role_id not in roles:
        return "role_unknown"
    if role_id == "system_admin":
        return "system_admin_not_allowed"
    if set(roles[role_id]) & (set(SYSTEM_PERMISSIONS) | {"identity.local.manage"}):
        return "system_permission_not_allowed"
    return None


def _internal(user_id: str) -> Principal:
    return Principal(user_id=user_id, username="", display_name="", source="internal")


def role_is_admin(conn, role_id: str) -> bool:
    from ..rbac import role_permissions

    return bool(set(role_permissions(conn, role_id)) & LOCAL_ADMIN_PERMISSIONS)


def holds_admin(conn, user_id: str) -> bool:
    """Does this user hold any administrative permission anywhere (the raw bindings, before the second-factor gate)."""
    from ..rbac import permissions_anywhere

    return bool(set(permissions_anywhere(conn, _internal(user_id))) & LOCAL_ADMIN_PERMISSIONS)


def has_factor(conn, user_id: str) -> bool:
    """USR2 phase 4: a TOTP factor or a usable passkey (services/local_passkeys.has_factor)."""
    from . import local_passkeys

    return local_passkeys.has_factor(conn, user_id)


def factor_policy_required(conn, user_id: str) -> bool:
    from . import second_factor as sf
    from .ha_user_auth import ADMIN_PERMISSIONS

    return sf.effective_policy(conn, _internal(user_id), ADMIN_PERMISSIONS)[0] == "required"


def session_policy(conn, admin: bool) -> tuple[float, float, bool]:
    """(absolute seconds, idle seconds, persistent cookie) for a new session of a user (admin = holds an administrative permission)."""
    from ..db import get_setting

    mode = get_setting(conn, "security.local_session", "rolling_30d") or "rolling_30d"
    absolute, idle, persistent = SESSION_MODES.get(mode, SESSION_MODES["rolling_30d"])
    if admin:
        try:
            days = int(get_setting(conn, "security.local_admin_session_days", "7") or "7")
        except ValueError:
            days = 7
        absolute = min(absolute, max(1, min(days, 7)) * 86400)
        idle = min(idle, ADMIN_IDLE_S)
    return float(absolute), float(idle), persistent


def password_min(conn) -> int:
    from ..db import get_setting

    try:
        return max(10, min(64, int(get_setting(conn, "security.local_password_min", "12") or "12")))
    except ValueError:
        return 12


def link_ttl_s(conn) -> float:
    from ..db import get_setting

    try:
        return max(1, min(168, int(get_setting(conn, "security.local_link_ttl_h", "72") or "72"))) * 3600.0
    except ValueError:
        return 72 * 3600.0


def lock_mode(conn) -> str:
    from ..db import get_setting

    return "lock" if (get_setting(conn, "security.local_lock_mode", "delay") or "delay") == "lock" else "delay"


# ---------------------------------------------------------------- sessions in memory

@dataclass
class LocalSession:
    """Duck-typed like ha_user_auth.RemoteSession where the rest of the product reads one (session_of: the live-stream cap,
    the sessions list's current marker, the second-factor `keep`)."""

    sid_hash: str
    principal: Principal
    user_id: str
    chain_id: str
    kind: str
    expires_at: float
    idle_expires_at: float
    created_at: float
    chain_started_at: float
    last_used_at: float
    persistent: bool
    gate: str = ""  # "" | "enrol" | "change"
    loaded_at: float = 0.0
    via: str = "cookie"
    iss_hash: str = ""

    @property
    def sid(self) -> str:
        return "l:" + self.sid_hash

    def sign_in(self) -> str:
        return "l:" + self.chain_id


class _Cache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by_sid: dict[str, LocalSession] = {}
        self._sockets: dict[str, weakref.WeakSet] = {}
        self._to_close: list[Any] = []

    def get(self, sid_hash: str) -> LocalSession | None:
        now = time.time()
        with self._lock:
            s = self._by_sid.get(sid_hash)
            if s is None:
                return None
            if now - s.loaded_at > CACHE_TTL_S or s.expires_at <= now or s.idle_expires_at <= now:
                self._by_sid.pop(sid_hash, None)
                return None
            return s

    def peek_live(self, sid_hash: str) -> bool:
        s = self.get(sid_hash)
        return s is not None

    def put(self, s: LocalSession) -> None:
        with self._lock:
            if len(self._by_sid) > 5000:
                for k in list(self._by_sid)[:500]:
                    self._by_sid.pop(k, None)
            self._by_sid[s.sid_hash] = s

    def drop(self, sid_hash: str) -> None:
        with self._lock:
            self._by_sid.pop(sid_hash, None)

    def drop_user(self, user_id: str) -> None:
        with self._lock:
            for k in [k for k, v in self._by_sid.items() if v.user_id == user_id]:
                self._by_sid.pop(k, None)

    def drop_chains(self, chains: set[str]) -> None:
        with self._lock:
            for k in [k for k, v in self._by_sid.items() if v.chain_id in chains]:
                self._by_sid.pop(k, None)
            for c in chains:
                socks = self._sockets.pop(c, None)
                if socks:
                    self._to_close.extend(list(socks))

    def attach(self, chain_id: str, websocket: Any) -> None:
        with self._lock:
            self._sockets.setdefault(chain_id, weakref.WeakSet()).add(websocket)

    def take_to_close(self) -> list[Any]:
        with self._lock:
            out, self._to_close = self._to_close, []
        return out

    def clear(self) -> None:
        with self._lock:
            self._by_sid.clear()
            for socks in self._sockets.values():
                self._to_close.extend(list(socks))
            self._sockets.clear()


CACHE = _Cache()


def take_sockets_to_close() -> list[Any]:
    return CACHE.take_to_close()


def close_sockets_from_thread() -> None:
    try:
        from anyio.from_thread import run as run_async

        from .ha_user_auth import _close_sockets

        run_async(_close_sockets)
    except Exception:  # noqa: BLE001 - not in a worker thread: the background pass closes them within seconds
        pass


# ---------------------------------------------------------------- cookies

def cookie_header(name: str, value: str, path: str, *, secure: bool, max_age: int | None) -> str:
    parts = [f"{name}={value}", "HttpOnly"]
    if max_age is not None:
        parts.append(f"Max-Age={max(0, int(max_age))}")
    parts.append(f"Path={path}")
    parts.append("SameSite=strict")
    if secure:
        parts.append("Secure")
    return "; ".join(parts)


def queue_cookie(conn_like: Any, settings: Settings, value: str, s: LocalSession) -> None:
    """A rotated cookie travels with the response of the request that rotated it (remote_channel.send_secured adds the header)."""
    from .ha_user_auth import COOKIE_SECURE, cookie_name

    name = cookie_name(settings, conn_like)
    max_age = int(s.expires_at - time.time()) if s.persistent else None
    header = cookie_header(name, value, settings.remote_path + "/", secure=name == COOKIE_SECURE, max_age=max_age)
    try:
        conn_like.scope.setdefault("state", {})["sw_local_set_cookie"] = header
    except AttributeError:
        pass


# ---------------------------------------------------------------- session store (database)

_SESSION_SQL = """SELECT s.*, u.username AS u_username, u.display_name AS u_display, u.active AS u_active, u.deleted_at AS u_deleted,
                         u.source AS u_source FROM auth_local_sessions s JOIN users u ON u.id = s.user_id WHERE s.sid_hash = ?"""


def _principal_of_row(row, factor_ok: bool) -> Principal:
    return Principal(user_id=row["user_id"], username=row["u_username"] or "", display_name=row["u_display"] or row["u_username"] or "",
                     source="local", via="cookie", factor_ok=factor_ok)


def _gate_for(conn, user_id: str, must_change: bool) -> str:
    if must_change:
        return "change"
    if not has_factor(conn, user_id) and factor_policy_required(conn, user_id):
        return "enrol"
    return ""


def _session_from_row(conn, row) -> LocalSession:
    cred = conn.execute("SELECT must_change FROM auth_local_credentials WHERE user_id = ?", (row["user_id"],)).fetchone()
    persistent = epoch(row["expires_at"]) - epoch(row["chain_started_at"]) > 13 * 3600  # browser_session (12 h) has no Max-Age
    return LocalSession(sid_hash=row["sid_hash"], principal=_principal_of_row(row, bool(row["factor_at"])), user_id=row["user_id"],
                        chain_id=row["chain_id"], kind=row["kind"], expires_at=epoch(row["expires_at"]), idle_expires_at=epoch(row["idle_expires_at"]),
                        created_at=epoch(row["created_at"]), chain_started_at=epoch(row["chain_started_at"]), last_used_at=epoch(row["last_used_at"]),
                        persistent=persistent, gate=_gate_for(conn, row["user_id"], bool(cred and cred["must_change"])), loaded_at=time.time())


def _new_cookie() -> str:
    return COOKIE_PREFIX + secrets.token_urlsafe(32)


def _kind_of(user_agent: str) -> str:
    """`app` for the phone app's WebView (the same user-agent mark CR-027's presence policy reads), else `browser`."""
    from . import presence

    return "app" if presence.is_app_user_agent(user_agent) else "browser"


def create_session(conn, settings: Settings, conn_like: Any, user_id: str, *, factor: bool, meta: dict[str, str]) -> tuple[str, LocalSession]:
    """A new chain for `user_id` on the caller's write connection. Returns (cookie value, session)."""
    from ..rbac import permissions_fingerprint
    from .ha_user_auth import mask_address

    now = time.time()
    admin = holds_admin(conn, user_id)
    absolute, idle, persistent = session_policy(conn, admin)
    value = _new_cookie()
    sh = sid_hash_of(value)
    chain = secrets.token_hex(16)
    user = conn.execute("SELECT username, display_name FROM users WHERE id = ?", (user_id,)).fetchone()
    fp = permissions_fingerprint(conn, _internal(user_id))
    ua = (meta.get("user_agent") or "")[:200]
    conn.execute(
        """INSERT INTO auth_local_sessions(sid_hash, user_id, kind, created_at, chain_started_at, last_used_at, expires_at, idle_expires_at,
                                           chain_id, factor_at, perm_fingerprint, ip_masked, country, user_agent)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (sh, user_id, _kind_of(ua), iso(now), iso(now), iso(now), iso(now + absolute), iso(min(now + idle, now + absolute)), chain,
         iso(now) if factor else None, fp, mask_address(meta.get("client_ip", "")), (meta.get("country") or "")[:8], ua))
    row = conn.execute(_SESSION_SQL, (sh,)).fetchone()
    s = _session_from_row(conn, row)
    s.persistent = persistent
    CACHE.put(s)
    _ = user
    return value, s


def _rotate(conn, row, meta: dict[str, str]) -> tuple[str, str]:
    """A new cookie value for the same chain; the old row ends `rotated` (still resolving to the new one for ROTATE_GRACE_S)."""
    from ..rbac import permissions_fingerprint
    from .ha_user_auth import mask_address

    now = time.time()
    value = _new_cookie()
    sh = sid_hash_of(value)
    fp = permissions_fingerprint(conn, _internal(row["user_id"]))
    conn.execute(
        """INSERT INTO auth_local_sessions(sid_hash, user_id, kind, created_at, chain_started_at, last_used_at, expires_at, idle_expires_at,
                                           rotated_from, chain_id, factor_at, perm_fingerprint, ip_masked, country, user_agent, label)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (sh, row["user_id"], row["kind"], iso(now), row["chain_started_at"], iso(now), row["expires_at"], row["idle_expires_at"], row["sid_hash"],
         row["chain_id"], row["factor_at"], fp, mask_address(meta.get("client_ip", "")) or row["ip_masked"], (meta.get("country") or row["country"] or "")[:8],
         (meta.get("user_agent") or row["user_agent"] or "")[:200], row["label"]))
    conn.execute("UPDATE auth_local_sessions SET revoked_at = ?, revoked_reason = 'rotated' WHERE sid_hash = ? AND revoked_at IS NULL", (iso(now), row["sid_hash"]))
    CACHE.drop(row["sid_hash"])
    return value, sh


def rotate_current(conn, settings: Settings, conn_like: Any, s: LocalSession, *, factor: bool = False) -> LocalSession | None:
    """Rotate the caller's own session now (password change, factor enrolment); the new cookie goes out with this response."""
    from .ha_user_auth import request_meta

    row = conn.execute(_SESSION_SQL, (s.sid_hash,)).fetchone()
    if row is None or row["revoked_at"]:
        return None
    if factor:
        conn.execute("UPDATE auth_local_sessions SET factor_at = ? WHERE sid_hash = ?", (iso(time.time()), s.sid_hash))
        row = conn.execute(_SESSION_SQL, (s.sid_hash,)).fetchone()
    value, sh = _rotate(conn, row, request_meta(conn_like))
    new = _session_from_row(conn, conn.execute(_SESSION_SQL, (sh,)).fetchone())
    new.persistent = s.persistent
    CACHE.put(new)
    queue_cookie(conn_like, settings, value, new)
    try:
        conn_like.scope.setdefault("state", {})["sw_remote_session"] = new
    except AttributeError:
        pass
    return new


def _audit(db_or_conn: Any, *, actor: Principal | None, action: str, decision: str, reason: str | None = None, resource_id: str | None = None,
           details: dict[str, Any] | None = None, request_id: str | None = None) -> None:
    from ..audit import audit

    det = {**(details or {}), "channel": "remote"}
    try:
        if hasattr(db_or_conn, "connection"):
            with db_or_conn.connection(label=action) as conn:
                audit(conn, actor=actor, action=action, decision=decision, resource_type="user", resource_id=resource_id or (actor.user_id if actor else None),
                      reason=reason, details=det, request_id=request_id)
        else:
            audit(db_or_conn, actor=actor, action=action, decision=decision, resource_type="user", resource_id=resource_id or (actor.user_id if actor else None),
                  reason=reason, details=det, request_id=request_id)
    except Exception:  # noqa: BLE001 - an audit failure never breaks a sign-in
        log.exception("could not write the %s audit row", action)


def _notify(db: Any, source: str, subject_id: str, *, reason: str | None = None) -> None:
    """USR2 phase 2 (security review F7, CR §3): the security events also reach the managers through the notification centre - never
    a username, an address or a person in the text (services/local_reset.notify_managers). Never raises."""
    try:
        from . import local_reset

        local_reset.notify_managers(db, source, subject_id, params={"reason": reason} if reason else None)
    except Exception:  # noqa: BLE001
        log.warning("could not emit %s", source)


def _lookup(db: Any, sid_hash: str) -> tuple[Any, Any] | None:
    """(row, successor row or None) of a cookie through a short read."""
    with db.connection(mode="read", label="local session") as conn:
        row = conn.execute(_SESSION_SQL, (sid_hash,)).fetchone()
        if row is None:
            return None
        succ = None
        if row["revoked_at"] and row["revoked_reason"] == "rotated" and time.time() - epoch(row["revoked_at"]) <= ROTATE_GRACE_S:
            nxt = conn.execute("SELECT sid_hash FROM auth_local_sessions WHERE rotated_from = ? AND revoked_at IS NULL", (sid_hash,)).fetchone()
            if nxt is not None:
                succ = conn.execute(_SESSION_SQL, (nxt["sid_hash"],)).fetchone()
        return row, succ


def _usable(row, now: float) -> bool:
    return (not row["revoked_at"] and epoch(row["expires_at"]) > now and epoch(row["idle_expires_at"]) > now and bool(row["u_active"])
            and not row["u_deleted"] and row["u_source"] == "local")


def resolve(db: Any, settings: Settings, conn_like: Any, cookie_value: str, *, offline: bool = False, rotate: bool = True) -> LocalSession | None:
    """The live local session a cookie names, or None. `offline=True` (the caller may hold the request's write lock): answered from
    the cache or a read, and ha_user_auth.NeedsUnlock when a write is due (the once-a-minute touch, the expiry bookkeeping, a
    rotation, the administrative cap) - the caller retries without its lock, exactly as for an HA session that HA must re-check.
    `rotate=False` (a WebSocket handshake, which has no response to carry a new cookie): never rotates."""
    from .ha_user_auth import NeedsUnlock

    if not cookie_value.startswith(COOKIE_PREFIX) or len(cookie_value) > 100 or not enabled_db(db):
        return None
    sh = sid_hash_of(cookie_value)
    cached = CACHE.get(sh)
    if cached is not None:
        return cached
    found = _lookup(db, sh)
    if found is None:
        return None
    row, succ = found
    now = time.time()
    grace = False
    if row["revoked_at"]:
        if succ is None or not _usable(succ, now):
            if succ is not None:
                lease_hook("session_ended", user_ids=[succ["user_id"]])  # T4: the chain's live row ran out / its user was disabled
            return None
        row, grace = succ, True  # the 60-second grace of a rotation (two tabs racing): the old value resolves to the new row, no new cookie
    if not _usable(row, now):
        # T4: an expired / idle session, or one whose user was disabled / deleted, ends the actor's capture lease (before the
        # offline retry below: the hook never touches the database)
        lease_hook("session_ended", user_ids=[row["user_id"]])
        if not row["revoked_at"] and not grace:
            if offline:
                raise NeedsUnlock
            reason = "idle" if epoch(row["idle_expires_at"]) <= now else "expired"
            try:
                with db.connection(label="local session expiry") as conn:
                    if conn.execute("UPDATE auth_local_sessions SET revoked_at = ?, revoked_reason = ? WHERE sid_hash = ? AND revoked_at IS NULL",
                                    (iso(now), reason, row["sid_hash"])).rowcount:
                        _audit(conn, actor=_principal_of_row(row, False), action="auth.local.session.expired", decision="allowed", reason=reason,
                               details={"id": public_id(row["chain_id"])})
            except Exception:  # noqa: BLE001 - the refusal stands
                pass
        return None
    from ..rbac import permissions_fingerprint
    from .ha_user_auth import mask_address, request_meta

    with db.connection(mode="read", label="local session view") as conn:
        s = _session_from_row(conn, row)
        uid = row["user_id"]
        admin = holds_admin(conn, uid)
        due_cap = admin and (epoch(row["expires_at"]) > epoch(row["chain_started_at"]) + session_policy(conn, True)[0]
                             or epoch(row["idle_expires_at"]) > now + ADMIN_IDLE_S)
        due_rotate = rotate and (permissions_fingerprint(conn, _internal(uid)) != (row["perm_fingerprint"] or "") or now - epoch(row["created_at"]) >= ROTATE_EVERY_S)
        due_touch = now - epoch(row["last_used_at"]) >= TOUCH_EVERY_S
    if grace or not (due_cap or due_rotate or due_touch):
        CACHE.put(s)
        return s
    if offline:
        raise NeedsUnlock
    meta = request_meta(conn_like)
    with db.connection(label="local session use") as conn:
        uid = row["user_id"]
        row = conn.execute(_SESSION_SQL, (row["sid_hash"],)).fetchone()
        if row is None or not _usable(row, now):
            lease_hook("session_ended", user_ids=[uid])  # T4: ended between the read and this write
            return None
        admin = holds_admin(conn, uid)
        if admin:  # Q3: an administrative permission caps the session (also one gained after the sign-in)
            cap = epoch(row["chain_started_at"]) + session_policy(conn, True)[0]
            idle_cap = now + ADMIN_IDLE_S
            if epoch(row["expires_at"]) > cap or epoch(row["idle_expires_at"]) > idle_cap:
                conn.execute("UPDATE auth_local_sessions SET expires_at = MIN(expires_at, ?), idle_expires_at = MIN(idle_expires_at, ?) WHERE sid_hash = ?",
                             (iso(cap), iso(idle_cap), row["sid_hash"]))
                row = conn.execute(_SESSION_SQL, (row["sid_hash"],)).fetchone()
                if not _usable(row, now):
                    lease_hook("session_ended", user_ids=[uid])  # T4: the administrative cap ended it
                    return None
        fp = permissions_fingerprint(conn, _internal(uid))
        rotate_reason = None
        if rotate:
            rotate_reason = "permissions" if fp != (row["perm_fingerprint"] or "") else "age" if now - epoch(row["created_at"]) >= ROTATE_EVERY_S else None
        if rotate_reason == "permissions":
            lease_hook("session_ended", user_ids=[uid])  # T4: the chain rotated for a privilege change (an age rotation is not an end)
        if rotate_reason:
            value, sh2 = _rotate(conn, row, meta)
            row = conn.execute(_SESSION_SQL, (sh2,)).fetchone()
            s = _session_from_row(conn, row)
            queue_cookie(conn_like, settings, value, s)
            _audit(conn, actor=s.principal, action="auth.local.session.rotated", decision="allowed", details={"reason": rotate_reason, "id": public_id(s.chain_id)})
        elif now - epoch(row["last_used_at"]) >= TOUCH_EVERY_S:
            idle = session_policy(conn, admin)[1]
            conn.execute("UPDATE auth_local_sessions SET last_used_at = ?, idle_expires_at = MIN(expires_at, ?), ip_masked = ?, country = ?, user_agent = ? WHERE sid_hash = ?",
                         (iso(now), iso(now + idle), mask_address(meta.get("client_ip", "")) or row["ip_masked"], (meta.get("country") or row["country"] or "")[:8],
                          (meta.get("user_agent") or row["user_agent"] or "")[:200], row["sid_hash"]))
            row = conn.execute(_SESSION_SQL, (row["sid_hash"],)).fetchone()
            s = _session_from_row(conn, row)
        else:
            s = _session_from_row(conn, row)
    CACHE.put(s)
    return s


def _gate_refusal(settings: Settings, conn_like: Any, s: LocalSession) -> ApiError | None:
    if not s.gate:
        return None
    path = (getattr(conn_like, "scope", None) or {}).get("path") or ""
    prefix = settings.remote_path
    rest = path[len(prefix):] if path.startswith(prefix + "/") else path
    allowed = ENROL_PATHS if s.gate == "enrol" else CHANGE_PATHS
    if any(rest == p or rest.startswith(p + "/") for p in allowed):
        return None
    if s.gate == "enrol":
        return ApiError(403, "second_factor_enrollment_required", ENROL_REQUIRED_HE)
    return ApiError(403, "password_change_required", CHANGE_REQUIRED_HE)


def remote_principal(request: Any, settings: Settings, cookie_value: str, offline: bool = False) -> Principal | None:
    """ha_user_auth.remote_principal's local branch. None = not a live local session (the caller then answers exactly as for any
    unknown cookie); an ApiError for a gated session outside its allowed routes."""
    db = request.app.state.db
    s = resolve(db, settings, request, cookie_value, offline=offline)
    if s is None:
        return None
    refusal = _gate_refusal(settings, request, s)
    if refusal is not None:
        raise refusal
    try:
        request.state.sw_remote_session = s
    except AttributeError:
        pass
    return s.principal


async def remote_principal_ws(websocket: Any, settings: Settings, cookie_value: str) -> Principal | None:
    from starlette.concurrency import run_in_threadpool

    from .ha_user_auth import origin_ok

    if not origin_ok(websocket):
        return None
    s = await run_in_threadpool(lambda: resolve(websocket.app.state.db, settings, websocket, cookie_value, rotate=False))
    if s is None or s.gate:
        return None
    CACHE.attach(s.chain_id, websocket)
    try:
        websocket.state.sw_remote_session = s
    except AttributeError:
        pass
    return s.principal


def still_live(principal: Principal, conn_like: Any) -> bool:
    """auth._pre_resolved for a local principal: its session is still in the cache (a revoke empties it)."""
    s = (getattr(conn_like, "scope", None) or {}).get("state", {}).get("sw_remote_session")
    return isinstance(s, LocalSession) and s.user_id == principal.user_id and CACHE.peek_live(s.sid_hash)


def holds_live_cookie(cookie_value: str | None) -> bool:
    """body_limit's credential tier: memory only, never an authentication."""
    return bool(cookie_value and cookie_value.startswith(COOKIE_PREFIX) and CACHE.peek_live(sid_hash_of(cookie_value)))


# ---------------------------------------------------------------- revocation

def lease_hook(reason: str, *, user_ids: list[str] | None = None, all: bool = False) -> None:
    """CR-WISKEY-LEASE-REVOCATION-EVENT T4 / T6 / T2 for Arx-only (local) actors (integ/264 risk 8; the extension point named in
    ha_user_auth._drop_locked). Every USR2 path that ends or narrows a local actor's authority - a session revoked (logout, sign out
    everywhere, an administrator's revoke, expiry, a password change / reset, the switch off), a factor added / removed / reset, the
    passkey-first mode changed, the user disabled / deleted - calls this. Strict (owner decision 2026-10-16): the actor's live
    capture leases are revoked at once, no re-check. Called BEFORE the database write it accompanies: a write that then rolls back
    has only over-revoked (the safe side). Never raises, never touches the database, never blocks."""
    try:
        from . import capture_lease

        capture_lease.on_authority_change(reason, user_ids=[u for u in (user_ids or []) if u], all=all)
    except Exception:  # noqa: BLE001 - never breaks a revocation; on_authority_change itself degrades the route on an internal error
        log.warning("capture lease hook %s could not run", reason)


def revoke_user_sessions(conn, user_id: str, reason: str, *, keep_chain: str | None = None) -> int:
    # T4: every caller is an authority change of the user (disable, delete, administrator revoke, sign out everywhere, password
    # change / reset, factor enrolled / reset, passkey removed) - so the lease goes even when no other chain is left to end
    # (a password change from the user's only session keeps that chain).
    lease_hook("session_ended", user_ids=[user_id])
    # APPREFRESH-295: every caller is an authority change - the phone app's persistent sign-ins end too (also the kept chain's: a
    # password change or reset re-signs the phone in)
    from . import app_refresh

    app_refresh.hook("revoke_user", conn, user_id, reason)
    rows = conn.execute("SELECT DISTINCT chain_id FROM auth_local_sessions WHERE user_id = ? AND revoked_at IS NULL", (user_id,)).fetchall()
    chains = {r["chain_id"] for r in rows if r["chain_id"] != keep_chain}
    if not chains:
        return 0
    now = iso(time.time())
    for c in chains:
        conn.execute("UPDATE auth_local_sessions SET revoked_at = ?, revoked_reason = ? WHERE chain_id = ? AND revoked_at IS NULL", (now, reason, c))
    CACHE.drop_chains(chains)
    return len(chains)


def revoke_chain(conn, chain_id: str, reason: str) -> int:
    owner = conn.execute("SELECT user_id FROM auth_local_sessions WHERE chain_id = ? LIMIT 1", (chain_id,)).fetchone()
    if owner is not None:
        lease_hook("session_ended", user_ids=[owner["user_id"]])  # T4: logout / one sign-in revoked by its owner or an administrator
    from . import app_refresh

    app_refresh.hook("revoke_anchor", conn, app_refresh.local_anchor(chain_id), reason)  # APPREFRESH-295: the families minted from this sign-in
    n = conn.execute("UPDATE auth_local_sessions SET revoked_at = ?, revoked_reason = ? WHERE chain_id = ? AND revoked_at IS NULL",
                     (iso(time.time()), reason, chain_id)).rowcount
    CACHE.drop_chains({chain_id})
    return 1 if n else 0


def revoke_all(conn, reason: str) -> int:
    # T4 for every local actor at once (the switch turned off): installation scope - over-revoking an HA actor's lease is the safe side
    lease_hook("session_ended", all=True)
    from . import app_refresh

    app_refresh.hook("revoke_kind", conn, "local", reason)  # APPREFRESH-295: every family minted from an Arx-only sign-in
    rows = conn.execute("SELECT DISTINCT chain_id FROM auth_local_sessions WHERE revoked_at IS NULL").fetchall()
    chains = {r["chain_id"] for r in rows}
    if chains:
        conn.execute("UPDATE auth_local_sessions SET revoked_at = ?, revoked_reason = ? WHERE revoked_at IS NULL", (iso(time.time()), reason))
    CACHE.clear()
    return len(chains)


def chain_owner(conn, pid: str) -> tuple[str, str] | None:
    """(chain_id, user_id) of a live chain by its public id, or None."""
    for r in conn.execute("SELECT DISTINCT chain_id, user_id FROM auth_local_sessions WHERE revoked_at IS NULL").fetchall():
        if public_id(r["chain_id"]) == pid:
            return r["chain_id"], r["user_id"]
    return None


def chains(conn, user_id: str | None = None) -> list[dict[str, Any]]:
    """The sessions list's local rows (one per live chain, freshest row), newest use first. No cookie, no full address."""
    from .ha_user_auth import agent_family

    now = iso(time.time())
    sql = """SELECT s.*, u.username AS u_username, u.display_name AS u_display FROM auth_local_sessions s JOIN users u ON u.id = s.user_id
             WHERE s.revoked_at IS NULL AND s.expires_at > ? AND s.idle_expires_at > ?"""
    args: list[Any] = [now, now]
    if user_id is not None:
        sql += " AND s.user_id = ?"
        args.append(user_id)
    out: dict[str, Any] = {}
    for r in conn.execute(sql + " ORDER BY s.last_used_at DESC", args).fetchall():
        if r["chain_id"] in out:
            continue
        out[r["chain_id"]] = {
            "id": public_id(r["chain_id"]), "user_id": r["user_id"], "username": r["u_username"], "display_name": r["u_display"],
            "created_at": r["chain_started_at"], "last_seen_at": r["last_used_at"], "address": r["ip_masked"], "country": r["country"] or None,
            "agent": agent_family(r["user_agent"]), "channel": "cookie", "kind": "local", "device": r["kind"], "label": r["label"],
            "_chain": "l:" + r["chain_id"],
        }
    return list(out.values())


# ---------------------------------------------------------------- brute force (memory tiers, written behind)

class _Tiers:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._ip: dict[str, dict[int, list[float]]] = {}  # key -> {window: [start, count]}
        self._global: collections.deque[tuple[float, str]] = collections.deque(maxlen=20000)  # (time, network key) - F7: networks counted
        # USR2-FIX F2: (uname hash, network key) -> (failures, last failure, delay until), for known AND unknown names alike
        self._acct: dict[tuple[str, str], tuple[int, float, float]] = {}
        # the ceiling twin of auth_local_credentials for names that do not exist: uname hash -> (window index, failures, locked until)
        self._unknown: dict[str, tuple[int, int, float]] = {}
        self._dirty = False
        self._storm_notified = 0.0

    @staticmethod
    def ip_key(ip: str) -> str:
        from .ha_user_auth import limit_ip

        return hashlib.sha256(limit_ip(ip).encode("utf-8", "replace")).hexdigest()[:32]

    def hit_ip(self, ip: str) -> float:
        """Count one attempt of the address; 0 = allowed, else the seconds until the fullest window frees up."""
        now = time.time()
        key = self.ip_key(ip)
        with self._lock:
            wins = self._ip.setdefault(key, {})
            wait = 0.0
            for window, cap in IP_WINDOWS:
                w = wins.get(window)
                if w is None or now - w[0] >= window:
                    w = wins[window] = [now, 0]
                if w[1] >= cap:
                    wait = max(wait, w[0] + window - now)
            if wait:
                return wait
            for window, _cap in IP_WINDOWS:
                wins[window][1] += 1
            self._dirty = True
            if len(self._ip) > 20000:
                for k in [k for k, v in self._ip.items() if all(now - w[0] >= win for win, w in v.items())][:5000]:
                    self._ip.pop(k, None)
            return 0.0

    def fail_global(self, ip: str = "") -> None:
        net = self.ip_key(ip) if ip else ""
        with self._lock:
            self._global.append((time.time(), net))
            self._dirty = True

    def global_count(self) -> int:
        cutoff = time.time() - GLOBAL_WINDOW_S
        with self._lock:
            while self._global and self._global[0][0] < cutoff:
                self._global.popleft()
            return len(self._global)

    def global_networks(self) -> int:
        """Distinct source networks among the failures of the window (security review F7)."""
        cutoff = time.time() - GLOBAL_WINDOW_S
        with self._lock:
            return len({n for t, n in self._global if t >= cutoff})

    def storm(self) -> bool:
        """USR2 phase 2 (security review F7): the storm needs GLOBAL_STORM_AT failures from at least GLOBAL_STORM_NETWORKS distinct
        networks - two addresses at the per-address allowance no longer switch on the refusal of every dormant account."""
        return self.global_count() >= GLOBAL_STORM_AT and self.global_networks() >= GLOBAL_STORM_NETWORKS

    def storm_should_notify(self) -> bool:
        now = time.time()
        with self._lock:
            if now - self._storm_notified >= 3600:
                self._storm_notified = now
                return True
            return False

    def _acct_key(self, uname: str, ip: str) -> tuple[str, str]:
        return (_uname_hash(uname), self.ip_key(ip))

    def acct_delay(self, uname: str, ip: str) -> float:
        """Seconds left of the per-account delay of this name FROM THIS NETWORK (IPv4 address / IPv6 /64); 0 = none."""
        key = self._acct_key(uname, ip)
        with self._lock:
            _n, _last, until = self._acct.get(key, (0, 0.0, 0.0))
        return max(0.0, until - time.time())

    def acct_fail(self, uname: str, ip: str) -> int:
        """Count one failure of this name from this network; returns the failures counted in the current window."""
        now = time.time()
        key = self._acct_key(uname, ip)
        with self._lock:
            n, last, _until = self._acct.get(key, (0, 0.0, 0.0))
            n = 1 if now - last > ACCOUNT_WINDOW_S else n + 1
            self._acct[key] = (n, now, now + account_delay(n) if n >= ACCOUNT_FREE_FAILURES else 0.0)
            if len(self._acct) > 20000:
                for k in [k for k, v in self._acct.items() if now - v[1] > ACCOUNT_WINDOW_S][:5000]:
                    self._acct.pop(k, None)
        return n

    def acct_clear(self, uname: str, ip: str) -> None:
        with self._lock:
            self._acct.pop(self._acct_key(uname, ip), None)

    def acct_clear_name(self, uname: str) -> int:
        """An administrator's unlock: every network's delay of this name ends (the ceiling row is cleared by the route)."""
        h = _uname_hash(uname)
        with self._lock:
            keys = [k for k in self._acct if k[0] == h]
            for k in keys:
                self._acct.pop(k, None)
            self._unknown.pop(h, None)
        return len(keys)

    def unknown_lock(self, uname: str) -> float:
        """The ceiling lock of a name that does not exist (the memory twin of auth_local_credentials.delay_until)."""
        with self._lock:
            _w, _n, until = self._unknown.get(_uname_hash(uname), (0, 0, 0.0))
        return max(0.0, until - time.time())

    def unknown_ceiling_fail(self, uname: str) -> None:
        now = time.time()
        key = _uname_hash(uname)
        window = int(now // ACCOUNT_CEILING_WINDOW_S)
        with self._lock:
            w, n, until = self._unknown.get(key, (window, 0, 0.0))
            n = n + 1 if w == window else 1
            if n >= ACCOUNT_CEILING:
                until = now + ACCOUNT_LOCK_S
            self._unknown[key] = (window, n, until)
            if len(self._unknown) > 10000:
                for k in [k for k, v in self._unknown.items() if v[0] != window and v[2] < now][:2000]:
                    self._unknown.pop(k, None)

    def flush(self, conn) -> int:
        with self._lock:
            if not self._dirty:
                return 0
            self._dirty = False
            ips = {k: {w: list(v) for w, v in wins.items()} for k, wins in self._ip.items()}
            glob = [t for t, _n in self._global]
        now = time.time()
        n = 0
        try:
            conn.execute("DELETE FROM auth_local_failures")
            for key, wins in list(ips.items())[:5000]:
                for window, (start, count) in wins.items():
                    if now - start < window and count:
                        conn.execute("INSERT INTO auth_local_failures(key, window_start, count, blocked_until, updated_at) VALUES (?,?,?,?,?)",
                                     (f"ip:{key}:{window}", start, count, None, now))
                        n += 1
            recent = [t for t in glob if now - t < GLOBAL_WINDOW_S]
            if recent:
                conn.execute("INSERT INTO auth_local_failures(key, window_start, count, blocked_until, updated_at) VALUES ('global', ?, ?, NULL, ?)",
                             (min(recent), len(recent), now))
                n += 1
        except Exception:  # noqa: BLE001 - an older schema or a busy database: memory only meanwhile
            with self._lock:
                self._dirty = True
            return 0
        return n

    def restore(self, conn) -> int:
        now = time.time()
        try:
            rows = conn.execute("SELECT key, window_start, count FROM auth_local_failures").fetchall()
        except Exception:  # noqa: BLE001
            return 0
        n = 0
        with self._lock:
            for r in rows:
                key = r["key"]
                if key == "global":
                    start, count = float(r["window_start"]), int(r["count"])
                    if now - start < GLOBAL_WINDOW_S:
                        self._global.extend([(start, "restored")] * min(count, 20000))  # one pseudo-network: a storm needs fresh evidence
                        n += 1
                    continue
                parts = key.split(":")
                if len(parts) != 3 or parts[0] != "ip":
                    continue
                window = int(parts[2]) if parts[2].isdigit() else 0
                if window and now - float(r["window_start"]) < window:
                    self._ip.setdefault(parts[1], {})[window] = [float(r["window_start"]), int(r["count"])]
                    n += 1
        return n

    def clear(self) -> None:
        with self._lock:
            self._ip.clear()
            self._global.clear()
            self._acct.clear()
            self._unknown.clear()
            self._dirty = False
            self._storm_notified = 0.0


TIERS = _Tiers()


def account_delay(failures: int) -> float:
    """The per-account delay after `failures` counted failures in the window: none below 5, then 30 s doubling, capped at 15 min."""
    if failures < ACCOUNT_FREE_FAILURES:
        return 0.0
    return float(min(ACCOUNT_DELAY_CAP_S, ACCOUNT_DELAY_FIRST_S * (2 ** (failures - ACCOUNT_FREE_FAILURES))))


# ---------------------------------------------------------------- pending second-factor records (memory)

@dataclass
class Pending:
    user_id: str
    ip: str
    created: float
    attempts: int = 0
    meta: dict[str, str] = field(default_factory=dict)


_pending: dict[str, Pending] = {}
_pending_lock = threading.Lock()


def new_pending(user_id: str, meta: dict[str, str]) -> str:
    pid = secrets.token_urlsafe(32)
    now = time.time()
    with _pending_lock:
        for k in [k for k, v in _pending.items() if now - v.created > PENDING_TTL_S]:
            _pending.pop(k, None)
        if len(_pending) > 2000:
            for k in list(_pending)[:200]:
                _pending.pop(k, None)
        for k in [k for k, v in _pending.items() if v.user_id == user_id]:
            _pending.pop(k, None)  # one open second step per user
        _pending[pid] = Pending(user_id=user_id, ip=meta.get("client_ip", ""), created=now, meta=dict(meta))
    return pid


def peek_pending(pid: str | None) -> Pending | None:
    """The live pending record without spending an attempt (the passkey options of the second step)."""
    if not pid:
        return None
    with _pending_lock:
        p = _pending.get(pid)
        if p is None or time.time() - p.created > PENDING_TTL_S or p.attempts >= PENDING_MAX_ATTEMPTS:
            return None
        return p


def take_pending(pid: str | None) -> Pending | None:
    if not pid:
        return None
    with _pending_lock:
        p = _pending.get(pid)
        if p is None:
            return None
        if time.time() - p.created > PENDING_TTL_S or p.attempts >= PENDING_MAX_ATTEMPTS:
            _pending.pop(pid, None)
            return None
        p.attempts += 1
        return p


def drop_pending(pid: str | None) -> None:
    if pid:
        with _pending_lock:
            _pending.pop(pid, None)


def drop_pending_of(user_id: str) -> None:
    with _pending_lock:
        for k in [k for k, v in _pending.items() if v.user_id == user_id]:
            _pending.pop(k, None)


# ---------------------------------------------------------------- the sign-in decision (blocking part; the route sleeps afterwards)

@dataclass
class SignInResult:
    status: str  # "session" | "pending" | "failed" | "rate_limited"
    sleep_s: float = 0.0
    retry_after: int = 0
    cookie: str | None = None
    session: LocalSession | None = None
    pending_id: str | None = None
    second_factor: str = "none"  # none | required | enroll_required
    must_change: bool = False
    user: dict[str, str] | None = None
    methods: tuple[str, ...] = ()  # USR2 phase 4: the second-factor methods of a pending step ("totp", "passkey")


def _context_words(conn, user_row) -> list[str]:
    words = [user_row["username"] or ""] + re.split(r"[\s._-]+", user_row["display_name"] or "")
    try:
        words += [r["name"] for r in conn.execute("SELECT name FROM sites WHERE deleted_at IS NULL").fetchall()]
    except Exception:  # noqa: BLE001
        pass
    return [w for w in words if w]


def sign_in(db: Any, settings: Settings, conn_like: Any, username: str, password: str, request_id: str | None) -> SignInResult:
    """Every tier, then the password, in the order that keeps every refusal alike from outside. Blocking (database, hashing)."""
    from . import local_passwords as lp
    from . import second_factor as sf
    from .ha_user_auth import REFUSAL_AUDITS, _record_sign_in, mask_address, request_meta

    meta = request_meta(conn_like)
    ip = meta.get("client_ip", "")
    masked = mask_address(ip)
    lp.ensure_dummy()
    wait = TIERS.hit_ip(ip)
    if wait:
        write, suppressed = REFUSAL_AUDITS.admit(f"local_rate_limited|{ip}")
        if write:
            _audit(db, actor=None, action="auth.local.sign_in.rate_limited", decision="denied", reason="rate_limited_ip", resource_id="unknown",
                   details={"ip": masked, **({"suppressed_since_last": suppressed} if suppressed else {})}, request_id=request_id)
        return SignInResult(status="rate_limited", retry_after=max(1, int(wait) + 1))
    storm = TIERS.storm()
    if storm and TIERS.storm_should_notify():
        _audit(db, actor=None, action="auth.local.storm", decision="denied", reason="global_tier", resource_id="installation",
               details={"failures_10min": TIERS.global_count(), "networks": TIERS.global_networks()}, request_id=request_id)
        _notify(db, "security.local_storm", "installation", reason="global_tier")
    base_sleep = GLOBAL_WAIT_S if storm else 0.0
    uname = username_key(username)
    now = time.time()
    with db.connection(mode="read", label="local sign-in lookup") as conn:
        user = conn.execute("""SELECT u.id, u.username, u.display_name, u.active, u.deleted_at, c.password_hash, c.params_version, c.failed_count,
                                      c.last_failed_at, c.delay_until, c.must_change, c.last_sign_in_at
                               FROM users u JOIN auth_local_credentials c ON c.user_id = u.id
                               WHERE u.source = 'local' AND lower(u.username) = ? AND u.deleted_at IS NULL""", (uname,)).fetchone() if uname else None
        mode = lock_mode(conn)
        ctx = _context_words(conn, user) if user is not None else []
        from . import local_passkeys as _lpk

        passkey_only = user is not None and _lpk.only_effective(conn, user["id"])  # usr2-passkeys-only-mode: the password is refused for this user
    pw_ok_len = isinstance(password, str) and len(lp.normalize(password).encode("utf-8")) <= lp.MAX_BYTES

    def fail(tier: str, *, user_id: str | None, sleep_s: float = 0.0, count: bool = True) -> SignInResult:
        if count:
            TIERS.fail_global(ip)
        details = {"tier": tier, "ip": masked}
        if user_id is None:
            write, suppressed = REFUSAL_AUDITS.admit(f"local_sign_in_failed|{ip}")
            if not write:
                return SignInResult(status="failed", sleep_s=base_sleep + sleep_s)
            if suppressed:
                details["suppressed_since_last"] = suppressed
        _audit(db, actor=None, action="auth.local.sign_in.failed", decision="denied", reason=tier, resource_id=user_id or "unknown", details=details,
               request_id=request_id)
        return SignInResult(status="failed", sleep_s=base_sleep + sleep_s)

    # USR2-FIX F2: the per-account delay is keyed by (name, source network) - the same for a known and an unknown name - so a
    # guesser's failures elsewhere never delay the person's correct password from their own network
    net_delay = TIERS.acct_delay(uname, ip) if uname else 0.0
    if user is None:
        lp.verify_dummy(password if pw_ok_len else "")
        if net_delay:
            return fail("account_delay", user_id=None, sleep_s=min(net_delay, DELAY_SLEEP_CAP_S), count=False)
        lock = TIERS.unknown_lock(uname) if uname else 0.0
        if lock:
            return fail("account_locked", user_id=None, sleep_s=min(lock, DELAY_SLEEP_CAP_S), count=False)
        if uname:
            TIERS.acct_fail(uname, ip)
            TIERS.unknown_ceiling_fail(uname)
        return fail("password", user_id=None)
    uid = user["id"]
    usable = bool(user["active"]) and not user["deleted_at"] and bool(user["password_hash"])
    if net_delay:
        lp.verify_dummy(password if pw_ok_len else "")
        write, suppressed = REFUSAL_AUDITS.admit(f"local_delayed|{uid}")
        if write:  # at most one row per account a minute (the folded attempts are counted on the next one)
            _audit(db, actor=None, action="auth.local.sign_in.delayed", decision="denied", reason="account_delay" if mode == "delay" else "account_locked",
                   resource_id=uid, details={"ip": masked, "tier": "network", "seconds_left": int(net_delay),
                                             **({"suppressed_since_last": suppressed} if suppressed else {})},
                   request_id=request_id)
        return SignInResult(status="failed", sleep_s=base_sleep + min(net_delay, DELAY_SLEEP_CAP_S))
    lock_left = max(0.0, float(user["delay_until"] or 0.0) - now)  # the ceiling lock (all networks together)
    if lock_left:
        lp.verify_dummy(password if pw_ok_len else "")
        write, suppressed = REFUSAL_AUDITS.admit(f"local_locked|{uid}")
        if write:
            _audit(db, actor=None, action="auth.local.sign_in.delayed", decision="denied", reason="account_ceiling",
                   resource_id=uid, details={"ip": masked, "tier": "ceiling", "seconds_left": int(lock_left),
                                             **({"suppressed_since_last": suppressed} if suppressed else {})},
                   request_id=request_id)
        return SignInResult(status="failed", sleep_s=base_sleep + min(lock_left, DELAY_SLEEP_CAP_S))
    if storm and not (user["last_sign_in_at"] and now - epoch(user["last_sign_in_at"]) < STALE_ACCOUNT_DAYS * 86400):
        lp.verify_dummy(password if pw_ok_len else "")
        return fail("global_tier", user_id=uid, count=False)
    ok = usable and pw_ok_len and lp.verify(password, user["password_hash"])
    if not (usable and pw_ok_len):  # the same one hash computation as a real check, whatever stopped it
        lp.verify_dummy(password if pw_ok_len else "")
    # FABLEFIX-295 P-01: a correct password for an account in passkeys-only mode is booked exactly like a wrong one (per-network
    # delay, ceiling count and lock, global tier, manager notices) - otherwise the side effects tell a guesser that the password is
    # right. The lock touches password sign-in only, which this person does not use; the passkey path is unaffected.
    if not ok or passkey_only:
        net_failures = TIERS.acct_fail(uname, ip)
        last = float(user["last_failed_at"] or 0.0)
        same_window = bool(last) and int(last // ACCOUNT_CEILING_WINDOW_S) == int(now // ACCOUNT_CEILING_WINDOW_S)
        failures = int(user["failed_count"] or 0) + 1 if same_window else 1
        locked = failures >= ACCOUNT_CEILING
        with db.connection(label="local sign-in failure") as conn:
            conn.execute("UPDATE auth_local_credentials SET failed_count = ?, last_failed_at = ?, delay_until = ?, updated_at = ? WHERE user_id = ?",
                         (failures, now, (now + ACCOUNT_LOCK_S) if locked else None, iso(now), uid))
        if locked:
            _audit(db, actor=None, action="auth.local.account_locked", decision="denied", reason="ceiling", resource_id=uid,
                   details={"failures_15min": failures, "lock_seconds": int(ACCOUNT_LOCK_S), "unlock": "identity.local.manage"}, request_id=request_id)
            _notify(db, "security.local_account_locked", uid)
        if net_failures == ACCOUNT_NOTIFY_AT:
            _audit(db, actor=None, action="auth.local.account_delayed", decision="denied", reason="ten_failures", resource_id=uid,
                   details={"failures": net_failures, "ip": masked}, request_id=request_id)
            _notify(db, "security.local_account_delayed", uid)
        if ok:  # passkeys-only: the same uniform 401 as any failed sign-in; the audit tier stays distinct for the managers
            return fail("passkey_only", user_id=uid)
        return fail("password" if usable else ("disabled" if not user["active"] else "no_password"), user_id=uid)
    # success
    TIERS.acct_clear(uname, ip)
    principal = Principal(user_id=uid, username=user["username"], display_name=user["display_name"] or user["username"], source="local", via="cookie")
    with db.connection(label="local sign-in success") as conn:
        if lp.needs_rehash(user["password_hash"], int(user["params_version"] or 1)):
            phc, version = lp.hash_password(password)
            conn.execute("UPDATE auth_local_credentials SET password_hash = ?, params_version = ? WHERE user_id = ?", (phc, version, uid))
            _audit(conn, actor=principal, action="auth.local.password.rehashed", decision="allowed", details={"params_version": version})
        conn.execute("""UPDATE auth_local_credentials SET failed_count = 0, last_failed_at = NULL, delay_until = NULL, last_sign_in_at = ?,
                        last_sign_in_from = ?, updated_at = ? WHERE user_id = ?""",
                     (iso(now), (masked + (" " + meta["country"] if meta.get("country") else "")).strip(), iso(now), uid))
        from . import local_passkeys

        totp = sf.is_enrolled(conn, uid)
        passkey = local_passkeys.usable(conn, uid)  # USR2 phase 4 (owner answer Q3): a usable passkey is the second factor too
        admin = holds_admin(conn, uid)
        required = factor_policy_required(conn, uid)
        if totp or passkey:
            pid = new_pending(uid, meta)
            methods = tuple(m for m, on in (("totp", totp), ("passkey", passkey)) if on)
            _audit(conn, actor=principal, action="auth.local.second_factor.required", decision="allowed", details={"ip": masked, "methods": list(methods)},
                   request_id=request_id)
            return SignInResult(status="pending", pending_id=pid, second_factor="required", sleep_s=base_sleep, methods=methods)
        value, s = create_session(conn, settings, conn_like, uid, factor=False, meta=meta)
        _audit(conn, actor=principal, action="auth.local.sign_in.succeeded", decision="allowed",
               details={"kind": s.kind, "ip": masked, "country": meta.get("country", ""), "factor": "none", "id": public_id(s.chain_id)}, request_id=request_id)
    _record_sign_in(db, principal, meta)
    return SignInResult(status="session", cookie=value, session=s, sleep_s=base_sleep,
                        second_factor="enroll_required" if (admin or required) else "none", must_change=bool(user["must_change"]),
                        user={"id": uid, "username": user["username"], "display_name": user["display_name"], "source": "local"})


def second_factor_step(db: Any, settings: Settings, conn_like: Any, pid: str | None, code: str, request_id: str | None) -> SignInResult:
    from . import second_factor as sf
    from .ha_user_auth import _record_sign_in, mask_address, request_meta

    p = take_pending(pid)
    if p is None:
        raise ApiError(401, "second_factor_expired", PENDING_EXPIRED_HE)
    meta = request_meta(conn_like)
    err: sf.SecondFactorError | None = None
    with db.connection(label="local sign-in second factor") as conn:
        user = conn.execute("SELECT id, username, display_name, active, deleted_at FROM users WHERE id = ? AND source = 'local'", (p.user_id,)).fetchone()
        if user is None or not user["active"] or user["deleted_at"]:
            drop_pending(pid)
            raise ApiError(401, "second_factor_expired", PENDING_EXPIRED_HE)
        principal = Principal(user_id=user["id"], username=user["username"], display_name=user["display_name"] or user["username"], source="local", via="cookie")
        try:
            sf.verify(conn, settings, user["id"], code)
        except sf.SecondFactorError as exc:
            err = exc
        if err is None:
            drop_pending(pid)
            value, s = create_session(conn, settings, conn_like, user["id"], factor=True, meta=meta)
            _audit(conn, actor=principal, action="auth.local.sign_in.succeeded", decision="allowed",
                   details={"kind": s.kind, "ip": mask_address(meta.get("client_ip", "")), "country": meta.get("country", ""), "factor": "totp",
                            "id": public_id(s.chain_id)}, request_id=request_id)
            cred = conn.execute("SELECT must_change FROM auth_local_credentials WHERE user_id = ?", (user["id"],)).fetchone()
        else:
            _audit(conn, actor=principal, action="auth.second_factor.failed", decision="denied",
                   reason={"locked": "second_factor_locked", "unreadable": "second_factor_unreadable"}.get(err.code, "second_factor_invalid"),
                   details={"method": "totp", "step": "local_sign_in"}, request_id=request_id)
    if err is not None:
        if err.code != "invalid":
            drop_pending(pid)
        status = 429 if err.code == "locked" else 401
        raise ApiError(status, "second_factor_locked" if err.code == "locked" else "second_factor_invalid", err.message, retryable=err.code == "locked")
    _record_sign_in(db, principal, meta)
    return SignInResult(status="session", cookie=value, session=s, second_factor="none", must_change=bool(cred and cred["must_change"]),
                        user={"id": user["id"], "username": user["username"], "display_name": user["display_name"], "source": "local"})


# ---------------------------------------------------------------- links (first login, reset)

def issue_link(conn, *, user_id: str, purpose: str, via: str, channel: str, actor: Principal, temporary: bool = False) -> tuple[str, float]:
    """A fresh single-use token for `user_id` (every earlier open link of the user is invalidated). Returns (token, expires epoch).
    Only SHA-256 of the token is stored; the caller returns the token ONCE and never logs or audits it."""
    now = time.time()
    token = secrets.token_urlsafe(32)
    expires = now + link_ttl_s(conn)
    conn.execute("UPDATE auth_local_links SET invalidated_at = ? WHERE user_id = ? AND used_at IS NULL AND invalidated_at IS NULL", (iso(now), user_id))
    conn.execute("""INSERT INTO auth_local_links(token_hash, user_id, purpose, issued_by, issued_via, issued_channel, created_at, expires_at, temporary)
                    VALUES (?,?,?,?,?,?,?,?,?)""", (token_hash(token), user_id, purpose, actor.user_id, via, channel, iso(now), iso(expires), 1 if temporary else 0))
    return token, expires


def invalidate_links(conn, user_id: str) -> int:
    return conn.execute("UPDATE auth_local_links SET invalidated_at = ? WHERE user_id = ? AND used_at IS NULL AND invalidated_at IS NULL",
                        (iso(time.time()), user_id)).rowcount


def link_path(settings: Settings, token: str) -> str:
    """The page that redeems a link: the token travels in the URL fragment, so it never reaches a proxy's or the add-on's access log."""
    return f"{settings.remote_path}/#/welcome?t={token}"


def use_link(db: Any, settings: Settings, conn_like: Any, token: str, password: str, request_id: str | None) -> dict[str, Any]:
    from . import local_passwords as lp
    from . import second_factor as sf
    from .ha_user_auth import mask_address, request_meta

    meta = request_meta(conn_like)
    now = time.time()
    th = token_hash(token or "")
    with db.connection(label="local set-password") as conn:
        link = conn.execute("""SELECT l.*, u.username, u.display_name, u.active, u.deleted_at, u.source FROM auth_local_links l JOIN users u ON u.id = l.user_id
                               WHERE l.token_hash = ?""", (th,)).fetchone()
        valid = (link is not None and not link["used_at"] and not link["invalidated_at"] and epoch(link["expires_at"]) > now and link["active"]
                 and not link["deleted_at"] and link["source"] == "local")
        if not valid:
            why = "unknown" if link is None else "used" if link["used_at"] else "invalidated" if link["invalidated_at"] else "expired" if epoch(link["expires_at"]) <= now else "user_inactive"
            _audit(conn, actor=None, action="auth.local.link.refused", decision="denied", reason=why, resource_id=link["user_id"] if link is not None else "unknown",
                   details={"ip": mask_address(meta.get("client_ip", ""))}, request_id=request_id)
            raise ApiError(401, "link_invalid", LINK_INVALID_HE)
        uid = link["user_id"]
        reason = lp.check_policy(password, min_length=password_min(conn), context=_context_words(conn, link), data_dir=settings.data_dir)
        if reason is not None:
            raise ApiError(400, "password_policy", POLICY_HE.get(reason, POLICY_HE["too_short"]), details={"reason": reason, "min_length": password_min(conn)})
        phc, version = lp.hash_password(password)
        conn.execute("""UPDATE auth_local_credentials SET password_hash = ?, params_version = ?, set_at = ?, set_by = 'link', must_change = ?,
                        failed_count = 0, last_failed_at = NULL, delay_until = NULL, updated_at = ? WHERE user_id = ?""",
                     (phc, version, iso(now), 1 if link["temporary"] else 0, iso(now), uid))
        conn.execute("UPDATE auth_local_links SET used_at = ? WHERE token_hash = ?", (iso(now), th))
        invalidate_links(conn, uid)
        ended = revoke_user_sessions(conn, uid, "password_changed")
        drop_pending_of(uid)
        _end_phone_credentials(conn, uid, "password_changed", request_id=request_id)
        must_enrol = not has_factor(conn, uid) and (holds_admin(conn, uid) or factor_policy_required(conn, uid))
        _audit(conn, actor=None, action="auth.local.link.used", decision="allowed", resource_id=uid,
               details={"purpose": link["purpose"], "via": link["issued_via"], "channel": link["issued_channel"], "temporary": bool(link["temporary"]),
                        "sessions_ended": ended, "ip": mask_address(meta.get("client_ip", ""))}, request_id=request_id)
    if ended:
        close_sockets_from_thread()
    return {"must_enrol": must_enrol}


POLICY_HE = {
    "too_short": "הסיסמה קצרה מדי.",
    "too_long": "הסיסמה ארוכה מדי (עד 128 תווים).",
    "common": "הסיסמה נפוצה מדי וקלה לניחוש. בחר משפט או צירוף ארוך יותר.",
    "contextual": "הסיסמה מבוססת על שם המשתמש, שם המערכת או שם האתר. בחר סיסמה אחרת.",
    "repeated": "הסיסמה בנויה מתו חוזר או מרצף מקלדת. בחר סיסמה אחרת.",
}


def change_password(conn, settings: Settings, conn_like: Any, s: LocalSession, current: str, new: str, code: str | None, request_id: str | None) -> dict[str, Any]:
    from . import local_passwords as lp
    from . import second_factor as sf

    uid = s.user_id
    row = conn.execute("SELECT u.username, u.display_name, c.password_hash, c.must_change FROM users u JOIN auth_local_credentials c ON c.user_id = u.id WHERE u.id = ?",
                       (uid,)).fetchone()
    if row is None or not lp.verify(current, row["password_hash"]):
        _audit(conn, actor=s.principal, action="auth.local.password.change_refused", decision="denied", reason="current_password", request_id=request_id)
        raise ApiError(400, "current_password_invalid", "הסיסמה הנוכחית אינה נכונה.")
    # USR2-FIX F11: the forced change after a TEMPORARY link (must_change) of an enrolled user. That session exists only because its
    # sign-in passed the TOTP step moments ago (factor_at on the session row - an enrolled user never gets a session without it),
    # and while must_change is set the session reaches nothing but this route (CHANGE_PATHS). Asking for a second code here is
    # what left the user stuck on the login page (no code field in that step), so the code shown AT THIS SIGN-IN counts. Every
    # other password change of an enrolled user still needs a fresh code.
    factor_shown_at_sign_in = bool(row["must_change"]) and bool(s.principal.factor_ok)
    if sf.is_enrolled(conn, uid) and not factor_shown_at_sign_in:
        if not code:
            raise ApiError(400, "second_factor_required", sf.REQUIRED_HE)
        try:
            sf.verify(conn, settings, uid, code)
        except sf.SecondFactorError as exc:
            raise ApiError(429 if exc.code == "locked" else 400, f"second_factor_{exc.code}", exc.message, retryable=exc.code == "locked") from None
    elif not sf.is_enrolled(conn, uid) and not factor_shown_at_sign_in:
        # USR2 phase 4: a user whose only factor is a passkey has no code to type - the change needs a FRESH sign-in that presented the
        # passkey (local_passkeys.recent_auth: < 5 minutes, factor shown), the passkey equivalent of "the current code"
        from . import local_passkeys

        if local_passkeys.usable(conn, uid) and not local_passkeys.recent_auth(conn, s):
            raise ApiError(403, "reauth_required", local_passkeys.REAUTH_HE)
    reason = lp.check_policy(new, min_length=password_min(conn), context=_context_words(conn, row), data_dir=settings.data_dir)
    if reason is None and lp.normalize(new) == lp.normalize(current):
        reason = "same_as_current"
    if reason is not None:
        raise ApiError(400, "password_policy", POLICY_HE.get(reason, "הסיסמה החדשה זהה לנוכחית."), details={"reason": reason, "min_length": password_min(conn)})
    phc, version = lp.hash_password(new)
    now = time.time()
    conn.execute("UPDATE auth_local_credentials SET password_hash = ?, params_version = ?, set_at = ?, set_by = 'self', must_change = 0, updated_at = ? WHERE user_id = ?",
                 (phc, version, iso(now), iso(now), uid))
    invalidate_links(conn, uid)
    ended = revoke_user_sessions(conn, uid, "password_changed", keep_chain=s.chain_id)
    # XSECFOLLOW-297: every phone of the user loses its device token and push registration - also the phone the change was made from:
    # its kept session re-registers the same install on the next presence call (contract section 1)
    _end_phone_credentials(conn, uid, "password_changed", actor=s.principal, request_id=request_id)
    rotate_current(conn, settings, conn_like, s)
    _audit(conn, actor=s.principal, action="auth.local.password.changed", decision="allowed", details={"other_sessions_ended": ended}, request_id=request_id)
    return {"other_sessions_ended": ended}


def logout(db: Any, settings: Settings, conn_like: Any, cookie_value: str) -> bool:
    """DELETE auth/session with a local cookie: the chain ends (`logout`), its pending second step too. False = no live local session."""
    from .ha_user_auth import request_meta

    if not cookie_value.startswith(COOKIE_PREFIX):
        return False
    sh = sid_hash_of(cookie_value)
    try:
        with db.connection(label="local logout") as conn:
            row = conn.execute(_SESSION_SQL, (sh,)).fetchone()
            if row is None or row["revoked_at"]:
                return False
            revoke_chain(conn, row["chain_id"], "logout")
            drop_pending_of(row["user_id"])
            principal = _principal_of_row(row, bool(row["factor_at"]))
            meta = request_meta(conn_like)
            from .ha_user_auth import mask_address

            _audit(conn, actor=principal, action="auth.local.session.revoked", decision="allowed", reason="logout",
                   details={"id": public_id(row["chain_id"]), "ip": mask_address(meta.get("client_ip", ""))})
            # XSECFIX-297 (review M2 / L1): a sign-out inside the phone app ends the app's device token and push registration too
            from . import presence

            presence.end_on_sign_out(conn, row["user_id"], "logout", user_agents=(meta.get("user_agent", ""), row["user_agent"] or ""), actor=principal)
    except Exception:  # noqa: BLE001 - an older schema: nothing to end
        return False
    return True


def _end_phone_credentials(conn, user_id: str, reason: str, *, actor: Principal | None = None, request_id: str | None = None) -> int:
    """XSECFOLLOW-297 (review follow-up b): a password change or reset is a "sign out everywhere" for the phone app too - every device
    token (`arxd_`) and push registration of the user ends (services/presence.end_on_sign_out, everywhere; device rows kept, audited
    `presence.device.credentials_ended`). Never raises: the password change stands."""
    from . import presence

    return presence.end_on_sign_out(conn, user_id, reason, everywhere=True, actor=actor, request_id=request_id)


# ---------------------------------------------------------------- hooks from other modules

def on_factor_enabled(conn, settings: Settings, conn_like: Any, principal: Principal) -> int:
    """The user just enrolled (second_factor.confirm): their other local sessions end, the current one rotates and counts as having
    shown the factor (they typed a code a moment ago)."""
    from .ha_user_auth import session_of

    lease_hook("second_factor_changed", user_ids=[principal.user_id])  # T6: a factor enrolled (TOTP confirm or the first passkey)
    s = session_of(conn_like)
    keep = s.chain_id if isinstance(s, LocalSession) and s.user_id == principal.user_id else None
    ended = revoke_user_sessions(conn, principal.user_id, "factor_enabled", keep_chain=keep)
    if keep is not None:
        rotate_current(conn, settings, conn_like, s, factor=True)
    CACHE.drop_user(principal.user_id)
    return ended


def on_factor_removed(conn, user_id: str) -> bool:
    """The user removed one of their own factors (a passkey, or TOTP `disable`). When none is left, no session of the user may keep
    counting as factor-verified (review RELEASE_264 F2): `factor_at` is cleared on every row of the user (the caller's kept chain
    included), so the administrative permissions close at once (rbac `factor_ok`); the user re-enrols from an ordinary session. The
    cached sessions are dropped so the change is seen on the next request. True when the factor flag was cleared."""
    lease_hook("second_factor_changed", user_ids=[user_id])  # T6: any factor removed (strict: also when another factor is left)
    CACHE.drop_user(user_id)
    from . import app_session

    app_session.drop_user_cache(user_id)  # SESSIONEXCH2: the app web sessions recompute factor_ok on the next request
    if has_factor(conn, user_id):
        return False
    conn.execute("UPDATE auth_local_sessions SET factor_at = NULL WHERE user_id = ? AND factor_at IS NOT NULL", (user_id,))
    CACHE.drop_user(user_id)
    return True


def on_factor_reset(conn, user_id: str) -> int:
    if not is_local_id(user_id):
        return 0
    lease_hook("second_factor_changed", user_ids=[user_id])  # T6: an administrator reset the factor (routers/second_factor also hooks)
    drop_pending_of(user_id)
    return revoke_user_sessions(conn, user_id, "factor_reset")


# ---------------------------------------------------------------- janitor

def janitor(db: Any) -> int:
    """main.janitor_tick: the memory tiers written behind; then (a read first, so a quiet installation takes no write lock) expired
    pending records, link rows 7 days after use / expiry / invalidation, session rows 30 days after revoke / expiry."""
    now = time.time()
    with _pending_lock:
        for k in [k for k, v in _pending.items() if now - v.created > PENDING_TTL_S]:
            _pending.pop(k, None)
    n = 0
    try:
        with db.connection(mode="read", label="local identity janitor read") as conn:
            if conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'auth_local_sessions'").fetchone() is None:
                return 0
            week, month = iso(now - 7 * 86400), iso(now - 30 * 86400)
            due = conn.execute("""SELECT 1 FROM auth_local_links WHERE COALESCE(used_at, invalidated_at, expires_at) < ? LIMIT 1""", (week,)).fetchone() \
                or conn.execute("""SELECT 1 FROM auth_local_sessions WHERE (revoked_at IS NOT NULL AND revoked_at < ?) OR expires_at < ? LIMIT 1""", (month, month)).fetchone()
            dirty = TIERS._dirty  # noqa: SLF001 - a racy peek; a miss is flushed next tick
        if not due and not dirty:
            return 0
        with db.connection(label="local identity janitor") as conn:
            if dirty:
                TIERS.flush(conn)
            if due:
                n += conn.execute("DELETE FROM auth_local_links WHERE COALESCE(used_at, invalidated_at, expires_at) < ?", (week,)).rowcount
                n += conn.execute("DELETE FROM auth_local_sessions WHERE (revoked_at IS NOT NULL AND revoked_at < ?) OR expires_at < ?", (month, month)).rowcount
    except Exception:  # noqa: BLE001 - housekeeping never raises
        log.warning("local identity janitor failed", exc_info=True)
    return n


def restore_tiers(db: Any) -> int:
    try:
        with db.connection(mode="read", label="local identity tiers restore") as conn:
            return TIERS.restore(conn)
    except Exception:  # noqa: BLE001
        return 0


def reset_for_tests() -> None:
    from . import local_passwords

    CACHE.clear()
    CACHE.take_to_close()
    TIERS.clear()
    with _pending_lock:
        _pending.clear()
    flag_changed()
    local_passwords.reset_for_tests()
    from . import local_reset

    local_reset.reset_for_tests()
    from . import local_passkeys

    local_passkeys.reset_for_tests()


_ = dataclasses  # kept for type tooling
