"""Custom roles and the delegation allow-list (T082).

CR-SPLIT-ACCESS-2440 (review 05:P2-08): moved unchanged out of routers/access.py, which still exports every name."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import bump_permission_revision, new_id, now_iso, permission_revision, set_setting
from ..errors import ApiError
from ..i18n import lang_of, localize_for
from ..rbac import INSTALLATION, Principal, ROLES, ROLE_NAMES_HE, all_roles, require, role_name
from ..services import access_custom_roles_store as store
from ..services import revocation
from ..wire import wire
from ..wire.access_custom_roles import CustomRole, CustomRoleDeleted, CustomRolePreview, CustomRoleUpdated, DelegationSaved, DelegationState
from ..services.rbac_admin import DEFAULT_DELEGABLE, PERMISSION_LABELS, SENSITIVE, _check_delegable_flag, _custom_role_dict, _rid, _role_impact, _terminate, _validate_role_body, delegable_roles, delegation_block, rendered_labels

router = APIRouter()


# ---------------------------------------------------------------- custom roles and delegation (T082)

# body-size guards only (the catalogue decides what is valid): wide enough for "select all" of the regular and of the
# sensitive lists, which the 20 / 40 of T082 no longer were (28 sensitive grants by 0.1.148 - owner hit the limit).
# 2.7.0 gate: the fixed 60 broke again at 61 sensitive grants (access.external.grant, tickets.technician_requests and
# tickets.external all sit in `sensitive_permissions_not_implied` - correctly: no role implies them, and a custom role that
# carries any of them is never delegable). The caps now follow the catalogue with headroom, so a new permission cannot make
# "select all" fail again; they stay bounded (a body cannot grow beyond the catalogue plus the margin).
ROLE_PERMISSIONS_MAX = max(120, len(PERMISSION_LABELS) + 40)
ROLE_SENSITIVE_MAX = max(60, len(SENSITIVE) + 20)


class CustomRoleBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: str = Field(default="", max_length=300)
    permissions: list[str] = Field(default_factory=list, max_length=ROLE_PERMISSIONS_MAX)
    sensitive: list[str] = Field(default_factory=list, max_length=ROLE_SENSITIVE_MAX)
    delegable: bool = False


class CustomRolePatch(CustomRoleBody):
    revision: int = Field(ge=1)


class RolePreviewBody(BaseModel):
    role_id: str | None = Field(default=None, max_length=60)
    permissions: list[str] = Field(default_factory=list, max_length=ROLE_PERMISSIONS_MAX)
    sensitive: list[str] = Field(default_factory=list, max_length=ROLE_SENSITIVE_MAX)


class DelegationBody(BaseModel):
    delegable_roles: list[str] = Field(default_factory=list, max_length=50)


@router.post("/access/roles", status_code=201, **wire(CustomRole))
def create_custom_role(body: CustomRoleBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    perms, sens = _validate_role_body(body.permissions, body.sensitive)
    _check_delegable_flag(body.delegable, perms, sens)
    if body.name.strip() in {role_name(conn, r) for r in ROLE_NAMES_HE} or store.live_name_taken(conn, body.name.strip()):
        raise ApiError(409, "role_name_taken", "כבר קיים תפקיד בשם הזה.")
    rid = f"custom-{new_id()[:8]}"
    now = now_iso()
    store.insert_custom_role(conn, rid, body.name.strip(), body.description, json.dumps(perms), json.dumps(sens), int(body.delegable), principal.user_id, principal.username, now)
    rev = bump_permission_revision(conn)
    audit(conn, actor=principal, action="rbac.role.create", decision="allowed", resource_type="role", resource_id=rid, request_id=_rid(request), details={"name": body.name.strip(), "permissions": perms, "sensitive": sens, "delegable": body.delegable, "revision": rev})
    return _custom_role_dict(conn, store.custom_role(conn, rid))


@router.post("/access/roles/preview", **wire(CustomRolePreview))
def preview_role_change(body: RolePreviewBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Before saving: who holds the role today (users, groups, scopes) and which permissions the change adds or removes."""
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    perms, sens = _validate_role_body(body.permissions, body.sensitive)
    if body.role_id and body.role_id not in all_roles(conn):
        raise ApiError(404, "not_found", "התפקיד לא נמצא.")
    return localize_for(conn, principal, {**_role_impact(conn, body.role_id, sorted(set(perms) | set(sens))), "labels": rendered_labels(conn, lang_of(conn, principal))})  # I18N-BACKEND-2490 (third pass): role / scope names in the reader's language


@router.patch("/access/roles/{role_id}", **wire(CustomRoleUpdated))
def update_custom_role(role_id: str, body: CustomRolePatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    if role_id in ROLES:
        raise ApiError(409, "builtin_role", "תפקידים מובנים אינם ניתנים לעריכה; צור תפקיד מותאם.")
    r = store.live_custom_role(conn, role_id)
    if not r:
        raise ApiError(404, "not_found", "התפקיד לא נמצא.")
    if body.revision != r["revision"]:
        raise ApiError(409, "stale_revision", "התפקיד השתנה בינתיים; טען מחדש.", details={"current_revision": r["revision"], "sent_revision": body.revision})
    perms, sens = _validate_role_body(body.permissions, body.sensitive)
    _check_delegable_flag(body.delegable, perms, sens)
    impact = _role_impact(conn, role_id, sorted(set(perms) | set(sens)))
    store.update_custom_role(conn, role_id, body.name.strip(), body.description, json.dumps(perms), json.dumps(sens), int(body.delegable), principal.user_id, principal.username, now_iso())
    rev = bump_permission_revision(conn)
    if impact["removed"]:
        _terminate(conn, settings_of(request), {u["id"] for u in impact["users"]})
    elif impact["added"]:
        revocation.changed({u["id"] for u in impact["users"]})
    audit(conn, actor=principal, action="rbac.role.update", decision="allowed", resource_type="role", resource_id=role_id, request_id=_rid(request),
          details={"added": impact["added"], "removed": impact["removed"], "affected_users": len(impact["users"]), "affected_bindings": impact["bindings"], "delegable": body.delegable, "revision": rev})
    return localize_for(conn, principal, {**_custom_role_dict(conn, store.custom_role(conn, role_id)), "impact": impact})  # I18N-BACKEND-2490 (third pass): role / scope names in the reader's language


@router.delete("/access/roles/{role_id}", **wire(CustomRoleDeleted))
def delete_custom_role(role_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    if role_id in ROLES:
        raise ApiError(409, "builtin_role", "תפקידים מובנים אינם נמחקים.")
    r = store.live_custom_role(conn, role_id)
    if not r:
        raise ApiError(404, "not_found", "התפקיד לא נמצא.")
    impact = _role_impact(conn, role_id, [])
    if impact["bindings"]:
        raise ApiError(409, "role_in_use", "התפקיד עדיין משויך; בטל את השיוכים קודם.", details={"bindings": impact["bindings"], "users": impact["users"], "groups": impact["groups"]})
    store.delete_custom_role(conn, role_id, now_iso(), principal.user_id, principal.username)
    rev = bump_permission_revision(conn)
    audit(conn, actor=principal, action="rbac.role.delete", decision="allowed", resource_type="role", resource_id=role_id, request_id=_rid(request), details={"name": r["name_he"], "revision": rev})
    return {"deleted": role_id, "revision": rev}


DELEGATION_RULES = [
    "מנהל אתר משייך רק תפקידים מרשימה זו - לעולם לא מנהל מערכת, מנהל אתר או תפקיד מותאם עם הרשאה רגישה",
    "רק הרשאות שהוא מחזיק בעצמו באותו היקף, ורק בתוך ההיקף שלו",
    "לא את עצמו: לא שיוך ישיר ולא דרך קבוצה שהוא חבר בה",
    "קבוצה רק כשכל השיוכים שלה בתוך ההיקף שלו; יצירה, שינוי שם ומחיקה של קבוצות - מנהל המערכת בלבד",
    "אין שינוי של תפקידים משותפים; בקשה מרובה נבדקת פריט־פריט ונדחית כולה בפריט הראשון שנחסם",
]


@router.get("/access/delegation", **wire(DelegationState))
def get_delegation(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, "identity.directory.read", INSTALLATION)
    blocked = {rid: delegation_block(conn, rid) for rid in all_roles(conn)}
    return {"delegable_roles": delegable_roles(conn), "default": DEFAULT_DELEGABLE, "rules": DELEGATION_RULES,
            "blocked": {k: v for k, v in blocked.items() if v}, "revision": permission_revision(conn)}


@router.put("/access/delegation", **wire(DelegationSaved))
def set_delegation(body: DelegationBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Replace the allow-list (rbac.roles.manage). Built-in roles live in the setting,
    custom roles in their own `delegable` flag - this call keeps both in step, so the list sent is the whole truth."""
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    known = all_roles(conn)
    chosen = sorted({r for r in body.delegable_roles if r in known})
    blocked = {r: delegation_block(conn, r) for r in chosen if delegation_block(conn, r)}
    if blocked:
        system = any(v == "system_role" for v in blocked.values())
        raise ApiError(422, "system_role_not_delegable" if system else "sensitive_role_not_delegable",
                       "תפקיד עם הרשאות מערכת אינו ניתן להאצלה." if system else "תפקיד מותאם עם הרשאה רגישה או עם שיוך תפקידים אינו ניתן להאצלה.",
                       details={"blocked": sorted(blocked), "reasons": blocked})
    before = delegable_roles(conn)
    set_setting(conn, "rbac.delegable_roles", json.dumps([r for r in chosen if r in ROLES]))
    for r in store.live_delegable_flags(conn):
        want = 1 if r["id"] in chosen else 0
        if int(r["delegable"]) != want:
            store.set_delegable(conn, r["id"], want, principal.user_id, principal.username, now_iso())
    rev = bump_permission_revision(conn)
    audit(conn, actor=principal, action="rbac.delegation.update", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request), details={"before": before, "after": delegable_roles(conn), "revision": rev})
    return {"delegable_roles": delegable_roles(conn), "revision": rev}
