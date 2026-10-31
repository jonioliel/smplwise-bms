"""CRY (2026-10-10): the installation's own background pictures behind the glass (הגדרות › כללי › מראה המערכת › רקע).

Two slots, `day` and `night`; each upload is checked by content (PNG / JPEG / WebP), re-encoded as a bounded JPEG (longest side
2560 px) under `<data_dir>/ui_backgrounds/<slot>.jpg`, and stamped into the product setting `ui.background_images`
({ day, night }: a version stamp or null), the cache key the frontend appends to the picture's address (design/background.ts).
Which background the page shows is the setting `ui.background` (builtin | none | custom, routers/settings.py); a user's own
choice is `ui.background` of /me/prefs. Writes need system.configure and are audited as settings.update; reading a picture
needs a signed-in principal only. The files travel with a backup (services/backup.py reads the stamps setting)."""
from __future__ import annotations

import contextlib
import json
import os
import sqlite3
import tempfile
import threading
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
IMAGE_MAX_BYTES = 12 * 1024 * 1024  # body_limit.LIMITS "ui_background" allows this + the multipart framing (SEC246 I1)
# SEC246 L1: the pixel budget, judged on the header-declared size before any decode. A JPEG is decoded at a reduced scale
# (draft: at most a quarter of its pixels for anything above 2 x IMAGE_MAX_PX), so a 48-64 MP phone photo stays affordable;
# PNG / WebP have no reduced decode and get the wall-photo ceiling.
JPEG_MAX_PIXELS = 64_000_000
OTHER_MAX_PIXELS = 40_000_000
DECODE_CONCURRENCY = 1
DECODE_WAIT_S = 5.0
_DECODE = threading.BoundedSemaphore(DECODE_CONCURRENCY)


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


def _too_many_pixels(w: int, h: int, limit: int) -> ApiError:
    return ApiError(422, "too_many_pixels", "התמונה גדולה מדי (רזולוציה).", details={"width": w, "height": h, "max_pixels": limit})


def reencode(data: bytes) -> bytes:
    """The content guarantee of a background picture (SEC246 L1): PNG / JPEG / WebP by content, the header-declared width x
    height checked against the pixel budget BEFORE any pixel is decoded, a JPEG decoded at a reduced scale (draft), the result
    re-encoded as a fresh JPEG of at most IMAGE_MAX_PX on its longest side (no EXIF, ICC, comments or appended bytes).
    ApiError 413 / 415 / 422 otherwise. Used by the upload and by a backup restore (I2)."""
    from io import BytesIO

    from PIL import Image, ImageOps

    from ..services import image_guard

    if len(data) > IMAGE_MAX_BYTES:
        raise ApiError(413, "payload_too_large", "התמונה גדולה מ־12 MB.", details={"max_bytes": IMAGE_MAX_BYTES})
    png = data.startswith(b"\x89PNG")
    jpeg = data.startswith(b"\xff\xd8")
    webp = data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if not (png or jpeg or webp):
        raise ApiError(415, "unsupported_format", "התמונה חייבת להיות PNG, JPG או WebP (הזיהוי לפי התוכן).")
    limit = JPEG_MAX_PIXELS if jpeg else OTHER_MAX_PIXELS
    try:
        im = image_guard.open_untrusted(data, ["PNG", "JPEG", "WEBP"])  # header only
        if image_guard.check_pixels(im, limit) is None:
            raise _too_many_pixels(im.size[0], im.size[1], limit)
        if im.format == "JPEG":
            im.draft("RGB", (IMAGE_MAX_PX, IMAGE_MAX_PX))  # the decoder itself downsamples (1/2 .. 1/8): never the full grid
        im = ImageOps.exif_transpose(im).convert("RGB")
        if max(im.size) > IMAGE_MAX_PX:
            im.thumbnail((IMAGE_MAX_PX, IMAGE_MAX_PX), Image.Resampling.LANCZOS)
        out = BytesIO()
        im.save(out, format="JPEG", quality=86, optimize=True)
    except ApiError:
        raise
    except Image.DecompressionBombError as exc:
        raise ApiError(422, "too_many_pixels", "התמונה גדולה מדי (רזולוציה).", details={"error": type(exc).__name__, "max_pixels": limit})
    except Exception as exc:  # noqa: BLE001 - a broken image is the upload's problem
        raise ApiError(422, "corrupt_image", "התמונה לא ניתנת לקריאה.", details={"error": type(exc).__name__})
    return out.getvalue()


def write_atomic(target: Path, data: bytes) -> None:
    """SEC246 I4: a unique temporary file in the same folder, then an atomic replace - two writers of one slot never share a
    temporary name, so a reader sees either the old picture or one complete new one."""
    fd, tmp = tempfile.mkstemp(dir=str(target.parent), prefix=f".{target.stem}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        os.replace(tmp, target)
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(tmp)
        raise


@contextlib.contextmanager
def _decode_slot():
    """SEC246 L1: at most DECODE_CONCURRENCY decodes at a time in this process; a request waits up to DECODE_WAIT_S for a
    slot, then gets 429 (parallel uploads queue instead of multiplying the decode memory)."""
    if not _DECODE.acquire(timeout=DECODE_WAIT_S):
        raise ApiError(429, "busy", "העלאת תמונה אחרת מתבצעת כעת. נסו שוב בעוד רגע.", retryable=True, details={"retry_after_s": 5})
    try:
        yield
    finally:
        _DECODE.release()


def _store(request: Request, slot: str, file: UploadFile) -> None:
    """Read the upload, re-encode it (reencode) and publish it atomically. Runs inside unlocked(): the decode never holds the
    write lock."""
    data = file.file.read(IMAGE_MAX_BYTES + 1)
    if len(data) > IMAGE_MAX_BYTES:
        raise ApiError(413, "payload_too_large", "התמונה גדולה מ־12 MB.", details={"max_bytes": IMAGE_MAX_BYTES})
    with _decode_slot():
        out = reencode(data)
    write_atomic(_dir(request) / f"{slot}.jpg", out)


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
    # SEC246 I2: a fixed type and nosniff (a restored file is re-encoded too, services/backup.restore)
    return FileResponse(p, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"})
