"""Role bindings: list, create, revoke. The checks and the writes themselves are in services/rbac_admin.py.

CR-SPLIT-ACCESS-2440 (review 05:P2-08): moved unchanged out of routers/access.py, which still exports every name."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import now_iso, permission_revision
from ..errors import ApiError
from ..i18n import localize_for
from ..rbac import INSTALLATION, Principal, require
from ..services import access_bindings_store as store
from ..services import revocation
from ..services.rbac_admin import BindingBody, _binding_dict, _terminate, affected_users, assigns_anywhere, delegated_sees, full_authority, insert_binding, revoke_one, validate_binding
from ..wire import access_bindings as W
from ..wire import wire

router = APIRouter()


# ---------------------------------------------------------------- bindings


@router.get("/access/bindings", **wire(W.BindingList))
def list_bindings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    if not assigns_anywhere(conn, principal):
        require(conn, principal, "rbac.assign", INSTALLATION)
    rows = store.active_bindings(conn, now_iso())
    if not full_authority(conn, principal):
        rows = [b for b in rows if delegated_sees(conn, principal, b)]
    return localize_for(conn, principal, {"bindings": [_binding_dict(conn, b) for b in rows], "revision": permission_revision(conn)})  # I18N-BACKEND-2490 (third pass): role / scope names in the reader's language


@router.post("/access/bindings", status_code=201, **wire(W.BindingCreated))
def create_binding(body: BindingBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    if body.role_id == "system_admin" and body.effect == "allow":
        from ..services import step_up

        step_up.declare_once(request, step_up.ONCE_ADMIN_ROLE)  # MFA-RESET-HARDENING-2510: the gate asks a once-proof (step-up on only)
    validate_binding(conn, principal, body, request)
    bid, rev = insert_binding(conn, principal, request, body)
    if body.effect == "deny":
        _terminate(conn, settings_of(request), affected_users(conn, body.subject_kind, body.subject_id))
    else:
        revocation.changed(affected_users(conn, body.subject_kind, body.subject_id))  # the shell shows what was granted
    row = store.binding(conn, bid)
    return localize_for(conn, principal, {**_binding_dict(conn, row), "revision": rev})  # I18N-BACKEND-2490 (third pass): role / scope names in the reader's language


@router.delete("/access/bindings/{binding_id}", **wire(W.BindingRevoked))
def revoke_binding(binding_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    if not assigns_anywhere(conn, principal):
        require(conn, principal, "rbac.assign", INSTALLATION)
    b = store.live_binding(conn, binding_id)
    if not b:
        raise ApiError(404, "not_found", "השיוך לא נמצא או כבר בוטל.")
    rev = revoke_one(conn, principal, request, b)
    _terminate(conn, settings_of(request), affected_users(conn, b["subject_kind"], b["subject_id"]))
    return {"revoked": binding_id, "revision": rev}
