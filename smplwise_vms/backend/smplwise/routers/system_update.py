"""Self-update API, slice S1 (CR-021 section 5): the state, the manual check and the interval. Permission `system.update` (system administrators
only, never delegable, installation scope). `apply` and `restart-platform` are S3 and do not exist yet.

Mounted under /api/v1 like every router, so the paths are /api/v1/system/update/... Errors use the project envelope; a missing permission is the
usual 403 `forbidden` (the CR called it `permission_denied`). The infrastructure's answer is never echoed: only the class of failure and its
numeric status."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import self_update as svc

router = APIRouter(prefix="/system/update")

PERMISSION = "system.update"


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    interval_hours: Literal[0, 1, 3, 6, 12, 24]


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.get("/state")
def get_state(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The page data for a holder of `system.update`. Everyone else gets `{update_available: false}` and nothing more, so the user-menu
    marker call leaks no version and no note (CR-021 section 5.1)."""
    if not authorize(conn, principal, PERMISSION, INSTALLATION).allowed:
        return {"update_available": False}
    return svc.view(conn)


@router.post("/check")
def check(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """Manual check: the store reload first, then the read. 429 `rate_limited` (1 per 30 s, 20 per hour). When the reload is refused but the
    read works the answer is 200 with `refreshed: false` and `check_result: "refresh_failed_read_ok"`. 503 `platform_not_permitted`
    (`required_role: manager`), 503 `infrastructure_unreachable`, 502 `infrastructure_error` when the read itself fails."""
    require(conn, principal, PERMISSION, INSTALLATION)
    allowed, wait = svc.take_check()
    if not allowed:
        err = ApiError(429, "rate_limited", "הבדיקה בוצעה זה עתה. נסו שוב בעוד רגע.", retryable=True, details={"retry_after_s": wait})
        return JSONResponse(status_code=429, content=err.payload(_rid(request) or ""), headers={"Retry-After": str(wait)})
    settings = settings_of(request)
    with unlocked(conn):  # the infrastructure is called without the request's write lock
        out = svc.run_check(settings, refresh=True)
    now = dt.datetime.now(dt.timezone.utc)
    svc.record(conn, out, now, refresh=True)
    audit(conn, actor=principal, action="system.update.check", decision="allowed", resource_type="installation", resource_id="update", request_id=_rid(request),
          details={"result": out.result, "refreshed": out.refreshed, "installed": out.info.installed if out.info else None, "latest": out.info.latest if out.info else None})
    if out.info is None:
        if out.result == "not_permitted":
            raise ApiError(503, "platform_not_permitted", "ל-Arx אין הרשאה לבדוק עדכונים בתשתית המערכת.", details={"required_role": "manager"})
        if out.result == "unreachable":
            raise ApiError(503, "infrastructure_unreachable", "תשתית המערכת אינה זמינה.", retryable=True)
        raise ApiError(502, "infrastructure_error", "תשתית המערכת החזירה שגיאה.", retryable=True, details={"upstream_status": out.upstream_status})
    v = svc.view(conn)
    return {"checked_at": v["checked_at"], "check_result": out.result, "installed": out.info.installed, "latest": out.info.latest,
            "update_available": out.info.update_available, "refreshed": out.refreshed}


@router.put("/settings")
def put_settings(body: SettingsIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    before = svc.get_interval(conn)
    svc.set_interval(conn, body.interval_hours)
    audit(conn, actor=principal, action="system.update.settings", decision="allowed", resource_type="installation", resource_id="update", request_id=_rid(request),
          details={"from": before, "to": body.interval_hours})
    return {"interval_hours": body.interval_hours}
