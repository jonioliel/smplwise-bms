"""CR-020: the cameras' video settings (הגדרות › אבטחה › מצלמות).

S1 - three GET routes, system administrators only (`system.configure` at installation scope, plus the camera's own chain
for the detail - T055). Every successful read is audited (`nvr.cameras.read`, counts only).
S2 - the guarded single-stream write: `PUT /nvr/cameras/{camera_id}/streams/{stream_ref}` and the read of one stream's
options. The write needs `nvr.configure` (a SYSTEM permission: built-in system_admin only) at installation scope AND on
the camera's chain (403 before 404), then `confirm: true` (the JSON literal) before any device read. The undo is
`POST /nvr/changes/{id}/rollback` (routers/nvr_write.py dispatches `stream_encoding` changes to the service here).
No route returns a device address, a user name, a password, a serial number or a MAC."""
from __future__ import annotations

import re
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Query, Request

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..mode import ensure_nvr  # NVR-less mode: 409 nvr_not_configured, after the permission check
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import nvr_settings
from ..services.access import camera_allowed, camera_scope, require_camera
from .nvr_write import _raw_body, json_body

router = APIRouter()
STREAM_REF_RE = re.compile(r"\d{1,6}")
# The PUT body is parsed by hand after the permission checks (review L2); its shape for the OpenAPI document (API 3.4):
WRITE_BODY_OPENAPI: dict[str, Any] = {"requestBody": {"required": True, "content": {"application/json": {"schema": {
    "type": "object", "required": ["if_match", "confirm", "changes"], "additionalProperties": False,
    "properties": {"if_match": {"type": "string", "pattern": "^[0-9a-f]{16}$"}, "confirm": {"type": "boolean", "enum": [True]},
                   "changes": {"type": "object", "minProperties": 1, "propertyNames": {"enum": list(nvr_settings.WRITE_FIELDS)}}}}}}}}
PERMISSION = "system.configure"
WRITE_PERMISSION = nvr_settings.WRITE_PERMISSION
RECORDER_ID = Query(default=None, pattern=r"^[A-Za-z0-9_.-]{1,40}$")
STREAM_REF = Path(pattern=r"^\d{1,6}$")
CODEC = Query(default=None, pattern=r"^[A-Za-z0-9.+_-]{1,32}$")


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _can_write(conn: sqlite3.Connection, principal: Principal, camera_id: str | None = None) -> bool:
    if not authorize(conn, principal, WRITE_PERMISSION, INSTALLATION).allowed:
        return False
    return camera_allowed(conn, principal, camera_id, WRITE_PERMISSION) if camera_id else True


@router.get("/nvr/recorders")
def recorders(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    settings = settings_of(request)
    ensure_nvr(settings)
    return nvr_settings.list_recorders(conn, settings, _can_write(conn, principal))


@router.get("/nvr/cameras")
def cameras(request: Request, recorder_id: str | None = RECORDER_ID, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    settings = settings_of(request)
    ensure_nvr(settings)
    result = nvr_settings.list_cameras(conn, settings, camera_scope(conn, principal, PERMISSION), recorder_id, _can_write(conn, principal))
    audit(conn, actor=principal, action="nvr.cameras.read", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request), details=nvr_settings.audit_details(result))
    return result


@router.get("/nvr/cameras/{camera_id}")
def camera(camera_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    require_camera(conn, principal, camera_id, PERMISSION)  # 403 (audited) before 404, as for every camera route
    settings = settings_of(request)
    ensure_nvr(settings)
    result = nvr_settings.camera_detail(conn, settings, camera_id, _can_write(conn, principal, camera_id))
    audit(conn, actor=principal, action="nvr.cameras.read", decision="allowed", resource_type="camera", resource_id=camera_id, request_id=_rid(request),
          details=nvr_settings.audit_details({"cameras": [result["camera"]], "stale": result["stale"], "error": result["camera"].get("error")}))
    return result


@router.get("/nvr/cameras/{camera_id}/streams/{stream_ref}/options")
def stream_options(camera_id: str, request: Request, stream_ref: str = STREAM_REF, codec: str | None = CODEC,
                   principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """API 3.3: one stream's options from capability discovery; writable is a boolean here (null in the lists)."""
    require(conn, principal, PERMISSION, INSTALLATION)
    require_camera(conn, principal, camera_id, PERMISSION)
    settings = settings_of(request)
    ensure_nvr(settings)
    return nvr_settings.stream_options(conn, settings, camera_id, stream_ref, codec)


def _writer_ro(camera_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """The write's permission on the READ connection, before the body is read (review L2 / L7, auth.read_gate pattern):
    nvr.configure at installation scope, then on the camera's chain (403, audited, before 404)."""
    require(conn, principal, WRITE_PERMISSION, INSTALLATION)
    require_camera(conn, principal, camera_id, WRITE_PERMISSION)
    return principal


@router.put("/nvr/cameras/{camera_id}/streams/{stream_ref}", openapi_extra=WRITE_BODY_OPENAPI)
def write_stream(camera_id: str, stream_ref: str, request: Request, principal: Principal = Depends(_writer_ro),
                 raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """API 3.4: one stream's encoding (nvr.configure + camera, {if_match, confirm: true, changes}); 200 {change|null, stream, ...}.

    Order: permission at installation, permission on the camera's chain (the gate), then - only then - the request
    itself: `confirm` (literal true), the stream id, the body shape (review L2: the body and the path are parsed by hand after
    the permission checks, so an unauthorised caller gets 403 whatever they sent), NVR-less mode, then the service (device
    reads, validation, two-phase write)."""
    try:
        req = nvr_settings.parse_write_body(json_body(raw))
        if not STREAM_REF_RE.fullmatch(stream_ref):
            raise ApiError(422, "validation", "מזהה זרם לא תקין.", details={"field": "stream_ref"})
    except ApiError as exc:
        raise nvr_settings.refuse_attempt(conn, principal, camera_id, stream_ref[:16], exc, _rid(request)) from None
    settings = settings_of(request)
    ensure_nvr(settings)
    return nvr_settings.write_stream(conn, settings, principal, camera_id, stream_ref, req, request_id=_rid(request))
