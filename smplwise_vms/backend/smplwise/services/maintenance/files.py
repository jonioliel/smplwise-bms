"""MAINT215B (owner review 24.10): the FILE of a certificate or a supplier document - the scanned certificate, the insurance policy.

No second file pipeline: a PDF goes through the tickets module's cost-file check (`tickets/cost_files.check_pdf`: `%PDF-` header, `%%EOF`,
no active content or encryption, at most 10 MiB; stored as received, never parsed, served ONLY as a download with a sandbox policy) and a
photographed page through the tickets image pipeline (`tickets/image_intake.reencode`: structure walk, pixel budget, metadata-free fresh
JPEG, at most 8 MiB). The bytes live under `<data>/maintenance/<task_id>/<16 hex>.<pdf|jpg>`, are confined to that folder, and are never
named by the uploader (the display name is cleaned and used only as a label and as the download name). The rows are NOT in project
backups (the bytes would not travel with them)."""
from __future__ import annotations

import contextlib
import hashlib
import re
import secrets
import threading
from dataclasses import dataclass
from pathlib import Path

from ..tickets import cost_files, image_intake

DIR = "maintenance"
IMAGE_MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 16_000_000
DECODE_WAIT_S = 5.0
NAME_MAX = 80
_DECODE = threading.BoundedSemaphore(1)
_TASK_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
_REL = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}/[0-9a-f]{16}\.(?:pdf|jpg)$")


class Refused(Exception):
    def __init__(self, status: int, code: str, message: str, **details: object):
        super().__init__(code)
        self.status, self.code, self.message, self.details = status, code, message, details


@dataclass(frozen=True)
class Stored:
    kind: str  # 'pdf' | 'image'
    rel_path: str
    sha256: str
    bytes: int


_MESSAGES = {
    "too_large": (413, "payload_too_large", "הקובץ גדול מדי."),
    "unsupported_format": (415, "unsupported_format", "יש להעלות קובץ PDF או תמונת JPEG / PNG."),
    "webp_refused": (415, "webp_refused", "תמונות WebP אינן נתמכות. יש להעלות JPEG או PNG."),
    "heic_refused": (415, "heic_refused", "תמונות HEIC אינן נתמכות. יש להעלות JPEG או PNG."),
    "pdf_invalid": (422, "pdf_invalid", "קובץ ה־PDF פגום."),
    "pdf_refused": (422, "pdf_refused", "קובץ ה־PDF מכיל תוכן פעיל או מוצפן ולכן נדחה."),
    "too_many_pixels": (422, "too_many_pixels", "התמונה גדולה מדי (רזולוציה)."),
    "image_invalid": (422, "image_invalid", "התמונה פגומה ואי אפשר לפתוח אותה."),
    "busy": (429, "busy", "העלאה אחרת מתבצעת כעת. נסו שוב בעוד רגע."),
}


def _refused(exc: Exception) -> Refused:
    code = getattr(exc, "code", "image_invalid")
    status, out, msg = _MESSAGES.get(code, _MESSAGES["image_invalid"])
    return Refused(status, out, msg, **{k: v for k, v in (getattr(exc, "details", None) or {}).items() if isinstance(v, int)})


def clean_name(raw: object, kind: str) -> str:
    """A display / download name: the base name only, no control characters, no path, at most NAME_MAX characters, with the right extension."""
    name = str(raw or "").replace("\\", "/").rsplit("/", 1)[-1]
    name = "".join(ch for ch in name if ch.isprintable() and ch not in '"<>:|?*').strip(" .")
    stem = name.rsplit(".", 1)[0] if "." in name else name
    ext = ".pdf" if kind == "pdf" else ".jpg"
    return (stem[: NAME_MAX - len(ext)].strip() or "certificate") + ext


def root(data_dir: Path) -> Path:
    return Path(data_dir) / DIR


def store(data_dir: Path, task_id: str, data: bytes) -> Stored:
    """Validate and write one file of a task. Raises Refused. Blocking (Pillow for a picture): the caller runs it outside the write lock."""
    if not _TASK_ID.fullmatch(task_id or ""):
        raise Refused(422, "image_invalid", "מזהה לא תקין.")
    if not data:
        raise Refused(422, "image_invalid", "הקובץ ריק.")
    kind = "pdf" if data[:5] == b"%PDF-" else "image"
    base = root(data_dir)
    try:
        if kind == "pdf":
            info = cost_files.check_pdf(data)
            payload, ext, sha = bytes(data), "pdf", info.sha256
        else:
            if len(data) > IMAGE_MAX_BYTES:
                raise Refused(413, "payload_too_large", "התמונה גדולה מ־8 MB.", max_bytes=IMAGE_MAX_BYTES)
            img = image_intake.reencode(data, max_pixels=MAX_PIXELS, wait_s=DECODE_WAIT_S, semaphore=_DECODE)
            payload, ext, sha = img.data, "jpg", hashlib.sha256(img.data).hexdigest()
    except image_intake.IntakeError as exc:
        raise _refused(exc) from None
    try:
        folder = image_intake.confine(base, base / task_id)
        folder.mkdir(parents=True, exist_ok=True)
        name = f"{secrets.token_hex(8)}.{ext}"
        path = image_intake.confine(base, folder / name)
        image_intake.write_atomic(path, payload)
    except image_intake.StorePathError:
        raise Refused(422, "image_invalid", "מזהה לא תקין.") from None
    return Stored(kind=kind, rel_path=f"{task_id}/{name}", sha256=sha, bytes=len(payload))


def path_of(data_dir: Path, rel: str) -> Path:
    if not isinstance(rel, str) or not _REL.fullmatch(rel):
        raise ValueError("bad maintenance file path")
    base = root(data_dir).resolve()
    p = (base / rel).resolve()
    if base not in p.parents:
        raise ValueError("maintenance file path outside its folder")
    return p


def remove(data_dir: Path, rel: str) -> None:
    with contextlib.suppress(ValueError, OSError):
        path_of(data_dir, rel).unlink()


def download_headers(name: str, kind: str) -> dict[str, str]:
    """A PDF is a download only (never inline, sandboxed); a re-encoded picture may be shown inline. Never sniffed, never cached."""
    safe = clean_name(name, kind).encode("ascii", "ignore").decode() or ("certificate.pdf" if kind == "pdf" else "certificate.jpg")
    h = {"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"}
    if kind == "pdf":
        h.update({"Content-Type": "application/pdf", "Content-Disposition": f'attachment; filename="{safe}"', "Content-Security-Policy": "sandbox"})
    else:
        h.update({"Content-Type": "image/jpeg", "Content-Disposition": f'inline; filename="{safe}"'})
    return h
