"""Plan Studio exports (T084): SVG and PNG are drawn from the same primitives as the map - deterministic byte for byte,
the level filter applies, the PNG draws walls over the plan picture - and the routes serve the published structure
(drafts only to editors)."""
from __future__ import annotations

import io
import json
import pathlib
import xml.etree.ElementTree as ET

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient
from PIL import Image

from smplwise.main import create_app
from smplwise.services import plan_geometry_render as render

FIX = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "plan_geometry"
ZONES = [{"id": "z1", "name": "מחסן", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.6, "y": 0.1}, {"x": 0.6, "y": 0.5}, {"x": 0.1, "y": 0.5}]}]


def _sample() -> dict:
    return json.loads((FIX / "sample-v2.json").read_text(encoding="utf-8"))


def test_svg_is_deterministic_and_draws_every_item():
    doc = _sample()
    a = render.render_svg(doc, ZONES, 1000, 800)
    assert a == render.render_svg(doc, ZONES, 1000, 800)
    root = ET.fromstring(a)
    ns = {"s": "http://www.w3.org/2000/svg"}
    assert len(root.findall(".//s:polyline", ns)) == len([p for p in render.structure_primitives(doc, 1000, 800) if p["kind"] == "wall"])
    assert 'data-opening="oc"' in a and 'data-room="z1"' in a and ">מחסן<" in a
    only = render.render_svg(doc, ZONES, 1000, 800, level="L1", rooms=False, labels=False)
    assert 'data-wall="wd"' in only and 'data-wall="wa"' not in only and "<text" not in only and "data-room" not in only


def test_png_draws_walls_over_the_background(tmp_path):
    bg = tmp_path / "bg.png"
    Image.new("RGB", (1000, 800), (255, 255, 255)).save(bg)
    data = render.render_png(_sample(), [], 1000, 800, background=bg)
    im = Image.open(io.BytesIO(data)).convert("RGB")
    assert im.size == (1000, 800)
    assert max(im.getpixel((500, 80))) < 150, "wall wa crosses (500, 80)"
    assert im.getpixel((500, 300)) == (255, 255, 255), "nothing in the middle of the room"
    assert render.render_png(_sample(), [], 1000, 800, background=bg) == data


def test_export_routes_serve_the_published_structure(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    vid = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()["id"]
    c.post(f"/api/v1/plan-versions/{vid}/publish")
    assert c.get(f"/api/v1/plan-versions/{vid}/export.svg").status_code == 404
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    wall = {"id": "w1", "level_id": "L0", "polyline": [[0.1, 0.2], [0.6, 0.2]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "interior",
            "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}
    c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], walls=[wall]), "base_revision": 0})
    assert c.get(f"/api/v1/plan-versions/{vid}/export.svg?draft=true").status_code == 200
    c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    svg = c.get(f"/api/v1/plan-versions/{vid}/export.svg")
    assert svg.status_code == 200 and svg.headers["content-type"].startswith("image/svg+xml") and 'data-wall="w1"' in svg.text
    assert c.get(f"/api/v1/plan-versions/{vid}/export.svg").content == svg.content
    png = c.get(f"/api/v1/plan-versions/{vid}/export.png")
    assert png.status_code == 200 and png.headers["content-type"] == "image/png" and Image.open(io.BytesIO(png.content)).size == (640, 400)
    bind(c, settings, "dana", "viewer", "floor", ids["floor2"])
    assert c.get(f"/api/v1/plan-versions/{vid}/export.svg", headers=as_user("dana")).status_code == 200
    assert c.get(f"/api/v1/plan-versions/{vid}/export.svg?draft=true", headers=as_user("dana")).status_code == 403
