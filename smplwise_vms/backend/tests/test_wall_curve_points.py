"""Walls drawn through points (WALLP, owner request 2026-10-08): the frontend's "קיר מעוגל" tool fits a smooth curve
through the clicked points (frontend/src/map/curve-fit.ts: circle tangents and biarcs) and stores it in the existing
curved-wall model - polyline + bulges, schema 2.1 - with the clicked points' polyline indices in
external_ids.curve_through. Nothing new on the server: these tests pin that every consumer takes such a wall as it is.

contracts/fixtures/plan_geometry/sample-curve-points.json is produced by the frontend fit and pinned there by
tests/unit-curve-fit.spec.ts (every wall re-fits to itself): an open wavy wall with a door and a window, a closed ring
(a round room through four points), a curved glass wall through three points (one arc) and a wavy glass wall."""
from __future__ import annotations

import copy
import io
import json
import math
import pathlib

import ezdxf
import pytest

from smplwise.services import plan_dxf_export as dxf_export
from smplwise.services import plan_dxf_map
from smplwise.services import plan_geometry as pg
from smplwise.services import plan_geometry_render as render
from smplwise.services import plan_glass
from smplwise.services import wall_path as wp

FIX = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "plan_geometry"
W, H = 1000, 800


def _doc() -> dict:
    return json.loads((FIX / "sample-curve-points.json").read_text(encoding="utf-8"))


def _wall(doc: dict, wid: str) -> dict:
    return next(w for w in doc["walls"] if w["id"] == wid)


def _through(w: dict) -> list[int]:
    return [int(x) for x in w["external_ids"]["curve_through"].split(",")]


def _kink_deg(pts: list, bulges: list, closed: bool) -> float:
    """The largest turn between the tangent arriving at a corner and the one leaving it (inner corners, and the closing
    corner of a ring)."""
    worst = 0.0
    n = len(pts)
    for c in range(1, n - 1 + (1 if closed else 0)):
        seg_in = c - 1
        seg_out = 0 if c == n - 1 else c
        a = wp.point_at([pts[seg_in], pts[seg_in + 1]], [bulges[seg_in]], wp.seg_length(pts[seg_in], pts[seg_in + 1], bulges[seg_in]))[1]
        b = wp.point_at([pts[seg_out], pts[seg_out + 1]], [bulges[seg_out]], 0.0)[1]
        worst = max(worst, abs(math.degrees(math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]))))
    return worst


def test_the_fixture_validates_as_2_1_and_keeps_the_clicked_points():
    doc = _doc()
    assert [i for i in pg.validate(doc) if i["severity"] == "error"] == []
    assert pg.document_version(doc) == "2.1"
    out = pg.normalize(doc, {})
    for w in doc["walls"]:
        assert _wall(out, w["id"])["external_ids"]["curve_through"] == w["external_ids"]["curve_through"], "normalize keeps the record"
        assert _wall(out, w["id"])["bulges"] == w["bulges"]


def test_the_curve_passes_through_its_clicked_points_and_is_smooth():
    doc = _doc()
    for w in doc["walls"]:
        pts, bulges = wp.wall_px(w, W, H)
        closed = w["polyline"][0] == w["polyline"][-1]
        idx = _through(w)
        assert idx[0] == 0 and (closed or idx[-1] == len(pts) - 1)
        assert _kink_deg(pts, bulges, closed) < 0.05, w["id"]
        assert all(abs(b) <= wp.MAX_BULGE for b in bulges)
    # three points: one arc (no junction), both spans on the same circle
    g = _wall(doc, "cp-glass")
    assert len(g["polyline"]) == 3 and _through(g) == [0, 1, 2]
    pts, bulges = wp.wall_px(g, W, H)
    a0 = wp.arc_of(pts[0], pts[1], bulges[0])
    a1 = wp.arc_of(pts[1], pts[2], bulges[1])
    assert a0 and a1 and math.hypot(a0[0] - a1[0], a0[1] - a1[1]) < 0.05 and a0[2] == pytest.approx(a1[2], abs=0.05)


def test_doors_and_windows_sit_on_the_curve():
    doc = _doc()
    issues = pg.validate(doc)
    assert not [i for i in issues if i.get("id") in ("op-door", "op-window") and i["severity"] == "error"]
    prims = render.structure_primitives(doc, W, H)
    w = _wall(doc, "cp-open")
    pts, bulges = wp.wall_px(w, W, H)
    door = next(p for p in prims if p["kind"] == "door" and p["id"] == "op-door")
    for e in door["gap"]:
        assert wp.project(pts, bulges, (e[0], e[1]))[1] < 0.5, "the door's gap ends lie on the arc"
    parts = [p for p in prims if p["kind"] == "wall" and p["id"] == "cp-open"]
    assert len(parts) == 3, "the door and the window cut the wall into three parts"
    assert all(p.get("arc") for p in parts)


def test_the_ring_is_a_round_room_with_an_area():
    w = _wall(_doc(), "cp-ring")
    pts, bulges = wp.wall_px(w, W, H)
    area_m2 = abs(wp.ring_area(pts, bulges)) * 0.01 * 0.01
    corners = [(p[0] * W, p[1] * H) for i, p in enumerate(w["polyline"]) if i in _through(w)]
    poly = abs(sum(corners[i][0] * corners[(i + 1) % 4][1] - corners[(i + 1) % 4][0] * corners[i][1] for i in range(4))) / 2 * 0.0001
    assert poly < area_m2 < poly * 1.7, "a round room bulges past its four points"


def test_curved_glass_through_points_glazes_along_the_curve():
    doc = _doc()
    prims = render.structure_primitives(doc, W, H)
    for wid in ("cp-glass", "cp-glass-wave"):
        w = _wall(doc, wid)
        assert w["kind"] == "glass"
        glz = next(p for p in prims if p["kind"] == "glazing" and p["id"] == wid)
        pts, bulges = wp.wall_px(w, W, H)
        assert len(glz["panels"]) == plan_glass.panel_count(wp.path_length(pts, bulges) * 0.01, plan_glass.glazing_of(w))
        for q in glz["panels"]:
            for e in (q["a"], q["b"]):
                assert wp.project(pts, bulges, (e[0], e[1]))[1] < 0.3, f"{wid}: a panel end off the curve"
        # no corner post at the junctions: the curve is smooth there (posts only at turns over 20 degrees)
        assert len(glz["mullions"]) == len(glz["panels"]) - 1


def test_dxf_writes_the_curves_as_arcs_and_reads_them_back():
    doc = _doc()
    data = dxf_export.render_dxf(doc, [], W, H)
    src = ezdxf.read(io.StringIO(data.decode("utf-8")))
    walls = [e for e in src.modelspace().query("LWPOLYLINE") if e.dxf.layer == "SW_WALLS"]
    ids = {e.get_xdata(dxf_export.APP_ID)[0].value for e in walls}
    assert {"cp-open", "cp-ring"} <= ids
    for e in walls:
        assert any(abs(b) > 1e-6 for *_xy, b in e.get_points("xyb")), "bulged LWPOLYLINE (true arcs)"
    glass = [e for e in src.modelspace().query("LWPOLYLINE") if e.dxf.layer == "SW_GLAZING"]
    assert glass and all(any(abs(b) > 1e-6 for *_xy, b in e.get_points("xyb")) for e in glass)
    # the project's own importer reads the open wall and the ring back as curved candidates
    whole = copy.deepcopy(doc)
    whole["openings"] = []
    whole["walls"] = [w for w in whole["walls"] if w["kind"] != "glass"]
    data = dxf_export.render_dxf(whole, [], W, H)
    src = ezdxf.read(io.StringIO(data.decode("utf-8")))
    ents = plan_dxf_map.read_entities(src, ["SW_WALLS"])
    extent = plan_dxf_map.extent_for(src, ["SW_WALLS"], ents)
    got = plan_dxf_map.map_geometry(src, layer_map={"SW_WALLS": "walls"}, block_map={}, units="m", extent=extent, rotation=0, crop=None, level_id="L0",
                                    run_id="rt", catalog=[], scale_m_per_px=None, entities=ents)
    curved = [w for w in got["walls"] if w.get("bulges")]
    assert len(curved) == 2
    ring = _wall(doc, "cp-ring")
    back = next(w for w in curved if w["polyline"][0] == w["polyline"][-1])
    assert sorted(round(b, 5) for b in back["bulges"] if b) == sorted(round(b, 5) for b in ring["bulges"] if b)


def test_saved_and_packaged_with_the_clicked_points(settings):
    from conftest import png_bytes, seed_tree
    from fastapi.testclient import TestClient

    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    vid = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()["id"]
    assert c.post(f"/api/v1/plan-versions/{vid}/publish").status_code == 200
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    s = _doc()
    doc = dict(g["doc"], walls=s["walls"], openings=s["openings"])
    doc["schema_version"] = "2.0"  # the server stamps what the walls need
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": 0})
    assert r.status_code == 200, r.text
    stored = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["doc"]
    assert stored["schema_version"] == "2.1"
    for w in s["walls"]:
        got = _wall(stored, w["id"])
        assert got["external_ids"]["curve_through"] == w["external_ids"]["curve_through"]
        assert got["polyline"] == w["polyline"] and got["bulges"] == w["bulges"]
    pkg = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": True})
    assert pkg.status_code == 200
    import zipfile

    with zipfile.ZipFile(io.BytesIO(pkg.content)) as z:
        plan = json.loads(z.read("plan.json"))
    assert _wall(plan, "cp-ring")["external_ids"]["curve_through"] == _wall(s, "cp-ring")["external_ids"]["curve_through"]
