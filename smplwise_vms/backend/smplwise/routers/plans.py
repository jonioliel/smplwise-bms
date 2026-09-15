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
from ..services import plan_render, plan_stylize
from .catalog import get_floor

router = APIRouter()


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def asset_row(r: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": r["id"], "floor_id": r["floor_id"], "original_name": r["original_name"], "mime": r["mime"], "sha256": r["sha256"],
        "bytes": r["bytes"], "page_count": r["page_count"], "created_at": r["created_at"],
        "pages": [{"page": p, "preview_url": f"api/v1/plan-assets/{r['id']}/pages/{p}/preview.png"} for p in range(1, r["page_count"] + 1)],
    }


def version_row(r: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": r["id"], "floor_id": r["floor_id"], "asset_id": r["asset_id"], "page": r["page"], "rotation": r["rotation"],
        "crop": json.loads(r["crop_json"]) if r["crop_json"] else None, "width_px": r["width_px"], "height_px": r["height_px"],
        "scale_m_per_px": r["scale_m_per_px"], "status": r["status"], "revision": r["revision"], "notes": r["notes"],
        "created_at": r["created_at"], "published_at": r["published_at"],
        # the map background follows render_mode; the source picture stays reachable for comparisons
        "image_url": f"api/v1/plan-versions/{r['id']}/{'stylized' if _stylized(r) else 'image'}.png",
        "source_url": f"api/v1/plan-versions/{r['id']}/source.png",
        "render_mode": "stylized" if _stylized(r) else "source",
        "stylized_url": f"api/v1/plan-versions/{r['id']}/stylized.png" if _has_stylized(r) else None,
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
            page_count = plan_render.pdf_page_count(dest)
            if page_count < 1 or page_count > settings.max_pdf_pages:
                raise ApiError(422, "too_many_pages", f"ה־PDF חייב להכיל 1–{settings.max_pdf_pages} עמודים.", details={"pages": page_count})
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
def page_preview(asset_id: str, page: int, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> FileResponse:
    settings = settings_of(request)
    asset = get_asset(conn, asset_id)
    require(conn, principal, "map.import", ("floor", asset["floor_id"]))
    if page < 1 or page > asset["page_count"]:
        raise not_found("העמוד לא קיים.")
    png = _page_png(settings, asset, page, settings.preview_px)
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
    version_id = new_id()
    out = _asset_dir(settings, asset["id"]) / f"version-{version_id}.png"
    crop = plan_render.Crop(**body.crop.model_dump()) if body.crop else None
    w, h = plan_render.derive_version_image(page_png, out, body.rotation, crop, settings.max_render_px)
    conn.execute(
        """INSERT INTO plan_versions(id, floor_id, asset_id, page, rotation, crop_json, width_px, height_px, image_path, scale_m_per_px, status, revision, notes, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?)""",
        (version_id, floor_id, asset["id"], body.page, body.rotation, json.dumps(body.crop.model_dump()) if body.crop else None, w, h,
         str(out.relative_to(settings.data_dir).as_posix()), body.scale_m_per_px, body.notes, principal.user_id, now_iso()),
    )
    audit(conn, actor=principal, action="plan.version.create", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
          details={"version_id": version_id, "asset_id": asset["id"], "page": body.page, "rotation": body.rotation, "crop": body.crop.model_dump() if body.crop else None})
    return version_row(get_version(conn, version_id))


@router.get("/floors/{floor_id}/plan-versions")
def list_versions(floor_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_floor(conn, floor_id)
    require(conn, principal, "map.edit", ("floor", floor_id))
    rows = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? ORDER BY created_at DESC", (floor_id,)).fetchall()
    return {"versions": [version_row(r) for r in rows]}


@router.get("/plan-versions/{version_id}/image.png")
def version_image(version_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> FileResponse:
    settings = settings_of(request)
    v = get_version(conn, version_id)
    # Viewers read only the published version; editors may also see drafts (ch. 9 / T019).
    if v["status"] == "published":
        require(conn, principal, "map.read", ("floor", v["floor_id"]))
    else:
        require(conn, principal, "map.edit", ("floor", v["floor_id"]))
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
    previous = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'published'", (v["floor_id"],)).fetchone()
    same_geometry = bool(previous) and previous["asset_id"] == v["asset_id"] and previous["page"] == v["page"] and previous["rotation"] == v["rotation"] and (previous["crop_json"] or None) == (v["crop_json"] or None)
    if previous:
        conn.execute("UPDATE plan_versions SET status = 'archived', archived_at = ? WHERE id = ?", (now, previous["id"]))
    conn.execute("UPDATE plan_versions SET status = 'published', published_by = ?, published_at = ? WHERE id = ?", (principal.user_id, now, version_id))
    # Anchors never migrate to an invented location: they follow only when the geometry is identical;
    # otherwise they keep their old version id and the map reports needs_alignment (T038 completes this).
    carried = 0
    if same_geometry:
        carried = conn.execute("UPDATE map_anchors SET plan_version_id = ?, updated_at = ? WHERE floor_id = ? AND effective_to IS NULL AND plan_version_id = ?",
                               (version_id, now, v["floor_id"], previous["id"])).rowcount
    audit(conn, actor=principal, action="plan.version.publish", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": version_id, "previous_version_id": previous["id"] if previous else None, "anchors_carried": carried, "same_geometry": same_geometry})
    return version_row(get_version(conn, version_id))


@router.delete("/plan-versions/{version_id}", status_code=204)
def delete_version(version_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    settings = settings_of(request)
    v = get_version(conn, version_id)
    require(conn, principal, "map.edit", ("floor", v["floor_id"]))
    if v["status"] != "draft":
        raise conflict("not_draft", "רק טיוטה ניתנת למחיקה; גרסה שפורסמה נשמרת להיסטוריה.", status=v["status"])
    if conn.execute("SELECT COUNT(*) FROM map_anchors WHERE plan_version_id = ?", (version_id,)).fetchone()[0]:
        raise conflict("has_anchors", "על הטיוטה מוצבים פריטים.")
    conn.execute("DELETE FROM plan_versions WHERE id = ?", (version_id,))
    (settings.data_dir / v["image_path"]).unlink(missing_ok=True)
    audit(conn, actor=principal, action="plan.version.delete", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request), details={"version_id": version_id})


# ---------------------------------------------------------------- stylized rendering (design M11, local variant)

class StylizeIn(BaseModel):
    strength: str = Field(default="medium", pattern="^(light|medium|strong)$")
    keep_lines: bool = False


class RenderModeIn(BaseModel):
    render_mode: str = Field(pattern="^(source|stylized)$")


def _readable(conn: sqlite3.Connection, principal: Principal, v: sqlite3.Row) -> None:
    if v["status"] == "published":
        require(conn, principal, "map.read", ("floor", v["floor_id"]))
    else:
        require(conn, principal, "map.edit", ("floor", v["floor_id"]))


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
            result = plan_stylize.stylize(src, out, body.strength, body.keep_lines)
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
