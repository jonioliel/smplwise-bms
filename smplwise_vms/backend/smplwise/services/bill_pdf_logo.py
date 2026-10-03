"""Logo handling for the bill PDF (CR-023 P3): decode, validate and re-encode a business logo.

The uploaded bytes are never handed to the PDF engine. They are decoded with Pillow (PNG or JPEG only, chosen by
magic bytes, not by file name or declared type), bounded in size and pixels, scaled down, stripped of all metadata
and re-encoded as a fresh PNG. SVG and anything else is refused.
"""
from __future__ import annotations

import io

from PIL import Image, ImageOps

MAX_LOGO_BYTES = 1_000_000  # the upload limit of the business settings
MAX_LOGO_PIXELS = 25_000_000  # decoded size guard (decompression bombs)
MAX_LOGO_SIDE = 800

_PNG = b"\x89PNG\r\n\x1a\n"
_JPEG = b"\xff\xd8\xff"


class LogoError(ValueError):
    """The logo was refused; the message is a stable machine code."""


def sanitize_logo(data: bytes) -> bytes:
    """Return a clean PNG (at most 800 px on the long side) or raise LogoError."""
    if not isinstance(data, (bytes, bytearray)) or not data:
        raise LogoError("logo_empty")
    if len(data) > MAX_LOGO_BYTES:
        raise LogoError("logo_too_large")
    head = bytes(data[:8])
    if not (head.startswith(_PNG) or head.startswith(_JPEG)):
        raise LogoError("logo_type")  # SVG, GIF, WebP, PDF ... are refused
    try:
        with Image.open(io.BytesIO(bytes(data)), formats=("PNG", "JPEG")) as img:
            if img.width * img.height > MAX_LOGO_PIXELS or img.width < 1 or img.height < 1:
                raise LogoError("logo_dimensions")
            img.load()
            if img.format == "JPEG":
                img = ImageOps.exif_transpose(img)
            if img.mode not in ("RGB", "RGBA"):
                alpha = "transparency" in img.info or img.mode in ("LA", "PA", "P")
                img = img.convert("RGBA" if alpha else "RGB")
            img.thumbnail((MAX_LOGO_SIDE, MAX_LOGO_SIDE))
            clean = Image.new(img.mode, img.size)
            clean.putdata(list(img.getdata()))  # drops every ancillary chunk and EXIF block
            out = io.BytesIO()
            clean.save(out, format="PNG", optimize=True)
    except LogoError:
        raise
    except Exception as exc:  # corrupt data, truncated files, decompression-bomb errors
        raise LogoError("logo_undecodable") from exc
    return out.getvalue()
