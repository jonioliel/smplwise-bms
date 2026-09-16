"""Map anchors (placements) with optimistic revisions and tombstones; the floor map bundle used by the
viewer and the editor (ch. 12, 13)."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn
from ..db import new_id, now_iso
from ..errors import ApiError, conflict, not_found
from ..rbac import Principal, authorize, require
from .catalog import building_row, floor_row, get_building, get_floor, get_site, site_row
from ..services.timeutil import parse_utc
from .plans import needs_alignment, version_at, version_row

router = APIRouter()


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def anchor_row(r: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": r["id"], "floor_id": r["floor_id"], "plan_version_id": r["plan_version_id"], "resource_type": r["resource_type"],
        "resource_id": r["resource_id"], "position": {"x": r["x"], "y": r["y"]}, "rotation_degrees": r["rotation_degrees"],
        "field_of_view_degrees": r["field_of_view_degrees"], "layer_id": r["layer_id"], "label": r["label"], "revision": r["revision"],
        "effective_from": r["effective_from"], "effective_to": r["effective_to"], "updated_at": r["updated_at"],
    }


def camera_row(r: sqlite3.Row) -> dict[str, Any]:
    try:
        caps = json.loads(r["capabilities_json"] or "{}")
    except ValueError:
        caps = {}
    return {
        "id": r["id"], "recorder_id": r["recorder_id"], "channel": r["channel"], "name": r["alias"] or r["name_source"] or f"ערוץ {r['channel']}",
        "name_source": r["name_source"], "alias": r["alias"], "enabled": bool(r["enabled"]), "sort_order": r["sort_order"],
        "main_track": r["main_track"], "sub_track": r["sub_track"], "status": r["status"], "last_seen_at": r["last_seen_at"],
        "stream": caps.get("stream"),
    }


def get_anchor(conn: sqlite3.Connection, anchor_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM map_anchors WHERE id = ? AND effective_to IS NULL", (anchor_id,)).fetchone()
    if not row:
        raise not_found("העוגן לא נמצא.")
    return row


def _current_version(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'published'", (floor_id,)).fetchone()


def _zones_for(conn: sqlite3.Connection, floor_id: str) -> list[dict[str, Any]]:
    from .zones import floor_zones  # local import: zones depends on this module

    return floor_zones(conn, floor_id)


def _editor_version(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    draft = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'draft' ORDER BY created_at DESC LIMIT 1", (floor_id,)).fetchone()
    return draft or _current_version(conn, floor_id)


@router.get("/floors/{floor_id}/map")
def floor_map(floor_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), draft: bool = False, at: str | None = None) -> dict[str, Any]:
    """Everything the map needs in one call. `draft=true` (editors) prefers the latest draft background; `at=<UTC>`
    returns the version that was published at that instant and the anchors effective then (historical map, T038)."""
    f = get_floor(conn, floor_id)
    require(conn, principal, "map.read", ("floor", floor_id))
    can_edit = authorize(conn, principal, "placement.edit", ("floor", floor_id)).allowed
    can_publish = authorize(conn, principal, "map.publish", ("floor", floor_id)).allowed
    at_iso: str | None = None
    history: str | None = None
    history_from = conn.execute("SELECT MIN(published_at) FROM plan_versions WHERE floor_id = ? AND published_at IS NOT NULL", (floor_id,)).fetchone()[0]
    if at:
        try:
            at_iso = parse_utc(at).strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            raise ApiError(422, "validation", "זמן חייב להיות UTC (Z).")
    if at_iso and history_from and at_iso >= history_from:
        # the floor's map history begins with its first publish; from then on the version and the anchors of that instant
        history = "exact"
        version = version_at(conn, floor_id, at_iso)
        anchors = conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?) ORDER BY layer_id, resource_id", (floor_id, at_iso, at_iso)).fetchall()
    else:
        # before the history begins (or without `at`): the current map, so older events still get a map
        history = "current" if at_iso else None
        version = _editor_version(conn, floor_id) if (draft and can_edit and not at_iso) else _current_version(conn, floor_id)
        anchors = conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL ORDER BY layer_id, resource_id", (floor_id,)).fetchall()
    cameras = {r["id"]: camera_row(r) for r in conn.execute("SELECT * FROM cameras ORDER BY sort_order, channel").fetchall()}
    from ..services import ha_bridge, ha_sync

    entity_ids = [a["resource_id"] for a in anchors if a["resource_type"] == "ha_entity"]
    entities: dict[str, Any] = {}
    if entity_ids:
        can_control = authorize(conn, principal, "ha.entity.control", ("floor", floor_id)).allowed
        for r in conn.execute(f"SELECT * FROM ha_entities WHERE entity_id IN ({','.join('?' * len(entity_ids))})", entity_ids).fetchall():
            e = ha_sync.entity_row(r)
            e["actions"] = ha_bridge.actions_for(e["domain"]) if can_control else []
            entities[e["entity_id"]] = e
    b = get_building(conn, f["building_id"])
    s = get_site(conn, b["site_id"])
    return {
        "floor": floor_row(conn, f),
        "building": building_row(b),
        "site": site_row(s),
        "plan": version_row(version) if version else None,
        "anchors": [dict(anchor_row(a), camera=cameras.get(a["resource_id"]) if a["resource_type"] == "camera" else None, entity=entities.get(a["resource_id"]) if a["resource_type"] == "ha_entity" else None) for a in anchors],
        "ha_sync": ha_sync.STATE.as_dict(),
        "zones": _zones_for(conn, floor_id),
        "needs_alignment": needs_alignment(conn, version, anchors),
        "at": at_iso,
        "history": history,
        "history_from": history_from,
        "permissions": {"edit": can_edit, "publish": can_publish, "import": authorize(conn, principal, "map.import", ("floor", floor_id)).allowed},
        "cameras": list(cameras.values()) if can_edit else [c for c in cameras.values() if any(a["resource_id"] == c["id"] for a in anchors)],
    }


class AnchorIn(BaseModel):
    resource_type: str = Field(pattern="^(camera|ha_entity)$")
    resource_id: str = Field(min_length=1, max_length=120)
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    rotation_degrees: float = Field(default=0, ge=0, lt=360)
    field_of_view_degrees: float | None = Field(default=None, gt=0, le=360)
    layer_id: str = Field(default="cameras", max_length=40)
    label: str | None = Field(default=None, max_length=120)


class AnchorPatch(BaseModel):
    revision: int = Field(ge=1)
    x: float | None = Field(default=None, ge=0, le=1)
    y: float | None = Field(default=None, ge=0, le=1)
    rotation_degrees: float | None = Field(default=None, ge=0, lt=360)
    field_of_view_degrees: float | None = Field(default=None, gt=0, le=360)
    layer_id: str | None = Field(default=None, max_length=40)
    label: str | None = Field(default=None, max_length=120)


@router.get("/floors/{floor_id}/anchors")
def list_anchors(floor_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_floor(conn, floor_id)
    require(conn, principal, "map.read", ("floor", floor_id))
    rows = conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL ORDER BY layer_id, resource_id", (floor_id,)).fetchall()
    return {"anchors": [anchor_row(r) for r in rows]}


@router.post("/floors/{floor_id}/anchors", status_code=201)
def create_anchor(floor_id: str, body: AnchorIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_floor(conn, floor_id)
    require(conn, principal, "placement.edit", ("floor", floor_id))
    version = _editor_version(conn, floor_id)
    if not version:
        raise conflict("no_plan", "לקומה אין תוכנית; העלה תוכנית לפני הצבת פריטים.")
    if body.resource_type == "camera" and not conn.execute("SELECT 1 FROM cameras WHERE id = ?", (body.resource_id,)).fetchone():
        raise ApiError(422, "validation", "המצלמה אינה רשומה במערכת.")
    if body.resource_type == "ha_entity":
        ent = conn.execute("SELECT domain FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (body.resource_id,)).fetchone()
        if not ent:
            raise ApiError(422, "validation", "הישות אינה בקטלוג Home Assistant של המערכת.")
        if body.layer_id == "cameras":  # default layer by domain unless the editor chose one
            body.layer_id = "doors" if ent["domain"] in ("lock", "cover") else "lights" if ent["domain"] in ("light", "switch", "fan") else "sensors"
    dup = conn.execute("SELECT id FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL AND resource_type = ? AND resource_id = ?", (floor_id, body.resource_type, body.resource_id)).fetchone()
    if dup:
        raise conflict("already_placed", "הפריט כבר מוצב על הקומה הזו.", anchor_id=dup["id"])
    aid, now = new_id(), now_iso()
    conn.execute(
        """INSERT INTO map_anchors(id, floor_id, plan_version_id, resource_type, resource_id, x, y, rotation_degrees, field_of_view_degrees, layer_id, label, revision, effective_from, created_by, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)""",
        (aid, floor_id, version["id"], body.resource_type, body.resource_id, body.x, body.y, body.rotation_degrees, body.field_of_view_degrees, body.layer_id, body.label, now, principal.user_id, principal.user_id, now),
    )
    audit(conn, actor=principal, action="anchor.create", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
          details={"anchor_id": aid, "resource": f"{body.resource_type}:{body.resource_id}", "x": body.x, "y": body.y})
    return anchor_row(get_anchor(conn, aid))


@router.patch("/map-anchors/{anchor_id}")
def update_anchor(anchor_id: str, body: AnchorPatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    a = get_anchor(conn, anchor_id)
    require(conn, principal, "placement.edit", ("floor", a["floor_id"]))
    if body.revision != a["revision"]:
        raise conflict("stale_revision", "העוגן השתנה בינתיים; טען מחדש ובחר איך למזג.", current_revision=a["revision"], sent_revision=body.revision)
    fields = {k: v for k, v in body.model_dump().items() if k != "revision" and v is not None}
    before = {k: a[k] for k in fields}
    if fields:
        sets = ", ".join(f"{k} = ?" for k in fields)
        conn.execute(f"UPDATE map_anchors SET {sets}, revision = revision + 1, updated_by = ?, updated_at = ? WHERE id = ?", (*fields.values(), principal.user_id, now_iso(), anchor_id))
    audit(conn, actor=principal, action="anchor.update", decision="allowed", resource_type="floor", resource_id=a["floor_id"], request_id=_rid(request),
          details={"anchor_id": anchor_id, "before": before, "after": fields})
    return anchor_row(get_anchor(conn, anchor_id))


@router.delete("/map-anchors/{anchor_id}", status_code=204)
def delete_anchor(anchor_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    a = get_anchor(conn, anchor_id)
    require(conn, principal, "placement.edit", ("floor", a["floor_id"]))
    now = now_iso()
    conn.execute("UPDATE map_anchors SET effective_to = ?, updated_by = ?, updated_at = ? WHERE id = ?", (now, principal.user_id, now, anchor_id))
    audit(conn, actor=principal, action="anchor.delete", decision="allowed", resource_type="floor", resource_id=a["floor_id"], request_id=_rid(request),
          details={"anchor_id": anchor_id, "resource": f"{a['resource_type']}:{a['resource_id']}"})
