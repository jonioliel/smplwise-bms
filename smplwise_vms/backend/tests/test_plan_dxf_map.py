"""DXF geometry mapping (T086, design 9.4): layer names suggest targets, block names and sizes suggest catalog items,
double lines become one wall with a thickness, an arc becomes a door on its wall with the swing of the drawing, window
lines become a window, blocks become objects of the document model, closed polylines become room polygons, everything
in the version's 0..1 space through the render extent, the rotation and the crop; the conventions of real CAD (walls
broken at openings, T-junctions, closed wall outlines, door blocks, mirrored arcs and inserts, dynamic blocks) map
without duplicates; the two routes serve the import screen, refuse a non-DXF asset, a viewer, a drawing without units
and a body that does not match the drawing or the library, and answer 504 when the worker outruns the guard."""
from __future__ import annotations

import dataclasses
import json
import math
import time

import ezdxf
import numpy as np
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import plan_dxf, plan_dxf_map

CATALOG = [
    {"id": "chair-1", "name_he": "כיסא", "name_en": "Chair", "tags": ["seat"], "size": (0.45, 0.45, 0.9)},
    {"id": "bed-1", "name_he": "מיטה", "name_en": "Single bed", "tags": ["bed"], "size": (2.0, 0.9, 0.5)},
    {"id": "door-1", "name_he": "דלת", "name_en": "Door", "tags": [], "size": (0.9, 0.1, 2.1)},
    {"id": "lamp-1", "name_he": "מנורת תקרה", "name_en": "Ceiling lamp", "tags": [], "size": (0.4, 0.4, 0.2), "z_ref": "ceiling", "z_m": -0.3},
]
GENERIC = {"catalog_id": "object.generic", "name": "עצם כללי"}
OBJECT_KEYS = {"id", "level_id", "item_id", "position", "rotation_deg", "size", "z_m", "params", "label", "anchor_ref", "group_id", "locked", "source", "confidence", "external_ids"}


def _drawing(path, units_code: int = 6) -> None:
    doc = ezdxf.new("R2010", setup=True)
    doc.header["$INSUNITS"] = units_code
    for name in ("A-WALL", "A-DOOR", "A-GLAZ", "A-FURN", "A-AREA", "TEXT"):
        doc.layers.add(name)
    msp = doc.modelspace()
    # the outer walls as double lines 0.2 m apart (outer face on the 12 x 8 rectangle), a single-line partition at x = 6
    for a, b in (((0, 0), (12, 0)), ((12, 0), (12, 8)), ((12, 8), (0, 8)), ((0, 8), (0, 0))):
        msp.add_line(a, b, dxfattribs={"layer": "A-WALL"})
    for a, b in (((0.2, 0.2), (11.8, 0.2)), ((11.8, 0.2), (11.8, 7.8)), ((11.8, 7.8), (0.2, 7.8)), ((0.2, 7.8), (0.2, 0.2))):
        msp.add_line(a, b, dxfattribs={"layer": "A-WALL"})
    msp.add_line((6, 0.2), (6, 7.8), dxfattribs={"layer": "A-WALL"})
    # a door: hinge at (6, 4) on the partition, the arc sweeps from (6.9, 4) [the tip, +x side] to (6, 4.9) [on the wall]
    msp.add_arc((6, 4), 0.9, 0, 90, dxfattribs={"layer": "A-DOOR"})
    # a window in the top wall: three lines from x = 2 to 3.2
    for y in (7.8, 7.9, 8.0):
        msp.add_line((2, y), (3.2, y), dxfattribs={"layer": "A-GLAZ"})
    for name, w, d in (("CHAIR", 0.45, 0.45), ("BED", 2.0, 1.6), ("WIDGET", 0.5, 0.5)):
        blk = doc.blocks.new(name=name)
        blk.add_lwpolyline([(0, 0), (w, 0), (w, d), (0, d)], close=True)
    msp.add_blockref("CHAIR", (3, 2), dxfattribs={"layer": "A-FURN"})
    msp.add_blockref("BED", (9, 2), dxfattribs={"layer": "A-FURN", "rotation": 90})
    msp.add_blockref("WIDGET", (4, 6), dxfattribs={"layer": "A-FURN"})
    msp.add_lwpolyline([(0.2, 0.2), (5.8, 0.2), (5.8, 7.8), (0.2, 7.8)], close=True, dxfattribs={"layer": "A-AREA"})
    msp.add_text("Lobby", dxfattribs={"layer": "TEXT", "height": 0.25}).set_placement((1, 1))
    doc.saveas(str(path))


def _cad_drawing(path) -> None:
    """How real CAD draws it: walls broken at their openings (with jambs), a T-junction, a wall drawn as a closed outline,
    three parallel lines, a door as a block (leaf + arc, hinge at the base point), a mirrored door arc (extrusion
    0,0,-1), mirrored and rotated furniture, a dynamic block's anonymous copy."""
    doc = ezdxf.new("R2010", setup=True)
    doc.header["$INSUNITS"] = 6
    for name in ("W", "D", "G", "F"):
        doc.layers.add(name)
    msp = doc.modelspace()

    def line(a, b, layer="W"):
        msp.add_line(a, b, dxfattribs={"layer": layer})

    # a T-junction: the outer face runs on, the inner face breaks where the double partition x = 4.9 / 5.1 meets it
    line((0, 0), (10, 0))
    line((0, 0.2), (4.9, 0.2))
    line((5.1, 0.2), (10, 0.2))
    line((4.9, 0.2), (4.9, 5))
    line((5.1, 0.2), (5.1, 5))
    # a wall drawn as a closed outline 5 x 0.2 (its two end caps are not walls)
    msp.add_lwpolyline([(0, 8), (5, 8), (5, 8.2), (0, 8.2)], close=True, dxfattribs={"layer": "W"})
    # three parallel lines 0.2 apart: one 0.4 m wall, not a pair plus a duplicate
    for y in (12, 12.2, 12.4):
        line((0, y), (6, y))
    # a double wall broken at a door (3 -> 3.9) and at a window (6 -> 7.2), with jambs
    for y in (16, 16.2):
        line((0, y), (3, y))
        line((3.9, y), (6, y))
        line((7.2, y), (10, y))
    for x in (3, 3.9, 6, 7.2):
        line((x, 16), (x, 16.2))
    msp.add_arc((3, 16.2), 0.9, 0, 90, dxfattribs={"layer": "D"})  # hinge on the jamb at x = 3, the leaf up
    for y in (16, 16.1, 16.2):
        line((6, y), (7.2, y), "G")
    # a door block on a single-line wall: hinge at the base point (15, 0), the leaf up, the arc to (15.9, 0)
    line((12, 0), (22, 0))
    door = doc.blocks.new("DOOR90")
    door.add_line((0, 0), (0, 0.9))
    door.add_arc((0, 0), 0.9, 0, 90)
    msp.add_blockref("DOOR90", (15, 0), dxfattribs={"layer": "D"})
    # a mirrored door arc on another single-line wall: centre (18, 4) in WCS is (-18, 4) in the arc's OCS
    line((12, 4), (22, 4))
    msp.add_arc((-18, 4), 0.9, 90, 180, dxfattribs={"layer": "D", "extrusion": (0, 0, -1)})
    # furniture: a desk as drawn, mirrored (xscale -1), turned 90 degrees; a dynamic block's anonymous copy of it
    desk = doc.blocks.new("DESK")
    desk.add_lwpolyline([(0, 0), (1.6, 0), (1.6, 0.8), (0, 0.8)], close=True)
    msp.add_blockref("DESK", (12, 8), dxfattribs={"layer": "F"})
    msp.add_blockref("DESK", (16, 8), dxfattribs={"layer": "F", "xscale": -1})
    msp.add_blockref("DESK", (20, 8), dxfattribs={"layer": "F", "rotation": 90})
    anon = doc.blocks.new_anonymous_block("U")
    anon.add_lwpolyline([(0, 0), (1.6, 0), (1.6, 0.8), (0, 0.8)], close=True)
    doc.appids.new("AcDbBlockRepBTag")
    anon.block_record.set_xdata("AcDbBlockRepBTag", [(1070, 1), (1005, desk.block_record.dxf.handle)])
    msp.add_blockref(anon.name, (12, 11), dxfattribs={"layer": "F"})
    # a door block on the furniture layer is not an object
    msp.add_blockref("DOOR90", (20, 11), dxfattribs={"layer": "F"})
    doc.saveas(str(path))


def _back(p, ext):
    """A 0..1 point (rotation 0, no crop) back in drawing metres."""
    return (p[0] * ext["w"] + ext["minx"], ext["maxy"] - p[1] * ext["h"])


def test_layer_and_block_suggestions():
    for name, want in (("A-WALL", "walls"), ("WALLS", "walls"), ("WALLS2", "walls"), ("M_MUR_EXT", "walls"), ("קירות", "walls"), ("A-DOOR", "openings"), ("דלתות", "openings"),
                       ("A-GLAZ", "windows"), ("WIND", "windows"), ("A-FURN", "objects"), ("EQPM", "objects"), ("ריהוט", "objects"), ("A-AREA", "rooms"), ("ROOM", "rooms"),
                       ("TEXT", "ignore"), ("0", "ignore"), ("DEFPOINTS", "ignore")):
        assert plan_dxf_map.suggest_layer(name) == want, name
    assert plan_dxf_map.suggest_block("CHAIR_01", (0.45, 0.45), CATALOG) == {"catalog_id": "chair-1", "name": "כיסא"}
    assert plan_dxf_map.suggest_block("BED-DOUBLE", (2.0, 1.6), CATALOG) == {"catalog_id": "bed-1", "name": "מיטה"}
    assert plan_dxf_map.suggest_block("SEAT", (0.5, 0.5), CATALOG) == {"catalog_id": "chair-1", "name": "כיסא"}, "a tag matches too"
    assert plan_dxf_map.suggest_block("כיסא", (0.5, 0.5), CATALOG) == {"catalog_id": "chair-1", "name": "כיסא"}, "the Hebrew name matches too"
    assert plan_dxf_map.suggest_block("WIDGET", (0.5, 0.5), CATALOG) == GENERIC
    assert plan_dxf_map.suggest_block("CHAIR", (0.5, 0.5), []) == {"catalog_id": "object.generic", "name": "כיסא"}, "the word list names it even without a catalog"
    assert plan_dxf_map.suggest_block("CHAIRS", (0.5, 0.5), CATALOG) == GENERIC, "whole words only"
    assert plan_dxf_map.suggest_block("CHAIR", (3.0, 3.0), CATALOG) == {"catalog_id": "object.generic", "name": "כיסא"}, "a 9 m2 block is no chair (footprint gate)"
    assert plan_dxf_map.suggest_block("CHAIR-TAG", (0.45, 0.45), CATALOG) == GENERIC, "an annotation word overrides the rest"
    assert plan_dxf_map.suggest_block("DOOR", (0.9, 0.9), CATALOG) == {"catalog_id": None, "name": "דלת"}, "a door block is not an object"
    assert plan_dxf_map.suggest_block("A-WINDOW-1200", (1.2, 0.2), CATALOG)["catalog_id"] is None
    choices = plan_dxf_map.catalog_choices(CATALOG)
    assert [c["id"] for c in choices][:2] == ["object.generic", "chair-1"] and choices[0]["name"] == "עצם כללי"
    real = plan_dxf_map.load_catalog(None)
    assert any(c["id"] == "object.generic" for c in real) and [c["id"] for c in plan_dxf_map.catalog_choices(real)].count("object.generic") == 1
    by = lambda n, s: plan_dxf_map.suggest_block(n, s, real)["catalog_id"]  # noqa: E731
    assert by("DOOR", (0.9, 0.9)) is None and by("Door_Single_900", (0.9, 0.9)) is None, "no door -> doorstation"
    assert by("CAR", (4.8, 1.9)) != "reader.card", "no car -> card reader"
    assert by("SOFA3", (2.1, 0.9)).startswith("sofa") and by("CHAIR", (0.45, 0.45)) == "chair.basic" and by("WC", (0.4, 0.7)) == "toilet.standard"


def test_summary_extent_and_transform(tmp_path):
    src = tmp_path / "plan.dxf"
    _drawing(src)
    s = plan_dxf_map.entities_summary(src, None, "m", CATALOG)
    assert plan_dxf_map.entities_summary(plan_dxf_map.load(src), None, "m", CATALOG) == s, "a loaded document gives the same summary as the path"
    by = {l["name"]: l for l in s["layers"]}
    assert s["units"] == "m" and s["metres_per_unit"] == 1.0
    assert by["A-WALL"]["count"] == 9 and by["A-WALL"]["suggested"] == "walls" and by["A-WALL"]["kinds"] == {"LINE": 9} and "m" in by["A-WALL"]["sample"]
    assert by["A-DOOR"]["count"] == 1 and by["A-DOOR"]["suggested"] == "openings" and by["A-DOOR"]["sample"].startswith("ARC")
    assert by["A-GLAZ"]["suggested"] == "windows" and by["A-FURN"]["count"] == 3 and by["A-AREA"]["suggested"] == "rooms" and by["TEXT"]["count"] == 0 and by["TEXT"]["suggested"] == "ignore"
    blocks = {b["name"]: b for b in s["blocks"]}
    assert blocks["CHAIR"]["count"] == 1 and [round(x, 2) for x in blocks["CHAIR"]["size_m"]] == [0.45, 0.45] and blocks["CHAIR"]["suggested"]["catalog_id"] == "chair-1"
    assert [round(x, 2) for x in blocks["BED"]["size_m"]] == [2.0, 1.6] and blocks["WIDGET"]["suggested"] == GENERIC
    ext = plan_dxf_map.extent_for(src, None)
    rendered = plan_dxf.render(src, tmp_path / "x.png", 400).extent
    for k in ("minx", "miny", "maxx", "maxy"):
        assert math.isclose(ext[k], rendered[k], abs_tol=1e-9), k
    assert math.isclose(ext["w"], 12.48) and math.isclose(ext["h"], 8.48)
    assert plan_dxf_map.extent_for(src, ["A-WALL"]) == plan_dxf_map.extent_for(src, ["A-WALL"], entities=plan_dxf_map.read_entities(src, None)), "precomputed entities, same extent"
    p = plan_dxf_map.to_version(3, 2, ext, 0, None)
    assert abs(p[0] - 3.24 / 12.48) < 1e-6 and abs(p[1] - 6.24 / 8.48) < 1e-6, "y up in the drawing, y down in the picture"
    q = plan_dxf_map.to_version(3, 2, ext, 90, {"x": 0.1, "y": 0.1, "w": 0.8, "h": 0.8})
    assert abs(q[0] - (1 - 6.24 / 8.48 - 0.1) / 0.8) < 1e-6 and abs(q[1] - (3.24 / 12.48 - 0.1) / 0.8) < 1e-6, "a 90 degree turn then the crop"


def test_map_geometry_walls_door_window_objects_rooms(tmp_path):
    src = tmp_path / "plan.dxf"
    _drawing(src)
    ext = plan_dxf_map.extent_for(src, None)
    layer_map = {"A-WALL": "walls", "A-DOOR": "openings", "A-GLAZ": "windows", "A-FURN": "objects", "A-AREA": "rooms", "TEXT": "ignore"}
    r = plan_dxf_map.map_geometry(src, layer_map=layer_map, block_map={}, units="m", extent=ext, rotation=0, crop=None, level_id="L0", run_id="d1", catalog=CATALOG, scale_m_per_px=0.03)
    assert r["detector"] == {"name": "plan_dxf_map", "version": plan_dxf_map.VERSION, "params": {"layers": 6, "blocks": 0, "units": "m", "rotation": 0, "crop": None}}, "counts, never the maps"
    assert r["scale"] == {"m_per_px": 0.03, "status": "measured"} and r["calibration_hint"] is None
    walls = r["walls"]
    assert len(walls) == 5 and all(w["id"].startswith("imp-d1-w") and w["source"] == "imported" and w["level_id"] == "L0" for w in walls)
    paired = [w for w in walls if abs(w["thickness_m"] - 0.2) < 0.011 and w["confidence"] >= 0.9]
    assert len(paired) == 4, [(w["thickness_m"], w["confidence"]) for w in walls]
    single = [w for w in walls if w["confidence"] < 0.9]
    assert len(single) == 1 and single[0]["thickness_m"] == 0.2, "an unpaired line takes the default thickness"
    # the paired top wall runs along y = 7.9 (0.1 m inside the outer face), the full 12 m
    W, H = 12.48, 8.48
    top = max(walls, key=lambda w: -(w["polyline"][0][1] + w["polyline"][1][1]))
    ys = [(8.24 - p[1] * H) for p in top["polyline"]]
    xs = sorted((p[0] * W - 0.24) for p in top["polyline"])
    assert all(abs(y - 7.9) < 0.02 for y in ys) and abs(xs[0] - 0) < 0.05 and abs(xs[1] - 12) < 0.05, (xs, ys)
    door = [o for o in r["openings"] if o["kind"] == "door"]
    assert len(door) == 1 and abs(door[0]["width_m"] - 0.9) < 0.02 and door[0]["source"] == "imported" and door[0]["height_m"] == 2.1
    partition = single[0]
    assert door[0]["wall_id"] == partition["id"]
    # the swing follows the drawing: the leaf tip (hinge + normal x width, geometry.ts convention) lands at (6.9, 4)
    a = np.array(partition["polyline"][0]) * [W, H]
    b = np.array(partition["polyline"][1]) * [W, H]
    d = (b - a) / np.linalg.norm(b - a)
    c = a + (b - a) * door[0]["t"]
    px_per_m = W / 12.48
    hinge = c - d * 0.9 * px_per_m / 2 if door[0]["hinge"] == "start" else c + d * 0.9 * px_per_m / 2
    n = np.array([d[1], -d[0]]) if door[0]["swing"] == "left" else np.array([-d[1], d[0]])
    tip = hinge + n * 0.9 * px_per_m
    assert abs((tip[0] - 0.24) - 6.9) < 0.05 and abs((8.24 - tip[1]) - 4.0) < 0.05, (door[0]["hinge"], door[0]["swing"], tip)
    win = [o for o in r["openings"] if o["kind"] == "window"]
    assert len(win) == 1 and abs(win[0]["width_m"] - 1.2) < 0.05 and win[0]["wall_id"] == top["id"] and win[0]["sill_m"] == 0.9
    assert min(abs(win[0]["t"] - 2.6 / 12), abs(win[0]["t"] - (1 - 2.6 / 12))) < 0.01
    # objects in the document model: position = the centre of the block's box, rotation 0 = the block as drawn
    objs = {o["external_ids"]["dxf_block"]: o for o in r["objects"]}
    assert set(objs) == {"CHAIR", "BED", "WIDGET"} and all(set(o) == OBJECT_KEYS and o["source"] == "imported" and o["id"].startswith("imp-d1-x") for o in r["objects"])
    chair = objs["CHAIR"]
    assert chair["item_id"] == "chair-1" and chair["label"] == "כיסא" and chair["z_m"] == 0 and chair["params"] == {} and chair["locked"] is False
    assert abs(chair["position"][0] - 3.465 / 12.48) < 1e-4 and abs(chair["position"][1] - 6.015 / 8.48) < 1e-4, "the centre (3.225, 2.225), not the insert corner"
    assert chair["size"] == {"w_m": 0.45, "d_m": 0.45, "h_m": 0.9} and chair["rotation_deg"] == 0 and chair["external_ids"]["dxf_handle"]
    bed = objs["BED"]
    assert bed["item_id"] == "bed-1" and bed["rotation_deg"] == 270 and bed["size"] == {"w_m": 2.0, "d_m": 1.6, "h_m": 0.5}, "a block turned 90 degrees CCW is -90 on the clockwise screen"
    assert np.allclose(_back(bed["position"], ext), (8.2, 3.0), atol=1e-3), "insert (9, 2) + R(90) (1, 0.8)"
    assert objs["WIDGET"]["item_id"] == "object.generic" and objs["WIDGET"]["label"] == "עצם כללי" and objs["WIDGET"]["size"] == {"w_m": 0.5, "d_m": 0.5, "h_m": 0.8}
    assert len(r["rooms"]) == 1 and len(r["rooms"][0]["polygon"]) == 4 and all(0 <= p["x"] <= 1 and 0 <= p["y"] <= 1 for p in r["rooms"][0]["polygon"])
    override = plan_dxf_map.map_geometry(src, layer_map=layer_map, block_map={"WIDGET": "lamp-1", "CHAIR": None}, units="m", extent=ext, rotation=90, crop=None, level_id="L0", run_id="d2",
                                         catalog=CATALOG, scale_m_per_px=0.03, ceiling_m=3.0)
    ov = {o["external_ids"]["dxf_block"]: o for o in override["objects"]}
    assert ov["WIDGET"]["item_id"] == "lamp-1" and ov["WIDGET"]["z_m"] == 2.7 and ov["WIDGET"]["label"] == "מנורת תקרה", "a ceiling item hangs from the level's ceiling"
    assert ov["CHAIR"]["item_id"] == "object.generic" and ov["CHAIR"]["label"] == "כיסא", "a null choice is the generic object"
    assert ov["BED"]["rotation_deg"] == 0 and ov["CHAIR"]["rotation_deg"] == 90, "the version's clockwise rotation adds"
    ignored = plan_dxf_map.map_geometry(src, layer_map={"A-WALL": "walls"}, block_map={}, units="m", extent=ext, rotation=0, crop=None, level_id="L0", run_id="d3", catalog=[], scale_m_per_px=0.03)
    assert len(ignored["walls"]) == 5 and ignored["openings"] == [] and ignored["objects"] == [] and ignored["rooms"] == []


def test_real_cad_conventions_map_without_duplicates(tmp_path):
    src = tmp_path / "cad.dxf"
    _cad_drawing(src)
    doc = plan_dxf_map.load(src)
    summary = plan_dxf_map.entities_summary(doc, None, "m", plan_dxf_map.load_catalog(None))
    blocks = {b["name"]: b for b in summary["blocks"]}
    assert set(blocks) == {"DESK", "DOOR90"} and blocks["DESK"]["count"] == 4, "the dynamic block's copy counts under its effective name"
    ents = plan_dxf_map.read_entities(doc, None)
    ext = plan_dxf_map.extent_for(doc, None, entities=ents)
    r = plan_dxf_map.map_geometry(doc, layer_map={"W": "walls", "D": "openings", "G": "windows", "F": "objects"}, block_map={}, units="m", extent=ext, rotation=0, crop=None,
                                  level_id="L0", run_id="c1", catalog=plan_dxf_map.load_catalog(None), scale_m_per_px=0.01, entities=ents)
    walls = [(w, [_back(p, ext) for p in w["polyline"]]) for w in r["walls"]]
    near = lambda y0: [(w, pts) for w, pts in walls if all(abs(p[1] - y0) < 0.25 and p[0] < 11 for p in pts)]  # noqa: E731
    # the T-junction: the outer wall in two pieces meeting at the junction (no stub, no off-centre duplicate), the partition
    tee = near(0.1)
    assert len(tee) == 2 and all(w["thickness_m"] == 0.2 and w["confidence"] == 0.9 for w, _ in tee), [(w["thickness_m"], pts) for w, pts in tee]
    spans = sorted(tuple(sorted(round(p[0], 2) for p in pts)) for _w, pts in tee)
    assert spans[0][0] == 0 and spans[-1][1] == 10 and spans[0][1] == spans[1][0], spans
    partition = [(w, pts) for w, pts in walls if all(abs(p[0] - 5.0) < 0.02 for p in pts)]
    assert len(partition) == 1 and partition[0][0]["thickness_m"] == 0.2
    # the closed outline is one wall; three parallel lines are one 0.4 m wall
    assert [(w["thickness_m"], round(pts[0][1], 2)) for w, pts in near(8.1)] == [(0.2, 8.1)]
    assert [(w["thickness_m"], round(pts[0][1], 2)) for w, pts in near(12.2)] == [(0.4, 12.2)]
    # the wall broken at a door and a window is one wall again, hosting both
    gap = near(16.1)
    assert len(gap) == 1 and sorted(round(p[0], 2) for p in gap[0][1]) == [0, 10]
    gap_openings = sorted((o["kind"], o["t"], o["width_m"]) for o in r["openings"] if o["wall_id"] == gap[0][0]["id"])
    assert [k for k, _t, _w in gap_openings] == ["door", "window"]
    assert abs(gap_openings[0][1] - 0.345) < 0.01 and abs(gap_openings[0][2] - 0.9) < 0.01 and abs(gap_openings[1][1] - 0.66) < 0.01 and abs(gap_openings[1][2] - 1.2) < 0.01
    # the door block and the mirrored arc: hinge at x = 15 / 18 (3 / 6 m along the 10 m wall), the opening 0.9 m toward +x, the leaf up
    for y0, t_want in ((0.0, 0.345), (4.0, 0.645)):
        host = [w for w, pts in walls if all(abs(p[1] - y0) < 0.01 for p in pts) and min(p[0] for p in pts) > 11]
        assert len(host) == 1, y0
        doors = [o for o in r["openings"] if o["wall_id"] == host[0]["id"]]
        assert len(doors) == 1 and doors[0]["kind"] == "door" and abs(doors[0]["t"] - t_want) < 0.005 and abs(doors[0]["width_m"] - 0.9) < 0.01 and doors[0]["hinge"] == "start" and doors[0]["swing"] == "left", (y0, doors)
    assert all(0 <= o["t"] <= 1 for o in r["openings"]) and len(r["openings"]) == 4
    assert len(r["walls"]) == 8, [pts for _w, pts in walls]
    # furniture: the centre of each desk, the mirrored one at the same angle, the turned one at 270; the door block is no object
    objs = sorted(r["objects"], key=lambda o: (round(_back(o["position"], ext)[1], 1), round(_back(o["position"], ext)[0], 1)))
    got = [(o["external_ids"]["dxf_block"], tuple(round(v, 2) for v in _back(o["position"], ext)), o["rotation_deg"], o["size"]["w_m"], o["size"]["d_m"]) for o in objs]
    assert got == [("DESK", (12.8, 8.4), 0, 1.6, 0.8), ("DESK", (15.2, 8.4), 0, 1.6, 0.8), ("DESK", (19.6, 8.8), 270, 1.6, 0.8), ("DESK", (12.8, 11.4), 0, 1.6, 0.8)], got
    assert all(o["item_id"] == "table.desk" for o in objs)


def test_large_drawing_maps_within_bound(tmp_path):
    """A generated 20k-entity drawing (a 50 x 50 grid of double-line rooms, door arcs, furniture, noise on other layers)
    is read once and mapped well inside the request guard."""
    doc = ezdxf.new("R2010", setup=True)
    doc.header["$INSUNITS"] = 6
    for name in ("A-WALL", "A-DOOR", "A-FURN", "NOISE"):
        doc.layers.add(name)
    msp = doc.modelspace()
    n = 50
    for k in range(n + 1):
        for i in range(n):
            for off in (-0.1, 0.1):
                msp.add_line((4 * i, 4 * k + off), (4 * i + 4, 4 * k + off), dxfattribs={"layer": "A-WALL"})
                msp.add_line((4 * k + off, 4 * i), (4 * k + off, 4 * i + 4), dxfattribs={"layer": "A-WALL"})
    chair = doc.blocks.new("CHAIR")
    chair.add_lwpolyline([(0, 0), (0.45, 0), (0.45, 0.45), (0, 0.45)], close=True)
    for i in range(n):
        for k in range(0, n, 5):
            msp.add_arc((4 * i + 1, 4 * k + 0.1), 0.9, 0, 90, dxfattribs={"layer": "A-DOOR"})
            msp.add_blockref("CHAIR", (4 * i + 2, 4 * k + 2), dxfattribs={"layer": "A-FURN"})
    while len(msp) < 20_000:
        j = len(msp)
        msp.add_line((j % 200, j // 200), (j % 200 + 0.5, j // 200 + 0.5), dxfattribs={"layer": "NOISE"})
    src = tmp_path / "big.dxf"
    doc.saveas(str(src))
    t0 = time.perf_counter()
    loaded = plan_dxf_map.load(src)  # the ezdxf load is timed apart: it is the library's cost, not the mapper's
    t1 = time.perf_counter()
    ext = plan_dxf_map.extent_for(loaded, None)
    r = plan_dxf_map.map_geometry(loaded, layer_map={"A-WALL": "walls", "A-DOOR": "openings", "A-FURN": "objects"}, block_map={}, units="m", extent=ext, rotation=0,
                                  crop=None, level_id="L0", run_id="big", catalog=plan_dxf_map.load_catalog(None), scale_m_per_px=0.01)
    elapsed = time.perf_counter() - t1
    print(f"20k-entity drawing: load {t1 - t0:.1f} s, read + extent + map {elapsed:.1f} s, {r['stats']}")
    assert elapsed < 15, elapsed
    assert len(r["walls"]) >= 2 * n * n and len(r["objects"]) == n * n // 5 and len(r["openings"]) == n * n // 5


def test_routes_serve_the_summary_and_import_candidates(settings, tmp_path):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    f2 = ids["floor2"]
    src = tmp_path / "plan.dxf"
    _drawing(src, units_code=0)  # unitless first: the drawing must be given units before geometry can be measured
    asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("plan.dxf", src.read_bytes(), "application/octet-stream")}).json()
    s = c.get(f"/api/v1/plan-assets/{asset['id']}/dxf/entities")
    assert s.status_code == 200, s.text
    body = s.json()
    assert body["asset_id"] == asset["id"] and body["units"] == "unitless" and body["metres_per_unit"] is None
    assert {l["name"]: l["suggested"] for l in body["layers"]}["A-WALL"] == "walls" and body["targets"][0] == {"id": "walls", "label": "קירות"}
    assert body["catalog_choices"][0] == {"id": "object.generic", "name": "עצם כללי"}
    assert [b["name"] for b in body["blocks"]] == ["BED", "CHAIR", "WIDGET"]
    png_asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    assert c.get(f"/api/v1/plan-assets/{png_asset['id']}/dxf/entities").status_code == 409
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    layer_map = {l["name"]: l["suggested"] for l in body["layers"]}
    unitless = c.post(f"/api/v1/plan-versions/{v['id']}/import-dxf-geometry", json={"layer_map": layer_map, "block_map": {}})
    assert unitless.status_code == 422 and unitless.json()["code"] == "dxf_unitless"
    assert c.put(f"/api/v1/plan-assets/{asset['id']}/dxf", json={"units": "m"}).status_code == 200
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert v["scale_m_per_px"], "with units the version carries the DXF scale"
    url = f"/api/v1/plan-versions/{v['id']}/import-dxf-geometry"
    # the body is bounded and checked against the drawing and the library before the file is read
    assert c.post(url, json={"layer_map": {"A-WALL": "nonsense"}}).status_code == 422
    assert c.post(url, json={"layer_map": {"x" * 256: "walls"}}).status_code == 422
    assert c.post(url, json={"layer_map": {f"L{i}": "walls" for i in range(2001)}}).status_code == 422
    assert c.post(url, json={"layer_map": {"A-WALL": "walls"}, "block_map": {"CHAIR": "Not An Id!"}}).json()["code"] == "validation"
    assert c.post(url, json={"layer_map": {}}).json()["code"] == "no_layers"
    assert c.post(url, json={"layer_map": {"A-WALL": "ignore", "TEXT": "ignore"}}).json()["code"] == "no_layers"
    unknown = c.post(url, json={"layer_map": {"A-WALL": "walls", "NOPE": "walls"}})
    assert unknown.status_code == 422 and unknown.json()["code"] == "unknown_layer" and unknown.json()["details"]["unknown"] == ["NOPE"]
    missing = c.post(url, json={"layer_map": {"A-WALL": "walls"}, "block_map": {"CHAIR": "no.such.item"}})
    assert missing.status_code == 422 and missing.json()["code"] == "unknown_item"
    assert c.post(url, json={"layer_map": layer_map, "level_id": "L9"}).json()["code"] == "unknown_level"
    r = c.post(url, json={"layer_map": layer_map, "block_map": {}})
    assert r.status_code == 200, r.text
    cands = r.json()
    assert len(cands["walls"]) == 5 and len(cands["openings"]) == 2 and len(cands["objects"]) == 3 and len(cands["rooms"]) == 1
    assert cands["version_id"] == v["id"] and cands["level_id"] == "L0" and cands["existing_auto"] == {"walls": 0, "openings": 0, "objects": 0} and cands["scale"]["status"] == "measured"
    assert all(w["source"] == "imported" for w in cands["walls"]) and cands["detector"]["params"]["layers"] == len(layer_map) and "layer_map" not in cands["detector"]["params"]
    assert all(set(o) == OBJECT_KEYS for o in cands["objects"]) and {o["item_id"] for o in cands["objects"]} >= {"chair.basic", "object.generic"}
    # the imported walls, openings and objects go through the same accept as detected ones, and the draft validates
    everything = [w["id"] for w in cands["walls"]] + [o["id"] for o in cands["openings"]] + [o["id"] for o in cands["objects"]]
    acc = c.post(f"/api/v1/plan-versions/{v['id']}/detect/accept", json={"accepted": everything, "edits": {}, "replace_auto": False,
                                                                        "candidates": {"walls": cands["walls"], "openings": cands["openings"], "objects": cands["objects"]},
                                                                        "base_revision": 0, "detector": cands["detector"]})
    assert acc.status_code == 200, acc.text
    saved = acc.json()["doc"]
    assert len(saved["walls"]) == 5 and len(saved["objects"]) == 3 and all(w["source"] == "imported" for w in saved["walls"]) and saved["meta"]["detector_version"].startswith("plan_dxf_map")
    assert not any(i["severity"] == "error" for i in acc.json()["issues"]), acc.json()["issues"]
    again = c.post(url, json={"layer_map": layer_map, "block_map": {}}).json()
    assert again["existing_auto"] == {"walls": 5, "openings": 2, "objects": 3}
    version_png = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": png_asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{version_png['id']}/import-dxf-geometry", json={"layer_map": {}}).status_code == 409
    bind(c, settings, "dana", "viewer", "floor", f2)
    assert c.get(f"/api/v1/plan-assets/{asset['id']}/dxf/entities", headers=as_user("dana")).status_code == 403
    assert c.post(url, json={"layer_map": layer_map}, headers=as_user("dana")).status_code == 403
    with app.state.db.connection() as conn:
        rows = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.import'").fetchall()]
    assert len(rows) == 2 and rows[0] == {"version_id": v["id"], "asset_id": asset["id"], "walls": 5, "openings": 2, "objects": 3, "rooms": 1, "layers": len(layer_map), "blocks": 0}


def test_routes_answer_504_when_the_worker_outruns_the_guard(settings, tmp_path, monkeypatch):
    def slow(*args, **kwargs):
        time.sleep(0.8)
        return {}

    monkeypatch.setattr(plan_dxf_map, "entities_summary", slow)
    monkeypatch.setattr(plan_dxf_map, "import_geometry", slow)
    app = create_app(dataclasses.replace(settings, detect_timeout_s=0.2))
    c = TestClient(app)
    f2 = seed_tree(c)["floor2"]
    src = tmp_path / "plan.dxf"
    _drawing(src)
    asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("plan.dxf", src.read_bytes(), "application/octet-stream")}).json()
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    t0 = time.perf_counter()
    s = c.get(f"/api/v1/plan-assets/{asset['id']}/dxf/entities")
    assert s.status_code == 504 and s.json()["code"] == "dxf_timeout" and s.json()["retryable"] is True
    r = c.post(f"/api/v1/plan-versions/{v['id']}/import-dxf-geometry", json={"layer_map": {"A-WALL": "walls"}})
    assert r.status_code == 504 and r.json()["code"] == "dxf_timeout"
    assert time.perf_counter() - t0 < 1.4, "neither request waits for its worker"
    with app.state.db.connection() as conn:
        rows = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.import'").fetchall()]
    assert rows == [{"version_id": v["id"], "asset_id": asset["id"], "timed_out": True, "timeout_s": 0.2}]


def _room_with(path, extra, units_code: int = 6) -> None:
    doc = ezdxf.new("R2010", setup=True)
    doc.header["$INSUNITS"] = units_code
    doc.layers.add("W")
    doc.layers.add("F")
    msp = doc.modelspace()
    for y in (0, 0.2):
        msp.add_line((0, y), (10, y), dxfattribs={"layer": "W"})
    extra(doc, msp)
    doc.saveas(str(path))


def test_kilometre_extents_are_refused_and_a_long_line_stays_cheap(tmp_path):
    src = tmp_path / "stray.dxf"
    _room_with(src, lambda doc, msp: msp.add_line((0, 5), (100_000, 5), dxfattribs={"layer": "W"}))
    t0 = time.perf_counter()
    try:
        plan_dxf_map.import_geometry(src, render_layers=None, layer_map={"W": "walls"}, block_map={}, units="m", rotation=0, crop=None, level_id="L0", run_id="k",
                                     catalog=[], scale_m_per_px=0.01)
        raise AssertionError("a 100 km extent must be refused")
    except plan_dxf.DxfError as exc:
        assert exc.code == "dxf_extent_too_large" and exc.details["limit_m"] == plan_dxf_map.MAX_EXTENT_M and exc.details["extent_m"] >= 100_000
    assert time.perf_counter() - t0 < 2
    # the spatial hash itself is bounded by the drawing size, not by the line length in metres
    t0 = time.perf_counter()
    walls, _stats = plan_dxf_map._pair_walls([((0.0, 0.0), (10.0, 0.0)), ((0.0, 0.2), (10.0, 0.2)), ((0.0, 5.0), (100_000.0, 5.0))])
    plan_dxf_map._bridge(walls, {"arcs": [], "boxes": [], "glazing": []}, {"arcs": plan_dxf_map._Grid(2.0), "boxes": plan_dxf_map._Grid(2.0), "glazing": plan_dxf_map._Grid(1.0)})
    assert time.perf_counter() - t0 < 2 and len(walls) == 2
    # a millimetre floor read as metres is 10 km wide: refused, while the same file in millimetres maps
    mm = tmp_path / "mm.dxf"
    _room_with(mm, lambda doc, msp: None, units_code=4)
    doc = ezdxf.readfile(str(mm))
    for e in doc.modelspace():
        e.transform(ezdxf.math.Matrix44.scale(1000, 1000, 1))
    doc.saveas(str(mm))
    ok = plan_dxf_map.import_geometry(mm, render_layers=None, layer_map={"W": "walls"}, block_map={}, units="mm", rotation=0, crop=None, level_id="L0", run_id="k", catalog=[], scale_m_per_px=0.01)
    assert len(ok["walls"]) == 1 and ok["walls"][0]["thickness_m"] == 0.2
    try:
        plan_dxf_map.import_geometry(mm, render_layers=None, layer_map={"W": "walls"}, block_map={}, units="m", rotation=0, crop=None, level_id="L0", run_id="k", catalog=[], scale_m_per_px=0.01)
        raise AssertionError("mm read as m must be refused")
    except plan_dxf.DxfError as exc:
        assert exc.code == "dxf_extent_too_large"


def test_one_suggestion_per_block_name_and_a_short_side_line_stays_a_wall(tmp_path):
    src = tmp_path / "scaled.dxf"

    def extra(doc, msp):
        desk = doc.blocks.new("DESK")
        desk.add_lwpolyline([(0, 0), (1.6, 0), (1.6, 0.8), (0, 0.8)], close=True)
        msp.add_blockref("DESK", (2, 3), dxfattribs={"layer": "F"})
        msp.add_blockref("DESK", (6, 3), dxfattribs={"layer": "F", "xscale": 2, "yscale": 2})
        msp.add_line((0, 0.4), (2, 0.4), dxfattribs={"layer": "W"})  # beside the 10 m wall, along only 20 % of it

    _room_with(src, extra)
    cat = plan_dxf_map.load_catalog(None)
    doc = plan_dxf_map.load(src)
    shown = {b["name"]: b for b in plan_dxf_map.entities_summary(doc, None, "m", cat)["blocks"]}
    assert shown["DESK"]["size_m"] == [1.6, 0.8] and shown["DESK"]["suggested"]["catalog_id"] == "table.desk", "the footprint of the first insert"
    r = plan_dxf_map.map_geometry(doc, layer_map={"W": "walls", "F": "objects"}, block_map={}, units="m", extent=plan_dxf_map.extent_for(doc, None), rotation=0, crop=None,
                                  level_id="L0", run_id="s", catalog=cat, scale_m_per_px=0.01)
    assert [o["item_id"] for o in r["objects"]] == ["table.desk", "table.desk"], "the scaled insert gets the item the card showed"
    assert sorted(o["size"]["w_m"] for o in r["objects"]) == [1.6, 3.2], "each insert keeps its own size"
    assert sorted((w["thickness_m"], w["confidence"]) for w in r["walls"]) == [(0.2, 0.6), (0.2, 0.9)], "no widening by a line along 20 % of the wall"
    assert r["stats"]["absorbed"] == 0


def test_an_import_failure_is_audited_and_answered_cleanly(settings, tmp_path, monkeypatch):
    def broken(*args, **kwargs):
        raise RuntimeError("boom")

    app = create_app(settings)
    c = TestClient(app)
    f2 = seed_tree(c)["floor2"]
    src = tmp_path / "stray.dxf"
    _room_with(src, lambda doc, msp: msp.add_line((0, 5), (100_000, 5), dxfattribs={"layer": "W"}))
    asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("stray.dxf", src.read_bytes(), "application/octet-stream")}).json()
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    url = f"/api/v1/plan-versions/{v['id']}/import-dxf-geometry"
    wide = c.post(url, json={"layer_map": {"W": "walls"}})
    assert wide.status_code == 422 and wide.json()["code"] == "dxf_extent_too_large" and "יחידות" in wide.json()["user_message"]
    monkeypatch.setattr(plan_dxf_map, "import_geometry", broken)
    failed = c.post(url, json={"layer_map": {"W": "walls"}})
    assert failed.status_code == 500 and failed.json()["code"] == "dxf_import_failed"
    with app.state.db.connection() as conn:
        rows = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.import'").fetchall()]
    assert rows == [{"version_id": v["id"], "asset_id": asset["id"], "failed": "DxfError", "code": "dxf_extent_too_large"},
                    {"version_id": v["id"], "asset_id": asset["id"], "failed": "RuntimeError"}]
