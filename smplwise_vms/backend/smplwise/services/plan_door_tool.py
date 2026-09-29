"""The "סמן דלת" tool of the Plan Studio editor (T087, recommendation 1 of docs/evidence/T087/DOOR_MODEL_STUDY_2026-09-29.md):
one click on a door symbol (or on the wall where a door is) and this module proposes the door - the wall it sits on,
its position, width, hinge side and swing - from the ink around the click, at the picture's own (upload) resolution.
Nothing here recognises doors on a whole plan: a person points at each one, so the search runs on a small crop and may
accept every drawing convention the study measured on the owner's scans:

- a 90 degree leaf with its quarter arc ("arc") or with the straight chord from the leaf tip to the latch ("chord");
- a single leaf open at 30-60 degrees without an arc, bounded by the far jamb (stall doors, "leaf");
- two leaves meeting over the middle of the opening: two 90 degree leaves with arcs, or the "V" of two slanted leaves
  ("double");
- a door-sized gap in a wall with no symbol at all ("gap");
- nothing found: the default door (0.9 m) at the click, on the wall clicked ("default").

The search is anchored on the ink, not on detected walls (the study: at the detector's 1600 px raster the hinge lies on
a detected wall for 6 of 33 leaves). Hinge candidates are the ink pixels near the click; from each, rays in the plan's
axis directions (and the directions of the draft's walls near the click) measure how far a drawn leaf runs; a leaf is
then scored with plan_detect_doors' pieces - the quarter arc, the chord, the rings around the arc - plus the wall ink
along the door line (a gap between two jambs). The door must cover the click. The best proposal is placed on a draft
wall that runs along it; when none does (a door in a gap between two drawn walls, or no wall drawn yet), the proposal
carries a short wall piece of its own for the person to accept with it.

Pure functions over a grey numpy array; the router (routers/plan_geometry.py, POST /plan-versions/{id}/door-proposal)
reads the picture, the draft's walls and the calibration, runs `propose` in a worker pool of its own (one worker) under a short
deadline and returns the answer. Nothing is stored and no picture leaves the server."""
from __future__ import annotations

import math
import threading
import time
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from . import plan_detect_doors as pdd
from . import plan_stylize as ps

DOOR_DEFAULT_M = 0.9  # the editor's default door (OPENING_DEFAULTS.door), used when nothing is found
LEAF_M = (0.45, 1.3)  # a leaf searched when the plan is calibrated (a leaf of a double from 0.45 m, a wide single to 1.3 m)
LEAF_FRAC = (0.004, 0.032)  # uncalibrated, no wall measured near the click: a leaf of 0.4-3.2 % of the picture's longer side
LEAF_WALLS = (2.0, 9.0)  # uncalibrated: a leaf of 2-9 wall thicknesses (0.45-1.3 m doors in 0.15-0.25 m walls)
MIN_LEAF_PX = 10.0  # below this a door cannot be told from text at any resolution
ANGLES_DEG = (30.0, 37.5, 45.0, 52.5, 60.0)  # slanted leaves (the study: 29-62 degrees from the wall)
ARC_MIN = 0.6  # a quarter arc: ink on this share of its samples (plan_detect.ARC_INK_RATIO)
CHORD_MIN = 0.7  # a chord symbol: ink on this share of the line from the leaf tip to the latch
CLUTTER_MAX = 0.5  # the rings about a 90 degree leaf hold at most this much ink (text, fixtures, hatching fill them)
GAP_MIN = 0.8  # a door line is open where the wall ink covers at most 1 - GAP_MIN of it
SCORE_MIN = 0.5  # a symbol below this is not proposed (the gap / default path runs instead)
RANK_DIST = 0.25  # the ranking's cost of a symbol's middle one door width away from the click
WALL_T_M = 0.15  # the wall band sampled beside a door line when nothing better is known
JAMB_M = 0.12  # a proposed wall piece reaches this far past each side of its door
CROP_LEAVES = 2.2  # the crop reaches this many of the largest leaf past the click
HINGE_REACH = 1.6  # hinge candidates lie within this many of the largest leaf of the click
HINGE_STEP_PX = 3  # hinge candidates: the ink pixels on this grid when there are many (a scan's leaf line is wider)
HINGE_ALL_MAX = 3000  # up to this many candidate pixels every one is a hinge candidate
MAX_HINGES = 6000  # the densest crop keeps this many hinge candidates (the nearest to the click)
LINE_GREY = (180, 220)  # the symbol-line threshold's bounds (line_threshold)
WALL_GREY = (90, 160)  # the wall threshold's bounds (wall_threshold)
RADIUS_STEPS = (0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2)  # a 90 degree leaf's radius refined against its swing
CACHE_SIZE = 2  # decoded pictures kept (a few MB each): consecutive clicks on one plan decode it once

NOTES = {
    "arc": "נמצאה קשת",
    "chord": "נמצאה כנף וקו סגירה",
    "leaf": "נמצאה כנף",
    "double": "נמצאה דלת כפולה",
    "gap": "נמצא פער",
    "default": "ברירת מחדל - בדוק",
}


class NoWall(ValueError):
    """Nothing to place a door on: no door symbol around the click and no wall of the draft near it."""


# ---------------------------------------------------------------- the picture (decoded once per plan)

_cache: dict[tuple[str, int, int], dict[str, Any]] = {}
_cache_lock = threading.Lock()


def picture(path: Path) -> dict[str, Any]:
    """The plan picture as grey levels (ink dark) with its Otsu threshold, decoded once per file version: {"g", "thr",
    "w", "h"}. Kept in a small in-process cache keyed by path, modification time and size (a new picture is a new key)."""
    st = path.stat()
    key = (str(path), st.st_mtime_ns, st.st_size)
    with _cache_lock:
        hit = _cache.get(key)
        if hit is not None:
            _cache[key] = _cache.pop(key)  # most recently used last
            return hit
    with Image.open(path) as im:
        im.load()
        g = np.asarray(im.convert("L"), dtype=np.uint8)
    entry = prepare(g)
    with _cache_lock:
        _cache[key] = entry
        while len(_cache) > CACHE_SIZE:
            _cache.pop(next(iter(_cache)))
    return entry


def prepare(g: np.ndarray) -> dict[str, Any]:
    """Grey levels (a light picture: inverted when dark on average, like plan_detect._analysis) and the thresholds."""
    g = np.asarray(g, dtype=np.uint8)
    if g.mean() < 100:
        g = 255 - g
    step = max(1, int(math.ceil(max(g.shape) / 1000)))  # Otsu on a sample: the histogram is all it needs
    thr = int(min(200, max(90, ps.otsu_threshold(g[::step, ::step]))))
    return {"g": g, "thr": thr, "w": int(g.shape[1]), "h": int(g.shape[0])}


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()


# ---------------------------------------------------------------- geometry helpers

def _unit(v: np.ndarray) -> np.ndarray:
    n = float(np.hypot(v[0], v[1]))
    return v / n if n > 1e-9 else np.array([1.0, 0.0])


def _perp(d: np.ndarray) -> np.ndarray:
    """The left normal of the document's convention (geometry.ts door(): nl = (d.y, -d.x))."""
    return np.array([d[1], -d[0]])


def _canon(d: np.ndarray) -> np.ndarray:
    """A direction and its opposite as one: x > 0, or x == 0 and y > 0."""
    return -d if d[0] < -1e-9 or (abs(d[0]) <= 1e-9 and d[1] < 0) else d


def _polyline_px(wall: dict[str, Any], W: int, H: int) -> np.ndarray:
    return np.array([[float(p[0]) * W, float(p[1]) * H] for p in wall["polyline"]], dtype=np.float64)


def _segments(walls: list[dict[str, Any]], W: int, H: int):
    """(wall, polyline px, cumulative length, total, segment index, a, b, length) for every segment of every wall."""
    for w in walls:
        pts = _polyline_px(w, W, H)
        if len(pts) < 2:
            continue
        seg = np.hypot(*(pts[1:] - pts[:-1]).T)
        cum = np.concatenate([[0.0], np.cumsum(seg)])
        total = float(cum[-1])
        if total <= 1e-6:
            continue
        for i in range(len(pts) - 1):
            if seg[i] > 1e-6:
                yield w, pts, cum, total, i, pts[i], pts[i + 1], float(seg[i])


def _seg_dist(p: np.ndarray, a: np.ndarray, b: np.ndarray) -> tuple[float, float]:
    """Distance from p to the segment a-b and the position along it (px from a, clamped)."""
    d = b - a
    L2 = float(np.dot(d, d))
    u = 0.0 if L2 <= 0 else max(0.0, min(1.0, float(np.dot(p - a, d)) / L2))
    q = a + d * u
    return float(np.hypot(*(p - q))), u * math.sqrt(L2)


# ---------------------------------------------------------------- the search

def _sample(mask: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """mask at the points (..., 2) -> bool (...), clamped to the picture (the few samples outside the search)."""
    return pdd.sample(mask, pts)


def local_wall_thickness(g: np.ndarray, thr: int, click: np.ndarray, reach: int) -> float | None:
    """The typical wall thickness around the click (px): the median length of the wall-ink runs across rows and columns
    of a window, counting runs of 3-60 px only (a run along a wall is longer, a speck shorter). None with too few."""
    x0, y0 = max(0, int(click[0]) - reach), max(0, int(click[1]) - reach)
    win = g[y0:int(click[1]) + reach + 1, x0:int(click[0]) + reach + 1]
    if win.size == 0:
        return None
    wall = ps.opening(win <= wall_threshold(thr), 1)
    runs: list[np.ndarray] = []
    for m in (wall, wall.T):
        e = np.diff(np.pad(m.astype(np.int8), ((0, 0), (1, 1))), axis=1)
        starts, ends = np.nonzero(e == 1), np.nonzero(e == -1)
        ln = ends[1] - starts[1]
        runs.append(ln[(ln >= 3) & (ln <= 60)])
    all_runs = np.concatenate(runs)
    return float(np.median(all_runs)) if all_runs.size >= 20 else None


def line_threshold(thr: int) -> int:
    """Symbol lines for the arc, chord and ring tests: ink up to a little past Otsu's threshold. Not the detector's 235 -
    at the upload resolution a scan's blurred lines are 8-10 px wide at 235 and every quarter circle near a wall finds
    ink there; the leaf rays still read the softer ink (a light grey leaf must not break)."""
    return int(min(LINE_GREY[1], max(LINE_GREY[0], thr + 20)))


def wall_threshold(thr: int) -> int:
    """Walls are the darkest ink: measured on the owner's scans at 3000 px, a wall band bottoms out at grey 50-120 and is
    8-13 px wide below 150, a leaf, chord or arc bottoms out at 135-200 and is at most 3 px wide there. The wall mask is
    the ink below this threshold opened by a 5 x 5 square, so the symbol lines never read as jambs or wall."""
    return int(min(WALL_GREY[1], max(WALL_GREY[0], thr - 40)))


class _Crop:
    """The masks of the crop around the click, padded with empty margins so the search samples without clamping: `leaf`
    (the soft ink plan_detect._analysis reads thin grey lines on, for the leaf rays), `line` (symbol lines:
    line_threshold, for the arc, chord and ring tests), `wall` (wall_threshold: walls and jambs only). `hinge_ok` marks
    where a hinge may be: ink within a few pixels of wall ink (a leaf hangs on a jamb), or any ink when the crop has no
    wall at all (a door drawn in a single-line partition)."""

    def __init__(self, g: np.ndarray, thr: int, t_band: float, margin: int, click: np.ndarray, reach: float, deadline: float | None = None) -> None:
        soft = g < max(200, min(235, thr + 50))
        wall = ps.opening(g <= wall_threshold(thr), 2)
        self.wall2d = wall
        self.B = margin
        # a hinge sits at a jamb: near wall ink, but not deep inside a wall band - worked out only where a hinge may be
        # (within `reach` of the click), from the wall ink up to the growth radius around that window
        grow = int(math.ceil(t_band)) + 4
        h, w = g.shape
        x0, y0 = max(0, int(click[0] - reach)), max(0, int(click[1] - reach))
        x1, y1 = min(w, int(click[0] + reach) + 1), min(h, int(click[1] + reach) + 1)
        near = np.zeros_like(soft)
        if x1 > x0 and y1 > y0:
            ex0, ey0, ex1, ey1 = max(0, x0 - grow), max(0, y0 - grow), min(w, x1 + grow), min(h, y1 + grow)
            sub = wall[ey0:ey1, ex0:ex1]
            if wall.any():
                ok = grow_square(sub, grow, deadline) & ~ps.erode(sub, 2)
                near[y0:y1, x0:x1] = soft[y0:y1, x0:x1] & ok[y0 - ey0:y1 - ey0, x0 - ex0:x1 - ex0]
            else:
                near[y0:y1, x0:x1] = soft[y0:y1, x0:x1]
        _check(deadline)
        self.hinge_ok = np.pad(near, margin)
        self.stride = self.hinge_ok.shape[1]
        # flat copies: a sample is one take() with the index clamped to the array (the margin keeps it inside anyway)
        self.leaf = np.pad(soft, margin).ravel()
        self.line = np.pad(g < line_threshold(thr), margin).ravel()
        self.wall = np.pad(wall, margin).ravel()

    def at(self, mask: np.ndarray, pts: np.ndarray) -> np.ndarray:
        q = pts + (self.B + 0.5)
        idx = q[..., 1].astype(np.intp) * self.stride + q[..., 0].astype(np.intp)
        return np.take(mask, idx, mode="clip")

    def at_clamped(self, mask: np.ndarray, pts: np.ndarray) -> np.ndarray:
        """`at` with each axis clamped to the padded arrays: for the few samples that may reach past the padding (the
        jamb search along a wide double door)."""
        rows = mask.size // self.stride
        x = np.clip((pts[..., 0] + (self.B + 0.5)).astype(np.intp), 0, self.stride - 1)
        y = np.clip((pts[..., 1] + (self.B + 0.5)).astype(np.intp), 0, rows - 1)
        return np.take(mask, y * self.stride + x)

    def ratio(self, mask: np.ndarray, pts: np.ndarray) -> np.ndarray:
        return self.at(mask, pts).mean(axis=-1)

    def band_solid(self, P: np.ndarray, N: np.ndarray, t: float) -> np.ndarray:
        """Wall ink at the points P (k x m x 2): any wall sample on the band from 1 px on the swing side to t + 1 px
        behind it (into the wall), across the direction N (k x 2)."""
        hit = np.zeros(P.shape[:2], dtype=bool)
        for o in np.linspace(1.0, -(t + 1.0), 5):
            hit |= self.at(self.wall, P + N[:, None, :] * o)
        return hit


def grow_square(mask: np.ndarray, r: int, deadline: float | None = None) -> np.ndarray:
    """plan_stylize.dilate(mask, r) - the same (2r+1) square - in doubling steps: a mask grown by c already covers
    [-c, c], so one more pass shifted by s <= 2c + 1 each way covers [-(c+s), c+s]; log2(r) passes per axis instead of
    r (padded by r first: at the border a mask grown by c covers only one side, and a doubling pass would leave holes).
    Checks the deadline between passes."""
    if r <= 0:
        return mask.copy()
    out = np.pad(mask, r)
    for axis in (1, 0):
        c = 0
        while c < r:
            _check(deadline)
            k = min(2 * c + 1, r - c)
            o = out.copy()
            if axis == 1:
                out[:, k:] |= o[:, :-k]
                out[:, :-k] |= o[:, k:]
            else:
                out[k:, :] |= o[:-k, :]
                out[:-k, :] |= o[k:, :]
            c += k
    return out[r:-r, r:-r]


def _run_length(cx: _Crop, H: np.ndarray, V: np.ndarray, lmax: float, gap: int = 3, chunk: int = 24) -> np.ndarray:
    """How far the leaf ink runs from each origin H along the unit direction V (px, 1 px steps), bridging breaks of up
    to `gap` samples: the position of the first of `gap` + 1 empty samples in a row. Rays are dropped as they stop;
    one still running at lmax reads lmax + 1."""
    k = len(H)
    out = np.full(k, float(int(lmax) + 1))
    alive = np.arange(k)
    start = 1
    while alive.size and start <= lmax:
        ds = np.arange(start, start + chunk + gap, dtype=np.float64)
        empty = ~cx.at(cx.leaf, H[alive, None, :] + V[alive, None, :] * ds[None, :, None])
        run = empty[:, :chunk].copy()
        for j in range(1, gap + 1):
            run &= empty[:, j: chunk + j]
        stopped = run.any(axis=1)
        out[alive[stopped]] = ds[run[stopped].argmax(axis=1)]
        alive = alive[~stopped]
        start += chunk
    return out


def _hinge_jamb(cx: _Crop, H: np.ndarray, U: np.ndarray, N: np.ndarray, t: float) -> tuple[np.ndarray, np.ndarray]:
    """Wall right behind the hinge (2-8 px back along the door line): (jamb, fill) - the share of those positions with
    wall anywhere across the wall's band (a leaf hangs on a jamb; a "door" hinged part-way up another door's leaf, or on
    the apex line of a "V", has nothing there), and how much of the band from the hinge's face through the wall is wall
    (a leaf hangs from the face: of two otherwise equal readings, the one hinged on the face)."""
    s = np.array([-8.0, -6.0, -4.0, -2.0])
    P = H[:, None, :] + U[:, None, :] * s[None, :, None]
    fill = np.zeros(P.shape[:2])
    offs = np.linspace(0.0, -max(2.0, t - 1.0), 5)
    for o in offs:
        fill += cx.at(cx.wall, P + N[:, None, :] * o)
    return cx.band_solid(P, N, t).mean(axis=1), (fill / len(offs)).mean(axis=1)


def _gap_end(cx: _Crop, H: np.ndarray, U: np.ndarray, N: np.ndarray, t: float, lo: np.ndarray, hi: np.ndarray) -> np.ndarray:
    """Where the wall ink starts again along U from the hinge: the first position in [lo, hi] (per candidate) with two
    solid samples in a row; NaN where the line stays open (no jamb)."""
    s = np.arange(1.0, float(np.max(hi)) + 3.0)
    solid = cx.band_solid(H[:, None, :] + U[:, None, :] * s[None, :, None], N, t)
    two = solid[:, :-1] & solid[:, 1:]
    ok = two & (s[None, :-1] >= lo[:, None]) & (s[None, :-1] <= hi[:, None])
    return np.where(ok.any(axis=1), s[:-1][ok.argmax(axis=1)], np.nan)


def _directions(walls_near: list[np.ndarray]) -> list[np.ndarray]:
    """The plan's axes and the directions of the draft's walls near the click, each once (within 3 degrees)."""
    out: list[np.ndarray] = [np.array([1.0, 0.0]), np.array([0.0, 1.0])]
    for d in walls_near:
        d = _canon(_unit(d))
        if all(abs(float(np.dot(d, e))) < math.cos(math.radians(3)) for e in out):
            out.append(d)
    return out[:6]


def _candidates(cx: _Crop, click: np.ndarray, rmin: float, rmax: float, t_px: float, dirs: list[np.ndarray], deadline: float | None) -> list[dict[str, Any]]:
    """Every leaf template around the click that passes its tests, with its score (crop coordinates)."""
    B = cx.B
    ys, xs = np.nonzero(cx.hinge_ok[B:-B, B:-B])
    hinges = np.stack([xs, ys], axis=1).astype(np.float64)
    if not len(hinges):
        return []
    dist = np.hypot(*(hinges - click).T)
    keep = dist <= HINGE_REACH * rmax + 4
    hinges, dist = hinges[keep], dist[keep]
    if len(hinges) > HINGE_ALL_MAX:
        # a scan's blurred lines are several pixels wide: a grid of them still lands on every leaf root; a crisp
        # drawing's 1-2 px lines keep every pixel (and have few)
        grid = (xs[keep] % HINGE_STEP_PX == 0) & (ys[keep] % HINGE_STEP_PX == 0)
        hinges, dist = hinges[grid], dist[grid]
    if len(hinges) > MAX_HINGES:
        hinges = hinges[np.argsort(dist)[:MAX_HINGES]]
    # a leaf root has ink 3, 6 and 9 px out and at half and 0.85 of the shortest leaf
    near3 = np.array([3.0, 6.0, 9.0, 0.5 * rmin * 0.9, 0.85 * rmin * 0.9])[None, :, None]
    far3 = np.array([7.0, 11.0, 15.0])[None, :, None]
    out: list[dict[str, Any]] = []
    for d in dirs:
        _check(deadline)
        n = _perp(d)
        for sn in (1.0, -1.0):
            N0 = n * sn
            for su in (1.0, -1.0):
                U0 = d * su
                # the 90 degree leaf does not depend on U: tested once per swing side, both latch sides scored
                for theta in ((90.0,) if su > 0 else ()) + ANGLES_DEG:
                    th = math.radians(theta)
                    V0 = N0 if theta == 90.0 else math.cos(th) * U0 + math.sin(th) * N0
                    # cheap first look: ink along the first part of a leaf, and not a wall running that way
                    pre = cx.at(cx.leaf, hinges[:, None, :] + V0 * near3).all(axis=1)
                    pre &= cx.at(cx.wall, hinges[:, None, :] + V0 * far3).sum(axis=1) <= 1
                    if not pre.any():
                        continue
                    Hs = hinges[pre]
                    Vs = np.broadcast_to(V0, Hs.shape)
                    lmax = rmax * (1.25 if theta == 90.0 else 1.25 / max(0.5, math.cos(th)))
                    L = _run_length(cx, Hs, Vs, lmax)
                    ok = (L >= (rmin if theta == 90.0 else rmin * 0.9)) & (L <= lmax)
                    if not ok.any():
                        continue
                    Hs, L = Hs[ok], L[ok]
                    # neighbouring hinges read the same leaf: one ray per 4 px cell and 4 px of length
                    _, first = np.unique(np.stack([np.floor(Hs[:, 0] / 4), np.floor(Hs[:, 1] / 4), np.floor(L / 4)], axis=1), axis=0, return_index=True)
                    Hs, L = Hs[first], L[first]
                    # a leaf is a line, not a wall running that way: little of it lies in a wall band
                    mid = cx.ratio(cx.wall, Hs[:, None, :] + V0 * (L[:, None, None] * np.linspace(0.35, 0.9, 8)[None, :, None]))
                    ok = mid <= 0.5
                    if not ok.any():
                        continue
                    Hs, L = Hs[ok], L[ok]
                    k = len(Hs)
                    Nk = np.broadcast_to(N0, (k, 2))
                    tip = Hs + V0 * L[:, None]
                    if theta == 90.0:
                        for su2 in (1.0, -1.0):
                            out += _score_square(cx, Hs, L, np.broadcast_to(d * su2, (k, 2)), Nk, tip, t_px, click)
                    else:
                        out += _score_slanted(cx, Hs, L, np.broadcast_to(U0, (k, 2)), Nk, tip, th, t_px, rmin, rmax, click)
    return _suppress(out)


def _suppress(cands: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The best template per leaf: of templates with the same kind of leaf and orientation whose hinges fall in the same
    6 px cell and whose sizes are within ~15 % (one step of a geometric scale), only the highest score stays."""
    cands.sort(key=lambda c: -c["score"])
    seen: set[tuple] = set()
    kept: list[dict[str, Any]] = []
    for c in cands:
        key = (c["square"], round(float(c["U"][0]), 2), round(float(c["U"][1]), 2), round(float(c["N"][0]), 2), round(float(c["N"][1]), 2),
               int(c["H"][0] // 6), int(c["H"][1] // 6), int(math.log(max(c["r"], 1.0)) / 0.14))
        if key in seen:
            continue
        seen.add(key)
        kept.append(c)
    return kept


def _covers(click: np.ndarray, H: np.ndarray, U: np.ndarray, N: np.ndarray, width: np.ndarray, height: np.ndarray, t: float) -> np.ndarray:
    """The click lies on the door: inside its box along the door line (with a quarter width to spare) from the far side
    of the wall to the leaf's reach."""
    rel = click[None, :] - H
    u = (rel * U).sum(axis=1)
    v = (rel * N).sum(axis=1)
    m = 0.25 * width + 3
    return (u >= -m) & (u <= width + m) & (v >= -(t + m)) & (v <= height + m)


def _swing_ink(cx: _Crop, H: np.ndarray, r: np.ndarray, U: np.ndarray, N: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(arc, chord) of a 90 degree leaf of radius r: ink on the middle half of the quarter arc (plan_detect_doors'
    template, the best of three radii within 3 %) and of the straight chord from the leaf tip to the latch (the best of
    three parallel lines 2 px apart). Only the middles: the two coincide at their ends, and the arc bulges 0.29 r past
    the chord in its middle."""
    arc = np.max(np.stack([cx.ratio(cx.line, pdd.arc_pts(H, r * f, U, N, 0.25, 0.75, 16)) for f in (0.97, 1.0, 1.03)]), axis=0)
    tip, latch = H + N * r[:, None], H + U * r[:, None]
    m = (U - N) / math.sqrt(2.0)  # the chord's normal (U and N are orthonormal)
    chord = np.max(np.stack([cx.ratio(cx.line, pdd.line_pts(tip + m * dn, latch + m * dn, 0.25, 0.75, 12)) for dn in (-2.0, 0.0, 2.0)]), axis=0)
    return arc, chord


def _score_square(cx: _Crop, H, L, U, N, tip, t, click) -> list[dict[str, Any]]:
    """A 90 degree leaf from H along N, measured L long by its ray; the latch at H + U r. The radius r is refined around
    L (RADIUS_STEPS) against the swing - arc or chord - and the leaf drawn out to it; r is the door's width. Evidence:
    the swing's ink, the open door line, wall ink behind the hinge and past the latch (the jambs). Clutter: the quarter
    circles at 0.5 r (inside the chord, which comes no closer than 0.71 r) and 1.3 r hold little ink around a door."""
    cover = _covers(click, H, U, N, L * 1.2, L * 1.2, t)
    if not cover.any():
        return []
    H, L, U, N = H[cover], L[cover], U[cover], N[cover]
    k, f = len(H), np.array(RADIUS_STEPS)
    Hr, Ur, Nr = np.repeat(H, len(f), axis=0), np.repeat(U, len(f), axis=0), np.repeat(N, len(f), axis=0)
    R = (L[:, None] * f[None, :]).ravel()
    arc, chord = _swing_ink(cx, Hr, R, Ur, Nr)
    leaf = cx.ratio(cx.leaf, pdd.line_pts(Hr, Hr + Nr * R[:, None], 0.1, 0.95, 14))
    # a smaller copy of a door hinged part-way up its leaf fits a blurred chord as well as the door itself: of the radii
    # whose swing is within 0.1 of the best and whose leaf is drawn out to them, the largest
    swing = np.maximum(arc, chord).reshape(k, len(f))
    fits = (swing >= swing.max(axis=1, keepdims=True) - 0.1) & (leaf.reshape(k, len(f)) >= 0.85)
    fits[np.arange(k), swing.argmax(axis=1)] = True
    pick = (len(f) - 1 - np.argmax(fits[:, ::-1], axis=1)) + np.arange(k) * len(f)
    r, arc, chord, leaf = R[pick], arc[pick], chord[pick], leaf[pick]
    arc_all = np.max(np.stack([cx.ratio(cx.line, pdd.arc_pts(H, r * q, U, N, 0.1, 0.9, 24)) for q in (0.97, 1.0, 1.03)]), axis=0)
    s = np.linspace(0.15, 0.85, 12)
    gap = 1.0 - cx.band_solid(H[:, None, :] + U[:, None, :] * (r[:, None, None] * s[None, :, None]), N, t).mean(axis=1)
    end = _gap_end(cx, H, U, N, t, 0.8 * r, 1.25 * r)
    width = r  # a 90 degree leaf is as long as the door is wide; the ink gap between two blurred wall ends is narrower
    ring_in = cx.ratio(cx.line, pdd.arc_pts(H, r * 0.5, U, N, 0.2, 0.8, 14))
    ring_out = cx.ratio(cx.line, pdd.arc_pts(H, r * 1.3, U, N, 0.2, 0.8, 18))
    clutter = np.maximum(ring_in, ring_out)
    hj, hfill = _hinge_jamb(cx, H, U, N, t)
    out: list[dict[str, Any]] = []
    for i in range(k):
        if clutter[i] > CLUTTER_MAX or leaf[i] < 0.8:
            continue
        lj = 0.0 if math.isnan(float(end[i])) else 1.0
        if arc[i] >= ARC_MIN and arc_all[i] >= ARC_MIN and arc[i] > chord[i]:
            kind, score = "arc", 0.45 + 0.3 * arc_all[i]
        elif chord[i] >= CHORD_MIN and chord[i] > arc[i]:
            kind, score = "chord", 0.42 + 0.3 * chord[i]
        elif gap[i] >= GAP_MIN and lj and hj[i] >= 0.5:
            kind, score = "leaf", 0.25 + 0.1 * gap[i]
        else:
            continue
        score += 0.15 * gap[i] + 0.2 * hj[i] + 0.05 * hfill[i] + 0.1 * lj - 0.2 * (hj[i] < 0.25) - 0.4 * float(clutter[i])
        out.append({"kind": kind, "square": True, "H": H[i].copy(), "U": U[i].copy(), "N": N[i].copy(), "r": float(r[i]), "width": float(width[i]), "tip": H[i] + N[i] * r[i],
                    "score": float(score), "scores": {"arc": round(float(arc_all[i]), 2), "chord": round(float(chord[i]), 2), "leaf": round(float(leaf[i]), 2), "gap": round(float(gap[i]), 2),
                                                      "clutter": round(float(clutter[i]), 2), "hinge_jamb": round(float(hj[i]), 2), "latch_jamb": lj}})
    return out


def _score_slanted(cx: _Crop, H, L, U, N, tip, th, t, rmin, rmax, click) -> list[dict[str, Any]]:
    """A leaf open at th (radians) from the door line, L long, leaning towards the latch: the width is where the wall
    ink starts again along the door line (the far jamb); without one the leaf's length (stall doors are drawn to scale).
    Alone it needs that jamb and an open door line; a leaf without them may still pair with its mirror (a "V")."""
    cover = _covers(click, H, U, N, 1.45 * L, L * math.sin(th), t)
    if not cover.any():
        return []
    H, L, U, N, tip = H[cover], L[cover], U[cover], N[cover], tip[cover]
    reach = L * math.cos(th)
    end = _gap_end(cx, H, U, N, t, np.maximum(rmin * 0.8, 0.6 * reach), np.minimum(rmax * 1.2, 1.45 * L))
    width = np.where(np.isnan(end), L, end)
    s = np.linspace(0.15, 0.85, 12)
    gap = 1.0 - cx.band_solid(H[:, None, :] + U[:, None, :] * (width[:, None, None] * s[None, :, None]), N, t).mean(axis=1)
    hj, _fill = _hinge_jamb(cx, H, U, N, t)
    out: list[dict[str, Any]] = []
    for k in range(len(H)):
        jamb = not math.isnan(float(end[k]))
        alone = jamb and gap[k] >= GAP_MIN and hj[k] >= 0.5
        score = 0.3 + 0.2 * gap[k] + 0.15 * hj[k] + (0.1 if alone else -0.2)
        out.append({"kind": "leaf", "square": False, "H": H[k].copy(), "U": U[k].copy(), "N": N[k].copy(), "r": float(L[k]), "width": float(width[k]), "tip": tip[k].copy(),
                    "score": float(score), "alone": alone, "theta": round(math.degrees(th), 1), "hj": float(hj[k]),
                    "scores": {"gap": round(float(gap[k]), 2), "hinge_jamb": round(float(hj[k]), 2), "latch_jamb": 1.0 if jamb else 0.0}})
    return out


def _pairs(cx: _Crop, cands: list[dict[str, Any]], t: float, click: np.ndarray, rmin: float, rmax: float) -> list[dict[str, Any]]:
    """Double doors: two leaves swinging to the same side from hinges on one line, facing each other, whose latches
    (90 degree leaves) or leaf tips ("V") meet. The door spans hinge to hinge."""
    top = sorted(cands, key=lambda c: -c["score"])[:150]
    if len(top) < 2:
        return []
    Hs = np.array([c["H"] for c in top])
    Us = np.array([c["U"] for c in top])
    Ns = np.array([c["N"] for c in top])
    rs = np.array([c["r"] for c in top])
    tips = np.array([c["tip"] for c in top])
    sq = np.array([c["square"] for c in top])
    thetas = np.array([c.get("theta", 90.0) for c in top])
    out: list[dict[str, Any]] = []
    swing = np.array([c["kind"] in ("arc", "chord") for c in top])
    for i, a in enumerate(top):
        if a["square"] and not swing[i]:
            continue  # two bare 90 degree leaves are not a double door: each needs its arc or chord
        rel = Hs - Hs[i]
        span = rel @ Us[i]
        lateral = np.abs(rel @ Ns[i])
        rr = np.maximum(rs, rs[i])
        ok = (sq == sq[i]) & (Us @ Us[i] < -0.95) & (Ns @ Ns[i] > 0.95) & (span > 0) & (lateral <= np.maximum(5.0, 0.12 * np.abs(span)))
        if a["square"]:
            ok &= swing & (np.abs(span - (rs + rs[i])) <= 0.3 * rr) & (np.abs(rs - rs[i]) <= 0.3 * rr)
        else:
            # a "V": mirrored leaves (similar angle and length) whose tips meet over the middle of the opening
            apex = (tips - Hs[i]) @ Us[i]
            ok &= (np.hypot(*(tips - tips[i]).T) <= 0.3 * rr) & (span >= 0.6 * rr) & (span <= 2.2 * rr) & (np.abs(rs - rs[i]) <= 0.25 * rr)
            ok &= (np.abs(thetas - thetas[i]) <= 12.0) & (np.abs(apex - span / 2) <= 0.2 * np.abs(span)) & (np.abs(float(apex[i]) - span / 2) <= 0.2 * np.abs(span))
        ok &= (span >= 2 * rmin * 0.8) & (span <= 2.4 * rmax)
        for j in np.nonzero(ok)[0]:
            b = top[j]
            sp = float(span[j])
            s = np.linspace(0.1, 0.9, 16)
            P = a["H"][None, None, :] + a["U"][None, None, :] * (sp * s)[None, :, None]
            hit = np.zeros(P.shape[:2], dtype=bool)
            for o in np.linspace(1.0, -(t + 1.0), 5):
                hit |= cx.at_clamped(cx.wall, P + a["N"][None, None, :] * o)
            gap = 1.0 - float(hit.mean())
            if gap < GAP_MIN:
                continue  # a double door opens its whole span
            if a["square"] and min(a["scores"].get("hinge_jamb", 0.0), b["scores"].get("hinge_jamb", 0.0)) < 0.5:
                continue  # two 90 degree leaves hang on two jambs
            if not _covers(click, a["H"][None, :], a["U"][None, :], a["N"][None, :], np.array([sp]), np.array([max(a["r"], b["r"])]), t)[0]:
                continue
            if not a["square"] and max(a.get("hj", 0.0), b.get("hj", 0.0)) < 0.5:
                continue
            base = max(a["score"], b["score"]) if a["square"] else 0.45 + 0.2 * gap + 0.1 * min(a.get("hj", 0.0), b.get("hj", 0.0))
            out.append({"kind": "double", "square": a["square"], "H": a["H"], "U": a["U"], "N": a["N"], "r": sp / 2, "width": sp, "tip": a["tip"],
                        "score": float(base + 0.15), "scores": {"gap": round(gap, 2), "leaves": [a["scores"], b["scores"]]}})
    return out


def _check(deadline: float | None) -> None:
    if deadline is not None and time.monotonic() > deadline:
        raise TimeoutError("door proposal: the deadline passed")


def _gap_on_wall(dark: np.ndarray, a: np.ndarray, d: np.ndarray, seg_len: float, along: float, t: float, rmin: float, rmax: float) -> tuple[float, float] | None:
    """A door-sized opening in the wall ink along a drawn wall line near the click: the run of open samples (no wall
    ink across the band) containing, or nearest to, the click's position, closed by wall ink on both sides. The line is
    tried at small lateral shifts (a hand-drawn wall lies a few pixels off the drawing). (start, end) px along the line."""
    n = _perp(d)
    reach = 2.4 * rmax
    s = np.arange(max(-rmax * 0.3, along - reach), min(seg_len + rmax * 0.3, along + reach) + 1.0, 1.0)
    if len(s) < 4:
        return None
    best: tuple[float, float] | None = None
    best_solid = -1.0
    for shift in np.arange(-6.0, 6.5, 2.0):
        P = a[None, :] + d[None, :] * s[:, None] + n[None, :] * shift
        solid = np.zeros(len(s), dtype=bool)
        for o in np.linspace(-t / 2, t / 2, 5):
            solid |= _sample(dark, P + n[None, :] * o)
        share = float(solid.mean())
        if share <= best_solid:
            continue
        # open runs bounded by solid ink on both sides
        runs: list[tuple[float, float]] = []
        i = 0
        while i < len(s):
            if solid[i]:
                i += 1
                continue
            j = i
            while j < len(s) and not solid[j]:
                j += 1
            if i > 0 and j < len(s):
                runs.append((float(s[i]), float(s[j - 1])))
            i = j
        pick = None
        for r0, r1 in runs:
            width = r1 - r0 + 1
            if not rmin <= width <= 2.4 * rmax:
                continue
            dist = 0.0 if r0 <= along <= r1 else min(abs(along - r0), abs(along - r1))
            if dist > 0.5 * width:
                continue
            if pick is None or dist < pick[0]:
                pick = (dist, r0 - 0.5, r1 + 0.5)
        best_solid = share
        best = (pick[1], pick[2]) if pick is not None else None
    return best


def propose(pic: dict[str, Any], x: float, y: float, walls: list[dict[str, Any]], scale_m_per_px: float | None, calibrated: bool,
            wall_id: str | None = None, deadline: float | None = None) -> dict[str, Any]:
    """The door proposal for a click at (x, y) (0..1 of the picture). `walls` are the draft's walls (document-v2 dicts:
    id, polyline, thickness_m) on the level being edited; `wall_id` pins the wall when the person clicked on one.
    `scale_m_per_px` is the document's effective scale (the calibration, or the editor's estimate) and `calibrated` says
    whether it is a real one: only then does it bound the leaf sizes searched. Raises NoWall when there is neither a
    symbol nor a wall to place a door on."""
    t0 = time.perf_counter()
    g_full, thr, W, H = pic["g"], pic["thr"], pic["w"], pic["h"]
    click_full = np.array([x * W, y * H])
    s = scale_m_per_px if scale_m_per_px and scale_m_per_px > 0 else None
    side = max(W, H)
    t_local: float | None = None
    if calibrated and s:
        rmin, rmax = max(MIN_LEAF_PX, LEAF_M[0] / s), max(MIN_LEAF_PX * 2, LEAF_M[1] / s)
    else:
        # without a real scale the walls around the click set the size: a door is a few wall thicknesses wide
        t_local = local_wall_thickness(g_full, thr, click_full, int(0.05 * side) + 40)
        if t_local is not None:
            rmin, rmax = max(MIN_LEAF_PX, LEAF_WALLS[0] * t_local), max(MIN_LEAF_PX * 2, LEAF_WALLS[1] * t_local)
        else:
            rmin, rmax = max(MIN_LEAF_PX, LEAF_FRAC[0] * side), max(MIN_LEAF_PX * 2, LEAF_FRAC[1] * side)
    rmax = min(rmax, 0.12 * side)
    # the wall band beside a door line: WALL_T_M at a real scale, else the walls measured here, else a guess
    t_default = max(3.0, min(0.6 * rmax, (WALL_T_M / s) if (calibrated and s) else t_local if t_local is not None else 0.3 * rmin + 2))
    # the draft's walls near the click
    # the draft's walls near the click; a wall the person clicked on (`wall_id`) comes first - the plain path uses the
    # first - but the others stay: the door may sit in one of them (a door by a corner, clicked at its hinge, pins the
    # perpendicular wall)
    near: list[tuple[float, Any]] = []
    for seg in _segments(walls, W, H):
        wall, pts, cum, total, i, a, b, L = seg
        dist, along = _seg_dist(click_full, a, b)
        t_px = float(wall.get("thickness_m") or WALL_T_M) / s if s else t_default
        pin = wall_id is not None and wall.get("id") == wall_id
        if dist <= max(1.3 * rmax, t_px) + 4 or pin:
            near.append((-1.0 if pin else dist, seg))
    near.sort(key=lambda z: z[0])
    near = near[:6]
    # the crop at the upload resolution
    pad = int(math.ceil(CROP_LEAVES * rmax + 8))
    x0, y0 = max(0, int(click_full[0]) - pad), max(0, int(click_full[1]) - pad)
    x1, y1 = min(W, int(click_full[0]) + pad + 1), min(H, int(click_full[1]) + pad + 1)
    g = g_full[y0:y1, x0:x1]
    off = np.array([x0, y0], dtype=np.float64)
    click = click_full - off
    dark = np.zeros((1, 1), dtype=bool)  # the wall ink of the crop (the plain path): the search's own wall mask
    t_band = t_default
    if near:
        w0 = near[0][1][0]
        t_band = max(3.0, min(0.6 * rmax, float(w0.get("thickness_m") or WALL_T_M) / s)) if s else t_default
    dirs = _directions([seg[6] - seg[5] for _, seg in near])
    _check(deadline)
    cands: list[dict[str, Any]] = []
    doubles: list[dict[str, Any]] = []
    if g.size:
        # the padding keeps every sample inside the arrays: a hinge lies within HINGE_REACH of the click, the longest
        # ray (a 60 degree leaf, 2.5 rmax) plus a chunk, and the bands and arcs past it reach 2.6 rmax + t + 30 further;
        # the crop already holds CROP_LEAVES * rmax (less at the picture's edge) around the click
        edge = min(click[0], click[1], g.shape[1] - click[0], g.shape[0] - click[1])
        margin = max(8, int(math.ceil(HINGE_REACH * rmax + 4 + 2.6 * rmax + t_band + 30 - edge)))
        cx = _Crop(g, thr, t_band, margin, click, HINGE_REACH * rmax + 4, deadline)
        dark = cx.wall2d
        cands = _candidates(cx, click, rmin, rmax, t_band, dirs, deadline)
        _check(deadline)
        doubles = _pairs(cx, cands, t_band, click, rmin, rmax) if cands else []
    singles = [c for c in cands if c["square"] or c.get("alone")]
    pool = [c for c in singles + doubles if c["score"] >= SCORE_MIN]
    best = None
    if pool:
        def rank(c: dict[str, Any]) -> float:
            # a person clicks inside the symbol: the middle of the swing (the door line's middle, raised by a third of
            # the leaf's reach) near the click counts
            reach = float(np.dot(c["tip"] - c["H"], c["N"]))
            middle = c["H"] + c["U"] * c["width"] / 2 + c["N"] * max(0.0, reach) / 3
            return c["score"] - RANK_DIST * float(np.hypot(*(middle - click))) / max(c["width"], 1.0)
        best = max(pool, key=rank)
    stats = {"hinge_templates": len(cands), "doubles": len(doubles), "walls_near": len(near)}
    result: dict[str, Any]
    if best is not None:
        result = _place_symbol(cx, best, off, near, W, H, s, t_band)
    else:
        result = _place_plain(dark, off, click_full, near, W, H, s, rmin, rmax)
    result["confidence"] = round(float(result.get("confidence", 0.3)), 3)
    result["note"] = NOTES[result["found"]]
    result["stats"] = stats
    result["elapsed_ms"] = int((time.perf_counter() - t0) * 1000)
    result["scale"] = {"m_per_px": s, "calibrated": bool(calibrated and s), "wall_px": round(t_local, 1) if t_local is not None else None,
                       "leaf_px": [round(rmin, 1), round(rmax, 1)]}
    return result


def _carrier(centre: np.ndarray, d: np.ndarray, width: float, near: list[tuple[float, Any]], W: int, H: int, s: float | None, t_band: float):
    """The draft wall a door with this centre and direction sits on: parallel within 8 degrees, the door line within
    the wall's band (half its thickness plus a margin), and the door inside the wall's length (a quarter width may stick
    out: it is then pulled in). (wall, pts, t along 0..1, wall direction at the door) or None."""
    best = None
    for _, (wall, pts, cum, total, i, a, b, L) in near:
        dw = _unit(b - a)
        if abs(float(np.dot(dw, d))) < math.cos(math.radians(8)):
            continue
        dist, along = _seg_dist(centre, a, b)
        rel = centre - a
        raw_along = float(np.dot(rel, dw))
        lateral = abs(float(dw[0] * rel[1] - dw[1] * rel[0]))
        t_px = float(wall.get("thickness_m") or WALL_T_M) / s if s else t_band
        if lateral > t_px / 2 + max(6.0, 0.2 * width):
            continue
        pos = float(cum[i]) + raw_along
        if pos - width / 2 < -0.25 * width or pos + width / 2 > total + 0.25 * width:
            continue
        half = width / 2
        pos = min(max(pos, half), total - half) if total >= width else total / 2
        if best is None or lateral < best[0]:
            best = (lateral, wall, pos / total, dw)
    return None if best is None else best[1:]


def _orient(U: np.ndarray, N: np.ndarray, dw: np.ndarray, double: bool) -> tuple[str, str]:
    """(hinge, swing) of the document for a leaf hinged where the door line starts along U, swinging to N, on a wall
    running along dw. A double door's hinge field picks the side of the wall it opens to (start = the left normal)."""
    nl = _perp(dw)
    left = float(np.dot(N, nl)) > 0
    if double:
        return ("start" if left else "end"), "double"
    return ("start" if float(np.dot(U, dw)) > 0 else "end"), ("left" if left else "right")


def _norm(p: np.ndarray, W: int, H: int) -> list[float]:
    return [round(min(1.0, max(0.0, float(p[0]) / W)), 6), round(min(1.0, max(0.0, float(p[1]) / H)), 6)]


def _refine(cx: _Crop, c: dict[str, Any], t: float) -> dict[str, Any]:
    """The door's own wall, measured from the wall ink: the band behind the door line (the offsets, into the wall from
    the swing side, where the wall stands behind the hinge or past the latch) and, along its centre line, the open run
    around the middle of the symbol closed by wall ink on both sides - the jambs. The door line moves onto the band's
    centre line (the document's walls are centre lines). A slanted leaf or a double door takes the run as its width and
    position when it is within 0.6-1.25 of the symbol's; a 90 degree leaf keeps its own (its length is the width, the gap
    between two blurred wall ends reads narrower) and the run only confirms it. Returns the door line's centre (crop
    px), width, wall thickness and whether the jambs were found."""
    H, U, N, w = c["H"], c["U"], c["N"], float(c["width"])
    offs = np.arange(-3.0, 1.6 * t + 4.0, 1.0)
    back = np.array([-10.0, -8.0, -6.0, -4.0])
    ahead = w + np.array([4.0, 6.0, 8.0, 10.0])
    pts = H[None, None, :] - N[None, None, :] * offs[:, None, None] + U[None, None, :] * np.concatenate([back, ahead])[None, :, None]
    solid = cx.at_clamped(cx.wall, pts)
    behind, past = solid[:, :4].mean(axis=1) >= 0.5, solid[:, 4:].mean(axis=1) >= 0.5
    rows = behind & past  # the wall on both sides of the door where it can be seen, else on either
    if not rows.any():
        rows = behind | past
    guess = {"centre": H + U * w / 2 - N * (t / 2), "width": w, "thick": t, "refined": False}
    if not rows.any():
        return guess
    # the band nearest the door line
    idx = np.nonzero(rows)[0]
    first = idx[0]
    last = first
    while last + 1 < len(rows) and rows[last + 1]:
        last += 1
    o_lo, o_hi = float(offs[first]), float(offs[last])
    o_c = (o_lo + o_hi) / 2
    thick = max(2.0, o_hi - o_lo + 1)
    guess["centre"] = H + U * w / 2 - N * o_c
    guess["thick"] = thick
    ss = np.arange(-0.6 * w, 1.6 * w + 1.0, 1.0)
    band = np.linspace(o_lo + 1, o_hi - 1, 3) if o_hi - o_lo >= 4 else np.array([o_c])  # the band's core: a wall end is rounded by the blur
    P = H[None, None, :] - N[None, None, :] * band[None, :, None] + U[None, None, :] * ss[:, None, None]
    line = cx.at_clamped(cx.wall, P).any(axis=1)
    mid = int(np.argmin(np.abs(ss - w / 2)))
    if line[mid]:
        return guess
    lo = mid
    while lo > 0 and not line[lo - 1]:
        lo -= 1
    hi = mid
    while hi + 1 < len(ss) and not line[hi + 1]:
        hi += 1
    if lo == 0 or hi == len(ss) - 1:
        return guess
    g0, g1 = float(ss[lo]) - 0.5, float(ss[hi]) + 0.5
    if not 0.6 * w <= g1 - g0 <= 1.25 * w:
        return guess
    if c["square"] and c["kind"] != "double":
        return dict(guess, refined=True)  # the leaf measures the width better than the blurred jambs; they confirm it
    return {"centre": H + U * (g0 + g1) / 2 - N * o_c, "width": g1 - g0, "thick": thick, "refined": True}


def _place_symbol(cx: _Crop, c: dict[str, Any], off: np.ndarray, near, W: int, H: int, s: float | None, t_band: float) -> dict[str, Any]:
    U, N = c["U"], c["N"]
    ref = _refine(cx, c, t_band)
    width = float(ref["width"])
    centre = ref["centre"] + off  # on the wall's centre line: the leaf hangs on the face it swings from
    Hf = centre - U * width / 2
    found = c["kind"]
    conf = min(0.95, max(0.35, c["score"] + (0.05 if ref["refined"] else -0.05)))
    t_band = float(ref["thick"])
    centre_face = centre + N * (t_band / 2)
    hit = _carrier(centre, U, width, near, W, H, s, t_band) or _carrier(centre_face, U, width, near, W, H, s, t_band)
    out: dict[str, Any] = {"found": found, "width_px": round(width, 2), "scores": dict(c["scores"], jambs=ref["refined"]),
                           "hinge_point": _norm(Hf, W, H), "leaf_tip": _norm(c["tip"] + off, W, H)}
    if hit is not None:
        wall, t, dw = hit
        hinge, swing = _orient(U, N, dw, found == "double")
        out.update({"wall_id": wall["id"], "t": round(float(t), 5), "new_wall": None, "hinge": hinge, "swing": swing, "confidence": conf, "warning": None})
        return out
    d = _canon(U)
    j = (JAMB_M / s) if s else 0.25 * width
    a, b = centre - d * (width / 2 + j), centre + d * (width / 2 + j)
    hinge, swing = _orient(U, N, d, found == "double")
    out.update({"wall_id": None, "t": 0.5, "new_wall": {"polyline": [_norm(a, W, H), _norm(b, W, H)], "thickness_px": round(t_band, 2)},
                "hinge": hinge, "swing": swing, "confidence": min(conf, 0.6),
                "warning": "אין קיר בטיוטה לאורך הדלת: יתווסף קטע קיר קצר איתה. בדוק את עוביו ואת חיבורו לקירות הסמוכים."})
    return out


def _place_plain(dark: np.ndarray, off: np.ndarray, click: np.ndarray, near, W: int, H: int, s: float | None, rmin: float, rmax: float) -> dict[str, Any]:
    """No symbol: a gap in the wall ink along the nearest draft wall, else the default door at the click on it."""
    if not near:
        raise NoWall("no door symbol around the click and no wall of the draft near it")
    dist, (wall, pts, cum, total, i, a, b, L) = near[0]
    dw = _unit(b - a)
    t_px = float(wall.get("thickness_m") or WALL_T_M) / s if s else max(4.0, 0.3 * rmin + 2)
    _, along = _seg_dist(click, a, b)
    side = float(np.dot(click - (a + dw * along), _perp(dw)))
    swing = "left" if side > 0 else "right"  # towards the side of the wall that was clicked
    gap = _gap_on_wall(dark, a - off, dw, L, along, t_px, rmin, rmax)
    if gap is not None:
        g0, g1 = gap
        width = g1 - g0
        pos = float(cum[i]) + (g0 + g1) / 2
        if width <= total:
            pos = min(max(pos, width / 2), total - width / 2)
            return {"found": "gap", "wall_id": wall["id"], "t": round(pos / total, 5), "new_wall": None, "width_px": round(width, 2), "hinge": "start", "swing": swing,
                    "confidence": 0.45, "warning": None, "scores": {}}
    width = (DOOR_DEFAULT_M / s) if s else None
    wpx = width if width is not None else 0.0
    pos = float(cum[i]) + along
    if wpx and wpx <= total:
        pos = min(max(pos, wpx / 2), total - wpx / 2)
    return {"found": "default", "wall_id": wall["id"], "t": round(pos / total, 5), "new_wall": None, "width_px": None, "hinge": "start", "swing": swing,
            "confidence": 0.2, "warning": "לא נמצאו סמל דלת או פער ליד הלחיצה: הוצעה דלת ברוחב ברירת המחדל. בדוק רוחב, ציר וכיוון.", "scores": {}}
