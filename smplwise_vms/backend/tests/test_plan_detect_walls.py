"""Plan Studio wall detection (T086, design 9.1): snapping and merging of segments, the tilt estimate, and walls found
on the synthetic set with the baseline recall and precision - calibrated, and uncalibrated with the estimated scale."""
from __future__ import annotations

import io
import json

import numpy as np
from PIL import Image

import plan_detect_metrics as pm
from smplwise.services import plan_detect as pd


def _seg(a, b, thick=10.0):
    s = pd.Seg(np.array(a, float), np.array(b, float), [thick] * 5)
    return s


def test_snap_axis_within_four_degrees_only():
    a, b, snapped = pd.snap_axis(np.array([0.0, 0.0]), np.array([100.0, 3.0]))
    assert snapped and b[1] == a[1] and abs(np.hypot(*(b - a)) - np.hypot(100, 3)) < 1e-9, "rotated about the midpoint, length kept"
    a, b, snapped = pd.snap_axis(np.array([0.0, 0.0]), np.array([100.0, 12.0]))
    assert not snapped and b[1] == 12.0
    a, b, snapped = pd.snap_axis(np.array([5.0, 0.0]), np.array([4.0, 50.0]))
    assert snapped and a[0] == b[0]


def test_merge_collinear_joins_touching_pieces_and_keeps_gaps():
    segs = [_seg((0, 0), (100, 0)), _seg((104, 1), (200, 0)), _seg((260, 0), (300, 0)), _seg((0, 40), (100, 40))]
    out = pd.merge_collinear(segs, join_px=8)
    assert len(out) == 3
    longest = max(out, key=lambda s: s.length)
    assert longest.length == 200 and longest.a[0] == 0 and longest.b[0] == 200
    groups = pd.line_groups(out)
    assert sorted(len(g) for g in groups) == [1, 2], "the 60 px gap keeps two segments on one line, the other wall is its own line"


def test_tilt_from_unsnapped_directions():
    s1 = _seg((0, 0), (400, 0))
    s1.raw = pd._unit(np.array([0.0, 0.0]), np.array([400.0, -5.6]))  # about -0.8 degrees
    s2 = _seg((0, 0), (0, 300))
    s2.raw = pd._unit(np.array([0.0, 0.0]), np.array([4.2, 300.0]))  # the same tilt, seen on a vertical
    assert abs(pd.estimate_tilt([s1, s2], 10.0) + 0.8) < 0.05
    assert pd.estimate_tilt([], 10.0) == 0.0


def _first_result(name: str, calibrated: bool):
    for n, gt, png in pm.load_set():
        if n == name:
            return gt, pd.detect(png, targets=("walls",), scale_m_per_px=gt["scale_m_per_px"] if calibrated else None, run_id="t1")
    raise AssertionError(name)


def test_walls_on_the_apartment_have_the_document_shape_and_kinds():
    gt, r = _first_result("apartment", True)
    assert r["openings"] == [] and r["detector"]["name"] == "plan_detect" and r["detector"]["params"]["targets"] == ["walls"]
    assert 10 <= len(r["walls"]) <= 16, "walls only: the seven walls stay split at their seven openings"
    for w in r["walls"]:
        assert w["id"].startswith("auto-t1-w") and w["source"] == "auto" and w["level_id"] == "L0" and 0 < w["confidence"] <= 0.99
        assert len(w["polyline"]) == 2 and all(0 <= c <= 1 for p in w["polyline"] for c in p)
        assert w["kind"] in ("exterior", "interior", "partition") and 0.05 <= w["thickness_m"] <= 0.4
        assert r["pixels"][w["id"]]["thickness_px"] > 5
    kinds = {w["kind"] for w in r["walls"]}
    assert "exterior" in kinds and "interior" in kinds
    outer = [w for w in r["walls"] if w["kind"] == "exterior"]
    assert all(abs(w["thickness_m"] - 0.16) < 0.04 for w in outer), [w["thickness_m"] for w in outer]
    assert r["scale"] == {"m_per_px": 0.01, "status": "measured"} and r["calibration_hint"] is None
    assert pm.wall_scores(gt, r["walls"], 10.0)["recall"] >= 0.95


def test_walls_baseline_calibrated_and_uncalibrated():
    rows = pm.run_set(lambda png, **kw: pd.detect(png, targets=("walls",), **kw))
    for row in rows:
        assert row["walls"]["recall"] >= 0.90, (row["name"], row["walls"])
        assert row["walls"]["precision"] >= 0.80, (row["name"], row["walls"])
    rows = pm.run_set(lambda png, **kw: pd.detect(png, targets=("walls",), **kw), calibrated=False)
    for row in rows:
        assert row["walls"]["recall"] >= 0.90 and row["walls"]["precision"] >= 0.80, (row["name"], row["walls"])


def test_tilted_scan_comes_back_on_the_scan_and_a_blank_picture_gives_nothing():
    gt, r = _first_result("noisy", True)
    assert abs(r["detector"]["params"]["tilt_deg"] + 0.8) < 0.3, r["detector"]["params"]
    assert pm.wall_scores(gt, r["walls"], 12.0)["recall"] >= 0.95
    buf = io.BytesIO()
    Image.new("L", (400, 300), 255).save(buf, "PNG")
    empty = pd.detect(buf.getvalue())
    assert empty["walls"] == [] and empty["openings"] == [] and empty["calibration_hint"] is None
    arr = np.asarray(Image.open(io.BytesIO(pm.load_set()[0][2])).convert("L"))
    assert len(pd.detect(arr, targets=("walls",), scale_m_per_px=0.01)["walls"]) == len(_first_result("apartment", True)[1]["walls"]), "an ndarray input is the same as the PNG"
