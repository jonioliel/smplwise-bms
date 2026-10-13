"""CR-038 public listener: a strict, bounded, in-memory `multipart/form-data` reader for the two upload routes (`/t/api/photo`,
`/t/api/claim/file`).

Why not Starlette's form parser: it runs before the route's own checks can (FastAPI reads a form body before dependencies),
spools files over 1 MiB to temporary files, and python-multipart's warnings quote input bytes. Here the route first resolves
the link (one indexed read), claims the link's single upload slot, then reads the body - already capped and deadline-bound by
the edge (public_http) - and hands it to `parse_form`, which allows exactly the fields the route names:
- no preamble, no epilogue beyond one CRLF, the boundary of the Content-Type only (RFC 2046 characters, 1-70 long);
- each part: a header block of at most 1 KiB and 4 headers; `Content-Disposition: form-data` with a plain ASCII `name`;
- every name at most once, unknown names refused, a file field must carry a `filename` (its value is never used), a text
  field must not, and is bounded and UTF-8;
- the declared part Content-Type is ignored (the image pipeline sniffs the bytes).
Nothing is logged; an error names the rule it broke, never input bytes."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Mapping

MAX_HEADER_BLOCK = 1024
MAX_PART_HEADERS = 4
_BOUNDARY_RE = re.compile(r"[0-9A-Za-z'()+_,\-./:=? ]{0,69}[0-9A-Za-z'()+_,\-./:=?]")
_NAME_RE = re.compile(r"[A-Za-z0-9_]{1,40}")


class MultipartError(ValueError):
    """`code`: content_type | boundary | structure | headers | disposition | unknown_field | duplicate_field | file_expected |
    text_expected | field_too_large | missing_field | encoding."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class FieldRule:
    file: bool
    max_bytes: int
    required: bool = True


@dataclass(frozen=True)
class Part:
    name: str
    data: bytes
    is_file: bool

    def text(self) -> str:
        try:
            return self.data.decode("utf-8")
        except UnicodeDecodeError:
            raise MultipartError("encoding") from None


def boundary_of(content_type: str | None) -> bytes:
    """The boundary of a `multipart/form-data; boundary=...` header value, or MultipartError."""
    if not content_type or len(content_type) > 300:
        raise MultipartError("content_type")
    media, _, params = content_type.partition(";")
    if media.strip().lower() != "multipart/form-data":
        raise MultipartError("content_type")
    boundary = None
    for raw in params.split(";"):
        key, sep, value = raw.strip().partition("=")
        if sep and key.strip().lower() == "boundary":
            if boundary is not None:
                raise MultipartError("boundary")
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] == '"':
                value = value[1:-1]
            boundary = value
    if boundary is None or not _BOUNDARY_RE.fullmatch(boundary):
        raise MultipartError("boundary")
    return boundary.encode("ascii")


def _disposition(value: str) -> tuple[str, bool]:
    """(name, has_filename) of a `form-data; name="x"[; filename="y"]` value."""
    kind, _, rest = value.partition(";")
    if kind.strip().lower() != "form-data":
        raise MultipartError("disposition")
    name: str | None = None
    has_filename = False
    for raw in rest.split(";"):
        key, sep, val = raw.strip().partition("=")
        if not sep:
            if raw.strip():
                raise MultipartError("disposition")
            continue
        key = key.strip().lower()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] == '"':
            val = val[1:-1]
        if key == "name":
            if name is not None or not _NAME_RE.fullmatch(val):
                raise MultipartError("disposition")
            name = val
        elif key == "filename":
            if has_filename or len(val) > 255:
                raise MultipartError("disposition")
            has_filename = True
        elif key == "filename*":
            raise MultipartError("disposition")  # RFC 7578 4.2: not in form-data
    if name is None:
        raise MultipartError("disposition")
    return name, has_filename


def _headers(block: bytes) -> str:
    """The Content-Disposition value of a part's header block (other headers allowed: Content-Type; nothing else)."""
    try:
        text = block.decode("ascii")
    except UnicodeDecodeError:
        raise MultipartError("headers") from None
    lines = text.split("\r\n")
    if len(lines) > MAX_PART_HEADERS:
        raise MultipartError("headers")
    disposition: str | None = None
    for line in lines:
        key, sep, value = line.partition(":")
        if not sep or not key or key != key.strip() or any(ord(c) < 0x20 for c in line):
            raise MultipartError("headers")
        k = key.lower()
        if k == "content-disposition":
            if disposition is not None:
                raise MultipartError("headers")
            disposition = value.strip()
        elif k != "content-type":
            raise MultipartError("headers")
    if disposition is None:
        raise MultipartError("disposition")
    return disposition


def parse_form(body: bytes, boundary: bytes, rules: Mapping[str, FieldRule]) -> dict[str, Part]:
    """The parts of `body` by name, exactly as `rules` allow, or MultipartError."""
    delim = b"--" + boundary
    if not body.startswith(delim + b"\r\n"):
        raise MultipartError("structure")
    sep = b"\r\n" + delim
    pos = len(delim) + 2
    parts: dict[str, Part] = {}
    while True:
        hend = body.find(b"\r\n\r\n", pos, pos + MAX_HEADER_BLOCK + 4)
        if hend < 0:
            raise MultipartError("headers")
        name, has_filename = _disposition(_headers(body[pos:hend]))
        rule = rules.get(name)
        if rule is None:
            raise MultipartError("unknown_field")
        if name in parts:
            raise MultipartError("duplicate_field")
        if rule.file != has_filename:
            raise MultipartError("file_expected" if rule.file else "text_expected")
        start = hend + 4
        end = body.find(sep, start)
        if end < 0:
            raise MultipartError("structure")
        if end - start > rule.max_bytes:
            raise MultipartError("field_too_large")
        parts[name] = Part(name, body[start:end], rule.file)
        after = end + len(sep)
        tail = body[after:after + 2]
        if tail == b"--":
            if body[after + 2:] not in (b"", b"\r\n"):
                raise MultipartError("structure")
            break
        if tail != b"\r\n":
            raise MultipartError("structure")
        pos = after + 2
        if len(parts) >= len(rules):
            raise MultipartError("structure")  # more parts than fields: something is smuggled
    for name, rule in rules.items():
        if rule.required and name not in parts:
            raise MultipartError("missing_field")
    return parts
