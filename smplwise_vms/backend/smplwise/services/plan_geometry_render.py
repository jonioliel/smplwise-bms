"""Deterministic drawing of the Plan Studio structure layer (T084, CR-003). structure_primitives() turns a v2 document
into plain shapes in plan pixels - walls cut by their openings (free ends extended by half the thickness so corners
close), door leaves and swing arcs, window glass, passages, labels. The SVG / PNG exports draw exactly these shapes and
frontend/src/map/geometry.ts computes the same list for the map; contracts/fixtures/plan_geometry pins both.
Coordinates are rounded half-up to 0.01 px, the same arithmetic on both sides."""
from __future__ import annotations

import math
from typing import Any

from .plan_geometry import DEFAULT_WALL_THICKNESS_M, effective_scale

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
    if swing == "sliding":
        k = w * 0.12
        return {"leaves": [[_p(_add(g0, nl, k)), _p(_add(g1, nl, k))]], "arcs": []}
    if swing == "double":
        h = w / 2
        leaves: list[list[list[float]]] = []
        arcs: list[dict[str, Any]] = []
        for hinge, along in ((g0, d), (g1, (-d[0], -d[1]))):
            tip = _add(hinge, nl, h)
            mid = _add(hinge, along, h)
            leaves.append([_p(hinge), _p(tip)])
            arcs.append({"from": _p(tip), "to": _p(mid), "r": r2(h), "sweep": _sweep(hinge, tip, mid)})
        return {"leaves": leaves, "arcs": arcs}
    n = nl if swing == "left" else nr
    hinge, other = (g0, g1) if (opening.get("hinge") or "start") == "start" else (g1, g0)
    tip = _add(hinge, n, w)
    return {"leaves": [[_p(hinge), _p(tip)]], "arcs": [{"from": _p(tip), "to": _p(other), "r": r2(w), "sweep": _sweep(hinge, tip, other)}]}


def structure_primitives(doc: dict[str, Any], width: float, height: float, level: str | None = None) -> list[dict[str, Any]]:
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
    return prims
