"""Global search: rooms only when searchable, cameras by name or channel, entities by name / area, routes that
open the hit, and scope (a floor-bound viewer sees only what is on their floors)."""
from __future__ import annotations

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import now_iso
from smplwise.main import create_app

RECT = [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.3}, {"x": 0.1, "y": 0.3}]


def test_search_kinds_routes_and_scope(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 4, "alias": "כניסה ראשית"}).json()
    assert c.post(f"/api/v1/floors/{ids['floor2']}/zones", json={"name": "לובי ראשי", "polygon": RECT}).status_code == 201
    assert c.post(f"/api/v1/floors/{ids['floor2']}/zones", json={"name": "לובי צדדי", "polygon": RECT, "searchable": False}).status_code == 201
    now = now_iso()
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO ha_entities(entity_id, name, domain, area_name, first_seen_at, updated_at) VALUES (?,?,?,?,?,?)", ("light.lobby", "תאורת לובי", "light", "לובי", now, now))

    r = c.get("/api/v1/search?q=לובי")
    assert r.status_code == 200, r.text
    hits = {(x["kind"], x["title"]) for x in r.json()["results"]}
    assert ("zone", "לובי ראשי") in hits and ("zone", "לובי צדדי") not in hits, "only searchable rooms"
    assert ("entity", "תאורת לובי") in hits, "installation-wide readers find unplaced entities"
    zone_hit = next(x for x in r.json()["results"] if x["kind"] == "zone")
    assert zone_hit["route"].startswith(f"/explore/floors/{ids['floor2']}?zone=") and zone_hit["floor_id"] == ids["floor2"]
    ent_hit = next(x for x in r.json()["results"] if x["kind"] == "entity")
    assert ent_hit["route"].startswith("/explore/entities?q=")

    cams = [x for x in c.get("/api/v1/search?q=כניסה").json()["results"] if x["kind"] == "camera"]
    assert cams and cams[0]["id"] == cam["id"] and cams[0]["route"] == f"/live/cameras/{cam['id']}", "an unplaced camera opens in the live view"
    assert any(x["kind"] == "camera" for x in c.get("/api/v1/search?q=4").json()["results"]), "channel number matches"
    assert c.get("/api/v1/search?q=").status_code == 422
    assert c.get("/api/v1/search?q=%20%20").json()["results"] == []

    # scope: a viewer bound to another floor sees nothing of floor 2; bound to floor 2 the room appears, the
    # unplaced entity still not (only installation-wide readers see the whole catalogue)
    bind(c, settings, "ron", "viewer", "floor", ids["floor3"])
    assert c.get("/api/v1/search?q=לובי", headers=as_user("ron")).json()["results"] == []
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    scoped = c.get("/api/v1/search?q=לובי", headers=as_user("ron")).json()["results"]
    assert [x["kind"] for x in scoped] == ["zone"]
