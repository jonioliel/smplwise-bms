"""CRY (2026-10-10): the installation's own background pictures behind the glass (הגדרות › כללי › מראה המערכת › רקע).

Two slots, `day` and `night`; each upload is checked by content (PNG / JPEG / WebP), re-encoded as a bounded JPEG (longest side
2560 px) under `<data_dir>/ui_backgrounds/<slot>.jpg`, and stamped into the product setting `ui.background_images`
({ day, night }: a version stamp or null), the cache key the frontend appends to the picture's address (design/background.ts).
Which background the page shows is the setting `ui.background` (builtin | none | custom, routers/settings.py); a user's own
choice is `ui.background` of /me/prefs. Writes need system.configure and are audited as settings.update; reading a picture
needs a signed-in principal only. The files travel with a backup (services/backup.py reads the stamps setting)."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import get_setting, now_iso, set_setting, unlocked
from ..errors import ApiError, not_found
from ..rbac import INSTALLATION, Principal, require

router = APIRouter()

SLOTS = ("day", "night")
STAMPS_KEY = "ui.background_images"
DIR = "ui_backgrounds"
IMAGE_MAX_PX = 2560
IMAGE_MAX_BYTES = 12 * 1024 * 1024


def rel_path(slot: str) -> str:
    """The stored file of a slot, relative to the data directory (the backup's file reference)."""
    return f"{DIR}/{slot}.jpg"


def stored_stamps(raw: Any) -> dict[str, str | None]:
    """`ui.background_images` as an object with both slots (a missing or corrupt value reads as no pictures)."""
    out: dict[str, str | None] = {s: None for s in SLOTS}
    try:
        value = json.loads(raw) if isinstance(raw, str) else raw
    except ValueError:
        return out
    if isinstance(value, dict):
        for s in SLOTS:
            v = value.get(s)
            if isinstance(v, str) and v.strip():
                out[s] = v.strip()
    return out


def _dir(request: Request) -> Path:
    d = settings_of(request).data_dir / DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


def _slot(slot: str) -> str:
    if slot not in SLOTS:
        raise not_found("לא נמצא.")
    return slot


def _store(request: Request, slot: str, file: UploadFile) -> None:
    """Read the upload (PNG / JPEG / WebP by content), re-encode as a bounded JPEG. Runs inside unlocked(): the decode never
    holds the write lock."""
    from io import BytesIO

    from PIL import Image, ImageOps

    data = file.file.read(IMAGE_MAX_BYTES + 1)
    if len(data) > IMAGE_MAX_BYTES:
        raise ApiError(413, "payload_too_large", "התמונה גדולה מ־12 MB.")
    png = data.startswith(b"\x89PNG")
    jpeg = data.startswith(b"\xff\xd8")
    webp = data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if not (png or jpeg or webp):
        raise ApiError(415, "unsupported_format", "התמונה חייבת להיות PNG, JPG או WebP (הזיהוי לפי התוכן).")
    try:
        im = Image.open(BytesIO(data))
        im = ImageOps.exif_transpose(im).convert("RGB")
        if max(im.size) > IMAGE_MAX_PX:
            im.thumbnail((IMAGE_MAX_PX, IMAGE_MAX_PX), Image.Resampling.LANCZOS)
    except Exception as exc:  # noqa: BLE001 - a broken image is the upload's problem
        raise ApiError(422, "corrupt_image", "התמונה לא ניתנת לקריאה.", details={"error": type(exc).__name__})
    target = _dir(request) / f"{slot}.jpg"
    tmp = target.with_name(f"{slot}.jpg.tmp")
    im.save(tmp, format="JPEG", quality=86, optimize=True)
    tmp.replace(target)


def _write_stamps(conn: sqlite3.Connection, stamps: dict[str, str | None]) -> None:
    set_setting(conn, STAMPS_KEY, json.dumps(stamps, separators=(",", ":")))


def _answer(conn: sqlite3.Connection) -> dict[str, Any]:
    return {"images": stored_stamps(get_setting(conn, STAMPS_KEY, "{}"))}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.post("/settings/background/{slot}", status_code=201)
def upload_background(slot: str, request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    slot = _slot(slot)
    require(conn, principal, "system.configure", INSTALLATION)
    with unlocked(conn):
        _store(request, slot, file)
    stamps = stored_stamps(get_setting(conn, STAMPS_KEY, "{}"))
    stamps[slot] = now_iso()
    _write_stamps(conn, stamps)
    audit(conn, actor=principal, action="settings.update", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={STAMPS_KEY: {slot: True}})
    return _answer(conn)


@router.delete("/settings/background/{slot}")
def delete_background(slot: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    slot = _slot(slot)
    require(conn, principal, "system.configure", INSTALLATION)
    (_dir(request) / f"{slot}.jpg").unlink(missing_ok=True)
    stamps = stored_stamps(get_setting(conn, STAMPS_KEY, "{}"))
    stamps[slot] = None
    _write_stamps(conn, stamps)
    audit(conn, actor=principal, action="settings.update", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={STAMPS_KEY: {slot: False}})
    return _answer(conn)


@router.get("/settings/background/{slot}")
def read_background(slot: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> FileResponse:
    slot = _slot(slot)
    if not stored_stamps(get_setting(conn, STAMPS_KEY, "{}"))[slot]:
        raise not_found("אין תמונה.")
    p = _dir(request) / f"{slot}.jpg"
    if not p.is_file():
        raise not_found("אין תמונה.")
    return FileResponse(p, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})
