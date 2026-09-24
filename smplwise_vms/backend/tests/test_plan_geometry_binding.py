"""Plan Studio bindings (T085): an object bound to an anchor is the anchor's body - the server refreshes its position
and rotation from the anchor on every save and publish, deleting the anchor un-binds the body (kept where it is), a
missing anchor is a warning; a tribune that connects levels derives its connector in the stored draft and in the
published document; circuit power is recomputed on save; stairs linked to another floor exist in both drafts under
the same id."""
from __future__ import annotations

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_sync

LEVELS = [{"id": "L0", "name": "מפלס ראשי", "elevation_m": 0.0, "ceiling_height_m": 2.8, "is_default": True, "external_ids": {}},
          {"id": "L1", "name": "אולם תחתון", "elevation_m": -1.2, "ceiling_height_m": 6.0, "is_default": False, "external_ids": {}}]


def OBJ(oid: str, item: str = "chair.basic", pos=(0.2, 0.2), **kw) -> dict:
    o = {"id": oid, "item_id": item, "level_id": "L0", "position": list(pos), "rotation_deg": 0, "size": {"w_m": 0.45, "d_m": 0.45, "h_m": 0.85}, "z_m": 0, "params": {},
         "label": None, "anchor_ref": None, "group_id": None, "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}
    o.update(kw)
    return o


def _plan(c, floor_id: str) -> str:
    asset = c.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return v["id"]


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    return app, c, ids, _plan(c, ids["floor2"])


def _save(c, vid, **fields):
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], **fields), "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text
    return r.json()


def test_a_bound_object_follows_its_anchor_on_save_and_publish_and_is_unbound_when_the_anchor_goes(settings):
    app, c, ids, vid = _setup(settings)
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "light.store", "state": "off", "attributes": {"friendly_name": "Store light"}, "last_changed": "2026-09-25T08:00:00+00:00", "last_updated": "2026-09-25T08:00:00+00:00"})
    a = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "light.store", "x": 0.7, "y": 0.25, "rotation_degrees": 30})
    assert a.status_code == 201, a.text
    lamp = OBJ("o1", item="light.ceiling", pos=(0.2, 0.2), z_m=2.5, size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, anchor_ref={"resource_type": "ha_entity", "resource_id": "light.store"})
    saved = _save(c, vid, objects=[lamp])
    assert saved["doc"]["objects"][0]["position"] == [0.7, 0.25] and saved["doc"]["objects"][0]["rotation_deg"] == 30, "the body sits on its anchor"
    assert saved["issues"] == []
    # the anchor moves: the stored draft is refreshed when it is read, and what publishes takes the live position
    moved = c.patch(f"/api/v1/map-anchors/{a.json()['id']}", json={"revision": 1, "x": 0.75})
    assert moved.status_code == 200, moved.text
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["doc"]["objects"][0]["position"] == [0.75, 0.25]
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").json()["unchanged"] is False
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry").json()["doc"]["objects"][0]["position"] == [0.75, 0.25]
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").json()["unchanged"] is True, "the same prepared document publishes nothing"
    # deleting the anchor leaves the body where it is, unbound; the draft revision moved (an open editor reloads)
    before = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["geometry"]["revision"]
    assert c.delete(f"/api/v1/map-anchors/{a.json()['id']}").status_code == 204
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    assert g["doc"]["objects"][0]["anchor_ref"] is None and g["doc"]["objects"][0]["position"] == [0.75, 0.25] and g["geometry"]["revision"] == before + 1
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT json_extract(details_json, '$.unbound_bodies') FROM audit_log WHERE action = 'anchor.delete'").fetchone()[0] == 1
    # a reference to an anchor that does not exist is a warning, never an error
    ghost = _save(c, vid, objects=[dict(lamp, anchor_ref={"resource_type": "ha_entity", "resource_id": "light.gone"})])
    assert [(i["code"], i["severity"], i["id"]) for i in ghost["issues"]] == [("anchor_missing", "warning", "o1")]
    assert ghost["doc"]["objects"][0]["position"] == [0.2, 0.2], "no anchor: the position the editor sent stays"
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200


def test_a_tribune_derives_its_connector_and_circuit_power_is_recomputed(settings):
    app, c, ids, vid = _setup(settings)
    tribune = OBJ("t1", item="tribune.stepped", pos=(0.4, 0.6), rotation_deg=180, size={"w_m": 4, "d_m": 3, "h_m": 1.2},
                  params={"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": "L1"})
    lamps = [OBJ("l1", item="light.ceiling", pos=(0.5, 0.3), size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, z_m=2.5),
             OBJ("l2", item="light.ceiling", pos=(0.6, 0.3), size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, z_m=2.5, params={"power_w": 60})]
    circuit = {"id": "k1", "name": "אולם", "switch_entity_id": "switch.hall", "member_ids": ["l1", "l2"], "color_token": "circuit-1", "power_w": 0}
    saved = _save(c, vid, levels=LEVELS, objects=[tribune, *lamps], circuits=[circuit])
    assert [x["id"] for x in saved["doc"]["connectors"]] == ["cx-t1"] and saved["doc"]["connectors"][0]["kind"] == "tribune" and saved["doc"]["connectors"][0]["level_to"] == "L1"
    assert saved["doc"]["circuits"][0]["power_w"] == 96 and saved["issues"] == []
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    assert [x["id"] for x in c.get(f"/api/v1/plan-versions/{vid}/geometry").json()["doc"]["connectors"]] == ["cx-t1"]
    diff = c.get(f"/api/v1/plan-versions/{vid}/geometry/diff").json()
    assert diff["diff"]["same"] is True and diff["counts"]["connectors"] == 1 and diff["counts"]["circuits"] == 1
    gone = _save(c, vid, objects=[dict(tribune, params=dict(tribune["params"], connects_levels=None)), *lamps])
    assert gone["doc"]["connectors"] == []
    # a custom item deleted from the library blocks publishing (422 geometry_invalid), not the save
    custom = c.post("/api/v1/catalog/objects", json={"based_on": "chair.basic", "names": {"he": "כיסא אולם"}}).json()
    with_custom = _save(c, vid, objects=[OBJ("c1", item=custom["id"])], circuits=[])  # the circuit's lamps are gone with the objects
    assert with_custom["issues"] == []
    assert c.delete(f"/api/v1/catalog/objects/{custom['id']}").status_code == 204
    assert [i["code"] for i in c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["issues"]] == ["unknown_item"]
    bad = c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    assert bad.status_code == 422 and bad.json()["code"] == "geometry_invalid"


def test_stairs_linked_to_another_floor_exist_in_both_drafts_under_one_id(settings):
    app, c, ids, vid = _setup(settings)
    other = _plan(c, ids["floor3"])
    stairs = {"id": "st1", "kind": "stairs", "level_from": "L0", "level_to": None, "floor_ids": [], "polyline": [[0.7, 0.7], [0.8, 0.7]], "width_m": 1.2, "label": None,
              "object_id": None, "source": "manual", "external_ids": {}}
    saved = _save(c, vid, connectors=[stairs])
    assert [i["code"] for i in saved["issues"]] == ["connector_levels"], "not linked yet: it goes nowhere"
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor2"]}).status_code == 422
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "nope", "floor_id": ids["floor3"]}).status_code == 404
    r = c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"]})
    assert r.status_code == 200, r.text
    assert r.json()["connector"]["floor_ids"] == sorted([ids["floor2"], ids["floor3"]]) and r.json()["target"] == {"floor_id": ids["floor3"], "version_id": other, "revision": 1}
    mine = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    theirs = c.get(f"/api/v1/plan-versions/{other}/geometry?draft=true").json()
    assert mine["issues"] == [] and theirs["issues"] == []
    assert [x["id"] for x in theirs["doc"]["connectors"]] == ["st1"] and theirs["doc"]["connectors"][0]["floor_ids"] == sorted([ids["floor2"], ids["floor3"]])
    assert theirs["doc"]["connectors"][0]["polyline"] == [[0.7, 0.7], [0.8, 0.7]] and theirs["doc"]["connectors"][0]["level_from"] == "L0"
    again = c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"]})
    assert again.status_code == 200 and again.json()["target"]["revision"] == 1, "linking twice changes nothing on the other floor"
    assert len(c.get(f"/api/v1/plan-versions/{other}/geometry?draft=true").json()["doc"]["connectors"]) == 1
    # a floor without a plan cannot receive it; a derived connector cannot be linked; a viewer cannot link
    empty = c.post(f"/api/v1/buildings/{ids['building']}/floors", json={"name": "קומה 4", "level": 4}).json()
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "st1", "floor_id": empty["id"]}).status_code == 409
    tribune = OBJ("t1", item="tribune.stepped", pos=(0.4, 0.6), size={"w_m": 4, "d_m": 3, "h_m": 1.2}, params={"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": "L1"})
    _save(c, vid, levels=LEVELS, objects=[tribune], connectors=[dict(stairs, floor_ids=[ids["floor2"], ids["floor3"]])])
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "cx-t1", "floor_id": ids["floor3"]}).status_code == 409
    bind(c, settings, "dana", "viewer", "floor", ids["floor2"])
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"]}, headers=as_user("dana")).status_code == 403
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'geometry.connector.link'").fetchone()[0] == 2
