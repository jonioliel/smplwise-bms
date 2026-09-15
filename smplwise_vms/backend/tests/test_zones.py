"""Spatial zones (M13): CRUD with revisions and scope, room candidates from the plan, acceptance as auto zones,
and the zones layer in the floor map bundle."""
from __future__ import annotations

import io

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient
from test_stylize import synthetic_plan

from smplwise.main import create_app
from smplwise.services import plan_zones


def test_room_candidates_from_synthetic_plan(tmp_path):
    src = tmp_path / "plan.png"
    synthetic_plan().save(src)
    r = plan_zones.detect_rooms(src, "medium")
    assert 2 <= len(r["rooms"]) <= 4, len(r["rooms"])
    for room in r["rooms"]:
        assert 3 <= len(room["polygon"]) <= 40 and all(0 <= p["x"] <= 1 and 0 <= p["y"] <= 1 for p in room["polygon"])
        assert 0 < room["centroid"]["x"] < 1 and room["area_ratio"] > 0.01
    # polygons are mostly rectilinear after snapping
    poly = r["rooms"][0]["polygon"]
    axis = sum(1 for a, b in zip(poly, poly[1:] + poly[:1]) if abs(a["x"] - b["x"]) < 0.002 or abs(a["y"] - b["y"]) < 0.002)
    assert axis >= len(poly) * 0.6


def test_zones_api_and_bundle(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    tri = [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.3}, {"x": 0.1, "y": 0.3}]
    r = c.post(f"/api/v1/floors/{ids['floor2']}/zones", json={"name": "לובי", "kind": "room", "polygon": tri})
    assert r.status_code == 201, r.text
    z = r.json()
    assert z["name"] == "לובי" and z["source"] == "manual" and z["color"].startswith("#") and z["revision"] == 1
    assert c.post(f"/api/v1/floors/{ids['floor2']}/zones", json={"name": "x", "polygon": tri[:2]}).status_code == 422
    # rename with the right revision; a stale revision is refused
    assert c.patch(f"/api/v1/zones/{z['id']}", json={"revision": 1, "name": "לובי ראשי"}).json()["revision"] == 2
    assert c.patch(f"/api/v1/zones/{z['id']}", json={"revision": 1, "name": "x"}).status_code == 409
    # the map bundle carries the zone; a viewer may read but not write
    buf = io.BytesIO()
    synthetic_plan(700, 500).save(buf, format="PNG")
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", buf.getvalue(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    m = c.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    assert [x["name"] for x in m["zones"]] == ["לובי ראשי"]
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    assert c.get(f"/api/v1/floors/{ids['floor2']}/zones", headers=as_user("ron")).status_code == 200
    assert c.post(f"/api/v1/floors/{ids['floor2']}/zones", json={"name": "x", "polygon": tri}, headers=as_user("ron")).status_code == 403
    assert c.get(f"/api/v1/floors/{ids['floor3']}/zones", headers=as_user("ron")).status_code == 403
    # detection on the published plan, acceptance as auto zones with default names, replace on re-run
    d = c.post(f"/api/v1/floors/{ids['floor2']}/zones/detect", json={"strength": "medium"})
    assert d.status_code == 200 and len(d.json()["rooms"]) >= 2 and d.json()["existing_auto"] == 0
    cands = [{"polygon": room["polygon"]} for room in d.json()["rooms"]]
    a = c.post(f"/api/v1/floors/{ids['floor2']}/zones/accept", json={"candidates": cands})
    assert a.status_code == 201 and len(a.json()["created"]) == len(cands)
    names = [x["name"] for x in a.json()["zones"] if x["source"] == "auto"]
    assert names[0] == "חדר 1"
    a2 = c.post(f"/api/v1/floors/{ids['floor2']}/zones/accept", json={"candidates": cands[:1], "replace_auto": True}).json()
    assert len([x for x in a2["zones"] if x["source"] == "auto"]) == 1 and any(x["name"] == "לובי ראשי" for x in a2["zones"])
    # delete is soft and audited
    assert c.delete(f"/api/v1/zones/{z['id']}").status_code == 204
    assert all(x["id"] != z["id"] for x in c.get(f"/api/v1/floors/{ids['floor2']}/zones").json()["zones"])
    with app.state.db.connection() as conn:
        acts = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'zone.%' ORDER BY rowid").fetchall()]
    assert acts[:2] == ["zone.create", "zone.update"] and "zone.detect" in acts and "zone.accept" in acts and acts[-1] == "zone.delete"
