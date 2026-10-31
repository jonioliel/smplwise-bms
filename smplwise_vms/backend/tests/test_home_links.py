"""SYNOPTIC-HA-2310: the home-platform mapping rows (migration 0187) - platform floor -> our floor and per-area overrides."""
from __future__ import annotations

import json

from conftest import seed_tree


def _seed_platform(settings) -> None:
    from smplwise.db import Database

    with Database(settings.db_path).connection() as conn:
        for fid, name, level in (("ground_floor", "Ground", 0), ("basement", "Basement", -1)):
            conn.execute("INSERT INTO ha_floors(floor_id, name, level, icon, position, updated_at) VALUES (?, ?, ?, NULL, 0, 'x')", (fid, name, level))
        for aid, fid in (("lobby", "ground_floor"), ("kitchen", "ground_floor"), ("parking", "basement"), ("roof", None)):
            conn.execute("INSERT INTO ha_areas(area_id, name, floor_id, icon, position, updated_at) VALUES (?, ?, ?, NULL, 0, 'x')", (aid, aid, fid))


def test_empty_by_default(client):
    seed_tree(client)
    assert client.get("/api/v1/home-links").json() == {"floors": [], "areas": []}


def test_floor_rows_area_overrides_and_validation(client, settings):
    ids = seed_tree(client)
    _seed_platform(settings)
    f2, f3 = ids["floor2"], ids["floor3"]
    r = client.put(f"/api/v1/floors/{f2}/home-link", json={"ha_floor_ids": ["ground_floor", "ground_floor", " "], "areas": {"roof": "include", "kitchen": "exclude"}})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["floors"] == [{"ha_floor_id": "ground_floor", "floor_id": f2}]
    assert {"area_id": "roof", "floor_id": f2} in body["areas"] and {"area_id": "kitchen", "floor_id": None} in body["areas"]

    # one row per platform floor: linking it to another floor moves it
    body = client.put(f"/api/v1/floors/{f3}/home-link", json={"ha_floor_ids": ["ground_floor", "basement"]}).json()
    assert sorted((x["ha_floor_id"], x["floor_id"]) for x in body["floors"]) == [("basement", f3), ("ground_floor", f3)]
    # [] clears this floor's platform floors; "auto" drops an area row
    body = client.put(f"/api/v1/floors/{f3}/home-link", json={"ha_floor_ids": ["basement"]}).json()
    assert body["floors"] == [{"ha_floor_id": "basement", "floor_id": f3}]
    body = client.put(f"/api/v1/floors/{f2}/home-link", json={"areas": {"kitchen": "auto"}}).json()
    assert all(a["area_id"] != "kitchen" for a in body["areas"])

    # unknown ids: 422 and nothing written
    assert client.put(f"/api/v1/floors/{f2}/home-link", json={"ha_floor_ids": ["nope"]}).status_code == 422
    assert client.put(f"/api/v1/floors/{f2}/home-link", json={"areas": {"nope": "include"}}).status_code == 422
    assert client.put(f"/api/v1/floors/{f2}/home-link", json={"areas": {"roof": "maybe"}}).status_code == 422
    assert client.put("/api/v1/floors/missing/home-link", json={"ha_floor_ids": []}).status_code == 404

    # a dangling row (the platform dropped the area / floor) never blocks a save
    from smplwise.db import Database

    with Database(settings.db_path).connection() as conn:
        conn.execute("DELETE FROM ha_areas WHERE area_id = 'roof'")
        conn.execute("DELETE FROM ha_floors WHERE floor_id = 'basement'")
    assert client.put(f"/api/v1/floors/{f3}/home-link", json={"ha_floor_ids": ["basement"]}).status_code == 200
    assert client.put(f"/api/v1/floors/{f2}/home-link", json={"areas": {"roof": "include"}}).status_code == 200

    # a deleted floor's rows are not listed
    assert client.delete(f"/api/v1/floors/{f3}").status_code == 204
    assert all(x["floor_id"] != f3 for x in client.get("/api/v1/home-links").json()["floors"])


def test_permission_is_floor_edit_on_every_floor_touched(client, settings):
    from conftest import as_user, bind

    ids = seed_tree(client)
    _seed_platform(settings)
    f2, f3 = ids["floor2"], ids["floor3"]
    bind(client, settings, "vera", "viewer", "floor", f2)
    bind(client, settings, "edna", "site_admin", "floor", f2)
    # a viewer reads the rows of a floor it reaches, never writes
    assert client.put(f"/api/v1/floors/{f2}/home-link", headers=as_user("vera"), json={"ha_floor_ids": ["ground_floor"]}).status_code == 403
    # the floor's site admin (the floor-edit permission) writes its own floor
    assert client.put(f"/api/v1/floors/{f2}/home-link", headers=as_user("edna"), json={"ha_floor_ids": ["ground_floor"]}).status_code == 200
    assert client.get("/api/v1/home-links", headers=as_user("vera")).json()["floors"] == [{"ha_floor_id": "ground_floor", "floor_id": f2}]
    # the admin links the basement to floor 3; the floor-2 editor cannot take it away from floor 3 (that edits floor 3 too)
    assert client.put(f"/api/v1/floors/{f3}/home-link", json={"ha_floor_ids": ["basement"], "areas": {"parking": "include"}}).status_code == 200
    assert client.put(f"/api/v1/floors/{f2}/home-link", headers=as_user("edna"), json={"ha_floor_ids": ["ground_floor", "basement"]}).status_code == 403
    assert client.put(f"/api/v1/floors/{f2}/home-link", headers=as_user("edna"), json={"areas": {"parking": "include"}}).status_code == 403
    # and does not see floor 3's rows
    assert all(x["floor_id"] != f3 for x in client.get("/api/v1/home-links", headers=as_user("edna")).json()["floors"])


def test_audited(client, settings):
    from smplwise.db import Database

    ids = seed_tree(client)
    _seed_platform(settings)
    client.put(f"/api/v1/floors/{ids['floor3']}/home-link", json={"ha_floor_ids": ["basement"], "areas": {"parking": "exclude"}})
    with Database(settings.db_path).connection() as conn:
        row = conn.execute("SELECT details_json, resource_id FROM audit_log WHERE action = 'floor.home_link' ORDER BY id DESC LIMIT 1").fetchone()
    details = json.loads(row[0])
    assert row[1] == ids["floor3"] and details["ha_floor_ids"] == ["basement"] and details["areas"] == {"parking": "exclude"}
