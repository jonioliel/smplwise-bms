"""Wall photo sets (CR-030 v2 section 6, WDX): the product's own folder `<data>/wall-photos/<set>/`, written only by the
administrator's upload. No external URL, no camera material, no media-library path: a set is a plain id, a photo is a random
hex id, every path is confined under the root. The upload is re-encoded to a 1920-px-wide JPEG rendition (this strips EXIF and
any embedded data); the original bytes are not kept. The display reads a list and renditions through the session, never a path."""
from __future__ import annotations

import io
import json
import re
import secrets
import shutil
from pathlib import Path
from typing import Any

from ..config import Settings

SET_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,39}$")
PHOTO_RE = re.compile(r"^[0-9a-f]{16}$")
MAX_FILES = 200
MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 40_000_000
MAX_WIDTH = 1920
MAX_SETS = 20
FORMATS = {"JPEG", "PNG", "WEBP"}


class PhotoError(ValueError):
    def __init__(self, code: str, message: str, status: int = 422, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.code, self.message, self.status, self.details = code, message, status, details or {}


def root(settings: Settings) -> Path:
    return Path(settings.data_dir) / "wall-photos"


def _set_dir(settings: Settings, set_id: str) -> Path:
    if not isinstance(set_id, str) or not SET_RE.fullmatch(set_id):
        raise PhotoError("frame_source_not_allowed", "תיקיית תמונות לא חוקית.", 403)
    base = root(settings).resolve()
    d = (base / set_id).resolve()
    if d.parent != base:
        raise PhotoError("frame_source_not_allowed", "תיקיית תמונות לא חוקית.", 403)
    return d


def set_exists(settings: Settings, set_id: str) -> bool:
    try:
        return _set_dir(settings, set_id).is_dir()
    except PhotoError:
        return False


def _meta(d: Path) -> dict[str, Any]:
    try:
        return json.loads((d / "_set.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _photos(d: Path) -> list[dict[str, Any]]:
    meta = _meta(d).get("photos", {})
    out = []
    for p in sorted(d.glob("*.jpg")):
        if PHOTO_RE.fullmatch(p.stem):
            m = meta.get(p.stem, {})
            out.append({"id": p.stem, "w": int(m.get("w", 0)), "h": int(m.get("h", 0)), "bytes": p.stat().st_size})
    return out


def list_sets(settings: Settings) -> list[dict[str, Any]]:
    base = root(settings)
    if not base.is_dir():
        return []
    out = []
    for d in sorted(base.iterdir()):
        if d.is_dir() and SET_RE.fullmatch(d.name):
            photos = _photos(d)
            out.append({"id": d.name, "name": _meta(d).get("name") or d.name, "count": len(photos), "bytes": sum(p["bytes"] for p in photos)})
    return out


def create_set(settings: Settings, name: str) -> dict[str, Any]:
    name = " ".join(name.split())[:40]
    if not name:
        raise PhotoError("validation", "שם התיקייה חסר.")
    if len(list_sets(settings)) >= MAX_SETS:
        raise PhotoError("photo_set_limit", "הגעת למספר התיקיות המרבי.", 409, {"max": MAX_SETS})
    set_id = secrets.token_hex(4)
    d = _set_dir(settings, "s" + set_id)
    d.mkdir(parents=True, exist_ok=False)
    (d / "_set.json").write_text(json.dumps({"name": name, "photos": {}}, ensure_ascii=False), encoding="utf-8")
    return {"id": d.name, "name": name, "count": 0, "bytes": 0}


def delete_set(settings: Settings, set_id: str) -> bool:
    d = _set_dir(settings, set_id)
    if not d.is_dir():
        return False
    shutil.rmtree(d)
    return True


def add_photo(settings: Settings, set_id: str, data: bytes) -> dict[str, Any]:
    from PIL import Image, ImageOps, UnidentifiedImageError

    d = _set_dir(settings, set_id)
    if not d.is_dir():
        raise PhotoError("photo_set_not_found", "תיקיית התמונות לא נמצאה.", 404)
    if len(data) > MAX_BYTES:
        raise PhotoError("payload_too_large", "התמונה גדולה מדי (עד 8MB).", 413)
    if len(_photos(d)) >= MAX_FILES:
        raise PhotoError("photo_set_full", "התיקייה מלאה (עד 200 תמונות).", 409, {"max": MAX_FILES})
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.format not in FORMATS:
                raise PhotoError("unsupported_format", "רק JPEG, PNG או WebP.", 415)
            if probe.width * probe.height > MAX_PIXELS:
                raise PhotoError("too_many_pixels", "התמונה גדולה מדי.", 413)
            img = ImageOps.exif_transpose(probe)
            img = img.convert("RGB")
    except PhotoError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise PhotoError("corrupt_image", "הקובץ אינו תמונה תקינה.") from exc
    if img.width > MAX_WIDTH:
        img = img.resize((MAX_WIDTH, max(1, round(img.height * MAX_WIDTH / img.width))))
    photo_id = secrets.token_hex(8)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85, optimize=True)  # a fresh encode: no EXIF, no ICC, no embedded thumbnails
    (d / f"{photo_id}.jpg").write_bytes(buf.getvalue())
    meta = _meta(d) or {"name": set_id, "photos": {}}
    meta.setdefault("photos", {})[photo_id] = {"w": img.width, "h": img.height}
    (d / "_set.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    return {"id": photo_id, "w": img.width, "h": img.height, "bytes": len(buf.getvalue())}


def delete_photo(settings: Settings, set_id: str, photo_id: str) -> bool:
    d = _set_dir(settings, set_id)
    if not PHOTO_RE.fullmatch(photo_id):
        return False
    p = d / f"{photo_id}.jpg"
    if not p.is_file():
        return False
    p.unlink()
    meta = _meta(d)
    meta.get("photos", {}).pop(photo_id, None)
    (d / "_set.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    return True


def list_photos(settings: Settings, set_id: str) -> list[dict[str, Any]]:
    d = _set_dir(settings, set_id)
    return [{"id": p["id"], "w": p["w"], "h": p["h"]} for p in _photos(d)] if d.is_dir() else []


def photo_path(settings: Settings, set_id: str, photo_id: str) -> Path | None:
    d = _set_dir(settings, set_id)
    if not PHOTO_RE.fullmatch(photo_id):
        return None
    p = d / f"{photo_id}.jpg"
    return p if p.is_file() else None
