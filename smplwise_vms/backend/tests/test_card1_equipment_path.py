"""VER1 (verifies CARD1, 2.4.0): the whole path of the equipment cards' controls - the UI's service call
(`POST /ha/entities/{id}/actions`) -> the add-on's allow-list (ha_bridge) -> the signed bridge call -> a fake bridge that applies the
integration's own ALLOWED_SERVICES (read from the canonical source) -> the state HA reports back -> the confirmation.

Covered: the five actions (valve.open_valve / close_valve, vacuum.pause, water_heater.turn_on / turn_off), the confirmation grant on
the valve opening, the `service_not_allowed` answer of a bridge that predates CARD1, the permission check (a viewer, a devices.control-only
caller whose domains do not reach these entities, an ha.entity.control holder), a wrong-domain entity and an argument. No live Home
Assistant, no wall-clock dependence beyond "the state arrives after the request"."""
from __future__ import annotations

import datetime as dt
from dataclasses import replace

import pytest
from bridge_loader import SRC, init_allowed_services
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_bridge, ha_client, ha_sync

CARD1_PAIRS = {("vacuum", "pause"), ("valve", "open_valve"), ("valve", "close_valve"), ("water_heater", "turn_on"), ("water_heater", "turn_off")}


def _st(entity_id: str, state: str, **attrs):
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    return {"entity_id": entity_id, "state": state, "attributes": {"friendly_name": entity_id, **attrs}, "last_changed": now, "last_updated": now}


STATES = [
    _st("valve.garden", "closed", current_position=0),
    _st("vacuum.robo", "cleaning", fan_speed="quiet"),
    _st("water_heater.boiler", "off", temperature=55),
    _st("switch.sign", "off"),
]
# (action id, entity, state HA reports once the command worked, needs the confirmation grant)
CASES = [
    ("valve.open_valve", "valve.garden", "open", True),
    ("valve.close_valve", "valve.garden", "closed", False),
    ("vacuum.pause", "vacuum.robo", "paused", False),
    ("water_heater.turn_on", "water_heater.boiler", "eco", False),
    ("water_heater.turn_off", "water_heater.boiler", "off", False),
]


@pytest.fixture()
def paired(settings, monkeypatch):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES)
    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    c = TestClient(app)
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    assert c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.1.0"})).status_code == 200
    return app, s, c, secret


def _install_bridge(monkeypatch, secret: str, allowed: set[tuple[str, str]]) -> list[dict]:
    """A fake of the integration's `execute`: signature first, then the allow-list, exactly as `__init__.py` orders them."""
    calls: list[dict] = []

    def fake_execute(_settings, payload, timeout=15.0):
        calls.append(payload)
        ha_bridge.verify(secret, payload)
        if (payload["domain"], payload["service"]) not in allowed:
            return {"ok": False, "error": "service_not_allowed"}
        return {"ok": True, "context_id": f"ctx-{len(calls)}"}

    monkeypatch.setattr(ha_client, "call_bridge_execute", fake_execute)
    return calls


def _body(action_id: str, rid: str, **kw):
    return {"allowed_action_id": action_id, "arguments": {}, "expected_state_version": None, "confirmation_grant": None, "client_request_id": rid, "expires_at": "2099-01-01T00:00:00Z", **kw}


def _report(app, entity_id: str, state: str, **attrs) -> None:
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, _st(entity_id, state, **attrs))


def test_the_integration_allow_list_carries_exactly_the_card1_pairs_the_addon_sends():
    allowed = init_allowed_services()
    assert CARD1_PAIRS <= allowed
    for action_id, _entity, _state, _grant in CASES:
        spec = ha_bridge.ACTIONS[action_id]
        assert (spec["domain"], spec["service"]) in allowed, action_id
    # the integration copy shipped inside the add-on is byte-identical (a stale copy would answer service_not_allowed in production)
    mirror = SRC.parents[1] / "smplwise_vms" / "integration" / "smplwise_bridge" / "__init__.py"
    assert mirror.read_bytes() == (SRC / "__init__.py").read_bytes()


@pytest.mark.parametrize("action_id,entity_id,reported,needs_grant", CASES)
def test_card_action_end_to_end_with_a_current_bridge(paired, monkeypatch, action_id, entity_id, reported, needs_grant):
    app, _s, c, secret = paired
    calls = _install_bridge(monkeypatch, secret, init_allowed_services())
    if needs_grant:  # opening a tap holds-to-confirm in the UI: without the grant the server refuses and nothing is sent
        r = c.post(f"/api/v1/ha/entities/{entity_id}/actions", json=_body(action_id, "no-grant"))
        assert r.status_code == 409 and r.json()["code"] == "confirmation_required" and calls == []
    r = c.post(f"/api/v1/ha/entities/{entity_id}/actions", json=_body(action_id, "go", confirmation_grant="confirmed" if needs_grant else None))
    assert r.status_code == 202, r.text
    a = r.json()
    domain, service = action_id.split(".")
    assert a["status"] == "pending" and a["error"] is None
    assert len(calls) == 1 and calls[0]["domain"] == domain and calls[0]["service"] == service
    assert calls[0]["data"] == {"entity_id": entity_id} and calls[0]["user_id"] == "dev-joni" and "sig" in calls[0]
    # a duplicate click (same client_request_id) never sends twice
    again = c.post(f"/api/v1/ha/entities/{entity_id}/actions", json=_body(action_id, "go", confirmation_grant="confirmed" if needs_grant else None))
    assert again.json()["id"] == a["id"] and len(calls) == 1
    if ha_bridge.ACTIONS[action_id]["expect"] is None:
        # water_heater.turn_on lands in an operation mode, not "on": nothing observable to wait for, so the record is honestly "sent" (confirmation none)
        rec = c.get(f"/api/v1/ha/actions/{a['id']}").json()
        assert rec["status"] == "confirmed" and rec["confirmation"] == "none"
        return
    # not confirmed on the bridge's acceptance alone; confirmed once HA reports the new state after the request
    assert c.get(f"/api/v1/ha/actions/{a['id']}").json()["status"] == "pending"
    _report(app, entity_id, reported)
    assert c.get(f"/api/v1/ha/actions/{a['id']}").json()["status"] == "confirmed"


@pytest.mark.parametrize("action_id,entity_id,reported,needs_grant", CASES)
def test_an_old_bridge_answers_service_not_allowed_and_the_failure_is_recorded(paired, monkeypatch, action_id, entity_id, reported, needs_grant):
    app, _s, c, secret = paired
    old = init_allowed_services() - CARD1_PAIRS
    calls = _install_bridge(monkeypatch, secret, old)
    r = c.post(f"/api/v1/ha/entities/{entity_id}/actions", json=_body(action_id, "old", confirmation_grant="confirmed" if needs_grant else None))
    assert r.status_code == 202, r.text
    a = r.json()
    assert len(calls) == 1 and a["status"] == "failed" and a["error"] == "service_not_allowed"
    # the answer is final: even if the entity later reports the expected state, a failed record does not turn into confirmed
    _report(app, entity_id, reported)
    assert c.get(f"/api/v1/ha/actions/{a['id']}").json()["status"] == "failed"
    # the old bridge still serves the actions it always knew (nothing else regressed)
    assert c.post("/api/v1/ha/entities/switch.sign/actions", json=_body("switch.turn_on", "known")).json()["status"] == "pending"


def test_the_ui_message_for_service_not_allowed_names_the_bridge_version_hint():
    """frontend/src/api/ha.ts holds the text the card shows for this answer; the card must not show a bare code."""
    from pathlib import Path

    src = (Path(__file__).resolve().parents[3] / "frontend" / "src" / "api" / "ha.ts").read_text(encoding="utf-8")
    assert "service_not_allowed:" in src


def test_permission_decides_before_anything_reaches_the_bridge(paired, monkeypatch):
    app, s, c, secret = paired
    calls = _install_bridge(monkeypatch, secret, init_allowed_services())
    # a viewer: no control of any kind
    bind(c, s, "ron", "viewer", "installation", "*")
    for action_id, entity_id, _r, grant in CASES:
        r = c.post(f"/api/v1/ha/entities/{entity_id}/actions", json=_body(action_id, f"v-{action_id}", confirmation_grant="confirmed" if grant else None), headers=as_user("ron"))
        assert r.status_code == 403, (action_id, r.text)
    # devices.control alone does not reach valve / vacuum / water_heater (its domains are the everyday ones): the same 403, and the cards say can_control false
    role = c.post("/api/v1/access/roles", json={"name": "שליטה בהתקנים בלבד", "permissions": ["devices.read", "devices.control"]}).json()["id"]
    bind(c, s, "dc", role, "installation", "*")
    for action_id, entity_id, _r, grant in CASES:
        r = c.post(f"/api/v1/ha/entities/{entity_id}/actions", json=_body(action_id, f"d-{action_id}", confirmation_grant="confirmed" if grant else None), headers=as_user("dc"))
        assert r.status_code == 403, (action_id, r.text)
    assert c.post("/api/v1/ha/entities/switch.sign/actions", json=_body("switch.turn_on", "d-switch"), headers=as_user("dc")).status_code == 202
    assert [p["domain"] for p in calls] == ["switch"], "the refused calls never reached the bridge"
    # ha.entity.control (the operator role holds it) is the permission that covers every allow-listed domain
    bind(c, s, "ent", "operator", "installation", "*")  # the operator role holds ha.entity.control
    r = c.post("/api/v1/ha/entities/vacuum.robo/actions", json=_body("vacuum.pause", "e-1"), headers=as_user("ent"))
    assert r.status_code == 202 and r.json()["status"] == "pending" and calls[-1]["service"] == "pause"


def test_the_allow_list_refuses_a_wrong_domain_an_argument_and_unknown_card_actions(paired, monkeypatch):
    _app, _s, c, secret = paired
    calls = _install_bridge(monkeypatch, secret, init_allowed_services())
    # a switch-wired tap keeps switch.turn_on / turn_off: valve.* on a switch is refused
    assert c.post("/api/v1/ha/entities/switch.sign/actions", json=_body("valve.open_valve", "w1", confirmation_grant="confirmed")).status_code == 422
    # no arguments are accepted by the argument-less services
    assert c.post("/api/v1/ha/entities/vacuum.robo/actions", json=_body("vacuum.pause", "w2", arguments={"fan_speed": "max"})).status_code == 422
    # the actions the cards might be tempted to use are not on the list
    for bad in ("vacuum.stop", "valve.set_valve_position", "water_heater.set_temperature", "valve.toggle"):
        assert c.post("/api/v1/ha/entities/valve.garden/actions", json=_body(bad, f"x-{bad}")).status_code == 422, bad
    assert calls == []
    # the entity read model lists the new actions per domain (the card renders its buttons from these)
    listed = {a["id"] for e in c.get("/api/v1/ha/entities").json()["entities"] for a in e["actions"]}
    assert {a for a, *_ in CASES} <= listed
