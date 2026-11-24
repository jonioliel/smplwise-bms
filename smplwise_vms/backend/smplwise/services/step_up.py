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

Not gated (slice 1): a bearer caller with a LONG-LIVED HA access token (owner decision Q48; MFA-TOKENS-2490 narrowed slice 1's exemption
of every bearer caller - a short-lived bearer token is gated like a session, services/access_tokens.kind_of); a
user with no step-up method (no authenticator code enrolled: current behaviour kept, an open question in
docs/changes/MFA-STEPUP-TRAIN-2490.md); the routes that demand their own per-call code (`EXEMPT_ROUTES`).

Slice 3 (MFA-STEPUP-GATES-2490, docs/changes/MFA-STEPUP-GATES-2490.md):

* the physical-safety actions (`PHYSICAL_ACTIONS`: alarm disarm, zone bypass, opening a door) are gated by `guard_action()` at their
  choke points (routers/alarm.py, routers/ha.py, routers/access_control_door.open_door, the door runs, the hold-open button, the
  acceptance pulse) - same switch, window and proofs; the personal alarm code typed for an alarm action is that action's proof;
* once-actions (`ONCE_ROUTES`, grace 0): the factor reset, the bridge-key reveal and the passkey removal need a proof on EVERY call
  (`once_proof()`: the own code in the request, or a once-proof from `auth/step-up/verify` bound to the action);
* an authority that grants a gated change without require() calls `on_grant()` itself (rbac_admin.assigns_anywhere, the
  door-automation settings, the visitor entrance flag, the WisKey door settings, the tickets costs and intake lexicon);
* a handler that opens its own connection is inside its request too (`current_request()`, set by main.CorrelationId until the
  response starts);
* write-method routes that change nothing are listed in `READ_ONLY_ROUTES`; tests/test_mfa_stepup_gates_2490.py walks the route
  table and fails on a write route that uses a gated permission without a gate or a listed reason."""
from __future__ import annotations

import hashlib
import sqlite3
import threading
import time
from contextvars import ContextVar
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

# MFA-STEPUP-GATES-2490 (slice 3): the physical-safety actions. Owner Q45 names alarm disarm and zone bypass; the slice card adds
# opening a door (design 4.2 scope `alarm_doors`, inside the owner's `all_sensitive`). They are authorised by their own authorities
# (the alarm scope, the one door rule, the bridge action's grant), not by require(), so each choke point calls guard_action()
# explicitly, after its authorisation and before anything is sent. Same switch, same window, same proofs as the settings gate (the
# security docs are silent on a separate grace: recorded as an open question in docs/changes/MFA-STEPUP-GATES-2490.md).
ACTION_DISARM = "alarm.disarm"
ACTION_BYPASS = "alarm.bypass"
ACTION_DOOR_OPEN = "door.open"
PHYSICAL_ACTIONS = frozenset({ACTION_DISARM, ACTION_BYPASS, ACTION_DOOR_OPEN})
# the permissions those actions are judged by (the route-table ratchet looks for them; never gated through require() directly)
PHYSICAL_PERMISSIONS = frozenset({"alarm.disarm", "alarm.bypass", "door.unlock", "access.doors.open", "access.release"})

# MFA-STEPUP-GATES-2490: once-actions (grace 0). These routes demand a proof for EVERY call - the caller's own current code in the
# request (`X-Arx-Second-Factor` or the body's `code`, as before), or a once-proof made by `POST auth/step-up/verify` with this
# action, consumed by the one call within ONE_SHOT_S. A window proof or a sign-in proof never counts for them, and the window gate
# leaves them to their own check (EXEMPT_ROUTES).
ONCE_RESET = "auth.second_factor.reset"  # routers/second_factor.admin_reset: the administrator's own code
ONCE_REVEAL = "bridge.key.code_revealed"  # routers/bridge_key.reveal_new_code: mandatory own code
ONCE_PASSKEY = "auth.local.passkey.removed"  # routers/local_passkeys.admin_remove: the administrator's own code
ONCE_ROUTES: dict[tuple[str, str], str] = {
    ("DELETE", "/auth/second-factor/users/{user_id}"): ONCE_RESET,
    ("POST", "/system/bridge-key/revoke/reveal"): ONCE_REVEAL,
    ("DELETE", "/identity/local-users/{user_id}/passkeys/{pk_id}"): ONCE_PASSKEY,
}
ONCE_ACTIONS = frozenset(ONCE_ROUTES.values())
# MFA-SECFIX-2500 (SR-4, W-1; owner questions page Q13, recommendation): a recovery code is a step-up proof for the normal window
# only. Never for a once-action, and never for a change of the caller's own factors - a new batch of recovery codes, adding or
# removing a passkey, registering or revoking a phone key - so one leaked code cannot be laundered into a lasting factor.
FACTOR_CHANGE_ACTIONS = frozenset({"auth.recovery_codes.regenerate", "auth.passkey.register", "auth.passkey.remove",
                                   "auth.device_key.register", "auth.device_key.revoke"})
NO_RECOVERY_ACTIONS = ONCE_ACTIONS | FACTOR_CHANGE_ACTIONS
EXEMPT_ROUTES = frozenset(ONCE_ROUTES)

# MFA-STEPUP-GATES-2490: write-method routes that authorise a gated permission but change nothing (previews, checks, dry runs,
# connection tests that store nothing). The gate leaves them alone; each entry says why. The route-table ratchet
# (tests/test_mfa_stepup_gates_2490.py) fails on an entry that names no route.
READ_ONLY_ROUTES: dict[tuple[str, str], str] = {
    ("POST", "/access/preview"): "the effect of a binding before it is saved - computed, nothing written",
    ("POST", "/access/roles/preview"): "the effect of a role edit before it is saved - computed, nothing written",
    ("POST", "/access/groups/{group_id}/impact"): "a group change applied inside a savepoint and rolled back",
    ("POST", "/ha-users/check"): "a read-only probe of the user list; only the probe's own result is kept",
    ("POST", "/nvr/encoding-batches/preview"): "the plan of an encoding batch - nothing is sent to the recorder",
    ("POST", "/access-control/installer/platform/import/preview"): "an import preview - nothing is written to WisKey or Arx",
    ("POST", "/access-control/installer/platform/retention/preview"): "a retention preview - nothing is deleted",
    ("POST", "/access-control/installer/platform/config/read"): "reads the station configuration",
    ("POST", "/access-control/installer/platform/config/preview"): "a configuration preview - nothing is applied",
    ("POST", "/access-control/installer/platform/maintenance/preview"): "a maintenance preview - nothing is queued",
    ("POST", "/tickets/admin/message-templates/preview"): "renders a template with sample values",
    ("POST", "/tickets/rules/test"): "a dry run of a rule on a read connection",
}

API_PREFIX = "/api/v1"
METHOD_TOTP = "totp"
METHOD_PASSKEY = "passkey"  # MFA-PASSKEYS-2490 (slice 4): a WebAuthn assertion on a step-up challenge (services/user_passkeys)
METHOD_RECOVERY = "recovery_code"  # MFA-RECOVERY-CODES-2490: a one-time recovery code, accepted by `verify` in place of the code
STATE_ATTR = "sw_step_up"  # request.state: "ok" once this request passed the gate (require() may run several times)

REQUIRED_HE = "לפני שינוי הגדרות, משתמשים או הרשאות צריך לאשר שוב את הזהות: הזן את הקוד הנוכחי מאפליקציית האימות."
PHYSICAL_HE = "לפני נטרול אזעקה, עקיפת חיישן או פתיחת דלת צריך לאשר שוב את הזהות: הזן את הקוד הנוכחי מאפליקציית האימות."
NO_SESSION_HE = "לא נמצאה כניסה פעילה לאישור. היכנס מחדש ונסה שוב."
NO_METHOD_HE = "אין לחשבון הזה דרך אימות נוספת. הפעל אימות דו־שלבי ב״החשבון שלי״."
NOT_APPLICABLE_HE = "אין צורך באישור נוסף בחיבור הזה."
RECOVERY_REFUSED_HE = "קוד שחזור לא מתאים לפעולה הזו. אשר עם הקוד מאפליקציית האימות, מפתח גישה או מפתח הטלפון."


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
    """The HTTP request `conn` serves: the link made by auth._track, else (MFA-STEPUP-GATES-2490) the request this code runs in -
    a handler that opens its own connection (`db.connection()`, `write_aside`) is inside its request too. The request context
    ends when the response starts (a background task after the answer, or a streamed body, is never gated)."""
    with _LINK_LOCK:
        held = _LINKS.get(id(conn))
    if held is not None and held[0] is conn:
        return held[1]
    return current_request()


# MFA-STEPUP-GATES-2490: the request the current code runs in (set by main.CorrelationId for every HTTP request; FastAPI runs a sync
# handler in a worker thread with a copy of this context). A mutable holder, so the middleware can close it when the response starts.
_CURRENT: ContextVar[dict[str, Any] | None] = ContextVar("sw_step_up_request", default=None)


def enter_request(scope: dict[str, Any]) -> tuple[Any, dict[str, Any]]:
    holder: dict[str, Any] = {"scope": scope, "open": True}
    return _CURRENT.set(holder), holder


def close_request(holder: dict[str, Any]) -> None:
    holder["open"] = False


def leave_request(token: Any) -> None:
    _CURRENT.reset(token)


def current_request() -> Any | None:
    held = _CURRENT.get()
    if not held or not held.get("open"):
        return None
    from starlette.requests import Request

    return Request(held["scope"])  # state, headers and the matched route all live in the shared scope dict


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
    """The step-up methods this user can use now: the authenticator-app code, and (MFA-PASSKEYS-2490, slice 4) a passkey that counts
    as a factor for this user (services/user_passkeys.counts: made for the current public address, the all-users switch for a user
    who is not an Arx-only identity). A user with only a passkey therefore has a method and is gated."""
    from . import second_factor as sf
    from . import user_passkeys

    out = [METHOD_TOTP] if sf.is_enrolled(conn, user_id) else []
    if user_passkeys.counts(conn, user_id):
        out.append(METHOD_PASSKEY)
    return out


def not_applicable(conn: sqlite3.Connection, request: Any, principal: Any) -> str | None:
    """Why step-up does not apply to this caller, or None when it does."""
    if not enabled(conn):
        return "off"
    if not _is_remote(request):
        if not local_channel(conn):
            return "local_channel"
    elif getattr(principal, "via", "") == "bearer":
        from . import access_tokens

        # owner decision Q48: a long-lived token from outside stays allowed, as today. MFA-TOKENS-2490 narrowed slice 1's exemption of
        # every bearer caller to the long-lived ones: a short-lived (or unreadable) bearer token is gated like a session
        if access_tokens.exempt(access_tokens.session_kind(request)):
            return "bearer_token"
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


def recovery_allowed(action: str | None) -> bool:
    """MFA-SECFIX-2500: may a recovery code be the proof for this action? Only for the normal window (see NO_RECOVERY_ACTIONS)."""
    return (action or "") not in NO_RECOVERY_ACTIONS


def fresh_proof(conn: sqlite3.Connection, request: Any, principal: Any, *, local_sign_in: bool = True) -> bool:
    """MFA-PASSKEYS-2490: does the caller's session hold a proof right now (the window, a one-shot proof - then spent - or, unless
    `local_sign_in` is False, a local sign-in that showed the factor within the window)? For the factor changes that need a proof
    whatever the switch says (adding a passkey to an account that already has a factor, removing one): not the gate, so neither the
    switch nor the channel matter. `local_sign_in=False`: only a proof given in this session (an Arx-only identity's passkey removal
    keeps its own fresh-sign-in rule for the sign-in part)."""
    key = session_key(request, principal)
    if key is None:
        return False
    if local_sign_in:
        return _satisfied(conn, request, principal, key)
    m = _get(key)
    if m is None or m.user_id != principal.user_id:
        return False
    if m.one_shot:
        return _now() - m.at <= ONE_SHOT_S and _consume(key, m)
    window = minutes(conn) * 60
    return window > 0 and _now() - m.at <= window


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


def route_key(request: Any) -> tuple[str, str]:
    return ((request.scope.get("method") or "").upper(), _route(request))


def _exempt(request: Any) -> bool:
    key = route_key(request)
    return key in EXEMPT_ROUTES or key in READ_ONLY_ROUTES


def _write_request(request: Any) -> bool:
    scope = getattr(request, "scope", None) or {}
    return scope.get("type") == "http" and (scope.get("method") or "GET").upper() not in SAFE_METHODS


def required_error(conn: sqlite3.Connection, principal: Any, permission: str) -> ApiError:
    return ApiError(403, "step_up_required", PHYSICAL_HE if permission in PHYSICAL_ACTIONS else REQUIRED_HE,
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
    """`permission` was granted on `conn` - by rbac.require(), or (MFA-STEPUP-GATES-2490) by an authority that decides a gated change
    without require() and calls this itself (rbac_admin.assigns_anywhere, the door-automation administrator settings...): gate it
    when it is a write of a gated permission inside an HTTP request, unless the route is a once-action or a read-only route."""
    if permission not in GATED_PERMISSIONS:
        return
    request = request_of(conn)
    if request is None or not _write_request(request) or _exempt(request):
        return
    guard(conn, request, principal, permission)


def guard_action(conn: sqlite3.Connection, request: Any, principal: Any, action: str) -> None:
    """MFA-STEPUP-GATES-2490: a physical-safety action (PHYSICAL_ACTIONS: alarm disarm, zone bypass, opening a door) inside an HTTP
    write request - called by its choke point after the action's own authorisation and BEFORE anything is reserved, recorded or
    sent. `request` None: the request this code runs in, if any; outside one (a timer, an automation firing, a background run)
    never gated. Same switch, window and proofs as the settings gate; nothing is queued or retried (the caller answers
    403 step_up_required and the person taps again)."""
    assert action in PHYSICAL_ACTIONS, action
    if request is None:
        request = request_of(conn)
    if request is None or not _write_request(request):
        return
    guard(conn, request, principal, action)


# ---------------------------------------------------------------- once-actions (grace 0)

class OnceProofMissing(Exception):
    """A once-action was called with no code and no once-proof for it."""


def _once_key(action: str, key: str) -> str:
    return f"once:{action}|{key}"


def mark_once(request: Any, principal: Any, action: str, method: str) -> float | None:
    """`POST auth/step-up/verify {action: <once-action>}`: a proof for ONE call of that action within ONE_SHOT_S (never a window)."""
    key = session_key(request, principal)
    if key is None:
        return None
    m = Mark(user_id=principal.user_id, at=_now(), method=method, one_shot=True)
    _put(_once_key(action, key), m)
    return m.at + ONE_SHOT_S


def _take_once(request: Any, principal: Any, action: str) -> bool:
    key = session_key(request, principal)
    if key is None:
        return False
    k = _once_key(action, key)
    m = _get(k)
    return m is not None and m.user_id == principal.user_id and _now() - m.at <= ONE_SHOT_S and _consume(k, m)


def once_proof(conn: sqlite3.Connection, request: Any, principal: Any, action: str, inline_code: str | None) -> str | None:
    """The proof a once-action (ONCE_ACTIONS) needs on EVERY call, whatever the switch, the window or the channel - the behaviour
    these routes always had. Returns the method that proved it (`totp`: the caller's own current code in this request, header
    `X-Arx-Second-Factor` or the body; `once`: a once-proof from `auth/step-up/verify` for this action, now consumed), or None when
    the caller has no step-up method (the route decides: the factor reset goes on as before, the bridge-key reveal refuses).
    Raises OnceProofMissing without either, and second_factor.SecondFactorError for a wrong code (the route maps and audits both,
    as before). A window proof or a sign-in proof never counts here."""
    if action not in ONCE_ACTIONS:
        raise ValueError(action)
    if not methods_of(conn, principal.user_id):
        return None
    from . import ha_user_auth as hua
    from . import second_factor as sf

    code = (request.headers.get(hua.SECOND_FACTOR_HEADER) or inline_code or "").strip()
    if not code:
        if _take_once(request, principal, action):
            return "once"
        raise OnceProofMissing(action)
    sf.verify(conn, request.app.state.settings, principal.user_id, code)
    return METHOD_TOTP


def once_details(conn: sqlite3.Connection, principal: Any, action: str) -> dict[str, Any]:
    """The `details` of a once-action's refusal, for the step-up sheet (slice 2): verify with this action, then retry once."""
    return {"action": action, "methods": methods_of(conn, principal.user_id), "minutes": 0, "once": True, "verify_path": "auth/step-up/verify"}


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
