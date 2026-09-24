"""Plan Studio drawing, phase 2 (T085): objects are rotated footprints with a symbol id (a cylinder keeps its square
box), a stepped tribune carries its step lines, connectors run along their polyline with an arrow and a level delta
label, the level filter keeps connectors, a bound body follows its anchor, the golden file pins 24 primitives, the
SVG draws every layer and honours ?layers=, the PNG draws footprints, the routes accept the layer list."""
from __future__ import annotations

import io
import json
import pathlib
import xml.etree.ElementTree as ET

from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient
from PIL import Image

from smplwise.main import create_app
from smplwise.services import plan_catalog as cat
from smplwise.services import plan_geometry as pg
from smplwise.services import plan_geometry_render as render
from smplwise.services import plan_symbols

FIX = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "plan_geometry"


def _sample() -> dict:
    return json.loads((FIX / "sample-v2.json").read_text(encoding="utf-8"))


def _by_id(prims, pid):
    return next(p for p in prims if p["id"] == pid)


def test_the_sample_is_normalized_and_valid():
    doc = _sample()
    assert pg.normalize(doc, cat.builtin()["items"]) == doc, "the derived tribune connector in the fixture is exactly what normalize produces"
    assert [i for i in pg.validate(doc) if i["severity"] == "error"] == []


def test_object_primitives_are_rotated_footprints_with_a_symbol():
    prims = render.structure_primitives(_sample(), 1000, 800)
    assert [p["kind"] for p in prims] == ["wall"] * 9 + ["door", "window", "door", "door", "passage", "door", "label", "label", "connector", "connector"] + ["object"] * 5
    assert len(prims) == 24
    o1 = _by_id(prims, "o1")
    assert o1 == {"kind": "object", "id": "o1", "item_id": "chair.basic", "shape": "box", "icon": "chair", "color": "furniture", "level_id": "L0", "cx": 200.0, "cy": 160.0,
                  "w": 45.0, "h": 45.0, "rotation": 0.0, "corners": [[177.5, 137.5], [222.5, 137.5], [222.5, 182.5], [177.5, 182.5]], "label": None, "circuit_id": None,
                  "anchor": None, "steps": []}
    o2 = _by_id(prims, "o2")  # 1.4 x 0.7 m desk turned 90 degrees clockwise: x' = -y, y' = x
    assert o2["corners"] == [[335.0, 250.0], [335.0, 390.0], [265.0, 390.0], [265.0, 250.0]] and o2["rotation"] == 90.0 and o2["label"] == "שולחן" and o2["icon"] == "table"
    o3 = _by_id(prims, "o3")
    assert o3["shape"] == "cylinder" and o3["corners"] == [[480.0, 220.0], [520.0, 220.0], [520.0, 260.0], [480.0, 260.0]]
    assert o3["circuit_id"] == "k1" and o3["anchor"] == "ha_entity:light.store" and o3["color"] == "light" and o3["icon"] == "lamp"
    o4 = _by_id(prims, "o4")  # a 4 x 3 m tribune turned 180 degrees, 4 rows: three step lines across the width
    assert o4["shape"] == "stepped" and o4["corners"] == [[450.0, 630.0], [50.0, 630.0], [50.0, 330.0], [450.0, 330.0]]
    assert o4["steps"] == [[[450.0, 555.0], [50.0, 555.0]], [[450.0, 480.0], [50.0, 480.0]], [[450.0, 405.0], [50.0, 405.0]]]
    assert _by_id(prims, "o5")["level_id"] == "L1" and _by_id(prims, "o5")["label"] == "מטף"
    # an item the library no longer has still draws: a plain box, the neutral colour
    doc = _sample()
    doc["objects"][0]["item_id"] = "gone.item"
    ghost = _by_id(render.structure_primitives(doc, 1000, 800), "o1")
    assert ghost["shape"] == "box" and ghost["icon"] == "box" and ghost["color"] == "object" and ghost["corners"] == o1["corners"]


def test_connector_primitives_carry_an_arrow_and_a_level_delta_label():
    prims = render.structure_primitives(_sample(), 1000, 800)
    c1 = _by_id(prims, "c1")
    assert c1 == {"kind": "connector", "id": "c1", "ckind": "stairs", "points": [[700.0, 560.0], [800.0, 560.0]], "width": 120.0, "arrow": {"from": [786.0, 560.0], "to": [800.0, 560.0]},
                  "label": "↓ −1.2 מ׳", "lx": 750.0, "ly": 560.0, "level_from": "L0", "level_to": "L1"}
    cx = _by_id(prims, "cx-o4")
    assert cx["ckind"] == "tribune" and cx["points"] == [[250.0, 330.0], [250.0, 630.0]] and cx["width"] == 400.0 and cx["arrow"] == {"from": [250.0, 616.0], "to": [250.0, 630.0]}
    assert cx["label"] == "↓ −1.2 מ׳" and [cx["lx"], cx["ly"]] == [250.0, 480.0]
    levels = {lv["id"]: lv for lv in _sample()["levels"]}
    assert render.connector_label(levels, {"level_from": "L1", "level_to": "L0", "label": None}) == "↑ +1.2 מ׳"
    assert render.connector_label(levels, {"level_from": "L0", "level_to": None, "label": None, "floor_ids": ["f2"]}) == "↕"
    assert render.connector_label(levels, {"level_from": "L0", "level_to": "L1", "label": "לגלריה"}) == "לגלריה"


def test_the_level_filter_keeps_connectors_and_anchors_move_bound_bodies():
    doc = _sample()
    only = render.structure_primitives(doc, 1000, 800, "L1")
    assert sorted(p["id"] for p in only) == ["c1", "cx-o4", "lb", "o5", "of", "wd", "wd"] and len(only) == 7
    moved = pg.apply_anchor_positions(doc, {"ha_entity:light.store": {"x": 0.9, "y": 0.9, "rotation": 45}})
    o3 = _by_id(render.structure_primitives(moved, 1000, 800), "o3")
    assert [o3["cx"], o3["cy"], o3["rotation"]] == [900.0, 720.0, 45.0]
    assert _by_id(render.structure_primitives(doc, 1000, 800), "o3")["cx"] == 500.0, "the source document is untouched"


def test_the_golden_file_has_24_and_7_primitives():
    golden = json.loads((FIX / "sample-v2.primitives.json").read_text(encoding="utf-8"))
    assert len(golden["all"]) == 24 and len(golden["level_L1"]) == 7
    assert render.structure_primitives(_sample(), 1000, 800) == golden["all"] and render.structure_primitives(_sample(), 1000, 800, "L1") == golden["level_L1"]


def test_every_symbol_exists_once():
    assert set(plan_symbols.SYMBOLS) == set(cat.ICONS) and len(plan_symbols.SYMBOLS) == 24
    assert plan_symbols.symbol_markup("chair").startswith("<") and plan_symbols.symbol_markup("nope") == plan_symbols.SYMBOLS["box"]


def test_svg_draws_objects_connectors_and_honours_layers():
    doc = _sample()
    a = render.render_svg(doc, [], 1000, 800)
    assert a == render.render_svg(doc, [], 1000, 800)
    ns = {"s": "http://www.w3.org/2000/svg"}
    root = ET.fromstring(a)
    assert 'data-object="o1"' in a and 'data-item="chair.basic"' in a and 'data-symbol="chair"' in a and 'data-connector="c1"' in a and 'data-connector-arrow="c1"' in a
    assert 'data-object-step="o4"' in a and 'data-connector-label="cx-o4"' in a and ">↓ −1.2 מ׳<" in a and 'data-object-label="o2"' in a and ">שולחן<" in a
    assert len(root.findall(".//s:polyline", ns)) == 9, "connectors and objects are paths, polygons and ellipses: the wall count stays"
    assert len(root.findall(".//s:ellipse", ns)) == 2, "the cylinder lamp (o3) and the cylinder extinguisher (o5, catalog shape)"
    only = render.render_svg(doc, [], 1000, 800, layers={"structure"})
    assert 'data-wall="wa"' in only and "data-object" not in only and "data-connector" not in only
    objects = render.render_svg(doc, [], 1000, 800, layers={"objects"})
    assert 'data-object="o1"' in objects and "data-wall" not in objects and "<text" not in objects, "labels is its own layer"
    no_labels = render.render_svg(doc, [], 1000, 800, labels=False)
    assert "<text" not in no_labels and 'data-object="o1"' in no_labels
    lifted = render.render_svg(doc, [], 1000, 800, anchors={"ha_entity:light.store": {"x": 0.9, "y": 0.9, "rotation": 0}})
    assert 'cx="900"' in lifted


def test_png_draws_footprints(tmp_path):
    data = render.render_png(_sample(), [], 1000, 800)
    im = Image.open(io.BytesIO(data)).convert("RGB")
    assert im.getpixel((200, 160)) != (255, 255, 255), "the chair footprint is tinted"
    assert im.getpixel((500, 300)) == (255, 255, 255), "nothing between the objects"
    assert render.render_png(_sample(), [], 1000, 800, layers={"structure"}) != data
    assert render.render_png(_sample(), [], 1000, 800) == data


def test_export_routes_take_a_layer_list(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    vid = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()["id"]
    c.post(f"/api/v1/plan-versions/{vid}/publish")
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    sample = _sample()
    doc = dict(g["doc"], levels=sample["levels"], objects=sample["objects"][:2], groups=sample["groups"], connectors=[sample["connectors"][0]])
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": 0}).status_code == 200
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    svg = c.get(f"/api/v1/plan-versions/{vid}/export.svg?layers=objects,labels")
    assert svg.status_code == 200 and 'data-object="o1"' in svg.text and "data-connector" not in svg.text and ">שולחן<" in svg.text
    assert c.get(f"/api/v1/plan-versions/{vid}/export.svg?layers=walls").status_code == 422
    assert c.get(f"/api/v1/plan-versions/{vid}/export.png?layers=structure,connectors").status_code == 200
