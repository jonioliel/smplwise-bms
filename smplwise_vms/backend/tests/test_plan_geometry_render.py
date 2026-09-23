"""Plan Studio drawing (T084): the structure primitives are deterministic, openings cut their wall, free wall ends are
extended by half the thickness, the level filter works, and the golden file the frontend compares with is current."""
from __future__ import annotations

import json
import pathlib

from smplwise.services import plan_geometry as pg
from smplwise.services import plan_geometry_render as render

FIX = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "plan_geometry"


def _sample() -> dict:
    return json.loads((FIX / "sample-v2.json").read_text(encoding="utf-8"))


def test_the_sample_fixture_is_a_valid_document():
    assert [i for i in pg.validate(_sample()) if i["severity"] == "error"] == []


def test_openings_cut_their_wall_and_free_ends_are_extended():
    prims = render.structure_primitives(_sample(), 1000, 800)
    wb = [p for p in prims if p["kind"] == "wall" and p["id"] == "wb"]
    # wb: (100,400)-(600,400), 15 px thick; door oc cuts [310, 390], passage oe cuts [500, 600] up to the wall end
    assert [p["points"] for p in wb] == [[[92.5, 400.0], [310.0, 400.0]], [[390.0, 400.0], [500.0, 400.0]]]
    assert [p["part"] for p in wb] == [0, 1] and wb[0]["width"] == 15.0
    door = next(p for p in prims if p["id"] == "oc")
    assert door["kind"] == "door" and door["gap"] == [[310.0, 400.0], [390.0, 400.0]]
    assert len(door["leaves"]) == 1 and door["leaves"][0][0] == [390.0, 400.0] and door["arcs"][0]["r"] == 80.0
    assert len(next(p for p in prims if p["id"] == "od")["leaves"]) == 2
    assert [p["kind"] for p in prims if p["id"] == "ob"] == ["window"]
    assert [p["kind"] for p in prims if p["id"] == "oe"] == ["passage"]
    wa_parts = [p for p in prims if p["kind"] == "wall" and p["id"] == "wa"]
    assert len(wa_parts) == 3 and wa_parts[1]["points"] == [[385.0, 80.0], [900.0, 80.0], [900.0, 120.0]]
    assert [p["id"] for p in prims if p["kind"] == "label"] == ["la", "lb"]


def test_level_filter():
    prims = render.structure_primitives(_sample(), 1000, 800, "L1")
    assert sorted({p["id"] for p in prims}) == ["lb", "of", "wd"]
    assert [p["id"] for p in prims if p["kind"] == "wall"] == ["wd", "wd"]


def test_primitives_are_deterministic_and_match_the_golden_file():
    doc = _sample()
    assert render.structure_primitives(doc, 1000, 800) == render.structure_primitives(json.loads(json.dumps(doc)), 1000, 800)
    golden = json.loads((FIX / "sample-v2.primitives.json").read_text(encoding="utf-8"))
    assert golden["width"] == 1000 and golden["height"] == 800
    assert render.structure_primitives(doc, 1000, 800) == golden["all"]
    assert render.structure_primitives(doc, 1000, 800, "L1") == golden["level_L1"]
