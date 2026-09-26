"""Deterministic drawing of the Plan Studio structure layer (T084, CR-003). structure_primitives() turns a v2 document
into plain shapes in plan pixels - walls cut by their openings (free ends extended by half the thickness so corners
close), door leaves and swing arcs, window glass, passages, labels. The SVG / PNG exports draw exactly these shapes and
frontend/src/map/geometry.ts computes the same list for the map; contracts/fixtures/plan_geometry pins both.
Coordinates are rounded half-up to 0.01 px, the same arithmetic on both sides."""
from __future__ import annotations

import io
import math
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape, quoteattr

from . import plan_catalog
from .plan_geometry import DEFAULT_LEVEL_ID, DEFAULT_WALL_THICKNESS_M, apply_anchor_positions, effective_scale
from .plan_symbols import symbol_markup

LAYERS = ("structure", "objects", "labels", "connectors")
ARROW_PX = 14.0
MAX_TRIBUNE_ROWS = 60  # tribune.stepped's params_schema cap (catalog/objects.json); a saved value above it still draws, capped, never a rows-1 unbounded loop
OBJECT_COLORS = {"object": "#7b8794", "structure": "#4b5567", "circulation": "#6b7f99", "furniture": "#9aa7b8", "light": "#f2b544", "electrical": "#e07a2f",
                 "safety": "#e0443c", "medical": "#2fa7b3", "sport": "#3fa25b", "sanitary": "#5b9bd5", "security": "#7a5cc7", "outdoor": "#5c9e4f"}
CIRCUIT_COLORS = {"circuit-1": "#2f6bff", "circuit-2": "#f59e0b", "circuit-3": "#22c55e", "circuit-4": "#a855f7", "circuit-5": "#ef4444", "circuit-6": "#14b8a6"}

Point = tuple[float, float]


def r2(v: float) -> float:
    return math.floor(v * 100 + 0.5) / 100


def _p(p: Point) -> list[float]:
    return [r2(p[0]), r2(p[1])]


def _cum(pts: list[Point]) -> list[float]:
    out = [0.0]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        out.append(out[-1] + math.hypot(x1 - x0, y1 - y0))
    return out


def point_at(pts: list[Point], cum: list[float], s: float) -> tuple[Point, Point]:
    """The point at arc length s along a polyline and the unit direction of the segment it lies on."""
    i = 0
    while i < len(pts) - 2 and s > cum[i + 1]:
        i += 1
    (x0, y0), (x1, y1) = pts[i], pts[i + 1]
    seg = cum[i + 1] - cum[i]
    if seg <= 1e-9:
        return (x0, y0), (1.0, 0.0)
    f = min(1.0, max(0.0, (s - cum[i]) / seg))
    return (x0 + (x1 - x0) * f, y0 + (y1 - y0) * f), ((x1 - x0) / seg, (y1 - y0) / seg)


def sub_polyline(pts: list[Point], cum: list[float], s0: float, s1: float) -> list[Point]:
    a, _ = point_at(pts, cum, s0)
    b, _ = point_at(pts, cum, s1)
    return [a, *[pts[i] for i in range(1, len(pts) - 1) if s0 < cum[i] < s1], b]


def _extend(p: Point, q: Point, by: float) -> Point:
    """Move p away from q by `by` (a free wall end grows by half the thickness, like a square cap)."""
    dx, dy = p[0] - q[0], p[1] - q[1]
    n = math.hypot(dx, dy)
    return p if n < 1e-9 else (p[0] + dx / n * by, p[1] + dy / n * by)


def _add(p: Point, v: Point, k: float) -> Point:
    return (p[0] + v[0] * k, p[1] + v[1] * k)


def _sweep(c: Point, a: Point, b: Point) -> int:
    """SVG sweep flag of the short arc a -> b around c (y points down: a positive cross product turns clockwise on screen)."""
    return 1 if (a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[0]) > 0 else 0


def _door(g0: Point, g1: Point, d: Point, opening: dict[str, Any], w: float) -> dict[str, Any]:
    nl: Point = (d[1], -d[0])  # the left of the wall direction
    nr: Point = (-d[1], d[0])
    swing = opening.get("swing") or "right"
    if swing == "none":
        return {"leaves": [], "arcs": []}
    # a double or sliding door has no hinge jamb to choose: its hinge picks the side of the wall (start = left, end = right)
    side = nl if (opening.get("hinge") or "start") == "start" else nr
    if swing == "sliding":
        k = w * 0.12
        return {"leaves": [[_p(_add(g0, side, k)), _p(_add(g1, side, k))]], "arcs": []}
    if swing == "double":
        h = w / 2
        leaves: list[list[list[float]]] = []
        arcs: list[dict[str, Any]] = []
        for hinge, along in ((g0, d), (g1, (-d[0], -d[1]))):
            tip = _add(hinge, side, h)
            mid = _add(hinge, along, h)
            leaves.append([_p(hinge), _p(tip)])
            arcs.append({"from": _p(tip), "to": _p(mid), "r": r2(h), "sweep": _sweep(hinge, tip, mid)})
        return {"leaves": leaves, "arcs": arcs}
    n = nl if swing == "left" else nr
    hinge, other = (g0, g1) if (opening.get("hinge") or "start") == "start" else (g1, g0)
    tip = _add(hinge, n, w)
    return {"leaves": [[_p(hinge), _p(tip)]], "arcs": [{"from": _p(tip), "to": _p(other), "r": r2(w), "sweep": _sweep(hinge, tip, other)}]}


def _rotated(cx: float, cy: float, x: float, y: float, theta: float) -> Point:
    """A footprint-local offset (x right, y down) turned by theta around the centre: clockwise on screen (y points down)."""
    c, s = math.cos(theta), math.sin(theta)
    return (cx + x * c - y * s, cy + x * s + y * c)


def connector_label(levels: dict[str, Any], c: dict[str, Any]) -> str:
    """"↓ −1.2 מ׳": the arrow and the signed elevation difference from level_from to level_to; a connector's own label
    wins; a cross-floor connector (no level_to here) shows only the two-way arrow. Two levels at the same elevation
    show "↕" too, the same as a cross-floor connector - there is no up or down to point. The magnitude is rounded
    half-up to 0.1 m (r2's rule, scaled), not Python's banker's rounding: 0.25 must read 0.3, matching JavaScript's
    toFixed(1) in geometry.ts connectorLabel, so the export and the map agree."""
    if c.get("label"):
        return str(c["label"])
    a, b = levels.get(c.get("level_from")), levels.get(c.get("level_to"))
    if a is None or b is None:
        return "↕"
    delta = float(b["elevation_m"]) - float(a["elevation_m"])
    if delta == 0:
        return "↕"
    d = math.floor(abs(delta) * 10 + 0.5) / 10
    return f"{'↓' if delta < 0 else '↑'} {'−' if delta < 0 else '+'}{d:.1f} מ׳"


def _connector_prims(doc: dict[str, Any], width: float, height: float, px_per_m: float) -> list[dict[str, Any]]:
    levels = {lv["id"]: lv for lv in doc.get("levels", []) if isinstance(lv, dict) and isinstance(lv.get("id"), str)}
    out: list[dict[str, Any]] = []
    for c in sorted(doc.get("connectors", []), key=lambda c: c["id"]):
        pts: list[Point] = [(float(p[0]) * width, float(p[1]) * height) for p in c.get("polyline", [])]
        if len(pts) < 2:
            continue
        cum = _cum(pts)
        total = cum[-1]
        if total <= 1e-6:
            continue
        tail, _ = point_at(pts, cum, max(0.0, total - min(ARROW_PX, total)))
        mid, _ = point_at(pts, cum, total / 2)
        out.append({"kind": "connector", "id": c["id"], "ckind": str(c.get("kind") or "stairs"), "points": [_p(q) for q in pts], "width": r2(max(1.0, float(c.get("width_m") or 1) * px_per_m)),
                    "arrow": {"from": _p(tail), "to": _p(pts[-1])}, "label": connector_label(levels, c), "lx": r2(mid[0]), "ly": r2(mid[1]),
                    "level_from": c.get("level_from"), "level_to": c.get("level_to")})
    return out


def _object_prims(doc: dict[str, Any], width: float, height: float, px_per_m: float, level: str | None, items: dict[str, Any]) -> list[dict[str, Any]]:
    circuit_of: dict[str, str] = {}
    for k in sorted(doc.get("circuits", []), key=lambda k: k["id"]):
        for mid in k.get("member_ids", []):
            circuit_of.setdefault(mid, k["id"])
    out: list[dict[str, Any]] = []
    for o in sorted(doc.get("objects", []), key=lambda o: o["id"]):
        if level is not None and o.get("level_id") != level:
            continue
        item = items.get(o.get("item_id")) or {}
        shape = item.get("shape") if item.get("shape") in plan_catalog.SHAPES else "box"
        cx, cy = float(o["position"][0]) * width, float(o["position"][1]) * height
        size = o.get("size") or {}
        hw, hd = float(size.get("w_m") or 0.05) * px_per_m / 2, float(size.get("d_m") or 0.05) * px_per_m / 2
        rot = float(o.get("rotation_deg") or 0)
        theta = math.radians(rot)
        corners = [_p(_rotated(cx, cy, sx * hw, sy * hd, theta)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        steps: list[list[list[float]]] = []
        params = o.get("params") if isinstance(o.get("params"), dict) else {}
        rows = params.get("rows")
        if shape == "stepped" and isinstance(rows, int) and rows >= 2:
            rows = min(rows, MAX_TRIBUNE_ROWS)  # the catalog's params_schema caps rows at 60; a saved value beyond that draws as 60, never hangs
            for i in range(1, rows):
                y = -hd + 2 * hd * i / rows
                steps.append([_p(_rotated(cx, cy, -hw, y, theta)), _p(_rotated(cx, cy, hw, y, theta))])
        ref = o.get("anchor_ref")
        out.append({"kind": "object", "id": o["id"], "item_id": str(o.get("item_id") or ""), "shape": shape, "icon": item.get("icon") if item.get("icon") in plan_catalog.ICONS else "box",
                    "color": item.get("color_token") if item.get("color_token") in plan_catalog.COLOR_TOKENS else "object", "level_id": o.get("level_id"),
                    "cx": r2(cx), "cy": r2(cy), "w": r2(hw * 2), "h": r2(hd * 2), "rotation": r2(rot), "corners": corners, "label": o.get("label") or None,
                    "circuit_id": circuit_of.get(o["id"]), "anchor": f"{ref['resource_type']}:{ref['resource_id']}" if isinstance(ref, dict) and ref.get("resource_id") else None,
                    "steps": steps})
    return out


def structure_primitives(doc: dict[str, Any], width: float, height: float, level: str | None = None, items: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Walls cut by their openings, door leaves and arcs, window glass, passages, labels (phase 1), then connectors
    (sorted by id, never filtered by level: they are what joins the levels) and objects (sorted by id, filtered by
    level). `items` is the library index; without it the built-in items are used, and an unknown item draws as a box."""
    scale, _ = effective_scale(doc)
    px_per_m = 1.0 / scale
    walls = {w["id"]: w for w in doc.get("walls", [])}
    by_wall: dict[Any, list[dict[str, Any]]] = {}
    for o in doc.get("openings", []):
        by_wall.setdefault(o.get("wall_id"), []).append(o)
    prims: list[dict[str, Any]] = []
    geo: dict[str, tuple[list[Point], list[float], float]] = {}
    for wid in sorted(walls):
        w = walls[wid]
        if level is not None and w.get("level_id") != level:
            continue
        pts: list[Point] = [(float(p[0]) * width, float(p[1]) * height) for p in w["polyline"]]
        cum = _cum(pts)
        total = cum[-1]
        if total <= 1e-6:
            continue
        wpx = max(1.0, float(w.get("thickness_m") or DEFAULT_WALL_THICKNESS_M) * px_per_m)
        geo[wid] = (pts, cum, wpx)
        cuts: list[tuple[float, float]] = []
        for o in by_wall.get(wid, []):
            c = float(o.get("t") or 0) * total
            half = float(o.get("width_m") or 0) * px_per_m / 2
            cuts.append((max(0.0, c - half), min(total, c + half)))
        cuts.sort()
        keep: list[tuple[float, float]] = []
        cursor = 0.0
        for a, b in cuts:
            if a > cursor:
                keep.append((cursor, a))
            cursor = max(cursor, b)
        if cursor < total:
            keep.append((cursor, total))
        part = 0
        for s0, s1 in keep:
            if s1 - s0 <= 0.01:
                continue
            seg = sub_polyline(pts, cum, s0, s1)
            if s0 <= 0:
                seg[0] = _extend(seg[0], seg[1], wpx / 2)
            if s1 >= total:
                seg[-1] = _extend(seg[-1], seg[-2], wpx / 2)
            prims.append({"kind": "wall", "id": wid, "part": part, "points": [_p(q) for q in seg], "width": r2(wpx)})
            part += 1
    for o in sorted(doc.get("openings", []), key=lambda o: o["id"]):
        g = geo.get(o.get("wall_id"))
        if g is None:
            continue
        pts, cum, wpx = g
        c, d = point_at(pts, cum, float(o.get("t") or 0) * cum[-1])
        w = float(o.get("width_m") or 0) * px_per_m
        g0, g1 = _add(c, d, -w / 2), _add(c, d, w / 2)
        base = {"id": o["id"], "gap": [_p(g0), _p(g1)]}
        if o.get("kind") == "door":
            prims.append({"kind": "door", **base, **_door(g0, g1, d, o, w)})
        elif o.get("kind") == "window":
            nl: Point = (d[1], -d[0])
            q = wpx / 4
            prims.append({"kind": "window", **base, "lines": [[_p(_add(g0, nl, q)), _p(_add(g1, nl, q))], [_p(_add(g0, nl, -q)), _p(_add(g1, nl, -q))]]})
        else:
            prims.append({"kind": "passage", **base})
    for lb in sorted(doc.get("labels", []), key=lambda l: l["id"]):
        if level is not None and lb.get("level_id") != level:
            continue
        prims.append({"kind": "label", "id": lb["id"], "x": r2(float(lb["position"][0]) * width), "y": r2(float(lb["position"][1]) * height),
                      "text": str(lb.get("text") or ""), "size": r2(float(lb.get("size") or 14))})
    prims.extend(_connector_prims(doc, width, height, px_per_m))
    prims.extend(_object_prims(doc, width, height, px_per_m, level, plan_catalog.builtin()["items"] if items is None else items))
    return prims


# ---------------------------------------------------------------- exports (same primitives as the map)

TOKENS = {"canvas": "#ffffff", "structure": "#4b5567", "opening": "#2f6bff", "glass": "#7fb2ff", "label": "#8b96a8", "room_fill": "#eef3ff", "room_line": "#c5cfdd"}


def _n(v: float) -> str:
    s = f"{r2(v):.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s


def _pts(points: Any) -> str:
    return " ".join(f"{_n(x)},{_n(y)}" for x, y in points)


def _rooms(zones: list[dict[str, Any]], width: float, height: float, level: str | None) -> list[tuple[dict[str, Any], list[tuple[float, float]]]]:
    out = []
    for z in sorted(zones, key=lambda z: z["id"]):
        if level is not None and (z.get("level_id") or DEFAULT_LEVEL_ID) != level:
            continue
        out.append((z, [(r2(p["x"] * width), r2(p["y"] * height)) for p in z["polygon"]]))
    return out


def _layer_set(layers: Any, labels: bool) -> set[str]:
    out = set(LAYERS) if layers is None else {str(x) for x in layers}
    if not labels:
        out.discard("labels")
    return out


def _prepared(doc: dict[str, Any], anchors: dict[str, Any] | None) -> dict[str, Any]:
    return apply_anchor_positions(doc, anchors) if anchors else doc


def _svg_object(p: dict[str, Any], labels: bool) -> list[str]:
    color = OBJECT_COLORS.get(p["color"], OBJECT_COLORS["object"])
    out = []
    if p["shape"] == "cylinder":
        out.append(f'<ellipse data-object={quoteattr(p["id"])} data-item={quoteattr(p["item_id"])} cx="{_n(p["cx"])}" cy="{_n(p["cy"])}" rx="{_n(p["w"] / 2)}" ry="{_n(p["h"] / 2)}" '
                   f'transform="rotate({_n(p["rotation"])} {_n(p["cx"])} {_n(p["cy"])})" fill="{color}" fill-opacity="0.18" stroke="{color}" stroke-width="1.2"/>')
    else:
        out.append(f'<polygon data-object={quoteattr(p["id"])} data-item={quoteattr(p["item_id"])} points="{_pts(p["corners"])}" fill="{color}" fill-opacity="0.18" stroke="{color}" stroke-width="1.2"/>')
    for a, b in p["steps"]:
        out.append(f'<path data-object-step={quoteattr(p["id"])} d="M {_n(a[0])} {_n(a[1])} L {_n(b[0])} {_n(b[1])}" stroke="{color}" stroke-width="1" fill="none"/>')
    s = min(3.0, max(0.35, min(p["w"], p["h"]) * 0.6 / 24))
    out.append(f'<g data-symbol={quoteattr(p["icon"])} transform="translate({_n(p["cx"])} {_n(p["cy"])}) rotate({_n(p["rotation"])}) scale({_n(s)}) translate(-12 -12)" '
               f'fill="none" stroke="{color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{symbol_markup(p["icon"])}</g>')
    if labels and p["label"]:
        out.append(f'<text data-object-label={quoteattr(p["id"])} x="{_n(p["cx"])}" y="{_n(p["cy"] + p["h"] / 2 + 12)}" font-size="11">{escape(p["label"])}</text>')
    return out


def _svg_connector(p: dict[str, Any], labels: bool) -> list[str]:
    d = "M " + " L ".join(f"{_n(x)} {_n(y)}" for x, y in p["points"])
    out = [f'<path data-connector={quoteattr(p["id"])} data-kind={quoteattr(p["ckind"])} d="{d}" stroke="{TOKENS["structure"]}" stroke-opacity="0.25" stroke-width="{_n(p["width"])}" fill="none"/>',
           f'<path data-connector-arrow={quoteattr(p["id"])} d="M {_n(p["arrow"]["from"][0])} {_n(p["arrow"]["from"][1])} L {_n(p["arrow"]["to"][0])} {_n(p["arrow"]["to"][1])}" '
           f'stroke="{TOKENS["structure"]}" stroke-width="2" marker-end="url(#sw-arrow)" fill="none"/>']
    if labels:
        out.append(f'<text data-connector-label={quoteattr(p["id"])} x="{_n(p["lx"])}" y="{_n(p["ly"])}" font-size="12">{escape(p["label"])}</text>')
    return out


def render_svg(doc: dict[str, Any], zones: list[dict[str, Any]], width: float, height: float, *, level: str | None = None, labels: bool = True, rooms: bool = True,
               layers: Any = None, anchors: dict[str, Any] | None = None, items: dict[str, Any] | None = None) -> str:
    """The structure, the connectors and the objects as SVG - the same primitives as the map. `layers` is a subset of
    LAYERS (default all); `labels=False` removes the labels layer; `anchors` moves bound bodies to their live anchors."""
    show = _layer_set(layers, labels)
    prims = structure_primitives(_prepared(doc, anchors), width, height, level, items)
    w, h = _n(width), _n(height)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
           f'<defs><marker id="sw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="{TOKENS["structure"]}"/></marker></defs>',
           f'<rect width="{w}" height="{h}" fill="{TOKENS["canvas"]}"/>']
    if rooms:
        out.append('<g id="rooms">')
        for z, pts in _rooms(zones, width, height, level):
            out.append(f'<polygon data-room={quoteattr(z["id"])} points="{_pts(pts)}" fill="{TOKENS["room_fill"]}" stroke="{TOKENS["room_line"]}" stroke-width="1"/>')
        out.append("</g>")
    if "structure" in show:
        out.append(f'<g id="walls" fill="none" stroke="{TOKENS["structure"]}" stroke-linecap="butt" stroke-linejoin="miter">')
        out.extend(f'<polyline data-wall={quoteattr(p["id"])} points="{_pts(p["points"])}" stroke-width="{_n(p["width"])}"/>' for p in prims if p["kind"] == "wall")
        out.append("</g>")
        out.append('<g id="openings" fill="none">')
        for p in prims:
            if p["kind"] == "door":
                out.append(f'<g data-opening={quoteattr(p["id"])}>')
                out.extend(f'<line x1="{_n(a[0])}" y1="{_n(a[1])}" x2="{_n(b[0])}" y2="{_n(b[1])}" stroke="{TOKENS["opening"]}" stroke-width="1.5"/>' for a, b in p["leaves"])
                out.extend(f'<path d="M {_n(a["from"][0])} {_n(a["from"][1])} A {_n(a["r"])} {_n(a["r"])} 0 0 {a["sweep"]} {_n(a["to"][0])} {_n(a["to"][1])}" '
                           f'stroke="{TOKENS["opening"]}" stroke-width="1" stroke-dasharray="4 3"/>' for a in p["arcs"])
                out.append("</g>")
            elif p["kind"] == "window":
                out.append(f'<g data-opening={quoteattr(p["id"])}>')
                out.extend(f'<line x1="{_n(a[0])}" y1="{_n(a[1])}" x2="{_n(b[0])}" y2="{_n(b[1])}" stroke="{TOKENS["glass"]}" stroke-width="1.5"/>' for a, b in p["lines"])
                out.append("</g>")
            elif p["kind"] == "passage":
                a, b = p["gap"]
                out.append(f'<line data-opening={quoteattr(p["id"])} x1="{_n(a[0])}" y1="{_n(a[1])}" x2="{_n(b[0])}" y2="{_n(b[1])}" stroke="{TOKENS["structure"]}" '
                           f'stroke-width="1" stroke-dasharray="2 3"/>')
        out.append("</g>")
    if "connectors" in show:
        out.append(f'<g id="connectors" font-family="Arial, Helvetica, sans-serif" font-weight="600" fill="{TOKENS["label"]}" text-anchor="middle" dominant-baseline="middle">')
        for p in prims:
            if p["kind"] == "connector":
                out.extend(_svg_connector(p, "labels" in show))
        out.append("</g>")
    if "objects" in show:
        out.append(f'<g id="objects" font-family="Arial, Helvetica, sans-serif" font-weight="600" fill="{TOKENS["label"]}" text-anchor="middle" dominant-baseline="middle">')
        for p in prims:
            if p["kind"] == "object":
                out.extend(_svg_object(p, "labels" in show))
        out.append("</g>")
    if "labels" in show:
        out.append(f'<g id="labels" font-family="Arial, Helvetica, sans-serif" font-weight="600" fill="{TOKENS["label"]}" text-anchor="middle" dominant-baseline="middle">')
        out.extend(f'<text data-label={quoteattr(p["id"])} x="{_n(p["x"])}" y="{_n(p["y"])}" font-size="{_n(p["size"])}">{escape(p["text"])}</text>'
                   for p in prims if p["kind"] == "label")
        out.append("</g>")
    out.append("</svg>")
    return "\n".join(out) + "\n"


def _rgb(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha


def _ellipse_points(p: dict[str, Any], n: int = 24) -> list[tuple[float, float]]:
    theta = math.radians(p["rotation"])
    return [_rotated(p["cx"], p["cy"], math.cos(2 * math.pi * i / n) * p["w"] / 2, math.sin(2 * math.pi * i / n) * p["h"] / 2, theta) for i in range(n)]


def render_png(doc: dict[str, Any], zones: list[dict[str, Any]], width: float, height: float, *, background: Path | None = None, level: str | None = None,
               layers: Any = None, anchors: dict[str, Any] | None = None, items: dict[str, Any] | None = None) -> bytes:
    """The structure, connectors and object footprints over the plan picture (or white). Text stays in the SVG:
    Pillow cannot shape Hebrew; symbols too (a centre dot marks each object)."""
    from PIL import Image, ImageDraw

    show = _layer_set(layers, True)
    size = (int(round(width)), int(round(height)))
    if background is not None:
        with Image.open(background) as im:
            base = im.convert("RGBA")
            if base.size != size:
                base = base.resize(size)
    else:
        base = Image.new("RGBA", size, _rgb(TOKENS["canvas"]))
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for _z, pts in _rooms(zones, width, height, level):
        draw.polygon([tuple(p) for p in pts], fill=_rgb(TOKENS["room_fill"], 110), outline=_rgb(TOKENS["room_line"]))
    prims = structure_primitives(_prepared(doc, anchors), width, height, level, items)
    if "connectors" in show:
        for p in prims:
            if p["kind"] == "connector":
                draw.line([tuple(q) for q in p["points"]], fill=_rgb(TOKENS["structure"], 60), width=max(1, int(round(p["width"]))))
                draw.line([tuple(p["arrow"]["from"]), tuple(p["arrow"]["to"])], fill=_rgb(TOKENS["structure"]), width=2)
    if "structure" in show:
        for p in prims:
            if p["kind"] == "wall":
                draw.line([tuple(q) for q in p["points"]], fill=_rgb(TOKENS["structure"]), width=max(1, int(round(p["width"]))), joint="curve")
        for p in prims:
            if p["kind"] == "door":
                arcs = p["arcs"] or [None] * len(p["leaves"])
                for (a, b), arc in zip(p["leaves"], arcs):
                    draw.line([tuple(a), tuple(b)], fill=_rgb(TOKENS["opening"]), width=2)
                    if arc is not None:
                        cx, cy, r = a[0], a[1], arc["r"]
                        start = math.degrees(math.atan2(arc["from"][1] - cy, arc["from"][0] - cx))
                        end = math.degrees(math.atan2(arc["to"][1] - cy, arc["to"][0] - cx))
                        if not arc["sweep"]:
                            start, end = end, start
                        draw.arc([cx - r, cy - r, cx + r, cy + r], start=start, end=end, fill=_rgb(TOKENS["opening"]), width=1)
            elif p["kind"] == "window":
                for a, b in p["lines"]:
                    draw.line([tuple(a), tuple(b)], fill=_rgb(TOKENS["glass"]), width=2)
            elif p["kind"] == "passage":
                draw.line([tuple(p["gap"][0]), tuple(p["gap"][1])], fill=_rgb(TOKENS["structure"]), width=1)
    if "objects" in show:
        for p in prims:
            if p["kind"] != "object":
                continue
            color = OBJECT_COLORS.get(p["color"], OBJECT_COLORS["object"])
            pts = _ellipse_points(p) if p["shape"] == "cylinder" else [tuple(q) for q in p["corners"]]
            draw.polygon([tuple(q) for q in pts], fill=_rgb(color, 60), outline=_rgb(color))
            for a, b in p["steps"]:
                draw.line([tuple(a), tuple(b)], fill=_rgb(color), width=1)
            draw.ellipse([p["cx"] - 2, p["cy"] - 2, p["cx"] + 2, p["cy"] + 2], fill=_rgb(color))
    out = Image.alpha_composite(base, layer).convert("RGB")
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()
