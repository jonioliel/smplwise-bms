"""CR-038 section 10.6 (and the photographed invoice pages of 11A.6A): the hostile-image pipeline of the tickets module.

Anonymous uploads reach this code from the public listener (review T7 / R1), so every step assumes the bytes were crafted:

1. size: at most MAX_BYTES (8 MiB; phones produce 2-5 MB JPEGs) - the listener's body limit already refused more;
2. type by magic bytes only (the declared type and the file name are ignored): JPEG and PNG. WebP is refused on purpose (a
   large decoder attack surface - CVE-2023-4863 - and phones send JPEG), HEIC with its own code (the page asks for "most
   compatible"), everything else as unsupported;
3. a PNG's chunk structure is walked BEFORE Pillow sees it: IHDR first, only known critical chunks, bounded ancillary chunks
   (text / ICC / EXIF sizes and counts - Pillow inflates compressed text and ICC chunks while opening), no animation chunks;
4. the image is opened lazily (header only) with Pillow restricted to the sniffed decoder, and its declared width x height is
   checked against MAX_PIXELS (16 MP - not the administrator's 40 MP budget, review T7-1) and each side against MAX_SIDE_IN;
5. a JPEG is decoded at a reduced scale (`draft`, the ui_background.reencode pattern) so a 16 MP photo decodes at about 4 MP;
6. the decode runs under this module's OWN semaphore (one decode at a time, DECODE_WAIT_S wait, then 429 `busy`) - never the
   router-private `ui_background._decode_slot`, so anonymous uploads never make an administrator's upload wait (review C2);
7. EXIF orientation is applied AFTER the pixel check (review T7-4), the picture is flattened to RGB (transparency onto white),
   scaled to at most 2048 px on the long side and written into a FRESH image, saved as a new JPEG (quality 82): no EXIF (GPS),
   ICC, XMP, comments, thumbnails or appended bytes survive - a polyglot's payload is gone;
8. the whole decode is wrapped: any exception is one answer, 422 `image_invalid` (review T7-4);
9. the result is written under a random 16-hex name with an atomic replace, inside a confined folder; SHA-256 recorded.
The original bytes are never stored or served. Pillow stays on the dependency watch (`upstream_watch.json` `py-pillow`).

Also here: the installation storage cap (2 GiB, a cached directory size refreshed at most every 60 s, checked BEFORE a body is
read), the one-upload-in-flight-per-link guard and the photo quotas (30 per assignment, 60 per ticket)."""
from __future__ import annotations

import contextlib
import hashlib
import io
import logging
import os
import secrets
import struct
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterator

from ...db import ID_RE
from .public_ports import PhotoCounts, StoredImage

KiB = 1024
MiB = 1024 * KiB
GiB = 1024 * MiB
MAX_BYTES = 8 * MiB
MAX_PIXELS = 16_000_000
MAX_SIDE_IN = 10_000
OUT_MAX_SIDE = 2048
# A JPEG is decoded at the largest 1/2..1/8 reduction whose long side still reaches DRAFT_MIN_SIDE. Asking for the full
# 2048 box (the ui_background pattern) leaves a typical 12 MP phone photo (4032 x 3024) at full scale (36 MB decoded); asking
# for 1536 decodes it at 1/2 (9 MB, ~3x faster) and the stored picture is 2016 px instead of 2048 - "at most 2048".
DRAFT_MIN_SIDE = 1536
JPEG_QUALITY = 82
DECODE_CONCURRENCY = 1
DECODE_WAIT_S = 5.0
# A progressive JPEG is decoded scan by scan; a small file with thousands of tiny scans makes libjpeg decode for a very long
# time (Pillow sets no scan limit). Phones write 1 (baseline) to ~12 scans. Byte stuffing guarantees FF DA appears in a JPEG
# only as a start-of-scan marker, so counting it bounds the scans before any decode.
JPEG_MAX_SCANS = 100
STORAGE_CAP_BYTES = 2 * GiB
STORAGE_REFRESH_S = 60.0
PHOTOS_PER_ASSIGNMENT = 30
PHOTOS_PER_TICKET = 60

_DECODE = threading.BoundedSemaphore(DECODE_CONCURRENCY)  # THIS module's; never shared with an administrator's route

# Pillow's TIFF / EXIF reader logs every tag VALUE at DEBUG ("Tag 270, Type: 2, Value: '...'") - GPS positions, camera serial
# numbers, names typed into a photo's metadata - while exif_transpose reads them. With the add-on at log level "debug" every
# anonymous upload's metadata would reach the add-on log (found by tests/test_tickets_public_logs.py). Pillow's own loggers
# are kept at INFO for the whole process, the way main.py keeps httpx at WARNING.
logging.getLogger("PIL").setLevel(logging.INFO)


class IntakeError(Exception):
    """An upload refused: `code` (fixed vocabulary), the HTTP `status` the listener answers, `details` (small numbers only - never
    file content, names or metadata)."""

    def __init__(self, code: str, status: int, **details: int) -> None:
        super().__init__(code)
        self.code = code
        self.status = status
        self.details = details


@dataclass(frozen=True)
class Reencoded:
    data: bytes
    width: int
    height: int
    sha256: str


# ---------------------------------------------------------------- type by content


def sniff(head: bytes) -> str:
    """'jpeg' | 'png' | 'webp' | 'heic' | 'avif' | 'gif' | 'bmp' | 'tiff' | 'pdf' | 'unknown' from the first bytes."""
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in (b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"hevm", b"hevs", b"mif1", b"msf1"):
            return "heic"
        if brand in (b"avif", b"avis"):
            return "avif"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if head[:2] == b"BM":
        return "bmp"
    if head[:4] in (b"II*\x00", b"MM\x00*"):
        return "tiff"
    if head.startswith(b"%PDF-"):
        return "pdf"
    return "unknown"


# ---------------------------------------------------------------- PNG structure walk (before Pillow)

_PNG_CRITICAL = frozenset({b"IHDR", b"PLTE", b"IDAT", b"IEND"})
_PNG_ANIMATION = frozenset({b"acTL", b"fcTL", b"fdAT"})
_PNG_TEXT = frozenset({b"tEXt", b"zTXt", b"iTXt"})
_PNG_LIMITS = {b"iCCP": 1 * MiB, b"eXIf": 64 * KiB, b"sPLT": 64 * KiB, b"tRNS": 1 * KiB}
_PNG_ANCILLARY_DEFAULT = 64 * KiB
PNG_MAX_ANCILLARY = 64
PNG_MAX_TEXT_CHUNKS = 8


def png_scan(data: bytes) -> tuple[int, int]:
    """(width, height) from IHDR after a walk of the chunk layout; IntakeError otherwise. Bytes after IEND are ignored (the
    re-encode drops them)."""
    pos = 8
    first = True
    ancillary = text = 0
    size = (0, 0)
    n = len(data)
    while True:
        if pos + 12 > n:
            raise IntakeError("image_invalid", 422)
        length, ctype = struct.unpack(">I4s", data[pos:pos + 8])
        if length > n - pos - 12 or not ctype.isalpha():
            raise IntakeError("image_invalid", 422)
        if first:
            if ctype != b"IHDR" or length != 13:
                raise IntakeError("image_invalid", 422)
            w, h = struct.unpack(">II", data[pos + 8:pos + 16])
            size = (w, h)
            first = False
        elif ctype in _PNG_ANIMATION:
            raise IntakeError("unsupported_format", 415)
        elif ctype[0:1].isupper():  # a critical chunk: only the four this decoder needs
            if ctype not in _PNG_CRITICAL or ctype == b"IHDR":
                raise IntakeError("image_invalid", 422)
        else:
            ancillary += 1
            if ctype in _PNG_TEXT:
                text += 1
            if ancillary > PNG_MAX_ANCILLARY or text > PNG_MAX_TEXT_CHUNKS or length > _PNG_LIMITS.get(ctype, _PNG_ANCILLARY_DEFAULT):
                raise IntakeError("image_invalid", 422)
        pos += 12 + length
        if ctype == b"IEND":
            return size


# ---------------------------------------------------------------- the decode slot


@contextlib.contextmanager
def decode_slot(wait_s: float = DECODE_WAIT_S, semaphore: threading.BoundedSemaphore | None = None) -> Iterator[None]:
    """At most DECODE_CONCURRENCY decodes at a time in this process for ticket images; a caller waits up to `wait_s`, then
    IntakeError 429 `busy` (the page retries with the same client_request_id)."""
    sem = semaphore or _DECODE
    if not sem.acquire(timeout=wait_s):
        raise IntakeError("busy", 429, retry_after_s=5)
    try:
        yield
    finally:
        sem.release()


def _flatten(im: Any) -> Any:
    from PIL import Image

    if im.mode in ("RGBA", "LA", "PA") or (im.mode == "P" and "transparency" in im.info):
        rgba = im.convert("RGBA")
        bg = Image.new("RGB", rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.getchannel("A"))
        return bg
    if im.mode != "RGB":
        return im.convert("RGB")
    return im


def reencode(data: bytes, *, max_pixels: int = MAX_PIXELS, wait_s: float = DECODE_WAIT_S,
             semaphore: threading.BoundedSemaphore | None = None) -> Reencoded:
    """The accepted, re-encoded JPEG of an upload, or IntakeError (413 too_large, 415 unsupported_format / webp_refused /
    heic_refused, 422 image_invalid / too_many_pixels, 429 busy). Blocking (Pillow): run it in a worker thread."""
    if not isinstance(data, (bytes, bytearray)) or len(data) == 0:
        raise IntakeError("unsupported_format", 415)
    if len(data) > MAX_BYTES:
        raise IntakeError("too_large", 413, max_bytes=MAX_BYTES)
    kind = sniff(bytes(data[:32]))
    if kind == "webp":
        raise IntakeError("webp_refused", 415)
    if kind == "heic":
        raise IntakeError("heic_refused", 415)
    if kind not in ("jpeg", "png"):
        raise IntakeError("unsupported_format", 415)
    if kind == "png":
        w, h = png_scan(bytes(data))
        if w <= 0 or h <= 0 or w * h > max_pixels or max(w, h) > MAX_SIDE_IN:
            raise IntakeError("too_many_pixels", 422, max_pixels=max_pixels)
    elif bytes(data).count(b"\xff\xda") > JPEG_MAX_SCANS:
        raise IntakeError("image_invalid", 422)
    from PIL import Image, ImageOps

    from .. import image_guard  # noqa: F401 - imported for its effect: the process-wide bomb threshold is set once there

    with decode_slot(wait_s, semaphore):
        try:
            im = Image.open(io.BytesIO(bytes(data)), formats=["JPEG"] if kind == "jpeg" else ["PNG"])  # header only
            if image_guard.check_pixels(im, max_pixels) is None or max(im.size) > MAX_SIDE_IN:
                raise IntakeError("too_many_pixels", 422, max_pixels=max_pixels)
            if kind == "jpeg":
                w, h = im.size
                longest = max(w, h)
                # the smallest decode whose long side still reaches DRAFT_MIN_SIDE: the decoder downsamples by 1/2 .. 1/8
                im.draft("RGB", (max(1, w * DRAFT_MIN_SIDE // longest), max(1, h * DRAFT_MIN_SIDE // longest)))
            im.load()
            im = ImageOps.exif_transpose(im)
            im = _flatten(im)
            if max(im.size) > OUT_MAX_SIDE:
                im.thumbnail((OUT_MAX_SIDE, OUT_MAX_SIDE), Image.Resampling.LANCZOS, reducing_gap=3.0)
            clean = Image.new("RGB", im.size)
            clean.paste(im)  # a fresh image: an empty info dict - nothing of the upload's metadata can be carried to the save
            buf = io.BytesIO()
            clean.save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True)
        except IntakeError:
            raise
        except Image.DecompressionBombError:
            raise IntakeError("too_many_pixels", 422, max_pixels=max_pixels) from None
        except Exception:  # noqa: BLE001 - review T7-4: a broken or hostile file is one answer, whatever failed inside Pillow
            raise IntakeError("image_invalid", 422) from None
    out = buf.getvalue()
    return Reencoded(out, clean.width, clean.height, hashlib.sha256(out).hexdigest())


# ---------------------------------------------------------------- storage (confined paths, atomic writes)


class StorePathError(ValueError):
    """A path built from an id or a stored relative path would leave the attachments root: refused, nothing touched."""


def confine(root: Path, candidate: Path) -> Path:
    base = Path(root).resolve()
    resolved = Path(candidate).resolve()
    if resolved == base or base not in resolved.parents:
        raise StorePathError("path outside the attachments folder")
    return resolved


def resolve_stored(root: Path, rel: str) -> Path:
    """The absolute file of a stored relative path (`<ticket_id>/<16 hex>.jpg`), confined under `root` (the floor_images
    `confine_stored` precedent: no absolute path, no backslash, no `..`)."""
    if not isinstance(rel, str) or not rel or rel.startswith("/") or "\\" in rel or ".." in rel.split("/") or ":" in rel:
        raise StorePathError("stored path is not a plain relative path")
    return confine(root, Path(root) / rel)


def write_atomic(target: Path, data: bytes) -> None:
    """A unique temporary file in the same folder, flushed, then an atomic replace (two writers never share a temporary name; a
    reader sees no file or the complete one)."""
    fd, tmp = tempfile.mkstemp(dir=str(target.parent), prefix=".up.", suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, target)
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(tmp)
        raise


def store_image(root: Path, ticket_id: str, image: Reencoded, *, subdir: str | None = None) -> StoredImage:
    """Write a re-encoded image as `<root>/<ticket_id>[/<subdir>]/<16 hex>.jpg` and describe it (the relative path is what a row
    stores). `subdir` is `costs` for invoice pages (spec 11A.6)."""
    if not isinstance(ticket_id, str) or not ID_RE.fullmatch(ticket_id):
        raise StorePathError("ticket id is not a plain id")
    if subdir is not None and subdir != "costs":
        raise StorePathError("unknown attachments sub-folder")
    rel_dir = ticket_id if subdir is None else f"{ticket_id}/{subdir}"
    folder = confine(root, Path(root) / rel_dir)
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{secrets.token_hex(8)}.jpg"
    path = confine(root, folder / name)
    write_atomic(path, image.data)
    return StoredImage(rel_path=f"{rel_dir}/{name}", sha256=image.sha256, bytes=len(image.data), width=image.width, height=image.height)


def remove_stored(root: Path, rel: str) -> bool:
    try:
        p = resolve_stored(root, rel)
    except StorePathError:
        return False
    try:
        p.unlink()
        return True
    except FileNotFoundError:
        return False


# ---------------------------------------------------------------- quotas


class StorageMeter:
    """The installation cap on the attachments folder (spec 10.6: 2 GiB, 507 `storage_full`). `used()` is a directory walk cached
    for STORAGE_REFRESH_S plus the bytes noted since; `admit(incoming)` is the check made BEFORE a body is read further."""

    def __init__(self, root: Path, cap_bytes: int = STORAGE_CAP_BYTES, refresh_s: float = STORAGE_REFRESH_S,
                 clock: Callable[[], float] = time.monotonic) -> None:
        self.root = Path(root)
        self.cap_bytes = cap_bytes
        self.refresh_s = refresh_s
        self._clock = clock
        self._lock = threading.Lock()
        self._walked: int | None = None
        self._at = 0.0
        self._since = 0
        self._walking = False

    def _walk(self) -> int:
        total = 0
        if not self.root.is_dir():
            return 0
        for dirpath, dirnames, filenames in os.walk(self.root, followlinks=False):
            for name in filenames:
                try:
                    st = os.lstat(os.path.join(dirpath, name))
                except OSError:
                    continue
                if not os.path.islink(os.path.join(dirpath, name)):
                    total += st.st_size
        return total

    def used(self) -> int:
        """The cached total; a stale one is re-walked by ONE caller while the others go on with the stale value (a walk of a
        large tree is never done under the lock, so uploads do not queue behind it in worker threads). Bytes noted while a
        walk runs may be counted twice or missed until the next walk - a few MB against a 2 GiB cap."""
        with self._lock:
            now = self._clock()
            stale = self._walked is None or now - self._at >= self.refresh_s
            if not stale or (self._walking and self._walked is not None):
                return (self._walked or 0) + self._since
            self._walking = True
        try:
            total = self._walk()
        finally:
            with self._lock:
                self._walking = False
        with self._lock:
            self._walked, self._at, self._since = total, self._clock(), 0
            return total

    def admit(self, incoming: int) -> None:
        if self.used() + max(0, incoming) > self.cap_bytes:
            raise IntakeError("storage_full", 507)

    def note(self, delta: int) -> None:
        with self._lock:
            self._since += delta


def check_photo_quota(counts: PhotoCounts, *, per_assignment: int = PHOTOS_PER_ASSIGNMENT, per_ticket: int = PHOTOS_PER_TICKET) -> None:
    """Spec 10.2 / 10.6: 30 photos per assignment (through its link), 60 per ticket from every source -> 409 `photo_limit`."""
    if counts.assignment >= per_assignment or counts.ticket >= per_ticket:
        raise IntakeError("photo_limit", 409)


class InFlight:
    """One upload at a time per key (a link id): a second concurrent upload of the same link is 429 `busy` at once (spec 10.1:
    per-token concurrency; a slow upload cannot be multiplied through one link)."""

    def __init__(self) -> None:
        self._held: set[str] = set()
        self._lock = threading.Lock()

    @contextlib.contextmanager
    def claim(self, key: str) -> Iterator[None]:
        with self._lock:
            if key in self._held:
                raise IntakeError("busy", 429, retry_after_s=5)
            self._held.add(key)
        try:
            yield
        finally:
            with self._lock:
                self._held.discard(key)

    def held(self, key: str) -> bool:
        with self._lock:
            return key in self._held
