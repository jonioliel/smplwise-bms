"""Spatial zones (design M13): named rooms and areas as normalized polygons on a floor. They are a data layer
next to the plan image (never burnt into it), separate from camera detection zones and privacy masks.
Candidates come from the local room detection (plan_zones); the editor names, keeps or discards them."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel, Field, field_validator

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import new_id, now_iso, unlocked
from ..errors import ApiError, conflict, not_found
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import plan_geometry as pg
from ..services import plan_zones
from ..services import shared_spaces
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
    level_id: str | None = Field(default=None, max_length=64)  # free text: not checked against the document's levels
    ceiling_height_m: float | None = Field(default=None, ge=0, le=50)
    tags: list[str] | None = None  # replaces the list; [] clears it
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")


    @field_validator("tags")
    @classmethod
    def _clean_tags(cls, v: list[str] | None) -> list[str] | None:
        """Free-text tags (T085) by the structure document's own rule, plan_geometry.check_tags: trimmed, merged
        case-insensitively, bounded on the cleaned list. A refused list answers 422."""
        if v is None:
            return None
        cleaned, problem = pg.check_tags(v)
        if problem is not None:
            raise ValueError(pg.TAG_PROBLEMS[problem])
        return cleaned


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
        "tags": json.loads(r["tags_json"]) if "tags_json" in r.keys() and r["tags_json"] else [],
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


def _via_share(conn: sqlite3.Connection, z: sqlite3.Row, from_floor_id: str | None):
    """CR-009 decision 1: a shared room is edited from either floor. `from_floor_id` = the other floor the edit comes
    from: it must show the room (an active share), and the placement maps its coordinates back to the home plan.
    Returns the placement (None for an edit made on the home floor itself)."""
    if not from_floor_id or from_floor_id == z["floor_id"]:
        return None
    from ..services import geometry_store as store

    share = next((s for s in shared_spaces.shares_of_zone(conn, z["id"]) if s.floor_id == from_floor_id), None)
    if share is None:
        raise ApiError(422, "not_shared", "החדר לא משותף עם הקומה הזו.")
    home_v, other_v = store.editor_version(conn, z["floor_id"]), store.editor_version(conn, from_floor_id)
    return shared_spaces.Placement(share.placement, shared_spaces._dims_of(home_v), shared_spaces._dims_of(other_v))


@router.patch("/zones/{zone_id}")
def update_zone(zone_id: str, body: ZonePatch, request: Request, from_floor_id: str | None = None, principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    z = _get_zone(conn, zone_id)
    place = _via_share(conn, z, from_floor_id)
    require(conn, principal, "placement.edit", ("floor", from_floor_id if place is not None else z["floor_id"]))
    group = shared_spaces.zone_in_share(conn, zone_id)
    if group is not None and (place is not None or body.polygon is not None):
        # security review B1: a shared room's outline decides what content every floor of it shows - reshaping it (or
        # editing it through another floor's map) needs the share rights on EVERY floor of the room; a deny anywhere wins
        for fid in group.floors:
            require(conn, principal, "map.edit", ("floor", fid))
            require(conn, principal, "placement.edit", ("floor", fid))
    if body.revision != z["revision"]:
        raise conflict("stale_revision", "האזור השתנה בינתיים; טען מחדש לפני שמירה.", current_revision=z["revision"])
    fields: dict[str, Any] = {}
    if body.name is not None:
        fields["name"] = body.name.strip()
    if body.kind is not None:
        fields["kind"] = body.kind
    if body.polygon is not None:
        pts = [(p.x, p.y) for p in body.polygon] if place is None else [tuple(place.ipt((p.x, p.y))) for p in body.polygon]
        if any(not (0 <= x <= 1 and 0 <= y <= 1) for x, y in pts):
            raise ApiError(422, "validation", "המצולע יוצא מגבולות התוכנית של קומת החדר.")
        fields["polygon_json"] = json.dumps([{"x": round(x, 4), "y": round(y, 4)} for x, y in pts])
    if place is not None and body.level_id is not None:
        body.level_id = None  # a level of the other floor is not a level of the room's floor
    if body.color is not None:
        fields["color"] = body.color
    if body.searchable is not None:
        fields["searchable"] = 1 if body.searchable else 0
    if body.level_id is not None:
        fields["level_id"] = body.level_id or None  # "" = the floor's default level
    if body.ceiling_height_m is not None:
        fields["ceiling_height_m"] = body.ceiling_height_m or None  # 0 = the level's ceiling
    if body.tags is not None:
        fields["tags_json"] = json.dumps(body.tags, ensure_ascii=False) if body.tags else None  # [] = no tags
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
    audit(conn, actor=principal, action="zone.update", decision="allowed", resource_type="zone", resource_id=zone_id, request_id=_rid(request),
          details={k: v for k, v in fields.items() if k != "polygon_json"} | ({"points": len(body.polygon)} if body.polygon else {}) | ({"via_floor_id": from_floor_id} if place is not None else {}))
    return zone_row(_get_zone(conn, zone_id))


# ---------------------------------------------------------------- shared space (CR-009)

class ShareIn(BaseModel):
    floor_id: str = Field(min_length=1, max_length=32)
    duplicate_zone_id: str | None = Field(default=None, min_length=1, max_length=32)
    rotation_deg: float = Field(default=0, ge=0, lt=360)
    auto: bool = True  # pick the duplicate room by name and overlap when none is given


class PlacementIn(BaseModel):
    revision: int = Field(ge=1)
    mode: str = Field(pattern="^(same_frame|fit)$")
    from_: list[float] | None = Field(default=None, alias="from", min_length=2, max_length=2)
    to: list[float] | None = Field(default=None, min_length=2, max_length=2)
    rotation_deg: float = Field(default=0, ge=0, lt=360)
    scale: float = Field(default=1, gt=0.01, le=100)


def _share_rights(conn: sqlite3.Connection, principal: Principal, floors: list[str] | tuple[str, ...], apply: bool, cameras: list[str] = ()) -> None:  # type: ignore[assignment]
    """Sharing widens reach (CR-009 §6, security review B1): map.edit on EVERY floor of the room to look (the preview
    shows each floor's drawing), and to apply or to add a member also placement.edit on every floor and placement reach
    on each camera that becomes a member (T055 B1: putting a camera on another floor's map). A deny anywhere wins."""
    for fid in dict.fromkeys(floors):
        require(conn, principal, "map.edit", ("floor", fid))
        if apply:
            require(conn, principal, "placement.edit", ("floor", fid))
    if apply and cameras:
        from ..services.access import require_camera_placement

        for cid in cameras:
            require_camera_placement(conn, principal, cid)


def _plan(conn: sqlite3.Connection, z: sqlite3.Row, body: ShareIn) -> dict[str, Any]:
    try:
        return shared_spaces.plan_conversion(conn, z, body.floor_id, body.duplicate_zone_id, body.rotation_deg, body.auto)
    except shared_spaces.SharedEditError as exc:
        raise ApiError(exc.status, exc.code, exc.message, details=exc.details)


def _floors_of(conn: sqlite3.Connection, z: sqlite3.Row, other_floor_id: str) -> list[str]:
    group = shared_spaces.group_of_zone(conn, z["id"])
    return [*(group.floors if group else (z["floor_id"],)), other_floor_id]


def _all_users(conn: sqlite3.Connection) -> list[str]:
    return [r[0] for r in conn.execute("SELECT id FROM users").fetchall()]


def _revoke(background: BackgroundTasks, users: list[str]) -> None:
    """Reach narrows now (streams and push sockets are re-checked) AND once more after the request's transaction is committed
    (main.CommitBeforeSend commits when the response starts; a background task runs after it): a stream that recomputes on the
    first generation change could otherwise read the still-committed OLD state and keep the old reach up to a minute."""
    from ..services import revocation

    revocation.mark(users)
    background.add_task(revocation.mark, users)


@router.post("/zones/{zone_id}/share/preview")
def share_preview(zone_id: str, body: ShareIn, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """"הפוך לחלל משותף" - what sharing this room with the other floor would do, written nowhere: the placement and its
    alignment check, the other floor's outline of the room (its duplicate room, kept), the duplicate content that leaves
    that floor's draft, and the members - the cameras and devices of either outline."""
    z = _get_zone(conn, zone_id)
    get_floor(conn, body.floor_id)
    _share_rights(conn, principal, _floors_of(conn, z, body.floor_id), apply=False)
    return shared_spaces.public(_plan(conn, z, body))


@router.post("/zones/{zone_id}/share")
def share_zone(zone_id: str, body: ShareIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The conversion, atomically: the duplicate content leaves the other floor's draft, its outline stays as that floor's
    outline of the room, the listed cameras and devices become members (each anchored where it is; a duplicate copy of a
    camera the room already has is tombstoned) and the share row is inserted. Every refusal comes before the first write."""
    z = _get_zone(conn, zone_id)
    get_floor(conn, body.floor_id)
    floors = _floors_of(conn, z, body.floor_id)
    _share_rights(conn, principal, floors, apply=True)
    plan = _plan(conn, z, body)
    _share_rights(conn, principal, floors, apply=True, cameras=shared_spaces.member_cameras(plan))  # review M3a
    now = now_iso()
    result = shared_spaces.apply_conversion(conn, z, plan, principal.user_id, now)
    rid = _rid(request)
    audit(conn, actor=principal, action="zone.share", decision="allowed", resource_type="zone", resource_id=zone_id, request_id=rid,
          details={"home_floor_id": z["floor_id"], "floor_id": body.floor_id, "share_id": result["share_id"], "placement": plan["placement"]["mode"],
                   "outline_zone_id": result["outline_zone_id"], "aligned": plan["aligned"]})
    audit(conn, actor=principal, action="geometry.shared.convert", decision="allowed", resource_type="floor", resource_id=body.floor_id, request_id=rid,
          details={"zone_id": zone_id, "home_floor_id": z["floor_id"], "removed": plan["remove"], "boundary_walls_kept": len(plan["boundary_walls_kept"]),
                   "anchors_dropped": len(result["dropped"])})
    for m in result["members_added"]:
        audit(conn, actor=principal, action="zone.share.member_add", decision="allowed", resource_type="zone", resource_id=zone_id, request_id=rid,
              details={"resource": f"{m['resource_type']}:{m['resource_id']}", "floors": floors})
    return {**shared_spaces.public(plan), **result}


@router.delete("/zones/{zone_id}/share/{floor_id}", status_code=204)
def unshare_zone(zone_id: str, floor_id: str, request: Request, background: BackgroundTasks, principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> None:
    """"בטל שיתוף": the other floor stops showing the room, and its readers stop reaching the room's members at once - the
    next request, and the open streams and push sockets now (revocation.mark, review M5). It drops the room's members
    with its last share, so it takes the share rights (map.edit + placement.edit) on BOTH floors of the pair (review
    L4, like removing a member); a deny on either floor refuses."""
    z = _get_zone(conn, zone_id)
    _share_rights(conn, principal, (z["floor_id"], floor_id), apply=True)
    if not shared_spaces.unshare(conn, zone_id, floor_id, principal.user_id, now_iso()):
        raise not_found("החדר לא משותף עם הקומה הזו.")
    audit(conn, actor=principal, action="zone.unshare", decision="allowed", resource_type="zone", resource_id=zone_id, request_id=_rid(request),
          details={"home_floor_id": z["floor_id"], "floor_id": floor_id})
    _revoke(background, _all_users(conn))


class MemberIn(BaseModel):
    resource_type: str = Field(pattern="^(camera|ha_entity|wiskey_station)$")
    resource_id: str = Field(min_length=1, max_length=shared_spaces.MAX_STATION_ID)


def _can_manage_members(conn: sqlite3.Connection, principal: Principal, floors: tuple[str, ...] | list[str]) -> bool:
    """The share rights without raising: map.edit and placement.edit on every floor of the room (the per-anchor action's
    rule; a camera additionally needs placement reach, checked when it is added)."""
    from ..rbac import authorize

    return all(authorize(conn, principal, p, ("floor", f)).allowed for f in floors for p in ("map.edit", "placement.edit"))


def _member_kind(resource_type: str, resource_id: str) -> str:
    if resource_type == "camera":
        return "camera"
    if resource_type == shared_spaces.STATION:
        return "station"
    domain = resource_id.split(".", 1)[0]
    return "door" if domain in ("lock", "doorbell", "intercom", "event") or "door" in resource_id else "device"


@router.get("/zones/{zone_id}/share/members")
def list_members(zone_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """"חברים בחלל המשותף" (owner 2026-09-30): whoever reaches ANY floor that shows the room sees, of its members, exactly
    what their own permissions allow per member - a camera through camera_scope (a deny on the camera, and later the
    per-person camera permissions, hide it), a device through its entity's visibility - never more because it is shared.
    Each member names the floors it is anchored on (a floor the reader may not read is "קומה אחרת"). `can_manage`: the
    share rights on every floor (add / remove); then `candidates` lists the anchors of the room's floors that are not
    members yet (the ones the reader sees). A WisKey station (CR-009 §13) is listed only for a reader who holds
    `access.read` (installation scope, as the WisKey screens require) and only by name - never its state, people, events,
    camera or a door command; it has no floors here (it is not anchored), and it is never a candidate of a reader without
    `access.read`."""
    z = _get_zone(conn, zone_id)
    group = shared_spaces.group_of_zone(conn, zone_id)
    if group is None:
        require(conn, principal, "map.read", ("floor", z["floor_id"]))  # review L3: the permission before the 404
        raise not_found("החדר אינו משותף.")
    from ..services.access import camera_scope, floor_reach
    from .ha import _entity_allowed

    reach = {f: floor_reach(conn, principal, f) for f in group.floors}
    if not any(r is not None for r in reach.values()):
        require(conn, principal, "map.read", ("floor", z["floor_id"]))  # the audited 403
    cams = camera_scope(conn, principal, "map.read")
    names = {r["id"]: r["name"] for r in conn.execute(f"SELECT id, name FROM floors WHERE id IN ({','.join('?' * len(group.floors))})", group.floors).fetchall()}

    manage = _can_manage_members(conn, principal, group.floors)
    stations = shared_spaces.served_stations(settings_of(request))  # None: WisKey has no honest copy right now

    def visible(rtype: str, rid: str) -> bool:
        if rtype == shared_spaces.STATION:  # CR-009 §13: the WisKey model (access.read), fail closed; a station WisKey no longer has is for managers only
            return shared_spaces.station_visible(conn, principal, rid) and (stations is None or rid in stations or manage)
        return cams.allows(rid) if rtype == "camera" else _entity_allowed(conn, principal, rid, "entity.state.read")

    def label(rtype: str, rid: str) -> str:
        if rtype == shared_spaces.STATION:
            s = (stations or {}).get(rid)
            return (s.get("name") or "עמדת WisKey") if s is not None else ("עמדת WisKey" if stations is None else "עמדה שאינה קיימת עוד ב־WisKey")
        if rtype == "camera":
            r = conn.execute("SELECT alias, name_source, channel FROM cameras WHERE id = ?", (rid,)).fetchone()
            return (r["alias"] or r["name_source"] or f"ערוץ {r['channel']}") if r is not None else rid
        r = conn.execute("SELECT name FROM ha_entities WHERE entity_id = ?", (rid,)).fetchone()
        return (r["name"] or rid) if r is not None else rid

    q = ",".join("?" * len(group.floors))
    live = conn.execute(f"SELECT id, floor_id, resource_type, resource_id FROM map_anchors WHERE effective_to IS NULL AND floor_id IN ({q}) ORDER BY floor_id, resource_type, resource_id",
                        group.floors).fetchall()
    placed: dict[tuple[str, str], list[str]] = {}
    for a in live:
        placed.setdefault((a["resource_type"], a["resource_id"]), [])
        if a["floor_id"] not in placed[(a["resource_type"], a["resource_id"])]:
            placed[(a["resource_type"], a["resource_id"])].append(a["floor_id"])
    fl = lambda fid: {"floor_id": fid, "name": names.get(fid, "") if reach.get(fid) is not None else shared_spaces.OTHER_FLOOR}  # noqa: E731
    members = []
    keys: set[tuple[str, str]] = set()
    for m in shared_spaces.member_rows(conn, zone_id):
        key = (m["resource_type"], m["resource_id"])
        keys.add(key)
        if not visible(*key):
            continue
        members.append({"resource_type": key[0], "resource_id": key[1], "kind": _member_kind(*key), "name": label(*key), "added_at": m["added_at"],
                        "floors": [fl(f) for f in placed.get(key, [])]})
    out: dict[str, Any] = {"zone_id": zone_id, "floors": [fl(f) for f in group.floors], "members": members, "can_manage": manage}
    if manage:
        cand = [{"resource_type": k[0], "resource_id": k[1], "kind": _member_kind(*k), "name": label(*k), "floors": [fl(f) for f in fs]}
                for k, fs in sorted(placed.items()) if k not in keys and visible(*k)]
        for sid, s in sorted((stations or {}).items(), key=lambda kv: (kv[1].get("name") or "", kv[0])):
            if (shared_spaces.STATION, sid) not in keys and shared_spaces.station_visible(conn, principal, sid):
                cand.append({"resource_type": shared_spaces.STATION, "resource_id": sid, "kind": "station", "name": s.get("name") or "עמדת WisKey", "floors": []})
        out["candidates"] = cand
    return out


@router.post("/zones/{zone_id}/share/members", status_code=201)
def add_member(zone_id: str, body: MemberIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """"הוסף לחלל המשותף": a camera or device of the room reaches every floor that shows it - the share rights on every
    floor of the room and placement reach on the camera. It must be placed on one of those floors."""
    z = _get_zone(conn, zone_id)
    group = shared_spaces.group_of_zone(conn, zone_id)
    if group is None:
        _share_rights(conn, principal, (z["floor_id"],), apply=True)  # review L3: the permission before the 404
        raise not_found("החדר אינו משותף.")
    _share_rights(conn, principal, group.floors, apply=True, cameras=[body.resource_id] if body.resource_type == "camera" else [])
    if body.resource_type == shared_spaces.STATION:
        # CR-009 §13: the same share rights as a camera (above), plus the WisKey model - the adder must hold access.read
        # (installation scope; the audited 403) and the station must exist in WisKey's served copy. It is not placed
        # anywhere: a station member is listed, it grants no reach (shared_spaces.station_visible).
        require(conn, principal, "access.read", INSTALLATION)
        stations = shared_spaces.served_stations(settings_of(request))
        if stations is None:
            raise ApiError(503, "intercom_unavailable", "נתוני WisKey אינם זמינים כרגע, ולכן אי אפשר להוסיף עמדה.", retryable=True)
        if body.resource_id not in stations:
            raise not_found("העמדה לא נמצאה ב־WisKey.")
    else:
        if body.resource_type == "ha_entity" and shared_spaces.alarm_owned(conn, [body.resource_id]):  # review M1
            raise ApiError(409, "alarm_managed", shared_spaces.ALARM_MEMBER_MESSAGE, details={"entity_ids": [body.resource_id]})
        q = ",".join("?" * len(group.floors))
        if not conn.execute(f"SELECT 1 FROM map_anchors WHERE resource_type = ? AND resource_id = ? AND effective_to IS NULL AND floor_id IN ({q})", (body.resource_type, body.resource_id, *group.floors)).fetchone():
            raise ApiError(422, "not_placed", "הפריט לא מוצב באף אחת מהקומות של החלל המשותף.")
    added = shared_spaces.add_member(conn, zone_id, body.resource_type, body.resource_id, principal.user_id, now_iso())
    if added:
        from ..services import revocation

        audit(conn, actor=principal, action="zone.share.member_add", decision="allowed", resource_type="zone", resource_id=zone_id, request_id=_rid(request),
              details={"resource": f"{body.resource_type}:{body.resource_id}", "floors": list(group.floors)})
        revocation.changed(_all_users(conn))
    return {"zone_id": zone_id, "added": added}


@router.delete("/zones/{zone_id}/share/members/{resource_type}/{resource_id}", status_code=204)
def remove_member(zone_id: str, resource_type: str, resource_id: str, request: Request, background: BackgroundTasks, principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> None:
    """"הסר מהחלל המשותף": narrows reach at once (revocation.mark). Owner 2026-09-30: the same rights as adding - the
    share rights on every floor of the room (map.edit + placement.edit), from the members list or the anchor alike."""
    z = _get_zone(conn, zone_id)
    group = shared_spaces.group_of_zone(conn, zone_id)
    floors = group.floors if group is not None else (z["floor_id"],)
    _share_rights(conn, principal, floors, apply=True)
    if resource_type == shared_spaces.STATION:
        # CR-009 §13 (Opus review): a station member is not the caller's to probe or remove without seeing it - the audited
        # 403 comes BEFORE the lookup, so 404 vs 204 cannot be used to test station ids
        require(conn, principal, "access.read", INSTALLATION)
    if not shared_spaces.remove_member(conn, zone_id, resource_type, resource_id, principal.user_id, now_iso()):
        raise not_found("הפריט אינו חלק מהחלל המשותף.")
    audit(conn, actor=principal, action="zone.share.member_remove", decision="allowed", resource_type="zone", resource_id=zone_id, request_id=_rid(request),
          details={"resource": f"{resource_type}:{resource_id}"})
    _revoke(background, _all_users(conn))

@router.patch("/zones/{zone_id}/share/{floor_id}")
def share_placement(zone_id: str, floor_id: str, body: PlacementIn, request: Request, principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """"יישור": where the room sits on the other plan (same_frame, or fit: from / to points, rotation, scale)."""
    z = _get_zone(conn, zone_id)
    _share_rights(conn, principal, (z["floor_id"], floor_id), apply=True)  # review L4: the share rights on BOTH floors
    share = next((s for s in shared_spaces.shares_of_zone(conn, zone_id) if s.floor_id == floor_id), None)
    if share is None:
        raise not_found("החדר לא משותף עם הקומה הזו.")
    if share.revision != body.revision:
        raise conflict("stale_revision", "השיתוף השתנה בינתיים; טען מחדש.", current_revision=share.revision)
    placement: dict[str, Any] = {"mode": "same_frame"}
    if body.mode == "fit":
        if body.from_ is None or body.to is None or any(not 0 <= v <= 1 for v in (*body.from_, *body.to)):
            raise ApiError(422, "validation", "יישור צריך נקודת מוצא ונקודת יעד בתוך התוכניות.")
        placement = {"mode": "fit", "from": [round(v, 6) for v in body.from_], "to": [round(v, 6) for v in body.to], "rotation_deg": round(body.rotation_deg, 3), "scale": round(body.scale, 6)}
    shared_spaces.set_placement(conn, zone_id, floor_id, placement, now_iso())
    audit(conn, actor=principal, action="zone.share.placement", decision="allowed", resource_type="zone", resource_id=zone_id, request_id=_rid(request),
          details={"floor_id": floor_id, "placement": placement})
    return {"zone_id": zone_id, "floor_id": floor_id, "placement": placement, "revision": share.revision + 1}


@router.delete("/zones/{zone_id}", status_code=204)
def delete_zone(zone_id: str, request: Request, background: BackgroundTasks, with_unshare: bool = False, principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> None:
    """Delete a room. A shared room (CR-009 §14) answers 409 `zone_shared` (with the home floor named in `details`) unless
    `?with_unshare=true` on the room's HOME floor: then ONE request ends every share of the room and its members and deletes
    the room - all or nothing. It needs the share rights (map.edit + placement.edit) on EVERY floor of the room, checked
    before the first write (a deny on any floor refuses everything), and is audited as the two steps would be:
    `zone.unshare` per floor, then `zone.delete`; revocation is marked so the other floors lose reach on the next request."""
    z = _get_zone(conn, zone_id)
    require(conn, principal, "placement.edit", ("floor", z["floor_id"]))
    group = shared_spaces.zone_in_share(conn, zone_id)
    if group is None:
        conn.execute("UPDATE spatial_zones SET deleted_at = ? WHERE id = ?", (now_iso(), zone_id))
        audit(conn, actor=principal, action="zone.delete", decision="allowed", resource_type="zone", resource_id=zone_id, request_id=_rid(request), details={"name": z["name"]})
        return
    # the refusal names the home floor only to a caller who may read it (review L1): otherwise "קומה אחרת" and no ids
    home = conn.execute("SELECT id, name FROM floors WHERE id = ?", (group.home_floor_id,)).fetchone()
    if home is not None and authorize(conn, principal, "map.read", ("floor", group.home_floor_id)).allowed:
        details = {"home_zone_id": group.zone_id, "home_floor_id": group.home_floor_id, "home_floor_name": home["name"]}
    else:
        details = {"home_floor_name": shared_spaces.OTHER_FLOOR}
    if not with_unshare or group.zone_id != zone_id:  # review M4: never a silently ignored share; another floor's outline is deleted from the home floor
        raise conflict("zone_shared", "החדר משותף לכמה קומות; מחק אותו בקומה שבה נוצר, או בטל את השיתוף.", **details)
    _share_rights(conn, principal, group.floors, apply=True)  # every floor, before the first write
    now = now_iso()
    rid = _rid(request)
    for s in group.shares:
        if shared_spaces.unshare(conn, zone_id, s.floor_id, principal.user_id, now):
            audit(conn, actor=principal, action="zone.unshare", decision="allowed", resource_type="zone", resource_id=zone_id, request_id=rid,
                  details={"home_floor_id": group.home_floor_id, "floor_id": s.floor_id, "reason": "zone_deleted"})
    conn.execute("UPDATE spatial_zones SET deleted_at = ? WHERE id = ?", (now, zone_id))
    audit(conn, actor=principal, action="zone.delete", decision="allowed", resource_type="zone", resource_id=zone_id, request_id=rid, details={"name": z["name"], "unshared_floors": [s.floor_id for s in group.shares]})
    _revoke(background, _all_users(conn))


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
        # review M4: a room that is part of a shared space is kept (un-share it first to replace it)
        keep = {r["id"] for r in conn.execute("SELECT id FROM spatial_zones WHERE floor_id = ? AND source = 'auto' AND deleted_at IS NULL", (floor_id,)).fetchall() if shared_spaces.zone_in_share(conn, r["id"]) is not None}
        conn.execute(f"UPDATE spatial_zones SET deleted_at = ? WHERE floor_id = ? AND source = 'auto' AND deleted_at IS NULL AND id NOT IN ({','.join('?' * len(keep)) or "''"})", (now_iso(), floor_id, *sorted(keep)))
    ids = []
    for i, cnd in enumerate(body.candidates):
        name = cnd.name.strip() or f"חדר {i + 1}"
        ids.append(_insert(conn, principal, floor_id, v["id"] if v else None, name, cnd.kind, cnd.polygon, None, "auto"))
    audit(conn, actor=principal, action="zone.accept", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request), details={"zones": len(ids), "replace_auto": body.replace_auto})
    return {"zones": floor_zones(conn, floor_id), "created": ids}
