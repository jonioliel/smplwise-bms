"""Plan Studio opening detection (T086, design 9.2 / 9.3 / 6.3): a drawn door arc gives a door whose hinge and swing
reproduce the drawing (the leaf tip lands on ink whichever way the wall was traced), a plain gap is a passage, the
double door of the hall is found as one opening, doors reach the baseline on the synthetic set, and an uncalibrated
plan gets a door-width calibration hint marked estimated; no passage joins pieces across a crossing wall, while doors
and passages flush with a T partition and doors with a filled leaf stay openings of their one wall."""
from __future__ import annotations

import io
import math
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw

import plan_detect_metrics as pm
from smplwise.services import plan_detect as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "fixtures" / "plan_detect"))
import gen_synthetic as gen  # noqa: E402


def _room(outer: int = 14, inner: int = 10) -> tuple[gen.Plan, int]:
    p = gen.Plan("t", 0.01, 800, 500)
    for a, b in (((60, 60), (740, 60)), ((740, 60), (740, 440)), ((740, 440), (60, 440)), ((60, 440), (60, 60))):
        p.wall(a, b, outer, "exterior")
    return p, p.wall((400, 60), (400, 440), inner)


def _png(p: gen.Plan) -> bytes:
    buf = io.BytesIO()
    p.im.save(buf, "PNG")
    return buf.getvalue()


def _tips_on_ink(im: Image.Image, r: dict) -> list[bool]:
    """For every single door: the leaf tip computed from the candidate (hinge end + normal x width, the door() rule of
    geometry.ts) lies on drawn ink within 3 px."""
    arr = np.asarray(im.convert("L")) < 128
    w_px, h_px = im.size
    by = {w["id"]: w for w in r["walls"]}
    out = []
    for o in r["openings"]:
        if o["kind"] != "door" or o["swing"] == "double":
            continue
        wall = by[o["wall_id"]]
        a = np.array(wall["polyline"][0]) * [w_px, h_px]
        b = np.array(wall["polyline"][1]) * [w_px, h_px]
        d = (b - a) / np.linalg.norm(b - a)
        c = a + (b - a) * o["t"]
        width = r["pixels"][o["id"]]["width_px"]
        hinge = c - d * width / 2 if o["hinge"] == "start" else c + d * width / 2
        n = np.array([d[1], -d[0]]) if o["swing"] == "left" else np.array([-d[1], d[0]])
        tip = hinge + n * width
        x, y = int(round(tip[0])), int(round(tip[1]))
        out.append(bool(arr[max(0, y - 3):y + 4, max(0, x - 3):x + 4].any()))
    return out


def test_a_drawn_door_is_a_door_with_the_drawings_hinge_and_swing():
    for hinge in ("start", "end"):
        for swing in ("left", "right"):
            p, wall = _room()
            p.door(wall, (400, 250), 90, hinge, swing)
            r = pd.detect(_png(p), scale_m_per_px=0.01, run_id="x")
            doors = [o for o in r["openings"] if o["kind"] == "door"]
            assert len(doors) == 1 and not [o for o in r["openings"] if o["kind"] == "passage"], (hinge, swing, r["openings"])
            o = doors[0]
            assert abs(o["width_m"] - 0.9) < 0.08 and o["confidence"] >= 0.55 and o["height_m"] == 2.1 and o["sill_m"] == 0
            assert o["id"].startswith("auto-x-o") and o["source"] == "auto" and o["wall_id"] in {w["id"] for w in r["walls"]}
            assert _tips_on_ink(p.im, r) == [True], (hinge, swing)
            assert 4 <= len(r["walls"]) <= 6, "the partition is one wall spanning its door"


def test_a_plain_gap_is_a_passage_and_the_hint_needs_a_door():
    p, wall = _room()
    p._gap(wall, (400, 250), 100)
    r = pd.detect(_png(p), scale_m_per_px=0.01, run_id="x")
    assert [(o["kind"], o["confidence"]) for o in r["openings"]] == [("passage", 0.45)] and abs(r["openings"][0]["width_m"] - 1.0) < 0.08
    r0 = pd.detect(_png(p), run_id="x")
    assert r0["calibration_hint"] is None and r0["scale"]["status"] == "estimated_walls" and 0.008 <= r0["scale"]["m_per_px"] <= 0.02
    assert [o["kind"] for o in r0["openings"]] == ["passage"]


def test_no_passage_across_a_crossing_wall():
    """A partition that ends at a crossing wall and a stub of the same thickness 1.47 m beyond it, on one line: the gap
    starts at the crossing wall's face, so it is no passage and the partition and the stub stay two walls (a10c58e
    joined the 12 px pair into one 5.5 m wall with a passage); a plain gap between two free ends stays a passage."""
    for part_t in (12, 6):
        p = gen.Plan("t", 0.01, 800, 500)
        for a, b in (((60, 60), (740, 60)), ((740, 60), (740, 440)), ((740, 440), (60, 440)), ((60, 440), (60, 60))):
            p.wall(a, b, 16, "exterior")
        p.wall((400, 60), (400, 440), 12)
        p.wall((60, 250), (400, 250), part_t)
        p.wall((560, 250), (610, 250), 12)
        r = pd.detect(_png(p), scale_m_per_px=0.01)
        assert r["openings"] == [], (part_t, r["openings"])
        on_line = sorted(sorted(round(x * 800) for x, _y in w["polyline"]) for w in r["walls"] if all(abs(y * 500 - 250) < 3 for _x, y in w["polyline"]))
        assert len(on_line) == 2 and on_line[0][1] <= 402 and on_line[1][0] >= 550, (part_t, on_line)
    p = gen.Plan("t", 0.01, 800, 500)
    for a, b in (((60, 60), (740, 60)), ((740, 60), (740, 440)), ((740, 440), (60, 440)), ((60, 440), (60, 60))):
        p.wall(a, b, 16, "exterior")
    p.wall((60, 250), (300, 250), 12)
    p.wall((390, 250), (740, 250), 12)
    r = pd.detect(_png(p), scale_m_per_px=0.01)
    assert [o["kind"] for o in r["openings"]] == ["passage"], r["openings"]


def _framed() -> gen.Plan:
    p = gen.Plan("t", 0.01, 800, 500)
    for a, b in (((60, 60), (740, 60)), ((740, 60), (740, 440)), ((740, 440), (60, 440)), ((60, 440), (60, 60))):
        p.wall(a, b, 16, "exterior")
    return p


def _on_line(r: dict, y: int = 250) -> list[dict]:
    return [w for w in r["walls"] if all(abs(q[1] * 500 - y) < 3 for q in w["polyline"])]


def test_doors_and_passages_flush_with_t_partitions_stay_openings_of_one_wall():
    """A T partition (or an L corner, or a door leaf) continues the wall mask on one side of a gap end only: that is no
    crossing wall, so a door or a passage whose jamb is flush with it stays an opening of the one wall it is in."""
    cases = (("door at a partition", ((294,),), True), ("door between two partitions", ((294,), (396,)), True), ("passage at a partition", ((294,),), False))
    for label, partitions, door in cases:
        p = _framed()
        wi = p.wall((60, 250), (740, 250), 12)
        for (x,) in partitions:
            p.wall((x, 250), (x, 440), 12)
        if door:
            p.door(wi, (345, 250), 90, "start", "left")
        else:
            p._gap(wi, (345, 250), 90)
            p.gt["doors"].append({"centre": [345, 250], "width_px": 90, "wall": wi, "hinge": "start", "swing": "none", "double": False})
        r = pd.detect(_png(p), scale_m_per_px=0.01)
        score = pm.opening_scores(p.gt, r["walls"], r["openings"], ("door", "passage"), "doors", 10.0)
        assert score["found"] == 1 and score["false"] == 0 and score["kind_recall"] == (1.0 if door else 0.0), (label, r["openings"])
        assert len(_on_line(r)) == 1 and [o["kind"] for o in r["openings"]] == ["door" if door else "passage"], (label, _on_line(r), r["openings"])


def test_a_door_with_a_filled_leaf_is_kept_where_it_is():
    """CAD draws the leaf as a filled 4-6 px bar from the hinge: it lies across the gap on the swing side only, so the
    gap is not blocked (a wall across it covers the whole band), and a leaf set 3 px into the wall is no crossing face."""
    for t in (12, 20):
        for leaf in (4, 6):
            for inset in (0, 3):
                p = _framed()
                wi = p.wall((60, 250), (740, 250), t)
                g0, _g1, _d = p._gap(wi, (400, 250), 90)
                x0 = int(g0[0]) - inset
                p.d.rectangle([x0, 250 - 90, x0 + leaf - 1, 250], fill=0)
                arc = [(g0[0] + 90 * math.cos(-math.pi / 2 * k / 30), 250 + 90 * math.sin(-math.pi / 2 * k / 30)) for k in range(31)]
                p.d.line(arc, fill=0, width=2)
                r = pd.detect(_png(p), scale_m_per_px=0.01)
                doors = [o for o in r["openings"] if o["kind"] == "door"]
                assert len(doors) == 1 and len(_on_line(r)) == 1, (t, leaf, inset, r["openings"], _on_line(r))
                (ax, _ay), (bx, _by) = _on_line(r)[0]["polyline"]
                assert abs((ax + (bx - ax) * doors[0]["t"]) * 800 - 400) <= 5 and abs(doors[0]["width_m"] - 0.9) < 0.05, (t, leaf, inset, doors[0])


def _matching_door(gt: dict, r: dict, g: dict, tol: float) -> tuple[dict, bool] | None:
    """The detected door nearest to the ground-truth door g whose wall runs along g's wall (pm's wall overlap test) and
    whose centre lies within tol plus half the width, with whether that wall runs the same way as the drawn one."""
    w_px, h_px = gt["width"], gt["height"]
    gw = gt["walls"][g["wall"]]
    ga, gb = np.array(gw["a"], float), np.array(gw["b"], float)
    by = {w["id"]: w for w in r["walls"]}
    best = None
    for o in r["openings"]:
        if o["kind"] != "door":
            continue
        a, b = pm._seg_px(by[o["wall_id"]], w_px, h_px)
        if pm._overlap_on(ga, gb, a, b, tol) <= 0:
            continue
        dist = float(np.hypot(*(a + (b - a) * o["t"] - np.array(g["centre"], float))))
        if dist <= tol + g["width_px"] / 2 and (best is None or dist < best[0]):
            best = (dist, o, float(np.dot(b - a, gb - ga)) > 0)
    return None if best is None else (best[1], best[2])


def _hatch(p: gen.Plan, box: tuple[int, int, int, int], spacing: int) -> None:
    """45-degree hatching of 1 px lines inside box (a filled material or a stair symbol beside an opening)."""
    x0, y0, x1, y1 = box
    layer = Image.new("L", p.im.size, 255)
    dd = ImageDraw.Draw(layer)
    for k in range(-(y1 - y0), x1 - x0, spacing):
        dd.line([(x0 + k, y0), (x0 + k + (y1 - y0), y1)], fill=0, width=1)
    m = Image.new("L", p.im.size, 0)
    ImageDraw.Draw(m).rectangle(box, fill=255)
    p.im.paste(layer, (0, 0), m)


def test_hatching_beside_a_plain_gap_is_no_door_arc():
    """A hatch fills every quarter circle with ink, so the arc alone would call it a door: a drawn arc stands clear of
    the quarter circles at 0.7 r and 1.3 r, a hatch does not."""
    for spacing in (6, 8, 10, 14):
        p, wall = _room()
        p._gap(wall, (400, 250), 90)
        _hatch(p, (412, 150, 600, 350), spacing)
        r = pd.detect(_png(p), scale_m_per_px=0.01, run_id="x")
        assert [o["kind"] for o in r["openings"]] == ["passage"], (spacing, r["openings"])
    for spacing in (8, 14):  # the door swings to +x; the hatch on the other side fills only the wrong swing's rings
        p, wall = _room()
        p.door(wall, (400, 250), 90)
        _hatch(p, (200, 150, 388, 350), spacing)
        r = pd.detect(_png(p), scale_m_per_px=0.01, run_id="x")
        assert [o["kind"] for o in r["openings"]] == ["door"] and _tips_on_ink(p.im, r) == [True], (spacing, r["openings"])


def test_uncalibrated_doors_in_thick_walls_and_a_narrow_double_door():
    """Uncalibrated, 0.3 m exterior walls make the median wall 30 px, so a 0.8 m door (80 px) reads 0.53 m and is
    under 4 partition thicknesses: the arc test is scale free and runs on a wide gate, the passage gate stays narrow."""
    for width in (70, 80):
        p, wall = _room(outer=30, inner=10)
        p.door(wall, (400, 250), width)
        r = pd.detect(_png(p), run_id="x")
        assert [o["kind"] for o in r["openings"]] == ["door"] and _tips_on_ink(p.im, r) == [True], (width, r["openings"])
        assert r["calibration_hint"] is not None and abs(r["calibration_hint"]["scale_m_per_px"] / (pd.DOOR_TYPICAL_M / width) - 1) <= 0.05
    p, wall = _room()
    p.door(wall, (400, 250), 120, double=True)
    r = pd.detect(_png(p), scale_m_per_px=0.01, run_id="x")
    assert [(o["kind"], o["swing"]) for o in r["openings"]] == [("door", "double")], r["openings"]
    assert abs(r["openings"][0]["width_m"] - 1.2) < 0.08 and r["openings"][0]["confidence"] <= 0.99


def test_doors_baseline_and_the_double_door():
    results = {}
    for name, gt, png in pm.load_set():
        r = results[name] = pd.detect(png, scale_m_per_px=gt["scale_m_per_px"])
        tol = pm.TOLERANCE_PX.get(name, 10.0)
        doors = pm.evaluate(gt, r, tol)["doors"]
        assert doors["recall"] >= 0.80 and doors["kind_recall"] >= 0.80, (name, doors)
        assert doors["false"] == 0, (name, doors)
        # every drawn door: the nearest detected door on the same wall has its hinge and swing (read in the detected
        # wall's direction, so both are flipped when that wall was traced the other way)
        for g in gt["doors"]:
            m = _matching_door(gt, r, g, tol)
            assert m is not None, (name, g)
            o, same_way = m
            if g["double"]:
                assert o["swing"] == "double", (name, g, o)
                continue
            hinge, swing = g["hinge"], g["swing"]
            if not same_way:
                hinge, swing = {"start": "end", "end": "start"}[hinge], {"left": "right", "right": "left"}[swing]
            assert (o["hinge"], o["swing"]) == (hinge, swing), (name, g, o)
    hall = results["hall"]
    doubles = [o for o in hall["openings"] if o["swing"] == "double"]
    assert len(doubles) == 1 and abs(doubles[0]["width_m"] - 1.92) < 0.12 and doubles[0]["kind"] == "door"
    singles = [o for o in hall["openings"] if o["kind"] == "door" and o["swing"] != "double"]
    assert len(singles) == 2 and all(abs(o["width_m"] - 0.96) < 0.1 for o in singles)


def test_calibration_hint_from_the_door_widths():
    for name, gt, png in pm.load_set():
        r = pd.detect(png, run_id="h")
        hint = r["calibration_hint"]
        assert hint is not None and hint["status"] == "estimated" and hint["method"] == "door_width" and hint["reason"] == "לפי רוחב דלת אופייני", name
        # the hint takes the median single door as 0.9 m: compare with the scale that makes the drawn doors 0.9 m
        drawn = float(np.median([d["width_px"] for d in gt["doors"] if not d["double"]]))
        assert abs(hint["scale_m_per_px"] / (pd.DOOR_TYPICAL_M / drawn) - 1) <= 0.05, (name, hint, drawn)
        assert hint["doors"] >= 2 and r["scale"]["status"] == "estimated_walls"
        for o in r["openings"]:
            if o["kind"] == "door" and o["swing"] != "double":
                assert abs(r["pixels"][o["id"]]["width_px"] * gt["scale_m_per_px"] - 0.9) < 0.12, (name, o)
    calibrated = pd.detect(pm.load_set()[0][2], scale_m_per_px=0.01)
    assert calibrated["calibration_hint"] is None and calibrated["scale"]["status"] == "measured"
