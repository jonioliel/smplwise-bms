"""OFFLINE110-295 slice 1: offline field work, the HTTP surface (services/offline_field.py is the rule). Default OFF (`field_offline.enabled`).

Technician (a signed-in user; his own data only - the tickets' visibility and assignment rules decide, there is no extra grant):
    GET   /field/offline/bundle?device_id=      today's bundle (or {status: locked|wipe}); 404 feature_disabled while the switch is off
    POST  /field/offline/sync                   {device_id, ops: [...]} -> per-op outcome + device_action (ok | lock | wipe)
    POST  /field/offline/wipe-confirmed         {device_id}: the phone cleared its cache
    GET   /field/offline/day-list               the day, read-only, with the receipt state
    POST  /field/offline/day-list/ack           {device_id?}: acknowledge receipt of today's list
    POST  /field/offline/tags/verify            {tag}: is this round-point tag signed by this server (the point, or valid: false)
Managers (tickets.manage at installation scope):
    GET   /field/offline/review                 held changes
    POST  /field/offline/review/{op_id}         {decision: approve|dismiss, note?}
    POST  /field/offline/devices/{user_id}/{device_id}/{lock|unlock|wipe|reenroll}   {reason?}
    GET   /field/offline/devices                known devices
    POST  /field/offline/round-points           {name, entity_id?, place_text?} ; GET lists them ; GET .../{id}/tag the payload text to print later
System administrator (system.configure):
    GET/PUT /field/offline/settings             every value (confirmed, audited) ; POST /field/offline/tag-key/rotate (confirmed)
Tag printing / NFC writing is a later job: this surface only produces and verifies the signed payload text."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import offline_field as svc
from ..services.tickets import access
from ..services.tickets.messaging import DEFAULT_TZ

router = APIRouter()

MANAGE = "tickets.manage"
CONFIGURE = "system.configure"
ID = r"^[A-Za-z0-9_.:-]{1,80}$"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _gate(conn: sqlite3.Connection) -> None:
    access.require_module(conn)
    svc.require_enabled(conn)


class SettingsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    changes: dict[str, Any]
    confirmed: Any = None


class SyncBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    device_id: str = Field(pattern=ID)
    ops: list[Any] = Field(default_factory=list, max_length=svc.MAX_OPS)


class DeviceBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    device_id: str = Field(pattern=ID)


class AckBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    device_id: str | None = Field(default=None, pattern=ID)


class TagBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tag: str = Field(max_length=120)


class ReviewBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: str
    note: str = Field(default="", max_length=500)


class ReasonBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(default="", max_length=200)


class PointBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    entity_id: str | None = Field(default=None, max_length=120)
    place_text: str = Field(default="", max_length=200)


class ConfirmBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirmed: Any = None


def _confirmed(v: Any) -> None:
    if v is not True:
        raise ApiError(409, "confirmation_required", "הפעולה דורשת אישור מפורש.")


# ---------------------------------------------------------------- settings (system administrator)

@router.get("/field/offline/settings")
def get_settings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    return {"settings": svc.settings_view(conn)}


@router.put("/field/offline/settings")
def put_settings(body: SettingsBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    _confirmed(body.confirmed)
    changed = svc.update_settings(conn, principal, body.changes, _rid(request))
    return {"settings": svc.settings_view(conn), "changed": sorted(changed)}


@router.post("/field/offline/tag-key/rotate")
def rotate(body: ConfirmBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    _confirmed(body.confirmed)
    svc.rotate_tag_key(settings_of(request).data_dir)
    audit(conn, actor=principal, action="offline.tag_key.rotate", decision="allowed", resource_type="offline_tag_key", resource_id="key", request_id=_rid(request))
    return {"rotated": True}


# ---------------------------------------------------------------- technician

@router.get("/field/offline/bundle")
def get_bundle(device_id: str = Query(pattern=ID), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    return svc.build_bundle(conn, principal, device_id)


@router.post("/field/offline/sync")
def post_sync(body: SyncBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    return svc.sync(conn, principal, settings_of(request).data_dir, body.device_id, body.ops, _rid(request))


@router.post("/field/offline/wipe-confirmed")
def post_wipe_confirmed(body: DeviceBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    svc.confirm_wipe(conn, principal.user_id, body.device_id)
    return {"confirmed": True}


@router.get("/field/offline/day-list")
def get_day_list(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn)
    return svc.day_list(conn, principal, DEFAULT_TZ)


@router.post("/field/offline/day-list/ack")
def post_ack(body: AckBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    return svc.ack_day(conn, principal, body.device_id, DEFAULT_TZ)


@router.post("/field/offline/tags/verify")
def post_verify(body: TagBody, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn)
    point = svc.verify_tag(conn, settings_of(request).data_dir, body.tag)
    return {"valid": point is not None, "point": ({"id": point["id"], "name": point["name"], "entity_id": point["entity_id"], "place_text": point["place_text"]} if point else None)}


# ---------------------------------------------------------------- managers

@router.get("/field/offline/review")
def get_review(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn)
    require(conn, principal, MANAGE, INSTALLATION)
    return {"items": svc.review_list(conn)}


@router.post("/field/offline/review/{op_id}")
def post_review(body: ReviewBody, request: Request, op_id: str = Path(pattern=ID), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    require(conn, principal, MANAGE, INSTALLATION)
    return svc.review_resolve(conn, principal, op_id, body.decision, body.note, _rid(request))


@router.get("/field/offline/devices")
def get_devices(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn)
    require(conn, principal, MANAGE, INSTALLATION)
    return {"devices": [dict(r) for r in conn.execute("SELECT * FROM offline_devices ORDER BY last_seen_at DESC LIMIT 500").fetchall()]}


@router.post("/field/offline/devices/{user_id}/{device_id}/{action}")
def post_device(body: ReasonBody, request: Request, user_id: str = Path(pattern=ID), device_id: str = Path(pattern=ID), action: str = Path(pattern=r"^(lock|unlock|wipe|reenroll)$"),
                principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    require(conn, principal, MANAGE, INSTALLATION)
    return svc.set_device_state(conn, principal, user_id, device_id, action, body.reason, _rid(request))


@router.get("/field/offline/round-points")
def get_points(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn)
    require(conn, principal, MANAGE, INSTALLATION)
    return {"points": [dict(r) for r in conn.execute("SELECT * FROM offline_round_points ORDER BY name").fetchall()]}


@router.post("/field/offline/round-points", status_code=201)
def post_point(body: PointBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    require(conn, principal, MANAGE, INSTALLATION)
    return svc.create_point(conn, principal, body.name, body.entity_id, body.place_text, _rid(request))


@router.get("/field/offline/round-points/{point_id}/tag")
def get_tag(request: Request, point_id: str = Path(pattern=ID), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    require(conn, principal, MANAGE, INSTALLATION)
    if conn.execute("SELECT 1 FROM offline_round_points WHERE id = ?", (point_id,)).fetchone() is None:
        raise ApiError(404, "point_not_found", "נקודת הסבב לא נמצאה.")
    return {"tag": svc.make_tag(settings_of(request).data_dir, point_id)}
