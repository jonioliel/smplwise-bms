"""CR-020 S1: the read-only table of the cameras' video settings (הגדרות › אבטחה › מצלמות).

Three GET routes, system administrators only (`system.configure` at installation scope, plus the camera's own chain for
the detail - T055). Nothing here writes: the guarded encoding writes are slice S2. No route returns a device address, a
user name, a password, a serial number or a MAC. Every successful read is audited (`nvr.cameras.read`, counts only)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..mode import ensure_nvr  # NVR-less mode: 409 nvr_not_configured, after the permission check
from ..rbac import INSTALLATION, Principal, require
from ..services import nvr_settings
from ..services.access import camera_scope, require_camera

router = APIRouter()
PERMISSION = "system.configure"
RECORDER_ID = Query(default=None, pattern=r"^[A-Za-z0-9_.-]{1,40}$")


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.get("/nvr/recorders")
def recorders(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    settings = settings_of(request)
    ensure_nvr(settings)
    return nvr_settings.list_recorders(conn, settings)


@router.get("/nvr/cameras")
def cameras(request: Request, recorder_id: str | None = RECORDER_ID, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    settings = settings_of(request)
    ensure_nvr(settings)
    result = nvr_settings.list_cameras(conn, settings, camera_scope(conn, principal, PERMISSION), recorder_id)
    audit(conn, actor=principal, action="nvr.cameras.read", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request), details=nvr_settings.audit_details(result))
    return result


@router.get("/nvr/cameras/{camera_id}")
def camera(camera_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    require_camera(conn, principal, camera_id, PERMISSION)  # 403 (audited) before 404, as for every camera route
    settings = settings_of(request)
    ensure_nvr(settings)
    result = nvr_settings.camera_detail(conn, settings, camera_id)
    audit(conn, actor=principal, action="nvr.cameras.read", decision="allowed", resource_type="camera", resource_id=camera_id, request_id=_rid(request),
          details=nvr_settings.audit_details({"cameras": [result["camera"]], "stale": result["stale"], "error": result["camera"].get("error")}))
    return result
