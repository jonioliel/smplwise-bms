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

import heapq
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
ARC_RING_MAX = 0.35  # a door arc: the quarter circles at 0.7 r and 1.3 r hold at most this much ink
ARC_WIDE_M = (0.3, 3.0)  # uncalibrated: the arc test runs on gaps of 0.3-3 m at the walls' estimated scale ...
ARC_WIDE_T = (2.0, 15.0)  # ... or 2-15 wall thicknesses (the arc does not depend on the scale)
DOUBLE_MIN_M = 1.1  # a double door from 1.1 m (two 0.55 m leaves): mirrored half arcs are tested from here
WINDOW_RANGE_M = (0.5, 3.0)
PIER_THICK_RATIO = 1.25  # a pier or stub continues a wall only as thick as it (thicker / thinner at most this)
MIN_WALL_M = 0.25
MIN_WALL_FRACTION = 0.005
BLOB_RATIO = 3.0  # a wall segment is at least this many thicknesses long
COMPACT_RATIO = 8.0  # a skeleton component less than this many of its thicknesses across is a blot, not walls
SOLID_INK = 0.93  # a segment shorter than COMPACT_RATIO thicknesses needs this much ink along its band (1-px closed ink)
COMPACT_SOLID_INK = 0.97  # a compact component off every wall line stays when its band is this solid
PROFILE_STEP_M = 0.05
PROFILE_BAND_PX = 2.0  # the profile pass samples each window line at -2, 0 and +2 px about the wall's face
PROFILE_SOLID_STEPS = 2  # a profile window has at least this many solid steps of its wall on both sides
PROFILE_MAX_RUN = 0.8  # ... covers at most this fraction of its wall
PROFILE_MIN_SOLID = 0.5  # ... and its wall is solid on at least this fraction of its steps
TARGETS = ("walls", "openings")


class DetectTimeout(TimeoutError):
    """A run passed its deadline (detect(deadline=...)). Raised between the stages and inside thin(), so a run the
    router has already answered 504 for stops within a stage and frees its pool worker instead of finishing unread."""


def _check(deadline: float | None) -> None:
    """Raise DetectTimeout when `deadline` (a time.monotonic() value) has passed; None never expires."""
    if deadline is not None and time.monotonic() > deadline:
        raise DetectTimeout("plan_detect: the deadline passed")


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


def thin(mask: np.ndarray, max_iter: int | None = None, deadline: float | None = None) -> np.ndarray:
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
    clean-up alternate until neither changes anything. `deadline` (time.monotonic()) is checked on every iteration:
    DetectTimeout once it has passed."""
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
            _check(deadline)
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
    """A straight wall piece in analysis pixels. `thick`, `length` and `dir` are computed once when the piece is built
    (a merge builds a new Seg): merging and grouping compare them many times. `net` says the piece (or one it absorbed)
    comes from a skeleton component that is not compact - the connected wall network, not a lone shape."""
    __slots__ = ("a", "b", "samples", "axis", "raw", "thick", "length", "dir", "net")

    def __init__(self, a: np.ndarray, b: np.ndarray, samples: list[float], axis: bool = False, raw: np.ndarray | None = None, net: bool = False) -> None:
        self.a, self.b, self.samples, self.axis, self.net = a, b, samples, axis, net
        self.raw = raw if raw is not None else _unit(a, b)  # the direction before any axis snapping (tilt estimate)
        self.thick = float(np.median(samples)) if samples else 2.0
        self.length = float(np.hypot(*(b - a)))
        self.dir = _unit(a, b)

    def project(self, p: np.ndarray) -> tuple[float, float]:
        """(along, lateral): along from a in pixels, lateral signed distance from the line."""
        d = self.dir
        v = p - self.a
        return float(np.dot(v, d)), float(d[0] * v[1] - d[1] * v[0])


def _angle_between(u: np.ndarray, v: np.ndarray) -> float:
    return math.degrees(math.acos(max(-1.0, min(1.0, abs(float(np.dot(u, v)))))))


_SLOPE = math.tan(math.radians(AXIS_TOL_DEG))


def _collinear(s: Seg, t: Seg, angle_tol: float = AXIS_TOL_DEG) -> tuple[float, float] | None:
    """The interval (lo, hi) of t along s's line when t lies on it (angle and lateral offset within tolerance).

    The lateral tolerance is 0.75 of the thicker piece. For pieces that are not both axis-snapped it grows with the
    distance of each end of t beyond the nearer end of s (pieces of one wall whose directions differ by up to the axis
    tolerance diverge by tan(4 deg) per pixel of separation), capped at one thickness: a parallel wall a few decimetres
    beside a long wall is never on its line, however far along it lies. Two axis-snapped pieces are exactly parallel,
    so the base tolerance applies alone."""
    if _angle_between(s.dir, t.dir) > angle_tol:
        return None
    thick = max(s.thick, t.thick, 2.0)
    base = 0.75 * thick
    both_axis = s.axis and t.axis
    ends = []
    for p in (t.a, t.b):
        along, lat = s.project(p)
        tol = base if both_axis else min(thick, base + _SLOPE * max(0.0, along - s.length, -along))
        if abs(lat) > tol:
            return None
        ends.append(along)
    return min(ends), max(ends)


def _near_pairs(segs: list[Seg], along_px: float | None) -> list[list[int]]:
    """For every segment, the indices of the segments that may be collinear with it (a superset of _collinear's
    relation, one vectorised test per segment): axis-snapped horizontal pieces pair only with pieces whose y ranges come
    within the widest lateral tolerance, likewise axis-snapped vertical ones in x, every piece that is not snapped with
    everything (so nothing depends on whether all near-axis pieces were snapped); with `along_px` the two bounding
    boxes, grown by that distance, must also meet (merging), without it any distance counts (one line)."""
    n = len(segs)
    if n < 2:
        return [[] for _ in range(n)]
    lateral = 1.5 * max(max(g.thick for g in segs), 2.0) + 2.0
    lo = np.array([np.minimum(g.a, g.b) for g in segs])
    hi = np.array([np.maximum(g.a, g.b) for g in segs])
    dirs = np.abs(np.array([g.dir for g in segs]))
    axis = np.array([bool(g.axis) for g in segs])
    horiz = axis & (dirs[:, 0] >= dirs[:, 1])
    vert = axis & ~horiz
    other = ~axis
    reach = None if along_px is None else along_px + lateral
    adj: list[list[int]] = []
    for i in range(n):
        ok = other | other[i] | (horiz & horiz[i]) | (vert & vert[i])
        if horiz[i]:  # the y ranges within the lateral tolerance (for another near-horizontal piece)
            ok &= other | ((lo[:, 1] <= hi[i, 1] + lateral) & (lo[i, 1] <= hi[:, 1] + lateral))
        if vert[i]:
            ok &= other | ((lo[:, 0] <= hi[i, 0] + lateral) & (lo[i, 0] <= hi[:, 0] + lateral))
        if reach is not None:
            ok &= (lo <= hi[i] + reach).all(axis=1) & (lo[i] <= hi + reach).all(axis=1)
        ok[i] = False
        adj.append(np.flatnonzero(ok).tolist())
    return adj


def merge_collinear(segs: list[Seg], join_px: float) -> list[Seg]:
    """Join segments on one line whose intervals touch or overlap (gap <= join_px) into one segment. Greedy in index
    order as before, but each segment is compared only with the candidates of _near_pairs (those of every piece it
    has absorbed so far), not with every other segment."""
    segs = [g for g in segs if g.length > 0]
    changed = True
    while changed:
        changed = False
        adj = _near_pairs(segs, join_px)
        out: list[Seg] = []
        used = [False] * len(segs)
        for i, g in enumerate(segs):
            if used[i]:
                continue
            used[i] = True
            cur = g
            heap = sorted(j for j in adj[i] if j > i)
            seen = set(heap)
            while heap:
                j = heapq.heappop(heap)
                if used[j]:
                    continue
                iv = _collinear(cur, segs[j])
                if iv is None or iv[0] > cur.length + join_px or iv[1] < -join_px:
                    continue
                d = cur.dir
                cur = Seg(cur.a + d * min(0.0, iv[0]), cur.a + d * max(cur.length, iv[1]), cur.samples + segs[j].samples, cur.axis and segs[j].axis, cur.raw, cur.net or segs[j].net)
                used[j] = True
                changed = True
                for k in adj[j]:
                    if k > j and k not in seen:
                        seen.add(k)
                        heapq.heappush(heap, k)
            out.append(cur)
        segs = out
    return segs


def line_groups(segs: list[Seg]) -> list[list[int]]:
    """Indices of the segments that share a line (union-find over the pairwise collinear relation, over the candidate
    pairs of _near_pairs)."""
    parent = list(range(len(segs)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, near in enumerate(_near_pairs(segs, None)):
        for j in near:
            if j > i and _collinear(segs[i], segs[j]) is not None:
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
    ink = g <= thr  # Otsu's threshold is the last level of the dark class: a flat two-level plan has its walls at thr
    soft = g < min(235, thr + 50)
    unit = max(1, int(round(aw / 800)))
    close_r = (1 + int(3 * strength + 0.5)) * unit  # 0.3 -> 2, 0.6 -> 3, 1.0 -> 4 units, like plan_stylize's light / medium / strong
    open_r = (1 if strength < 0.8 else 2) * unit
    # a one-pixel opening first: isolated scan speckles must not be closed into blobs (the raw ink keeps every line)
    walls = ps.opening(ps.closing(ps.opening(ink, 1), close_r), open_r)
    thin_ink = soft & ~ps.dilate(walls, 1)
    return {"aw": aw, "ah": ah, "factor": aw / width, "ink": soft, "ink_d": ps.dilate(soft, 1), "walls": walls, "thin": ps.dilate(thin_ink, 2), "threshold": thr}


def _even_width(dt: np.ndarray, pts: np.ndarray, horizontal: bool) -> np.ndarray:
    """1 where an axis-parallel band is an even number of pixels wide at the skeleton pixel, else 0: 2 * dt - 1 is the
    exact width of an odd band (one centre row), an even band has two centre rows with the same distance and is one
    pixel wider. Read from the neighbours across the band."""
    h, w = dt.shape
    xs, ys = pts[:, 0].astype(int), pts[:, 1].astype(int)
    here = dt[ys, xs]
    if horizontal:
        n1, n2 = dt[np.clip(ys - 1, 0, h - 1), xs], dt[np.clip(ys + 1, 0, h - 1), xs]
    else:
        n1, n2 = dt[ys, np.clip(xs - 1, 0, w - 1)], dt[ys, np.clip(xs + 1, 0, w - 1)]
    return ((n1 == here) | (n2 == here)).astype(np.float64)


def _pieces(dt: np.ndarray, skel: np.ndarray, t0: float) -> list[tuple[Seg, float, bool]]:
    """Skeleton branches -> straight pieces, each with the length of its branch (for a branch with two free ends, the
    drawn length: the skeleton plus a thickness) and whether its skeleton component is compact. Spurs (branches that
    meet a junction) shorter than 1.5 thicknesses go, Douglas-Peucker splits each branch at its corners, near-axis pieces
    snap to the axis. A piece keeps the thickness samples of its own stretch of the branch only; a thickness is
    2 * dt - 1 (the chamfer distance reads 1 on the edge pixel itself), plus one on an axis-parallel piece whose band
    is an even number of pixels wide (_even_width).

    Components: branches whose end points touch (8-neighbours) belong together (union-find, every branch counts, spurs
    too). A component whose extent plus its thickness is under COMPACT_RATIO of its median thickness is a compact
    shape - a word the closing turned into one blot, a column, a filled symbol - not a run of walls."""
    spur = max(1.5 * t0, 6.0)
    branches = trace_branches(skel)
    parent = list(range(len(branches)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    ends: dict[tuple[int, int], list[int]] = {}
    for i, br in enumerate(branches):
        for x, y in (br[0], br[-1]):
            ends.setdefault((x, y), []).append(i)
    for (x, y), ids in ends.items():
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for j in ends.get((x + dx, y + dy), ()):
                    for i in ids:
                        parent[find(i)] = find(j)
    comp_lo: dict[int, np.ndarray] = {}
    comp_hi: dict[int, np.ndarray] = {}
    comp_th: dict[int, list[np.ndarray]] = {}
    per_branch = []
    for i, br in enumerate(branches):
        pts = np.array(br, dtype=np.float64)
        th = 2.0 * dt[pts[:, 1].astype(int), pts[:, 0].astype(int)] - 1.0
        per_branch.append((pts, th))
        r = find(i)
        lo, hi = pts.min(axis=0), pts.max(axis=0)
        comp_lo[r] = np.minimum(comp_lo[r], lo) if r in comp_lo else lo
        comp_hi[r] = np.maximum(comp_hi[r], hi) if r in comp_hi else hi
        comp_th.setdefault(r, []).append(th)
    compact = {}
    for r in comp_lo:
        t = float(np.median(np.concatenate(comp_th[r])))
        compact[r] = float((comp_hi[r] - comp_lo[r]).max()) + t < COMPACT_RATIO * max(t, 1.0)
    nb = neighbour_count(skel)
    out: list[tuple[Seg, float, bool]] = []
    for i, br in enumerate(branches):
        if len(br) < 2:
            continue
        pts, th = per_branch[i]
        blen = float(np.sum(np.hypot(np.diff(pts[:, 0]), np.diff(pts[:, 1]))))
        (x0, y0), (x1, y1) = br[0], br[-1]
        if nb[y0, x0] == 1 and nb[y1, x1] == 1:
            # both ends free: not a spur but a whole shape (a pier between two openings, a free-standing wall, a
            # word); its length is the drawn one, the skeleton stops half a thickness short of each end
            blen += float(np.median(th))
        elif blen < spur:
            continue
        poly = rdp([(float(x), float(y)) for x, y in br], max(1.5, 0.35 * t0))
        idx: list[int] = []
        k = 0
        for v in poly:  # the branch index of every kept vertex (rdp keeps original points, in order)
            while (float(br[k][0]), float(br[k][1])) != v:
                k += 1
            idx.append(k)
            k = min(k + 1, len(br) - 1)
        for i0, i1 in zip(idx, idx[1:]):
            a, b, on_axis = snap_axis(pts[i0], pts[i1])
            samples = th[i0 : i1 + 1]
            if on_axis:
                samples = samples + _even_width(dt, pts[i0 : i1 + 1], abs(b[0] - a[0]) >= abs(b[1] - a[1]))
            out.append((Seg(a, b, samples.tolist(), on_axis, _unit(pts[i0], pts[i1]), not compact[find(i)]), blen, compact[find(i)]))
    return out


def _band_ink(g: Seg, ink: np.ndarray) -> float:
    """The fraction of ink on three lines along the segment (the centre line and a quarter thickness either side,
    10 % to 90 % of its length, 24 samples each)."""
    along = np.linspace(0.1, 0.9, 24)
    nl = np.array([g.dir[1], -g.dir[0]])
    return float(np.mean([_ratio(ink, g.a + np.outer(along, g.b - g.a) + nl * off) for off in (-g.thick / 4, 0.0, g.thick / 4)]))


def _on_centre_line(g: Seg, ref: Seg) -> bool:
    """g continues ref: the same direction (within the axis tolerance), both ends of g within half the thinner
    thickness of ref's centre line, and the two within PIER_THICK_RATIO in thickness. Stricter than _collinear (0.75
    of the thicker, for merging): a pier sits on its wall's centre line with its wall's thickness, a label beside a
    wall does neither."""
    if max(g.thick, ref.thick) > PIER_THICK_RATIO * min(g.thick, ref.thick) or _angle_between(g.dir, ref.dir) > AXIS_TOL_DEG:
        return False
    return max(abs(ref.project(g.a)[1]), abs(ref.project(g.b)[1])) <= 0.5 * min(g.thick, ref.thick)


def _on_wall_lines(cands: list[Seg], walls: list[Seg]) -> list[bool]:
    """For every candidate piece: whether it lies on the centre line of one of the wall pieces (a pier between two
    openings is a compact component of its own, but it continues its wall)."""
    if not cands or not walls:
        return [False] * len(cands)
    both = cands + walls
    adj = _near_pairs(both, None)
    n = len(cands)
    return [any(j >= n and _on_centre_line(cands[i], both[j]) for j in adj[i]) for i in range(n)]


def _segments(pieces: list[Seg], t_med: float, min_len: float, reach_px: float | None = None, solid: np.ndarray | None = None) -> list[Seg]:
    """Pieces -> wall segments: collinear pieces join, then short leftovers go, and so do blobs - a segment shorter
    than BLOB_RATIO thicknesses is a filled shape (a word the closing turned into one blot, a legend box), not a wall,
    unless it continues a wall: the segments whose centre line it lies on (_on_centre_line: its ends within half the
    thinner thickness, as thick within PIER_THICK_RATIO) include a seed or one that continues it, and add up to at
    least COMPACT_RATIO of its thicknesses of drawn wall. A seed is a segment of the wall network that is solid ink
    along its band (_band_ink on `solid`, the ink with one-pixel holes closed, >= SOLID_INK; without `solid` every
    network segment seeds): the closing joins a row of bold words into one non-compact chain, whose band reads
    0.75-0.9, and every word bar on that row's centre line would otherwise continue it. A pier between two windows or a stub between a corner and a door
    is short (its skeleton is also a thickness shorter than the drawn wall) but lies on its wall's centre line with its
    wall's thickness; a label beside a wall is neither on it nor as thick, and a row of labels has no network segment.
    Only direct neighbours within `reach_px` along the line count (an opening away at most; line_groups would chain a
    row of words across to a wall). Such a segment needs its drawn length (skeleton plus a thickness), not its
    skeleton, to reach min_len."""
    segs = merge_collinear(pieces, join_px=max(1.5 * t_med, 6.0))
    short = {i for i, g in enumerate(segs) if g.length < BLOB_RATIO * g.thick}
    on: dict[int, list[int]] = {i: [j for j in near if _on_centre_line(segs[i], segs[j])] for i, near in enumerate(_near_pairs(segs, reach_px)) if i in short}
    continues: set[int] = set()
    seeds: dict[int, bool] = {}

    def seed(j: int) -> bool:
        if j not in seeds:
            seeds[j] = segs[j].net and (solid is None or _band_ink(segs[j], solid) >= SOLID_INK)
        return seeds[j]

    changed = True
    while changed:  # a row of piers links up from the network one opening at a time
        changed = False
        for i in short - continues:
            nb = on[i]
            # each neighbour at its drawn length: the skeleton stops half a thickness short of each end
            if any(j in continues or seed(j) for j in nb) and sum(segs[j].length + segs[j].thick for j in nb) >= COMPACT_RATIO * segs[i].thick:
                continues.add(i)
                changed = True
    return [g for i, g in enumerate(segs) if (g.length >= min_len and g.length >= BLOB_RATIO * g.thick) or (i in continues and g.length + g.thick >= min_len)]


def _stage(gray: Image.Image, strength: float, analysis_px: int, scale_m_per_px: float | None, deadline: float | None = None) -> dict[str, Any]:
    an = _analysis(gray, strength, analysis_px)
    aw, ah, f = an["aw"], an["ah"], an["factor"]
    mask = an["walls"]
    _check(deadline)
    dt = chamfer_dt(mask)
    _check(deadline)
    skel = thin(mask, deadline=deadline)
    t0 = float(np.median(2.0 * dt[skel] - 1.0)) if skel.any() else 4.0
    pieces = _pieces(dt, skel, t0)
    _check(deadline)
    walls_like = [g for g, _, compact in pieces if not compact]
    # the typical wall thickness from the long pieces of non-compact components only (at least 4 thicknesses and
    # MIN_WALL_FRACTION of the width): text, hatching and filled symbols make many short or blob-shaped pieces, and
    # every skeleton pixel of them would pull the median up; not only the axis-parallel ones, or a plan drawn at
    # 30-45 degrees would take its thickness from a few pieces (or fall back to t0)
    long_pieces = [g for g in walls_like if g.length >= 4 * g.thick and g.length >= MIN_WALL_FRACTION * aw]
    t_med = float(np.median(np.concatenate([g.samples for g in long_pieces]))) if long_pieces else t0
    calibrated = scale_m_per_px is not None and scale_m_per_px > 0
    # metres per analysis pixel: the calibration, else the walls themselves - the median wall is taken as 0.2 m (the
    # same assumption as phase 1's estimate, measured on this drawing instead of assumed from the width)
    s = (scale_m_per_px / f) if calibrated else DEFAULT_WALL_M / t_med
    min_len = MIN_WALL_M / s if calibrated else max(MIN_WALL_FRACTION * aw, MIN_WALL_M / s)
    # the ink with one-pixel holes closed: white scan speckle or a label's white halo across a wall must not make a
    # drawn wall read as broken, while a bold word keeps its letter counters and spacing (<= 0.90)
    solid = ps.closing(an["ink"], 1)
    # branches shorter than a wall never become one (text strokes, hatching dashes); a compact shape's pieces only
    # when they lie on a wall's line, or when they are solid ink and at least BLOB_RATIO thicknesses long (a
    # free-standing 0.6-1.4 m wall, a small closed box)
    kept = [g for g, blen, compact in pieces if blen >= min_len and not compact]
    small = [g for g, blen, compact in pieces if blen >= min_len and compact]
    kept += [g for g, ok in zip(small, _on_wall_lines(small, kept)) if ok or (g.length >= BLOB_RATIO * g.thick and _band_ink(g, solid) >= COMPACT_SOLID_INK)]
    _check(deadline)
    segs = _segments(kept, t_med, min_len, WINDOW_RANGE_M[1] / s, solid)  # a pier's neighbours are an opening away at most
    # a short segment must be solid ink along its band: bold words that the closing joined into one bar read 0.75-0.9
    # (letter counters and spacing), a drawn wall reads 1.0; long segments are not tested
    segs = [g for g in segs if g.length >= COMPACT_RATIO * g.thick or _band_ink(g, solid) >= SOLID_INK]
    return {"an": an, "dt": dt, "skel": skel, "t_med": t_med, "s": s, "calibrated": calibrated, "pieces": kept, "segs": segs, "aw": aw, "ah": ah, "f": f}


# ---------------------------------------------------------------- openings

def _ratio(mask: np.ndarray, pts: np.ndarray) -> float:
    """The fraction of the sample points (x, y) that fall on set pixels of the mask."""
    h, w = mask.shape
    xs = np.clip(np.round(pts[:, 0]).astype(int), 0, w - 1)
    ys = np.clip(np.round(pts[:, 1]).astype(int), 0, h - 1)
    return float(mask[ys, xs].mean())


def _arc(centre: np.ndarray, radius: float, u: np.ndarray, n: np.ndarray, count: int = 24) -> np.ndarray:
    """24 points on the quarter circle about `centre` from direction u (the other gap end) to direction n (the leaf)."""
    th = np.linspace(0.08, math.pi / 2 - 0.08, count)
    return centre + np.outer(np.cos(th), u) * radius + np.outer(np.sin(th), n) * radius


def _arc_ratio(mask: np.ndarray, centre: np.ndarray, radius: float, u: np.ndarray, n: np.ndarray) -> float:
    """Ink along the quarter circle from u to n about centre, the best of five radii within 6 %: the gap ends are known
    to a few pixels, a drawn arc is two or three pixels wide."""
    return max(_ratio(mask, _arc(centre, radius * k, u, n)) for k in (0.94, 0.97, 1.0, 1.03, 1.06))


def _lines_along(g0: np.ndarray, d: np.ndarray, length: float, nl: np.ndarray, t_ref: float, ink: np.ndarray, band: float = 0.0) -> int:
    """How many of the three lines a window symbol may show (both wall faces and the glass line between them) are
    drawn along the run g0 -> g0 + d * length: ink on at least 60 % of 16 samples per line. With `band`, each line is
    the best of three parallel samplings at -band, 0 and +band pixels (a drawn line a pixel or two off the wall's
    measured face still counts)."""
    hits = 0
    along = np.linspace(0.1, 0.9, 16)
    shifts = (0.0,) if band <= 0 else (-band, 0.0, band)
    for off in (-t_ref / 2, 0.0, t_ref / 2):
        if max(_ratio(ink, g0 + np.outer(along, d) * length + nl * (off + sh)) for sh in shifts) >= WINDOW_LINE_RATIO:
            hits += 1
    return hits


def _arc_clear(mask: np.ndarray, centre: np.ndarray, radius: float, u: np.ndarray, n: np.ndarray) -> bool:
    """A drawn arc is a line: the same quarter circle at 0.7 r and at 1.3 r is mostly empty (<= ARC_RING_MAX). Hatching,
    text or any other ink area beside a gap fills every circle; measured on hatches of 1 px lines 8 px apart 0.96 / 1.00,
    14 px apart 0.71 / 0.67, real door arcs 0.00 / 0.00."""
    return max(_arc_ratio(mask, centre, radius * 0.7, u, n), _arc_ratio(mask, centre, radius * 1.3, u, n)) <= ARC_RING_MAX


def classify_gap(g0: np.ndarray, g1: np.ndarray, d: np.ndarray, t_ref: float, s: float, calibrated: bool, thin_mask: np.ndarray, ink: np.ndarray) -> dict[str, Any] | None:
    """What the gap g0 -> g1 (along d) between two collinear wall segments is (design 9.2 / 9.3): a door (a quarter
    circle of ink of the gap's radius about one gap end, >= 60 % ink and clear rings inside and outside it, the best of
    hinge x swing), a double door (a gap of 1.1-2.4 m with mirrored half arcs), a window (2-3 thin lines along the gap),
    a passage (a door-sized gap without an arc), or nothing (None). `s` is metres per pixel. Uncalibrated, s is only
    the walls' estimate (the median wall taken as 0.2 m), so the scale-free arc test runs on a wide gate (0.3-3 m at
    that estimate, or 2-15 thicknesses), while a passage still needs the narrow gate (0.6-1.5 m, or 1.5-4 thicknesses)."""
    gap = float(np.hypot(*(g1 - g0)))
    door = DOOR_RANGE_M[0] / s <= gap <= DOOR_RANGE_M[1] / s or (not calibrated and DOOR_RANGE_T[0] * t_ref <= gap <= DOOR_RANGE_T[1] * t_ref)
    wide = not calibrated and (ARC_WIDE_M[0] / s <= gap <= ARC_WIDE_M[1] / s or ARC_WIDE_T[0] * t_ref <= gap <= ARC_WIDE_T[1] * t_ref)
    double = DOUBLE_MIN_M / s <= gap <= DOUBLE_RANGE_M[1] / s or wide
    arcs = door or double or wide
    window = WINDOW_RANGE_M[0] / s <= gap <= WINDOW_RANGE_M[1] / s
    if not (arcs or window):
        return None
    nl, nr = np.array([d[1], -d[0]]), np.array([-d[1], d[0]])
    best = (0.0, "start", "left")
    if arcs:
        for hinge, centre, other in (("start", g0, g1), ("end", g1, g0)):
            u = _unit(centre, other)
            for swing, n in (("left", nl), ("right", nr)):
                r = _arc_ratio(thin_mask, centre, gap, u, n)
                if r > best[0] and r >= ARC_INK_RATIO and _arc_clear(thin_mask, centre, gap, u, n):
                    best = (r, hinge, swing)
    double_ratio = 0.0
    if double:
        for n in (nl, nr):
            r = min(_arc_ratio(thin_mask, g0, gap / 2, d, n), _arc_ratio(thin_mask, g1, gap / 2, -d, n))
            if r > double_ratio and r >= ARC_INK_RATIO and _arc_clear(thin_mask, g0, gap / 2, d, n) and _arc_clear(thin_mask, g1, gap / 2, -d, n):
                double_ratio = r
    hits = _lines_along(g0, d, gap, nl, t_ref, ink) if window else 0

    def conf_arc(r: float) -> float:
        return round(min(0.99, 0.55 + 0.45 * (r - ARC_INK_RATIO) / (1 - ARC_INK_RATIO)), 3)

    if double_ratio >= ARC_INK_RATIO:
        return {"kind": "door", "swing": "double", "hinge": "start", "confidence": conf_arc(double_ratio), "width_px": gap}
    if best[0] >= ARC_INK_RATIO:
        return {"kind": "door", "swing": best[2], "hinge": best[1], "confidence": conf_arc(best[0]), "width_px": gap}
    if window and hits >= 2:
        return {"kind": "window", "swing": "none", "hinge": "start", "confidence": round(0.45 + 0.15 * hits, 3), "width_px": gap}
    if door:
        return {"kind": "passage", "swing": "none", "hinge": "start", "confidence": 0.45, "width_px": gap}
    return None


def _gap_end(mask: np.ndarray, p: np.ndarray, into: np.ndarray, t: float) -> np.ndarray:
    """The gap end p (a skeleton end grown by t / 2) moved onto the wall mask's end face: along three lines parallel to
    the wall (the centre and a quarter thickness either side), walking in the direction `into` the gap from half a
    thickness plus 4 px behind p, the face is where the mask stops; the line that stops first wins (the side of the
    wall the door leaf and arc do not touch, where the closing added nothing). The skeleton alone misses by a few
    pixels when thinning bends its end toward a corner of a stepped face. p stays when no line has a clean face
    within reach (a window whose lines the closing joined into the wall band)."""
    reach = int(math.ceil(t / 2 + 4))
    ks = np.arange(-reach, reach + 1, dtype=np.float64)
    side = np.array([-into[1], into[0]])
    h, w = mask.shape
    best = None
    for off in (-t / 4, 0.0, t / 4):
        pts = p + side * off + np.outer(ks, into)
        xs = np.clip(np.round(pts[:, 0]).astype(int), 0, w - 1)
        ys = np.clip(np.round(pts[:, 1]).astype(int), 0, h - 1)
        vals = mask[ys, xs]
        if not vals[0] or vals.all():
            continue
        j = int(np.argmin(vals))  # the first unset sample
        end = ks[j] - 0.5
        best = end if best is None else min(best, end)
    return p if best is None else p + into * best


def _crossing_face(mask: np.ndarray, face: np.ndarray, into: np.ndarray, t: float) -> bool:
    """Whether the gap end `face` is the face of another wall that crosses (or meets) this line there, not a free end
    of this wall: just behind the face (1.5 px), the wall mask continues sideways past this wall's band, without a
    break from t / 2 + 1 to t / 2 + max(8, t) px, on BOTH sides. A free end's band stops at t / 2 (the fillet a closing
    leaves between a door leaf and the wall is a few pixels, well inside that reach); a T partition, an L corner or a
    door leaf continues it on one side only, and a door or passage flush with them is still an opening of this wall."""
    h, w = mask.shape
    q = face - into * 1.5
    side = np.array([-into[1], into[0]])
    ks = np.arange(t / 2 + 1, t / 2 + max(8.0, t) + 1)
    for sgn in (1.0, -1.0):
        pts = q + np.outer(ks * sgn, side)
        xs = np.clip(np.round(pts[:, 0]).astype(int), 0, w - 1)
        ys = np.clip(np.round(pts[:, 1]).astype(int), 0, h - 1)
        if not mask[ys, xs].all():
            return False
    return True


def _gap_status(mask: np.ndarray, g0: np.ndarray, g1: np.ndarray, p0: np.ndarray, p1: np.ndarray, d: np.ndarray, t0: float, t1: float) -> str:
    """Whether the gap g0 -> g1 between two pieces on one line may be an opening that joins them: "blocked" when
    _gap_end moved an end more than half a thickness plus 2 px from the grown skeleton end p0 / p1 (it walked through
    other ink) or when the wall mask covers the whole band (the centre line and a quarter of the thinner thickness
    either side) on at least 3 px between the faces (a wall lies across the gap; a door leaf drawn filled from the
    hinge covers only its swing side); "cross0" / "cross1" when the near / far end is the face of a crossing wall
    (_crossing_face: the line runs on past a crossing wall, and the gap beside it belongs to the piece on the other side
    only), "cross1" also when both ends are (a door or window proven by its symbol stays with the current wall, a
    passage is refused); else "free"."""
    if float(np.hypot(*(g0 - p0))) > t0 / 2 + 2 or float(np.hypot(*(g1 - p1))) > t1 / 2 + 2:
        return "blocked"
    gap = float(np.hypot(*(g1 - g0)))
    if gap > 6:
        h, w = mask.shape
        side = np.array([-d[1], d[0]])
        tt = min(t0, t1)
        across = None
        for off in (-tt / 4, 0.0, tt / 4):
            pts = g0 + side * off + np.outer(np.arange(2.0, gap - 2.0), d)
            on = mask[np.clip(np.round(pts[:, 1]).astype(int), 0, h - 1), np.clip(np.round(pts[:, 0]).astype(int), 0, w - 1)]
            across = on if across is None else across & on
        if int(across.sum()) >= 3:
            return "blocked"
    c0, c1 = _crossing_face(mask, g0, d, t0), _crossing_face(mask, g1, -d, t1)
    return "cross0" if c0 and not c1 else "cross1" if c1 else "free"


def walls_from_gaps(segs: list[Seg], s: float, calibrated: bool, thin_mask: np.ndarray, ink: np.ndarray, want_openings: bool, wall_mask: np.ndarray | None = None) -> tuple[list[Seg], list[dict[str, Any]]]:
    """Walk every line of collinear segments in order; a recognised gap joins its two neighbours into one wall with the
    opening at the gap, an unrecognised gap keeps them apart. The skeleton stops half a thickness short of a wall end
    (thinning retracts the ends), so a gap is measured between the ends grown by t / 2 - the same growth the
    primitives apply when they draw a free wall end.

    A gap with the face of a crossing wall at one end (_gap_status) never joins the pieces across that wall: a door or
    window found there belongs to the piece on its free side, whose wall then ends (or starts) at the crossing face;
    a passage there (no symbol to prove it) is not taken - a partition that ends at a crossing wall and a stub beyond
    it are two walls. With crossing faces at both ends, a door or window stays with the current wall."""
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
            status = "free" if want_openings and lo - segs[i].thick / 2 > cur_hi + t_cur / 2 else "blocked"
            if status == "free" and wall_mask is not None:
                p0, p1 = g0, g1
                g0, g1 = _gap_end(wall_mask, g0, d, t_cur), _gap_end(wall_mask, g1, -d, segs[i].thick)
                status = _gap_status(wall_mask, g0, g1, p0, p1, d, t_cur, segs[i].thick)
            found = classify_gap(g0, g1, d, t_ref, s, calibrated, thin_mask, ink) if status != "blocked" else None
            if found is not None and status != "free" and found["kind"] == "passage":
                found = None
            if found is not None and status != "free":
                # one end is a crossing wall's face: the opening goes to the piece on its free side, and the line is
                # cut at the crossing wall
                along0, along1 = base.project(g0)[0], base.project(g1)[0]
                if status == "cross1":  # the far end: the current wall runs on to the crossing face with the opening
                    pending.append(dict(found, along=(along0 + along1) / 2))
                    cur_hi = max(cur_hi, along1)
                walls.append(Seg(base.a + d * cur_lo, base.a + d * cur_hi, cur_samples, cur_axis))
                for o in pending:
                    openings.append(dict(o, wall_seg=len(walls) - 1, t=(o["along"] - cur_lo) / max(cur_hi - cur_lo, 1e-9)))
                pending = [] if status == "cross1" else [dict(found, along=(along0 + along1) / 2)]
                cur_lo = lo if status == "cross1" else min(lo, along0)
                cur_hi, cur_samples, cur_axis = hi, list(segs[i].samples), segs[i].axis
                continue
            if found is None:
                walls.append(Seg(base.a + d * cur_lo, base.a + d * cur_hi, cur_samples, cur_axis))
                for o in pending:
                    openings.append(dict(o, wall_seg=len(walls) - 1, t=(o["along"] - cur_lo) / max(cur_hi - cur_lo, 1e-9)))
                pending = []
                cur_lo, cur_hi, cur_samples, cur_axis = lo, hi, list(segs[i].samples), segs[i].axis
                continue
            pending.append(dict(found, along=base.project((g0 + g1) / 2)[0]))
            cur_hi = max(cur_hi, hi)
            cur_samples += segs[i].samples
            cur_axis = cur_axis and segs[i].axis
        walls.append(Seg(base.a + d * cur_lo, base.a + d * cur_hi, cur_samples, cur_axis))
        for o in pending:
            openings.append(dict(o, wall_seg=len(walls) - 1, t=(o["along"] - cur_lo) / max(cur_hi - cur_lo, 1e-9)))
    return walls, openings


def windows_by_profile(walls: list[Seg], openings: list[dict[str, Any]], dt: np.ndarray, ink: np.ndarray, s: float) -> list[dict[str, Any]]:
    """Design 9.3: along every wall, in 5 cm steps, the ink thickness on the wall's centre line (the best of three
    perpendicular offsets, so a wall a few pixels off its detected line still reads solid); a run of 0.5-3 m under
    half the wall's median thickness, with two or three lines drawn along it, is a window. `dt` is the distance
    transform of the raw ink: the closing merges a window's parallel lines into a band as thick as the wall, so the
    wall mask cannot tell, but the raw ink there is a few thin lines (or nothing on the centre line) and the profile
    drops. A run already covered by an opening from the gap pass is left alone (an opening's `t` is a fraction of its
    wall's length; the two overlap when their centres are closer than half their widths added). The lines are sampled
    in a band of +-PROFILE_BAND_PX about each face, at most a quarter of the wall's thickness (_lines_along), the
    confidence is capped at 0.99 like the gap pass's.

    A window sits in a wall: its run needs PROFILE_SOLID_STEPS solid steps on both sides and may cover at most
    PROFILE_MAX_RUN of the wall, and a wall that is low on more than half of its steps is skipped altogether. A wall
    drawn as its two outlines (CAD style, no fill) reads low along its whole length, like a window, and its outlines
    make two or three lines along it."""
    ah, aw = dt.shape
    found: list[dict[str, Any]] = []
    step = max(2.0, PROFILE_STEP_M / s)
    for wi, g in enumerate(walls):
        n_steps = int(g.length / step)
        if n_steps < 6:
            continue
        d = g.dir
        nl = np.array([d[1], -d[0]])
        along = np.arange(n_steps) * step + step / 2
        prof = np.zeros(n_steps)
        for off in (-g.thick / 3, 0.0, g.thick / 3):
            pts = g.a + np.outer(along, d) + nl * off
            prof = np.maximum(prof, 2.0 * dt[np.clip(np.round(pts[:, 1]).astype(int), 0, ah - 1), np.clip(np.round(pts[:, 0]).astype(int), 0, aw - 1)])
        low = prof < 0.5 * g.thick
        if low.mean() > 1.0 - PROFILE_MIN_SOLID:
            continue
        band = min(PROFILE_BAND_PX, g.thick / 4)
        k = 0
        while k < n_steps:
            if not low[k]:
                k += 1
                continue
            k2 = k
            while k2 < n_steps and low[k2]:
                k2 += 1
            run = (k2 - k) * step
            walled = k >= PROFILE_SOLID_STEPS and k2 + PROFILE_SOLID_STEPS <= n_steps and not low[k - PROFILE_SOLID_STEPS : k].any() and not low[k2 : k2 + PROFILE_SOLID_STEPS].any()
            if walled and WINDOW_RANGE_M[0] / s <= run <= WINDOW_RANGE_M[1] / s and run <= PROFILE_MAX_RUN * g.length:
                c_along = (along[k] + along[k2 - 1]) / 2
                t = c_along / g.length
                taken = any(o["wall_seg"] == wi and abs(o["t"] - t) * g.length < (run + o["width_px"]) / 2 for o in openings + found)
                if not taken:
                    g0 = g.a + d * (c_along - run / 2)
                    hits = _lines_along(g0, d, run, nl, g.thick, ink, band)
                    if hits >= 2:
                        found.append({"kind": "window", "swing": "none", "hinge": "start", "confidence": round(min(0.99, 0.4 + 0.15 * hits), 3), "width_px": run, "wall_seg": wi, "t": t})
            k = k2
    return found


# ---------------------------------------------------------------- the detector

def detect(png: bytes | np.ndarray, *, targets: tuple[str, ...] | list[str] = TARGETS, strength: float = 0.6, scale_m_per_px: float | None = None, level_id: str = "L0", run_id: str = "0", deadline: float | None = None) -> dict[str, Any]:
    """Candidates (document-v2 walls and openings, source "auto") for a plan picture. `scale_m_per_px` is the version's
    calibration (None when there is none); `targets` always includes "walls" ("openings" needs them). `deadline` (a
    time.monotonic() value, the router's guard) is checked between the stages and inside the thinning: DetectTimeout
    once it has passed, so a run nobody waits for any more gives its worker back."""
    t0 = time.perf_counter()
    _check(deadline)
    if isinstance(png, (bytes, bytearray)):
        with Image.open(io.BytesIO(png)) as im:
            im.load()
            gray = im.convert("L")
    else:
        gray = Image.fromarray(np.asarray(png)).convert("L")
    # stage 1 (800 px): the scan's tilt; a tilted scan is straightened before the real pass, so snapping and merging see
    # axis-parallel walls, and every result is turned back onto the scan at the end
    probe = _stage(gray, strength, TILT_PX, scale_m_per_px, deadline)
    # the tilt from the pieces before merging: a merged wall keeps the direction of its first piece, which may be a
    # short skewed piece at a junction, and would weigh it by the whole wall's length
    tilt = estimate_tilt(probe["pieces"], probe["t_med"])
    if abs(tilt) < TILT_MIN_DEG:
        tilt = 0.0
    src = gray.rotate(tilt, resample=Image.BICUBIC, fillcolor=255) if tilt else gray
    st = _stage(src, strength, ANALYSIS_PX, scale_m_per_px, deadline)
    an, dt, s, calibrated, segs, aw, ah, f = st["an"], st["dt"], st["s"], st["calibrated"], st["segs"], st["aw"], st["ah"], st["f"]
    want_openings = "openings" in targets
    walls, openings = walls_from_gaps(segs, s, calibrated, an["thin"], an["ink_d"], want_openings, an["walls"])
    _check(deadline)
    if want_openings:
        openings += windows_by_profile(walls, openings, chamfer_dt(an["ink"]), an["ink_d"], s)
        _check(deadline)
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
