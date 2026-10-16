"""VPORTAL (owner-approved 2026-10-16): the organisation's branding on the public pages - the vendor portal, the handler page and the
vendor quote page. The organisation NAME is the existing setting `tickets.settings.organization_name`; this module adds the optional
LOGO, set in Settings by a `system.configure` holder (routers/tickets_admin.py) and served by the public listener as a separate image
file (`/<prefix>/brand/<stamp>.jpg`, public_portal.py) - never inlined in a page bundle. Without a logo the pages show the name only.

Safe image handling (the public surface's hostile-image pipeline, image_intake.reencode): the upload is judged by its CONTENT, JPEG or
PNG only - SVG (scripts), WebP, HEIC, GIF, anything else is refused (415); at most LOGO_MAX_BYTES and LOGO_MAX_PIXELS judged on the
header before any decode; the decoder gets a metadata-free copy; the result is a FRESH JPEG (no EXIF / ICC / comments / appended
bytes; transparency flattened on white) of at most LOGO_SIDE px on its longest side. The stored file is served with a fixed
`image/jpeg` type and `nosniff` (the edge adds the public headers).

Where it lives: `<data>/tickets/_brand/logo.jpg` (the leading underscore keeps the ticket folder sweep away - deletion._ID never
matches it). Its stamp - the first 16 hex characters of the file's SHA-256 - is the setting `tickets.settings.brand.logo` (inside the
tickets settings document, so like the organisation name it never travels in a project backup); the public file name carries the
stamp, so a new logo is a new URL (cached `immutable`) and an old URL answers the uniform 404."""
from __future__ import annotations

import hashlib
import io
import re
from pathlib import Path
from typing import Any

from . import image_intake, settings_doc

LOGO_MAX_BYTES = 512 * 1024
LOGO_MAX_PIXELS = 4_000_000
LOGO_SIDE = 512
LOGO_QUALITY = 88
DIR = "_brand"
FILE = "logo.jpg"
STAMP_RE = re.compile(r"[0-9a-f]{16}")
NAME_RE = re.compile(r"([0-9a-f]{16})\.jpg")


class LogoRefused(ValueError):
    """An upload that is not a usable logo: `code` (fixed vocabulary), the HTTP `status`."""

    def __init__(self, code: str, status: int, **details: int) -> None:
        super().__init__(code)
        self.code = code
        self.status = status
        self.details = details


def logo_path(data_dir: Path) -> Path:
    return Path(data_dir) / "tickets" / DIR / FILE


def stamp(conn) -> str | None:
    """The current logo's stamp, or None (no logo)."""
    try:
        value = (settings_doc.read(conn).get("brand") or {}).get("logo") or ""
    except Exception:  # noqa: BLE001 - an unreadable document reads as "no logo"
        return None
    return value if STAMP_RE.fullmatch(value) else None


def logo_name(conn) -> str | None:
    """The public file name of the logo (`<stamp>.jpg`), or None. The pages fetch `<prefix>/brand/<name>`."""
    s = stamp(conn)
    return f"{s}.jpg" if s else None


def prepare(data: bytes) -> bytes:
    """The stored JPEG of an uploaded logo, or LogoRefused. Blocking (Pillow): run it in a worker thread / outside the write lock."""
    if not isinstance(data, (bytes, bytearray)) or not data:
        raise LogoRefused("unsupported_format", 415)
    if len(data) > LOGO_MAX_BYTES:
        raise LogoRefused("too_large", 413, max_bytes=LOGO_MAX_BYTES)
    try:
        clean = image_intake.reencode(bytes(data), max_pixels=LOGO_MAX_PIXELS)
    except image_intake.IntakeError as exc:
        raise LogoRefused(exc.code, exc.status, **{k: v for k, v in exc.details.items() if isinstance(v, int)}) from None
    if max(clean.width, clean.height) <= LOGO_SIDE:
        return clean.data
    from PIL import Image

    # our own fresh JPEG (no metadata, bounded size): shrink it to the logo size
    with Image.open(io.BytesIO(clean.data), formats=["JPEG"]) as im:
        im.load()
        small = im.convert("RGB")
        small.thumbnail((LOGO_SIDE, LOGO_SIDE), Image.Resampling.LANCZOS)
        out = Image.new("RGB", small.size)
        out.paste(small)
        buf = io.BytesIO()
        out.save(buf, "JPEG", quality=LOGO_QUALITY, optimize=True)
    return buf.getvalue()


def stamp_of(jpeg: bytes) -> str:
    return hashlib.sha256(jpeg).hexdigest()[:16]


def write(data_dir: Path, jpeg: bytes) -> str:
    """Publish a prepared logo atomically; returns its stamp (the caller stores it in the settings document)."""
    target = logo_path(data_dir)
    target.parent.mkdir(parents=True, exist_ok=True)
    image_intake.write_atomic(target, jpeg)
    return stamp_of(jpeg)


def remove(data_dir: Path) -> None:
    try:
        logo_path(data_dir).unlink()
    except FileNotFoundError:
        pass


def resolve(data_dir: Path | None, name: str, current: str | None) -> Path | None:
    """The file to serve for a public `<stamp>.jpg` request: only the CURRENT stamp, only when the file on disk still has it."""
    m = NAME_RE.fullmatch(name or "")
    if data_dir is None or m is None or current is None or m.group(1) != current:
        return None
    p = logo_path(data_dir)
    try:
        if not p.is_file() or p.is_symlink():
            return None
        if stamp_of(p.read_bytes()) != current:
            return None
    except OSError:
        return None
    return p


def public_brand(conn) -> dict[str, Any]:
    """What a public page may show of the organisation: the name and the logo's file name (or None)."""
    doc = settings_doc.read(conn)
    return {"organization": doc["organization_name"], "logo": logo_name(conn)}
