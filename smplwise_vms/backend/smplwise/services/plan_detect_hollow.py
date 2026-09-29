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
   classifies the gap (a window's lines along it, a door's arc). An interior at least five rows wide whose middle rows
   are filled grey (median HOLLOW_FILL_GREY below the paper's) is a filled wall, not hollow.
3. Not a stack: no third stroke continues the rhythm - a parallel stroke beyond either line at HOLLOW_STACK times the
   spacing, along at least HOLLOW_STACK_OVERLAP of the stretch (stair treads, tribune rows, rows of dashes).
4. Spacing: the plan's own hollow-wall spacing is learnt as the length-weighted mode of the stretches left after 1-3
   (half-pixel bins); a stretch is kept within HOLLOW_SPACING_TOL of it (or HOLLOW_SPACING_TOL_PX).
5. Not a tribune: beyond either line, no regular stack of rows (plan_detect's tribune rule, _steps_side: STEPS_MIN_ROWS
   lines STEPS_SPACING_M apart, read on the soft ink) - the double line of a railing at a tribune's edge is no wall.
6. A truly solid piece on the stretch's line (its middle reads interior ink across the centre line and a pixel either
   side on at least HOLLOW_SOLID_CENTRE of its length, as thick as the pair within HOLLOW_SOLID_RATIO) touching it:
   touched at both ends over at most WINDOW_RANGE_M[1], the stretch is the face lines of an opening in that wall and is
   dropped; otherwise the stretch is cut around the piece (a wall drawn filled over part of its length and as an
   outline over the rest keeps its outline part).
7. Length: a hollow wall runs at least HOLLOW_MIN_M; a shorter stretch is kept only when it continues a kept one on
   the same line (centre and spacing within HOLLOW_LINE_PX) within plan_detect.WINDOW_RANGE_M[1].
8. Structure: a stretch is kept only when it belongs to the building - linked end-to-body (an end within the other's
   half thickness plus max(3 px, t_med)), or along its line within WINDOW_RANGE_M[1], through other stretches to a
   solid wall; or, with no solid wall in its group, when the group has stretches in both axes and lies inside the
   solid walls' box grown as drop_reference_strokes grows it. A lone pair (two dimension lines, a double title rule,
   a double sheet border) is not a wall.
9. The plan-level gate (_gate): the hollow walls are emitted only when they are this plan's envelope - the ones with
   no solid wall (at least HOLLOW_GATE_SOLID of t_med thick) running parallel just beyond them (within
   HOLLOW_GATE_OUTSIDE_M towards the box's nearer edge, along half their length) add up to HOLLOW_GATE_SHARE of the
   perimeter of the building's box, and turn a corner (one group linked through the walls, ends within
   HOLLOW_GATE_CORNER_M of a body, holds them in both axes). On a solid-wall plan the thin double lines are counters,
   wardrobes and shelves along the walls: nothing is emitted and stats say "no_envelope".

Two solid walls 0.75 m apart with walls crossing between them (the T-junction fixture) fail rule 1 (their strokes are
as thick as the median wall) and rule 2 (0.8 m centre to centre is above HOLLOW_SPACING_M).

A kept stretch becomes one wall on its middle line, as thick as the pair (outer face to outer face), flagged hollow:
its ends are the drawn ends pulled in by half its thickness (the solid pass's skeleton convention, so the gap between
two pieces is the drawn opening), or moved onto the centre line of a perpendicular wall it meets (a corner, a T). A
solid piece that only reads the outline (its centre line interior ink on at most HOLLOW_FUSED_CENTRE: the closing
fused the pair into a band), lies in the stretch's band, is no thicker than it and is at least half inside it is
absorbed into it (a window the solid pass finds on it is carried over to the hollow wall: carry_windows); any other
solid piece on its line stays as the solid pass left it, with its openings, and the stretch is cut around it. Kind: exterior. Confidence: at
most HOLLOW_CONF_MAX, from length, blankness and agreement with the learnt spacing.

Known limits: axis-parallel only; one spacing per plan (the mode); a double line with a light grey fill and an interior
under five rows reads hollow; a hollow wall made of two hairline pairs (a cladding pair and an inner line) is read at
its hairline pair.

Cost: run-length passes over the dark mask in both axes, a union of runs, partner and stack lookups by sorted centre;
0.3-1.4 s at 1600 px on the owner's scans, about 1 s for 1440 strokes of dashed rows. More than HOLLOW_MAX_STROKES
strokes skip the pass (stats "too_many_strokes"). The run's deadline is checked between the stages and every 256
strokes. The detect request's `hollow_walls: false` switches the pass off."""
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
HOLLOW_FUSED_CENTRE = 0.2  # a solid piece is absorbed only when its centre line is interior ink on at most this share
HOLLOW_FILL_GREY = 20  # an interior whose middle rows are this much darker than the paper (median) is a grey fill
HOLLOW_GATE_SHARE = 0.25  # the hollow walls add up to at least this share of the building box's perimeter
HOLLOW_GATE_SOLID = 0.8  # ... not counting a hollow wall with a solid wall this share of t_med thick just beyond it ...
HOLLOW_GATE_OUTSIDE_M = 1.0  # ... within this distance (towards the box's nearer edge)
HOLLOW_GATE_CORNER_M = 1.5  # ... and turn a corner: ends linked within this distance for the gate
HOLLOW_MAX_STROKES = 1500  # more strokes than this (both axes): the pass is skipped (rows of dashes, dense text)


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


class _Frame:
    """The strokes of one axis frame sorted by their centre, with numpy views for the range lookups."""

    def __init__(self, strokes: list[Stroke]) -> None:
        self.strokes = sorted(strokes, key=lambda st: st.c)
        self.c = np.array([st.c for st in self.strokes], dtype=np.float64)
        self.lo = np.array([st.lo for st in self.strokes], dtype=np.int64)
        self.hi = np.array([st.hi for st in self.strokes], dtype=np.int64)

    def between(self, c0: float, c1: float) -> tuple[int, int]:
        """The index range of the strokes whose centre lies in [c0, c1]."""
        return int(np.searchsorted(self.c, c0, "left")), int(np.searchsorted(self.c, c1, "right"))


def _pairs(axis: str, fr: _Frame, ink: np.ndarray, gray: np.ndarray, paper: float, sp_lo: float, sp_hi: float, run_px: int, check: Callable[[], None]) -> list[Pair]:
    """Every pair of rules 1-2 in one axis frame (`ink` / `gray` in that frame: rows along the axis): one per blank
    stretch of the two strokes' overlap (a window symbol, a crossing wall or hatching between the lines ends a
    stretch). The partners of a stroke are looked up by centre (a sorted range) and filtered by overlap at once, so
    rows of dashes or text cost a range lookup each, not a pass over every stroke. An interior at least five rows wide
    whose middle rows (the row next to each stroke left out: blur) are filled grey (median below the paper's median
    grey by HOLLOW_FILL_GREY) is a filled wall, not hollow; a narrower interior cannot tell blur from a fill."""
    out: list[Pair] = []
    for i, a in enumerate(fr.strokes):
        if i % 256 == 0:
            check()
        j0, j1 = fr.between(a.c + sp_lo, a.c + sp_hi)
        j0 = max(j0, i + 1)
        if j0 >= j1:
            continue
        lo = np.maximum(fr.lo[j0:j1], a.lo)
        hi = np.minimum(fr.hi[j0:j1], a.hi)
        for k in np.flatnonzero(hi - lo + 1 >= run_px).tolist():
            b = fr.strokes[j0 + k]
            r0 = int(round(a.c + (a.t - 1) / 2)) + 1
            r1 = int(round(b.c - (b.t - 1) / 2)) - 1
            if r1 < r0:
                continue
            l0, h0 = int(lo[k]), int(hi[k])
            if _stacked(Pair(axis, a, b, l0, h0, 0.0), fr):  # rows of dashes, treads: stacked over the whole overlap
                continue
            for x0, x1, share in _blank_stretches(ink[r0 : r1 + 1, l0 : h0 + 1], run_px):
                if r1 - r0 >= 4 and float(np.median(gray[r0 + 1 : r1, l0 + x0 : l0 + x1 + 1])) < paper - HOLLOW_FILL_GREY:
                    continue
                out.append(Pair(axis, a, b, l0 + x0, l0 + x1, share))
    return out


def _core_grey(axis: str, st: Stroke, gray: np.ndarray) -> float:
    """The stroke's core: the median over (up to 32 of) its columns of the darkest grey across it."""
    r0 = max(0, int(round(st.c - st.t / 2)))
    r1 = min(gray.shape[0], int(round(st.c + st.t / 2)) + 1)
    cols = np.unique(np.linspace(st.lo, st.hi, 32).round().astype(int))
    return float(np.median(gray[r0:r1, cols].min(axis=0)))


def _stacked(p: Pair, fr: _Frame) -> bool:
    """Rule 3: a third stroke beyond either line at HOLLOW_STACK spacings, along HOLLOW_STACK_OVERLAP of the pair."""
    for c0, c1 in ((p.a.c - HOLLOW_STACK[1] * p.d, p.a.c - HOLLOW_STACK[0] * p.d), (p.b.c + HOLLOW_STACK[0] * p.d, p.b.c + HOLLOW_STACK[1] * p.d)):
        j0, j1 = fr.between(c0, c1)
        if j0 < j1 and bool(np.any(np.minimum(fr.hi[j0:j1], p.hi) - np.maximum(fr.lo[j0:j1], p.lo) + 1 >= HOLLOW_STACK_OVERLAP * p.length)):
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


def _centre_dark(g: pd.Seg, ink: np.ndarray) -> float:
    """The share of 32 points along the solid piece's middle (5-95 %) where the ink covers the centre line and a pixel
    either side: a solid band reads about 1, two hairlines the closing fused into a band read low wherever the blank
    row between them passes within a pixel of the piece's centre line."""
    h, w = ink.shape
    along = np.linspace(0.05, 0.95, 32)
    nl = np.array([g.dir[1], -g.dir[0]])
    base = g.a + np.outer(along, g.b - g.a)
    hit = np.ones(len(along), dtype=bool)
    for off in (-1.0, 0.0, 1.0):
        pts = base + nl * off
        hit &= ink[np.clip(np.round(pts[:, 1]).astype(int), 0, h - 1), np.clip(np.round(pts[:, 0]).astype(int), 0, w - 1)]
    return float(hit.mean())


def _pt(axis: str, along: float, across: float) -> np.ndarray:
    return np.array([along, across]) if axis == "h" else np.array([across, along])


def _cut(p: Pair, spans: list[tuple[float, float]], run_px: int) -> list[Pair]:
    """The pieces of p outside the given spans along it, each at least run_px long."""
    pieces = [(p.lo, p.hi)]
    for s0, s1 in spans:
        pieces = [x for lo_, hi_ in pieces for x in ((lo_, min(hi_, int(math.floor(s0)))), (max(lo_, int(math.ceil(s1))), hi_)) if x[1] - x[0] + 1 >= run_px]
    return [Pair(p.axis, p.a, p.b, lo_, hi_, p.blank) for lo_, hi_ in pieces]


class _UF:
    """Union-find over n items."""

    def __init__(self, n: int) -> None:
        self.parent = list(range(n))

    def find(self, i: int) -> int:
        while self.parent[i] != i:
            self.parent[i] = self.parent[self.parent[i]]
            i = self.parent[i]
        return i

    def union(self, i: int, j: int) -> None:
        self.parent[self.find(i)] = self.find(j)


def _link_groups(bodies: list[tuple[np.ndarray, np.ndarray, float]], ends: list[list[np.ndarray]], link: float, only: Callable[[int, int], bool]) -> _UF:
    """Union-find over end-to-body links (an end within the other's half thickness plus link) allowed by only."""
    n = len(bodies)
    uf = _UF(n)
    if n > 1:
        pts = np.array([e for es in ends for e in es])
        owner = np.repeat(np.arange(n), 2)
        for j in range(n):
            a, b, half = bodies[j]
            for k in np.flatnonzero(pd._point_seg_dist(pts, a, b) <= half + link).tolist():
                i = int(owner[k])
                if i != j and only(i, j):
                    uf.union(i, j)
    return uf


def find_hollow(segs: list[pd.Seg], an: dict[str, Any], s: float, t_med: float, check: Callable[[], None] = lambda: None) -> tuple[list[pd.Seg], list[pd.Seg], dict[str, Any]]:
    """The hollow walls of the picture (see the module docstring). `segs` are the solid pass's segments, `an` the
    masks of plan_detect._analysis (it needs "dark", "gray" and "ink_d"), `s` metres per analysis pixel. Returns (the solid segments left - those absorbed into a hollow wall removed -, the hollow segments with
    Seg.hollow = their confidence, stats). stats["skipped"] = "too_many_strokes" or stats["gate"] = "no_envelope"
    when the pass gives nothing on purpose."""
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
    if stats["strokes"] > HOLLOW_MAX_STROKES:
        stats["skipped"] = "too_many_strokes"
        return segs, [], stats
    fr = {axis: _Frame(strokes[axis]) for axis in frames}
    # the interior is blank when nothing in it is as dark as the strokes: ink there is what is at least half way from
    # the threshold to the strokes' typical core grey (a light scan's blur between two hairlines is not ink)
    gray = an["gray"]
    every = [(axis, st) for axis in frames for st in strokes[axis]]
    cores = [_core_grey(axis, st, gray if axis == "h" else gray.T) for axis, st in every[:: max(1, len(every) // 200)]]
    core = float(np.median(cores)) if cores else 0.0
    stats["core_grey"] = round(core, 1)
    blank_ink = gray <= (core + an["threshold"]) / 2
    paper = float(np.median(gray))
    cands: list[Pair] = []
    for axis in frames:
        m, g_ = (blank_ink, gray) if axis == "h" else (blank_ink.T, gray.T)
        for k, p in enumerate(_pairs(axis, fr[axis], m, g_, paper, max(sp_lo, 3.0), sp_hi, run_px, check)):
            if k % 256 == 0:
                check()
            if not _stacked(p, fr[axis]):
                cands.append(p)
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
    reach = pd.WINDOW_RANGE_M[1] / s
    # rule 6: a truly solid piece on the pair's line (as thick as the pair) that touches it. Touching it at both ends
    # over at most an opening's length, the pair is the face lines of an opening of that wall: dropped; else the pair
    # is cut around the piece (a wall drawn filled over part of its length and as an outline over the rest)
    solid_frames = [(i, _frame_of("h", g), _frame_of("v", g)) for i, g in enumerate(segs)]
    truly: dict[int, float] = {}

    def centre_of(i: int) -> float:
        if i not in truly:
            truly[i] = _centre_dark(segs[i], blank_ink)
        return truly[i]

    kept: list[Pair] = []
    for p in cands:
        spans: list[tuple[float, float]] = []
        at_lo = at_hi = False
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
            if centre_of(i) < HOLLOW_SOLID_CENTRE:
                continue
            at_lo = at_lo or lo <= p.lo
            at_hi = at_hi or hi >= p.hi
            spans.append((lo - g.thick / 2 - p.w / 2, hi + g.thick / 2 + p.w / 2))
        if not spans:
            kept.append(p)
        elif not (at_lo and at_hi and p.length <= reach):
            kept += _cut(p, spans, run_px)
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

    def same_line(p: Pair, q: Pair) -> bool:
        return q.axis == p.axis and abs(q.c - p.c) <= HOLLOW_LINE_PX and abs(q.d - p.d) <= HOLLOW_LINE_PX and max(q.lo - p.hi, p.lo - q.hi) <= reach

    keep = [p for p in unique if p.length >= long_px]
    rest = [p for p in unique if p.length < long_px]
    grown = True
    while grown and rest:
        grown = False
        for p in list(rest):
            if any(same_line(p, q) for q in keep):
                keep.append(p)
                rest.remove(p)
                grown = True
    rules["length"] = len(keep)
    check()
    # rule 8: linked to the building
    n_s = len(segs)
    link = max(3.0, t_med)
    bodies = [(g.a, g.b, g.thick / 2) for g in segs] + [(_pt(p.axis, p.lo - p.w / 2, p.c), _pt(p.axis, p.hi + p.w / 2, p.c), p.w / 2) for p in keep]
    ends = [[g.a, g.b] for g in segs] + [[_pt(p.axis, p.lo, p.c), _pt(p.axis, p.hi, p.c)] for p in keep]
    uf = _link_groups(bodies, ends, link, lambda i, j: i >= n_s or j >= n_s)
    for k, p in enumerate(keep):  # pieces of one line, an opening apart, are one wall
        for k2 in range(k + 1, len(keep)):
            if same_line(p, keep[k2]):
                uf.union(n_s + k, n_s + k2)
    find = uf.find
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
    # absorb the outline-only solid pieces mostly inside a kept pair's band (the closing fused part of the pair into a
    # band: its centre line is blank, at most HOLLOW_FUSED_CENTRE interior ink; plan_detect carries a window found on it
    # over to the hollow wall, carry_windows); any other solid piece on the pair's line stays as the solid pass left
    # it, and the pair is cut around it (the solid wall, its gaps and openings stay as they were)
    absorbed: set[int] = set()
    on_line: list[list[int]] = []
    for p in kept_pairs:
        near: list[int] = []
        for i, fh, fv in solid_frames:
            f = fh if p.axis == "h" else fv
            if f is None or i in absorbed:
                continue
            g = segs[i]
            c, lo, hi = f
            if abs(c - p.c) > p.w / 2 + 1 or g.thick > p.w + 2:
                continue
            inside = min(hi, p.hi + p.w) - max(lo, p.lo - p.w)
            if inside <= 0:
                continue
            fused = centre_of(i) <= HOLLOW_FUSED_CENTRE
            if fused and inside >= 0.5 * max(hi - lo, 1.0):
                absorbed.add(i)
                p.lo = min(p.lo, int(math.floor(lo - g.thick / 2)))
                p.hi = max(p.hi, int(math.ceil(hi + g.thick / 2)))
            else:
                near.append(i)
        on_line.append(near)
    cut: list[Pair] = []
    for p, near in zip(kept_pairs, on_line):
        spans = []
        for i in near:
            if i in absorbed:
                continue
            g = segs[i]
            _c, lo, hi = _frame_of(p.axis, g)  # type: ignore[misc]
            spans.append((lo - g.thick / 2 - p.w / 2, hi + g.thick / 2 + p.w / 2))
        cut += _cut(p, spans, run_px)
    kept_pairs = cut
    check()
    # the hollow segments: ends pulled in by half the thickness, or onto a perpendicular wall's centre line
    others = [(g, _frame_of("h", g), _frame_of("v", g)) for i, g in enumerate(segs) if i not in absorbed]
    out: list[pd.Seg] = []
    out_axis: list[str] = []
    for p in kept_pairs:
        q_len = min(1.0, p.length * s / 3.0)
        q_blank = 1.0 - p.blank / HOLLOW_BLANK_MAX
        q_sp = max(0.0, 1.0 - abs(p.d - mode) / tol)
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
        out_axis.append(p.axis)
    if not out:
        return segs, [], stats
    if not _gate(segs, out, out_axis, link, t_med, s, stats):
        stats["gate"] = "no_envelope"
        return segs, [], stats
    stats["walls"] = len(out)
    stats["absorbed"] = len(absorbed)
    return [g for i, g in enumerate(segs) if i not in absorbed], out, stats


def _gate(segs: list[pd.Seg], out: list[pd.Seg], out_axis: list[str], link: float, t_med: float, s: float, stats: dict[str, Any]) -> bool:
    """The plan-level gate: the hollow walls are this plan's envelope only when
    - the hollow walls on the outside add up to HOLLOW_GATE_SHARE of the perimeter of the building's box (the solid and
      hollow walls'): a hollow wall with a solid wall (at least HOLLOW_GATE_SOLID of t_med thick) running parallel beyond
      it - towards the box's nearer edge, within HOLLOW_GATE_OUTSIDE_M, along half its length - is inside the building
      (a counter or a wardrobe along a wall) and does not count;
    - and those outside hollow walls turn a corner of the building: one group linked end-to-body through the walls
      (solid and hollow; an end within HOLLOW_GATE_CORNER_M of the other's body, a corner box between them) holds them
      in both axes.
    On a solid-wall plan the thin double lines are furniture along the walls: nothing is emitted. Writes
    stats["envelope_share"]."""
    pts = np.array([p for g in list(segs) + out for p in (g.a, g.b)])
    box_lo, box_hi = pts.min(axis=0), pts.max(axis=0)
    perimeter = 2.0 * float(np.sum(box_hi - box_lo))
    reach = HOLLOW_GATE_OUTSIDE_M / s
    frames = [(g, _frame_of("h", g), _frame_of("v", g)) for g in segs if g.thick >= HOLLOW_GATE_SOLID * t_med]
    outer: list[bool] = []
    for g, ax in zip(out, out_axis):
        k = 1 if ax == "h" else 0  # the coordinate across the wall
        c = float(g.a[k])
        lo, hi = float(min(g.a[1 - k], g.b[1 - k])), float(max(g.a[1 - k], g.b[1 - k]))
        side = -1.0 if c - box_lo[k] < box_hi[k] - c else 1.0
        inside = False
        for _o, fh, fv in frames:
            f = fh if ax == "h" else fv
            if f is None:
                continue
            beyond = (f[0] - c) * side
            if g.thick / 2 < beyond <= g.thick / 2 + reach and min(hi, f[2]) - max(lo, f[1]) >= 0.5 * (hi - lo):
                inside = True
                break
        outer.append(not inside)
    total = sum(g.length + g.thick for g, o in zip(out, outer) if o)
    stats["envelope_share"] = round(total / perimeter, 3) if perimeter else 0.0
    n_s = len(segs)
    corner = max(link, HOLLOW_GATE_CORNER_M / s)  # a building's corner drawn as a small box leaves a hollow wall short of it
    uf = _link_groups([(g.a, g.b, g.thick / 2) for g in list(segs) + out], [[g.a, g.b] for g in list(segs) + out], corner, lambda i, j: True)
    turn: dict[int, set[str]] = {}
    for k, (ax, o) in enumerate(zip(out_axis, outer)):
        if o:
            turn.setdefault(uf.find(n_s + k), set()).add(ax)
    return total >= HOLLOW_GATE_SHARE * perimeter and any(len(v) == 2 for v in turn.values())


def carry_windows(solid_walls: list[pd.Seg], solid_openings: list[dict[str, Any]], walls: list[pd.Seg], openings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The windows the solid pass alone finds (`solid_walls` / `solid_openings`: plan_detect.walls_from_gaps and
    windows_by_profile on the solid segments only) that now lie on a hollow wall of the answer (`walls` / `openings`):
    the pieces they sat on were absorbed into it, and a hollow wall's middle is blank, so the profile pass cannot find
    them there again. Each is carried over (same width and confidence) unless an opening of that wall already covers
    its centre. Returns the openings to add."""
    added: list[dict[str, Any]] = []
    for o in solid_openings:
        if o["kind"] != "window":
            continue
        sw = solid_walls[o["wall_seg"]]
        p = sw.a + (sw.b - sw.a) * o["t"]
        for wi, g in enumerate(walls):
            if not g.hollow or pd._angle_between(g.dir, sw.dir) > pd.AXIS_TOL_DEG:
                continue
            along, lat = g.project(p)
            if abs(lat) > g.thick / 2 + 2 or not 0 <= along <= g.length:
                continue
            t = along / max(g.length, 1e-9)
            if any(q["wall_seg"] == wi and abs(q["t"] - t) * g.length < (q["width_px"] + o["width_px"]) / 2 for q in openings + added):
                break
            added.append(dict(o, wall_seg=wi, t=t))
            break
    return added


def on_hollow_lines(solid: list[pd.Seg], hollow: list[pd.Seg]) -> list[pd.Seg]:
    """The solid segments lying on the line of a hollow wall (parallel, their middle within its band): the only ones
    whose windows carry_windows can move, so the solid-only re-run for it reads these alone."""
    out = []
    for g in solid:
        m = (g.a + g.b) / 2
        for h in hollow:
            if pd._angle_between(g.dir, h.dir) <= pd.AXIS_TOL_DEG and abs(h.project(m)[1]) <= h.thick / 2 + 2:
                out.append(g)
                break
    return out
