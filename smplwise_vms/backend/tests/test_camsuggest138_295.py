"""CAMSUGGEST138-295: nearest-camera suggestion for a zone - the installation defaults (settings keys) and the accepted camera link.
The ranking is client-side geometry (frontend/tests/unit-camera-suggest.spec.ts); here only the server side: defaults + validation,
the permission split, accept / read / clear, the same-floor rule, and that a removed camera pin reads as an empty link."""
from __future__ import annotations

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app

API = "/api/v1"
SQ = [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.4}, {"x": 0.1, "y": 0.4}]


def _world(settings):
    c = TestClient(create_app(settings))
    ids = seed_tree(c)
    cams = [c.post(f"{API}/cameras", json={"channel": n, "alias": f"מצלמה {n}"}).json()["id"] for n in (1, 2)]
    for f in (ids["floor2"], ids["floor3"]):
        asset = c.post(f"{API}/floors/{f}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
        v = c.post(f"{API}/floors/{f}/plan-versions", json={"asset_id": asset["id"]}).json()
        c.post(f"{API}/plan-versions/{v['id']}/publish")
    a2 = c.post(f"{API}/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cams[0], "x": 0.5, "y": 0.2}).json()
    a3 = c.post(f"{API}/floors/{ids['floor3']}/anchors", json={"resource_type": "camera", "resource_id": cams[1], "x": 0.2, "y": 0.2}).json()
    zone = c.post(f"{API}/floors/{ids['floor2']}/zones", json={"name": "לובי", "kind": "room", "polygon": SQ}).json()
    return c, ids, a2, a3, zone


def test_settings_defaults_validation_and_permission(settings):
    c, ids, *_ = _world(settings)
    st = c.get(f"{API}/settings").json()["settings"]
    assert (st["plan.camsuggest_distance"], st["plan.camsuggest_fov"], st["plan.camsuggest_count"]) == ("35", "50", "3")
    r = c.patch(f"{API}/settings", json={"plan.camsuggest_distance": "20", "plan.camsuggest_fov": "100", "plan.camsuggest_count": "2"})
    assert r.status_code == 200 and r.json()["settings"]["plan.camsuggest_distance"] == "20" and r.json()["settings"]["plan.camsuggest_count"] == "2"
    for k, bad in (("distance", "0"), ("distance", "101"), ("distance", "x"), ("fov", "-1"), ("fov", "101"), ("count", "0"), ("count", "4")):
        assert c.patch(f"{API}/settings", json={f"plan.camsuggest_{k}": bad}).status_code == 422, (k, bad)
    # an editor of one floor does not change the installation defaults
    bind(c, settings, "ed", "operator", "floor", ids["floor2"])
    assert c.patch(f"{API}/settings", json={"plan.camsuggest_distance": "10"}, headers=as_user("ed")).status_code == 403


def test_accept_read_clear_and_same_floor_rule(settings):
    c, ids, a2, a3, zone = _world(settings)
    url = f"{API}/zones/{zone['id']}/suggested-camera"
    assert c.get(url).json()["anchor_id"] is None
    assert c.put(url, json={"anchor_id": a3["id"]}).status_code == 422  # a camera pinned on another floor
    assert c.put(url, json={"anchor_id": "nope"}).status_code == 422
    r = c.put(url, json={"anchor_id": a2["id"]})
    assert r.status_code == 200 and r.json()["anchor_id"] == a2["id"]
    assert c.get(url).json()["anchor_id"] == a2["id"]
    assert c.get(f"{API}/zones/missing/suggested-camera").status_code == 404
    # a viewer reads but may not accept; a user without the floor reads nothing
    bind(c, settings, "vi", "viewer", "floor", ids["floor2"])
    assert c.get(url, headers=as_user("vi")).json()["anchor_id"] == a2["id"]
    assert c.put(url, json={"anchor_id": a2["id"]}, headers=as_user("vi")).status_code == 403
    assert c.delete(url, headers=as_user("vi")).status_code == 403
    bind(c, settings, "other", "viewer", "floor", ids["floor3"])
    assert c.get(url, headers=as_user("other")).status_code == 403
    assert c.delete(url).json()["anchor_id"] is None and c.get(url).json()["anchor_id"] is None


def test_removed_camera_pin_reads_as_empty_link(settings):
    c, ids, a2, _a3, zone = _world(settings)
    url = f"{API}/zones/{zone['id']}/suggested-camera"
    assert c.put(url, json={"anchor_id": a2["id"]}).status_code == 200
    assert c.delete(f"{API}/map-anchors/{a2['id']}").status_code == 204
    assert c.get(url).json()["anchor_id"] is None
