"""Plan Studio detection fixtures (T086): the committed synthetic plans are exactly what the generator draws (pixel for
pixel, and the same ground truth), each ground truth is consistent (openings sit on their wall, every wall has a
thickness), and the metrics harness scores a perfect answer as 1.0 and a wrong one as 0."""
from __future__ import annotations

import io
import json
import pathlib
import sys

import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "fixtures" / "plan_detect"))
import gen_synthetic as gen  # noqa: E402
import plan_detect_metrics as pm  # noqa: E402

NAMES = ["apartment", "lshape", "hall", "diagonal", "noisy", "thick"]


def test_committed_fixtures_match_the_generator(tmp_path):
    assert list(gen.PLANS) == NAMES
    assert gen.generate(tmp_path) == NAMES
    for name in NAMES:
        fresh = np.asarray(Image.open(tmp_path / f"{name}.png").convert("L"))
        kept = np.asarray(Image.open(pm.FIXTURES / f"{name}.png").convert("L"))
        assert kept.shape == (1200, 1600) and np.array_equal(fresh, kept), f"{name}.png differs from the generator: rerun gen_synthetic.py"
        assert json.loads((tmp_path / f"{name}.json").read_text(encoding="utf-8")) == json.loads((pm.FIXTURES / f"{name}.json").read_text(encoding="utf-8")), name


def test_ground_truth_is_consistent():
    for name, gt, png in pm.load_set():
        assert gt["name"] == name and gt["width"] == 1600 and gt["height"] == 1200 and 0.005 <= gt["scale_m_per_px"] <= 0.02
        assert len(gt["walls"]) >= 5 and all(w["thickness_px"] >= 8 for w in gt["walls"])
        for o in gt["doors"] + gt["windows"]:
            wall = gt["walls"][o["wall"]]
            a, b = np.array(wall["a"], float), np.array(wall["b"], float)
            d = (b - a) / np.linalg.norm(b - a)
            v = np.array(o["centre"], float) - a
            lateral = abs(d[0] * v[1] - d[1] * v[0])
            along = float(np.dot(v, d))
            assert lateral < 1.5 and 0 < along < np.linalg.norm(b - a), (name, o)
            # a real door: 0.8-1.0 m single, 1.6-2.0 m double; a window 1.0-1.5 m
            metres = o["width_px"] * gt["scale_m_per_px"]
            assert (1.5 <= metres <= 2.0) if o.get("double") else (0.7 <= metres <= 1.5), (name, o, metres)
        assert Image.open(io.BytesIO(png)).size == (1600, 1200)
    assert sum(len(gt["doors"]) for _, gt, _ in pm.load_set()) >= 20 and sum(len(gt["windows"]) for _, gt, _ in pm.load_set()) >= 12


def _perfect(gt: dict) -> dict:
    """A detector answer built from the ground truth itself, in the response shape of plan_detect.detect."""
    w, h = gt["width"], gt["height"]
    walls = [{"id": f"auto-t-w{i:03d}", "polyline": [[a[0] / w, a[1] / h], [b[0] / w, b[1] / h]]} for i, (a, b) in enumerate((x["a"], x["b"]) for x in gt["walls"])]
    openings = []
    for k, key in (("door", "doors"), ("window", "windows")):
        for j, o in enumerate(gt[key]):
            wall = gt["walls"][o["wall"]]
            a, b = np.array(wall["a"], float), np.array(wall["b"], float)
            t = float(np.dot(np.array(o["centre"], float) - a, (b - a) / np.linalg.norm(b - a))) / float(np.linalg.norm(b - a))
            openings.append({"id": f"auto-t-{k}{j}", "wall_id": walls[o["wall"]]["id"], "t": t, "kind": k})
    return {"walls": walls, "openings": openings}


def test_metrics_score_a_perfect_and_an_empty_answer():
    name, gt, _ = pm.load_set()[0]
    good = pm.evaluate(gt, _perfect(gt), pm.TOLERANCE_PX.get(name, 10.0))
    assert good["walls"]["recall"] > 0.999 and good["walls"]["precision"] > 0.999
    assert good["doors"]["recall"] == 1.0 and good["doors"]["kind_recall"] == 1.0 and good["doors"]["false"] == 0
    assert good["windows"]["recall"] == 1.0 and good["windows"]["false"] == 0
    empty = pm.evaluate(gt, {"walls": [], "openings": []})
    assert empty["walls"]["recall"] == 0.0 and empty["doors"]["recall"] == 0.0 and empty["windows"]["recall"] == 0.0
    # a wall far from every ground-truth wall counts against precision, and a door on it counts as false
    off = {"walls": [{"id": "x", "polyline": [[0.5, 0.5], [0.6, 0.5]]}], "openings": [{"id": "o", "wall_id": "x", "t": 0.5, "kind": "door"}]}
    bad = pm.evaluate(gt, off)
    assert bad["walls"]["precision"] == 0.0 and bad["doors"]["false"] == 1
