"""CR-BLUEPRINT80 slice 1: the built-in blueprint library, the closed format, parameter validation against the real installation, the forbidden actions (every door,
lock, alarm, siren and cover action), permissions, the module switches, and instantiation == the manual equivalent through the SAME create path.

The pure tests need no app; the route tests use the CR-017 world (tests/automations_fixture.py) with a few extra entities added to the fake Home Assistant."""
from __future__ import annotations

import copy
import json

import pytest

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, NOTIFY, OMER, draft_of, rid, seed_mirror, svc_block, typed_state_trigger
from automations_fixture import grant as _raw_grant
from conftest import seed_tree
from smplwise.routers.access import SENSITIVE as _SENSITIVE
from smplwise.services import automation_blueprints as bps
from smplwise.services import door_path

BP = f"{API}/automation-blueprints"
EDIT = ["automation.manage", "scene.manage", "script.manage"]
READ = ["devices.read", "entity.state.read"]


# ================================================================ pure: the library and the closed format

def test_the_library_is_eight_valid_unique_hebrew_blueprints():
    assert len(bps.LIBRARY) == 8
    assert len({b["id"] for b in bps.LIBRARY}) == 8 and len({b["title"] for b in bps.LIBRARY}) == 8
    for b in bps.LIBRARY:
        assert bps.validate_definition(b) == [], b["id"]
        assert any("֐" <= ch <= "׿" for ch in b["title"] + b["description"]), "Hebrew title and description"
        assert not any(w in json.dumps(b, ensure_ascii=False) for w in ("lock.", "alarm_control_panel", "siren.", "cover.", "script.", "automation.turn")), b["id"]
    assert [b["title"] for b in bps.LIBRARY][:2] == ["כיבוי אורות כשהאזור ריק בלילה", "התראה על דלת או חלון שנשארו פתוחים"]


def _mut(bp_id, fn):
    bp = bps.get(bp_id)
    fn(bp)
    return bps.validate_definition(bp)


@pytest.mark.parametrize("service", ["lock.unlock", "lock.lock", "lock.open", "cover.open_cover", "cover.close_cover", "alarm_control_panel.alarm_disarm", "alarm_control_panel.alarm_arm_away",
                                     "siren.turn_on", "script.turn_on", "automation.trigger", "homeassistant.turn_on", "shell_command.x", "light.open_door", "button.press", "unlock_door"])
def test_a_definition_with_a_forbidden_or_unlisted_service_is_refused(service):
    errs = _mut("motion_light_timer", lambda bp: bp["template"]["actions"].append({"action": service, "target": {"entity_id": [{"$param": "lights"}]}}))
    assert errs and any("service" in e for e in errs), (service, errs)


def test_a_definition_outside_the_closed_format_is_refused():
    assert _mut("motion_light_timer", lambda bp: bp["template"]["triggers"].append({"trigger": "device", "device_id": "x"}))
    assert _mut("motion_light_timer", lambda bp: bp["template"]["triggers"].append({"trigger": "template", "value_template": "{{ 1 }}"}))
    assert _mut("motion_light_timer", lambda bp: bp["template"]["triggers"].append({"trigger": "webhook", "webhook_id": "x"}))
    assert _mut("motion_light_timer", lambda bp: bp["template"]["triggers"][0].update({"unknown": 1}))
    assert _mut("motion_light_timer", lambda bp: bp["template"]["conditions"].append({"condition": "template", "value_template": "x"}))
    assert _mut("motion_light_timer", lambda bp: bp["template"]["actions"].append({"choose": []}))
    assert _mut("motion_light_timer", lambda bp: bp["template"]["actions"].append({"action": "light.turn_off", "target": {"area_id": "x"}}))
    assert _mut("motion_light_timer", lambda bp: bp["template"]["actions"].append({"action": "light.turn_off", "target": {"entity_id": ["light.a"]}, "service_template": "x"}))
    assert _mut("motion_light_timer", lambda bp: bp["parameters"].append(bps.P("extra", "text", "x")))  # a parameter never used
    assert _mut("motion_light_timer", lambda bp: bp["template"]["actions"].append({"action": "light.turn_off", "target": {"entity_id": {"$param": "nope"}}}))  # undeclared
    assert _mut("motion_light_timer", lambda bp: bp["parameters"][1].update({"domains": ["cover"]}))  # a controlled parameter of a forbidden domain
    assert _mut("motion_light_timer", lambda bp: bp["parameters"][1].update({"type": "code"}))
    assert _mut("motion_light_timer", lambda bp: bp.update({"surprise": True}))
    assert _mut("motion_light_timer", lambda bp: bp["template"].update({"variables": {}}))
    # a parameter may stand for the action of a notification step only
    assert _mut("motion_light_timer", lambda bp: bp["template"]["actions"].append({"action": {"$param": "lights"}, "data": {}}))


def test_check_config_is_an_independent_second_line_against_door_actions():
    class E(bps.Env):
        notify_targets = (NOTIFY,)

        def sensitive(self, e):
            return e in {"switch.relay_as_door"}

    env = E()
    bad = [
        {"actions": [{"action": "lock.unlock", "target": {"entity_id": ["lock.front_door"]}}]},
        {"actions": [{"action": "cover.open_cover", "target": {"entity_id": ["cover.driveway_gate"]}}]},
        {"actions": [{"action": "alarm_control_panel.alarm_disarm", "target": {"entity_id": ["alarm_control_panel.home_panel"]}}]},
        {"actions": [{"action": "siren.turn_on", "target": {"entity_id": ["siren.x"]}}]},
        {"actions": [{"action": "notify.someone_else", "data": {"message": "x"}}]},
        {"actions": [{"action": "script.turn_on", "target": {"entity_id": ["script.x"]}}]},
        {"actions": [{"action": "switch.turn_on", "target": {"entity_id": ["switch.relay_as_door"]}}]},
        {"actions": [{"action": "light.turn_on", "target": {"entity_id": ["lock.front_door"]}}]},
        {"actions": [{"service": "light.turn_on"}]},
    ]
    for cfg in bad:
        assert bps.check_config(cfg, env, env.notify_targets), cfg
    ok = {"actions": [{"action": "light.turn_off", "target": {"entity_id": ["light.office"]}}, {"delay": {"hours": 0, "minutes": 1, "seconds": 0}},
                      {"action": NOTIFY, "data": {"message": "x"}}]}
    assert bps.check_config(ok, env, env.notify_targets) == []


# ================================================================ the app world

def _extra_world(app, fake):
    """A few more entities for the blueprints: a door and a window sensor, a leak sensor, a temperature sensor, more lights, a scene."""
    def add(eid, name, area, state, attrs):
        fake.states[eid] = {"entity_id": eid, "state": state, "attributes": {"friendly_name": name, **attrs}, "last_changed": "2026-09-30T10:00:00+00:00", "last_updated": "2026-09-30T10:00:00+00:00"}
        fake.registry.append({"id": f"reg-{eid}", "entity_id": eid, "unique_id": f"u-{eid}", "platform": "generic", "config_entry_id": "ce-generic", "device_id": None, "area_id": area,
                              "entity_category": None, "original_name": name, "name": None, "disabled_by": None, "hidden_by": None})

    add("binary_sensor.front_door_contact", "Front door contact", "sch_yard", "off", {"device_class": "door"})
    add("binary_sensor.living_window", "Living window", "sch_living", "off", {"device_class": "window"})
    add("binary_sensor.laundry_leak", "Laundry leak", "sch_gym", "off", {"device_class": "moisture"})
    add("sensor.living_temperature", "Living temperature", "sch_living", "22", {"device_class": "temperature", "unit_of_measurement": "°C"})
    add("light.hall", "Hall light", "sch_living", "off", {})
    add("light.garden", "Garden light", "sch_yard", "off", {})
    add("scene.evening", "Evening", "sch_living", "unknown", {})
    seed_mirror(app.state.db, fake)


@pytest.fixture()
def bp_app(autos_app):
    app, s, c, fake, tr = autos_app
    _extra_world(app, fake)
    assert c.patch(f"{API}/settings", json={"automations.blueprints_enabled": "true"}).status_code == 200
    return app, s, c, fake, tr


MOTION = "binary_sensor.motion_hall"


def _p_motion_light(**kw):
    return {"motion": [MOTION], "lights": ["light.office"], "brightness": 60, "minutes": 5, **kw}


def _inst(c, bp_id, params, headers=None, **extra):
    return c.post(f"{BP}/{bp_id}/instantiate", json={"params": params, "client_request_id": rid(), **extra}, headers=headers or {})


def _stored(fake, item_id):
    return next(i for i in fake.automations if str(i.get("id")) == item_id)


def _errors(r):
    assert r.status_code == 422, r.text
    return {(e["param"], e["code"]) for e in r.json()["details"]["errors"]}


# ================================================================ switches: default OFF, module off

def test_default_off_then_on_and_the_automations_module_off(autos_app):
    app, s, c, fake, tr = autos_app
    st = c.get(f"{BP}/status").json()
    assert st["module_on"] is True and st["enabled"] is False and st["can_use"] is True and st["count"] == 8 and st["import_export"] is False
    for r in (c.get(BP), c.get(f"{BP}/motion_light_timer"), c.post(f"{BP}/motion_light_timer/preview", json={"params": _p_motion_light()}), _inst(c, "motion_light_timer", _p_motion_light())):
        assert r.status_code == 409 and r.json()["code"] == "blueprints_disabled", r.text
    assert not [b for b in tr.bridge_calls if b["op"] == "upsert"]
    assert c.patch(f"{API}/settings", json={"automations.blueprints_enabled": "true"}).status_code == 200
    assert c.get(BP).status_code == 200
    assert c.patch(f"{API}/settings", json={"automations.enabled": "false"}).status_code == 200
    st = c.get(f"{BP}/status").json()
    assert st["module_on"] is False and st["enabled"] is True
    for r in (c.get(BP), _inst(c, "motion_light_timer", _p_motion_light())):
        assert r.status_code == 409 and r.json()["code"] == "feature_disabled", r.text
    assert not [b for b in tr.bridge_calls if b["op"] == "upsert"]


def test_the_library_route_is_read_only_and_never_shows_the_template(bp_app):
    app, s, c, fake, tr = bp_app
    r = c.get(BP)
    assert r.status_code == 200
    body = r.json()
    assert [b["id"] for b in body["blueprints"]] == [b["id"] for b in bps.LIBRARY] and body["schema"] == 1
    assert all("template" not in b and b["sensitive"] is False and b["builtin"] is True for b in body["blueprints"])
    assert c.get(f"{BP}/motion_light_timer").json()["parameters"][0]["key"] == "motion"
    assert c.get(f"{BP}/nope").status_code == 404 and c.get(f"{BP}/nope").json()["code"] == "blueprint_not_found"
    for method in ("PUT", "DELETE", "PATCH"):
        assert c.request(method, BP).status_code in (404, 405)
    assert c.post(BP, json={}).status_code in (404, 405), "no way to add a blueprint in slice 1"


# ================================================================ preview and instantiate

def test_preview_returns_the_draft_and_writes_nothing(bp_app):
    app, s, c, fake, tr = bp_app
    before = len(fake.automations)
    r = c.post(f"{BP}/motion_light_timer/preview", json={"params": _p_motion_light()})
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["ok"] is True and b["refusal"] is None and b["enabled_on_create"] is False and b["blueprint"] == {"id": "motion_light_timer", "version": 1}
    d = b["draft"]
    assert d["alias"] == "תאורה בתנועה עם כיבוי אוטומטי" and d["mode"] == "restart" and [a.get("action") or a.get("type") for a in d["actions"]] == ["light.turn_on", "delay", "light.turn_off"]
    assert all(blk["raw"] is None for blk in d["triggers"] + d["actions"]) and b["sentence"]
    assert len(fake.automations) == before and not [x for x in tr.bridge_calls if x["op"] == "upsert"]


def test_instantiation_equals_the_manual_equivalent_and_is_created_disabled(bp_app):
    app, s, c, fake, tr = bp_app
    bp = bps.get("motion_light_timer")
    r = _inst(c, "motion_light_timer", _p_motion_light(), name="תאורת פרוזדור מתבנית")
    assert r.status_code == 201, r.text
    item = r.json()["item"]
    assert r.json()["blueprint"] == {"id": "motion_light_timer", "version": 1} and item["name"] == "תאורת פרוזדור מתבנית" and item["state"] == "off" and item["created_via"] == "arx"
    manual = draft_of("תאורת פרוזדור ידנית", triggers=[typed_state_trigger(MOTION, "on")], actions=[
        svc_block("light.turn_on", ["light.office"], {"brightness_pct": 60}, uid="a1"),
        {"uid": "a2", "kind": "typed", "type": "delay", "delay": {"hours": 0, "minutes": 5, "seconds": 0}, "raw": None, "sentence": ""},
        svc_block("light.turn_off", ["light.office"], uid="a3")], mode="restart")
    manual["description"] = bp["description"]
    r2 = c.post(f"{API}/automations/automation", json={"draft": manual, "enabled": False, "client_request_id": rid()})
    assert r2.status_code == 201, r2.text
    a, b = _stored(fake, item["config_id"]), _stored(fake, r2.json()["item"]["config_id"])
    strip = lambda cfg: {k: v for k, v in cfg.items() if k not in ("id", "alias")}  # noqa: E731
    assert strip(a) == strip(b) and a["alias"] != b["alias"]
    assert a["triggers"] == [{"trigger": "state", "entity_id": [MOTION], "to": "on"}] and a["mode"] == "restart"
    calls = [x for x in tr.bridge_calls if x["op"] == "upsert"]
    assert len(calls) == 2 and calls[0]["profile"] == calls[1]["profile"] == "builder" and calls[0]["user_id"] == calls[1]["user_id"]
    assert calls[0]["sensitive"] is False
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'automation.create' AND decision = 'allowed' ORDER BY rowid").fetchall()
    assert json.loads(rows[0]["details_json"])["blueprint"] == {"id": "motion_light_timer", "version": 1} and "blueprint" not in json.loads(rows[1]["details_json"])


def test_instantiation_is_idempotent_and_rate_limited_like_the_editor(bp_app):
    app, s, c, fake, tr = bp_app
    key = rid()
    body = {"params": _p_motion_light(), "client_request_id": key}
    r1, r2 = c.post(f"{BP}/motion_light_timer/instantiate", json=body), c.post(f"{BP}/motion_light_timer/instantiate", json=body)
    assert r1.status_code == 201 and r2.status_code == 201 and r1.json()["item"]["id"] == r2.json()["item"]["id"]
    assert len([x for x in tr.bridge_calls if x["op"] == "upsert"]) == 1


@pytest.mark.parametrize("bp_id,params", [
    ("lights_off_floor_empty_night", {"motion": [MOTION], "lights": ["light.office", "light.hall"], "minutes": 15, "from_time": "22:30", "to_time": "05:45"}),
    ("door_left_open_notify", {"sensors": ["binary_sensor.front_door_contact", "binary_sensor.living_window"], "minutes": 10, "message": "הדלת פתוחה"}),
    ("temperature_out_of_range", {"sensor": "sensor.living_temperature", "low": 18, "high": 28.5}),
    ("scheduled_scene", {"scene": "scene.evening", "at": "19:30", "days": ["sun", "mon", "thu"]}),
    ("motion_light_timer", _p_motion_light()),
    ("water_leak_notify", {"sensors": ["binary_sensor.laundry_leak"]}),
    ("ac_off_window_open", {"windows": ["binary_sensor.living_window"], "climate": ["climate.living_room", "climate.study"], "minutes": 4}),
    ("area_lights_at_sunset", {"area": "sch_living", "offset": -30, "brightness": 50}),
])
def test_every_library_blueprint_instantiates_through_the_create_path(bp_app, bp_id, params):
    app, s, c, fake, tr = bp_app
    prev = c.post(f"{BP}/{bp_id}/preview", json={"params": params})
    assert prev.status_code == 200 and prev.json()["ok"] is True, prev.text
    r = _inst(c, bp_id, params)
    assert r.status_code == 201, r.text
    item = r.json()["item"]
    assert item["state"] == "off" and item["sensitive"] is False and item["locked_count"] == 0
    cfg = _stored(fake, item["config_id"])
    assert json.dumps(cfg, ensure_ascii=False).count("lock.") == 0 and "cover." not in json.dumps(cfg)
    ops_seen = [x["op"] for x in tr.bridge_calls]
    assert ops_seen.count("upsert") == 1 and ops_seen[-1] in ("upsert", "disable"), ops_seen  # created through the bridge, then switched off (created disabled)


def test_sunset_area_blueprint_expands_the_area_to_literal_entities(bp_app):
    app, s, c, fake, tr = bp_app
    r = _inst(c, "area_lights_at_sunset", {"area": "sch_living", "offset": 15})
    assert r.status_code == 201, r.text
    cfg = _stored(fake, r.json()["item"]["config_id"])
    assert cfg["triggers"] == [{"trigger": "sun", "event": "sunset", "offset": "00:15:00"}]
    assert cfg["actions"][0]["target"]["entity_id"] == ["light.hall", "light.office"] and cfg["actions"][0]["data"] == {"brightness_pct": 70}


# ================================================================ parameter validation against the installation

def test_parameter_validation(bp_app):
    app, s, c, fake, tr = bp_app

    def prev(bp_id, params):
        return c.post(f"{BP}/{bp_id}/preview", json={"params": params})

    base = _p_motion_light()
    assert _errors(prev("motion_light_timer", {**base, "motion": ["binary_sensor.nowhere"]})) == {("motion", "entity_unknown")}
    assert _errors(prev("motion_light_timer", {**base, "motion": ["light.office"]})) == {("motion", "entity_domain")}
    assert _errors(prev("motion_light_timer", {**base, "motion": ["binary_sensor.living_window"]})) == {("motion", "entity_class")}
    assert _errors(prev("motion_light_timer", {**base, "lights": ["switch.hall_lights"]})) == {("lights", "entity_domain")}
    assert _errors(prev("motion_light_timer", {**base, "lights": []})) == {("lights", "required")}
    assert _errors(prev("motion_light_timer", {**base, "lights": ["light.office"] * 1 + [f"light.l{i}" for i in range(25)]})) == {("lights", "too_many")}
    assert _errors(prev("motion_light_timer", {**base, "minutes": 0})) == {("minutes", "out_of_range")}
    assert _errors(prev("motion_light_timer", {**base, "minutes": "5"})) == {("minutes", "out_of_range")}
    assert _errors(prev("motion_light_timer", {**base, "minutes": True})) == {("minutes", "out_of_range")}
    assert _errors(prev("motion_light_timer", {**base, "brightness": 101})) == {("brightness", "out_of_range")}
    assert _errors(prev("motion_light_timer", {**base, "surprise": 1})) == {("surprise", "unknown_param")}
    assert _errors(prev("motion_light_timer", {"motion": [MOTION]})) == {("lights", "required")}
    assert _errors(prev("lights_off_floor_empty_night", {"motion": [MOTION], "lights": ["light.office"], "from_time": "25:00"})) == {("from_time", "time_invalid")}
    assert _errors(prev("lights_off_floor_empty_night", {"motion": [MOTION], "lights": ["light.office"], "from_time": "22:00", "to_time": "22:00"})) == {("from_time", "rule")}
    assert _errors(prev("temperature_out_of_range", {"sensor": "sensor.living_temperature", "low": 30, "high": 20})) == {("low", "rule")}
    assert _errors(prev("temperature_out_of_range", {"sensor": "sensor.outdoor_temperature"})) == {("sensor", "entity_class")}
    assert _errors(prev("door_left_open_notify", {"sensors": ["binary_sensor.front_door_contact"], "message": "{{ states('lock.front_door') }}"})) == {("message", "text_invalid")}
    assert _errors(prev("door_left_open_notify", {"sensors": ["binary_sensor.front_door_contact"], "notify": "notify.not_approved"})) == {("notify", "notify_not_approved")}
    assert _errors(prev("door_left_open_notify", {"sensors": ["binary_sensor.front_door_contact"], "notify": "light.turn_off"})) == {("notify", "notify_not_approved")}
    assert _errors(prev("scheduled_scene", {"scene": "light.office"})) == {("scene", "entity_invalid")}
    assert _errors(prev("scheduled_scene", {"scene": "scene.missing"})) == {("scene", "entity_unknown")}
    assert _errors(prev("scheduled_scene", {"scene": "scene.evening", "days": ["xyz"]})) == {("days", "weekdays_invalid")}
    assert _errors(prev("area_lights_at_sunset", {"area": "no_such_area"})) == {("area", "area_unknown")}
    assert _errors(prev("area_lights_at_sunset", {"area": "sch_bedrooms"})) == {("area", "area_empty")}
    assert _errors(prev("motion_light_timer", {})) >= {("motion", "required"), ("lights", "required")}
    assert c.post(f"{BP}/motion_light_timer/preview", json={"params": "x"}).status_code == 422
    assert c.post(f"{BP}/motion_light_timer/preview", json={"params": {}, "x": 1}).status_code == 422
    assert c.post(f"{BP}/motion_light_timer/preview", content=b"x", headers={"content-type": "text/plain"}).status_code == 415
    assert not [x for x in tr.bridge_calls if x["op"] == "upsert"]


def test_the_notify_target_defaults_to_the_first_approved_one_and_an_empty_list_is_a_missing_value(bp_app):
    app, s, c, fake, tr = bp_app
    r = _inst(c, "water_leak_notify", {"sensors": ["binary_sensor.laundry_leak"]})
    assert r.status_code == 201 and _stored(fake, r.json()["item"]["config_id"])["actions"][0]["action"] == NOTIFY
    assert c.patch(f"{API}/settings", json={"automations.notify_targets": []}).status_code == 200
    assert _errors(c.post(f"{BP}/water_leak_notify/preview", json={"params": {"sensors": ["binary_sensor.laundry_leak"]}})) == {("notify", "required")}


# ================================================================ forbidden: doors, locks, alarm, sirens, covers

@pytest.mark.parametrize("entity", ["lock.front_door", "lock.side_door", "cover.driveway_gate", "cover.gym_shutter", "alarm_control_panel.home_panel", "alarm_control_panel.shed_panel"])
def test_a_door_lock_alarm_siren_or_cover_cannot_be_a_target_of_any_blueprint(bp_app, entity):
    app, s, c, fake, tr = bp_app
    for bp_id, key, extra in (("motion_light_timer", "lights", {"motion": [MOTION]}), ("lights_off_floor_empty_night", "lights", {"motion": [MOTION]}), ("ac_off_window_open", "climate", {"windows": ["binary_sensor.living_window"]})):
        r = _inst(c, bp_id, {**extra, key: [entity]})
        assert r.status_code == 422 and r.json()["code"] == "validation", (bp_id, r.text)
        assert {e["param"] for e in r.json()["details"]["errors"]} == {key}
    assert _errors(c.post(f"{BP}/scheduled_scene/preview", json={"params": {"scene": entity}})) == {("scene", "entity_invalid")}
    assert not [x for x in tr.bridge_calls if x["op"] == "upsert"] and not [x for x in fake.calls if x["domain"] in ("lock", "cover", "alarm_control_panel", "siren")]


def test_a_possible_door_device_and_the_door_layer_are_refused_and_an_area_silently_leaves_them_out(bp_app, monkeypatch):
    app, s, c, fake, tr = bp_app
    monkeypatch.setattr(door_path, "possible_door_entities", lambda conn: {"switch.hall_lights", "light.hall"})
    r = _inst(c, "lights_off_floor_empty_night", {"motion": [MOTION], "lights": ["light.office", "light.hall"]})
    assert r.status_code == 422 and {(e["param"], e["code"]) for e in r.json()["details"]["errors"]} == {("lights", "entity_not_allowed")}
    r = _inst(c, "area_lights_at_sunset", {"area": "sch_living"})
    assert r.status_code == 201 and _stored(fake, r.json()["item"]["config_id"])["actions"][0]["target"]["entity_id"] == ["light.office"]
    assert [x for x in tr.bridge_calls if x["op"] == "upsert"].__len__() == 1


def test_a_tampered_blueprint_with_a_door_action_never_reaches_the_create_path(bp_app, monkeypatch):
    """Defence in depth: even a definition that slipped past validate_definition (an imported one with a bug) is stopped on the EXPANDED config."""
    app, s, c, fake, tr = bp_app
    evil = bps.get("motion_light_timer")
    evil["id"] = "evil_blueprint"
    evil["parameters"] = [bps.P("lights", "entities", "x", domains=["switch"], role="control"), bps.P("motion", "entities", "m", domains=["binary_sensor"], role="watch")]
    evil["template"]["actions"] = [{"action": "lock.unlock", "target": {"entity_id": [{"$param": "lights"}]}}]
    evil["template"]["triggers"] = [{"trigger": "state", "entity_id": {"$param": "motion"}, "to": "on"}]
    monkeypatch.setattr(bps, "LIBRARY", (*bps.LIBRARY, evil))
    r = _inst(c, "evil_blueprint", {"motion": [MOTION], "lights": ["switch.hall_lights"]})
    assert r.status_code == 422 and r.json()["details"]["errors"][0]["code"] == "blueprint_forbidden_action"
    assert not [x for x in tr.bridge_calls if x["op"] == "upsert"] and not [x for x in fake.calls if x["domain"] == "lock"]
    with app.state.db.connection() as conn:
        a = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'automation.blueprint.instantiate' ORDER BY id DESC").fetchone()
        assert a["decision"] == "denied" and a["reason"] == "validation"


def test_no_door_automation_block_is_created_or_touched(bp_app):
    app, s, c, fake, tr = bp_app
    with app.state.db.connection() as conn:
        before = conn.execute("SELECT COUNT(*) FROM door_automations").fetchone()[0]
    assert _inst(c, "motion_light_timer", _p_motion_light()).status_code == 201
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM door_automations").fetchone()[0] == before
    assert not [r for r in c.app.routes if "blueprint" in getattr(r, "path", "") and "door" in getattr(r, "path", "")]


# ================================================================ permissions

def _grant(c, user, name, perms, sensitive, floor_id):
    both = list(dict.fromkeys(list(perms) + list(sensitive)))
    return _raw_grant(c, user, name, [p for p in both if p not in _SENSITIVE], [p for p in both if p in _SENSITIVE], "floor", floor_id)


def test_permissions_a_user_without_manage_is_refused_everywhere(bp_app):
    app, s, c, fake, tr = bp_app
    ids = seed_tree(c)
    from automations_fixture import place

    place(c, ids["floor2"], "light.office", "binary_sensor.motion_hall")
    _raw_grant(c, "ron", "מפעיל סקריפטים (בדיקת תבניות)", ["script.run", "devices.control"] + READ, [], "installation", "*")
    RON = {"X-SW-Dev-User": "ron"}
    for r in (c.get(BP, headers=RON), c.get(f"{BP}/motion_light_timer", headers=RON), c.post(f"{BP}/motion_light_timer/preview", json={"params": _p_motion_light()}, headers=RON),
              _inst(c, "motion_light_timer", _p_motion_light(), RON)):
        assert r.status_code == 403, r.text
    st = c.get(f"{BP}/status", headers=RON)
    assert st.status_code == 200 and st.json()["can_use"] is False
    assert not [x for x in tr.bridge_calls if x["op"] == "upsert"]
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE decision = 'denied' AND actor_user_id = 'dev-ron'").fetchone()[0] >= 1


def test_permissions_a_floor_editor_is_held_to_the_same_scope_and_delegation_rules_as_the_editor(bp_app):
    app, s, c, fake, tr = bp_app
    from automations_fixture import directory, place

    ids = seed_tree(c)
    place(c, ids["floor2"], "light.office", "binary_sensor.motion_hall")
    _grant(c, "omer", "עורך קומה (בדיקת תבניות)", ["script.run", "devices.control"] + READ + EDIT, EDIT, ids["floor2"])
    # not an HA administrator and the delegation switch is off: refused exactly like a hand-made automation
    r = _inst(c, "motion_light_timer", _p_motion_light(), OMER)
    assert r.status_code == 403 and r.json()["code"] == "delegation_off"
    tr.delegated = True
    directory(c, tr.secret, delegated=True, changed_at="2026-10-01T09:00:00Z")
    # a device outside the floor: the same 403 forbidden the editor gives, with nothing written
    r = _inst(c, "motion_light_timer", {**_p_motion_light(), "lights": ["light.hall"]}, OMER)
    assert r.status_code in (403, 422), r.text
    assert not [x for x in tr.bridge_calls if x["op"] == "upsert"]
    # a trigger sensor outside the floor is not in reach
    r = _inst(c, "motion_light_timer", {**_p_motion_light(), "motion": ["binary_sensor.living_window"]}, OMER)
    assert r.status_code == 422
    # inside the floor: created, as the editor would, by that user
    r = _inst(c, "motion_light_timer", _p_motion_light(), OMER)
    assert r.status_code == 201, r.text
    call = [x for x in tr.bridge_calls if x["op"] == "upsert"][-1]
    assert call["user_id"] == "dev-omer" and call["profile"] == "builder"
