"""APPREFRESH-295 slice 1 (docs/changes/CR-APPREFRESH295.md): the phone app's persistent sign-in - rotating, single-use APP REFRESH
TOKENS with reuse detection, and the short-lived ACCESS TOKENS a refresh hands out. Backend only, behind `security.app_refresh`
(default `off`: no route mints or accepts anything, the public routes answer 404 as if absent).

- A FAMILY is one sign-in of one phone install (migration 0146): it is minted by a signed-in session for a device registration of
  the SAME user (CR-027 `mobile_devices`) and the install_id that registration holds, and it remembers the sign-in it came from
  (the anchor: the hashed HA refresh-token id, or the hashed Arx-only chain). One live family per device.
- A refresh token (`arxr_` + 256 random bits) is SINGLE USE. A refresh presents it with the device id and the install id; the
  server marks it used and returns a new one (rotation) plus an access token (`arxa_`, minutes). Presenting a used token again is
  REUSE and revokes the whole family - except the retry grace: a token whose child was never used may be presented again for
  RETRY_GRACE_S (20) seconds (the answer to the first try was lost on the phone's network); the unused child is then superseded.
  Either way a thief and the phone cannot both keep refreshing: the loser's next refresh is a reuse and ends the family.
- A wrong device id / install id with a valid token is a theft signal: the family is revoked (binding_mismatch).
- Expiry: absolute and idle (`security.app_refresh_absolute_days` / `_idle_days`); a holder of an administrative permission
  (rbac.LOCAL_ADMIN_PERMISSIONS) is capped at `_admin_absolute_days` / `_admin_idle_hours` (the USR2 Q3 rule), also when the
  permission was gained after the family was minted.
- Revocation: the device deleted or re-registered, the device tokens ended (TFA2 factor change), the user disabled / deleted, the
  anchor sign-in revoked (sign out everywhere, an administrator's revoke, a local password change / reset, HA refusing the sign-in's
  token), the feature switched off, an explicit revoke by the user or an administrator (the lost-phone kill switch).
- Nothing here stores, logs, audits or returns token material except the one response that hands a new token to its owner: only
  SHA-256(token) is kept, audit rows carry family / device ids and reasons.
"""
from __future__ import annotations

import calendar
import datetime
import hashlib
import hmac
import logging
import secrets
import sqlite3
import time
from typing import Any

from ..audit import audit
from ..db import Database, get_setting, new_id, set_setting
from ..errors import ApiError
from ..rbac import LOCAL_ADMIN_PERMISSIONS, Principal, permissions_anywhere
from . import app_refresh_key as dk
from . import device_attestation as att

log =logging.getLogger("smplwise.app_refresh")

FEATURE_KEY = "security.app_refresh"
REFRESH_PREFIX = "arxr_"
ACCESS_PREFIX = "arxa_"
FAMILY_PREFIX = "arf_"

# The installation settings (owner decision 2026-10-23: the lifetimes are adjustable in the Settings, validated here): setting key ->
# (default, low, high); a stored value outside its range is clamped. The idle lifetime may never exceed the absolute one (refused on
# write; clamped on read). The administrator cap stays (USR2 Q3); the retry grace is a constant (owner decision: not a setting).
ABSOLUTE_KEY = "security.app_refresh_absolute_days"
IDLE_KEY = "security.app_refresh_idle_days"
ACCESS_KEY = "security.app_refresh_access_minutes"
POLICY: dict[str, tuple[int, int, int]] = {
    ABSOLUTE_KEY: (90, 1, 365),
    IDLE_KEY: (30, 1, 90),
    ACCESS_KEY: (10, 1, 60),
    "security.app_refresh_admin_absolute_days": (7, 1, 7),
    "security.app_refresh_admin_idle_hours": (24, 1, 72),
}
# APPREFRESH2-295 (the device-bound key, CR section 13): off = no new family binds a key | optional (default, the lab) = a family binds
# the key the app sends | required (before customers) = no family without a key: mint refuses, keyless families end. A family that HAS a
# key always needs a valid proof, whatever the mode (no downgrade by a setting).
DEVICE_KEY_KEY = "security.app_refresh_device_key"
DEVICE_KEY_MODES = ("off", "optional", "required")
DEVICE_KEY_DEFAULT = "optional"
# APPREFRESH3-295 (CR section 14): the wording of the notice the device's user receives when an administrator approves a device-key reset
# (owner: configurable in the Settings, not hard-coded). Plain text; the only placeholders are {device} (the device's name) and {until}
# (when the approval lapses, installation time zone). A PUT with null restores the default.
NOTICE_TITLE_KEY = "security.app_refresh_key_reset_notice_title"
NOTICE_BODY_KEY = "security.app_refresh_key_reset_notice_body"
NOTICE_DEFAULTS: dict[str, tuple[str, int]] = {
    NOTICE_TITLE_KEY: ("מפתח האבטחה של האפליקציה אופס", 80),
    NOTICE_BODY_KEY: ("מנהל המערכת אישר איפוס של מפתח האבטחה במכשיר {device}. יש להיכנס מחדש באפליקציה עד {until}. אם לא ביקשת זאת - פנה למנהל המערכת.", 180),
}
NOTICE_PLACEHOLDERS = ("{device}", "{until}")
# ATTEST232-295 (docs/changes/CR-ATTEST232.md): hardware attestation of the device key. off (default) = nothing is asked or recorded |
# log_only = a verdict is recorded and audited at every mint, nothing is ever refused | required = a mint is refused unless the key's
# attestation verified at or above the minimum level. Every value is editable in the Settings.
ATTEST_MODE_KEY = "security.app_refresh_attestation"
ATTEST_MODES = ("off", "log_only", "required")
ATTEST_MODE_DEFAULT = "off"
ATTEST_LEVEL_KEY = "security.app_refresh_attestation_min_level"  # software | tee | strongbox
ATTEST_LEVEL_DEFAULT = "tee"
ATTEST_ROOTS_KEY = "security.app_refresh_attestation_android_roots"  # PEM text of the trusted Android attestation roots; empty = none
ATTEST_SETTING_KEYS = (ATTEST_MODE_KEY, ATTEST_LEVEL_KEY, ATTEST_ROOTS_KEY)
SETTING_KEYS = (FEATURE_KEY, DEVICE_KEY_KEY, *POLICY, *NOTICE_DEFAULTS, *ATTEST_SETTING_KEYS)
# APPREFRESH3-295: an administrator-approved device-key reset lets the device's next mint bind a new key without the old key's proof, once,
# within this window (then the pin holds again). A constant, like the retry grace.
RESET_WINDOW_S = 24 * 3600
RESET_REASON_MIN, RESET_REASON_MAX = 3, 200
PIN_SCOPE_PREFIX = "dk:"  # app_refresh_nonces.family_id of a nonce issued for a pinned device that has no live keyed family
# Security review D-02 (2026-10-24): challenge nonces per (family, client /64) - burst 10, 30 per minute - so a third party who knows a
# device id can no longer empty the phone's bucket; plus a per-family ceiling well above an app's need that only catches storms.
RATE_CHALLENGE = (10, 30.0)
RATE_CHALLENGE_FAMILY = (60, 120.0)
RETRY_GRACE_S = 20  # a used token whose child is still unused may be presented again this long (a lost answer); owner decision: constant

FRESH_SIGN_IN_S = 15 * 60  # the remote channel mints a family only from a sign-in at most this old
RATE_ISSUE = (10, 10 / 60.0)  # families minted per user: burst 10, 10 per hour
RATE_REFRESH = (10, 30.0)  # refreshes per family: burst 10, 30 per minute
RATE_SETTINGS = (20, 20.0)
FAILURES_PER_MIN = 20  # unknown / malformed tokens per client key before 429
FAILURES_GLOBAL = 300
KEEP_ENDED_DAYS = 30  # ended families (and their token rows) stay this long for the audit trail

INVALID_HE = "הכניסה השמורה באפליקציה אינה תקפה. יש להיכנס מחדש."
EXPIRED_HE = "הכניסה השמורה באפליקציה פגה. יש להיכנס מחדש."
RATE_HE = "יותר מדי ניסיונות. נסו שוב בעוד דקה."
MISMATCH_HE = "המכשיר אינו תואם לרישום. יש לרשום את המכשיר מחדש."
FRESH_HE = "כדי לשמור כניסה באפליקציה יש להיכנס מחדש ממש עכשיו."
DEVICE_HE = "המכשיר לא נמצא."
NOT_FOUND_HE = "Not found"
KEY_HE = "מפתח המכשיר אינו תקין. יש לעדכן את האפליקציה ולהיכנס מחדש."
PROOF_RETRY_HE = "יש לחזור על הבקשה."
KEY_BOUND_HE = "המכשיר הזה רשום עם מפתח אבטחה אחר. אם המפתח אבד, בקשו ממנהל המערכת לאפס אותו."
ATTEST_HE = "לא ניתן לאמת שמפתח האבטחה נוצר בחומרה מאובטחת של המכשיר. יש לעדכן את האפליקציה ולהיכנס מחדש."
NO_KEY_HE ="למכשיר הזה אין מפתח אבטחה רשום."
REASON_HE = f"יש לכתוב סיבה ({RESET_REASON_MIN}-{RESET_REASON_MAX} תווים)."
SELF_RESET_HE = "איפוס מפתח של המכשיר שלך מאשרים רק מתוך הרשת המקומית."
NOTICE_INVALID_HE = "נוסח ההודעה: טקסט רגיל, עם {device} ו־{until} בלבד."


class Refused(ApiError):
    pass


def _now() -> float:
    """The clock (a seam: tests move it to age a family or a token)."""
    return time.time()


def iso(ts: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))


def epoch(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        return float(calendar.timegm(time.strptime(value, "%Y-%m-%dT%H:%M:%SZ")))
    except (ValueError, OverflowError):
        return 0.0


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8", "replace")).hexdigest()


def install_hash(install_id: str) -> str:
    return hashlib.sha256(("install:" + (install_id or "")).encode("utf-8", "replace")).hexdigest()


def _new(prefix: str) -> str:
    return prefix + secrets.token_urlsafe(32)


def is_refresh_token(token: Any) -> bool:
    return isinstance(token, str) and token.startswith(REFRESH_PREFIX) and 40 <= len(token) <= 80


def is_access_token(token: Any) -> bool:
    return isinstance(token, str) and token.startswith(ACCESS_PREFIX) and 40 <= len(token) <= 80


# ---------------------------------------------------------------- limits (in memory, per process)

from .presence import _Failures, take  # noqa: E402 - the CR-027 limiters (same semantics, own lanes / instances)

FAILURES = _Failures(FAILURES_PER_MIN)
FAILURES_ALL = _Failures(FAILURES_GLOBAL)


def reset_limits() -> None:
    from . import presence

    presence.reset_limits()
    FAILURES.hits.clear()
    FAILURES_ALL.hits.clear()


def failures_blocked(key: str) -> bool:
    return FAILURES.blocked(key) or FAILURES_ALL.blocked("all")


def client_blocked(key: str) -> bool:
    """The per-client tier only (security review F-07: a token of a LIVE family skips the global tier - its per-family bucket bounds it,
    so a storm of garbage from elsewhere never locks every phone out for a minute)."""
    return FAILURES.blocked(key)


def global_blocked() -> bool:
    return FAILURES_ALL.blocked("all")


def failed(key: str) -> None:
    FAILURES.fail(key)
    FAILURES_ALL.fail("all")


# ---------------------------------------------------------------- settings

def enabled(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, FEATURE_KEY, "off") or "off") == "on"


def enabled_db(db: Database) -> bool:
    try:
        with db.connection(mode="read", label="app_refresh.flag") as conn:
            return enabled(conn)
    except sqlite3.Error:
        return False


def policy(conn: sqlite3.Connection) -> dict[str, int]:
    out: dict[str, int] = {}
    for key, (default, lo, hi) in POLICY.items():
        try:
            v = int(get_setting(conn, key, str(default)) or default)
        except (TypeError, ValueError):
            v = default
        out[key] = max(lo, min(hi, v))
    out[IDLE_KEY] = min(out[IDLE_KEY], out[ABSOLUTE_KEY])  # never above the absolute lifetime (a hand-edited row)
    return out


def device_key_mode(conn: sqlite3.Connection) -> str:
    v = (get_setting(conn, DEVICE_KEY_KEY, DEVICE_KEY_DEFAULT) or DEVICE_KEY_DEFAULT).strip()
    return v if v in DEVICE_KEY_MODES else "required"  # a hand-edited unknown value fails closed


def mode_rank(mode: str) -> int:
    return DEVICE_KEY_MODES.index(mode) if mode in DEVICE_KEY_MODES else len(DEVICE_KEY_MODES)


def attest_mode(conn: sqlite3.Connection) -> str:
    v = (get_setting(conn, ATTEST_MODE_KEY, ATTEST_MODE_DEFAULT) or ATTEST_MODE_DEFAULT).strip()
    return v if v in ATTEST_MODES else "required"  # a hand-edited unknown value fails closed


def attest_mode_rank(mode: str) -> int:
    return ATTEST_MODES.index(mode) if mode in ATTEST_MODES else len(ATTEST_MODES)


def attest_min_level(conn: sqlite3.Connection) -> str:
    v = (get_setting(conn, ATTEST_LEVEL_KEY, ATTEST_LEVEL_DEFAULT) or ATTEST_LEVEL_DEFAULT).strip()
    return v if v in att.LEVELS else "strongbox"  # a hand-edited unknown value fails closed (the highest bar)


def attest_roots(conn: sqlite3.Connection) -> str:
    return (get_setting(conn, ATTEST_ROOTS_KEY, "") or "")[:att.MAX_ROOTS_PEM]


def clean_roots(value: Any) -> str | None:
    """PEM trust roots as stored: only the certificate blocks, one per paragraph. '' (none) is valid. None = invalid."""
    if value is None or value == "":
        return ""
    if not isinstance(value, str) or len(value) > att.MAX_ROOTS_PEM:
        return None
    try:
        certs = att.parse_roots(value)
    except ValueError:
        return None
    from cryptography.hazmat.primitives import serialization
    return "".join(c.public_bytes(serialization.Encoding.PEM).decode("ascii") for c in certs)


def clean_notice(value: Any, max_len: int) -> str | None:
    """A notice template as stored: whitespace folded, 1..max_len characters, no braces except the two placeholders. None = invalid."""
    if not isinstance(value, str):
        return None
    text = " ".join(value.split())
    if not 1 <= len(text) <= max_len:
        return None
    rest = text
    for p in NOTICE_PLACEHOLDERS:
        rest = rest.replace(p, "")
    return None if ("{" in rest or "}" in rest) else text


def notice_template(conn: sqlite3.Connection, key: str) -> str:
    default, max_len = NOTICE_DEFAULTS[key]
    return clean_notice(get_setting(conn, key, default), max_len) or default  # a hand-edited bad row falls back to the default


def render_notice(template: str, device: str, until: str) -> str:
    """Plain substitution (never str.format: a device name with braces stays text)."""
    return template.replace("{device}", device).replace("{until}", until)


def settings_out(conn: sqlite3.Connection) -> dict[str, Any]:
    return {FEATURE_KEY: "on" if enabled(conn) else "off", DEVICE_KEY_KEY: device_key_mode(conn), **policy(conn),
            ATTEST_MODE_KEY: attest_mode(conn), ATTEST_LEVEL_KEY: attest_min_level(conn), ATTEST_ROOTS_KEY: attest_roots(conn),
            **{k: notice_template(conn, k) for k in NOTICE_DEFAULTS}}


def update_settings(conn: sqlite3.Connection, body: dict[str, Any], actor: Principal, *, channel: str, request_id: str | None) -> tuple[dict[str, Any], dict[str, Any], int]:
    """Validate and store a partial update. Returns (settings, changes, families ended). The caller checked the authority (a system
    administrator) and the channel rule (ON from the local channel only). Switching OFF revokes every family."""
    changes: dict[str, Any] = {}
    for key, value in body.items():
        if key == FEATURE_KEY:
            if value not in ("on", "off"):
                raise ApiError(422, "validation", "ערך לא תקין.", details={"field": key})
            if value != ("on" if enabled(conn) else "off"):
                changes[key] = value
        elif key == DEVICE_KEY_KEY:
            if value not in DEVICE_KEY_MODES:
                raise ApiError(422, "validation", "ערך לא תקין.", details={"field": key, "allowed": list(DEVICE_KEY_MODES)})
            if value != device_key_mode(conn):
                changes[key] = value
        elif key == ATTEST_MODE_KEY:
            if value not in ATTEST_MODES:
                raise ApiError(422, "validation", "ערך לא תקין.", details={"field": key, "allowed": list(ATTEST_MODES)})
            if value != attest_mode(conn):
                changes[key] = value
        elif key == ATTEST_LEVEL_KEY:
            if value not in att.LEVELS:
                raise ApiError(422, "validation", "ערך לא תקין.", details={"field": key, "allowed": list(att.LEVELS)})
            if value != attest_min_level(conn):
                changes[key] = value
        elif key == ATTEST_ROOTS_KEY:
            pem = clean_roots(value)
            if pem is None:
                raise ApiError(422, "validation", "תעודות האמון אינן תקינות.", details={"field": key, "max": att.MAX_ROOTS_PEM})
            if pem != attest_roots(conn):
                changes[key] = pem
        elif key in NOTICE_DEFAULTS:
            default, max_len = NOTICE_DEFAULTS[key]
            text = default if value is None else clean_notice(value, max_len)
            if text is None:
                raise ApiError(422, "validation", NOTICE_INVALID_HE, details={"field": key, "max": max_len, "placeholders": list(NOTICE_PLACEHOLDERS)})
            if text != notice_template(conn, key):
                changes[key] = text
        elif key in POLICY:
            _, lo, hi = POLICY[key]
            if isinstance(value, bool) or not isinstance(value, int) or not lo <= value <= hi:
                raise ApiError(422, "validation", f"ערך בין {lo} ל־{hi}.", details={"field": key})
            changes[key] = value
        else:
            raise ApiError(422, "validation", "הגדרה לא מוכרת.", details={"field": str(key)[:80]})
    merged = {**policy(conn), **{k: v for k, v in changes.items() if k in POLICY}}
    if merged[IDLE_KEY] > merged[ABSOLUTE_KEY]:
        raise ApiError(422, "validation", "משך חוסר הפעילות לא יכול לעלות על משך החיים המרבי.", details={"field": IDLE_KEY, "max": merged[ABSOLUTE_KEY]})
    ended = 0
    for key, value in changes.items():
        set_setting(conn, key, str(value))
    if changes.get(FEATURE_KEY) == "off":
        ended = revoke_all(conn, "feature_off", actor=actor, request_id=request_id)
    elif changes.get(DEVICE_KEY_KEY) == "required":  # no family without a key from now on: the keyless ones end at once
        ended = _revoke(conn, "device_key_fp IS NULL", (), "device_key_required", actor=actor, request_id=request_id, subject="*")
    if changes.get(ATTEST_MODE_KEY) == "required" and changes.get(FEATURE_KEY) != "off":
        # no sign-in without a verified attestation of its own key from now on: the others end at once (like device_key `required`)
        ended += _revoke(conn, "NOT EXISTS (SELECT 1 FROM app_refresh_attestations a WHERE a.device_id = app_refresh_families.device_id "
                               "AND a.status = 'verified' AND a.key_fp = app_refresh_families.device_key_fp)", (), "attestation_required",
                         actor=actor, request_id=request_id, subject="*")
    if FEATURE_KEY in changes:
        audit(conn, actor=actor, action="auth.app_refresh.feature_enabled" if changes[FEATURE_KEY] == "on" else "auth.app_refresh.feature_disabled",
              decision="allowed", resource_type="installation", resource_id="app_refresh", request_id=request_id,
              details={"channel": channel, **({"families_ended": ended} if ended else {})})
    if changes:
        audit(conn, actor=actor, action="auth.app_refresh.settings", decision="allowed", resource_type="installation", resource_id="app_refresh",
              request_id=request_id, details=changes)
    return settings_out(conn), changes, ended


# ---------------------------------------------------------------- helpers

def _holds_admin(conn: sqlite3.Connection, user_id: str) -> bool:
    perms = permissions_anywhere(conn, Principal(user_id=user_id, username="", display_name="", source="internal"))
    return bool(set(perms) & LOCAL_ADMIN_PERMISSIONS)


def _caps(conn: sqlite3.Connection, admin: bool) -> tuple[float, float]:
    """(absolute seconds, idle seconds) for a family of an administrator or not."""
    p = policy(conn)
    if admin:
        return p["security.app_refresh_admin_absolute_days"] * 86400.0, p["security.app_refresh_admin_idle_hours"] * 3600.0
    return p["security.app_refresh_absolute_days"] * 86400.0, p["security.app_refresh_idle_days"] * 86400.0


def _user_refusal(conn: sqlite3.Connection, user_id: str) -> str | None:
    """Why this user may no longer hold a family: inactive / deleted in Arx, or disabled in the Home Assistant directory."""
    u = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if u is None or not u["active"]:
        return "user_inactive"
    if "deleted_at" in u.keys() and u["deleted_at"]:
        return "user_deleted"
    try:
        ha = conn.execute("SELECT is_active FROM ha_users WHERE id = ?", (user_id,)).fetchone()
    except sqlite3.OperationalError:
        ha = None
    if ha is not None and not ha["is_active"]:
        return "user_inactive"
    return None


def _remote_refusal(conn: sqlite3.Connection, user_id: str) -> str | None:
    """Security review F-01: the remote-access policy, as the remote channel applies it to a sign-in (ha_user_auth.policy_refusal without
    the HA user object): a wall user never travels; under the policy an HA user needs the per-user flag, the administrator default or
    (any_role) a binding. An Arx-only identity signs in on the remote channel by design (no flag). The administrators' MFA rule needs the
    HA user's factor, which only a live HA sign-in knows: it is checked at the session exchange (slice 2), recorded in the CR."""
    from ..rbac import LOCAL_ID_PREFIX
    from . import ha_user_auth as hua
    from . import wall as wall_service

    if wall_service.remote_refusal_needed(conn, user_id):
        return "wall_user_remote_not_allowed"
    if str(user_id).startswith(LOCAL_ID_PREFIX):
        return None
    if hua.remote_basis(conn, user_id) is None:
        return "remote_not_allowed"
    return None


def _refusal(conn: sqlite3.Connection, user_id: str) -> str | None:
    return _user_refusal(conn, user_id) or _remote_refusal(conn, user_id)


def _anchor_revoked(conn: sqlite3.Connection, fam: sqlite3.Row) -> bool:
    if fam["anchor_kind"] not in ANCHOR_KINDS or not fam["anchor_hash"]:
        return True  # REL2140 M-4: a family with no anchor (minted by 2.14.0 before this fix) is never refreshed again
    if fam["anchor_kind"] != "ha":
        return False
    if fam["anchor_hash"].startswith(SESSION_ANCHOR_PREFIX):  # REL2140 M-4: the sign-in lives only in this process - gone = ended
        from . import ha_user_auth as hua

        return not any(session_anchor(s.sign_in()) == fam["anchor_hash"] for s in hua.STORE.sessions_of(user_id=fam["user_id"]))
    try:
        return conn.execute("SELECT 1 FROM remote_revoked_chains WHERE iss_hash = ?", (fam["anchor_hash"],)).fetchone() is not None
    except sqlite3.OperationalError:
        return False


def _family_out(r: sqlite3.Row, device_name: str | None = None) -> dict[str, Any]:
    return {"family_id": r["family_id"], "device_id": r["device_id"], "device_name": device_name, "platform": r["platform"], "channel": r["channel"],
            "created_at": r["created_at"], "last_used_at": r["last_used_at"], "idle_expires_at": r["idle_expires_at"],
            "absolute_expires_at": r["absolute_expires_at"], "admin_capped": bool(r["admin_capped"]), "device_key_bound": bool(r["device_key_fp"])}


def _mint_pair(conn: sqlite3.Connection, fam_id: str, user_id: str, device_id: str, generation: int, parent: str | None, now: float) -> tuple[str, str, float]:
    """A new refresh token of `generation` (child of `parent`) and a new access token. Returns (refresh, access, access expiry)."""
    refresh = _new(REFRESH_PREFIX)
    access = _new(ACCESS_PREFIX)
    rh = token_hash(refresh)
    conn.execute("INSERT INTO app_refresh_tokens(token_hash, family_id, generation, parent_hash, state, issued_at) VALUES (?,?,?,?, 'live', ?)",
                 (rh, fam_id, generation, parent, iso(now)))
    if parent is not None:
        conn.execute("UPDATE app_refresh_tokens SET child_hash = ? WHERE token_hash = ?", (rh, parent))
    access_exp = now + policy(conn)["security.app_refresh_access_minutes"] * 60.0
    conn.execute("DELETE FROM app_access_tokens WHERE family_id = ? AND expires_at <= ?", (fam_id, iso(now)))
    conn.execute("INSERT INTO app_access_tokens(token_hash, family_id, user_id, device_id, issued_at, expires_at) VALUES (?,?,?,?,?,?)",
                 (token_hash(access), fam_id, user_id, device_id, iso(now), iso(access_exp)))
    return refresh, access, access_exp


def _answer(fam: sqlite3.Row, refresh: str, access: str, access_exp: float, idle_exp: float) -> dict[str, Any]:
    return {"family_id": fam["family_id"], "token_type": "Bearer", "refresh_token": refresh, "refresh_expires_at": iso(idle_exp),
            "absolute_expires_at": fam["absolute_expires_at"], "access_token": access, "access_expires_at": iso(access_exp),
            "expires_in": max(0, int(access_exp - _now())),
            # APPREFRESH2: whether this family's refreshes must carry a device-key proof (true once a key is bound, for its whole life)
            "device_key": {"bound": True, "alg": dk.ALG} if fam["device_key_fp"] else {"bound": False},
            "proof_required": bool(fam["device_key_fp"])}


# ---------------------------------------------------------------- the device-bound key (APPREFRESH2-295)

def _mint_key(conn: sqlite3.Connection, principal: Principal, device_id: str, device_key: dict[str, Any] | None, request_id: str | None) -> tuple[str, str] | None:
    """The key a new family binds: (SPKI DER base64url, fingerprint hex) or None (no key: mode off, or optional without one). Every
    refusal is audited with the reason only (never the key, the signature or a full fingerprint) and raises 422 / 409.

    Security review D-01 (b), widened by APPREFRESH3-295: while the device has a PINNED key (the last key it bound - kept beyond the family
    that bound it, so re-registering the device, the app's sign-out or any "end this sign-in" no longer forgets it), a mint that would
    leave it without that key (another key, no key, or mode `off`) must carry `device_key.replaces`, a proof by the OLD key
    (`_check_replace`), or the device must hold a pending administrator-approved reset (`approve_key_reset`, the lost-key path: consumed
    here, once); otherwise `409 device_key_bound` and nothing ends."""
    mode = device_key_mode(conn)

    def deny(status: int, code: str, reason: str) -> Refused:
        audit(conn, actor=principal, action="auth.app_refresh.issue", decision="denied", resource_type="mobile_device", resource_id=device_id,
              reason=reason, request_id=request_id, details={"device_key_mode": mode})
        return Refused(status, code, KEY_HE)

    key: tuple[str, str] | None = None
    if mode != "off":  # under `off` nothing is bound; the answer says `bound: false`, the app keeps refreshing without a proof
        if device_key is None:
            if mode == "required":
                raise deny(422, "device_key_required", "device_key_required")
        else:
            text = device_key.get("public_key") or ""
            try:
                spki, fp = dk.parse_public_key(text)
            except dk.BadKey:
                raise deny(422, "device_key_invalid", "device_key_invalid") from None
            proof = device_key.get("proof") or {}
            ts = proof.get("ts")
            if not isinstance(ts, int) or isinstance(ts, bool) or not dk.verify(spki, str(proof.get("sig") or ""), dk.mint_message(device_id, ts, text)):
                raise deny(422, "device_key_proof_invalid", "proof_invalid")
            if abs(ts - _now()) > dk.POP_SKEW_S:
                raise deny(422, "device_key_proof_invalid", "proof_stale")
            other = conn.execute("SELECT 1 FROM app_refresh_families WHERE device_key_fp = ? AND revoked_at IS NULL AND device_id <> ?", (fp, device_id)).fetchone()
            if other is not None:  # one hardware key per phone: the same key on another device is a copy
                raise deny(409, "device_key_in_use", "device_key_in_use")
            key = (dk.b64u_encode(spki), fp)
    pin = pinned_key(conn, device_id)
    if pin is not None and (key is None or key[1] != pin["fp"]):
        new_fp = dk.fingerprint_prefix(key[1]) if key else None
        if _reset_pending(pin, _now()):
            # the lost-key path: an administrator approved this device's reset (audited, the user notified); spent by this mint, once
            _clear_reset(conn, device_id)
            audit(conn, actor=principal, action="auth.app_refresh.key_replaced", decision="allowed", resource_type="mobile_device", resource_id=device_id,
                  request_id=request_id, details={"family": pin["family_id"], "old_key_fp": dk.fingerprint_prefix(pin["fp"]), "new_key_fp": new_fp,
                                                  "device_key_mode": mode, "via": "admin_reset", "approved_by": pin["reset_by"]})
        else:
            _check_replace(conn, principal, device_id, pin, device_key, mode, request_id)
            audit(conn, actor=principal, action="auth.app_refresh.key_replaced", decision="allowed", resource_type="mobile_device", resource_id=device_id,
                  request_id=request_id, details={"family": pin["family_id"], "old_key_fp": dk.fingerprint_prefix(pin["fp"]), "new_key_fp": new_fp,
                                                  "device_key_mode": mode, "via": "old_key"})
    return key


# ---------------------------------------------------------------- hardware attestation (ATTEST232-295, migration 0176)

def attestation_status(conn: sqlite3.Connection, device_id: str) -> dict[str, Any]:
    """What an administrator (or the device's user) sees of the last verdict: never the chain, a 16-hex key prefix at most."""
    try:
        row = conn.execute("SELECT * FROM app_refresh_attestations WHERE device_id = ?", (device_id,)).fetchone()
    except sqlite3.OperationalError as exc:  # a database before migration 0176
        if _tables_missing(exc):
            row = None
        else:
            raise
    if row is None:
        return {"device_id": device_id, "checked": False}
    return {"device_id": device_id, "checked": True, "status": row["status"], "level": row["level"], "format": row["format"],
            "key_fp": dk.fingerprint_prefix(row["key_fp"]), "mode": row["mode"], "reason": row["reason"], "checked_at": row["checked_at"]}


def _attest(conn: sqlite3.Connection, principal: Principal, device_id: str, install_id: str, key: tuple[str, str] | None,
            device_key: dict[str, Any] | None, request_id: str | None) -> dict[str, Any] | None:
    """The attestation gate of a mint. Mode off: nothing happens (None). log_only: the verdict is stored and audited, the mint always goes
    on. required: the mint is refused (422, nothing ends) unless the key's attestation `verified` at or above the minimum level. A
    verifier that cannot judge (`unavailable`: no trust roots, no verifier installed) is NOT a pass in `required`."""
    mode = attest_mode(conn)
    if mode == "off":
        return None
    min_level = attest_min_level(conn)
    sent = (device_key or {}).get("attestation")
    fmt = sent.get("format") if isinstance(sent, dict) else None
    verdict: att.Verdict
    if key is None:
        verdict = att.Verdict(att.MISSING, reason="no_device_key")  # an attestation vouches for a key; no key bound, nothing to vouch for
    elif not isinstance(sent, dict):
        verdict = att.Verdict(att.MISSING, reason="not_sent")
    else:
        ctx = att.Context(device_id=device_id, install_id=install_id, key_spki=dk.b64u_decode(key[0], max_len=400),
                          challenge=att.challenge_for(device_id, install_id), trust_roots_pem=attest_roots(conn),
                          now=datetime.datetime.fromtimestamp(_now(), datetime.timezone.utc), settings={"min_level": min_level})
        verdict = att.check(fmt, sent.get("data"), ctx)
    passed = verdict.status == att.VERIFIED and att.level_rank(verdict.level) >= att.level_rank(min_level)
    reason = verdict.reason if verdict.status != att.VERIFIED else (None if passed else "level_too_low")
    conn.execute(
        """INSERT INTO app_refresh_attestations(device_id, user_id, status, level, format, key_fp, mode, reason, checked_at)
           VALUES (?,?,?,?,?,?,?,?,?)
           ON CONFLICT(device_id) DO UPDATE SET user_id = excluded.user_id, status = excluded.status, level = excluded.level, format = excluded.format,
               key_fp = excluded.key_fp, mode = excluded.mode, reason = excluded.reason, checked_at = excluded.checked_at""",
        (device_id, principal.user_id, verdict.status, verdict.level, fmt if fmt in att.FORMATS else None, key[1] if key else None, mode, reason,
         iso(_now())))
    refused = mode == "required" and not passed
    audit(conn, actor=principal, action="auth.app_refresh.attestation", decision="denied" if refused else "allowed", resource_type="mobile_device",
          resource_id=device_id, reason=reason, request_id=request_id,
          details={"mode": mode, "status": verdict.status, "level": verdict.level, "format": fmt if fmt in att.FORMATS else None,
                   "min_level": min_level, **({"key_fp": dk.fingerprint_prefix(key[1])} if key else {})})
    if refused:
        code = {att.MISSING: "attestation_required", att.UNAVAILABLE: "attestation_unavailable"}.get(verdict.status, "attestation_invalid")
        if verdict.status == att.VERIFIED:
            code = "attestation_level_too_low"
        raise Refused(422, code, ATTEST_HE)
    return {"mode": mode, "status": verdict.status, "level": verdict.level, "enforced": mode == "required"}


# ---------------------------------------------------------------- the device-key pin (APPREFRESH3-295, migration 0158)

def pin_scope(device_id: str) -> str:
    return PIN_SCOPE_PREFIX + device_id


def _pin_row(conn: sqlite3.Connection, device_id: str) -> sqlite3.Row | None:
    try:
        return conn.execute("SELECT * FROM app_refresh_device_keys WHERE device_id = ?", (device_id,)).fetchone()
    except sqlite3.OperationalError as exc:  # a database before migration 0158
        if _tables_missing(exc):
            return None
        raise


def pinned_key(conn: sqlite3.Connection, device_id: str) -> dict[str, Any] | None:
    """The key this device registration is pinned to - the stored pin, or (a row the backfill missed) the key of its live keyed family; the
    live family wins if they ever differ. None: the device never bound a key (a slice-1 app), or a reset to keyless was consented to.
    {spki (base64url SPKI DER), fp, family_id (the live keyed family or None), reset_expires_at, reset_by, stored}."""
    row = _pin_row(conn, device_id)
    fam = conn.execute("SELECT family_id, device_key_spki, device_key_fp FROM app_refresh_families WHERE device_id = ? AND revoked_at IS NULL"
                       " AND device_key_fp IS NOT NULL", (device_id,)).fetchone()
    if row is None and fam is None:
        return None
    if fam is not None and row is not None and fam["device_key_fp"] != row["device_key_fp"]:
        log.warning("device key pin of %s differs from its live family; the family's key is used", device_id)
    src = fam if fam is not None else row
    return {"spki": src["device_key_spki"], "fp": src["device_key_fp"], "family_id": fam["family_id"] if fam is not None else None,
            "reset_expires_at": row["reset_expires_at"] if row is not None else None, "reset_by": row["reset_by"] if row is not None else None,
            "reset_approved_at": row["reset_approved_at"] if row is not None else None, "stored": row is not None}


def _reset_pending(pin: dict[str, Any], now: float) -> bool:
    return bool(pin.get("reset_expires_at")) and epoch(pin["reset_expires_at"]) > now


def _clear_reset(conn: sqlite3.Connection, device_id: str) -> None:
    conn.execute("UPDATE app_refresh_device_keys SET reset_approved_at = NULL, reset_expires_at = NULL, reset_by = NULL, reset_reason = NULL"
                 " WHERE device_id = ?", (device_id,))


def _store_pin(conn: sqlite3.Connection, device_id: str, user_id: str, key: tuple[str, str] | None, now: float) -> None:
    """After a successful mint: pin the key it bound (a new key restarts bound_at; the same key only refreshes updated_at), or - a mint
    that bound no key, which reached here only with the old key's consent or a reset - drop the pin."""
    if key is None:
        conn.execute("DELETE FROM app_refresh_device_keys WHERE device_id = ?", (device_id,))
        return
    conn.execute(
        """INSERT INTO app_refresh_device_keys(device_id, user_id, device_key_spki, device_key_fp, device_key_alg, bound_at, updated_at)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(device_id) DO UPDATE SET user_id = excluded.user_id, device_key_spki = excluded.device_key_spki,
               bound_at = CASE WHEN app_refresh_device_keys.device_key_fp = excluded.device_key_fp THEN app_refresh_device_keys.bound_at ELSE excluded.bound_at END,
               device_key_fp = excluded.device_key_fp, device_key_alg = excluded.device_key_alg, updated_at = excluded.updated_at""",
        (device_id, user_id, key[0], key[1], dk.ALG, iso(now), iso(now)))


def key_status(conn: sqlite3.Connection, device_id: str) -> dict[str, Any]:
    """What an administrator (or the device's user) sees of the pin: never the key, a 16-hex fingerprint prefix at most."""
    pin = pinned_key(conn, device_id)
    now = _now()
    if pin is None:
        return {"device_id": device_id, "pinned": False, "reset_pending": False}
    row = _pin_row(conn, device_id)
    pending = _reset_pending(pin, now)
    return {"device_id": device_id, "pinned": True, "alg": dk.ALG, "key_fp": dk.fingerprint_prefix(pin["fp"]),
            "bound_at": row["bound_at"] if row is not None else None, "sign_in_live": pin["family_id"] is not None,
            "reset_pending": pending, "reset_expires_at": pin["reset_expires_at"] if pending else None,
            "reset_approved_at": pin["reset_approved_at"] if pending else None}


def _until_text(conn: sqlite3.Connection, ts: float) -> str:
    import datetime as _dt

    from .timeutil import zone

    tz = "Asia/Jerusalem"
    try:
        from ..routers.settings import read_settings

        tz = read_settings(conn).get("time.zone") or tz
    except Exception:  # noqa: BLE001 - the notice still goes out, in the default zone
        pass
    return _dt.datetime.fromtimestamp(ts, zone(tz)).strftime("%d/%m/%Y %H:%M")


def _notify_reset(conn: sqlite3.Connection, user_id: str, device_id: str, device_name: str, expires: float) -> bool:
    """The device's own user is told (in the inbox and the channels of the `security.app_device_key_reset` policy) in the wording the
    Settings hold. Never the administrator's name, the reason, or any key material. A failure never undoes the reset (logged)."""
    try:
        from . import notify

        until = _until_text(conn, expires)
        title = render_notice(notice_template(conn, NOTICE_TITLE_KEY), device_name, until)
        body = render_notice(notice_template(conn, NOTICE_BODY_KEY), device_name, until)
        res = notify.emit_full(conn, notify.Signal("security.app_device_key_reset", "session", user_id,
                                                   dedupe_key=f"security.app_device_key_reset:session:{user_id}:{notify.new_id()}",
                                                   params={"notice_title": title, "notice_body": body, "name": device_name},
                                                   initiator_user_id=user_id, link="#/system/notifications", origin={"kind": "app_device_key"}))
        return res.action in ("created", "folded", "renotified")
    except Exception:  # noqa: BLE001
        log.warning("device key reset notice failed", exc_info=True)
        return False


def approve_key_reset(conn: sqlite3.Connection, actor: Principal, device_id: str, reason: Any, *, channel: str, request_id: str | None) -> dict[str, Any]:
    """An administrator's explicit approval of a device-key reset - the lost-key path (the caller checked: a system administrator). The
    device's live sign-in ends (its key is no longer trusted), its open nonces are dropped, and for RESET_WINDOW_S the device's next mint
    (by its own user, from a fresh sign-in, as always) may bind a new key - or none - without the old key's proof, once. Audited
    (`auth.app_refresh.key_reset_approved`, the reason and a fingerprint prefix, never the key) and the user is notified. An administrator
    approves a reset of their OWN device only from the local channel (a stolen remote session cannot re-key its own phone)."""
    def deny(status: int, code: str, why: str, msg: str) -> Refused:
        audit(conn, actor=actor, action="auth.app_refresh.key_reset_approved", decision="denied", resource_type="mobile_device", resource_id=device_id[:64],
              reason=why, request_id=request_id, details={"channel": channel})
        return Refused(status, code, msg)

    dev = conn.execute("SELECT id, user_id, name, revoked_at FROM mobile_devices WHERE id = ?", (device_id,)).fetchone()
    if dev is None:
        raise deny(404, "not_found", "device_not_found", DEVICE_HE)
    text = " ".join(str(reason).split()) if isinstance(reason, str) else ""
    if not RESET_REASON_MIN <= len(text) <= RESET_REASON_MAX:
        raise deny(422, "validation", "reason_invalid", REASON_HE)
    if dev["user_id"] == actor.user_id and channel != "local":
        raise deny(403, "local_channel_only", "own_device_remote", SELF_RESET_HE)
    pin = pinned_key(conn, device_id)
    if pin is None:
        raise deny(409, "no_device_key", "no_device_key", NO_KEY_HE)
    now = _now()
    expires = now + RESET_WINDOW_S
    if not pin["stored"]:
        _store_pin(conn, device_id, dev["user_id"], (pin["spki"], pin["fp"]), now)
    conn.execute("UPDATE app_refresh_device_keys SET reset_approved_at = ?, reset_expires_at = ?, reset_by = ?, reset_reason = ? WHERE device_id = ?",
                 (iso(now), iso(expires), actor.user_id, text, device_id))
    ended = revoke_device(conn, device_id, "device_key_reset")
    _drop_nonces(conn, pin_scope(device_id))
    notified = _notify_reset(conn, dev["user_id"], device_id, dev["name"] or "", expires)
    audit(conn, actor=actor, action="auth.app_refresh.key_reset_approved", decision="allowed", resource_type="mobile_device", resource_id=device_id,
          request_id=request_id, reason="admin_approved",
          details={"user": dev["user_id"], "key_fp": dk.fingerprint_prefix(pin["fp"]), "expires_at": iso(expires), "channel": channel,
                   "families_ended": ended, "notified": notified, "note": text})
    return {"device_id": device_id, "reset_expires_at": iso(expires), "families_ended": ended, "user_notified": notified}


USER_RELEASE_REASONS = ("app_sign_out", "revoked_by_user", "signed_out_everywhere")


def release_pins(conn: sqlite3.Connection, device_ids: Any, reason: str, *, actor: Principal, request_id: str | None) -> int:
    """Owner decision Q296 (2026-10-23): the USER ending the old sign-in themselves - the app's own sign-out with its current token, "end this
    sign-in" or "sign out everywhere" on their own account - releases the device's pinned key, so the next mint binds a new key without the
    old key's proof. Nothing else releases it: re-registering or deleting the device, an administrator's end, a refusal, expiry, the
    feature switched off (only an administrator-approved reset does). Audited `auth.app_refresh.key_released`."""
    if reason not in USER_RELEASE_REASONS:
        return 0
    n = 0
    for did in sorted(set(device_ids)):
        row = _pin_row(conn, did)
        if row is None or row["user_id"] != actor.user_id:
            continue
        if conn.execute("SELECT 1 FROM app_refresh_families WHERE device_id = ? AND revoked_at IS NULL", (did,)).fetchone() is not None:
            continue
        conn.execute("DELETE FROM app_refresh_device_keys WHERE device_id = ?", (did,))
        _drop_nonces(conn, pin_scope(did))
        audit(conn, actor=actor, action="auth.app_refresh.key_released", decision="allowed", resource_type="mobile_device", resource_id=did,
              reason=reason, request_id=request_id, details={"key_fp": dk.fingerprint_prefix(row["device_key_fp"])})
        n += 1
    return n


def withdraw_key_reset(conn: sqlite3.Connection, actor: Principal, device_id: str, *, channel: str, request_id: str | None) -> bool:
    """Withdraw a pending approval (the pin holds again at once). False: nothing was pending."""
    pin = pinned_key(conn, device_id)
    if pin is None or not _reset_pending(pin, _now()):
        return False
    _clear_reset(conn, device_id)
    audit(conn, actor=actor, action="auth.app_refresh.key_reset_withdrawn", decision="allowed", resource_type="mobile_device", resource_id=device_id,
          request_id=request_id, details={"channel": channel})
    return True


def _take_nonce(conn: sqlite3.Connection, scopes: str | tuple[str, ...], nonce: Any, now: float) -> bool:
    """Spend a challenge nonce of one of `scopes` (a family id, or a device's pin scope): False for an unknown / foreign / used / expired
    one. A valid one is marked used BEFORE the caller verifies the signature (single use, also when the proof is then refused)."""
    allowed = (scopes,) if isinstance(scopes, str) else scopes
    row = conn.execute("SELECT * FROM app_refresh_nonces WHERE nonce_hash = ?", (dk.nonce_hash(nonce),)).fetchone() if dk.is_nonce(nonce) else None
    if row is None or row["family_id"] not in allowed or row["used_at"] or epoch(row["expires_at"]) <= now:
        return False
    conn.execute("UPDATE app_refresh_nonces SET used_at = ? WHERE nonce_hash = ?", (iso(now), row["nonce_hash"]))
    return True


def _check_replace(conn: sqlite3.Connection, principal: Principal, device_id: str, pin: dict[str, Any], device_key: dict[str, Any] | None,
                   mode: str, request_id: str | None) -> None:
    """Security review D-01 (b) / APPREFRESH3: the OLD (pinned) key's consent to hand the device to the mint's new key (or to none). The
    proof `device_key.replaces = {nonce, ts, sig}` signs `replace_message(device_id, nonce, ts, <the new public_key text>)` with the old
    key over a challenge nonce of the device (POST /auth/app/refresh-challenge: the live keyed family's scope, or - no live family - the
    device's pin scope). Every refusal is `409 device_key_bound` with a reason, audited, and ends nothing (a consumed nonce stays
    consumed)."""
    now = _now()

    def deny(reason: str) -> Refused:
        audit(conn, actor=principal, action="auth.app_refresh.issue", decision="denied", resource_type="mobile_device", resource_id=device_id,
              reason="device_key_bound", request_id=request_id, details={"device_key_mode": mode, "family": pin["family_id"], "replace": reason})
        return Refused(409, "device_key_bound", KEY_BOUND_HE, details={"reason": reason, "server_time": int(now)})

    rep = (device_key or {}).get("replaces")
    if not rep:
        raise deny("missing")
    nonce, ts, sig = rep.get("nonce"), rep.get("ts"), rep.get("sig")
    scopes = tuple(s for s in (pin["family_id"], pin_scope(device_id)) if s)
    if not _take_nonce(conn, scopes, nonce, now):
        raise deny("nonce")
    text = str((device_key or {}).get("public_key") or "")
    if not isinstance(ts, int) or isinstance(ts, bool) or not dk.verify(dk.b64u_decode(pin["spki"]), str(sig or ""),
                                                                        dk.replace_message(device_id, nonce, ts, text)):
        raise deny("invalid")
    if abs(ts - now) > dk.POP_SKEW_S:
        raise deny("clock")


def unstored_challenge() -> dict[str, Any]:
    """A challenge answer (a fresh random nonce) - stored by challenge() for a known keyed family, by nobody otherwise."""
    now = _now()
    return {"nonce": dk.NONCE_PREFIX + secrets.token_urlsafe(32), "expires_in": dk.NONCE_TTL_S, "expires_at": iso(now + dk.NONCE_TTL_S),
            "server_time": int(now)}


def challenge(conn: sqlite3.Connection, device_id: str) -> tuple[dict[str, Any], str | None]:
    """A single-use nonce for the next refresh proof of `device_id`'s live keyed family. Returns (answer, family id or None). For an
    unknown device / a family without a key the answer has the same shape and a random nonce that is stored nowhere (no write, no
    existence oracle in the answer); the refresh then fails like any unknown token."""
    now = _now()
    answer = unstored_challenge()
    nonce = answer["nonce"]
    fid = _device_scope(conn, device_id)
    if fid is None:
        return answer, None
    conn.execute("DELETE FROM app_refresh_nonces WHERE family_id = ? AND (used_at IS NOT NULL OR expires_at <= ?)", (fid, iso(now)))
    conn.execute("""DELETE FROM app_refresh_nonces WHERE family_id = ? AND nonce_hash NOT IN (
                        SELECT nonce_hash FROM app_refresh_nonces WHERE family_id = ? ORDER BY issued_at DESC, rowid DESC LIMIT ?)""",
                 (fid, fid, dk.MAX_OPEN_NONCES - 1))
    conn.execute("INSERT INTO app_refresh_nonces(nonce_hash, family_id, issued_at, expires_at) VALUES (?,?,?,?)",
                 (dk.nonce_hash(nonce), fid, iso(now), iso(now + dk.NONCE_TTL_S)))
    return answer, fid


def _device_scope(conn: sqlite3.Connection, device_id: str) -> str | None:
    """Where a challenge nonce of this device is stored: its live KEYED family, else (APPREFRESH3) its pin scope when the device is pinned
    to a key without a live family (the replace proof after a re-registration / sign-out), else nowhere."""
    r = conn.execute("SELECT family_id FROM app_refresh_families WHERE device_id = ? AND revoked_at IS NULL AND device_key_fp IS NOT NULL",
                     (device_id,)).fetchone()
    if r is not None:
        return r["family_id"]
    return pin_scope(device_id) if _pin_row(conn, device_id) is not None else None


def peek_device_family(db: Database, device_id: str) -> str | None:
    """The nonce scope of a device - its live KEYED family, or its pin scope (a short read, no write gate) - the challenge route's limiter
    key; None for an unknown / unkeyed device."""
    with db.connection(mode="read", label="app_refresh.peek_device") as conn:
        return _device_scope(conn, device_id)


def _proof_retry(reason: str, now: float) -> Refused:
    """A proof the phone can simply redo (a stale / unknown / used nonce, its clock off): nothing ends, the refresh token is NOT consumed."""
    return Refused(401, "app_refresh_proof_retry", PROOF_RETRY_HE, retryable=True, details={"reason": reason, "server_time": int(now)})


def _check_proof(conn: sqlite3.Connection, fam: sqlite3.Row, token: str, device_id: str, proof: dict[str, Any] | None, now: float,
                 request_id: str | None) -> None:
    """The proof of possession of the family's device key, checked on EVERY refresh - the first try and the retry inside the 20 s grace
    alike (each try signs a fresh nonce: a captured request can never be replayed, a token without the key is useless). A missing or
    wrong signature over a valid token is a theft signal: the family ends (`proof_missing` / `proof_invalid`). A nonce problem or a
    clock off by more than POP_SKEW_S is answered `app_refresh_proof_retry` and ends nothing."""
    if not fam["device_key_spki"]:
        if device_key_mode(conn) == "required":
            _end(conn, fam, "device_key_required", request_id)
            raise Refused(401, "app_refresh_invalid", INVALID_HE)
        return  # a slice-1 family under `optional` / `off`: no proof (a proof sent anyway is ignored)
    if not proof:
        _end(conn, fam, "proof_missing", request_id)
        raise Refused(401, "app_refresh_invalid", INVALID_HE)
    nonce, ts, sig = proof.get("nonce"), proof.get("ts"), proof.get("sig")
    if not _take_nonce(conn, fam["family_id"], nonce, now):  # single use, also when the proof is then refused
        raise _proof_retry("nonce", now)
    spki = dk.b64u_decode(fam["device_key_spki"])
    if not isinstance(ts, int) or isinstance(ts, bool) or not dk.verify(spki, str(sig or ""), dk.refresh_message(device_id, nonce, ts, token)):
        _end(conn, fam, "proof_invalid", request_id)
        raise Refused(401, "app_refresh_invalid", INVALID_HE)
    if abs(ts - now) > dk.POP_SKEW_S:
        raise _proof_retry("clock", now)


# ---------------------------------------------------------------- issue

def issue(conn: sqlite3.Connection, principal: Principal, device_id: str, install_id: str, *, anchor_kind: str, anchor_hash: str, channel: str,
          request_id: str | None, device_key: dict[str, Any] | None = None) -> dict[str, Any]:
    """Mint a family for the caller's own device `device_id` (the install_id must be the one the registration holds). A previous live
    family of that device is replaced. Raises Refused (the router audits nothing more: every refusal here is audited)."""
    dev = conn.execute("SELECT * FROM mobile_devices WHERE id = ?", (device_id,)).fetchone()
    if dev is None or dev["revoked_at"] or dev["user_id"] != principal.user_id:
        audit(conn, actor=principal, action="auth.app_refresh.issue", decision="denied", resource_type="mobile_device", resource_id=device_id,
              reason="not_own_device", request_id=request_id)
        raise Refused(404, "not_found", DEVICE_HE)
    if not hmac.compare_digest(install_hash(install_id), install_hash(dev["install_id"])):
        audit(conn, actor=principal, action="auth.app_refresh.issue", decision="denied", resource_type="mobile_device", resource_id=device_id,
              reason="binding_mismatch", request_id=request_id)
        raise Refused(409, "binding_mismatch", MISMATCH_HE)
    refusal = _refusal(conn, principal.user_id)
    if refusal:  # F-04: audited like every other mint refusal
        audit(conn, actor=principal, action="auth.app_refresh.issue", decision="denied", resource_type="mobile_device", resource_id=device_id,
              reason=refusal, request_id=request_id)
        raise Refused(403, "remote_not_allowed" if refusal.endswith("remote_not_allowed") else "forbidden", INVALID_HE)
    if anchor_kind not in ANCHOR_KINDS or not anchor_hash:
        # REL2140 review M-4 (F-02): every family names the sign-in it came from, so revoking that sign-in ends it - never an unanchored one
        audit(conn, actor=principal, action="auth.app_refresh.issue", decision="denied", resource_type="mobile_device", resource_id=device_id,
              reason="sign_in_not_anchorable", request_id=request_id, details={"anchor": anchor_kind})
        raise Refused(403, "sign_in_not_anchorable", INVALID_HE)
    if not take("app_refresh.issue", principal.user_id, RATE_ISSUE):
        raise Refused(429, "rate_limited", RATE_HE, retryable=True, details={"retry_after_s": 60})
    key = _mint_key(conn, principal, device_id, device_key, request_id)  # before the old family is replaced: a refused key ends nothing
    attestation = _attest(conn, principal, device_id, install_id, key, device_key, request_id)  # ATTEST232: also before anything ends
    revoke_device(conn, device_id, "replaced", actor=principal, request_id=request_id)
    now = _now()
    admin = _holds_admin(conn, principal.user_id)
    absolute, idle = _caps(conn, admin)
    fam_id = FAMILY_PREFIX + new_id()
    abs_exp = now + absolute
    idle_exp = min(abs_exp, now + idle)
    conn.execute(
        """INSERT INTO app_refresh_families(family_id, user_id, device_id, install_hash, platform, anchor_kind, anchor_hash, channel, admin_capped,
                                            created_at, last_used_at, absolute_expires_at, idle_expires_at, generation)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)""",
        (fam_id, principal.user_id, device_id, install_hash(install_id), dev["platform"], anchor_kind, anchor_hash or "", channel, int(admin),
         iso(now), iso(now), iso(abs_exp), iso(idle_exp)))
    if key is not None:
        conn.execute("UPDATE app_refresh_families SET device_key_spki = ?, device_key_fp = ?, device_key_alg = ?, device_key_bound_at = ? WHERE family_id = ?",
                     (key[0], key[1], dk.ALG, iso(now), fam_id))
    _store_pin(conn, device_id, principal.user_id, key, now)  # APPREFRESH3: the pin outlives this family
    refresh, access, access_exp = _mint_pair(conn, fam_id, principal.user_id, device_id, 1, None, now)
    audit(conn, actor=principal, action="auth.app_refresh.issued", decision="allowed", resource_type="mobile_device", resource_id=device_id, request_id=request_id,
          details={"family": fam_id, "anchor": anchor_kind, "admin_capped": admin, "via": channel,
                   "device_key": dk.ALG if key else None, **({"key_fp": dk.fingerprint_prefix(key[1])} if key else {})})
    fam = conn.execute("SELECT * FROM app_refresh_families WHERE family_id = ?", (fam_id,)).fetchone()
    out = _answer(fam, refresh, access, access_exp, idle_exp)
    if attestation is not None:  # only while the mode is not off: an `off` installation answers exactly as before
        out["attestation"] = attestation
    return out


# ---------------------------------------------------------------- refresh

def _system(user_id: str) -> Principal:
    """The actor of an audit row written for a family's own request (the app, no session): the family's user, source `device`."""
    return Principal(user_id=user_id, username="", display_name="", source="device")


system_principal = _system


def peek_family(db: Database, token: str) -> str | None:
    """The family id a refresh token names (a short read, no write gate), or None for an unknown / malformed token."""
    return peek(db, token)[0]


def peek(db: Database, token: str) -> tuple[str | None, bool]:
    """(family id or None, whether that family is still live) - a short read, no write gate."""
    if not is_refresh_token(token):
        return None, False
    with db.connection(mode="read", label="app_refresh.peek") as conn:
        r = conn.execute("""SELECT t.family_id, f.revoked_at FROM app_refresh_tokens t LEFT JOIN app_refresh_families f ON f.family_id = t.family_id
                            WHERE t.token_hash = ?""", (token_hash(token),)).fetchone()
    if r is None:
        return None, False
    return r["family_id"], r["revoked_at"] is None


def _current(conn: sqlite3.Connection, row: sqlite3.Row, now: float) -> bool:
    """Is this refresh token the family's CURRENT one: live, or used inside the retry grace with a still-unused child (the phone that
    lost the answer)."""
    if row["state"] == "live":
        return True
    if row["state"] == "used" and now - epoch(row["used_at"]) <= RETRY_GRACE_S and row["child_hash"]:
        child = conn.execute("SELECT state FROM app_refresh_tokens WHERE token_hash = ?", (row["child_hash"],)).fetchone()
        return child is not None and child["state"] == "live"
    return False


def sign_out(conn: sqlite3.Connection, token: str, request_id: str | None) -> str | None:
    """The app's own sign-out. Only the family's CURRENT token signs it out (`app_sign_out`); any older token of a live family is a
    reuse by definition (security review F-03): the family ends as `reuse`, audited `reuse_detected`, so the theft signal is kept.
    Returns what happened (`signed_out` | `reuse` | None for nothing to end)."""
    row = conn.execute("SELECT * FROM app_refresh_tokens WHERE token_hash = ?", (token_hash(token),)).fetchone() if is_refresh_token(token) else None
    if row is None:
        return None
    fam = conn.execute("SELECT * FROM app_refresh_families WHERE family_id = ?", (row["family_id"],)).fetchone()
    if fam is None or fam["revoked_at"]:
        return None
    if not _current(conn, row, _now()):
        _end(conn, fam, "reuse", request_id, action="auth.app_refresh.reuse_detected")
        return "reuse"
    revoke_family(conn, fam["family_id"], "app_sign_out")
    audit(conn, actor=_system(fam["user_id"]), action="auth.app_refresh.revoked", decision="allowed", resource_type="mobile_device",
          resource_id=fam["device_id"], reason="app_sign_out", request_id=request_id, details={"family": fam["family_id"], "channel": "app"})
    release_pins(conn, [fam["device_id"]], "app_sign_out", actor=_system(fam["user_id"]), request_id=request_id)  # Q296: the user's own end
    return "signed_out"


def _end(conn: sqlite3.Connection, fam: sqlite3.Row, reason: str, request_id: str | None, *, action: str = "auth.app_refresh.refused") -> None:
    revoke_family(conn, fam["family_id"], reason)
    audit(conn, actor=_system(fam["user_id"]), action=action, decision="denied", resource_type="mobile_device", resource_id=fam["device_id"],
          reason=reason, request_id=request_id, details={"family": fam["family_id"], "channel": "app"})


def refresh(conn: sqlite3.Connection, token: str, device_id: str, install_id: str, request_id: str | None,
            proof: dict[str, Any] | None = None) -> dict[str, Any]:
    """Rotate: on the request's WRITE connection (one transaction, so two racing refreshes of one token serialise and the second is a
    retry or a reuse). Raises Refused 401 `app_refresh_invalid` / `app_refresh_expired`; every family-ending refusal is audited and
    committed (the caller must not roll back on a Refused - see routers/app_refresh)."""
    now = _now()
    row = conn.execute("SELECT * FROM app_refresh_tokens WHERE token_hash = ?", (token_hash(token),)).fetchone() if is_refresh_token(token) else None
    if row is None:
        raise Refused(401, "app_refresh_invalid", INVALID_HE)
    fam = conn.execute("SELECT * FROM app_refresh_families WHERE family_id = ?", (row["family_id"],)).fetchone()
    if fam is None or fam["revoked_at"]:
        raise Refused(401, "app_refresh_invalid", INVALID_HE)
    if fam["device_id"] != device_id or not hmac.compare_digest(fam["install_hash"], install_hash(install_id)):
        _end(conn, fam, "binding_mismatch", request_id)
        raise Refused(401, "app_refresh_invalid", INVALID_HE)
    dev = conn.execute("SELECT revoked_at, user_id, install_id FROM mobile_devices WHERE id = ?", (device_id,)).fetchone()
    if dev is None or dev["revoked_at"] or dev["user_id"] != fam["user_id"] or not hmac.compare_digest(install_hash(dev["install_id"]), fam["install_hash"]):
        _end(conn, fam, "device_gone", request_id)
        raise Refused(401, "app_refresh_invalid", INVALID_HE)
    refusal = _refusal(conn, fam["user_id"])  # the user's state AND the remote-access policy, re-evaluated at every refresh (F-01)
    if refusal:
        _end(conn, fam, refusal, request_id)
        raise Refused(401, "app_refresh_invalid", INVALID_HE)
    if _anchor_revoked(conn, fam):
        _end(conn, fam, "sign_in_revoked", request_id)
        raise Refused(401, "app_refresh_invalid", INVALID_HE)
    admin = _holds_admin(conn, fam["user_id"])
    # Re-evaluated against the CURRENT settings at every refresh (owner decision 2026-10-23, the safer choice): a shortened lifetime (or
    # the administrative cap, also for a permission gained after the mint) applies to existing families at once; a lengthened one never
    # extends the absolute expiry a family was issued with (the min with the stored values).
    absolute, idle = _caps(conn, admin)
    abs_exp = min(epoch(fam["absolute_expires_at"]), epoch(fam["created_at"]) + absolute)
    idle_exp = min(epoch(fam["idle_expires_at"]), epoch(fam["last_used_at"]) + idle, abs_exp)
    if now >= abs_exp or now >= idle_exp:
        _end(conn, fam, "expired" if now >= abs_exp else "idle", request_id)
        raise Refused(401, "app_refresh_expired", EXPIRED_HE)
    # APPREFRESH2: the device-key proof BEFORE the token state - a retry inside the grace must prove possession exactly like a first try
    _check_proof(conn, fam, token, device_id, proof, now, request_id)
    if row["state"] == "live":
        parent = row["token_hash"]
    elif _current(conn, row, now):
        # the retry of a lost answer (inside RETRY_GRACE_S, child still unused): the child and every access token handed out with it are superseded
        conn.execute("UPDATE app_refresh_tokens SET state = 'superseded' WHERE token_hash = ?", (row["child_hash"],))
        conn.execute("DELETE FROM app_access_tokens WHERE family_id = ?", (fam["family_id"],))
        parent = row["token_hash"]
    else:
        _end(conn, fam, "reuse", request_id, action="auth.app_refresh.reuse_detected")
        raise Refused(401, "app_refresh_invalid", INVALID_HE)
    new_idle = min(abs_exp, now + idle)
    gen = int(fam["generation"]) + 1
    conn.execute("UPDATE app_refresh_tokens SET state = 'used', used_at = COALESCE(used_at, ?) WHERE token_hash = ?", (iso(now), parent))
    conn.execute("UPDATE app_refresh_families SET generation = ?, last_used_at = ?, idle_expires_at = ?, absolute_expires_at = ?, admin_capped = ? WHERE family_id = ?",
                 (gen, iso(now), iso(new_idle), iso(abs_exp), int(admin or fam["admin_capped"]), fam["family_id"]))
    refresh_token, access, access_exp = _mint_pair(conn, fam["family_id"], fam["user_id"], device_id, gen, parent, now)
    fam = conn.execute("SELECT * FROM app_refresh_families WHERE family_id = ?", (fam["family_id"],)).fetchone()
    return _answer(fam, refresh_token, access, access_exp, new_idle)


# ---------------------------------------------------------------- access tokens

def resolve_access(conn: sqlite3.Connection, token: str) -> dict[str, Any] | None:
    """The live access token's owner (user, device, family, expiry), or None. Constant work either way."""
    if not is_access_token(token):
        return None
    r = conn.execute(
        """SELECT a.user_id, a.device_id, a.family_id, a.expires_at, f.revoked_at AS f_revoked, f.device_key_fp AS f_key FROM app_access_tokens a
           JOIN app_refresh_families f ON f.family_id = a.family_id WHERE a.token_hash = ?""", (token_hash(token),)).fetchone()
    if r is None or r["f_revoked"] or epoch(r["expires_at"]) <= _now():
        return None
    if not r["f_key"] and device_key_mode(conn) == "required":  # APPREFRESH2: no keyless family under `required`, also for its access tokens
        return None
    if _refusal(conn, r["user_id"]):  # F-01: the remote-access policy too
        return None
    return {"user_id": r["user_id"], "device_id": r["device_id"], "family_id": r["family_id"], "expires_at": r["expires_at"]}


# ---------------------------------------------------------------- revocation

def _tables_missing(exc: sqlite3.OperationalError) -> bool:
    return "no such table" in str(exc)


def _drop_nonces(conn: sqlite3.Connection, family_id: str) -> None:
    try:
        conn.execute("DELETE FROM app_refresh_nonces WHERE family_id = ?", (family_id,))
    except sqlite3.OperationalError as exc:  # a database before migration 0157
        if not _tables_missing(exc):
            raise


def _revoke(conn: sqlite3.Connection, where: str, args: tuple[Any, ...], reason: str, *, actor: Principal | None = None, request_id: str | None = None,
            subject: str | None = None) -> int:
    try:
        ids = [r["family_id"] for r in conn.execute(f"SELECT family_id FROM app_refresh_families WHERE revoked_at IS NULL AND {where}", args).fetchall()]
    except sqlite3.OperationalError as exc:  # a database before migration 0146 (an upgrade test): nothing to revoke
        if _tables_missing(exc):
            return 0
        raise
    if not ids:
        return 0
    now = iso(_now())
    for fid in ids:
        conn.execute("UPDATE app_refresh_families SET revoked_at = ?, revoked_reason = ? WHERE family_id = ? AND revoked_at IS NULL", (now, reason[:40], fid))
        conn.execute("UPDATE app_refresh_tokens SET state = 'revoked' WHERE family_id = ? AND state = 'live'", (fid,))
        conn.execute("DELETE FROM app_access_tokens WHERE family_id = ?", (fid,))
        _drop_nonces(conn, fid)
    if actor is not None:
        audit(conn, actor=actor, action="auth.app_refresh.revoked", decision="allowed", resource_type="user", resource_id=subject, reason=reason,
              request_id=request_id, details={"families": len(ids), "ids": sorted(ids)[:20]})
    return len(ids)


def revoke_family(conn: sqlite3.Connection, family_id: str, reason: str, **kw: Any) -> int:
    return _revoke(conn, "family_id = ?", (family_id,), reason, **kw)


def revoke_device(conn: sqlite3.Connection, device_id: str, reason: str, **kw: Any) -> int:
    return _revoke(conn, "device_id = ?", (device_id,), reason, subject=kw.pop("subject", device_id), **kw)


def revoke_user(conn: sqlite3.Connection, user_id: str, reason: str, *, keep_anchor: str = "", **kw: Any) -> int:
    if keep_anchor:
        return _revoke(conn, "user_id = ? AND anchor_hash <> ?", (user_id, keep_anchor), reason, subject=user_id, **kw)
    return _revoke(conn, "user_id = ?", (user_id,), reason, subject=user_id, **kw)


def revoke_anchor(conn: sqlite3.Connection, anchor_hash: str, reason: str, **kw: Any) -> int:
    if not anchor_hash:
        return 0
    return _revoke(conn, "anchor_hash = ?", (anchor_hash,), reason, **kw)


def revoke_all(conn: sqlite3.Connection, reason: str, **kw: Any) -> int:
    return _revoke(conn, "1 = 1", (), reason, subject="*", **kw)


def revoke_kind(conn: sqlite3.Connection, anchor_kind: str, reason: str, **kw: Any) -> int:
    return _revoke(conn, "anchor_kind = ?", (anchor_kind,), reason, subject="*", **kw)


def local_anchor(chain_id: str) -> str:
    """The anchor of a family minted from an Arx-only (USR2) session: SHA-256 of its chain id (never the chain id itself)."""
    return hashlib.sha256(("chain:" + chain_id).encode("utf-8")).hexdigest()


ANCHOR_KINDS = ("ha", "local")  # REL2140 review M-4: the only kinds a family may be minted with (never ingress / dev / none)
SESSION_ANCHOR_PREFIX = "s:"


def session_anchor(sign_in: str) -> str:
    """REL2140 review M-4: the anchor of a family minted from a remote HA session whose access token carries no `iss` (no hashed HA
    refresh-token id to record): `s:` + SHA-256 of that session's sign-in (its cookie chain - every rotation keeps it), stored with
    anchor kind `ha` (migration 0146's CHECK is unchanged; the prefix never matches an `iss_hash`). Such a family ends when that sign-in
    is revoked (the sessions list, sign out, the re-validation pass) and, because the sign-in lives only in this process, when no live
    session of it is left (`_anchor_revoked`) - e.g. after an add-on restart. The device-key slice (slice 2) replaces it."""
    return SESSION_ANCHOR_PREFIX + hashlib.sha256(("session:" + sign_in).encode("utf-8")).hexdigest()


def remote_anchor(s: Any) -> tuple[str, str]:
    """(anchor kind, anchor hash) of a remote HA session (ha_user_auth.RemoteSession): its HA sign-in, else its own sign-in."""
    if getattr(s, "iss_hash", ""):
        return "ha", s.iss_hash
    return "ha", session_anchor(s.sign_in())


def hook(fn_name: str, *args: Any, **kw: Any) -> int:
    """The other modules' revocation paths call this (never raises: a failure is logged and the primary revocation stands; the family
    then still ends at its next refresh through the same checks - user state, anchor, device)."""
    try:
        return globals()[fn_name](*args, **kw)
    except Exception:  # noqa: BLE001
        log.warning("app refresh revocation %s failed", fn_name, exc_info=True)
        return 0


def revoke_anchor_db(db: Database, anchor_hash: str, reason: str) -> int:
    """For callers outside a request transaction (the HA re-validation pass)."""
    if not anchor_hash:
        return 0
    try:
        with db.connection(label="app_refresh.anchor") as conn:
            rows = conn.execute("SELECT user_id FROM app_refresh_families WHERE revoked_at IS NULL AND anchor_hash = ?", (anchor_hash,)).fetchall()
            n = revoke_anchor(conn, anchor_hash, reason)
            for uid in {r["user_id"] for r in rows}:
                audit(conn, actor=_system(uid), action="auth.app_refresh.revoked", decision="allowed", resource_type="user", resource_id=uid, reason=reason)
            return n
    except Exception:  # noqa: BLE001
        log.warning("app refresh anchor revocation failed", exc_info=True)
        return 0


# ---------------------------------------------------------------- lists and retention

def list_families(conn: sqlite3.Connection, user_id: str | None = None) -> list[dict[str, Any]]:
    sql = ("SELECT f.*, d.name AS d_name FROM app_refresh_families f LEFT JOIN mobile_devices d ON d.id = f.device_id WHERE f.revoked_at IS NULL"
           + (" AND f.user_id = ?" if user_id else "") + " ORDER BY f.created_at")
    rows = conn.execute(sql, (user_id,) if user_id else ()).fetchall()
    now = _now()
    out = []
    for r in rows:
        if epoch(r["absolute_expires_at"]) <= now or epoch(r["idle_expires_at"]) <= now:
            continue  # expired: ends at its next use or with the janitor
        item = _family_out(r, r["d_name"])
        if user_id is None:
            item["user_id"] = r["user_id"]
        out.append(item)
    return out


def family(conn: sqlite3.Connection, family_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM app_refresh_families WHERE family_id = ?", (family_id,)).fetchone()


def janitor(db: Database) -> dict[str, int]:
    """Expired access tokens; families that ran out (marked ended); ended families and their token rows past KEEP_ENDED_DAYS."""
    now = _now()
    try:
        with db.connection(label="app_refresh.janitor") as conn:
            access = conn.execute("DELETE FROM app_access_tokens WHERE expires_at <= ?", (iso(now),)).rowcount
            try:
                conn.execute("DELETE FROM app_refresh_nonces WHERE expires_at <= ? OR used_at IS NOT NULL", (iso(now),))
            except sqlite3.OperationalError as exc:
                if not _tables_missing(exc):
                    raise
            try:  # APPREFRESH3: a lapsed reset approval is cleared (the pin holds again); a pin whose registration row is gone goes with it
                conn.execute("UPDATE app_refresh_device_keys SET reset_approved_at = NULL, reset_expires_at = NULL, reset_by = NULL, reset_reason = NULL"
                             " WHERE reset_expires_at IS NOT NULL AND reset_expires_at <= ?", (iso(now),))
                conn.execute("DELETE FROM app_refresh_device_keys WHERE device_id NOT IN (SELECT id FROM mobile_devices)")
            except sqlite3.OperationalError as exc:
                if not _tables_missing(exc):
                    raise
            expired = _revoke(conn, "(absolute_expires_at <= ? OR idle_expires_at <= ?)", (iso(now), iso(now)), "expired")
            cutoff = iso(now - KEEP_ENDED_DAYS * 86400)
            old = [r["family_id"] for r in conn.execute("SELECT family_id FROM app_refresh_families WHERE revoked_at IS NOT NULL AND revoked_at < ?", (cutoff,)).fetchall()]
            for fid in old:
                conn.execute("DELETE FROM app_refresh_tokens WHERE family_id = ?", (fid,))
                conn.execute("DELETE FROM app_access_tokens WHERE family_id = ?", (fid,))
                _drop_nonces(conn, fid)
                conn.execute("DELETE FROM app_refresh_families WHERE family_id = ?", (fid,))
    except sqlite3.OperationalError as exc:
        if _tables_missing(exc):
            return {"access": 0, "expired": 0, "deleted": 0}
        raise
    return {"access": access, "expired": expired, "deleted": len(old)}


__all__ = ["FEATURE_KEY", "Refused", "enabled", "enabled_db", "policy", "settings_out", "update_settings", "issue", "refresh", "peek_family",
           "resolve_access", "revoke_family", "revoke_device", "revoke_user", "revoke_anchor", "revoke_all", "revoke_anchor_db", "hook",
           "list_families", "family", "janitor", "reset_limits", "is_refresh_token", "is_access_token", "token_hash", "install_hash",
           "DEVICE_KEY_KEY", "DEVICE_KEY_MODES", "device_key_mode", "mode_rank", "challenge", "peek_device_family",
           "pinned_key", "key_status", "approve_key_reset", "withdraw_key_reset", "release_pins", "NOTICE_TITLE_KEY", "NOTICE_BODY_KEY",
           "RESET_WINDOW_S"]
