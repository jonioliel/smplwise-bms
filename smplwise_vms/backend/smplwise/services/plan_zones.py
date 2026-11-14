"""Room candidates from a plan (design handoff M13, local variant): the same wall/room analysis as the
stylized rendering, then one polygon per enclosed room (pixel-edge contour tracing + Douglas-Peucker), in
normalized plan coordinates so zones survive zoom, rotation of the view and version transitions.
Candidates are suggestions only; the editor names, keeps or discards them."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from . import plan_stylize as ps

MAX_ROOMS = 60
MIN_AREA_RATIO = 0.0015

# walker headings, clockwise on screen (y down): east, south, west, north
_STEP = [(1, 0), (0, 1), (-1, 0), (0, -1)]
# pixel offsets (relative to the corner the walker stands on) of the pixel ahead-left / ahead-right per heading
_AHEAD_LEFT = [(0, -1), (0, 0), (-1, 0), (-1, -1)]
_AHEAD_RIGHT = [(0, 0), (-1, 0), (-1, -1), (0, -1)]


def trace_boundary(mask: np.ndarray) -> list[tuple[int, int]]:
    """Outer contour of the blob that contains the topmost-leftmost set pixel, as pixel-corner coordinates
    walked clockwise with the blob on the right-hand side (crack following). The result is an exact
    rectilinear polygon: every edge is axis-parallel."""
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return []
    h, w = mask.shape
    y0 = int(ys.min())
    x0 = int(xs[ys == y0].min())

    def inside(px: int, py: int) -> bool:
        return 0 <= px < w and 0 <= py < h and bool(mask[py, px])

    start = (x0, y0)
    cx, cy, d = x0, y0, 0  # top-left corner of the first pixel, heading east
    pts: list[tuple[int, int]] = [start]
    for _ in range(4 * (w * h + w + h) + 8):
        cx += _STEP[d][0]
        cy += _STEP[d][1]
        if (cx, cy) == start and d == 0:
            break
        al = _AHEAD_LEFT[d]
        ar = _AHEAD_RIGHT[d]
        if inside(cx + al[0], cy + al[1]):
            nd = (d - 1) % 4
        elif inside(cx + ar[0], cy + ar[1]):
            nd = d
        else:
            nd = (d + 1) % 4
        if nd != d:
            pts.append((cx, cy))
            d = nd
        if (cx, cy) == start and d == 0:
            break
    return pts


def rdp(points: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    """Douglas-Peucker simplification (iterative, keeps the endpoints)."""
    if len(points) < 3:
        return points
    pts = np.asarray(points, dtype=np.float64)
    keep = np.zeros(len(pts), dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b - a < 2:
            continue
        pa, pb = pts[a], pts[b]
        seg = pb - pa
        seg_len = float(np.hypot(seg[0], seg[1]))
        rel = pts[a + 1 : b] - pa
        if seg_len == 0:
            d = np.hypot(rel[:, 0], rel[:, 1])
        else:
            # perpendicular distance via the 2-D cross product (numpy 2 dropped 2-vector np.cross)
            d = np.abs(seg[0] * rel[:, 1] - seg[1] * rel[:, 0]) / seg_len
        i = int(np.argmax(d)) + a + 1
        if d.max() > eps:
            keep[i] = True
            stack.append((a, i))
            stack.append((i, b))
    return [(float(p[0]), float(p[1])) for p in pts[keep]]


def simplify_ring(points: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    """RDP on a closed ring: split at the two farthest-apart vertices so no edge is treated as an endpoint."""
    if len(points) < 4:
        return points
    pts = np.asarray(points, dtype=np.float64)
    i1 = int(np.argmax(np.hypot(pts[:, 0] - pts[0, 0], pts[:, 1] - pts[0, 1])))
    if i1 <= 0:
        return rdp(points, eps)
    a = rdp([(float(p[0]), float(p[1])) for p in pts[: i1 + 1]], eps)
    b = rdp([(float(p[0]), float(p[1])) for p in np.concatenate([pts[i1:], pts[:1]])], eps)
    return a[:-1] + b[:-1]


def _orthogonalize(points: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Snap nearly axis-parallel edges (architectural rooms are mostly rectilinear), then drop vertices that
    became duplicated or collinear."""
    out = [list(p) for p in points]
    n = len(out)
    for i in range(n):
        a, b = out[i], out[(i + 1) % n]
        if abs(a[0] - b[0]) < tol:
            m = (a[0] + b[0]) / 2
            a[0] = b[0] = m
        elif abs(a[1] - b[1]) < tol:
            m = (a[1] + b[1]) / 2
            a[1] = b[1] = m
    cleaned: list[tuple[float, float]] = []
    for i in range(n):
        p, q, r = out[i - 1], out[i], out[(i + 1) % n]
        if abs(q[0] - p[0]) < 1e-9 and abs(q[1] - p[1]) < 1e-9:
            continue
        cross = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0])
        if abs(cross) < 1e-6:
            continue
        cleaned.append((q[0], q[1]))
    return cleaned if len(cleaned) >= 3 else [(p[0], p[1]) for p in out]


def detect_rooms(src: Path, strength: str = "medium") -> dict[str, Any]:
    """Room polygons (normalized 0-1, origin top-left) from the plan image."""
    with Image.open(src) as im:
        im.load()
        width, height = im.size
        gray = im.convert("L")
    scale = min(1.0, ps.ANALYSIS_PX / max(width, height))
    aw, ah = max(8, int(round(width * scale))), max(8, int(round(height * scale)))
    g = np.asarray(gray.resize((aw, ah), Image.LANCZOS), dtype=np.uint8)
    if g.mean() < 100:
        g = 255 - g
    thr = int(min(200, max(90, ps.otsu_threshold(g))))
    ink = g < thr
    unit = max(1, int(round(aw / 800)))
    open_r, close_r = ps.STRENGTH.get(strength, ps.STRENGTH["medium"])
    walls = ps.opening(ps.closing(ink, close_r * unit), open_r * unit)
    lscale = min(1.0, ps.LABEL_PX / max(aw, ah))
    lw, lh = max(8, int(round(aw * lscale))), max(8, int(round(ah * lscale)))
    walls_coarse = ps._resize_mask(walls, (lw, lh))
    seal = max(2, int(round(ps.SEAL_RATIO * lw)))
    sealed = ps.dilate(walls_coarse, seal)
    labels = ps.label_regions(~sealed)
    areas = np.bincount(labels.ravel())
    border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])).tolist())
    min_area = max(30, int(MIN_AREA_RATIO * lw * lh))
    room_labels = sorted([int(l) for l in np.unique(labels) if l > 0 and l not in border and areas[l] >= min_area], key=lambda l: -areas[l])[:MAX_ROOMS]
    rooms = []
    eps = max(1.5, 0.012 * lw)
    for i, lab in enumerate(room_labels):
        region = labels == lab
        # grow back to the real walls, but not into other rooms; keep the blob that contains the seed
        grown = ps.dilate(region, seal) & ~walls_coarse & (region | (labels == 0))
        comps = ps.label_regions(grown)
        seed_y, seed_x = np.argwhere(region)[0]
        mask = comps == comps[seed_y, seed_x]
        pts = trace_boundary(mask)
        if len(pts) < 4:
            continue
        poly = simplify_ring([(float(x), float(y)) for x, y in pts], eps)
        poly = _orthogonalize(poly, eps)
        if len(poly) < 3:
            continue
        norm = [{"x": round(min(1.0, max(0.0, x / lw)), 4), "y": round(min(1.0, max(0.0, y / lh)), 4)} for x, y in poly]
        cy, cx = np.argwhere(region).mean(axis=0)
        rooms.append({
            "index": i + 1,
            "polygon": norm,
            "area_ratio": round(float(areas[lab]) / (lw * lh), 4),
            "centroid": {"x": round(float(cx + 0.5) / lw, 4), "y": round(float(cy + 0.5) / lh, 4)},
        })
    return {"rooms": rooms, "width_px": width, "height_px": height, "strength": strength}
