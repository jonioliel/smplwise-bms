"""K88: room <-> area links - the zone field, the suggestion table, the bulk apply, the device tree's `map` pointer,
permissions and audit. Areas come from the mirrored registry (ha_sync.apply_structure); nothing is written to it."""
from __future__ import annotations

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_sync, plan_area_links

TRI = [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.3}, {"x": 0.1, "y": 0.3}]
TRI2 = [{"x": 0.5, "y": 0.5}, {"x": 0.8, "y": 0.5}, {"x": 0.8, "y": 0.8}, {"x": 0.5, "y": 0.8}]
AREAS = [
    {"area_id": "lobby", "name": "לובי", "floor_id": "ground"},
    {"area_id": "kitchen", "name": "מטבח", "floor_id": "ground"},
    {"area_id": "master", "name": "חדר שינה הורים", "floor_id": "first"},
    {"area_id": "stairs", "name": "מדרגות", "floor_id": None},
]
FLOORS = [{"floor_id": "ground", "name": "קומת קרקע", "level": 0}, {"floor_id": "first", "name": "קומה ראשונה", "level": 1}]


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    with app.state.db.connection() as conn:
        ha_sync.apply_structure(conn, AREAS, FLOORS)
    return app, c, ids


def _zone(c, floor_id, name, poly=TRI):
    r = c.post(f"/api/v1/floors/{floor_id}/zones", json={"name": name, "kind": "room", "polygon": poly})
    assert r.status_code == 201, r.text
    return r.json()


def test_score_and_normalise():
    assert plan_area_links.score("לובי", "לובי") == 1.0
    assert plan_area_links.score("חדר שינה הורים", "שינה הורים") == 1.0  # the "חדר " prefix never decides
    assert plan_area_links.score("לובי כניסה", "לובי") == 0.8
    assert plan_area_links.score("Kitchen", "kitchen ") == 1.0
    assert plan_area_links.score("חדר מטבח", "מטבח") == 1.0
    assert plan_area_links.score("לובי", "מטבח") == 0.0
    assert 0.5 <= plan_area_links.score("חדר שינה ילדים", "חדר שינה הורים") < 0.8
    assert plan_area_links.score("", "לובי") == 0.0


def test_zone_patch_links_and_clears_area(settings):
    app, c, ids = _setup(settings)
    z = _zone(c, ids["floor2"], "לובי")
    assert z["area_id"] is None
    r = c.patch(f"/api/v1/zones/{z['id']}", json={"revision": 1, "area_id": "lobby"})
    assert r.status_code == 200, r.text
    assert r.json()["area_id"] == "lobby" and r.json()["revision"] == 2
    # the map bundle and the list carry it
    assert c.get(f"/api/v1/floors/{ids['floor2']}/zones").json()["zones"][0]["area_id"] == "lobby"
    # an unknown area is refused, nothing changes
    r = c.patch(f"/api/v1/zones/{z['id']}", json={"revision": 2, "area_id": "nope"})
    assert r.status_code == 422 and r.json()["code"] == "validation"
    assert c.get(f"/api/v1/floors/{ids['floor2']}/zones").json()["zones"][0]["revision"] == 2
    # "" clears
    r = c.patch(f"/api/v1/zones/{z['id']}", json={"revision": 2, "area_id": ""})
    assert r.status_code == 200 and r.json()["area_id"] is None
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT details_json AS details FROM audit_log WHERE action = 'zone.update' ORDER BY rowid").fetchall()
    assert len(rows) == 2 and "ha_area_id" in rows[0]["details"]


def test_table_suggests_by_name_and_apply_links(settings):
    app, c, ids = _setup(settings)
    z1 = _zone(c, ids["floor2"], "לובי")
    z2 = _zone(c, ids["floor2"], "חדר שינה הורים", TRI2)
    z3 = _zone(c, ids["floor3"], "מחסן")
    t = c.get("/api/v1/plan/area-links")
    assert t.status_code == 200, t.text
    body = t.json()
    assert [a["area_id"] for a in body["areas"]] and {a["area_id"] for a in body["areas"]} == {"lobby", "kitchen", "master", "stairs"}
    rows = {r["zone_id"]: r for r in body["rows"]}
    assert rows[z1["id"]]["status"] == "suggested" and rows[z1["id"]]["suggestion"]["area_id"] == "lobby" and rows[z1["id"]]["suggestion"]["score"] == 1.0
    assert rows[z2["id"]]["suggestion"]["area_id"] == "master"
    assert rows[z3["id"]]["status"] == "none" and rows[z3["id"]]["suggestion"] is None
    assert rows[z1["id"]]["floor_name"] == "קומה 2" and rows[z1["id"]]["building_name"] == "מבנה א"
    assert body["counts"] == {"linked": 0, "suggested": 2, "none": 1, "dangling": 0}
    # a floor filter
    only3 = c.get(f"/api/v1/plan/area-links?floor_id={ids['floor3']}").json()
    assert [r["zone_id"] for r in only3["rows"]] == [z3["id"]]
    # apply both suggestions in one call
    r = c.post("/api/v1/plan/area-links", json={"links": [{"zone_id": z1["id"], "area_id": "lobby"}, {"zone_id": z2["id"], "area_id": "master"}]})
    assert r.status_code == 200, r.text
    assert r.json()["changed"] == 2 and r.json()["counts"]["linked"] == 2
    rows = {x["zone_id"]: x for x in r.json()["rows"]}
    assert rows[z1["id"]]["status"] == "linked" and rows[z1["id"]]["area_name"] == "לובי"
    # idempotent: the same links again change nothing
    assert c.post("/api/v1/plan/area-links", json={"links": [{"zone_id": z1["id"], "area_id": "lobby"}]}).json()["changed"] == 0
    # a linked area is not proposed to another room of the same floor; another floor may still get it
    z4 = _zone(c, ids["floor2"], "לובי", TRI2)
    z5 = _zone(c, ids["floor3"], "לובי")
    rows = {x["zone_id"]: x for x in c.get("/api/v1/plan/area-links").json()["rows"]}
    assert rows[z4["id"]]["suggestion"] is None
    assert rows[z5["id"]]["suggestion"]["area_id"] == "lobby"
    # unlink through the bulk call, with the optimistic lock
    zr = c.get(f"/api/v1/floors/{ids['floor2']}/zones").json()["zones"]
    rev = next(z["revision"] for z in zr if z["id"] == z1["id"])
    assert c.post("/api/v1/plan/area-links", json={"links": [{"zone_id": z1["id"], "area_id": None, "revision": rev + 5}]}).status_code == 409
    assert c.post("/api/v1/plan/area-links", json={"links": [{"zone_id": z1["id"], "area_id": None, "revision": rev}]}).json()["changed"] == 1
    assert c.post("/api/v1/plan/area-links", json={"links": [{"zone_id": "missing", "area_id": "lobby"}]}).status_code == 404
    assert c.post("/api/v1/plan/area-links", json={"links": [{"zone_id": z2["id"], "area_id": "nope"}]}).status_code == 422
    with app.state.db.connection() as conn:
        n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'zone.area_links'").fetchone()[0]
    assert n == 2  # the apply and the unlink; the no-op call wrote no row


def test_dangling_link_reads_as_unlinked_after_registry_refresh(settings):
    app, c, ids = _setup(settings)
    z = _zone(c, ids["floor2"], "לובי")
    assert c.patch(f"/api/v1/zones/{z['id']}", json={"revision": 1, "area_id": "lobby"}).status_code == 200
    with app.state.db.connection() as conn:
        ha_sync.apply_structure(conn, [a for a in AREAS if a["area_id"] != "lobby"], FLOORS)
    row = c.get("/api/v1/plan/area-links").json()["rows"][0]
    assert row["status"] in ("suggested", "none") and row["area_id"] is None and row["dangling"] is True
    assert c.get("/api/v1/plan/area-links").json()["counts"]["dangling"] == 1
    assert c.get("/api/v1/devices/tree").json()["floors"]  # nothing breaks


def test_device_tree_and_area_carry_the_map_pointer(settings):
    app, c, ids = _setup(settings)
    z = _zone(c, ids["floor2"], "לובי")
    tree = c.get("/api/v1/devices/tree").json()
    areas = {a["area_id"]: a for f in tree["floors"] for a in f["areas"]}
    assert areas["lobby"]["map"] is None
    assert c.post("/api/v1/plan/area-links", json={"links": [{"zone_id": z["id"], "area_id": "lobby"}]}).status_code == 200
    tree = c.get("/api/v1/devices/tree").json()
    areas = {a["area_id"]: a for f in tree["floors"] for a in f["areas"]}
    assert areas["lobby"]["map"] == {"floor_id": ids["floor2"], "zone_id": z["id"]}
    assert areas["kitchen"]["map"] is None
    d = c.get("/api/v1/devices/areas/lobby")
    assert d.status_code == 200, d.text
    assert d.json()["area"]["map"] == {"floor_id": ids["floor2"], "zone_id": z["id"]}
    # a deleted room drops the pointer
    assert c.delete(f"/api/v1/zones/{z['id']}").status_code == 204
    tree = c.get("/api/v1/devices/tree").json()
    areas = {a["area_id"]: a for f in tree["floors"] for a in f["areas"]}
    assert areas["lobby"]["map"] is None


def test_permissions(settings):
    app, c, ids = _setup(settings)
    z = _zone(c, ids["floor2"], "לובי")
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    assert c.get("/api/v1/plan/area-links", headers=as_user("ron")).status_code == 403
    assert c.get(f"/api/v1/plan/area-links?floor_id={ids['floor2']}", headers=as_user("ron")).status_code == 403
    assert c.get("/api/v1/plan/areas", headers=as_user("ron")).status_code == 403
    assert c.post("/api/v1/plan/area-links", json={"links": [{"zone_id": z["id"], "area_id": "lobby"}]}, headers=as_user("ron")).status_code == 403
    assert c.patch(f"/api/v1/zones/{z['id']}", json={"revision": 1, "area_id": "lobby"}, headers=as_user("ron")).status_code == 403
    # an editor of floor 2 may read the table of that floor and link its rooms, not the whole installation
    bind(c, settings, "dana", "editor", "floor", ids["floor2"])
    assert c.get(f"/api/v1/plan/area-links?floor_id={ids['floor2']}", headers=as_user("dana")).status_code == 200
    assert c.get(f"/api/v1/plan/areas?floor_id={ids['floor2']}", headers=as_user("dana")).status_code == 200
    assert c.get("/api/v1/plan/area-links", headers=as_user("dana")).status_code == 403
    assert c.post("/api/v1/plan/area-links", json={"links": [{"zone_id": z["id"], "area_id": "lobby"}]}, headers=as_user("dana")).status_code == 200
    z3 = _zone(c, ids["floor3"], "מטבח")
    assert c.post("/api/v1/plan/area-links", json={"links": [{"zone_id": z3["id"], "area_id": "kitchen"}]}, headers=as_user("dana")).status_code == 403


def test_settings_plan_surfaces(settings):
    app, c, ids = _setup(settings)
    assert c.get("/api/v1/settings").json()["settings"]["plan.surfaces"] == ["devices", "area"]
    r = c.patch("/api/v1/settings", json={"plan.surfaces": ["area"]})
    assert r.status_code == 200, r.text
    assert r.json()["settings"]["plan.surfaces"] == ["area"]
    assert c.patch("/api/v1/settings", json={"plan.surfaces": []}).json()["settings"]["plan.surfaces"] == []
    assert c.patch("/api/v1/settings", json={"plan.surfaces": ["area", "devices"]}).json()["settings"]["plan.surfaces"] == ["devices", "area"]
    assert c.patch("/api/v1/settings", json={"plan.surfaces": ["wall"]}).status_code == 422
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    assert c.patch("/api/v1/settings", json={"plan.surfaces": ["area"]}, headers=as_user("ron")).status_code == 403
