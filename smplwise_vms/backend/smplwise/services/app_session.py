"""SESSIONEXCH2-295 (docs/changes/APPREFRESH-SESSION-EXCHANGE-SPEC.md revision 3; owner decisions 427-432 of 2026-10-24): the phone app's
WebView session, obtained through a ONE-TIME CODE. Behind `security.app_session_exchange` (default `off`) AND `security.app_refresh`.

- The EXCHANGE (`POST /auth/app/session`, the app's native client): a live access token of a live, KEYED family plus a device-key proof
  (purpose `session`, app_refresh_key.session_message) -> a single-use code (`arxc_`, 60 s, one outstanding per family), bound to the
  family, the family's key fingerprint and the request's origin. Keyless families are refused (decision 430: no downgrade path). The
  access token is NOT spent (review S-07 option 1: the nonce + a fresh signature guard every exchange).
- The REDEEM (`GET /auth/app/session/redeem?code=`, a top-level navigation of the WebView): the code is spent at the first presentation
  (also when it is then refused), the origin and the key are re-checked, and the SERVER sets the Arx session cookie (`a.` + 256 bits,
  HttpOnly, Secure, SameSite=Strict, Path=<remote_path>/) - decision 429 (supersedes "cookie in the body", review S-05).
- The WEB SESSION (`app_web_sessions`, migration 0174): 60 minutes idle, renewed by use up to 7 days (decision 431), administrators 1 h /
  30 min (decision 392), never beyond its family; one per family; resolved on every request (cache 15 s) with the family's live state,
  its expiry under the CURRENT settings and its anchor (review S-03), the user / policy refusal, the administrators' MFA rule (decision
  397) and the permission fingerprint. Ends with its family in the same transaction (app_refresh._revoke, review S-09), at every
  start-up (decision 398), on "end this session" in the sessions list together with its family (review S-04), and on the web sign-out
  together with its family (decision 394). A web session never mints a family (review S-01, routers/app_refresh.issue).
- Nothing here stores, logs, audits or returns a code, a cookie value, a hash of either, an access token or its digest, a nonce or a
  signature: SHA-256 at rest only; the redeem path's access-log line is redacted (`code=REDACTED`)."""
from __future__ import annotations

import hashlib
import hmac
import logging
import re
import secrets
import sqlite3
from dataclasses import dataclass, field
from typing import Any

from ..audit import audit
from ..db import Database, get_setting
from ..errors import ApiError
from ..rbac import LOCAL_ID_PREFIX, Principal, permissions_anywhere
from . import app_refresh as ar
from . import app_refresh_key as dk
from .session_cache import SessionCache

log = logging.getLogger("smplwise.app_session")

FEATURE_KEY = "security.app_session_exchange"
MODES = ("off", "on")  # decision 430: no keyless mode
IDLE_KEY = "security.app_session_idle_minutes"
MAX_KEY = "security.app_session_max_days"
POLICY: dict[str, tuple[int, int, int]] = {IDLE_KEY: (60, 5, 60), MAX_KEY: (7, 1, 7)}  # (default, low, high) - decision 431
SETTING_KEYS = (FEATURE_KEY, *POLICY)
ADMIN_ABSOLUTE_S = 3600.0  # decision 392
ADMIN_IDLE_S = 1800.0
ACCESS_MAX_WHILE_ON = 15  # review S-02 / F-09: the access-token lifetime bound while the exchange is on

CODE_PREFIX = "arxc_"
CODE_TTL_S = 60
COOKIE_PREFIX = "a."
CACHE_TTL_S = 15.0
# CR-APP-SESSION-CACHE-2443 (the shape CR-LOCAL-USER-CREATE-2438 fixed in local_identity): every ending drops the cache entry inside the
# ending transaction, before its commit; a request that read the session row before that commit used to put the session back after the
# drop, and the ended session then answered from the cache for CACHE_TTL_S (and a WebSocket attached meanwhile was never closed). After a
# drop, nothing of that session / user (after a clear: nothing at all) is cached for this long. Longer than any transaction lives.
DROP_HOLD_S = 30.0
TOUCH_EVERY_S = 60.0
RATE_EXCHANGE = (5, 0.5)  # per family: burst 5, 30 per hour
KEEP_ENDED_DAYS = 30
CODE_KEEP_S = 86400  # spent / lapsed code rows are kept a day (the replay audit), then deleted
REDEEM_SUFFIX = "/api/v1/auth/app/session/redeem"

KEY_REQUIRED_HE = "החיבור של מסך האפליקציה דורש מפתח מכשיר. יש להיכנס מחדש באפליקציה."
ENROL_HE = "יש להפעיל אימות דו־שלבי לפני הכניסה דרך האפליקציה."
_B64U = re.compile(r"^[A-Za-z0-9_-]+$")


class Refused(ApiError):
    pass


def _now() -> float:
    return ar._now()  # one clock with app_refresh (the tests move it)


iso = ar.iso
epoch = ar.epoch


def _h(label: str, value: str) -> str:
    return hashlib.sha256((label + ":" + value).encode("utf-8", "replace")).hexdigest()


def code_hash(code: str) -> str:
    return _h("app-code", code)


def sid_hash_of(value: str) -> str:
    return _h("app-session", value)


def public_id_of(sid_hash: str) -> str:
    return _h("app-session-id", sid_hash)[:20]


def origin_hash(origin: str) -> str:
    return _h("app-origin", origin)


def is_code(value: Any) -> bool:
    return isinstance(value, str) and value.startswith(CODE_PREFIX) and 40 <= len(value) <= 80 and bool(_B64U.match(value[len(CODE_PREFIX):]))


def is_cookie(value: Any) -> bool:
    return isinstance(value, str) and value.startswith(COOKIE_PREFIX) and 40 <= len(value) <= 80


def _internal(user_id: str) -> Principal:
    return Principal(user_id=user_id, username="", display_name="", source="internal")


def _col(row: Any, name: str) -> Any:
    try:
        return row[name]
    except (IndexError, KeyError):
        return None


def _missing(exc: sqlite3.OperationalError) -> bool:
    return "no such table" in str(exc) or "no such column" in str(exc)


# ---------------------------------------------------------------- settings

def mode(conn: sqlite3.Connection) -> str:
    v = (get_setting(conn, FEATURE_KEY, "off") or "off").strip()
    return v if v in MODES else "off"  # an unknown stored value fails closed


def enabled(conn: sqlite3.Connection) -> bool:
    """Both switches: the exchange AND the saved sign-in (review S-09: read on every cache miss, never trusted from a hook)."""
    return mode(conn) == "on" and ar.enabled(conn)


def enabled_db(db: Database) -> bool:
    try:
        with db.connection(mode="read", label="app_session.flag") as conn:
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
    return out


def settings_out(conn: sqlite3.Connection) -> dict[str, Any]:
    return {FEATURE_KEY: mode(conn), **policy(conn)}


def _caps(conn: sqlite3.Connection, admin: bool) -> tuple[float, float]:
    """(absolute seconds, idle seconds) of a web session."""
    if admin:
        return ADMIN_ABSOLUTE_S, ADMIN_IDLE_S
    p = policy(conn)
    return p[MAX_KEY] * 86400.0, min(p[IDLE_KEY] * 60.0, p[MAX_KEY] * 86400.0)


# ---------------------------------------------------------------- shared checks

def _family_state(conn: sqlite3.Connection, fam: sqlite3.Row, now: float) -> tuple[str | None, float, float]:
    """(refusal reason or None, effective absolute expiry, effective idle expiry) of a live family - the refresh's own checks in its order:
    the device registration, the user / directory / remote policy, the anchor, the expiry under the CURRENT settings."""
    dev = conn.execute("SELECT revoked_at, user_id, install_id FROM mobile_devices WHERE id = ?", (fam["device_id"],)).fetchone()
    absolute, idle = ar._caps(conn, ar._holds_admin(conn, fam["user_id"]))
    abs_exp = min(epoch(fam["absolute_expires_at"]), epoch(fam["created_at"]) + absolute)
    idle_exp = min(epoch(fam["idle_expires_at"]), epoch(fam["last_used_at"]) + idle, abs_exp)
    if dev is None or dev["revoked_at"] or dev["user_id"] != fam["user_id"] or not hmac.compare_digest(ar.install_hash(dev["install_id"]), fam["install_hash"]):
        return "device_gone", abs_exp, idle_exp
    refusal = ar._refusal(conn, fam["user_id"])
    if refusal:
        return refusal, abs_exp, idle_exp
    if ar._anchor_revoked(conn, fam):
        return "sign_in_revoked", abs_exp, idle_exp
    if now >= abs_exp:
        return "expired", abs_exp, idle_exp
    if now >= idle_exp:
        return "idle", abs_exp, idle_exp
    return None, abs_exp, idle_exp


def _mfa_refused(conn: sqlite3.Connection, fam: sqlite3.Row) -> bool:
    """Decision 397: the administrators' MFA rule, checked at the exchange, the redeem and every web-session request (nothing is ended
    when the rule is switched on). An HA user holding an administrative permission needs the minting HA sign-in's MFA flag; NULL (an
    older family) fails closed. Arx-only identities have their own factor rule (rbac.local_factor_gate)."""
    from . import ha_user_auth as hua

    uid = fam["user_id"]
    if str(uid).startswith(LOCAL_ID_PREFIX):
        return False
    if str(hua.remote_settings(conn).get("remote.require_mfa_admin", "false")) != "true":
        return False
    if _col(fam, "ha_mfa") == 1:
        return False
    return bool(set(permissions_anywhere(conn, _internal(uid))) & hua.ADMIN_PERMISSIONS)


def _enrol_refused(conn: sqlite3.Connection, fam: sqlite3.Row) -> bool:
    """An HA user whom the second-factor policy now requires to enrol, and who has no factor (an Arx-only user gets a gated session).
    CORE-RELIABILITY-2540 (deep review SEC-4): "has a factor" is the remote sign-in's own rule (ha_user_auth.factor_owed) - an
    authenticator code, an active phone key (owner Q51), a passkey while `security.passkey_remote_factor` is on, and, when only the
    enforced sign-in factor policy requires one, HA's own MFA as recorded for the sign-in that minted this family (`ha_mfa` = 1).
    Before, only the authenticator code counted, so a policy locked the phone-key / passkey / HA-MFA users out of the app's web view.
    Fail closed: an administrator's reset (`must_enroll`), a family without an HA MFA record (NULL) and any answer this function does
    not know refuse."""
    from . import ha_user_auth as hua

    user_id = fam["user_id"]
    if str(user_id).startswith(LOCAL_ID_PREFIX):
        return False
    owed = hua.factor_owed(conn, _internal(user_id), passkey=True)
    if owed in ("none", "code"):
        return False
    if owed == "ha_mfa":
        return _col(fam, "ha_mfa") != 1
    return True  # enroll, enroll_after_reset, or an answer added later


def _perm_fp(conn: sqlite3.Connection, user_id: str) -> str:
    from ..rbac import permissions_fingerprint

    return permissions_fingerprint(conn, _internal(user_id))


# ---------------------------------------------------------------- the exchange (native client)

def peek_access(db: Database, token: str) -> tuple[str | None, bool]:
    """(family id or None, whether that family is live) of an access token - a short read, no write gate."""
    if not ar.is_access_token(token):
        return None, False
    with db.connection(mode="read", label="app_session.peek") as conn:
        r = conn.execute("""SELECT a.family_id, a.expires_at, f.revoked_at FROM app_access_tokens a JOIN app_refresh_families f ON f.family_id = a.family_id
                            WHERE a.token_hash = ?""", (ar.token_hash(token),)).fetchone()
    if r is None or epoch(r["expires_at"]) <= _now():
        return None, False
    return r["family_id"], r["revoked_at"] is None


def _check_proof(conn: sqlite3.Connection, fam: sqlite3.Row, token: str, device_id: str, proof: dict[str, Any] | None, now: float,
                 request_id: str | None) -> None:
    if not proof:
        ar._end(conn, fam, "session_proof_missing", request_id)
        raise Refused(401, "app_refresh_invalid", ar.INVALID_HE)
    nonce, ts, sig = proof.get("nonce"), proof.get("ts"), proof.get("sig")
    if not ar._take_nonce(conn, fam["family_id"], nonce, now):  # single use, also when the proof is then refused
        raise ar._proof_retry("nonce", now)
    spki = dk.b64u_decode(fam["device_key_spki"])
    if not isinstance(ts, int) or isinstance(ts, bool) or not dk.verify(spki, str(sig or ""), dk.session_message(device_id, nonce, ts, token)):
        ar._end(conn, fam, "session_proof_invalid", request_id)
        raise Refused(401, "app_refresh_invalid", ar.INVALID_HE)
    if abs(ts - now) > dk.POP_SKEW_S:
        raise ar._proof_retry("clock", now)


def _deny_exchange(conn: sqlite3.Connection, fam: sqlite3.Row, reason: str, request_id: str | None) -> None:
    audit(conn, actor=ar._system(fam["user_id"]), action="auth.app_session.exchange", decision="denied", resource_type="mobile_device",
          resource_id=fam["device_id"], reason=reason, request_id=request_id, details={"family": fam["family_id"], "channel": "app"})


def exchange(conn: sqlite3.Connection, token: str, device_id: str, install_id: str, proof: dict[str, Any] | None, *, origin: str,
             remote_path: str, request_id: str | None, meta: dict[str, str] | None = None) -> dict[str, Any]:
    """Spec section 5, steps 3 and 5-10, on the request's WRITE connection. Raises Refused / ApiError; every family-ending refusal is
    audited and committed (the connection commits on an ApiError)."""
    from . import ha_user_auth as hua

    now = _now()
    r = conn.execute("SELECT family_id, expires_at FROM app_access_tokens WHERE token_hash = ?", (ar.token_hash(token),)).fetchone() \
        if ar.is_access_token(token) else None
    if r is None or epoch(r["expires_at"]) <= now:
        raise Refused(401, "app_access_invalid", ar.INVALID_HE)
    fam = ar.family(conn, r["family_id"])
    if fam is None or fam["revoked_at"]:
        raise Refused(401, "app_access_invalid", ar.INVALID_HE)
    if fam["device_id"] != device_id or not hmac.compare_digest(fam["install_hash"], ar.install_hash(install_id)):
        ar._end(conn, fam, "binding_mismatch", request_id)
        raise Refused(401, "app_refresh_invalid", ar.INVALID_HE)
    reason, _, _ = _family_state(conn, fam, now)
    if reason:
        ar._end(conn, fam, reason, request_id)
        if reason in ("expired", "idle"):
            raise Refused(401, "app_refresh_expired", ar.EXPIRED_HE)
        raise Refused(401, "app_refresh_invalid", ar.INVALID_HE)
    if not fam["device_key_spki"] or not fam["device_key_fp"]:  # decision 430: never a keyless exchange; nothing ends
        _deny_exchange(conn, fam, "key_required", request_id)
        raise Refused(403, "app_session_key_required", KEY_REQUIRED_HE)
    _check_proof(conn, fam, token, device_id, proof, now, request_id)
    if _mfa_refused(conn, fam):
        _deny_exchange(conn, fam, "mfa_required", request_id)
        raise Refused(403, "remote_mfa_required", hua.MFA_REQUIRED_HE)
    if _enrol_refused(conn, fam):
        _deny_exchange(conn, fam, "enrol_required", request_id)
        raise Refused(403, "second_factor_enrollment_required", ENROL_HE)
    code = CODE_PREFIX + secrets.token_urlsafe(32)
    conn.execute("UPDATE app_session_codes SET used_at = ?, used_reason = 'superseded' WHERE family_id = ? AND used_at IS NULL",
                 (iso(now), fam["family_id"]))
    conn.execute("""INSERT INTO app_session_codes(code_hash, family_id, user_id, device_id, key_fp, origin_hash, created_at, expires_at)
                    VALUES (?,?,?,?,?,?,?,?)""",
                 (code_hash(code), fam["family_id"], fam["user_id"], fam["device_id"], fam["device_key_fp"], origin_hash(origin), iso(now),
                  iso(now + CODE_TTL_S)))
    audit(conn, actor=ar._system(fam["user_id"]), action="auth.app_session.code_issued", decision="allowed", resource_type="mobile_device",
          resource_id=fam["device_id"], request_id=request_id,
          details={"family": fam["family_id"], "key_fp": dk.fingerprint_prefix(fam["device_key_fp"]), "channel": "app", "ip": _ip(meta)})
    return {"code": code, "expires_in": CODE_TTL_S, "expires_at": iso(now + CODE_TTL_S), "redeem_path": remote_path + REDEEM_SUFFIX}


# ---------------------------------------------------------------- the redeem (the WebView)

@dataclass
class Redeemed:
    ok: bool
    reason: str = ""
    cookie_value: str = field(default="", repr=False)
    expires_at: float = 0.0
    count_failure: bool = False  # an unknown / spent / lapsed code counts on the client's failure tier


CROSS_SITE_VALUES = ("cross-site", "same-site")


def _ip(meta: dict[str, str] | None) -> str:
    """X4 F-3: the masked client address the audit rows of this module carry (`ip`, as the local sign-in audit does)."""
    from .ha_user_auth import mask_address

    return mask_address((meta or {}).get("client_ip", ""))


MARKER_RE = re.compile(r"^[0-9A-Fa-f]{12,32}$")


def redeem_marker_ok(values: list[str]) -> bool:
    """X4 F-1 fix 2: the redeem is the app's own navigation only when it carries exactly one `X-Correlation-Id` of 12-32 hex characters
    (the apps send it on `loadUrl(url, headers)` / `URLRequest`); a link opened from SMS / mail / another app cannot carry a header."""
    return len(values) == 1 and bool(MARKER_RE.fullmatch(values[0] or ""))


def cookie_user(conn: sqlite3.Connection, settings: Any, request: Any) -> str | None:
    """X4 F-1 fix 1: the user of a LIVE Arx session the request's cookie names (an HA remote session in this process, an Arx-only `l.`
    session, an app `a.` web session), else None. Read only: nothing is touched, rotated or ended."""
    import time

    from . import ha_user_auth as hua
    from . import local_identity as li

    sid = hua.session_id_of(settings, request)
    if not sid:
        return None
    try:
        if sid.startswith(COOKIE_PREFIX):
            r = conn.execute("SELECT user_id, expires_at, idle_expires_at FROM app_web_sessions WHERE sid_hash = ? AND revoked_at IS NULL",
                             (sid_hash_of(sid),)).fetchone()
            return r["user_id"] if r is not None and min(epoch(r["expires_at"]), epoch(r["idle_expires_at"])) > _now() else None
        if sid.startswith(li.COOKIE_PREFIX):
            r = conn.execute("SELECT user_id, expires_at, idle_expires_at FROM auth_local_sessions WHERE sid_hash = ? AND revoked_at IS NULL",
                             (li.sid_hash_of(sid),)).fetchone()
            return r["user_id"] if r is not None and min(epoch(r["expires_at"]), epoch(r["idle_expires_at"])) > time.time() else None
    except sqlite3.OperationalError as exc:
        if _missing(exc):
            return None
        raise
    s = hua.STORE.peek(sid)
    return s.principal.user_id if s is not None else None


def refuse_cross_site(conn: sqlite3.Connection, code: str, *, site: str, request_id: str | None, meta: dict[str, str] | None = None) -> None:
    """SX-27: the audit row of a redeem refused because `Sec-Fetch-Site` was `cross-site` / `same-site` (the 303 to
    `?app_session=failed` and the code's state are unchanged: a cross-site page neither redeems nor spends it, so the app's own
    navigation still can). A known code attributes the row to its user / device / family; an unknown or malformed one is recorded
    against the installation. The row never carries the code, its hash or any header value other than the closed `sec_fetch_site`."""
    site = site if site in CROSS_SITE_VALUES else "other"
    row = conn.execute("SELECT user_id, device_id, family_id FROM app_session_codes WHERE code_hash = ?", (code_hash(code),)).fetchone() \
        if is_code(code) else None
    if row is not None:
        audit(conn, actor=ar._system(row["user_id"]), action="auth.app_session.redeem", decision="denied", resource_type="mobile_device",
              resource_id=row["device_id"], reason="cross_site", request_id=request_id,
              details={"family": row["family_id"], "sec_fetch_site": site, "code_known": True, "ip": _ip(meta)})
        return
    audit(conn, actor=None, action="auth.app_session.redeem", decision="denied", resource_type="installation", resource_id="app_session",
          reason="cross_site", request_id=request_id, details={"sec_fetch_site": site, "code_known": False, "ip": _ip(meta)})


def redeem(conn: sqlite3.Connection, code: str, *, origin: str, meta: dict[str, str], request_id: str | None, marker_ok: bool = True,
           current_user: str | None = None) -> Redeemed:
    """Spec section 5a, steps 4-9, on a write connection. Never raises for a refusal: the spend of the code must commit.
    X4 F-1: `marker_ok` False (no app marker header) or a `current_user` other than the code's (the browser already holds another
    user's live session) refuses AFTER the code is spent, so a link-borne code dies and an existing session is never replaced.
    X4 F-3: unknown and lapsed codes are audited too; every row carries the masked client address, never the code or its hash."""
    now = _now()
    ip = _ip(meta)
    row = conn.execute("SELECT * FROM app_session_codes WHERE code_hash = ?", (code_hash(code),)).fetchone() if is_code(code) else None
    if row is None:
        audit(conn, actor=None, action="auth.app_session.redeem", decision="denied", resource_type="installation", resource_id="app_session",
              reason="code_unknown", request_id=request_id, details={"ip": ip})
        return Redeemed(False, "invalid", count_failure=True)
    actor = ar._system(row["user_id"])
    if row["used_at"]:
        audit(conn, actor=actor, action="auth.app_session.code_replayed", decision="denied", resource_type="mobile_device", resource_id=row["device_id"],
              reason="code_replayed", request_id=request_id, details={"family": row["family_id"], "ip": ip})
        return Redeemed(False, "replayed", count_failure=True)
    lapsed = epoch(row["expires_at"]) <= now
    # single use: spent at the first presentation, also when a check below then refuses it
    conn.execute("UPDATE app_session_codes SET used_at = ?, used_reason = ? WHERE code_hash = ? AND used_at IS NULL",
                 (iso(now), "expired" if lapsed else "redeemed", row["code_hash"]))
    if lapsed:
        audit(conn, actor=actor, action="auth.app_session.redeem", decision="denied", resource_type="mobile_device", resource_id=row["device_id"],
              reason="code_expired", request_id=request_id, details={"family": row["family_id"], "ip": ip})
        return Redeemed(False, "expired", count_failure=True)

    def deny(reason: str) -> Redeemed:
        conn.execute("UPDATE app_session_codes SET used_reason = ? WHERE code_hash = ?", (reason[:40], row["code_hash"]))
        audit(conn, actor=actor, action="auth.app_session.redeem", decision="denied", resource_type="mobile_device", resource_id=row["device_id"],
              reason=reason, request_id=request_id, details={"family": row["family_id"], "ip": ip})
        return Redeemed(False, reason)

    if not marker_ok:  # X4 F-1 fix 2: a link opened outside the app (SMS, mail, another app, typed) carries no header
        return deny("marker_missing")
    if current_user is not None and current_user != row["user_id"]:  # X4 F-1 fix 1: never replace another user's live session
        return deny("session_present")
    if not hmac.compare_digest(row["origin_hash"], origin_hash(origin)):
        return deny("origin_mismatch")
    fam = ar.family(conn, row["family_id"])
    if fam is None or fam["revoked_at"]:
        return deny("family_ended")
    if not fam["device_key_fp"] or not hmac.compare_digest(fam["device_key_fp"], row["key_fp"]):
        return deny("key_changed")
    reason, abs_exp, idle_exp = _family_state(conn, fam, now)
    if reason:
        return deny(reason)
    if _mfa_refused(conn, fam):
        return deny("mfa_required")
    if _enrol_refused(conn, fam):
        return deny("enrol_required")
    uid = fam["user_id"]
    admin = ar._holds_admin(conn, uid)
    absolute, idle = _caps(conn, admin)
    expires = min(now + absolute, abs_exp, idle_exp)
    idle_expires = min(now + idle, expires)
    value = COOKIE_PREFIX + secrets.token_urlsafe(32)
    sh = sid_hash_of(value)
    pid = public_id_of(sh)
    _end_where(conn, "family_id = ?", (fam["family_id"],), "replaced")  # one live web session per family
    from .ha_user_auth import mask_address

    conn.execute("""INSERT INTO app_web_sessions(sid_hash, public_id, family_id, user_id, device_id, key_fp, created_at, last_used_at, expires_at,
                                                 idle_expires_at, perm_fingerprint, ip_masked, user_agent) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                 (sh, pid, fam["family_id"], uid, fam["device_id"], fam["device_key_fp"], iso(now), iso(now), iso(expires), iso(idle_expires),
                  _perm_fp(conn, uid), mask_address(meta.get("client_ip", "")), (meta.get("user_agent") or "")[:200]))
    audit(conn, actor=actor, action="auth.app_session.created", decision="allowed", resource_type="mobile_device", resource_id=fam["device_id"],
          request_id=request_id,
          details={"session": pid, "family": fam["family_id"], "key_fp": dk.fingerprint_prefix(fam["device_key_fp"]), "admin_capped": admin,
                   "ha_mfa": None if _col(fam, "ha_mfa") is None else bool(_col(fam, "ha_mfa")), "gate": _gate(conn, uid), "via": "app", "ip": ip})
    return Redeemed(True, cookie_value=value, expires_at=expires)


# ---------------------------------------------------------------- the session object and its cache

@dataclass
class AppWebSession:
    """Duck-typed like ha_user_auth.RemoteSession / local_identity.LocalSession where ha_user_auth.session_of readers read one (the
    live-stream cap, the sessions list's current marker). No chain_id and no iss_hash: it never anchors or mints a family (S-01)."""

    sid_hash: str
    public_id: str
    principal: Principal
    user_id: str
    family_id: str
    device_id: str
    expires_at: float
    idle_expires_at: float
    created_at: float
    last_used_at: float
    gate: str = ""
    loaded_at: float = 0.0
    kind: str = "app"
    via: str = "cookie"
    iss_hash: str = ""
    chain_id: str = ""

    @property
    def sid(self) -> str:
        return "a:" + self.sid_hash

    def sign_in(self) -> str:
        return "a:" + self.public_id


def is_app_session(s: Any) -> bool:
    return isinstance(s, AppWebSession)


class _Cache(SessionCache[AppWebSession]):
    """The phone app's web-view sessions; sockets are keyed by session (a web session never rotates). The shared cache is
    services/session_cache.py (code review 2026-11-13 P2-4): an ended session is refused by a late put (ended keys), a user whose state
    changed is held for DROP_HOLD_S (CR-APP-SESSION-CACHE-2443). Here only: after a clear (the switch off, a start-up) nothing at all is
    cached for DROP_HOLD_S - a request that read before the clear's commit must not put its session back."""

    def __init__(self) -> None:
        super().__init__(clock=lambda: _now(), ttl_s=lambda: CACHE_TTL_S, user_hold_s=lambda: DROP_HOLD_S)
        self._cleared_at: float | None = None

    def _clear_held_locked(self, now: float) -> bool:
        if self._cleared_at is None:
            return False
        if now - self._cleared_at < DROP_HOLD_S:
            return True  # a clock that went back keeps the hold (fail closed)
        self._cleared_at = None
        return False

    def _put_refused_locked(self, s: AppWebSession) -> bool:
        return self._clear_held_locked(_now()) or super()._put_refused_locked(s)

    def drop(self, sid_hashes: set[str]) -> None:
        with self._lock:
            for sh in sid_hashes:
                self._by_sid.pop(sh, None)
            self._end_keys_locked(sid_hashes)

    def attach(self, sid_hash: str, websocket: Any, user_id: str = "") -> bool:
        """False when the session's entry is gone (ended between the resolve and the attach, review M2 / code review 2026-11-13 P1-1):
        the caller refuses the socket. Every ending drops the entry by session (drop, clear); a web session never rotates.
        CR-APP-SESSION-CACHE-2443: a session the resolve could not cache only because its USER is held (a factor / access change, not an
        ending) still attaches - an ending of it ends the session's key, which refuses here, or closes the socket once attached."""

        def live() -> bool:
            if sid_hash in self._by_sid:
                return True
            return not self._clear_held_locked(_now()) and self._user_held_live_locked(sid_hash, user_id)

        return self._attach(sid_hash, websocket, live)

    def clear(self) -> None:
        """Everything ends (the switch off, a start-up): nothing is cached for DROP_HOLD_S either."""
        super().clear()
        with self._lock:
            self._cleared_at = _now()

    def forget_ended(self) -> None:
        """Tests only: forget the ended keys, the held users and the clear's hold."""
        super().forget_ended()
        with self._lock:
            self._cleared_at = None

    def reset(self) -> None:
        """Tests only: an empty cache with no holds."""
        super().clear()
        self.forget_ended()


CACHE = _Cache()


def take_sockets_to_close() -> list[Any]:
    return CACHE.take_to_close()


def drop_user_cache(user_id: str) -> None:
    """The user's factor / directory state changed: the next request re-reads (local_identity.on_factor_removed)."""
    CACHE.drop_user(user_id)


def on_access_changed(user_ids: Any) -> None:
    """CR-APP-SESSION-CACHE-2443: services/revocation.mark / changed (a binding granted / revoked / denied, a role edit, a user disabled):
    the users' web sessions are re-checked on their next request (permission fingerprint, user state, the administrators' caps) instead
    of when the cache entry ages out. Memory only; never raises."""
    try:
        CACHE.drop_users({str(u) for u in user_ids if u})
    except Exception:  # noqa: BLE001 - a signal never fails the change that sent it
        log.warning("app web session cache could not follow an access change", exc_info=True)


def _lease(user_ids: list[str]) -> None:
    from .local_identity import lease_hook

    lease_hook("session_ended", user_ids=[u for u in user_ids if u])


def _gate(conn: sqlite3.Connection, user_id: str) -> str:
    if not str(user_id).startswith(LOCAL_ID_PREFIX):
        return ""
    from . import local_identity as li

    cred = conn.execute("SELECT must_change FROM auth_local_credentials WHERE user_id = ?", (user_id,)).fetchone()
    return li._gate_for(conn, user_id, bool(cred and cred["must_change"]))


def _principal(conn: sqlite3.Connection, user_id: str, fam: sqlite3.Row) -> Principal:
    u = conn.execute("SELECT username, display_name FROM users WHERE id = ?", (user_id,)).fetchone()
    if str(user_id).startswith(LOCAL_ID_PREFIX):
        from . import local_identity as li

        factor_ok = bool(_col(fam, "factor_at")) and li.has_factor(conn, user_id)
        name = (u["username"] if u else "") or ""
        return Principal(user_id=user_id, username=name, display_name=(u["display_name"] if u else "") or name, source="local", via="cookie",
                         factor_ok=factor_ok)
    try:
        ha = conn.execute("SELECT username, name FROM ha_users WHERE id = ?", (user_id,)).fetchone()
    except sqlite3.OperationalError:
        ha = None
    username = (ha["username"] if ha else "") or (u["username"] if u else "") or ""
    display = (ha["name"] if ha else "") or (u["display_name"] if u else "") or username
    return Principal(user_id=user_id, username=username, display_name=display, source="remote", via="cookie")


def _session_problem(conn: sqlite3.Connection, row: sqlite3.Row, fam: sqlite3.Row | None, now: float) -> str | None:
    """Spec section 6.4: why this web session may not answer now (None = it may)."""
    if row["revoked_at"]:
        return "ended"
    admin = ar._holds_admin(conn, row["user_id"])
    absolute, idle = _caps(conn, admin)
    if now >= min(epoch(row["expires_at"]), epoch(row["created_at"]) + absolute):
        return "expired"
    if now >= min(epoch(row["idle_expires_at"]), epoch(row["last_used_at"]) + idle):
        return "idle"
    if fam is None or fam["revoked_at"]:
        return "family_ended"
    if not fam["device_key_fp"] or not hmac.compare_digest(fam["device_key_fp"], row["key_fp"]):
        return "key_changed"
    reason, _, _ = _family_state(conn, fam, now)
    if reason:
        return reason
    if _mfa_refused(conn, fam):
        return "mfa_required"
    if _perm_fp(conn, row["user_id"]) != (row["perm_fingerprint"] or ""):
        return "permissions"
    return None


def _build(conn: sqlite3.Connection, row: sqlite3.Row, fam: sqlite3.Row) -> AppWebSession:
    admin = ar._holds_admin(conn, row["user_id"])
    absolute, idle = _caps(conn, admin)
    return AppWebSession(sid_hash=row["sid_hash"], public_id=row["public_id"], principal=_principal(conn, row["user_id"], fam), user_id=row["user_id"],
                         family_id=row["family_id"], device_id=row["device_id"],
                         expires_at=min(epoch(row["expires_at"]), epoch(row["created_at"]) + absolute),
                         idle_expires_at=min(epoch(row["idle_expires_at"]), epoch(row["last_used_at"]) + idle),
                         created_at=epoch(row["created_at"]), last_used_at=epoch(row["last_used_at"]), gate=_gate(conn, row["user_id"]),
                         loaded_at=_now())


def resolve(db: Database, conn_like: Any, cookie_value: str, *, offline: bool = False) -> AppWebSession | None:
    """The live web session a cookie names, or None. offline=True (the caller may hold the request's write lock): ha_user_auth.NeedsUnlock
    when a write is due (the once-a-minute touch, the end of a session that just failed a check) - the caller retries without its lock."""
    from .ha_user_auth import NeedsUnlock, request_meta

    if not is_cookie(cookie_value):
        return None
    sh = sid_hash_of(cookie_value)
    cached = CACHE.get(sh)
    if cached is not None:
        return cached
    if not enabled_db(db):  # S-09: both switches on every cache miss
        return None
    now = _now()
    try:
        with db.connection(mode="read", label="app session") as conn:
            row = conn.execute("SELECT * FROM app_web_sessions WHERE sid_hash = ?", (sh,)).fetchone()
            if row is None or row["revoked_at"]:
                return None
            fam = ar.family(conn, row["family_id"])
            problem = _session_problem(conn, row, fam, now)
            s = _build(conn, row, fam) if problem is None else None
            due_touch = problem is None and now - epoch(row["last_used_at"]) >= TOUCH_EVERY_S
    except sqlite3.OperationalError as exc:
        if _missing(exc):
            return None
        raise
    if problem is not None:
        if offline:
            raise NeedsUnlock
        with db.connection(label="app session end") as conn:
            _end_where(conn, "sid_hash = ?", (sh,), problem, audit_each=True)
        return None
    if due_touch:
        if offline:
            raise NeedsUnlock
        meta = request_meta(conn_like)
        from .ha_user_auth import mask_address

        with db.connection(label="app session use") as conn:
            row = conn.execute("SELECT * FROM app_web_sessions WHERE sid_hash = ?", (sh,)).fetchone()
            if row is None or row["revoked_at"]:
                return None
            _, idle = _caps(conn, ar._holds_admin(conn, row["user_id"]))
            conn.execute("""UPDATE app_web_sessions SET last_used_at = ?, idle_expires_at = MIN(expires_at, ?), ip_masked = ?, user_agent = ?
                            WHERE sid_hash = ? AND revoked_at IS NULL""",
                         (iso(now), iso(now + idle), mask_address(meta.get("client_ip", "")) or row["ip_masked"],
                          (meta.get("user_agent") or row["user_agent"] or "")[:200], sh))
            row = conn.execute("SELECT * FROM app_web_sessions WHERE sid_hash = ?", (sh,)).fetchone()
            fam = ar.family(conn, row["family_id"])
            s = _build(conn, row, fam)
    CACHE.put(s)
    return s


def remote_principal(request: Any, settings: Any, cookie_value: str, offline: bool = False) -> Principal | None:
    """ha_user_auth.remote_principal's `a.` branch. None = not a live web session (the caller answers as for any unknown cookie); an
    ApiError for a gated (Arx-only, enrolment / password change) session outside its allowed routes."""
    from . import local_identity as li

    s = resolve(request.app.state.db, request, cookie_value, offline=offline)
    if s is None:
        return None
    refusal = li._gate_refusal(settings, request, s)
    if refusal is not None:
        raise refusal
    try:
        request.state.sw_remote_session = s
    except AttributeError:
        pass
    return s.principal


async def remote_principal_ws(websocket: Any, settings: Any, cookie_value: str) -> Principal | None:
    from starlette.concurrency import run_in_threadpool

    from .ha_user_auth import origin_ok

    if not origin_ok(websocket):
        return None
    s = await run_in_threadpool(lambda: resolve(websocket.app.state.db, websocket, cookie_value))
    if s is None or s.gate:
        return None
    if not CACHE.attach(s.sid_hash, websocket, s.user_id):
        return None  # review M2 (P1-1): the session ended between the resolve and the attach - nothing would close this socket
    try:
        websocket.state.sw_remote_session = s
    except AttributeError:
        pass
    return s.principal


def still_live(principal: Principal, conn_like: Any) -> bool:
    """auth._pre_resolved for a web-session principal: its entry is still cached (a revoke drops it)."""
    s = (getattr(conn_like, "scope", None) or {}).get("state", {}).get("sw_remote_session")
    return isinstance(s, AppWebSession) and s.user_id == principal.user_id and CACHE.get(s.sid_hash) is not None


def holds_live_cookie(cookie_value: str | None) -> bool:
    """body_limit's credential tier: memory only, never an authentication."""
    return bool(is_cookie(cookie_value) and CACHE.get(sid_hash_of(cookie_value or "")) is not None)


# ---------------------------------------------------------------- ending

def _end_where(conn: sqlite3.Connection, where: str, args: tuple[Any, ...], reason: str, *, audit_each: bool = False) -> int:
    """End the live web sessions matching `where` (and withdraw the unredeemed codes of their families when the family itself ends). The
    cache entries are dropped and the WebSockets queued for closing at once; the users' capture leases end (strict, T4)."""
    try:
        rows = conn.execute(f"SELECT sid_hash, public_id, user_id, family_id FROM app_web_sessions WHERE revoked_at IS NULL AND {where}", args).fetchall()
    except sqlite3.OperationalError as exc:  # a database before migration 0174
        if _missing(exc):
            return 0
        raise
    if not rows:
        return 0
    now = iso(_now())
    for r in rows:
        conn.execute("UPDATE app_web_sessions SET revoked_at = ?, revoked_reason = ? WHERE sid_hash = ? AND revoked_at IS NULL", (now, reason[:40], r["sid_hash"]))
        if audit_each:
            audit(conn, actor=ar._system(r["user_id"]), action="auth.app_session.ended", decision="allowed", resource_type="user", resource_id=r["user_id"],
                  reason=reason, details={"session": r["public_id"], "family": r["family_id"]})
    _lease(sorted({r["user_id"] for r in rows}))
    CACHE.drop({r["sid_hash"] for r in rows})
    return len(rows)


def end_family_sessions(conn: sqlite3.Connection, family_ids: list[str], reason: str) -> int:
    """Called by app_refresh._revoke in ITS transaction for every family it ends (spec section 12; review S-09: not a best-effort hook)."""
    n = 0
    for fid in family_ids:
        n += _end_where(conn, "family_id = ?", (fid,), reason)
        try:
            conn.execute("UPDATE app_session_codes SET used_at = ?, used_reason = 'family_ended' WHERE family_id = ? AND used_at IS NULL", (iso(_now()), fid))
        except sqlite3.OperationalError as exc:
            if not _missing(exc):
                raise
    return n


def end_all(conn: sqlite3.Connection, reason: str) -> int:
    """The switch turned off / a start-up: every live web session ends, every unredeemed code is withdrawn."""
    n = _end_where(conn, "1 = 1", (), reason)
    try:
        conn.execute("UPDATE app_session_codes SET used_at = ?, used_reason = ? WHERE used_at IS NULL", (iso(_now()), reason[:40]))
    except sqlite3.OperationalError as exc:
        if not _missing(exc):
            raise
    CACHE.clear()
    return n


def end_on_startup(db: Database) -> int:
    """Decision 398 + review S-03: no web session and no code survives a restart (a rollback and re-upgrade, an `s:`-anchored family
    whose HA sign-in lived only in the previous process). Never raises."""
    try:
        with db.connection(label="app_session.startup") as conn:
            n = end_all(conn, "restart")
            if n:
                audit(conn, actor=None, action="auth.app_session.ended", decision="allowed", resource_type="installation", resource_id="app_session",
                      reason="restart", details={"sessions": n})
            return n
    except Exception:  # noqa: BLE001
        log.warning("app web sessions could not be ended at start-up", exc_info=True)
        return 0


def logout(db: Database, conn_like: Any, cookie_value: str) -> bool:
    """Decision 394: the sign-out inside the web screen ends the web session AND its family, as the user's own end (releases the device's
    pinned key, Q296). False: not a live web session."""
    if not is_cookie(cookie_value):
        return False
    sh = sid_hash_of(cookie_value)
    try:
        with db.connection(label="app session logout") as conn:
            row = conn.execute("SELECT * FROM app_web_sessions WHERE sid_hash = ?", (sh,)).fetchone()
            if row is None or row["revoked_at"]:
                return False
            actor = ar._system(row["user_id"])
            _end_where(conn, "sid_hash = ?", (sh,), "web_sign_out")
            ar.revoke_family(conn, row["family_id"], "web_sign_out", actor=actor, subject=row["user_id"])
            ar.release_pins(conn, [row["device_id"]], "web_sign_out", actor=actor, request_id=None)
            # XSECFIX-297 (review M2 / L1): the sign-out ends this device's token and push registration too (it re-registers on sign-in)
            from . import presence

            presence.end_on_sign_out(conn, row["user_id"], "logout", device_ids=[row["device_id"]], actor=actor,
                                     sign_ins=("a:" + row["public_id"],))  # FE-SAFETY-FIX-2520: and its browser push subscriptions
            audit(conn, actor=actor, action="auth.app_session.signed_out", decision="allowed", resource_type="mobile_device", resource_id=row["device_id"],
                  reason="web_sign_out", details={"session": row["public_id"], "family": row["family_id"]})
            return True
    except sqlite3.OperationalError as exc:
        if _missing(exc):
            return False
        raise


# ---------------------------------------------------------------- the sessions list (decision 396, review S-04)

def list_rows(conn: sqlite3.Connection, user_id: str | None = None) -> list[dict[str, Any]]:
    """One row per live web session (kind `app`, the device's name, `saved_sign_in: true`). No cookie, no hash, no full address."""
    from .ha_user_auth import agent_family

    if mode(conn) != "on":
        return []
    now = iso(_now())
    sql = """SELECT s.*, d.name AS d_name, u.username AS u_username, u.display_name AS u_display FROM app_web_sessions s
             LEFT JOIN mobile_devices d ON d.id = s.device_id LEFT JOIN users u ON u.id = s.user_id
             WHERE s.revoked_at IS NULL AND s.expires_at > ? AND s.idle_expires_at > ?"""
    args: list[Any] = [now, now]
    if user_id is not None:
        sql += " AND s.user_id = ?"
        args.append(user_id)
    try:
        rows = conn.execute(sql + " ORDER BY s.last_used_at DESC", args).fetchall()
    except sqlite3.OperationalError as exc:
        if _missing(exc):
            return []
        raise
    return [{"id": r["public_id"], "user_id": r["user_id"], "username": r["u_username"], "display_name": r["u_display"], "created_at": r["created_at"],
             "last_seen_at": r["last_used_at"], "address": r["ip_masked"] or None, "country": None, "agent": agent_family(r["user_agent"]),
             "channel": "cookie", "kind": "app", "device": r["d_name"], "label": None, "saved_sign_in": True, "_chain": "a:" + r["public_id"]}
            for r in rows]


def owner_of(conn: sqlite3.Connection, public_id: str) -> sqlite3.Row | None:
    try:
        return conn.execute("SELECT * FROM app_web_sessions WHERE public_id = ? AND revoked_at IS NULL", (public_id,)).fetchone()
    except sqlite3.OperationalError as exc:
        if _missing(exc):
            return None
        raise


# ---------------------------------------------------------------- housekeeping

def janitor(db: Database) -> dict[str, int]:
    """Lapsed / spent code rows past a day; live sessions past their expiry or whose family ended / ran out (the sweep for a missed
    fan-out, S-09); ended sessions past KEEP_ENDED_DAYS."""
    now = _now()
    out = {"codes": 0, "ended": 0, "deleted": 0}
    try:
        with db.connection(label="app_session.janitor") as conn:
            out["codes"] = conn.execute("DELETE FROM app_session_codes WHERE expires_at <= ?", (iso(now - CODE_KEEP_S),)).rowcount
            out["ended"] += _end_where(conn, "(expires_at <= ? OR idle_expires_at <= ?)", (iso(now), iso(now)), "expired")
            out["ended"] += _end_where(conn, "family_id IN (SELECT family_id FROM app_refresh_families WHERE revoked_at IS NOT NULL"
                                             " OR absolute_expires_at <= ? OR idle_expires_at <= ?)", (iso(now), iso(now)), "family_ended")
            out["deleted"] = conn.execute("DELETE FROM app_web_sessions WHERE revoked_at IS NOT NULL AND revoked_at < ?",
                                          (iso(now - KEEP_ENDED_DAYS * 86400),)).rowcount
    except sqlite3.OperationalError as exc:
        if not _missing(exc):
            raise
    return out


# ---------------------------------------------------------------- the access log never carries a code

# X4 I-2: the parameter name in every spelling Starlette decodes to `code` (`cod%65=`, `%63ode=`, any case), `&` or `;` separated
_CODE_IN_URL = re.compile(r"(?i)((?<![^?&;\s\"])(?:c|%63)(?:o|%6f)(?:d|%64)(?:e|%65)(?:=|%3d))[^&;\s\"]*")


class RedactCode(logging.Filter):
    """The redeem path's query carries the one-time code; uvicorn's access log line records the full path - redacted here."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            if isinstance(record.args, tuple) and any(isinstance(a, str) and REDEEM_SUFFIX in a for a in record.args):
                record.args = tuple(_CODE_IN_URL.sub(r"\1REDACTED", a) if isinstance(a, str) and REDEEM_SUFFIX in a else a for a in record.args)
            if isinstance(record.msg, str) and REDEEM_SUFFIX in record.msg:
                record.msg = _CODE_IN_URL.sub(r"\1REDACTED", record.msg)
        except Exception:  # noqa: BLE001 - a log line is never lost
            pass
        return True


_FILTER = RedactCode()


def install_log_filter() -> None:
    for name in ("uvicorn.access", "uvicorn.error", "smplwise"):
        lg = logging.getLogger(name)
        if _FILTER not in lg.filters:
            lg.addFilter(_FILTER)


install_log_filter()


def reset_for_tests() -> None:
    CACHE.reset()
    CACHE.take_to_close()
    CACHE.forget_ended()


__all__ = ["FEATURE_KEY", "MODES", "SETTING_KEYS", "POLICY", "Refused", "exchange", "redeem", "resolve", "remote_principal", "remote_principal_ws",
           "still_live", "holds_live_cookie", "end_family_sessions", "end_all", "end_on_startup", "logout", "list_rows", "owner_of", "janitor",
           "is_app_session", "AppWebSession", "peek_access", "enabled", "enabled_db", "mode", "settings_out"]
