"""Schedules: more actions (owner request 2026-10-04) - scripts (alarm scripts are ordinary scripts), scenes, helpers, humidifiers, vacuums,
cover tilt and climate swing / humidity, offered only where the entity's own capabilities say so; the explicit allow-list; disarming
not schedulable by default (`schedules.allow_disarm`, a system administrator's typed decision, audited); run-time revalidation of an action
whose entity disappeared or lost the service; the older stored forms (a script called as its own service) read and rewritten; and the
administrator's acknowledgement of a review warning bound to the schedule's content. Fakes only: the FakeScheduler component and bridge
(tests/fake_scheduler.py) - nothing here reaches a real system or a real alarm."""
from __future__ import annotations

import json
from typing import Any

import pytest

import fake_scheduler
from schedules_fixture import *  # noqa: F401,F403
from schedules_fixture import sched_app  # noqa: F401
from schedules_fixture import grant
from smplwise.services import ha_bridge, ha_client, ha_sync
from smplwise.services import schedule_model as model
from smplwise.services import schedule_policy as policy
from smplwise.services import schedules as store

API = "/api/v1"

# the generic extra entities of these tests (anonymised; the same shapes as the platform's states)
EXTRA: dict[str, tuple[str, str | None, str, dict[str, Any]]] = {
    "script.morning_routine": ("Morning routine", "sch_living", "off", {"last_triggered": None}),
    "script.night_alarm": ("Night alarm script", None, "off", {"last_triggered": None}),
    "script.opaque": ("Opaque script", "sch_living", "off", {}),
    "script.needs_device": ("Needs a device", "sch_living", "off", {}),
    "scene.movie": ("Movie scene", "sch_living", "2026-09-30T09:00:00+00:00", {}),
    "input_boolean.guests": ("Guests mode", "sch_living", "off", {}),
    "input_number.boiler_minutes": ("Boiler minutes", "sch_living", "30", {"min": 10, "max": 90, "step": 5}),
    "input_select.house_mode": ("House mode", "sch_living", "home", {"options": ["home", "away", "night"]}),
    "vacuum.robot": ("Robot vacuum", "sch_living", "docked", {"supported_features": 8192 | 16}),
    "vacuum.old_robot": ("Old robot", "sch_living", "docked", {"supported_features": 4}),
    "humidifier.bedroom": ("Bedroom humidifier", "sch_bedrooms", "on", {"min_humidity": 30, "max_humidity": 70, "available_modes": ["normal", "sleep"], "supported_features": 1}),
    "cover.blind": ("Office blind", "sch_living", "open", {"current_position": 100, "current_tilt_position": 50, "device_class": "blind", "supported_features": 15 | 16 | 32 | 128}),
    "climate.swing_ac": ("Swing AC", "sch_living", "cool", {"hvac_modes": ["off", "cool"], "swing_modes": ["off", "vertical"], "min_temp": 16, "max_temp": 30, "supported_features": 1 | 32}),
}

SCRIPT_CONFIGS = {
    "script.morning_routine": {"alias": "Morning routine", "fields": {
        "minutes": {"name": "Minutes", "required": True, "selector": {"number": {"min": 1, "max": 60}}},
        "room": {"name": "Room", "selector": {"select": {"options": ["hall", "office"]}}},
        "loud": {"name": "Loud", "selector": {"boolean": {}}}},
        "sequence": [{"action": "light.turn_on", "target": {"entity_id": "light.office"}}]},
    "script.night_alarm": {"alias": "Night alarm script", "sequence": [{"action": "alarm_control_panel.alarm_disarm", "target": {"entity_id": "alarm_control_panel.shed_panel"}}]},
    "script.needs_device": {"alias": "Needs a device", "fields": {"target": {"name": "Target", "required": True, "selector": {"entity": {"multiple": True}}}},
                            "sequence": [{"action": "light.turn_on", "target": {"entity_id": "light.office"}}]},
}


def _extra(app, fake) -> None:
    """Put EXTRA into the mirror and the fake's world, and the script configs into the automations mirror (`ha_config_items`)."""
    states, reg = [], []
    for eid, (name, area, st, attrs) in EXTRA.items():
        state = {"entity_id": eid, "state": st, "attributes": {"friendly_name": name, **attrs}, "last_changed": "2026-09-30T10:00:00+00:00", "last_updated": "2026-09-30T10:00:00+00:00"}
        states.append(state)
        fake.world[eid] = state
        reg.append({"id": f"reg-{eid}", "entity_id": eid, "unique_id": f"u-{eid}", "platform": "generic", "config_entry_id": "ce-generic", "device_id": None, "area_id": area,
                    "entity_category": None, "original_name": name, "name": None, "disabled_by": None, "hidden_by": None})
    with app.state.db.connection() as conn:
        for st in states:
            ha_sync.upsert_state(conn, st)
        ha_sync.apply_registry(conn, ha_client.registry_maps(reg, [], fake_scheduler.AREAS, fake_scheduler.FLOORS))
        for eid, cfg in SCRIPT_CONFIGS.items():
            conn.execute("INSERT INTO ha_config_items(kind, item_id, config_id, entity_id, source, revision, config_json, masked, reason, seen_at, changed_at) VALUES ('script', ?, ?, ?, 'ui', 'r1', ?, 0, NULL, ?, ?)",
                         (eid.split(".", 1)[1], eid.split(".", 1)[1], eid, json.dumps(cfg), "2026-09-30T10:00:00Z", "2026-09-30T10:00:00Z"))


def _bridge(c, tr, version: str) -> None:
    assert c.post(f"{API}/ha/bridge/ping", json=ha_bridge.sign(tr.secret, {"version": version})).status_code == 200


@pytest.fixture()
def more(sched_app):
    app, s, c, fake, tr = sched_app
    _extra(app, fake)
    _bridge(c, tr, "0.6.1")
    return app, s, c, fake, tr


def _catalog(c, **q) -> dict[str, dict[str, Any]]:
    r = c.get(f"{API}/schedules/catalog", params=q)
    assert r.status_code == 200, r.text
    return {e["entity_id"]: e for e in r.json()["entities"]}


def _create(c, d: dict[str, Any], headers: dict[str, str] | None = None, **extra: Any):
    return c.post(f"{API}/schedules", json={"draft": d, "enabled": True, "client_request_id": rid(), **extra}, headers=headers or {})


def _one(service: str, entity: str, name: str = "One", **data: Any) -> dict[str, Any]:
    return draft_of(name, [slot("06:15:00", None, act(service, entity, **data))])


def _audit(app, action: str) -> list[dict[str, Any]]:
    with app.state.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


# ---------------------------------------------------------------- the explicit allow-list (a new service must be listed here)

EXPECTED_SERVICES = {
    "light": {"light.turn_on", "light.turn_off"},
    "switch": {"switch.turn_on", "switch.turn_off"},
    "cover": {"cover.open_cover", "cover.close_cover", "cover.stop_cover", "cover.set_cover_position", "cover.set_cover_tilt_position", "cover.open_cover_tilt", "cover.close_cover_tilt"},
    "climate": {"climate.set_hvac_mode", "climate.set_temperature", "climate.set_fan_mode", "climate.set_preset_mode", "climate.set_swing_mode", "climate.set_humidity", "climate.turn_off"},
    "fan": {"fan.turn_on", "fan.turn_off", "fan.set_percentage"},
    "alarm": {"alarm_control_panel.alarm_arm_home", "alarm_control_panel.alarm_arm_away", "alarm_control_panel.alarm_arm_night", "alarm_control_panel.alarm_arm_vacation",
              "alarm_control_panel.alarm_arm_custom_bypass", "alarm_control_panel.alarm_disarm"},
    "lock": {"lock.lock", "lock.unlock"},
    "door": {"cover.open_cover", "cover.close_cover", "cover.stop_cover", "cover.set_cover_position", "switch.turn_on", "switch.turn_off", "button.press"},
    "script": {"script.turn_on"},
    "scene": {"scene.turn_on"},
    "helper": {"input_boolean.turn_on", "input_boolean.turn_off", "input_number.set_value", "input_select.select_option"},
    "humidifier": {"humidifier.set_humidity", "humidifier.set_mode"},
    "vacuum": {"vacuum.start", "vacuum.return_to_base"},
}


def test_the_allow_list_is_explicit_and_every_new_service_is_listed():
    assert {c: set(s) for c, s in policy.SCHEDULE_ACTIONS.items()} == EXPECTED_SERVICES, "a schedule service was added or removed: list it in EXPECTED_SERVICES on purpose"
    original = set().union(*(EXPECTED_SERVICES[c] for c in policy.ORIGINAL_CLASSES)) - {"cover.open_cover_tilt", "cover.close_cover_tilt", "climate.set_swing_mode", "climate.set_humidity"}
    assert policy.NEWER_BRIDGE_SERVICES == policy.SCHEDULE_ACTION_SERVICES - original, "every service the 0.6.0 bridge refuses needs the newer bridge"
    assert set(policy.FEATURE_BITS) <= policy.SCHEDULE_ACTION_SERVICES and set(policy.FEATURE_EVIDENCE) <= set(policy.FEATURE_BITS)
    assert policy.SCHEDULE_ACTION_SERVICES <= set(ha_bridge.ACTIONS)
    for service, args in policy.SERVICE_ARGS.items():
        assert not ({"code", "pin", "password"} & set(args)), service
    assert "alarm_control_panel.alarm_trigger" not in policy.SCHEDULE_ACTION_SERVICES and not any(s.startswith(("siren.", "media_player.", "notify.")) for s in policy.SCHEDULE_ACTION_SERVICES)


def test_capability_rules_never_invent_a_service():
    cover = {"supported_features": 3, "attributes": {}}
    assert policy.service_capable("cover.open_cover", cover) and not policy.service_capable("cover.stop_cover", cover) and not policy.service_capable("cover.open_cover_tilt", cover)
    assert policy.service_capable("cover.stop_cover", {"supported_features": 0, "attributes": {}}), "a legacy service on an entity that reports no bits keeps working"
    assert not policy.service_capable("vacuum.start", {"supported_features": 0, "attributes": {}}), "a new service needs positive evidence"
    assert policy.service_capable("climate.set_swing_mode", {"supported_features": 1, "attributes": {"swing_modes": ["off"]}}), "the attribute proves it too"
    assert not policy.arg_capable("light.turn_on", "brightness", {"attributes": {"supported_color_modes": ["onoff"]}})
    assert policy.arg_capable("light.turn_on", "brightness", {"attributes": {"supported_color_modes": ["brightness"]}})


# ---------------------------------------------------------------- the capability-driven catalogue

def test_catalog_offers_only_what_each_entity_really_supports(more):
    app, s, c, fake, tr = more
    cat = _catalog(c)
    morning = cat["script.morning_routine"]
    assert morning["class"] == "script" and morning["selectable"] and morning["area_name"] == "Living room" and morning["name"] == "Morning routine"
    (run,) = morning["actions"]
    assert run["service"] == "script.turn_on"
    (variables,) = run["args"]
    assert variables["type"] == "vars" and [f["name"] for f in variables["fields"]] == ["minutes", "room", "loud"]
    minutes = variables["fields"][0]
    assert minutes == {"name": "minutes", "label": "Minutes", "required": True, "type": "int", "min": 1, "max": 60}
    assert variables["fields"][1]["type"] == "enum" and variables["fields"][1]["choices"] == ["hall", "office"] and variables["fields"][2]["type"] == "bool"
    assert cat["script.opaque"]["selectable"] and cat["script.opaque"]["actions"][0]["args"] == [] and cat["script.opaque"]["sensitive"] is True  # effects unknown = sensitive
    assert cat["script.night_alarm"]["sensitive"] is True and cat["script.night_alarm"]["actions"][0]["lowering"] is True
    assert cat["script.needs_device"]["selectable"] is False and cat["script.needs_device"]["reason"]["code"] == "script_field_unsupported"
    assert [a["service"] for a in cat["scene.movie"]["actions"]] == ["scene.turn_on"]
    num = next(a for a in cat["input_number.boiler_minutes"]["actions"])
    assert num["args"][0] == {"name": "value", "type": "float", "required": True, "label": "ערך", "min": 10.0, "max": 90.0, "step": 5.0}
    sel = cat["input_select.house_mode"]["actions"][0]["args"][0]
    assert sel["type"] == "enum" and sel["choices"] == ["home", "away", "night"]
    assert {a["service"] for a in cat["vacuum.robot"]["actions"]} == {"vacuum.start", "vacuum.return_to_base"}
    assert "vacuum.old_robot" in cat and cat["vacuum.old_robot"]["selectable"] is False, "a vacuum that reports neither start nor return is listed with the reason"
    hum = {a["service"]: a for a in cat["humidifier.bedroom"]["actions"]}
    assert hum["humidifier.set_humidity"]["args"][0]["min"] == 30 and hum["humidifier.set_mode"]["args"][0]["choices"] == ["normal", "sleep"]
    blind = {a["service"] for a in cat["cover.blind"]["actions"]}
    assert {"cover.open_cover_tilt", "cover.close_cover_tilt", "cover.set_cover_tilt_position"} <= blind
    gate = {a["service"] for a in cat["cover.driveway_gate"]["actions"]}
    assert gate == {"cover.open_cover", "cover.close_cover"}, "the gate reports open | close only: no stop, no position"
    swing = {a["service"]: a for a in cat["climate.swing_ac"]["actions"]}
    assert swing["climate.set_swing_mode"]["args"][0]["choices"] == ["off", "vertical"]
    assert "climate.set_swing_mode" not in {a["service"] for a in cat["climate.living_room"]["actions"]}
    panel = {a["service"] for a in cat["alarm_control_panel.shed_panel"]["actions"]}
    assert "alarm_control_panel.alarm_disarm" not in panel and "alarm_control_panel.alarm_arm_home" in panel, "disarming is not offered by default"
    assert _catalog(c, **{"class": "script"}).keys() == {"script.morning_routine", "script.night_alarm", "script.opaque", "script.needs_device"}


def test_an_older_bridge_cannot_take_the_new_actions(more):
    app, s, c, fake, tr = more
    _bridge(c, tr, "0.6.0")
    cat = _catalog(c)
    assert cat["scene.movie"]["selectable"] is False and cat["scene.movie"]["reason"]["code"] == "bridge_too_old_for_action"
    assert "cover.open_cover_tilt" not in {a["service"] for a in cat["cover.blind"]["actions"]} and cat["cover.blind"]["selectable"]
    r = _create(c, _one("scene.turn_on", "scene.movie"))
    assert r.status_code == 503 and r.json()["code"] == "bridge_too_old_for_action"
    assert _create(c, _one("cover.close_cover", "cover.blind")).status_code == 201, "the original actions keep working"


# ---------------------------------------------------------------- scripts as first-class actions

def test_a_script_with_its_variables_is_scheduled_through_the_bridge(more):
    app, s, c, fake, tr = more
    d = _one("script.turn_on", "script.morning_routine", name="Morning", variables={"minutes": 20, "room": "office"})
    r = _create(c, d)
    assert r.status_code == 201, r.text
    sched = r.json()["schedule"]
    assert sched["read_only"] is None and sched["can"]["edit"] and sched["can"]["run"]
    act_ = sched["slots"][0]["actions"][0]
    assert act_ == {"service": "script.turn_on", "entity_id": "script.morning_routine", "data": {"variables": {"minutes": 20, "room": "office"}}, "supported": True, "class": "script",
                    "sensitive": False, "lowering": False}
    assert sched["entities"][0]["name"] == "Morning routine" and sched["entities"][0]["area_name"] == "Living room"
    sent = next(b for b in tr.fake.bridge_calls if b["op"] == "add")
    assert sent["payload"]["timeslots"][0]["actions"] == [{"service": "script.turn_on", "entity_id": "script.morning_routine", "service_data": {"variables": {"minutes": 20, "room": "office"}}}]
    row = _audit(app, "schedule.create")[-1]
    assert row["decision"] == "allowed" and "script.morning_routine" in json.loads(row["details_json"])["entities"]
    # run now works the same as for any action (an attention action: confirmed explicitly)
    run = c.post(f"{API}/schedules/{sched['id']}/run", json={"client_request_id": rid(), "confirm": True})
    assert run.status_code == 202, run.text


@pytest.mark.parametrize("variables,code", [
    ({"minutes": 99}, "validation"), ({"speed": 1}, "validation"), ({"room": "garage", "minutes": 5}, "validation"), ({"code": "1234", "minutes": 5}, "code_not_allowed"),
    ({"minutes": {"nested": 1}}, "validation"), ({"room": "hall"}, "validation"),
])
def test_script_variables_follow_the_scripts_own_fields(more, variables, code):
    app, s, c, fake, tr = more
    r = _create(c, _one("script.turn_on", "script.morning_routine", variables=variables))
    assert r.status_code == 422 and r.json()["code"] == code, r.text
    assert not any(b["op"] == "add" for b in tr.fake.bridge_calls), "nothing reaches the bridge"


def test_a_script_whose_fields_are_not_known_runs_without_variables_only(more):
    app, s, c, fake, tr = more
    assert _create(c, _one("script.turn_on", "script.opaque", variables={"x": 1})).status_code == 422
    assert _create(c, _one("script.turn_on", "script.opaque")).status_code == 201


def test_an_alarm_script_is_an_ordinary_script_with_the_alarm_grants_and_the_lowering_confirmation(more):
    app, s, c, fake, tr = more
    d = _one("script.turn_on", "script.night_alarm", name="Night")
    r = _create(c, d)
    assert r.status_code == 409 and r.json()["code"] == "lowering_confirmation_required"
    # a manager without the sensitive permission may not schedule it
    grant(c, "maya", "Plain manager", ["schedule.view", "devices.read", "entity.state.read", "script.run"], ["schedule.manage", "ha.entity.control"], "installation", "*")
    r = _create(c, d, headers={"X-SW-Dev-User": "maya"}, confirm_lowering=True)
    assert r.status_code == 403 and r.json()["code"] == "sensitive_permission_required"
    # ... nor one with it but without the right to disarm that panel by hand
    grant(c, "noa", "Sensitive manager", ["schedule.view", "devices.read", "entity.state.read", "script.run", "alarm.view"],
          ["schedule.manage", "schedule.sensitive", "ha.entity.control"], "installation", "*")
    r = _create(c, d, headers={"X-SW-Dev-User": "noa"}, confirm_lowering=True)
    assert r.status_code == 403 and r.json()["code"] == "grant_required"
    r = _create(c, d, confirm_lowering=True)
    assert r.status_code == 201 and r.json()["schedule"]["sensitive"] is True and r.json()["schedule"]["lowering"] is True
    assert next(b for b in tr.fake.bridge_calls if b["op"] == "add")["sensitive"] is True


def test_a_script_stored_in_the_older_form_is_shown_editable_and_rewritten_on_save(more):
    app, s, c, fake, tr = more
    sid = fake._add({"name": "", "weekdays": ["daily"], "repeat_type": "repeat", "timeslots": [
        {"start": "06:15:00", "stop": None, "conditions": [], "condition_type": None, "track_conditions": False, "actions": [{"service": "script.morning_routine", "entity_id": None, "service_data": {"minutes": 10}}]}]})
    store.MIRROR.pull(None, "test")
    got = c.get(f"{API}/schedules/{sid}").json()
    assert got["read_only"] is None, "no 'original platform' read-only for a script any more"
    assert got["slots"][0]["actions"][0]["service"] == "script.turn_on" and got["slots"][0]["actions"][0]["entity_id"] == "script.morning_routine"
    assert got["slots"][0]["actions"][0]["data"] == {"variables": {"minutes": 10}} and got["display_name"].startswith("Morning routine")
    assert not any(w["code"] == "unsupported_content" for w in got.get("warnings", []))
    d = model.canonical_draft({**draft_of("Renamed", []), "slots": [{"start": "06:15:00", "stop": None, "actions": [{"service": "script.morning_routine", "entity_id": None, "data": {"minutes": 10}}]}]})
    r = put_draft(c, sid, d, got["revision"])
    assert r.status_code == 200, r.text
    edit = [b for b in tr.fake.bridge_calls if b["op"] == "edit"][-1]
    assert edit["payload"]["timeslots"][0]["actions"] == [{"service": "script.turn_on", "entity_id": "script.morning_routine", "service_data": {"variables": {"minutes": 10}}}]


# ---------------------------------------------------------------- the other new classes

def test_helpers_humidifiers_vacuums_and_scenes(more):
    app, s, c, fake, tr = more
    assert _create(c, _one("input_number.set_value", "input_number.boiler_minutes", value=45)).status_code == 201
    r = _create(c, _one("input_number.set_value", "input_number.boiler_minutes", value=95))
    assert r.status_code == 422 and "out_of_range" in {e["code"] for e in r.json()["details"]["errors"]}
    assert _create(c, _one("input_select.select_option", "input_select.house_mode", option="away")).status_code == 201
    assert _create(c, _one("input_select.select_option", "input_select.house_mode", option="party")).status_code == 422
    assert _create(c, _one("humidifier.set_mode", "humidifier.bedroom", mode="sleep")).status_code == 201
    assert _create(c, _one("vacuum.start", "vacuum.robot")).status_code == 201
    r = _create(c, _one("vacuum.start", "vacuum.old_robot"))
    assert r.status_code == 422 and r.json()["code"] == "service_not_supported"
    r = _create(c, _one("cover.stop_cover", "cover.driveway_gate"))
    assert r.status_code == 422 and r.json()["code"] == "service_not_supported"
    assert _create(c, _one("scene.turn_on", "scene.movie")).status_code == 201
    assert _create(c, _one("climate.set_swing_mode", "climate.swing_ac", swing_mode="vertical")).status_code == 201
    assert _create(c, _one("climate.set_swing_mode", "climate.swing_ac", swing_mode="horizontal")).status_code == 422


def test_settings_classes_switch_the_new_classes_off_and_an_old_every_class_list_keeps_them_on(more):
    app, s, c, fake, tr = more
    with app.state.db.connection() as conn:
        conn.execute("DELETE FROM settings WHERE key = 'schedules.classes_rev'")
        conn.execute("INSERT INTO settings(key, value) VALUES ('schedules.classes', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (json.dumps(list(policy.ORIGINAL_CLASSES)),))
    assert "script" in c.get(f"{API}/settings").json()["settings"]["schedules.classes"], "saved with every class on before 2026-10-04: still every class"
    assert c.patch(f"{API}/settings", json={"schedules.classes": list(policy.ORIGINAL_CLASSES)}).status_code == 200
    assert c.get(f"{API}/settings").json()["settings"]["schedules.classes"] == list(policy.ORIGINAL_CLASSES), "saved now: read as saved"
    r = _create(c, _one("scene.turn_on", "scene.movie"))
    assert r.status_code == 422 and r.json()["code"] == "class_not_allowed"
    assert "scene.movie" not in _catalog(c)


# ---------------------------------------------------------------- disarming (owner decision pending; default: not schedulable)

def test_disarm_is_refused_until_a_system_administrator_allows_it_with_a_typed_confirmation(more, monkeypatch):
    app, s, c, fake, tr = more
    d = _one("alarm_control_panel.alarm_disarm", "alarm_control_panel.shed_panel", name="Disarm")
    r = _create(c, d, confirm_lowering=True)
    assert r.status_code == 422 and r.json()["code"] == "disarm_not_allowed" and "מנהל מערכת" in r.json()["user_message"]
    # a site administrator (no system.configure) cannot touch it; a configurator who is not a system administrator neither (audited)
    bind(c, s, "conf", "site_admin", "installation", "*")
    r = c.patch(f"{API}/settings", json={"schedules.allow_disarm": "true", "schedules.allow_disarm_confirm": "אפשר נטרול"}, headers={"X-SW-Dev-User": "conf"})
    assert r.status_code == 403
    import smplwise.rbac as rbac

    real = rbac.is_system_admin
    monkeypatch.setattr(rbac, "is_system_admin", lambda conn, uid: False)
    r = c.patch(f"{API}/settings", json={"schedules.allow_disarm": "true", "schedules.allow_disarm_confirm": "אפשר נטרול"})
    assert r.status_code == 403 and _audit(app, "schedules.allow_disarm")[-1]["decision"] == "denied"
    monkeypatch.setattr(rbac, "is_system_admin", real)
    # the administrator must type the word
    r = c.patch(f"{API}/settings", json={"schedules.allow_disarm": "true"})
    assert r.status_code == 422 and r.json()["code"] == "confirm_required"
    r = c.patch(f"{API}/settings", json={"schedules.allow_disarm": "true", "schedules.allow_disarm_confirm": "אפשר נטרול"})
    assert r.status_code == 200 and r.json()["settings"]["schedules.allow_disarm"] == "true"
    row = _audit(app, "schedules.allow_disarm")[-1]
    assert row["decision"] == "allowed" and json.loads(row["details_json"]) == {"to": "true"}
    assert "אפשר נטרול" not in json.dumps(_audit(app, "settings.update")), "the typed confirmation is never stored"
    assert c.get(f"{API}/schedules/status").json()["settings"]["allow_disarm"] is True
    assert "alarm_control_panel.alarm_disarm" in {a["service"] for a in _catalog(c)["alarm_control_panel.shed_panel"]["actions"]}
    assert _create(c, d).json()["code"] == "lowering_confirmation_required"
    # (the creator's own disarm code is the existing rule, tested elsewhere: here the caller's policy asks for none)
    bind(c, s, "boss", "system_admin", "installation", "*")
    assert c.put(f"{API}/alarm/users/dev-joni/policy", json={"arm_policy": "no_code", "disarm_policy": "no_code", "current_pin": None}, headers=BOSS).status_code == 200
    assert _create(c, d, confirm_lowering=True).status_code == 201
    # a panel that needs a code to disarm stays unschedulable whatever the setting says
    r = _create(c, _one("alarm_control_panel.alarm_disarm", "alarm_control_panel.home_panel"), confirm_lowering=True)
    assert r.status_code == 422 and r.json()["code"] == "alarm_code_needed"
    # switching it off needs no word, still audited
    assert c.patch(f"{API}/settings", json={"schedules.allow_disarm": "false"}).status_code == 200
    assert json.loads(_audit(app, "schedules.allow_disarm")[-1]["details_json"]) == {"to": "false"}


def test_no_alarm_code_ever_reaches_the_logs_or_the_bridge(more, caplog):
    app, s, c, fake, tr = more
    r = _create(c, _one("script.turn_on", "script.morning_routine", variables={"minutes": 5, "pin": "4321"}))
    assert r.status_code == 422
    assert "4321" not in caplog.text and "4321" not in json.dumps(_audit(app, "schedule.create")) and not tr.fake.bridge_calls


# ---------------------------------------------------------------- run-time revalidation and failure injection

def test_an_action_whose_entity_disappeared_is_visible_and_never_run_silently(more):
    app, s, c, fake, tr = more
    r = _create(c, _one("scene.turn_on", "scene.movie", name="Movie night"))
    sid = r.json()["schedule"]["id"]
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET removed_at = '2026-10-01T00:00:00Z' WHERE entity_id = 'scene.movie'")
    got = c.get(f"{API}/schedules/{sid}").json()
    assert got["read_only"] is None and got["can"]["run"] is False and got["can"]["edit"] is True
    assert any(w["code"] == "entity_missing" for w in got["warnings"]) and got["slots"][0]["actions"][0]["invalid"]["code"] == "entity_missing"
    run = c.post(f"{API}/schedules/{sid}/run", json={"client_request_id": rid(), "confirm": True})
    assert run.status_code == 409 and run.json()["code"] == "action_invalid"
    assert _audit(app, "schedule.run")[-1]["decision"] == "denied"
    # the platform fires the slot anyway: the derived run is recorded at once as not happening as planned, audited, the administrators told
    with app.state.db.connection() as conn:
        entity = conn.execute("SELECT entity_id FROM schedule_cache WHERE schedule_id = ?", (sid,)).fetchone()[0]
        store.MIRROR._start_run(conn, sid, {"entity_id": entity, "state": "triggered", "attributes": {"current_slot": 0}, "last_changed": "2026-10-01T06:15:00+00:00"})
    runs = c.get(f"{API}/schedules/runs", params={"schedule_id": sid}).json()["items"]
    assert runs[0]["result"] == "not_confirmed" and runs[0]["settled_at"] and runs[0]["detail"]["entities"][0]["entity_id"] == "scene.movie"
    assert _audit(app, "schedule.run_invalid")[-1]["reason"] == "entity_missing"
    review = c.get(f"{API}/schedules/review").json()["items"]
    assert "action_invalid" in next(i for i in review if i["schedule"]["id"] == sid)["issues"]


def test_an_entity_that_lost_the_service_makes_the_run_fail_visibly(more):
    app, s, c, fake, tr = more
    sid = _create(c, _one("vacuum.start", "vacuum.robot", name="Clean")).json()["schedule"]["id"]
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET supported_features = 16 WHERE entity_id = 'vacuum.robot'")
    got = c.get(f"{API}/schedules/{sid}").json()
    assert got["slots"][0]["actions"][0]["invalid"]["code"] == "service_unsupported" and got["can"]["run"] is False


def test_bridge_refusal_and_timeout_on_a_script_schedule(more):
    app, s, c, fake, tr = more
    tr.fake.fail_next["add"] = "entity_not_found"
    r = _create(c, _one("script.turn_on", "script.opaque"))
    assert r.status_code == 502 and r.json()["code"] == "scheduler_refused"
    tr.fake.timeout_next.add("add")
    r = _create(c, _one("script.turn_on", "script.opaque", name="Timeout"))
    assert r.status_code in (202, 504)


# ---------------------------------------------------------------- acknowledging a review warning

def _review(c, sid: str) -> dict[str, Any] | None:
    return next((i for i in c.get(f"{API}/schedules/review").json()["items"] if i["schedule"]["id"] == sid), None)


def test_a_system_administrator_acknowledges_a_sensitive_outside_schedule_bound_to_its_content(more):
    app, s, c, fake, tr = more
    sid = next(i for i, it in fake.items.items() if it.get("name") == "Arm the home panel")
    item = _review(c, sid)
    assert "no_owner_sensitive" in item["issues"] and item["acknowledged"] == []
    before = c.get(f"{API}/schedules/status").json()["counts"]["attention"]
    assert c.get(f"{API}/schedules/status").json()["can"]["acknowledge"] is True
    r = c.post(f"{API}/schedules/{sid}/acknowledge", json={"issue": "no_owner_sensitive"})
    assert r.status_code == 200 and r.json()["acknowledged"] is True and r.json()["acknowledgement"]["by"]["username"] == "joni"
    item = _review(c, sid)
    assert "no_owner_sensitive" not in item["issues"] and item["acknowledged"][0]["issue"] == "no_owner_sensitive" and item["acknowledged"][0]["at"]
    assert c.get(f"{API}/schedules/status").json()["counts"]["attention"] == before - (0 if item["issues"] else 1)
    row = _audit(app, "schedule.acknowledge")[-1]
    assert row["decision"] == "allowed" and row["actor_username"] == "joni" and json.loads(row["details_json"])["issue"] == "no_owner_sensitive"
    # the acknowledgement never touched the schedule
    assert not any(b["op"] in ("edit", "add", "remove") for b in tr.fake.bridge_calls)
    # undo restores the warning
    assert c.post(f"{API}/schedules/{sid}/acknowledge", json={"issue": "no_owner_sensitive", "undo": True}).status_code == 200
    assert "no_owner_sensitive" in _review(c, sid)["issues"] and _audit(app, "schedule.unacknowledge")[-1]["decision"] == "allowed"
    # acknowledged again, then the content changes OUTSIDE Arx: the warning comes back by itself
    assert c.post(f"{API}/schedules/{sid}/acknowledge", json={"issue": "no_owner_sensitive"}).status_code == 200
    fake._edit(sid, {"timeslots": [{"start": "23:45:00", "actions": [{"service": "alarm_control_panel.alarm_arm_home", "entity_id": "alarm_control_panel.home_panel"}]}]})
    store.MIRROR.pull(None, "test")
    item = _review(c, sid)
    assert "no_owner_sensitive" in item["issues"] and item["acknowledged"] == []


def test_acknowledging_is_for_system_administrators_only_and_is_audited(more):
    app, s, c, fake, tr = more
    sid = next(i for i, it in fake.items.items() if it.get("name") == "Arm the home panel")
    grant(c, "sam", "Site manager", ["schedule.view", "devices.read", "entity.state.read", "alarm.view", "alarm.arm"],
          ["schedule.manage", "schedule.sensitive", "ha.entity.control"], "installation", "*")
    r = c.post(f"{API}/schedules/{sid}/acknowledge", json={"issue": "no_owner_sensitive"}, headers={"X-SW-Dev-User": "sam"})
    assert r.status_code == 403
    row = _audit(app, "schedule.acknowledge")[-1]
    assert row["decision"] == "denied" and row["actor_username"] == "sam"
    assert c.get(f"{API}/schedules/status", headers={"X-SW-Dev-User": "sam"}).json()["can"]["acknowledge"] is False
    assert c.post(f"{API}/schedules/{sid}/acknowledge", json={"issue": "contains_code"}).status_code == 422, "only the two warnings may be acknowledged"
    assert c.post(f"{API}/schedules/{sid}/acknowledge", json={"issue": "unsupported_content"}).status_code == 409, "a warning the schedule does not have"
    assert c.post(f"{API}/schedules/{sid}/acknowledge", json={"issue": "no_owner_sensitive", "undo": True}).status_code == 409
