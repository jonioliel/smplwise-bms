"""Plan Studio detection tuning, detector 1.4 (T086, the 0.1.90 list items 3-6 measured on the owner's real scans, which
stay private; synthetic pictures only here, fixtures/plan_detect_tuning/gen_tuning.py): section-cut lines that cross the
envelope are no walls; a white gap under 0.3 m with no symbol joins its two pieces (no passage); a tribune is proposed as
a steps object (library item tribune.stepped); a pier grid as column objects with the envelope line between the edge
columns, the sides of each pier's outline no wall stubs. Every rule is a request option, on by default: each plan is
scored with its rule on and off, the committed synthetic set must come out identical, and the route passes the options
through and accepts the object candidates."""
from __future__ import annotations

import dataclasses
import json
import sys

import numpy as np
from PIL import Image

from conftest import seed_tree
from fastapi.testclient import TestClient

import plan_detect_metrics as pm
from smplwise.main import create_app
from smplwise.services import plan_detect as pd
from smplwise.services import plan_detect_objects as pdo

sys.path.insert(0, str(pm.TUNING))
import gen_tuning as gen  # noqa: E402

NAMES = ["reference", "steps", "fragments", "piers"]
OFF = {"section_lines": False, "join_gaps": False, "steps_regions": False, "columns": False}


def _plan(name: str) -> tuple[dict, bytes]:
    return next((gt, png) for n, gt, png in pm.load_set(pm.TUNING) if n == name)


def _run(name: str, calibrated: bool = True, **opts) -> tuple[dict, dict, dict]:
    gt, png = _plan(name)
    r = pd.detect(png, scale_m_per_px=gt["scale_m_per_px"] if calibrated else None, **opts)
    return gt, r, pm.evaluate(gt, r, 10.0)


def test_committed_tuning_fixtures_match_the_generator(tmp_path):
    assert list(gen.PLANS) == NAMES and gen.generate(tmp_path) == NAMES
    for name in NAMES:
        fresh = np.asarray(Image.open(tmp_path / f"{name}.png").convert("L"))
        kept = np.asarray(Image.open(pm.TUNING / f"{name}.png").convert("L"))
        assert kept.shape == (1200, 1600) and np.array_equal(fresh, kept), f"{name}.png differs from the generator: rerun gen_tuning.py"
        assert json.loads((tmp_path / f"{name}.json").read_text(encoding="utf-8")) == json.loads((pm.TUNING / f"{name}.json").read_text(encoding="utf-8")), name


def test_section_lines_crossing_the_envelope_are_no_walls():
    """Three section-cut lines cross the envelope (arrow bar outside, free end inside): suggested as walls before
    (precision 0.82), dropped with the rule; the free-standing wall inside and the garden wall leaving the envelope stay."""
    for calibrated in (True, False):
        _gt, r, e = _run("reference", calibrated)
        assert e["walls"]["precision"] >= 0.99 and e["walls"]["recall"] >= 0.99, (calibrated, e["walls"])
        assert r["stats"]["dropped_crossing"] >= 3 and "section_lines" not in r["detector"]["params"]
        assert e["doors"]["found"] == 2 and e["doors"]["false"] == 0
    _gt, r, e = _run("reference", **{"section_lines": False})
    assert e["walls"]["precision"] < 0.9 and e["walls"]["recall"] >= 0.99, e["walls"]
    assert r["detector"]["params"]["section_lines"] is False and "dropped_crossing" not in r["stats"]


def test_drop_reference_strokes_crossing_rule_on_segments():
    """The rule on segments (0.02 m / px): a 60 x 40 m hall. A stroke from 3 m inside to 5 m outside the hall with a bar
    at its outer end goes; a free-standing wall inside, a wall leaving the hall from its envelope (it touches it) and a
    wall parallel to the hall outside it (no end inside the box) stay; without `crossing` nothing changes."""
    s, t_med = 0.02, 6.0

    def sg(a, b, thick=6.0):
        return pd.Seg(np.array(a, float), np.array(b, float), [thick] * 5, axis=True)

    hall = [sg((0, 0), (3000, 0)), sg((3000, 0), (3000, 2000)), sg((3000, 2000), (0, 2000)), sg((0, 2000), (0, 0))]
    hall += [sg((x, 0), (x, 2000)) for x in (500, 1000, 1500, 2000, 2500)]
    keep = [sg((1200, 800), (1400, 800)), sg((3000, 1000), (3300, 1000)), sg((3040, 300), (3040, 1500))]
    stroke = [sg((1250, 150), (1250, -250), 4.0), sg((1230, -250), (1270, -250), 4.0)]
    counts: dict[str, int] = {}
    kept, outside, dropped = pd.drop_reference_strokes(hall + keep + stroke, t_med, s, crossing=True, counts=counts)
    assert dropped == 2 and counts["crossing"] == 2 and len(kept) == len(hall) + len(keep), [(g.a, g.b) for g in kept]
    kept, _outside, dropped = pd.drop_reference_strokes(hall + keep + stroke, t_med, s)
    assert dropped == 0 and len(kept) == len(hall) + len(keep) + 2


def test_short_gaps_join_and_are_no_passages():
    """Partitions broken by 0.1-0.24 m white gaps (one with a dimension tick across): one wall each with the rule
    (pieces per wall 1.0), and uncalibrated no false passage; the real 1.0 m passage and both doors stay."""
    for calibrated in (True, False):
        _gt, r, e = _run("fragments", calibrated)
        assert e["walls"]["pieces"] == 1.0 and e["walls"]["recall"] >= 0.99 and e["walls"]["precision"] >= 0.99, (calibrated, e["walls"])
        assert e["doors"]["found"] == 3 and e["doors"]["false"] == 0, (calibrated, e["doors"])
        assert [o["kind"] for o in r["openings"]].count("passage") == 1 and r["stats"]["joined_gaps"] >= 1
    _gt, _r, e = _run("fragments", True, join_gaps=False)
    assert e["walls"]["pieces"] > 1.0, e["walls"]
    _gt, _r, e = _run("fragments", False, join_gaps=False)
    assert e["doors"]["false"] >= 1, e["doors"]


def test_a_gap_between_a_hollow_and_a_solid_piece_is_not_joined():
    """Regression (the owner's floor 0): joining a solid piece and a hollow envelope piece across a 0.28 m gap made the
    hollow wall interior and lost the window carried onto it. Blank masks: no symbol in the gap, no wall across it."""
    s = 0.02
    blank = np.zeros((200, 400), dtype=bool)
    a = pd.Seg(np.array([20.0, 100.0]), np.array([150.0, 100.0]), [8.0] * 5, axis=True)
    b = pd.Seg(np.array([172.0, 100.0]), np.array([350.0, 100.0]), [8.0] * 5, axis=True)
    walls, openings = pd.walls_from_gaps([a, b], s, True, blank, blank, True, None, join_px=pd.JOIN_GAP_M / s)
    assert len(walls) == 1 and openings == []
    hollow_b = pd.Seg(b.a, b.b, b.samples, True, hollow=0.8)
    walls, _ = pd.walls_from_gaps([a, hollow_b], s, True, blank, blank, True, None, join_px=pd.JOIN_GAP_M / s)
    assert len(walls) == 2
    walls, _ = pd.walls_from_gaps([a, b], s, True, blank, blank, True, None)
    assert len(walls) == 2, "without join_px the gap keeps its pieces apart, as before"


def test_a_tribune_is_proposed_as_a_steps_object():
    """Seven lines 0.9 m apart (edges heavier): one tribune.stepped candidate of six rows, 12 x 5.4 m, and no wall among
    the rows; the stair's 0.3 m treads make no region. Off: no object, the walls unchanged."""
    for calibrated in (True, False):
        gt, r, e = _run("steps", calibrated)
        assert e["objects"]["steps"]["found"] == 1 and e["objects"]["steps"]["false"] == 0 and e["objects"]["column"]["false"] == 0, (calibrated, e["objects"])
        (o,) = r["objects"]
        assert o["item_id"] == pdo.STEPS_ITEM and o["source"] == "auto" and o["id"].startswith("auto-") and o["level_id"] == "L0" and o["rotation_deg"] == 0.0
        assert o["params"]["rows"] == 6 and o["params"]["step_height_m"] == 0.3 and 0 < o["confidence"] <= 0.9
        assert r["pixels"][o["id"]]["w_px"] > 0 and r["pixels"][o["id"]]["d_px"] > 0
        if calibrated:
            assert abs(o["size"]["w_m"] - 12.0) < 0.5 and abs(o["size"]["d_m"] - 5.4) < 0.4 and abs(o["params"]["step_width_m"] - 0.9) < 0.06, o
        rows = [w for w in r["walls"] if all(490 <= p[0] * 1600 <= 1110 and 290 <= p[1] * 1200 <= 580 for p in w["polyline"])]
        assert rows == [] and e["walls"]["precision"] >= 0.99, rows
    _gt, r, e = _run("steps", steps_regions=False)
    assert r["objects"] == [] and r["detector"]["params"]["steps_regions"] is False and e["walls"]["precision"] >= 0.99


def test_a_pier_grid_is_proposed_as_columns_with_the_envelope_between_them():
    """Nine 0.9 m pier boxes every 6 m on three sides with faint glazing between: nine column candidates, the pier
    outlines no stubs, the envelope along the three rows (exterior, capped confidence), the lone 0.4 m column inside
    not proposed. Off: the envelope is missing (recall 0.50) and the outlines' sides are stubs (precision 0.80)."""
    for calibrated in (True, False):
        gt, r, e = _run("piers", calibrated)
        assert e["objects"]["column"]["found"] == 9 and e["objects"]["column"]["false"] == 0 and e["objects"]["steps"]["false"] == 0, (calibrated, e["objects"])
        assert e["walls"]["recall"] >= 0.95 and e["walls"]["precision"] >= 0.95, (calibrated, e["walls"])
        assert r["stats"]["envelope_walls"] >= 3 and r["stats"]["columns"] == 9
        env = [w for w in r["walls"] if w["confidence"] == pdo.ENVELOPE_CONF]
        assert len(env) == r["stats"]["envelope_walls"] and all(w["kind"] == "exterior" for w in env)
        for c in gt["objects"]:  # no wall lies wholly inside a pier
            x, y = c["centre"]
            assert not [w for w in r["walls"] if all(abs(p[0] * 1600 - x) <= 25 and abs(p[1] * 1200 - y) <= 25 for p in w["polyline"])], c
        assert not [o for o in r["objects"] if abs(o["position"][0] * 1600 - 1150) < 30 and abs(o["position"][1] * 1200 - 550) < 30]
        assert all(o["item_id"] == pdo.COL_ITEM and o["size"]["h_m"] == pdo.COL_HEIGHT_M for o in r["objects"])
    _gt, r, e = _run("piers", columns=False)
    assert r["objects"] == [] and e["walls"]["recall"] < 0.6 and e["walls"]["precision"] < 0.85, e["walls"]


def test_column_rows_need_a_regular_spacing_and_bridge_a_lost_column():
    def blob(x, y, side=40.0):
        return {"cx": float(x), "cy": float(y), "w": side, "h": side}

    row = [blob(x, 500) for x in (100, 400, 700, 1000)]
    assert pdo._runs(row, 100, 600, 0) == [[0, 1, 2, 3]]
    assert pdo._runs(row[:2], 100, 600, 0) == [], "two columns are no row"
    lost = [blob(x, 500) for x in (100, 400, 1000, 1300)]  # 700 lost: a double spacing is bridged
    assert pdo._runs(lost, 100, 600, 0) == [[0, 1, 2, 3]]
    uneven = [blob(x, 500) for x in (100, 400, 550, 1000)]
    assert pdo._runs(uneven, 100, 600, 0) == []
    sizes = [blob(100, 500), blob(400, 500, 80.0), blob(700, 500)]
    assert pdo._runs(sizes, 100, 600, 0) == [], "columns of one row are about one size"
    assert pdo._runs([blob(500, y) for y in (100, 400, 700)], 100, 600, 1) == [[0, 1, 2]]


def test_components_of_a_mask():
    m = np.zeros((20, 30), dtype=bool)
    m[2:6, 2:8] = True
    m[6:9, 5] = True  # joined below
    m[10:15, 20:25] = True
    comps = sorted(pdo._components(m))
    assert comps == [(2, 2, 7, 8, 27), (20, 10, 24, 14, 25)]
    assert pdo._components(np.zeros((5, 5), dtype=bool)) == []


def test_the_committed_synthetic_set_is_unchanged_by_the_new_rules():
    """The six plans of the phase-3 set carry none of these drawings: every rule on or off, the same walls and openings,
    and no object."""
    for name, gt, png in pm.load_set():
        on = pd.detect(png, scale_m_per_px=gt["scale_m_per_px"])
        off = pd.detect(png, scale_m_per_px=gt["scale_m_per_px"], **OFF)
        assert on["walls"] == off["walls"] and on["openings"] == off["openings"], name
        assert on["objects"] == [] and off["objects"] == [], name


def _setup(settings, png: bytes):
    app = create_app(dataclasses.replace(settings, max_render_px=1600))
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("steps.png", png, "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return app, c, v["id"]


def test_the_route_passes_the_options_and_accepts_an_object_candidate(settings):
    _gt, png = _plan("steps")
    app, c, vid = _setup(settings, png)
    r = c.post(f"/api/v1/plan-versions/{vid}/detect", json={})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["detector"]["version"] == pd.VERSION == "1.4" and body["existing_auto"] == {"walls": 0, "openings": 0, "objects": 0}
    (tribune,) = body["objects"]
    assert tribune["item_id"] == "tribune.stepped" and tribune["params"]["rows"] == 6
    off = c.post(f"/api/v1/plan-versions/{vid}/detect", json=OFF).json()
    assert off["objects"] == [] and all(off["detector"]["params"][k] is False for k in OFF)
    assert c.post(f"/api/v1/plan-versions/{vid}/detect", json={"columns": "maybe"}).status_code == 422
    accept = {"accepted": [w["id"] for w in body["walls"]] + [tribune["id"]], "edits": {}, "replace_auto": False,
              "candidates": {"walls": body["walls"], "openings": body["openings"], "objects": body["objects"]}, "base_revision": 0, "detector": body["detector"]}
    a = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=accept)
    assert a.status_code == 200, a.text
    doc = a.json()["doc"]
    assert [o["item_id"] for o in doc["objects"]] == ["tribune.stepped"] and doc["objects"][0]["source"] == "auto"
    assert a.json()["merge"]["accepted"] == {"walls": len(body["walls"]), "openings": 0, "objects": 1}
    assert not [i for i in a.json()["issues"] if i.get("item") == tribune["id"]], a.json()["issues"]
    again = c.post(f"/api/v1/plan-versions/{vid}/detect", json={}).json()
    assert again["existing_auto"] == {"walls": len(body["walls"]), "openings": 0, "objects": 1}
    with app.state.db.connection() as conn:
        rows = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.detect' ORDER BY rowid").fetchall()]
    assert rows[0]["objects"] == 1 and rows[1]["objects"] == 0
