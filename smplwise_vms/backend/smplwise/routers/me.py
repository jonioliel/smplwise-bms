from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import get_setting, permission_revision
from ..rbac import INSTALLATION, Principal, bindings_of, effective_permissions, has_any_binding, permissions_anywhere

router = APIRouter()


@router.get("/me")
def me(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict:
    return {
        "user": {
            "id": principal.user_id,
            "username": principal.username,
            "display_name": principal.display_name,
            "source": principal.source,
        },
        "bindings": bindings_of(conn, principal),
        "permissions_installation": effective_permissions(conn, principal, INSTALLATION),
        "permissions_any": permissions_anywhere(conn, principal),  # what the shell may show at all (any scope)
        "has_access": has_any_binding(conn, principal),
        "permission_revision": permission_revision(conn),
        "bootstrap_state": get_setting(conn, "bootstrap_state", "pending"),
    }
