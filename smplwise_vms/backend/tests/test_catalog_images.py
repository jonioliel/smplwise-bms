"""R1 (0.1.67): a photo per site and per building - upload (content-sniffed, re-encoded, bounded), serve, delete,
permission (site.content.configure to change, map.read to see)."""
from __future__ import annotations

from io import BytesIO

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app


def _png(w: int = 2400, h: int = 1200) -> bytes:
    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (w, h), (30, 90, 200)).save(buf, format="PNG")
    return buf.getvalue()


def test_site_and_building_images(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids = seed_tree(c)
        tree = c.get("/api/v1/sites?tree=true").json()
        site = tree["sites"][0]
        assert site["image_url"] is None
        building = site["buildings"][0]
        # not an image
        r = c.post(f"/api/v1/sites/{site['id']}/image", files={"file": ("x.png", b"hello", "image/png")})
        assert r.status_code == 415
        r = c.post(f"/api/v1/sites/{site['id']}/image", files={"file": ("x.png", _png(), "image/png")})
        assert r.status_code == 200 and r.json()["image_url"].startswith(f"api/v1/catalog/images/site/{site['id']}")
        img = c.get(f"/api/v1/catalog/images/site/{site['id']}")
        assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg"
        from PIL import Image

        im = Image.open(BytesIO(img.content))
        assert max(im.size) == 1600, "bounded to 1600 px"
        r = c.post(f"/api/v1/buildings/{building['id']}/image", files={"file": ("b.jpg", _png(800, 600), "image/jpeg")})
        assert r.status_code == 200 and r.json()["image_url"]
        tree = c.get("/api/v1/sites?tree=true").json()
        assert tree["sites"][0]["image_url"] and tree["sites"][0]["buildings"][0]["image_url"]
        # a viewer on another floor may not change, may read the site image only inside her scope
        bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
        assert c.post(f"/api/v1/sites/{site['id']}/image", files={"file": ("x.png", _png(), "image/png")}, headers=as_user("ron")).status_code == 403
        assert c.delete(f"/api/v1/sites/{site['id']}/image", headers=as_user("ron")).status_code == 403
        r = c.delete(f"/api/v1/sites/{site['id']}/image")
        assert r.status_code == 200 and r.json()["image_url"] is None
        assert c.get(f"/api/v1/catalog/images/site/{site['id']}").status_code == 404
        assert c.get("/api/v1/catalog/images/room/x").status_code == 404
