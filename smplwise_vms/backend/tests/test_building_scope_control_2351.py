"""BUILDING-SCOPE-CONTROL-2351: "הצג ושלוט" per building on a multi-building site - the server cuts the bulk / list scope to the building
the request names (services/building_scope: map placement > per-area row > platform-floor row, then the area -> building rows), refuses a
scope or an `only` id of another building (403 `outside_building`, audited), and without a building id behaves exactly as before."""
from __future__ import annotations

import json

from conftest import as_user, bind
from test_devices import _bulk, _finish, bulk_app, dev_app  # noqa: F401 - the fixtures of the bulk tests

from smplwise.services import building_scope

API = "/api/v1"


def _site(c, app) -> dict[str, str]:
    """Two buildings: A holds the platform floor "ground" (lobby) and the floorless garden (an area -> building row); B holds "second"
    (office) and is the shared building."""
    site = c.post(f"{API}/sites", json={"name": "מתחם"}).json()
    a = c.post(f"{API}/sites/{site['id']}/buildings", json={"name": "בניין א"}).json()
    b = c.post(f"{API}/sites/{site['id']}/buildings", json={"name": "משותף"}).json()
    assert c.patch(f"{API}/buildings/{b['id']}", json={"is_shared": True}).status_code == 200
    fa = c.post(f"{API}/buildings/{a['id']}/floors", json={"name": "קומה 0", "level": 0}).json()
    fb = c.post(f"{API}/buildings/{b['id']}/floors", json={"name": "קומה 2", "level": 2}).json()
    assert c.put(f"{API}/floors/{fa['id']}/home-link", json={"ha_floor_ids": ["ground"]}).status_code == 200
    assert c.put(f"{API}/floors/{fb['id']}/home-link", json={"ha_floor_ids": ["second"]}).status_code == 200
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO home_area_buildings(area_id, building_id, updated_at, updated_by) VALUES ('garden', ?, '2026-11-02T00:00:00Z', 'test')", (a["id"],))
    # the office light on, so building B has something to turn off
    assert c.post(f"{API}/ha/dev/states", json={"states": [{"entity_id": "light.office", "state": "on", "attributes": {}}]}).status_code == 200
    return {"A": a["id"], "B": b["id"], "fA": fa["id"], "fB": fb["id"]}


def _ids(preview: dict) -> set[str]:
    return {t["entity_id"] for t in preview["targets"]}


def _rows(app) -> list[dict]:
    with app.state.db.connection() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = 'devices.bulk' ORDER BY rowid").fetchall()]
    for r in rows:
        r["details"] = json.loads(r["details_json"] or "{}")
    return rows


def _preview(c, **q):
    return c.get(f"{API}/devices/actions/preview", params={"kind": "lights_off", "scope": "building", "id": "*", **q})


def test_the_server_resolves_each_buildings_areas_from_the_mapping_rows(bulk_app):
    app, _s, c, _fake = bulk_app
    ids = _site(c, app)
    with app.state.db.connection() as conn:
        got = building_scope.area_buildings(conn)
        assert got == {"lobby": ids["A"], "empty_room": ids["A"], "garden": ids["A"], "office": ids["B"]}
        # a per-area row wins over the platform floor's row
        conn.execute("INSERT INTO home_area_links(area_id, floor_id, updated_at, updated_by) VALUES ('lobby', ?, '2026-11-02T00:00:00Z', 'test')", (ids["fB"],))
        assert building_scope.area_buildings(conn)["lobby"] == ids["B"]
        # ... and an area taken off every floor by hand belongs to no building (unless an area -> building row says so)
        conn.execute("UPDATE home_area_links SET floor_id = NULL WHERE area_id = 'lobby'")
        assert "lobby" not in building_scope.area_buildings(conn)
        conn.execute("DELETE FROM home_area_links")
        # a deleted building owns nothing, and naming it is a 404
        conn.execute("UPDATE buildings SET deleted_at = '2026-11-02T00:00:00Z' WHERE id = ?", (ids["B"],))
        assert "office" not in building_scope.area_buildings(conn)
    r = _preview(c, building=ids["B"])
    assert (r.status_code, r.json()["code"]) == (404, "building_not_found")


def test_a_scoped_bulk_reaches_only_its_building_and_names_it_in_the_audit(bulk_app):
    app, _s, c, fake = bulk_app
    ids = _site(c, app)
    everything = _preview(c).json()
    assert _ids(everything) == {"light.lobby", "light.garden", "light.office"} and "building_id" not in everything, "no building id = exactly as before"
    a = _preview(c, building=ids["A"]).json()
    assert _ids(a) == {"light.lobby", "light.garden"} and a["building_id"] == ids["A"] and a["name"] == "בניין א"
    b = _preview(c, building=ids["B"]).json()
    assert _ids(b) == {"light.office"}, "the shared building is a building like any other: its own areas only"
    # a floor wholly in the building, and an area of it, scoped the same way
    assert _ids(_preview(c, scope="floor", id="ground", building=ids["A"]).json()) == {"light.lobby"}
    assert _ids(_preview(c, scope="area", id="garden", building=ids["A"]).json()) == {"light.garden"}
    # the run: building B only
    r = c.post(f"{API}/devices/actions", json=_bulk(scope="building", id="*", kind="lights_off", building=ids["B"], preview_digest=b["digest"]))
    assert r.status_code == 202, r.text
    _finish(c, r.json()["id"])
    assert {p["data"]["entity_id"] for p in fake.calls} == {"light.office"}
    attempt = [x for x in _rows(app) if x["details"].get("phase") == "attempt"][-1]
    assert attempt["details"]["building_id"] == ids["B"] and attempt["details"]["entity_ids"] == ["light.office"]
    # building A's lights are still on: acting in B never touched A
    assert c.get(f"{API}/devices/areas/lobby").json()["counts"]["lights_on"] == 1


def test_a_scope_or_an_entity_of_another_building_is_refused_and_audited(bulk_app):
    app, _s, c, fake = bulk_app
    ids = _site(c, app)
    # preview: an area / a floor of the other building
    for q in ({"scope": "area", "id": "office", "building": ids["A"]}, {"scope": "floor", "id": "second", "building": ids["A"]}, {"scope": "area", "id": "lobby", "building": ids["B"]}):
        r = _preview(c, **q)
        assert (r.status_code, r.json()["code"]) == (403, "outside_building"), q
    denied = [x for x in _rows(app) if x["decision"] == "denied" and x["details"].get("phase") == "preview"]
    assert len(denied) == 3 and all(x["reason"] == "outside_building" and x["details"]["building_id"] for x in denied)
    # preview: an `only` id outside the building (a crafted list) - refused, not silently dropped
    r = _preview(c, building=ids["A"], only="light.lobby,light.office")
    assert (r.status_code, r.json()["code"]) == (403, "outside_building")
    # the run: the same refusals, each one audited row, nothing sent
    for extra in ({"scope": "area", "id": "lobby", "building": ids["B"]}, {"scope": "floor", "id": "ground", "building": ids["B"]},
                  {"scope": "building", "id": "*", "building": ids["A"], "only": ["light.office"]}):
        r = c.post(f"{API}/devices/actions", json=_bulk(kind="lights_off", **extra))
        assert (r.status_code, r.json()["code"]) == (403, "outside_building"), extra
    refused = [x for x in _rows(app) if x["details"].get("phase") == "refused"]
    assert len(refused) == 3 and all(x["reason"] == "outside_building" and x["details"]["outcome"] == "not_sent" and x["details"]["building_id"] for x in refused)
    r = c.post(f"{API}/devices/actions", json=_bulk(kind="lights_off", scope="area", id="lobby", building="no-such-building"))
    assert (r.status_code, r.json()["code"]) == (404, "building_not_found")
    assert not fake.calls
    # a malformed building id is a validation refusal (audited by the body check)
    assert c.post(f"{API}/devices/actions", json=_bulk(building="")).status_code == 422


def test_the_tiles_list_follows_the_building(bulk_app):
    app, _s, c, _fake = bulk_app
    ids = _site(c, app)

    def listed(**q) -> set[str]:
        r = c.get(f"{API}/devices/items", params={"kind": "lights", **q})
        assert r.status_code == 200, r.text
        return {i["entity_id"] for f in r.json()["floors"] for a in f["areas"] for i in a["items"]}

    assert listed() == {"light.lobby", "light.lobby_spot", "light.garden", "light.office"}
    assert listed(building=ids["A"]) == {"light.lobby", "light.lobby_spot", "light.garden"}
    assert listed(building=ids["B"]) == {"light.office"}
    one = c.get(f"{API}/devices/items", params={"kind": "lights", "building": ids["A"]}).json()
    assert one["counts"]["total"] == 3 and one["building_id"] == ids["A"] and one["name"] == "בניין א"
    assert listed(scope="floor", id="ground", building=ids["A"]) == {"light.lobby", "light.lobby_spot"}
    assert c.get(f"{API}/devices/items", params={"kind": "lights", "scope": "area", "id": "office", "building": ids["A"]}).status_code == 404
    assert c.get(f"{API}/devices/items", params={"kind": "lights", "scope": "floor", "id": "second", "building": ids["A"]}).status_code == 404
    assert c.get(f"{API}/devices/items", params={"kind": "lights", "building": "no-such-building"}).status_code == 404


def test_a_floor_scoped_holder_keeps_his_limits_inside_a_building(bulk_app):
    """The building cut narrows; it never widens - a floor-scoped holder still may not act on the whole building."""
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    bind(c, s, "fa", "site_admin", "floor", ids["fA"])
    r = c.get(f"{API}/devices/actions/preview", params={"kind": "lights_off", "scope": "building", "id": "*", "building": ids["A"]}, headers=as_user("fa"))
    assert r.status_code == 403
