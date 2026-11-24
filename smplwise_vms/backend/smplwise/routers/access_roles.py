"""The role catalogue as the access screens show it (built-in and custom roles, labels, what the caller may hand out).

CR-SPLIT-ACCESS-2440 (review 05:P2-08): moved unchanged out of routers/access.py, which still exports every name."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends

from ..auth import current_principal_ro, get_read_conn
from ..i18n import lang_of, localize
from ..rbac import INSTALLATION, LEGACY_PERMISSIONS, Principal, ROLES, authorize, require, role_name
from ..services import access_roles_store as store
from ..services.rbac_admin import SENSITIVE, SYSTEM_PERMISSIONS, _custom_role_dict, assigns_anywhere, delegable_roles, delegation_block, full_authority, rendered_labels
from ..wire import access_roles as W
from ..wire import wire

router = APIRouter()


# ---------------------------------------------------------------- roles

@router.get("/access/roles", **wire(W.RoleCatalogue))
def list_roles(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The role catalogue. A delegated administrator (rbac.assign somewhere, no directory right) gets only the roles
    they may hand out - the wizard never offers system_admin, site_admin or anything off the allow-list."""
    delegated_only = not authorize(conn, principal, "identity.directory.read", INSTALLATION).allowed and assigns_anywhere(conn, principal)
    if not delegated_only:
        require(conn, principal, "identity.directory.read", INSTALLATION)
    delegable = delegable_roles(conn)
    roles = []
    for rid, perms in ROLES.items():
        roles.append({
            "id": rid, "name": role_name(conn, rid), "permissions": list(perms), "custom": False, "description": "", "revision": None, "delegable": rid in delegable,
            "sensitive_included": [p for p in perms if p in SENSITIVE], "sensitive_missing": [p for p in SENSITIVE if p not in perms and p not in LEGACY_PERMISSIONS], "system_role": bool(set(perms) & SYSTEM_PERMISSIONS),
            "delegation_block": delegation_block(conn, rid),
        })
    for r in store.live_custom_roles(conn):
        roles.append(_custom_role_dict(conn, r))
    if delegated_only:
        roles = [r for r in roles if r["id"] in delegable]
    lang = lang_of(conn, principal)
    return {"roles": localize(roles, lang), "labels": rendered_labels(conn, lang),  # I18N-BACKEND-2490: in the reader's language (names and labels)
            "sensitive": SENSITIVE, "system_permissions": sorted(SYSTEM_PERMISSIONS), "delegable_roles": delegable,
            "legacy_permissions": LEGACY_PERMISSIONS,  # WXPERM: old name -> the permission it stands for (the editor hides an old name a role does not hold)
            "can_manage_roles": authorize(conn, principal, "rbac.roles.manage", INSTALLATION).allowed, "delegated": delegated_only or not full_authority(conn, principal)}
