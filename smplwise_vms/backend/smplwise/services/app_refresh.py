"""APPREFRESH-295 slice 1 (docs/changes/CR-APPREFRESH295.md): the phone app's persistent sign-in - rotating, single-use APP REFRESH
TOKENS with reuse detection, and the short-lived ACCESS TOKENS a refresh hands out. Backend only, behind `security.app_refresh`
(default `off`: no route mints or accepts anything, the public routes answer 404 as if absent).

- A FAMILY is one sign-in of one phone install (migration 0150): it is minted by a signed-in session for a device registration of
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

log = logging.getLogger("smplwise.app_refresh")

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
SETTING_KEYS = (FEATURE_KEY, *POLICY)
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


def settings_out(conn: sqlite3.Connection) -> dict[str, Any]:
    return {FEATURE_KEY: "on" if enabled(conn) else "off", **policy(conn)}


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
    if fam["anchor_kind"] != "ha" or not fam["anchor_hash"]:
        return False
    try:
        return conn.execute("SELECT 1 FROM remote_revoked_chains WHERE iss_hash = ?", (fam["anchor_hash"],)).fetchone() is not None
    except sqlite3.OperationalError:
        return False


def _family_out(r: sqlite3.Row, device_name: str | None = None) -> dict[str, Any]:
    return {"family_id": r["family_id"], "device_id": r["device_id"], "device_name": device_name, "platform": r["platform"], "channel": r["channel"],
            "created_at": r["created_at"], "last_used_at": r["last_used_at"], "idle_expires_at": r["idle_expires_at"],
            "absolute_expires_at": r["absolute_expires_at"], "admin_capped": bool(r["admin_capped"])}


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
            "expires_in": max(0, int(access_exp - _now()))}


# ---------------------------------------------------------------- issue

def issue(conn: sqlite3.Connection, principal: Principal, device_id: str, install_id: str, *, anchor_kind: str, anchor_hash: str, channel: str,
          request_id: str | None) -> dict[str, Any]:
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
    if not take("app_refresh.issue", principal.user_id, RATE_ISSUE):
        raise Refused(429, "rate_limited", RATE_HE, retryable=True, details={"retry_after_s": 60})
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
    refresh, access, access_exp = _mint_pair(conn, fam_id, principal.user_id, device_id, 1, None, now)
    audit(conn, actor=principal, action="auth.app_refresh.issued", decision="allowed", resource_type="mobile_device", resource_id=device_id, request_id=request_id,
          details={"family": fam_id, "anchor": anchor_kind, "admin_capped": admin, "via": channel})
    fam = conn.execute("SELECT * FROM app_refresh_families WHERE family_id = ?", (fam_id,)).fetchone()
    return _answer(fam, refresh, access, access_exp, idle_exp)


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
    return "signed_out"


def _end(conn: sqlite3.Connection, fam: sqlite3.Row, reason: str, request_id: str | None, *, action: str = "auth.app_refresh.refused") -> None:
    revoke_family(conn, fam["family_id"], reason)
    audit(conn, actor=_system(fam["user_id"]), action=action, decision="denied", resource_type="mobile_device", resource_id=fam["device_id"],
          reason=reason, request_id=request_id, details={"family": fam["family_id"], "channel": "app"})


def refresh(conn: sqlite3.Connection, token: str, device_id: str, install_id: str, request_id: str | None) -> dict[str, Any]:
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
        """SELECT a.user_id, a.device_id, a.family_id, a.expires_at, f.revoked_at AS f_revoked FROM app_access_tokens a
           JOIN app_refresh_families f ON f.family_id = a.family_id WHERE a.token_hash = ?""", (token_hash(token),)).fetchone()
    if r is None or r["f_revoked"] or epoch(r["expires_at"]) <= _now():
        return None
    if _refusal(conn, r["user_id"]):  # F-01: the remote-access policy too
        return None
    return {"user_id": r["user_id"], "device_id": r["device_id"], "family_id": r["family_id"], "expires_at": r["expires_at"]}


# ---------------------------------------------------------------- revocation

def _tables_missing(exc: sqlite3.OperationalError) -> bool:
    return "no such table" in str(exc)


def _revoke(conn: sqlite3.Connection, where: str, args: tuple[Any, ...], reason: str, *, actor: Principal | None = None, request_id: str | None = None,
            subject: str | None = None) -> int:
    try:
        ids = [r["family_id"] for r in conn.execute(f"SELECT family_id FROM app_refresh_families WHERE revoked_at IS NULL AND {where}", args).fetchall()]
    except sqlite3.OperationalError as exc:  # a database before migration 0150 (an upgrade test): nothing to revoke
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
            expired = _revoke(conn, "(absolute_expires_at <= ? OR idle_expires_at <= ?)", (iso(now), iso(now)), "expired")
            cutoff = iso(now - KEEP_ENDED_DAYS * 86400)
            old = [r["family_id"] for r in conn.execute("SELECT family_id FROM app_refresh_families WHERE revoked_at IS NOT NULL AND revoked_at < ?", (cutoff,)).fetchall()]
            for fid in old:
                conn.execute("DELETE FROM app_refresh_tokens WHERE family_id = ?", (fid,))
                conn.execute("DELETE FROM app_access_tokens WHERE family_id = ?", (fid,))
                conn.execute("DELETE FROM app_refresh_families WHERE family_id = ?", (fid,))
    except sqlite3.OperationalError as exc:
        if _tables_missing(exc):
            return {"access": 0, "expired": 0, "deleted": 0}
        raise
    return {"access": access, "expired": expired, "deleted": len(old)}


__all__ = ["FEATURE_KEY", "Refused", "enabled", "enabled_db", "policy", "settings_out", "update_settings", "issue", "refresh", "peek_family",
           "resolve_access", "revoke_family", "revoke_device", "revoke_user", "revoke_anchor", "revoke_all", "revoke_anchor_db", "hook",
           "list_families", "family", "janitor", "reset_limits", "is_refresh_token", "is_access_token", "token_hash", "install_hash"]
