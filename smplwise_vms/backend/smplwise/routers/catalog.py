"""Sites → buildings → floors (MASTER_SPEC ch. 9–10). Stable ids, soft delete, explicit handling of
children and anchors, visibility filtered by the caller's scoped bindings."""
from __future__ import annotations

import sqlite3
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import get_setting, new_id, now_iso, set_setting, unlocked
from ..errors import ApiError, conflict, not_found, validation
from ..rbac import INSTALLATION, Principal, authorize, require

router = APIRouter()

P_READ = "map.read"
P_CONTENT = "site.content.configure"
P_SYSTEM = "system.configure"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


# ---------- serializers ----------

def _image_url(kind: str, r: sqlite3.Row) -> str | None:
    try:
        return f"api/v1/catalog/images/{kind}/{r['id']}?v={r['updated_at']}" if r["image_path"] else None
    except (IndexError, KeyError):  # before migration 0015
        return None


def site_row(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "name": r["name"], "address": r["address"], "timezone": r["timezone"], "sort_order": r["sort_order"], "updated_at": r["updated_at"], "image_url": _image_url("site", r)}


def building_row(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "site_id": r["site_id"], "name": r["name"], "sort_order": r["sort_order"], "updated_at": r["updated_at"], "image_url": _image_url("building", r)}


# ---------- photos (R1) ----------

IMAGE_MAX_PX = 1600
IMAGE_MAX_BYTES = 12 * 1024 * 1024


def _image_dir(request: Request) -> Any:
    d = settings_of(request).data_dir / "catalog_images"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _store_image(request: Request, kind: str, obj_id: str, file: UploadFile) -> str:
    """Read the upload (PNG / JPEG only, by content), re-encode as a bounded JPEG, return the relative path. Called by
    sync handlers inside unlocked(): the decode runs in the threadpool without the write lock, and taking the lock back
    never blocks the event loop."""
    from PIL import Image, ImageOps

    from ..services import image_guard

    data = file.file.read(IMAGE_MAX_BYTES + 1)
    if len(data) > IMAGE_MAX_BYTES:
        raise ApiError(413, "payload_too_large", "התמונה גדולה מ־12 MB.")
    if not (data.startswith(b"\x89PNG") or data.startswith(b"\xff\xd8")):
        raise ApiError(415, "unsupported_format", "התמונה חייבת להיות PNG או JPG (הזיהוי לפי התוכן).")
    try:
        im = image_guard.open_untrusted(data, ["PNG", "JPEG"], mpo_first_frame=True)
        im = ImageOps.exif_transpose(im).convert("RGB")
        if max(im.size) > IMAGE_MAX_PX:
            im.thumbnail((IMAGE_MAX_PX, IMAGE_MAX_PX), Image.Resampling.LANCZOS)
    except Exception as exc:  # noqa: BLE001 - a broken image is the upload's problem
        raise ApiError(422, "corrupt_image", "התמונה לא ניתנת לקריאה.", details={"error": type(exc).__name__})
    rel = f"{kind}-{obj_id}.jpg"
    im.save(_image_dir(request) / rel, format="JPEG", quality=86, optimize=True)
    return rel


def _still_there(request: Request, rel: str, check: Callable[[], Any]) -> None:
    """The site / building may have been deleted while the picture was decoded without the lock: re-check it in the
    transaction that stores the path, and remove the written file when it is gone."""
    try:
        check()
    except ApiError:
        (_image_dir(request) / rel).unlink(missing_ok=True)
        raise


@router.post("/sites/{site_id}/image")
def site_image_upload(site_id: str, request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_site(conn, site_id)
    require(conn, principal, P_CONTENT, ("site", site_id))
    with unlocked(conn):  # decoding and re-encoding the image runs without the write lock
        rel = _store_image(request, "site", site_id, file)
    _still_there(request, rel, lambda: get_site(conn, site_id))
    conn.execute("UPDATE sites SET image_path = ?, updated_at = ? WHERE id = ?", (rel, now_iso(), site_id))
    audit(conn, actor=principal, action="site.update", decision="allowed", resource_type="site", resource_id=site_id, request_id=_rid(request), details={"image": True})
    return site_row(get_site(conn, site_id))


@router.delete("/sites/{site_id}/image")
def site_image_delete(site_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    r = get_site(conn, site_id)
    require(conn, principal, P_CONTENT, ("site", site_id))
    if r["image_path"]:
        (_image_dir(request) / r["image_path"]).unlink(missing_ok=True)
    conn.execute("UPDATE sites SET image_path = NULL, updated_at = ? WHERE id = ?", (now_iso(), site_id))
    audit(conn, actor=principal, action="site.update", decision="allowed", resource_type="site", resource_id=site_id, request_id=_rid(request), details={"image": False})
    return site_row(get_site(conn, site_id))


@router.post("/buildings/{building_id}/image")
def building_image_upload(building_id: str, request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_building(conn, building_id)
    require(conn, principal, P_CONTENT, ("building", building_id))
    with unlocked(conn):  # decoding and re-encoding the image runs without the write lock
        rel = _store_image(request, "building", building_id, file)
    _still_there(request, rel, lambda: get_building(conn, building_id))
    conn.execute("UPDATE buildings SET image_path = ?, updated_at = ? WHERE id = ?", (rel, now_iso(), building_id))
    audit(conn, actor=principal, action="building.update", decision="allowed", resource_type="building", resource_id=building_id, request_id=_rid(request), details={"image": True})
    return building_row(get_building(conn, building_id))


@router.delete("/buildings/{building_id}/image")
def building_image_delete(building_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    r = get_building(conn, building_id)
    require(conn, principal, P_CONTENT, ("building", building_id))
    if r["image_path"]:
        (_image_dir(request) / r["image_path"]).unlink(missing_ok=True)
    conn.execute("UPDATE buildings SET image_path = NULL, updated_at = ? WHERE id = ?", (now_iso(), building_id))
    audit(conn, actor=principal, action="building.update", decision="allowed", resource_type="building", resource_id=building_id, request_id=_rid(request), details={"image": False})
    return building_row(get_building(conn, building_id))


@router.get("/catalog/images/{kind}/{obj_id}")
def catalog_image(kind: str, obj_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> FileResponse:
    if kind == "site":
        r = get_site(conn, obj_id)
        require(conn, principal, "map.read", ("site", obj_id))
    elif kind == "building":
        r = get_building(conn, obj_id)
        require(conn, principal, "map.read", ("building", obj_id))
    else:
        raise not_found("לא נמצא.")
    if not r["image_path"]:
        raise not_found("אין תמונה.")
    p = _image_dir(request) / r["image_path"]
    if not p.is_file():
        raise not_found("אין תמונה.")
    return FileResponse(p, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})


def floor_row(conn: sqlite3.Connection, r: sqlite3.Row, mirrored: dict[tuple[str, str], list[tuple[str, str]]] | None = None) -> dict[str, Any]:
    """`mirrored`: services/shared_spaces.mirrored_anchor_floors, when the caller already has it (the site tree)."""
    published = conn.execute("SELECT id, width_px, height_px, published_at FROM plan_versions WHERE floor_id = ? AND status = 'published'", (r["id"],)).fetchone()
    draft = conn.execute("SELECT id FROM plan_versions WHERE floor_id = ? AND status = 'draft' ORDER BY created_at DESC LIMIT 1", (r["id"],)).fetchone()
    anchors = conn.execute("SELECT COUNT(*) FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL", (r["id"],)).fetchone()[0]
    cameras = conn.execute("SELECT COUNT(*) FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL AND resource_type = 'camera'", (r["id"],)).fetchone()[0]
    # CR-009: what a room another floor shares with this one adds (the card shows it as "משותף", counted once per device)
    if mirrored is None:
        from ..services.shared_spaces import mirrored_anchor_floors

        mirrored = mirrored_anchor_floors(conn)
    shared = [k for k, pairs in mirrored.items() if any(fid == r["id"] for fid, _home in pairs)]
    return {
        "id": r["id"],
        "building_id": r["building_id"],
        "name": r["name"],
        "level": r["level"],
        "sort_order": r["sort_order"],
        "ha_area_id": r["ha_area_id"],
        "has_plan": published is not None,
        "published_version_id": published["id"] if published else None,
        "plan_width_px": published["width_px"] if published else None,
        "plan_height_px": published["height_px"] if published else None,
        "draft_version_id": draft["id"] if draft else None,
        "anchor_count": anchors,
        "camera_count": cameras,
        "shared_anchor_count": len(shared),
        "shared_camera_count": sum(1 for rtype, _rid in shared if rtype == "camera"),
        "updated_at": r["updated_at"],
    }


def get_site(conn: sqlite3.Connection, site_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM sites WHERE id = ? AND deleted_at IS NULL", (site_id,)).fetchone()
    if not row:
        raise not_found("האתר לא נמצא.")
    return row


def get_building(conn: sqlite3.Connection, building_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM buildings WHERE id = ? AND deleted_at IS NULL", (building_id,)).fetchone()
    if not row:
        raise not_found("המבנה לא נמצא.")
    return row


def get_floor(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM floors WHERE id = ? AND deleted_at IS NULL", (floor_id,)).fetchone()
    if not row:
        raise not_found("הקומה לא נמצאה.")
    return row


# ---------- tree ----------

@router.get("/sites")
def list_sites(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), tree: bool = Query(True)) -> dict[str, Any]:
    """Only nodes the caller may read appear; a site is listed when the caller can read it or any child."""
    all_read = authorize(conn, principal, P_READ, INSTALLATION).allowed
    # T055: a floor reached only through camera-scoped bindings (a camera anchored there) is listed too - its map
    # shows the drawing and those cameras (services/access.floor_reach)
    from ..services.access import camera_reach_floors
    from ..services.shared_spaces import mirrored_anchor_floors

    mirrored = mirrored_anchor_floors(conn)
    # CR-009: the floors whose drawing the caller reaches through cameras - the one rule floor_reach uses too (a camera of
    # a shared room opens the floors that show the room only for a binding on the camera itself)
    cam_floors = set() if all_read else camera_reach_floors(conn, principal, P_READ)
    sites_out: list[dict[str, Any]] = []
    for s in conn.execute("SELECT * FROM sites WHERE deleted_at IS NULL ORDER BY sort_order, name").fetchall():
        site_ok = all_read or authorize(conn, principal, P_READ, ("site", s["id"])).allowed
        buildings_out: list[dict[str, Any]] = []
        for b in conn.execute("SELECT * FROM buildings WHERE site_id = ? AND deleted_at IS NULL ORDER BY sort_order, name", (s["id"],)).fetchall():
            building_ok = site_ok or authorize(conn, principal, P_READ, ("building", b["id"])).allowed
            floors_out: list[dict[str, Any]] = []
            for f in conn.execute("SELECT * FROM floors WHERE building_id = ? AND deleted_at IS NULL ORDER BY level DESC, sort_order, name", (b["id"],)).fetchall():
                if building_ok or authorize(conn, principal, P_READ, ("floor", f["id"])).allowed or f["id"] in cam_floors:
                    floors_out.append(floor_row(conn, f, mirrored))
            if building_ok or floors_out:
                item = building_row(b)
                if tree:
                    item["floors"] = floors_out
                buildings_out.append(item)
        if site_ok or buildings_out:
            item = site_row(s)
            if tree:
                item["buildings"] = buildings_out
            sites_out.append(item)
    return {"sites": sites_out, "can_create_site": authorize(conn, principal, P_SYSTEM, INSTALLATION).allowed}


# ---------- sites ----------

class SiteIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    address: str = Field(default="", max_length=240)
    timezone: str = Field(default="Asia/Jerusalem", max_length=64)
    sort_order: int = 0


class SitePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    address: str | None = Field(default=None, max_length=240)
    timezone: str | None = Field(default=None, max_length=64)
    sort_order: int | None = None


@router.post("/sites", status_code=201)
def create_site(body: SiteIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, P_SYSTEM, INSTALLATION)
    sid, now = new_id(), now_iso()
    conn.execute("INSERT INTO sites(id, name, address, timezone, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                 (sid, body.name.strip(), body.address.strip(), body.timezone, body.sort_order, now, now))
    audit(conn, actor=principal, action="site.create", decision="allowed", resource_type="site", resource_id=sid, request_id=_rid(request), details={"name": body.name})
    return site_row(get_site(conn, sid))


@router.patch("/sites/{site_id}")
def update_site(site_id: str, body: SitePatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_site(conn, site_id)
    require(conn, principal, P_CONTENT, ("site", site_id))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if fields:
        sets = ", ".join(f"{k} = ?" for k in fields)
        conn.execute(f"UPDATE sites SET {sets}, updated_at = ? WHERE id = ?", (*fields.values(), now_iso(), site_id))
    audit(conn, actor=principal, action="site.update", decision="allowed", resource_type="site", resource_id=site_id, request_id=_rid(request), details=fields)
    return site_row(get_site(conn, site_id))


@router.delete("/sites/{site_id}", status_code=204)
def delete_site(site_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    get_site(conn, site_id)
    require(conn, principal, P_SYSTEM, INSTALLATION)
    n = conn.execute("SELECT COUNT(*) FROM buildings WHERE site_id = ? AND deleted_at IS NULL", (site_id,)).fetchone()[0]
    if n:
        raise conflict("has_children", "לאתר יש מבנים; מחק או העבר אותם קודם.", buildings=n)
    conn.execute("UPDATE sites SET deleted_at = ?, updated_at = ? WHERE id = ?", (now_iso(), now_iso(), site_id))
    audit(conn, actor=principal, action="site.delete", decision="allowed", resource_type="site", resource_id=site_id, request_id=_rid(request))


# ---------- buildings ----------

class BuildingIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sort_order: int = 0


class BuildingPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    sort_order: int | None = None


@router.post("/sites/{site_id}/buildings", status_code=201)
def create_building(site_id: str, body: BuildingIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_site(conn, site_id)
    require(conn, principal, P_CONTENT, ("site", site_id))
    bid, now = new_id(), now_iso()
    conn.execute("INSERT INTO buildings(id, site_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", (bid, site_id, body.name.strip(), body.sort_order, now, now))
    audit(conn, actor=principal, action="building.create", decision="allowed", resource_type="building", resource_id=bid, request_id=_rid(request), details={"name": body.name, "site_id": site_id})
    return building_row(get_building(conn, bid))


@router.patch("/buildings/{building_id}")
def update_building(building_id: str, body: BuildingPatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_building(conn, building_id)
    require(conn, principal, P_CONTENT, ("building", building_id))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if fields:
        sets = ", ".join(f"{k} = ?" for k in fields)
        conn.execute(f"UPDATE buildings SET {sets}, updated_at = ? WHERE id = ?", (*fields.values(), now_iso(), building_id))
    audit(conn, actor=principal, action="building.update", decision="allowed", resource_type="building", resource_id=building_id, request_id=_rid(request), details=fields)
    return building_row(get_building(conn, building_id))


@router.delete("/buildings/{building_id}", status_code=204)
def delete_building(building_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    b = get_building(conn, building_id)
    require(conn, principal, P_CONTENT, ("site", b["site_id"]))
    n = conn.execute("SELECT COUNT(*) FROM floors WHERE building_id = ? AND deleted_at IS NULL", (building_id,)).fetchone()[0]
    if n:
        raise conflict("has_children", "למבנה יש קומות; מחק אותן קודם.", floors=n)
    conn.execute("UPDATE buildings SET deleted_at = ?, updated_at = ? WHERE id = ?", (now_iso(), now_iso(), building_id))
    audit(conn, actor=principal, action="building.delete", decision="allowed", resource_type="building", resource_id=building_id, request_id=_rid(request))


# ---------- floors ----------

class FloorIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    level: int = 0
    sort_order: int = 0


class FloorPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    level: int | None = None
    sort_order: int | None = None
    ha_area_id: str | None = Field(default=None, max_length=120)


@router.post("/buildings/{building_id}/floors", status_code=201)
def create_floor(building_id: str, body: FloorIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_building(conn, building_id)
    require(conn, principal, P_CONTENT, ("building", building_id))
    fid, now = new_id(), now_iso()
    conn.execute("INSERT INTO floors(id, building_id, name, level, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (fid, building_id, body.name.strip(), body.level, body.sort_order, now, now))
    audit(conn, actor=principal, action="floor.create", decision="allowed", resource_type="floor", resource_id=fid, request_id=_rid(request), details={"name": body.name, "building_id": building_id, "level": body.level})
    return floor_row(conn, get_floor(conn, fid))


@router.get("/floors/{floor_id}")
def read_floor(floor_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    f = get_floor(conn, floor_id)
    from ..services.access import require_floor_read

    require_floor_read(conn, principal, floor_id, P_READ)
    b = get_building(conn, f["building_id"])
    s = get_site(conn, b["site_id"])
    return {"floor": floor_row(conn, f), "building": building_row(b), "site": site_row(s)}


@router.patch("/floors/{floor_id}")
def update_floor(floor_id: str, body: FloorPatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_floor(conn, floor_id)
    require(conn, principal, P_CONTENT, ("floor", floor_id))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if fields:
        sets = ", ".join(f"{k} = ?" for k in fields)
        conn.execute(f"UPDATE floors SET {sets}, updated_at = ? WHERE id = ?", (*fields.values(), now_iso(), floor_id))
    audit(conn, actor=principal, action="floor.update", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request), details=fields)
    return floor_row(conn, get_floor(conn, floor_id))


@router.delete("/floors/{floor_id}", status_code=204)
def delete_floor(floor_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), force: bool = Query(False)) -> None:
    """A floor with anchors is not deleted silently: 409 unless force=true, which tombstones the anchors first."""
    f = get_floor(conn, floor_id)
    require(conn, principal, P_CONTENT, ("building", f["building_id"]))
    anchors = conn.execute("SELECT COUNT(*) FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL", (floor_id,)).fetchone()[0]
    if anchors and not force:
        raise conflict("has_anchors", "על הקומה מוצבים פריטים; אשר מחיקה מפורשת (force) או הסר אותם קודם.", anchors=anchors)
    now = now_iso()
    if anchors:
        conn.execute("UPDATE map_anchors SET effective_to = ?, updated_at = ?, updated_by = ? WHERE floor_id = ? AND effective_to IS NULL", (now, now, principal.user_id, floor_id))
    conn.execute("UPDATE plan_versions SET status = 'archived', archived_at = ? WHERE floor_id = ? AND status != 'archived'", (now, floor_id))
    conn.execute("UPDATE floors SET deleted_at = ?, updated_at = ? WHERE id = ?", (now, now, floor_id))
    from ..services import revocation, shared_spaces

    ended = shared_spaces.end_for_floor(conn, floor_id, principal.user_id, now)  # review L5: no live share or member row outlives the floor
    if ended["shares"]:
        revocation.mark([r[0] for r in conn.execute("SELECT id FROM users").fetchall()])  # reach through the room narrows now
        audit(conn, actor=principal, action="zone.unshare", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
              details={"reason": "floor_deleted", "shares_ended": len(ended["shares"]), "rooms_without_members": ended["zones"]})
    from ..services.skins import store as skins_store

    controls = skins_store.delete_floor(settings_of(request), conn, floor_id)  # CR-006 2a: the floor's control images go with it
    from ..services import plan_bakes

    bakes = plan_bakes.delete_floor(settings_of(request), conn, floor_id)  # CR-029 S3: the floor's stills, masks and lightmaps go with it
    default_cleared = get_setting(conn, "map.default_floor") == floor_id  # owner 2026-09-30: the map's default floor must not point at a deleted floor
    if default_cleared:
        set_setting(conn, "map.default_floor", "")
        audit(conn, actor=principal, action="settings.update", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"map.default_floor": "", "reason": "floor_deleted", "floor_id": floor_id})
    audit(conn, actor=principal, action="floor.delete", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request), details={"anchors_tombstoned": anchors, "force": force, "skin_controls_deleted": controls, "bakes_deleted": bakes, "map_default_floor_cleared": default_cleared})


# ---------- home-platform links (SYNOPTIC-HA-2310) ----------
# Mapping rows keyed by the platform's id -> our floor (migration 0187): layer 1 = platform floor -> our floor (one row per platform
# floor), layer 2 = per-area override (NULL floor = taken off every floor by hand). Layer 3, the plan rooms' area links, wins over both
# and lives with the rooms (spatial_zones.ha_area_id). These are the layers of docs/changes/PROPOSAL-MULTI-BUILDING-HOME.md; nothing here
# knows a building, so a building level can be added later without touching the rows.

def _live_floor_ids(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute("SELECT id FROM floors WHERE deleted_at IS NULL").fetchall()}


@router.get("/home-links")
def list_home_links(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The rows whose floor the caller may read (an area taken off every floor has no floor and is always listed: it names no place)."""
    live = _live_floor_ids(conn)
    all_read = authorize(conn, principal, P_READ, INSTALLATION).allowed
    seen: dict[str, bool] = {}

    def readable(fid: str) -> bool:
        if fid not in live:
            return False
        if all_read:
            return True
        if fid not in seen:
            from ..services.access import floor_reach

            seen[fid] = floor_reach(conn, principal, fid, P_READ) is not None
        return seen[fid]

    floors = [{"ha_floor_id": r["ha_floor_id"], "floor_id": r["floor_id"]} for r in conn.execute("SELECT ha_floor_id, floor_id FROM home_floor_links ORDER BY ha_floor_id").fetchall() if readable(r["floor_id"])]
    areas = [{"area_id": r["area_id"], "floor_id": r["floor_id"]} for r in conn.execute("SELECT area_id, floor_id FROM home_area_links ORDER BY area_id").fetchall() if r["floor_id"] is None or readable(r["floor_id"])]
    return {"floors": floors, "areas": areas}


class HomeLinkIn(BaseModel):
    # the platform floors of this floor, the whole list (None = unchanged, [] = none); a platform floor held by another floor moves here
    ha_floor_ids: list[str] | None = Field(default=None, max_length=50)
    # per area: include = belongs to this floor; exclude = taken off every floor ("לא משויך"); auto = back to the automatic rule
    areas: dict[str, Literal["include", "exclude", "auto"]] | None = Field(default=None, max_length=500)


@router.put("/floors/{floor_id}/home-link")
def put_home_link(floor_id: str, body: HomeLinkIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Whoever may edit the floor (site.content.configure on it) - and on every other floor a row is taken from. Unknown platform ids
    answer 422, except ids already in a row (a dangling row never blocks a save). Audited as floor.home_link."""
    get_floor(conn, floor_id)
    require(conn, principal, P_CONTENT, ("floor", floor_id))
    live = _live_floor_ids(conn)
    now = now_iso()
    details: dict[str, Any] = {}
    if body.ha_floor_ids is not None:
        want: list[str] = []
        for raw in body.ha_floor_ids:
            hid = (raw or "").strip()
            if hid and len(hid) <= 120 and hid not in want:
                want.append(hid)
        current = {r[0]: r[1] for r in conn.execute("SELECT ha_floor_id, floor_id FROM home_floor_links").fetchall()}
        taken: set[str] = set()
        for hid in want:
            if hid not in current and not conn.execute("SELECT 1 FROM ha_floors WHERE floor_id = ?", (hid,)).fetchone():
                raise validation("הקומה לא נמצאה ברשימת הקומות של מערכת הבית.", ha_floor_id=hid)
            if current.get(hid) not in (None, floor_id) and current[hid] in live:
                taken.add(current[hid])
        for fid in sorted(taken):
            require(conn, principal, P_CONTENT, ("floor", fid))  # taking a platform floor from another floor is that floor's edit too
        for hid, fid in current.items():
            if fid == floor_id and hid not in want:
                conn.execute("DELETE FROM home_floor_links WHERE ha_floor_id = ?", (hid,))
        for hid in want:
            conn.execute("INSERT INTO home_floor_links(ha_floor_id, floor_id, updated_at, updated_by) VALUES (?, ?, ?, ?) "
                         "ON CONFLICT(ha_floor_id) DO UPDATE SET floor_id = excluded.floor_id, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
                         (hid, floor_id, now, principal.user_id))
        details["ha_floor_ids"] = want
        if taken:
            details["taken_from_floors"] = sorted(taken)
    if body.areas is not None:
        current = {r[0]: r[1] for r in conn.execute("SELECT area_id, floor_id FROM home_area_links").fetchall()}
        changes: dict[str, str] = {}
        for raw, mode in body.areas.items():
            aid = (raw or "").strip()
            if not aid or len(aid) > 120:
                continue
            if mode != "auto" and aid not in current and not conn.execute("SELECT 1 FROM ha_areas WHERE area_id = ?", (aid,)).fetchone():
                raise validation("האזור לא נמצא ברשימת האזורים.", area_id=aid)
            prev = current.get(aid)
            if prev is not None and prev != floor_id and prev in live:
                require(conn, principal, P_CONTENT, ("floor", prev))  # the row belongs to another floor: moving or clearing it edits that floor too
            if mode == "include":
                conn.execute("INSERT INTO home_area_links(area_id, floor_id, updated_at, updated_by) VALUES (?, ?, ?, ?) "
                             "ON CONFLICT(area_id) DO UPDATE SET floor_id = excluded.floor_id, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
                             (aid, floor_id, now, principal.user_id))
            elif mode == "exclude":
                conn.execute("INSERT INTO home_area_links(area_id, floor_id, updated_at, updated_by) VALUES (?, NULL, ?, ?) "
                             "ON CONFLICT(area_id) DO UPDATE SET floor_id = NULL, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
                             (aid, now, principal.user_id))
            else:
                conn.execute("DELETE FROM home_area_links WHERE area_id = ?", (aid,))
            changes[aid] = mode
        details["areas"] = changes
    audit(conn, actor=principal, action="floor.home_link", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request), details=details)
    return list_home_links(principal, conn)
