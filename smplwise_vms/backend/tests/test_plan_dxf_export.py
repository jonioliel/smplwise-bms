"""Plan Studio 5 (T088, ST5): the DXF export. Every test reads the written file back with a DXF reader (ezdxf) and
checks the entities against the primitives the SVG and the map draw: the fixed layers, the units, the mirrored y, the
item ids in XDATA, Hebrew text, the cleaning of control and bidi characters, and the route's permissions."""
from __future__ import annotations

import copy
import io
import json
import pathlib
import re

import ezdxf
import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import plan_dxf
from smplwise.services import plan_dxf_export as dx
from smplwise.services import plan_geometry_render as render

FIX = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "plan_geometry"
ZONES = [{"id": "z1", "name": "מחסן", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.6, "y": 0.1}, {"x": 0.6, "y": 0.5}, {"x": 0.1, "y": 0.5}]}]
ANCHORS = [{"resource_type": "camera", "resource_id": "cam1", "name": "כניסה ראשית", "x": 0.5, "y": 0.5, "rotation_degrees": 90},
           {"resource_type": "ha_entity", "resource_id": "light.hall", "name": "תאורת מבואה", "x": 0.2, "y": 0.7, "rotation_degrees": 0}]


def _sample() -> dict:
    return json.loads((FIX / "sample-v2.json").read_text(encoding="utf-8"))


def _read(data: bytes) -> ezdxf.document.Drawing:
    return ezdxf.read(io.StringIO(data.decode("utf-8")))


def _on(doc, layer: str, kind: str | None = None) -> list:
    """The entities of a layer FAMILY: the fixed name, or its per-level layers (SW_WALLS-L0, ...) when the plan has more
    than one level."""
    return [e for e in doc.modelspace() if (e.dxf.layer == layer or e.dxf.layer.startswith(layer + "-")) and (kind is None or e.dxftype() == kind)]


def _xid(e) -> str:
    return e.get_xdata(dx.APP_ID)[0].value


def test_the_written_file_reads_back_with_the_same_entities():
    doc = _sample()
    data = dx.render_dxf(doc, ZONES, 1000, 800, anchors=ANCHORS)
    back = _read(data)
    auditor = back.audit()
    assert not auditor.has_errors, [str(e) for e in auditor.errors]
    assert back.dxfversion == "AC1032"
    expected = {"SW_DEVICES"} | {f"{n}-{lv}" for n in dx.LEVEL_FAMILIES for lv in ("L0", "L1")}
    assert expected <= {lay.dxf.name for lay in back.layers}, "two levels: a layer family per level"
    prims = render.structure_primitives(doc, 1000, 800)
    walls = [p for p in prims if p["kind"] == "wall"]
    got = _on(back, "SW_WALLS", "LWPOLYLINE")
    assert len(got) == len(walls) and len(walls) > 0
    assert sorted(_xid(e) for e in got) == sorted(p["id"] for p in walls)
    # every opening is there, by id: door leaves and swings, window glass, passages
    openings = {p["id"] for p in prims if p["kind"] in ("door", "window", "passage")}
    assert {_xid(e) for e in _on(back, "SW_OPENINGS")} == openings
    leaves = sum(len(p["leaves"]) for p in prims if p["kind"] == "door")
    arcs = sum(len(p["arcs"]) for p in prims if p["kind"] == "door")
    windows = sum(len(p["lines"]) for p in prims if p["kind"] == "window")
    passages = sum(1 for p in prims if p["kind"] == "passage")
    assert len(_on(back, "SW_OPENINGS", "LINE")) == leaves + windows + passages
    assert len(_on(back, "SW_OPENINGS", "ARC")) == arcs
    # objects, connectors, rooms and devices
    objects = [p for p in prims if p["kind"] == "object"]
    shapes = [e for e in _on(back, "SW_OBJECTS") if e.dxftype() in ("LWPOLYLINE", "ELLIPSE")]
    assert sorted(_xid(e) for e in shapes) == sorted(p["id"] for p in objects)
    connectors = [p for p in prims if p["kind"] == "connector"]
    per_level = sum(len({c["level_from"], c["level_to"]}) for c in connectors)
    assert len(_on(back, "SW_CONNECTORS", "LWPOLYLINE")) == per_level and per_level > len(connectors) > 0
    rooms = _on(back, "SW_ROOMS", "LWPOLYLINE")
    assert len(rooms) == 1 and rooms[0].closed and _xid(rooms[0]) == "z1"
    assert len(_on(back, "SW_DEVICES", "CIRCLE")) == 2
    assert len(_on(back, "SW_DEVICES", "LINE")) == 1, "a heading line for the camera only"
    # Hebrew text survives as text (labels, room name, device names)
    texts = {e.plain_text() for e in back.modelspace() if e.dxftype() == "MTEXT"}
    for lb in doc["labels"]:
        assert lb["text"] in texts
    assert {"מחסן", "כניסה ראשית", "תאורת מבואה"} <= texts
    assert "\\U+" not in data.decode("utf-8"), "R2018 is UTF-8: no escaped code points"


def test_units_axes_and_header():
    doc = _sample()  # calibrated: 0.01 m per pixel
    back = _read(dx.render_dxf(doc, [], 1000, 800))
    assert back.header["$INSUNITS"] == 6 and back.header["$MEASUREMENT"] == 1
    custom = dict(back.header.custom_vars)
    assert custom["SW_UNITS"] == "m" and custom["SW_SCALE_STATUS"] == "measured" and custom["SW_PLAN_WIDTH"] == "10" and custom["SW_PLAN_HEIGHT"] == "8"
    wall = next(p for p in render.structure_primitives(doc, 1000, 800) if p["kind"] == "wall")
    e = next(e for e in _on(back, "SW_WALLS") if _xid(e) == wall["id"])
    pts = [(round(x, 4), round(y, 4)) for x, y in e.get_points("xy")]
    expected = [(round(x * 0.01, 4), round((800 - y) * 0.01, 4)) for x, y in wall["points"]]
    assert pts == expected, "metres, y mirrored about the plan height"
    assert e.dxf.const_width == pytest.approx(wall["width"] * 0.01)
    # our own DXF reader (the plan upload path) takes the file as a metric drawing with our layers
    info = None
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        p = pathlib.Path(tmp) / "x.dxf"
        p.write_bytes(dx.render_dxf(doc, ZONES, 1000, 800))
        info = plan_dxf.inspect(p)
    assert info.units == "m"
    assert {"SW_WALLS-L0", "SW_WALLS-L1", "SW_OPENINGS-L0", "SW_ROOMS-L0"} <= {l["name"] for l in info.layers if l["drawable"]}
    assert info.extent is not None and 0 <= info.extent["minx"] and info.extent["maxx"] <= 10.5


def test_an_uncalibrated_plan_stays_in_pixels():
    doc = _sample()
    doc["dimensions"] = {**doc["dimensions"], "scale_m_per_px": None, "calibration": {"status": "missing", "method": None, "pairs": [], "residual_pct": None, "reason": "לא בוצע כיול"}}
    back = _read(dx.render_dxf(doc, [], 1000, 800))
    assert back.header["$INSUNITS"] == 0
    custom = dict(back.header.custom_vars)
    assert custom["SW_UNITS"] == "px" and custom["SW_SCALE_STATUS"] == "missing" and custom["SW_PLAN_WIDTH"] == "1000"


def test_level_filter_and_layer_switch():
    doc = _sample()
    only = _read(dx.render_dxf(doc, ZONES, 1000, 800, level="L1"))
    ids = {_xid(e) for e in _on(only, "SW_WALLS")}
    assert "wd" in ids and "wa" not in ids
    bare = _read(dx.render_dxf(doc, ZONES, 1000, 800, layers={"structure"}))
    assert _on(bare, "SW_WALLS") and not _on(bare, "SW_OBJECTS") and not _on(bare, "SW_LABELS") and not _on(bare, "SW_CONNECTORS")
    assert _on(bare, "SW_ROOMS"), "rooms and devices are always drawn"


def test_text_is_cleaned_and_escaped():
    doc = _sample()
    doc["labels"][0] = {**doc["labels"][0], "text": "מטבח {A}\\B‮שקר‏\x07", "level_id": "L0"}
    back = _read(dx.render_dxf(doc, [], 1000, 800))
    texts = [e for e in back.modelspace() if e.dxftype() == "MTEXT" and _xid(e) == doc["labels"][0]["id"]]
    assert len(texts) == 1
    raw = texts[0].text
    assert "‮" not in raw and "‏" not in raw and "\x07" not in raw
    assert texts[0].plain_text() == "מטבח {A}\\Bשקר"
    assert dx.clean_text("a\nb") == "a\\Pb"


def test_deterministic_geometry():
    """Two exports of the same document draw the same entities (the header carries ezdxf's own timestamps and GUIDs)."""
    doc = _sample()

    def body(data: bytes) -> list:
        return [(e.dxftype(), e.dxf.layer, _xid(e)) for e in _read(data).modelspace()]

    assert body(dx.render_dxf(doc, ZONES, 1000, 800, anchors=ANCHORS)) == body(dx.render_dxf(copy.deepcopy(doc), ZONES, 1000, 800, anchors=ANCHORS))


def test_route_serves_the_published_structure_and_guards_drafts(settings):
    c = TestClient(create_app(settings))
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    vid = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()["id"]
    c.post(f"/api/v1/plan-versions/{vid}/publish")
    assert c.get(f"/api/v1/plan-versions/{vid}/export.dxf").status_code == 404
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    wall = {"id": "w1", "level_id": "L0", "polyline": [[0.1, 0.2], [0.6, 0.2]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "interior",
            "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}
    label = {"id": "l1", "text": "לובי", "position": [0.3, 0.4], "level_id": "L0", "size": 14}
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], walls=[wall], labels=[label]), "base_revision": 0}).status_code == 200
    d = c.get(f"/api/v1/plan-versions/{vid}/export.dxf?draft=true")
    assert d.status_code == 200 and d.headers["content-type"].startswith("image/vnd.dxf") and d.headers["content-disposition"].endswith('.dxf"')
    c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    r = c.get(f"/api/v1/plan-versions/{vid}/export.dxf")
    assert r.status_code == 200
    back = _read(r.content)
    assert [_xid(e) for e in _on(back, "SW_WALLS")] == ["w1"]
    assert "לובי" in {e.plain_text() for e in back.modelspace() if e.dxftype() == "MTEXT"}
    custom = dict(back.header.custom_vars)
    assert custom["SW_PLAN_VERSION"] == vid and custom["SW_STAGE"] == "published" and len(custom["SW_DOC_HASH"]) == 64
    assert c.get(f"/api/v1/plan-versions/{vid}/export.dxf?layers=bogus").status_code == 422
    bind(c, settings, "dana", "viewer", "floor", ids["floor2"])
    assert c.get(f"/api/v1/plan-versions/{vid}/export.dxf", headers=as_user("dana")).status_code == 200
    assert c.get(f"/api/v1/plan-versions/{vid}/export.dxf?draft=true", headers=as_user("dana")).status_code == 403
    assert c.get(f"/api/v1/plan-versions/{vid}/export.dxf", headers=as_user("stranger")).status_code == 403


# ---------------------------------------------------------------- PLN2: a layer family per level, the plan picture

def _single_level() -> dict:
    doc = _sample()
    doc["levels"] = [lv for lv in doc["levels"] if lv["id"] == "L0"]
    for coll in ("walls", "labels", "objects"):
        doc[coll] = [x for x in doc[coll] if x.get("level_id") == "L0"]
    keep = {w["id"] for w in doc["walls"]}
    doc["openings"] = [o for o in doc["openings"] if o["wall_id"] in keep]
    doc["connectors"] = []
    return doc


def _xdata(e) -> list[str]:
    return [t.value for t in e.get_xdata(dx.APP_ID)]


def test_a_single_level_plan_keeps_the_fixed_layer_names():
    doc = _single_level()
    back = _read(dx.render_dxf(doc, ZONES, 1000, 800, anchors=ANCHORS))
    names = {lay.dxf.name for lay in back.layers}
    assert set(dx.LAYERS) <= names and not any("-" in n for n in names if n.startswith("SW_")), names
    assert {e.dxf.layer for e in back.modelspace()} <= set(dx.LAYERS)
    assert _on(back, "SW_WALLS") and all(e.dxf.layer == "SW_WALLS" for e in _on(back, "SW_WALLS"))
    assert not any(k.startswith("SW_LEVEL_") for k, _ in back.header.custom_vars)
    assert all(len(_xdata(e)) == 2 for e in back.modelspace()), "no level value in XDATA"
    assert dx.level_suffixes(doc) == {}


def test_each_level_draws_into_its_own_layer_family():
    doc = _sample()
    back = _read(dx.render_dxf(doc, ZONES, 1000, 800, anchors=ANCHORS))
    assert not back.audit().has_errors
    for lv in ("L0", "L1"):
        wall_ids = {w["id"] for w in doc["walls"] if w["level_id"] == lv}
        assert wall_ids and {_xid(e) for e in back.modelspace() if e.dxf.layer == f"SW_WALLS-{lv}"} == wall_ids
        assert all(_xdata(e)[2] == lv for e in back.modelspace() if e.dxf.layer.endswith(f"-{lv}")), "the level id is the third XDATA value"
    # objects and labels by their level
    for coll, fam in (("objects", "SW_OBJECTS"), ("labels", "SW_LABELS")):
        for item in doc[coll]:
            layers = {e.dxf.layer for e in back.modelspace() if _xid(e) == item["id"] and e.dxftype() in ("LWPOLYLINE", "ELLIPSE", "MTEXT") and e.dxf.layer.startswith(fam)}
            assert layers == {f"{fam}-{item['level_id']}"}, (item["id"], layers)
    # openings follow their wall's level
    wall_level = {w["id"]: w["level_id"] for w in doc["walls"]}
    for o in doc["openings"]:
        assert {e.dxf.layer for e in back.modelspace() if _xid(e) == o["id"]} == {f"SW_OPENINGS-{wall_level[o['wall_id']]}"}
    # a connector between L0 and L1 is on both levels' connector layers; devices stay on the floor's layer
    c1 = [e for e in back.modelspace() if _xid(e) == "c1" and e.dxftype() == "LWPOLYLINE"]
    assert sorted(e.dxf.layer for e in c1) == ["SW_CONNECTORS-L0", "SW_CONNECTORS-L1"]
    assert {e.dxf.layer for e in back.modelspace() if _xid(e).startswith(("camera:", "ha_entity:"))} == {"SW_DEVICES"}
    # a room without a level goes with the default level
    assert {e.dxf.layer for e in back.modelspace() if _xid(e) == "z1"} == {"SW_ROOMS-L0"}
    # the level names travel in the layer descriptions and the header (Hebrew as text)
    custom = dict(back.header.custom_vars)
    for lv in doc["levels"]:
        assert custom[f"SW_LEVEL_{lv['id']}"] == f"{lv['name']} | {lv['elevation_m']:g} m"
        assert lv["name"] in back.layers.get(f"SW_WALLS-{lv['id']}").description


def test_the_level_filter_keeps_the_level_layer_names():
    doc = _sample()
    only = _read(dx.render_dxf(doc, ZONES, 1000, 800, level="L1"))
    drawn = {e.dxf.layer for e in only.modelspace()}
    assert "SW_WALLS-L1" in drawn and not any(n.endswith("-L0") for n in drawn), drawn
    assert {_xid(e) for e in only.modelspace() if e.dxf.layer == "SW_WALLS-L1"} == {"wd"}
    # the connectors that reach L1 are on L1's layer only (their other end is not exported)
    assert {e.dxf.layer for e in only.modelspace() if _xid(e) == "c1"} == {"SW_CONNECTORS-L1"}


@pytest.mark.parametrize("ids,expected", [
    (["L0", "L1"], {"L0": "L0", "L1": "L1"}),
    (["ground floor", "gallery/2"], {"ground floor": "GROUND_FLOOR", "gallery/2": "GALLERY_2"}),
    (["קרקע", "a*b"], {"קרקע": "LV0", "a*b": "A_B"}),
    (["a-b", "a_b"], {"a-b": "A_B", "a_b": "LV1"}),
    (["x" * 64, "y"], {"x" * 64: "X" * dx.MAX_SUFFIX, "y": "Y"}),
])
def test_level_suffixes_are_layer_safe_and_unique(ids, expected):
    doc = {"levels": [{"id": i, "name": i, "elevation_m": n * 3.0, "ceiling_height_m": 3.0, "is_default": n == 0} for n, i in enumerate(ids)]}
    got = dx.level_suffixes(doc)
    assert got == expected
    assert len(set(got.values())) == len(got)
    assert all(re.fullmatch(r"[A-Z0-9_]{1,%d}" % dx.MAX_SUFFIX, s) for s in got.values())


def test_hostile_level_ids_and_names_still_write_a_valid_file():
    doc = _sample()
    bad = 'L<1>/"*'
    doc["levels"][1] = {**doc["levels"][1], "id": bad, "name": "גלריה {\\x}\u202e\x07"}
    for coll in ("walls", "labels", "objects"):
        for x in doc[coll]:
            if x.get("level_id") == "L1":
                x["level_id"] = bad
    for c in doc["connectors"]:
        c["level_to"] = bad
    back = _read(dx.render_dxf(doc, ZONES, 1000, 800))
    assert not back.audit().has_errors
    names = {lay.dxf.name for lay in back.layers}
    assert "SW_WALLS-L_1" in names and not any(ch in n for n in names for ch in '<>/"*\\')
    desc = back.layers.get("SW_WALLS-L_1").description
    assert "\u202e" not in desc and "\x07" not in desc


def test_the_plan_picture_is_an_image_entity_beside_the_drawing():
    doc = _sample()  # calibrated, 0.01 m per pixel
    back = _read(dx.render_dxf(doc, [], 1000, 800, background={"file_name": "background.png", "width_px": 1000, "height_px": 800}))
    assert not back.audit().has_errors
    images = [e for e in back.modelspace() if e.dxftype() == "IMAGE"]
    assert len(images) == 1
    img = images[0]
    assert img.dxf.layer == "SW_BACKGROUND" and list(back.modelspace())[0] is img, "drawn first: the structure sits on top"
    assert img.image_def.dxf.filename == "background.png", "a bare file name: the picture sits in the drawing's own folder"
    assert tuple(img.dxf.image_size)[:2] == (1000, 800)
    corners = img.boundary_path_wcs()
    xs, ys = [p.x for p in corners], [p.y for p in corners]
    assert min(xs) == pytest.approx(0, abs=1e-6) and max(xs) == pytest.approx(10) and min(ys) == pytest.approx(0, abs=1e-6) and max(ys) == pytest.approx(8)
    # no background, or a name that is not a bare file name, or no size: no IMAGE and no layer
    for bad in (None, {"file_name": "../x.png", "width_px": 10, "height_px": 10}, {"file_name": "a/b.png", "width_px": 10, "height_px": 10},
                {"file_name": "C:\\x.png", "width_px": 10, "height_px": 10}, {"file_name": ".hidden", "width_px": 10, "height_px": 10},
                {"file_name": "b.png", "width_px": 0, "height_px": 10}, {"file_name": "b.png", "width_px": "x", "height_px": 10}):
        plain = _read(dx.render_dxf(doc, [], 1000, 800, background=bad))
        assert not [e for e in plain.modelspace() if e.dxftype() == "IMAGE"] and "SW_BACKGROUND" not in {lay.dxf.name for lay in plain.layers}, bad
