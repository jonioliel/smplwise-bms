"""The path of a wall, straight or curved (owner request 2026-10-08: curved walls, arcs, round rooms). A wall keeps its
`polyline` (corner points, 0..1) and may carry `bulges`: one number per segment (len(polyline) - 1), the DXF
LWPOLYLINE convention - bulge = tan(theta / 4), theta the angle the arc turns through, 0 = a straight segment.

Everything here works in plan PIXELS (x * width_px, y * height_px): the normalized space is not isotropic (a plan
wider than it is tall stretches x), so an arc is only a circle in pixels. The sign follows the stored numbers (x to
the right, y DOWN): a positive bulge turns from +x towards +y, which is clockwise on screen; the arc then bulges to the
screen-left of the segment's direction (the side geometry.ts calls `nl` = (d.y, -d.x)). The DXF export mirrors y, so
it writes -bulge.

This module is the single source of the sampled path every consumer uses (render, exports, openings, lengths,
offsets, areas); frontend/src/map/wall-path.ts is its mirror and contracts/fixtures/plan_geometry/wall-path.golden.json
pins both. It imports nothing from the rest of the service, so any wall kind (and any later module) can use it."""
from __future__ import annotations

import math
from typing import Any, Mapping, Sequence

Point = tuple[float, float]

MAX_BULGE = 4.0  # |bulge| <= 4: an arc of at most ~303 degrees (a full circle is two segments of bulge 1)
TOL_PX = 0.25  # default sampling tolerance: the largest distance between the arc and its chords, in plan pixels
MAX_STEP = math.pi / 36  # never more than 5 degrees per chord, whatever the radius (the 3D view and the hit lines)
MAX_SEGMENTS = 128  # chords per arc at most
EPS = 1e-9


def _num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


# ---------------------------------------------------------------- reading a wall

def bulges_of(wall: Mapping[str, Any]) -> list[float]:
    """The wall's bulges, one per segment; all zeros when absent. A malformed list (wrong length or a non-number) reads
    as straight: the validator refuses such a document, and a reader must never crash on a draft that fails it."""
    pl = wall.get("polyline")
    n = max(0, len(pl) - 1) if isinstance(pl, list) else 0
    raw = wall.get("bulges")
    if not isinstance(raw, list) or len(raw) != n or not all(_num(b) for b in raw):
        return [0.0] * n
    return [float(b) for b in raw]


def is_curved(wall: Mapping[str, Any]) -> bool:
    return any(abs(b) > EPS for b in bulges_of(wall))


def wall_px(wall: Mapping[str, Any], width: float, height: float) -> tuple[list[Point], list[float]]:
    """The wall's corner points in plan pixels and its bulges."""
    pts = [(float(p[0]) * width, float(p[1]) * height) for p in wall.get("polyline") or []]
    return pts, bulges_of(wall)


# ---------------------------------------------------------------- one segment

def arc_of(a: Point, b: Point, bulge: float) -> tuple[float, float, float, float, float] | None:
    """(cx, cy, r, start angle, sweep) of the arc a -> b, or None for a straight (or zero-length) segment. Angles are
    atan2 angles in the stored frame; the sweep is signed (positive = increasing angle = the bulge's sign)."""
    if abs(bulge) <= EPS:
        return None
    dx, dy = b[0] - a[0], b[1] - a[1]
    chord = math.hypot(dx, dy)
    if chord <= EPS:
        return None
    k = (1.0 - bulge * bulge) / (4.0 * bulge)  # the centre sits k * chord from the midpoint, along (-dy, dx) / chord
    cx = (a[0] + b[0]) / 2 - dy * k
    cy = (a[1] + b[1]) / 2 + dx * k
    r = chord * (1.0 + bulge * bulge) / (4.0 * abs(bulge))
    return cx, cy, r, math.atan2(a[1] - cy, a[0] - cx), 4.0 * math.atan(bulge)


def seg_length(a: Point, b: Point, bulge: float) -> float:
    arc = arc_of(a, b, bulge)
    return math.hypot(b[0] - a[0], b[1] - a[1]) if arc is None else arc[2] * abs(arc[4])


def radius(a: Point, b: Point, bulge: float) -> float:
    """The arc's radius in pixels; infinity for a straight segment."""
    arc = arc_of(a, b, bulge)
    return math.inf if arc is None else arc[2]


def _steps(r: float, sweep: float, tol: float) -> int:
    step = MAX_STEP
    if tol < r:
        step = min(step, 2.0 * math.acos(1.0 - tol / r))
    return max(1, min(MAX_SEGMENTS, math.ceil(abs(sweep) / step - EPS)))


# ---------------------------------------------------------------- a whole path

def cumulative(pts: Sequence[Point], bulges: Sequence[float]) -> list[float]:
    out = [0.0]
    for i in range(len(pts) - 1):
        out.append(out[-1] + seg_length(pts[i], pts[i + 1], bulges[i] if i < len(bulges) else 0.0))
    return out


def path_length(pts: Sequence[Point], bulges: Sequence[float]) -> float:
    return cumulative(pts, bulges)[-1]


def _seg_point(a: Point, b: Point, bulge: float, f: float) -> tuple[Point, Point]:
    """The point at fraction f (0..1, by length) of one segment and the unit direction of travel there."""
    arc = arc_of(a, b, bulge)
    if arc is None:
        dx, dy = b[0] - a[0], b[1] - a[1]
        n = math.hypot(dx, dy)
        d = (dx / n, dy / n) if n > EPS else (1.0, 0.0)
        return (a[0] + dx * f, a[1] + dy * f), d
    cx, cy, r, a0, sweep = arc
    ang = a0 + sweep * f
    sgn = 1.0 if sweep > 0 else -1.0
    return (cx + r * math.cos(ang), cy + r * math.sin(ang)), (-math.sin(ang) * sgn, math.cos(ang) * sgn)


def _locate(cum: list[float], s: float) -> tuple[int, float]:
    """The segment index holding arc length s (clamped to the path) and the fraction along it - the render's rule: the
    first segment whose end is at or beyond s."""
    i = 0
    n = len(cum) - 1
    while i < n - 1 and s > cum[i + 1]:
        i += 1
    seg = cum[i + 1] - cum[i]
    return i, (min(1.0, max(0.0, (s - cum[i]) / seg)) if seg > EPS else 0.0)


def point_at(pts: Sequence[Point], bulges: Sequence[float], s: float, cum: list[float] | None = None) -> tuple[Point, Point]:
    """The point at arc length s along the path and the unit tangent there (direction of travel)."""
    cum = cum or cumulative(pts, bulges)
    i, f = _locate(cum, s)
    return _seg_point(pts[i], pts[i + 1], bulges[i], f)


def sub_path(pts: Sequence[Point], bulges: Sequence[float], s0: float, s1: float, cum: list[float] | None = None) -> tuple[list[Point], list[float]]:
    """The exact part of the path between arc lengths s0 < s1: corner points and bulges (a cut arc keeps its circle:
    its bulge is tan of a quarter of the part's own sweep)."""
    cum = cum or cumulative(pts, bulges)
    i0, f0 = _locate(cum, s0)
    i1, f1 = _locate(cum, s1)
    out_p: list[Point] = [_seg_point(pts[i0], pts[i0 + 1], bulges[i0], f0)[0]]
    out_b: list[float] = []
    for i in range(i0, i1 + 1):
        lo = f0 if i == i0 else 0.0
        hi = f1 if i == i1 else 1.0
        if hi - lo <= EPS and not (i == i0 == i1):
            continue
        b = bulges[i]
        out_b.append(0.0 if abs(b) <= EPS else math.tan(math.atan(b) * (hi - lo)))
        out_p.append(_seg_point(pts[i], pts[i + 1], b, hi)[0] if i == i1 else pts[i + 1])
    if len(out_p) == 1:  # s0 == s1 on one segment
        out_p.append(out_p[0])
        out_b.append(0.0)
    return out_p, out_b


def sample_with_s(pts: Sequence[Point], bulges: Sequence[float], tol: float = TOL_PX) -> tuple[list[Point], list[float]]:
    """The path as a polyline whose chords stay within `tol` pixels of every arc (and at most MAX_STEP per chord),
    with the exact arc length of each sampled point - so a projection onto the samples maps back to the wall's own
    length. Straight segments add only their end point; corner points are always kept exactly."""
    if not pts:
        return [], []
    out: list[Point] = [pts[0]]
    s_out: list[float] = [0.0]
    s = 0.0
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        bulge = bulges[i] if i < len(bulges) else 0.0
        arc = arc_of(a, b, bulge)
        if arc is None:
            s += math.hypot(b[0] - a[0], b[1] - a[1])
            out.append(b)
            s_out.append(s)
            continue
        cx, cy, r, a0, sweep = arc
        n = _steps(r, sweep, tol)
        for k in range(1, n):
            ang = a0 + sweep * k / n
            out.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
            s_out.append(s + r * abs(sweep) * k / n)
        s += r * abs(sweep)
        out.append(b)
        s_out.append(s)
    return out, s_out


def sample(pts: Sequence[Point], bulges: Sequence[float], tol: float = TOL_PX) -> list[Point]:
    return sample_with_s(pts, bulges, tol)[0]


def sampled_wall(wall: Mapping[str, Any], width: float, height: float, tol: float = TOL_PX) -> list[list[float]]:
    """THE shared helper: the wall's path as a normalized polyline (0..1), arcs sampled within `tol` pixels. A straight
    wall comes back as its own polyline."""
    pts, bulges = wall_px(wall, width, height)
    return [[x / width, y / height] for x, y in sample(pts, bulges, tol)]


def wall_length_px(wall: Mapping[str, Any], width: float, height: float) -> float:
    pts, bulges = wall_px(wall, width, height)
    return path_length(pts, bulges) if len(pts) >= 2 else 0.0


def project(pts: Sequence[Point], bulges: Sequence[float], q: Point, tol: float = TOL_PX) -> tuple[float, float, Point]:
    """The nearest point of the path to q: (arc length there, distance, the point)."""
    sp, ss = sample_with_s(pts, bulges, tol)
    best = (0.0, math.inf, sp[0] if sp else q)
    for i in range(len(sp) - 1):
        (ax, ay), (bx, by) = sp[i], sp[i + 1]
        dx, dy = bx - ax, by - ay
        l2 = dx * dx + dy * dy
        u = max(0.0, min(1.0, ((q[0] - ax) * dx + (q[1] - ay) * dy) / l2)) if l2 > 0 else 0.0
        p = (ax + u * dx, ay + u * dy)
        d = math.hypot(q[0] - p[0], q[1] - p[1])
        if d < best[1]:
            best = (ss[i] + u * (ss[i + 1] - ss[i]), d, p)
    return best


# ---------------------------------------------------------------- making arcs

def bulge_through(a: Point, m: Point, b: Point) -> float:
    """The bulge of the arc from a to b through m (a 3-point arc); 0 when the three points are collinear or m sits on
    an end. Clamped to MAX_BULGE."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    side = (m[0] - a[0]) * dy - (m[1] - a[1]) * dx  # > 0: m on the side a positive bulge bulges to
    ux, uy, vx, vy = a[0] - m[0], a[1] - m[1], b[0] - m[0], b[1] - m[1]
    nu, nv = math.hypot(ux, uy), math.hypot(vx, vy)
    if nu <= EPS or nv <= EPS or abs(side) <= EPS * max(1.0, math.hypot(dx, dy)):
        return 0.0
    inscribed = math.acos(max(-1.0, min(1.0, (ux * vx + uy * vy) / (nu * nv))))  # the angle at m = pi - theta / 2
    mag = math.tan((math.pi - inscribed) / 2.0)
    return math.copysign(min(MAX_BULGE, mag), side)


def bulge_for_radius(a: Point, b: Point, r: float, sign: float, major: bool = False) -> float | None:
    """The bulge of the arc of radius r (pixels) from a to b on the side of `sign`; None when r is shorter than half
    the chord. The minor arc unless `major`."""
    chord = math.hypot(b[0] - a[0], b[1] - a[1])
    if chord <= EPS or not (r > 0) or r < chord / 2 - 1e-9:
        return None
    half = math.asin(min(1.0, chord / (2.0 * r)))  # theta / 2 of the minor arc
    theta = 2.0 * math.pi - 2.0 * half if major else 2.0 * half
    return math.copysign(min(MAX_BULGE, math.tan(theta / 4.0)), sign if sign != 0 else 1.0)


def fillet(pts: Sequence[Point], bulges: Sequence[float], i: int, r: float) -> tuple[list[Point], list[float]] | None:
    """Round corner i (pixels) with an arc of radius r tangent to both of its segments, which must be straight. A
    closed outline (last point == first) may round any corner, 0 included. None when the corner cannot take that
    radius (an end of an open wall, a curved neighbour, a straight-through corner, or the tangent points would run
    past the neighbouring corners)."""
    pts = list(pts)
    bulges = list(bulges)
    n = len(pts)
    if n >= 4 and pts[0] == pts[-1] and i == 0:
        # a closed outline's corner 0 is its start and its end: the path then starts at the second tangent point,
        # [p2, v1, ..., v(m-1), p1, p2], the fillet closing it (segments v(m-1) -> p1 and p2 -> v1 keep their bulges)
        res = _fillet_corner(pts[-2], pts[0], pts[1], bulges[-1], bulges[0], r)
        if res is None:
            return None
        p1, p2, fb = res
        return [p2, *pts[1:-1], p1, p2], [*bulges, fb]
    if not 0 < i < n - 1:
        return None
    res = _fillet_corner(pts[i - 1], pts[i], pts[i + 1], bulges[i - 1], bulges[i], r)
    if res is None:
        return None
    p1, p2, fb = res
    return [*pts[:i], p1, p2, *pts[i + 1:]], [*bulges[:i], fb, *bulges[i:]]


def _fillet_corner(a: Point, v: Point, b: Point, b_in: float, b_out: float, r: float) -> tuple[Point, Point, float] | None:
    """The two tangent points and the bulge of the fillet of radius r at corner v between a -> v and v -> b."""
    (ax, ay), (vx, vy), (bx, by) = a, v, b
    two = (b_in, b_out)
    if any(abs(b) > EPS for b in two) or not (r > 0):
        return None
    d1x, d1y = vx - ax, vy - ay
    d2x, d2y = bx - vx, by - vy
    l1, l2 = math.hypot(d1x, d1y), math.hypot(d2x, d2y)
    if l1 <= EPS or l2 <= EPS:
        return None
    d1x, d1y, d2x, d2y = d1x / l1, d1y / l1, d2x / l2, d2y / l2
    cross = d1x * d2y - d1y * d2x
    turn = math.atan2(cross, d1x * d2x + d1y * d2y)  # signed turning angle at the corner
    if abs(turn) <= 1e-6 or abs(turn) >= math.pi - 1e-6:
        return None
    tlen = r * math.tan(abs(turn) / 2.0)
    if tlen > l1 + 1e-9 or tlen > l2 + 1e-9:
        return None
    p1 = (vx - d1x * tlen, vy - d1y * tlen)
    p2 = (vx + d2x * tlen, vy + d2y * tlen)
    return p1, p2, math.tan(turn / 4.0)


# ---------------------------------------------------------------- areas and edges

def ring_area(pts: Sequence[Point], bulges: Sequence[float]) -> float:
    """The signed area (pixels squared) enclosed by a closed path (last point == first): the corner polygon by the
    shoelace plus each arc's circular segment. Positive when the path runs with increasing angle in the stored
    frame (clockwise on screen)."""
    a = 0.0
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        a += x0 * y1 - x1 * y0
    area = a / 2.0
    for i in range(len(pts) - 1):
        arc = arc_of(pts[i], pts[i + 1], bulges[i] if i < len(bulges) else 0.0)
        if arc is not None:
            r, sweep = arc[2], arc[4]
            area += math.copysign(r * r / 2.0 * (abs(sweep) - math.sin(abs(sweep))), sweep)
    return area


def offset_polyline(pts: Sequence[Point], d: float, miter_limit: float = 4.0) -> list[Point]:
    """A polyline moved sideways by d pixels (positive = screen-left of travel, geometry.ts' `nl`), with mitred joins
    (a join sharper than miter_limit * |d| is cut at that length). Used on a sampled path for a wall's two faces:
    offset_polyline(sampled, +t/2) and offset_polyline(sampled, -t/2)."""
    pts = [p for k, p in enumerate(pts) if k == 0 or math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) > EPS]
    if len(pts) < 2:
        return list(pts)
    normals = []
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        n = math.hypot(bx - ax, by - ay)
        normals.append(((by - ay) / n, -(bx - ax) / n))
    out = [(pts[0][0] + normals[0][0] * d, pts[0][1] + normals[0][1] * d)]
    for k in range(1, len(pts) - 1):
        (n0x, n0y), (n1x, n1y) = normals[k - 1], normals[k]
        mx, my = n0x + n1x, n0y + n1y
        mn = math.hypot(mx, my)
        if mn <= EPS:
            out.append((pts[k][0] + n1x * d, pts[k][1] + n1y * d))
            continue
        mx, my = mx / mn, my / mn
        cos_half = mx * n1x + my * n1y
        length = d / cos_half if cos_half > EPS else d * miter_limit
        if abs(length) > abs(d) * miter_limit:
            length = math.copysign(abs(d) * miter_limit, length)
        out.append((pts[k][0] + mx * length, pts[k][1] + my * length))
    n = normals[-1]
    out.append((pts[-1][0] + n[0] * d, pts[-1][1] + n[1] * d))
    return out


def wall_faces(wall: Mapping[str, Any], width: float, height: float, thickness_px: float, tol: float = TOL_PX) -> tuple[list[Point], list[Point]]:
    """The wall's two faces in pixels (left, right of travel), from its sampled path."""
    pts, bulges = wall_px(wall, width, height)
    s = sample(pts, bulges, tol)
    return offset_polyline(s, thickness_px / 2.0), offset_polyline(s, -thickness_px / 2.0)
