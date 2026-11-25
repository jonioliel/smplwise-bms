"""MFA-RESET-HARDENING-2510 (second-factor train slice 10; owner decision Q53 of 2026-11-22, NOT the recommendation: an administrator may
reset another user's authentication methods from ANY channel, with the administrator's own approval). The rules around
`DELETE auth/second-factor/users/{user_id}` (routers/second_factor.admin_reset) and its preflight
`GET auth/second-factor/users/{user_id}/reset-check`:

* **once-action** - the administrator's own fresh proof on EVERY call, exactly as before this slice (services/step_up.once_proof:
  the own current code in the request, or a once-proof of `auth/step-up/verify {action: auth.second_factor.reset}`; nothing for an
  administrator who has no method). Unchanged whatever `security.step_up` says (owner answers 24.11: the reset always asked).
* **typed confirmation** - the request carries `confirm` = the target's username (compared without case and surrounding blanks,
  Unicode NFC); a missing or different value is refused before the proof is read (422 `factor_reset_confirm_required` /
  `factor_reset_confirm_mismatch`, audited). An account with no username types its user id.
* **channel** - `security.factor_reset_channel` = `any` (default, owner Q53) | `local` (only through the local channel, Ingress):
  a remote request under `local` is refused (403 `factor_reset_local_only`, audited). Only a system administrator changes the
  setting, and widening it back to `any` happens on the local channel only (routers/settings_patch/identity.factor_reset_channel).
* **rate limit** - at most `RATE_MAX` (3) resets per administrator per `RATE_WINDOW_S` (one hour), counted from the administrator's
  own allowed `auth.second_factor.reset` audit rows (durable: a restart hands no fresh budget); the fourth is refused
  (429 `factor_reset_rate_limited`, audited) before the proof is read.
* **never oneself** - the caller's own factor goes through `disable` with a current code (409 `second_factor_self_reset`, audited).
* **last administrator** - see `last_admin_blocks`.
* **after the reset** (the route): every factor kind removed (SR-2), the target's step-up proofs, every sign-in (HA, Arx-only, phone
  app) and every device credential (device token + push registration: the administrator's "sign out everywhere",
  presence.end_on_sign_out(everywhere=True)) end; the user is told (`security.second_factor_reset`) and so are the managers
  (`security.second_factor_reset_by_admin`, content-free); `must_enroll` is set (below).

`must_enroll` (table `auth_factor_resets`, migration 0224): set by an administrator's reset, cleared by the user's next enrolment of
any factor (the code, a passkey, a phone key - `enrolled`). While it is set and the user has no factor:

* a NEW remote sign-in of a Home Assistant user whose factor policy requires a factor goes to enrolment (403
  `second_factor_enrollment_required` with `details.must_enroll = true`) - Home Assistant's own MFA (the `ha_mfa` path of the
  enforced sign-in policy, MFA-POLICY-2490) no longer satisfies it until an Arx factor is enrolled again;
* an Arx-only identity already goes to its enrolment gate when the policy requires a factor (local_identity, unchanged);
* the user's own `GET auth/second-factor` answers `must_enroll` (and `must_enroll_enforced` when the policy requires it) for the
  account screen.

Owner Q14 stays: a sign-in with a RECOVERY code never sets this flag (only an administrator's reset does)."""
from __future__ import annotations

import datetime as dt
import sqlite3
import unicodedata
from typing import Any

CHANNEL_KEY = "security.factor_reset_channel"
CHANNEL_ANY = "any"
CHANNEL_LOCAL = "local"
CHANNELS = (CHANNEL_ANY, CHANNEL_LOCAL)
DEFAULT_CHANNEL = CHANNEL_ANY  # owner Q53 (2026-11-22): from anywhere - the design's recommendation was `local`
RATE_MAX = 3
RATE_WINDOW_S = 3600
ACTION = "auth.second_factor.reset"

LOCAL_ONLY_HE = "איפוס דרכי אימות של משתמש אחר מותר רק מהרשת המקומית (לפי ההגדרה ״איפוס דרכי אימות״)."
CONFIRM_REQUIRED_HE = "כדי לאשר את האיפוס יש להקליד את שם המשתמש של החשבון."
CONFIRM_MISMATCH_HE = "שם המשתמש שהוקלד אינו תואם לחשבון. האיפוס לא בוצע."
RATE_LIMITED_HE = "אפשר לאפס דרכי אימות לשלושה משתמשים לכל היותר בשעה. נסה שוב מאוחר יותר."
LAST_ADMIN_HE = ("זה מנהל המערכת האחרון שיכול להיכנס מרחוק: אחרי האיפוס הוא יצטרך להפעיל אימות מחדש ואף מנהל לא יוכל להיכנס מרחוק. "
                 "הוסף קודם דרך אימות למנהל מערכת אחר, או בצע את הפעולה מהרשת המקומית אחרי שינוי מדיניות האימות.")
UNKNOWN_HE = "המשתמש לא נמצא בספריית המערכת."


# ---------------------------------------------------------------- the channel setting

def channel(conn: sqlite3.Connection) -> str:
    from ..db import get_setting

    value = get_setting(conn, CHANNEL_KEY, DEFAULT_CHANNEL) or DEFAULT_CHANNEL
    return value if value in CHANNELS else DEFAULT_CHANNEL


def reauth_refuses(request: Any) -> bool:
    """MFA-FACTOR-HARDEN-2520 (review MFA-REVIEW-2520 N-5, owner-approved): resetting another user's authentication methods from
    outside needs a sign-in of the administrator's own session within 5 minutes - the rule a first factor has (MFA-SECFIX-2500 SR-3,
    `step_up.recent_sign_in`; a re-sign-in, not a code prompt). It comes on top of the administrator's once-proof (which an
    administrator with no factor of their own cannot give), so a stolen old administrator session resets nobody. The local channel
    always passes (the break-glass path)."""
    from . import step_up

    return not step_up.recent_sign_in(request)


def channel_refuses(conn: sqlite3.Connection, request: Any) -> bool:
    """True when the setting allows the reset on the local channel only and this request came from outside."""
    if channel(conn) != CHANNEL_LOCAL:
        return False
    from ..remote_channel import is_remote

    return bool(is_remote(request))


# ---------------------------------------------------------------- the typed confirmation

def confirm_text(conn: sqlite3.Connection, user_id: str) -> str | None:
    """What the administrator types to confirm: the target's username (the directory's, else the Home Assistant user list's), or the
    user id when the account has none. None: no such user."""
    row = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
    name = (row["username"] or "").strip() if row is not None else ""
    if not name:
        try:
            ha = conn.execute("SELECT username FROM ha_users WHERE id = ?", (user_id,)).fetchone()
        except sqlite3.OperationalError:
            ha = None
        if ha is not None:
            name = (ha["username"] or "").strip()
        elif row is None:
            return None
    return name or user_id


def _norm(text: str) -> str:
    return unicodedata.normalize("NFC", text).strip().casefold()


def confirm_matches(expected: str, typed: str | None) -> bool:
    return bool(typed) and _norm(str(typed)) == _norm(expected)


# ---------------------------------------------------------------- the rate limit (3 per administrator per hour)

def _cutoff(now: dt.datetime | None = None) -> str:
    at = (now or dt.datetime.now(dt.timezone.utc)) - dt.timedelta(seconds=RATE_WINDOW_S)
    return at.replace(microsecond=0).isoformat().replace("+00:00", "Z")  # the format of db.now_iso (audit_log.at)


def resets_in_window(conn: sqlite3.Connection, admin_id: str) -> int:
    """How many resets this administrator made in the last hour: the allowed `auth.second_factor.reset` audit rows (index
    idx_audit_action_at). Durable across a restart, exact, and the rows already exist."""
    return int(conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = ? AND decision = 'allowed' AND actor_user_id = ? AND at > ?",
                            (ACTION, admin_id, _cutoff())).fetchone()[0])


def resets_left(conn: sqlite3.Connection, admin_id: str) -> int:
    return max(RATE_MAX - resets_in_window(conn, admin_id), 0)


# ---------------------------------------------------------------- must_enroll

def must_enroll_flag(conn: sqlite3.Connection, user_id: str) -> bool:
    try:
        row = conn.execute("SELECT must_enroll FROM auth_factor_resets WHERE user_id = ?", (user_id,)).fetchone()
    except sqlite3.OperationalError:  # before migration 0224
        return False
    return bool(row and row["must_enroll"])


def must_enroll(conn: sqlite3.Connection, user_id: str) -> bool:
    """The flag is set (an administrator reset the user's factors) AND the user has no factor yet (belt and braces: a factor made
    by a path that did not clear the flag ends it too)."""
    if not must_enroll_flag(conn, user_id):
        return False
    from . import step_up

    return not step_up.methods_of(conn, user_id)


def must_enroll_users(conn: sqlite3.Connection) -> list[str]:
    try:
        ids = [r["user_id"] for r in conn.execute("SELECT user_id FROM auth_factor_resets WHERE must_enroll = 1 ORDER BY user_id").fetchall()]
    except sqlite3.OperationalError:
        return []
    return [u for u in ids if must_enroll(conn, u)]


def mark_must_enroll(conn: sqlite3.Connection, user_id: str, *, by: str) -> None:
    from ..db import now_iso

    conn.execute("INSERT INTO auth_factor_resets(user_id, reset_at, reset_by, must_enroll) VALUES (?, ?, ?, 1) "
                 "ON CONFLICT(user_id) DO UPDATE SET reset_at = excluded.reset_at, reset_by = excluded.reset_by, must_enroll = 1",
                 (user_id, now_iso(), by))


def enrolled(conn: sqlite3.Connection, user_id: str) -> None:
    """The user enrolled a factor (the code confirmed, a passkey or a phone key registered): the flag ends. Never raises."""
    try:
        conn.execute("UPDATE auth_factor_resets SET must_enroll = 0 WHERE user_id = ? AND must_enroll = 1", (user_id,))
    except sqlite3.OperationalError:
        pass


def enforced(conn: sqlite3.Connection, user_id: str) -> bool:
    """must_enroll AND the user's factor policy requires a factor: the next remote sign-in goes to enrolment."""
    if not must_enroll(conn, user_id):
        return False
    from ..rbac import Principal
    from . import second_factor as sf
    from .ha_user_auth import ADMIN_PERMISSIONS

    return sf.effective_policy(conn, Principal(user_id=user_id, username="", display_name="", source="internal"), ADMIN_PERMISSIONS)[0] == "required"


# ---------------------------------------------------------------- the last administrator

def _internal(user_id: str) -> Any:
    from ..rbac import Principal

    return Principal(user_id=user_id, username="", display_name="", source="internal")


def sign_in_factor(conn: sqlite3.Connection, user_id: str) -> bool:
    """MFA-REVIEW-DOCS-2520 (finding N-3): does the user hold a factor that answers a NEW remote sign-in - not merely a step-up method?
    A Home Assistant user: the authenticator code (a recovery code rides on it) or an active phone key (owner Q51; ha_user_auth
    .second_factor_need). An Arx-only identity: the code or a usable passkey (local_identity.has_factor - its passkey sign-in step).
    A Home Assistant user's passkey is a step-up method only (step_up.methods_of): it never answers the remote sign-in, so under a
    policy that requires a factor such a user goes to enrolment and cannot sign in from outside."""
    from . import device_keys, local_passkeys, user_passkeys
    from . import second_factor as sf

    if user_passkeys.is_local_user(conn, user_id):
        return local_passkeys.has_factor(conn, user_id)
    return sf.is_enrolled(conn, user_id) or device_keys.has_active(conn, user_id)


def signs_in_remotely(conn: sqlite3.Connection, user_id: str, *, remote_on: bool, after_reset: bool = False) -> bool:
    """Could this user complete a NEW remote sign-in (as far as Arx decides it, without asking Home Assistant)? The remote channel is on,
    the user is active and not a wall-only user, the remote policy admits them, and the second factor does not stop them: they hold a
    sign-in factor (`sign_in_factor` - a Home Assistant user's passkey is not one), or their policy does not require one, or (the
    enforced sign-in policy's `ha_mfa` path) Home Assistant's own MFA was seen for them and no `must_enroll` is pending. `after_reset`:
    as if every factor of the user were gone and `must_enroll` set."""
    if not remote_on:
        return False
    from . import active_users, mfa_provenance
    from . import ha_user_auth as hua
    from . import second_factor as sf
    from . import wall

    if active_users.is_disabled(conn, user_id) or wall.remote_refusal_needed(conn, user_id):
        return False
    if hua.remote_basis(conn, user_id) is None:
        return False
    if not after_reset and sign_in_factor(conn, user_id):
        return True
    value, source = sf.effective_policy(conn, _internal(user_id), hua.ADMIN_PERMISSIONS)
    if value != "required":
        return True
    if source == "policy" and not after_reset and not must_enroll(conn, user_id):
        return mfa_provenance.seen(conn, user_id) is not None
    return False


def system_admins(conn: sqlite3.Connection) -> list[str]:
    from ..rbac import is_system_admin

    return [r["id"] for r in conn.execute("SELECT id FROM users WHERE active = 1 AND deleted_at IS NULL ORDER BY id").fetchall()
            if is_system_admin(conn, r["id"])]


def last_admin_blocks(conn: sqlite3.Connection, target: str, *, remote_on: bool) -> bool:
    """The last-administrator rule, precisely: the reset is refused when ALL of these hold -

    1. the target is a system administrator (rbac.is_system_admin: an active installation-wide `system_admin` allow-binding);
    2. the target can sign in remotely NOW (`signs_in_remotely`);
    3. after the reset the target could NOT (their factor policy requires a factor, so the next remote sign-in goes to enrolment);
    4. no OTHER active system administrator can sign in remotely now (the caller counts when they are one).

    So a reset never leaves the installation without an administrator who can sign in from outside, unless that was already the
    case before it (then the reset changes nothing remote). The local channel (Ingress) stays the break-glass path either way."""
    from ..rbac import is_system_admin

    if not is_system_admin(conn, target):
        return False
    if not signs_in_remotely(conn, target, remote_on=remote_on):
        return False
    if signs_in_remotely(conn, target, remote_on=remote_on, after_reset=True):
        return False
    return not any(signs_in_remotely(conn, uid, remote_on=remote_on) for uid in system_admins(conn) if uid != target)


def remote_on(request: Any) -> bool:
    settings = getattr(getattr(getattr(request, "app", None), "state", None), "settings", None)
    return bool(getattr(settings, "remote_access", False))


# ---------------------------------------------------------------- the preflight (for the screens)

def check(conn: sqlite3.Connection, request: Any, principal: Any, target: str) -> dict[str, Any]:
    """`GET auth/second-factor/users/{user_id}/reset-check`: everything the reset dialog needs BEFORE the administrator confirms -
    whether the reset may go ahead now and, if not, the first refusal it would meet (the route checks in the same order); the text to
    type; the channel setting and this request's channel; the resets left this hour; what would be removed; whether the user would
    have to enrol again at their next remote sign-in; the once-action details for the step-up dialog. Reads only; nothing is spent."""
    from ..remote_channel import is_remote
    from . import step_up
    from . import second_factor as sf

    text = confirm_text(conn, target)
    left = resets_left(conn, principal.user_id)
    remote = bool(is_remote(request))
    reason: str | None = None
    if target == principal.user_id:
        reason = "self"
    elif text is None:
        reason = "user_unknown"
    elif channel_refuses(conn, request):
        reason = "local_only"
    elif reauth_refuses(request):
        reason = "reauth"
    elif last_admin_blocks(conn, target, remote_on=remote_on(request)):
        reason = "last_admin"
    elif left <= 0:
        reason = "rate_limited"
    factors = {"totp": sf.is_enrolled(conn, target), "passkeys": _count(conn, "SELECT COUNT(*) FROM auth_webauthn_credentials WHERE user_id = ?", target),
               "device_keys": _count(conn, "SELECT COUNT(*) FROM auth_device_keys WHERE user_id = ? AND revoked_at IS NULL", target),
               "recovery_codes": _count(conn, "SELECT COUNT(*) FROM auth_recovery_codes WHERE user_id = ? AND used_at IS NULL", target)}
    policy_required = sf.effective_policy(conn, _internal(target), _admin_permissions())[0] == "required" if text is not None else False
    return {"user_id": target, "allowed": reason is None, "reason": reason, "confirm_text": text or "", "channel": channel(conn),
            "remote": remote, "resets_left": left, "rate_max": RATE_MAX, "factors": factors, "must_enroll_after": policy_required,
            "step_up": step_up.once_details(conn, principal, ACTION)}


def _admin_permissions() -> frozenset[str]:
    from .ha_user_auth import ADMIN_PERMISSIONS

    return ADMIN_PERMISSIONS


def _count(conn: sqlite3.Connection, sql: str, user_id: str) -> int:
    try:
        return int(conn.execute(sql, (user_id,)).fetchone()[0])
    except sqlite3.OperationalError:
        return 0
