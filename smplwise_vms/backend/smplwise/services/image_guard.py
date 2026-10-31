"""One place for Pillow's decompression-bomb threshold and the per-call pixel ceilings (security review 2.4.6, I3 / L1).

`PIL.Image.MAX_IMAGE_PIXELS` is a process-wide value. Before SEC246 three modules wrote it (plan_render at import: 60 M,
wall_photos on every call: 40 M, floor_images on every call: max(current, 72 M)), so the bomb threshold of every other decoder
depended on which request ran last, and threads raced on it. Now it is set ONCE, here, to the value plan_render has always
imposed (60 M: a warning above it, a refusal above twice it), and nothing else writes it. Each upload route keeps its own,
stricter ceiling as an explicit check of the header-declared size BEFORE any pixel is decoded (`check_pixels`): floor images
36 MP, wall photos 40 MP, the background pictures (routers/ui_background.py) their own budget."""
from __future__ import annotations

import io
from collections.abc import Sequence
from typing import Any

from PIL import Image, UnidentifiedImageError

PILLOW_MAX_IMAGE_PIXELS = 60_000_000


def install() -> None:
    """Set the process-wide threshold (idempotent; called at import of this module)."""
    Image.MAX_IMAGE_PIXELS = PILLOW_MAX_IMAGE_PIXELS


def check_pixels(im: Any, max_pixels: int) -> tuple[int, int] | None:
    """(width, height) when the opened (not yet decoded) image is within `max_pixels`, None otherwise. `Image.open` reads the
    header only, so this costs no decode."""
    w, h = im.size
    if w <= 0 or h <= 0 or w * h > max_pixels:
        return None
    return w, h


def open_untrusted(src: Any, formats: Sequence[str]) -> Any:
    """`Image.open` of uploaded / fetched bytes (or a path / file object) with Pillow restricted to `formats` (DEPAUDIT-2310 M1).
    The format the opened image reports is checked too: Pillow's JPEG opener hands back an MPO (a multi-picture file behind a
    plain JPEG header, one of the loaders of the Pillow 12 advisories) even under `formats=["JPEG"]`. Header only, nothing is
    decoded; raises UnidentifiedImageError for any other format."""
    allowed = tuple(formats)
    im = Image.open(io.BytesIO(bytes(src)) if isinstance(src, (bytes, bytearray, memoryview)) else src, formats=allowed)
    if im.format not in allowed:
        fmt = im.format
        im.close()
        raise UnidentifiedImageError(f"image format {fmt} is not one of {allowed}")
    return im


install()
