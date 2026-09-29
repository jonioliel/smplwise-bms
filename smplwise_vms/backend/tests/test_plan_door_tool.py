"""The "סמן דלת" tool (T087, services/plan_door_tool.py and POST /plan-versions/{id}/door-proposal): one click on a door
symbol proposes the door. Synthetic crops for the conventions the study measured on the owner's scans - a 90 degree
leaf with its quarter arc, with the straight chord ("triangle"), a single leaf open at 45 degrees (stall door), a "V"
double door - plus a bare gap, nothing at all, and every hinge / swing / wall direction; the draft wall the door goes on
(or the short wall piece it brings when there is none); the search reads only its crop and keeps its deadline. The
route: map.edit only, bounded input, nothing stored or audited, 422 when there is nothing to place a door on, 504 past
its deadline, and a real proposal on the apartment fixture."""
from __future__ import annotations

import dataclasses
import json
import math
import time

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFilter

import plan_detect_metrics as pm
from conftest import as_user, bind, seed_tree, sw_perf_enabled, sw_time_factor
from smplwise.main import create_app
from smplwise.services import plan_door_tool as pdt

SCALE = 0.01  # 1 cm per pixel: a 0.9 m door is 90 px
W, H = 800, 600
WALL_Y = 300
T = 14  # wall thickness (px)


def _plan(gap: tuple[float, float] | None = (355, 445), vertical: bool = False) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    """A room: a 14 px wall across the picture (horizontal at y 300, or vertical at x 400) with an opening, plus a
    few other walls far from it."""
    im = Image.new("L", (W, H), 255)
    d = ImageDraw.Draw(im)
    for box in ((40, 40, 760, 54), (40, 546, 760, 560), (40, 40, 54, 560), (746, 40, 760, 560)):
        d.rectangle(box, fill=0)
    if not vertical:
        d.rectangle((40, WALL_Y - T // 2, 760, WALL_Y + T // 2 - 1), fill=0)
        if gap:
            d.rectangle((gap[0], WALL_Y - T // 2 - 1, gap[1] - 1, WALL_Y + T // 2), fill=255)
    else:
        d.rectangle((400 - T // 2, 40, 400 + T // 2 - 1, 560), fill=0)
        if gap:
            d.rectangle((400 - T // 2 - 1, gap[0], 400 + T // 2, gap[1] - 1), fill=255)
    return im, d


def _arc(d: ImageDraw.ImageDraw, c, r: float, a0: float, a1: float, width: int = 2) -> None:
    da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
    d.line([(c[0] + r * math.cos(a0 + da * k / 40), c[1] + r * math.sin(a0 + da * k / 40)) for k in range(41)], fill=0, width=width)


def _door(d, hinge, latch, n, style: str = "arc", width: int = 2) -> tuple:
    """A 90 degree leaf from `hinge` along the unit normal `n` (the swing side), as long as hinge -> latch, with its
    quarter arc ("arc") or the straight chord from the tip to the latch ("chord")."""
    h, l, n = np.array(hinge, float), np.array(latch, float), np.array(n, float)
    r = float(np.hypot(*(l - h)))
    tip = h + n * r
    d.line([tuple(h), tuple(tip)], fill=0, width=width)
    if style == "arc":
        _arc(d, h, r, math.atan2(*(tip - h)[::-1]), math.atan2(*(l - h)[::-1]), width)
    else:
        d.line([tuple(tip), tuple(l)], fill=0, width=width)
    return tuple(tip)


def _pic(im: Image.Image, blur: float = 1.0) -> dict:
    """The picture as the tool reads it, softened like a 300 dpi scan."""
    return pdt.prepare(np.asarray(im.filter(ImageFilter.GaussianBlur(blur)) if blur else im))


def _wall(x0=40, y0=WALL_Y, x1=760, y1=WALL_Y, wid="w1") -> dict:
    return {"id": wid, "polyline": [[x0 / W, y0 / H], [x1 / W, y1 / H]], "thickness_m": T * SCALE, "level_id": "L0"}


def _centre(r: dict, walls: list[dict]) -> np.ndarray:
    poly = r["new_wall"]["polyline"] if r["new_wall"] else next(w for w in walls if w["id"] == r["wall_id"])["polyline"]
    a, b = np.array(poly[0]) * [W, H], np.array(poly[1]) * [W, H]
    return a + (b - a) * r["t"]


def _propose(pic, click, walls=(), calibrated=True, **kw) -> dict:
    return pdt.propose(pic, click[0] / W, click[1] / H, list(walls), SCALE if calibrated else 0.2 / (0.006 * W), calibrated, **kw)


# ---------------------------------------------------------------- the conventions

@pytest.mark.parametrize("style", ["arc", "chord"])
def test_a_90_degree_leaf_with_its_arc_or_chord_is_proposed_on_the_wall(style):
    im, d = _plan()
    _door(d, (355, WALL_Y - T / 2), (445, WALL_Y - T / 2), (0, -1), style)
    walls = [_wall()]
    r = _propose(_pic(im), (385, 250), walls)
    assert r["found"] == style and r["note"] == pdt.NOTES[style]
    assert r["wall_id"] == "w1" and r["new_wall"] is None and r["warning"] is None
    assert abs(r["width_px"] - 90) <= 9, r
    assert np.hypot(*(_centre(r, walls) - (400, WALL_Y))) <= 10
    assert (r["hinge"], r["swing"]) == ("start", "left")  # the wall runs +x; its left normal (y, -x) points up the page
    assert 0.35 <= r["confidence"] <= 0.95


@pytest.mark.parametrize("hinge_end,up", [(False, True), (True, True), (False, False), (True, False)])
def test_every_hinge_and_swing_reproduces_the_drawing(hinge_end, up):
    im, d = _plan()
    face = WALL_Y - T / 2 if up else WALL_Y + T / 2
    h, l = ((445, face), (355, face)) if hinge_end else ((355, face), (445, face))
    _door(d, h, l, (0, -1) if up else (0, 1))
    walls = [_wall()]
    click = (400, WALL_Y - 40 if up else WALL_Y + 40)
    r = _propose(_pic(im), click, walls)
    assert r["found"] == "arc", r
    assert r["hinge"] == ("end" if hinge_end else "start") and r["swing"] == ("left" if up else "right")


def test_a_door_in_a_vertical_wall_drawn_bottom_to_top():
    im, d = _plan(vertical=True)
    _door(d, (400 + T / 2, 445), (400 + T / 2, 355), (1, 0))  # hinged at the lower jamb, the leaf opens to the right
    walls = [_wall(400, 560, 400, 40)]  # drawn upwards: direction (0, -1), left normal (-1, 0)
    r = _propose(_pic(im), (440, 410), walls)
    assert r["found"] == "arc" and r["wall_id"] == "w1"
    assert abs(r["width_px"] - 90) <= 9
    assert (r["hinge"], r["swing"]) == ("start", "right")  # hinged where the wall starts (its lower end), opening away from its left


def test_a_single_leaf_open_at_45_degrees_takes_the_width_of_its_jambs():
    im, d = _plan()
    h = np.array([355, WALL_Y - T / 2])
    tip = h + 90 * np.array([math.cos(math.radians(45)), -math.sin(math.radians(45))])
    d.line([tuple(h), tuple(tip)], fill=0, width=2)
    walls = [_wall()]
    r = _propose(_pic(im), (380, 270), walls)
    assert r["found"] == "leaf" and r["wall_id"] == "w1", r
    assert abs(r["width_px"] - 90) <= 10
    assert (r["hinge"], r["swing"]) == ("start", "left")


def test_a_v_double_door_spans_hinge_to_hinge():
    im, d = _plan(gap=(310, 490))
    for hx, sx in ((310, 1), (490, -1)):
        d.line([(hx, WALL_Y - T / 2), (400, WALL_Y - T / 2 - 90)], fill=0, width=2)
    walls = [_wall()]
    r = _propose(_pic(im), (400, 250), walls)
    assert r["found"] == "double" and r["swing"] == "double" and r["hinge"] == "start", r  # start = the wall's left side (up)
    assert abs(r["width_px"] - 180) <= 18
    assert np.hypot(*(_centre(r, walls) - (400, WALL_Y))) <= 12


def test_two_arc_leaves_meeting_in_the_middle_are_one_double_door():
    im, d = _plan(gap=(310, 490))
    _door(d, (310, WALL_Y + T / 2), (400, WALL_Y + T / 2), (0, 1))
    _door(d, (490, WALL_Y + T / 2), (400, WALL_Y + T / 2), (0, 1))
    walls = [_wall()]
    r = _propose(_pic(im), (400, 350), walls)
    assert r["found"] == "double" and r["swing"] == "double" and r["hinge"] == "end", r  # opens to the wall's right (down)
    assert abs(r["width_px"] - 180) <= 18


def test_a_bare_gap_on_a_drawn_wall_gives_its_width_and_the_clicked_side():
    im, d = _plan(gap=(350, 450))
    walls = [_wall(wid="hand")]
    r = _propose(_pic(im), (400, WALL_Y + 20), walls)
    assert r["found"] == "gap" and r["note"] == "נמצא פער" and r["wall_id"] == "hand"
    assert abs(r["width_px"] - 100) <= 6
    assert abs(_centre(r, walls)[0] - 400) <= 4
    assert r["swing"] == "right"  # the click was below the wall: the door opens towards it


def test_nothing_found_is_the_default_door_on_the_wall_clicked():
    im, _d = _plan(gap=None)
    walls = [_wall()]
    r = _propose(_pic(im), (230, WALL_Y - 12), walls)
    assert r["found"] == "default" and r["note"] == "ברירת מחדל - בדוק" and r["width_px"] is None and r["warning"]
    assert abs(_centre(r, walls)[0] - 230) <= 2 and r["swing"] == "left"


def test_a_click_off_every_wall_without_a_symbol_is_refused():
    im, _d = _plan(gap=None)
    with pytest.raises(pdt.NoWall):
        _propose(_pic(im), (230, 150), [])


def test_a_symbol_without_a_draft_wall_brings_its_own_wall_piece():
    im, d = _plan()
    _door(d, (355, WALL_Y - T / 2), (445, WALL_Y - T / 2), (0, -1))
    r = _propose(_pic(im), (385, 250), [])
    assert r["found"] == "arc" and r["wall_id"] is None and r["t"] == 0.5 and r["warning"]
    a, b = (np.array(p) * [W, H] for p in r["new_wall"]["polyline"])
    assert abs(a[1] - WALL_Y) <= 3 and abs(b[1] - WALL_Y) <= 3 and a[0] < b[0]  # along the drawn wall, on its centre line
    assert abs(np.hypot(*(b - a)) - (90 + 2 * pdt.JAMB_M / SCALE)) <= 12
    assert (r["hinge"], r["swing"]) == ("start", "left") and r["new_wall"]["thickness_px"] >= 8


def test_a_hand_drawn_wall_a_few_pixels_off_the_drawing_still_carries_the_door():
    im, d = _plan()
    _door(d, (355, WALL_Y - T / 2), (445, WALL_Y - T / 2), (0, -1))
    walls = [_wall(40, WALL_Y + 6, 760, WALL_Y + 6)]
    r = _propose(_pic(im), (385, 250), walls)
    assert r["found"] == "arc" and r["wall_id"] == "w1"


def test_a_door_sticking_out_of_a_short_drawn_wall_gets_a_wall_piece():
    """The draft wall stops at the left jamb (the door lies in the gap between two drawn walls): the door is not forced
    onto a wall it does not sit on."""
    im, d = _plan()
    _door(d, (355, WALL_Y - T / 2), (445, WALL_Y - T / 2), (0, -1))
    walls = [_wall(40, WALL_Y, 355, WALL_Y, "left"), _wall(445, WALL_Y, 760, WALL_Y, "right")]
    r = _propose(_pic(im), (385, 250), walls)
    assert r["wall_id"] is None and r["new_wall"] is not None and r["found"] == "arc"


def test_uncalibrated_the_walls_around_the_click_set_the_size():
    im, d = _plan()
    _door(d, (355, WALL_Y - T / 2), (445, WALL_Y - T / 2), (0, -1))
    r = _propose(_pic(im), (385, 250), [_wall()], calibrated=False)
    assert r["found"] == "arc" and abs(r["width_px"] - 90) <= 9
    assert r["scale"]["calibrated"] is False and abs(r["scale"]["wall_px"] - T) <= 3


def test_a_round_table_by_the_wall_is_not_a_door():
    im, d = _plan(gap=None)
    d.ellipse((330, WALL_Y - T / 2 - 100, 430, WALL_Y - T / 2), outline=0, width=2)
    r = _propose(_pic(im), (380, 250), [_wall()])
    assert r["found"] in ("default", "gap") or r["confidence"] < 0.6, r


# ---------------------------------------------------------------- bounds

def test_the_search_reads_only_its_crop():
    im, d = _plan()
    _door(d, (355, WALL_Y - T / 2), (445, WALL_Y - T / 2), (0, -1))
    base = np.asarray(im.filter(ImageFilter.GaussianBlur(1.0))).copy()
    r1 = _propose(pdt.prepare(base), (385, 250), [_wall()])
    reach = int(math.ceil(pdt.CROP_LEAVES * pdt.LEAF_M[1] / SCALE + 8))
    noisy = base.copy()
    rng = np.random.RandomState(3)
    far = np.ones_like(noisy, dtype=bool)
    far[max(0, 250 - reach): 250 + reach + 1, max(0, 385 - reach): 385 + reach + 1] = False
    noisy[far & (rng.rand(*noisy.shape) < 0.3)] = 0
    pic2 = pdt.prepare(noisy)
    pic2["thr"] = pdt.prepare(base)["thr"]  # the whole-picture threshold aside, nothing outside the crop is read
    r2 = _propose(pic2, (385, 250), [_wall()])
    strip = lambda r: {k: v for k, v in r.items() if k not in ("elapsed_ms", "stats")}
    assert strip(r1) == strip(r2)


def test_a_passed_deadline_stops_the_search():
    im, d = _plan()
    _door(d, (355, WALL_Y - T / 2), (445, WALL_Y - T / 2), (0, -1))
    with pytest.raises(TimeoutError):
        _propose(_pic(im), (385, 250), [_wall()], deadline=time.monotonic() - 1)


def test_one_click_is_quick():
    im, d = _plan()
    _door(d, (355, WALL_Y - T / 2), (445, WALL_Y - T / 2), (0, -1))
    pic = _pic(im)
    _propose(pic, (385, 250), [_wall()])
    t0 = time.perf_counter()
    for _ in range(3):
        _propose(pic, (385, 250), [_wall()])
    ms = (time.perf_counter() - t0) / 3 * 1000
    assert ms <= (300 if sw_perf_enabled() else 1500 * sw_time_factor()), ms


def test_the_picture_is_decoded_once_per_file(tmp_path):
    im, _d = _plan()
    path = tmp_path / "p.png"
    im.save(path)
    pdt.clear_cache()
    a = pdt.picture(path)
    assert pdt.picture(path) is a
    time.sleep(0.01)
    Image.new("L", (W, H), 255).save(path)
    assert pdt.picture(path) is not a  # a new file is a new key


# ---------------------------------------------------------------- the route

def _setup(settings, **overrides):
    settings = dataclasses.replace(settings, max_render_px=1600, **overrides)
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    apartment = next(png for name, _gt, png in pm.load_set() if name == "apartment")
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("apartment.png", apartment, "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return app, c, ids, v["id"]


# the apartment fixture (tests/fixtures/plan_detect, 1600 x 1200, 0.01 m / px): the door in the partition x 800,
# hinged at y 355, the leaf to the right; a click inside its swing
DOOR_CLICK = (830 / 1600, 385 / 1200)


def test_the_route_proposes_a_door_and_stores_nothing(settings):
    app, c, ids, vid = _setup(settings)
    before = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    # calibrated as a person would: two points 13.6 m apart
    cal = c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"pairs": [{"a": [120 / 1600, 0.5], "b": [1480 / 1600, 0.5], "metres": 13.6}]})
    assert cal.status_code == 200, cal.text
    with app.state.db.connection() as conn:
        audits = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
    r = c.post(f"/api/v1/plan-versions/{vid}/door-proposal", json={"x": DOOR_CLICK[0], "y": DOOR_CLICK[1]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["found"] == "arc" and body["version_id"] == vid and body["level_id"] == "L0"
    assert abs(body["width_px"] - 90) <= 9 and body["wall_id"] is None and body["new_wall"] is not None  # no wall drawn yet
    assert body["scale"]["calibrated"] is True and body["elapsed_ms"] >= 0
    # a wall drawn through the door carries it
    doc = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    doc_body = doc["doc"]
    doc_body["walls"] = [{"id": "hand1", "level_id": "L0", "polyline": [[0.5, 0.1], [0.5, 0.9]], "thickness_m": 0.1, "height_m": None, "base_z_m": 0,
                          "kind": "interior", "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}]
    saved = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc_body, "base_revision": doc["geometry"]["revision"]})
    assert saved.status_code == 200, saved.text
    r2 = c.post(f"/api/v1/plan-versions/{vid}/door-proposal", json={"x": DOOR_CLICK[0], "y": DOOR_CLICK[1], "wall_id": "hand1", "level_id": "L0"}).json()
    assert r2["wall_id"] == "hand1" and r2["new_wall"] is None and abs(r2["t"] * 960 + 120 - 400) <= 10  # the wall runs y 120 -> 1080
    assert (r2["hinge"], r2["swing"]) == ("start", "left")  # the wall runs down the page: its left normal points right
    after = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    assert after["doc"]["openings"] == [] and after["geometry"]["revision"] == saved.json()["geometry"]["revision"], "a proposal is never stored"
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action LIKE 'geometry.door%'").fetchone()[0] == 0
        # the save above wrote its own rows; the proposals none
        assert conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0] >= audits
    assert before["doc"]["openings"] == []


def test_the_route_needs_map_edit_and_bounded_input(settings):
    app, c, ids, vid = _setup(settings)
    url = f"/api/v1/plan-versions/{vid}/door-proposal"
    for bad in ({"x": -0.1, "y": 0.5}, {"x": 0.5, "y": 1.2}, {"x": 0.5}, {"x": "a", "y": 0.5}, {"x": 0.5, "y": 0.5, "wall_id": ""}):
        assert c.post(url, json=bad).status_code == 422, bad
    r = c.post(url, json={"x": 0.5, "y": 0.5, "wall_id": "nope"})
    assert r.status_code == 422 and r.json()["code"] == "unknown_wall"
    r = c.post(url, json={"x": 0.5, "y": 0.5, "level_id": "L9"})
    assert r.status_code == 422 and r.json()["code"] == "unknown_level"
    bind(c, settings, "dana", "viewer", "floor", ids["floor2"])
    assert c.post(url, json={"x": DOOR_CLICK[0], "y": DOOR_CLICK[1]}, headers=as_user("dana")).status_code == 403
    bind(c, settings, "eli", "editor", "floor", ids["floor2"])
    assert c.post(url, json={"x": DOOR_CLICK[0], "y": DOOR_CLICK[1]}, headers=as_user("eli")).status_code == 200
    assert c.post("/api/v1/plan-versions/nope/door-proposal", json={"x": 0.5, "y": 0.5}).status_code == 404


def test_the_route_refuses_a_click_with_nothing_to_place_a_door_on(settings):
    app, c, ids, vid = _setup(settings)
    r = c.post(f"/api/v1/plan-versions/{vid}/door-proposal", json={"x": 0.3, "y": 0.35})  # the middle of a room, no wall drawn
    assert r.status_code == 422 and r.json()["code"] == "no_wall"


def test_the_route_answers_504_past_its_deadline(settings, monkeypatch):
    def slow(*args, **kwargs):
        time.sleep(0.8)
        return {}

    monkeypatch.setattr(pdt, "propose", slow)
    app, c, ids, vid = _setup(settings, detect_timeout_s=0.2)
    t0 = time.perf_counter()
    r = c.post(f"/api/v1/plan-versions/{vid}/door-proposal", json={"x": 0.5, "y": 0.5})
    assert r.status_code == 504 and r.json()["code"] == "door_proposal_timeout" and r.json()["retryable"] is True
    assert time.perf_counter() - t0 < 0.8 * sw_time_factor() + 0.5
