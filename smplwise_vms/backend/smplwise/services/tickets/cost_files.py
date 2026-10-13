"""CR-038 section 11A.6 / 11A.6A: invoice and receipt files of a vendor's cost claim - PDF acceptance checks, the document
grouping of photographed pages, and the headers a file is served with. Slice 9 owns the claim routes and rows; this module is
the file side they call.

PDFs (11A.6) - a PDF cannot be re-encoded without a renderer, which the add-on does not have and will not add, so:
- accepted only with `%PDF-` at offset 0 and an `%%EOF` within the last 1 KiB, at most 10 MiB;
- refused (422 `pdf_refused`) when its bytes name `/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile`, `/RichMedia`, `/XFA`,
  `/OpenAction`, `/AA` or `/Encrypt` (an encrypted file cannot be scanned at all). The scan reads every PDF NAME token of the
  file and compares it exactly after decoding `#xx` escapes - so `/J#61vaScript` is caught, and `/JSON` or `/AAPL` are not
  mistaken for `/JS` / `/AA` as a plain substring search would;
- KNOWN LIMIT, stated plainly: names inside compressed object streams (`/ObjStm`, PDF 1.5+) or any other compressed stream are
  invisible to a byte scan. The scan is a FILTER, NOT A GUARANTEE. The real controls are the next two rules;
- stored under a random name in `<data>/tickets/<ticket_id>/costs/`, and never parsed, rendered, thumbnailed or previewed by Arx;
- served only as a DOWNLOAD to authorised internal users: `Content-Type: application/pdf`, `Content-Disposition: attachment`,
  `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, `Cache-Control: private, no-store`
  (`pdf_download_headers`); the vendor page shows only the name and size of its own files and offers no download.
  Residual (spec S25): a malicious PDF can still reach a reviewer's own PDF viewer - the guide says to keep it up to date.

Photographed pages (11A.6A) are ordinary images: every page goes through image_intake.reencode (16 MP, re-encode, no EXIF);
client-side cropping / contrast is a convenience, never a trust boundary.

Limits per claim revision (11A.2): at most 3 documents, each ONE PDF or up to 10 photographed pages, at most 25 files in total;
the same file (same SHA-256) twice in one claim is refused (`duplicate_file`). Pending uploads live 24 h, at most 30 pending files
per link and 40 uploads an hour per link (the public rate gate)."""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Mapping, Sequence

from .image_intake import IntakeError, sniff

KiB = 1024
MiB = 1024 * KiB
PDF_MAX_BYTES = 10 * MiB
PDF_TAIL = 1 * KiB
ACTIVE_NAMES = frozenset({b"JavaScript", b"JS", b"Launch", b"EmbeddedFile", b"RichMedia", b"XFA", b"OpenAction", b"AA", b"Encrypt"})
# a PDF name: a solidus and every regular character up to the next whitespace or delimiter (ISO 32000-1, 7.2.2 / 7.3.5)
_DELIM = rb"\x00\t\n\x0c\r ()<>\[\]{}/%"
# the plain spellings, as WHOLE names, in one C-level search (a 10 MiB file is scanned in milliseconds whatever it holds)
_PLAIN_RE = re.compile(rb"/(?:" + b"|".join(re.escape(n) for n in sorted(ACTIVE_NAMES, key=len, reverse=True)) +
                       rb")(?=[" + _DELIM + rb"]|\Z)")
# names written with #xx escapes (`/J#61vaScript`): decoded one by one - bounded, a file made of escapes is refused
_ESCAPED_RE = re.compile(rb"/[^" + _DELIM + rb"]*#[^" + _DELIM + rb"]*")
_HEX_ESCAPE_RE = re.compile(rb"#([0-9A-Fa-f]{2})")
MAX_ESCAPED_NAMES = 2000

MAX_DOCUMENTS = 3
MAX_PAGES = 10
MAX_FILES = 25
PENDING_TTL_S = 24 * 3600.0
MAX_PENDING_PER_LINK = 30
DOCUMENT_KEY_RE = re.compile(r"[A-Za-z0-9_-]{1,32}")


@dataclass(frozen=True)
class PdfInfo:
    bytes: int
    sha256: str


def _decoded_name(raw: bytes) -> bytes:
    return _HEX_ESCAPE_RE.sub(lambda m: bytes([int(m.group(1), 16)]), raw)


def active_markers(data: bytes) -> set[str]:
    """The refused names that appear as whole PDF name tokens anywhere in `data` - plainly or with `#xx` escapes. A file with
    more than MAX_ESCAPED_NAMES escaped names answers {"(escapes)"} (no invoice needs that many; scanning them all would let a
    crafted file buy seconds of CPU per upload)."""
    found = {m.group(0)[1:].decode("ascii") for m in _PLAIN_RE.finditer(data)}
    if b"#" in data:
        for i, m in enumerate(_ESCAPED_RE.finditer(data)):
            if i >= MAX_ESCAPED_NAMES:
                found.add("(escapes)")
                break
            name = _decoded_name(m.group(0)[1:])
            if name in ACTIVE_NAMES:
                found.add(name.decode("ascii", "replace"))
    return found


def check_pdf(data: bytes) -> PdfInfo:
    """Accept a PDF per 11A.6, or IntakeError: 413 `too_large`, 415 `unsupported_format` (no `%PDF-` at offset 0), 422
    `pdf_invalid` (no `%%EOF` in the last 1 KiB), 422 `pdf_refused` (an active-content or encryption name). See the module
    docstring for what this check can and cannot see."""
    if not isinstance(data, (bytes, bytearray)) or not data:
        raise IntakeError("unsupported_format", 415)
    if len(data) > PDF_MAX_BYTES:
        raise IntakeError("too_large", 413, max_bytes=PDF_MAX_BYTES)
    data = bytes(data)
    if not data.startswith(b"%PDF-"):
        raise IntakeError("unsupported_format", 415)
    if b"%%EOF" not in data[-PDF_TAIL:]:
        raise IntakeError("pdf_invalid", 422)
    if active_markers(data):
        raise IntakeError("pdf_refused", 422)
    return PdfInfo(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


def claim_file_kind(head: bytes) -> str | None:
    """'pdf' or 'photo' (JPEG / PNG, still to be re-encoded) by content; None for anything else."""
    kind = sniff(head[:32])
    if kind == "pdf":
        return "pdf"
    if kind in ("jpeg", "png"):
        return "photo"
    return None


# ---------------------------------------------------------------- pages and documents of one claim revision


class DocumentProblem(ValueError):
    """A claim's document list refused: `code` and the index of the offending document (or -1). Codes: too_many_documents,
    empty_document, too_many_pages, too_many_files, mixed_document, unknown_file, expired_file, file_reused, duplicate_file."""

    def __init__(self, code: str, index: int = -1) -> None:
        super().__init__(code)
        self.code = code
        self.index = index


@dataclass(frozen=True)
class PendingFile:
    """A `ticket_cost_files` row still pending (claim_id NULL) as slice 9 hands it in."""

    id: str
    link_id: str
    kind: str  # 'photo' | 'pdf'
    sha256: str
    bytes: int
    created_at: float
    document_key: str | None = None
    page_no: int | None = None


def page_fields(document_key: object, page_no: object) -> tuple[str | None, int | None]:
    """The optional `document_key` / `page_no` form fields of a pending upload: an opaque client key (1-32 of [A-Za-z0-9_-])
    and a page number 1-10. ValueError for anything else."""
    key: str | None = None
    page: int | None = None
    if document_key not in (None, ""):
        if not isinstance(document_key, str) or not DOCUMENT_KEY_RE.fullmatch(document_key):
            raise ValueError("document_key")
        key = document_key
    if page_no not in (None, ""):
        try:
            page = int(page_no) if isinstance(page_no, (int, str)) and not isinstance(page_no, bool) else -1
        except ValueError:
            page = -1
        if not 1 <= page <= MAX_PAGES:
            raise ValueError("page_no")
    return key, page


def check_pending_quota(pending_count: int) -> None:
    """Spec 11A.6: at most 30 pending (uploaded, not yet submitted) files per link -> 409 `file_limit` (the hourly 40 is the
    public rate gate's `token_claim_files`)."""
    if pending_count >= MAX_PENDING_PER_LINK:
        raise IntakeError("file_limit", 409)


def assemble_documents(documents: Sequence[Sequence[str]], pending: Mapping[str, PendingFile], *, link_id: str,
                       now: float) -> list[list[PendingFile]]:
    """The documents of one submission in the order given: each a list of file ids (one PDF, or 1-10 photographed pages in page
    order). `pending` holds the link's pending files by id; a file of another link reads as unknown (nothing is learned
    about other links). DocumentProblem otherwise."""
    if len(documents) > MAX_DOCUMENTS:
        raise DocumentProblem("too_many_documents")
    seen_ids: set[str] = set()
    seen_hashes: set[str] = set()
    total = 0
    out: list[list[PendingFile]] = []
    for i, ids in enumerate(documents):
        if not ids:
            raise DocumentProblem("empty_document", i)
        if len(ids) > MAX_PAGES:
            raise DocumentProblem("too_many_pages", i)
        total += len(ids)
        if total > MAX_FILES:
            raise DocumentProblem("too_many_files", i)
        files: list[PendingFile] = []
        for fid in ids:
            f = pending.get(fid) if isinstance(fid, str) else None
            if f is None or f.link_id != link_id:
                raise DocumentProblem("unknown_file", i)
            if now - f.created_at >= PENDING_TTL_S:
                raise DocumentProblem("expired_file", i)
            if fid in seen_ids:
                raise DocumentProblem("file_reused", i)
            if f.sha256 in seen_hashes:
                raise DocumentProblem("duplicate_file", i)
            seen_ids.add(fid)
            seen_hashes.add(f.sha256)
            files.append(f)
        kinds = {f.kind for f in files}
        if "pdf" in kinds and (len(files) != 1 or kinds != {"pdf"}):
            raise DocumentProblem("mixed_document", i)
        out.append(files)
    return out


# ---------------------------------------------------------------- serving headers

_SAFE_NUMBER_RE = re.compile(r"[0-9]{1,9}")


def _number(ticket_number: object) -> str:
    s = str(ticket_number)
    if not _SAFE_NUMBER_RE.fullmatch(s):
        raise ValueError("ticket number")
    return s


def pdf_download_headers(ticket_number: int, n: int) -> dict[str, str]:
    """Spec 11A.6: an invoice PDF is a download only - never inline, never sniffed, sandboxed if anything renders it."""
    return {
        "Content-Type": "application/pdf",
        "Content-Disposition": f'attachment; filename="ticket-{_number(ticket_number)}-invoice-{int(n)}.pdf"',
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
        "Cache-Control": "private, no-store",
    }


def photo_headers(ticket_number: int) -> dict[str, str]:
    """Spec 10.6: a re-encoded photo, inline, fixed type, never sniffed, never cached by a shared cache."""
    return {
        "Content-Type": "image/jpeg",
        "Content-Disposition": f'inline; filename="ticket-{_number(ticket_number)}.jpg"',
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
    }
