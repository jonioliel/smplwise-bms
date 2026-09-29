"""Hollow walls ("hollow_v1") of the Plan Studio detector (T087): a second pass after the solid walls.

The owner's scans draw many exterior walls as two thin parallel lines with white between them. The solid pass reads
the closed and opened ink (plan_detect._analysis "walls"): a 1-3 px line does not survive the opening, and two such
lines only merge into one band where the closing bridges them, so these walls are missed or read as a thin interior
wall. This pass reads the dark ink (grey <= the picture's Otsu threshold, before any morphology) instead. It runs on
the solid segments left by plan_detect.drop_reference_strokes, which therefore stays exactly as it was.

The rule (lengths at the working resolution, plan_detect.ANALYSIS_PX; axis-parallel walls of the straightened picture
only - a diagonal hollow wall is a known limit):

1. Stroke: a straight axis-parallel run of dark ink at least HOLLOW_RUN_M long (pixels whose dark run across the axis
   is at most HOLLOW_PIXEL_PX, joined over neighbouring rows) whose thickness (the median over its columns) is at most
   HOLLOW_STROKE_PX AND below the plan's median solid wall (t_med - 0.5 px). A solid wall is at least t_med thick by
   definition, so two solid walls never form a pair: the discriminator of the T-junction case (12 px walls, t_med 12).
2. Pair: two strokes on one axis, centre-to-centre spacing within HOLLOW_SPACING_M, cut into the stretches of their
   overlap whose interior is blank: no "interior ink" pixel across the band strictly between the two strokes (a dark
   speck of at most HOLLOW_SPECK_PX along does not count), each stretch at least HOLLOW_RUN_M long and at most
   HOLLOW_BLANK_MAX ink. Interior ink is grey <= half way from the threshold to the strokes' median core grey (the
   darkest grey across each stroke): a light scan's blur between two hairlines is not ink, hatching, room content, a
   stair, a window's glass line or a crossing wall is - so a window or a crossing ends a stretch, and the gap pass then
   classifies the gap (a window's lines along it, a door's arc).
3. Not a stack: no third stroke continues the rhythm - a parallel stroke beyond either line at HOLLOW_STACK times the
   spacing, along at least HOLLOW_STACK_OVERLAP of the stretch (stair treads, tribune rows).
4. Spacing: the plan's own hollow-wall spacing is learnt as the length-weighted mode of the stretches left after 1-3
   (half-pixel bins); a stretch is kept within HOLLOW_SPACING_TOL of it (or HOLLOW_SPACING_TOL_PX).
5. Not a tribune: beyond either line, no regular stack of rows (plan_detect's tribune rule, _steps_side: STEPS_MIN_ROWS
   lines STEPS_SPACING_M apart, read on the soft ink) - the double line of a railing at a tribune's edge is no wall.
6. Not an opening of a solid wall: a stretch on the line of a truly solid wall piece (its centre line interior ink on
   at least HOLLOW_SOLID_CENTRE of its length, as thick as the pair within HOLLOW_SOLID_RATIO) that touches it along
   the line is the face lines of a window or a passage in that wall, not a wall.
7. Length: a hollow wall runs at least HOLLOW_MIN_M; a shorter stretch is kept only when it continues a kept one on
   the same line (centre and spacing within HOLLOW_LINE_PX) within plan_detect.WINDOW_RANGE_M[1].
8. Structure: a stretch is kept only when it belongs to the building - linked end-to-body (an end within the other's
   half thickness plus max(3 px, t_med)), or along its line within WINDOW_RANGE_M[1], through other stretches to a
   solid wall; or, with no solid wall in its group, when the group has stretches in both axes and lies inside the
   solid walls' box grown as drop_reference_strokes grows it. A lone pair (two dimension lines, a double title rule,
   a double sheet border) is not a wall.

Two solid walls 0.75 m apart with walls crossing between them (the T-junction fixture) fail rule 1 (their strokes are
as thick as the median wall) and rule 2 (0.8 m centre to centre is above HOLLOW_SPACING_M).

A kept stretch becomes one wall on its middle line, as thick as the pair (outer face to outer face), flagged hollow:
its ends are the drawn ends pulled in by half its thickness (the solid pass's skeleton convention, so the gap between
two pieces is the drawn opening), or moved onto the centre line of a perpendicular wall it meets (a corner, a T). A
solid piece on its line inside its band, no thicker than it and at least half inside its length (the closing fused
part of the pair into a band), is absorbed into it; a solid piece on its line mostly outside it stays, and the stretch
is cut around it (the solid wall and its openings stay as they were). Kind: exterior. Confidence: at most
HOLLOW_CONF_MAX, from length, blankness and agreement with the learnt spacing.

Known limits: axis-parallel only; one spacing per plan (the mode); a double line with a light grey fill reads hollow;
a hollow wall made of two hairline pairs (a cladding pair and an inner line) is read at its hairline pair.

Cost: run-length passes over the dark mask in both axes and a union of runs: 0.3-0.9 s at 1600 px on the owner's
scans. The run's deadline is checked between the stages."""
from __future__ import annotations

import math
from typing import Any, Callable

import numpy as np

from . import plan_detect as pd

HOLLOW_VERSION = "hollow_v1"
HOLLOW_STROKE_PX = 5.0  # a stroke is at most this thick (a 1-3 px drawn line, blur of a scan) ...
HOLLOW_PIXEL_PX = 7  # ... read from pixels whose dark run across the axis is at most this long
HOLLOW_SPECK_PX = 2  # a dark speck across the interior this short does not end a blank stretch
HOLLOW_RUN_M = 0.4  # a stroke is a straight run of at least this length
HOLLOW_MIN_M = 1.5  # a hollow wall runs at least this long
HOLLOW_SPACING_M = (0.12, 0.6)  # centre-to-centre spacing of the two strokes
HOLLOW_SPACING_TOL = 0.35  # a kept pair's spacing is within this share of the plan's learnt spacing ...
HOLLOW_SPACING_TOL_PX = 1.5  # ... or within this many pixels
HOLLOW_BLANK_MAX = 0.1  # the dark ink between the strokes covers at most this share of the band
HOLLOW_STACK = (0.6, 1.4)  # a third stroke this many spacings beyond a line makes a stack ...
HOLLOW_STACK_OVERLAP = 0.5  # ... when it runs along this share of the pair
HOLLOW_SOLID_CENTRE = 0.8  # a truly solid wall piece: its centre line is dark on this share
HOLLOW_SOLID_RATIO = (0.7, 1.4)  # ... and as thick as the pair within these ratios (the window guard)
HOLLOW_LINE_PX = 1.5  # pieces of one hollow wall: centre and spacing within this many pixels
HOLLOW_CONF_MAX = 0.9


class Stroke:
    """A thin axis-parallel run of dark ink in an axis frame: `c` its centre across the axis, `lo` / `hi` the first
    and last pixel along it, `t` its thickness."""
    __slots__ = ("c", "lo", "hi", "t")

    def __init__(self, c: float, lo: int, hi: int, t: float) -> None:
        self.c, self.lo, self.hi, self.t = c, lo, hi, t


class Pair:
    """Two strokes of one hollow wall in an axis frame ("h": along x, "v": along y)."""
    __slots__ = ("axis", "a", "b", "c", "d", "lo", "hi", "w", "blank", "q")

    def __init__(self, axis: str, a: Stroke, b: Stroke, lo: int, hi: int, blank: float) -> None:
        self.axis, self.a, self.b, self.lo, self.hi, self.blank = axis, a, b, lo, hi, blank
        self.c = (a.c + b.c) / 2
        self.d = b.c - a.c
        self.w = self.d + (a.t + b.t) / 2  # outer face to outer face
        self.q = 0.0

    @property
    def length(self) -> float:
        return float(self.hi - self.lo + 1)


def _row_runs(mask: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Every run of set pixels along the rows: (row, first x, last x + 1)."""
    h, w = mask.shape
    p = np.zeros((h, w + 2), dtype=np.int8)
    p[:, 1:-1] = mask
    d = np.diff(p, axis=1)
    ys, x0 = np.nonzero(d == 1)
    _ye, x1 = np.nonzero(d == -1)
    return ys, x0, x1


def _paint(shape: tuple[int, int], ys: np.ndarray, x0: np.ndarray, x1: np.ndarray, val: np.ndarray | None = None) -> np.ndarray:
    """A row-run list painted back onto a picture (each run's pixels get `val`, default 1)."""
    h, w = shape
    acc = np.zeros((h, w + 1), dtype=np.int32)
    v = np.ones(len(ys), dtype=np.int32) if val is None else val.astype(np.int32)
    np.add.at(acc, (ys, x0), v)
    np.add.at(acc, (ys, x1), -v)
    return np.cumsum(acc, axis=1)[:, :w]


def axis_strokes(mask: np.ndarray, run_px: int, t_max: float) -> list[Stroke]:
    """The thin strokes along the rows of `mask` (transpose it for the columns): pixels in row runs of at least run_px,
    whose run across the rows (inside those long runs) is at most HOLLOW_PIXEL_PX; long runs of those pixels joined
    over neighbouring rows where they overlap; a joined stroke whose median thickness exceeds t_max is dropped."""
    ys, x0, x1 = _row_runs(mask)
    k = (x1 - x0) >= run_px
    if not k.any():
        return []
    along = _paint(mask.shape, ys[k], x0[k], x1[k]) > 0
    cy, c0, c1 = _row_runs(along.T)
    across = _paint(along.T.shape, cy, c0, c1, c1 - c0).T
    thin = along & (across <= HOLLOW_PIXEL_PX)
    ys, x0, x1 = _row_runs(thin)
    k = (x1 - x0) >= run_px
    ys, x0, x1 = ys[k], x0[k], x1[k]
    n = len(ys)
    if not n:
        return []
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    start = np.searchsorted(ys, np.arange(mask.shape[0] + 1))  # ys is sorted (row-major runs)
    yl, x0l, x1l = ys.tolist(), x0.tolist(), x1.tolist()
    for i in range(n):
        y = yl[i]
        if y == 0:
            continue
        for j in range(int(start[y - 1]), int(start[y])):
            if x0l[j] < x1l[i] and x0l[i] < x1l[j]:
                parent[find(i)] = find(j)
    comps: dict[int, list[int]] = {}
    for i in range(n):
        comps.setdefault(find(i), []).append(i)
    out: list[Stroke] = []
    for ids in comps.values():
        idx = np.array(ids)
        lo, hi = int(x0[idx].min()), int(x1[idx].max())
        cnt = np.zeros(hi - lo, dtype=np.int32)
        for i in ids:
            cnt[x0l[i] - lo : x1l[i] - lo] += 1
        t = float(np.median(cnt[cnt > 0]))
        if t > t_max:
            continue
        wsum = (x1[idx] - x0[idx]).astype(np.float64)
        out.append(Stroke(float(np.sum(ys[idx] * wsum) / wsum.sum()), lo, hi - 1, t))
    return out


def _blank_stretches(band: np.ndarray, run_px: int) -> list[tuple[int, int, float]]:
    """The stretches (first, last column, dark share) of an interior band (rows across, columns along) with no dark
    pixel across it, blocked runs of at most HOLLOW_SPECK_PX bridged (scan speckle), at least run_px long and at most
    HOLLOW_BLANK_MAX dark over the stretch."""
    blocked = band.any(axis=0)
    n = blocked.size
    p = np.concatenate(([False], blocked, [False])).astype(np.int8)
    dd = np.diff(p)
    for s0, s1 in zip(np.flatnonzero(dd == 1), np.flatnonzero(dd == -1)):
        if s1 - s0 <= HOLLOW_SPECK_PX and s0 > 0 and s1 < n:
            blocked[s0:s1] = False
    p = np.concatenate(([True], blocked, [True])).astype(np.int8)
    dd = np.diff(p)
    out = []
    for s0, s1 in zip(np.flatnonzero(dd == -1), np.flatnonzero(dd == 1)):
        if s1 - s0 >= run_px:
            share = float(band[:, s0:s1].mean())
            if share <= HOLLOW_BLANK_MAX:
                out.append((int(s0), int(s1 - 1), share))
    return out


def _pairs(axis: str, strokes: list[Stroke], dark: np.ndarray, sp_lo: float, sp_hi: float, run_px: int) -> list[Pair]:
    """Every pair of rules 1-2 in one axis frame (`dark` in that frame: rows along the axis): one per blank stretch of
    the two strokes' overlap (a window symbol, a crossing wall or hatching between the lines ends a stretch)."""
    strokes = sorted(strokes, key=lambda st: st.c)
    cs = [st.c for st in strokes]
    out: list[Pair] = []
    for i, a in enumerate(strokes):
        for j in range(i + 1, len(strokes)):
            b = strokes[j]
            dd = cs[j] - cs[i]
            if dd > sp_hi:
                break
            if dd < sp_lo:
                continue
            lo, hi = max(a.lo, b.lo), min(a.hi, b.hi)
            if hi - lo + 1 < run_px:
                continue
            r0 = int(round(a.c + (a.t - 1) / 2)) + 1
            r1 = int(round(b.c - (b.t - 1) / 2)) - 1
            if r1 < r0:
                continue
            for x0, x1, share in _blank_stretches(dark[r0 : r1 + 1, lo : hi + 1], run_px):
                out.append(Pair(axis, a, b, lo + x0, lo + x1, share))
    return out


def _core_grey(axis: str, st: Stroke, gray: np.ndarray) -> float:
    """The stroke's core: the median over (up to 32 of) its columns of the darkest grey across it."""
    r0 = max(0, int(round(st.c - st.t / 2)))
    r1 = min(gray.shape[0], int(round(st.c + st.t / 2)) + 1)
    cols = np.unique(np.linspace(st.lo, st.hi, 32).round().astype(int))
    return float(np.median(gray[r0:r1, cols].min(axis=0)))


def _stacked(p: Pair, strokes: list[Stroke]) -> bool:
    """Rule 3: a third stroke beyond either line at HOLLOW_STACK spacings, along HOLLOW_STACK_OVERLAP of the pair."""
    for st in strokes:
        if st is p.a or st is p.b:
            continue
        beyond = p.a.c - st.c if st.c < p.a.c else st.c - p.b.c if st.c > p.b.c else -1.0
        if HOLLOW_STACK[0] * p.d <= beyond <= HOLLOW_STACK[1] * p.d:
            if min(st.hi, p.hi) - max(st.lo, p.lo) + 1 >= HOLLOW_STACK_OVERLAP * p.length:
                return True
    return False


def learn_spacing(pairs: list[Pair]) -> float | None:
    """Rule 4: the length-weighted mode of the pairs' spacings (half-pixel bins, smoothed over neighbours)."""
    if not pairs:
        return None
    ds = np.array([p.d for p in pairs])
    wts = np.array([p.length for p in pairs])
    lo = math.floor(ds.min() * 2) / 2
    bins = np.floor((ds - lo) * 2).astype(int)
    hist = np.bincount(bins, weights=wts)
    smooth = hist.copy()
    smooth[1:] += hist[:-1] * 0.5
    smooth[:-1] += hist[1:] * 0.5
    k = int(np.argmax(smooth))
    sel = np.abs(bins - k) <= 1
    return float(np.average(ds[sel], weights=wts[sel]))


def _seg_of_stroke(axis: str, st: Stroke) -> pd.Seg:
    if axis == "h":
        return pd.Seg(np.array([float(st.lo), st.c]), np.array([float(st.hi), st.c]), [st.t] * 3, axis=True)
    return pd.Seg(np.array([st.c, float(st.lo)]), np.array([st.c, float(st.hi)]), [st.t] * 3, axis=True)


def _tribune(p: Pair, ink: np.ndarray, s: float) -> bool:
    """Rule 5: a regular stack of rows beyond either line (plan_detect's tribune rule, on the soft ink)."""
    st_lo, st_hi = pd.STEPS_SPACING_M[0] / s, pd.STEPS_SPACING_M[1] / s
    reach = st_hi * (pd.STEPS_MIN_ROWS + 0.5)
    for st, away in ((p.a, -1.0), (p.b, 1.0)):
        g = _seg_of_stroke(p.axis, st)
        nl = np.array([g.dir[1], -g.dir[0]])
        across = np.array([0.0, 1.0]) if p.axis == "h" else np.array([1.0, 0.0])
        sign = 1.0 if float(np.dot(nl, across * away)) > 0 else -1.0
        if pd._steps_side(pd._lines_beside(g, ink, reach)[1:], sign, st_lo, st_hi):
            return True
    return False


def _frame_of(axis: str, g: pd.Seg) -> tuple[float, float, float] | None:
    """A solid segment in an axis frame: (centre across, lo, hi along), or None when it is not on that axis."""
    if not g.axis:
        return None
    horiz = abs(g.dir[0]) >= abs(g.dir[1])
    if (axis == "h") != horiz:
        return None
    if axis == "h":
        return float((g.a[1] + g.b[1]) / 2), float(min(g.a[0], g.b[0])), float(max(g.a[0], g.b[0]))
    return float((g.a[0] + g.b[0]) / 2), float(min(g.a[1], g.b[1])), float(max(g.a[1], g.b[1]))


def _centre_dark(g: pd.Seg, dark: np.ndarray) -> float:
    along = np.linspace(0.05, 0.95, 32)
    return pd._ratio(dark, g.a + np.outer(along, g.b - g.a))


def _pt(axis: str, along: float, across: float) -> np.ndarray:
    return np.array([along, across]) if axis == "h" else np.array([across, along])


def find_hollow(segs: list[pd.Seg], an: dict[str, Any], s: float, t_med: float, check: Callable[[], None] = lambda: None) -> tuple[list[pd.Seg], list[pd.Seg], dict[str, Any]]:
    """The hollow walls of the picture (see the module docstring). `segs` are the solid pass's segments, `an` the
    masks of plan_detect._analysis (it needs "dark" and "ink_d"), `s` metres per analysis pixel. Returns (the solid
    segments left - those absorbed into a hollow wall removed -, the hollow segments with Seg.hollow = their
    confidence, stats)."""
    dark = an["dark"]
    run_px = max(4, int(round(HOLLOW_RUN_M / s)))
    t_max = min(HOLLOW_STROKE_PX, t_med - 0.5)
    sp_lo = HOLLOW_SPACING_M[0] / s
    sp_hi = HOLLOW_SPACING_M[1] / s
    stats: dict[str, Any] = {"version": HOLLOW_VERSION, "strokes": 0, "pairs": 0, "spacing_px": None, "walls": 0, "absorbed": 0}
    frames = {"h": dark, "v": dark.T}
    strokes: dict[str, list[Stroke]] = {}
    for axis, m in frames.items():
        strokes[axis] = axis_strokes(m, run_px, t_max) if t_max >= 1.0 else []
        stats["strokes"] += len(strokes[axis])
        check()
    # the interior is blank when nothing in it is as dark as the strokes: ink there is what is at least half way from
    # the threshold to the strokes' typical core grey (a light scan's blur between two hairlines is not ink)
    gray = an["gray"]
    cores = [_core_grey(axis, st, gray if axis == "h" else gray.T) for axis in frames for st in strokes[axis]]
    core = float(np.median(cores)) if cores else 0.0
    stats["core_grey"] = round(core, 1)
    blank_ink = gray <= (core + an["threshold"]) / 2
    cands: list[Pair] = []
    for axis in frames:
        m = blank_ink if axis == "h" else blank_ink.T
        ps_ = _pairs(axis, strokes[axis], m, max(sp_lo, 3.0), sp_hi, run_px)
        cands += [p for p in ps_ if not _stacked(p, strokes[axis])]
    check()
    stats["pairs"] = len(cands)
    mode = learn_spacing(cands)
    if mode is None:
        return segs, [], stats
    stats["spacing_px"] = round(mode, 2)
    tol = max(HOLLOW_SPACING_TOL_PX, HOLLOW_SPACING_TOL * mode)
    cands = [p for p in cands if abs(p.d - mode) <= tol]
    rules = {"spacing": len(cands)}  # the pairs left after each rule, for the stats
    cands = [p for p in cands if not _tribune(p, an["ink_d"], s)]
    rules["tribune"] = len(cands)
    check()
    # rule 6 (the window guard) and the solid pieces inside a pair's band
    solid_frames = [(i, _frame_of("h", g), _frame_of("v", g)) for i, g in enumerate(segs)]
    truly: dict[int, bool] = {}
    kept: list[Pair] = []
    for p in cands:
        guard = False
        for i, fh, fv in solid_frames:
            f = fh if p.axis == "h" else fv
            if f is None:
                continue
            g = segs[i]
            c, lo, hi = f
            if abs(c - p.c) > p.w / 2 or not (HOLLOW_SOLID_RATIO[0] * p.w <= g.thick <= HOLLOW_SOLID_RATIO[1] * p.w):
                continue
            if lo - g.thick / 2 > p.hi + p.w + 2 or hi + g.thick / 2 < p.lo - p.w - 2:
                continue
            if i not in truly:
                truly[i] = _centre_dark(g, blank_ink) >= HOLLOW_SOLID_CENTRE
            if truly[i]:
                guard = True
                break
        if not guard:
            kept.append(p)
    rules["guard"] = len(kept)
    # one pair per band: the longer / more regular one wins where two overlap
    kept.sort(key=lambda p: -(p.length * (1.0 - abs(p.d - mode) / (2 * tol))))
    unique: list[Pair] = []
    for p in kept:
        if any(q.axis == p.axis and abs(q.c - p.c) < (q.w + p.w) / 2 and min(q.hi, p.hi) - max(q.lo, p.lo) > 0.5 * min(q.length, p.length) for q in unique):
            continue
        unique.append(p)
    rules["unique"] = len(unique)
    # rule 7: long pairs, and the shorter pieces that continue them on the same line
    long_px = HOLLOW_MIN_M / s
    reach = pd.WINDOW_RANGE_M[1] / s
    keep = [p for p in unique if p.length >= long_px]
    rest = [p for p in unique if p.length < long_px]
    grown = True
    while grown and rest:
        grown = False
        for p in list(rest):
            if any(q.axis == p.axis and abs(q.c - p.c) <= HOLLOW_LINE_PX and abs(q.d - p.d) <= HOLLOW_LINE_PX and max(q.lo - p.hi, p.lo - q.hi) <= reach for q in keep):
                keep.append(p)
                rest.remove(p)
                grown = True
    rules["length"] = len(keep)
    check()
    # rule 8: linked to the building
    n_s = len(segs)
    bodies: list[tuple[np.ndarray, np.ndarray, float]] = [(g.a, g.b, g.thick / 2) for g in segs]
    ends: list[list[np.ndarray]] = [[g.a, g.b] for g in segs]
    for p in keep:
        a, b = _pt(p.axis, p.lo - p.w / 2, p.c), _pt(p.axis, p.hi + p.w / 2, p.c)  # to the corner's centre
        bodies.append((a, b, p.w / 2))
        ends.append([_pt(p.axis, p.lo, p.c), _pt(p.axis, p.hi, p.c)])
    n = len(bodies)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    link = max(3.0, t_med)
    if keep:
        pts = np.array([e for es in ends for e in es])
        owner = np.repeat(np.arange(n), 2)
        for j in range(n):
            a, b, half = bodies[j]
            near = np.flatnonzero(pd._point_seg_dist(pts, a, b) <= half + link)
            for k in near:
                i = int(owner[k])
                if i != j and (i >= n_s or j >= n_s):  # only links that involve a pair matter here
                    parent[find(i)] = find(j)
        for k, p in enumerate(keep):  # pieces of one line, an opening apart, are one wall
            for k2 in range(k + 1, len(keep)):
                q = keep[k2]
                if q.axis == p.axis and abs(q.c - p.c) <= HOLLOW_LINE_PX and abs(q.d - p.d) <= HOLLOW_LINE_PX and max(q.lo - p.hi, p.lo - q.hi) <= reach:
                    parent[find(n_s + k)] = find(n_s + k2)
    has_solid = {find(i) for i in range(n_s)}
    axes: dict[int, set[str]] = {}
    for k, p in enumerate(keep):
        axes.setdefault(find(n_s + k), set()).add(p.axis)
    # a group of pairs linked to no solid wall but turning (a hollow outline alone) must lie inside the solid walls' box
    # when there are solid walls (grown as plan_detect.drop_reference_strokes does): a sheet border drawn double is not
    # a building
    box_lo = box_hi = None
    if segs:
        sp = np.array([p for g in segs for p in (g.a, g.b)])
        grow = max(2.0 * t_med, pd.REF_MARGIN_M / s)
        box_lo, box_hi = sp.min(axis=0) - grow, sp.max(axis=0) + grow

    def inside_box(p: Pair) -> bool:
        return box_lo is None or all(bool(np.all(box_lo <= e) and np.all(e <= box_hi)) for e in (_pt(p.axis, p.lo, p.c), _pt(p.axis, p.hi, p.c)))

    kept_pairs = [p for k, p in enumerate(keep) if find(n_s + k) in has_solid or (len(axes[find(n_s + k)]) == 2 and inside_box(p))]
    rules["structure"] = len(kept_pairs)
    stats["rules"] = rules
    # absorb the solid pieces mostly inside a kept pair's band (the closing fused part of the pair); a solid piece on
    # the pair's line that is mostly outside it stays, and the pair is cut around it (the solid pass's wall, its gaps
    # and openings stay as they were)
    absorbed: set[int] = set()
    on_line: list[list[tuple[int, float]]] = []
    for p in kept_pairs:
        near: list[tuple[int, float]] = []
        for i, fh, fv in solid_frames:
            f = fh if p.axis == "h" else fv
            if f is None or i in absorbed:
                continue
            g = segs[i]
            c, lo, hi = f
            if abs(c - p.c) > p.w / 2 + 1 or g.thick > p.w + 2:
                continue
            inside = min(hi, p.hi + p.w) - max(lo, p.lo - p.w)
            if inside >= 0.5 * max(hi - lo, 1.0):
                absorbed.add(i)
                p.lo = min(p.lo, int(math.floor(lo - g.thick / 2)))
                p.hi = max(p.hi, int(math.ceil(hi + g.thick / 2)))
            elif inside > 0:
                near.append((i, inside))
        on_line.append(near)
    cut: list[Pair] = []
    for p, near in zip(kept_pairs, on_line):
        spans = []
        for i, _inside in near:
            if i in absorbed:
                continue
            g = segs[i]
            _c, lo, hi = _frame_of(p.axis, g)  # type: ignore[misc]
            spans.append((lo - g.thick / 2 - p.w / 2, hi + g.thick / 2 + p.w / 2))
        pieces = [(p.lo, p.hi)]
        for s0, s1 in spans:
            pieces = [x for lo_, hi_ in pieces for x in ((lo_, min(hi_, int(math.floor(s0)))), (max(lo_, int(math.ceil(s1))), hi_)) if x[1] - x[0] + 1 >= run_px]
        for lo_, hi_ in pieces:
            q = Pair(p.axis, p.a, p.b, lo_, hi_, p.blank)
            cut.append(q)
    kept_pairs = cut
    # the hollow segments: ends pulled in by half the thickness, or onto a perpendicular wall's centre line
    others = [(g, _frame_of("h", g), _frame_of("v", g)) for i, g in enumerate(segs) if i not in absorbed]
    out: list[pd.Seg] = []
    for p in kept_pairs:
        tol_px = max(HOLLOW_SPACING_TOL_PX, HOLLOW_SPACING_TOL * mode)
        q_len = min(1.0, p.length * s / 3.0)
        q_blank = 1.0 - p.blank / HOLLOW_BLANK_MAX
        q_sp = max(0.0, 1.0 - abs(p.d - mode) / tol_px)
        p.q = round(min(HOLLOW_CONF_MAX, 0.35 + 0.25 * q_len + 0.2 * q_blank + 0.2 * q_sp), 3)
        lo, hi = p.lo + p.w / 2, p.hi - p.w / 2
        cross = "v" if p.axis == "h" else "h"
        perp = [(q.c, q.lo - q.w / 2, q.hi + q.w / 2, q.w) for q in kept_pairs if q.axis == cross]
        for g, fh, fv in others:
            f = fv if p.axis == "h" else fh
            if f is not None:
                perp.append((f[0], f[1] - g.thick / 2, f[2] + g.thick / 2, g.thick))
        for c, plo, phi, pw in perp:
            if not (plo - p.w / 2 <= p.c <= phi + p.w / 2):
                continue
            if abs(c - p.lo) <= pw / 2 + p.w / 2 + link and c < lo:
                lo = c
            if abs(c - p.hi) <= pw / 2 + p.w / 2 + link and c > hi:
                hi = c
        if hi - lo < 1.0:
            continue
        g = pd.Seg(_pt(p.axis, lo, p.c), _pt(p.axis, hi, p.c), [p.w] * max(3, int((hi - lo) // 4)), axis=True, net=True)
        g.hollow = p.q
        out.append(g)
    stats["walls"] = len(out)
    stats["absorbed"] = len(absorbed)
    return [g for i, g in enumerate(segs) if i not in absorbed], out, stats
