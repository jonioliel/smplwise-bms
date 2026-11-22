"""The effective-permission preview and the RBAC audit trail.

CR-SPLIT-ACCESS-2440 (review 05:P2-08): moved unchanged out of routers/access.py, which still exports every name."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import permission_revision
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, effective_permissions, require, scope_name
from ..services import access_audit_store as store
from ..services.rbac_admin import PERMISSION_LABELS, _scope_exists, _user_bindings, delegated_sees, full_authority, rendered_labels
from ..wire import access_audit as W
from ..wire import wire

router = APIRouter()


# ---------------------------------------------------------------- preview + audit

class PreviewBody(BaseModel):
    user_id: str = Field(min_length=1, max_length=200)
    scope_type: str = Field(default="installation", pattern="^(installation|site|building|floor|camera|access_control_station)$")
    scope_id: str = Field(default="*", min_length=1, max_length=200)


@router.post("/access/preview", **wire(W.AccessPreview))
def preview(body: PreviewBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Effective permissions of a user at a scope, computed server-side; no impersonation (§12)."""
    scope = (body.scope_type, body.scope_id)
    if body.user_id != principal.user_id:
        require(conn, principal, "rbac.assign", scope)
    if not _scope_exists(conn, *scope):
        raise ApiError(422, "scope_unknown", "ההיקף לא נמצא.")
    u = store.user_row(conn, body.user_id)
    subject = Principal(user_id=body.user_id, username=(u["username"] if u else ""), display_name=(u["display_name"] if u else ""), source=(u["source"] if u else "ingress"))
    active = bool(u["active"]) if u else True
    allowed = effective_permissions(conn, subject, scope) if active else []
    limited = body.user_id != principal.user_id and not full_authority(conn, principal)
    if limited:
        # security review T082: never more than the actor holds there themselves
        allowed = sorted(set(allowed) & set(effective_permissions(conn, principal, scope)))
    return {
        "user_id": body.user_id,
        "scope_type": body.scope_type,
        "scope_id": body.scope_id,
        "scope_name": scope_name(conn, *scope),
        "active": active,
        "allowed": allowed,
        "denied": [p for p in PERMISSION_LABELS if p not in allowed],
        "limited_to_own": limited,
        "labels": rendered_labels(conn),
        # a delegated administrator previews inside their reach: the bindings listed are the ones there, too
        "bindings": [b for b in _user_bindings(conn, body.user_id) if not limited or delegated_sees(conn, principal, b)],
        "revision": permission_revision(conn),
    }


@router.get("/audit", **wire(W.AuditPage))
def list_audit(
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    prefix: str = Query("rbac.", max_length=60),
    actor: str | None = Query(None, max_length=200),
    resource_id: str | None = Query(None, max_length=200),
    limit: int = Query(100, ge=1, le=500),
    channel: str | None = Query(None, pattern="^(local|remote|bearer)$"),
    view: str | None = Query(None, pattern="^(remote_sign_ins|remote_refusals)$"),
    actor_kind: str | None = Query(None, pattern="^(automation|person)$"),
) -> dict[str, Any]:
    """The audit screen. CR-008 P2: `channel` = where the actor came from (`local` = inside the system's own UI,
    `remote` = SmplWise Arx, `bearer` = Arx with a bearer token); `view` = a quick view that replaces the action prefix:
    `remote_sign_ins` (every auth.remote_* row: sign-ins, refusals, revocations, sign-outs, refused cross-site requests)
    or `remote_refusals` (every denied row of the remote channel - remote_not_allowed, csrf_refused, rate limits, a
    revoked sign-in, the remote live-stream cap)."""
    require(conn, principal, "audit.read", INSTALLATION)
    rows = []
    for r in store.audit_rows(conn, view, prefix, channel, actor_kind, actor, resource_id, limit):
        d = dict(r)
        try:
            d["details"] = json.loads(d.pop("details_json") or "{}")
        except (ValueError, KeyError):
            d["details"] = {}
        rows.append(d)
    return {"rows": rows}
