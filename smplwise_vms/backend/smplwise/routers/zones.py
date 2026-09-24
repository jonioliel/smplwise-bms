"""Spatial zones (design M13): named rooms and areas as normalized polygons on a floor. They are a data layer
next to the plan image (never burnt into it), separate from camera detection zones and privacy masks.
Candidates come from the local room detection (plan_zones); the editor names, keeps or discards them."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import new_id, now_iso, unlocked
from ..errors import ApiError, conflict, not_found
from ..rbac import Principal, require
from ..services import plan_zones
from .anchors import _editor_version
from .catalog import get_floor

router = APIRouter()

KINDS = ("room", "zone", "corridor", "outdoor", "service")
PALETTE = ["#2767ED", "#22A06B", "#F59E0B", "#8B5CF6", "#0EA5E9", "#EC4899", "#14B8A6", "#F97316"]


class Point(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class ZoneIn(BaseModel):
    name: str = Field(default="", max_length=80)
    kind: str = Field(default="room", pattern="^(room|zone|corridor|outdoor|service)$")
    polygon: list[Point] = Field(min_length=3, max_length=200)
    color: str | None = Field(default=None, pattern="^#[0-9a-fA-F]{6}$")
    searchable: bool = True
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")


class ZonePatch(BaseModel):
    revision: int = Field(ge=1)
    name: str | None = Field(default=None, max_length=80)
    kind: str | None = Field(default=None, pattern="^(room|zone|corridor|outdoor|service)$")
    polygon: list[Point] | None = Field(default=None, min_length=3, max_length=200)
    color: str | None = Field(default=None, pattern="^#[0-9a-fA-F]{6}$")
    searchable: bool | None = None
    level_id: str | None = Field(default=None, max_length=64)
    ceiling_height_m: float | None = Field(default=None, ge=0, le=50)
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")


class DetectIn(BaseModel):
    strength: str = Field(default="medium", pattern="^(light|medium|strong)$")


class Candidate(BaseModel):
    polygon: list[Point] = Field(min_length=3, max_length=200)
    name: str = Field(default="", max_length=80)
    kind: str = Field(default="room", pattern="^(room|zone|corridor|outdoor|service)$")


class AcceptIn(BaseModel):
    candidates: list[Candidate] = Field(min_length=1, max_length=60)
    replace_auto: bool = False


def zone_row(r: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": r["id"],
        "floor_id": r["floor_id"],
        "plan_version_id": r["plan_version_id"],
        "name": r["name"],
        "kind": r["kind"],
        "polygon": json.loads(r["polygon_json"]),
        "color": r["color"],
        "label_pos": r["label_pos"] or "auto",
        "source": r["source"],
        "searchable": bool(r["searchable"]),
        "level_id": r["level_id"] if "level_id" in r.keys() else None,
        "ceiling_height_m": r["ceiling_height_m"] if "ceiling_height_m" in r.keys() else None,
        "revision": r["revision"],
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
    }


def floor_zones(conn: sqlite3.Connection, floor_id: str) -> list[dict[str, Any]]:
    return [zone_row(r) for r in conn.execute("SELECT * FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL ORDER BY created_at, rowid", (floor_id,)).fetchall()]


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _get_zone(conn: sqlite3.Connection, zone_id: str) -> sqlite3.Row:
    r = conn.execute("SELECT * FROM spatial_zones WHERE id = ? AND deleted_at IS NULL", (zone_id,)).fetchone()
    if not r:
        raise not_found("האזור לא נמצא.")
    return r


def _insert(conn: sqlite3.Connection, principal: Principal, floor_id: str, version_id: str | None, name: str, kind: str, polygon: list[Point], color: str | None, source: str, searchable: bool = True) -> str:
    zid = new_id()
    now = now_iso()
    n = conn.execute("SELECT COUNT(*) FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL", (floor_id,)).fetchone()[0]
    conn.execute(
        "INSERT INTO spatial_zones(id, floor_id, plan_version_id, name, kind, polygon_json, color, source, searchable, revision, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?)",
        (zid, floor_id, version_id, name.strip(), kind, json.dumps([{"x": round(p.x, 4), "y": round(p.y, 4)} for p in polygon]), color or PALETTE[n % len(PALETTE)], source, 1 if searchable else 0, principal.user_id, now, now),
    )
    return zid


@router.get("/floors/{floor_id}/zones")
def list_zones_api(floor_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_floor(conn, floor_id)
    require(conn, principal, "map.read", ("floor", floor_id))
    return {"zones": floor_zones(conn, floor_id)}


@router.post("/floors/{floor_id}/zones", status_code=201)
def create_zone(floor_id: str, body: ZoneIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_floor(conn, floor_id)
    require(conn, principal, "placement.edit", ("floor", floor_id))
    v = _editor_version(conn, floor_id)
    zid = _insert(conn, principal, floor_id, v["id"] if v else None, body.name, body.kind, body.polygon, body.color, "manual", body.searchable)
    audit(conn, actor=principal, action="zone.create", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request), details={"zone_id": zid, "name": body.name, "kind": body.kind, "points": len(body.polygon)})
    return zone_row(_get_zone(conn, zid))


@router.patch("/zones/{zone_id}")
def update_zone(zone_id: str, body: ZonePatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    z = _get_zone(conn, zone_id)
    require(conn, principal, "placement.edit", ("floor", z["floor_id"]))
    if body.revision != z["revision"]:
        raise conflict("stale_revision", "האזור השתנה בינתיים; טען מחדש לפני שמירה.", current_revision=z["revision"])
    fields: dict[str, Any] = {}
    if body.name is not None:
        fields["name"] = body.name.strip()
    if body.kind is not None:
        fields["kind"] = body.kind
    if body.polygon is not None:
        fields["polygon_json"] = json.dumps([{"x": round(p.x, 4), "y": round(p.y, 4)} for p in body.polygon])
    if body.color is not None:
        fields["color"] = body.color
    if body.searchable is not None:
        fields["searchable"] = 1 if body.searchable else 0
    if body.level_id is not None:
        fields["level_id"] = body.level_id or None  # "" = the floor's default level
    if body.ceiling_height_m is not None:
        fields["ceiling_height_m"] = body.ceiling_height_m or None  # 0 = the level's ceiling
    if body.label_pos is not None:
        fields["label_pos"] = body.label_pos
    if body.label_pos is not None:
        fields["label_pos"] = body.label_pos
    if body.label_pos is not None:
        fields["label_pos"] = body.label_pos
    if body.label_pos is not None:
        fields["label_pos"] = body.label_pos
    if not fields:
        return zone_row(z)
    fields["revision"] = z["revision"] + 1
    fields["updated_at"] = now_iso()
    conn.execute(f"UPDATE spatial_zones SET {', '.join(f'{k} = ?' for k in fields)} WHERE id = ?", (*fields.values(), zone_id))
    audit(conn, actor=principal, action="zone.update", decision="allowed", resource_type="zone", resource_id=zone_id, request_id=_rid(request), details={k: v for k, v in fields.items() if k != "polygon_json"} | ({"points": len(body.polygon)} if body.polygon else {}))
    return zone_row(_get_zone(conn, zone_id))


@router.delete("/zones/{zone_id}", status_code=204)
def delete_zone(zone_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    z = _get_zone(conn, zone_id)
    require(conn, principal, "placement.edit", ("floor", z["floor_id"]))
    conn.execute("UPDATE spatial_zones SET deleted_at = ? WHERE id = ?", (now_iso(), zone_id))
    audit(conn, actor=principal, action="zone.delete", decision="allowed", resource_type="zone", resource_id=zone_id, request_id=_rid(request), details={"name": z["name"]})


@router.post("/floors/{floor_id}/zones/detect")
def detect_zones(floor_id: str, body: DetectIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Room candidates from the floor's plan (local image processing; nothing is saved until accepted)."""
    get_floor(conn, floor_id)
    require(conn, principal, "placement.edit", ("floor", floor_id))
    v = _editor_version(conn, floor_id)
    if not v:
        raise ApiError(409, "no_plan", "לקומה אין תוכנית עדיין.")
    settings = settings_of(request)
    src = settings.data_dir / v["image_path"]
    if not src.exists():
        raise not_found("תמונת התוכנית חסרה בדיסק.")
    try:
        with unlocked(conn):
            result = plan_zones.detect_rooms(src, body.strength)
    except (OSError, ValueError, MemoryError) as exc:
        raise ApiError(500, "detect_failed", "זיהוי החדרים נכשל.", details={"error": type(exc).__name__})
    audit(conn, actor=principal, action="zone.detect", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request), details={"rooms": len(result["rooms"]), "strength": body.strength})
    return {**result, "plan_version_id": v["id"], "existing_auto": conn.execute("SELECT COUNT(*) FROM spatial_zones WHERE floor_id = ? AND source = 'auto' AND deleted_at IS NULL", (floor_id,)).fetchone()[0]}


@router.post("/floors/{floor_id}/zones/accept", status_code=201)
def accept_zones(floor_id: str, body: AcceptIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Save chosen candidates as zones (source 'auto'); optionally replace the previous automatic ones."""
    get_floor(conn, floor_id)
    require(conn, principal, "placement.edit", ("floor", floor_id))
    v = _editor_version(conn, floor_id)
    if body.replace_auto:
        conn.execute("UPDATE spatial_zones SET deleted_at = ? WHERE floor_id = ? AND source = 'auto' AND deleted_at IS NULL", (now_iso(), floor_id))
    ids = []
    for i, cnd in enumerate(body.candidates):
        name = cnd.name.strip() or f"חדר {i + 1}"
        ids.append(_insert(conn, principal, floor_id, v["id"] if v else None, name, cnd.kind, cnd.polygon, None, "auto"))
    audit(conn, actor=principal, action="zone.accept", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request), details={"zones": len(ids), "replace_auto": body.replace_auto})
    return {"zones": floor_zones(conn, floor_id), "created": ids}
