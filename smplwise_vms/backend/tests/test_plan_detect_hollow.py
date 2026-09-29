"""Plan Studio hollow walls (T087, hollow_v1, services/plan_detect_hollow.py; synthetic pictures only - the owner's
scans stay private): a hollow exterior outline with a door gap and a window is four exterior walls flagged hollow with
the door and the window found in them; a hollow outline meets a solid wall at its corners and leaves a solid interior
wall alone; two thin lines with hatching or room content between them are never one hollow wall; the double line of a
tribune railing and the treads of a stair are rejected by their rules; two solid walls 0.75 m apart (the T-junction
fixture of test_plan_detect_walls) give the pass no stroke at all; the synthetic set has no hollow wall; every wall of
the answer carries the flag; the pass keeps the run's deadline."""
from __future__ import annotations

import io
import math

import numpy as np
import pytest
from PIL import Image, ImageDraw

import plan_detect_metrics as pm
from smplwise.services import plan_detect as pd
from smplwise.services import plan_detect_hollow as pdh

S = 0.01  # metres per pixel of the synthetic pictures (1600 x 1200 px = 16 x 12 m)
GAP = 30  # the two lines of a hollow wall, centre to centre: 0.3 m


def _png(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def _px(w: dict) -> list[tuple[float, float]]:
    return [(p[0] * 1600, p[1] * 1200) for p in w["polyline"]]


def _hollow_box(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int], sides: tuple[str, ...] = ("top", "right", "bottom", "left"), lw: int = 2) -> None:
    """Two outlines GAP px apart (2 px lines, white between) on the given sides of the box."""
    x0, y0, x1, y1 = box
    for off in (0, GAP):
        a, b, c, e = x0 + off, y0 + off, x1 - off, y1 - off
        if "top" in sides:
            d.rectangle([a, b, c, b + lw - 1], fill=0)
        if "bottom" in sides:
            d.rectangle([a, e - lw + 1, c, e], fill=0)
        if "left" in sides:
            d.rectangle([a, b, a + lw - 1, e], fill=0)
        if "right" in sides:
            d.rectangle([c - lw + 1, b, c, e], fill=0)


def _outline_with_door_and_window() -> Image.Image:
    """A 14 x 10 m hollow outline (0.3 m), two solid 0.12 m interior walls ending on its inner line, a 0.9 m door in
    the bottom wall (both lines cut, the ends closed by jambs, the leaf and its quarter arc) and a 1.2 m window in the
    top wall (the lines run on, a glass line along the middle)."""
    im = Image.new("L", (1600, 1200), 255)
    d = ImageDraw.Draw(im)
    _hollow_box(d, (100, 100, 1500, 1100))
    d.rectangle([800, 132, 811, 1068], fill=0)
    d.rectangle([132, 600, 800, 611], fill=0)
    d.rectangle([400, 1068, 489, 1101], fill=255)
    for x in (398, 490):
        d.rectangle([x, 1070, x + 1, 1101], fill=0)
    hinge = (400, 1085)
    d.line([hinge, (400, 995)], fill=0, width=2)
    d.line([(hinge[0] + 90 * math.cos(math.radians(-90 + 3 * k)), hinge[1] + 90 * math.sin(math.radians(-90 + 3 * k))) for k in range(31)], fill=0, width=2)
    d.rectangle([600, 115, 719, 116], fill=0)
    return im


def test_a_hollow_outline_is_four_exterior_hollow_walls_with_its_door_and_window():
    png = _png(_outline_with_door_and_window())
    for scale in (S, None):
        r = pd.detect(png, scale_m_per_px=scale)
        hollow = [w for w in r["walls"] if w["hollow"]]
        solid = [w for w in r["walls"] if not w["hollow"]]
        assert len(hollow) == 4 and r["stats"]["hollow"]["walls"] >= 4 and r["stats"]["hollow"]["spacing_px"] == GAP, (scale, r["stats"]["hollow"])
        for w in hollow:
            (xa, ya), (xb, yb) = _px(w)
            mid = 115.5 if abs(xb - xa) > abs(yb - ya) and ya < 600 else 1084.5 if abs(xb - xa) > abs(yb - ya) else 115.5 if xa < 800 else 1484.5
            assert all(abs((y if abs(xb - xa) > abs(yb - ya) else x) - mid) < 1.0 for x, y in _px(w)), "on the middle line"
            assert max(abs(xb - xa), abs(yb - ya)) > 960, "corner to corner, across the door and the window"
            assert w["kind"] == "exterior" and 0.5 <= w["confidence"] <= pdh.HOLLOW_CONF_MAX
        if scale:
            assert all(abs(w["thickness_m"] - 0.32) < 0.02 for w in hollow), "outer face to outer face"
        assert len(solid) == 2 and all(w["kind"] == "interior" for w in solid), [(_px(w), w["kind"]) for w in solid]
        by_id = {w["id"]: w for w in r["walls"]}
        found = {}
        for o in r["openings"]:
            (xa, ya), (xb, yb) = _px(by_id[o["wall_id"]])
            found[o["kind"]] = (xa + (xb - xa) * o["t"], ya + (yb - ya) * o["t"], by_id[o["wall_id"]]["hollow"])
        assert set(found) == {"door", "window"}, r["openings"]
        assert abs(found["door"][0] - 445) < 10 and abs(found["door"][1] - 1085) < 3 and found["door"][2], found
        assert abs(found["window"][0] - 660) < 10 and abs(found["window"][1] - 115) < 3 and found["window"][2], found
        if scale:
            door = next(o for o in r["openings"] if o["kind"] == "door")
            assert abs(door["width_m"] - 0.9) < 0.1, door


def test_a_hollow_outline_meets_a_solid_wall_and_leaves_the_interior_wall_alone(monkeypatch):
    im = Image.new("L", (1600, 1200), 255)
    d = ImageDraw.Draw(im)
    _hollow_box(d, (100, 100, 1500, 1100), sides=("top", "bottom", "left"))
    d.rectangle([1484, 100, 1499, 1100], fill=0)  # the east side: a solid 0.16 m wall the hollow lines end on
    d.rectangle([700, 132, 711, 1068], fill=0)  # a solid 0.12 m wall between the top and bottom hollow walls
    r = pd.detect(_png(im), scale_m_per_px=S)
    hollow = [w for w in r["walls"] if w["hollow"]]
    solid = sorted((_px(w), w["thickness_m"]) for w in r["walls"] if not w["hollow"])
    assert len(hollow) == 3 and all(w["kind"] == "exterior" and abs(w["thickness_m"] - 0.32) < 0.02 for w in hollow)
    east = next(p for p, t in solid if t == 0.16)[0][0]
    for w in hollow:
        (xa, ya), (xb, yb) = _px(w)
        if abs(xb - xa) > abs(yb - ya):  # top and bottom: from the west corner onto the solid wall's centre line
            assert abs(min(xa, xb) - 115.5) < 1.0 and abs(max(xa, xb) - east) < 1.0, _px(w)
    interior = next(w for w in r["walls"] if not w["hollow"] and w["thickness_m"] == 0.12)
    assert interior["kind"] == "interior", interior
    real = pdh.find_hollow
    monkeypatch.setattr(pdh, "find_hollow", lambda segs, *a, **k: (segs, [], real(segs, *a, **k)[2]))
    alone = pd.detect(_png(im), scale_m_per_px=S)["walls"]
    assert solid == sorted((_px(w), w["thickness_m"]) for w in alone), "the solid walls are the solid pass's, as without the hollow pass"


def test_two_thin_lines_with_hatching_or_room_content_between_are_never_one_hollow_wall():
    """Inside a solid 0.16 m building, two 2 px lines 0.3 m apart across it, wall to wall: with 45 degree hatching
    between them, or with furniture boxes between them, the pass finds no pair long enough and adds nothing - the
    answer is the one without the pass."""
    for content in ("hatch", "boxes"):
        im = Image.new("L", (1600, 1200), 255)
        d = ImageDraw.Draw(im)
        d.rectangle([100, 100, 1500, 1100], outline=0, width=16)
        d.rectangle([116, 500, 1484, 501], fill=0)
        d.rectangle([116, 530, 1484, 531], fill=0)
        if content == "hatch":
            for x in range(86, 1484, 8):
                d.line([(x, 529), (x + 27, 502)], fill=0, width=1)
        else:
            for x in range(200, 1484, 60):
                d.rectangle([x, 506, x + 30, 525], outline=0, width=2)
        png = _png(im)
        for scale in (S, None):
            r = pd.detect(png, scale_m_per_px=scale)
            assert not [w for w in r["walls"] if w["hollow"]] and r["stats"]["hollow"]["walls"] == 0, (content, scale, r["stats"]["hollow"])
            on_line = [w for w in r["walls"] if all(abs(y - 515.5) < 20 for _, y in _px(w))]
            assert on_line == [], (content, scale, [_px(w) for w in on_line])


def test_a_tribune_railing_and_stair_treads_are_rejected_by_their_rules(monkeypatch):
    """A railing drawn as a double line 0.2 m apart, wall to wall, above five tribune rows 0.9 m apart; a stair of nine
    treads 0.28 m apart from the east wall. Neither is a hollow wall: the tribune rule takes the railing (without it the
    railing would be one), the stack rule takes the treads (without it they would pair)."""
    im = Image.new("L", (1600, 1200), 255)
    d = ImageDraw.Draw(im)
    d.rectangle([100, 100, 1500, 1100], outline=0, width=16)
    d.rectangle([116, 300, 1484, 301], fill=0)
    d.rectangle([116, 320, 1484, 321], fill=0)
    for k in range(1, 6):
        d.rectangle([116, 320 + 90 * k, 1484, 321 + 90 * k], fill=0)
    for k in range(9):
        d.rectangle([1324, 850 + 28 * k, 1484, 851 + 28 * k], fill=0)
    png = _png(im)
    r = pd.detect(png, scale_m_per_px=S)
    rules = r["stats"]["hollow"]["rules"]
    assert not [w for w in r["walls"] if w["hollow"]] and rules["spacing"] == 1 and rules["tribune"] == 0, r["stats"]["hollow"]
    monkeypatch.setattr(pdh, "_tribune", lambda *a, **k: False)
    rail = [w for w in pd.detect(png, scale_m_per_px=S)["walls"] if w["hollow"]]
    assert len(rail) == 1 and all(abs(y - 310.5) < 1.0 for _, y in _px(rail[0])), "without the tribune rule the railing would be a wall"
    monkeypatch.setattr(pdh, "_stacked", lambda *a, **k: False)
    assert pd.detect(png, scale_m_per_px=S)["stats"]["hollow"]["pairs"] > r["stats"]["hollow"]["pairs"], "without the stack rule the treads pair"


def test_two_solid_walls_075_m_apart_give_the_pass_no_stroke():
    """The T-junction fixture of test_plan_detect_walls (its second picture, unchanged there): 12 px walls, inner walls
    0.75 m inside the frame with walls crossing between them. Its strokes are as thick as the median wall (rule 1), so
    the pass finds no stroke and the eight solid walls stay."""
    im = Image.new("L", (1600, 1200), 255)
    d = ImageDraw.Draw(im)
    d.rectangle([50, 50, 1550, 1150], outline=0, width=12)
    for x in (130, 1460):
        d.rectangle([x, 50, x + 11, 1150], fill=0)
    for y in (130, 1060):
        d.rectangle([50, y, 1550, y + 11], fill=0)
    for scale in (S, None):
        r = pd.detect(_png(im), targets=("walls",), scale_m_per_px=scale)
        assert r["stats"]["hollow"]["strokes"] == 0 and r["stats"]["hollow"]["walls"] == 0, r["stats"]["hollow"]
        assert len(r["walls"]) == 8 and not any(w["hollow"] for w in r["walls"])
    # the same geometry drawn as 2 px lines is a pair of rule 1 but 0.8 m apart, above HOLLOW_SPACING_M
    assert pdh.HOLLOW_SPACING_M[1] < 0.8


def test_the_synthetic_set_has_no_hollow_wall_and_every_wall_carries_the_flag():
    for calibrated in (True, False):
        for name, gt, png in pm.load_set():
            r = pd.detect(png, scale_m_per_px=gt["scale_m_per_px"] if calibrated else None)
            assert all(w["hollow"] is False for w in r["walls"]), (name, calibrated)
            assert r["stats"]["hollow"]["walls"] == 0 and r["stats"]["hollow"]["version"] == pdh.HOLLOW_VERSION, (name, calibrated, r["stats"]["hollow"])


def test_the_pass_keeps_the_deadline_and_its_cost_is_bounded():
    png = _png(_outline_with_door_and_window())
    st = pd._stage(Image.open(io.BytesIO(png)).convert("L"), 0.6, pd.ANALYSIS_PX, S)

    def expired() -> None:
        raise pd.DetectTimeout("test")

    with pytest.raises(pd.DetectTimeout):
        pdh.find_hollow(st["segs"], st["an"], st["s"], st["t_med"], expired)
    kept, hollow, stats = pdh.find_hollow(st["segs"], st["an"], st["s"], st["t_med"])
    assert len(hollow) == stats["walls"] and all(g.hollow and g.axis for g in hollow)
    assert len(kept) == len(st["segs"]) - stats["absorbed"]


def test_axis_strokes_measure_thin_runs_only():
    m = np.zeros((60, 200), dtype=bool)
    m[10:12, 20:180] = True  # a 2 px line, 1.6 m
    m[30:42, 20:180] = True  # a 12 px band: no stroke
    m[50:52, 20:40] = True  # too short
    strokes = pdh.axis_strokes(m, 40, 5.0)
    assert [(round(st.c, 1), st.lo, st.hi, st.t) for st in strokes] == [(10.5, 20, 179, 2.0)]
