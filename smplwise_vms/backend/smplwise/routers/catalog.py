"""Sites → buildings → floors (MASTER_SPEC ch. 9–10). Stable ids, soft delete, explicit handling of
children and anchors, visibility filtered by the caller's scoped bindings."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import new_id, now_iso
from ..errors import ApiError, conflict, not_found
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


async def _store_image(request: Request, kind: str, obj_id: str, file: UploadFile) -> str:
    """Read the upload (PNG / JPEG only, by content), re-encode as a bounded JPEG, return the relative path."""
    from io import BytesIO

    from PIL import Image, ImageOps

    data = await file.read(IMAGE_MAX_BYTES + 1)
    if len(data) > IMAGE_MAX_BYTES:
        raise ApiError(413, "payload_too_large", "התמונה גדולה מ־12 MB.")
    if not (data.startswith(b"\x89PNG") or data.startswith(b"\xff\xd8")):
        raise ApiError(415, "unsupported_format", "התמונה חייבת להיות PNG או JPG (הזיהוי לפי התוכן).")
    try:
        im = Image.open(BytesIO(data))
        im = ImageOps.exif_transpose(im).convert("RGB")
        if max(im.size) > IMAGE_MAX_PX:
            im.thumbnail((IMAGE_MAX_PX, IMAGE_MAX_PX), Image.Resampling.LANCZOS)
    except Exception as exc:  # noqa: BLE001 - a broken image is the upload's problem
        raise ApiError(422, "corrupt_image", "התמונה לא ניתנת לקריאה.", details={"error": type(exc).__name__})
    rel = f"{kind}-{obj_id}.jpg"
    im.save(_image_dir(request) / rel, format="JPEG", quality=86, optimize=True)
    return rel


@router.post("/sites/{site_id}/image")
async def site_image_upload(site_id: str, request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_site(conn, site_id)
    require(conn, principal, P_CONTENT, ("site", site_id))
    rel = await _store_image(request, "site", site_id, file)
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
async def building_image_upload(building_id: str, request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_building(conn, building_id)
    require(conn, principal, P_CONTENT, ("building", building_id))
    rel = await _store_image(request, "building", building_id, file)
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


def floor_row(conn: sqlite3.Connection, r: sqlite3.Row) -> dict[str, Any]:
    published = conn.execute("SELECT id, width_px, height_px, published_at FROM plan_versions WHERE floor_id = ? AND status = 'published'", (r["id"],)).fetchone()
    draft = conn.execute("SELECT id FROM plan_versions WHERE floor_id = ? AND status = 'draft' ORDER BY created_at DESC LIMIT 1", (r["id"],)).fetchone()
    anchors = conn.execute("SELECT COUNT(*) FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL", (r["id"],)).fetchone()[0]
    cameras = conn.execute("SELECT COUNT(*) FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL AND resource_type = 'camera'", (r["id"],)).fetchone()[0]
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
    sites_out: list[dict[str, Any]] = []
    for s in conn.execute("SELECT * FROM sites WHERE deleted_at IS NULL ORDER BY sort_order, name").fetchall():
        site_ok = all_read or authorize(conn, principal, P_READ, ("site", s["id"])).allowed
        buildings_out: list[dict[str, Any]] = []
        for b in conn.execute("SELECT * FROM buildings WHERE site_id = ? AND deleted_at IS NULL ORDER BY sort_order, name", (s["id"],)).fetchall():
            building_ok = site_ok or authorize(conn, principal, P_READ, ("building", b["id"])).allowed
            floors_out: list[dict[str, Any]] = []
            for f in conn.execute("SELECT * FROM floors WHERE building_id = ? AND deleted_at IS NULL ORDER BY level DESC, sort_order, name", (b["id"],)).fetchall():
                if building_ok or authorize(conn, principal, P_READ, ("floor", f["id"])).allowed:
                    floors_out.append(floor_row(conn, f))
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
    require(conn, principal, P_READ, ("floor", floor_id))
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
    audit(conn, actor=principal, action="floor.delete", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request), details={"anchors_tombstoned": anchors, "force": force})
