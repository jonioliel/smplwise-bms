"""CAMSUGGEST138-295: 'suggest the nearest camera for a zone' in the floor-plan studio - the accepted link.

The ranking itself is pure geometry on the client (frontend/src/map/camera-suggest.ts): it needs only the zone polygon and the
camera pins the editor already holds; its defaults (max distance, FOV weight, count) are the installation settings
`plan.camsuggest_*` (routers/settings.py, Settings > Map). The server keeps the camera an editor ACCEPTED for a zone. No migration:
the link lives in the `settings` key/value table. A suggestion is never applied automatically - PUT /zones/{id}/suggested-camera
is only ever called from the accept button."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import get_setting, now_iso, set_setting
from ..errors import ApiError, not_found
from ..rbac import Principal, require

router = APIRouter()

LINK_PREFIX = "plan.zone_camera."


class LinkIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    anchor_id: str = Field(min_length=1, max_length=64)


def _zone(conn: sqlite3.Connection, zone_id: str) -> sqlite3.Row:
    z = conn.execute("SELECT id, floor_id FROM spatial_zones WHERE id = ?", (zone_id,)).fetchone()
    if z is None:
        raise not_found("האזור לא נמצא.")
    return z


def _link_view(conn: sqlite3.Connection, zone_id: str) -> dict[str, Any]:
    raw = get_setting(conn, LINK_PREFIX + zone_id)
    empty = {"zone_id": zone_id, "anchor_id": None, "updated_at": None}
    if not raw:
        return empty
    try:
        d = json.loads(raw)
    except ValueError:
        return empty
    a = conn.execute("SELECT id FROM map_anchors WHERE id = ? AND effective_to IS NULL AND resource_type = 'camera'", (d.get("anchor_id"),)).fetchone()
    # a camera pin removed since: the link reads as empty (the stored value is replaced on the next accept)
    return {"zone_id": zone_id, "anchor_id": a["id"], "updated_at": d.get("updated_at")} if a else empty


@router.get("/zones/{zone_id}/suggested-camera")
def get_zone_camera(zone_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    z = _zone(conn, zone_id)
    require(conn, principal, "map.read", ("floor", z["floor_id"]))
    return _link_view(conn, zone_id)


@router.put("/zones/{zone_id}/suggested-camera")
def accept_zone_camera(zone_id: str, request: Request, body: LinkIn, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The editor accepted a suggestion: the camera pin becomes the zone's camera. The pin must be a live camera pin on the same floor."""
    z = _zone(conn, zone_id)
    require(conn, principal, "placement.edit", ("floor", z["floor_id"]))
    a = conn.execute("SELECT id FROM map_anchors WHERE id = ? AND floor_id = ? AND effective_to IS NULL AND resource_type = 'camera'", (body.anchor_id, z["floor_id"])).fetchone()
    if a is None:
        raise ApiError(422, "camera_not_on_floor", "המצלמה אינה מוצבת בקומה של האזור")
    ts = now_iso()
    set_setting(conn, LINK_PREFIX + zone_id, json.dumps({"anchor_id": a["id"], "updated_at": ts}))
    audit(conn, actor=principal, action="plan.zone_camera.accept", decision="allowed", resource_type="zone", resource_id=zone_id,
          request_id=getattr(request.state, "correlation_id", None), details={"anchor_id": a["id"]})
    return {"zone_id": zone_id, "anchor_id": a["id"], "updated_at": ts}


@router.delete("/zones/{zone_id}/suggested-camera")
def clear_zone_camera(zone_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    z = _zone(conn, zone_id)
    require(conn, principal, "placement.edit", ("floor", z["floor_id"]))
    conn.execute("DELETE FROM settings WHERE key = ?", (LINK_PREFIX + zone_id,))
    audit(conn, actor=principal, action="plan.zone_camera.clear", decision="allowed", resource_type="zone", resource_id=zone_id,
          request_id=getattr(request.state, "correlation_id", None), details={})
    return {"zone_id": zone_id, "anchor_id": None, "updated_at": None}
