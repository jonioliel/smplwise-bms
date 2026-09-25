"""Plan Studio detection primitives (T086, design 9.1): the chamfer distance transform equals a brute-force relaxation,
thinning turns a thick bar into one connected pixel-wide line and keeps a ring closed, and tracing splits a skeleton
at its junctions into branches with the right end points."""
from __future__ import annotations

import numpy as np

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
    # a thinned ring has junction pixels at its corners: its branches together still cover the whole skeleton
    ring = np.zeros((40, 40), dtype=bool)
    ring[5:35, 5:35] = True
    ring[12:28, 12:28] = False
    sk = pd.thin(ring)
    pixels = {p for b in pd.trace_branches(sk) for p in b}
    assert len(pixels) >= 0.9 * int(sk.sum())
    # a loop without any node (a diamond: every pixel has exactly two 8-neighbours) is one closed branch
    dia = np.zeros((16, 16), dtype=bool)
    for k in range(6):
        for x, y in ((7 + k, 2 + k), (7 - k, 2 + k), (7 + k, 12 - k), (7 - k, 12 - k)):
            dia[y, x] = True
    loops = pd.trace_branches(dia)
    assert len(loops) == 1 and loops[0][0] == loops[0][-1] and len(loops[0]) == int(dia.sum()) + 1
    assert pd.trace_branches(np.zeros((8, 8), dtype=bool)) == []
