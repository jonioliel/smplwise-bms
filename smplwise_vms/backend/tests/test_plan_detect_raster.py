"""Plan Studio detection primitives (T086, design 9.1): the chamfer distance transform equals a brute-force relaxation,
thinning turns a thick bar into one connected pixel-wide line and keeps a ring closed, a tilted bar thins to one line
without junction pixels, a two-pixel diagonal survives, thinning is idempotent and fast on filled areas, and tracing
splits a skeleton at its junctions into branches with the right end points."""
from __future__ import annotations

import time

import numpy as np
import pytest

from smplwise.services import plan_detect as pd


def _brute_chamfer(mask: np.ndarray) -> np.ndarray:
    pad = np.pad(mask, 1)
    h, w = pad.shape
    ref = np.where(pad, 10**8, 0)
    changed = True
    while changed:
        changed = False
        for y in range(h):
            for x in range(w):
                if not pad[y, x]:
                    continue
                best = ref[y, x]
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if (dy or dx) and 0 <= y + dy < h and 0 <= x + dx < w:
                            best = min(best, ref[y + dy, x + dx] + (4 if dy and dx else 3))
                if best < ref[y, x]:
                    ref[y, x] = best
                    changed = True
    return ref[1:-1, 1:-1] / 3.0


def test_chamfer_matches_brute_force_and_treats_the_border_as_background():
    rng = np.random.RandomState(3)
    mask = rng.rand(24, 31) < 0.7
    d = pd.chamfer_dt(mask)
    assert d.dtype == np.float32 and d.shape == mask.shape
    assert np.allclose(d, _brute_chamfer(mask)) and float(d[~mask].max()) == 0.0
    bar = np.zeros((9, 40), dtype=bool)
    bar[:, 5:35] = True  # touches the top and bottom edges: the centre row is 5 rows from the nearest border
    assert float(pd.chamfer_dt(bar)[4, 20]) == 5.0 and float(pd.chamfer_dt(bar)[0, 20]) == 1.0


def test_thinning_gives_a_one_pixel_connected_skeleton():
    bar = np.zeros((40, 120), dtype=bool)
    bar[14:27, 10:110] = True
    sk = pd.thin(bar)
    nb = pd.neighbour_count(sk)
    assert int(sk.sum()) >= 85 and int(nb.max()) == 2 and len(set(np.nonzero(sk)[0].tolist())) == 1, "a horizontal bar thins to one row"
    assert int(nb[sk].min()) == 1 and int((nb == 1).sum()) == 2, "exactly two end points"
    ring = np.zeros((60, 60), dtype=bool)
    ring[10:50, 10:50] = True
    ring[18:42, 18:42] = False
    sk = pd.thin(ring)
    assert int(sk.sum()) > 100 and int(pd.neighbour_count(sk)[sk].min()) >= 2, "a ring stays closed (no end points)"
    assert not pd.thin(np.zeros((5, 5), dtype=bool)).any()


def test_tracing_splits_at_junctions_and_keeps_loops():
    t = np.zeros((60, 60), dtype=bool)
    t[10:50, 28:32] = True
    t[28:32, 10:50] = True
    branches = pd.trace_branches(pd.thin(t))
    long = [b for b in branches if len(b) >= 10]
    assert len(long) == 4, "a plus sign has four arms (the two-pixel stubs are the junction cluster)"
    ends = {b[-1] for b in long} | {b[0] for b in long}
    assert any(abs(x - 29) <= 2 and y <= 12 for x, y in ends) and any(abs(y - 29) <= 2 and x >= 47 for x, y in ends)
    # a thinned ring has no junction pixels (the stair pass removes the corner steps): one closed branch covers it
    ring = np.zeros((40, 40), dtype=bool)
    ring[5:35, 5:35] = True
    ring[12:28, 12:28] = False
    sk = pd.thin(ring)
    branches = pd.trace_branches(sk)
    assert int(pd.neighbour_count(sk).max()) == 2 and len(branches) == 1 and branches[0][0] == branches[0][-1]
    assert {p for b in branches for p in b} == {(int(x), int(y)) for y, x in zip(*np.nonzero(sk))}
    # a loop without any node (a diamond: every pixel has exactly two 8-neighbours) is one closed branch
    dia = np.zeros((16, 16), dtype=bool)
    for k in range(6):
        for x, y in ((7 + k, 2 + k), (7 - k, 2 + k), (7 + k, 12 - k), (7 - k, 12 - k)):
            dia[y, x] = True
    loops = pd.trace_branches(dia)
    assert len(loops) == 1 and loops[0][0] == loops[0][-1] and len(loops[0]) == int(dia.sum()) + 1
    assert pd.trace_branches(np.zeros((8, 8), dtype=bool)) == []


def _bar(angle_deg: float, half: float, n: int = 300) -> np.ndarray:
    yy, xx = np.mgrid[0:n, 0:n]
    t = np.deg2rad(angle_deg)
    c = n / 2
    dist = np.abs(-np.sin(t) * (xx - c) + np.cos(t) * (yy - c))
    along = np.abs(np.cos(t) * (xx - c) + np.sin(t) * (yy - c))
    return (dist <= half) & (along <= n * 0.4)


def _shapes() -> list[np.ndarray]:
    plus = np.zeros((60, 60), dtype=bool)
    plus[10:50, 28:32] = True
    plus[28:32, 10:50] = True
    ell = np.zeros((80, 80), dtype=bool)
    ell[10:20, 10:70] = True
    ell[10:70, 10:20] = True
    rng = np.random.RandomState(5)
    return [plus, ell, rng.rand(60, 70) < 0.6] + [_bar(a, h) for a in (20, 30, 45, 60) for h in (2.5, 5)]


@pytest.mark.parametrize("angle", [20, 30, 60])
@pytest.mark.parametrize("half", [2.5, 5.0])
def test_a_tilted_bar_thins_to_one_line_without_junctions(angle, half):
    sk = pd.thin(_bar(angle, half))
    nb = pd.neighbour_count(sk)
    assert int((nb == 1).sum()) == 2 and int((nb >= 3).sum()) == 0, "no stair-step junction clusters, no end forks"
    assert len(pd.trace_branches(sk)) == 1 and int(sk.sum()) >= 0.8 * 240


def test_a_two_pixel_diagonal_and_a_small_block_survive():
    m = np.zeros((40, 40), dtype=bool)
    for i in range(5, 35):
        m[i, i] = m[i, i + 1] = True
    sk = pd.thin(m)
    assert int(sk.sum()) >= 0.8 * 30 and int((pd.neighbour_count(sk) == 1).sum()) == 2
    block = np.zeros((8, 8), dtype=bool)
    block[3:5, 3:5] = True
    assert int(pd.thin(block).sum()) == 1


def test_thinning_is_idempotent_and_tracing_covers_every_connected_pixel():
    for m in _shapes():
        sk = pd.thin(m)
        assert np.array_equal(pd.thin(sk), sk)
        nb = pd.neighbour_count(sk)
        covered = {p for b in pd.trace_branches(sk) for p in b}
        assert covered == {(int(x), int(y)) for y, x in zip(*np.nonzero(sk & (nb > 0)))}


def test_thinning_a_plan_with_a_solid_block_is_fast_and_max_iter_is_not_silent():
    m = np.zeros((1200, 1600), dtype=bool)
    for y in range(50, 1150, 150):
        m[y : y + 12, 50:1550] = True
    for x in range(50, 1550, 200):
        m[50:1150, x : x + 12] = True
    m[400:800, 400:900] = True  # a filled legend box or a hatched area
    t0 = time.perf_counter()
    sk = pd.thin(m)
    assert time.perf_counter() - t0 < 6.0
    assert int(pd.neighbour_count(sk).max()) <= 4 and not sk[450:750, 450:850].all()
    with pytest.raises(RuntimeError):
        pd.thin(np.ones((60, 60), dtype=bool), max_iter=3)
