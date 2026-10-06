"""Plan Studio 5 (T088, ST5): the DXF export. Every test reads the written file back with a DXF reader (ezdxf) and
checks the entities against the primitives the SVG and the map draw: the fixed layers, the units, the mirrored y, the
item ids in XDATA, Hebrew text, the cleaning of control and bidi characters, and the route's permissions."""
from __future__ import annotations

import copy
import io
import json
import pathlib

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
    return [e for e in doc.modelspace() if e.dxf.layer == layer and (kind is None or e.dxftype() == kind)]


def _xid(e) -> str:
    return e.get_xdata(dx.APP_ID)[0].value


def test_the_written_file_reads_back_with_the_same_entities():
    doc = _sample()
    data = dx.render_dxf(doc, ZONES, 1000, 800, anchors=ANCHORS)
    back = _read(data)
    auditor = back.audit()
    assert not auditor.has_errors, [str(e) for e in auditor.errors]
    assert back.dxfversion == "AC1032"
    assert {name for name in dx.LAYERS} <= {lay.dxf.name for lay in back.layers}
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
    assert len(_on(back, "SW_CONNECTORS", "LWPOLYLINE")) == len(connectors)
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
    assert {"SW_WALLS", "SW_OPENINGS", "SW_ROOMS"} <= {l["name"] for l in info.layers if l["drawable"]}
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
