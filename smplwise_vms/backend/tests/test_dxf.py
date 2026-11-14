"""T065: DXF as a plan source through the isolated adapter — sniffed by content, inspected (units, layers, entity
counts, unsupported types reported, never silently dropped), rendered from chosen layers with the source kept
untouched, options editable, a version created from it carries the scale the drawing's units imply."""
from __future__ import annotations

import io
import math

import ezdxf
from conftest import seed_tree
from fastapi.testclient import TestClient
from PIL import Image

from smplwise.main import create_app
from smplwise.services import plan_dxf, plan_render

MINIMAL_DXF = """0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
WALLS
10
0
20
0
30
0
11
1000
21
0
31
0
0
LINE
8
WALLS
10
1000
20
0
30
0
11
1000
21
500
31
0
0
CIRCLE
8
DOORS
10
200
20
200
30
0
40
50
0
TEXT
8
LABELS
10
10
20
10
30
0
40
20
1
Lobby
0
ENDSEC
0
EOF
"""


def _rich_dxf(path):
    doc = ezdxf.new("R2010", setup=True)
    doc.header["$INSUNITS"] = 4  # millimetres
    doc.layers.add("WALLS")
    doc.layers.add("DOORS")
    doc.layers.add("FURNITURE")
    doc.layers.add("LABELS")
    msp = doc.modelspace()
    msp.add_lwpolyline([(0, 0), (12000, 0), (12000, 8000), (0, 8000)], close=True, dxfattribs={"layer": "WALLS"})
    msp.add_line((6000, 0), (6000, 8000), dxfattribs={"layer": "WALLS"})
    msp.add_arc((6000, 4000), 900, 0, 90, dxfattribs={"layer": "DOORS"})
    msp.add_circle((3000, 4000), 400, dxfattribs={"layer": "FURNITURE"})
    msp.add_text("Lobby", dxfattribs={"layer": "LABELS", "height": 250}).set_placement((100, 100))
    msp.add_hatch(color=2, dxfattribs={"layer": "FURNITURE"}).paths.add_polyline_path([(100, 100), (500, 100), (500, 500)], is_closed=True)
    blk = doc.blocks.new(name="CHAIR")
    blk.add_lwpolyline([(0, 0), (400, 0), (400, 400), (0, 400)], close=True)
    msp.add_blockref("CHAIR", (9000, 2000), dxfattribs={"layer": "FURNITURE"})
    msp.add_blockref("CHAIR", (9600, 2000), dxfattribs={"layer": "FURNITURE"})
    doc.saveas(str(path))


def test_sniff_by_content():
    assert plan_render.sniff_mime(MINIMAL_DXF.encode()) == "image/vnd.dxf"
    assert plan_render.sniff_mime(b"AutoCAD Binary DXF\r\n\x1a\x00" + b"\x00" * 40) == "image/vnd.dxf"
    assert plan_render.sniff_mime(b"%PDF-1.7 ...") == "application/pdf"
    assert plan_render.sniff_mime(b"0\nNOTASECTION\n") is None
    assert plan_dxf.sniff(b"  0\r\nSECTION\r\n  2\r\nHEADER")


def test_inspect_and_render_report_everything(tmp_path):
    src = tmp_path / "plan.dxf"
    _rich_dxf(src)
    info = plan_dxf.inspect(src)
    assert info.units == "mm" and info.units_code == 4 and info.drawable == 6, info.entity_counts
    assert info.unsupported == {"TEXT": 1, "HATCH": 1}, "text and hatch are counted, not dropped silently"
    names = {l["name"]: l["drawable"] for l in info.layers}
    assert names["WALLS"] == 2 and names["DOORS"] == 1 and names["FURNITURE"] == 3 and names.get("LABELS", 0) == 0
    assert info.extent and math.isclose(info.extent["width"], 12000) and math.isclose(info.extent["height"], 8000)
    out = tmp_path / "page.png"
    res = plan_dxf.render(src, out, 1200)
    assert res.partial is True and res.skipped == {"TEXT": 1, "HATCH": 1} and res.rendered == 6 and set(res.layers) == {"WALLS", "DOORS", "FURNITURE"}
    assert res.width == 1200 and abs(res.height - 1200 * 8480 / 12480) < 3, res.height  # aspect kept: 12000x8000 plus a 2 % margin of the longer side on each edge
    assert res.units == "mm" and res.meters_per_px and math.isclose(res.meters_per_px, 0.001 / res.px_per_unit)
    with Image.open(out) as im:
        dark_all = sum(1 for p in im.convert("L").getdata() if p < 128)
    assert dark_all > 1000
    walls_only = plan_dxf.render(src, tmp_path / "walls.png", 1200, layers=["WALLS"])
    assert walls_only.rendered == 2 and walls_only.layers == ["WALLS"]
    with Image.open(tmp_path / "walls.png") as im:
        dark_walls = sum(1 for p in im.convert("L").getdata() if p < 128)
    assert 0 < dark_walls < dark_all, "fewer layers, fewer pixels"
    import pytest

    with pytest.raises(plan_dxf.DxfError) as exc:
        plan_dxf.render(src, tmp_path / "none.png", 1200, layers=["LABELS"])
    assert exc.value.code == "dxf_empty"
    with pytest.raises(plan_dxf.DxfError) as exc2:
        plan_dxf.inspect(tmp_path / "missing.dxf")
    assert exc2.value.code == "corrupt_dxf"


def test_upload_options_and_version_scale(settings, tmp_path):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    f2 = ids["floor2"]
    src = tmp_path / "plan.dxf"
    _rich_dxf(src)
    r = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("floor.dxf", src.read_bytes(), "application/octet-stream")})
    assert r.status_code == 201, r.text
    asset = r.json()
    assert asset["kind"] == "dxf" and asset["mime"] == "image/vnd.dxf" and asset["page_count"] == 1
    # the source is kept as uploaded, the preview is a real picture
    stored = settings.data_dir / "plans" / asset["id"] / "source.dxf"
    assert stored.exists() and stored.read_bytes() == src.read_bytes()
    prev = c.get(f"/api/v1/plan-assets/{asset['id']}/pages/1/preview.png")
    assert prev.status_code == 200 and prev.headers["content-type"] == "image/png" and Image.open(io.BytesIO(prev.content)).size[0] > 100
    d = c.get(f"/api/v1/plan-assets/{asset['id']}/dxf").json()
    assert d["adapter"]["library"] == "ezdxf" and d["adapter"]["license"] == "MIT" and d["info"]["units"] == "mm" and d["render"]["partial"] is True and d["render"]["skipped"] == {"TEXT": 1, "HATCH": 1}
    assert d["options"] == {"layers": None, "units": None}
    # layer choice re-renders; unknown layer / empty choice / unknown units are refused
    assert c.put(f"/api/v1/plan-assets/{asset['id']}/dxf", json={"layers": ["NOPE"]}).json()["code"] == "unknown_layer"
    assert c.put(f"/api/v1/plan-assets/{asset['id']}/dxf", json={"layers": []}).json()["code"] == "no_layers"
    assert c.put(f"/api/v1/plan-assets/{asset['id']}/dxf", json={"units": "parsec"}).json()["code"] == "unknown_units"
    assert c.put(f"/api/v1/plan-assets/{asset['id']}/dxf", json={"layers": ["LABELS"]}).json()["code"] == "dxf_empty"
    d2 = c.put(f"/api/v1/plan-assets/{asset['id']}/dxf", json={"layers": ["WALLS", "DOORS"], "units": "cm"}).json()
    assert d2["options"] == {"layers": ["WALLS", "DOORS"], "units": "cm"} and d2["render"]["rendered"] == 3 and d2["render"]["units"] == "cm"
    prev2 = c.get(f"/api/v1/plan-assets/{asset['id']}/pages/1/preview.png")
    assert prev2.status_code == 200 and prev2.content != prev.content
    # a version made from the drawing carries the scale its units imply (centimetres chosen: 12000 units = 120 m)
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]})
    assert v.status_code == 201, v.text
    ver = v.json()
    assert ver["scale_m_per_px"] and ver["width_px"] > 0
    expected = 120 * (1 + 2 * 0.02) / ver["width_px"]  # extent plus the 2 % margin on each side, over the version width
    assert math.isclose(ver["scale_m_per_px"], expected, rel_tol=0.03), (ver["scale_m_per_px"], expected)
    # a hand-written minimal DXF (no tables) also goes through; a non-DXF with a .dxf name is refused by content
    r2 = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("tiny.dxf", MINIMAL_DXF.encode(), "application/octet-stream")})
    assert r2.status_code == 201, r2.text
    assert c.get(f"/api/v1/plan-assets/{r2.json()['id']}/dxf").json()["info"]["unsupported"] == {"TEXT": 1}
    assert c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("fake.dxf", b"hello world", "application/octet-stream")}).status_code == 415
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'plan.asset.dxf_options'").fetchone()[0] == 1
