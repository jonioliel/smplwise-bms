"""DXF geometry mapping (T086, design 9.4): layer names suggest targets, block names and sizes suggest catalog items,
double lines become one wall with a thickness, an arc becomes a door on its wall with the swing of the drawing, window
lines become a window, blocks become objects, closed polylines become room polygons, everything in the version's 0..1
space through the render extent, the rotation and the crop; the two routes serve the import screen and refuse a
non-DXF asset, a viewer and a drawing without units."""
from __future__ import annotations

import io
import json
import math

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
]


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


def test_layer_and_block_suggestions():
    for name, want in (("A-WALL", "walls"), ("WALLS", "walls"), ("M_MUR_EXT", "walls"), ("קירות", "walls"), ("A-DOOR", "openings"), ("דלתות", "openings"),
                       ("A-GLAZ", "windows"), ("WIND", "windows"), ("A-FURN", "objects"), ("EQPM", "objects"), ("ריהוט", "objects"), ("A-AREA", "rooms"), ("ROOM", "rooms"),
                       ("TEXT", "ignore"), ("0", "ignore"), ("DEFPOINTS", "ignore")):
        assert plan_dxf_map.suggest_layer(name) == want, name
    assert plan_dxf_map.suggest_block("CHAIR_01", (0.45, 0.45), CATALOG) == {"catalog_id": "chair-1", "name": "כיסא"}
    assert plan_dxf_map.suggest_block("BED-DOUBLE", (2.0, 1.6), CATALOG) == {"catalog_id": "bed-1", "name": "מיטה"}
    assert plan_dxf_map.suggest_block("SEAT", (0.5, 0.5), CATALOG) == {"catalog_id": "chair-1", "name": "כיסא"}, "a tag matches too"
    assert plan_dxf_map.suggest_block("WIDGET", (0.5, 0.5), CATALOG) == {"catalog_id": None, "name": "עצם כללי"}
    assert plan_dxf_map.suggest_block("CHAIR", (0.5, 0.5), []) == {"catalog_id": None, "name": "כיסא"}, "the word list names it even without a catalog"
    assert [c["id"] for c in plan_dxf_map.catalog_choices(CATALOG)][:2] == [None, "chair-1"] and plan_dxf_map.catalog_choices(CATALOG)[0]["name"] == "עצם כללי"
    assert isinstance(plan_dxf_map.load_catalog(None), list), "no catalog file, no table: an empty list, not a crash"


def test_summary_extent_and_transform(tmp_path):
    src = tmp_path / "plan.dxf"
    _drawing(src)
    s = plan_dxf_map.entities_summary(src, None, "m", CATALOG)
    by = {l["name"]: l for l in s["layers"]}
    assert s["units"] == "m" and s["metres_per_unit"] == 1.0
    assert by["A-WALL"]["count"] == 9 and by["A-WALL"]["suggested"] == "walls" and by["A-WALL"]["kinds"] == {"LINE": 9} and "m" in by["A-WALL"]["sample"]
    assert by["A-DOOR"]["count"] == 1 and by["A-DOOR"]["suggested"] == "openings" and by["A-DOOR"]["sample"].startswith("ARC")
    assert by["A-GLAZ"]["suggested"] == "windows" and by["A-FURN"]["count"] == 3 and by["A-AREA"]["suggested"] == "rooms" and by["TEXT"]["count"] == 0 and by["TEXT"]["suggested"] == "ignore"
    blocks = {b["name"]: b for b in s["blocks"]}
    assert blocks["CHAIR"]["count"] == 1 and [round(x, 2) for x in blocks["CHAIR"]["size_m"]] == [0.45, 0.45] and blocks["CHAIR"]["suggested"]["catalog_id"] == "chair-1"
    assert [round(x, 2) for x in blocks["BED"]["size_m"]] == [2.0, 1.6] and blocks["WIDGET"]["suggested"] == {"catalog_id": None, "name": "עצם כללי"}
    ext = plan_dxf_map.extent_for(src, None)
    rendered = plan_dxf.render(src, tmp_path / "x.png", 400).extent
    for k in ("minx", "miny", "maxx", "maxy"):
        assert math.isclose(ext[k], rendered[k], abs_tol=1e-9), k
    assert math.isclose(ext["w"], 12.48) and math.isclose(ext["h"], 8.48)
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
    assert r["detector"]["name"] == "plan_dxf_map" and r["scale"] == {"m_per_px": 0.03, "status": "measured"} and r["calibration_hint"] is None
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
    objs = {o["name"]: o for o in r["objects"]}
    assert set(objs) == {"כיסא", "מיטה", "עצם כללי"} and all(o["source"] == "imported" and o["id"].startswith("imp-d1-x") for o in r["objects"])
    assert objs["כיסא"]["catalog_id"] == "chair-1" and abs(objs["כיסא"]["pose"]["x"] - 3.24 / 12.48) < 1e-4 and abs(objs["כיסא"]["pose"]["y"] - 6.24 / 8.48) < 1e-4
    assert objs["כיסא"]["size"] == {"w_m": 0.45, "d_m": 0.45, "h_m": 0.9} and objs["כיסא"]["pose"]["rotation_deg"] == 90 and objs["כיסא"]["external_ids"]["dxf_block"] == "CHAIR"
    assert objs["מיטה"]["pose"]["rotation_deg"] == 0 and objs["מיטה"]["size"]["w_m"] == 2.0 and objs["מיטה"]["size"]["h_m"] == 0.5, "a block turned 90 degrees CCW points up"
    assert objs["עצם כללי"]["catalog_id"] is None and objs["עצם כללי"]["size"] == {"w_m": 0.5, "d_m": 0.5, "h_m": 0.8}
    assert len(r["rooms"]) == 1 and len(r["rooms"][0]["polygon"]) == 4 and all(0 <= p["x"] <= 1 and 0 <= p["y"] <= 1 for p in r["rooms"][0]["polygon"])
    override = plan_dxf_map.map_geometry(src, layer_map=layer_map, block_map={"WIDGET": "bed-1"}, units="m", extent=ext, rotation=0, crop=None, level_id="L0", run_id="d2", catalog=CATALOG, scale_m_per_px=0.03)
    assert [o["catalog_id"] for o in override["objects"] if o["external_ids"]["dxf_block"] == "WIDGET"] == ["bed-1"]
    ignored = plan_dxf_map.map_geometry(src, layer_map={"A-WALL": "walls"}, block_map={}, units="m", extent=ext, rotation=0, crop=None, level_id="L0", run_id="d3", catalog=[], scale_m_per_px=0.03)
    assert len(ignored["walls"]) == 5 and ignored["openings"] == [] and ignored["objects"] == [] and ignored["rooms"] == []


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
    assert {l["name"]: l["suggested"] for l in body["layers"]}["A-WALL"] == "walls" and body["targets"][0] == {"id": "walls", "label": "קירות"} and body["catalog_choices"][0]["id"] is None
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
    assert c.post(f"/api/v1/plan-versions/{v['id']}/import-dxf-geometry", json={"layer_map": {"A-WALL": "nonsense"}}).status_code == 422
    assert c.post(f"/api/v1/plan-versions/{v['id']}/import-dxf-geometry", json={"layer_map": layer_map, "level_id": "L9"}).json()["code"] == "unknown_level"
    r = c.post(f"/api/v1/plan-versions/{v['id']}/import-dxf-geometry", json={"layer_map": layer_map, "block_map": {}})
    assert r.status_code == 200, r.text
    cands = r.json()
    assert len(cands["walls"]) == 5 and len(cands["openings"]) == 2 and len(cands["objects"]) == 3 and len(cands["rooms"]) == 1
    assert cands["version_id"] == v["id"] and cands["level_id"] == "L0" and cands["existing_auto"] == {"walls": 0, "openings": 0} and cands["scale"]["status"] == "measured"
    assert all(w["source"] == "imported" for w in cands["walls"])
    # the imported walls and openings go through the same accept as detected ones
    acc = c.post(f"/api/v1/plan-versions/{v['id']}/detect/accept", json={"accepted": [w["id"] for w in cands["walls"]] + [o["id"] for o in cands["openings"]], "edits": {}, "replace_auto": False,
                                                                        "candidates": {"walls": cands["walls"], "openings": cands["openings"]}, "base_revision": 0, "detector": cands["detector"]})
    assert acc.status_code == 200, acc.text
    assert len(acc.json()["doc"]["walls"]) == 5 and all(w["source"] == "imported" for w in acc.json()["doc"]["walls"]) and acc.json()["doc"]["meta"]["detector_version"].startswith("plan_dxf_map")
    assert not any(i["severity"] == "error" for i in acc.json()["issues"]), acc.json()["issues"]
    version_png = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": png_asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{version_png['id']}/import-dxf-geometry", json={"layer_map": {}}).status_code == 409
    bind(c, settings, "dana", "viewer", "floor", f2)
    assert c.get(f"/api/v1/plan-assets/{asset['id']}/dxf/entities", headers=as_user("dana")).status_code == 403
    assert c.post(f"/api/v1/plan-versions/{v['id']}/import-dxf-geometry", json={"layer_map": layer_map}, headers=as_user("dana")).status_code == 403
    with app.state.db.connection() as conn:
        rows = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.import'").fetchall()]
    assert len(rows) == 1 and rows[0] == {"version_id": v["id"], "asset_id": asset["id"], "walls": 5, "openings": 2, "objects": 3, "rooms": 1, "layers": len(layer_map), "blocks": 0}
