"""Local detection of walls, doors and windows from a plan picture (Plan Studio phase 3, T086, design section 9).

A pure function over a PNG, numpy and Pillow only (no OpenCV, no scipy, no model, no database): Otsu -> the same
morphology plan_stylize uses for its wall mask -> Zhang-Suen thinning -> skeleton tracing -> Douglas-Peucker ->
axis snapping at <= 4 degrees -> collinear merging -> thickness from a chamfer distance transform -> gaps between
collinear pieces classified by sampling the thin-ink mask (a door arc, mirrored arcs, window lines) -> windows from
the ink-thickness profile along each wall. The result is a set of document-v2 candidates (source "auto", a confidence
per item, ids "auto-<run>-w001" / "auto-<run>-o001") in the 0..1 space of the picture, with a calibration hint from
the door widths when the plan is not calibrated. Nothing here is stored or published: the router returns the
candidates and a person accepts them (routers/plan_geometry.py)."""
from __future__ import annotations

import io
import math
import time
from typing import Any

import numpy as np
from PIL import Image

from . import plan_stylize as ps
from .plan_zones import rdp

VERSION = "1.0"
ANALYSIS_PX = 1600  # the working resolution (design 9.1 / 9.6)
TILT_PX = 800  # the cheap first pass that measures the tilt of a scan
TILT_MIN_DEG = 0.15
DEFAULT_WALL_M = 0.2  # an uncalibrated plan: the median wall is taken as 0.2 m (phase 1's assumption, measured here)
DOOR_TYPICAL_M = 0.9  # the calibration hint (design 6.3)
AXIS_TOL_DEG = 4.0
ARC_INK_RATIO = 0.6
WINDOW_LINE_RATIO = 0.6
DOOR_RANGE_M = (0.6, 1.5)
DOUBLE_RANGE_M = (1.5, 2.4)
DOOR_RANGE_T = (1.5, 4.0)  # uncalibrated: a gap of 1.5 to 4 wall thicknesses may be a door too
WINDOW_RANGE_M = (0.5, 3.0)
MIN_WALL_M = 0.25
MIN_WALL_FRACTION = 0.005
PROFILE_STEP_M = 0.05
TARGETS = ("walls", "openings")


# ---------------------------------------------------------------- raster primitives (numpy only)

def chamfer_dt(mask: np.ndarray) -> np.ndarray:
    """Two-pass 3-4 chamfer distance transform (pixels) from every set pixel to the nearest unset pixel; the picture
    border counts as background. Each pass is one loop over rows: the in-row dependency (min over k <= x of
    d[k] + 3(x - k)) is a running minimum of d[k] - 3k plus 3x, so a row costs a few vectorised numpy calls."""
    m = np.pad(np.asarray(mask, dtype=bool), 1)
    h, w = m.shape
    d = np.where(m, 10**8, 0).astype(np.int64)
    x3 = 3 * np.arange(w, dtype=np.int64)

    def diag(c: np.ndarray, other: np.ndarray) -> np.ndarray:
        c = np.minimum(c, other + 3)
        c[1:] = np.minimum(c[1:], other[:-1] + 4)
        c[:-1] = np.minimum(c[:-1], other[1:] + 4)
        return c

    d[0] = np.minimum.accumulate(d[0] - x3) + x3
    for y in range(1, h):
        d[y] = np.minimum.accumulate(diag(d[y], d[y - 1]) - x3) + x3
    d[h - 1] = (np.minimum.accumulate(d[h - 1][::-1] - x3) + x3)[::-1]
    for y in range(h - 2, -1, -1):
        d[y] = (np.minimum.accumulate(diag(d[y], d[y + 1])[::-1] - x3) + x3)[::-1]
    return (d[1:-1, 1:-1] / 3.0).astype(np.float32)


def _zs_tables() -> tuple[np.ndarray, np.ndarray]:
    """The two Zhang-Suen sub-iteration rules as 512-entry tables: the low byte is the neighbour byte (bit k is P(k + 2)
    in the order N, NE, E, SE, S, SW, W, NW), bit 8 says the pixel lies where the input is thinner than three pixels.
    There Lu-Wang's 3 <= B <= 6 applies, so a line that is already two pixels thick (a 2-px diagonal) is not eroded
    from both ends to nothing; everywhere else Zhang-Suen's 2 <= B <= 6, which also trims the end of a thick slanted
    bar to one end point (B >= 3 there leaves a fork of spurs about half a thickness long)."""
    tables = []
    for step in (0, 1):
        t = np.zeros(512, dtype=bool)
        for code in range(512):
            p = [(code >> k) & 1 for k in range(8)]
            b = sum(p)
            a = sum(1 for k in range(8) if p[k] == 0 and p[(k + 1) % 8] == 1)
            p2, _p3, p4, _p5, p6, _p7, p8, _p9 = p
            m = (p2 * p4 * p6 == 0 and p4 * p6 * p8 == 0) if step == 0 else (p2 * p4 * p8 == 0 and p2 * p6 * p8 == 0)
            t[code] = (3 if code >> 8 else 2) <= b <= 6 and a == 1 and m
        tables.append(t)
    return tables[0], tables[1]


_ZS_TABLES = _zs_tables()
_BIT = {"N": 1, "NE": 2, "E": 4, "SE": 8, "S": 16, "SW": 32, "W": 64, "NW": 128}  # the neighbour byte of thin
# the clean-up patterns as (bits that must be set, bits that must be empty) of the neighbour byte: first every bump (a
# pixel whose only two neighbours are a 4-neighbour and the diagonal next to it, the tip of a triangle), then every
# stair corner (two perpendicular 4-neighbours set, the three opposite pixels empty). Each pattern is safe to apply
# to all pixels at once: two neighbouring pixels cannot both match the same pattern.
_CLEANUP = tuple((_BIT[x] | _BIT[y], 255 & ~(_BIT[x] | _BIT[y])) for x, y in (
    ("N", "NE"), ("N", "NW"), ("E", "NE"), ("E", "SE"), ("S", "SE"), ("S", "SW"), ("W", "SW"), ("W", "NW"))) + tuple(
    (_BIT[x] | _BIT[y], _BIT[o1] | _BIT[o2] | _BIT[o3]) for x, y, o1, o2, o3 in (
        ("N", "E", "S", "W", "SW"), ("E", "S", "W", "N", "NW"), ("S", "W", "N", "E", "NE"), ("W", "N", "E", "S", "SE")))


def _distinct(a: np.ndarray) -> np.ndarray:
    """The sorted distinct values of an index array (a sort and a neighbour compare: faster here than np.unique)."""
    if a.size < 2:
        return a
    a = np.sort(a)
    keep = np.empty(a.size, dtype=bool)
    keep[0] = True
    np.not_equal(a[1:], a[:-1], out=keep[1:])
    return a[keep]


def thin(mask: np.ndarray, max_iter: int | None = None) -> np.ndarray:
    """Zhang-Suen thinning (Lu-Wang's B >= 3 where the input is already a line, see _zs_tables) followed by a clean-up
    pass, on the bounding box of the mask.

    Each sub-iteration looks up only candidate pixels in a table of their neighbour byte: first every set pixel with a
    background 4-neighbour, later only the set pixels next to one deleted since that sub-iteration last ran (a pixel
    whose neighbourhood did not change gives the same answer), so the cost follows the boundary, not the area. A 2 x 2
    block whose four pixels would all go at once keeps one. `max_iter` (default: the larger side of the bounding box)
    bounds the iterations; hitting it raises RuntimeError instead of returning a half-thinned mask. The clean-up pass
    then deletes, one pattern at a time (each pattern is safe in parallel), every bump (a pixel whose only two
    neighbours touch each other) and the corner pixel of every 4-connected step (two perpendicular 4-neighbours set,
    the three opposite pixels empty), so a tilted wall is one 8-connected line without junction pixels. Thinning and
    clean-up alternate until neither changes anything."""
    ys, xs = np.nonzero(mask)
    if not ys.size:
        return np.zeros(mask.shape, dtype=bool)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
    img = np.pad(np.asarray(mask[y0:y1, x0:x1], dtype=np.uint8), 1)
    hh, ww = img.shape
    flat = img.reshape(-1)
    offs = np.array([-ww, -ww + 1, 1, ww + 1, ww, ww - 1, -1, -ww - 1], dtype=np.int64)  # N NE E SE S SW W NW
    c = img[1:-1, 1:-1]
    edge = (c == 1) & ((img[:-2, 1:-1] == 0) | (img[2:, 1:-1] == 0) | (img[1:-1, :-2] == 0) | (img[1:-1, 2:] == 0))
    ey, ex = np.nonzero(edge)
    start = (ey.astype(np.int64) + 1) * ww + ex + 1
    # 256 where no 3 x 3 square of the input covers the pixel (the input is already a line there): the B >= 3 rule
    core = img.copy()
    core[1:-1, 1:-1] &= img[:-2, 1:-1] & img[2:, 1:-1] & img[1:-1, :-2] & img[1:-1, 2:] & img[:-2, :-2] & img[:-2, 2:] & img[2:, :-2] & img[2:, 2:]
    core[[0, -1], :] = 0
    core[:, [0, -1]] = 0
    cover = core.copy()
    cover[1:-1, 1:-1] |= core[:-2, 1:-1] | core[2:, 1:-1] | core[1:-1, :-2] | core[1:-1, 2:] | core[:-2, :-2] | core[:-2, 2:] | core[2:, :-2] | core[2:, 2:]
    line_flag = ((img == 1) & (cover == 0)).astype(np.int64).reshape(-1) * 256
    cand = [start, start.copy()]
    limit = max_iter if max_iter is not None else max(hh, ww)
    it = 0
    dying = np.zeros(flat.size, dtype=bool)
    while True:
        while cand[0].size or cand[1].size:
            if it >= limit:
                raise RuntimeError(f"thin: not converged after {limit} iterations")
            it += 1
            for step in (0, 1):
                idx = cand[step]
                cand[step] = idx[:0]
                idx = idx[flat[idx] == 1]
                if not idx.size:
                    continue
                code = np.packbits(flat[idx[:, None] + offs], axis=1, bitorder="little")[:, 0].astype(np.int64) + line_flag[idx]
                dead = idx[_ZS_TABLES[step][code]]
                if not dead.size:
                    continue
                # a 2 x 2 block whose four pixels all go in one sub-iteration would vanish: its top-left pixel stays
                dying[dead] = True
                whole = dying[dead + 1] & dying[dead + ww] & dying[dead + ww + 1]
                dying[dead] = False
                dead = dead[~whole]
                flat[dead] = 0
                near = (dead[:, None] + offs).ravel()
                near = near[flat[near] == 1]
                cand[0] = _distinct(np.concatenate((cand[0], near)))
                cand[1] = _distinct(np.concatenate((cand[1], near)))
        pix = np.flatnonzero(flat)
        gone = []
        for must, forbid in _CLEANUP:
            code = np.packbits(flat[pix[:, None] + offs], axis=1, bitorder="little")[:, 0]
            hit = (flat[pix] == 1) & ((code & must) == must) & ((code & forbid) == 0)
            if hit.any():
                flat[pix[hit]] = 0
                gone.append(pix[hit])
        if not gone:
            break
        gone = np.concatenate(gone)
        # a clean-up deletion can make a neighbour deletable for Zhang-Suen again: resume from those neighbours, so the
        # result is a fixed point of both (thin(thin(x)) == thin(x))
        near = (gone[:, None] + offs).ravel()
        near = _distinct(near[flat[near] == 1])
        cand = [near, near.copy()]
    out = np.zeros(mask.shape, dtype=bool)
    out[y0:y1, x0:x1] = img[1:-1, 1:-1].astype(bool)
    return out


_N8 = ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1))


def neighbour_count(skel: np.ndarray) -> np.ndarray:
    """The number of set 8-neighbours of every set pixel (0 on unset pixels): 1 is an end point, 2 a line pixel, 3 and
    more a junction."""
    p = np.pad(skel.astype(np.int16), 1)
    n = np.zeros(skel.shape, dtype=np.int16)
    for dy, dx in _N8:
        n += p[1 + dy : 1 + dy + skel.shape[0], 1 + dx : 1 + dx + skel.shape[1]]
    return n * skel


def trace_branches(skel: np.ndarray) -> list[list[tuple[int, int]]]:
    """Every branch of the skeleton between nodes (end points and junctions) as a list of (x, y) pixels; a closed loop
    without a node comes back as one branch that starts and ends at its topmost-leftmost pixel. An isolated pixel
    (no 8-neighbour) is no branch and is dropped."""
    h, w = skel.shape
    nb = neighbour_count(skel)
    node = skel & ((nb == 1) | (nb >= 3))
    visited = np.zeros_like(skel, dtype=bool)
    branches: list[list[tuple[int, int]]] = []

    def neighbours(y: int, x: int) -> list[tuple[int, int]]:
        out = []
        for dy, dx in _N8:
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and skel[yy, xx]:
                out.append((yy, xx))
        return out

    def walk(y0: int, x0: int, y1: int, x1: int) -> list[tuple[int, int]]:
        path = [(x0, y0), (x1, y1)]
        visited[y1, x1] = True
        py, px, cy, cx = y0, x0, y1, x1
        while not node[cy, cx]:
            nxt = [(yy, xx) for yy, xx in neighbours(cy, cx) if (yy, xx) != (py, px) and (node[yy, xx] or not visited[yy, xx])]
            if not nxt:
                break
            nxt.sort(key=lambda q: abs(q[0] - cy) + abs(q[1] - cx))  # a 4-neighbour before a diagonal
            py, px, (cy, cx) = cy, cx, nxt[0]
            visited[cy, cx] = True
            path.append((cx, cy))
        return path

    ys, xs = np.nonzero(node)
    for y, x in zip(ys.tolist(), xs.tolist()):
        visited[y, x] = True
        for yy, xx in neighbours(y, x):
            if node[yy, xx]:
                if (yy, xx) > (y, x):
                    branches.append([(x, y), (xx, yy)])
                continue
            if not visited[yy, xx]:
                branches.append(walk(y, x, yy, xx))
    ys, xs = np.nonzero(skel & ~visited)
    for y, x in zip(ys.tolist(), xs.tolist()):
        if visited[y, x]:
            continue
        visited[y, x] = True
        nx = neighbours(y, x)
        if nx:
            path = walk(y, x, nx[0][0], nx[0][1])
            path.append((x, y))
            branches.append(path)
    return branches


# ---------------------------------------------------------------- segments (analysis pixel space)

def _unit(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    v = b - a
    n = float(np.hypot(v[0], v[1]))
    return v / n if n > 1e-9 else np.array([1.0, 0.0])


def snap_axis(a: np.ndarray, b: np.ndarray, tol_deg: float = AXIS_TOL_DEG) -> tuple[np.ndarray, np.ndarray, bool]:
    """Rotate a segment about its midpoint onto the nearest axis when it is within tol_deg of one (length kept)."""
    v = b - a
    length = float(np.hypot(v[0], v[1]))
    if length < 1e-9:
        return a, b, False
    ang = math.degrees(math.atan2(v[1], v[0]))
    mid = (a + b) / 2
    for axis, d in ((0.0, (1.0, 0.0)), (180.0, (-1.0, 0.0)), (-180.0, (-1.0, 0.0)), (90.0, (0.0, 1.0)), (-90.0, (0.0, -1.0))):
        if abs(ang - axis) <= tol_deg:
            dv = np.array(d)
            return mid - dv * length / 2, mid + dv * length / 2, True
    return a, b, False


class Seg:
    __slots__ = ("a", "b", "samples", "axis", "raw")

    def __init__(self, a: np.ndarray, b: np.ndarray, samples: list[float], axis: bool = False, raw: np.ndarray | None = None) -> None:
        self.a, self.b, self.samples, self.axis = a, b, samples, axis
        self.raw = raw if raw is not None else _unit(a, b)  # the direction before any axis snapping (tilt estimate)

    @property
    def thick(self) -> float:
        return float(np.median(self.samples)) if self.samples else 2.0

    @property
    def length(self) -> float:
        return float(np.hypot(*(self.b - self.a)))

    @property
    def dir(self) -> np.ndarray:
        return _unit(self.a, self.b)

    def project(self, p: np.ndarray) -> tuple[float, float]:
        """(along, lateral): along from a in pixels, lateral signed distance from the line."""
        d = self.dir
        v = p - self.a
        return float(np.dot(v, d)), float(d[0] * v[1] - d[1] * v[0])


def _angle_between(u: np.ndarray, v: np.ndarray) -> float:
    return math.degrees(math.acos(max(-1.0, min(1.0, abs(float(np.dot(u, v)))))))


def _collinear(s: Seg, t: Seg, angle_tol: float = AXIS_TOL_DEG) -> tuple[float, float] | None:
    """The interval (lo, hi) of t along s's line when t lies on it (angle and lateral offset within tolerance)."""
    if _angle_between(s.dir, t.dir) > angle_tol:
        return None
    # the lateral tolerance grows with the distance along the line: two pieces of one slightly rotated wall (a scan
    # off by up to the axis tolerance) sit on lines that diverge by tan(4 deg) per pixel of separation
    base_tol = 0.75 * max(s.thick, t.thick, 2.0)
    slope = math.tan(math.radians(angle_tol))
    a0, la = s.project(t.a)
    a1, lb = s.project(t.b)
    if abs(la) > base_tol + slope * abs(a0) or abs(lb) > base_tol + slope * abs(a1):
        return None
    return min(a0, a1), max(a0, a1)


def merge_collinear(segs: list[Seg], join_px: float) -> list[Seg]:
    """Join segments on one line whose intervals touch or overlap (gap <= join_px) into one segment."""
    segs = [s for s in segs if s.length > 0]
    changed = True
    while changed:
        changed = False
        out: list[Seg] = []
        used = [False] * len(segs)
        for i, s in enumerate(segs):
            if used[i]:
                continue
            cur = s
            for j in range(i + 1, len(segs)):
                if used[j]:
                    continue
                iv = _collinear(cur, segs[j])
                if iv is None or iv[0] > cur.length + join_px or iv[1] < -join_px:
                    continue
                d = cur.dir
                cur = Seg(cur.a + d * min(0.0, iv[0]), cur.a + d * max(cur.length, iv[1]), cur.samples + segs[j].samples, cur.axis and segs[j].axis, cur.raw)
                used[j] = True
                changed = True
            out.append(cur)
            used[i] = True
        segs = out
    return segs


def line_groups(segs: list[Seg]) -> list[list[int]]:
    """Indices of the segments that share a line (union-find over the pairwise collinear relation)."""
    parent = list(range(len(segs)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(segs)):
        for j in range(i + 1, len(segs)):
            if _collinear(segs[i], segs[j]) is not None:
                parent[find(i)] = find(j)
    groups: dict[int, list[int]] = {}
    for i in range(len(segs)):
        groups.setdefault(find(i), []).append(i)
    return list(groups.values())


def estimate_tilt(segs: list[Seg], t_med: float) -> float:
    """The scan's tilt in degrees (y-down atan2 convention): the length-weighted mean of every long segment's angle to
    its nearest axis, over the segments within the axis tolerance. 0 when nothing is long enough."""
    num = den = 0.0
    for g in segs:
        if g.length < 4 * t_med:
            continue
        d = g.raw
        r = ((math.degrees(math.atan2(d[1], d[0])) + 45.0) % 90.0) - 45.0
        if abs(r) <= AXIS_TOL_DEG:
            num += r * g.length
            den += g.length
    return num / den if den else 0.0


# ---------------------------------------------------------------- the picture -> masks

def _analysis(gray: Image.Image, strength: float, analysis_px: int = ANALYSIS_PX) -> dict[str, Any]:
    """The masks at the working resolution: `walls` (the closed / opened ink, as plan_stylize builds it), `ink` (a
    softer threshold that keeps the light thin lines a scan gives door arcs and window glass), `ink_d` (ink dilated by
    one pixel, for line sampling), `thin` (ink away from the walls, dilated by two, for the arc test)."""
    width, height = gray.size
    scale = min(1.0, analysis_px / max(width, height))
    aw, ah = max(8, int(round(width * scale))), max(8, int(round(height * scale)))
    g = np.asarray(gray.resize((aw, ah), Image.LANCZOS), dtype=np.uint8)
    if g.mean() < 100:
        g = 255 - g
    thr = int(min(200, max(90, ps.otsu_threshold(g))))
    ink = g < thr
    soft = g < min(235, thr + 50)
    unit = max(1, int(round(aw / 800)))
    close_r = (1 + int(3 * strength + 0.5)) * unit  # 0.3 -> 2, 0.6 -> 3, 1.0 -> 4 units, like plan_stylize's light / medium / strong
    open_r = (1 if strength < 0.8 else 2) * unit
    # a one-pixel opening first: isolated scan speckles must not be closed into blobs (the raw ink keeps every line)
    walls = ps.opening(ps.closing(ps.opening(ink, 1), close_r), open_r)
    thin_ink = soft & ~ps.dilate(walls, 1)
    return {"aw": aw, "ah": ah, "factor": aw / width, "ink": soft, "ink_d": ps.dilate(soft, 1), "walls": walls, "thin": ps.dilate(thin_ink, 2), "threshold": thr}


def _segments(dt: np.ndarray, skel: np.ndarray, t_med: float, min_len: float) -> list[Seg]:
    """Skeleton branches -> straight segments: spurs shorter than 1.5 thicknesses go, Douglas-Peucker splits each branch
    at its corners, near-axis segments snap to the axis, collinear pieces join, short leftovers go."""
    spur = max(1.5 * t_med, 6.0)
    segs: list[Seg] = []
    for br in trace_branches(skel):
        pts = np.array(br, dtype=np.float64)
        if len(br) < 2 or float(np.sum(np.hypot(np.diff(pts[:, 0]), np.diff(pts[:, 1])))) < spur:
            continue
        samples = (2.0 * dt[pts[:, 1].astype(int), pts[:, 0].astype(int)]).tolist()
        poly = rdp([(float(x), float(y)) for x, y in br], max(1.5, 0.35 * t_med))
        for p, q in zip(poly, poly[1:]):
            a, b, on_axis = snap_axis(np.array(p), np.array(q))
            segs.append(Seg(a, b, samples, on_axis, _unit(np.array(p), np.array(q))))
    segs = merge_collinear(segs, join_px=max(1.5 * t_med, 6.0))
    return [g for g in segs if g.length >= min_len]


def _stage(gray: Image.Image, strength: float, analysis_px: int, scale_m_per_px: float | None) -> dict[str, Any]:
    an = _analysis(gray, strength, analysis_px)
    aw, ah, f = an["aw"], an["ah"], an["factor"]
    mask = an["walls"]
    dt = chamfer_dt(mask)
    skel = thin(mask)
    t_med = float(np.median(2.0 * dt[skel])) if skel.any() else 4.0
    calibrated = scale_m_per_px is not None and scale_m_per_px > 0
    # metres per analysis pixel: the calibration, else the walls themselves - the median wall is taken as 0.2 m (the
    # same assumption as phase 1's estimate, measured on this drawing instead of assumed from the width)
    s = (scale_m_per_px / f) if calibrated else DEFAULT_WALL_M / t_med
    min_len = MIN_WALL_M / s if calibrated else max(MIN_WALL_FRACTION * aw, MIN_WALL_M / s)
    segs = _segments(dt, skel, t_med, min_len)
    return {"an": an, "dt": dt, "skel": skel, "t_med": t_med, "s": s, "calibrated": calibrated, "segs": segs, "aw": aw, "ah": ah, "f": f}


# ---------------------------------------------------------------- openings (Tasks 4 and 5 replace the two stubs)

def classify_gap(g0: np.ndarray, g1: np.ndarray, d: np.ndarray, t_ref: float, s: float, calibrated: bool, thin_mask: np.ndarray, ink: np.ndarray) -> dict[str, Any] | None:
    """Task 4: what the gap between two collinear wall segments is. Until then: nothing."""
    return None


def walls_from_gaps(segs: list[Seg], s: float, calibrated: bool, thin_mask: np.ndarray, ink: np.ndarray, want_openings: bool) -> tuple[list[Seg], list[dict[str, Any]]]:
    """Walk every line of collinear segments in order; a recognised gap joins its two neighbours into one wall with the
    opening at the gap, an unrecognised gap keeps them apart. The skeleton stops half a thickness short of a wall end
    (thinning retracts the ends), so a gap is measured between the ends grown by t / 2 - the same growth the
    primitives apply when they draw a free wall end."""
    walls: list[Seg] = []
    openings: list[dict[str, Any]] = []
    for group in line_groups(segs):
        ref = max(group, key=lambda i: segs[i].length)
        base = segs[ref]
        items = []
        for i in group:
            a0, _ = base.project(segs[i].a)
            a1, _ = base.project(segs[i].b)
            items.append((min(a0, a1), max(a0, a1), i))
        items.sort()
        d = base.dir
        cur_lo, cur_hi, cur_samples, cur_axis = items[0][0], items[0][1], list(segs[items[0][2]].samples), segs[items[0][2]].axis
        pending: list[dict[str, Any]] = []
        for lo, hi, i in items[1:]:
            t_cur = max(float(np.median(cur_samples)), 2.0)
            t_ref = max(t_cur, segs[i].thick, 2.0)
            g0 = base.a + d * (cur_hi + t_cur / 2)
            g1 = base.a + d * (lo - segs[i].thick / 2)
            found = classify_gap(g0, g1, d, t_ref, s, calibrated, thin_mask, ink) if (want_openings and lo - segs[i].thick / 2 > cur_hi + t_cur / 2) else None
            if found is None:
                walls.append(Seg(base.a + d * cur_lo, base.a + d * cur_hi, cur_samples, cur_axis))
                for o in pending:
                    openings.append(dict(o, wall_seg=len(walls) - 1, t=(o["along"] - cur_lo) / max(cur_hi - cur_lo, 1e-9)))
                pending = []
                cur_lo, cur_hi, cur_samples, cur_axis = lo, hi, list(segs[i].samples), segs[i].axis
                continue
            pending.append(dict(found, along=(cur_hi + lo) / 2))
            cur_hi = max(cur_hi, hi)
            cur_samples += segs[i].samples
            cur_axis = cur_axis and segs[i].axis
        walls.append(Seg(base.a + d * cur_lo, base.a + d * cur_hi, cur_samples, cur_axis))
        for o in pending:
            openings.append(dict(o, wall_seg=len(walls) - 1, t=(o["along"] - cur_lo) / max(cur_hi - cur_lo, 1e-9)))
    return walls, openings


def windows_by_profile(walls: list[Seg], openings: list[dict[str, Any]], dt: np.ndarray, ink: np.ndarray, s: float) -> list[dict[str, Any]]:
    """Task 5: windows the closing hid inside a wall band. Until then: none."""
    return []


# ---------------------------------------------------------------- the detector

def detect(png: bytes | np.ndarray, *, targets: tuple[str, ...] | list[str] = TARGETS, strength: float = 0.6, scale_m_per_px: float | None = None, level_id: str = "L0", run_id: str = "0") -> dict[str, Any]:
    """Candidates (document-v2 walls and openings, source "auto") for a plan picture. `scale_m_per_px` is the version's
    calibration (None when there is none); `targets` always includes "walls" ("openings" needs them)."""
    t0 = time.perf_counter()
    if isinstance(png, (bytes, bytearray)):
        with Image.open(io.BytesIO(png)) as im:
            im.load()
            gray = im.convert("L")
    else:
        gray = Image.fromarray(np.asarray(png)).convert("L")
    # stage 1 (800 px): the scan's tilt; a tilted scan is straightened before the real pass, so snapping and merging see
    # axis-parallel walls, and every result is turned back onto the scan at the end
    probe = _stage(gray, strength, TILT_PX, scale_m_per_px)
    tilt = estimate_tilt(probe["segs"], probe["t_med"])
    if abs(tilt) < TILT_MIN_DEG:
        tilt = 0.0
    src = gray.rotate(tilt, resample=Image.BICUBIC, fillcolor=255) if tilt else gray
    st = _stage(src, strength, ANALYSIS_PX, scale_m_per_px)
    an, dt, s, calibrated, segs, aw, ah, f = st["an"], st["dt"], st["s"], st["calibrated"], st["segs"], st["aw"], st["ah"], st["f"]
    want_openings = "openings" in targets
    walls, openings = walls_from_gaps(segs, s, calibrated, an["thin"], an["ink_d"], want_openings)
    if want_openings:
        openings += windows_by_profile(walls, openings, chamfer_dt(an["ink"]), an["ink_d"], s)
    mask = an["walls"]
    ys, xs = np.nonzero(mask)
    frame = (float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max())) if xs.size else (0.0, 0.0, float(aw), float(ah))
    t_wall_med = float(np.median([g.thick for g in walls])) if walls else st["t_med"]

    def on_frame(g: Seg) -> bool:
        """Both ends within 1.5 thicknesses of the same edge of the wall mask's bounding box: the wall runs along the
        plan's frame (a partition that spans the plan touches two different edges and is not exterior)."""
        tol = 1.5 * g.thick
        for axis, edge in ((0, frame[0]), (0, frame[2]), (1, frame[1]), (1, frame[3])):
            if abs(g.a[axis] - edge) <= tol and abs(g.b[axis] - edge) <= tol:
                return True
        return False

    def kind_of(g: Seg) -> str:
        """Design 9.1 step 4: exterior when at least 1.6 x the median thickness or lying on the plan's frame; partition
        under 0.6 x; else interior. Known limit: the inner corner of an L-shaped outline is not on the frame and reads
        interior unless it is thicker than the rest - the kind is a suggestion the editor changes in the panel."""
        if g.thick >= 1.6 * t_wall_med or on_frame(g):
            return "exterior"
        return "partition" if g.thick < 0.6 * t_wall_med else "interior"

    def confidence(g: Seg) -> float:
        """Design 9.1 step 5 (ruling 4): length (2 m and longer score full), thickness consistency (the interquartile
        spread of the samples over the median) and straightness (on an axis, or not)."""
        arr = np.array(g.samples) if g.samples else np.array([g.thick])
        q1, q3 = np.percentile(arr, 25), np.percentile(arr, 75)
        consistency = 1.0 - min(1.0, (q3 - q1) / max(g.thick, 1e-6))
        return round(min(0.99, max(0.05, 0.4 * min(1.0, g.length * s / 2.0) + 0.35 * consistency + 0.25 * (1.0 if g.axis else 0.85))), 3)

    cx, cy = aw / 2.0, ah / 2.0
    cos_t, sin_t = math.cos(math.radians(tilt)), math.sin(math.radians(tilt))

    def back(p: np.ndarray) -> list[float]:
        """A straightened-frame point back onto the scan (the inverse of the rotation above), normalised 0..1."""
        x, y = p[0] - cx, p[1] - cy
        xo, yo = cx + x * cos_t - y * sin_t, cy + x * sin_t + y * cos_t
        return [round(min(1.0, max(0.0, xo / aw)), 5), round(min(1.0, max(0.0, yo / ah)), 5)]

    out_walls = [{
        "id": f"auto-{run_id}-w{i + 1:03d}", "level_id": level_id, "polyline": [back(g.a), back(g.b)],
        "thickness_m": round(max(0.02, g.thick * s), 3), "height_m": None, "base_z_m": 0, "kind": kind_of(g), "confidence": confidence(g),
        "source": "auto", "locked": False, "external_ids": {},
    } for i, g in enumerate(walls)]
    pixels = {w["id"]: {"thickness_px": round(walls[i].thick / f, 2)} for i, w in enumerate(out_walls)}
    out_openings = []
    door_gaps: list[float] = []
    for k, o in enumerate(openings):
        oid = f"auto-{run_id}-o{k + 1:03d}"
        out_openings.append({
            "id": oid, "wall_id": out_walls[o["wall_seg"]]["id"], "t": round(min(1.0, max(0.0, o["t"])), 5), "kind": o["kind"], "width_m": round(o["width_px"] * s, 3),
            "height_m": 1.2 if o["kind"] == "window" else 2.1, "sill_m": 0.9 if o["kind"] == "window" else 0, "swing": o["swing"], "hinge": o["hinge"],
            "anchor_ref": None, "confidence": o["confidence"], "source": "auto", "external_ids": {},
        })
        pixels[oid] = {"width_px": round(o["width_px"] / f, 2)}
        if o["kind"] == "door" and o["swing"] != "double":
            door_gaps.append(o["width_px"] / f)
    hint = None
    if not calibrated and door_gaps:  # design 6.3: the median single door is DOOR_TYPICAL_M
        hint = {"scale_m_per_px": round(DOOR_TYPICAL_M / float(np.median(door_gaps)), 6), "status": "estimated", "method": "door_width", "reason": "לפי רוחב דלת אופייני", "doors": len(door_gaps)}
    return {
        "walls": out_walls if "walls" in targets else [],
        "openings": out_openings if want_openings else [],
        "detector": {"name": "plan_detect", "version": VERSION, "params": {"strength": strength, "targets": list(targets), "analysis_px": [aw, ah], "threshold": an["threshold"], "tilt_deg": round(tilt, 2)}},
        "calibration_hint": hint,
        "pixels": pixels,
        "scale": {"m_per_px": round(s * f, 6), "status": "measured" if calibrated else "estimated_walls"},
        "stats": {"probe_segments": len(probe["segs"]), "segments": len(segs), "ms": int((time.perf_counter() - t0) * 1000)},
    }
