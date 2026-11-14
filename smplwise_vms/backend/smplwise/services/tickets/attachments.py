"""CR-038 section 10.6: the internal photo upload of a ticket (slice 1's route) - its quotas, its translation of refusals into the
route's Hebrew answers, and its stored-path helpers. The decoding itself is NOT here (deep review A6, TK251): both paths - this
staff route and the public handler page (slice 4) - run the ONE intake pipeline, services/tickets/image_intake.reencode: a
structure walk of the PNG / JPEG before Pillow sees anything (16-bit PNG, ancillary-chunk, scan-count and segment limits), the
header-judged pixel budget (16 MP; 8 MP for PNG and for progressive JPEG), a METADATA-FREE copy handed to Pillow (EXIF is read by the
bounded IFD0 reader for the orientation only - Pillow's TIFF reader, whose DEBUG log quotes tag values, never sees an upload), the
strict load, RGB, at most 2048 px on the long side, a FRESH JPEG q82, then image_intake.store_image (a random name, an atomic
fsync'd write, confined paths).

What stays this route's own: the installation's storage cap (a cached directory size, refreshed at most every 60 s; checked
BEFORE any decode), the 8 MiB body, and its OWN one-slot decode semaphore (`_DECODE`, 5 s wait, then 429 `busy`) - passed to the
pipeline, so anonymous uploads can never starve a staff member's and the reverse (never the background upload's slot either). The
original bytes are never stored or served. Files live on the data volume: `<data>/tickets/<ticket id>/<16 hex>.jpg` (relative
path in the row)."""
from __future__ import annotations

import contextlib
import hashlib
import os
import re
import threading
import time
from dataclasses import dataclass
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


# the pipeline's refusal codes -> this route's answers (the public page has its own vocabulary)
_MESSAGES: dict[str, tuple[int, str, str]] = {
    "too_large": (413, "payload_too_large", "התמונה גדולה מ־8 MB."),
    "webp_refused": (415, "webp_refused", "תמונות WebP אינן נתמכות. יש להעלות JPEG או PNG."),
    "heic_refused": (415, "heic_refused", "תמונות HEIC אינן נתמכות. יש להעלות JPEG (בטלפון: הגדרות המצלמה › \"התואם ביותר\")."),
    "unsupported_format": (415, "unsupported_format", "יש להעלות תמונת JPEG או PNG."),
    "too_many_pixels": (422, "too_many_pixels", "התמונה גדולה מדי (רזולוציה)."),
    "image_invalid": (422, "image_invalid", "התמונה פגומה ואי אפשר לפתוח אותה."),
    "busy": (429, "busy", "העלאת תמונה אחרת מתבצעת כעת. נסו שוב בעוד רגע."),
}


def _refused(exc: Exception) -> Refused:
    code = getattr(exc, "code", "image_invalid")
    status, out_code, message = _MESSAGES.get(code, _MESSAGES["image_invalid"])
    details = {k: v for k, v in (getattr(exc, "details", None) or {}).items() if isinstance(v, int)}
    return Refused(status, out_code, message, **details)


def reencode(data: bytes) -> tuple[bytes, int, int]:
    """The validated, re-encoded picture through the ONE intake pipeline (image_intake.reencode) in THIS route's decode slot:
    (fresh JPEG bytes, width, height). Raises Refused."""
    from . import image_intake

    try:
        image = image_intake.reencode(data, max_pixels=MAX_PIXELS, wait_s=DECODE_WAIT_S, semaphore=_DECODE)
    except image_intake.IntakeError as exc:
        raise _refused(exc) from None
    return image.data, image.width, image.height


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
    from . import image_intake

    base = root(data_dir)
    base.mkdir(parents=True, exist_ok=True)
    try:
        stored = image_intake.store_image(base, ticket_id, image_intake.Reencoded(out, width, height, hashlib.sha256(out).hexdigest()))
    except image_intake.StorePathError:
        raise Refused(422, "image_invalid", "מזהה לא תקין.") from None
    _account(data_dir, stored.bytes)
    return Stored(rel_path=stored.rel_path, sha256=stored.sha256, bytes=stored.bytes, width=stored.width, height=stored.height)


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
