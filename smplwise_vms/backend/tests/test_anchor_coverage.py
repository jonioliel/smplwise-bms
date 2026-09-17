"""R2 (0.1.69): manual coverage per camera anchor - a cone radius or a free polygon, cleared with an explicit null."""
from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app


def _anchor(c: TestClient) -> dict:
    ids = seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 3, "alias": "חניה"}).json()
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    r = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.3, "y": 0.4, "rotation_degrees": 90, "field_of_view_degrees": 100, "coverage_radius": 0.25})
    assert r.status_code == 201, r.text
    return {**ids, "anchor": r.json()}


def test_coverage_radius_polygon_and_clear(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids = _anchor(c)
        a = ids["anchor"]
        assert a["coverage_radius"] == 0.25 and a["coverage_polygon"] is None
        # a polygon replaces the cone; points are rounded and kept in order
        poly = [[0.3, 0.4], [0.5, 0.35], [0.55, 0.5], [0.3, 0.55]]
        r = c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], "coverage_polygon": poly})
        assert r.status_code == 200, r.text
        a = r.json()
        assert a["coverage_polygon"] == poly and a["coverage_radius"] == 0.25
        listed = c.get(f"/api/v1/floors/{ids['floor2']}/anchors").json()["anchors"]
        assert listed[0]["coverage_polygon"] == poly
        # the map bundle carries it too
        m = c.get(f"/api/v1/floors/{ids['floor2']}/map").json()
        assert m["anchors"][0]["coverage_polygon"] == poly
        # too few points / out of the plan → 422; a bad radius → 422
        assert c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], "coverage_polygon": [[0, 0], [1, 1]]}).status_code == 422
        assert c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], "coverage_polygon": [[0, 0], [1, 1], [2, 0]]}).status_code == 422
        assert c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], "coverage_radius": 3}).status_code == 422
        # an explicit null clears; an absent key leaves the value alone
        r = c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], "coverage_polygon": None, "label": "חניה צפון"})
        assert r.status_code == 200, r.text
        a = r.json()
        assert a["coverage_polygon"] is None and a["coverage_radius"] == 0.25 and a["label"] == "חניה צפון"
        r = c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], "coverage_radius": None})
        assert r.status_code == 200 and r.json()["coverage_radius"] is None
