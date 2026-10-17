"""RFQATT (owner 17.10; docs/tickets/RFQ_BACKEND_CONTRACT.md section 19, docs/changes/CR-RFQ-ATTACHMENTS.md): the FILE side of the
attachments a manager puts on a request for quotation - deciding what a file is from its bytes, the refusal checks, the stored copy,
the display name and the headers a file is served with. The rows, the permissions and who may see what are rfq_attach.py's.

Allow-list (by CONTENT - the declared type and the file name's extension are never trusted):
- pictures: JPEG, PNG, WebP -> the ONE image pipeline (image_intake.reencode, here with `allow_webp`): the structure walk, the pixel
  budget, a metadata-free copy for the decoder, a FRESH JPEG (no EXIF / GPS / ICC / XMP / comments / appended bytes), at most
  2048 px; plus a re-encoded 480 px thumbnail made from that fresh JPEG. The original bytes are never stored or served. 8 MiB.
- PDF -> check_pdf: cost_files.check_pdf (magic at 0, active-content names incl. inflated streams, encryption refused) plus the
  structure rules of review F3 (only whitespace after the last `%%EOF`, no ZIP directory inside - the PDF/ZIP polyglot); stored byte
  for byte, never parsed, rendered or thumbnailed by Arx. 10 MiB.
- DOCX / XLSX (owner 17.10: "common office docs"; behind the installation setting `rfq.attachments.allow_office`, OFF by default ->
  422 `office_disabled`) -> check_office: a plain OOXML package or nothing. The ZIP must start at byte 0 and end with its
  end-of-central-directory record (no prepended or appended bytes), no `%PDF-` in its first KiB and no other format's magic in the
  first entry's header (the polyglot shapes), at most 2000 entries, unique plain names (no absolute path, `..`, backslash, drive or
  NUL), no encryption, stored / deflate only, at most 100 MiB uncompressed and a bounded ratio per entry (a ZIP bomb is refused from
  its directory, before anything is inflated); exactly one main part (`word/document.xml` -> docx, `xl/workbook.xml` -> xlsx)
  declared with exactly the macro-FREE main content type. Every part must carry a content type from an ALLOW-list
  ([Content_Types].xml; review F2): anything else - altChunk MHT / HTML / RTF, data connections, query tables, external links, OLE,
  ActiveX, macros, embedded fonts, EMF / WMF / SVG - is refused (422 `office_refused`), never cleaned. Every XML part is PARSED with
  expat (review F1: character references decoded, a DOCTYPE / ENTITY anywhere refused, no tag-length window) and judged on DECODED
  values: every relationship (refused types in any mode, an external target only for a hyperlink, no URL as an internal target);
  Word field codes joined across their `instrText` runs (DDE / DDEAUTO / INCLUDETEXT / INCLUDEPICTURE / LINK / ... and a field type
  built by a nested field refused); a `|` in any spreadsheet formula location (cells, defined names, tables, validation, conditional
  formats); OLE / ActiveX / altChunk / DDE-link / external-reference / Power Query elements; pivot caches over external data.
  Inflating for the scans is bounded (100 MiB in all, 32 MiB and 2 million elements per part) and runs in this route's decode slot.
  Stored byte for byte; never previewed or converted by Arx. 10 MiB.
- Everything else -> 415 `unsupported_format` (HEIC with its own code, as on the ticket routes).
Like the invoice PDFs, the scans are a FILTER, not a guarantee: the real controls are "never rendered by Arx" and "served only as a
download" (`Content-Disposition: attachment`, the exact type, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`,
and a CSP: `sandbox` on the internal API, the listener's `default-src 'none'` on the public edge). A picture is served inline (it is a
fresh JPEG of our own).

Storage: `<data>/tickets/<folder>/rfq/<16 hex>.<jpg|pdf|docx|xlsx>` (random names, atomic fsync'd writes, confined paths;
image_intake.confine / write_atomic). `folder` is the request's id (the orphan sweep knows the `rfq` sub-folder)."""
from __future__ import annotations

import hashlib
import io
import re
import secrets
import struct
import threading
import unicodedata
import urllib.parse
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

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
OFFICE_PART_MAX = 32 * MiB  # one XML part at most this much inflated
OFFICE_MAX_ELEMENTS = 2_000_000  # elements per XML part (bounds the parse's CPU)
OFFICE_PARSE_CHUNK = 1 * MiB
OFFICE_NAME_MAX = 255
OFFICE_HEAD = 1 * KiB  # a PDF reader accepts `%PDF-` anywhere in the first KiB: never inside an office package's head
MAIN = {"word/document.xml": "docx", "xl/workbook.xml": "xlsx"}
MAIN_TYPE = {"docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
             "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"}
# names refused before anything is read (defence in depth - the content-type allow-list below decides anyway)
_REFUSED_NAME = re.compile(r"(vbaproject|vbadata|/activex/|^activex/|/embeddings/|^embeddings/|macrosheets/|externallinks/|oleobject|"
                           r"^xl/connections\.xml$|querytables/|^word/fonts/|afchunk|"
                           r"\.(exe|dll|com|scr|bat|cmd|ps1|vbs|vbe|js|jse|wsf|wsh|hta|lnk|jar|msi|sh|py|cpl|reg|apk|"
                           r"emf|wmf|emz|wmz|odttf|ttf|otf|fntdata|mht|mhtml|htm|html|xhtml|svg|txt|rtf|data)$)", re.I)
_PRINTER_BIN = re.compile(r"^(word|xl)/printerSettings/printerSettings\d{1,4}\.bin$", re.I)
_DTD = re.compile(rb"<!\s*(DOCTYPE|ENTITY)", re.I)  # over the WHOLE raw part, before the parser (which refuses one as well)
# F2 (review 2.6.4): the content types a package may hold - an ALLOW-list. Anything else (altChunk MHT / HTML / RTF / plain text,
# data connections, query tables, external links, OLE / ActiveX, macros, embedded fonts, EMF / WMF / SVG pictures, signatures, web
# extensions ...) is refused, never cleaned.
_ALLOWED_TYPES = frozenset({
    "application/vnd.openxmlformats-package.relationships+xml",
    "application/vnd.openxmlformats-package.core-properties+xml",
    "application/xml",  # customXml items (parsed: a Power Query DataMashup is refused)
    "application/vnd.openxmlformats-officedocument.spreadsheetml.printersettings",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.printersettings",
    "application/vnd.openxmlformats-officedocument.vmldrawing",  # legacy comment shapes (parsed: OLE objects / macro buttons refused)
    "image/jpeg", "image/png", "image/gif", "image/bmp", "image/tiff",
    "application/vnd.ms-office.chartstyle+xml", "application/vnd.ms-office.chartcolorstyle+xml",
    "application/vnd.ms-office.drawingml.diagramdrawing+xml",
    "application/vnd.ms-word.styleswitheffects+xml", "application/vnd.ms-word.commentsextended+xml",
    "application/vnd.ms-word.commentsids+xml", "application/vnd.ms-word.commentsextensible+xml", "application/vnd.ms-word.people+xml",
    "application/vnd.ms-excel.person+xml", "application/vnd.ms-excel.threadedcomments+xml", "application/vnd.ms-excel.sheetmetadata+xml",
})
_ALLOWED_OOXML = re.compile(r"application/vnd\.openxmlformats-officedocument\.(wordprocessingml|spreadsheetml|drawingml|drawing|theme|"
                            r"themeoverride|extended-properties|custom-properties|customxmlproperties)(\.[a-z0-9-]+)*\+xml")
_REFUSED_OOXML = re.compile(r"connections|querytable|externallink|oleobject|activex|control|macro|vba|template|mailmerge|revisionlog|"
                            r"revisionheaders|usernames|volatiledependencies")
# relationship types refused by their last path segment, whatever the mode (decoded, case-insensitive)
_REFUSED_REL = frozenset({
    "attachedtemplate", "oleobject", "activex", "activexcontrolbinary", "vbaproject", "vbaprojectsignature", "wordvbadata", "frame",
    "subdocument", "externallink", "externallinkpath", "package", "control", "afchunk", "connections", "querytable", "font",
    "mailmergesource", "mailmergeheadersource", "recipientdata", "datasource", "webextension", "webextensiontaskpanes", "taskpanes",
    "attachedtoolbars", "customization", "keymapcustomizations", "xlmacrosheet", "xlintlmacrosheet", "macrosheet", "intlmacrosheet",
    "dialogsheet", "usernames", "revisionheaders", "volatiledependencies", "rdrichvaluewebimage"})
# elements refused wherever they appear (decoded local names): OLE / ActiveX / alternative-format imports / DDE and external workbook
# links / Power Query / VML macro buttons
_REFUSED_ELEMENTS = frozenset({"altChunk", "subDoc", "OLEObject", "oleObject", "oleObjects", "control", "controls", "ddeLink", "oleLink",
                               "externalReference", "externalReferences", "DataMashup", "FmlaMacro", "webPublishItems"})
# F1: Word field types that run, fetch or link (judged on the JOINED field code - every instrText run of one field)
_REFUSED_FIELDS = frozenset({"DDE", "DDEAUTO", "INCLUDETEXT", "INCLUDEPICTURE", "LINK", "EMBED", "IMPORT", "DATABASE", "PRINT",
                             "MACROBUTTON", "RD", "AUTOTEXTLIST"})
# F1: spreadsheet formula locations (cells, defined names, tables, data validation, conditional formats, extension lists)
_FORMULA_ELEMENTS = frozenset({"f", "definedName", "formula", "formula1", "formula2", "calculatedColumnFormula", "totalsRowFormula"})
_HEAD_MAGIC = (b"%PDF-", b"\xff\xd8\xff", b"\x89PNG", b"GIF8", b"<html", b"<HTML", b"<script")
_URL_TARGET = re.compile(r"^[a-z][a-z0-9+.-]*:", re.I)
_VML_BR = re.compile(rb"<br\s*>", re.I)


@dataclass(frozen=True)
class FileInfo:
    kind: str
    bytes: int
    sha256: str


class _Refused(Exception):
    """An office part carries something refused (-> 422 office_refused)."""


def _bad_name(name: str) -> bool:
    return (not name or len(name) > OFFICE_NAME_MAX or name.startswith("/") or "\\" in name or "\x00" in name or ":" in name
            or ".." in name.split("/"))


def _eocd_at_end(data: bytes) -> bool:
    """The classic end-of-central-directory record is the file's last 22 bytes with an empty comment (no appended bytes). A ZIP64
    archive also ends with that record (its ZIP64 record and locator sit before it), so it is NOT refused here: `zipfile` reads it,
    the entry count and the sizes are judged from the directory either way, and a 10 MiB upload never needs ZIP64."""
    return len(data) >= 22 and data[-22:-18] == b"PK\x05\x06" and data[-2:] == b"\x00\x00"


def _local(name: str) -> str:
    return name.rsplit("}", 1)[-1]


def _parse(body: bytes, start: Callable[[str, dict[str, str]], None], end: Callable[[str, str], None] | None = None,
           text_of: frozenset[str] = frozenset()) -> None:
    """Parse one XML part with expat: character references are DECODED, attribute whitespace is irrelevant, a DOCTYPE / ENTITY
    anywhere is refused (so no entity is ever defined or expanded), namespaces are resolved (names arrive as `uri}local`; the
    judges read local names, whatever the prefix). `start(local, attrs)`; `end(local, text)` gets the joined text of elements whose
    local name is in `text_of`. Raises _Refused, or IntakeError 422 office_invalid for XML that is not well-formed."""
    from xml.parsers import expat

    p = expat.ParserCreate(namespace_separator="}")
    p.buffer_text = True
    p.SetParamEntityParsing(expat.XML_PARAM_ENTITY_PARSING_NEVER)
    count = [0]
    stack: list[tuple[str, list[str] | None]] = []

    def refuse_dtd(*_a: object) -> None:
        raise _Refused("dtd")

    def on_start(name: str, attrs: dict[str, str]) -> None:
        count[0] += 1
        if count[0] > OFFICE_MAX_ELEMENTS:
            raise _Refused("elements")
        local = _local(name)
        if local in _REFUSED_ELEMENTS:
            raise _Refused(local)
        start(local, {_local(k): v for k, v in attrs.items()})
        stack.append((local, [] if local in text_of else None))

    def on_end(_name: str) -> None:
        local, buf = stack.pop()
        if end is not None:
            end(local, "".join(buf) if buf is not None else "")

    def on_text(data: str) -> None:
        for _n, buf in reversed(stack):
            if buf is not None:
                buf.append(data)
                return

    p.StartDoctypeDeclHandler = refuse_dtd
    p.EntityDeclHandler = refuse_dtd
    p.ExternalEntityRefHandler = refuse_dtd
    p.StartElementHandler = on_start
    p.EndElementHandler = on_end
    p.CharacterDataHandler = on_text
    try:
        view = memoryview(body)
        for i in range(0, len(body), OFFICE_PARSE_CHUNK):
            p.Parse(bytes(view[i:i + OFFICE_PARSE_CHUNK]), False)
        p.Parse(b"", True)
    except expat.ExpatError:
        raise IntakeError("office_invalid", 422) from None


def _content_types(body: bytes) -> tuple[dict[str, str], dict[str, str]]:
    """[Content_Types].xml -> (extension defaults, part-name overrides), both keyed lower-case (OPC names are case-insensitive)."""
    defaults: dict[str, str] = {}
    overrides: dict[str, str] = {}

    def start(local: str, a: dict[str, str]) -> None:
        if local == "Default":
            key, table = (a.get("Extension") or "").strip().lower(), defaults
        elif local == "Override":
            key, table = (a.get("PartName") or "").strip().lower(), overrides
        else:
            return
        ctype = (a.get("ContentType") or "").strip().lower()
        if not key or not ctype or table.get(key, ctype) != ctype:
            raise IntakeError("office_invalid", 422)
        table[key] = ctype

    _parse(body, start)
    return defaults, overrides


def _type_allowed(ctype: str) -> bool:
    if ctype in _ALLOWED_TYPES:
        return True
    return bool(_ALLOWED_OOXML.fullmatch(ctype)) and not _REFUSED_OOXML.search(ctype)


def _check_rels(body: bytes) -> None:
    """F1: EVERY Relationship element (no tag-length window), its DECODED Type and TargetMode: a refused type in any mode; an
    external target only for a hyperlink; an internal target never a URL or a UNC path."""
    def start(local: str, a: dict[str, str]) -> None:
        if local != "Relationship":
            return
        rtype = (a.get("Type") or "").strip().lower().rstrip("/").rsplit("/", 1)[-1]
        if rtype in _REFUSED_REL:
            raise _Refused(rtype)
        external = (a.get("TargetMode") or "").strip().lower() == "external"
        target = (a.get("Target") or "").strip()
        if external and rtype != "hyperlink":
            raise _Refused("external")
        if not external and (target.startswith(("\\\\", "//")) or _URL_TARGET.match(target)):
            raise _Refused("internal_url")

    _parse(body, start)


class _Fields:
    """F1: Word field codes as Word reads them - the text of every `instrText` (and `delInstrText`) run between a field's begin and
    separate marks is JOINED before it is judged (`DD` + `EAUTO` in two runs is one `DDEAUTO`); `fldSimple@instr` likewise. A field
    whose type would come from a nested field (`{ {QUOTE 68 68 69 ...} ... }`, the 2017 obfuscation) is refused."""

    TEXT = frozenset({"instrText", "delInstrText"})

    def __init__(self) -> None:
        self.stack: list[dict[str, Any]] = []
        self.orphans: list[str] = []

    @staticmethod
    def judge(instr: str, computed: bool = False) -> None:
        if computed:
            raise _Refused("computed_field")
        m = re.match(r"\s*=?\s*([A-Za-z]+)", instr or "")
        if m and m.group(1).upper() in _REFUSED_FIELDS:
            raise _Refused("field")

    def start(self, local: str, a: dict[str, str]) -> None:
        if "instr" in a:
            self.judge(a["instr"])
        if local != "fldChar":
            return
        kind = (a.get("fldCharType") or "").strip()
        if kind == "begin":
            if self.stack and self.stack[-1]["instr_phase"] and not "".join(self.stack[-1]["instr"]).strip():
                self.stack[-1]["computed"] = True
            self.stack.append({"instr": [], "instr_phase": True, "computed": False})
        elif kind == "separate" and self.stack:
            self.stack[-1]["instr_phase"] = False
        elif kind == "end" and self.stack:
            f = self.stack.pop()
            self.judge("".join(f["instr"]), f["computed"])

    def end(self, local: str, text: str) -> None:
        if local in self.TEXT:
            if self.stack and self.stack[-1]["instr_phase"]:
                self.stack[-1]["instr"].append(text)
            else:
                self.orphans.append(text)

    def finish(self) -> None:
        for f in self.stack:
            self.judge("".join(f["instr"]), f["computed"])
        self.judge("".join(self.orphans))


def _check_word_part(body: bytes) -> None:
    fields = _Fields()
    _parse(body, fields.start, fields.end, _Fields.TEXT)
    fields.finish()


def _check_sheet_part(body: bytes) -> None:
    """F1: a `|` in ANY formula location (the DDE shape `cmd|' /c calc'!A0`, decoded); F2: external data behind a pivot cache."""
    def start(local: str, a: dict[str, str]) -> None:
        if local == "cacheSource" and ((a.get("type") or "worksheet").strip() != "worksheet" or "connectionId" in a):
            raise _Refused("pivot_external")

    def end(local: str, text: str) -> None:
        if local in _FORMULA_ELEMENTS and "|" in text:
            raise _Refused("formula_pipe")

    _parse(body, start, end, _FORMULA_ELEMENTS)


def _head_polyglot(data: bytes) -> bool:
    """F3: no PDF header in the first KiB (where a PDF reader looks for it) and no other format's magic in the first entry's name or
    extra field (the first entry starts at byte 0 - checked by the caller)."""
    if b"%PDF-" in data[:OFFICE_HEAD]:
        return True
    if len(data) < 30:
        return False
    name_len, extra_len = struct.unpack("<HH", data[26:30])
    field = data[30:30 + name_len + extra_len]
    return any(m in field for m in _HEAD_MAGIC)


def check_office(data: bytes) -> FileInfo:
    """Accept a plain DOCX / XLSX (module docstring), or IntakeError: 413 `too_large`, 415 `unsupported_format`, 422
    `office_invalid` (not a well-formed package), 422 `office_refused` (active content, an external reference, a part outside the
    content-type allow-list, a polyglot head, a ZIP bomb). Every XML part is PARSED (expat, DTDs refused) and judged on decoded
    values - never grepped."""
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
    if _head_polyglot(data):
        raise IntakeError("office_refused", 422)
    seen: set[str] = set()
    total = 0
    name_refused = False
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
            name_refused = True
    names = {i.filename for i in infos}
    mains = [n for n in MAIN if n in names]
    if "[Content_Types].xml" not in names or len(mains) != 1:
        raise IntakeError("office_invalid", 422)  # not an office document at all
    if name_refused:
        raise IntakeError("office_refused", 422)
    kind = MAIN[mains[0]]
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
        if _DTD.search(out):
            raise _Refused("dtd")  # anywhere in the part (comments / PIs before it hide nothing)
        return out

    try:
        defaults, overrides = _content_types(read(zf.getinfo("[Content_Types].xml"), 1 * MiB))
        if overrides.get("/" + mains[0]) != MAIN_TYPE[kind]:
            raise _Refused("main_type")  # exactly the macro-free main type (a macroEnabled one is not on the list either)
        if not all(_type_allowed(t) for t in (*defaults.values(), *overrides.values())):
            raise _Refused("declared_type")  # every DECLARED type is on the allow-list, used by a part or not
        for info in infos:
            name = info.filename
            if name.endswith("/") or name == "[Content_Types].xml":
                continue
            lower = name.lower()
            leaf = lower.rsplit("/", 1)[-1]
            ctype = overrides.get("/" + lower) or defaults.get(leaf.rsplit(".", 1)[-1] if "." in leaf else "")
            if not ctype or not _type_allowed(ctype):
                raise _Refused("type")  # F2: a part outside the allow-list, or with no declared type at all
            if lower.endswith(".rels"):
                if ctype != "application/vnd.openxmlformats-package.relationships+xml":
                    raise _Refused("rels_type")
                _check_rels(read(info, 1 * MiB))
            elif ctype.endswith("+xml") or ctype in ("application/xml", "application/vnd.openxmlformats-officedocument.vmldrawing"):
                body = read(info, OFFICE_PART_MAX)
                if ctype == "application/vnd.openxmlformats-officedocument.vmldrawing":
                    body = _VML_BR.sub(b"<br/>", body)  # Excel writes legacy VML with unclosed <br> (as Apache POI also tolerates)
                if kind == "docx":
                    _check_word_part(body)
                else:
                    _check_sheet_part(body)
    except _Refused:
        raise IntakeError("office_refused", 422) from None
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
    thumb_bytes: int = 0

    @property
    def stored_bytes(self) -> int:
        """Everything written to disk for this file (the storage cap's accounting, F6)."""
        return self.bytes + self.thumb_bytes


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


PDF_TAIL_WHITESPACE = b" \t\r\n\f\x00"


def check_pdf(data: bytes) -> cost_files.PdfInfo:
    """cost_files.check_pdf (magic at 0, active-content names, encryption) plus F3's STRUCTURE rules for a file other people will
    open: nothing but whitespace after the LAST `%%EOF` (no appended payload, whatever re-appends a trailer), and no ZIP central
    directory + end record anywhere in the bytes (a PDF/ZIP - PDF/JAR, PDF/DOCX - polyglot). 422 `pdf_invalid` / `pdf_refused`."""
    info = cost_files.check_pdf(data)
    raw = bytes(data)
    end = raw.rfind(b"%%EOF")
    if end < 0 or raw[end + 5:].strip(PDF_TAIL_WHITESPACE):
        raise IntakeError("pdf_invalid", 422)
    if b"PK\x05\x06" in raw and b"PK\x01\x02" in raw:
        raise IntakeError("pdf_refused", 422)
    return info


def store(root: Path, folder: str, data: bytes, *, wait_s: float = DECODE_WAIT_S, allow_office: bool = True, allow_webp: bool = True,
          semaphore: threading.BoundedSemaphore | None = None) -> StoredFile:
    """Check and write one file of a request. Raises IntakeError (the refusal) or StorePathError. Blocking: run it in a worker
    thread, OUTSIDE the database write lock. `allow_office` is the installation setting `rfq.attachments.allow_office` (OFF by
    default; the route passes it): without it a Word / Excel package is refused (422 `office_disabled`) before it is scanned.
    RFQ-VENDOR-UPLOAD (contract 19.10): the vendor's PUBLIC upload calls this same function - the same checks, the same stored
    shapes - with `allow_webp=False` (the public routes keep refusing WebP, decision 6) and `semaphore` = the public listener's
    decode slot (image_intake's own, shared with the anonymous photo uploads), so a vendor never takes the managers' slot."""
    sem = semaphore or _DECODE
    coarse = check_size(data)
    if coarse == "office" and not allow_office:
        raise IntakeError("office_disabled", 422)
    if coarse == "image":
        image = image_intake.reencode(data, wait_s=wait_s, semaphore=sem, allow_webp=allow_webp)
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
        return StoredFile("image", MIME["image"], rel, thumb_rel, image.sha256, len(image.data), image.width, image.height, len(thumb))
    if coarse == "pdf":
        info = check_pdf(data)
        rel = _write(root, folder, "pdf", bytes(data))
        return StoredFile("pdf", MIME["pdf"], rel, None, info.sha256, info.bytes)
    with image_intake.decode_slot(wait_s, sem):  # F9: the inflate + parse takes this route's slot (a burst never fills the pool)
        office = check_office(data)
    rel = _write(root, folder, EXT[office.kind], bytes(data))
    return StoredFile(office.kind, MIME[office.kind], rel, None, office.sha256, office.bytes)


def size_of(root: Path, *rel_paths: str | None) -> int:
    """The bytes the stored files take now (0 for a missing one) - measured before a removal, for the storage accounting (F6)."""
    total = 0
    for rel in rel_paths:
        if rel:
            try:
                total += path_of(root, rel).stat().st_size
            except (ValueError, OSError):
                pass
    return total


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
    never stored by a shared cache. F7: `Content-Security-Policy: sandbox` reaches the INTERNAL API only (the remote channel keeps a
    route CSP); the public edge replaces every route CSP with the listener's `default-src 'none'; ...` (public_http.final_headers),
    which is at least as strict for a download."""
    fallback = _ascii_name(ref_number, file_id, kind)
    if kind == "image":
        return {"Content-Type": MIME["image"], "Content-Disposition": f'inline; filename="{fallback}"', "X-Content-Type-Options": "nosniff",
                "Cache-Control": "private, no-store"}
    encoded = urllib.parse.quote(name if isinstance(name, str) else fallback, safe="")
    return {"Content-Type": MIME[kind], "Content-Disposition": f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{encoded}",
            "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox", "Cache-Control": "private, no-store"}


def vendor_headers(kind: str, *, ref_number: int, file_id: str, name: str, thumb: bool = False) -> dict[str, str]:
    """RFQ-VENDOR-UPLOAD (contract 19.10): a file a VENDOR uploaded, as the managers receive it - ALWAYS a download (`attachment`,
    a picture and its thumbnail too: an `<img>` still shows it, a click never opens it inside the app's origin), the exact type,
    `nosniff`, `Content-Security-Policy: sandbox` (the internal API keeps a route CSP) and `private, no-store`."""
    shown = "image" if thumb else kind
    fallback = _ascii_name(ref_number, file_id, shown)
    shown_name = (f"thumb-{fallback}" if thumb else name) if isinstance(name, str) else fallback
    encoded = urllib.parse.quote(shown_name, safe="")
    return {"Content-Type": MIME[shown], "Content-Disposition": f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{encoded}",
            "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox", "Cache-Control": "private, no-store"}


def limits(allow_office: bool = False) -> dict[str, object]:
    """The numbers the manager's form shows and enforces before a byte leaves the browser (the server enforces them anyway).
    `types` lists Word / Excel only while the installation setting `rfq.attachments.allow_office` is on."""
    types = ["jpg", "png", "webp", "pdf"] + (["docx", "xlsx"] if allow_office else [])
    return {"files": MAX_FILES, "image_bytes": IMAGE_MAX_BYTES, "document_bytes": DOCUMENT_MAX_BYTES, "total_bytes": TOTAL_MAX_BYTES,
            "caption": CAPTION_MAX, "types": types, "office": bool(allow_office)}


def office_allowed(conn) -> bool:
    """The installation setting `rfq.attachments.allow_office` (tickets.settings, system.configure; OFF by default - owner question 1,
    decided by the lead 17.10: Word / Excel stay available behind it until the hardened checks are verified)."""
    from . import settings_doc

    try:
        return bool(settings_doc.read(conn)["rfq"]["attachments"]["allow_office"])
    except (KeyError, TypeError):
        return False


def is_office(kind: str) -> bool:
    return kind in ("docx", "xlsx")
