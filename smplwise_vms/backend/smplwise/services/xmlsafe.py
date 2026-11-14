"""Device XML parsing without entity tricks (T069): the NVR and the bridge never send a DOCTYPE, so any document
that carries one (external entities, entity expansion bombs) is refused before the parser sees it. The error is a
ParseError subclass, so every existing `except ET.ParseError` keeps working.

Security review L1 (2026-10-04): the DOCTYPE check reads bytes, so a UTF-16 / UTF-32 body (BOM or NUL bytes) or an XML
declaration naming another encoding could hide `<!DOCTYPE` from it while expat still decodes it. Only UTF-8 (with or
without BOM) and its subsets are accepted; everything else is refused."""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET

_DOCTYPE = re.compile(rb"<!DOCTYPE|<!ENTITY", re.I)
_DECL_ENCODING = re.compile(rb"^\s*<\?xml[^>]*\bencoding\s*=\s*[\"']([A-Za-z0-9._-]+)[\"']", re.I)
_ALLOWED_ENCODINGS = {b"utf-8", b"utf8", b"us-ascii", b"ascii"}
_WIDE_BOMS = (b"\xff\xfe", b"\xfe\xff", b"\x00\x00\xfe\xff", b"\xff\xfe\x00\x00")


class UnsafeXml(ET.ParseError):
    pass


def parse(text: str | bytes) -> ET.Element:
    raw = text.encode("utf-8", "replace") if isinstance(text, str) else text
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    if raw.startswith(_WIDE_BOMS) or b"\x00" in raw[:1024]:
        raise UnsafeXml("only UTF-8 device documents are accepted")
    m = _DECL_ENCODING.match(raw)
    if m and m.group(1).lower() not in _ALLOWED_ENCODINGS:
        raise UnsafeXml("only UTF-8 device documents are accepted")
    if _DOCTYPE.search(raw):
        raise UnsafeXml("DOCTYPE / ENTITY declarations are not accepted from devices")
    return ET.fromstring(raw)
