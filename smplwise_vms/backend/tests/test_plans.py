"""Plan import (T019/T020): content sniffing, page previews, derived versions with rotation/crop,
publish, image authorization, anchors with revisions and floor delete guard (T021 backend side)."""
from __future__ import annotations

from conftest import as_user, bind, pdf_bytes, png_bytes, seed_tree


def upload(client, floor_id, name, data, mime, headers=None):
    return client.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": (name, data, mime)}, headers=headers or {})


def test_png_upload_version_publish_and_map(client):
    ids = seed_tree(client)
    r = upload(client, ids["floor2"], "plan.png", png_bytes(640, 400), "image/png")
    assert r.status_code == 201, r.text
    asset = r.json()
    assert asset["mime"] == "image/png" and asset["page_count"] == 1 and len(asset["sha256"]) == 64
    assert client.get(asset["pages"][0]["preview_url"]).headers["content-type"] == "image/png"

    v = client.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"], "rotation": 90, "crop": {"x": 0.1, "y": 0.1, "w": 0.8, "h": 0.8}}).json()
    assert v["status"] == "draft" and v["rotation"] == 90
    # rotated 640x400 → 400x640, cropped 80% → 320x512
    assert (v["width_px"], v["height_px"]) == (320, 512)

    # map before publish: no plan for a viewer
    m = client.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    assert m["plan"] is None
    # editors can ask for the draft
    assert client.get(f"/api/v1/floors/{ids['floor2']}/map?draft=true").json()["plan"]["id"] == v["id"]

    p = client.post(f"/api/v1/plan-versions/{v['id']}/publish").json()
    assert p["status"] == "published" and p["published_at"]
    m = client.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    assert m["plan"]["id"] == v["id"] and m["floor"]["has_plan"] is True
    img = client.get(m["plan"]["image_url"])
    assert img.status_code == 200 and img.headers["content-type"] == "image/png"

    # publishing again is a conflict; deleting a published version is refused
    assert client.post(f"/api/v1/plan-versions/{v['id']}/publish").json()["code"] == "not_draft"
    assert client.delete(f"/api/v1/plan-versions/{v['id']}").json()["code"] == "not_draft"


def test_pdf_pages_and_rejections(client):
    ids = seed_tree(client)
    r = upload(client, ids["floor2"], "plan.pdf", pdf_bytes(2), "application/pdf")
    assert r.status_code == 201, r.text
    assert r.json()["page_count"] == 2
    assert client.get(r.json()["pages"][1]["preview_url"]).status_code == 200
    v = client.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": r.json()["id"], "page": 2}).json()
    assert v["page"] == 2 and v["width_px"] > 0
    # page out of range
    assert client.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": r.json()["id"], "page": 3}).status_code == 422
    # too many pages
    assert upload(client, ids["floor2"], "big.pdf", pdf_bytes(6), "application/pdf").json()["code"] == "too_many_pages"
    # extension lies: a PNG named .pdf is accepted as PNG (content sniffing), a text file is rejected
    assert upload(client, ids["floor2"], "x.pdf", png_bytes(64, 64), "application/pdf").json()["mime"] == "image/png"
    assert upload(client, ids["floor2"], "x.png", b"hello", "image/png").json()["code"] == "unsupported_format"
    assert upload(client, ids["floor2"], "x.svg", b"<svg xmlns='http://www.w3.org/2000/svg'></svg>", "image/svg+xml").json()["code"] == "unsupported_format"


def test_anchor_lifecycle_and_revisions(client):
    ids = seed_tree(client)
    cam = client.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה"}).json()
    # no plan yet → cannot place
    assert client.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.5, "y": 0.5}).json()["code"] == "no_plan"
    asset = upload(client, ids["floor2"], "plan.png", png_bytes(), "image/png").json()
    v = client.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    client.post(f"/api/v1/plan-versions/{v['id']}/publish")

    a = client.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.25, "y": 0.4, "rotation_degrees": 90, "field_of_view_degrees": 70}).json()
    assert a["revision"] == 1 and a["plan_version_id"] == v["id"]
    assert client.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.1, "y": 0.1}).json()["code"] == "already_placed"

    ok = client.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": 1, "x": 0.3}).json()
    assert ok["revision"] == 2 and ok["position"]["x"] == 0.3
    stale = client.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": 1, "x": 0.9})
    assert stale.status_code == 409 and stale.json()["code"] == "stale_revision" and stale.json()["details"]["current_revision"] == 2

    m = client.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    assert len(m["anchors"]) == 1 and m["anchors"][0]["camera"]["name"] == "כניסה" and m["needs_alignment"] is False

    # a new version with different geometry keeps the anchor on the old version → needs_alignment
    v2 = client.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"], "rotation": 180}).json()
    client.post(f"/api/v1/plan-versions/{v2['id']}/publish")
    m = client.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    assert m["needs_alignment"] is True and m["anchors"][0]["plan_version_id"] == v["id"]
    # same geometry republish carries anchors forward
    v3 = client.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"], "rotation": 180}).json()
    client.post(f"/api/v1/plan-versions/{v3['id']}/publish")
    # (anchor still points at v; carrying only happens from the previously published version)

    # floor delete guard
    assert client.delete(f"/api/v1/floors/{ids['floor2']}").json()["code"] == "has_anchors"
    assert client.delete(f"/api/v1/floors/{ids['floor2']}?force=true").status_code == 204
    assert client.get(f"/api/v1/floors/{ids['floor2']}").status_code == 404


def test_viewer_reads_only_published_images(client, settings):
    ids = seed_tree(client)
    asset = upload(client, ids["floor2"], "plan.png", png_bytes(), "image/png").json()
    draft = client.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    bind(client, settings, "ron", "viewer", "floor", ids["floor2"])
    h = as_user("ron")
    assert client.get(draft["image_url"], headers=h).status_code == 403
    assert client.get(asset["pages"][0]["preview_url"], headers=h).status_code == 403
    assert upload(client, ids["floor2"], "p.png", png_bytes(), "image/png", headers=h).status_code == 403
    client.post(f"/api/v1/plan-versions/{draft['id']}/publish")
    assert client.get(draft["image_url"], headers=h).status_code == 200
    m = client.get(f"/api/v1/floors/{ids['floor2']}/map", headers=h).json()
    assert m["permissions"] == {"edit": False, "publish": False, "import": False}
