"""The Frigate configuration API (FRGS, docs/changes/CR-029-FRIGATE-PROVIDER.md section 13): the config schema Arx knows, one camera's zones
and curated settings as Frigate shows them now (reads), and the guarded config writes (class `config`, OFF by default).

The model of a write lives in `services/frigate_config_svc.py` (permission `system.configure` on the camera, class on, `confirm: true` per
action, the first write of each kind only with `supervised: true`, read before / ONE write / read back, change-log row, undo through
`POST /frigate/{rid}/changes/{id}/revert`). Every write is tested against the in-process fake Frigate only; the wire shape is unverified."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import frigate_config_svc as cfgsvc
from ..services import frigate_control_svc as svc
from ..services import frigate_native_svc as native
from ..services.access import camera_allowed
from ..services.recorders import frigate_config as fcfg
from .frigate import _camera_row
from .frigate_control import _adapter, _may_see, _rq
from .recorders import PERMISSION

router = APIRouter()


class ZoneIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    points: list[list[float]] = Field(min_length=fcfg.ZONE_POINTS_MIN, max_length=fcfg.ZONE_POINTS_MAX)
    objects: list[str] = Field(default_factory=list, max_length=fcfg.LABELS_MAX)
    inertia: int | None = None
    loitering_time: int | None = None
    confirm: bool = False
    supervised: bool = False


class ConfirmIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: bool = False
    supervised: bool = False


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    values: dict[str, Any] = Field(min_length=1, max_length=len(fcfg.SETTINGS))
    confirm: bool = False
    supervised: bool = False


@router.get("/frigate/{recorder_id}/config/schema")
def config_schema(recorder_id: str, request: Request, verify: bool = Query(False), principal: Principal = Depends(current_principal_ro),
                  conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The configuration schema Arx knows for Frigate (zones and the curated camera settings: types, ranges, defaults, sections). Static;
    `verify=true` (system.configure) also reads the instance's own schema and names our fields it does not know (a read; nothing is written)."""
    a = _adapter(conn, request, recorder_id)
    _may_see(conn, principal)
    out: dict[str, Any] = {"recorder_id": recorder_id, **fcfg.schema(), "frigate_check": None}
    if verify:
        require(conn, principal, PERMISSION, INSTALLATION)
        out["frigate_check"] = fcfg.FrigateConfig(a).frigate_schema_check()
    return out


@router.get("/frigate/{recorder_id}/cameras/{camera_id}/config")
def camera_config(recorder_id: str, camera_id: str, request: Request, principal: Principal = Depends(current_principal_ro),
                  conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """ONE camera's zones (relative polygons, never mirrored) and curated settings as Frigate's effective config shows them now, and whether
    THIS caller may change them now (`system.configure` on the camera AND the `config` class on). A read: nothing is written."""
    cam = _camera_row(conn, principal, recorder_id, camera_id, "video.live")
    _may_see(conn, principal)
    a = _adapter(conn, request, recorder_id)
    view = cfgsvc.camera_view(a, cam["source_ref"])
    writable = bool(svc.policy(conn, recorder_id)["config"] and camera_allowed(conn, principal, camera_id, svc.PERMISSION["config"]))
    done = native.first_writes(conn, recorder_id)
    return {"recorder_id": recorder_id, "camera_id": camera_id, "camera_key": cam["source_ref"], **view, "writable": writable,
            "first_write_done": {k: done[k] for k in cfgsvc.KINDS},
            "can_supervise": authorize(conn, principal, PERMISSION, INSTALLATION).allowed}


@router.put("/frigate/{recorder_id}/cameras/{camera_id}/config/zones/{name}")
def put_zone(recorder_id: str, camera_id: str, name: str, body: ZoneIn, request: Request, principal: Principal = Depends(current_principal),
             conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Create or replace ONE zone (`confirm: true`; the first zone write of a recorder also `supervised: true` from a system administrator)."""
    cam = _camera_row(conn, principal, recorder_id, camera_id, svc.PERMISSION["config"])
    a = _adapter(conn, request, recorder_id)
    zone = body.model_dump(exclude={"confirm", "supervised"})
    return {"recorder_id": recorder_id, "camera_id": camera_id, "name": name,
            **cfgsvc.put_zone(conn, principal, a, cam, name, zone, confirm=body.confirm, supervised=body.supervised, request_id=_rq(request))}


@router.post("/frigate/{recorder_id}/cameras/{camera_id}/config/zones/{name}/delete")
def delete_zone(recorder_id: str, camera_id: str, name: str, body: ConfirmIn, request: Request, principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Remove ONE zone (`confirm: true`; undo from the change log brings it back)."""
    cam = _camera_row(conn, principal, recorder_id, camera_id, svc.PERMISSION["config"])
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, "camera_id": camera_id, "name": name,
            **cfgsvc.delete_zone(conn, principal, a, cam, name, confirm=body.confirm, supervised=body.supervised, request_id=_rq(request))}


@router.put("/frigate/{recorder_id}/cameras/{camera_id}/config/settings/{section}")
def put_settings(recorder_id: str, camera_id: str, section: str, body: SettingsIn, request: Request, principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Change settings of ONE section of ONE camera (keys from the schema only; `null` = back to Frigate's default). `confirm: true`."""
    cam = _camera_row(conn, principal, recorder_id, camera_id, svc.PERMISSION["config"])
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, "camera_id": camera_id, "section": section,
            **cfgsvc.put_settings(conn, principal, a, cam, section, body.values, confirm=body.confirm, supervised=body.supervised, request_id=_rq(request))}
