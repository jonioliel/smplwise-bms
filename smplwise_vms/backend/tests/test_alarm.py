"""CR-010 (אבטחה › אזעקה): alarm discovery and zone ↔ bypass pairing (Risco exact, PAI / Visonic / PIMA / Alarmo best
effort), the permission matrix and scope, arm / disarm / bypass through the bridge, the code policy (stored panel code,
personal PINs, no_code / code_required, remote channel), lockout and rate limits, the write-only panel code, and the
rule that no code ever reaches a log, an audit row, an API response, an error or the database in clear.

No Home Assistant is contacted: states and registries are the fixtures of tests/fake_alarm.py, the bridge is a fake
that verifies the signature and records what it would send."""
from __future__ import annotations

import json
import logging
import os
import sqlite3
from dataclasses import replace
from pathlib import Path

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

import fake_alarm
from smplwise.auth import current_principal
from smplwise.rbac import ROLES, Principal
from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE
from smplwise.services import alarm as svc
from smplwise.services import alarm_codes as codes
from smplwise.services import ha_bridge, ha_client, ha_sync

ROOT = Path(__file__).resolve().parents[3]
BOSS = {"X-SW-Dev-User": "boss"}  # a second system administrator: an admin's own policy / first PIN are set by another (review M3)
CODE = "92461385"  # the panel code of these tests: grep for it everywhere it must never appear
PIN = "58302719"  # 8 digits: a chance match inside the database files is negligible


def _exp() -> str:
    import datetime as dt

    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=60)).strftime("%Y-%m-%dT%H:%M:%SZ")


_n = [0]


def _rid() -> str:
    _n[0] += 1
    return f"alarm-req-{_n[0]}"


@pytest.fixture(autouse=True)
def _fresh_limits():
    from smplwise.routers import alarm as alarm_router

    codes.LOCKOUT.reset()
    alarm_router._PASS_THROUGH.clear()
    yield
    codes.LOCKOUT.reset()
    alarm_router._PASS_THROUGH.clear()


@pytest.fixture()
def alarm_app(settings, monkeypatch):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    reg, devs, states = fake_alarm.everything()
    monkeypatch.setattr(ha_client, "get_states", lambda _s: states)
    from smplwise.main import create_app

    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    with app.state.db.connection() as conn:
        ha_sync.apply_registry(conn, ha_client.registry_maps(reg, devs, fake_alarm.AREAS, fake_alarm.FLOORS))
        ha_sync.apply_structure(conn, fake_alarm.AREAS, fake_alarm.FLOORS)
    c = TestClient(app)
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.2.6"}))
    calls: list[dict] = []
    answer: dict = {"ok": True, "context_id": "ctx"}

    def fake_execute(_settings, payload, timeout=15.0):
        ha_bridge.verify(secret, payload)
        calls.append(payload)
        return dict(answer)

    monkeypatch.setattr(ha_client, "call_bridge_execute", fake_execute)
    bind(c, s, "boss", "system_admin", "installation", "*")
    return app, s, c, calls, answer


def _panels(c, headers=None) -> dict:
    r = c.get("/api/v1/alarm/panels", headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()


def _panel(body: dict, eid: str) -> dict:
    return next(p for p in body["panels"] if p["entity_id"] == eid)


def _act(c, eid: str, action: str, headers=None, **kw):
    body = {"action": action, "client_request_id": _rid(), "expires_at": _exp(), **kw}
    return c.post(f"/api/v1/alarm/panels/{eid}/actions", json=body, headers=headers or {})


def _bypass(c, zone: str, on: bool, headers=None, **kw):
    body = {"bypassed": on, "client_request_id": _rid(), "expires_at": _exp(), **kw}
    return c.post(f"/api/v1/alarm/zones/{zone}/bypass", json=body, headers=headers or {})


def _no_code(c, user_id: str = "dev-joni") -> None:
    assert c.put(f"/api/v1/alarm/users/{user_id}/policy", json={"arm_policy": "no_code", "disarm_policy": "no_code"}, headers=BOSS).status_code == 200


def _as_remote(app, user_id: str = "dev-joni", username: str = "joni") -> None:
    app.dependency_overrides[current_principal] = lambda: Principal(user_id=user_id, username=username, display_name=username, source="remote", via="cookie")


# ---------------------------------------------------------------- permissions registered

def test_permissions_registered_and_default_roles():
    for p in ("alarm.view", "alarm.arm", "alarm.disarm", "alarm.bypass"):
        assert PERMISSION_LABELS[p]
    expect = {
        "viewer": {"alarm.view"}, "editor": {"alarm.view"}, "kiosk": set(), "operator": {"alarm.view", "alarm.arm"},
        "site_admin": {"alarm.view", "alarm.arm", "alarm.disarm", "alarm.bypass"}, "system_admin": {"alarm.view", "alarm.arm", "alarm.disarm", "alarm.bypass"},
    }
    for role, perms in expect.items():
        assert {p for p in ROLES[role] if p.startswith("alarm.")} == perms, role
    assert "alarm.disarm" in SENSITIVE and "alarm.bypass" in SENSITIVE and "alarm.arm" not in SENSITIVE
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    for role in contract["roles"]:
        assert {p for p in role["permissions"] if p.startswith("alarm.")} == expect[role["id"]], role["id"]


# ---------------------------------------------------------------- discovery: Risco (exact)

def test_risco_two_partitions_eight_zones_exact_pairing(alarm_app):
    app, s, c, calls, _ = alarm_app
    body = _panels(c)
    house, garden = _panel(body, "alarm_control_panel.risco_house"), _panel(body, "alarm_control_panel.risco_garden")
    assert house["integration"] == "Risco" and house["platform"] == "risco"
    assert house["arm_modes"] == ["arm_home", "arm_away", "arm_night"] and garden["arm_modes"] == ["arm_home", "arm_away"]
    assert house["needs_code_disarm"] is True and house["needs_code_arm"] is False  # code_format number, code_arm_required false
    for p in (house, garden):
        ids = [z["entity_id"] for z in p["zones"]]
        assert sorted(ids) == sorted(f"binary_sensor.{oid}" for _, oid, *_ in fake_alarm.RISCO_ZONES)  # 8 zones, no aux, no diagnostic
        for z in p["zones"]:
            assert z["shared"] is True  # two partitions of one system: shared until an administrator assigns a zone
            assert z["bypass"]["entity_id"] == z["entity_id"].replace("binary_sensor.", "switch.") + "_bypassed"
            assert z["bypass"]["strategy"] == "device"
            assert z["kind"] == "zone"  # Risco reports "motion" for every zone
            assert set(z["aux"]) == {z["entity_id"] + "_alarmed", z["entity_id"] + "_armed"}
        assert p["unpaired_controls"] == []
    kitchen_window = next(z for z in house["zones"] if z["entity_id"] == "binary_sensor.kitchen_window")
    assert kitchen_window["bypassed"] is True and kitchen_window["zone_number"] == 4
    # ready to arm: the open back door (zone 2) blocks; the bypassed kitchen window does not
    assert house["ready"] == {"ready": False, "open": ["binary_sensor.back_door"], "faults": []}
    assert body["counts"]["zones"] == 11  # 8 Risco + 3 PAI


def test_risco_pairs_by_zone_id_without_devices_and_never_by_name():
    """Without device ids the unique id's system + zone number still pairs exactly; a look-alike switch of another
    zone number (or with no Risco unique id) is never taken by name."""
    reg, _devs, states = fake_alarm.risco()
    ents = _entities(reg, states, drop_devices=True)
    ents.append({**_ent("switch.front_door_bypass_copy", "risco", fake_alarm.RISCO_ENTRY, None, "unrelated-uid-bypass", state="off")})
    disc = svc.discover(None, ents, {})  # type: ignore[arg-type]
    z = next(z for z in disc["panels"][0]["zones"] if z["entity_id"] == "binary_sensor.front_door")
    assert z["bypass"]["entity_id"] == "switch.front_door_bypassed" and z["bypass"]["strategy"] == "zone_id"
    assert [u["entity_id"] for u in disc["panels"][0]["unpaired_controls"]] == ["switch.front_door_bypass_copy"]


# ---------------------------------------------------------------- discovery: other shapes

def _ent(eid: str, platform: str, entry: str | None, device: str | None, unique: str | None, state: str = "off", **attrs) -> dict:
    return {"entity_id": eid, "domain": eid.split(".")[0], "platform": platform, "config_entry_id": entry, "device_id": device, "unique_id": unique, "name": attrs.pop("name", ""),
            "original_name": None, "state": state, "attributes": attrs, "available": state != "unavailable", "fresh": True, "device_class": attrs.get("device_class"),
            "supported_features": attrs.get("supported_features", 0), "area_id": None, "area_name": None, "entity_category": attrs.pop("entity_category", None), "last_changed": fake_alarm.T0}


def _entities(reg, states, drop_devices=False) -> list[dict]:
    by = {s["entity_id"]: s for s in states}
    out = []
    for r in reg:
        st = by.get(r["entity_id"], {"state": "off", "attributes": {}})
        e = _ent(r["entity_id"], r["platform"], r["config_entry_id"], None if drop_devices else r["device_id"], r["unique_id"], st["state"], **dict(st["attributes"]))
        e["entity_category"] = r.get("entity_category")
        out.append(e)
    return out


def test_pai_pairs_by_stem_and_lists_the_unpaired_switch():
    reg, _d, states = fake_alarm.pai()
    disc = svc.discover(None, _entities(reg, states), {})  # type: ignore[arg-type]
    p = disc["panels"][0]
    assert p["integration"].startswith("MQTT") and p["needs_code_disarm"] is False
    zones = {z["entity_id"]: z for z in p["zones"]}
    assert set(zones) == {f"binary_sensor.paradox_zone_{o}_open" for o, *_ in fake_alarm.PAI_ZONES}  # tamper sensors attach
    fd = zones["binary_sensor.paradox_zone_front_door_open"]
    assert fd["bypass"]["entity_id"] == "switch.paradox_zone_front_door_bypassed" and fd["bypass"]["strategy"] == "entity_id"
    assert fd["aux"] == ["binary_sensor.paradox_zone_front_door_tamper"] and fd["kind"] == "opening"
    assert [u["entity_id"] for u in p["unpaired_controls"]] == ["switch.paradox_zone_shed_bypassed"]


def test_visonic_select_pima_zone_number_and_alarmo_override():
    ents = [
        _ent("alarm_control_panel.visonic_alarm", "visonic", "ce-v", "dev-v", "visonic_panel", "disarmed", supported_features=3, code_format="number"),
        _ent("binary_sensor.visonic_z01_zone", "visonic", "ce-v", "dev-vz1", "visonic_z01_sensor", "off", device_class="door"),
        _ent("select.visonic_z01_arm_mode", "visonic", "ce-v", "dev-vz1", "visonic_z01_select", "bypass", options=["bypass", "armed"]),
        _ent("alarm_control_panel.pima_force", "pima_force", "ce-p", "dev-p", "pima_p1", "armed_away", supported_features=3),
        _ent("binary_sensor.knysh_rshyt", "pima_force", "ce-p", "dev-p", "pima-sensor-3", "off", zone=3, name="כניסה ראשית"),
        _ent("binary_sensor.mtbkh", "pima_force", "ce-p", "dev-p", "pima-sensor-5", "off", zone=5, name="מטבח"),
        _ent("switch.zone_3_bypass", "pima_force", "ce-p", "dev-p", "pima-bypass-3", "on"),
        _ent("alarm_control_panel.alarmo", "alarmo", "ce-a", None, "alarmo", "armed_home", supported_features=3, bypassed_sensors=["binary_sensor.cr_hall"]),
        _ent("binary_sensor.cr_hall", "zha", "ce-z", "dev-z", "zha_hall", "on", device_class="motion"),
        _ent("binary_sensor.cr_door", "zha", "ce-z", "dev-z2", "zha_door", "off", device_class="door"),
    ]
    disc = svc.discover(None, ents, {"binary_sensor.cr_door": {"zone_entity_id": "binary_sensor.cr_door", "panel_entity_id": "alarm_control_panel.alarmo", "bypass_entity_id": None, "excluded": 0}})  # type: ignore[arg-type]
    by = {p["entity_id"]: p for p in disc["panels"]}
    v = by["alarm_control_panel.visonic_alarm"]["zones"][0]
    assert v["bypass"]["domain"] == "select" and v["bypass"]["on_option"] == "bypass" and v["bypass"]["off_option"] == "armed" and v["bypassed"] is True
    pz = {z["entity_id"]: z for z in by["alarm_control_panel.pima_force"]["zones"]}
    assert pz["binary_sensor.knysh_rshyt"]["bypass"]["entity_id"] == "switch.zone_3_bypass" and pz["binary_sensor.knysh_rshyt"]["bypass"]["strategy"] == "zone_number"
    assert pz["binary_sensor.mtbkh"]["bypass"] is None
    al = {z["entity_id"]: z for z in by["alarm_control_panel.alarmo"]["zones"]}
    assert set(al) == {"binary_sensor.cr_hall", "binary_sensor.cr_door"}  # named by the panel + assigned by hand
    assert al["binary_sensor.cr_hall"]["bypassed"] is True and al["binary_sensor.cr_door"]["bypass"] is None


def test_stem_and_markers():
    assert svc.stem("front_door_bypassed") == "front_door" and svc.stem("bypass_front_door") == "front_door"
    assert svc.stem("visonic_z01_arm_mode") == svc.stem("visonic_z01_zone") == "visonic_z01"
    assert svc.stem("zone") == "zone"  # never strips to nothing
    assert svc.marker_of("binary_sensor.a_low_battery") == "battery" and svc.marker_of("binary_sensor.a_tamper") == "tamper"
    assert svc.marker_of("binary_sensor.a", "tamper") == "tamper" and svc.marker_of("binary_sensor.front_door") is None
    assert svc.risco_zone_key({"unique_id": "abc_zone_12_local_bypassed"}) == ("abc", 12, True) and svc.risco_zone_key({"unique_id": "u_zone_3"}) == ("u", 3, False)


# ---------------------------------------------------------------- overrides (Settings)

def test_overrides_pair_exclude_and_reset_are_audited(alarm_app):
    app, s, c, calls, _ = alarm_app
    cfg = c.get("/api/v1/alarm/config").json()
    assert any(p["entity_id"] == "alarm_control_panel.risco_house" for p in cfg["panels"]) and cfg["integrations"]["risco"]["verified"] is True
    r = c.put("/api/v1/alarm/overrides/binary_sensor.front_door", json={"bypass_entity_id": ""})  # "no bypass"
    assert r.status_code == 200, r.text
    r = c.put("/api/v1/alarm/overrides/binary_sensor.smoke_detector", json={"excluded": True})
    assert r.status_code == 200
    r = c.put("/api/v1/alarm/overrides/binary_sensor.bedroom_window", json={"panel_entity_id": "alarm_control_panel.risco_house"})
    assert r.status_code == 200
    body = _panels(c)
    house, garden = _panel(body, "alarm_control_panel.risco_house"), _panel(body, "alarm_control_panel.risco_garden")
    fd = next(z for z in house["zones"] if z["entity_id"] == "binary_sensor.front_door")
    assert fd["bypass"] is None
    assert "switch.front_door_bypassed" in [u["entity_id"] for u in house["unpaired_controls"]]  # nothing hidden
    assert "binary_sensor.smoke_detector" not in [z["entity_id"] for z in house["zones"]]
    bw = next(z for z in house["zones"] if z["entity_id"] == "binary_sensor.bedroom_window")
    assert bw["shared"] is False and "binary_sensor.bedroom_window" not in [z["entity_id"] for z in garden["zones"]]
    assert c.put("/api/v1/alarm/overrides/switch.front_door_bypassed", json={}).status_code == 404  # zones are binary sensors
    assert c.put("/api/v1/alarm/overrides/binary_sensor.front_door", json={"bypass_entity_id": "binary_sensor.back_door"}).status_code == 422
    assert c.delete("/api/v1/alarm/overrides/binary_sensor.front_door").status_code == 200
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'alarm.mapping' AND decision = 'allowed'").fetchone()[0] == 4
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'alarm.mapping' AND decision = 'denied'").fetchone()[0] == 2
    # configuration needs system.configure
    bind(c, s, "omer", "operator", "installation", "*")
    assert c.get("/api/v1/alarm/config", headers=as_user("omer")).status_code == 403
    assert c.put("/api/v1/alarm/overrides/binary_sensor.front_door", json={}, headers=as_user("omer")).status_code == 403


# ---------------------------------------------------------------- permissions and scope

def test_permission_matrix(alarm_app):
    app, s, c, calls, _ = alarm_app
    _set_code(c)  # a stored panel code: no_code users disarm without typing one
    for u, role in (("vera", "viewer"), ("omer", "operator"), ("edna", "editor"), ("kira", "kiosk"), ("sara", "site_admin")):
        bind(c, s, u, role, "installation", "*")
        _no_code(c, f"dev-{u}")
    h = as_user
    assert c.get("/api/v1/alarm/panels", headers=h("kira")).status_code == 403
    for u in ("vera", "edna"):
        p = _panel(_panels(c, h(u)), "alarm_control_panel.risco_house")
        assert p["can"] == {"arm": False, "disarm": False, "bypass": False, "restore": False}
        assert _act(c, "alarm_control_panel.risco_house", "arm_away", h(u)).status_code == 403
    p = _panel(_panels(c, h("omer")), "alarm_control_panel.risco_house")
    assert p["can"]["arm"] is True and p["can"]["disarm"] is False and p["can"]["bypass"] is False
    assert _act(c, "alarm_control_panel.risco_house", "arm_away", h("omer")).status_code == 202
    assert _act(c, "alarm_control_panel.risco_house", "disarm", h("omer"), confirmed=True).status_code == 403
    assert _bypass(c, "binary_sensor.front_door", True, h("omer"), confirmed=True).status_code == 403
    assert _act(c, "alarm_control_panel.risco_house", "disarm", h("sara"), confirmed=True).status_code == 202
    assert _bypass(c, "binary_sensor.front_door", True, h("sara"), confirmed=True).status_code == 202
    with app.state.db.connection() as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE decision = 'denied' AND action LIKE 'alarm.%'").fetchone()[0]
    assert denied >= 5
    # trigger is never offered
    assert _act(c, "alarm_control_panel.risco_house", "trigger", h("sara")).status_code == 422
    assert "alarm_control_panel.alarm_trigger" not in ha_bridge.ACTIONS


def test_floor_scope_follows_placement(alarm_app):
    app, s, c, calls, _ = alarm_app
    ids = seed_tree(c)
    f2 = ids["floor2"]
    asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    assert c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "ha_entity", "resource_id": "alarm_control_panel.risco_garden", "x": 0.3, "y": 0.3}).status_code == 201
    bind(c, s, "fay", "operator", "floor", f2)
    _no_code(c, "dev-fay")
    body = _panels(c, as_user("fay"))
    assert [p["entity_id"] for p in body["panels"]] == ["alarm_control_panel.risco_garden"]
    assert _act(c, "alarm_control_panel.risco_house", "arm_away", as_user("fay")).status_code == 404
    assert _act(c, "alarm_control_panel.risco_garden", "arm_away", as_user("fay")).status_code == 202


# ---------------------------------------------------------------- actions through the bridge

def test_arm_needs_no_confirmation_disarm_and_bypass_do(alarm_app):
    app, s, c, calls, _ = alarm_app
    _no_code(c)
    r = _act(c, "alarm_control_panel.risco_house", "arm_night")
    assert r.status_code == 202 and r.json()["expected_state"] == "armed_night", r.text
    assert calls[-1]["domain"] == "alarm_control_panel" and calls[-1]["service"] == "alarm_arm_night" and "code" not in calls[-1]["data"]
    assert _act(c, "alarm_control_panel.risco_garden", "arm_night").status_code == 422  # the garden partition has no night mode
    assert _act(c, "alarm_control_panel.risco_house", "disarm").json()["code"] == "confirmation_required"
    assert _bypass(c, "binary_sensor.back_door", True).json()["code"] == "confirmation_required"
    r = _bypass(c, "binary_sensor.back_door", True, confirmed=True)
    assert r.status_code == 202 and calls[-1]["domain"] == "switch" and calls[-1]["service"] == "turn_on" and calls[-1]["data"] == {"entity_id": "switch.back_door_bypassed"}
    r = _bypass(c, "binary_sensor.kitchen_window", False, confirmed=True)
    assert r.status_code == 202 and calls[-1]["service"] == "turn_off"
    # idempotent: a repeated click with the same request id sends nothing twice
    rid = _rid()
    n = len(calls)
    for _ in range(2):
        assert c.post("/api/v1/alarm/panels/alarm_control_panel.risco_house/actions", json={"action": "arm_away", "client_request_id": rid, "expires_at": _exp()}).status_code == 202
    assert len(calls) == n + 1
    # the confirmation poll is the existing one; "arming" (an exit delay) counts as accepted
    aid = r.json()["id"]
    assert c.get(f"/api/v1/ha/actions/{aid}").status_code == 200
    # unknown zone, a zone with no bypass control
    assert _bypass(c, "binary_sensor.nope", True, confirmed=True).status_code == 404
    c.put("/api/v1/alarm/overrides/binary_sensor.front_door", json={"bypass_entity_id": ""})
    assert _bypass(c, "binary_sensor.front_door", True, confirmed=True).json()["code"] == "no_bypass_control"


def test_bypass_select_shape_uses_its_options(alarm_app):
    app, s, c, calls, _ = alarm_app
    _no_code(c)
    with app.state.db.connection() as conn:
        for st in ({"entity_id": "select.back_door_arm_mode", "state": "armed", "attributes": {"options": ["bypass", "armed"], "friendly_name": "x"}},):
            ha_sync.upsert_state(conn, st)
        conn.execute("UPDATE ha_entities SET platform = 'risco', config_entry_id = ? WHERE entity_id = 'select.back_door_arm_mode'", (fake_alarm.RISCO_ENTRY,))
    assert c.put("/api/v1/alarm/overrides/binary_sensor.back_door", json={"bypass_entity_id": "select.back_door_arm_mode"}).status_code == 200
    r = _bypass(c, "binary_sensor.back_door", True, confirmed=True)
    assert r.status_code == 202 and calls[-1]["service"] == "select_option" and calls[-1]["data"]["option"] == "bypass"


# ---------------------------------------------------------------- the code policy

def _set_code(c, eid="alarm_control_panel.risco_house", code=CODE):
    r = c.put(f"/api/v1/alarm/panels/{eid}/code", json={"code": code})
    assert r.status_code == 200, r.text
    return r.json()


def test_panel_code_is_write_only_encrypted_and_key_file_is_private(alarm_app):
    app, s, c, calls, _ = alarm_app
    out = _set_code(c)
    assert out == {"panel_code": {"set": True, "set_at": out["panel_code"]["set_at"], "set_by": "joni"}}
    kp = codes.key_path(s)
    assert kp.is_file() and len(kp.read_bytes()) == 32
    if os.name == "posix":
        assert (kp.stat().st_mode & 0o777) == 0o600
    cfg = c.get("/api/v1/alarm/config").json()
    assert _panel(cfg, "alarm_control_panel.risco_house")["panel_code"]["set"] is True
    with app.state.db.connection() as conn:
        blob = conn.execute("SELECT ciphertext FROM alarm_panel_codes").fetchone()[0]
        assert CODE not in blob and codes.decrypt(s, "alarm_control_panel.risco_house", blob) == CODE
        with pytest.raises(codes.CodeError):
            codes.decrypt(s, "alarm_control_panel.risco_garden", blob)  # bound to its panel
    assert c.put("/api/v1/alarm/panels/alarm_control_panel.risco_house/code", json={"code": "12ab"}).status_code == 422  # number format
    assert c.delete("/api/v1/alarm/panels/alarm_control_panel.risco_house/code").json()["panel_code"]["set"] is False
    bind(c, s, "sara", "site_admin", "installation", "*")
    assert c.put("/api/v1/alarm/panels/alarm_control_panel.risco_house/code", json={"code": CODE}, headers=as_user("sara")).status_code == 403


def test_code_plan_matrix():
    panel = {"needs_code_arm": False, "needs_code_disarm": True}
    no, req = {"arm_policy": "no_code", "disarm_policy": "no_code", "pin_set": True}, {"arm_policy": "code_required", "disarm_policy": "code_required", "pin_set": True}
    plan = codes.code_plan
    # no_code: nothing to type; the stored code goes where the panel needs it
    assert plan(action="disarm", panel=panel, user_policy=no, mode="personal_pin", stored=True, remote=False, remote_codeless=True) == {"prompt": "none", "send": "stored"}
    assert plan(action="arm", panel=panel, user_policy=no, mode="personal_pin", stored=True, remote=False, remote_codeless=True) == {"prompt": "none", "send": "none"}
    assert plan(action="disarm", panel=panel, user_policy=no, mode="personal_pin", stored=False, remote=False, remote_codeless=True) == {"prompt": "panel", "send": "typed"}
    # remote: codeless only while alarm.remote_codeless is on
    assert plan(action="disarm", panel=panel, user_policy=no, mode="personal_pin", stored=True, remote=True, remote_codeless=True)["prompt"] == "none"
    assert plan(action="disarm", panel=panel, user_policy=no, mode="personal_pin", stored=True, remote=True, remote_codeless=False)["prompt"] == "pin"
    # code_required: the PIN (personal_pin) or the stored panel code (panel_code)
    assert plan(action="disarm", panel=panel, user_policy=req, mode="personal_pin", stored=True, remote=False, remote_codeless=True) == {"prompt": "pin", "send": "stored"}
    assert plan(action="disarm", panel=panel, user_policy=req, mode="panel_code", stored=True, remote=False, remote_codeless=True) == {"prompt": "panel", "send": "stored"}
    assert plan(action="arm", panel=panel, user_policy={**req, "pin_set": False}, mode="personal_pin", stored=True, remote=False, remote_codeless=True)["prompt"] == "pin_missing"
    assert plan(action="arm", panel=panel, user_policy=req, mode="panel_code", stored=False, remote=False, remote_codeless=True)["prompt"] == "unverifiable"
    assert plan(action="disarm", panel=panel, user_policy=req, mode="personal_pin", stored=False, remote=False, remote_codeless=True) == {"prompt": "panel", "send": "typed"}
    # arm vs disarm are separate policies; bypass follows disarm and never sends a code
    mixed = {"arm_policy": "no_code", "disarm_policy": "code_required", "pin_set": True}
    assert plan(action="arm", panel=panel, user_policy=mixed, mode="personal_pin", stored=True, remote=False, remote_codeless=True)["prompt"] == "none"
    assert plan(action="disarm", panel=panel, user_policy=mixed, mode="personal_pin", stored=True, remote=False, remote_codeless=True)["prompt"] == "pin"
    assert plan(action="bypass", panel=panel, user_policy=mixed, mode="personal_pin", stored=True, remote=False, remote_codeless=True) == {"prompt": "pin", "send": "none"}


def test_pin_hash_and_the_first_pin_rules(alarm_app):
    """Security review M3: the FIRST PIN is set by an administrator, or by the user after typing a stored panel code
    correctly; changing a PIN needs the current one; an administrator changes their own policy / PIN only with their
    current PIN (or another administrator does it). PIN length: alarm.pin_min_length (default 6)."""
    app, s, c, calls, _ = alarm_app
    h = codes.hash_pin(PIN)
    assert PIN not in h and codes.verify_pin(PIN, h) and not codes.verify_pin("000000", h) and not codes.verify_pin(PIN, None)
    assert codes.hash_pin(PIN) != h  # salted
    bind(c, s, "omer", "operator", "installation", "*")
    o = as_user("omer")
    # no stored panel code: only an administrator can give the first PIN
    r = c.put("/api/v1/alarm/me/pin", json={"pin": PIN}, headers=o)
    assert r.status_code == 409 and r.json()["code"] == "pin_by_admin" and "פנה למנהל המערכת" in r.json()["user_message"]
    _set_code(c)
    assert c.put("/api/v1/alarm/me/pin", json={"pin": PIN, "panel_code": "11111111"}, headers=o).json()["code"] == "wrong_code"
    assert c.put("/api/v1/alarm/me/pin", json={"pin": "1234", "panel_code": CODE}, headers=o).json()["code"] == "invalid_pin"  # 6 by default
    assert c.put("/api/v1/alarm/me/pin", json={"pin": PIN, "panel_code": CODE}, headers=o).status_code == 200
    assert c.put("/api/v1/alarm/me/pin", json={"pin": "55555555"}, headers=o).status_code == 403  # changing needs the current PIN
    assert c.put("/api/v1/alarm/me/pin", json={"pin": "55555555", "current_pin": PIN}, headers=o).status_code == 200
    me = c.get("/api/v1/alarm/me", headers=o).json()
    assert me["pin_set"] is True and me["code_mode"] == "personal_pin" and me["disarm_policy"] == "code_required"
    assert "55555555" not in json.dumps(me)
    assert c.patch("/api/v1/settings", json={"alarm.pin_min_length": "4"}, headers=BOSS).status_code == 200
    assert c.put("/api/v1/alarm/me/pin", json={"pin": "4321", "current_pin": "55555555"}, headers=o).status_code == 200
    # an administrator's own policy / PIN: another administrator, or their current PIN
    assert c.put("/api/v1/alarm/users/dev-joni/policy", json={"arm_policy": "no_code"}).json()["code"] == "own_change_by_other_admin"
    assert c.put("/api/v1/alarm/users/dev-joni/pin", json={"pin": PIN}).json()["code"] == "own_change_by_other_admin"
    assert c.put("/api/v1/alarm/users/dev-joni/pin", json={"pin": PIN}, headers=BOSS).status_code == 200
    assert c.put("/api/v1/alarm/users/dev-joni/policy", json={"arm_policy": "no_code"}).json()["code"] == "wrong_code"
    assert c.put("/api/v1/alarm/users/dev-joni/policy", json={"arm_policy": "no_code", "current_pin": PIN}).status_code == 200
    assert c.delete("/api/v1/alarm/users/dev-joni/pin").json()["code"] == "own_pin_by_other_admin"
    assert c.delete("/api/v1/alarm/users/dev-nobody/pin", headers=BOSS).status_code == 404
    # a code_required user without a PIN is told whom to ask
    bind(c, s, "fay", "operator", "installation", "*")
    r = _act(c, "alarm_control_panel.risco_house", "arm_away", as_user("fay"))
    assert r.status_code == 409 and r.json()["code"] == "pin_not_set" and "פנה למנהל המערכת" in r.json()["user_message"]
    with app.state.db.connection() as conn:
        hows = [json.loads(d)["pin"] for (d,) in conn.execute("SELECT details_json FROM audit_log WHERE action = 'alarm.pin' AND decision = 'allowed'").fetchall()]
    assert hows.count("first_by_panel_code") == 1 and hows.count("changed") == 2

def test_code_required_with_pin_sends_the_stored_code(alarm_app, caplog):
    app, s, c, calls, _ = alarm_app
    caplog.set_level(logging.DEBUG)
    _set_code(c)
    c.put("/api/v1/alarm/users/dev-joni/pin", json={"pin": PIN}, headers=BOSS)
    p = _panel(_panels(c), "alarm_control_panel.risco_house")
    assert p["code"] == {"arm": "pin", "disarm": "pin", "bypass": "pin"} and p["panel_code_set"] is True
    assert _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True).json()["code"] == "code_required"
    r = _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code=PIN)
    assert r.status_code == 202, r.text
    assert calls[-1]["data"] == {"entity_id": "alarm_control_panel.risco_house", "code": CODE}  # the panel's own code went to the panel
    # arming: the panel needs no code to arm, so nothing is sent even though the PIN was checked
    r = _act(c, "alarm_control_panel.risco_house", "arm_away", code=PIN)
    assert r.status_code == 202 and "code" not in calls[-1]["data"]
    _assert_code_nowhere(app, s, caplog, [r.text])


def test_panel_code_mode_compares_with_the_stored_code(alarm_app):
    app, s, c, calls, _ = alarm_app
    _set_code(c)
    assert c.patch("/api/v1/settings", json={"alarm.code_mode": "panel_code"}).status_code == 200
    assert _panel(_panels(c), "alarm_control_panel.risco_house")["code"]["disarm"] == "panel"
    r = _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code="11111111")
    assert r.status_code == 403 and r.json()["code"] == "wrong_code" and r.json()["user_message"] == "קוד שגוי."
    assert _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code=CODE).status_code == 202
    assert calls[-1]["data"]["code"] == CODE


def test_no_code_user_sends_the_stored_code_and_the_remote_rules(alarm_app):
    app, s, c, calls, _ = alarm_app
    _set_code(c)
    _no_code(c)
    r = _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True)
    assert r.status_code == 202 and calls[-1]["data"]["code"] == CODE
    # from the remote channel: codeless too while alarm.remote_codeless is on (the default, owner decision)
    _as_remote(app)
    try:
        r = _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True)
        assert r.status_code == 202
        with app.state.db.connection() as conn:
            row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'alarm.disarm' ORDER BY rowid DESC LIMIT 1").fetchone()
        assert json.loads(row[0])["channel"] == "remote"
        app.dependency_overrides.clear()
        assert c.patch("/api/v1/settings", json={"alarm.remote_codeless": "false"}).status_code == 200
        _as_remote(app)
        r = _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True)
        assert r.status_code == 409 and r.json()["details"]["prompt"] in ("pin", "pin_missing")
        app.dependency_overrides.clear()
        assert c.patch("/api/v1/settings", json={"alarm.remote_codeless": "true", "alarm.remote_disarm": "false"}).status_code == 200
        _as_remote(app)
        assert _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True).json()["code"] == "remote_disarm_disabled"
        assert _bypass(c, "binary_sensor.back_door", True, confirmed=True).json()["code"] == "remote_disarm_disabled"
        assert _act(c, "alarm_control_panel.risco_house", "arm_away").status_code == 202  # arming stays allowed
        assert _bypass(c, "binary_sensor.kitchen_window", False, confirmed=True).status_code == 202  # restoring protection too
        app.dependency_overrides.clear()
        assert c.patch("/api/v1/settings", json={"alarm.remote_control": "false"}).status_code == 200
        _as_remote(app)
        assert _act(c, "alarm_control_panel.risco_house", "arm_away").json()["code"] == "remote_control_disabled"
        assert _panel(_panels(c), "alarm_control_panel.risco_house")["can"] == {"arm": False, "disarm": False, "bypass": False, "restore": False}
    finally:
        app.dependency_overrides.clear()


def test_wrong_pins_lock_out_the_user_only(alarm_app, caplog):
    """Security review M2: in personal_pin mode five wrong PINs lock out that USER only - an arm-only user must not be able
    to lock disarming for everyone. Only failures count."""
    app, s, c, calls, _ = alarm_app
    caplog.set_level(logging.DEBUG)
    _set_code(c)
    c.put("/api/v1/alarm/users/dev-joni/pin", json={"pin": PIN}, headers=BOSS)
    for _ in range(6):  # successes never count toward a lockout
        assert _act(c, "alarm_control_panel.risco_house", "arm_away", code=PIN).status_code == 202
    for i in range(5):
        r = _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code=f"000{i}")
        assert r.status_code == 403 and r.json()["code"] == "wrong_code"
    assert r.json()["details"]["locked_s"] > 0
    r = _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code=PIN)  # even the right PIN, now
    assert r.status_code == 429 and r.json()["code"] == "code_locked"
    # another user on the SAME panel is not locked
    bind(c, s, "sara", "site_admin", "installation", "*")
    c.put("/api/v1/alarm/users/dev-sara/pin", json={"pin": "77777777"}, headers=BOSS)
    assert _act(c, "alarm_control_panel.risco_house", "disarm", as_user("sara"), confirmed=True, code="77777777").status_code == 202
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'alarm.disarm' AND reason = 'wrong_code'").fetchone()[0] == 5
    _assert_code_nowhere(app, s, caplog, [])


def test_panel_code_mode_locks_out_user_and_panel(alarm_app):
    """In panel_code mode a wrong panel code counts against the user AND the panel."""
    app, s, c, calls, _ = alarm_app
    _set_code(c)
    assert c.patch("/api/v1/settings", json={"alarm.code_mode": "panel_code"}).status_code == 200
    for i in range(5):
        assert _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code=f"1111000{i}").json()["code"] == "wrong_code"
    bind(c, s, "sara", "site_admin", "installation", "*")
    assert _act(c, "alarm_control_panel.risco_house", "disarm", as_user("sara"), confirmed=True, code=CODE).json()["code"] == "code_locked"
    _set_code(c, "alarm_control_panel.risco_garden")
    assert _act(c, "alarm_control_panel.risco_garden", "disarm", as_user("sara"), confirmed=True, code=CODE).status_code == 202


def test_pass_through_counts_only_failures(alarm_app, caplog):
    """No stored code: the typed panel code is passed through. The panel's refusal (invalid_code) and an attempt the
    panel never confirmed count as wrong codes (Risco ignores a wrong code silently); confirmed actions never count
    (review M2); a generic ServiceValidationError is not a wrong code (review L3)."""
    app, s, c, calls, answer = alarm_app
    caplog.set_level(logging.DEBUG)
    _no_code(c)
    assert _panel(_panels(c), "alarm_control_panel.risco_house")["code"]["disarm"] == "panel"
    assert _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code="12ab").json()["code"] == "wrong_code"  # number format
    for _ in range(3):
        assert _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code=CODE).status_code == 202
    answer.update(ok=False, error="ServiceValidationError")
    for _ in range(5):
        assert _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code=CODE).json()["code"] == "code_rejected"
    answer.update(ok=False, error="invalid_code")
    for _ in range(5):
        r = _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code=CODE)
        assert r.status_code == 422 and r.json()["code"] == "code_rejected" and CODE not in r.text
    r = _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code=CODE)
    assert r.status_code == 429 and r.json()["code"] == "code_locked"
    _assert_code_nowhere(app, s, caplog, [r.text])


def test_unconfirmed_pass_through_counts_as_a_wrong_code(alarm_app, monkeypatch):
    app, s, c, calls, answer = alarm_app
    from smplwise.routers import alarm as alarm_router
    from smplwise.services import ha_actions

    _no_code(c)
    monkeypatch.setattr(ha_actions, "CONFIRM_WINDOW_S", 0.0)  # the panel never reports the change: "unknown" at once
    for i in range(5):
        r = _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code=CODE)
        assert r.status_code == 202, (i, r.text)
    alarm_router._settle_pass_through  # noqa: B018 - settled on the next typed attempt
    r = _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code=CODE)
    assert r.status_code == 429 and r.json()["code"] == "code_locked"

def test_bridge_failure_text_never_carries_the_code(alarm_app, monkeypatch, caplog):
    app, s, c, calls, _ = alarm_app
    caplog.set_level(logging.DEBUG)
    _set_code(c)
    _no_code(c)
    from smplwise.errors import ApiError

    def failing(_settings, payload, timeout=15.0):
        raise ApiError(503, "bridge_error", f"echo {payload['data'].get('code')}", details={"body": json.dumps(payload)})

    monkeypatch.setattr(ha_client, "call_bridge_execute", failing)
    r = _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True)
    assert r.status_code == 503 and CODE not in r.text and "body" not in r.json()["details"]
    _assert_code_nowhere(app, s, caplog, [r.text])


def test_generic_route_refuses_alarm_owned_entities_whatever_the_permissions(alarm_app):
    """Security review B1 / M1: a zone's bypass switch (Risco), a bypass select (Visonic shape), an unpaired bypass switch
    (PAI) and the panel itself are refused on the general entity route (map cards, devices screens) with 409
    use_alarm_screen, audited - an operator holding ha.entity.control and devices.control included."""
    app, s, c, calls, _ = alarm_app
    bind(c, s, "omer", "operator", "installation", "*")
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "select.back_door_arm_mode", "state": "armed", "attributes": {"options": ["bypass", "armed"], "friendly_name": "x"}})
        conn.execute("UPDATE ha_entities SET platform = 'risco', config_entry_id = ? WHERE entity_id = 'select.back_door_arm_mode'", (fake_alarm.RISCO_ENTRY,))
    body = {"arguments": {}, "expected_state_version": None, "confirmation_grant": "confirmed", "expires_at": "2099-01-01T00:00:00Z"}
    n = len(calls)
    for eid, action in (("switch.back_door_bypassed", "switch.turn_on"), ("switch.paradox_zone_shed_bypassed", "switch.turn_on"),
                        ("select.back_door_arm_mode", "select.select_option"), ("alarm_control_panel.risco_house", "alarm_control_panel.alarm_arm_away"),
                        ("alarm_control_panel.risco_house", "alarm_control_panel.alarm_disarm")):
        args = {"option": "bypass"} if action == "select.select_option" else {}
        for who in ("omer", "joni"):
            r = c.post(f"/api/v1/ha/entities/{eid}/actions", json={**body, "allowed_action_id": action, "arguments": args, "client_request_id": _rid()}, headers=as_user(who))
            assert r.status_code == 409 and r.json()["code"] == "use_alarm_screen", (eid, who, r.text)
    assert len(calls) == n  # nothing reached the bridge
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ha.action' AND reason = 'use_alarm_screen'").fetchone()[0] == 10
    # the catalogue lists them read-only
    d = c.get("/api/v1/ha/entities/switch.back_door_bypassed").json()
    assert d["alarm_managed"] is True and d["actions"] == []
    rows = {r["entity_id"]: r for r in c.get("/api/v1/ha/entities?domain=switch").json()["entities"]}
    assert rows["switch.back_door_bypassed"]["alarm_managed"] is True and rows["switch.back_door_bypassed"]["actions"] == []


def test_bulk_never_reaches_a_bypass_switch_even_marked_bulk_safe(alarm_app):
    app, s, c, calls, _ = alarm_app
    from smplwise.services import device_bulk

    # a PAI bypass switch (no entity category, so the devices area lists it) placed in the kitchen area
    sw = "switch.paradox_zone_front_door_bypassed"
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET area_id = 'alarm_kitchen', area_name = 'מטבח', ha_floor_id = 'alarm_ground', ha_floor_name = 'קרקע' WHERE entity_id = ?", (sw,))
    r = c.put(f"/api/v1/devices/entities/{sw}/bulk-safe", json={"bulk_safe": True})
    assert r.status_code == 409 and r.json()["code"] == "alarm_managed"
    with app.state.db.connection() as conn:  # a mark made before this rule existed
        device_bulk.set_bulk_safe(conn, Principal(user_id="dev-joni", username="joni", display_name="joni", source="dev"), sw, True)
        conn.execute("UPDATE ha_entities SET state = 'on' WHERE entity_id = ?", (sw,))
    p = c.get("/api/v1/devices/actions/preview?scope=area&id=alarm_kitchen&kind=all_off").json()
    assert sw not in [t["entity_id"] for t in p["targets"]]
    ex = {x["entity_id"]: x for x in p["excluded"]}
    assert ex[sw]["reason"] == "alarm_managed"
    with app.state.db.connection() as conn:
        pol = device_bulk.SwitchPolicy(conn)
        assert pol.switch_reason(sw) == (False, "alarm_managed")
        _w, _s, permitted = device_bulk.bulk_scope(conn, Principal(user_id="dev-joni", username="joni", display_name="joni", source="dev"))
        assert not permitted(sw)
    area = c.get("/api/v1/devices/areas/alarm_kitchen").json()
    rows = [r for card in area["cards"].values() for r in card.get("entities", []) if r["entity_id"] == sw]
    assert rows and rows[0]["alarm_managed"] is True and rows[0]["can_control"] is False

def test_user_policy_admin_api(alarm_app):
    app, s, c, calls, _ = alarm_app
    bind(c, s, "omer", "operator", "installation", "*")
    r = c.get("/api/v1/alarm/users/dev-omer")
    assert r.status_code == 200 and r.json()["arm_policy"] == "code_required" and r.json()["pin_set"] is False
    assert c.put("/api/v1/alarm/users/dev-omer/policy", json={"arm_policy": "no_code"}).json()["arm_policy"] == "no_code"
    assert c.put("/api/v1/alarm/users/dev-omer/policy", json={"arm_policy": "whatever"}).status_code == 422
    assert c.put("/api/v1/alarm/users/dev-omer/pin", json={"pin": "1234"}).json()["code"] == "invalid_pin"
    assert c.put("/api/v1/alarm/users/dev-omer/pin", json={"pin": PIN}).json()["pin_set"] is True
    assert c.delete("/api/v1/alarm/users/dev-omer/pin").json()["pin_set"] is False
    assert c.put("/api/v1/alarm/users/dev-omer/policy", json={"arm_policy": "no_code"}, headers=as_user("omer")).status_code == 403
    with app.state.db.connection() as conn:
        rows = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action IN ('alarm.user_policy', 'alarm.pin') AND decision = 'allowed'").fetchall()]
    assert rows.count("alarm.user_policy") == 1 and rows.count("alarm.pin") == 2


def test_code_never_stored_in_clear_logged_or_audited(alarm_app, caplog):
    """The end-to-end sweep: set the panel code, use it every way, then grep the captured log, every audit row, every
    ha_actions row and the raw database files for it."""
    app, s, c, calls, answer = alarm_app
    caplog.set_level(logging.DEBUG)
    _set_code(c)
    c.put("/api/v1/alarm/users/dev-joni/pin", json={"pin": PIN}, headers=BOSS)
    texts = [
        _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code=PIN).text,
        _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True, code="1" * 8).text,
        _bypass(c, "binary_sensor.back_door", True, confirmed=True, code=PIN).text,
        c.get("/api/v1/alarm/config").text,
        c.get("/api/v1/alarm/panels").text,
    ]
    assert calls and any(p["data"].get("code") == CODE for p in calls)
    _assert_code_nowhere(app, s, caplog, texts)


def _assert_code_nowhere(app, s, caplog, texts: list[str]) -> None:
    for t in texts:
        assert CODE not in t and PIN not in t
    assert CODE not in caplog.text and PIN not in caplog.text
    with app.state.db.connection() as conn:
        for (details,) in conn.execute("SELECT details_json FROM audit_log").fetchall():
            assert CODE not in (details or "") and PIN not in (details or "")
        for row in conn.execute("SELECT * FROM ha_actions").fetchall():
            assert CODE not in json.dumps(dict(row)) and PIN not in json.dumps(dict(row))
    # the raw database files, the write-ahead log included
    for f in Path(s.db_path).parent.glob(Path(s.db_path).name + "*"):
        raw = f.read_bytes()
        assert CODE.encode() not in raw and PIN.encode() not in raw, f.name


def test_lockout_units():
    lo = codes.Lockout(limit=2, window_s=10, lock_s=30)
    assert lo.fail(["u", "p"], now=0) == 0 and lo.fail(["u", "p"], now=1) > 0
    assert lo.locked_for(["p"], now=20) > 0 and lo.locked_for(["p"], now=40) == 0


def test_key_file_is_written_byte_exact(tmp_path, settings):
    """Regression: a text-mode descriptor on Windows turned a 0x0A byte of the random key into CR LF (33 bytes), and the
    stored code became unreadable at random. Forty fresh keys: every one must round-trip."""
    for i in range(40):
        s = replace(settings, data_dir=tmp_path / f"d{i}")
        blob = codes.encrypt(s, "alarm_control_panel.x", CODE)
        assert len(codes.key_path(s).read_bytes()) == 32
        assert codes.decrypt(s, "alarm_control_panel.x", blob) == CODE