"""Plan Studio wall detection (T086, design 9.1): snapping and merging of segments, the tilt estimate, and walls found
on the synthetic set with the baseline recall and precision - calibrated, and uncalibrated with the estimated scale; a
parallel wall beside a long wall stays its own wall, T-junctions near the corners do not fake a tilt, and room labels
neither add walls nor slow the detector down."""
from __future__ import annotations

import io
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFont

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


def _png(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def _frame(width: int = 16) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    im = Image.new("L", (1600, 1200), 255)
    d = ImageDraw.Draw(im)
    d.rectangle([50, 50, 1550, 1150], outline=0, width=width)
    return im, d


def test_a_parallel_wall_beside_a_long_wall_stays_its_own_wall():
    for gap in (30, 40, 60):  # centre lines 0.3 - 0.6 m apart at 0.01 m / px, far along the top wall
        im, d = _frame()
        y = 58 + gap
        d.rectangle([700, y - 8, 1300, y + 7], fill=0)
        r = pd.detect(_png(im), scale_m_per_px=0.01)
        assert len(r["walls"]) == 5 and r["openings"] == [], (gap, [w["polyline"] for w in r["walls"]], r["openings"])
        on = [w for w in r["walls"] if all(abs(p[1] * 1200 - y) < 6 for p in w["polyline"])]
        top = [w for w in r["walls"] if all(abs(p[1] * 1200 - 58) < 6 for p in w["polyline"])]
        assert len(on) == 1 and len(top) == 1 and abs(top[0]["polyline"][1][0] - top[0]["polyline"][0][0]) * 1600 > 1400, gap


def test_t_junctions_near_the_corners_do_not_tilt_an_axis_aligned_plan():
    im, d = _frame(12)
    d.rectangle([900, 120, 1540, 131], fill=0)
    d.rectangle([900, 120, 911, 1140], fill=0)
    im2, d2 = _frame(12)
    for x in (130, 1460):
        d2.rectangle([x, 50, x + 11, 1150], fill=0)
    for y in (130, 1060):
        d2.rectangle([50, y, 1550, y + 11], fill=0)
    for picture, walls in ((im, 6), (im2, 8)):
        for scale in (0.01, None):
            r = pd.detect(_png(picture), targets=("walls",), scale_m_per_px=scale)
            assert r["detector"]["params"]["tilt_deg"] == 0 and len(r["walls"]) == walls, (scale, r["detector"]["params"], len(r["walls"]))


def _labelled(png: bytes, count: int = 200) -> bytes:
    """The plan with `count` bold room labels in its free space (never on the walls, at least 6 px apart: close enough
    for the closing to join neighbouring words into one blot)."""
    im = Image.open(io.BytesIO(png)).convert("L")
    busy = np.asarray(im) < 128
    grown = busy.copy()
    for _ in range(14):
        grown[1:, :] |= grown[:-1, :]
        grown[:-1, :] |= grown[1:, :]
        grown[:, 1:] |= grown[:, :-1]
        grown[:, :-1] |= grown[:, 1:]
    d = ImageDraw.Draw(im)
    font = ImageFont.load_default(size=28)
    rng = np.random.RandomState(7)
    words = ["BEDROOM", "12.4 m2", "KITCHEN", "+0.00", "WC", "LIVING", "3.40", "2.85", "DN", "UP"]
    placed = 0
    for _ in range(20000):
        if placed == count:
            break
        w = words[rng.randint(len(words))]
        x, y = int(rng.randint(0, 1560)), int(rng.randint(0, 1180))
        x0, y0, x1, y1 = d.textbbox((x, y), w, font=font, stroke_width=2)
        if x1 >= im.width or y1 >= im.height or grown[y0 : y1 + 1, x0 : x1 + 1].any():
            continue
        d.text((x, y), w, fill=0, font=font, stroke_width=2, stroke_fill=0)
        grown[max(0, y0 - 6) : y1 + 7, max(0, x0 - 6) : x1 + 7] = True
        placed += 1
    assert placed == count
    return _png(im)


def test_room_labels_add_no_walls_and_do_not_slow_the_detector():
    _name, gt, png = pm.load_set()[0]
    noisy = _labelled(png)
    for scale in (0.01, None):
        clean = pd.detect(png, targets=("walls",), scale_m_per_px=scale)
        t0 = time.perf_counter()
        r = pd.detect(noisy, targets=("walls",), scale_m_per_px=scale)
        assert time.perf_counter() - t0 < 5.0
        a, b = pm.wall_scores(gt, clean["walls"], 10.0), pm.wall_scores(gt, r["walls"], 10.0)
        assert len(r["walls"]) == len(clean["walls"]) and b["precision"] >= 0.98 and abs(a["recall"] - b["recall"]) < 0.01, (scale, len(r["walls"]), b)
        assert r["scale"] == clean["scale"], "the labels do not move the estimated scale"
