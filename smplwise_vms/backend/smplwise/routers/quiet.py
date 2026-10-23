"""CR-QUIET103 slice 1: quiet windows - the HTTP surface (Arx RBAC is the only authority; services/quiet_windows.py is the rule).

    GET  /quiet/windows            the active windows (and the last ended ones) of the floors the caller may read (`devices.read`)
    POST /quiet/windows            start one: {scope_type: floor|area, scope_id, minutes?}  - `devices.control` on the floor (an area with no floor:
                                   the installation); RBAC alone decides (no role gets the permission by default beyond what devices.control already gives)
    POST /quiet/windows/{id}/stop  end it now - the same permission on the same floor
    GET  /quiet/settings           the four settings (readable by anyone who can read windows; the values are not secret)
    PUT  /quiet/settings           `system.configure` at the installation, confirmed

Shipped OFF (`quiet.windows.enabled`). Critical / safety notifications are never held (see the service)."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, Field

from ..auth import current_principal, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import quiet_windows as qw
from ..services.timeutil import iso_utc

router = APIRouter()


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class StartBody(BaseModel):
    scope_type: Literal["floor", "area"]
    scope_id: str = Field(min_length=1, max_length=128)
    minutes: int | None = Field(default=None, ge=1, le=720)


class SettingsBody(BaseModel):
    changes: dict[str, Any]
    confirmed: Any = None


@router.get("/quiet/windows")
def list_windows(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    now = qw.now_utc()
    return {"enabled": qw.enabled(conn), "windows": qw.list_for(conn, principal, now), "now": iso_utc(now),
            "can_configure": authorize(conn, principal, qw.CONFIGURE, INSTALLATION).allowed}


@router.post("/quiet/windows", status_code=201)
def start_window(body: StartBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return qw.start(conn, principal, body.scope_type, body.scope_id, body.minutes, _rid(request))


@router.post("/quiet/windows/{window_id}/stop")
def stop_window(request: Request, window_id: str = Path(min_length=1, max_length=64), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return qw.stop(conn, principal, window_id, _rid(request))


@router.get("/quiet/settings")
def get_settings(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return {"settings": qw.settings_view(conn)}


@router.put("/quiet/settings")
def put_settings(body: SettingsBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, qw.CONFIGURE, INSTALLATION)
    if body.confirmed is not True:
        raise ApiError(409, "confirmation_required", "הפעולה דורשת אישור מפורש.")
    changed = qw.update_settings(conn, principal, body.changes, _rid(request))
    return {"settings": qw.settings_view(conn), "changed": sorted(changed)}
