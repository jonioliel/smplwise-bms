"""CR-038 section 10.6: the ONE image validator and store of the module - the internal upload route (slice 1) and the public
handler page (slice 4) both call `store()`.

Order (review R1 / T7 / C2 / T8): the installation's storage cap (a cached directory size, refreshed at most every 60 s; checked
BEFORE any decode) -> magic bytes (JPEG and PNG only; WebP refused on purpose - a large decoder surface phones do not need; HEIC
refused with a clear message) -> the header-declared size against 16 MP (image_guard.check_pixels, no decode) -> JPEG `draft` (the
decoder downsamples) -> the decode under this module's OWN one-slot semaphore (5 s wait, then 429 `busy`; never the background
upload's slot, so anonymous uploads can never starve an administrator's) -> EXIF orientation applied -> RGB -> at most 2048 px on the
long side -> a FRESH JPEG q82 (no EXIF / GPS, ICC, XMP, thumbnails or trailing bytes survive) -> a random file name -> an atomic
write -> SHA-256 recorded. The whole decode is wrapped: any decoder failure is 422 `image_invalid`. The original bytes are never
stored or served. Files live on the data volume: `<data>/tickets/<ticket id>/<16 hex>.jpg` (relative path in the row)."""
from __future__ import annotations

import contextlib
import hashlib
import os
import re
import secrets
import tempfile
import threading
import time
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 16_000_000
LONG_SIDE = 2048
QUALITY = 82
PER_TICKET_MAX = 60
STORAGE_CAP = 2 * 1024 * 1024 * 1024
DECODE_WAIT_S = 5.0
SIZE_TTL_S = 60.0
DIR = "tickets"
_DECODE = threading.BoundedSemaphore(1)
_SIZE: dict[str, tuple[float, int]] = {}
_SIZE_LOCK = threading.Lock()
_REL = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}/[0-9a-f]{16}\.jpg$")
_HEIF_BRANDS = {b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"mif1", b"msf1", b"heif", b"avif", b"avis"}


class Refused(Exception):
    """An upload the validator refuses: the route answers `status` with `code` and the Hebrew message."""

    def __init__(self, status: int, code: str, message: str, **details: object):
        super().__init__(code)
        self.status = status
        self.code = code
        self.message = message
        self.details = details


@dataclass(frozen=True)
class Stored:
    rel_path: str
    sha256: str
    bytes: int
    width: int
    height: int


def root(data_dir: Path) -> Path:
    return data_dir / DIR


def used_bytes(data_dir: Path) -> int:
    """The size of the attachment directory, cached SIZE_TTL_S (a walk per upload would be its own DoS lever)."""
    base = root(data_dir)
    key = str(base)
    now = time.monotonic()
    with _SIZE_LOCK:
        hit = _SIZE.get(key)
        if hit and now - hit[0] < SIZE_TTL_S:
            return hit[1]
    total = 0
    if base.is_dir():
        for dirpath, _dirs, files in os.walk(base):
            for f in files:
                with contextlib.suppress(OSError):
                    total += os.stat(os.path.join(dirpath, f)).st_size
    with _SIZE_LOCK:
        _SIZE[key] = (now, total)
    return total


def _account(data_dir: Path, delta: int) -> None:
    key = str(root(data_dir))
    with _SIZE_LOCK:
        hit = _SIZE.get(key)
        if hit:
            _SIZE[key] = (hit[0], max(0, hit[1] + delta))


def forget_size_cache() -> None:
    with _SIZE_LOCK:
        _SIZE.clear()


def sniff(data: bytes) -> str:
    """'jpeg' | 'png' by content (the declared type and the file name are ignored); Refused otherwise."""
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        raise Refused(415, "webp_refused", "תמונות WebP אינן נתמכות. יש להעלות JPEG או PNG.")
    if data[4:8] == b"ftyp" and data[8:12] in _HEIF_BRANDS:
        raise Refused(415, "heic_refused", "תמונות HEIC אינן נתמכות. יש להעלות JPEG (בטלפון: הגדרות המצלמה › \"התואם ביותר\").")
    raise Refused(415, "unsupported_format", "יש להעלות תמונת JPEG או PNG.")


def reencode(data: bytes) -> tuple[bytes, int, int]:
    """The validated, re-encoded picture: (fresh JPEG bytes, width, height). Raises Refused."""
    from PIL import Image, ImageOps

    from ..image_guard import check_pixels
    from .image_intake import _load_strict

    kind = sniff(data)
    try:
        im = Image.open(BytesIO(data), formats=["JPEG"] if kind == "jpeg" else ["PNG"])  # the header only
        if check_pixels(im, MAX_PIXELS) is None:
            w, h = im.size
            raise Refused(422, "too_many_pixels", "התמונה גדולה מדי (רזולוציה).", width=w, height=h, max_pixels=MAX_PIXELS)
        if im.format == "JPEG":
            im.draft("RGB", (LONG_SIDE, LONG_SIDE))  # the decoder itself downsamples: never the full grid of a large photo
        if not _DECODE.acquire(timeout=DECODE_WAIT_S):
            raise Refused(429, "busy", "העלאת תמונה אחרת מתבצעת כעת. נסו שוב בעוד רגע.", retry_after_s=5)
        try:
            _load_strict(im)  # 2.5.0 gate: never with LOAD_TRUNCATED_IMAGES on (WeasyPrint sets it process-wide)
            im = ImageOps.exif_transpose(im)  # after the pixel check (review T7-4)
            im = im.convert("RGB")
            if max(im.size) > LONG_SIDE:
                im.thumbnail((LONG_SIDE, LONG_SIDE), Image.Resampling.LANCZOS)
            out = BytesIO()
            im.save(out, format="JPEG", quality=QUALITY, optimize=True)
            width, height = im.size
        finally:
            _DECODE.release()
    except Refused:
        raise
    except Image.DecompressionBombError:
        raise Refused(422, "too_many_pixels", "התמונה גדולה מדי (רזולוציה).", max_pixels=MAX_PIXELS) from None
    except Exception as exc:  # noqa: BLE001 - any decoder failure is the upload's problem (review T7-4)
        raise Refused(422, "image_invalid", "התמונה פגומה ואי אפשר לפתוח אותה.", error=type(exc).__name__) from None
    return out.getvalue(), width, height


def _write_atomic(target: Path, data: bytes) -> None:
    fd, tmp = tempfile.mkstemp(dir=str(target.parent), prefix=".up.", suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        os.replace(tmp, target)
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(tmp)
        raise


def check_capacity(data_dir: Path, incoming: int) -> None:
    """The installation cap, before anything is decoded (review T8)."""
    if used_bytes(data_dir) + incoming > STORAGE_CAP:
        raise Refused(507, "storage_full", "נפח התמונות המותר מלא. פנו למנהל המערכת.", max_bytes=STORAGE_CAP)


def store(data_dir: Path, ticket_id: str, data: bytes) -> Stored:
    """Validate, re-encode and write one picture of a ticket. Raises Refused. Runs OUTSIDE the database write lock (the caller
    wraps it in db.unlocked)."""
    if len(data) > MAX_BYTES:
        raise Refused(413, "payload_too_large", "התמונה גדולה מ־8 MB.", max_bytes=MAX_BYTES)
    if not data:
        raise Refused(422, "image_invalid", "הקובץ ריק.")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", ticket_id):
        raise Refused(422, "image_invalid", "מזהה לא תקין.")
    check_capacity(data_dir, len(data))
    out, width, height = reencode(data)
    folder = root(data_dir) / ticket_id
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{secrets.token_hex(8)}.jpg"
    _write_atomic(folder / name, out)
    _account(data_dir, len(out))
    return Stored(rel_path=f"{ticket_id}/{name}", sha256=hashlib.sha256(out).hexdigest(), bytes=len(out), width=width, height=height)


def path_of(data_dir: Path, rel_path: str) -> Path:
    """The file of a stored row, confined to the attachment directory (the `floor_images.confine` precedent). ValueError otherwise."""
    if not isinstance(rel_path, str) or not _REL.fullmatch(rel_path):
        raise ValueError("bad attachment path")
    base = root(data_dir).resolve()
    p = (base / rel_path).resolve()
    if base not in p.parents:
        raise ValueError("attachment path outside its folder")
    return p


def remove(data_dir: Path, rel_path: str) -> None:
    with contextlib.suppress(ValueError, OSError):
        p = path_of(data_dir, rel_path)
        size = p.stat().st_size
        p.unlink()
        _account(data_dir, -size)
