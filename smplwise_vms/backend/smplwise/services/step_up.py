"""MFA-STEPUP-TRAIN-2490 slice 1 (owner decisions 2026-11-22, Q45/Q46 + note): step-up before every change of settings, users and
permissions, with a 5-minute grace, and ONE setting that turns step-up off (then the second factor is asked only at sign-in).

How the gate works (one central place, no per-route copies):

* `rbac.require()` calls `on_grant()` after it ALLOWED a permission. When the permission is one of `GATED_PERMISSIONS` and the
  connection belongs to an HTTP request whose method changes something (not GET / HEAD / OPTIONS), `guard()` runs. So every current
  and future write route that authorises one of those permissions with `require()` is gated, AFTER its authorisation and before it acts.
* The connection -> request link is made by `auth._track` (get_conn / get_read_conn): `attach()` on open, `detach()` on close. A
  connection a handler or a background job opens on its own is never linked, so it is never gated.
* `guard()` passes when step-up does not apply to this caller (see `not_applicable`), or when the caller's session holds a fresh proof.
  Otherwise the request's own writes are rolled back (an ApiError commits, so nothing half-written may stay), the refusal is audited
  (`auth.step_up.required`) and the answer is `403 step_up_required` with the methods the caller can use.

Proofs ("marks") live server-side, in memory, per session: never on the HA token and never in a client cookie. A mark is keyed by a
hash of the session's sign-in (the HA refresh-token sign-in, the local session chain, the app session) and bound to the user id. A
restart forgets them (the user is asked again). Sources of a mark:

* `POST auth/step-up/verify` with a current authenticator-app code (method `totp`; passkeys / the phone key come in later slices);
* a remote sign-in that just showed the code (`note_sign_in_factor`, called by ha_user_auth.exchange);
* the first code of an enrolment in this session (`note_proof`, routers/second_factor.confirm);
* a local (Arx-only) session whose sign-in showed the factor (`auth_local_sessions.factor_at`) within the window.

Settings: `security.step_up` on (default, the owner's decision) | off (only the sign-in factor); `security.step_up_minutes` 0-30
(default 5; 0 = every action: a verified proof is good for ONE gated request within ONE_SHOT_S, sign-in proofs do not count);
`security.step_up_local` off (default: the local channel, Ingress, keeps today's behaviour - CR-011 E) | on.

Not gated (slice 1): a bearer caller (an HA access token on every request: long-lived tokens stay allowed, owner decision Q48); a
user with no step-up method (no authenticator code enrolled: current behaviour kept, an open question in
docs/changes/MFA-STEPUP-TRAIN-2490.md); the two routes that already demand their own per-action code (`EXEMPT_ROUTES`)."""
from __future__ import annotations

import hashlib
import sqlite3
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from ..errors import ApiError

STEP_UP_KEY = "security.step_up"
MINUTES_KEY = "security.step_up_minutes"
LOCAL_KEY = "security.step_up_local"
DEFAULT_ON = "on"
DEFAULT_MINUTES = 5
MAX_MINUTES = 30
DEFAULT_LOCAL = "off"
ONE_SHOT_S = 60.0  # security.step_up_minutes = 0: how long a verified proof waits for the one gated request it is good for
MAX_MARKS = 20000

# The permissions whose WRITE use needs a fresh proof: settings (system and module configuration, restore, update, the bridge key, the
# partner interface), users (Arx-only users, HA users) and permissions (role bindings, custom roles). Reads are never gated.
SETTINGS_PERMISSIONS = frozenset({"system.configure", "sources.configure", "nvr.configure", "site.content.configure", "calendar.configure",
                                  "tickets.configure", "backup.manage", "system.update", "bridge.key.rotate", "partner.manage"})
USERS_PERMISSIONS = frozenset({"identity.local.manage", "users.ha_manage"})
PERMISSIONS_PERMISSIONS = frozenset({"rbac.assign", "rbac.roles.manage"})
GATED_PERMISSIONS = SETTINGS_PERMISSIONS | USERS_PERMISSIONS | PERMISSIONS_PERMISSIONS
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

# Routes that already demand their OWN current code for every call (stricter than the window); the gate leaves them to it. The
# next slice (2FA-STEPUP-GATES) moves them onto the central proof.
EXEMPT_ROUTES = frozenset({
    ("DELETE", "/auth/second-factor/users/{user_id}"),  # routers/second_factor.admin_reset: the administrator's own code
    ("POST", "/system/bridge-key/revoke/reveal"),  # routers/bridge_key.reveal_new_code: mandatory own code
})

API_PREFIX = "/api/v1"
METHOD_TOTP = "totp"
METHOD_DEVICE_KEY = "device_key"  # MFA-DEVICEKEY-2490 (slice 8): a phone-key signature on a step-up challenge (services/device_keys)
STATE_ATTR = "sw_step_up"  # request.state: "ok" once this request passed the gate (require() may run several times)

REQUIRED_HE = "לפני שינוי הגדרות, משתמשים או הרשאות צריך לאשר שוב את הזהות: הזן את הקוד הנוכחי מאפליקציית האימות."
NO_SESSION_HE = "לא נמצאה כניסה פעילה לאישור. היכנס מחדש ונסה שוב."
NO_METHOD_HE = "אין לחשבון הזה דרך אימות נוספת. הפעל אימות דו־שלבי ב״החשבון שלי״."
NOT_APPLICABLE_HE = "אין צורך באישור נוסף בחיבור הזה."


# ---------------------------------------------------------------- settings

def enabled(conn: sqlite3.Connection) -> bool:
    from ..db import get_setting

    return (get_setting(conn, STEP_UP_KEY, DEFAULT_ON) or DEFAULT_ON) != "off"


def minutes(conn: sqlite3.Connection) -> int:
    from ..db import get_setting

    raw = get_setting(conn, MINUTES_KEY, str(DEFAULT_MINUTES))
    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):
        return DEFAULT_MINUTES
    return min(max(value, 0), MAX_MINUTES)


def local_channel(conn: sqlite3.Connection) -> bool:
    from ..db import get_setting

    return (get_setting(conn, LOCAL_KEY, DEFAULT_LOCAL) or DEFAULT_LOCAL) == "on"


# ---------------------------------------------------------------- the connection -> request link (auth._track)

_LINK_LOCK = threading.Lock()
_LINKS: dict[int, tuple[Any, Any]] = {}  # id(conn) -> (conn, request); the identity check guards against a reused id


def attach(conn: Any, request: Any) -> None:
    with _LINK_LOCK:
        _LINKS[id(conn)] = (conn, request)


def detach(conn: Any) -> None:
    with _LINK_LOCK:
        held = _LINKS.get(id(conn))
        if held is not None and held[0] is conn:
            _LINKS.pop(id(conn), None)


def request_of(conn: Any) -> Any | None:
    with _LINK_LOCK:
        held = _LINKS.get(id(conn))
    return held[1] if held is not None and held[0] is conn else None


# ---------------------------------------------------------------- marks (server-side, per session, memory only)

@dataclass
class Mark:
    user_id: str
    at: float
    method: str
    one_shot: bool = False  # made while security.step_up_minutes = 0: good for one gated request within ONE_SHOT_S


_MARK_LOCK = threading.Lock()
_MARKS: dict[str, Mark] = {}


def _now() -> float:
    return time.time()


def _hash(key: str) -> str:
    return hashlib.sha256(("step-up|" + key).encode("utf-8")).hexdigest()


def _put(key: str, mark: Mark) -> None:
    h = _hash(key)
    with _MARK_LOCK:
        if h not in _MARKS and len(_MARKS) >= MAX_MARKS:
            for k in list(_MARKS)[: MAX_MARKS // 10]:  # the oldest tenth (insertion order)
                _MARKS.pop(k, None)
        _MARKS.pop(h, None)
        _MARKS[h] = mark


def _get(key: str) -> Mark | None:
    with _MARK_LOCK:
        return _MARKS.get(_hash(key))


def _consume(key: str, mark: Mark) -> bool:
    h = _hash(key)
    with _MARK_LOCK:
        if _MARKS.get(h) is mark:
            _MARKS.pop(h, None)
            return True
    return False


def forget_user(user_id: str) -> int:
    """Drop every mark of the user (their factor was removed or reset). Returns how many."""
    with _MARK_LOCK:
        gone = [h for h, m in _MARKS.items() if m.user_id == user_id]
        for h in gone:
            _MARKS.pop(h, None)
    return len(gone)


def reset_for_tests() -> None:
    with _MARK_LOCK:
        _MARKS.clear()
    with _LINK_LOCK:
        _LINKS.clear()


# ---------------------------------------------------------------- who and which session

def _is_remote(request: Any) -> bool:
    from ..remote_channel import is_remote

    return is_remote(request)


def session_key(request: Any, principal: Any) -> str | None:
    """The key of the caller's session for a mark: the sign-in of the remote session (HA cookie session, Arx-only session, phone-app
    session - one sign-in keeps it across cookie rotations), or `ingress:<user>` on the local channel. None: no session to hold a mark."""
    if not _is_remote(request):
        return f"ingress:{principal.user_id}"
    from . import ha_user_auth as hua

    s = hua.session_of(request)
    if s is not None:
        sign_in = getattr(s, "sign_in", None)
        value = sign_in() if callable(sign_in) else getattr(s, "sid", "")
        if value:
            return f"remote:{value}"
    sid = hua.session_id_of(request.app.state.settings, request)
    return f"cookie:{sid}" if sid else None


def methods_of(conn: sqlite3.Connection, user_id: str) -> list[str]:
    """The step-up methods this user can use now: the authenticator-app code, and (MFA-DEVICEKEY-2490, slice 8) an active phone key of
    the Android app (services/device_keys). A user with only a phone key therefore has a method and is gated - in a browser too, where
    the phone key cannot answer (the change is then made from the app, or the user adds the authenticator code)."""
    from . import device_keys
    from . import second_factor as sf

    out = [METHOD_TOTP] if sf.is_enrolled(conn, user_id) else []
    if device_keys.has_active(conn, user_id):
        out.append(METHOD_DEVICE_KEY)
    return out


def not_applicable(conn: sqlite3.Connection, request: Any, principal: Any) -> str | None:
    """Why step-up does not apply to this caller, or None when it does."""
    if not enabled(conn):
        return "off"
    if not _is_remote(request):
        if not local_channel(conn):
            return "local_channel"
    elif getattr(principal, "via", "") == "bearer":
        return "bearer_token"  # owner decision Q48: a long-lived token from outside stays allowed, as today
    if not methods_of(conn, principal.user_id):
        return "no_method"
    return None


def _parse_iso(value: Any) -> float | None:
    if not value:
        return None
    try:
        d = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.timestamp()


def _local_sign_in_factor_at(conn: sqlite3.Connection, request: Any, principal: Any) -> float | None:
    """An Arx-only session: when its sign-in showed the second factor (`auth_local_sessions.factor_at`, kept across rotations)."""
    if getattr(principal, "source", "") != "local" or not _is_remote(request):
        return None
    from . import ha_user_auth as hua

    s = hua.session_of(request)
    sid_hash = getattr(s, "sid_hash", None)
    if not sid_hash or not hasattr(s, "chain_id"):
        return None
    row = conn.execute("SELECT factor_at FROM auth_local_sessions WHERE sid_hash = ?", (sid_hash,)).fetchone()
    return _parse_iso(row[0]) if row is not None else None


def valid_until(conn: sqlite3.Connection, request: Any, principal: Any) -> float | None:
    """When the caller's current proof stops counting, or None when there is none (a one-shot proof: its own expiry)."""
    key = session_key(request, principal)
    if key is None:
        return None
    now = _now()
    window = minutes(conn) * 60
    best: float | None = None
    m = _get(key)
    if m is not None and m.user_id == principal.user_id:
        end = m.at + (ONE_SHOT_S if m.one_shot else window)
        if (m.one_shot or window > 0) and end > now:
            best = end
    if window > 0:
        at = _local_sign_in_factor_at(conn, request, principal)
        if at is not None and at + window > now:
            best = max(best or 0.0, at + window)
    return best


def _satisfied(conn: sqlite3.Connection, request: Any, principal: Any, key: str) -> bool:
    window = minutes(conn) * 60
    now = _now()
    m = _get(key)
    if m is not None and m.user_id == principal.user_id:
        if m.one_shot:
            if now - m.at <= ONE_SHOT_S and _consume(key, m):
                return True
        elif window > 0 and now - m.at <= window:
            return True
    if window > 0:
        at = _local_sign_in_factor_at(conn, request, principal)
        if at is not None and now - at <= window:
            return True
    return False


# ---------------------------------------------------------------- proofs

def mark(conn: sqlite3.Connection, request: Any, principal: Any, method: str) -> float | None:
    """Record a proof the caller just gave in this session. Returns when it stops counting (None: no session to hold it)."""
    key = session_key(request, principal)
    if key is None:
        return None
    one_shot = minutes(conn) == 0
    m = Mark(user_id=principal.user_id, at=_now(), method=method, one_shot=one_shot)
    _put(key, m)
    return m.at + (ONE_SHOT_S if one_shot else minutes(conn) * 60)


def note_proof(request: Any, principal: Any, method: str) -> None:
    """A code shown in this session for another purpose (the enrolment's first code): it is a fresh proof too. Never one-shot."""
    key = session_key(request, principal)
    if key is not None:
        _put(key, Mark(user_id=principal.user_id, at=_now(), method=method))


def note_sign_in_factor(session: Any) -> None:
    """A remote sign-in that just showed the second factor (ha_user_auth.exchange): the session starts with a fresh proof."""
    sign_in = getattr(session, "sign_in", None)
    value = sign_in() if callable(sign_in) else ""
    if value:
        _put(f"remote:{value}", Mark(user_id=session.principal.user_id, at=_now(), method="sign_in"))


# ---------------------------------------------------------------- the gate

def _route(request: Any) -> str:
    """The matched route's template without the API prefix (`/settings`, `/auth/second-factor/users/{user_id}`) - never a concrete id."""
    template = getattr(request.scope.get("route"), "path", None)
    if not isinstance(template, str):
        return ""
    return template[len(API_PREFIX):] if template.startswith(API_PREFIX + "/") else template


def _exempt(request: Any) -> bool:
    return (request.scope.get("method") or "", _route(request)) in EXEMPT_ROUTES


def required_error(conn: sqlite3.Connection, principal: Any, permission: str) -> ApiError:
    return ApiError(403, "step_up_required", REQUIRED_HE,
                    details={"action": permission, "methods": methods_of(conn, principal.user_id), "minutes": minutes(conn),
                             "verify_path": "auth/step-up/verify"})


def guard(conn: sqlite3.Connection, request: Any, principal: Any, permission: str) -> None:
    """Pass, or refuse this write with 403 step_up_required (its own writes rolled back, the refusal audited). Public: a route that
    authorises a gated change without require() calls it directly."""
    state = getattr(request, "state", None)
    if state is not None and getattr(state, STATE_ATTR, None) == "ok":
        return
    if not_applicable(conn, request, principal) is None:
        key = session_key(request, principal)
        if key is None or not _satisfied(conn, request, principal, key):
            _refuse(conn, request, principal, permission)
    if state is not None:
        setattr(state, STATE_ATTR, "ok")


def _refuse(conn: sqlite3.Connection, request: Any, principal: Any, permission: str) -> None:
    from .. import correlation_id
    from ..audit import audit
    from ..db import read_mode, rollback_and_restart

    if not read_mode(conn) and conn.in_transaction:
        rollback_and_restart(conn)  # nothing the request wrote before the gate stays (an ApiError commits)
    audit(conn, actor=principal, action="auth.step_up.required", decision="denied", resource_type="step_up", resource_id=permission,
          reason="step_up_required", request_id=correlation_id.of(request),
          details={"permission": permission, "method": request.scope.get("method") or "", "route": _route(request)})
    raise required_error(conn, principal, permission)


def on_grant(conn: sqlite3.Connection, principal: Any, permission: str) -> None:
    """rbac.require() allowed `permission` on `conn`: gate it when it is a write of a gated permission inside an HTTP request."""
    if permission not in GATED_PERMISSIONS:
        return
    request = request_of(conn)
    if request is None:
        return
    scope = getattr(request, "scope", None) or {}
    if scope.get("type") != "http" or (scope.get("method") or "GET").upper() in SAFE_METHODS:
        return
    if _exempt(request):
        return
    guard(conn, request, principal, permission)


def iso(at: float | None) -> str | None:
    return datetime.fromtimestamp(at, timezone.utc).isoformat(timespec="seconds") if at else None


def status(conn: sqlite3.Connection, request: Any, principal: Any) -> dict[str, Any]:
    """`GET auth/step-up`: the switch, the window, whether it applies to this caller (and why not), the methods, the current proof."""
    reason = not_applicable(conn, request, principal)
    until = valid_until(conn, request, principal) if reason is None else None
    return {"enabled": enabled(conn), "minutes": minutes(conn), "local_channel": local_channel(conn), "applies": reason is None,
            "reason": reason, "methods": methods_of(conn, principal.user_id),
            "valid_until": iso(until)}


from ..test_reset import register_reset  # noqa: E402 - imports nothing from the package

register_reset(__name__, ("_MARKS", "_LINKS"), reset_for_tests)
