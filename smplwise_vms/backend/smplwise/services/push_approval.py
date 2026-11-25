"""MFA-T095-REST-2530 (CR-011 option D, T095 acceptance 3 second half): push approval with number matching.

A person on a desktop (or any session without the phone key) is refused a sensitive action with 403 `step_up_required`; when
`security.push_approval` is on and the account has an active phone key, the step-up dialog offers "approve on my phone":

1. the REQUESTER session asks `POST auth/step-up/push {action}` -> an approval request (`pa_...`) bound to the user, the requester's
   session, the action and a two-digit NUMBER that only the requester's screen shows; the account's own user gets a content-free notice
   (`security.push_approval_requested`) on every device through the existing channels (inbox, web push, the phone app's push) - no new
   provider; the notice carries neither the number nor the action;
2. the PHONE (the Android app, signed in as the same user, holding the phone key) lists the pending request (`GET auth/push-approvals`)
   - what it is for, never the number - and the person TYPES the two-digit number the requesting screen shows (number matching, typed:
   an approval given blindly, "push fatigue", hits the right number once in 90 and a miss ends the request; picking among a few shown
   numbers would be one in three);
3. the phone asks a phone-key challenge for the typed number (`POST auth/push-approvals/{id}/challenge {key_id, number}`): an ordinary `step_up`
   challenge of services/device_keys bound to the PHONE's session, the key and the action text `auth.push_approval.n<number>` - so the
   app (mobile/android-shell DeviceKey.kt, unchanged) shows the prompt and signs bytes that carry the chosen number; the app's biometric
   / screen-lock prompt is the user-verification step;
4. `POST auth/push-approvals/{id}/approve {challenge_id, key_id, signature}` checks the signature (services/device_keys.check: single use,
   bound, lockout) and then the number: the right one approves the request, a wrong one DENIES it (`number_mismatch`);
   `POST auth/push-approvals/{id}/deny` ("this was not me") denies it too. A denial blocks new requests of that user for
   DENY_COOLDOWN_S (a flood of prompts after "not me" is exactly the fatigue attack);
5. the requester polls `GET auth/step-up/push/{id}` and, once `approved`, spends it with `POST auth/step-up/verify {method: "push",
   challenge_id: <request id>, action}` within USE_WINDOW_S: a proof for ONE request of exactly that action on exactly that session
   (services/step_up.mark_action) - never a window, never for another action, never twice.

Where push approval counts: the settings / users / permissions gate and the physical actions (step_up.GATED_PERMISSIONS |
PHYSICAL_ACTIONS). Never for a once-action (another user's factor reset, the bridge-key reveal, a role change to system administrator,
a restore) and never for a change of the caller's own factors (step_up.FACTOR_CHANGE_ACTIONS) - those keep the methods of the device
that asks (open question in docs/changes/MFA-T095-REST-2530.md).

Everything is in memory (like the step-up marks and the phone-key challenges): a restart forgets open requests (the person asks again).
Fail closed: an unknown, expired, used, cancelled, superseded, other-user or other-session request is refused with the same answer.
Nothing here logs, audits or returns a signature or key material; the number is returned to the requester only."""
from __future__ import annotations

import hashlib
import secrets
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from typing import Any

SETTING_KEY = "security.push_approval"
DEFAULT = "off"  # owner rule: a new behaviour ships off (CR-011 Q11 was never answered - "not understood", design q30)

METHOD = "push"  # the step-up method name (services/step_up)
ID_PREFIX = "pa_"
ID_PATTERN = r"^pa_[A-Za-z0-9_-]{20,40}$"
APPROVE_ACTION_PREFIX = "auth.push_approval.n"  # the phone-key challenge's action text: the chosen number is inside the signed bytes

TTL_S = 90.0  # a pending request lives this long (the phone has to be found, unlocked and the prompt answered)
USE_WINDOW_S = 60.0  # an approved request must be spent by the requester this soon after the approval
DENY_COOLDOWN_S = 300.0  # after "not me" or a wrong number: no new request of that user for this long
NUMBER_MIN, NUMBER_MAX = 10, 99
MAX_OPEN = 2000

PENDING, APPROVED, DENIED, EXPIRED, CANCELLED, USED = "pending", "approved", "denied", "expired", "cancelled", "used"

UNKNOWN_HE = "בקשת האישור לא נמצאה או שפגה. נסה שוב."
COOLDOWN_HE = "בקשת אישור קודמת נדחתה בטלפון. אפשר לבקש שוב בעוד כמה דקות."
OFF_HE = "אישור בטלפון כבוי בהגדרות המערכת."
NO_PHONE_HE = "אין לחשבון הזה מפתח טלפון פעיל, ולכן אי אפשר לאשר בטלפון."
METHOD_REFUSED_HE = "את הפעולה הזו אי אפשר לאשר בטלפון. אשר עם הקוד מאפליקציית האימות, מפתח גישה או מפתח הטלפון במכשיר הזה."
SAME_SESSION_HE = "את הבקשה מאשרים במכשיר אחר - בטלפון שבו מותקנת האפליקציה."
NOT_APPROVED_HE = "הבקשה עוד לא אושרה בטלפון."


def _now() -> float:
    return time.monotonic()


# ---------------------------------------------------------------- settings

def enabled(conn: sqlite3.Connection) -> bool:
    from ..db import get_setting

    try:
        return (get_setting(conn, SETTING_KEY, DEFAULT) or DEFAULT) == "on"
    except Exception:  # noqa: BLE001 - fail closed
        return False


def approvable(action: str | None) -> bool:
    """May a push approval prove `action`? The gated changes and the physical actions only (never a once-action, never a factor change)."""
    from . import step_up

    a = action or ""
    if a in step_up.ANY_ONCE_ACTIONS or a in step_up.FACTOR_CHANGE_ACTIONS:
        return False
    return a in step_up.GATED_PERMISSIONS or a in step_up.PHYSICAL_ACTIONS


def available(conn: sqlite3.Connection, user_id: str, action: str | None) -> bool:
    """Is `push` a step-up method of this user for `action` now: the switch is on, the action may be approved, the user has a phone key."""
    from . import device_keys

    return enabled(conn) and approvable(action) and device_keys.has_active(conn, user_id)


# ---------------------------------------------------------------- requests (memory)

@dataclass
class Approval:
    id: str
    user_id: str
    session: str  # the requester's step-up session key (services/step_up.session_key)
    action: str
    number: int
    created: float
    expires: float
    status: str = PENDING
    reason: str | None = None
    decided: float | None = None
    key_id: str | None = None
    challenges: dict[str, int] = field(default_factory=dict)  # phone-key challenge id -> the number it was issued for


_LOCK = threading.Lock()
_POOL: dict[str, Approval] = {}  # sha256(id) -> approval, insertion order = age
_COOLDOWN: dict[str, float] = {}  # user id -> monotonic time until which no new request is made


def _h(approval_id: str) -> str:
    return hashlib.sha256(("push-approval|" + approval_id).encode("utf-8", "replace")).hexdigest()


def _expire_locked(now: float) -> None:
    for a in _POOL.values():
        if a.status == PENDING and a.expires <= now:
            a.status, a.reason = EXPIRED, "expired"
        elif a.status == APPROVED and a.decided is not None and now - a.decided > USE_WINDOW_S:
            a.status, a.reason = EXPIRED, "unused"
    for k in [k for k, a in _POOL.items() if a.status != PENDING and now - a.created > TTL_S + USE_WINDOW_S + 60.0]:
        _POOL.pop(k, None)
    for u in [u for u, until in _COOLDOWN.items() if until <= now]:
        _COOLDOWN.pop(u, None)


def cooldown_left(user_id: str) -> int:
    with _LOCK:
        now = _now()
        _expire_locked(now)
        until = _COOLDOWN.get(user_id)
    return int(until - now) + 1 if until else 0


def create(user_id: str, session: str, action: str) -> tuple[Approval, list[Approval]]:
    """A new pending request. At most ONE is open per user: an older pending one is cancelled (`superseded`) and returned for the audit.
    The caller checks the switch, the action, the phone key, the cooldown and the rate limit first."""
    number = NUMBER_MIN + secrets.randbelow(NUMBER_MAX - NUMBER_MIN + 1)
    approval_id = ID_PREFIX + secrets.token_urlsafe(24)
    now = _now()
    a = Approval(id=approval_id, user_id=user_id, session=session, action=action, number=number, created=now, expires=now + TTL_S)
    superseded: list[Approval] = []
    with _LOCK:
        _expire_locked(now)
        for old in _POOL.values():
            if old.user_id == user_id and old.status in (PENDING, APPROVED):
                old.status, old.reason, old.decided = CANCELLED, "superseded", now
                superseded.append(old)
        while len(_POOL) >= MAX_OPEN:
            _POOL.pop(next(iter(_POOL)), None)
        _POOL[_h(approval_id)] = a
    return a, superseded


def get(approval_id: Any) -> Approval | None:
    if not isinstance(approval_id, str) or not approval_id.startswith(ID_PREFIX) or len(approval_id) > 60:
        return None
    with _LOCK:
        _expire_locked(_now())
        return _POOL.get(_h(approval_id))


def of_requester(approval_id: Any, user_id: str, session: str | None) -> Approval | None:
    """The request as its REQUESTER may see it: the same user AND the same session, else None (the same answer as an unknown id)."""
    a = get(approval_id)
    if a is None or a.user_id != user_id or session is None or a.session != session:
        return None
    return a


def pending_of(user_id: str) -> list[Approval]:
    with _LOCK:
        _expire_locked(_now())
        return [a for a in _POOL.values() if a.user_id == user_id and a.status == PENDING]


def expires_in(a: Approval) -> int:
    return max(0, int(a.expires - _now()))


def cancel(a: Approval, reason: str = "cancelled") -> bool:
    with _LOCK:
        if a.status not in (PENDING, APPROVED):
            return False
        a.status, a.reason, a.decided = CANCELLED, reason, _now()
        return True


def note_challenge(a: Approval, challenge_id: str, number: int) -> None:
    with _LOCK:
        for k in list(a.challenges)[: max(0, len(a.challenges) - 4)]:  # a few live picks at most
            a.challenges.pop(k, None)
        a.challenges[challenge_id] = number


def take_challenge(a: Approval, challenge_id: Any) -> int | None:
    """The number a phone-key challenge of this request was issued for (spent: a challenge approves once). None: not this request's."""
    if not isinstance(challenge_id, str):
        return None
    with _LOCK:
        return a.challenges.pop(challenge_id, None)


def deny(a: Approval, reason: str) -> bool:
    """"Not me" or a wrong number: the request is denied and the user's new requests wait DENY_COOLDOWN_S."""
    with _LOCK:
        if a.status != PENDING:
            return False
        now = _now()
        a.status, a.reason, a.decided = DENIED, reason, now
        _COOLDOWN[a.user_id] = now + DENY_COOLDOWN_S
        return True


def approve(a: Approval, key_id: str) -> bool:
    with _LOCK:
        now = _now()
        if a.status != PENDING or a.expires <= now:
            return False
        a.status, a.reason, a.decided, a.key_id = APPROVED, None, now, key_id
        return True


def spend(approval_id: Any, user_id: str, session: str | None, action: str | None) -> Approval | None:
    """The requester spends an APPROVED request for `action` (single use, within USE_WINDOW_S of the approval). None: refused - an
    unknown / other user / other session / other action / not approved / already used / too old request (one answer for all)."""
    a = of_requester(approval_id, user_id, session)
    if a is None:
        return None
    with _LOCK:
        now = _now()
        if a.status != APPROVED or a.decided is None or not (0.0 <= now - a.decided <= USE_WINDOW_S) or a.action != (action or ""):
            return None
        a.status, a.reason = USED, None
        return a


def reset_for_tests() -> None:
    with _LOCK:
        _POOL.clear()
        _COOLDOWN.clear()


from ..test_reset import register_reset  # noqa: E402 - imports nothing from the package

register_reset(__name__, ("_POOL", "_COOLDOWN"), reset_for_tests)
