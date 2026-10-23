"""CR-LOGOS295 section 5.5: the one SVG sanitiser (the company logo upload; any later SVG input shares it).

An SVG is code-shaped data. The rule here is allowlist-and-rebuild: the upload is parsed, every element and attribute that is not on the
allowlist is dropped, and a FRESH document is serialised from what is left - the submitted bytes are never stored or served.
Anything that could execute or fetch (script, foreignObject, image, animation, event attributes, an external reference, a `url(` that
is not a `#local` one, an `@import`) REFUSES the whole file instead of being quietly removed, so the administrator learns that the
file was not what it seemed. The result is served only through `<img>` (never inline, never `<object>`) with a sandboxing
Content-Security-Policy (routers/brand.py), so even a miss here cannot run in the application's origin.

No third-party parser: the stdlib expat parser is used behind a pre-check that refuses any DOCTYPE / ENTITY declaration (the only
route to an entity-expansion bomb or an external entity), plus hard limits on size, depth and element count.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
MAX_BYTES = 512 * 1024
MAX_DEPTH = 32
MAX_ELEMENTS = 5000

ALLOWED_ELEMENTS = frozenset("""svg g path rect circle ellipse line polyline polygon text tspan defs linearGradient radialGradient stop
clipPath mask use symbol title desc style""".split())
# elements that refuse the file (a miss on the allowlist alone only drops them)
REFUSED_ELEMENTS = frozenset("""script foreignObject image animate animateTransform animateMotion animateColor set iframe object embed
audio video canvas handler listener a switch""".split())
ALLOWED_ATTRS = frozenset("""id class transform viewBox preserveAspectRatio x y x1 y1 x2 y2 cx cy r rx ry width height d points
fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray
stroke-dashoffset opacity color stop-color stop-opacity offset gradientUnits gradientTransform spreadMethod fx fy fr
clip-path clip-rule mask maskUnits maskContentUnits clipPathUnits patternUnits font-family font-size font-weight font-style
text-anchor dominant-baseline letter-spacing word-spacing dx dy rotate textLength lengthAdjust display visibility
vector-effect paint-order mix-blend-mode isolation style version xml:space""".split())
PAINT_STYLE = frozenset("""fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-miterlimit
stroke-dasharray stroke-dashoffset opacity color stop-color stop-opacity clip-path clip-rule mask font-family font-size font-weight
font-style text-anchor dominant-baseline letter-spacing display visibility paint-order mix-blend-mode isolation""".split())

_DECL = re.compile(rb"<!\s*(DOCTYPE|ENTITY|ATTLIST|ELEMENT|NOTATION)", re.I)
_PI = re.compile(rb"<\?(?!xml[\s?])", re.I)  # a processing instruction other than the XML declaration (xml-stylesheet ...)
_URL = re.compile(r"url\(\s*([^)]*)\)", re.I)
_BAD_VALUE = re.compile(r"javascript:|data:|vbscript:|expression\s*\(|@import|behavior\s*:|-moz-binding", re.I)
_LEN = re.compile(r"^\s*([0-9]*\.?[0-9]+)\s*(px|pt|mm|cm|in|em|%)?\s*$")


class SvgRefused(ValueError):
    """The file is refused. `reason` is a short machine key (the API turns it into the user message)."""

    def __init__(self, reason: str, detail: str = ""):
        super().__init__(f"{reason}: {detail}" if detail else reason)
        self.reason = reason
        self.detail = detail


@dataclass(frozen=True)
class CleanSvg:
    data: bytes
    width: int  # the viewBox size, rounded: the aspect ratio the consumer needs (the file itself carries no width / height)
    height: int


def _local(tag: str) -> tuple[str, str]:
    if tag.startswith("{"):
        ns, _, name = tag[1:].partition("}")
        return ns, name
    return "", tag


def _check_value(value: str) -> None:
    if _BAD_VALUE.search(value):
        raise SvgRefused("unsafe_value")
    for m in _URL.finditer(value):
        ref = m.group(1).strip().strip("'\"")
        if not ref.startswith("#"):
            raise SvgRefused("external_reference")


def _clean_style(value: str) -> str:
    _check_value(value)
    kept = []
    for part in value.split(";"):
        name, sep, val = part.partition(":")
        name = name.strip().lower()
        if sep and name in PAINT_STYLE:
            kept.append(f"{name}:{val.strip()}")
    return ";".join(kept)


def _clean_css(text: str) -> str:
    """A <style> element: kept only when it holds plain rules (exports from Illustrator / Inkscape put the fills there)."""
    if "<" in text:
        raise SvgRefused("unsafe_value")
    _check_value(text)
    if "\\" in text:  # CSS escapes can spell a blocked word
        raise SvgRefused("unsafe_value")
    return text.strip()


def _length(v: str | None) -> float | None:
    if v is None:
        return None
    m = _LEN.match(v)
    if not m or m.group(2) == "%":
        return None
    n = float(m.group(1))
    return n if n > 0 else None


def sanitize(raw: bytes) -> CleanSvg:
    if len(raw) > MAX_BYTES:
        raise SvgRefused("too_large")
    if _DECL.search(raw):
        raise SvgRefused("declaration")
    if _PI.search(raw):
        raise SvgRefused("processing_instruction")
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    try:
        root = ET.fromstring(raw)
    except (ET.ParseError, ValueError) as exc:
        raise SvgRefused("not_xml", type(exc).__name__) from exc
    ns, name = _local(root.tag)
    if ns != SVG_NS or name != "svg":
        raise SvgRefused("not_svg")

    count = 0

    def walk(src: ET.Element, depth: int) -> ET.Element | None:
        nonlocal count
        if depth > MAX_DEPTH:
            raise SvgRefused("too_deep")
        count += 1
        if count > MAX_ELEMENTS:
            raise SvgRefused("too_many_elements")
        ens, ename = _local(src.tag)
        if ename in REFUSED_ELEMENTS and ens in ("", SVG_NS):
            raise SvgRefused("forbidden_element", ename)
        if ens != SVG_NS or ename not in ALLOWED_ELEMENTS:
            return None  # a foreign-namespace or unknown element (and its subtree) is dropped
        out = ET.Element(f"{{{SVG_NS}}}{ename}")
        for key, val in src.attrib.items():
            ans, aname = _local(key)
            if aname.lower().startswith("on"):
                raise SvgRefused("event_attribute", aname)
            if aname == "href" and ans in ("", XLINK_NS):
                if not val.startswith("#"):
                    raise SvgRefused("external_reference")
                out.set("href" if ans == "" else f"{{{XLINK_NS}}}href", val)
                continue
            if ans == "http://www.w3.org/XML/1998/namespace" and aname == "space":
                out.set("{http://www.w3.org/XML/1998/namespace}space", val)
                continue
            if ans not in ("", SVG_NS) or aname not in ALLOWED_ATTRS or aname == "xml:space":
                continue  # not on the allowlist: dropped, not refused
            _check_value(val)
            if aname == "style":
                val = _clean_style(val)
                if not val:
                    continue
            out.set(aname, val)
        if ename in ("text", "tspan", "title", "desc"):
            out.text = src.text
        elif ename == "style":
            out.text = _clean_css(src.text or "")
        for child in src:
            kept = walk(child, depth + 1)
            if kept is not None:
                out.append(kept)
            if ename in ("text", "tspan") and child.tail:
                if kept is not None:
                    kept.tail = child.tail
        return out

    clean = walk(root, 1)
    assert clean is not None
    # normalise the geometry: a viewBox is the contract; width / height attributes are dropped (the consumer sizes the image)
    vb = clean.get("viewBox")
    w = h = None
    if vb:
        parts = re.split(r"[\s,]+", vb.strip())
        try:
            nums = [float(p) for p in parts]
        except ValueError as exc:
            raise SvgRefused("bad_viewbox") from exc
        if len(nums) != 4 or nums[2] <= 0 or nums[3] <= 0:
            raise SvgRefused("bad_viewbox")
        w, h = nums[2], nums[3]
    else:
        w, h = _length(src_attr(root, "width")), _length(src_attr(root, "height"))
        if not w or not h:
            raise SvgRefused("no_size")
        clean.set("viewBox", f"0 0 {w:g} {h:g}")
    for a in ("width", "height"):
        if a in clean.attrib:
            del clean.attrib[a]
    ET.register_namespace("", SVG_NS)
    ET.register_namespace("xlink", XLINK_NS)
    out_bytes = ET.tostring(clean, encoding="unicode").encode("utf-8")
    if len(out_bytes) > MAX_BYTES:
        raise SvgRefused("too_large")
    return CleanSvg(out_bytes, max(1, round(w)), max(1, round(h)))


def src_attr(el: ET.Element, name: str) -> str | None:
    return el.attrib.get(name)
