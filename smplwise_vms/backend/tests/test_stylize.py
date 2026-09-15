"""Stylized plan rendering (design M11, local variant): thin strokes go, walls and rooms stay, the map can
switch between the source and the stylized picture, and only importers may run it."""
from __future__ import annotations

import io

import numpy as np
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from smplwise.main import create_app
from smplwise.services import plan_stylize


def synthetic_plan(w: int = 900, h: int = 650) -> Image.Image:
    """Outer wall, two partitions (three rooms), a thin dimension line, small text-like marks and a door gap."""
    im = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(im)
    d.rectangle([40, 40, w - 40, h - 40], outline=0, width=14)
    d.rectangle([w // 2 - 6, 40, w // 2 + 6, h - 40], fill=0)
    d.rectangle([40, h // 2 - 6, w // 2, h // 2 + 6], fill=0)
    d.rectangle([w // 2 - 6, h // 2 + 40, w // 2 + 6, h // 2 + 110], fill=255)  # door opening in the partition
    d.line([60, h - 20, w - 60, h - 20], fill=0, width=1)  # dimension line
    for i in range(30):
        x = 80 + i * 25
        d.rectangle([x, 60, x + 6, 72], outline=0, width=1)  # text-like specks
    d.line([100, 100, 300, 100], fill=0, width=2)  # furniture outline
    return im


def test_stylize_removes_thin_strokes_and_finds_rooms(tmp_path):
    src = tmp_path / "plan.png"
    synthetic_plan().save(src)
    out = tmp_path / "plan.stylized.png"
    r = plan_stylize.stylize(src, out, "medium", keep_lines=False)
    assert out.exists() and r["rooms"] >= 2 and r["width_px"] == 900 and r["ms"] >= 0
    px = np.asarray(Image.open(out).convert("RGB"))
    assert tuple(px[45, 450]) == plan_stylize.WALL, "outer wall kept"
    assert tuple(px[630, 450]) in (plan_stylize.CANVAS, plan_stylize.ROOM), "dimension line removed"
    assert tuple(px[100, 200]) in (plan_stylize.CANVAS, plan_stylize.ROOM), "thin furniture outline removed"
    assert tuple(px[200, 200]) == plan_stylize.ROOM, "inside a room is white"
    assert tuple(px[10, 10]) == plan_stylize.CANVAS, "outside is canvas"
    r2 = plan_stylize.stylize(src, tmp_path / "keep.png", "light", keep_lines=True)
    assert r2["rooms"] >= 2
    assert tuple(np.asarray(Image.open(tmp_path / "keep.png").convert("RGB"))[100, 200]) == plan_stylize.FURNITURE, "thin lines kept faintly on request"


def test_labeling_counts_enclosed_regions():
    free = np.ones((40, 60), dtype=bool)
    free[:, 30] = False  # a wall splitting the area in two
    free[20, :] = False  # and another one
    lab = plan_stylize.label_regions(free)
    ids = {int(v) for v in np.unique(lab) if v > 0}
    assert len(ids) == 4


def test_stylize_api_and_render_mode(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    buf = io.BytesIO()
    synthetic_plan(700, 500).save(buf, format="PNG")
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", buf.getvalue(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert v["render_mode"] == "source" and v["stylized_url"] is None
    r = c.post(f"/api/v1/plan-versions/{v['id']}/stylize", json={"strength": "medium", "keep_lines": False})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["rooms"] >= 2 and body["stylized_url"].endswith("stylized.png") and body["source_url"].endswith("source.png")
    assert c.get("/api/v1/" + body["stylized_url"].removeprefix("api/v1/")).headers["content-type"] == "image/png"
    # switching the render mode changes what the map serves; the source stays reachable
    assert c.patch(f"/api/v1/plan-versions/{v['id']}", json={"render_mode": "stylized"}).json()["render_mode"] == "stylized"
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    m = c.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    assert m["plan"]["image_url"].endswith("stylized.png") and m["plan"]["render_mode"] == "stylized" and m["plan"]["source_url"].endswith("source.png")
    assert c.patch(f"/api/v1/plan-versions/{v['id']}", json={"render_mode": "source"}).json()["image_url"].endswith("image.png")
    # a version without a stylized picture cannot be switched to it
    v2 = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.patch(f"/api/v1/plan-versions/{v2['id']}", json={"render_mode": "stylized"}).status_code == 409
    # permissions: a viewer may see the published picture but not run the processing
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    assert c.get(f"/api/v1/plan-versions/{v['id']}/stylized.png", headers=as_user("ron")).status_code == 200
    assert c.post(f"/api/v1/plan-versions/{v['id']}/stylize", json={"strength": "light"}, headers=as_user("ron")).status_code == 403
    assert c.patch(f"/api/v1/plan-versions/{v['id']}", json={"render_mode": "stylized"}, headers=as_user("ron")).status_code == 403
