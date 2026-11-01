"""USR1 (docs/design/USR1_HA_USERS_FROM_ARX.md): Settings › משתמשים והרשאות › משתמשי מערכת הבית - create home-system users
(ordinary users, never administrators) with ONE Arx role binding, and deactivate / activate / delete ONLY the users Arx itself
created (table ha_managed_users).

Every route: `users.ha_manage` (a SYSTEM permission: built-in system_admin only) at installation scope, audited on refusal.
Every write additionally needs the actor to be an active home-system administrator in the synced directory (security spec §8:
the add-on's administrator token never does what the person may not do) - `ha_admin_required`.

The password is a SecretStr: passed once to services/ha_user_admin and dropped - never stored, logged, audited or answered.
Audit rows carry ids only. HA calls run outside the request's write lock (db.unlocked).

USR1-263: the optional administrator token is the secrets-store entry `ha_users_token` (Settings > Connections > Secrets,
services/secrets_store.py; encrypted, write-only), read from the store on every request (`_ha_settings`); it is never an
add-on option."""
from __future__ import annotations

import dataclasses
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field, SecretStr

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import get_setting, new_id, now_iso, set_setting, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, all_roles, require, role_name, scope_name
from ..services import ha_user_admin as hua
from ..services import revocation, secrets_store
from ..services.tickets import out_documents
from . import access as acc

router = APIRouter()

PERMISSION = "users.ha_manage"
MAX_MANAGED = 50
LIVE_STATES = ("creating", "active", "inactive", "needs_repair")
ACCESS_KEY = "ha_users.access"
SECRET = "ha_users_token"  # the secrets-store entry (services/secrets_store.SPECS)

PASSWORD_HE = {
    "too_short": f"הסיסמה קצרה מדי (לפחות {hua.PASSWORD_MIN} תווים).",
    "too_long": f"הסיסמה ארוכה מדי (עד {hua.PASSWORD_MAX} תווים).",
    "repetitive": "הסיסמה חוזרת על אותם תווים.",
    "common": "הסיסמה נפוצה מדי וקלה לניחוש.",
    "sequence": "הסיסמה היא רצף מקלדת או ספרות.",
    "contains_username": "הסיסמה מכילה את שם המשתמש.",
    "contains_name": "הסיסמה מכילה את השם המוצג.",
}


# ---------------------------------------------------------------- guards


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _ha_settings(request: Request, conn: sqlite3.Connection):
    """The request's settings with `ha_users_token` taken from the secrets store (a stored value; a cleared or unreadable entry =
    none, fail closed; no entry at all = the developer environment HA_USERS_TOKEN). The value never leaves this process."""
    settings = settings_of(request)
    return dataclasses.replace(settings, ha_users_token=secrets_store.current_value(conn, settings, SECRET))


def actor_is_ha_admin(conn: sqlite3.Connection, principal: Principal) -> bool:
    row = conn.execute("SELECT is_admin, is_active FROM ha_users WHERE id = ?", (principal.user_id,)).fetchone()
    return bool(row and row["is_admin"] and row["is_active"])


def _guard_write(conn: sqlite3.Connection, principal: Principal, request: Request, action: str, resource_id: str = "*") -> None:
    """users.ha_manage (audited by require) and then the home-system administrator check (audited here)."""
    require(conn, principal, PERMISSION, INSTALLATION)
    if not actor_is_ha_admin(conn, principal):
        audit(conn, actor=principal, action=action, decision="denied", resource_type="ha_user", resource_id=resource_id, reason="ha_admin_required", request_id=_rid(request))
        raise ApiError(403, "ha_admin_required", "רק מנהל של מערכת הבית רשאי לנהל את המשתמשים שלה.")


def _refuse(conn: sqlite3.Connection, principal: Principal, request: Request, action: str, resource_id: str, status: int, code: str, message: str) -> ApiError:
    audit(conn, actor=principal, action=action, decision="denied", resource_type="ha_user", resource_id=resource_id, reason=code, request_id=_rid(request))
    return ApiError(status, code, message)


def _failed(conn: sqlite3.Connection, principal: Principal, request: Request, action: str, resource_id: str, exc: hua.HaUserError, details: dict[str, Any] | None = None) -> ApiError:
    if exc.kind in ("not_authorised", "not_configured", "unavailable"):
        _store_access(conn, exc.kind)
    audit(conn, actor=principal, action=action, decision="failed", resource_type="ha_user", resource_id=resource_id, reason=exc.kind,
          request_id=_rid(request), details={**(details or {}), "ha_code": exc.ha_code} if exc.ha_code else details)
    return hua.api_error(exc)


def _store_access(conn: sqlite3.Connection, state: str) -> None:
    import json

    set_setting(conn, ACCESS_KEY, json.dumps({"state": state, "checked_at": now_iso()}))


def _access(conn: sqlite3.Connection) -> dict[str, Any]:
    import json

    try:
        raw = json.loads(get_setting(conn, ACCESS_KEY) or "{}")
    except ValueError:
        raw = {}
    return {"state": raw.get("state") or "unknown", "checked_at": raw.get("checked_at")}


def _managed(conn: sqlite3.Connection, ha_user_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM ha_managed_users WHERE ha_user_id = ? AND state != 'deleted'", (ha_user_id,)).fetchone()


def would_strand_admins(conn: sqlite3.Connection, user_id: str) -> bool:
    """Would turning this user inactive leave the installation without an active Arx administrator? A dry run inside a
    savepoint that is always rolled back (nothing is written)."""
    before = acc.admin_count(conn)
    if not before:
        return False
    conn.execute("SAVEPOINT usr1_probe")
    try:
        conn.execute("UPDATE users SET active = 0 WHERE id = ?", (user_id,))
        after = acc.admin_count(conn)
    finally:
        conn.execute("ROLLBACK TO usr1_probe")
        conn.execute("RELEASE usr1_probe")
    return after == 0


def _row(conn: sqlite3.Connection, r: sqlite3.Row, principal: Principal) -> dict[str, Any]:
    creator = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (r["created_by"],)).fetchone()
    return {
        "ha_user_id": r["ha_user_id"],
        "username": r["username"],
        "display_name": r["display_name"],
        "role_id": r["role_id"],
        "role_name": role_name(conn, r["role_id"]),
        "scope_type": r["scope_type"],
        "scope_id": r["scope_id"],
        "scope_name": scope_name(conn, r["scope_type"], r["scope_id"]),
        "state": r["state"],
        "repair": r["repair"],
        "person": bool(r["person_id"]),
        "created_at": r["created_at"],
        "created_by_name": (creator["display_name"] or creator["username"]) if creator else None,
        "is_self": r["ha_user_id"] == principal.user_id,
    }


# ---------------------------------------------------------------- read


@router.get("/ha-users")
def list_managed(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    rows = conn.execute("SELECT * FROM ha_managed_users WHERE state IN ('active', 'inactive', 'needs_repair') ORDER BY created_at").fetchall()
    roles = all_roles(conn) if acc.full_authority(conn, principal) else {r: [] for r in acc.delegable_roles(conn)}
    return {
        "users": [_row(conn, r, principal) for r in rows],
        "can_manage": True,
        "actor_ha_admin": actor_is_ha_admin(conn, principal),
        "transport": hua.transport_kind(_ha_settings(request, conn)),
        "access": _access(conn),
        "roles": [{"id": rid, "name": role_name(conn, rid)} for rid in sorted(roles)],
        "scopes": [s for s in acc.assign_scopes(conn, principal) if s["type"] in ("installation", "site", "building", "floor")],
        "password": {"min_length": hua.PASSWORD_MIN, "max_length": hua.PASSWORD_MAX},
        "limit": MAX_MANAGED,
    }


@router.post("/ha-users/check")
def check(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Read-only probe: does the admin-only user list answer with the configured token?"""
    require(conn, principal, PERMISSION, INSTALLATION)
    settings = _ha_settings(request, conn)
    with unlocked(conn):
        state = hua.check_access(settings)
    _store_access(conn, state)
    audit(conn, actor=principal, action="ha_users.check", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request), details={"state": state, "transport": hua.transport_kind(settings)})
    return {"access": _access(conn), "transport": hua.transport_kind(settings)}


# ---------------------------------------------------------------- create


class CreateBody(BaseModel):
    # extra keys are refused, so `is_admin`, `group_ids` or `is_owner` can never even be requested
    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1, max_length=60)
    username: str = Field(min_length=3, max_length=32, pattern=hua.USERNAME_PATTERN)
    password: SecretStr = Field(max_length=256)
    role_id: str = Field(min_length=1, max_length=60)
    scope_type: str = Field(default="installation", pattern="^(installation|site|building|floor)$")
    scope_id: str = Field(default="*", min_length=1, max_length=200)
    create_person: bool = True
    local_only: bool = False
    request_key: str | None = Field(default=None, min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


def _bind(conn: sqlite3.Connection, principal: Principal, request: Request, ha_user_id: str, body: CreateBody) -> str:
    """The Arx side of a created user: the directory mirror row (the bridge's next push overwrites it), the user row and ONE
    binding - the chosen role at the chosen scope, nothing else. Raises on any failure (the caller compensates)."""
    now = now_iso()
    conn.execute(
        "INSERT INTO ha_users(id, name, username, is_active, is_admin, group_ids_json, synced_at) VALUES (?, ?, ?, 1, 0, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET name = excluded.name, username = excluded.username",
        (ha_user_id, body.display_name, body.username, f'["{hua.USERS_GROUP}"]', now),
    )
    binding = acc.BindingBody(subject_kind="user", subject_id=ha_user_id, role_id=body.role_id, scope_type=body.scope_type, scope_id=body.scope_id)
    acc.validate_binding(conn, principal, binding)
    bid, _rev = acc.insert_binding(conn, principal, request, binding, extra_audit={"via": "ha_users.create"})
    return bid


@router.post("/ha-users", status_code=201)
def create(body: CreateBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    action = "ha_users.create"
    _guard_write(conn, principal, request, action)
    settings = _ha_settings(request, conn)
    if body.request_key:
        prior = conn.execute("SELECT * FROM ha_managed_users WHERE request_key = ?", (body.request_key,)).fetchone()
        if prior is not None:
            if prior["state"] in ("active", "inactive", "needs_repair"):
                return {"user": _row(conn, prior, principal), "replayed": True}
            raise ApiError(409, "request_in_progress", "הבקשה הזו כבר בטיפול.")
    problem = hua.password_problem(body.password.get_secret_value(), body.username, body.display_name)
    if problem:
        raise ApiError(422, "password_weak", PASSWORD_HE[problem], details={"rule": problem})  # names the rule only, never the value
    if conn.execute(f"SELECT COUNT(*) FROM ha_managed_users WHERE state IN ({','.join('?' * len(LIVE_STATES))})", LIVE_STATES).fetchone()[0] >= MAX_MANAGED:
        raise _refuse(conn, principal, request, action, "*", 409, "limit_reached", f"אפשר לנהל מכאן עד {MAX_MANAGED} משתמשים.")
    # the directory mirror keeps a row for a user Arx deleted (HA freed its username): those rows do not count
    taken = conn.execute("SELECT 1 FROM ha_users WHERE lower(username) = ? AND id NOT IN (SELECT ha_user_id FROM ha_managed_users WHERE state = 'deleted')",
                         (body.username,)).fetchone() or conn.execute(
        f"SELECT 1 FROM ha_managed_users WHERE lower(username) = ? AND state IN ({','.join('?' * len(LIVE_STATES))})", (body.username, *LIVE_STATES)).fetchone()
    if taken:
        raise _refuse(conn, principal, request, action, "*", 409, "username_taken", "שם המשתמש כבר קיים במערכת הבית.")
    # the binding is checked BEFORE anything is created: the same rules as the bindings API (role, scope, delegation)
    if body.role_id not in all_roles(conn):
        raise ApiError(422, "role_unknown", "תפקיד לא מוכר.")
    if not acc._scope_exists(conn, body.scope_type, body.scope_id):  # noqa: SLF001 - the bindings API's own scope check
        raise ApiError(422, "scope_unknown", "ההיקף (אתר / מבנה / קומה) לא נמצא.")
    acc.check_delegation(conn, principal, body.role_id, (body.scope_type, body.scope_id), "user", None, op="bind", effect="allow")

    row_id = new_id()
    now = now_iso()
    conn.execute(
        "INSERT INTO ha_managed_users(id, request_key, username, display_name, role_id, scope_type, scope_id, state, created_by, created_at, updated_by, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, 'creating', ?, ?, ?, ?)",
        (row_id, body.request_key, body.username, body.display_name, body.role_id, body.scope_type, body.scope_id, principal.user_id, now, principal.user_id, now),
    )
    base = {"row_id": row_id, "role_id": body.role_id, "scope": f"{body.scope_type}:{body.scope_id}"}
    try:
        with unlocked(conn):  # commits the 'creating' row first: a crash mid-call leaves a visible row
            created = hua.create_user(settings, name=body.display_name, username=body.username, password=body.password.get_secret_value(),
                                      local_only=body.local_only, create_person=body.create_person)
    except hua.HaUserError as exc:
        if exc.ha_user_id:  # created in HA and the compensation failed: keep a visible repair row with the id
            conn.execute("UPDATE ha_managed_users SET ha_user_id = ?, state = 'needs_repair', repair = 'compensation_failed', updated_at = ? WHERE id = ?", (exc.ha_user_id, now_iso(), row_id))
        else:
            conn.execute("DELETE FROM ha_managed_users WHERE id = ?", (row_id,))
        raise _failed(conn, principal, request, action, exc.ha_user_id or row_id, exc, base) from None
    if created.person_failed:
        base["person_missing"] = True
    conn.execute("SAVEPOINT usr1_bind")
    try:
        binding_id = _bind(conn, principal, request, created.ha_user_id, body)
    except Exception as bind_exc:  # noqa: BLE001 - any Arx-side failure: undo it, then undo the HA user
        conn.execute("ROLLBACK TO usr1_bind")
        conn.execute("RELEASE usr1_bind")
        with unlocked(conn):
            gone = hua.compensating_delete(settings, created.ha_user_id, created.person_id)
        if gone:
            conn.execute("DELETE FROM ha_managed_users WHERE id = ?", (row_id,))
        else:
            conn.execute("UPDATE ha_managed_users SET ha_user_id = ?, person_id = ?, state = 'needs_repair', repair = 'binding_failed', updated_at = ? WHERE id = ?",
                         (created.ha_user_id, created.person_id, now_iso(), row_id))
        audit(conn, actor=principal, action=action, decision="failed", resource_type="ha_user", resource_id=created.ha_user_id, reason="binding_failed",
              request_id=_rid(request), details={**base, "compensated": gone, "error": bind_exc.code if isinstance(bind_exc, ApiError) else type(bind_exc).__name__})
        raise ApiError(500 if gone else 502, "binding_failed",
                       "המשתמש לא נוצר: שיוך התפקיד ב־Arx נכשל, והמשתמש הוסר שוב ממערכת הבית." if gone
                       else "שיוך התפקיד נכשל וההסרה ממערכת הבית לא הצליחה; המשתמש מסומן 'דורש תיקון'.") from None
    conn.execute("RELEASE usr1_bind")
    conn.execute(
        "UPDATE ha_managed_users SET ha_user_id = ?, person_id = ?, binding_id = ?, state = 'active', repair = ?, updated_at = ? WHERE id = ?",
        (created.ha_user_id, created.person_id, binding_id, "person_missing" if created.person_failed else None, now_iso(), row_id),
    )
    _store_access(conn, "ok")
    audit(conn, actor=principal, action=action, decision="allowed", resource_type="ha_user", resource_id=created.ha_user_id, request_id=_rid(request),
          details={**base, "binding_id": binding_id, "person": bool(created.person_id)})
    revocation.changed({created.ha_user_id})
    row = conn.execute("SELECT * FROM ha_managed_users WHERE id = ?", (row_id,)).fetchone()
    return {"user": _row(conn, row, principal), "replayed": False}


# ---------------------------------------------------------------- deactivate / activate


class ConfirmBody(BaseModel):
    confirm: bool


def _set_active(ha_user_id: str, active: bool, body: ConfirmBody, request: Request, principal: Principal, conn: sqlite3.Connection) -> dict[str, Any]:
    action = "ha_users.activate" if active else "ha_users.deactivate"
    _guard_write(conn, principal, request, action, ha_user_id)
    if body.confirm is not True:
        raise ApiError(422, "confirm_required", "נדרש אישור מפורש.")
    row = _managed(conn, ha_user_id)
    if row is None:
        raise _refuse(conn, principal, request, action, ha_user_id, 404, "not_managed", "המשתמש לא נוצר דרך Arx, ולכן מנוהל רק במסך של מערכת הבית.")
    if row["state"] not in ("active", "inactive"):
        raise _refuse(conn, principal, request, action, ha_user_id, 409, "needs_repair", "המשתמש דורש תיקון; אפשר רק למחוק אותו.")
    if ha_user_id == principal.user_id:
        raise _refuse(conn, principal, request, action, ha_user_id, 409, "self_target", "אי אפשר לשנות את המשתמש שלך מכאן.")
    if _directory_admin(conn, ha_user_id):
        raise _refuse(conn, principal, request, action, ha_user_id, 409, "target_not_safe", "המשתמש הפך למנהל במערכת הבית ולכן אינו מנוהל מכאן.")
    if not active and would_strand_admins(conn, ha_user_id):
        raise _refuse(conn, principal, request, action, ha_user_id, 409, "last_admin", "השינוי משאיר את ההתקנה בלי מנהל מערכת פעיל; הקצה מנהל אחר קודם.")
    try:
        with unlocked(conn):
            hua.set_active(_ha_settings(request, conn), ha_user_id, active)
    except hua.HaUserError as exc:
        if exc.kind == "not_found":
            conn.execute("UPDATE ha_managed_users SET state = 'needs_repair', repair = 'missing_in_ha', updated_by = ?, updated_at = ? WHERE id = ?", (principal.user_id, now_iso(), row["id"]))
        raise _failed(conn, principal, request, action, ha_user_id, exc) from None
    flag = 1 if active else 0
    conn.execute("UPDATE ha_managed_users SET state = ?, updated_by = ?, updated_at = ? WHERE id = ?", ("active" if active else "inactive", principal.user_id, now_iso(), row["id"]))
    conn.execute("UPDATE ha_users SET is_active = ? WHERE id = ?", (flag, ha_user_id))
    conn.execute("UPDATE users SET active = ? WHERE id = ?", (flag, ha_user_id))
    audit(conn, actor=principal, action=action, decision="allowed", resource_type="ha_user", resource_id=ha_user_id, request_id=_rid(request), details={"row_id": row["id"]})
    if active:
        revocation.changed({ha_user_id})
    else:
        acc._terminate(conn, settings_of(request), {ha_user_id})  # noqa: SLF001 - the access API's own "access taken away" path
        out_documents.revoke_for_inactive_users_safe(conn)  # TEMPLINK-2320 (owner 4A): his report links die at once
    return {"user": _row(conn, conn.execute("SELECT * FROM ha_managed_users WHERE id = ?", (row["id"],)).fetchone(), principal)}


def _directory_admin(conn: sqlite3.Connection, ha_user_id: str) -> bool:
    row = conn.execute("SELECT is_admin FROM ha_users WHERE id = ?", (ha_user_id,)).fetchone()
    return bool(row and row["is_admin"])


@router.post("/ha-users/{ha_user_id}/deactivate")
def deactivate(ha_user_id: str, body: ConfirmBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _set_active(ha_user_id, False, body, request, principal, conn)


@router.post("/ha-users/{ha_user_id}/activate")
def activate(ha_user_id: str, body: ConfirmBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _set_active(ha_user_id, True, body, request, principal, conn)


# ---------------------------------------------------------------- delete


class DeleteBody(BaseModel):
    confirm_username: str = Field(min_length=1, max_length=64)


@router.post("/ha-users/{ha_user_id}/delete")
def delete(ha_user_id: str, body: DeleteBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    action = "ha_users.delete"
    _guard_write(conn, principal, request, action, ha_user_id)
    row = _managed(conn, ha_user_id)
    if row is None or row["state"] == "creating":
        raise _refuse(conn, principal, request, action, ha_user_id, 404, "not_managed", "המשתמש לא נוצר דרך Arx, ולכן מנוהל רק במסך של מערכת הבית.")
    if body.confirm_username.casefold() != str(row["username"]).casefold():  # HAUSER-295 follow-up: case-insensitive (HA lower-cases usernames); whitespace stays exact
        raise ApiError(422, "confirm_mismatch", "יש להקליד את שם המשתמש בדיוק כדי לאשר את המחיקה.")
    if ha_user_id == principal.user_id:
        raise _refuse(conn, principal, request, action, ha_user_id, 409, "self_target", "אי אפשר למחוק את המשתמש שלך.")
    if _directory_admin(conn, ha_user_id):
        raise _refuse(conn, principal, request, action, ha_user_id, 409, "target_not_safe", "המשתמש הפך למנהל במערכת הבית ולכן אינו נמחק מכאן.")
    if would_strand_admins(conn, ha_user_id):
        raise _refuse(conn, principal, request, action, ha_user_id, 409, "last_admin", "המחיקה משאירה את ההתקנה בלי מנהל מערכת פעיל; הקצה מנהל אחר קודם.")
    # owner rule (integ/264): an Arx-only (USR2) identity linked to this HA user blocks the delete - the manager unlinks first
    # (Settings > Arx users). Refused before Home Assistant is called; the audit row carries ids only.
    linked = [r[0] for r in conn.execute("SELECT local_user_id FROM identity_links WHERE ha_user_id = ? ORDER BY local_user_id", (ha_user_id,))]
    if linked:
        audit(conn, actor=principal, action=action, decision="denied", resource_type="ha_user", resource_id=ha_user_id, reason="linked_local_identity",
              request_id=_rid(request), details={"local_user_ids": linked})
        raise ApiError(409, "linked_local_identity", "למשתמש הזה מקושר משתמש Arx. יש לבטל את הקישור במסך 'משתמשי Arx' לפני המחיקה.",
                       details={"local_user_ids": linked})
    settings = _ha_settings(request, conn)
    try:
        with unlocked(conn):
            existed = hua.delete_user(settings, ha_user_id, row["person_id"])
    except hua.HaUserError as exc:
        raise _failed(conn, principal, request, action, ha_user_id, exc, {"row_id": row["id"]}) from None
    conn.execute("SAVEPOINT usr1_cleanup")
    try:
        revoked = 0
        for b in conn.execute("SELECT * FROM bindings WHERE subject_kind = 'user' AND subject_id = ? AND revoked_at IS NULL", (ha_user_id,)).fetchall():
            acc.revoke_one(conn, principal, request, b)
            revoked += 1
        conn.execute("DELETE FROM group_members WHERE user_id = ?", (ha_user_id,))
        conn.execute("UPDATE users SET active = 0 WHERE id = ?", (ha_user_id,))
        conn.execute("UPDATE ha_users SET is_active = 0 WHERE id = ?", (ha_user_id,))
        conn.execute("UPDATE ha_managed_users SET state = 'deleted', repair = NULL, deleted_at = ?, updated_by = ?, updated_at = ? WHERE id = ?", (now_iso(), principal.user_id, now_iso(), row["id"]))
    except Exception as exc:  # noqa: BLE001 - the user is gone in HA: keep a repair row, the next delete finishes the cleanup
        conn.execute("ROLLBACK TO usr1_cleanup")
        conn.execute("RELEASE usr1_cleanup")
        conn.execute("UPDATE ha_managed_users SET state = 'needs_repair', repair = 'cleanup_failed', updated_by = ?, updated_at = ? WHERE id = ?", (principal.user_id, now_iso(), row["id"]))
        audit(conn, actor=principal, action=action, decision="failed", resource_type="ha_user", resource_id=ha_user_id, reason="cleanup_failed", request_id=_rid(request),
              details={"row_id": row["id"], "error": exc.code if isinstance(exc, ApiError) else type(exc).__name__})
        raise ApiError(500, "cleanup_failed", "המשתמש נמחק ממערכת הבית, אך הניקוי ב־Arx לא הושלם; המשתמש מסומן 'דורש תיקון' ואפשר למחוק שוב.") from None
    conn.execute("RELEASE usr1_cleanup")
    audit(conn, actor=principal, action=action, decision="allowed", resource_type="ha_user", resource_id=ha_user_id, request_id=_rid(request),
          details={"row_id": row["id"], "bindings_revoked": revoked, "already_gone": not existed})
    acc._terminate(conn, settings, {ha_user_id})  # noqa: SLF001
    out_documents.revoke_for_inactive_users_safe(conn)  # TEMPLINK-2320 (owner 4A): his report links die at once
    return {"deleted": ha_user_id, "already_gone": not existed}
