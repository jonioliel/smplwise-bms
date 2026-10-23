"""IDENT146 (docs/changes/CR-IDENT146.md): the personal data export of Arx-only (local) identities.

`GET auth/local/personal-data`                       the signed-in local person's own bundle (a local session only)
`GET identity/local-users/{id}/personal-data`        the same bundle for one person, on a data-subject request (`identity.local.manage`,
                                                     system_admin only)
Both: 409 `personal_export_off` while `privacy.personal_export` is off (the default); JSON, `Cache-Control: no-store`, an attachment; one
audit row per export (the subject id and row counts - never the content). The bundle is built on request and never stored."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response

from ..audit import audit
from ..auth import current_principal, get_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import local_identity as li
from ..services import local_privacy as lp

router = APIRouter()

OFF_HE = "ייצוא המידע האישי אינו מופעל במערכת הזו."
SELF_ONLY_HE = "הפעולה זמינה רק למשתמש Arx שנכנס עם חשבון משלו."
NOT_FOUND_HE = "המשתמש לא נמצא."


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _deliver(conn: sqlite3.Connection, request: Request, principal: Principal, subject: str, on_behalf: bool) -> Response:
    if not lp.export_enabled(conn):
        audit(conn, actor=principal, action=lp.AUDIT_EXPORTED, decision="denied", resource_type="user", resource_id=subject,
              reason="export_off", request_id=_rid(request))
        raise ApiError(409, "personal_export_off", OFF_HE)
    try:
        bundle = lp.export_bundle(conn, subject)
    except LookupError:
        raise ApiError(404, "user_unknown", NOT_FOUND_HE) from None
    counts = {k: len(v) for k, v in bundle.items() if isinstance(v, list)}
    audit(conn, actor=principal, action=lp.AUDIT_EXPORTED, decision="allowed", resource_type="user", resource_id=subject, request_id=_rid(request),
          details={"on_behalf": on_behalf, "rows": counts})
    return Response(content=json.dumps(bundle, ensure_ascii=False, indent=2), media_type="application/json; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="arx-personal-data.json"', "Cache-Control": "no-store"})


@router.get("/auth/local/personal-data")
def own_personal_data(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    if principal.source != "local" or not li.is_local_id(principal.user_id):
        raise ApiError(403, "not_local_identity", SELF_ONLY_HE)
    return _deliver(conn, request, principal, principal.user_id, False)


@router.get("/identity/local-users/{user_id}/personal-data")
def user_personal_data(user_id: str, request: Request, principal: Principal = Depends(current_principal),
                       conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    require(conn, principal, "identity.local.manage", INSTALLATION)
    if not li.is_local_id(user_id) or len(user_id) > 40:
        raise ApiError(404, "user_unknown", NOT_FOUND_HE)
    return _deliver(conn, request, principal, user_id, True)


_ = Any  # kept for type tooling
