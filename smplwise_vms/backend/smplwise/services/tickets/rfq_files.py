"""RFQATT (owner 17.10; docs/tickets/RFQ_BACKEND_CONTRACT.md section 19, docs/changes/CR-RFQ-ATTACHMENTS.md): the FILE side of the
attachments a manager puts on a request for quotation - deciding what a file is from its bytes, the refusal checks, the stored copy,
the display name and the headers a file is served with. The rows, the permissions and who may see what are rfq_attach.py's.

Allow-list (by CONTENT - the declared type and the file name's extension are never trusted):
- pictures: JPEG, PNG, WebP -> the ONE image pipeline (image_intake.reencode, here with `allow_webp`): the structure walk, the pixel
  budget, a metadata-free copy for the decoder, a FRESH JPEG (no EXIF / GPS / ICC / XMP / comments / appended bytes), at most
  2048 px; plus a re-encoded 480 px thumbnail made from that fresh JPEG. The original bytes are never stored or served. 8 MiB.
- PDF -> cost_files.check_pdf (magic, trailer, active-content names incl. inflated streams, encryption refused); stored byte for
  byte, never parsed, rendered or thumbnailed by Arx. 10 MiB.
- DOCX / XLSX (owner 17.10: "common office docs") -> check_office: a plain OOXML package or nothing. The ZIP must start at byte 0
  and end with its end-of-central-directory record (no prepended or appended bytes - the polyglot shapes), at most 2000 entries,
  unique plain names (no absolute path, `..`, backslash, drive or NUL), no encryption, stored / deflate only, at most 100 MiB
  uncompressed and a bounded ratio per entry (a ZIP bomb is refused from its directory, before anything is inflated); exactly one
  main part (`word/document.xml` -> docx, `xl/workbook.xml` -> xlsx) declared with the macro-FREE content type; refused (422
  `office_refused`): macros (vbaProject / vbaData, any `macroEnabled` type), ActiveX, embedded objects (`embeddings/`, OLE, any
  `.bin` but printer settings), macro sheets, external workbook links / DDE links, an executable-looking name, a DOCTYPE / ENTITY in
  any XML part, an EXTERNAL relationship other than a hyperlink (remote templates, frames, OLE links), a DDE field (DDEAUTO) and a
  `|` in a spreadsheet formula (the DDE shape). Inflating for these scans is bounded (100 MiB in all, 32 MiB per part). Stored byte for byte; never
  parsed further, previewed or converted by Arx. 10 MiB.
- Everything else -> 415 `unsupported_format` (HEIC with its own code, as on the ticket routes).
Like the invoice PDFs, the scans are a FILTER, not a guarantee: the real controls are "never rendered by Arx" and "served only as a
download" (`Content-Disposition: attachment`, the exact type, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`,
`Cache-Control: private, no-store`). A picture is served inline (it is a fresh JPEG of our own).

Storage: `<data>/tickets/<folder>/rfq/<16 hex>.<jpg|pdf|docx|xlsx>` (random names, atomic fsync'd writes, confined paths;
image_intake.confine / write_atomic). `folder` is the request's id (the orphan sweep knows the `rfq` sub-folder)."""
from __future__ import annotations

import hashlib
import io
import re
import secrets
import threading
import unicodedata
import urllib.parse
import zipfile
from dataclasses import dataclass
from pathlib import Path

from . import cost_files, image_intake
from .image_intake import IntakeError, StorePathError

KiB = 1024
MiB = 1024 * KiB
IMAGE_MAX_BYTES = image_intake.MAX_BYTES  # 8 MiB, the pipeline's own cap
DOCUMENT_MAX_BYTES = 10 * MiB
MAX_FILES = 10  # live (not removed) files per request
TOTAL_MAX_BYTES = 40 * MiB  # stored bytes of the live files of one request
NAME_STEM_MAX = 100
CAPTION_MAX = 200
THUMB_SIDE = 480
THUMB_QUALITY = 75
SUBDIR = "rfq"
KINDS = ("image", "pdf", "docx", "xlsx")
EXT = {"image": "jpg", "pdf": "pdf", "docx": "docx", "xlsx": "xlsx"}
MIME = {"image": "image/jpeg", "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
ACCEPT = ("image/jpeg", "image/png", "image/webp", "application/pdf", MIME["docx"], MIME["xlsx"])  # the picker's hint only

# this route's OWN decode slot (attachments.py / image_intake keep theirs): a manager's upload never waits for an anonymous one
_DECODE = threading.BoundedSemaphore(1)
DECODE_WAIT_S = 5.0

# ---------------------------------------------------------------- office packages

OFFICE_MAX_ENTRIES = 2000
OFFICE_MAX_UNCOMPRESSED = 100 * MiB
OFFICE_MAX_RATIO = 100  # an entry larger than OFFICE_RATIO_FLOOR may not inflate more than this many times
OFFICE_RATIO_FLOOR = 1 * MiB
OFFICE_SCAN_BUDGET = 100 * MiB
OFFICE_PART_MAX = 32 * MiB  # one scanned part (document.xml, a sheet) at most this much inflated
OFFICE_HEAD = 2 * KiB  # every XML part's head is read for a DOCTYPE / ENTITY
OFFICE_NAME_MAX = 255
MAIN = {"word/document.xml": "docx", "xl/workbook.xml": "xlsx"}
MAIN_TYPE = {"docx": b"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
             "xlsx": b"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"}
_REFUSED_NAME = re.compile(r"(vbaproject|vbadata|/activex/|^activex/|/embeddings/|^embeddings/|macrosheets/|externallinks/|oleobject|"
                           r"\.(exe|dll|com|scr|bat|cmd|ps1|vbs|vbe|js|jse|wsf|wsh|hta|lnk|jar|msi|sh|py|cpl|reg|apk)$)", re.I)
_PRINTER_BIN = re.compile(r"^(word|xl)/printerSettings/printerSettings\d{1,4}\.bin$", re.I)
_REFUSED_TYPES = re.compile(rb"macroEnabled|vbaProject|activeX|oleObject|ms-office\.vbaProject|ms-excel\.sheet\.macro|ms-word\.document\.macro",
                            re.I)
_DTD = re.compile(rb"<!\s*(DOCTYPE|ENTITY)", re.I)
_REL = re.compile(rb"<(?:\w+:)?Relationship\b[^>]{0,4096}>", re.I)
_REL_EXTERNAL = re.compile(rb"\bTargetMode\s*=\s*[\"']\s*External\s*[\"']", re.I)
_REL_TYPE = re.compile(rb"\bType\s*=\s*[\"']([^\"']{1,512})[\"']", re.I)
_REL_REFUSED_TYPE = re.compile(rb"(attachedTemplate|oleObject|activeX|vbaProject|frame|subDocument|externalLink|package|control)\s*$", re.I)
_DDE_WORD = re.compile(rb"DDEAUTO|<(?:\w+:)?instrText\b[^>]{0,256}>\s*DDE\b|\binstr\s*=\s*[\"']\s*DDE", re.I)
_FORMULA_PIPE = re.compile(rb"<(?:\w+:)?f\b[^>]{0,512}>[^<]{0,65536}\|")
_WORD_SCANNED = re.compile(r"^word/[^/]+\.xml$", re.I)
_SHEET_SCANNED = re.compile(r"^xl/(worksheets|chartsheets)/[^/]+\.xml$|^xl/sharedStrings\.xml$", re.I)


@dataclass(frozen=True)
class FileInfo:
    kind: str
    bytes: int
    sha256: str


def _bad_name(name: str) -> bool:
    return (not name or len(name) > OFFICE_NAME_MAX or name.startswith("/") or "\\" in name or "\x00" in name or ":" in name
            or ".." in name.split("/"))


def _eocd_at_end(data: bytes) -> bool:
    """The end-of-central-directory record is the file's last 22 bytes (no ZIP comment, no appended bytes, no ZIP64)."""
    return len(data) >= 22 and data[-22:-18] == b"PK\x05\x06" and data[-2:] == b"\x00\x00"


def check_office(data: bytes) -> FileInfo:
    """Accept a plain DOCX / XLSX (module docstring), or IntakeError: 413 `too_large`, 415 `unsupported_format`, 422
    `office_invalid` (not a well-formed package), 422 `office_refused` (active content, external references, a ZIP bomb)."""
    if not isinstance(data, (bytes, bytearray)) or not data:
        raise IntakeError("unsupported_format", 415)
    if len(data) > DOCUMENT_MAX_BYTES:
        raise IntakeError("too_large", 413, max_bytes=DOCUMENT_MAX_BYTES)
    data = bytes(data)
    if not data.startswith(b"PK\x03\x04"):
        raise IntakeError("unsupported_format", 415)
    if not _eocd_at_end(data):
        raise IntakeError("office_invalid", 422)
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
        infos = zf.infolist()
    except (zipfile.BadZipFile, zipfile.LargeZipFile, ValueError, OSError, EOFError, NotImplementedError):
        raise IntakeError("office_invalid", 422) from None
    if not infos or len(infos) > OFFICE_MAX_ENTRIES:
        raise IntakeError("office_refused", 422)
    if min(i.header_offset for i in infos) != 0:
        raise IntakeError("office_invalid", 422)  # bytes before the first entry the directory names (a prepended payload)
    seen: set[str] = set()
    total = 0
    for i in infos:
        name = i.filename
        folded = name.casefold()
        if _bad_name(name) or folded in seen:
            raise IntakeError("office_invalid", 422)
        seen.add(folded)
        if i.flag_bits & 0x1:
            raise IntakeError("office_refused", 422)  # encrypted: nothing can be checked
        if i.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
            raise IntakeError("office_refused", 422)
        if i.file_size < 0 or i.compress_size < 0:
            raise IntakeError("office_invalid", 422)
        total += i.file_size
        if total > OFFICE_MAX_UNCOMPRESSED:
            raise IntakeError("office_refused", 422)  # a ZIP bomb, refused from its directory
        if i.file_size > OFFICE_RATIO_FLOOR and (i.compress_size == 0 or i.file_size > OFFICE_MAX_RATIO * i.compress_size):
            raise IntakeError("office_refused", 422)
        if name.endswith("/"):
            continue
        if _REFUSED_NAME.search(name) or (folded.endswith(".bin") and not _PRINTER_BIN.match(name)):
            raise IntakeError("office_refused", 422)
    names = {i.filename for i in infos}
    mains = [MAIN[n] for n in MAIN if n in names]
    if "[Content_Types].xml" not in names or len(mains) != 1:
        raise IntakeError("office_invalid", 422)
    kind = mains[0]
    budget = [OFFICE_SCAN_BUDGET]

    def read(info: zipfile.ZipInfo, limit: int) -> bytes:
        want = min(limit, budget[0])
        try:
            with zf.open(info) as f:
                out = f.read(want + 1)
        except (zipfile.BadZipFile, ValueError, OSError, EOFError, NotImplementedError, RuntimeError):
            raise IntakeError("office_invalid", 422) from None
        if len(out) > want:
            raise IntakeError("office_refused", 422)  # more than the scan may inflate: refused, never half-checked
        budget[0] -= len(out)
        return out

    types = read(zf.getinfo("[Content_Types].xml"), 1 * MiB)
    if _DTD.search(types) or _REFUSED_TYPES.search(types) or MAIN_TYPE[kind] not in types:
        raise IntakeError("office_refused", 422)
    for info in infos:
        name = info.filename
        if name.endswith("/") or name == "[Content_Types].xml":
            continue
        lower = name.lower()
        if lower.endswith(".rels"):
            body = read(info, 1 * MiB)
            if _DTD.search(body):
                raise IntakeError("office_refused", 422)
            for m in _REL.finditer(body):
                rel = m.group(0)
                t = _REL_TYPE.search(rel)
                rtype = t.group(1) if t else b""
                if _REL_REFUSED_TYPE.search(rtype):
                    raise IntakeError("office_refused", 422)
                if _REL_EXTERNAL.search(rel) and not rtype.rstrip().lower().endswith(b"/hyperlink"):
                    raise IntakeError("office_refused", 422)
        elif (kind == "docx" and _WORD_SCANNED.match(name)) or (kind == "xlsx" and _SHEET_SCANNED.match(name)):
            body = read(info, OFFICE_PART_MAX)
            if _DTD.search(body[:OFFICE_HEAD * 4]):
                raise IntakeError("office_refused", 422)
            if kind == "docx" and _DDE_WORD.search(body):
                raise IntakeError("office_refused", 422)
            if kind == "xlsx" and _FORMULA_PIPE.search(body):
                raise IntakeError("office_refused", 422)
        elif lower.endswith(".xml") or lower.endswith(".vml"):
            if _DTD.search(read(info, OFFICE_HEAD)):
                raise IntakeError("office_refused", 422)
    return FileInfo(kind=kind, bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


# ---------------------------------------------------------------- what a file is (by content)

def kind_of(data: bytes) -> str:
    """'image' | 'pdf' | 'office' by the first bytes; IntakeError 415 (heic_refused / unsupported_format) for anything else."""
    head = bytes(data[:32])
    sniffed = image_intake.sniff(head)
    if sniffed in ("jpeg", "png", "webp"):
        return "image"
    if sniffed == "heic":
        raise IntakeError("heic_refused", 415)
    if sniffed == "pdf":
        return "pdf"
    if head.startswith(b"PK\x03\x04"):
        return "office"
    raise IntakeError("unsupported_format", 415)


def check_size(data: bytes) -> str:
    """Everything decided BEFORE a decode or a scan: the kind by content and its size rule. Returns the coarse kind."""
    if not isinstance(data, (bytes, bytearray)) or not data:
        raise IntakeError("unsupported_format", 415)
    kind = kind_of(data)
    cap = IMAGE_MAX_BYTES if kind == "image" else DOCUMENT_MAX_BYTES
    if len(data) > cap:
        raise IntakeError("too_large", 413, max_bytes=cap)
    return kind


# ---------------------------------------------------------------- names and captions

_WIN_RESERVED = re.compile(r"^(con|prn|aux|nul|com[0-9]|lpt[0-9])$", re.I)
_UNSAFE = re.compile(r'[<>:"/\\|?*]')


def display_name(raw: object, kind: str) -> str:
    """The name shown to managers and vendors: the last path segment only (`../../etc/passwd` -> `passwd`), NFC, no control / bidi /
    zero-width / private characters, no characters a file system refuses, at most NAME_STEM_MAX characters before the extension,
    and ALWAYS the extension of what the content is (a re-encoded picture is a .jpg whatever it was called). Never a storage path."""
    s = raw if isinstance(raw, str) else ""
    s = s.replace("\\", "/").split("/")[-1]
    s = unicodedata.normalize("NFC", s)
    s = "".join(ch for ch in s if unicodedata.category(ch)[0] not in ("C", "Z") or ch == " ")
    stem = s.rsplit(".", 1)[0] if "." in s else s
    stem = _UNSAFE.sub("_", stem).strip(" .")
    stem = re.sub(r"\s+", " ", stem)[:NAME_STEM_MAX].strip(" .")
    if not stem or _WIN_RESERVED.match(stem):
        stem = f"_{stem}" if stem else "file"
    return f"{stem}.{EXT[kind]}"


def clean_caption(raw: object) -> str:
    """An optional one-line caption (<= CAPTION_MAX after cleaning): control / bidi / zero-width characters removed. ValueError when
    it is not text or longer."""
    if raw is None:
        return ""
    if not isinstance(raw, str):
        raise ValueError("caption")
    s = unicodedata.normalize("NFC", raw)
    s = "".join(" " if ch in "\r\n\t" else ch for ch in s if unicodedata.category(ch) not in ("Cc", "Cf", "Co", "Cs", "Cn") or ch in "\r\n\t")
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > CAPTION_MAX:
        raise ValueError("caption")
    return s


# ---------------------------------------------------------------- the stored copy

@dataclass(frozen=True)
class StoredFile:
    kind: str
    mime: str
    rel_path: str
    thumb_rel: str | None
    sha256: str
    bytes: int
    width: int | None = None
    height: int | None = None


def _folder(root: Path, folder: str) -> tuple[Path, str]:
    if not isinstance(folder, str) or not image_intake.ID_RE.fullmatch(folder):
        raise StorePathError("folder is not a plain id")
    rel_dir = f"{folder}/{SUBDIR}"
    path = image_intake.confine(root, Path(root) / rel_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path, rel_dir


def _write(root: Path, folder: str, ext: str, data: bytes) -> str:
    path, rel_dir = _folder(root, folder)
    name = f"{secrets.token_hex(8)}.{ext}"
    image_intake.write_atomic(image_intake.confine(root, path / name), data)
    return f"{rel_dir}/{name}"


def thumbnail(jpeg: bytes) -> bytes:
    """A THUMB_SIDE px JPEG of a picture the pipeline already re-encoded (our own fresh JPEG, never an upload's bytes)."""
    from PIL import Image

    with Image.open(io.BytesIO(jpeg), formats=["JPEG"]) as im:
        im.draft("RGB", (THUMB_SIDE, THUMB_SIDE))
        im = im.convert("RGB")
        im.thumbnail((THUMB_SIDE, THUMB_SIDE), Image.Resampling.LANCZOS)
        clean = Image.new("RGB", im.size)
        clean.paste(im)
        buf = io.BytesIO()
        clean.save(buf, "JPEG", quality=THUMB_QUALITY, optimize=True)
    return buf.getvalue()


def store(root: Path, folder: str, data: bytes, *, wait_s: float = DECODE_WAIT_S) -> StoredFile:
    """Check and write one file of a request. Raises IntakeError (the refusal) or StorePathError. Blocking: run it in a worker
    thread, OUTSIDE the database write lock."""
    coarse = check_size(data)
    if coarse == "image":
        image = image_intake.reencode(data, wait_s=wait_s, semaphore=_DECODE, allow_webp=True)
        try:
            thumb = thumbnail(image.data)
        except Exception:  # noqa: BLE001 - our own JPEG; a failure here is a server fault, answered as an invalid picture
            raise IntakeError("image_invalid", 422) from None
        rel = _write(root, folder, "jpg", image.data)
        try:
            thumb_rel = _write(root, folder, "jpg", thumb)
        except BaseException:
            image_intake.remove_stored(root, rel)
            raise
        return StoredFile("image", MIME["image"], rel, thumb_rel, image.sha256, len(image.data), image.width, image.height)
    if coarse == "pdf":
        info = cost_files.check_pdf(data)
        rel = _write(root, folder, "pdf", bytes(data))
        return StoredFile("pdf", MIME["pdf"], rel, None, info.sha256, info.bytes)
    office = check_office(data)
    rel = _write(root, folder, EXT[office.kind], bytes(data))
    return StoredFile(office.kind, MIME[office.kind], rel, None, office.sha256, office.bytes)


def remove(root: Path, *rel_paths: str | None) -> int:
    n = 0
    for rel in rel_paths:
        if rel and image_intake.remove_stored(root, rel):
            n += 1
    return n


def path_of(root: Path, rel: str) -> Path:
    """The file of a stored row, confined under the attachments root and inside an `rfq` sub-folder (StorePathError otherwise)."""
    if not isinstance(rel, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}/rfq/[0-9a-f]{16}\.(jpg|pdf|docx|xlsx)", rel):
        raise StorePathError("not an rfq file path")
    return image_intake.resolve_stored(root, rel)


# ---------------------------------------------------------------- serving headers

def _ascii_name(ref_number: int, index: str, kind: str) -> str:
    return f"rfq-{int(ref_number):02d}-{re.sub(r'[^A-Za-z0-9]', '', index)[:8] or 'file'}.{EXT[kind]}"


def headers(kind: str, *, ref_number: int, file_id: str, name: str, thumb: bool = False) -> dict[str, str]:
    """A picture (or its thumbnail): a fresh JPEG of ours, inline. Anything else: a DOWNLOAD only - the exact type, attachment, an
    ASCII fallback name plus the cleaned display name as RFC 5987 `filename*`, never sniffed, sandboxed if anything renders it,
    never stored by a shared cache."""
    fallback = _ascii_name(ref_number, file_id, kind)
    if kind == "image":
        return {"Content-Type": MIME["image"], "Content-Disposition": f'inline; filename="{fallback}"', "X-Content-Type-Options": "nosniff",
                "Cache-Control": "private, no-store"}
    encoded = urllib.parse.quote(name if isinstance(name, str) else fallback, safe="")
    return {"Content-Type": MIME[kind], "Content-Disposition": f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{encoded}",
            "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox", "Cache-Control": "private, no-store"}


def limits() -> dict[str, object]:
    """The numbers the manager's form shows and enforces before a byte leaves the browser (the server enforces them anyway)."""
    return {"files": MAX_FILES, "image_bytes": IMAGE_MAX_BYTES, "document_bytes": DOCUMENT_MAX_BYTES, "total_bytes": TOTAL_MAX_BYTES,
            "caption": CAPTION_MAX, "types": ["jpg", "png", "webp", "pdf", "docx", "xlsx"]}
