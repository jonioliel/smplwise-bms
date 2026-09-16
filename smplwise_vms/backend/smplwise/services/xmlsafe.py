"""Device XML parsing without entity tricks (T069): the NVR and the bridge never send a DOCTYPE, so any document
that carries one (external entities, entity expansion bombs) is refused before the parser sees it. The error is a
ParseError subclass, so every existing `except ET.ParseError` keeps working."""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET

_DOCTYPE = re.compile(rb"<!DOCTYPE|<!ENTITY", re.I)


class UnsafeXml(ET.ParseError):
    pass


def parse(text: str | bytes) -> ET.Element:
    raw = text.encode("utf-8", "replace") if isinstance(text, str) else text
    if _DOCTYPE.search(raw):
        raise UnsafeXml("DOCTYPE / ENTITY declarations are not accepted from devices")
    return ET.fromstring(raw)
