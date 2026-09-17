"""Home Assistant entities (T023/T024/T025): sync upserts, registry mapping, scoped catalogue, anchors with entity
state, actions through the bridge (pairing, HMAC, idempotency, confirmation), directory push."""
from __future__ import annotations

import datetime as dt
import time
from dataclasses import replace

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import ha_bridge, ha_client, ha_sync

STATES = [
    {"entity_id": "light.lobby", "state": "off", "attributes": {"friendly_name": "Lobby light", "supported_features": 44, "brightness": None, "secret_token": "x"}, "last_changed": "2026-09-15T10:00:00+00:00", "last_updated": "2026-09-15T10:00:00+00:00"},
    {"entity_id": "lock.front", "state": "locked", "attributes": {"friendly_name": "Front door", "device_class": "lock"}, "last_changed": "2026-09-15T09:00:00+00:00", "last_updated": "2026-09-15T09:00:00+00:00"},
    {"entity_id": "sensor.temp", "state": "23.5", "attributes": {"friendly_name": "Temp", "unit_of_measurement": "°C", "device_class": "temperature"}, "last_changed": "2026-09-15T10:30:00+00:00", "last_updated": "2026-09-15T10:30:00+00:00"},
    {"entity_id": "update.core", "state": "off", "attributes": {"friendly_name": "Core update"}, "last_changed": "2026-09-15T10:30:00+00:00", "last_updated": "2026-09-15T10:30:00+00:00"},
]


@pytest.fixture()
def ha_app(settings, monkeypatch):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES)
    app = create_app(s)
    ha_sync.STATE.connected = True  # the socket thread is not started in tests
    ha_sync.snapshot(app.state.db, s)
    return app, s


def test_snapshot_registry_and_catalogue(ha_app):
    app, s = ha_app
    c = TestClient(app)
    r = c.get("/api/v1/ha/entities").json()
    ids = [e["entity_id"] for e in r["entities"]]
    assert ids == ["light.lobby", "lock.front", "sensor.temp"], ids  # update.* skipped
    light = next(e for e in r["entities"] if e["entity_id"] == "light.lobby")
    assert light["name"] == "Lobby light" and light["state"] == "off" and "secret_token" not in light["attributes"] and light["attributes"]["supported_features"] == 44
    assert [a["id"] for a in light["actions"]] == ["light.turn_on", "light.turn_off"] and light["fresh"] is True
    assert r["domains"] == {"light": 1, "lock": 1, "sensor": 1}
    # registry names/areas win over friendly names; disabled entities are kept but hidden by default
    maps = ha_client.registry_maps(
        [{"entity_id": "light.lobby", "id": "reg1", "unique_id": "u1", "platform": "hue", "device_id": "d1", "area_id": None, "name": "Lobby ceiling", "original_name": "Hue 1", "disabled_by": None},
         {"entity_id": "switch.old", "id": "reg2", "unique_id": "u2", "platform": "x", "device_id": None, "area_id": "a2", "name": None, "original_name": "Old", "disabled_by": "user"}],
        [{"id": "d1", "area_id": "a1"}],
        [{"area_id": "a1", "name": "Lobby", "floor_id": "f1"}, {"area_id": "a2", "name": "Cellar", "floor_id": None}],
        [{"floor_id": "f1", "name": "Ground"}],
    )
    assert maps["light.lobby"]["area_name"] == "Lobby" and maps["light.lobby"]["ha_floor_name"] == "Ground" and maps["switch.old"]["disabled"] == 1
    with app.state.db.connection() as conn:
        ha_sync.apply_registry(conn, maps)
    r2 = c.get("/api/v1/ha/entities?q=lobby").json()["entities"]
    assert r2[0]["name"] == "Lobby ceiling" and r2[0]["area_name"] == "Lobby" and r2[0]["registry_id"] == "reg1"
    assert [e["entity_id"] for e in c.get("/api/v1/ha/entities?include_disabled=true&domain=switch").json()["entities"]] == ["switch.old"]
    assert c.get("/api/v1/ha/entities?domain=switch").json()["entities"] == []
    # tombstone: an entity gone from HA is marked removed, not deleted
    with app.state.db.connection() as conn:
        ha_sync.tombstone_missing(conn, {"light.lobby", "lock.front"})
    assert "sensor.temp" not in [e["entity_id"] for e in c.get("/api/v1/ha/entities").json()["entities"]]
    assert c.get("/api/v1/ha/entities/sensor.temp").json()["removed_at"]


def test_scope_placement_and_map_bundle(ha_app):
    app, s = ha_app
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    # unknown entity refused; known one placed with a domain-derived layer
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "light.nope", "x": 0.2, "y": 0.2}).status_code == 422
    a = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "lock.front", "x": 0.2, "y": 0.2})
    assert a.status_code == 201 and a.json()["layer_id"] == "doors"
    bundle = c.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    ent = next(x for x in bundle["anchors"] if x["resource_type"] == "ha_entity")["entity"]
    assert ent["entity_id"] == "lock.front" and ent["state"] == "locked" and [x["id"] for x in ent["actions"]] == ["lock.lock", "lock.unlock"]
    assert bundle["ha_sync"]["connected"] is True
    # a floor-2 viewer sees only the placed entity in the catalogue, nothing on other floors
    bind(c, s, "ron", "viewer", "floor", ids["floor2"])
    mine = c.get("/api/v1/ha/entities", headers=as_user("ron")).json()
    assert [e["entity_id"] for e in mine["entities"]] == ["lock.front"] and mine["can_control"] is False
    assert c.get("/api/v1/ha/entities/light.lobby", headers=as_user("ron")).status_code == 403
    bind(c, s, "vi", "viewer", "floor", ids["floor3"])
    assert c.get("/api/v1/ha/entities", headers=as_user("vi")).json()["entities"] == []


def test_bridge_signing_and_directory(ha_app):
    app, s = ha_app
    c = TestClient(app)
    # pairing code is admin-only and stable until regenerated
    p = c.get("/api/v1/ha/bridge/pairing").json()
    assert p["pairing_code"] and p["addon_url"].endswith(":8099") and p["paired_at"] is None
    assert c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"] == p["pairing_code"]
    secret = p["pairing_code"]
    msg = ha_bridge.sign(secret, {"version": "0.1.0"})
    ha_bridge.verify(secret, msg)
    with pytest.raises(ApiError):
        ha_bridge.verify(secret, msg)  # replay
    with pytest.raises(ApiError):
        ha_bridge.verify(secret, ha_bridge.sign("wrong", {"version": "0.1.0"}))
    with pytest.raises(ApiError):
        ha_bridge.verify(secret, ha_bridge.sign(secret, {"a": 1}, ts=int(time.time()) - 600))
    with pytest.raises(ApiError):
        ha_bridge.verify(None, msg)
    # ping marks paired; directory push stores users; a bad signature is refused
    r = c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.1.0"}))
    assert r.status_code == 200 and r.json()["ok"]
    r = c.post("/api/v1/ha/bridge/directory", json=ha_bridge.sign(secret, {"users": [{"id": "u1", "name": "Yoni", "username": "yoni", "is_active": True, "is_admin": True, "group_ids": ["system-admin"]}, {"id": "u2", "name": "Guest", "is_active": True}]}))
    assert r.status_code == 200
    # the running version travels with every push and is recorded (0.1.58) - not only at pairing time
    from smplwise.services import bridge_install

    assert bridge_install.status(db=c.app.state.db)["active_version"] == "0.1.0"
    r = c.post("/api/v1/ha/bridge/directory", json=ha_bridge.sign(secret, {"users": [{"id": "u1", "name": "Yoni", "username": "yoni", "is_active": True, "is_admin": True, "group_ids": ["system-admin"]}, {"id": "u2", "name": "Guest", "is_active": True}], "version": "0.2.1"}))
    assert r.status_code == 200
    assert bridge_install.status(db=c.app.state.db)["active_version"] == "0.2.1"
    assert r.status_code == 200 and r.json()["users"] == 2
    assert c.post("/api/v1/ha/bridge/directory", json={"users": [], "ts": int(time.time()), "nonce": "x", "sig": "bad"}).status_code == 401
    st = c.get("/api/v1/ha/status").json()
    assert st["bridge"]["paired"] is True and st["bridge"]["directory_users"] == 2 and st["configured"] is True
    # viewers cannot read the pairing code
    bind(c, s, "ron", "viewer", "installation", "*")
    assert c.get("/api/v1/ha/bridge/pairing", headers=as_user("ron")).status_code == 403


def test_actions_through_bridge(ha_app, monkeypatch):
    app, s = ha_app
    c = TestClient(app)
    body = lambda **kw: {"allowed_action_id": "light.turn_on", "arguments": {"brightness_pct": 40}, "expected_state_version": None, "confirmation_grant": None, "client_request_id": "req-1", "expires_at": "2099-01-01T00:00:00Z", **kw}  # noqa: E731
    # not paired → 503 with an explanation, recorded as failed
    r = c.post("/api/v1/ha/entities/light.lobby/actions", json=body())
    assert r.status_code == 503 and r.json()["code"] == "bridge_not_paired"
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.1.0"}))
    calls: list[dict] = []

    def fake_execute(_settings, payload, timeout=15.0):
        calls.append(payload)
        ha_bridge.verify(secret, payload)  # the integration would verify exactly this
        if payload["data"].get("entity_id") == "lock.front" and payload["service"] == "unlock":
            return {"ok": False, "error": "unauthorized"}
        return {"ok": True, "context_id": "ctx1"}

    monkeypatch.setattr(ha_client, "call_bridge_execute", fake_execute)
    # validation: unknown action / wrong domain / bad argument
    assert c.post("/api/v1/ha/entities/light.lobby/actions", json=body(allowed_action_id="light.explode", client_request_id="v1")).status_code == 422
    assert c.post("/api/v1/ha/entities/light.lobby/actions", json=body(allowed_action_id="switch.turn_on", client_request_id="v2")).status_code == 422
    assert c.post("/api/v1/ha/entities/light.lobby/actions", json=body(arguments={"brightness_pct": 400}, client_request_id="v3")).status_code == 422
    # happy path: pending, signed payload carries the VMS user id, idempotent on the same client_request_id
    r = c.post("/api/v1/ha/entities/light.lobby/actions", json=body(client_request_id="req-2"))
    assert r.status_code == 202, r.text
    a = r.json()
    assert a["status"] == "pending" and calls[-1]["user_id"] == "dev-joni" and calls[-1]["data"] == {"entity_id": "light.lobby", "brightness_pct": 40} and "sig" in calls[-1]
    again = c.post("/api/v1/ha/entities/light.lobby/actions", json=body(client_request_id="req-2"))
    assert again.status_code == 202 and again.json()["id"] == a["id"] and len(calls) == 1, "duplicate click does not send twice"
    # not confirmed until HA reports the expected state after the request
    assert c.get(f"/api/v1/ha/actions/{a['id']}").json()["status"] == "pending"
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "light.lobby", "state": "on", "attributes": {"friendly_name": "Lobby light"}, "last_changed": dt.datetime.now(dt.timezone.utc).isoformat(), "last_updated": dt.datetime.now(dt.timezone.utc).isoformat()})
    assert c.get(f"/api/v1/ha/actions/{a['id']}").json()["status"] == "confirmed"
    # unlock needs its own grant on top of control (T079); the administrator gets it only through a custom role
    r = c.post("/api/v1/ha/entities/lock.front/actions", json=body(allowed_action_id="lock.unlock", arguments={}, client_request_id="req-3", confirmation_grant="confirmed"))
    assert r.status_code == 403 and r.json()["code"] == "grant_required" and r.json()["details"]["grant"] == "door.unlock"
    opener = c.post("/api/v1/access/roles", json={"name": "פותח דלתות", "permissions": ["map.read"], "sensitive": ["door.unlock"]}).json()
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-joni", "role_id": opener["id"], "scope_type": "installation", "scope_id": "*"}).status_code == 201
    # sensitive action needs an explicit confirmation; HA's own permission answer is honoured (denied)
    r = c.post("/api/v1/ha/entities/lock.front/actions", json=body(allowed_action_id="lock.unlock", arguments={}, client_request_id="req-3b"))
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    r = c.post("/api/v1/ha/entities/lock.front/actions", json=body(allowed_action_id="lock.unlock", arguments={}, client_request_id="req-4", confirmation_grant="confirmed"))
    assert r.status_code == 202 and r.json()["status"] == "denied" and r.json()["error"] == "ha_unauthorized"
    # permission: a viewer cannot act; an operator on another floor cannot act on an unplaced entity
    bind(c, s, "ron", "viewer", "installation", "*")
    assert c.post("/api/v1/ha/entities/light.lobby/actions", json=body(client_request_id="req-5"), headers=as_user("ron")).status_code == 403
    detail = c.get("/api/v1/ha/entities/light.lobby").json()
    assert detail["can_control"] is True and detail["recent_actions"][0]["status"] == "confirmed"
