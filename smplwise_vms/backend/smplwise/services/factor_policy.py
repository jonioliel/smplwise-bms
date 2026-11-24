r"""MFA-POLICY-2490 (slice 5 of the second-factor train; design docs/design/full-2fa-t095/DESIGN.md 4.1, 6, 7, 9): the sign-in factor
policy - WHO must show a second factor when signing in remotely - with per-user / per-role overrides (now with `exempt`), the
wall-panel exemption, the long-lived-token rule and the compliance view.

Settings (services/settings_store.DEFAULTS; never restored from a backup):

| key | values | default |
|---|---|---|
| `security.factor_policy` | `optional` (nobody by policy) \| `admins` \| `sensitive` \| `all` | `optional` |
| `security.factor_policy_mode` | `report` (evaluated and shown, never refuses) \| `enforce` | `report` |
| `security.factor_wall_exempt` | `on` \| `off` - wall-panel users are exempt from this policy | `on` |
| `security.remote_long_lived_tokens` | `allow` \| `refuse_under_policy` \| `refuse` | `allow` (owner decision Q48) |

Owner answer for this slice (built to the recommendation): a user without a factor stays ALLOWED until the policy is switched on.
So the defaults change nothing on upgrade: `report` mode never refuses a sign-in, and the legacy rules (`security.second_factor_policy`,
`remote.require_mfa_admin`, the TFA2 overrides) keep working exactly as before in every mode.

In `enforce` mode a user is required to show a factor when the legacy rules require it OR this policy does (never weaker than today);
an exemption here (an `exempt` override, a wall-panel user, the service identity) exempts from THIS policy only. A user whom only
this policy requires and who has no Arx factor may satisfy it with Home Assistant's own MFA, proven by services/mfa_provenance.

Resolution order (design 4.1): the service identity (always exempt, owner 18.10) -> the user's own override -> any role `required` ->
a wall-panel user (when `security.factor_wall_exempt` = on) -> any role `optional` / `exempt` -> the global policy.

Overrides live in `auth_factor_policy` (migration 0221, seeded from `auth_totp_policy`). The legacy TFA2 route and this module's route
mirror each other's writes into both tables, so the two layers never disagree about a person or a role (`exempt` is `optional` in the
legacy table). Neither table travels in a backup (`auth_totp_policy` never did): a restore cannot change who must show a factor.
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Any

from ..db import get_setting, now_iso

POLICY_KEY = "security.factor_policy"
POLICIES = ("optional", "admins", "sensitive", "all")
DEFAULT_POLICY = "optional"
MODE_KEY = "security.factor_policy_mode"
MODES = ("report", "enforce")
DEFAULT_MODE = "report"
WALL_KEY = "security.factor_wall_exempt"
DEFAULT_WALL = "on"
LLAT_KEY = "security.remote_long_lived_tokens"
LLAT_MODES = ("allow", "refuse_under_policy", "refuse")
DEFAULT_LLAT = "allow"

SIGN_IN_VALUES = ("required", "optional", "exempt")
OVERRIDE_VALUES = ("inherit", *SIGN_IN_VALUES)
OVERRIDE_KINDS = ("user", "role")

# `sensitive` (design 4.1): the administrative permissions, every permission whose write is step-up gated (settings, users,
# permissions), alarm disarm / zone bypass and the door permissions.
DOOR_ALARM_PERMISSIONS = frozenset({"alarm.disarm", "alarm.bypass", "access.doors.open", "access.release", "access.emergency.open"})

LONG_LIVED_REFUSED_HE = "החיבור הזה לא מאפשר אימות דו-שלבי. התחברו עם שם המשתמש והסיסמה."
SIGN_IN_AGAIN_HE = "האימות הדו-שלבי של החשבון זוהה רק עכשיו. התנתקו והתחברו שוב כדי להשלים את הכניסה."


def admin_permissions() -> frozenset[str]:
    from .ha_user_auth import ADMIN_PERMISSIONS

    return ADMIN_PERMISSIONS


def sensitive_permissions() -> frozenset[str]:
    from .step_up import GATED_PERMISSIONS

    return admin_permissions() | GATED_PERMISSIONS | DOOR_ALARM_PERMISSIONS


def _setting(conn: sqlite3.Connection, key: str, allowed: tuple[str, ...], default: str) -> str:
    try:
        value = get_setting(conn, key, default) or default
    except Exception:  # noqa: BLE001 - a read error never changes the policy: the default (= today's behaviour)
        return default
    return value if value in allowed else default


def policy(conn: sqlite3.Connection) -> str:
    return _setting(conn, POLICY_KEY, POLICIES, DEFAULT_POLICY)


def mode(conn: sqlite3.Connection) -> str:
    return _setting(conn, MODE_KEY, MODES, DEFAULT_MODE)


def enforced(conn: sqlite3.Connection) -> bool:
    return mode(conn) == "enforce"


def wall_exempt(conn: sqlite3.Connection) -> bool:
    return _setting(conn, WALL_KEY, ("on", "off"), DEFAULT_WALL) == "on"


def long_lived_mode(conn: sqlite3.Connection) -> str:
    return _setting(conn, LLAT_KEY, LLAT_MODES, DEFAULT_LLAT)


# ---------------------------------------------------------------- overrides

def overrides(conn: sqlite3.Connection) -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {"user": {}, "role": {}}
    try:
        for r in conn.execute("SELECT subject_kind, subject_id, sign_in FROM auth_factor_policy").fetchall():
            out[r["subject_kind"]][r["subject_id"]] = r["sign_in"]
    except sqlite3.OperationalError:  # before migration 0221: the legacy table is the only source
        from . import second_factor as sf

        return sf.overrides(conn)
    return out


def _write(conn: sqlite3.Connection, table: str, column: str, kind: str, subject_id: str, value: str | None, actor_id: str | None) -> None:
    if value is None:
        conn.execute(f"DELETE FROM {table} WHERE subject_kind = ? AND subject_id = ?", (kind, subject_id))  # noqa: S608 - fixed names
        return
    conn.execute(
        f"INSERT INTO {table}(subject_kind, subject_id, {column}, updated_at, updated_by) VALUES (?,?,?,?,?) "  # noqa: S608 - fixed names
        f"ON CONFLICT(subject_kind, subject_id) DO UPDATE SET {column} = excluded.{column}, updated_at = excluded.updated_at, "
        "updated_by = excluded.updated_by", (kind, subject_id, value, now_iso(), actor_id))


def set_override(conn: sqlite3.Connection, kind: str, subject_id: str, value: str, actor_id: str | None) -> str | None:
    """Store `required` / `optional` / `exempt`, or drop the row for `inherit`; mirrored into the legacy table (`exempt` = `optional`
    there). Returns the previous value (None = inherit)."""
    before = conn.execute("SELECT sign_in FROM auth_factor_policy WHERE subject_kind = ? AND subject_id = ?", (kind, subject_id)).fetchone()
    stored = None if value == "inherit" else value
    _write(conn, "auth_factor_policy", "sign_in", kind, subject_id, stored, actor_id)
    _write(conn, "auth_totp_policy", "policy", kind, subject_id, None if stored is None else ("optional" if stored == "exempt" else stored), actor_id)
    return before["sign_in"] if before else None


def mirror_legacy(conn: sqlite3.Connection, kind: str, subject_id: str, value: str, actor_id: str | None) -> None:
    """The legacy TFA2 route wrote `auth_totp_policy`: keep `auth_factor_policy` in step (a no-op before migration 0221)."""
    try:
        _write(conn, "auth_factor_policy", "sign_in", kind, subject_id, None if value == "inherit" else value, actor_id)
    except sqlite3.OperationalError:
        pass


# ---------------------------------------------------------------- resolution

@dataclass(frozen=True)
class Resolution:
    sign_in: str  # required | optional | exempt
    source: str  # service | user | role | wall | global


def internal(user_id: str) -> Any:
    from ..rbac import Principal

    return Principal(user_id=user_id, username="", display_name="", source="internal")


def is_service_identity(conn: sqlite3.Connection, user_id: str) -> bool:
    try:
        return bool(user_id) and (get_setting(conn, "identity.service_user_id", "") or "") == user_id
    except Exception:  # noqa: BLE001
        return False


def is_wall_user(conn: sqlite3.Connection, user_id: str) -> bool:
    try:
        return conn.execute("SELECT 1 FROM wall_profiles WHERE user_id = ? AND enabled = 1", (user_id,)).fetchone() is not None
    except sqlite3.OperationalError:  # before the wall migration
        return False


def _role_ids(conn: sqlite3.Connection, principal: Any) -> list[str]:
    from ..rbac import _active_bindings

    return sorted({b["role_id"] for b in _active_bindings(conn, principal) if b["effect"] == "allow"})


def resolve(conn: sqlite3.Connection, principal: Any, candidate: str | None = None, *, ov: dict[str, dict[str, str]] | None = None) -> Resolution:
    """What THIS policy says for the user (the legacy rules are not part of it). `candidate` evaluates another global value (the
    compliance preview) instead of the stored one."""
    from ..rbac import permissions_anywhere

    uid = principal.user_id
    if is_service_identity(conn, uid):
        return Resolution("exempt", "service")
    ov = ov if ov is not None else overrides(conn)
    own = ov["user"].get(uid)
    if own in SIGN_IN_VALUES:
        return Resolution(own, "user")
    role_values = [ov["role"][r] for r in _role_ids(conn, principal) if r in ov["role"]]
    if "required" in role_values:
        return Resolution("required", "role")
    if wall_exempt(conn) and is_wall_user(conn, uid):
        return Resolution("exempt", "wall")
    if "optional" in role_values:
        return Resolution("optional", "role")
    if "exempt" in role_values:
        return Resolution("exempt", "role")
    glob = candidate if candidate in POLICIES else policy(conn)
    if glob == "all":
        return Resolution("required", "global")
    if glob in ("admins", "sensitive"):
        wanted = admin_permissions() if glob == "admins" else sensitive_permissions()
        if set(permissions_anywhere(conn, principal)) & wanted:
            return Resolution("required", "global")
    return Resolution("optional", "global")


def requires(conn: sqlite3.Connection, principal: Any) -> bool:
    """This policy requires a factor of the user AND is enforced (the hook second_factor.effective_policy reads)."""
    return enforced(conn) and resolve(conn, principal).sign_in == "required"


# ---------------------------------------------------------------- the long-lived-token rule (owner Q48: `allow` by default)

def long_lived_check_needed(conn: sqlite3.Connection, principal: Any) -> bool:
    """Whether a NEW remote sign-in of this user must find out if its token is a long-lived one (only when the rule is not `allow`)."""
    m = long_lived_mode(conn)
    if m == "allow":
        return False
    if m == "refuse":
        return True
    from . import second_factor as sf

    return sf.effective_policy(conn, principal, admin_permissions())[0] == "required"


def jwt_lifetime_s(token: str) -> float | None:
    """`exp - iat` of an HA access token (unverified claims; HA accepted the token before this is asked). A normal sign-in's access
    token lives 30 minutes, a long-lived one years."""
    from .ha_user_auth import _jwt_payload

    p = _jwt_payload(token) or {}
    exp, iat = p.get("exp"), p.get("iat")
    if isinstance(exp, (int, float)) and isinstance(iat, (int, float)):
        return float(exp) - float(iat)
    return None


LONG_LIVED_MIN_S = 2 * 86400.0


def is_long_lived(token: str, ha_type: str) -> bool:
    """HA's refresh-token type says so, or (the listing silent / changed) the token's own lifetime is longer than two days."""
    if ha_type:
        return ha_type == "long_lived_access_token"
    life = jwt_lifetime_s(token)
    return life is not None and life > LONG_LIVED_MIN_S


# ---------------------------------------------------------------- the compliance view

MISSING_CAP = 500


def _people(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Every active person Arx knows: its own users (not deleted / purged / disabled) and the HA directory's active users."""
    from .active_users import is_disabled

    people: dict[str, dict[str, Any]] = {}
    try:
        rows = conn.execute("SELECT id, display_name, username, source FROM users WHERE active = 1 AND deleted_at IS NULL AND purged_at IS NULL").fetchall()
    except sqlite3.OperationalError:
        rows = conn.execute("SELECT id, display_name, username, source FROM users WHERE active = 1").fetchall()
    for r in rows:
        people[r["id"]] = {"user_id": r["id"], "name": r["display_name"] or r["username"] or "", "kind": "local" if r["source"] == "local" else "ha"}
    try:
        for r in conn.execute("SELECT id, name, username FROM ha_users WHERE is_active = 1").fetchall():
            people.setdefault(r["id"], {"user_id": r["id"], "name": r["name"] or r["username"] or "", "kind": "ha"})
    except sqlite3.OperationalError:
        pass
    return [p for uid, p in sorted(people.items()) if not is_disabled(conn, uid)]


def _factor_of(conn: sqlite3.Connection, person: dict[str, Any], mfa_seen: dict[str, str]) -> str | None:
    from . import second_factor as sf

    uid = person["user_id"]
    if sf.is_enrolled(conn, uid):
        return "totp"
    if person["kind"] == "local":
        from . import local_passkeys

        try:
            if local_passkeys.has_factor(conn, uid):
                return "passkey"
        except sqlite3.OperationalError:
            pass
    if uid in mfa_seen:
        return "ha_mfa"
    return None


def compliance(conn: sqlite3.Connection, candidate: str | None = None) -> dict[str, Any]:
    """Who this policy (or the `candidate` global value) covers, who has a factor, who would have to enrol at the next remote sign-in
    and who is exempt (with the reason). Names and ids only - never a secret, a code or a token."""
    from . import second_factor as sf
    from . import mfa_provenance

    ov = overrides(conn)
    mfa_seen = mfa_provenance.seen_users(conn)
    total = covered = enrolled = 0
    missing: list[dict[str, Any]] = []
    exempt: list[dict[str, Any]] = []
    legacy_required = 0
    for person in _people(conn):
        total += 1
        principal = internal(person["user_id"])
        res = resolve(conn, principal, candidate, ov=ov)
        legacy = sf.legacy_policy(conn, principal, admin_permissions())[0] == "required"
        legacy_required += int(legacy)
        factor = _factor_of(conn, person, mfa_seen)
        if res.sign_in == "exempt":
            exempt.append({**person, "reason": res.source, "factor": factor})
            continue
        if res.sign_in != "required":
            continue
        covered += 1
        if factor:
            enrolled += 1
        elif len(missing) < MISSING_CAP:
            missing.append({**person, "reason": res.source, "factor": None})
    return {"policy": candidate if candidate in POLICIES else policy(conn), "users_total": total, "covered": covered, "enrolled": enrolled,
            "missing_count": covered - enrolled, "missing": missing, "exempt_count": len(exempt), "exempt": exempt[:MISSING_CAP],
            "ha_mfa_seen": len(mfa_seen), "legacy_required": legacy_required}


def status(conn: sqlite3.Connection) -> dict[str, Any]:
    """The settings of this policy and the legacy rules next to them (what the screens slice shows above the compliance preview)."""
    from . import second_factor as sf

    return {"policy": policy(conn), "mode": mode(conn), "enforced": enforced(conn), "wall_exempt": wall_exempt(conn),
            "long_lived_tokens": long_lived_mode(conn),
            "legacy": {"second_factor_policy": sf.policy(conn),
                       "require_mfa_admin": (get_setting(conn, "remote.require_mfa_admin", "false") or "false") == "true"}}
