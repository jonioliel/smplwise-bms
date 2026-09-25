"""Plan assets (immutable originals) and plan versions (derived backgrounds; draft → published →
archived). Images are served only through authorized endpoints (ch. 11, 12, 32)."""
from __future__ import annotations

import json
import shutil
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..config import Settings
from ..db import new_id, now_iso, unlocked
from ..errors import ApiError, conflict, not_found
from ..rbac import Principal, require
from ..services import geometry_store
from ..services import plan_dxf, plan_dxf_map, plan_render, plan_stylize
from .catalog import get_floor

router = APIRouter()


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def asset_row(r: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": r["id"], "floor_id": r["floor_id"], "original_name": r["original_name"], "mime": r["mime"], "sha256": r["sha256"],
        "bytes": r["bytes"], "page_count": r["page_count"], "created_at": r["created_at"],
        "pages": [{"page": p, "preview_url": f"api/v1/plan-assets/{r['id']}/pages/{p}/preview.png"} for p in range(1, r["page_count"] + 1)],
        "kind": "pdf" if r["mime"] == "application/pdf" else "dxf" if r["mime"] == "image/vnd.dxf" else "image",
    }


def version_row(r: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": r["id"], "floor_id": r["floor_id"], "asset_id": r["asset_id"], "page": r["page"], "rotation": r["rotation"],
        "crop": json.loads(r["crop_json"]) if r["crop_json"] else None, "width_px": r["width_px"], "height_px": r["height_px"],
        "scale_m_per_px": r["scale_m_per_px"], "status": r["status"], "revision": r["revision"], "notes": r["notes"],
        "calibration": json.loads(r["calibration_json"]) if "calibration_json" in r.keys() and r["calibration_json"] else None,
        "created_at": r["created_at"], "published_at": r["published_at"], "archived_at": r["archived_at"],
        "created_by": r["created_by"], "published_by": r["published_by"],
        # the map background follows render_mode; the source picture stays reachable for comparisons
        "image_url": f"api/v1/plan-versions/{r['id']}/{'stylized' if _stylized(r) else 'image'}.png",
        "source_url": f"api/v1/plan-versions/{r['id']}/source.png",
        "render_mode": "stylized" if _stylized(r) else "source",
        "stylized_url": f"api/v1/plan-versions/{r['id']}/stylized.png" if _has_stylized(r) else None,
    }


def _geometry(r: sqlite3.Row) -> tuple[Any, ...]:
    """Two versions with the same asset, page, rotation and crop share one pixel space: anchors move between them freely."""
    return (r["asset_id"], r["page"], r["rotation"], r["crop_json"] or None)


def _published(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'published'", (floor_id,)).fetchone()


def _carry_anchors(conn: sqlite3.Connection, target: sqlite3.Row, now: str) -> tuple[int, int]:
    """Active anchors placed on a version with identical geometry follow the target version. Others keep their
    version id and the map reports needs_alignment: nothing is ever moved to an invented location (T038)."""
    same = [r["id"] for r in conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND id != ?", (target["floor_id"], target["id"])).fetchall() if _geometry(r) == _geometry(target)]
    carried = 0
    if same:
        carried = conn.execute(
            f"UPDATE map_anchors SET plan_version_id = ?, updated_at = ? WHERE floor_id = ? AND effective_to IS NULL AND plan_version_id IN ({','.join('?' * len(same))})",
            (target["id"], now, target["floor_id"], *same),
        ).rowcount
    pending = conn.execute("SELECT COUNT(*) FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL AND plan_version_id != ?", (target["floor_id"], target["id"])).fetchone()[0]
    return carried, pending


def needs_alignment(conn: sqlite3.Connection, version: sqlite3.Row | None, anchors: list[sqlite3.Row]) -> bool:
    """An anchor needs a look when it was placed on a version whose pixel space differs from the shown one."""
    if not version or not anchors:
        return False
    versions = {r["id"]: r for r in conn.execute("SELECT * FROM plan_versions WHERE floor_id = ?", (version["floor_id"],)).fetchall()}
    g = _geometry(version)
    return any(a["plan_version_id"] != version["id"] and (a["plan_version_id"] not in versions or _geometry(versions[a["plan_version_id"]]) != g) for a in anchors)


def version_at(conn: sqlite3.Connection, floor_id: str, iso: str) -> sqlite3.Row | None:
    """The version that was published at the instant (every version keeps one published period; a restore creates a copy)."""
    return conn.execute(
        "SELECT * FROM plan_versions WHERE floor_id = ? AND status != 'draft' AND published_at IS NOT NULL AND published_at <= ? AND (archived_at IS NULL OR archived_at > ?) ORDER BY published_at DESC LIMIT 1",
        (floor_id, iso, iso),
    ).fetchone()


def version_diff(conn: sqlite3.Connection, target: sqlite3.Row, base: sqlite3.Row | None) -> dict[str, Any]:
    """What publishing (or restoring) `target` means: geometry changes against `base` and the fate of every placed item."""
    changes: list[dict[str, Any]] = []
    if base is not None:
        for name, col in (("asset", "asset_id"), ("page", "page"), ("rotation", "rotation"), ("crop", "crop_json"), ("width_px", "width_px"), ("height_px", "height_px")):
            a, b = base[col], target[col]
            if col == "crop_json":
                a, b = (json.loads(a) if a else None), (json.loads(b) if b else None)
            if a != b:
                changes.append({"field": name, "from": a, "to": b})
    g = _geometry(target)
    versions = {r["id"]: r for r in conn.execute("SELECT * FROM plan_versions WHERE floor_id = ?", (target["floor_id"],)).fetchall()}
    cameras = {r["id"]: r for r in conn.execute("SELECT id, channel, name_source, alias FROM cameras").fetchall()}
    items = []
    for a in conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL ORDER BY layer_id, resource_id", (target["floor_id"],)).fetchall():
        on = versions.get(a["plan_version_id"])
        carried = a["plan_version_id"] == target["id"] or (on is not None and _geometry(on) == g)
        cam = cameras.get(a["resource_id"]) if a["resource_type"] == "camera" else None
        name = (cam["alias"] or cam["name_source"] or f"ערוץ {cam['channel']}") if cam else (a["label"] or a["resource_id"])
        items.append({"anchor_id": a["id"], "resource_type": a["resource_type"], "resource_id": a["resource_id"], "name": name,
                      "on_version_id": a["plan_version_id"], "outcome": "carried" if carried else "needs_alignment"})
    carried_n = sum(1 for i in items if i["outcome"] == "carried")
    return {
        "from": version_row(base) if base is not None else None,
        "to": version_row(target),
        "geometry": {"same": base is not None and not changes, "changes": changes},
        "anchors": {"total": len(items), "carried": carried_n, "needs_alignment": len(items) - carried_n, "items": items},
    }


def _has_stylized(r: sqlite3.Row) -> bool:
    keys = r.keys()
    return "stylized_path" in keys and bool(r["stylized_path"])


def _stylized(r: sqlite3.Row) -> bool:
    return _has_stylized(r) and r["render_mode"] == "stylized"


def get_asset(conn: sqlite3.Connection, asset_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM plan_assets WHERE id = ?", (asset_id,)).fetchone()
    if not row:
        raise not_found("קובץ התוכנית לא נמצא.")
    return row


def get_version(conn: sqlite3.Connection, version_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM plan_versions WHERE id = ?", (version_id,)).fetchone()
    if not row:
        raise not_found("גרסת התוכנית לא נמצאה.")
    return row


def _asset_dir(settings: Settings, asset_id: str) -> Path:
    return settings.plans_dir / asset_id


def _page_png(settings: Settings, asset: sqlite3.Row, page: int, max_px: int) -> Path:
    """Rendered page cache: <asset>/page-<n>-<max_px>.png (derived, reproducible from the original)."""
    out = _asset_dir(settings, asset["id"]) / f"page-{page}-{max_px}.png"
    if out.exists():
        return out
    src = settings.data_dir / asset["storage_path"]
    if asset["mime"] == "application/pdf":
        plan_render.render_pdf_page(src, page, out, max_px, settings.render_timeout_s)
    elif asset["mime"] == "image/vnd.dxf":
        opts = plan_dxf.load_options(_asset_dir(settings, asset["id"]))
        try:
            plan_dxf.render(src, out, max_px, opts.get("layers"), opts.get("units"))
        except plan_dxf.DxfError as exc:
            raise ApiError(422, exc.code, "לא ניתן לרנדר את ה־DXF עם השכבות שנבחרו.", details=exc.details)
    else:
        plan_render.normalize_image(src, out, max_px)
    return out


# ---------- upload ----------

@router.post("/floors/{floor_id}/plan-assets", status_code=201)
async def upload_asset(floor_id: str, request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    settings = settings_of(request)
    get_floor(conn, floor_id)
    require(conn, principal, "map.import", ("floor", floor_id))

    head = await file.read(1024)
    mime = plan_render.sniff_mime(head)
    if mime == "image/svg+xml":
        raise ApiError(415, "unsupported_format", "SVG אינו נתמך עד שיוטמע sanitization; ייצא PDF או PNG.")
    if mime not in plan_render.SUPPORTED:
        raise ApiError(415, "unsupported_format", "הקובץ אינו PDF, PNG או JPG (הזיהוי לפי התוכן, לא לפי הסיומת).")

    asset_id = new_id()
    folder = _asset_dir(settings, asset_id)
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / f"source{plan_render.SUPPORTED[mime]}"
    size = 0
    try:
        with dest.open("wb") as out:
            out.write(head)
            size = len(head)
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    raise ApiError(413, "payload_too_large", f"הקובץ גדול מ־{settings.max_upload_bytes // (1024 * 1024)} MB.")
                out.write(chunk)
        page_count = 1
        if mime == "application/pdf":
            try:
                page_count = plan_render.pdf_page_count(dest)
            except Exception as exc:  # noqa: BLE001 - poppler / pypdf refuse the file: the upload is the problem
                raise ApiError(422, "corrupt_pdf", "ה־PDF לא ניתן לקריאה.", details={"error": type(exc).__name__})
            if page_count < 1 or page_count > settings.max_pdf_pages:
                raise ApiError(422, "too_many_pages", f"ה־PDF חייב להכיל 1–{settings.max_pdf_pages} עמודים.", details={"pages": page_count})
        elif mime == "image/vnd.dxf":
            try:
                info = plan_dxf.inspect(dest)
                if info.drawable == 0:
                    raise plan_dxf.DxfError("dxf_empty", "nothing drawable", {"unsupported": info.unsupported})
                result = plan_dxf.render(dest, folder / f"page-1-{settings.preview_px}.png", settings.preview_px)
            except plan_dxf.DxfError as exc:
                raise ApiError(422, exc.code, {"corrupt_dxf": "קובץ ה־DXF לא ניתן לקריאה.", "dxf_empty": "ב־DXF אין גאומטריה שניתן לצייר (קווים, פוליליינים, מעגלים, קשתות, בלוקים).", "dxf_too_large": "ה־DXF גדול מדי."}.get(exc.code, "ה־DXF נדחה."), details=exc.details)
            plan_dxf.save_options(folder, {"layers": None, "units": None, "info": info.to_dict(), "render": result.to_dict()})
        else:
            plan_render.normalize_image(dest, folder / f"page-1-{settings.preview_px}.png", settings.preview_px)
    except ApiError:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    except Exception as exc:  # corrupt file, decoder error
        shutil.rmtree(folder, ignore_errors=True)
        raise ApiError(422, "decode_failed", "לא ניתן לקרוא את הקובץ.", details={"error": type(exc).__name__}) from exc

    sha = plan_render.sha256_of(dest)
    name = (file.filename or "plan")[:200]
    conn.execute(
        "INSERT INTO plan_assets(id, floor_id, original_name, mime, sha256, bytes, page_count, storage_path, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (asset_id, floor_id, name, mime, sha, size, page_count, str(dest.relative_to(settings.data_dir).as_posix()), principal.user_id, now_iso()),
    )
    audit(conn, actor=principal, action="plan.asset.upload", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
          details={"asset_id": asset_id, "mime": mime, "bytes": size, "pages": page_count, "sha256": sha})
    return asset_row(get_asset(conn, asset_id))


@router.get("/floors/{floor_id}/plan-assets")
def list_assets(floor_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_floor(conn, floor_id)
    require(conn, principal, "map.import", ("floor", floor_id))
    rows = conn.execute("SELECT * FROM plan_assets WHERE floor_id = ? ORDER BY created_at DESC", (floor_id,)).fetchall()
    return {"assets": [asset_row(r) for r in rows]}


@router.get("/plan-assets/{asset_id}/pages/{page}/preview.png")
def page_preview(asset_id: str, page: int, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), rotation: int = 0) -> FileResponse:
    """Page preview for the import wizard; `rotation` (0/90/180/270) returns the page as the derived version
    will see it, so the crop box drawn over it maps 1:1 onto the saved image."""
    settings = settings_of(request)
    asset = get_asset(conn, asset_id)
    require(conn, principal, "map.import", ("floor", asset["floor_id"]))
    if page < 1 or page > asset["page_count"]:
        raise not_found("העמוד לא קיים.")
    if rotation not in (0, 90, 180, 270):
        raise ApiError(422, "validation", "סיבוב חייב להיות 0, 90, 180 או 270.")
    png = _page_png(settings, asset, page, settings.preview_px)
    if rotation:
        rotated = png.with_name(f"{png.stem}_r{rotation}.png")
        if not rotated.exists() or rotated.stat().st_mtime < png.stat().st_mtime:
            plan_render.derive_version_image(png, rotated, rotation, None, settings.preview_px)
        png = rotated
    return FileResponse(png, media_type="image/png", headers={"Cache-Control": "private, max-age=3600"})


# ---------- versions ----------

class CropIn(BaseModel):
    x: float = Field(ge=0, lt=1)
    y: float = Field(ge=0, lt=1)
    w: float = Field(gt=0, le=1)
    h: float = Field(gt=0, le=1)


class VersionIn(BaseModel):
    asset_id: str
    page: int = Field(default=1, ge=1)
    rotation: int = 0
    crop: CropIn | None = None
    notes: str = Field(default="", max_length=500)
    scale_m_per_px: float | None = Field(default=None, gt=0)


@router.post("/floors/{floor_id}/plan-versions", status_code=201)
def create_version(floor_id: str, body: VersionIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    settings = settings_of(request)
    get_floor(conn, floor_id)
    require(conn, principal, "map.edit", ("floor", floor_id))
    asset = get_asset(conn, body.asset_id)
    if asset["floor_id"] != floor_id:
        raise ApiError(422, "validation", "קובץ התוכנית שייך לקומה אחרת.")
    if body.page > asset["page_count"]:
        raise ApiError(422, "validation", "מספר עמוד מחוץ לטווח.", details={"pages": asset["page_count"]})
    page_png = _page_png(settings, asset, body.page, settings.max_render_px)
    dxf_scale: float | None = None
    if asset["mime"] == "image/vnd.dxf" and body.scale_m_per_px is None:
        # the drawing's units give the scale for free: metres per unit / pixels per unit at this render, corrected for the crop and the final resize
        opts = plan_dxf.load_options(_asset_dir(settings, asset["id"]))
        with unlocked(conn):
            probe = plan_dxf.render(settings.data_dir / asset["storage_path"], page_png.with_name("probe.png"), settings.max_render_px, opts.get("layers"), opts.get("units"))
        page_png.with_name("probe.png").unlink(missing_ok=True)
        if probe.meters_per_px:
            dxf_scale = probe.meters_per_px
    version_id = new_id()
    out = _asset_dir(settings, asset["id"]) / f"version-{version_id}.png"
    crop = plan_render.Crop(**body.crop.model_dump()) if body.crop else None
    w, h = plan_render.derive_version_image(page_png, out, body.rotation, crop, settings.max_render_px)
    scale_value = body.scale_m_per_px
    if dxf_scale is not None:
        from PIL import Image as _Image

        with _Image.open(page_png) as _im:
            rw, rh = _im.size
        if body.rotation in (90, 270):
            rw, rh = rh, rw
        crop_w_px = round(crop.w * rw) if crop else rw
        scale_value = dxf_scale * (crop_w_px / w) if w else dxf_scale
    conn.execute(
        """INSERT INTO plan_versions(id, floor_id, asset_id, page, rotation, crop_json, width_px, height_px, image_path, scale_m_per_px, status, revision, notes, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?)""",
        (version_id, floor_id, asset["id"], body.page, body.rotation, json.dumps(body.crop.model_dump()) if body.crop else None, w, h,
         str(out.relative_to(settings.data_dir).as_posix()), scale_value, body.notes, principal.user_id, now_iso()),
    )
    # a new version starts from the floor's structure when it is the same drawing (copied / mapped through a re-crop)
    carry = geometry_store.carry(conn, get_version(conn, version_id), principal.user_id)
    audit(conn, actor=principal, action="plan.version.create", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
          details={"version_id": version_id, "asset_id": asset["id"], "page": body.page, "rotation": body.rotation, "crop": body.crop.model_dump() if body.crop else None,
                   "geometry_carry": carry})
    return dict(version_row(get_version(conn, version_id)), geometry_carry=carry)


@router.get("/floors/{floor_id}/plan-versions")
def list_versions(floor_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_floor(conn, floor_id)
    require(conn, principal, "map.edit", ("floor", floor_id))
    rows = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? ORDER BY created_at DESC", (floor_id,)).fetchall()
    counts = {r["plan_version_id"]: r["n"] for r in conn.execute("SELECT plan_version_id, COUNT(*) AS n FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL GROUP BY plan_version_id", (floor_id,)).fetchall()}
    return {"versions": [dict(version_row(r), anchors_on=counts.get(r["id"], 0)) for r in rows]}


@router.get("/plan-versions/{version_id}/image.png")
def version_image(version_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> FileResponse:
    settings = settings_of(request)
    v = get_version(conn, version_id)
    # Viewers read published and archived versions (the historical map shows old plans); drafts need an editor (ch. 9 / T019).
    _readable(conn, principal, v)
    path = settings.data_dir / v["image_path"]
    if not path.exists():
        raise not_found("תמונת התוכנית חסרה בדיסק.")
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "private, max-age=86400"})


@router.post("/plan-versions/{version_id}/publish")
def publish_version(version_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    require(conn, principal, "map.publish", ("floor", v["floor_id"]))
    if v["status"] != "draft":
        raise conflict("not_draft", "רק טיוטה ניתנת לפרסום.", status=v["status"])
    now = now_iso()
    # the version's structure is published with it; an invalid one refuses the publish before anything changes (422)
    structure_pending = geometry_store.pending_doc(conn, v)
    previous = _published(conn, v["floor_id"])
    if previous:
        conn.execute("UPDATE plan_versions SET status = 'archived', archived_at = ?, revision = revision + 1 WHERE id = ?", (now, previous["id"]))
    conn.execute("UPDATE plan_versions SET status = 'published', published_by = ?, published_at = ?, revision = revision + 1 WHERE id = ?", (principal.user_id, now, version_id))
    # Anchors never migrate to an invented location: they follow only between versions with identical geometry;
    # otherwise they keep their old version id and the map reports needs_alignment (T038).
    carried, pending = _carry_anchors(conn, get_version(conn, version_id), now)
    structure = geometry_store.publish(conn, get_version(conn, version_id), principal.user_id, now) if structure_pending is not None else None
    audit(conn, actor=principal, action="plan.version.publish", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": version_id, "previous_version_id": previous["id"] if previous else None, "anchors_carried": carried, "needs_alignment": pending,
                   "same_geometry": bool(previous) and _geometry(previous) == _geometry(v),
                   "structure_published": bool(structure and not structure["unchanged"])})
    return version_row(get_version(conn, version_id))


@router.get("/plan-versions/{version_id}/diff")
def diff_version(version_id: str, against: str | None = None, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Preview shown before publishing or restoring: geometry changes against the published version (or `against`)
    and what happens to every placed item (T038)."""
    v = get_version(conn, version_id)
    require(conn, principal, "map.edit", ("floor", v["floor_id"]))
    base = get_version(conn, against) if against else _published(conn, v["floor_id"])
    if base is not None and base["floor_id"] != v["floor_id"]:
        raise ApiError(422, "validation", "הגרסאות שייכות לקומות שונות.")
    return version_diff(conn, v, base)


class RollbackIn(BaseModel):
    revision: int = Field(ge=1)
    expected_published_id: str | None = Field(default=None, max_length=32)


@router.post("/plan-versions/{version_id}/rollback", status_code=201)
def rollback_version(version_id: str, body: RollbackIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Restore an archived version as a new published version (its own copy of the picture and the same geometry), so
    every version keeps exactly one published period for the historical map. Anchors follow by geometry. The archived
    row and the previously published version bump their revision, so a concurrent restore or publish is a clear 409."""
    settings = settings_of(request)
    v = get_version(conn, version_id)
    require(conn, principal, "map.publish", ("floor", v["floor_id"]))
    if v["status"] != "archived":
        raise conflict("not_archived", "רק גרסה מהארכיון ניתנת לשחזור.", status=v["status"])
    if body.revision != v["revision"]:
        raise conflict("stale_revision", "הגרסה השתנתה בינתיים; טען מחדש את היסטוריית הגרסאות.", current_revision=v["revision"], sent_revision=body.revision)
    previous = _published(conn, v["floor_id"])
    if body.expected_published_id is not None and (previous["id"] if previous else None) != body.expected_published_id:
        raise conflict("stale_published", "בינתיים פורסמה גרסה אחרת; בדוק את ההשוואה שוב.", published_version_id=previous["id"] if previous else None)
    src = settings.data_dir / v["image_path"]
    if not src.exists():
        raise not_found("תמונת התוכנית חסרה בדיסק.")
    now = now_iso()
    restored_id = new_id()
    out = src.with_name(f"version-{restored_id}.png")
    shutil.copyfile(src, out)
    stylized_rel = None
    if _has_stylized(v) and (settings.data_dir / v["stylized_path"]).exists():
        so = out.with_name(out.stem + ".stylized.png")
        shutil.copyfile(settings.data_dir / v["stylized_path"], so)
        stylized_rel = str(so.relative_to(settings.data_dir).as_posix())
    if previous:
        conn.execute("UPDATE plan_versions SET status = 'archived', archived_at = ?, revision = revision + 1 WHERE id = ?", (now, previous["id"]))
    conn.execute("UPDATE plan_versions SET revision = revision + 1 WHERE id = ?", (version_id,))
    notes = f"שחזור של גרסה שפורסמה ב־{v['published_at'] or v['created_at']}"
    conn.execute(
        """INSERT INTO plan_versions(id, floor_id, asset_id, page, rotation, crop_json, width_px, height_px, image_path, scale_m_per_px, calibration_json, status, revision, notes,
                                     created_by, created_at, published_by, published_at, render_mode, stylized_path, stylize_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 1, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (restored_id, v["floor_id"], v["asset_id"], v["page"], v["rotation"], v["crop_json"], v["width_px"], v["height_px"], str(out.relative_to(settings.data_dir).as_posix()),
         v["scale_m_per_px"], v["calibration_json"], notes, principal.user_id, now, principal.user_id, now, v["render_mode"] if stylized_rel else "source", stylized_rel, v["stylize_json"] if stylized_rel else None),
    )
    restored = get_version(conn, restored_id)
    carried, pending = _carry_anchors(conn, restored, now)
    geometry_store.copy_published(conn, v, restored, principal.user_id, now)
    audit(conn, actor=principal, action="plan.version.rollback", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"restored_from": version_id, "version_id": restored_id, "previous_version_id": previous["id"] if previous else None, "anchors_carried": carried, "needs_alignment": pending})
    return version_row(restored)


@router.delete("/plan-versions/{version_id}", status_code=204)
def delete_version(version_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    settings = settings_of(request)
    v = get_version(conn, version_id)
    require(conn, principal, "map.edit", ("floor", v["floor_id"]))
    if v["status"] != "draft":
        raise conflict("not_draft", "רק טיוטה ניתנת למחיקה; גרסה שפורסמה נשמרת להיסטוריה.", status=v["status"])
    if conn.execute("SELECT COUNT(*) FROM map_anchors WHERE plan_version_id = ?", (version_id,)).fetchone()[0]:
        raise conflict("has_anchors", "על הטיוטה מוצבים פריטים.")
    conn.execute("DELETE FROM plan_geometry WHERE plan_version_id = ?", (version_id,))
    conn.execute("DELETE FROM plan_versions WHERE id = ?", (version_id,))
    (settings.data_dir / v["image_path"]).unlink(missing_ok=True)
    audit(conn, actor=principal, action="plan.version.delete", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request), details={"version_id": version_id})


# ---------------------------------------------------------------- stylized rendering (design M11, local variant)

class StylizeIn(BaseModel):
    strength: str = Field(default="medium", pattern="^(light|medium|strong)$")
    keep_lines: bool = False
    room_fill: str = Field(default="white", pattern="^(white|tint|none)$")


class RenderModeIn(BaseModel):
    render_mode: str = Field(pattern="^(source|stylized)$")


def _readable(conn: sqlite3.Connection, principal: Principal, v: sqlite3.Row) -> None:
    if v["status"] == "draft":
        require(conn, principal, "map.edit", ("floor", v["floor_id"]))
    else:
        require(conn, principal, "map.read", ("floor", v["floor_id"]))


@router.get("/plan-versions/{version_id}")
def get_version_api(version_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    _readable(conn, principal, v)
    return version_row(v)


@router.get("/plan-versions/{version_id}/source.png")
def version_source(version_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> FileResponse:
    v = get_version(conn, version_id)
    _readable(conn, principal, v)
    path = settings_of(request).data_dir / v["image_path"]
    if not path.exists():
        raise not_found("תמונת התוכנית חסרה בדיסק.")
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "private, max-age=86400"})


@router.get("/plan-versions/{version_id}/stylized.png")
def version_stylized(version_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> FileResponse:
    v = get_version(conn, version_id)
    _readable(conn, principal, v)
    if not _has_stylized(v):
        raise not_found("לגרסה זו אין עדיין תמונה מעובדת.")
    path = settings_of(request).data_dir / v["stylized_path"]
    if not path.exists():
        raise not_found("התמונה המעובדת חסרה בדיסק.")
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "private, max-age=3600"})


@router.post("/plan-versions/{version_id}/stylize")
def stylize_version(version_id: str, body: StylizeIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Local image processing (no AI, nothing leaves the add-on): walls and rooms in the SMPLWISE language."""
    settings = settings_of(request)
    v = get_version(conn, version_id)
    require(conn, principal, "map.import", ("floor", v["floor_id"]))
    src = settings.data_dir / v["image_path"]
    if not src.exists():
        raise not_found("תמונת התוכנית חסרה בדיסק.")
    out = src.with_name(src.stem + ".stylized.png")
    try:
        with unlocked(conn):
            result = plan_stylize.stylize(src, out, body.strength, body.keep_lines, body.room_fill)
    except (OSError, ValueError, MemoryError) as exc:
        raise ApiError(500, "stylize_failed", "עיבוד התוכנית נכשל.", details={"error": type(exc).__name__})
    conn.execute("UPDATE plan_versions SET stylized_path = ?, stylize_json = ? WHERE id = ?", (str(out.relative_to(settings.data_dir)).replace("\\", "/"), json.dumps(result), version_id))
    audit(conn, actor=principal, action="plan.stylize", decision="allowed", resource_type="plan_version", resource_id=version_id, request_id=_rid(request), details=result)
    return {**result, "version_id": version_id, "source_url": f"api/v1/plan-versions/{version_id}/source.png", "stylized_url": f"api/v1/plan-versions/{version_id}/stylized.png"}


@router.patch("/plan-versions/{version_id}")
def patch_version(version_id: str, body: RenderModeIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    require(conn, principal, "map.import", ("floor", v["floor_id"]))
    if body.render_mode == "stylized" and not _has_stylized(v):
        raise conflict("stylized_missing", "הרץ קודם את העיבוד לשפת SMPLWISE.")
    conn.execute("UPDATE plan_versions SET render_mode = ? WHERE id = ?", (body.render_mode, version_id))
    audit(conn, actor=principal, action="plan.render_mode", decision="allowed", resource_type="plan_version", resource_id=version_id, request_id=_rid(request), details={"render_mode": body.render_mode})
    return version_row(get_version(conn, version_id))


# ---------------------------------------------------------------- DXF options (T065)

class DxfOptions(BaseModel):
    layers: list[str] | None = None
    units: str | None = None


def _dxf_payload(settings: Settings, asset: sqlite3.Row) -> dict[str, Any]:
    opts = plan_dxf.load_options(_asset_dir(settings, asset["id"]))
    return {
        "asset_id": asset["id"],
        "adapter": {"library": "ezdxf", "license": "MIT", "drawable": list(plan_dxf.DRAWABLE), "note": "TEXT/MTEXT, HATCH, DIMENSION and 3D entities are counted and reported, never drawn; DWG must be converted to DXF first."},
        "info": opts.get("info"),
        "options": {"layers": opts.get("layers"), "units": opts.get("units")},
        "render": opts.get("render"),
        "units_choices": sorted(plan_dxf.METERS),
    }


@router.get("/plan-assets/{asset_id}/dxf")
def dxf_info(asset_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """What the DXF contains (version, units, layers with drawable counts, entity counts, unsupported types, extent),
    the chosen layers/units and the last render (size, scale, skipped entities, partial flag)."""
    asset = get_asset(conn, asset_id)
    require(conn, principal, "map.import", ("floor", asset["floor_id"]))
    if asset["mime"] != "image/vnd.dxf":
        raise ApiError(409, "not_dxf", "הקובץ אינו DXF.")
    return _dxf_payload(settings_of(request), asset)


@router.put("/plan-assets/{asset_id}/dxf")
def dxf_set_options(asset_id: str, body: DxfOptions, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Choose the layers to draw and the drawing units; the page cache is re-rendered from the untouched source.
    A partial conversion (skipped entity types) is always reported in `render.skipped`; an empty selection is refused."""
    settings = settings_of(request)
    asset = get_asset(conn, asset_id)
    require(conn, principal, "map.import", ("floor", asset["floor_id"]))
    if asset["mime"] != "image/vnd.dxf":
        raise ApiError(409, "not_dxf", "הקובץ אינו DXF.")
    folder = _asset_dir(settings, asset_id)
    opts = plan_dxf.load_options(folder)
    known = {l["name"] for l in (opts.get("info") or {}).get("layers", [])}
    layers = None
    if body.layers is not None:
        layers = [l for l in body.layers if l in known]
        unknown = [l for l in body.layers if l not in known]
        if unknown:
            raise ApiError(422, "unknown_layer", "שכבה לא קיימת בקובץ.", details={"unknown": unknown})
        if not layers:
            raise ApiError(422, "no_layers", "יש לבחור לפחות שכבה אחת.")
    units = body.units
    if units is not None and units not in plan_dxf.METERS and units != "unitless":
        raise ApiError(422, "unknown_units", "יחידה לא מוכרת.", details={"choices": sorted(plan_dxf.METERS)})
    src = settings.data_dir / asset["storage_path"]
    for cached in folder.glob("page-1-*.png"):
        cached.unlink(missing_ok=True)
    try:
        with unlocked(conn):
            result = plan_dxf.render(src, folder / f"page-1-{settings.preview_px}.png", settings.preview_px, layers, None if units == "unitless" else units)
    except plan_dxf.DxfError as exc:
        raise ApiError(422, exc.code, "השכבות שנבחרו אינן מכילות גאומטריה שניתן לצייר.", details=exc.details)
    opts.update({"layers": layers, "units": units, "render": result.to_dict()})
    plan_dxf.save_options(folder, opts)
    audit(conn, actor=principal, action="plan.asset.dxf_options", decision="allowed", resource_type="floor", resource_id=asset["floor_id"], request_id=_rid(request),
          details={"asset_id": asset_id, "layers": layers, "units": units, "rendered": result.rendered, "skipped": result.skipped})
    return _dxf_payload(settings, asset)


# ---------------------------------------------------------------- DXF geometry mapping (phase 3, T086)

@router.get("/plan-assets/{asset_id}/dxf/entities")
def dxf_entities(asset_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The mapping screen's table: every layer with its drawable count, kinds, a sample and the suggested target, every
    block with its count, footprint and the suggested catalog item; the targets and the catalog choices to pick from."""
    settings = settings_of(request)
    asset = get_asset(conn, asset_id)
    require(conn, principal, "map.import", ("floor", asset["floor_id"]))
    if asset["mime"] != "image/vnd.dxf":
        raise ApiError(409, "not_dxf", "הקובץ אינו DXF.")
    opts = plan_dxf.load_options(_asset_dir(settings, asset_id))
    units = opts.get("units") or (opts.get("info") or {}).get("units")
    catalog = plan_dxf_map.load_catalog(conn)
    try:
        with unlocked(conn):
            summary = plan_dxf_map.entities_summary(settings.data_dir / asset["storage_path"], opts.get("layers"), units, catalog)
    except plan_dxf.DxfError as exc:
        raise ApiError(422, exc.code, "קובץ ה־DXF לא ניתן לקריאה.", details=exc.details)
    return {"asset_id": asset_id, **summary, "targets": [{"id": t, "label": plan_dxf_map.TARGET_LABELS[t]} for t in plan_dxf_map.TARGETS], "catalog_choices": plan_dxf_map.catalog_choices(catalog)}


class DxfImportIn(BaseModel):
    layer_map: dict[str, str] = Field(default={})
    block_map: dict[str, str | None] = Field(default={})
    level_id: str | None = Field(default=None, max_length=64)


@router.post("/plan-versions/{version_id}/import-dxf-geometry")
def import_dxf_geometry(version_id: str, body: DxfImportIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Candidates from the DXF the version was made from, by the chosen layer and block mapping (design 9.4), in the
    shape of /detect: nothing is stored; the editor accepts them through /detect/accept."""
    settings = settings_of(request)
    v = get_version(conn, version_id)
    require(conn, principal, "map.import", ("floor", v["floor_id"]))
    if v["status"] == "archived":
        raise conflict("archived_version", "גרסה מהארכיון אינה ניתנת לעריכה; שחזר אותה קודם.")
    asset = get_asset(conn, v["asset_id"])
    if asset["mime"] != "image/vnd.dxf":
        raise ApiError(409, "not_dxf", "גרסת התוכנית לא נוצרה מקובץ DXF.")
    bad = sorted({t for t in body.layer_map.values() if t not in plan_dxf_map.TARGETS})
    if bad:
        raise ApiError(422, "validation", "יעד מיפוי לא מוכר.", details={"targets": bad})
    opts = plan_dxf.load_options(_asset_dir(settings, asset["id"]))
    units = opts.get("units") or (opts.get("info") or {}).get("units")
    if not plan_dxf.METERS.get(units or ""):
        raise ApiError(422, "dxf_unitless", "בחר יחידות לקובץ ה־DXF (בשלב הייבוא) לפני ייבוא הגאומטריה.")
    doc, _row = geometry_store.working_doc(conn, v)
    level_id = body.level_id or next((lv["id"] for lv in doc["levels"] if lv.get("is_default")), "L0")
    if level_id not in {lv["id"] for lv in doc["levels"]}:
        raise ApiError(422, "unknown_level", "המפלס לא קיים בטיוטת המבנה.")
    src = settings.data_dir / asset["storage_path"]
    catalog = plan_dxf_map.load_catalog(conn)
    try:
        with unlocked(conn):
            extent = plan_dxf_map.extent_for(src, opts.get("layers"))
            result = plan_dxf_map.map_geometry(src, layer_map=body.layer_map, block_map=body.block_map, units=units, extent=extent, rotation=int(v["rotation"]),
                                               crop=json.loads(v["crop_json"]) if v["crop_json"] else None, level_id=level_id, run_id=new_id()[:6], catalog=catalog,
                                               scale_m_per_px=v["scale_m_per_px"])
    except plan_dxf.DxfError as exc:
        raise ApiError(422, exc.code, "קובץ ה־DXF לא ניתן לקריאה או ריק בשכבות שנבחרו.", details=exc.details)
    existing = {c: sum(1 for i in doc.get(c) or [] if isinstance(i, dict) and i.get("source") == "imported") for c in ("walls", "openings")}
    audit(conn, actor=principal, action="geometry.import", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "asset_id": asset["id"], "walls": len(result["walls"]), "openings": len(result["openings"]), "objects": len(result["objects"]),
                   "rooms": len(result["rooms"]), "layers": len(body.layer_map), "blocks": len(body.block_map)})
    return {**result, "version_id": v["id"], "level_id": level_id, "existing_auto": existing}

