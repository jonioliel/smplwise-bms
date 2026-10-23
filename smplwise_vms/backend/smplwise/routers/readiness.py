"""CR-FLEET215: the installation readiness score and demo mode (Settings only; management, never an operator screen).

- GET /readiness      the checklist score and what is missing (`system.configure` at the installation; read-only, no device call)
- GET /demo           whether demo mode is on (`system.configure`)
- PUT /demo           `{enabled: bool}` (system administrator); audited before / after; OFF by default
- GET /demo/dataset   the example data, every object `example: true` (`system.configure`; 409 `demo_off` while the switch is off)"""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, is_system_admin, require
from ..services import demo_mode
from ..services import readiness as readiness_svc

router = APIRouter()
_TEXT = {
    "not_system_admin": "רק מנהל מערכת יכול לשנות הגדרה זו.",
    "demo_off": "מצב ההדגמה כבוי.",
}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class DemoIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool


@router.get("/readiness")
def get_readiness(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """CR-FLEET215: the installation readiness score, its checklist and what is missing (system.configure; no device call)."""
    require(conn, principal, "system.configure", INSTALLATION)
    return readiness_svc.compute(settings_of(request), conn)


@router.get("/demo")
def get_demo(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """CR-FLEET215: whether demo mode (example data, clearly marked) is on (system.configure)."""
    require(conn, principal, "system.configure", INSTALLATION)
    return {"enabled": demo_mode.enabled(conn), "label": demo_mode.LABEL}


@router.put("/demo")
def put_demo(body: DemoIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """CR-FLEET215: turn demo mode on or off (OFF by default; nothing is stored, so off is the whole cleanup); audited (system administrator)."""
    with request.app.state.db.connection(label="demo.switch") as conn:
        require(conn, principal, "system.configure", INSTALLATION)
        if not is_system_admin(conn, principal.user_id):
            audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="installation", resource_id="demo",
                  reason="not_system_admin", request_id=_rid(request))
            raise ApiError(403, "not_system_admin", _TEXT["not_system_admin"])
        before, after = demo_mode.set_enabled(conn, body.enabled)
        audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="demo",
              request_id=_rid(request), details={"key": demo_mode.SWITCH, "before": before, "after": after})
        return {"enabled": body.enabled, "label": demo_mode.LABEL}


@router.get("/demo/dataset")
def get_demo_dataset(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """CR-FLEET215: the example dataset, every object marked `example: true` (system.configure; only while demo mode is on)."""
    require(conn, principal, "system.configure", INSTALLATION)
    if not demo_mode.enabled(conn):
        raise ApiError(409, "demo_off", _TEXT["demo_off"])
    return demo_mode.dataset()
