"""Sites → buildings → floors (MASTER_SPEC ch. 9–10). Stable ids, soft delete, explicit handling of
children and anchors, visibility filtered by the caller's scoped bindings."""
from __future__ import annotations

import sqlite3
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import get_setting, new_id, now_iso, set_setting, unlocked
from ..errors import ApiError, conflict, not_found, validation
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import catalog_store as store
from ..services.safe_paths import confine  # BACKEND-SAFETY-2435: stored picture paths stay inside catalog_images
from ._common import rid as _rid
from ..wire import catalog as W
from ..wire import wire

router = APIRouter()

P_READ = "map.read"
P_CONTENT = "site.content.configure"
P_SYSTEM = "system.configure"


# ---------- serializers ----------

def _image_url(kind: str, r: sqlite3.Row) -> str | None:
    try:
        return f"api/v1/catalog/images/{kind}/{r['id']}?v={r['updated_at']}" if r["image_path"] else None
    except (IndexError, KeyError):  # before migration 0015
        return None


def site_row(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "name": r["name"], "address": r["address"], "timezone": r["timezone"], "sort_order": r["sort_order"], "updated_at": r["updated_at"], "image_url": _image_url("site", r)}


def _is_shared(r: sqlite3.Row) -> bool:
    try:
        return bool(r["is_shared"])
    except (IndexError, KeyError):  # before migration 0188
        return False


def building_row(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "site_id": r["site_id"], "name": r["name"], "sort_order": r["sort_order"], "updated_at": r["updated_at"], "image_url": _image_url("building", r), "is_shared": _is_shared(r)}


# ---------- photos (R1) ----------

IMAGE_MAX_PX = 1600
IMAGE_MAX_BYTES = 12 * 1024 * 1024


def _image_dir(request: Request) -> Any:
    d = settings_of(request).data_dir / "catalog_images"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _unlink_stored(request: Request, rel: str) -> None:
    """BACKEND-SAFETY-2435: remove a stored picture only when its path stays inside catalog_images."""
    p = confine(_image_dir(request), rel)
    if p is not None:
        p.unlink(missing_ok=True)


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


@router.post("/sites/{site_id}/image", **wire(W.CatalogSite))
def site_image_upload(site_id: str, request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_site(conn, site_id)
    require(conn, principal, P_CONTENT, ("site", site_id))
    with unlocked(conn):  # decoding and re-encoding the image runs without the write lock
        rel = _store_image(request, "site", site_id, file)
    _still_there(request, rel, lambda: get_site(conn, site_id))
    store.set_site_image(conn, site_id, rel, now_iso())
    audit(conn, actor=principal, action="site.update", decision="allowed", resource_type="site", resource_id=site_id, request_id=_rid(request), details={"image": True})
    return site_row(get_site(conn, site_id))


@router.delete("/sites/{site_id}/image", **wire(W.CatalogSite))
def site_image_delete(site_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    r = get_site(conn, site_id)
    require(conn, principal, P_CONTENT, ("site", site_id))
    if r["image_path"]:
        _unlink_stored(request, r["image_path"])
    store.set_site_image(conn, site_id, None, now_iso())
    audit(conn, actor=principal, action="site.update", decision="allowed", resource_type="site", resource_id=site_id, request_id=_rid(request), details={"image": False})
    return site_row(get_site(conn, site_id))


@router.post("/buildings/{building_id}/image", **wire(W.CatalogBuilding))
def building_image_upload(building_id: str, request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_building(conn, building_id)
    require(conn, principal, P_CONTENT, ("building", building_id))
    with unlocked(conn):  # decoding and re-encoding the image runs without the write lock
        rel = _store_image(request, "building", building_id, file)
    _still_there(request, rel, lambda: get_building(conn, building_id))
    store.set_building_image(conn, building_id, rel, now_iso())
    audit(conn, actor=principal, action="building.update", decision="allowed", resource_type="building", resource_id=building_id, request_id=_rid(request), details={"image": True})
    return building_row(get_building(conn, building_id))


@router.delete("/buildings/{building_id}/image", **wire(W.CatalogBuilding))
def building_image_delete(building_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    r = get_building(conn, building_id)
    require(conn, principal, P_CONTENT, ("building", building_id))
    if r["image_path"]:
        _unlink_stored(request, r["image_path"])
    store.set_building_image(conn, building_id, None, now_iso())
    audit(conn, actor=principal, action="building.update", decision="allowed", resource_type="building", resource_id=building_id, request_id=_rid(request), details={"image": False})
    return building_row(get_building(conn, building_id))


@router.get("/catalog/images/{kind}/{obj_id}")
def catalog_image(kind: str, obj_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> FileResponse:
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
    p = confine(_image_dir(request), r["image_path"])  # BACKEND-SAFETY-2435: a stored path outside catalog_images is refused
    if p is None or not p.is_file():
        raise not_found("אין תמונה.")
    return FileResponse(p, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})


def floor_row(conn: sqlite3.Connection, r: sqlite3.Row, mirrored: dict[tuple[str, str], list[tuple[str, str]]] | None = None) -> dict[str, Any]:
    """`mirrored`: services/shared_spaces.mirrored_anchor_floors, when the caller already has it (the site tree)."""
    published = store.published_plan(conn, r["id"])
    draft = store.newest_draft_plan(conn, r["id"])
    anchors = store.floor_anchor_count(conn, r["id"])
    cameras = store.floor_camera_count(conn, r["id"])
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
    row = store.live_site(conn, site_id)
    if not row:
        raise not_found("האתר לא נמצא.")
    return row


def get_building(conn: sqlite3.Connection, building_id: str) -> sqlite3.Row:
    row = store.live_building(conn, building_id)
    if not row:
        raise not_found("המבנה לא נמצא.")
    return row


def get_floor(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row:
    row = store.live_floor(conn, floor_id)
    if not row:
        raise not_found("הקומה לא נמצאה.")
    return row


# ---------- tree ----------

@router.get("/sites", **wire(W.CatalogSites))
def list_sites(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn), tree: bool = Query(True)) -> dict[str, Any]:
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
    for s in store.live_sites(conn):
        site_ok = all_read or authorize(conn, principal, P_READ, ("site", s["id"])).allowed
        buildings_out: list[dict[str, Any]] = []
        for b in store.site_buildings(conn, s["id"]):
            building_ok = site_ok or authorize(conn, principal, P_READ, ("building", b["id"])).allowed
            floors_out: list[dict[str, Any]] = []
            for f in store.building_floors(conn, b["id"]):
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


@router.post("/sites", status_code=201, **wire(W.CatalogSite))
def create_site(body: SiteIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, P_SYSTEM, INSTALLATION)
    sid, now = new_id(), now_iso()
    store.insert_site(conn, sid, body.name.strip(), body.address.strip(), body.timezone, body.sort_order, now)
    audit(conn, actor=principal, action="site.create", decision="allowed", resource_type="site", resource_id=sid, request_id=_rid(request), details={"name": body.name})
    return site_row(get_site(conn, sid))


def _site_patch_fields(body: SitePatch) -> dict[str, Any]:
    """CR-BE-FOLLOWUPS-2470: the edit trims name and address like create does, refuses a name that is only blanks and a
    time zone the zone database does not know (the same check as the installation's `time.zone` setting)."""
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    for key in ("name", "address"):
        if key in fields:
            fields[key] = fields[key].strip()
    if "name" in fields and not fields["name"]:
        raise validation("שם האתר לא יכול להיות ריק.", name=body.name)
    if "timezone" in fields:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            ZoneInfo(fields["timezone"])
        except (ZoneInfoNotFoundError, ValueError):
            raise validation("אזור זמן לא מוכר.", timezone=fields["timezone"])
    return fields


@router.patch("/sites/{site_id}", **wire(W.CatalogSite))
def update_site(site_id: str, body: SitePatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_site(conn, site_id)
    require(conn, principal, P_CONTENT, ("site", site_id))
    fields = _site_patch_fields(body)
    if fields:
        store.patch_row(conn, "sites", site_id, fields, now_iso())
    audit(conn, actor=principal, action="site.update", decision="allowed", resource_type="site", resource_id=site_id, request_id=_rid(request), details=fields)
    return site_row(get_site(conn, site_id))


@router.delete("/sites/{site_id}", status_code=204)
def delete_site(site_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    get_site(conn, site_id)
    require(conn, principal, P_SYSTEM, INSTALLATION)
    n = store.live_building_count(conn, site_id)
    if n:
        raise conflict("has_children", "לאתר יש מבנים; מחק או העבר אותם קודם.", buildings=n)
    store.soft_delete_site(conn, site_id, now_iso(), now_iso())
    audit(conn, actor=principal, action="site.delete", decision="allowed", resource_type="site", resource_id=site_id, request_id=_rid(request))


# ---------- buildings ----------

class BuildingIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sort_order: int = 0


class BuildingPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    sort_order: int | None = None
    # MULTIBUILDING-HOME-2330: the site's shared building ("משותף") - listed last on the home screen, unchecked in "כבה הכל באתר"
    is_shared: bool | None = None


@router.post("/sites/{site_id}/buildings", status_code=201, **wire(W.CatalogBuilding))
def create_building(site_id: str, body: BuildingIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_site(conn, site_id)
    require(conn, principal, P_CONTENT, ("site", site_id))
    bid, now = new_id(), now_iso()
    store.insert_building(conn, bid, site_id, body.name.strip(), body.sort_order, now)
    audit(conn, actor=principal, action="building.create", decision="allowed", resource_type="building", resource_id=bid, request_id=_rid(request), details={"name": body.name, "site_id": site_id})
    return building_row(get_building(conn, bid))


@router.patch("/buildings/{building_id}", **wire(W.CatalogBuilding))
def update_building(building_id: str, body: BuildingPatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_building(conn, building_id)
    require(conn, principal, P_CONTENT, ("building", building_id))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if "is_shared" in fields:
        fields["is_shared"] = 1 if fields["is_shared"] else 0
    if fields:
        store.patch_row(conn, "buildings", building_id, fields, now_iso())
    audit(conn, actor=principal, action="building.update", decision="allowed", resource_type="building", resource_id=building_id, request_id=_rid(request), details=fields)
    return building_row(get_building(conn, building_id))


@router.delete("/buildings/{building_id}", status_code=204)
def delete_building(building_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    b = get_building(conn, building_id)
    require(conn, principal, P_CONTENT, ("site", b["site_id"]))
    n = store.live_floor_count(conn, building_id)
    if n:
        raise conflict("has_children", "למבנה יש קומות; מחק אותן קודם.", floors=n)
    from ..services import building_scope

    guard = building_scope.RemapGuard(conn, principal, P_CONTENT)  # FIX-MH01-2560: the building's area -> building rows stop counting
    store.soft_delete_building(conn, building_id, now_iso(), now_iso())
    guard.check()
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


@router.post("/buildings/{building_id}/floors", status_code=201, **wire(W.CatalogFloor))
def create_floor(building_id: str, body: FloorIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_building(conn, building_id)
    require(conn, principal, P_CONTENT, ("building", building_id))
    fid, now = new_id(), now_iso()
    store.insert_floor(conn, fid, building_id, body.name.strip(), body.level, body.sort_order, now)
    audit(conn, actor=principal, action="floor.create", decision="allowed", resource_type="floor", resource_id=fid, request_id=_rid(request), details={"name": body.name, "building_id": building_id, "level": body.level})
    return floor_row(conn, get_floor(conn, fid))


@router.get("/floors/{floor_id}", **wire(W.CatalogFloorRead))
def read_floor(floor_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    f = get_floor(conn, floor_id)
    from ..services.access import require_floor_read

    require_floor_read(conn, principal, floor_id, P_READ)
    b = get_building(conn, f["building_id"])
    s = get_site(conn, b["site_id"])
    return {"floor": floor_row(conn, f), "building": building_row(b), "site": site_row(s)}


@router.patch("/floors/{floor_id}", **wire(W.CatalogFloor))
def update_floor(floor_id: str, body: FloorPatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_floor(conn, floor_id)
    require(conn, principal, P_CONTENT, ("floor", floor_id))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if fields:
        store.patch_row(conn, "floors", floor_id, fields, now_iso())
    audit(conn, actor=principal, action="floor.update", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request), details=fields)
    return floor_row(conn, get_floor(conn, floor_id))


@router.delete("/floors/{floor_id}", status_code=204)
def delete_floor(floor_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), force: bool = Query(False)) -> None:
    """A floor with anchors is not deleted silently: 409 unless force=true, which tombstones the anchors first."""
    f = get_floor(conn, floor_id)
    require(conn, principal, P_CONTENT, ("building", f["building_id"]))
    anchors = store.floor_anchor_count(conn, floor_id)
    if anchors and not force:
        raise conflict("has_anchors", "על הקומה מוצבים פריטים; אשר מחיקה מפורשת (force) או הסר אותם קודם.", anchors=anchors)
    now = now_iso()
    from ..services import building_scope

    guard = building_scope.RemapGuard(conn, principal, P_CONTENT)  # FIX-MH01-2560: the floor's areas fall back to their next mapping row
    if anchors:
        store.end_floor_anchors(conn, floor_id, now, principal.user_id)
    store.archive_floor_plans(conn, floor_id, now)
    store.soft_delete_floor(conn, floor_id, now)
    guard.check()  # before any file is removed below
    from ..services import revocation, shared_spaces

    ended = shared_spaces.end_for_floor(conn, floor_id, principal.user_id, now)  # review L5: no live share or member row outlives the floor
    if ended["shares"]:
        revocation.mark(store.user_ids(conn))  # reach through the room narrows now
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


# ---------- moving a floor to another building (MULTI-BUILDING-SAFETY-2500, owner 22.11 Q62) ----------
# Allowed only to someone who manages the content of BOTH buildings, after an impact preview that names who loses access
# (services/floor_move.py). The move is confirmed with the preview's digest (409 preview_stale when anything changed since).

def _move_targets(conn: sqlite3.Connection, principal: Principal, floor_id: str, building_id: str) -> tuple[sqlite3.Row, sqlite3.Row]:
    """The live floor and the live target building, after the two permission checks (source building AND target building, each refusal
    audited). The target must be another building of the same site (a site's time zone and address are its own)."""
    from ..services import floor_move

    f = get_floor(conn, floor_id)
    require(conn, principal, P_CONTENT, ("building", f["building_id"]))
    target = floor_move.live_building(conn, building_id)
    if target is None:
        raise ApiError(404, "building_not_found", "הבניין לא נמצא.", details={"building_id": building_id})
    require(conn, principal, P_CONTENT, ("building", target["id"]))
    if target["id"] == f["building_id"]:
        raise validation("הקומה כבר נמצאת בבניין הזה.", building_id=building_id)
    source = get_building(conn, f["building_id"])
    if source["site_id"] != target["site_id"]:
        raise validation("אפשר להעביר קומה רק לבניין באותו אתר.", building_id=building_id)
    return f, target


@router.get("/floors/{floor_id}/move-preview", **wire(W.FloorMovePreview))
def floor_move_preview(floor_id: str, building: str = Query(..., min_length=1, max_length=120), principal: Principal = Depends(current_principal_ro),
                       conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """What moving the floor to another building of its site changes: who loses / gains access, what moves with it, blockers."""
    from ..services import floor_move

    f, target = _move_targets(conn, principal, floor_id, building)
    return floor_move.preview(conn, f, target)


class FloorMoveIn(BaseModel):
    building_id: str = Field(min_length=1, max_length=120)
    preview_digest: str = Field(min_length=1, max_length=64)


@router.post("/floors/{floor_id}/move", **wire(W.FloorMoveResult))
def floor_move(floor_id: str, body: FloorMoveIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Move the floor to another building of its site, confirmed with the preview's digest; plans, anchors, cameras and floor bindings go with it."""
    from ..services import floor_move as fm, revocation

    f, target = _move_targets(conn, principal, floor_id, body.building_id)
    pv = fm.preview(conn, f, target)
    if pv["blockers"]:
        raise conflict("move_blocked", "אי אפשר להעביר את הקומה: חדר משותף מחבר אותה לקומה בבניין אחר. בטלו את השיתוף קודם.",
                       blockers=[b["code"] for b in pv["blockers"]])
    if body.preview_digest != pv["digest"]:
        raise conflict("preview_stale", "משהו השתנה מאז התצוגה המקדימה. בדקו אותה שוב.", digest=pv["digest"])
    records = fm.apply(conn, floor_id, target["id"], now_iso())
    p = pv["people"]
    audit(conn, actor=principal, action="floor.move", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
          details={"from": pv["from_building"]["id"], "to": target["id"], "loses": p["loses"], "gains": p["gains"], "changes": p["changes"],
                   "lost_users": [x["user_id"] for x in p["items"] if x["change"] == "loses"], "records": records, "digest": pv["digest"]})
    revocation.mark(store.user_ids(conn))  # reach moved with the floor: every open socket re-scopes now
    return {"floor": floor_row(conn, get_floor(conn, floor_id)), "from_building": pv["from_building"], "to_building": pv["to_building"],
            "records": records, "loses": p["loses"], "gains": p["gains"], "changes": p["changes"]}


# ---------- home-platform links (SYNOPTIC-HA-2310) ----------
# Mapping rows keyed by the platform's id -> our floor (migration 0187): layer 1 = platform floor -> our floor (one row per platform
# floor), layer 2 = per-area override (NULL floor = taken off every floor by hand). Layer 3, the plan rooms' area links, wins over both
# and lives with the rooms (spatial_zones.ha_area_id). These are the layers of docs/changes/PROPOSAL-MULTI-BUILDING-HOME.md; nothing here
# knows a building, so a building level can be added later without touching the rows.

def _live_floor_ids(conn: sqlite3.Connection) -> set[str]:
    return store.live_floor_ids(conn)


@router.get("/home-links", **wire(W.CatalogHomeLinks))
def list_home_links(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
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

    floors = [{"ha_floor_id": r["ha_floor_id"], "floor_id": r["floor_id"]} for r in store.floor_link_rows(conn) if readable(r["floor_id"])]
    areas = [{"area_id": r["area_id"], "floor_id": r["floor_id"]} for r in store.area_link_rows(conn) if r["floor_id"] is None or readable(r["floor_id"])]
    # MAPPING-ASSIST-2330: the area -> building rows of the home's site level (an area the mapping assistant put in a building where none of
    # our floors fits), for buildings the caller may read (the building itself, or one of its floors)
    buildings: list[dict[str, str]] = []
    try:
        rows = store.area_building_rows(conn)
    except sqlite3.OperationalError:  # before migration 0189
        rows = []
    if rows:
        floors_of: dict[str, list[str]] = {}
        for r in store.live_floor_buildings(conn):
            floors_of.setdefault(r[1], []).append(r[0])
        b_ok: dict[str, bool] = {}
        for r in rows:
            bid = r["building_id"]
            if bid not in b_ok:
                b_ok[bid] = all_read or authorize(conn, principal, P_READ, ("building", bid)).allowed or any(readable(f) for f in floors_of.get(bid, []))
            if b_ok[bid]:
                buildings.append({"area_id": r["area_id"], "building_id": bid})
    return {"floors": floors, "areas": areas, "buildings": buildings}


class HomeLinkIn(BaseModel):
    # the platform floors of this floor, the whole list (None = unchanged, [] = none); a platform floor held by another floor moves here
    ha_floor_ids: list[str] | None = Field(default=None, max_length=50)
    # per area: include = belongs to this floor; exclude = taken off every floor ("לא משויך"); auto = back to the automatic rule
    areas: dict[str, Literal["include", "exclude", "auto"]] | None = Field(default=None, max_length=500)


@router.put("/floors/{floor_id}/home-link", **wire(W.CatalogHomeLinks))
def put_home_link(floor_id: str, body: HomeLinkIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Whoever may edit the floor (site.content.configure on it) - and on every other floor a row is taken from. Unknown platform ids
    answer 422, except ids already in a row (a dangling row never blocks a save). Audited as floor.home_link."""
    get_floor(conn, floor_id)
    require(conn, principal, P_CONTENT, ("floor", floor_id))
    from ..services import building_scope

    guard = building_scope.RemapGuard(conn, principal, P_CONTENT)  # round 14: an area leaving its building needs that building's edit too
    live = _live_floor_ids(conn)
    now = now_iso()
    details: dict[str, Any] = {}
    if body.ha_floor_ids is not None:
        want: list[str] = []
        for raw in body.ha_floor_ids:
            hid = (raw or "").strip()
            if hid and len(hid) <= 120 and hid not in want:
                want.append(hid)
        current = store.floor_links(conn)
        taken: set[str] = set()
        for hid in want:
            if hid not in current and not store.platform_floor_known(conn, hid):
                raise validation("הקומה לא נמצאה ברשימת הקומות של מערכת הבית.", ha_floor_id=hid)
            if current.get(hid) not in (None, floor_id) and current[hid] in live:
                taken.add(current[hid])
        for fid in sorted(taken):
            require(conn, principal, P_CONTENT, ("floor", fid))  # taking a platform floor from another floor is that floor's edit too
        for hid, fid in current.items():
            if fid == floor_id and hid not in want:
                store.delete_floor_link(conn, hid)
        for hid in want:
            store.put_floor_link(conn, hid, floor_id, now, principal.user_id)
        details["ha_floor_ids"] = want
        if taken:
            details["taken_from_floors"] = sorted(taken)
    if body.areas is not None:
        current = store.area_links(conn)
        changes: dict[str, str] = {}
        for raw, mode in body.areas.items():
            aid = (raw or "").strip()
            if not aid or len(aid) > 120:
                continue
            if mode != "auto" and aid not in current and not store.platform_area_known(conn, aid):
                raise validation("האזור לא נמצא ברשימת האזורים.", area_id=aid)
            prev = current.get(aid)
            if prev is not None and prev != floor_id and prev in live:
                require(conn, principal, P_CONTENT, ("floor", prev))  # the row belongs to another floor: moving or clearing it edits that floor too
            if mode == "include":
                store.include_area(conn, aid, floor_id, now, principal.user_id)
            elif mode == "exclude":
                store.exclude_area(conn, aid, now, principal.user_id)
            else:
                store.delete_area_link(conn, aid)
            changes[aid] = mode
        details["areas"] = changes
    guard.check()
    audit(conn, actor=principal, action="floor.home_link", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request), details=details)
    return list_home_links(principal, conn)
