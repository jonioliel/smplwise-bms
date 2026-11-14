"""TKMAP1 (owner 16.10): the vendor's picture of a request's map element - a 2D SVG drawn on the SERVER from the floor's published
structure, never the plan document itself (the vendor never receives geometry JSON, ids or the uploaded drawing).

What is drawn (an allowlist - everything else of the plan is dropped before a byte is written):
- the structure of the element's level: walls (straight, curved, glass with their mullions and opening panels), doors with leaves and
  swing arcs, windows, passages - plan_geometry_render.structure_primitives (the deterministic renderer the map and the exports use),
  filtered to those kinds;
- the floor's own rooms on that level (spatial_zones: outline + NAME at the room's centre);
- the marked element: a ring, a solid dot and an arrow pointing at it;
- a caption band (element name · floor · room) and a zoomed inset of the surroundings (the same drawing through a second viewBox).

What is never drawn: any other object (furniture, devices, CAMERAS, sensors, the element's own plan symbol), connectors (stairs name
other floors), free-text plan labels, circuits, other levels, rooms other floors share in, the uploaded drawing (it can show anything),
and no id of any kind (no `data-*`, no element / wall / room id; the only ids are this picture's own `p`, `ic` and `mk`).
Every text is XML-escaped. The output is deterministic for the same inputs (the map's 0.01 px rounding)."""
from __future__ import annotations

import math
import unicodedata
from typing import Any, Iterable
from xml.sax.saxutils import escape

from .. import plan_geometry_render as render
from ..plan_geometry import DEFAULT_LEVEL_ID, effective_scale

STRUCTURE_KINDS = frozenset({"wall", "glazing", "door", "window", "passage"})
MARK = "#e0443c"
INK = "#1f2a3d"
CAPTION_BG = "#f4f6fa"
INSET_SHARE = 0.34  # the inset's side as a share of the shorter plan side
INSET_RADIUS_M = 2.5  # the surroundings shown in the inset: about 2.5 m around the element
FONT = "Arial, Helvetica, sans-serif"

_n = render._n  # the renderer's number format (0.01 px, no trailing zeros)

# Which zone (room) NAMES the vendor's picture draws (owner decision on review finding F2, 16.10: element_room_only - change it HERE only):
#   "all"               - the name of every named zone of the element's level (the first 2.6.0 behaviour);
#   "element_room_only" - DEFAULT: the name of the room that holds the element plus the names of corridor-kind zones; every other
#                         outline stays, unnamed (a vault / server room is never named to a vendor).
# Future options (a per-zone "hide from vendors" flag) belong in zone_names_to_draw().
CORRIDOR_KINDS = frozenset({"corridor"})
MAP_ZONE_NAMES = "element_room_only"
TEXT_MAX = 120  # the longest text (name / floor / room / caption part) a picture carries


def clean_text(value: Any, limit: int = TEXT_MAX) -> str:
    """A name made safe for the picture: control (Cc) and format (Cf: bidi overrides U+202A-202E / U+2066-2069, zero-width, BOM) characters,
    surrogates, private-use and non-characters are removed (they make the SVG ill-formed XML or reorder the drawn text), tab / newline
    become a space, runs of spaces collapse, and the result is cut to `limit` characters."""
    out: list[str] = []
    for ch in str(value if value is not None else ""):
        cat = unicodedata.category(ch)
        if ch.isspace():
            out.append(" ")
        elif cat in ("Cc", "Cf", "Cs", "Co", "Cn"):
            continue
        else:
            out.append(ch)
    return " ".join("".join(out).split())[:limit]


def zone_names_to_draw(rooms: list[tuple[str, list[tuple[float, float]], str]], element_room: str | None) -> list[tuple[str, tuple[float, float]]]:
    """THE ONE place that decides which room names are written into the picture (policy MAP_ZONE_NAMES, see above).
    `rooms` are the level's (name, outline); returns (clean name, centre) for each name that is drawn."""
    named = [(clean_text(name), pts, kind) for name, pts, kind in rooms]
    named = [(name, pts, kind) for name, pts, kind in named if name]
    if MAP_ZONE_NAMES == "element_room_only":
        want = clean_text(element_room)
        named = [(name, pts, kind) for name, pts, kind in named if (want and name == want) or kind in CORRIDOR_KINDS]
    return [(name, _centroid(pts)) for name, pts, _kind in named]


def structure_only(doc: dict[str, Any], width: float, height: float, level: str) -> list[dict[str, Any]]:
    """The structure primitives of ONE level, with nothing but the kinds of STRUCTURE_KINDS (objects / connectors / labels dropped).
    The objects are removed from the document before the primitives are computed, so no catalog lookup happens for them either."""
    bare = {k: v for k, v in doc.items() if k not in ("objects", "connectors", "labels", "circuits")}
    bare.update(objects=[], connectors=[], labels=[])
    return [p for p in render.structure_primitives(bare, width, height, level, items={}) if p.get("kind") in STRUCTURE_KINDS]


def _centroid(pts: list[tuple[float, float]]) -> tuple[float, float]:
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(a) < 1e-9:
        return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
    return cx / (3 * a), cy / (3 * a)


def floor_rooms(zones: Iterable[dict[str, Any]], width: float, height: float, level: str) -> list[tuple[str, list[tuple[float, float]], str]]:
    """(name, outline in plan px) of the floor's rooms on `level` - a malformed outline is skipped, never guessed."""
    out: list[tuple[str, list[tuple[float, float]], str]] = []
    for z in zones:
        if (z.get("level_id") or DEFAULT_LEVEL_ID) != level:
            continue
        poly = z.get("polygon")
        if not isinstance(poly, list) or len(poly) < 3:
            continue
        try:
            pts = [(render.r2(float(p["x"]) * width), render.r2(float(p["y"]) * height)) for p in poly]
        except (KeyError, TypeError, ValueError):
            continue
        if not all(math.isfinite(v) for p in pts for v in p):
            continue
        out.append((str(z.get("name") or ""), pts, str(z.get("kind") or "")))
    return out


def _structure_markup(prims: list[dict[str, Any]], rooms: list[tuple[str, list[tuple[float, float]], str]], u: float, element_room: str | None = None) -> list[str]:
    tk = render.TOKENS
    out = [f'<g fill="{tk["room_fill"]}" stroke="{tk["room_line"]}" stroke-width="{_n(max(1.0, u))}">']
    out.extend(f'<polygon points="{render._pts(pts)}"/>' for _name, pts, _kind in rooms)
    out.append("</g>")
    out.append(f'<g fill="none" stroke="{tk["structure"]}" stroke-linecap="butt" stroke-linejoin="miter">')
    for p in prims:
        if p["kind"] == "wall":
            pts = render._pts(p["points"])
            if p.get("glass"):
                band, _line = render.glass_band(p["width"])
                out.append(f'<polyline points="{pts}" stroke-width="{_n(p["width"])}"/>'
                           f'<polyline points="{pts}" stroke="{tk["glass_fill"]}" stroke-width="{_n(band)}"/>'
                           f'<polyline points="{pts}" stroke="{tk["glass"]}" stroke-width="1"/>')
            else:
                out.append(f'<polyline points="{pts}" stroke-width="{_n(p["width"])}"/>')
        elif p["kind"] == "glazing":
            mw = max(1.0, p["mullion"])
            out.extend(f'<line x1="{_n(a[0])}" y1="{_n(a[1])}" x2="{_n(b[0])}" y2="{_n(b[1])}" stroke-width="{_n(mw)}"/>' for a, b in p["mullions"])
            out.extend(f'<line x1="{_n(q["a"][0])}" y1="{_n(q["a"][1])}" x2="{_n(q["b"][0])}" y2="{_n(q["b"][1])}" stroke="{tk["opening"]}" stroke-width="1.5" '
                       f'stroke-dasharray="3 2"/>' for q in p["panels"] if q["operation"])
        elif p["kind"] == "door":
            out.extend(f'<line x1="{_n(a[0])}" y1="{_n(a[1])}" x2="{_n(b[0])}" y2="{_n(b[1])}" stroke="{tk["opening"]}" stroke-width="1.5"/>' for a, b in p["leaves"])
            out.extend(f'<path d="M {_n(a["from"][0])} {_n(a["from"][1])} A {_n(a["r"])} {_n(a["r"])} 0 0 {int(a["sweep"])} {_n(a["to"][0])} {_n(a["to"][1])}" '
                       f'stroke="{tk["opening"]}" stroke-width="1" stroke-dasharray="4 3"/>' for a in p["arcs"])
        elif p["kind"] == "window":
            out.extend(f'<line x1="{_n(a[0])}" y1="{_n(a[1])}" x2="{_n(b[0])}" y2="{_n(b[1])}" stroke="{tk["glass"]}" stroke-width="1.5"/>' for a, b in p["lines"])
        elif p["kind"] == "passage":
            a, b = p["gap"]
            out.append(f'<line x1="{_n(a[0])}" y1="{_n(a[1])}" x2="{_n(b[0])}" y2="{_n(b[1])}" stroke-width="1" stroke-dasharray="2 3"/>')
    out.append("</g>")
    labelled = zone_names_to_draw(rooms, element_room)
    if labelled:
        out.append(f'<g font-family="{FONT}" font-weight="600" font-size="{_n(13 * u)}" fill="{tk["label"]}" text-anchor="middle" dominant-baseline="middle">')
        out.extend(f'<text x="{_n(c[0])}" y="{_n(c[1])}">{escape(name)}</text>' for name, c in labelled)
        out.append("</g>")
    return out


def _mark(x: float, y: float, r: float, u: float, arrow_from: tuple[float, float] | None) -> list[str]:
    out = [f'<circle cx="{_n(x)}" cy="{_n(y)}" r="{_n(r)}" fill="{MARK}" fill-opacity="0.14" stroke="#ffffff" stroke-width="{_n(5 * u)}"/>',
           f'<circle cx="{_n(x)}" cy="{_n(y)}" r="{_n(r)}" fill="none" stroke="{MARK}" stroke-width="{_n(3 * u)}"/>',
           f'<circle cx="{_n(x)}" cy="{_n(y)}" r="{_n(max(2.5 * u, r * 0.18))}" fill="{MARK}" stroke="#ffffff" stroke-width="{_n(1.5 * u)}"/>']
    if arrow_from is not None:
        fx, fy = arrow_from
        dx, dy = x - fx, y - fy
        d = math.hypot(dx, dy)
        if d > r * 1.5:
            ux, uy = dx / d, dy / d
            tip = (x - ux * (r + 2 * u), y - uy * (r + 2 * u))
            head = 12 * u
            base = (tip[0] - ux * head, tip[1] - uy * head)
            left = (base[0] + uy * head * 0.55, base[1] - ux * head * 0.55)
            right = (base[0] - uy * head * 0.55, base[1] + ux * head * 0.55)
            line = f'M {_n(fx)} {_n(fy)} L {_n(base[0])} {_n(base[1])}'
            out.append(f'<path d="{line}" stroke="#ffffff" stroke-width="{_n(7 * u)}" stroke-linecap="round" fill="none"/>')
            out.append(f'<path d="{line}" stroke="{MARK}" stroke-width="{_n(3.5 * u)}" stroke-linecap="round" fill="none"/>')
            out.append(f'<polygon points="{_n(tip[0])},{_n(tip[1])} {_n(left[0])},{_n(left[1])} {_n(right[0])},{_n(right[1])}" fill="{MARK}" '
                       f'stroke="#ffffff" stroke-width="{_n(1.5 * u)}" stroke-linejoin="round"/>')
    return out


def render_public_svg(doc: dict[str, Any] | None, zones: list[dict[str, Any]], width: float, height: float, *, level: str, x: float, y: float,
                      caption: str, title: str, room: str | None = None) -> str:
    """The vendor's picture. `x` / `y` are the element in plan px; `caption` the band's text (name · floor · room); `title` the
    accessible name. `doc` None (a floor without a published structure) draws the rooms and the mark only."""
    caption, title = clean_text(caption, 3 * TEXT_MAX), clean_text(title, 3 * TEXT_MAX)
    width = max(1.0, float(width))
    height = max(1.0, float(height))
    u = max(width, height) / 1000.0  # one "unit": strokes and type scale with the plan, so a 4000 px plan is as legible as a 1000 px one
    prims = structure_only(doc, width, height, level) if doc else []
    rooms = floor_rooms(zones, width, height, level)
    band = round(44 * u, 2)
    px_per_m = 1.0 / effective_scale(doc or {"dimensions": {"width_px": int(width)}})[0]
    ring = max(10 * u, min(0.6 * px_per_m, 28 * u))
    # the arrow comes from the plan's centre side (an element at the centre: from the upper left) so its tail stays on the drawing
    cx, cy = width / 2, height / 2
    vx, vy = cx - x, cy - y
    vd = math.hypot(vx, vy)
    if vd < 1e-6:
        vx, vy, vd = -1.0, -1.0, math.sqrt(2)
    length = 0.14 * max(width, height)
    tail = (min(width, max(0.0, x + vx / vd * length)), min(height, max(0.0, y + vy / vd * length)))
    # the inset: a square over the corner FARTHEST from the element (it never covers the mark), ~INSET_RADIUS_M around it
    side = round(INSET_SHARE * min(width, height), 2)
    pad = round(10 * u, 2)
    ix = pad if x > width / 2 else width - side - pad
    iy = pad if y > height / 2 else height - side - pad
    radius = min(max(INSET_RADIUS_M * px_per_m, 0.05 * max(width, height)), 0.15 * max(width, height))
    total_h = height + band
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{_n(width)}" height="{_n(total_h)}" '
           f'viewBox="0 0 {_n(width)} {_n(total_h)}" role="img" aria-label="{escape(title, {chr(34): "&quot;"})}">',
           f"<title>{escape(title)}</title>",
           '<defs><g id="p">', *_structure_markup(prims, rooms, u, room), "</g>",
           f'<g id="mk">{"".join(_mark(x, y, ring, u, None))}</g>',
           f'<clipPath id="ic"><rect x="{_n(ix)}" y="{_n(iy)}" width="{_n(side)}" height="{_n(side)}" rx="{_n(8 * u)}"/></clipPath></defs>',
           f'<rect width="{_n(width)}" height="{_n(total_h)}" fill="{render.TOKENS["canvas"]}"/>',
           f'<rect width="{_n(width)}" height="{_n(band)}" fill="{CAPTION_BG}"/>',
           f'<text x="{_n(width / 2)}" y="{_n(band / 2)}" font-family="{FONT}" font-weight="700" font-size="{_n(17 * u)}" fill="{INK}" '
           f'text-anchor="middle" dominant-baseline="middle" direction="rtl" unicode-bidi="plaintext">{escape(caption)}</text>',
           f'<g transform="translate(0 {_n(band)})">',
           '<use href="#p" xlink:href="#p"/>',
           *_mark(x, y, ring, u, tail),
           f'<g clip-path="url(#ic)"><rect x="{_n(ix)}" y="{_n(iy)}" width="{_n(side)}" height="{_n(side)}" fill="{render.TOKENS["canvas"]}"/>',
           f'<svg x="{_n(ix)}" y="{_n(iy)}" width="{_n(side)}" height="{_n(side)}" viewBox="{_n(x - radius)} {_n(y - radius)} {_n(2 * radius)} {_n(2 * radius)}">',
           '<use href="#p" xlink:href="#p"/><use href="#mk" xlink:href="#mk"/></svg></g>',
           f'<rect x="{_n(ix)}" y="{_n(iy)}" width="{_n(side)}" height="{_n(side)}" rx="{_n(8 * u)}" fill="none" stroke="{INK}" stroke-opacity="0.55" '
           f'stroke-width="{_n(2 * u)}"/>',
           "</g></svg>"]
    return "\n".join(out) + "\n"
