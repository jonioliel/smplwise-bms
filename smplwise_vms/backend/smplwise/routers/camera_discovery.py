"""Finding cameras on the site's network (ONVIF-API-2500; design docs/design/onvif-discovery-2412 sections 7 and 14, owner decisions
2026-11-22 Q55-Q61). The routes over services/camera_discovery (MANAGER), which holds every rule: the site-network range clamp
(Q56), the one credential attempt per camera per press (Q57), the known-device marks (Q58, Q59), the limits, RBAC and the audit.

- `GET /cameras/discovery/capabilities` - on / off, the engine and whether it can run, the suggested range, the address cap, whether
  a scan is running.
- `GET /cameras/discovery/scans` - the scans this person may see (newest first, without their devices): finds a running scan again
  after a reload.
- `POST /cameras/discovery/scans` - `{range?}` (empty = the suggested range) -> 202 the scan. 409 `discovery_off` / `scan_running`;
  422 `range_invalid` / `range_too_large` / `range_refused` (`details.fields: ["range"]`) / `site_network_unknown`; 429
  `rate_limited` with `Retry-After` and `details.retry_after_s`.
- `GET /cameras/discovery/scans/{scan_id}` - the scan with every device found so far (poll while `state` is `running`).
- `DELETE /cameras/discovery/scans/{scan_id}` - stops the scan and forgets every credential typed for it.
- `POST /cameras/discovery/scans/{scan_id}/identify` - `{device_ids, username, password, same_for_all}`: ONE GetDeviceInformation
  per selected camera (never repeated automatically; more than one device needs `same_for_all: true`). 409 `scan_not_active`;
  422 `credentials_invalid` / `device_unknown` / `same_for_all_required` (field names in `details.fields`); 429 `rate_limited`.
  ONVIF-CLIENT-2500: an `ok` press also reads the camera's video profiles and stream addresses (`profiles`, `suggested`).
- `POST /cameras/discovery/scans/{scan_id}/add` - `{cameras: [{device_id, name?, area_id?, main_profile?, sub_profile?}]}` (ONVIF-CLIENT-
  2500): each through the existing `create_standalone`, partial success `{added, failed}`. 409 `webrtc_server_required` /
  `scan_not_active`. The preview of a found camera is the `{scan_id, device_id, profile}` form of `POST /cameras/source/test`.

Every route needs `system.configure` at the installation (the permission of the recorder connection and of the cameras without a
recorder), checked by the service; a refusal is the audited 403. The two body routes check it on a READ connection before the body
is read (review L7, the raw-body pattern of routers/camera_sources.py): an unauthorised caller gets the 403 whatever it sent. A scan
another person started is `404 scan_not_found` (no existence leak). Errors are the five-key envelope; a refusal about request fields
names them in `details.fields` and `details.problems` (ADR-019 D1) and never echoes a value. No answer, error, audit row or log
line carries a user name, a password, a serial number or a URL with credentials."""
from __future__ import annotations

import json
import sqlite3
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, read_gate, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import camera_sources
from ..services.camera_discovery import onvif_http, ranges
from ..services.camera_discovery import service as svc
from ..wire import camera_discovery as W
from ..wire import wire
from ._common import raw_body as _raw_body, rid as _rid

router = APIRouter()
PERMISSION = svc.PERMISSION
BODY_MAX = 16 * 1024
DEVICE_ID_MAX = 32

_admin_ro = read_gate(lambda conn, principal: require(conn, principal, PERMISSION, INSTALLATION))


class ScanIn(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    range: str | None = Field(default=None, max_length=64)


class IdentifyIn(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    device_ids: list[Annotated[str, StringConstraints(max_length=DEVICE_ID_MAX)]] = Field(min_length=1, max_length=svc.MAX_IDENTIFY_DEVICES)
    username: str = Field(max_length=onvif_http.USER_MAX)
    password: str = Field(max_length=onvif_http.PASSWORD_MAX)
    same_for_all: bool = False


class AddCameraIn(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    device_id: str = Field(max_length=DEVICE_ID_MAX)
    name: str | None = Field(default=None, max_length=120)
    area_id: str | None = Field(default=None, max_length=120)
    main_profile: str | None = Field(default=None, max_length=64)
    sub_profile: str | None = Field(default=None, max_length=64)


class AddIn(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    cameras: list[AddCameraIn] = Field(min_length=1, max_length=svc.MAX_IDENTIFY_DEVICES)


def _parse(request: Request, raw: bytes, model: type[BaseModel]) -> Any:
    """The body, read only AFTER the permission check. A refusal names the fields and the pydantic reason of each (ADR-019 D1:
    `details.fields` + `details.problems`) - never the value sent (it may be a password)."""
    if len(raw) > BODY_MAX:
        raise ApiError(413, "payload_too_large", "גוף הבקשה גדול מדי.", details={"max_bytes": BODY_MAX})
    media = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if raw.strip() and media != "application/json":
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        data = None
    if not isinstance(data, dict):
        message = "גוף הבקשה חייב להיות אובייקט JSON."
        raise ApiError(422, "validation", message, details={"fields": ["body"], "problems": [{"field": "body", "code": "json_invalid", "message": message}]})
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        problems: list[dict[str, str]] = []
        for err in exc.errors(include_url=False, include_input=False, include_context=False):
            field = ".".join(str(p) for p in err["loc"]) or "body"
            if not any(p["field"] == field and p["code"] == err["type"] for p in problems):
                problems.append({"field": field, "code": str(err["type"])})
        fields = list(dict.fromkeys(p["field"] for p in problems))
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields, "problems": problems}) from None


def _limited(request: Request, exc: ApiError) -> JSONResponse:
    """429 `rate_limited`: the envelope with `Retry-After` (seconds, also `details.retry_after_s`)."""
    wait = int((exc.details or {}).get("retry_after_s") or 60)
    return JSONResponse(status_code=429, content=exc.payload(_rid(request) or ""), headers={"Retry-After": str(wait)})


@router.get("/cameras/discovery/capabilities", **wire(W.DiscoveryCapabilities))
def capabilities(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Any:
    """Whether a scan can run and with which range (the site network is read from the Supervisor, cached a minute)."""
    return svc.MANAGER.capabilities(conn, settings_of(request), principal)


@router.get("/cameras/discovery/scans", **wire(W.ScanList))
def list_scans(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Any:
    """The scans this person may see, newest first (no devices: poll the scan itself for them)."""
    return svc.MANAGER.list_scans(conn, principal)


@router.post("/cameras/discovery/scans", status_code=202, **wire(W.ScanJob))
def start_scan(request: Request, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(_raw_body),
               conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """Start a scan of `range` (or the suggested range). The sweep runs in the background; poll `GET .../scans/{id}`."""
    body: ScanIn = _parse(request, raw, ScanIn)
    settings = settings_of(request)
    with unlocked(conn):  # the site network may need the Supervisor: never under the write lock (the service reads the cached answer)
        ranges.site_interfaces(settings)
    try:
        return svc.MANAGER.start_scan(conn, settings, principal, body.range, request_id=_rid(request))
    except ApiError as exc:
        if exc.status == 429:
            return _limited(request, exc)
        raise


@router.get("/cameras/discovery/scans/{scan_id}", **wire(W.ScanJob))
def get_scan(scan_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Any:
    """The scan: state, progress, counts and every device found so far."""
    return svc.MANAGER.get(conn, principal, scan_id)


@router.delete("/cameras/discovery/scans/{scan_id}", **wire(W.ScanCancelled))
def cancel_scan(scan_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """Stop the scan (a running sweep ends at its next datagram) and forget every credential typed for it."""
    return svc.MANAGER.cancel(conn, principal, scan_id, request_id=_rid(request))


@router.post("/cameras/discovery/scans/{scan_id}/identify", **wire(W.IdentifyResult))
def identify(scan_id: str, request: Request, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(_raw_body),
             conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """ONE identification attempt per selected camera with the typed user / password (Q57). The device calls run without the
    database write lock (the service releases it)."""
    body: IdentifyIn = _parse(request, raw, IdentifyIn)
    try:
        return svc.MANAGER.identify(conn, settings_of(request), principal, scan_id, device_ids=body.device_ids,
                                    username=body.username, password=body.password, same_for_all=body.same_for_all, request_id=_rid(request))
    except ApiError as exc:
        if exc.status == 429:
            return _limited(request, exc)
        raise


@router.post("/cameras/discovery/scans/{scan_id}/add", **wire(W.AddResult))
def add(scan_id: str, request: Request, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(_raw_body),
        conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """Add the chosen identified cameras as cameras without a recorder (ONVIF-CLIENT-2500; design 4.5). Each one goes through the
    existing `create_standalone` (sealed addresses, origin `onvif`); partial success is reported per camera. A camera behind the
    recorder (Q58), a recorder (Q59), an already added or an unidentified camera is refused in `failed`. go2rtc (the WebRTC server)
    is required like for any camera without a recorder: 409 `webrtc_server_required` after the permission, before the body."""
    camera_sources.ensure_webrtc_server(settings_of(request))
    body: AddIn = _parse(request, raw, AddIn)
    return svc.MANAGER.add(conn, settings_of(request), principal, scan_id, cameras=[c.model_dump() for c in body.cameras], request_id=_rid(request))
