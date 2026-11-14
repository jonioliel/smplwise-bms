"""A camera's video source and the cameras without a recorder (CAMERA-STREAM-SOURCES-2410; services/camera_sources.py).

- `GET /cameras/{camera_id}/source` - the camera's source: `nvr` (from its recorder, the default) or `manual` with the masked address
  of each profile, `has_password`, the last stream test, the source's health and what such a camera can do. Never an address.
- `PUT /cameras/{camera_id}/source` - `{mode: nvr|manual, main_url, sub_url, area_id?, if_revision?}`. A masked address sent back keeps
  the stored secret (same host only). A camera without a recorder cannot go back to `nvr`.
- `POST /cameras/source/test` - `{url, camera_id?, profile}`: one frame through a throwaway go2rtc stream -> preview, resolution, codec,
  or `{ok: false, code, message}` with a fixed Hebrew text. Six a minute per person.
- `POST /cameras/standalone` - `{name, area_id?, main_url, sub_url}`: a camera without a recorder (live + snapshots only).
  NVRLESS-CAMERAS-2411 (owner, 08.11): the stream test and the add answer 409 `webrtc_server_required` when go2rtc (the WebRTC /
  video server) is not configured - after the permission, before the body is parsed (no URL is looked at).
- `DELETE /cameras/standalone/{camera_id}` - removes such a camera (its source, row and map placements; go2rtc streams deleted).

Every route needs `system.configure` (the permission of the recorder connection settings), checked on a read connection BEFORE the
body is read (the raw-body pattern of routers/nvr_connection.py: an unauthorised caller gets the audited 403 whatever it sent). Every
change and every test is audited - camera id, mode, outcome; never an address, a host or a user name. Every address goes through
services/source_policy.py; a refused one is a 422 with the policy's code and an audited denial."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..auth import current_principal, get_conn, read_gate, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import camera_sources as svc
from .nvr_connection import _parse, _raw_body

router = APIRouter()
PERMISSION = svc.PERMISSION
URL_MAX = 2048

_admin_ro = read_gate(lambda conn, principal: require(conn, principal, PERMISSION, INSTALLATION))


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class SourceIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["nvr", "manual"]
    main_url: str | None = Field(default=None, max_length=URL_MAX)
    sub_url: str | None = Field(default=None, max_length=URL_MAX)
    area_id: str | None = Field(default=None, max_length=120)
    if_revision: int | None = None


class TestIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str | None = Field(default=None, max_length=URL_MAX)
    camera_id: str | None = Field(default=None, max_length=64)
    profile: Literal["main", "sub"] = "main"


class StandaloneIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(max_length=200)
    area_id: str | None = Field(default=None, max_length=120)
    main_url: str | None = Field(default=None, max_length=URL_MAX)
    sub_url: str | None = Field(default=None, max_length=URL_MAX)


@router.get("/cameras/{camera_id}/source")
def get_source(camera_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The camera's video source (never an address: the masked form and `has_password`)."""
    require(conn, principal, PERMISSION, INSTALLATION)
    return svc.view(conn, svc._camera(conn, camera_id))


@router.put("/cameras/{camera_id}/source")
def put_source(camera_id: str, request: Request, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(_raw_body),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Change the camera's video source (the recorder, or its own RTSP addresses)."""
    require(conn, principal, PERMISSION, INSTALLATION)
    body: SourceIn = _parse(request, raw, SourceIn)
    return svc.save(conn, settings_of(request), principal, camera_id, mode=body.mode, main_url=body.main_url, sub_url=body.sub_url,
                    if_revision=body.if_revision, area_id=body.area_id, request_id=_rid(request))


@router.post("/cameras/source/test")
def test_source(request: Request, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(_raw_body),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Test an address before saving: one frame -> a small preview, the resolution and the codec, or a fixed Hebrew error."""
    require(conn, principal, PERMISSION, INSTALLATION)
    svc.ensure_webrtc_server(settings_of(request))  # NVRLESS-CAMERAS-2411: before any URL handling
    body: TestIn = _parse(request, raw, TestIn)
    return svc.test_stream(conn, settings_of(request), principal, url=body.url, camera_id=body.camera_id, profile=body.profile, request_id=_rid(request))


@router.post("/cameras/standalone", status_code=201)
def create_standalone(request: Request, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(_raw_body),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Add a camera without a recorder: live video and snapshots from its own RTSP addresses."""
    require(conn, principal, PERMISSION, INSTALLATION)
    svc.ensure_webrtc_server(settings_of(request))  # NVRLESS-CAMERAS-2411: before any URL handling
    body: StandaloneIn = _parse(request, raw, StandaloneIn)
    return svc.create_standalone(conn, settings_of(request), principal, name=body.name, area_id=body.area_id, main_url=body.main_url, sub_url=body.sub_url,
                                 request_id=_rid(request))


@router.delete("/cameras/standalone/{camera_id}")
def delete_standalone(camera_id: str, request: Request, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Remove a camera without a recorder (a camera on a recorder is refused: 409 not_standalone)."""
    require(conn, principal, PERMISSION, INSTALLATION)
    if not svc.CAMERA_ID_RE.fullmatch(camera_id or ""):
        raise ApiError(404, "not_found", svc.MSG["not_found"])
    return svc.delete_standalone(conn, settings_of(request), principal, camera_id, request_id=_rid(request))
