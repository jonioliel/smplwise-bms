"""T040: more entity adapters with risk classes. Arguments are validated by type and range (float / enum / string),
the expected state follows the requested value, "attention" actions need a confirmation, "sensitive" ones their own
grant (alarm.disarm), and every accepted call reaches the bridge with exactly the cleaned service data."""
from __future__ import annotations

from dataclasses import replace

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_bridge, ha_client, ha_sync

T = "2026-09-15T10:00:00+00:00"
STATES2 = [
    {"entity_id": "climate.hall", "state": "heat", "attributes": {"friendly_name": "Hall AC", "hvac_modes": ["off", "heat", "cool"], "temperature": 22, "current_temperature": 24.5, "min_temp": 16, "max_temp": 30}, "last_changed": T, "last_updated": T},
    {"entity_id": "media_player.tv", "state": "paused", "attributes": {"friendly_name": "TV", "volume_level": 0.3}, "last_changed": T, "last_updated": T},
    {"entity_id": "number.setpoint", "state": "40", "attributes": {"friendly_name": "Setpoint", "min": 0, "max": 100, "step": 5}, "last_changed": T, "last_updated": T},
    {"entity_id": "select.mode", "state": "eco", "attributes": {"friendly_name": "Mode", "options": ["eco", "comfort", "boost"]}, "last_changed": T, "last_updated": T},
    {"entity_id": "alarm_control_panel.home", "state": "armed_away", "attributes": {"friendly_name": "Alarm"}, "last_changed": T, "last_updated": T},
    {"entity_id": "siren.yard", "state": "off", "attributes": {"friendly_name": "Yard siren"}, "last_changed": T, "last_updated": T},
    {"entity_id": "input_boolean.night", "state": "off", "attributes": {"friendly_name": "Night mode"}, "last_changed": T, "last_updated": T},
]


def _body(**kw):
    return {"allowed_action_id": "climate.set_temperature", "arguments": {}, "expected_state_version": None, "confirmation_grant": None, "client_request_id": "r1", "expires_at": "2099-01-01T00:00:00Z", **kw}


@pytest.fixture()
def paired(settings, monkeypatch):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES2)
    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    c = TestClient(app)
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.2.1"}))
    calls: list[dict] = []

    def fake_execute(_settings, payload, timeout=15.0):
        calls.append(payload)
        ha_bridge.verify(secret, payload)
        return {"ok": True, "context_id": "ctx"}

    monkeypatch.setattr(ha_client, "call_bridge_execute", fake_execute)
    ids = seed_tree(c)
    f2 = ids["floor2"]
    asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    for i, st in enumerate(STATES2):
        r = c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "ha_entity", "resource_id": st["entity_id"], "x": 0.1 + i * 0.1, "y": 0.4})
        assert r.status_code == 201, r.text
    bind(c, s, "omer", "operator", "floor", f2)
    return app, s, c, calls, ids


def test_catalogue_carries_risk_and_argument_specs(paired):
    app, s, c, calls, ids = paired
    d = c.get("/api/v1/ha/entities/climate.hall", headers=as_user("omer")).json()
    by = {a["id"]: a for a in d["actions"]}
    assert set(by) == {"climate.set_hvac_mode", "climate.set_temperature"}
    assert by["climate.set_hvac_mode"]["risk"] == "routine" and by["climate.set_hvac_mode"]["argument_specs"][0]["choices"][:3] == ["off", "heat", "cool"]
    assert by["climate.set_temperature"]["argument_specs"] == [{"name": "temperature", "type": "float", "min": 5, "max": 35}]
    al = {a["id"]: a for a in c.get("/api/v1/ha/entities/alarm_control_panel.home", headers=as_user("omer")).json()["actions"]}
    assert al["alarm_control_panel.alarm_disarm"]["risk"] == "sensitive" and al["alarm_control_panel.alarm_disarm"]["grant"] == "alarm.disarm" and al["alarm_control_panel.alarm_disarm"]["granted"] is False
    assert al["alarm_control_panel.alarm_arm_away"]["risk"] == "attention" and al["alarm_control_panel.alarm_arm_away"]["sensitive"] is True
    assert {a["id"] for a in c.get("/api/v1/ha/entities/input_boolean.night", headers=as_user("omer")).json()["actions"]} == {"input_boolean.turn_on", "input_boolean.turn_off"}


def test_arguments_are_validated_and_reach_the_bridge_cleaned(paired):
    app, s, c, calls, ids = paired
    o = as_user("omer")
    # float in range → accepted, the bridge receives the number
    r = c.post("/api/v1/ha/entities/climate.hall/actions", json=_body(arguments={"temperature": "21.5"}), headers=o)
    assert r.status_code == 202, r.text
    assert calls[-1]["domain"] == "climate" and calls[-1]["service"] == "set_temperature" and calls[-1]["data"] == {"entity_id": "climate.hall", "temperature": 21.5}
    # out of range, wrong type, unknown argument
    assert c.post("/api/v1/ha/entities/climate.hall/actions", json=_body(arguments={"temperature": 40}, client_request_id="r2"), headers=o).status_code == 422
    assert c.post("/api/v1/ha/entities/climate.hall/actions", json=_body(arguments={"temperature": "warm"}, client_request_id="r3"), headers=o).status_code == 422
    assert c.post("/api/v1/ha/entities/climate.hall/actions", json=_body(arguments={"fan": "high"}, client_request_id="r4"), headers=o).status_code == 422
    # enum: the expected state is the requested mode; an unknown mode is refused before the bridge
    n = len(calls)
    assert c.post("/api/v1/ha/entities/climate.hall/actions", json=_body(allowed_action_id="climate.set_hvac_mode", arguments={"hvac_mode": "party"}, client_request_id="r5"), headers=o).status_code == 422
    r = c.post("/api/v1/ha/entities/climate.hall/actions", json=_body(allowed_action_id="climate.set_hvac_mode", arguments={"hvac_mode": "cool"}, client_request_id="r6"), headers=o)
    assert r.status_code == 202 and r.json()["expected_state"] == "cool" and len(calls) == n + 1
    # a mode without its argument is refused
    assert c.post("/api/v1/ha/entities/climate.hall/actions", json=_body(allowed_action_id="climate.set_hvac_mode", client_request_id="r7"), headers=o).status_code == 422
    # select: the option is a bounded string, expected state = the option; number: whole floats keep their form
    r = c.post("/api/v1/ha/entities/select.mode/actions", json=_body(allowed_action_id="select.select_option", arguments={"option": " comfort "}, client_request_id="r8"), headers=o)
    assert r.status_code == 202 and r.json()["expected_state"] == "comfort" and calls[-1]["data"]["option"] == "comfort"
    assert c.post("/api/v1/ha/entities/select.mode/actions", json=_body(allowed_action_id="select.select_option", arguments={"option": "x" * 81}, client_request_id="r9"), headers=o).status_code == 422
    r = c.post("/api/v1/ha/entities/number.setpoint/actions", json=_body(allowed_action_id="number.set_value", arguments={"value": 45}, client_request_id="r10"), headers=o)
    assert r.status_code == 202 and r.json()["expected_state"] == "45" and calls[-1]["data"]["value"] == 45
    # media volume as a fraction
    r = c.post("/api/v1/ha/entities/media_player.tv/actions", json=_body(allowed_action_id="media_player.volume_set", arguments={"volume_level": 0.55}, client_request_id="r11"), headers=o)
    assert r.status_code == 202 and calls[-1]["data"]["volume_level"] == 0.55
    assert c.post("/api/v1/ha/entities/media_player.tv/actions", json=_body(allowed_action_id="media_player.volume_set", arguments={"volume_level": 1.5}, client_request_id="r12"), headers=o).status_code == 422
    # domain mismatch never reaches the bridge
    n = len(calls)
    assert c.post("/api/v1/ha/entities/media_player.tv/actions", json=_body(allowed_action_id="climate.set_temperature", arguments={"temperature": 20}, client_request_id="r13"), headers=o).status_code == 422
    assert len(calls) == n


def test_attention_needs_confirmation_and_sensitive_needs_its_grant(paired):
    app, s, c, calls, ids = paired
    o = as_user("omer")
    # siren: attention → confirmation first
    r = c.post("/api/v1/ha/entities/siren.yard/actions", json=_body(allowed_action_id="siren.turn_on"), headers=o)
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    r = c.post("/api/v1/ha/entities/siren.yard/actions", json=_body(allowed_action_id="siren.turn_on", confirmation_grant="confirmed", client_request_id="r2"), headers=o)
    assert r.status_code == 202 and calls[-1]["service"] == "turn_on"
    # arming is attention, disarming is sensitive: the operator may arm but not disarm
    r = c.post("/api/v1/ha/entities/alarm_control_panel.home/actions", json=_body(allowed_action_id="alarm_control_panel.alarm_arm_home", confirmation_grant="confirmed", client_request_id="r3"), headers=o)
    assert r.status_code == 202 and r.json()["expected_state"] == "armed_home"
    n = len(calls)
    r = c.post("/api/v1/ha/entities/alarm_control_panel.home/actions", json=_body(allowed_action_id="alarm_control_panel.alarm_disarm", confirmation_grant="confirmed", client_request_id="r4"), headers=o)
    assert r.status_code == 403 and r.json()["code"] == "grant_required" and r.json()["details"]["grant"] == "alarm.disarm" and len(calls) == n
    # a custom role with the sensitive grant on that floor allows it, still with a confirmation
    role = c.post("/api/v1/access/roles", json={"name": "מנטרל אזעקה", "permissions": ["map.read"], "sensitive": ["alarm.disarm"]}).json()
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-omer", "role_id": role["id"], "scope_type": "floor", "scope_id": ids["floor2"]}).status_code == 201
    assert c.post("/api/v1/ha/entities/alarm_control_panel.home/actions", json=_body(allowed_action_id="alarm_control_panel.alarm_disarm", client_request_id="r5"), headers=o).status_code == 409
    r = c.post("/api/v1/ha/entities/alarm_control_panel.home/actions", json=_body(allowed_action_id="alarm_control_panel.alarm_disarm", confirmation_grant="confirmed", client_request_id="r6"), headers=o)
    assert r.status_code == 202 and calls[-1]["service"] == "alarm_disarm" and calls[-1]["user_id"] == "dev-omer"
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ha.action' AND decision = 'denied' AND reason = 'grant_required'").fetchone()[0] == 1
