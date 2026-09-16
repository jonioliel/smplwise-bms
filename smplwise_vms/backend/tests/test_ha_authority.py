"""T079: Home Assistant's own per-user permissions decide an action even when the bridge token could do more;
sensitive entity actions need their own grant on top of ha.entity.control; map editing is not control; the request
body never carries an identity or a raw service call; every denial is audited with its reason."""
from __future__ import annotations

from dataclasses import replace

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient
from test_ha import STATES

from smplwise.main import create_app
from smplwise.services import ha_bridge, ha_client, ha_sync


def _body(**kw):
    return {"allowed_action_id": "light.turn_on", "arguments": {}, "expected_state_version": None, "confirmation_grant": None, "client_request_id": "r1", "expires_at": "2099-01-01T00:00:00Z", **kw}


@pytest.fixture()
def paired(settings, monkeypatch):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES)
    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    c = TestClient(app)
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.1.0"}))
    calls: list[dict] = []
    answers: dict[str, dict] = {}

    def fake_execute(_settings, payload, timeout=15.0):
        calls.append(payload)
        ha_bridge.verify(secret, payload)
        return answers.get(payload["user_id"], {"ok": True, "context_id": "ctx"})

    monkeypatch.setattr(ha_client, "call_bridge_execute", fake_execute)
    ids = seed_tree(c)
    f2 = ids["floor2"]
    asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    for i, eid in enumerate(("light.lobby", "lock.front")):
        r = c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "ha_entity", "resource_id": eid, "x": 0.2 + i * 0.3, "y": 0.4})
        assert r.status_code == 201, r.text
    return app, s, c, calls, answers, ids


def test_ha_side_denial_wins_over_bridge_authority(paired):
    app, s, c, calls, answers, ids = paired
    # the VMS administrator holds everything the VMS knows; Home Assistant still says no for this user
    answers["dev-joni"] = {"ok": False, "error": "unauthorized"}
    r = c.post("/api/v1/ha/entities/light.lobby/actions", json=_body())
    assert r.status_code == 202 and r.json()["status"] == "denied" and r.json()["error"] == "ha_unauthorized"
    assert calls[-1]["user_id"] == "dev-joni", "the call went out in the user's own identity, never the add-on's"
    answers["dev-joni"] = {"ok": False, "error": "unknown_user"}
    r = c.post("/api/v1/ha/entities/light.lobby/actions", json=_body(client_request_id="r2"))
    assert r.json()["status"] == "denied" and r.json()["error"] == "ha_unknown_user"
    detail = c.get("/api/v1/ha/entities/light.lobby").json()
    assert detail["recent_actions"][0]["status"] == "denied" and detail["recent_actions"][0]["error"] == "ha_unknown_user"
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'ha.action' ORDER BY rowid").fetchall()
    assert [(row[0], row[1]) for row in rows] == [("denied", "ha_unauthorized"), ("denied", "ha_unknown_user")]


def test_unlock_needs_its_own_grant(paired):
    app, s, c, calls, answers, ids = paired
    f2 = ids["floor2"]
    bind(c, s, "omer", "operator", "floor", f2)  # operator: ha.entity.control on floor 2, nothing sensitive
    o = as_user("omer")
    d = c.get("/api/v1/ha/entities/lock.front", headers=o).json()
    assert d["can_control"] is True
    by_id = {a["id"]: a for a in d["actions"]}
    assert by_id["lock.lock"]["granted"] is True and by_id["lock.unlock"]["granted"] is False and by_id["lock.unlock"]["grant"] == "door.unlock"
    r = c.post("/api/v1/ha/entities/lock.front/actions", json=_body(allowed_action_id="lock.unlock", confirmation_grant="confirmed"), headers=o)
    assert r.status_code == 403 and r.json()["code"] == "grant_required" and r.json()["details"]["grant"] == "door.unlock"
    assert not calls, "nothing reaches Home Assistant without the grant"
    # a custom role carrying the sensitive grant at that floor unlocks it, in the user's own identity
    role = c.post("/api/v1/access/roles", json={"name": "פותח דלתות", "permissions": ["map.read"], "sensitive": ["door.unlock"]}).json()
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-omer", "role_id": role["id"], "scope_type": "floor", "scope_id": f2}).status_code == 201
    assert {a["id"]: a["granted"] for a in c.get("/api/v1/ha/entities/lock.front", headers=o).json()["actions"]}["lock.unlock"] is True
    r = c.post("/api/v1/ha/entities/lock.front/actions", json=_body(allowed_action_id="lock.unlock", confirmation_grant="confirmed", client_request_id="r2"), headers=o)
    assert r.status_code == 202 and r.json()["status"] == "pending" and calls[-1]["user_id"] == "dev-omer" and calls[-1]["service"] == "unlock"
    # the grant alone (without control) is not enough either: door.unlock on floor 3 does not reach floor 2
    bind(c, s, "dana", "operator", "floor", ids["floor3"])
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-dana", "role_id": role["id"], "scope_type": "floor", "scope_id": ids["floor3"]}).status_code == 201
    assert c.post("/api/v1/ha/entities/lock.front/actions", json=_body(allowed_action_id="lock.unlock", confirmation_grant="confirmed"), headers=as_user("dana")).status_code == 403
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ha.action' AND decision = 'denied' AND reason = 'grant_required'").fetchone()[0] == 1


def test_map_edit_is_not_control_and_no_client_identity(paired):
    app, s, c, calls, answers, ids = paired
    bind(c, s, "noa", "editor", "installation", "*")  # editor: map.edit everywhere, no ha.entity.control
    assert c.post("/api/v1/ha/entities/light.lobby/actions", json=_body(), headers=as_user("noa")).status_code == 403
    assert not calls
    # the body is closed: no user id, context or raw service call can ride along
    for extra in ({"user_id": "someone-else"}, {"context": {"user_id": "x"}}, {"service": "homeassistant.restart"}):
        assert c.post("/api/v1/ha/entities/light.lobby/actions", json={**_body(), **extra}).status_code == 422
    assert not calls
    # no generic dispatch: admin services, disarm and unknown lock services are simply not actions
    for aid in ("homeassistant.restart", "alarm_control_panel.alarm_disarm", "lock.open"):
        assert c.post("/api/v1/ha/entities/light.lobby/actions", json=_body(allowed_action_id=aid)).status_code == 422
    assert not calls
    # the catalogue advertises only the allow-list, and the allow-list has no admin-only service
    listed = c.get("/api/v1/ha/entities").json()["entities"]
    assert listed and all(a["id"] in ha_bridge.ACTIONS for e in listed for a in e["actions"])
    assert all(spec["domain"] not in ("homeassistant", "hassio", "alarm_control_panel") for spec in ha_bridge.ACTIONS.values())
