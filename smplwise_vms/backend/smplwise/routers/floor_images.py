"""Own floor images (K88): upload / replace / delete the two variants of a floor's picture, its alignment on the plan, and
the file itself. Reading needs map.read on the floor (the live map draws it), changing needs map.edit. No platform write,
no network, nothing leaves the data directory."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError, not_found
from ..rbac import Principal, require
from ..services import floor_images as fi
from .catalog import get_floor

router = APIRouter()

_STATUS = {"payload_too_large": 413, "unsupported_format": 415, "too_many_pixels": 413, "too_small": 422, "corrupt_image": 422, "bad_variant": 422, "validation": 422}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _raise(exc: fi.FloorImageError) -> None:
    raise ApiError(_STATUS.get(exc.code, 422), exc.code, exc.message, details=exc.details or None)


class LayoutIn(BaseModel):
    corners: list[list[float]] = Field(min_length=4, max_length=4)
    opacity: float | None = Field(default=None, ge=0.2, le=1.0)


@router.get("/floors/{floor_id}/images")
def floor_images_api(floor_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The floor's own images (off / on) and their alignment."""
    get_floor(conn, floor_id)
    require(conn, principal, "map.read", ("floor", floor_id))
    return fi.describe(conn, floor_id)


@router.get("/floors/{floor_id}/images/{variant}")
def floor_image_file(floor_id: str, variant: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> FileResponse:
    """The image file of one variant (PNG or JPEG as uploaded)."""
    settings = settings_of(request)
    get_floor(conn, floor_id)
    require(conn, principal, "map.read", ("floor", floor_id))
    if variant not in fi.VARIANTS:
        raise not_found("תמונת הקומה לא נמצאה.")
    try:
        found = fi.file_of(settings, conn, floor_id, variant)
    except fi.FloorImageStoreError:
        raise not_found("תמונת הקומה לא נמצאה.")
    if found is None or not found[0].exists():
        raise not_found("תמונת הקומה לא נמצאה.")
    return FileResponse(found[0], media_type=found[1], headers={"Cache-Control": "private, max-age=86400"})


@router.post("/floors/{floor_id}/images", status_code=201)
async def upload_floor_image(floor_id: str, request: Request, variant: str = Form(...), file: UploadFile = File(...),
                             principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Upload or replace one variant ("off" = lights off, "on" = lights on). PNG or JPEG, up to 12 MB and 36 megapixels."""
    settings = settings_of(request)
    get_floor(conn, floor_id)
    require(conn, principal, "map.edit", ("floor", floor_id))
    if variant not in fi.VARIANTS:
        raise ApiError(422, "bad_variant", "סוג התמונה אינו מוכר.", details={"choices": list(fi.VARIANTS)})
    data = await file.read(fi.MAX_BYTES + 1)
    try:
        row, replaced = fi.store(settings, conn, floor_id, variant, data, principal.user_id)
    except fi.FloorImageStoreError:
        raise ApiError(409, "floor_id_unsafe", "מזהה הקומה אינו מתאים לשמירת קבצים; לא נשמר דבר.")
    except fi.FloorImageError as exc:
        _raise(exc)
    audit(conn, actor=principal, action="floor_image.upload", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
          details={"variant": variant, "sha256": row["sha256"], "bytes": row["bytes"], "width": row["width"], "height": row["height"], "replaced": replaced})
    return {**row, "replaced": replaced, "layout": fi.layout_of(conn, floor_id)}


@router.delete("/floors/{floor_id}/images/{variant}", status_code=204)
def delete_floor_image(floor_id: str, variant: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """Remove one variant (the alignment is kept while the other variant exists)."""
    settings = settings_of(request)
    get_floor(conn, floor_id)
    require(conn, principal, "map.edit", ("floor", floor_id))
    if variant not in fi.VARIANTS:
        raise not_found("תמונת הקומה לא נמצאה.")
    if not fi.remove(settings, conn, floor_id, variant):
        raise not_found("תמונת הקומה לא נמצאה.")
    audit(conn, actor=principal, action="floor_image.delete", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request), details={"variant": variant})
    return Response(status_code=204)


@router.put("/floors/{floor_id}/images/layout")
def put_floor_image_layout(floor_id: str, body: LayoutIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Where the image's four corners (top-left, top-right, bottom-right, bottom-left) sit on the plan, in plan-normalised
    coordinates (0..1 inside the plan; a little outside is allowed), and the image opacity."""
    get_floor(conn, floor_id)
    require(conn, principal, "map.edit", ("floor", floor_id))
    if not conn.execute("SELECT 1 FROM floor_images WHERE floor_id = ?", (floor_id,)).fetchone():
        raise ApiError(409, "no_image", "לקומה אין תמונה; העלו תמונה לפני היישור.")
    try:
        layout = fi.save_layout(conn, floor_id, body.corners, body.opacity, principal.user_id)
    except fi.FloorImageError as exc:
        _raise(exc)
    audit(conn, actor=principal, action="floor_image.layout", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
          details={"corners": layout["corners"], "opacity": layout["opacity"]})
    return layout
