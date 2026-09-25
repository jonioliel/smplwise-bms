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


def thin(mask: np.ndarray, max_iter: int = 200) -> np.ndarray:
    """Zhang-Suen thinning, both sub-iterations vectorised over the whole picture; stops when nothing changes. Works
    on the bounding box of the mask in 0/1 bytes: the neighbour count is a byte sum, a 0 -> 1 transition is `u < v`."""
    ys, xs = np.nonzero(mask)
    if not ys.size:
        return np.zeros(mask.shape, dtype=bool)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
    img = np.pad(np.asarray(mask[y0:y1, x0:x1], dtype=np.uint8), 1)
    for _ in range(max_iter):
        changed = False
        for step in (0, 1):
            p2, p3, p4, p5 = img[:-2, 1:-1], img[:-2, 2:], img[1:-1, 2:], img[2:, 2:]
            p6, p7, p8, p9 = img[2:, 1:-1], img[2:, :-2], img[1:-1, :-2], img[:-2, :-2]
            c = img[1:-1, 1:-1]
            nb = (p2, p3, p4, p5, p6, p7, p8, p9)
            b = p2 + p3
            for n in nb[2:]:
                b = b + n
            a = (p2 < p3).astype(np.uint8)
            for u, v in zip(nb[1:], nb[2:] + nb[:1]):
                a += u < v
            m = ((p2 & p4 & p6) == 0) & ((p4 & p6 & p8) == 0) if step == 0 else ((p2 & p4 & p8) == 0) & ((p2 & p6 & p8) == 0)
            kill = (c == 1) & (b >= 2) & (b <= 6) & (a == 1) & m
            if kill.any():
                changed = True
                c[kill] = 0
        if not changed:
            break
    out = np.zeros(mask.shape, dtype=bool)
    out[y0:y1, x0:x1] = img[1:-1, 1:-1].astype(bool)
    return out


_N8 = ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1))


def neighbour_count(skel: np.ndarray) -> np.ndarray:
    p = np.pad(skel.astype(np.int16), 1)
    n = np.zeros(skel.shape, dtype=np.int16)
    for dy, dx in _N8:
        n += p[1 + dy : 1 + dy + skel.shape[0], 1 + dx : 1 + dx + skel.shape[1]]
    return n * skel


def trace_branches(skel: np.ndarray) -> list[list[tuple[int, int]]]:
    """Every branch of the skeleton between nodes (end points and junctions) as a list of (x, y) pixels; a closed loop
    without a node comes back as one branch that starts and ends at its topmost-leftmost pixel."""
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
