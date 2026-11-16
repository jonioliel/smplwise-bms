"""WisKey tab: one station's own camera account (`system.configure`), write-only.

CR-SPLIT-ACCESS-CONTROL-2440 (review 05:P2-08): moved unchanged out of routers/access_control.py, which still exports every name."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, Field, ValidationError

from ..audit import audit
from ..auth import get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import Principal
from ..services import intercom_sync, wiskey_camera
from ._common import is_json as _is_json
from .access_control_base import MAX_STATION_ID, _credentials_admin, _credentials_admin_ro
from .access_control_stills import _still_path

router = APIRouter()


# ---------------------------------------------------------------- per-station camera credentials (system.configure)
# Every station is assumed to share the add-on options' account (owner decision 2026-09-28); these set or clear one
# station's own. Write-only: no reply ever carries a username or password (like HA's `password` option type).

class StationCredentials(BaseModel):
    username: str = Field(min_length=1, max_length=256)  # WisKey's own limits (ConnectionSettings)
    password: str = Field(min_length=1, max_length=256)


async def _credentials_body(request: Request) -> bytes:
    """The body, unparsed; declared AFTER the permission dependency, so a caller without system.configure gets an
    audited 403 whatever they sent (FastAPI would otherwise parse a declared body model first: 422 before 403)."""
    return await request.body()


def _refuse_credentials(conn: sqlite3.Connection, principal: Principal, request: Request, station_id: str, exc: ApiError) -> ApiError:
    audit(conn, actor=principal, action="intercom.credentials.set", decision="denied", resource_type="intercom_station", resource_id=station_id,
          reason=exc.code, request_id=getattr(request.state, "correlation_id", None))
    return exc


def _parse_credentials(conn: sqlite3.Connection, principal: Principal, request: Request, station_id: str, raw: bytes) -> StationCredentials:
    """The physical endpoints' order (_parse): the content type, then the JSON, then the fields - each an audited refusal."""
    content_type = request.headers.get("content-type")
    if not _is_json(content_type):
        raise _refuse_credentials(conn, principal, request, station_id, ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).", details={"content_type": (content_type or "")[:100]}))
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise _refuse_credentials(conn, principal, request, station_id, ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]})) from None
    try:
        return StationCredentials.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise _refuse_credentials(conn, principal, request, station_id, ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields})) from None


def _drop_still(request: Request, station_id: str) -> None:
    """Another account may show another picture (or none): the cached still is not served for up to max_age (N4a)."""
    _still_path(settings_of(request), station_id).unlink(missing_ok=True)


@router.get("/intercom/stations/credentials")
def stations_credentials(request: Request, principal: Principal = Depends(_credentials_admin_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The admin screen's list: the feed's state, whether the shared default is set, and per station (every one the
    feed knows, plus any override row for a station it no longer lists - `known: false`) whether an override exists and
    since when. Names come from the feed; no username, password or host is ever in the reply."""
    settings = settings_of(request)
    state, overview = intercom_sync.SYNC.served(settings)
    return {"state": state, **wiskey_camera.listing(conn, settings, overview)}


@router.get("/intercom/stations/{station_id}/credentials")
def station_credentials(request: Request, principal: Principal = Depends(_credentials_admin_ro), conn: sqlite3.Connection = Depends(get_read_conn), station_id: str = Path(min_length=1, max_length=MAX_STATION_ID)) -> dict[str, Any]:
    """Whether the station has its own credentials, whether the shared default is set, and which one applies."""
    return wiskey_camera.status(conn, settings_of(request), station_id)


@router.put("/intercom/stations/{station_id}/credentials")
def set_station_credentials(
    request: Request,
    principal: Principal = Depends(_credentials_admin_ro),
    raw: bytes = Depends(_credentials_body),
    conn: sqlite3.Connection = Depends(get_conn),
    station_id: str = Path(min_length=1, max_length=MAX_STATION_ID),
) -> dict[str, Any]:
    body = _parse_credentials(conn, principal, request, station_id, raw)
    replaced = wiskey_camera.set_override(conn, settings_of(request), station_id, body.username, body.password, principal.user_id)
    _drop_still(request, station_id)
    audit(conn, actor=principal, action="intercom.credentials.set", decision="allowed", resource_type="intercom_station", resource_id=station_id,
          request_id=getattr(request.state, "correlation_id", None), details={"replaced": replaced})
    return wiskey_camera.status(conn, settings_of(request), station_id)


@router.delete("/intercom/stations/{station_id}/credentials")
def clear_station_credentials(request: Request, principal: Principal = Depends(_credentials_admin), conn: sqlite3.Connection = Depends(get_conn), station_id: str = Path(min_length=1, max_length=MAX_STATION_ID)) -> dict[str, Any]:
    removed = wiskey_camera.clear_override(conn, station_id)
    _drop_still(request, station_id)
    audit(conn, actor=principal, action="intercom.credentials.clear", decision="allowed", resource_type="intercom_station", resource_id=station_id,
          request_id=getattr(request.state, "correlation_id", None), details={"removed": removed})
    return wiskey_camera.status(conn, settings_of(request), station_id)
