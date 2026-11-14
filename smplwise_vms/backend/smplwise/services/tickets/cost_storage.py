"""CR-038 slice 9, sections 11A.6 / 11A.6A: the file side of a cost claim - accepting one upload (a photographed page or a PDF),
writing it under `<data>/tickets/<ticket_id>/costs/` with a random name, and assembling a document's re-encoded pages into one
PDF for the manager's download.

- A photo goes through image_intake.reencode (JPEG / PNG only, 16 MP, a fresh JPEG without EXIF / GPS): client-side cropping
  and contrast are a convenience, never a trust boundary (S27).
- A PDF goes through cost_files.check_pdf (magic, trailer, size, active-content names incl. inflated FlateDecode streams) and is
  stored byte for byte - NEVER parsed, rendered or thumbnailed by Arx (S25).
- The assembled PDF (`assemble_pdf`) is built with fpdf2 (already a dependency) from the stored, re-encoded JPEG pages only: images,
  no text layer, no active content, no metadata beyond the producer line fpdf2 writes.
Paths are always confined under the attachments root (image_intake.confine)."""
from __future__ import annotations

import secrets
from dataclasses import dataclass
from pathlib import Path

from . import cost_files, image_intake
from .image_intake import IntakeError, StorePathError


@dataclass(frozen=True)
class StoredFile:
    kind: str  # 'photo' | 'pdf'
    rel_path: str
    sha256: str
    bytes: int
    width: int | None = None
    height: int | None = None


def kind_of(data: bytes) -> str:
    kind = cost_files.claim_file_kind(bytes(data[:32]))
    if kind is None:
        raise IntakeError("unsupported_format", 415)
    return kind


def check(data: bytes) -> str:
    """Everything decided BEFORE a decode: the kind by content and its size rule. Returns the kind."""
    kind = kind_of(data)
    if kind == "photo" and len(data) > image_intake.MAX_BYTES:
        raise IntakeError("too_large", 413, max_bytes=image_intake.MAX_BYTES)
    return kind


def store_pdf(root: Path, ticket_id: str, data: bytes) -> StoredFile:
    info = cost_files.check_pdf(data)
    if not isinstance(ticket_id, str) or not image_intake.ID_RE.fullmatch(ticket_id):
        raise StorePathError("ticket id is not a plain id")
    rel_dir = f"{ticket_id}/costs"
    folder = image_intake.confine(root, Path(root) / rel_dir)
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{secrets.token_hex(8)}.pdf"
    image_intake.write_atomic(image_intake.confine(root, folder / name), bytes(data))
    return StoredFile("pdf", f"{rel_dir}/{name}", info.sha256, info.bytes)


def store_photo(root: Path, ticket_id: str, data: bytes, *, wait_s: float = image_intake.DECODE_WAIT_S) -> StoredFile:
    image = image_intake.reencode(data, wait_s=wait_s)
    s = image_intake.store_image(root, ticket_id, image, subdir="costs")
    return StoredFile("photo", s.rel_path, s.sha256, s.bytes, s.width, s.height)


def store_upload(root: Path, ticket_id: str, data: bytes, *, wait_s: float = image_intake.DECODE_WAIT_S) -> StoredFile:
    kind = check(data)
    if kind == "pdf":
        return store_pdf(root, ticket_id, data)
    return store_photo(root, ticket_id, data, wait_s=wait_s)


def remove(root: Path, rel_path: str) -> bool:
    return image_intake.remove_stored(root, rel_path)


def path_of(root: Path, rel_path: str) -> Path:
    return image_intake.resolve_stored(root, rel_path)


def assemble_pdf(page_paths: list[Path]) -> bytes:
    """One PDF of a photographed document: each stored page (a re-encoded JPEG) on a page of its own size (1 px = 0.75 pt)."""
    from fpdf import FPDF
    from PIL import Image

    pdf = FPDF(unit="pt")
    pdf.set_auto_page_break(False)
    pdf.set_creator("")
    pdf.set_producer("")
    for p in page_paths:
        with Image.open(p) as im:
            w, h = im.size
        pw, ph = w * 0.75, h * 0.75
        pdf.add_page(format=(pw, ph))
        pdf.image(str(p), x=0, y=0, w=pw, h=ph)
    return bytes(pdf.output())
