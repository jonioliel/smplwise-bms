"""CR-038 section 11A.6 / 11A.6A: invoice and receipt files of a vendor's cost claim - PDF acceptance checks, the document
grouping of photographed pages, and the headers a file is served with. Slice 9 owns the claim routes and rows; this module is
the file side they call.

PDFs (11A.6) - a PDF cannot be re-encoded without a renderer, which the add-on does not have and will not add, so:
- accepted only with `%PDF-` at offset 0 and an `%%EOF` within the last 1 KiB, at most 10 MiB;
- refused (422 `pdf_refused`) when its bytes name `/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile`, `/RichMedia`, `/XFA`,
  `/OpenAction`, `/AA` or `/Encrypt` (an encrypted file cannot be scanned at all). The scan reads every PDF NAME token of the
  file and compares it exactly after decoding `#xx` escapes - so `/J#61vaScript` is caught, and `/JSON` or `/AAPL` are not
  mistaken for `/JS` / `/AA` as a plain substring search would; a name with a `#` that is not a two-digit escape
  (`/J#avaScript`) is refused too - some readers are lenient about it;
- every FlateDecode (zlib) stream is INFLATED, within a bound, and its bytes scanned the same way (code review V7: PDF 1.5+
  writers - Word, Chrome, LibreOffice - put every object, an `/OpenAction` included, in compressed object streams, which a
  byte scan alone never sees). The bound: all streams of a file together inflate to at most max(8 x the file, 4 MiB) and
  never more than 32 MiB, at most 4000 streams - past it the file is refused (no invoice comes near it; an inflate bomb
  buys no CPU or memory). A stream that is not valid zlib is scanned as far as it inflates. Deep review 2026-10-15: the
  `stream` keyword is recognised before CR LF, LF, a lone CR and trailing blanks (A1); a direct /Length that lands on a later
  `endstream` extends the inflated span (A3); a stream dictionary naming a /Predictor (except a cross-reference stream or an
  image XObject), indirect /DecodeParms or /Filter, or a /Filter array with FlateDecode twice is refused, and output that is
  itself a zlib stream is inflated again (up to 4 layers) and scanned (A2);
- KNOWN LIMIT, stated plainly: streams under other filters (LZW, ASCII85, ASCIIHex, RunLength) are not decoded, nor the
  predictor-coded rows of a cross-reference stream or an image. The scan is a FILTER, NOT A GUARANTEE. The real controls are
  the next two rules;
- stored under a random name in `<data>/tickets/<ticket_id>/costs/`, and never parsed, rendered, thumbnailed or previewed by Arx;
- served only as a DOWNLOAD to authorised internal users: `Content-Type: application/pdf`, `Content-Disposition: attachment`,
  `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, `Cache-Control: private, no-store`
  (`pdf_download_headers`); the vendor page shows only the name and size of its own files and offers no download.
  Residual (spec S25): a malicious PDF can still reach a reviewer's own PDF viewer - the guide says to keep it up to date.

Photographed pages (11A.6A) are ordinary images: every page goes through image_intake.reencode (16 MP, re-encode, no EXIF);
client-side cropping / contrast is a convenience, never a trust boundary.

Limits per claim revision (11A.2): at most 3 documents, each ONE PDF or up to 10 photographed pages, at most 25 files in total;
the same file (same SHA-256) twice in one claim is refused (`duplicate_file`). Pending uploads live 24 h, at most 30 pending files
and 64 MiB per link (deep review A5) and 40 uploads an hour per link (the public rate gate)."""
from __future__ import annotations

import hashlib
import re
import zlib
from dataclasses import dataclass
from typing import Iterator, Mapping, Sequence

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
_BAD_ESCAPE_RE = re.compile(rb"#(?![0-9A-Fa-f]{2})")
MAX_ESCAPED_NAMES = 2000
# the bounded inflate of FlateDecode streams (code review V7)
INFLATE_RATIO = 8
INFLATE_MIN = 4 * MiB
INFLATE_MAX = 32 * MiB
MAX_STREAMS = 4000
MAX_FLATE_DEPTH = 4  # output that is itself a zlib stream is inflated again, at most this many layers (deep review A2)
# the `stream` keyword and its end of line: CR LF or LF per ISO 32000-1 7.3.8.1, plus the lone CR and trailing blanks lenient
# readers accept (deep review A1: `stream\r` and `stream \r\n` were skipped)
_STREAM_RE = re.compile(rb"stream[ \t]*(?:\r\n|\r|\n)")
# the stream dictionary is read back from the `stream` keyword to the nearest `obj` (at most this far)
_DICT_WINDOW = 8 * KiB
_WS = rb"[\x00\t\n\x0c\r ]"
# a direct integer /Length (not `/Length 12 0 R`): deep review A3
_LENGTH_RE = re.compile(rb"/Length" + _WS + rb"{1,16}(\d{1,10})(?!\d)(?!" + _WS + rb"{1,16}\d{1,10}" + _WS + rb"{1,16}R)")
_ENDSTREAM_RE = re.compile(_WS + rb"{0,16}endstream")
_PREDICTOR_RE = re.compile(rb"/Predictor(?=[" + _DELIM + rb"]|\Z)")
_TYPE_RE = re.compile(rb"/Type" + _WS + rb"*/([^" + _DELIM + rb"]*)")
_SUBTYPE_RE = re.compile(rb"/Subtype" + _WS + rb"*/([^" + _DELIM + rb"]*)")
# `N G ` right before an `obj` keyword (searched in the 64 bytes before it, anchored at its end): the object header
_HEADER_BEFORE_RE = re.compile(rb"[" + _DELIM + rb"]\d{1,10}" + _WS + rb"{1,16}\d{1,10}" + _WS + rb"{1,16}\Z")
_DELIM_BYTES = frozenset(b"\x00\t\n\x0c\r ()<>[]{}/%")
_MAX_HEADER_TRIES = 8
# every pattern below is bounded (no unbounded repeat that can backtrack across a crafted 8 KiB window)
_REF = rb"\d{1,10}" + _WS + rb"{1,16}\d{1,10}" + _WS + rb"{1,16}R(?=[" + _DELIM + rb"]|\Z)"
_REF_RE = re.compile(_REF)
_FILTER_REF_RE = re.compile(rb"/Filter" + _WS + rb"{0,16}" + _REF)
_PARMS_REF_RE = re.compile(rb"/DecodeParms" + _WS + rb"{0,16}" + _REF)
_ARRAY_OF_RE = re.compile(rb"/(Filter|DecodeParms)" + _WS + rb"{0,16}\[")
_ARRAY_MAX = 512  # a /Filter or /DecodeParms array longer than this (no `]` within it) is refused
_FLATE_NAME_RE = re.compile(rb"/(?:FlateDecode|Fl)(?=[" + _DELIM + rb"]|\Z)")

MAX_DOCUMENTS = 3
MAX_PAGES = 10
MAX_FILES = 25
PENDING_TTL_S = 24 * 3600.0
MAX_PENDING_PER_LINK = 30
MAX_PENDING_BYTES_PER_LINK = 64 * MiB  # deep review A5: the bytes cap next to the count
DOCUMENT_KEY_RE = re.compile(r"[A-Za-z0-9_-]{1,32}")


@dataclass(frozen=True)
class PdfInfo:
    bytes: int
    sha256: str


def _decoded_name(raw: bytes) -> bytes:
    return _HEX_ESCAPE_RE.sub(lambda m: bytes([int(m.group(1), 16)]), raw)


def active_markers(data: bytes, escapes: list[int] | None = None) -> set[str]:
    """The refused names that appear as whole PDF name tokens anywhere in `data` - plainly or with `#xx` escapes - plus
    "(escape)" for a name with a malformed `#` escape. More than MAX_ESCAPED_NAMES escaped names (counted across every call
    that shares `escapes`, a one-element list: the whole file and its inflated streams) answers {"(escapes)"} (no invoice needs
    that many; scanning them all would let a crafted file buy seconds of CPU per upload)."""
    budget = escapes if escapes is not None else [MAX_ESCAPED_NAMES]
    found = {m.group(0)[1:].decode("ascii") for m in _PLAIN_RE.finditer(data)}
    if b"#" in data:
        for m in _ESCAPED_RE.finditer(data):
            if budget[0] <= 0:
                found.add("(escapes)")
                break
            budget[0] -= 1
            raw = m.group(0)[1:]
            if _BAD_ESCAPE_RE.search(raw):
                found.add("(escape)")
                continue
            name = _decoded_name(raw)
            if name in ACTIVE_NAMES:
                found.add(name.decode("ascii", "replace"))
    return found


def _zlib_header(buf: bytes, at: int = 0) -> bool:
    if at + 2 > len(buf):
        return False
    cmf, flg = buf[at], buf[at + 1]
    return cmf & 0x0F == 8 and cmf >> 4 <= 7 and (cmf * 256 + flg) % 31 == 0


def _stream_dictionary(data: bytes, keyword_at: int) -> tuple[bytes, bool]:
    """(the stream's dictionary with `#xx` name escapes decoded - so `/Pr#65dictor` reads as `/Predictor` -, trusted). The
    dictionary is the text from the last object header (`N G obj`) within _DICT_WINDOW bytes before the `stream` keyword.
    No tokenizer runs here, so a header can be faked inside a literal string (`(1 0 obj)`) to cut the dictionary short: when
    the text after the header does not balance its parentheses (backslash escapes honoured - a header faked inside a string
    leaves that string's closing parenthesis unmatched after it), or no header is found, the whole window is returned instead
    and marked untrusted (no exemption is granted on it - a fake only makes the check stricter). Balanced literal strings are
    fine (some writers put `/ID [(..)(..)]` in a cross-reference stream's dictionary).
    Residual, stated: a dictionary deliberately broken with BARE header tokens (`... /Predictor 12 >> 7 0 obj /Type /XRef`)
    is read from the fake header on; only a real tokenizer would see through it. The download-only rule stays the control."""
    lo = max(0, keyword_at - _DICT_WINDOW)
    header_end = _last_header_end(data, lo, keyword_at)
    if header_end >= 0:
        narrow = data[header_end:keyword_at]
        if _parens_balanced(narrow):
            return _decoded_name(narrow), True
    return _decoded_name(data[lo:keyword_at]), False


def _last_header_end(data: bytes, lo: int, hi: int) -> int:
    """The end of the last `N G obj` header in data[lo:hi], or -1. Searched BACKWARD from the `obj` keywords (a C-level rfind),
    at most _MAX_HEADER_TRIES candidates - a window crafted full of numbers or `obj` words costs a few probes, then counts as
    "no header" (untrusted: stricter, never looser)."""
    pos = hi
    for _ in range(_MAX_HEADER_TRIES):
        pos = data.rfind(b"obj", lo, pos)
        if pos < 0:
            return -1
        end = pos + 3
        if (end == len(data) or data[end] in _DELIM_BYTES) and _HEADER_BEFORE_RE.search(data, max(lo, pos - 64), pos):
            return end
    return -1


_STRING_BYTES_RE = re.compile(rb"[()\\]")
_MAX_STRING_BYTES = 256  # more parentheses / backslashes than this in one stream dictionary: untrusted (bounds the loop)


def _parens_balanced(text: bytes) -> bool:
    """True when every literal string of `text` closes inside it (escape-aware) - so `text` did not begin inside a string.
    A backslash outside a string is not PDF syntax and answers False (it could be the escape of a string begun earlier)."""
    marks = text.count(b"(") + text.count(b")") + text.count(b"\\")
    if not marks:
        return True
    if marks > _MAX_STRING_BYTES:
        return False
    depth = 0
    skip_at = -1
    for m in _STRING_BYTES_RE.finditer(text):
        at, c = m.start(), text[m.start()]
        if at == skip_at:
            continue  # the byte a backslash escapes
        if c == 0x5C:
            if not depth:
                return False
            skip_at = at + 1
        elif c == 0x28:
            depth += 1
        else:
            depth -= 1
            if depth < 0:
                return False
    return depth == 0


def _predictor_exempt(d: bytes) -> bool:
    """A predictor is allowed only where it cannot hide objects (deep review A2: refused "in object streams", read fail-closed:
    every stream that is not one of these two kinds):
    - a cross-reference stream: exactly one /Type and it is /XRef, no /Subtype (every PDF 1.5+ writer puts a PNG predictor on
      it; it holds offsets);
    - an image XObject: /Type absent or exactly /XObject, exactly one /Subtype and it is /Image, /Width and /Height present
      (PNG images embedded by iText / PDFBox keep their predictor-coded rows; image samples are not parsed as objects).
    Residual, stated: a reader that ignores /Type when it opens an object stream could be fed a predictor-coded object stream
    labelled as one of these; the download-only rule stays the control (spec S25)."""
    types = _TYPE_RE.findall(d)
    subtypes = _SUBTYPE_RE.findall(d)
    if types == [b"XRef"] and not subtypes:
        return True
    return types in ([], [b"XObject"]) and subtypes == [b"Image"] and b"/Width" in d and b"/Height" in d


def _refused_dictionary(d: bytes, trusted: bool) -> bool:
    """Deep review A2: a stream dictionary the scan cannot see through. A PNG / TIFF predictor scrambles the inflated bytes so
    no name token stays visible - refused unless `_predictor_exempt` (on a trusted dictionary only). Decode parameters or a
    filter held in another object (`9 0 R`) could hide either trick - refused. A /Filter array naming FlateDecode more than
    once - refused (no invoice writer produces a double layer)."""
    if _PREDICTOR_RE.search(d) and not (trusted and _predictor_exempt(d)):
        return True
    if _PARMS_REF_RE.search(d) or _FILTER_REF_RE.search(d):
        return True
    for m in _ARRAY_OF_RE.finditer(d):
        close = d.find(b"]", m.end(), m.end() + _ARRAY_MAX)
        if close < 0:
            return True  # an array the bounded check cannot see the end of
        items = d[m.end():close]
        if m.group(1) == b"Filter" and len(_FLATE_NAME_RE.findall(items)) > 1:
            return True
        if m.group(1) == b"DecodeParms" and _REF_RE.search(items):
            return True
    return False


def _stream_end(data: bytes, start: int, d: bytes) -> int:
    """Deep review A3: where the stream's bytes end. The first `endstream` literal - and, when the dictionary holds a direct
    integer /Length whose end lands on (whitespace +) `endstream`, the LATER of the two: an `endstream` inside a stored deflate
    block cannot cut the scan short while a /Length-driven reader keeps reading. (Inflating the longer span sees everything the
    shorter one does: deflate output is a prefix stream.)"""
    n = len(data)
    lit = data.find(b"endstream", start)
    end = lit if lit >= 0 else n
    for m in _LENGTH_RE.finditer(d):
        stop = start + int(m.group(1))
        if stop <= n and _ENDSTREAM_RE.match(data, stop):
            end = max(end, stop)
    return end


def inflated_streams(data: bytes) -> Iterator[bytes]:
    """The inflated bytes of every zlib (FlateDecode) stream of `data`, in order, within the bound of the module docstring
    (IntakeError 422 `pdf_refused` past it). A stream is recognised by the `stream` keyword (any end of line, A1) and a valid
    zlib header after it; it ends at the next `endstream`, or at a direct /Length landing on a later one (A3). Its dictionary
    must not name a predictor (cross-reference streams excepted), indirect decode parameters / filters or a double Flate
    layer (A2: 422 `pdf_refused`). Output that is itself a zlib stream is inflated again, up to MAX_FLATE_DEPTH layers, each
    layer yielded and counted against the same bound. Corrupt zlib data yields what inflated before the error."""
    budget = min(INFLATE_MAX, max(INFLATE_MIN, INFLATE_RATIO * len(data)))
    streams = 0
    n = len(data)
    for m in _STREAM_RE.finditer(data):
        start = m.end()
        if start + 2 > n:
            break
        if not _zlib_header(data, start):
            continue  # not a zlib stream (a JPEG image, a plain content stream, the `stream` of an `endstream`)
        streams += 1
        if streams > MAX_STREAMS:
            raise IntakeError("pdf_refused", 422)
        d, trusted = _stream_dictionary(data, m.start())
        if _refused_dictionary(d, trusted):
            raise IntakeError("pdf_refused", 422)
        layer = data[start:_stream_end(data, start, d)]
        for depth in range(MAX_FLATE_DEPTH + 1):
            if depth == MAX_FLATE_DEPTH:
                raise IntakeError("pdf_refused", 422)  # more zlib layers than any writer produces
            out = _inflate(layer, budget)
            if len(out) > budget:
                raise IntakeError("pdf_refused", 422)  # an inflate bomb, or far more content than an invoice holds
            budget -= len(out)
            yield out
            if not _zlib_header(out):
                break
            layer = out


def _inflate(stream: bytes, limit: int) -> bytes:
    """At most `limit` + 1 bytes of `stream` inflated (one more than the limit tells the caller it was exceeded; zlib's
    max_length keeps a bomb from ever producing more). Corrupt data: what inflated before the corrupt piece - the stream is
    fed again in 1 KiB pieces, so a lenient reader cannot see much more than the scan did."""
    try:
        return zlib.decompressobj().decompress(stream, limit + 1)
    except zlib.error:
        pass
    d = zlib.decompressobj()
    out = bytearray()
    for i in range(0, len(stream), 1024):
        try:
            out += d.decompress(stream[i:i + 1024], limit + 1 - len(out))
        except zlib.error:
            break
        if len(out) > limit or d.eof:
            break
    return bytes(out)


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
    escapes = [MAX_ESCAPED_NAMES]
    if active_markers(data, escapes):
        raise IntakeError("pdf_refused", 422)
    for inflated in inflated_streams(data):
        if active_markers(inflated, escapes):
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


def check_pending_quota(pending_count: int, pending_bytes: int = 0) -> None:
    """Spec 11A.6: at most 30 pending (uploaded, not yet submitted) files per link, and (deep review A5) at most 64 MiB of them
    -> 409 `file_limit` (the hourly 40 is the public rate gate's `token_claim_files`). Checked before the body is read, so one
    upload may pass the byte cap by at most its own size (10 MiB): 30 x 10 MiB = 300 MiB per link is no longer possible."""
    if pending_count >= MAX_PENDING_PER_LINK or pending_bytes >= MAX_PENDING_BYTES_PER_LINK:
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
