"""MAPPING-ASSIST-2330 (owner approval 31.10, round 10 mapping v3): the mapping assistant's server side - state, settings, the apply
transaction (new buildings / floors, layer 1 + layer 2 rows, area -> building rows), versions and "חזרה לגרסה זו", audit, the
multi-building switch (OFF by default), and the site-configure permission on every route."""
from __future__ import annotations

import json

from conftest import as_user, bind, seed_tree

API = "/api/v1"


def _platform(settings) -> None:
    from smplwise.db import Database

    with Database(settings.db_path).connection() as conn:
        for fid, name, level in (("hf_a2", "א · קומה 2", 2), ("hf_a3", "א · קומה 3", 3), ("hf_e1", "ה · קומה 1", 1)):
            conn.execute("INSERT INTO ha_floors(floor_id, name, level, icon, position, updated_at) VALUES (?, ?, ?, NULL, 0, 'x')", (fid, name, level))
        for aid, name, fid in (("lobby", "א · לובי", "hf_a2"), ("office", "א · משרדים", "hf_a3"), ("e_lobby", "ה · לובי", "hf_e1"), ("bikes", "א · אופניים", None), ("trash", "חדר אשפה", "hf_a2")):
            conn.execute("INSERT INTO ha_areas(area_id, name, floor_id, icon, position, updated_at) VALUES (?, ?, ?, NULL, 0, 'x')", (aid, name, fid))


def _audits(settings, action: str) -> list[dict]:
    from smplwise.db import Database

    with Database(settings.db_path).connection() as conn:
        return [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = ? AND decision = 'allowed' ORDER BY rowid", (action,)).fetchall()]


STATE = {"v": 1, "spec": {"position": "start", "seps": ["·"], "kind": "any", "marker": "בניין"}, "tokens": {"ה": {"t": "new", "name": "בניין ה"}}, "manual_tokens": [], "advanced": False, "rules": [], "decisions": {}}


def _plan(ids: dict[str, str]) -> dict:
    return {
        "new_buildings": [{"key": "b1", "name": "בניין ה"}],
        "new_floors": [{"key": "f1", "building": "new:b1", "name": "קומה 1", "level": 1}],
        "floors": [{"ha_floor_id": "hf_a2", "floor": ids["floor2"]}, {"ha_floor_id": "hf_a3", "floor": ids["floor3"]}, {"ha_floor_id": "hf_e1", "floor": "new:f1"}],
        "areas": [{"area_id": "bikes", "floor": "keep", "building": ids["building"]}],
        "items": ["f:hf_a2", "f:hf_a3", "f:hf_e1", "a:lobby", "a:office", "a:e_lobby", "a:bikes", "a:trash"],
    }


def test_read_defaults_and_platform_items(client, settings):
    ids = seed_tree(client)
    _platform(settings)
    r = client.get(f"{API}/sites/{ids['site']}/mapping")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"] is None and body["revision"] == 0 and body["versions"] == [] and body["seen"] is None
    assert body["settings"] == {"floor_inherit": "on", "auto_insert": "off", "new_token": "new_first"}
    assert body["multi_building"] is False and body["can_toggle"] is True
    assert {f["id"] for f in body["items"]["floors"]} == {"hf_a2", "hf_a3", "hf_e1"}
    assert {a["id"]: a["floor_id"] for a in body["items"]["areas"]}["bikes"] is None
    assert [b["name"] for b in body["buildings"]] == ["מבנה א"] and len(body["buildings"][0]["floors"]) == 2
    assert body["links"] == {"floors": [], "areas": [], "buildings": []}
    # the installation setting: off by default, read-only in GET /settings
    assert client.get(f"{API}/settings").json()["settings"]["home.multi_building"] == "off"
    assert client.get(f"{API}/home-links").json()["buildings"] == []


def test_state_and_settings_round_trip_with_revision(client, settings):
    ids = seed_tree(client)
    url = f"{API}/sites/{ids['site']}/mapping"
    r = client.put(f"{url}/state", json={"state": STATE, "revision": 0})
    assert r.status_code == 200 and r.json()["revision"] == 1
    assert client.put(f"{url}/state", json={"state": STATE, "revision": 0}).status_code == 409  # stale
    assert client.get(url).json()["state"]["tokens"]["ה"] == {"t": "new", "name": "בניין ה"}
    r = client.put(f"{url}/settings", json={"floor_inherit": "off", "new_token": "existing_first"})
    assert r.status_code == 200
    assert r.json()["settings"] == {"floor_inherit": "off", "auto_insert": "off", "new_token": "existing_first"}
    assert client.put(f"{url}/settings", json={"auto_insert": "sometimes"}).status_code == 422
    assert client.get(url).json()["settings"]["new_token"] == "existing_first"
    assert _audits(settings, "home.mapping.settings")[-1] == {"floor_inherit": "off", "new_token": "existing_first"}
    assert _audits(settings, "home.mapping.state")


def test_apply_creates_rows_buildings_and_a_version(client, settings):
    ids = seed_tree(client)
    _platform(settings)
    url = f"{API}/sites/{ids['site']}/mapping"
    r = client.post(f"{url}/apply", json={"state": STATE, "plan": _plan(ids), "summary": {"open": 0}})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["version"] == 1
    assert [b["name"] for b in out["created"]["buildings"]] == ["בניין ה"]
    new_floor = out["created"]["floors"][0]["id"]
    links = client.get(f"{API}/home-links").json()
    assert sorted((x["ha_floor_id"], x["floor_id"]) for x in links["floors"]) == sorted([("hf_a2", ids["floor2"]), ("hf_a3", ids["floor3"]), ("hf_e1", new_floor)])
    assert links["buildings"] == [{"area_id": "bikes", "building_id": ids["building"]}]
    # the new building and floor are real catalogue rows
    tree = client.get(f"{API}/sites?tree=true").json()["sites"][0]
    assert "בניין ה" in [b["name"] for b in tree["buildings"]]
    m = client.get(url).json()
    assert m["versions"][0]["number"] == 1 and m["versions"][0]["current"] is True and m["versions"][0]["summary"]["floor_rows"] == 3
    assert set(m["seen"]) == set(_plan(ids)["items"])
    assert m["state"]["tokens"]["ה"]["name"] == "בניין ה" and m["revision"] == 1
    a = _audits(settings, "home.mapping.apply")[-1]
    assert a["version"] == 1 and a["floor_rows"] == 3 and a["building_rows"] == 1 and len(a["buildings_created"]) == 1
    assert any(x.get("via") == "home.mapping.apply" for x in _audits(settings, "building.create"))


def test_apply_checks_everything_first_and_writes_nothing_on_error(client, settings):
    ids = seed_tree(client)
    _platform(settings)
    other = client.post(f"{API}/sites", json={"name": "אתר אחר"}).json()
    ob = client.post(f"{API}/sites/{other['id']}/buildings", json={"name": "זר"}).json()
    of = client.post(f"{API}/buildings/{ob['id']}/floors", json={"name": "קומה", "level": 0}).json()
    url = f"{API}/sites/{ids['site']}/mapping/apply"
    bad = [
        {"floors": [{"ha_floor_id": "nope", "floor": ids["floor2"]}]},  # unknown platform floor
        {"floors": [{"ha_floor_id": "hf_a2", "floor": of["id"]}]},  # a floor of another site
        {"areas": [{"area_id": "nope", "floor": "keep", "building": ids["building"]}]},
        {"areas": [{"area_id": "bikes", "floor": "keep", "building": ob["id"]}]},  # a building of another site
        {"floors": [{"ha_floor_id": "hf_e1", "floor": "new:f9"}]},  # unknown new floor
        {"new_buildings": [{"key": "b1", "name": "x"}, {"key": "b1", "name": "y"}]},
    ]
    for p in bad:
        r = client.post(url, json={"state": STATE, "plan": {"items": [], **p}})
        assert r.status_code == 422, (p, r.text)
    assert client.get(f"{API}/home-links").json() == {"floors": [], "areas": [], "buildings": []}
    assert client.get(f"{API}/sites/{ids['site']}/mapping").json()["versions"] == []
    names = [b["name"] for s in client.get(f"{API}/sites?tree=true").json()["sites"] for b in s["buildings"]]
    assert names.count("x") == 0


def test_restore_writes_a_new_version_with_the_old_rows(client, settings):
    ids = seed_tree(client)
    _platform(settings)
    url = f"{API}/sites/{ids['site']}/mapping"
    assert client.post(f"{url}/apply", json={"state": STATE, "plan": _plan(ids)}).status_code == 200
    # version 2: hf_a2 moves to floor 3, the bikes row goes, "trash" is taken off every floor
    p2 = {"floors": [{"ha_floor_id": "hf_a2", "floor": ids["floor3"]}], "areas": [{"area_id": "bikes", "floor": "keep", "building": None}, {"area_id": "trash", "floor": None, "building": None}], "items": ["a:trash"]}
    r = client.post(f"{url}/apply", json={"state": {**STATE, "decisions": {"a:trash": {"t": "none"}}}, "plan": p2, "kind": "confirm"})
    assert r.status_code == 200 and r.json()["version"] == 2
    links = client.get(f"{API}/home-links").json()
    assert {"ha_floor_id": "hf_a2", "floor_id": ids["floor3"]} in links["floors"] and links["buildings"] == []
    assert {"area_id": "trash", "floor_id": None} in links["areas"]
    # a confirm keeps what the earlier version saw
    assert "a:lobby" in client.get(url).json()["seen"]
    # back to version 1
    r = client.post(f"{url}/versions/1/restore")
    assert r.status_code == 200, r.text
    assert r.json()["version"] == 3
    links = client.get(f"{API}/home-links").json()
    assert {"ha_floor_id": "hf_a2", "floor_id": ids["floor2"]} in links["floors"]
    assert links["buildings"] == [{"area_id": "bikes", "building_id": ids["building"]}]
    assert all(a["area_id"] != "trash" for a in links["areas"])
    m = client.get(url).json()
    assert [v["number"] for v in m["versions"]] == [3, 2, 1] and m["versions"][0]["kind"] == "restore" and m["versions"][0]["restored_from"] == 1
    assert m["state"]["decisions"] == {}  # the state of version 1
    # the building version 1 created is still there (nothing is deleted)
    assert "בניין ה" in [b["name"] for b in client.get(f"{API}/sites?tree=true").json()["sites"][0]["buildings"]]
    assert _audits(settings, "home.mapping.restore")[-1]["restored_from"] == 1
    assert client.post(f"{url}/versions/99/restore").status_code == 404


def test_rows_of_a_deleted_building_are_not_listed(client, settings):
    ids = seed_tree(client)
    _platform(settings)
    b2 = client.post(f"{API}/sites/{ids['site']}/buildings", json={"name": "ב"}).json()
    plan = {"areas": [{"area_id": "bikes", "floor": "keep", "building": b2["id"]}], "items": []}
    assert client.post(f"{API}/sites/{ids['site']}/mapping/apply", json={"state": STATE, "plan": plan}).status_code == 200
    assert client.get(f"{API}/home-links").json()["buildings"] == [{"area_id": "bikes", "building_id": b2["id"]}]
    assert client.delete(f"{API}/buildings/{b2['id']}").status_code == 204
    assert client.get(f"{API}/home-links").json()["buildings"] == []


def test_multi_building_switch_off_by_default_audited_and_permissioned(client, settings):
    ids = seed_tree(client)
    assert client.get(f"{API}/settings").json()["settings"]["home.multi_building"] == "off"
    r = client.put(f"{API}/home/multi-building", json={"enabled": True})
    assert r.status_code == 200 and r.json() == {"enabled": True}
    assert client.get(f"{API}/settings").json()["settings"]["home.multi_building"] == "on"
    assert client.get(f"{API}/sites/{ids['site']}/mapping").json()["multi_building"] is True
    # not through PATCH /settings
    client.patch(f"{API}/settings", json={"home.multi_building": "off"})
    assert client.get(f"{API}/settings").json()["settings"]["home.multi_building"] == "on"
    assert client.put(f"{API}/home/multi-building", json={"enabled": False}).status_code == 200
    assert client.get(f"{API}/settings").json()["settings"]["home.multi_building"] == "off"
    assert [a["enabled"] for a in _audits(settings, "home.multi_building")] == [True, False]
    # a viewer may not switch it; a site administrator of the (only) site may
    bind(client, settings, "dana", "viewer", "installation", "*")
    assert client.put(f"{API}/home/multi-building", json={"enabled": True}, headers=as_user("dana")).status_code == 403
    bind(client, settings, "yoni", "site_admin", "site", ids["site"])
    assert client.put(f"{API}/home/multi-building", json={"enabled": True}, headers=as_user("yoni")).status_code == 200
    # ... but not when another site exists that he does not administer
    client.post(f"{API}/sites", json={"name": "אתר שני"})
    assert client.put(f"{API}/home/multi-building", json={"enabled": False}, headers=as_user("yoni")).status_code == 403
    assert client.get(f"{API}/sites/{ids['site']}/mapping", headers=as_user("yoni")).json()["can_toggle"] is False


def test_every_mapping_route_needs_the_site_configure_permission(client, settings):
    ids = seed_tree(client)
    _platform(settings)
    url = f"{API}/sites/{ids['site']}/mapping"
    bind(client, settings, "dana", "viewer", "installation", "*")
    h = as_user("dana")
    assert client.get(url, headers=h).status_code == 403
    assert client.put(f"{url}/state", json={"state": STATE, "revision": 0}, headers=h).status_code == 403
    assert client.put(f"{url}/settings", json={"floor_inherit": "off"}, headers=h).status_code == 403
    assert client.post(f"{url}/apply", json={"state": STATE, "plan": _plan(ids)}, headers=h).status_code == 403
    assert client.post(f"{url}/versions/1/restore", headers=h).status_code == 403
    assert client.get(f"{API}/home-links").json()["floors"] == []
    # a site administrator of this site may
    bind(client, settings, "yoni", "site_admin", "site", ids["site"])
    assert client.post(f"{url}/apply", json={"state": STATE, "plan": _plan(ids)}, headers=as_user("yoni")).status_code == 200
    assert client.get(f"{API}/sites/missing/mapping").status_code == 404
