"""Object candidates of the Plan Studio detector (T086 tuning, detector 1.4; the 0.1.90 list items 4 and 6, measured on
the owner's real scans): what the wall pass used to misread as walls is proposed as a library object instead.

Steps regions (item 4, request option `steps_regions`): plan_detect.drop_steps_edges already drops the edge lines of a
tribune (a straight segment with at least STEPS_MIN_ROWS evenly spaced parallel lines 0.6-1.2 m apart on one side). Here
each dropped edge at least STEPS_MIN_WIDTH_M long is followed across its rows as far as they stay regular
(STEPS_MAX_ROWS at most); with STEPS_MIN_ROWS rows or more the region between the edge and its last row is one
`tribune.stepped` candidate (the library's tribune: rows along its width, stepping across its depth), regions found from
both edges of one tribune merged. Stair treads (closer than 0.6 m) never make a region - the edge rule refuses them.

Columns (item 6, request option `columns`): a pier drawn as a filled box (black, or a dark outline around a grey fill
with a hatch - floor -2 of the owner's sheets) is a blob of ink darker than the paper by COL_FILL_GREY that keeps a core
after an erosion by a square just under COL_MIN_M (lines, text, hatching and the walls running into it do not); the
core's box grown back is the column. A box COL_MIN_M to COL_MAX_M on each side, at most COL_ASPECT long for its width and
filled (COL_RAW_FILL), is a column when at least COL_MIN_ROW of them of about one size (COL_SIZE_RATIO) stand on one line
(centres within COL_LINE_TOL of their side) at a regular spacing (COL_SPACING_M, the widest at most COL_REGULAR times the
narrowest; ONE double spacing per run - a column the scan lost - is bridged, never the first) - a pier grid, never a
lone blob - and when it is not a wall with a window rhythm (windowed_wall: the wall or a window symbol continues from
both faces of its blobs across their whole thickness, review B1: a masonry facade's piers). The wall pieces that
lie wholly inside a column (the sides of its outline, which the wall pass suggested as stubs) are dropped. A row of
columns on the edge of the building's box (within max(COL_EDGE_M, a side) of it) is the envelope: the stretches between
neighbouring columns that walls cover less than COL_COVERED become wall candidates, centre to centre but only over the
parts no wall covers (review M3: a proposed facade wall never overlaps a wall), of the median wall's thickness and a
capped confidence (ENVELOPE_CONF) - the owner draws the facade between the piers as faint glazing below every threshold.
Known limit: axis-parallel lines and blobs only - a wing at an angle gets no tribune and no columns.

Numpy only; nothing here is stored: plan_detect turns the regions and columns into document-v2 object candidates."""
from __future__ import annotations

import math
from typing import Any, Callable

import numpy as np

from . import plan_detect as pd
from . import plan_stylize as ps

STEPS_MAX_ROWS = 60  # a region follows at most this many rows from its edge
STEPS_MIN_WIDTH_M = 3.0  # a tribune is at least this wide (its edge's length): the owner's sheets had a row of toilet
# stalls (1.1 m) and an entrance porch (2.5 m) whose parallel lines pass the edge rule ...
STEPS_MIN_ROWS = 4  # ... and has at least this many rows (five lines with its edge; the edge rule drops an edge from
# three rows): a corridor with three dashed lines beside a wall passed the edge rule on floor -1
STEPS_MERGE = 0.5  # two regions are one when the smaller has this share of its area inside the larger
STEPS_ITEM = "tribune.stepped"
STEP_HEIGHT_M = 0.3  # the library tribune's default riser (the scan has no heights)
COL_FILL_GREY = 20  # a column's fill is at least this much darker than the paper (the median grey)
COL_MIN_M, COL_MAX_M = 0.6, 1.6  # a column's sides. From 0.6 m: the erosion then clears a 0.5 m wall running into it,
# and the words and symbols of a 1:100 scan (filled blobs of 0.4-0.68 m, rows of them along a dimension chain, all
# proposed at 0.45 m on the owner's sheets) stay out - smaller columns are not proposed (known limit). The owner's piers
# measure 0.75-1.3 m, the pilasters beside the facade 0.8 x 2 m.
COL_ASPECT = 2.6
COL_SOLID = 0.7  # the eroded core fills this share of its bounding box ...
COL_RAW_FILL = 0.9  # ... and the fill this share of the column's box (a word's box is half white)
COL_MAX_RUNS = 200_000
COL_WALL_RATIO = 1.3  # a blob whose thickness across its row is within this of the ink continuing from its faces is a
# piece of that wall (a window pier), not a column (review B1)
COL_MIN_ROW = 3
COL_SIZE_RATIO = 1.4
COL_LINE_TOL = 0.35  # centres on one line within this share of the mean side
COL_SPACING_M = (2.0, 12.0)
COL_SIDE_T = (2.5, 10.0)  # uncalibrated: a column's side in median wall thicknesses (from 2.5: the opening then clears a
# thick exterior wall that runs into the column, as the calibrated 0.3 m does) ...
COL_SPACING_SIDES = (2.5, 20.0)  # ... and the spacing in column sides
COL_REGULAR = 1.3
COL_EDGE_M = 1.0
COL_COVERED = 0.5  # a stretch between two columns already this much covered by walls gets no envelope wall
COL_ITEM = "column.square"
COL_HEIGHT_M = 2.8  # the library column's default height
ENVELOPE_CONF = 0.55
COL_MAX_BLOBS = 400  # more square blobs than this (a hatched sheet): no columns (bounded cost)


# ---------------------------------------------------------------- steps regions

def _rows_from(g: pd.Seg, sign: float, ink: np.ndarray, s: float) -> list[float]:
    """The offsets (px, positive on `sign`'s side) of the regular rows beside g, from the first row on, as far as they
    stay regular: each gap within STEPS_SPACING_M and within STEPS_REGULAR of the first."""
    st_lo, st_hi = pd.STEPS_SPACING_M[0] / s, pd.STEPS_SPACING_M[1] / s
    lines = pd._lines_beside(g, ink, st_hi * (STEPS_MAX_ROWS + 0.5))[1:]
    side = sorted(c * sign for c, _, _ in lines if c * sign > 0)
    rows: list[float] = []
    prev, first = 0.0, None
    for c in side:
        gap = c - prev
        if not st_lo <= gap <= st_hi or (first is not None and max(gap, first) > pd.STEPS_REGULAR * min(gap, first)):
            break
        first = gap if first is None else first
        rows.append(c)
        prev = c
        if len(rows) >= STEPS_MAX_ROWS:
            break
    return rows


def steps_regions(edges: list[tuple[pd.Seg, float]], ink: np.ndarray, s: float) -> list[dict[str, Any]]:
    """Regions (analysis px) from the dropped steps edges: {"centre", "dir", "normal", "length", "depth", "rows",
    "spacing"}, `normal` the unit vector from the edge toward its rows (the object rises that way), the larger kept when
    two overlap (both edges of one tribune find the same region; of two equal ones the first edge found)."""
    regions: list[dict[str, Any]] = []
    for g, sign in edges:
        if g.length * s < STEPS_MIN_WIDTH_M:
            continue  # a row of toilet stalls or a short run of parallel lines: its edge is dropped, but it is no tribune
        rows = _rows_from(g, sign, ink, s)
        if len(rows) < STEPS_MIN_ROWS:
            continue
        nl = np.array([g.dir[1], -g.dir[0]]) * sign
        depth = rows[-1]
        centre = (g.a + g.b) / 2 + nl * depth / 2
        regions.append({"centre": centre, "dir": g.dir, "normal": nl, "length": g.length, "depth": depth, "rows": len(rows), "spacing": depth / len(rows)})
    regions.sort(key=lambda r: -r["length"] * r["depth"])
    kept: list[dict[str, Any]] = []
    for r in regions:
        if not any(_overlap_share(r, k) >= STEPS_MERGE for k in kept):
            kept.append(r)
    return kept


def _box(r: dict[str, Any]) -> tuple[float, float, float, float]:
    """The axis box of a region (an axis-parallel edge: its own box)."""
    horizontal = abs(r["dir"][0]) >= abs(r["dir"][1])
    w, h = (r["length"], r["depth"]) if horizontal else (r["depth"], r["length"])
    return r["centre"][0] - w / 2, r["centre"][1] - h / 2, r["centre"][0] + w / 2, r["centre"][1] + h / 2


def _overlap_share(a: dict[str, Any], b: dict[str, Any]) -> float:
    """The share of a's box that lies inside b's box."""
    ax0, ay0, ax1, ay1 = _box(a)
    bx0, by0, bx1, by1 = _box(b)
    ix = max(0.0, min(ax1, bx1) - max(ax0, bx0))
    iy = max(0.0, min(ay1, by1) - max(ay0, by0))
    area = max((ax1 - ax0) * (ay1 - ay0), 1e-9)
    return ix * iy / area


# ---------------------------------------------------------------- columns

def fill_mask(gray: np.ndarray) -> np.ndarray:
    """The ink a column is drawn with: COL_FILL_GREY darker than the paper (the median grey)."""
    return gray < float(np.median(gray)) - COL_FILL_GREY


def square_blobs(gray: np.ndarray, lo_px: float, hi_px: float, check: Callable[[], None] = lambda: None, fill: np.ndarray | None = None) -> list[dict[str, float]]:
    """The square filled blobs of the picture (analysis px) with sides lo_px..hi_px: {"cx", "cy", "w", "h"}; empty
    when there are more than COL_MAX_BLOBS of them, or when the eroded ink holds more than COL_MAX_RUNS row runs (a
    noisy or hatched sheet: bounded cost). `check` (the detector's deadline) runs between the stages."""
    if fill is None:
        fill = fill_mask(gray)
    # the cores: what is left of the fill after an erosion by a square just under lo_px - every wall thinner than that
    # (the walls running into a pier) is gone, a column keeps a core of its side less 2r; the column is its core's
    # box grown back by r
    r = max(1, int((lo_px - 1) // 2))
    core = ps.erode(fill, r)
    check()
    comps = _components(core)
    check()
    h_img, w_img = fill.shape
    out: list[dict[str, float]] = []
    for x0, y0, x1, y1, area in comps:  # inclusive core boxes
        if area < COL_SOLID * (x1 - x0 + 1) * (y1 - y0 + 1):
            continue
        bx0, by0, bx1, by1 = max(0, x0 - r), max(0, y0 - r), min(w_img - 1, x1 + r), min(h_img - 1, y1 + r)
        w, h = bx1 - bx0 + 1, by1 - by0 + 1
        if not (lo_px * 0.9 <= min(w, h) and max(w, h) <= hi_px and max(w, h) <= COL_ASPECT * min(w, h)):
            continue
        if float(fill[by0 : by1 + 1, bx0 : bx1 + 1].mean()) < COL_RAW_FILL:
            continue  # a word or a symbol: its box is not filled
        out.append({"cx": (bx0 + bx1) / 2, "cy": (by0 + by1) / 2, "w": float(w), "h": float(h)})
        if len(out) > COL_MAX_BLOBS:
            return []
    return out


def _components(mask: np.ndarray) -> list[tuple[int, int, int, int, int]]:
    """The 4-connected components of a mask as (x0, y0, x1, y1, area) with inclusive boxes: row runs joined by a
    union-find where they overlap the row above (fast on the sparse cores; label_regions converges slowly on long thin
    shapes). Empty when the mask has more than COL_MAX_RUNS runs (bounded cost)."""
    h, w = mask.shape
    pad = np.zeros((h, w + 2), dtype=np.int8)
    pad[:, 1:-1] = mask
    d = np.diff(pad, axis=1)
    ry, rx0 = np.nonzero(d == 1)
    _ey, rx1 = np.nonzero(d == -1)  # exclusive ends, in the same row-major order as the starts
    n = int(ry.size)
    if n == 0 or n > COL_MAX_RUNS:
        return []
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    ry_l, rx0_l, rx1_l = ry.tolist(), rx0.tolist(), rx1.tolist()
    prev_lo = prev_hi = 0  # the runs of the row above: indices prev_lo..prev_hi-1
    k = 0
    while k < n:
        y = ry_l[k]
        k2 = k
        while k2 < n and ry_l[k2] == y:
            k2 += 1
        if prev_hi > prev_lo and ry_l[prev_lo] == y - 1:
            j = prev_lo
            for i in range(k, k2):
                while j < prev_hi and rx1_l[j] <= rx0_l[i]:
                    j += 1
                jj = j
                while jj < prev_hi and rx0_l[jj] < rx1_l[i]:
                    parent[find(i)] = find(jj)
                    jj += 1
        prev_lo, prev_hi = k, k2
        k = k2
    roots = np.array([find(i) for i in range(n)])
    uniq, inv = np.unique(roots, return_inverse=True)
    x0 = np.full(uniq.size, 1 << 30)
    y0 = np.full(uniq.size, 1 << 30)
    x1 = np.full(uniq.size, -1)
    y1 = np.full(uniq.size, -1)
    np.minimum.at(x0, inv, rx0)
    np.minimum.at(y0, inv, ry)
    np.maximum.at(x1, inv, rx1 - 1)
    np.maximum.at(y1, inv, ry)
    area = np.bincount(inv, weights=(rx1 - rx0)).astype(int)
    return [(int(x0[c]), int(y0[c]), int(x1[c]), int(y1[c]), int(area[c])) for c in range(uniq.size)]


def _runs(blobs: list[dict[str, float]], lo: float, hi: float, axis: int) -> list[list[int]]:
    """Rows (axis 0: centres on one horizontal line, ordered by x) or columns (axis 1) of COL_MIN_ROW or more blobs of
    about one size at a regular spacing of lo..hi px."""
    other = 1 - axis
    key = ("cx", "cy")
    order = sorted(range(len(blobs)), key=lambda i: blobs[i][key[other]])
    lines: list[list[int]] = []
    for i in order:  # cluster by the cross coordinate
        side = (blobs[i]["w"] + blobs[i]["h"]) / 2
        if lines and abs(blobs[i][key[other]] - blobs[lines[-1][0]][key[other]]) <= COL_LINE_TOL * side:
            lines[-1].append(i)
        else:
            lines.append([i])
    def side(j: int) -> float:
        return (blobs[j]["w"] + blobs[j]["h"]) / 2

    def regular(run: list[int]) -> bool:
        """The spacings of `run` as multiples of the shortest: each one or two units (a column the scan lost leaves a
        double spacing - the row goes on across it, the lost column is not proposed), at most ONE double per run and
        never the first (two columns alone cannot tell a double from a unit), the unit lo..hi, the spacings regular
        (COL_REGULAR) and the columns of about one size (COL_SIZE_RATIO)."""
        pos = [blobs[j][key[axis]] for j in run]
        gaps = [b - a for a, b in zip(pos, pos[1:])]
        unit = min(gaps)
        if unit <= 0 or not lo <= unit <= hi:
            return False
        steps = [max(1, round(gp / unit)) for gp in gaps]
        if max(steps) > 2 or steps.count(2) > 1 or steps[0] != 1:
            return False
        norm = [gp / k for gp, k in zip(gaps, steps)]
        sides = [side(j) for j in run]
        return max(norm) <= COL_REGULAR * min(norm) and max(sides) <= COL_SIZE_RATIO * min(sides)

    runs: list[list[int]] = []
    for line in lines:
        line.sort(key=lambda i: blobs[i][key[axis]])
        run: list[int] = []
        for i in line:
            if not run or regular(run + [i]):
                run.append(i)
                continue
            if len(run) >= COL_MIN_ROW:
                runs.append(run)
            # the column that ended the run may start the next one with its predecessor
            run = [run[-1], i] if regular([run[-1], i]) else [i]
        if len(run) >= COL_MIN_ROW:
            runs.append(run)
    return runs


def find_columns(an: dict[str, Any], s: float, t_med: float, calibrated: bool, check: Callable[[], None] = lambda: None) -> tuple[list[dict[str, float]], list[tuple[int, list[int]]]]:
    """The columns (analysis px) and their runs as (axis, indices into the columns): axis 0 a horizontal row. On an
    uncalibrated plan the metres are the walls' guess (the median wall taken as 0.2 m), so the sizes are read against
    the median wall instead: a side of COL_SIDE_T wall thicknesses, a spacing of COL_SPACING_SIDES sides."""
    fill = fill_mask(an["gray"])
    if calibrated:
        blobs = square_blobs(an["gray"], COL_MIN_M / s, COL_MAX_M / s, check, fill)
        lo, hi = COL_SPACING_M[0] / s, COL_SPACING_M[1] / s
    else:
        blobs = square_blobs(an["gray"], COL_SIDE_T[0] * t_med, COL_SIDE_T[1] * t_med, check, fill)
        side = float(np.median([(b["w"] + b["h"]) / 2 for b in blobs])) if blobs else 0.0
        lo, hi = COL_SPACING_SIDES[0] * side, COL_SPACING_SIDES[1] * side
    check()
    # a row of window piers of a thick wall is no pier grid (review B1): its stubs stay walls, its windows are classified
    runs = [(axis, run) for axis in (0, 1) for run in _runs(blobs, lo, hi, axis) if not windowed_wall(blobs, run, axis, fill)]
    used = sorted({i for _, run in runs for i in run})
    remap = {old: new for new, old in enumerate(used)}
    return [blobs[i] for i in used], [(axis, [remap[i] for i in run]) for axis, run in runs]


def _continues(fill: np.ndarray, c: dict[str, float], axis: int, sign: float) -> bool:
    """Whether a wall continues from the face of column `c` on side `sign` along the row axis: just beyond the face (2,
    4 and 6 px) the ink across the row - a wall's fill, or the face and glass lines of a window symbol - spans at least
    the column's own thickness across the row over COL_WALL_RATIO. Faint glazing between piers (two hairlines well inside
    the pier's width) and a thinner wall running into the column span much less."""
    h, w = fill.shape
    cross = 1 - axis
    size = (c["w"], c["h"])
    centre = (c["cx"], c["cy"])
    across = size[cross]
    offs = np.arange(-0.75 * across, 0.75 * across + 1)
    best = 0.0
    for k in (2.0, 4.0, 6.0):
        at = centre[axis] + sign * (size[axis] / 2 + k)
        cs = np.round(centre[cross] + offs).astype(int)
        a = int(round(at))
        if not 0 <= a < (w if axis == 0 else h):
            continue
        ok = (cs >= 0) & (cs < (h if axis == 0 else w))
        vals = fill[cs[ok], a] if axis == 0 else fill[a, cs[ok]]
        idx = np.flatnonzero(vals)
        if idx.size:
            best = max(best, float(idx[-1] - idx[0] + 1))
    return across <= COL_WALL_RATIO * best


def windowed_wall(blobs: list[dict[str, float]], run: list[int], axis: int, fill: np.ndarray) -> bool:
    """Whether a run of blobs is the piers of a wall with a window rhythm (review B1), not a pier grid: at least half of
    its blobs have a wall (or a window symbol) continuing from each face that faces another blob of the run - the first
    and the last blob on their inner face only. A thick masonry facade (0.6 m piers between 1.5 m windows) passes the
    size and spacing tests of a pier grid; its piers are pieces of the wall, as thick across the row as the wall."""
    walled = 0
    for k, j in enumerate(run):
        sides = ([-1.0] if k > 0 else []) + ([1.0] if k < len(run) - 1 else [])
        if all(_continues(fill, blobs[j], axis, sg) for sg in sides):
            walled += 1
    return 2 * walled >= len(run)


def _inside(p: np.ndarray, c: dict[str, float], pad: float) -> bool:
    return abs(p[0] - c["cx"]) <= c["w"] / 2 + pad and abs(p[1] - c["cy"]) <= c["h"] / 2 + pad


def drop_column_stubs(segs: list[pd.Seg], columns: list[dict[str, float]]) -> tuple[list[pd.Seg], int]:
    """The wall pieces lying wholly inside a column (both ends within its box, grown by half the piece's thickness plus
    2 px): the sides of its outline. A wall that runs into or through a column keeps its outside end."""
    if not columns:
        return segs, 0
    kept = [g for g in segs if not any(_inside(g.a, c, g.thick / 2 + 2) and _inside(g.b, c, g.thick / 2 + 2) for c in columns)]
    return kept, len(segs) - len(kept)


def envelope_walls(columns: list[dict[str, float]], runs: list[tuple[int, list[int]]], walls: list[pd.Seg], t: float, s: float) -> list[pd.Seg]:
    """The envelope line between the columns of every run on the edge of the building's box (walls and columns, within
    max(COL_EDGE_M, the run's side) of it): the stretches between neighbouring columns that the walls cover less than
    COL_COVERED, joined while consecutive, one wall each, centre to centre, `t` thick. A run inside the building (a
    pier grid in a hall) gets none."""
    if not columns:
        return []
    pts = [p for g in walls for p in (g.a, g.b)] + [np.array([c["cx"] + dx * c["w"] / 2, c["cy"] + dy * c["h"] / 2]) for c in columns for dx, dy in ((-1, -1), (1, 1))]
    arr = np.array(pts)
    lo, hi = arr.min(axis=0), arr.max(axis=0)
    out: list[pd.Seg] = []
    for axis, run in runs:
        cs = [columns[i] for i in run]
        cross = 1 - axis
        side = float(np.mean([(c["w"] + c["h"]) / 2 for c in cs]))
        at = float(np.mean([(c["cx"], c["cy"])[cross] for c in cs]))
        edge = max(COL_EDGE_M / s, side)
        if not (abs(at - lo[cross]) <= edge or abs(at - hi[cross]) <= edge):
            continue
        stretch: list[tuple[float, float]] = []
        for c0, c1 in zip(cs, cs[1:]):
            a0, a1 = (c0["cx"], c0["cy"])[axis], (c1["cx"], c1["cy"])[axis]
            f0, f1 = a0 + (c0["w"], c0["h"])[axis] / 2, a1 - (c1["w"], c1["h"])[axis] / 2
            if _covered(walls, axis, at, f0, f1, side / 2) >= COL_COVERED:
                continue
            # only what no wall covers, centre to centre (review M3): a proposed facade wall never overlaps a wall
            for u0, u1 in _uncovered(walls, axis, at, a0, a1, side / 2):
                if u1 - u0 < max(2.0 * t, 1.0):
                    continue
                if stretch and abs(stretch[-1][1] - u0) < 1e-6:
                    stretch[-1] = (stretch[-1][0], u1)
                else:
                    stretch.append((u0, u1))
        for s0, s1 in stretch:
            a = np.array([s0, at]) if axis == 0 else np.array([at, s0])
            b = np.array([s1, at]) if axis == 0 else np.array([at, s1])
            out.append(pd.Seg(a, b, [t] * 5, axis=True))
    return out


def _cover_intervals(walls: list[pd.Seg], axis: int, at: float, f0: float, f1: float, tol: float) -> list[tuple[float, float]]:
    """The merged intervals of [f0, f1] on the line `at` (horizontal when axis is 0) that walls along it cover (each
    wall's drawn extent: its ends grown by half its thickness)."""
    cross = 1 - axis
    iv = []
    for g in walls:
        if abs(g.dir[axis]) < math.cos(math.radians(pd.AXIS_TOL_DEG)):
            continue
        if abs(g.a[cross] - at) > tol + g.thick / 2 or abs(g.b[cross] - at) > tol + g.thick / 2:
            continue
        lo, hi = sorted((float(g.a[axis]), float(g.b[axis])))
        lo, hi = lo - g.thick / 2, hi + g.thick / 2
        if hi > f0 and lo < f1:
            iv.append((max(lo, f0), min(hi, f1)))
    iv.sort()
    merged: list[tuple[float, float]] = []
    for lo, hi in iv:
        if merged and lo <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], hi))
        else:
            merged.append((lo, hi))
    return merged


def _covered(walls: list[pd.Seg], axis: int, at: float, f0: float, f1: float, tol: float) -> float:
    """The share of [f0, f1] on the line `at` that walls along it cover."""
    if f1 <= f0:
        return 1.0
    return sum(hi - lo for lo, hi in _cover_intervals(walls, axis, at, f0, f1, tol)) / (f1 - f0)


def _uncovered(walls: list[pd.Seg], axis: int, at: float, f0: float, f1: float, tol: float) -> list[tuple[float, float]]:
    """The sub-intervals of [f0, f1] on the line `at` that no wall along it covers."""
    out: list[tuple[float, float]] = []
    cur = f0
    for lo, hi in _cover_intervals(walls, axis, at, f0, f1, tol):
        if lo > cur:
            out.append((cur, lo))
        cur = max(cur, hi)
    if cur < f1:
        out.append((cur, f1))
    return out
