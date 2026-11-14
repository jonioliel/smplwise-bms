"""EMROLE-295 (owner decisions 2026-10-24): giving the built-in `emergency_open` role to people who are not system administrators - a guard, a temporary
guard, a reception desk clerk - with an expiry.

- WHO may grant: a system administrator, and a holder of the built-in `security_manager` role (the single permission `emergency.open.grant`) while the setting
  `doors.emergency.grant.by_security_manager` is on. That permission opens THIS module only: it grants the one role `emergency_open`, never another role, never a
  deny, never `rbac.assign`, never to oneself. A security manager acts inside the scope where the permission is held.
- The EXPIRY: the grant is an ordinary binding with `expires_at`; the binding query (`rbac._active_bindings`) drops an expired binding on EVERY authorization, so the
  server enforces it at use time without a sweeper. The default and the longest expiry are settings (`doors.emergency.grant.default_hours` / `.max_hours`); a security
  manager is always bounded by the maximum, only a system administrator may give a grant without an expiry.
- Everything is audited: `door.emergency.grant` / `door.emergency.grant_revoke` (and the generic `rbac.bind` / `rbac.unbind` rows the binding code writes), refusals
  as `denied` rows. Nothing here touches a door, a station or the engine.
"""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from fastapi import Request

from ..audit import audit
from ..db import bump_permission_revision, now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, is_system_admin, role_name, scope_name
from ..services.timeutil import parse_utc
from . import door_emergency as de
from . import door_windows as dw

GRANT = "emergency.open.grant"
ROLE_ID = "emergency_open"
MANAGER_ROLE = "security_manager"
SCOPE_TYPES = ("installation", "site", "building", "access_control_station")
ADMIN_MAX_DAYS = 3650
BRIEF_MAX = 25


def _active_sql(extra: str = "") -> str:
    return f"SELECT * FROM bindings WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) {extra} ORDER BY created_at"


def roles_of(conn: sqlite3.Connection, user_id: str) -> list[dict[str, Any]]:
    """The active roles of one person at this moment (direct and through a group): role id, scope, expiry. Audit evidence: ids only."""
    rows = conn.execute(_active_sql("AND effect = 'allow' AND ((subject_kind = 'user' AND subject_id = ?) OR (subject_kind = 'group' AND subject_id IN "
                                    "(SELECT group_id FROM group_members WHERE user_id = ?)))"), (now_iso(), user_id, user_id)).fetchall()
    return [{"role": b["role_id"], "scope": f"{b['scope_type']}:{b['scope_id']}", "expires_at": b["expires_at"]} for b in rows][:12]


def holders_brief(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(_active_sql("AND effect = 'allow' AND role_id = ?"), (now_iso(), ROLE_ID)).fetchall()
    return [{"subject": f"{b['subject_kind']}:{b['subject_id']}", "scope": f"{b['scope_type']}:{b['scope_id']}", "expires_at": b["expires_at"]} for b in rows][:BRIEF_MAX]


def grant_basis(conn: sqlite3.Connection, principal: Principal, scope: tuple[str, str] | None = None) -> str | None:
    """"system_admin", "security_manager" (the permission at `scope`, or anywhere when no scope is given, while the setting is on) or None."""
    if is_system_admin(conn, principal.user_id):
        return "system_admin"
    if de.setting(conn, de.GRANT_BY_MANAGER) != "on":
        return None
    if scope is None:
        from ..rbac import permissions_anywhere

        return "security_manager" if GRANT in permissions_anywhere(conn, principal) else None
    return "security_manager" if authorize(conn, principal, GRANT, scope).allowed else None


def _refuse(conn: sqlite3.Connection, principal: Principal, action: str, status: int, code: str, text: str, **details: Any) -> ApiError:
    audit(conn, actor=principal, action=action, decision="denied", resource_type="role", resource_id=ROLE_ID, reason=code, details=details or None)
    return ApiError(status, code, text, details=details or None)


def _name(conn: sqlite3.Connection, subject_kind: str, subject_id: str) -> str:
    from ..routers.access import _subject_name

    return _subject_name(conn, subject_kind, subject_id)


def holder_rows(conn: sqlite3.Connection, principal: Principal) -> list[dict[str, Any]]:
    """The active emergency_open grants this reader may manage (a security manager sees those inside the scopes of the permission)."""
    out = []
    for b in conn.execute(_active_sql("AND effect = 'allow' AND role_id = ?"), (now_iso(), ROLE_ID)).fetchall():
        scope = (b["scope_type"], b["scope_id"])
        basis = grant_basis(conn, principal, scope)
        if basis is None:
            continue
        out.append({"id": b["id"], "subject_kind": b["subject_kind"], "subject_id": b["subject_id"], "name": _name(conn, b["subject_kind"], b["subject_id"]),
                    "scope_type": b["scope_type"], "scope_id": b["scope_id"], "scope_name": scope_name(conn, b["scope_type"], b["scope_id"]),
                    "expires_at": b["expires_at"], "created_at": b["created_at"], "assigned_by": b["assigned_by"],
                    "assigned_by_name": _name(conn, "user", b["assigned_by"]) if b["assigned_by"] else "", "role_name": role_name(conn, ROLE_ID)})
    return out


def candidates(conn: sqlite3.Connection) -> list[dict[str, str]]:
    from ..routers.access import active_user_ids
    from . import service_identity

    ids = sorted(active_user_ids(conn))
    people = [{"id": i, "name": _name(conn, "user", i)} for i in ids if not service_identity.is_service_user(conn, i)]
    return sorted(people, key=lambda p: p["name"].lower())[:500]


def scopes(conn: sqlite3.Connection, principal: Principal) -> list[dict[str, str]]:
    """The places a grant may be given in by this reader: the installation, the sites and buildings (and nothing else - a station is judged by its own chain)."""
    out: list[dict[str, str]] = []
    if grant_basis(conn, principal, INSTALLATION):
        out.append({"scope_type": "installation", "scope_id": "*", "name": scope_name(conn, "installation", "*")})
    for table, kind in (("sites", "site"), ("buildings", "building")):
        for r in conn.execute(f"SELECT id FROM {table} WHERE deleted_at IS NULL ORDER BY name").fetchall():
            if grant_basis(conn, principal, (kind, r["id"])):
                out.append({"scope_type": kind, "scope_id": r["id"], "name": scope_name(conn, kind, r["id"])})
    return out


def view(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    basis = grant_basis(conn, principal)
    if basis is None:
        raise ApiError(403, "forbidden", "אין הרשאה.")
    return {"basis": basis, "default_hours": int(de.setting(conn, de.GRANT_DEFAULT_H)), "max_hours": int(de.setting(conn, de.GRANT_MAX_H)),
            "can_no_expiry": basis == "system_admin", "holders": holder_rows(conn, principal), "candidates": candidates(conn), "scopes": scopes(conn, principal),
            "role_name": role_name(conn, ROLE_ID)}


def resolve_expiry(conn: sqlite3.Connection, principal: Principal, basis: str, expires_at: str | None, no_expiry: bool, now: dt.datetime) -> str | None:
    action = "door.emergency.grant"
    max_h = int(de.setting(conn, de.GRANT_MAX_H))
    limit = now + (dt.timedelta(days=ADMIN_MAX_DAYS) if basis == "system_admin" else dt.timedelta(hours=max_h))
    if no_expiry:
        if basis != "system_admin":
            raise _refuse(conn, principal, action, 422, "expiry_required", "מתן תפקיד בלי תוקף שמור למנהל מערכת.")
        return None
    if expires_at:
        try:
            at = parse_utc(expires_at)
        except ValueError:
            raise ApiError(422, "validation", "תוקף חייב להיות תאריך ושעה ב־UTC (Z).") from None
        if at <= now:
            raise _refuse(conn, principal, action, 422, "expiry_past", "התוקף כבר עבר.")
        if at > limit:
            raise _refuse(conn, principal, action, 422, "expiry_too_long", "התוקף ארוך מהמותר.", max_hours=max_h if basis != "system_admin" else None)
        return dw.iso(at)
    default_h = int(de.setting(conn, de.GRANT_DEFAULT_H))
    if default_h == 0:
        return None if basis == "system_admin" else dw.iso(now + dt.timedelta(hours=max_h))
    return dw.iso(now + dt.timedelta(hours=default_h))


def grant(conn: sqlite3.Connection, request: Request, principal: Principal, *, user_id: str, scope_type: str, scope_id: str, expires_at: str | None, no_expiry: bool,
          now: dt.datetime, dev_mode: bool = False, remote: bool = True) -> dict[str, Any]:
    from ..routers.access import BindingBody, _scope_exists, insert_binding, local_binding_check, user_known
    from ..services import revocation, service_identity
    from ..rbac import LOCAL_ID_PREFIX

    action = "door.emergency.grant"
    dw.require_person(conn, principal, action, dev_mode=dev_mode)
    if scope_type not in SCOPE_TYPES:
        raise ApiError(422, "validation", "היקף לא תקין.")
    scope = (scope_type, scope_id)
    basis = grant_basis(conn, principal, scope)
    if basis is None:
        raise _refuse(conn, principal, action, 403, "grant_not_allowed", "אין הרשאה לתת את תפקיד פתיחת החירום.", scope=f"{scope_type}:{scope_id}")
    if not _scope_exists(conn, *scope):
        raise ApiError(422, "scope_unknown", "ההיקף לא נמצא.")
    if not user_known(conn, user_id) or user_id not in _active_ids(conn):
        raise ApiError(404, "user_unknown", "המשתמש לא נמצא.")
    if service_identity.is_service_user(conn, user_id):
        raise _refuse(conn, principal, action, 422, "service_account", service_identity.SERVICE_ACCOUNT_HE, user=user_id)
    if basis != "system_admin" and user_id == principal.user_id:
        raise _refuse(conn, principal, action, 403, "grant_self", "אי אפשר לתת לעצמך את התפקיד.", user=user_id)
    expiry = resolve_expiry(conn, principal, basis, expires_at, no_expiry, now)
    if user_id.startswith(LOCAL_ID_PREFIX):
        if expiry is None:  # a local (Arx-only) identity holds this role as an addition to its one role, so it is always expiry-bound
            raise _refuse(conn, principal, action, 422, "expiry_required", "למשתמש Arx התפקיד ניתן רק עם תוקף.", user=user_id)
        local_binding_check(conn, principal, user_id, ROLE_ID, "allow", remote=remote)
    dup = conn.execute(_active_sql("AND subject_kind = 'user' AND subject_id = ? AND role_id = ? AND scope_type = ? AND scope_id = ? AND effect = 'allow'"),
                       (now_iso(), user_id, ROLE_ID, scope_type, scope_id)).fetchone()
    if dup:
        raise ApiError(409, "grant_exists", "לאדם הזה כבר יש את התפקיד בהיקף הזה. כדי לשנות תוקף יש לבטל ולתת מחדש.", details={"binding_id": dup["id"]})
    body = BindingBody(subject_kind="user", subject_id=user_id, role_id=ROLE_ID, scope_type=scope_type, scope_id=scope_id, effect="allow", expires_at=expiry)
    bid, rev = insert_binding(conn, principal, request, body, extra_audit={"via": "emergency_grant", "granter_basis": basis})
    audit(conn, actor=principal, action=action, decision="allowed", resource_type="user", resource_id=user_id,
          details={"binding_id": bid, "role_id": ROLE_ID, "scope": f"{scope_type}:{scope_id}", "expires_at": expiry, "granter_basis": basis,
                   "granter_roles": roles_of(conn, principal.user_id), "revision": rev})
    revocation.changed({user_id})
    return {"id": bid, "user_id": user_id, "scope_type": scope_type, "scope_id": scope_id, "expires_at": expiry, "revision": rev}


def _active_ids(conn: sqlite3.Connection) -> set[str]:
    from ..routers.access import active_user_ids

    return active_user_ids(conn)


def revoke(conn: sqlite3.Connection, settings: Any, request: Request, principal: Principal, binding_id: str, *, dev_mode: bool = False) -> dict[str, Any]:
    from ..routers.access import _terminate

    action = "door.emergency.grant_revoke"
    dw.require_person(conn, principal, action, dev_mode=dev_mode)
    b = conn.execute("SELECT * FROM bindings WHERE id = ? AND revoked_at IS NULL AND role_id = ? AND effect = 'allow'", (binding_id, ROLE_ID)).fetchone()
    if b is None:
        raise ApiError(404, "not_found", "השיוך לא נמצא או כבר בוטל.")
    basis = grant_basis(conn, principal, (b["scope_type"], b["scope_id"]))
    if basis is None:
        raise _refuse(conn, principal, action, 403, "grant_not_allowed", "אין הרשאה לבטל את תפקיד פתיחת החירום.", binding_id=binding_id)
    rev = bump_permission_revision(conn)
    conn.execute("UPDATE bindings SET revoked_at = ? WHERE id = ?", (now_iso(), binding_id))
    audit(conn, actor=principal, action="rbac.unbind", decision="allowed", resource_type=b["subject_kind"], resource_id=b["subject_id"],
          details={"binding_id": binding_id, "role_id": ROLE_ID, "scope": f"{b['scope_type']}:{b['scope_id']}", "revision": rev, "via": "emergency_grant"})
    audit(conn, actor=principal, action=action, decision="allowed", resource_type=b["subject_kind"], resource_id=b["subject_id"],
          details={"binding_id": binding_id, "role_id": ROLE_ID, "scope": f"{b['scope_type']}:{b['scope_id']}", "expires_at": b["expires_at"], "revoker_basis": basis,
                   "revoker_roles": roles_of(conn, principal.user_id), "revision": rev})
    users = {b["subject_id"]} if b["subject_kind"] == "user" else set()
    _terminate(conn, settings, users)
    return {"revoked": binding_id, "revision": rev}
