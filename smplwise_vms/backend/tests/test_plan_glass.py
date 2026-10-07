"""Window walls (glass curtain walls, document 2.1): the validator and its limits, the version stamp (2.1 only when a
glass wall or a glazing block is used; every other document stays 2.0), the panel layout maths along the path length,
the shared primitive (mullions skip opening cuts, corner posts only on real corners), the SVG / PNG / DXF exports (the
DXF read back), and the API round trip: save, publish, the signed package export / import, merge into a 2.0 draft,
diff."""
from __future__ import annotations

import copy
import io
import json

import ezdxf
import pytest
from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import plan_dxf_export as dxf_export
from smplwise.services import plan_geometry as pg
from smplwise.services import plan_geometry_render as render
from smplwise.services import plan_glass as glass

VERSION = {"id": "v1", "floor_id": "f1", "asset_id": "a1", "page": 1, "rotation": 0, "crop_json": None, "width_px": 1000, "height_px": 500,
           "scale_m_per_px": 0.02, "calibration_json": None}
ASSET = {"sha256": "b" * 64, "original_name": "plan.pdf", "mime": "application/pdf"}


def _glass_wall(**over) -> dict:
    w = {"id": "g1", "level_id": "L0", "polyline": [[0.1, 0.2], [0.5, 0.2]], "thickness_m": 0.15, "height_m": None, "base_z_m": 0, "kind": "glass",
         "confidence": 1, "source": "manual", "locked": False, "external_ids": {},
         "glazing": {"panel_width_m": 1.0, "panel_count": None, "mullion_m": 0.06, "sill_m": 0.3, "glazed_height_m": None, "tint": "clear", "opacity": 0.35,
                     "operable": [{"panel": 2, "operation": "casement_left", "anchor_ref": {"resource_type": "ha_entity", "resource_id": "binary_sensor.window_2"}}]}}
    w.update(over)
    return w


def _solid_wall(**over) -> dict:
    w = {"id": "w1", "level_id": "L0", "polyline": [[0.1, 0.6], [0.5, 0.6]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "exterior",
         "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}
    w.update(over)
    return w


def _doc(*walls: dict) -> dict:
    d = pg.new_document(VERSION, ASSET)
    d["walls"] = list(walls) if walls else [_glass_wall(), _solid_wall()]
    return d


def _codes(doc: dict) -> set[tuple[str, str | None, str]]:
    return {(i["code"], i["id"], i["severity"]) for i in pg.validate(doc)}


# ---------------------------------------------------------------- model and validator

def test_a_glass_wall_validates_and_the_version_is_stamped_only_when_used():
    d = _doc()
    assert pg.validate(d) == []
    assert pg.rebase(d, VERSION, ASSET)["schema_version"] == "2.1"
    plain = _doc(_solid_wall())
    assert pg.rebase(plain, VERSION, ASSET)["schema_version"] == "2.0", "a document without window walls stays 2.0 for older readers"
    assert pg.document_version(plain) == "2.0" and pg.document_version(d) == "2.1"
    # a glass wall without a glazing block is valid too (the defaults)
    bare = _glass_wall()
    del bare["glazing"]
    assert pg.validate(_doc(bare)) == [] and pg.document_version(_doc(bare)) == "2.1"
    # both versions are read; anything else is refused
    for v in ("2.0", "2.1"):
        assert not any(i["structural"] for i in pg.validate(dict(d, schema_version=v)))
    assert any(i["code"] == "schema_version" and i["structural"] for i in pg.validate(dict(d, schema_version="2.2")))


@pytest.mark.parametrize("field,value", [("glazing", "nope"), ("glazing.panel_width_m", "1"), ("glazing.panel_count", 1.5), ("glazing.mullion_m", True),
                                         ("glazing.tint", 3), ("glazing.operable", {}), ("glazing.operable[0]", {"panel": "2", "operation": "tilt"}),
                                         ("glazing.glazed_height_m", "2")])
def test_wrong_types_refuse_the_save(field, value):
    d = _doc()
    w = d["walls"][0]
    if field == "glazing":
        w["glazing"] = value
    elif field == "glazing.operable[0]":
        w["glazing"]["operable"] = [value]
    else:
        w["glazing"][field.split(".", 1)[1]] = value
    issues = pg.validate(d)
    assert issues and all(i["structural"] for i in issues)
    assert any(i["code"] == "type" and i["path"].endswith(field.replace("glazing", "glazing", 1)) for i in issues), issues


def test_ranges_and_enums_block_publishing_but_not_the_save():
    def with_glazing(**g):
        w = _glass_wall()
        w["glazing"].update(g)
        return _doc(w)

    for g in ({"panel_width_m": 0.1}, {"panel_width_m": 7}, {"mullion_m": 0.0}, {"mullion_m": 0.6}, {"sill_m": -1}, {"glazed_height_m": 0.1},
              {"opacity": 1.0}, {"panel_count": 0}, {"panel_count": glass.MAX_PANELS + 1}):
        issues = pg.validate(with_glazing(**{"operable": [], **g}))
        assert [(i["code"], i["severity"], i["structural"]) for i in issues] == [("glazing_range", "error", False)], (g, issues)
    assert ("enum", "g1", "error") in _codes(with_glazing(tint="mirror"))
    assert ("enum", "g1", "error") in _codes(with_glazing(operable=[{"panel": 0, "operation": "fly"}]))
    assert ("anchor_ref", "g1", "error") in _codes(with_glazing(operable=[{"panel": 0, "operation": "tilt", "anchor_ref": {"resource_type": "x"}}]))
    # 0.4 of 1000 px at 0.02 m/px = 8 m: 8 panels of 1 m - panel 8 does not exist, a panel twice is refused
    assert ("operable_panel", "g1", "error") in _codes(with_glazing(operable=[{"panel": 8, "operation": "tilt"}]))
    assert ("operable_panel", "g1", "error") in _codes(with_glazing(operable=[{"panel": 1, "operation": "tilt"}, {"panel": 1, "operation": "sliding"}]))
    assert pg.validate(with_glazing(operable=[{"panel": 7, "operation": "tilt"}])) == []
    # a sill above an explicit wall height is a warning
    w = _glass_wall(height_m=2.0)
    w["glazing"].update(sill_m=1.5, glazed_height_m=1.0)
    assert ("glazing_height", "g1", "warning") in _codes(_doc(w))
    # glazing kept on a wall converted to another kind: a warning, nothing refused
    solid = _solid_wall(glazing=_glass_wall()["glazing"])
    assert [(i["code"], i["severity"]) for i in pg.validate(_doc(solid))] == [("glazing_ignored", "warning")]
    # too many operable entries is a structural limit
    many = _glass_wall()
    many["glazing"]["operable"] = [{"panel": i, "operation": "tilt"} for i in range(glass.MAX_PANELS + 1)]
    assert any(i["structural"] for i in pg.validate(_doc(many)))


def test_glazing_is_an_editable_field_of_a_wall_candidate():
    assert "glazing" in pg.EDITABLE_FIELDS["walls"]


# ---------------------------------------------------------------- panel layout maths (path length only)

def test_panel_count_and_bounds():
    assert glass.panel_count(8.0, {"panel_width_m": 1.0}) == 8
    assert glass.panel_count(8.4, {"panel_width_m": 1.2}) == 7  # 7.0 exactly
    assert glass.panel_count(8.7, {"panel_width_m": 1.2}) == 7  # 7.25 rounds down
    assert glass.panel_count(9.0, {"panel_width_m": 1.2}) == 8  # 7.5 rounds half-up
    assert glass.panel_count(0.3, {"panel_width_m": 1.2}) == 1, "a short wall is one panel"
    assert glass.panel_count(8.0, {"panel_width_m": 1.0, "panel_count": 3}) == 3, "a stored count wins"
    assert glass.panel_count(1e6, {"panel_width_m": 0.2}) == glass.MAX_PANELS
    assert glass.panel_count(0, {"panel_width_m": 1.0}) == 1
    assert glass.panel_bounds(6.0, 3) == [0.0, 2.0, 4.0, 6.0]


def test_auto_divide_into_equal_panels_within_bounds():
    assert glass.auto_divide(12.0, 0.9, 1.5) == 10  # target 1.2 m -> 10 panels of 1.2
    assert glass.auto_divide(12.0, 0.9, 1.5, target_m=1.5) == 8
    assert glass.auto_divide(12.0, 1.4, 1.5) == 8, "only 8 panels of 1.5 m fit [1.4, 1.5]"
    assert glass.auto_divide(0.5, 0.9, 1.5) is None, "a wall shorter than the narrowest panel"
    assert glass.auto_divide(2.05, 1.1, 1.2) is None, "no whole number of panels fits"
    assert glass.auto_divide(3.0, 1.5, 1.5) == 2
    assert glass.auto_divide(5.0, 2, 1) is None and glass.auto_divide(-1, 1, 2) is None
    for length in (0.95, 3.3, 7.77, 19.1, 64.0):
        n = glass.auto_divide(length, 0.9, 1.5)
        assert n is not None and 0.9 - 1e-9 <= length / n <= 1.5 + 1e-9


# ---------------------------------------------------------------- the shared primitive and the exports

def test_primitives_mark_only_glass_walls_and_draw_the_mullions():
    d = _doc()
    d["openings"] = [{"id": "o1", "wall_id": "g1", "t": 0.5, "kind": "door", "width_m": 0.9, "height_m": 2.1, "sill_m": 0, "swing": "right", "hinge": "start",
                      "anchor_ref": None, "confidence": 1, "source": "manual", "external_ids": {}}]
    prims = render.structure_primitives(d, 1000, 500)
    walls = [p for p in prims if p["kind"] == "wall"]
    assert [p.get("glass") for p in walls if p["id"] == "g1"] == [True, True], "the door cuts the glass wall in two parts"
    assert all("glass" not in p for p in walls if p["id"] == "w1"), "a solid wall's primitive is unchanged"
    g = next(p for p in prims if p["kind"] == "glazing")
    assert g["id"] == "g1" and len(g["panels"]) == 8 and g["mullion"] == 3.0
    # 8 panels -> 7 inner edges at 50 px steps from x=100; the one at x=300 is inside the door's cut (277.5..322.5)
    assert [m[0][0] for m in g["mullions"]] == [150, 200, 250, 350, 400, 450]
    assert g["panels"][2]["operation"] == "casement_left" and g["panels"][2]["anchor"] == "ha_entity:binary_sensor.window_2"
    assert [p["operation"] for p in g["panels"]].count(None) == 7
    # the glazing primitive follows its wall's parts, before the openings
    kinds = [p["kind"] for p in prims]
    assert kinds.index("glazing") > max(i for i, p in enumerate(prims) if p["kind"] == "wall" and p["id"] == "g1")
    assert kinds.index("glazing") < kinds.index("door")


def test_a_corner_gets_a_post_and_a_gentle_bend_does_not():
    corner = _glass_wall(polyline=[[0.1, 0.2], [0.33, 0.2], [0.33, 0.6]])  # 4.6 m + 4 m, a right angle
    corner["glazing"].update(panel_width_m=10, operable=[])  # one panel: only the corner post
    g = next(p for p in render.structure_primitives(_doc(corner), 1000, 500) if p["kind"] == "glazing")
    assert len(g["mullions"]) == 1
    (a, b) = g["mullions"][0]
    assert a[0] != b[0] and a[1] != b[1], "the post lies on the bisector"
    bend = _glass_wall(polyline=[[0.1, 0.2], [0.3, 0.2], [0.5, 0.21]])  # ~5.7 degrees
    bend["glazing"].update(panel_width_m=10, operable=[])
    g = next(p for p in render.structure_primitives(_doc(bend), 1000, 500) if p["kind"] == "glazing")
    assert g["mullions"] == []


def test_svg_and_png_draw_the_glazing_layer():
    d = _doc()
    svg = render.render_svg(d, [], 1000, 500)
    assert '<g id="glazing"' in svg and 'data-wall-kind="glass"' in svg and svg.count("data-mullion=") == 7
    assert 'data-operable="g1" data-panel="2" data-operation="casement_left"' in svg
    assert '<polyline data-wall="w1"' in svg and '<polyline data-wall="g1"' not in svg, "the glass wall is not drawn as a solid wall"
    plain = render.render_svg(_doc(_solid_wall()), [], 1000, 500)
    assert 'id="glazing"' not in plain
    assert render.render_svg(_doc(_solid_wall()), [], 1000, 500) == plain
    no_structure = render.render_svg(d, [], 1000, 500, layers=["objects"])
    assert 'id="glazing"' not in no_structure
    png = render.render_png(d, [], 1000, 500)
    assert png[:8] == b"\x89PNG\r\n\x1a\n"


def _read(data: bytes):
    return ezdxf.read(io.StringIO(data.decode("utf-8")))


def _xkinds(drawing, layer: str) -> list[str]:
    return sorted(e.get_xdata(dxf_export.APP_ID)[1][1] for e in drawing.modelspace() if e.dxf.layer == layer)


def test_dxf_has_its_own_glazing_layer_and_reads_back():
    d = _doc()
    back = _read(dxf_export.render_dxf(d, [], 1000, 500))
    names = {lay.dxf.name for lay in back.layers}
    assert "SW_GLAZING" in names
    kinds = _xkinds(back, "SW_GLAZING")
    assert kinds.count("glass_wall") == 1 and kinds.count("glass_pane") == 1 and kinds.count("mullion") == 7
    assert sorted(k for k in kinds if k.startswith("glass_panel")) == sorted([f"glass_panel:{i}" for i in range(8) if i != 2] + ["glass_panel:2:casement_left"])
    operable = [e for e in back.modelspace() if e.dxf.layer == "SW_GLAZING" and e.get_xdata(dxf_export.APP_ID)[1][1] == "glass_panel:2:casement_left"]
    assert operable[0].dxf.linetype == "DASHED"
    # metres: the 8 m wall's frame band is 0.15 m wide
    frame = next(e for e in back.modelspace() if e.dxf.layer == "SW_GLAZING" and e.dxf.dxftype == "LWPOLYLINE" and e.get_xdata(dxf_export.APP_ID)[1][1] == "glass_wall")
    assert frame.dxf.const_width == pytest.approx(0.15)
    pts = [tuple(p[:2]) for p in frame.get_points()]
    assert pts[0][0] == pytest.approx(2.0 - 0.075) and pts[-1][0] == pytest.approx(10.0 + 0.075)
    assert _xkinds(back, "SW_WALLS") == ["wall"], "the solid wall stays on SW_WALLS"
    # a plan without window walls keeps exactly its layer table
    plain = _read(dxf_export.render_dxf(_doc(_solid_wall()), [], 1000, 500))
    assert "SW_GLAZING" not in {lay.dxf.name for lay in plain.layers}
    # the structure switch covers the glazing
    assert _xkinds(_read(dxf_export.render_dxf(d, [], 1000, 500, layers=["objects"])), "SW_GLAZING") == []


def test_dxf_levels_split_the_glazing_family():
    d = _doc()
    d["levels"].append({"id": "L1", "name": "גלריה", "elevation_m": 3.0, "ceiling_height_m": 2.6, "is_default": False, "external_ids": {}})
    d["walls"][0]["level_id"] = "L1"
    back = _read(dxf_export.render_dxf(d, [], 1000, 500))
    names = {lay.dxf.name for lay in back.layers}
    assert {"SW_GLAZING-L0", "SW_GLAZING-L1"} <= names and "SW_GLAZING" not in names
    assert _xkinds(back, "SW_GLAZING-L1").count("mullion") == 7 and _xkinds(back, "SW_GLAZING-L0") == []


# ---------------------------------------------------------------- through the API: save, publish, package, merge, diff

@pytest.fixture()
def world(settings):
    c = TestClient(create_app(settings))
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    vid = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()["id"]
    assert c.post(f"/api/v1/plan-versions/{vid}/publish").status_code == 200
    return c, vid


def _draft(c: TestClient, vid: str) -> dict:
    return c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()


def _put(c: TestClient, vid: str, doc: dict, revision: int):
    return c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": revision})


def test_save_publish_and_package_round_trip(world):
    c, vid = world
    g = _draft(c, vid)
    assert g["doc"]["schema_version"] == "2.0"
    wall = _glass_wall(polyline=[[0.1, 0.2], [0.6, 0.2]])
    # the client still says 2.0: the server stamps 2.1 because the document now uses a window wall
    r = _put(c, vid, dict(g["doc"], walls=[wall]), g["geometry"]["revision"])
    assert r.status_code == 200, r.text
    g = _draft(c, vid)
    assert g["doc"]["schema_version"] == "2.1" and g["doc"]["walls"][0]["glazing"] == wall["glazing"]
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    published = c.get(f"/api/v1/plan-versions/{vid}/geometry").json()
    assert published["doc"]["schema_version"] == "2.1"
    pkg = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": False})
    assert pkg.status_code == 200
    import zipfile
    with zipfile.ZipFile(io.BytesIO(pkg.content)) as z:
        inside = json.loads(z.read("plan.json"))
        manifest = json.loads(z.read("manifest.json"))
    assert inside["schema_version"] == "2.1" and manifest["document"]["schema_version"] == "2.1"
    # the draft drifts (the wall goes back to solid), then the package restores the window wall exactly
    g = _draft(c, vid)
    solid = dict(g["doc"]["walls"][0], kind="exterior")
    solid.pop("glazing")
    assert _put(c, vid, dict(g["doc"], walls=[solid]), g["geometry"]["revision"]).status_code == 200
    assert _draft(c, vid)["doc"]["schema_version"] == "2.0", "converting back drops to 2.0"
    files = {"file": ("p.swplan.zip", pkg.content, "application/zip")}
    p = c.post(f"/api/v1/plan-versions/{vid}/package/preview?mode=replace", files=files)
    assert p.status_code == 200, p.text
    plan = p.json()
    assert plan["diff"]["collections"]["walls"]["changed"] == [wall["id"]]
    assert plan["result_hash"] == published["geometry"]["doc_hash"]
    done = c.post(f"/api/v1/plan-versions/{vid}/package/import?mode=replace&base_revision={plan['base_revision']}&expect_hash={plan['result_hash']}", files=files)
    assert done.status_code == 200, done.text
    after = _draft(c, vid)
    assert after["geometry"]["doc_hash"] == published["geometry"]["doc_hash"]
    assert after["doc"]["walls"][0]["kind"] == "glass" and after["doc"]["schema_version"] == "2.1"


def test_merge_into_a_2_0_draft_and_the_diff(world):
    c, vid = world
    g = _draft(c, vid)
    assert _put(c, vid, dict(g["doc"], walls=[_glass_wall()]), g["geometry"]["revision"]).status_code == 200
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    pkg = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": False}).content
    g = _draft(c, vid)
    assert _put(c, vid, dict(g["doc"], walls=[_solid_wall()]), g["geometry"]["revision"]).status_code == 200
    assert _draft(c, vid)["doc"]["schema_version"] == "2.0"
    files = {"file": ("p.swplan.zip", pkg, "application/zip")}
    plan = c.post(f"/api/v1/plan-versions/{vid}/package/preview?mode=merge", files=files).json()
    assert plan["diff"]["collections"]["walls"]["added"] == ["g1"]
    done = c.post(f"/api/v1/plan-versions/{vid}/package/import?mode=merge&base_revision={plan['base_revision']}&expect_hash={plan['result_hash']}", files=files)
    assert done.status_code == 200, done.text
    doc = _draft(c, vid)["doc"]
    assert doc["schema_version"] == "2.1" and {w["id"] for w in doc["walls"]} == {"g1", "w1"}
    # diff: a glazing edit is a change of that wall
    edited = copy.deepcopy(doc)
    edited["walls"] = [dict(w, glazing=dict(w["glazing"], panel_count=4)) if w["id"] == "g1" else w for w in edited["walls"]]
    assert pg.diff(doc, edited)["collections"] == {"walls": {"added": [], "removed": [], "changed": ["g1"]}}


def test_dxf_export_route_carries_the_glazing(world):
    c, vid = world
    g = _draft(c, vid)
    assert _put(c, vid, dict(g["doc"], walls=[_glass_wall()]), g["geometry"]["revision"]).status_code == 200
    r = c.get(f"/api/v1/plan-versions/{vid}/export.dxf?draft=true")
    assert r.status_code == 200, r.text
    back = _read(r.content)
    assert "SW_GLAZING" in {lay.dxf.name for lay in back.layers} and "mullion" in _xkinds(back, "SW_GLAZING")


def test_the_shared_glass_golden_is_what_the_renderer_draws():
    """contracts/fixtures/plan_geometry/sample-v2-glass.json and its primitives: the map's buildPrimitives is checked
    against the same file (frontend/tests/unit-glass-wall.spec.ts)."""
    import pathlib
    fix = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "plan_geometry"
    doc = json.loads((fix / "sample-v2-glass.json").read_text(encoding="utf-8"))
    assert pg.validate(doc) == [] and doc["schema_version"] == "2.1" == pg.document_version(doc)
    golden = json.loads((fix / "sample-v2-glass.primitives.json").read_text(encoding="utf-8"))
    assert render.structure_primitives(doc, 1000, 800) == golden["all"]
