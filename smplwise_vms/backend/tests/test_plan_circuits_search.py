"""Plan Studio circuits, levels and search, server side (T085): the map bundle carries the published levels and the
state of every circuit's switch (control only with ha.entity.control on the floor, never in a historical bundle); a
circuit's switch counts as placed on the floor for scope, so a floor operator toggles it through the existing entity
action route and a floor viewer only reads it; zones and anchors take a level; the global search finds objects of
published documents by label or library name; the developer-only state route feeds the live spec."""
from __future__ import annotations

import datetime as dt
from dataclasses import replace

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.routers import ha as ha_router
from smplwise.services import ha_sync

LEVELS = [{"id": "L0", "name": "מפלס ראשי", "elevation_m": 0.0, "ceiling_height_m": 2.8, "is_default": True, "external_ids": {}},
          {"id": "L1", "name": "אולם תחתון", "elevation_m": -1.2, "ceiling_height_m": 6.0, "is_default": False, "external_ids": {}}]


def OBJ(oid: str, item: str, pos, **kw) -> dict:
    o = {"id": oid, "item_id": item, "level_id": "L0", "position": list(pos), "rotation_deg": 0, "size": {"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, "z_m": 2.5, "params": {},
         "label": None, "anchor_ref": None, "group_id": None, "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}
    o.update(kw)
    return o


def _state(app, entity_id: str, state: str) -> None:
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": entity_id, "state": state, "attributes": {"friendly_name": entity_id}, "last_changed": now, "last_updated": now})


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return app, c, ids, v["id"]


def _publish(c, vid, **fields):
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], **fields), "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text
    p = c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    assert p.status_code == 200, p.text
    return r.json()


CIRCUITS = [{"id": "k1", "name": "אולם צפון", "switch_entity_id": "switch.hall_a", "member_ids": ["l1", "l2"], "color_token": "circuit-1", "power_w": 0},
            {"id": "k2", "name": "אולם דרום", "switch_entity_id": "switch.hall_b", "member_ids": ["l3"], "color_token": "circuit-2", "power_w": 0}]
LAMPS = [OBJ("l1", "light.ceiling", (0.3, 0.3)), OBJ("l2", "light.ceiling", (0.4, 0.3)), OBJ("l3", "light.ceiling", (0.6, 0.3))]


def test_the_bundle_carries_levels_and_circuit_states_and_a_switch_counts_as_placed(settings):
    app, c, ids, vid = _setup(settings)
    _state(app, "switch.hall_a", "on")
    _state(app, "switch.hall_b", "off")
    m = c.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    assert m["levels"] == [] and m["circuit_states"] == {}, "nothing published yet"
    _publish(c, vid, levels=LEVELS, objects=LAMPS, circuits=CIRCUITS)
    m = c.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    assert [lv["id"] for lv in m["levels"]] == ["L0", "L1"] and m["levels"][1]["elevation_m"] == -1.2
    k1 = m["circuit_states"]["k1"]
    assert k1["entity_id"] == "switch.hall_a" and k1["state"] == "on" and k1["known"] is True and k1["can_control"] is True and k1["member_ids"] == ["l1", "l2"]
    assert k1["power_w"] == 72 and k1["name"] == "אולם צפון" and k1["color_token"] == "circuit-1"
    assert [a["id"] for a in k1["actions"]] == ["switch.turn_on", "switch.turn_off"]
    assert m["circuit_states"]["k2"]["state"] == "off"
    # a floor viewer reads the state but cannot control; the switch counts as placed on the floor for scope
    bind(c, settings, "vera", "viewer", "floor", ids["floor2"])
    bind(c, settings, "omer", "operator", "floor", ids["floor2"])
    bind(c, settings, "ron", "viewer", "floor", ids["floor3"])
    v = c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("vera")).json()["circuit_states"]["k1"]
    assert v["state"] == "on" and v["can_control"] is False and v["actions"] == []
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("omer")).json()["circuit_states"]["k1"]["can_control"] is True
    e = c.get("/api/v1/ha/entities/switch.hall_a", headers=as_user("vera"))
    assert e.status_code == 200 and [p["floor_id"] for p in e.json()["placements"]] == [ids["floor2"]] and e.json()["can_control"] is False
    assert c.get("/api/v1/ha/entities/switch.hall_a", headers=as_user("ron")).status_code == 403
    assert [x["entity_id"] for x in c.get("/api/v1/ha/entities?placed=true", headers=as_user("vera")).json()["entities"]] == ["switch.hall_a", "switch.hall_b"]
    # a historical bundle carries the state of its instant and never control
    at = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    h = c.get(f"/api/v1/floors/{ids['floor2']}/map?at={at}").json()
    assert h["history"] == "exact" and h["circuit_states"]["k1"]["can_control"] is False and h["circuit_states"]["k1"]["actions"] == []
    assert h["circuit_states"]["k1"]["state"] == "on", "the local HA history knows the state recorded a moment ago"


def test_the_toggle_uses_the_existing_entity_action_route_and_its_permission(settings):
    app, c, ids, vid = _setup(settings)
    _state(app, "switch.hall_a", "off")
    _publish(c, vid, levels=LEVELS, objects=LAMPS[:2], circuits=CIRCUITS[:1])
    bind(c, settings, "vera", "viewer", "floor", ids["floor2"])
    bind(c, settings, "omer", "operator", "floor", ids["floor2"])
    body = {"allowed_action_id": "switch.turn_on", "arguments": {}, "expected_state_version": None, "confirmation_grant": None, "client_request_id": "c1", "expires_at": "2099-01-01T00:00:00Z"}
    assert c.post("/api/v1/ha/entities/switch.hall_a/actions", json=body, headers=as_user("vera")).status_code == 403, "reading a circuit grants no control"
    r = c.post("/api/v1/ha/entities/switch.hall_a/actions", json=body, headers=as_user("omer"))
    assert r.status_code == 503 and r.json()["code"] == "bridge_not_paired", "the floor operator reaches the existing action path (no bridge in the test)"
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM ha_actions WHERE entity_id = 'switch.hall_a'").fetchone()[0] == 1


def test_zones_and_anchors_take_a_level(settings):
    app, c, ids, vid = _setup(settings)
    _publish(c, vid, levels=LEVELS)
    z = c.post(f"/api/v1/floors/{ids['floor2']}/zones", json={"name": "אולם", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.3}]}).json()
    assert z["level_id"] is None and z["ceiling_height_m"] is None
    z2 = c.patch(f"/api/v1/zones/{z['id']}", json={"revision": 1, "level_id": "L1", "ceiling_height_m": 5}).json()
    assert z2["level_id"] == "L1" and z2["ceiling_height_m"] == 5
    assert c.patch(f"/api/v1/zones/{z['id']}", json={"revision": 2, "level_id": "", "ceiling_height_m": 0}).json()["level_id"] is None
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["zones"][0]["ceiling_height_m"] is None
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "אולם"}).json()
    a = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.3, "y": 0.3, "level_id": "L1"}).json()
    assert a["level_id"] == "L1"
    assert c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": 1, "level_id": ""}).json()["level_id"] is None
    assert c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": 2, "level_id": "L0"}).json()["level_id"] == "L0"
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["anchors"][0]["level_id"] == "L0"


def test_global_search_finds_objects_of_published_documents(settings):
    app, c, ids, vid = _setup(settings)
    objects = [OBJ("x1", "extinguisher.co2", (0.15, 0.8), label="מטף כניסה", size={"w_m": 0.2, "d_m": 0.2, "h_m": 0.6}, z_m=0.9),
               OBJ("x2", "chair.basic", (0.2, 0.2), size={"w_m": 0.45, "d_m": 0.45, "h_m": 0.85}, z_m=0)]
    _publish(c, vid, objects=objects)
    r = c.get("/api/v1/search?q=מטף").json()
    hits = [x for x in r["results"] if x["kind"] == "object"]
    assert len(hits) == 1 and r["counts"]["object"] == 1
    assert hits[0] == {"kind": "object", "id": "x1", "title": "מטף כניסה", "subtitle": f"מטף CO2 · מבנה א · קומה 2", "route": f"/explore/floors/{ids['floor2']}?focus=object:x1", "floor_id": ids["floor2"]}
    assert [x["id"] for x in c.get("/api/v1/search?q=co2").json()["results"] if x["kind"] == "object"] == ["x1"], "the English name and the tags count"
    assert [x["title"] for x in c.get("/api/v1/search?q=כיסא").json()["results"] if x["kind"] == "object"] == ["כיסא"], "no label: the library name"
    # a draft-only object is not searchable; a viewer of another floor sees nothing
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=[*objects, OBJ("x3", "aed.wall", (0.5, 0.5), label="AED מסדרון", size={"w_m": 0.4, "d_m": 0.2, "h_m": 0.4}, z_m=1.2)]), "base_revision": g["geometry"]["revision"]})
    assert [x["kind"] for x in c.get("/api/v1/search?q=AED").json()["results"]] == []
    bind(c, settings, "ron", "viewer", "floor", ids["floor3"])
    assert c.get("/api/v1/search?q=מטף", headers=as_user("ron")).json()["results"] == []


def test_the_dev_state_route_exists_only_in_developer_mode(settings):
    app, c, ids, vid = _setup(settings)
    r = c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "switch.hall_a", "state": "on", "attributes": {"friendly_name": "Hall A"}}]})
    assert r.status_code == 200, r.text
    assert r.json()["entities"][0]["state"] == "on" and c.get("/api/v1/ha/entities/switch.hall_a").json()["state"] == "on"
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"state": "on"}]}).status_code == 422
    bind(c, settings, "vera", "viewer", "floor", ids["floor2"])
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "switch.hall_a", "state": "off"}]}, headers=as_user("vera")).status_code == 403
    with pytest.raises(ApiError) as exc:
        ha_router._dev_only(replace(settings, in_addon=True))
    assert exc.value.status == 404
    with pytest.raises(ApiError):
        ha_router._dev_only(replace(settings, dev_user=None))
    ha_router._dev_only(settings)
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ha.dev.states'").fetchone()[0] == 1
