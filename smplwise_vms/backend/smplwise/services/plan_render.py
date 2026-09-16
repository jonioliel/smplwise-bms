"""Plan file handling (MASTER_SPEC ch. 11): content sniffing, size/page limits, PDF rasterization in an
isolated process (pdftoppm with a timeout; PyMuPDF in-process only as a developer fallback), image
normalization with Pillow, rotation + crop applied to a derived copy. The original file is never modified."""
from __future__ import annotations

import hashlib
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps

from ..errors import ApiError

Image.MAX_IMAGE_PIXELS = 60_000_000

SUPPORTED = {"application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "image/vnd.dxf": ".dxf"}


def sniff_mime(head: bytes) -> str | None:
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if b"<svg" in head[:512].lower():
        return "image/svg+xml"
    from . import plan_dxf

    if plan_dxf.sniff(head):
        return "image/vnd.dxf"
    return None


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


@dataclass(frozen=True)
class Crop:
    x: float
    y: float
    w: float
    h: float

    def validate(self) -> "Crop":
        if not (0 <= self.x < 1 and 0 <= self.y < 1 and 0 < self.w <= 1 and 0 < self.h <= 1 and self.x + self.w <= 1.0001 and self.y + self.h <= 1.0001):
            raise ApiError(422, "validation", "חיתוך לא תקין: הערכים חייבים להיות בתחום 0–1 ובתוך התמונה.")
        return self


def _pdftoppm() -> str | None:
    return shutil.which("pdftoppm")


def pdf_page_count(path: Path) -> int:
    info = shutil.which("pdfinfo")
    if info:
        out = subprocess.run([info, str(path)], capture_output=True, text=True, timeout=20, check=False).stdout
        for line in out.splitlines():
            if line.startswith("Pages:"):
                return int(line.split(":", 1)[1].strip())
    try:
        import pymupdf  # type: ignore

        with pymupdf.open(path) as doc:
            return doc.page_count
    except ImportError as exc:  # pragma: no cover - environment without either renderer
        raise ApiError(503, "renderer_unavailable", "אין מנוע לרינדור PDF בשרת (pdftoppm או PyMuPDF).") from exc


def render_pdf_page(path: Path, page: int, out_png: Path, max_px: int, timeout_s: int) -> None:
    """Rasterize one page so that its longest edge is `max_px`. Subprocess first (isolated, bounded)."""
    out_png.parent.mkdir(parents=True, exist_ok=True)
    tool = _pdftoppm()
    if tool:
        prefix = out_png.with_suffix("")
        cmd = [tool, "-f", str(page), "-l", str(page), "-png", "-scale-to", str(max_px), "-singlefile", str(path), str(prefix)]
        try:
            subprocess.run(cmd, capture_output=True, timeout=timeout_s, check=True)
        except subprocess.TimeoutExpired as exc:
            raise ApiError(504, "render_timeout", "רינדור ה־PDF עבר את מגבלת הזמן.", retryable=True) from exc
        except subprocess.CalledProcessError as exc:
            raise ApiError(422, "render_failed", "לא ניתן לרנדר את עמוד ה־PDF.", details={"tool": "pdftoppm"}) from exc
        produced = prefix.with_suffix(".png")
        if produced != out_png:
            produced.replace(out_png)
        return
    try:
        import pymupdf  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise ApiError(503, "renderer_unavailable", "אין מנוע לרינדור PDF בשרת (pdftoppm או PyMuPDF).") from exc
    with pymupdf.open(path) as doc:
        if page < 1 or page > doc.page_count:
            raise ApiError(422, "validation", "מספר עמוד מחוץ לטווח.")
        pg = doc[page - 1]
        longest = max(pg.rect.width, pg.rect.height) or 1
        zoom = max_px / longest
        pix = pg.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        pix.save(str(out_png))


def normalize_image(path: Path, out_png: Path, max_px: int) -> None:
    """Re-encode an uploaded raster as PNG: EXIF orientation applied, RGB, bounded size."""
    out_png.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGB")
        if max(im.size) > max_px:
            im.thumbnail((max_px, max_px), Image.Resampling.LANCZOS)
        im.save(out_png, format="PNG", optimize=True)


def derive_version_image(page_png: Path, out_png: Path, rotation: int, crop: Crop | None, max_px: int) -> tuple[int, int]:
    """Apply rotation (0/90/180/270, clockwise on screen) then a normalized crop; return (w, h)."""
    if rotation not in (0, 90, 180, 270):
        raise ApiError(422, "validation", "סיבוב חייב להיות 0, 90, 180 או 270.")
    out_png.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(page_png) as im:
        im = im.convert("RGB")
        if rotation:
            transpose = {90: Image.Transpose.ROTATE_270, 180: Image.Transpose.ROTATE_180, 270: Image.Transpose.ROTATE_90}[rotation]
            im = im.transpose(transpose)
        if crop:
            crop = crop.validate()
            w, h = im.size
            box = (round(crop.x * w), round(crop.y * h), round(min(1.0, crop.x + crop.w) * w), round(min(1.0, crop.y + crop.h) * h))
            if box[2] - box[0] < 16 or box[3] - box[1] < 16:
                raise ApiError(422, "validation", "החיתוך קטן מדי.")
            im = im.crop(box)
        if max(im.size) > max_px:
            im.thumbnail((max_px, max_px), Image.Resampling.LANCZOS)
        im.save(out_png, format="PNG", optimize=True)
        return im.size
