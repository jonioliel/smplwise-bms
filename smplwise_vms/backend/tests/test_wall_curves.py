"""Curved walls (owner request 2026-10-08): the wall_path helper, the 2.1 document (bulges per segment), and every
consumer of a wall's geometry - validation, lengths and openings, areas, faces, primitives (SVG / PNG / map / 3D),
the DXF export and its read-back (ezdxf and the project's own importer), re-crop, candidates, diff and the signed
package round trip.

Golden files shared with the frontend mirror (frontend/src/map/wall-path.ts, tests/unit-wall-path.spec.ts):
contracts/fixtures/plan_geometry/wall-path.golden.json and sample-curved.primitives.json. Regenerate them with
SW_REGEN_GOLDEN=1 (then review the diff)."""
from __future__ import annotations

import copy
import io
import json
import math
import os
import pathlib

import ezdxf
import pytest

from smplwise.services import plan_dxf_export as dxf_export
from smplwise.services import plan_dxf_map
from smplwise.services import plan_geometry as pg
from smplwise.services import plan_geometry_render as render
from smplwise.services import wall_path as wp

FIX = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "plan_geometry"
REGEN = os.environ.get("SW_REGEN_GOLDEN") == "1"


def _curved() -> dict:
    return json.loads((FIX / "sample-curved.json").read_text(encoding="utf-8"))


def _straight() -> dict:
    return json.loads((FIX / "sample-v2.json").read_text(encoding="utf-8"))


def _r(v, k: int = 6):
    if isinstance(v, (list, tuple)):
        return [_r(x, k) for x in v]
    if isinstance(v, float):
        return round(v, k) + 0.0
    return v


def _wall(doc: dict, wid: str) -> dict:
    return next(w for w in doc["walls"] if w["id"] == wid)


# ---------------------------------------------------------------- golden values (shared with the frontend)

GOLDEN_SEGMENTS = [((0.0, 0.0), (200.0, 0.0), 1.0), ((0.0, 0.0), (200.0, 0.0), -1.0), ((10.0, 20.0), (110.0, 120.0), 0.414214),
                   ((300.0, 50.0), (300.0, 350.0), -0.25), ((0.0, 0.0), (100.0, 0.0), 2.5), ((5.0, 5.0), (65.0, 5.0), 0.0)]
GOLDEN_PATH = ([(100.0, 480.0), (300.0, 480.0), (300.0, 720.0), (500.0, 720.0)], [0.0, -0.414214, 0.3])


def golden_cases() -> dict:
    out: dict = {"segments": [], "path": {}, "through": [], "radius": [], "fillet": [], "area": [], "offset": {}}
    for a, b, bulge in GOLDEN_SEGMENTS:
        arc = wp.arc_of(a, b, bulge)
        out["segments"].append({"a": list(a), "b": list(b), "bulge": bulge, "arc": None if arc is None else _r(list(arc)), "length": _r(wp.seg_length(a, b, bulge)),
                                "sample_025": _r([list(p) for p in wp.sample([a, b], [bulge], 0.25)], 4), "sample_2": _r([list(p) for p in wp.sample([a, b], [bulge], 2.0)], 4)})
    pts, bulges = GOLDEN_PATH
    cum = wp.cumulative(pts, bulges)
    total = cum[-1]
    out["path"] = {"points": [list(p) for p in pts], "bulges": bulges, "cumulative": _r(cum), "length": _r(total),
                   "at": [{"s": _r(total * f), "point": _r(list(wp.point_at(pts, bulges, total * f)[0])), "tangent": _r(list(wp.point_at(pts, bulges, total * f)[1]))}
                          for f in (0.0, 0.1, 0.33, 0.5, 0.71, 1.0)],
                   "sub": [{"s0": _r(total * f0), "s1": _r(total * f1), "points": _r([list(p) for p in wp.sub_path(pts, bulges, total * f0, total * f1)[0]]),
                            "bulges": _r(wp.sub_path(pts, bulges, total * f0, total * f1)[1])} for f0, f1 in ((0.0, 1.0), (0.2, 0.6), (0.45, 0.55), (0.6, 0.95))],
                   "sample": _r([list(p) for p in wp.sample(pts, bulges)], 4),
                   "project": [{"q": list(q), "s": _r(wp.project(pts, bulges, q)[0], 4), "dist": _r(wp.project(pts, bulges, q)[1], 4)} for q in ((200.0, 470.0), (290.0, 600.0), (420.0, 760.0))]}
    for a, m, b in (((0.0, 0.0), (100.0, -100.0), (200.0, 0.0)), ((0.0, 0.0), (100.0, 30.0), (200.0, 0.0)), ((0.0, 0.0), (100.0, 0.0), (200.0, 0.0)),
                    ((50.0, 50.0), (20.0, 120.0), (90.0, 200.0))):
        out["through"].append({"a": list(a), "m": list(m), "b": list(b), "bulge": _r(wp.bulge_through(a, m, b))})
    for r, sign, major in ((100.0, 1.0, False), (150.0, -1.0, False), (150.0, 1.0, True), (99.0, 1.0, False)):
        got = wp.bulge_for_radius((0.0, 0.0), (200.0, 0.0), r, sign, major)
        out["radius"].append({"r": r, "sign": sign, "major": major, "bulge": None if got is None else _r(got)})
    square = [(0.0, 0.0), (100.0, 0.0), (100.0, 100.0), (0.0, 100.0), (0.0, 0.0)]
    for i, r in ((1, 20.0), (0, 30.0), (2, 100.0), (2, 120.0)):
        got = wp.fillet(square, [0.0] * 4, i, r)
        out["fillet"].append({"points": [list(p) for p in square], "i": i, "r": r, "result": None if got is None else {"points": _r([list(p) for p in got[0]]), "bulges": _r(got[1])}})
    for pts_a, b_a in (([(0.0, 0.0), (200.0, 0.0), (0.0, 0.0)], [1.0, 1.0]), (square, [0.0] * 4), (*wp.fillet(square, [0.0] * 4, 0, 30.0),),
                       ([(0.0, 0.0), (100.0, 0.0), (100.0, 100.0), (0.0, 100.0), (0.0, 0.0)], [0.0, -0.5, 0.0, 0.3])):
        out["area"].append({"points": [list(p) for p in pts_a], "bulges": list(b_a), "area": _r(wp.ring_area(pts_a, b_a), 4)})
    sampled = wp.sample(*GOLDEN_PATH)
    out["offset"] = {"left_10": _r([list(p) for p in wp.offset_polyline(sampled, 10.0)], 4), "right_10": _r([list(p) for p in wp.offset_polyline(sampled, -10.0)], 4)}
    return out


def test_golden_values_match_the_shared_file():
    path = FIX / "wall-path.golden.json"
    got = golden_cases()
    if REGEN:
        path.write_text(json.dumps(got, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    assert json.loads(path.read_text(encoding="utf-8")) == json.loads(json.dumps(got))


def test_curved_primitives_match_the_shared_file():
    doc = _curved()
    got = {"all": render.structure_primitives(doc, 1000, 800), "level_L0": render.structure_primitives(doc, 1000, 800, "L0")}
    path = FIX / "sample-curved.primitives.json"
    if REGEN:
        path.write_text(json.dumps(got, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    assert json.loads(path.read_text(encoding="utf-8")) == json.loads(json.dumps(got))


# ---------------------------------------------------------------- the helper itself

def test_semicircle_geometry():
    cx, cy, r, a0, sweep = wp.arc_of((0.0, 0.0), (2.0, 0.0), 1.0)
    assert (cx, cy, r) == pytest.approx((1.0, 0.0, 1.0)) and sweep == pytest.approx(math.pi)
    mid, tangent = wp.point_at([(0.0, 0.0), (2.0, 0.0)], [1.0], math.pi / 2)
    assert mid == pytest.approx((1.0, -1.0)) and tangent == pytest.approx((1.0, 0.0), abs=1e-12), "positive bulge bulges to screen-left (y down)"
    assert wp.seg_length((0.0, 0.0), (2.0, 0.0), 1.0) == pytest.approx(math.pi)


def test_sampling_respects_the_tolerance_and_keeps_corners():
    pts, bulges = [(0.0, 0.0), (400.0, 0.0), (400.0, 300.0)], [0.6, 0.0]
    for tol in (0.05, 0.25, 1.0, 5.0):
        s, ss = wp.sample_with_s(pts, bulges, tol)
        cx, cy, r, _a0, _sw = wp.arc_of(pts[0], pts[1], 0.6)
        for (x0, y0), (x1, y1) in zip(s, s[1:]):
            if (x1, y1) == pts[2]:
                continue
            mx, my = (x0 + x1) / 2, (y0 + y1) / 2
            assert r - math.hypot(mx - cx, my - cy) <= tol + 1e-9  # the chord's middle stays within tol of the arc
        assert s[0] == pts[0] and pts[1] in s and s[-1] == pts[2]
        assert ss[-1] == pytest.approx(wp.path_length(pts, bulges))
    assert len(wp.sample(pts, bulges, 0.05)) > len(wp.sample(pts, bulges, 5.0))
    assert len(wp.sample([(0.0, 0.0), (1e6, 0.0)], [1.0], 1e-9)) - 1 == wp.MAX_SEGMENTS, "bounded"


def test_sub_path_keeps_the_circle():
    pts, bulges = [(0.0, 0.0), (200.0, 0.0)], [1.0]
    total = wp.path_length(pts, bulges)
    sp, sb = wp.sub_path(pts, bulges, total * 0.25, total * 0.75)
    assert wp.arc_of(sp[0], sp[1], sb[0])[:3] == pytest.approx(wp.arc_of(pts[0], pts[1], 1.0)[:3])
    assert wp.path_length(sp, sb) == pytest.approx(total / 2)


def test_three_point_and_radius_bulges():
    a, b = (0.0, 0.0), (200.0, 0.0)
    for bulge in (0.2, -0.7, 1.0, 2.0):
        _p, _t = wp.point_at([a, b], [bulge], wp.seg_length(a, b, bulge) * 0.37)
        assert wp.bulge_through(a, _p, b) == pytest.approx(bulge, rel=1e-9)
        r = wp.radius(a, b, bulge)
        assert wp.bulge_for_radius(a, b, r, bulge, major=abs(bulge) > 1) == pytest.approx(bulge, rel=1e-9)
    assert wp.bulge_through(a, (100.0, 0.0), b) == 0.0 and wp.bulge_for_radius(a, b, 99.0, 1.0) is None


def test_fillet_is_tangent_and_has_the_radius():
    square = [(0.0, 0.0), (100.0, 0.0), (100.0, 100.0), (0.0, 100.0), (0.0, 0.0)]
    pts, bulges = wp.fillet(square, [0.0] * 4, 2, 25.0)
    k = bulges.index(next(b for b in bulges if b))
    assert wp.radius(pts[k], pts[k + 1], bulges[k]) == pytest.approx(25.0)
    _p, t_in = wp.point_at(pts, bulges, wp.cumulative(pts, bulges)[k] + 1e-6)
    assert t_in == pytest.approx((0.0, 1.0), abs=1e-5), "tangent to the incoming side"
    assert wp.ring_area(pts, bulges) == pytest.approx(100 * 100 - (25 * 25 - math.pi * 25 * 25 / 4))
    closed = wp.fillet(square, [0.0] * 4, 0, 10.0)
    assert closed is not None and closed[0][0] == closed[0][-1] and len(closed[1]) == 5
    assert wp.fillet(square, [0.0] * 4, 1, 101.0) is None, "tangent points past the next corner"
    assert wp.fillet([(0.0, 0.0), (10.0, 0.0), (20.0, 0.0)], [0.0, 0.0], 1, 5.0) is None, "a straight-through corner"
    assert wp.fillet([(0.0, 0.0), (10.0, 0.0), (10.0, 10.0)], [0.3, 0.0], 1, 2.0) is None, "a curved neighbour"


def test_round_room_area_and_faces():
    doc = _curved()
    w = _wall(doc, "cb-round")
    pts, bulges = wp.wall_px(w, 1000, 800)
    assert abs(wp.ring_area(pts, bulges)) * 0.01 ** 2 == pytest.approx(math.pi * 1.0 ** 2), "a 1 m circle: pi m2"
    left, right = wp.wall_faces(w, 1000, 800, thickness_px=20.0)
    for face, expect in ((left, 110.0), (right, 90.0)):  # positive bulge, increasing angle: screen-left is outward
        radii = [math.hypot(x - 800, y - 400) for x, y in face]
        assert min(radii) == pytest.approx(expect, abs=0.3) and max(radii) == pytest.approx(expect, abs=0.3)


# ---------------------------------------------------------------- the document (2.1)

def test_curved_sample_validates_and_is_stamped_2_1():
    doc = _curved()
    assert [i for i in pg.validate(doc) if i["severity"] == "error"] == []
    assert pg.doc_version(doc) == "2.1" and pg.has_curves(doc)
    straight = _straight()
    assert pg.doc_version(straight) == "2.0" and not pg.has_curves(straight)


def test_straight_documents_stay_byte_for_byte():
    """Backward compatibility: a document without curves is untouched by everything curved walls added."""
    straight = _straight()
    before = pg.canonical_json(straight)
    out = pg.normalize(straight, {})
    assert pg.canonical_json(pg.normalize(json.loads(before), {})) == pg.canonical_json(out)
    assert "bulges" not in pg.canonical_json(out) and out["schema_version"] == "2.0"
    assert render.structure_primitives(straight, 1000, 800) == json.loads((FIX / "sample-v2.primitives.json").read_text(encoding="utf-8"))["all"]


def test_bulges_are_validated():
    doc = _curved()
    bad = copy.deepcopy(doc)
    _wall(bad, "ca-arc")["bulges"] = [0.5, 0.1]
    assert any(i["structural"] and i["path"].endswith(".bulges") for i in pg.validate(bad)), "wrong length refuses the save"
    bad = copy.deepcopy(doc)
    _wall(bad, "ca-arc")["bulges"] = ["0.5"]
    assert any(i["structural"] for i in pg.validate(bad))
    bad = copy.deepcopy(doc)
    _wall(bad, "ca-arc")["bulges"] = [4.5]
    assert any(i["code"] == "bulge" and i["id"] == "ca-arc" for i in pg.validate(bad))
    bad = copy.deepcopy(doc)
    _wall(bad, "ca-arc")["polyline"] = [[0.2, 0.05], [0.5, 0.05]]
    assert any(i["code"] == "bounds" and i["id"] == "ca-arc" for i in pg.validate(bad)), "an arc that leaves the plan"
    bad = copy.deepcopy(doc)
    bad["schema_version"] = "2.2"
    assert any(i["code"] == "schema_version" and i["structural"] for i in pg.validate(bad))


def test_normalize_drops_all_zero_bulges_and_rebase_stamps():
    doc = _curved()
    _wall(doc, "ca-arc")["bulges"] = [0.0]
    out = pg.normalize(doc, {})
    assert "bulges" not in _wall(out, "ca-arc") and "bulges" in _wall(out, "cb-round")
    flat = copy.deepcopy(out)
    for w in flat["walls"]:
        w.pop("bulges", None)
    assert pg.doc_version(flat) == "2.0" and pg.doc_version(out) == "2.1"


def test_openings_are_measured_along_the_arc():
    doc = _curved()
    w = _wall(doc, "ca-arc")
    chord_m = 300 * 0.01
    arc_m = pg.wall_length_px(w, 1000, 800) * 0.01
    assert arc_m > chord_m + 0.15
    o = next(x for x in doc["openings"] if x["id"] == "oa-door")
    o["width_m"] = chord_m + 0.1  # wider than the chord, narrower than the arc: it fits a curved wall
    assert not any(i["code"] == "opening_outside_wall" for i in pg.validate(doc))
    o["width_m"] = arc_m + 0.2
    assert any(i["code"] == "opening_outside_wall" for i in pg.validate(doc))


def test_door_on_an_arc_sits_on_the_arc_along_its_tangent():
    doc = _curved()
    prims = render.structure_primitives(doc, 1000, 800)
    door = next(p for p in prims if p["id"] == "oa-door")
    pts, bulges = wp.wall_px(_wall(doc, "ca-arc"), 1000, 800)
    centre, tangent = wp.point_at(pts, bulges, wp.path_length(pts, bulges) * 0.5)
    (x0, y0), (x1, y1) = door["gap"]
    assert ((x0 + x1) / 2, (y0 + y1) / 2) == pytest.approx(centre, abs=0.02)
    assert centre[1] < 240, "the arc's middle, above the chord"
    d = (x1 - x0, y1 - y0)
    assert abs(d[0] * tangent[1] - d[1] * tangent[0]) / math.hypot(*d) < 1e-3, "the gap lies along the tangent"
    walls = [p for p in prims if p["kind"] == "wall" and p["id"] == "ca-arc"]
    assert len(walls) == 2 and all(p["arc"]["bulges"] and len(p["arc"]["bulges"]) == len(p["arc"]["points"]) - 1 for p in walls)


def test_structure_primitives_sample_curves_and_keep_straight_walls():
    prims = render.structure_primitives(_curved(), 1000, 800)
    rnd = [p for p in prims if p["id"] == "cb-round" and p["kind"] == "wall"]
    # a closed outline starts and ends at its first corner: the window cuts it into two parts, as a straight outline
    assert len(rnd) == 2 and sum(len(p["points"]) for p in rnd) > 40
    for p in rnd:
        for x, y in p["points"][1:-1]:
            assert math.hypot(x - 800, y - 400) == pytest.approx(100, abs=0.3)
    straight = next(p for p in prims if p["id"] == "ce-straight")
    assert "arc" not in straight and len(straight["points"]) == 2


def test_svg_and_png_draw_the_curves():
    doc = _curved()
    svg = render.render_svg(doc, [], 1000, 800)
    assert sum(ln.count(",") for ln in svg.splitlines() if 'data-wall="cb-round"' in ln) > 40
    png = render.render_png(doc, [], 1000, 800)
    from PIL import Image

    im = Image.open(io.BytesIO(png)).convert("RGB")
    assert im.getpixel((800, 500)) != (255, 255, 255) and im.getpixel((800, 400)) == (255, 255, 255), "the ring is drawn, its middle empty"
    assert im.getpixel((800, 300)) == (255, 255, 255), "the window at t = 0.25 (the top of the ring) cuts it"


# ---------------------------------------------------------------- DXF

def _export_dxf(doc: dict) -> ezdxf.document.Drawing:
    data = dxf_export.render_dxf(doc, [], 1000, 800)
    return ezdxf.read(io.StringIO(data.decode("utf-8")))


def test_dxf_writes_bulged_polylines_on_the_wall_layer():
    doc = _curved()
    dxf = _export_dxf(doc)
    walls = [e for e in dxf.modelspace().query("LWPOLYLINE") if e.dxf.layer == "SW_WALLS"]
    by_id: dict[str, list] = {}
    for e in walls:
        by_id.setdefault(e.get_xdata(dxf_export.APP_ID)[0].value, []).append(e)
    assert set(by_id) == {"ca-arc", "cb-round", "cc-mixed", "cd-room", "ce-straight"}
    assert all(b == 0 for e in by_id["ce-straight"] + by_id["cd-room"] for (b,) in e.get_points("b")), "straight walls exactly as before"
    assert len(by_id["cb-round"]) == 2, "the window cuts the closed ring into two parts"
    total = 0.0
    for rnd in by_id["cb-round"]:
        bulges = [b for (b,) in rnd.get_points("b")]
        assert any(abs(b) > 0.05 for b in bulges) and all(b <= 0 for b in bulges), "y is mirrored: the document's positive bulge is written negative"
        assert rnd.dxf.const_width == pytest.approx(0.2)
        pts = list(rnd.get_points("xyb"))
        for (x0, y0, b), (x1, y1, _b) in zip(pts, pts[1:]):
            total += wp.seg_length((x0, y0), (x1, y1), b)
    # the arc length in CAD is the wall's length in metres (exact arcs, not chords): the ring less the window, plus the
    # two free ends grown by half the thickness
    w = _wall(doc, "cb-round")
    window = next(o for o in doc["openings"] if o["id"] == "ob-window")
    expected = pg.wall_length_px(w, 1000, 800) * 0.01 - window["width_m"] + w["thickness_m"]
    assert total == pytest.approx(expected, abs=1e-3)


def test_dxf_round_trip_through_the_project_importer():
    """The exported drawing read back by plan_dxf_map (the project's own reader) gives curved candidates with the
    same arcs: a centre line drawn with the wall's width becomes one wall with the original bulges."""
    doc = _curved()
    doc["openings"] = []  # whole walls: one part each
    data = dxf_export.render_dxf(doc, [], 1000, 800)
    src = ezdxf.read(io.StringIO(data.decode("utf-8")))
    ents = plan_dxf_map.read_entities(src, ["SW_WALLS"])
    extent = plan_dxf_map.extent_for(src, ["SW_WALLS"], ents)
    got = plan_dxf_map.map_geometry(src, layer_map={"SW_WALLS": "walls"}, block_map={}, units="m", extent=extent, rotation=0, crop=None, level_id="L0",
                                    run_id="rt", catalog=[], scale_m_per_px=None, entities=ents)
    curved = [w for w in got["walls"] if w.get("bulges")]
    assert len(curved) == 3 and got["stats"]["centrelines"] == 3
    assert [i for i in pg.validate({**_curved(), "walls": got["walls"], "openings": []}) if i["structural"]] == []
    src_round = _wall(doc, "cb-round")
    imp = next(w for w in curved if w["thickness_m"] == pytest.approx(0.2) and len(w["polyline"]) == 5)
    # the free ends grew by half the thickness (two short straight runs); the arcs keep their bulges and sign
    assert [b for b in imp["bulges"] if b] == pytest.approx(src_round["bulges"], abs=1e-6)
    # radius in metres survives: version space of the import is the drawing extent, so compare radii in metres
    k = next(i for i, b in enumerate(imp["bulges"]) if b)
    ex_w = extent["w"]
    a = (imp["polyline"][k][0] * ex_w, imp["polyline"][k][1] * extent["h"])
    b = (imp["polyline"][k + 1][0] * ex_w, imp["polyline"][k + 1][1] * extent["h"])
    assert wp.radius(a, b, imp["bulges"][k]) == pytest.approx(1.0, abs=2e-3)


def test_importer_pairs_concentric_arcs_and_reads_circles():
    d = ezdxf.new("R2018")
    d.units = 6
    msp = d.modelspace()
    msp.add_arc((5, 5), 3.0, 0, 120, dxfattribs={"layer": "A-WALL"})
    msp.add_arc((5, 5), 3.2, 0, 120, dxfattribs={"layer": "A-WALL"})
    msp.add_circle((12, 5), 1.5, dxfattribs={"layer": "A-WALL"})
    msp.add_circle((12, 5), 1.7, dxfattribs={"layer": "A-WALL"})
    msp.add_line((0, 0), (14, 0), dxfattribs={"layer": "A-WALL"})
    ents = plan_dxf_map.read_entities(d, ["A-WALL"])
    extent = plan_dxf_map.extent_for(d, ["A-WALL"], ents)
    got = plan_dxf_map.map_geometry(d, layer_map={"A-WALL": "walls"}, block_map={}, units="m", extent=extent, rotation=0, crop=None, level_id="L0",
                                    run_id="cc", catalog=[], scale_m_per_px=None, entities=ents)
    curved = [w for w in got["walls"] if w.get("bulges")]
    assert got["stats"]["curves_paired"] == 2 and got["stats"]["curves_single"] == 0
    assert sorted(w["thickness_m"] for w in curved) == [0.2, 0.2]
    ring = next(w for w in curved if w["polyline"][0] == w["polyline"][-1])
    assert len(ring["bulges"]) == 2 and all(b == pytest.approx(-1.0) for b in ring["bulges"]), "a full circle: two half turns, mirrored"
    arc = next(w for w in curved if w is not ring)
    assert len(arc["bulges"]) == 1 and arc["bulges"][0] == pytest.approx(-math.tan(math.radians(120) / 4), abs=1e-6)


def test_curved_window_wall_glazes_along_the_arc():
    """Curved walls meet window walls (both document 2.1): a round room made of glass is 2.1, validates, draws glass parts
    with their arcs, divides its glazing over the exact arc length with every panel end on the arc, and the DXF writes
    the glass wall and pane as bulged polylines on SW_GLAZING."""
    from smplwise.services import plan_glass

    doc = _curved()
    w = _wall(doc, "cb-round")
    w.update({"kind": "glass", "thickness_m": 0.12})
    assert pg.document_version(doc) == "2.1" and pg.doc_version is pg.document_version
    assert [i for i in pg.validate(doc) if i["structural"]] == []
    prims = render.structure_primitives(doc, 1000, 800)
    parts = [p for p in prims if p["kind"] == "wall" and p["id"] == "cb-round"]
    assert parts and all(p.get("glass") and p.get("arc") for p in parts)
    glz = next(p for p in prims if p["kind"] == "glazing" and p["id"] == "cb-round")
    pts, bulges = wp.wall_px(w, 1000, 800)
    length_m = wp.path_length(pts, bulges) * 0.01
    assert len(glz["panels"]) == plan_glass.panel_count(length_m, plan_glass.glazing_of(w))
    for q in glz["panels"]:
        for e in (q["a"], q["b"]):
            assert wp.project(pts, bulges, (e[0], e[1]))[1] < 0.3, "a panel end off the arc"
    src = _export_dxf(doc)
    glass = [e for e in src.modelspace().query("LWPOLYLINE") if e.dxf.layer == "SW_GLAZING"]
    assert len(glass) >= 2 and all(any(abs(b) > 1e-6 for *_xy, b in e.get_points("xyb")) for e in glass)
    # a straight document with a glass wall stays as main drew it (no arc on its parts)
    straight = _curved()
    sw = _wall(straight, "ce-straight")
    sw["kind"] = "glass"
    assert all("arc" not in p for p in render.structure_primitives(straight, 1000, 800) if p["kind"] == "wall" and p["id"] == "ce-straight")


def test_importer_hosts_doors_and_windows_on_curved_walls():
    """Map 1.3: a door swing arc, a second door swinging the other way and a window line on a curved wall (a pair of
    concentric arcs) become openings of that wall, placed by arc length; straight walls keep their own matching."""
    d = ezdxf.new("R2018")
    d.units = 6
    msp = d.modelspace()
    c, r, sweep = (5.0, 5.0), 3.1, 120.0
    msp.add_arc(c, 3.0, 0, sweep, dxfattribs={"layer": "A-WALL"})
    msp.add_arc(c, 3.2, 0, sweep, dxfattribs={"layer": "A-WALL"})
    msp.add_line((0, -2), (14, -2), dxfattribs={"layer": "A-WALL"})
    on = lambda deg: (c[0] + r * math.cos(math.radians(deg)), c[1] + r * math.sin(math.radians(deg)))  # noqa: E731

    def door(hinge_deg: float, outward: bool) -> None:
        h = on(hinge_deg)
        o = on(hinge_deg + math.degrees(0.9 / r))  # the gap's other end, 0.9 m further along the wall
        out = (math.cos(math.radians(hinge_deg)), math.sin(math.radians(hinge_deg)))
        tip_deg = math.degrees(math.atan2(out[1], out[0])) if outward else math.degrees(math.atan2(-out[1], -out[0]))
        o_deg = math.degrees(math.atan2(o[1] - h[1], o[0] - h[0]))
        start, end = (tip_deg, o_deg) if outward else (o_deg, tip_deg)  # counter-clockwise, the short way
        msp.add_arc(h, 0.9, start % 360, end % 360, dxfattribs={"layer": "A-DOOR"})

    door(40.0, True)
    door(90.0, False)
    msp.add_line(on(15.0), on(25.0), dxfattribs={"layer": "A-WIND"})
    layers = ["A-WALL", "A-DOOR", "A-WIND"]
    ents = plan_dxf_map.read_entities(d, layers)
    extent = plan_dxf_map.extent_for(d, layers, ents)
    got = plan_dxf_map.map_geometry(d, layer_map={"A-WALL": "walls", "A-DOOR": "openings", "A-WIND": "windows"}, block_map={}, units="m", extent=extent,
                                    rotation=0, crop=None, level_id="L0", run_id="co", catalog=[], scale_m_per_px=None, entities=ents)
    assert got["detector"]["version"] == "1.3"
    curved = next(w for w in got["walls"] if w.get("bulges"))
    on_curve = sorted((o for o in got["openings"] if o["wall_id"] == curved["id"]), key=lambda o: o["t"])
    assert [o["kind"] for o in on_curve] == ["window", "door", "door"]
    length = r * math.radians(sweep)
    win, d1, d2 = on_curve
    assert win["t"] == pytest.approx(r * math.radians(20.0) / length, abs=2e-3)
    assert win["width_m"] == pytest.approx(r * math.radians(10.0), abs=5e-3)
    assert d1["t"] == pytest.approx((r * math.radians(40.0) + 0.45) / length, abs=2e-3) and d1["width_m"] == pytest.approx(0.9, abs=1e-3)
    assert d1["hinge"] == "start" and d2["hinge"] == "start"
    assert d1["swing"] != d2["swing"], "one door opens outward, the other inward"
    doc = {**_curved(), "walls": got["walls"], "openings": got["openings"]}
    issues = pg.validate(doc)
    assert [i for i in issues if i["structural"]] == []


# ---------------------------------------------------------------- transforms, candidates, diff

def test_recrop_keeps_an_arc_inside_and_flattens_one_it_cuts():
    doc = _curved()
    keep = pg.transform_crop(doc, None, {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0})
    assert _wall(keep, "cb-round")["bulges"] == [1.0, 1.0]
    cut = pg.transform_crop(doc, None, {"x": 0.0, "y": 0.0, "w": 0.8, "h": 1.0})  # x = 0.8 crosses the round room
    rnd = _wall(cut, "cb-round")
    assert "bulges" not in rnd and len(rnd["polyline"]) > 10
    assert any("מעוגל" in n for n in cut["uncertainty"]["notes"])
    assert _wall(cut, "ca-arc")["bulges"] == [0.5], "an arc wholly inside keeps its bulge (a crop is a similarity)"


def test_candidate_edit_that_replaces_corners_drops_stale_bulges():
    doc = _curved()
    cand = {"walls": [{**_wall(doc, "ca-arc"), "id": "imp-r-w001", "source": "imported"}]}
    merged, _counts = pg.merge_candidates(doc, cand, ["imp-r-w001"], {"imp-r-w001": {"polyline": [[0.2, 0.3], [0.3, 0.3], [0.5, 0.3]]}}, False)
    assert "bulges" not in _wall(merged, "imp-r-w001")
    merged, _counts = pg.merge_candidates(doc, cand, ["imp-r-w001"], {"imp-r-w001": {"bulges": [-0.3]}}, False)
    assert _wall(merged, "imp-r-w001")["bulges"] == [-0.3]


def test_diff_sees_a_bend():
    old = _curved()
    new = copy.deepcopy(old)
    _wall(new, "ca-arc")["bulges"] = [0.3]
    assert pg.diff(old, new)["collections"]["walls"]["changed"] == ["ca-arc"]


# ---------------------------------------------------------------- signed package round trip (API)

def test_package_round_trip_keeps_curves(settings):
    from conftest import png_bytes, seed_tree
    from fastapi.testclient import TestClient

    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    vid = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()["id"]
    assert c.post(f"/api/v1/plan-versions/{vid}/publish").status_code == 200
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    s = _curved()
    doc = dict(g["doc"], walls=s["walls"], openings=s["openings"])
    doc["schema_version"] = "2.0"  # a client may send 2.0: the server stamps what the walls need
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": 0})
    assert r.status_code == 200, r.text
    stored = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["doc"]
    assert stored["schema_version"] == "2.1" and _wall(stored, "cb-round")["bulges"] == [1.0, 1.0]
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    published = c.get(f"/api/v1/plan-versions/{vid}/geometry").json()["geometry"]["doc_hash"]
    pkg = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": False})
    assert pkg.status_code == 200
    import zipfile

    with zipfile.ZipFile(io.BytesIO(pkg.content)) as z:
        plan = json.loads(z.read("plan.json"))
        names = z.namelist()
    assert plan["schema_version"] == "2.1" and _wall(plan, "ca-arc")["bulges"] == [0.5]
    dxf_name = next((n for n in names if n.endswith(".dxf")), None)
    if dxf_name is not None:
        with zipfile.ZipFile(io.BytesIO(pkg.content)) as z:
            assert b"SW_WALLS" in z.read(dxf_name)
    # the draft drifts (arcs straightened), then the package brings the curves back with the same hash
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    flat = dict(g["doc"], walls=[{k: v for k, v in w.items() if k != "bulges"} for w in g["doc"]["walls"]])
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": flat, "base_revision": g["geometry"]["revision"]}).status_code == 200
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["doc"]["schema_version"] == "2.0"
    p = c.post(f"/api/v1/plan-versions/{vid}/package/preview?mode=replace", files={"file": ("p.swplan.zip", pkg.content, "application/zip")})
    assert p.status_code == 200, p.text
    plan_r = p.json()
    assert plan_r["result_hash"] == published
    q = f"mode=replace&base_revision={plan_r['base_revision']}&expect_hash={plan_r['result_hash']}"
    done = c.post(f"/api/v1/plan-versions/{vid}/package/import?{q}", files={"file": ("p.swplan.zip", pkg.content, "application/zip")})
    assert done.status_code == 200, done.text
    back = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    assert back["geometry"]["doc_hash"] == published and back["doc"]["schema_version"] == "2.1"
    # an Arx before curved walls refuses the package (never misreads it): its check was == "2.0"
    assert plan["schema_version"] != "2.0"
