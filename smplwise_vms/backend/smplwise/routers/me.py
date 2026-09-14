from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends

from ..auth import current_principal, get_conn
from ..db import get_setting, permission_revision
from ..rbac import INSTALLATION, Principal, bindings_of, effective_permissions, has_any_binding

router = APIRouter()


@router.get("/me")
def me(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    return {
        "user": {
            "id": principal.user_id,
            "username": principal.username,
            "display_name": principal.display_name,
            "source": principal.source,
        },
        "bindings": bindings_of(conn, principal),
        "permissions_installation": effective_permissions(conn, principal, INSTALLATION),
        "has_access": has_any_binding(conn, principal),
        "permission_revision": permission_revision(conn),
        "bootstrap_state": get_setting(conn, "bootstrap_state", "pending"),
    }
