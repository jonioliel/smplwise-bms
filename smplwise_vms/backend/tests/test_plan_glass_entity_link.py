"""VER1 (verifies WALL-glass, 2.4.0): a window wall's opening panel linked to an entity (`glazing.operable[].anchor_ref`), end to end
through the API: save -> draft reload -> publish -> exports (svg / png / dxf / package plan.json) -> package import -> diff.
tests/test_plan_glass.py owns the geometry, the validator and the exports of an UNLINKED wall; this file owns what the link adds.
Also pins `schema_version: "2.1"` only-when-used across those routes."""
from __future__ import annotations

import copy
import io
import json
import zipfile

import ezdxf
import pytest
from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import plan_dxf_export as dxf_export
from smplwise.services import plan_geometry as pg
from smplwise.services import plan_geometry_render as render

REF = {"resource_type": "ha_entity", "resource_id": "binary_sensor.vent_window"}
REF2 = {"resource_type": "ha_entity", "resource_id": "cover.vent_cover"}
VERSION = {"id": "v1", "floor_id": "f1", "asset_id": "a1", "page": 1, "rotation": 0, "crop_json": None, "width_px": 1000, "height_px": 500,
           "scale_m_per_px": 0.02, "calibration_json": None}
ASSET = {"sha256": "b" * 64, "original_name": "plan.pdf", "mime": "application/pdf"}


def _wall(**over) -> dict:
    w = {"id": "gv", "level_id": "L0", "polyline": [[0.1, 0.2], [0.5, 0.2]], "thickness_m": 0.15, "height_m": None, "base_z_m": 0, "kind": "glass",
         "confidence": 1, "source": "manual", "locked": False, "external_ids": {},
         "glazing": {"panel_width_m": 1.0, "panel_count": 8, "mullion_m": 0.06, "sill_m": 0.3, "glazed_height_m": None, "tint": "clear", "opacity": 0.35,
                     "operable": [{"panel": 1, "operation": "casement_left", "anchor_ref": REF}, {"panel": 5, "operation": "tilt", "anchor_ref": REF2},
                                  {"panel": 6, "operation": "sliding", "anchor_ref": None}]}}
    w.update(over)
    return w


def _doc(wall: dict | None = None) -> dict:
    d = pg.new_document(VERSION, ASSET)
    d["walls"] = [wall or _wall()]
    return d


def _issues(doc: dict) -> list[dict]:
    return pg.validate(doc)


# ---------------------------------------------------------------- validator

def test_a_linked_panel_validates_and_the_link_alone_does_not_change_the_version_rule():
    d = _doc()
    assert _issues(d) == []
    assert pg.document_version(d) == "2.1"
    # a plan with no window wall stays 2.0 whatever other links it carries
    solid = _doc(_wall(kind="exterior"))
    solid["walls"][0].pop("glazing")
    assert pg.document_version(solid) == "2.0" and pg.rebase(solid, VERSION, ASSET)["schema_version"] == "2.0"


@pytest.mark.parametrize("ref", [{"resource_type": "ha_entity", "resource_id": ""}, {"resource_type": "ha_entity"}, {"resource_type": "spaceship", "resource_id": "x.y"},
                                 {"resource_id": "binary_sensor.vent_window"}])
def test_a_malformed_link_blocks_publishing_but_not_the_save(ref):
    d = _doc()
    d["walls"][0]["glazing"]["operable"][0]["anchor_ref"] = ref
    issues = _issues(d)
    assert [i["code"] for i in issues] == ["anchor_ref"] and not any(i["structural"] for i in issues)


def test_a_link_that_is_not_an_object_is_refused_structurally():
    d = _doc()
    d["walls"][0]["glazing"]["operable"][0]["anchor_ref"] = "binary_sensor.vent_window"
    issues = _issues(d)
    assert issues and all(i["structural"] for i in issues)


def test_a_link_on_a_panel_that_does_not_exist_is_refused_at_publish():
    d = _doc()
    d["walls"][0]["glazing"]["operable"].append({"panel": 20, "operation": "tilt", "anchor_ref": REF2})
    assert any(i["code"] == "operable_panel" for i in _issues(d))


# ---------------------------------------------------------------- drawing: the link reaches the primitive and the exports

def test_the_primitive_names_the_linked_entity_per_panel():
    g = next(p for p in render.structure_primitives(_doc(), 1000, 500) if p["kind"] == "glazing")
    by = {q["index"]: q for q in g["panels"]}
    assert by[1]["anchor"] == "ha_entity:binary_sensor.vent_window" and by[1]["operation"] == "casement_left"
    assert by[5]["anchor"] == "ha_entity:cover.vent_cover" and by[5]["operation"] == "tilt"
    assert by[6]["operation"] == "sliding" and by[6]["anchor"] is None, "an opening panel without an entity is drawn, just not stateful"
    assert all(by[i]["anchor"] is None and by[i]["operation"] is None for i in (0, 2, 3, 4, 7))


def test_svg_png_and_dxf_exports_draw_the_linked_panels():
    d = _doc()
    svg = render.render_svg(d, [], 1000, 500)
    assert 'data-operable="gv" data-panel="1" data-operation="casement_left"' in svg and 'data-operable="gv" data-panel="5" data-operation="tilt"' in svg
    assert render.render_png(d, [], 1000, 500)[:8] == b"\x89PNG\r\n\x1a\n"
    back = ezdxf.read(io.StringIO(dxf_export.render_dxf(d, [], 1000, 500).decode("utf-8")))
    kinds = sorted(e.get_xdata(dxf_export.APP_ID)[1][1] for e in back.modelspace() if e.dxf.layer == "SW_GLAZING")
    assert {"glass_panel:1:casement_left", "glass_panel:5:tilt", "glass_panel:6:sliding", "glass_panel:0"} <= set(kinds)


# ---------------------------------------------------------------- the API: save, reload, publish, package, import, diff

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


def _links(doc: dict) -> list:
    return [(o["panel"], o["operation"], o["anchor_ref"]) for w in doc["walls"] for o in (w.get("glazing") or {}).get("operable", [])]


def test_the_link_survives_save_reload_publish_and_every_export(world):
    c, vid = world
    g = _draft(c, vid)
    assert g["doc"]["schema_version"] == "2.0"
    wall = _wall()
    r = _put(c, vid, dict(g["doc"], walls=[wall]), g["geometry"]["revision"])
    assert r.status_code == 200, r.text
    g = _draft(c, vid)
    assert g["doc"]["schema_version"] == "2.1"
    assert _links(g["doc"]) == [(1, "casement_left", REF), (5, "tilt", REF2), (6, "sliding", None)], "reload returns the links exactly as saved"
    # the entities are not placed on this floor: nothing blocks (the link is an entity id, like a door's)
    assert not [i for i in g.get("issues", []) if i.get("severity") == "error"]
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    pub = c.get(f"/api/v1/plan-versions/{vid}/geometry").json()
    assert _links(pub["doc"]) == _links(g["doc"]) and pub["doc"]["schema_version"] == "2.1"
    # exports of the published document and of the draft
    for q in ("", "?draft=true"):
        svg = c.get(f"/api/v1/plan-versions/{vid}/export.svg{q}")
        assert svg.status_code == 200 and 'data-panel="1" data-operation="casement_left"' in svg.text
        assert c.get(f"/api/v1/plan-versions/{vid}/export.png{q}").content[:4] == b"\x89PNG"
        dxf = c.get(f"/api/v1/plan-versions/{vid}/export.dxf{q}")
        assert dxf.status_code == 200 and "SW_GLAZING" in dxf.text
    pkg = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": False})
    assert pkg.status_code == 200
    with zipfile.ZipFile(io.BytesIO(pkg.content)) as z:
        inside = json.loads(z.read("plan.json"))
    assert inside["schema_version"] == "2.1" and _links(inside) == _links(g["doc"]), "plan.json carries the links"


def test_the_package_import_restores_the_links_and_the_diff_sees_a_relink(world):
    c, vid = world
    g = _draft(c, vid)
    assert _put(c, vid, dict(g["doc"], walls=[_wall()]), g["geometry"]["revision"]).status_code == 200
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    published = c.get(f"/api/v1/plan-versions/{vid}/geometry").json()
    pkg = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": False}).content
    # the draft drifts: panel 1 is relinked to the other entity and panel 5 unlinked
    g = _draft(c, vid)
    drift = copy.deepcopy(g["doc"])
    ops = drift["walls"][0]["glazing"]["operable"]
    ops[0]["anchor_ref"], ops[1]["anchor_ref"] = REF2, None
    assert pg.diff(g["doc"], drift)["collections"] == {"walls": {"added": [], "removed": [], "changed": ["gv"]}}, "a relink is a change of that wall"
    assert _put(c, vid, drift, g["geometry"]["revision"]).status_code == 200
    assert _links(_draft(c, vid)["doc"]) != _links(published["doc"])
    files = {"file": ("p.swplan.zip", pkg, "application/zip")}
    plan = c.post(f"/api/v1/plan-versions/{vid}/package/preview?mode=replace", files=files)
    assert plan.status_code == 200, plan.text
    plan = plan.json()
    assert plan["diff"]["collections"]["walls"]["changed"] == ["gv"]
    done = c.post(f"/api/v1/plan-versions/{vid}/package/import?mode=replace&base_revision={plan['base_revision']}&expect_hash={plan['result_hash']}", files=files)
    assert done.status_code == 200, done.text
    after = _draft(c, vid)
    assert _links(after["doc"]) == [(1, "casement_left", REF), (5, "tilt", REF2), (6, "sliding", None)]
    assert after["geometry"]["doc_hash"] == published["geometry"]["doc_hash"]


def test_unlinking_and_converting_back_returns_to_2_0(world):
    c, vid = world
    g = _draft(c, vid)
    assert _put(c, vid, dict(g["doc"], walls=[_wall()]), g["geometry"]["revision"]).status_code == 200
    g = _draft(c, vid)
    assert g["doc"]["schema_version"] == "2.1"
    solid = dict(g["doc"]["walls"][0], kind="exterior")
    solid.pop("glazing")
    assert _put(c, vid, dict(g["doc"], walls=[solid]), g["geometry"]["revision"]).status_code == 200
    back = _draft(c, vid)
    assert back["doc"]["schema_version"] == "2.0" and _links(back["doc"]) == []
    assert "SW_GLAZING" not in c.get(f"/api/v1/plan-versions/{vid}/export.dxf?draft=true").text
