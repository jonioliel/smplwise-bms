"""The crop the wizard shows is the crop the server saves: previews are served already rotated, and a
normalized crop on the rotated page selects the same pixels in the derived version image."""
from __future__ import annotations

import io

from conftest import seed_tree
from fastapi.testclient import TestClient
from PIL import Image

from smplwise.main import create_app


def quadrant_png(w: int = 400, h: int = 200) -> bytes:
    """Four solid quadrants: TL red, TR green, BL blue, BR yellow."""
    im = Image.new("RGB", (w, h))
    px = im.load()
    for x in range(w):
        for y in range(h):
            px[x, y] = (220, 30, 30) if (x < w // 2 and y < h // 2) else (30, 180, 60) if (x >= w // 2 and y < h // 2) else (30, 60, 220) if (x < w // 2) else (240, 210, 40)
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def dominant(png: bytes) -> tuple[int, int, int]:
    im = Image.open(io.BytesIO(png)).convert("RGB")
    im = im.resize((1, 1), Image.BOX)
    return im.getpixel((0, 0))


def close(a: tuple[int, int, int], b: tuple[int, int, int], tol: int = 12) -> bool:
    return all(abs(x - y) <= tol for x, y in zip(a, b))


def test_rotated_preview_and_matching_crop(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", quadrant_png(), "image/png")}).json()
    p0 = c.get(f"/api/v1/plan-assets/{asset['id']}/pages/1/preview.png")
    p90 = c.get(f"/api/v1/plan-assets/{asset['id']}/pages/1/preview.png?rotation=90")
    assert p0.status_code == 200 and p90.status_code == 200
    s0 = Image.open(io.BytesIO(p0.content)).size
    s90 = Image.open(io.BytesIO(p90.content)).size
    assert s0[0] > s0[1] and s90[0] < s90[1], "a 90° preview swaps width and height"
    assert c.get(f"/api/v1/plan-assets/{asset['id']}/pages/1/preview.png?rotation=45").status_code == 422
    # after a 90° clockwise turn the top-left quadrant of the rotated page is the source's bottom-left (blue)
    im90 = Image.open(io.BytesIO(p90.content)).convert("RGB")
    tl = im90.crop((0, 0, im90.width // 2, im90.height // 2)).resize((1, 1), Image.BOX).getpixel((0, 0))
    assert close(tl, (30, 60, 220)), tl
    # the same normalized crop on the derived version yields the same quadrant
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"], "page": 1, "rotation": 90, "crop": {"x": 0, "y": 0, "w": 0.5, "h": 0.5}}).json()
    img = c.get(f"/api/v1/plan-versions/{v['id']}/image.png").content
    assert close(dominant(img), (30, 60, 220)), dominant(img)
    # and without rotation, the bottom-right quarter is yellow
    v2 = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"], "page": 1, "rotation": 0, "crop": {"x": 0.5, "y": 0.5, "w": 0.5, "h": 0.5}}).json()
    assert close(dominant(c.get(f"/api/v1/plan-versions/{v2['id']}/image.png").content), (240, 210, 40))
