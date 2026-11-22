"""Users from Home Assistant: the directory with each user's bindings, and the directory sync request.

CR-SPLIT-ACCESS-2440 (review 05:P2-08): moved unchanged out of routers/access.py, which still exports every name."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import get_setting, permission_revision, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, all_roles, authorize, require
from ..services import access_directory_store as store
from ..services import ha_client
from ..services.rbac_admin import _delegated_directory, _rid, _users, assign_scopes, assigns_anywhere, delegable_roles, full_authority
from ..wire import access_directory as W
from ..wire import wire

router = APIRouter()


# ---------------------------------------------------------------- directory

@router.get("/identity/users", **wire(W.Directory))
def list_users(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    if not authorize(conn, principal, "identity.directory.read", INSTALLATION).allowed and assigns_anywhere(conn, principal):
        return _delegated_directory(conn, principal)
    require(conn, principal, "identity.directory.read", INSTALLATION)
    return {
        "users": _users(conn, principal),
        "directory": {
            "paired": bool(get_setting(conn, "bridge.paired_at")),
            "last_directory_at": get_setting(conn, "bridge.directory_at") or None,
            "users": store.ha_user_count(conn),
        },
        "revision": permission_revision(conn),
        "can_assign": authorize(conn, principal, "rbac.assign", INSTALLATION).allowed,
        "delegated": not full_authority(conn, principal),
        "assign_scopes": assign_scopes(conn, principal),
        "assignable_roles": sorted(all_roles(conn)) if full_authority(conn, principal) else delegable_roles(conn),
        # CR-008 P2: turning a user's remote flag off ends their remote sessions only under remote.policy = flag
        "remote_policy": get_setting(conn, "remote.policy", "flag") or "flag",
    }


@router.post("/identity/sync", **wire(W.DirectorySync))
def sync_directory(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Ask the bridge integration to push the HA user directory now (it pushes every 60 s anyway)."""
    require(conn, principal, "system.configure", INSTALLATION)
    settings = settings_of(request)
    if not get_setting(conn, "bridge.paired_at"):
        raise ApiError(503, "bridge_not_paired", "גשר Arx אינו מצומד ב־Home Assistant.")
    audit(conn, actor=principal, action="identity.sync", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request))
    try:
        with unlocked(conn):
            result = ha_client.call_service(settings, "smplwise_bridge", "sync_directory", {}, return_response=True)
    except ApiError as exc:
        if exc.code in ("service_not_found", "ha_error"):
            return {"requested": False, "note": "האינטגרציה המותקנת עדיין ללא שירות sync_directory; הספרייה נדחפת אוטומטית כל דקה.", "error": exc.code}
        raise
    return {"requested": True, "result": result}
