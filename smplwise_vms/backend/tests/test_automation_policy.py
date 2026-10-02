"""CR-017 automation policy (services/automation_policy.py): secrets, sensitive classes and their manual-control grants, the builder allow-list and its closed
argument specs, loops and cycles, the schedule suggestion. Mirrors the primitives of frontend/tests/unit-automations.spec.ts; synthetic data only."""
from __future__ import annotations

import pytest

from bridge_loader import init_allowed_services
from smplwise.services import automation_policy as pol, ha_bridge


# ---------------------------------------------------------------- secrets

def test_secret_keys_are_whole_words_and_masked_at_any_depth():
    for k in ("code", "password", "passwd", "token", "access_token", "api_key", "apikey", "apiKey", "secret", "pin", "alarm-code", "PIN"):
        assert pol.is_secret_key(k), k
    for k in ("shipping", "unicode", "encoded", "message", "entity_id", "brightness_pct", "tokenizer_x"):
        assert not pol.is_secret_key(k), k
    assert pol.secret_kind({"data": {"code": "1234"}}) == "code"
    assert pol.secret_kind({"a": [{"api_key": "x"}]}) == "secret"
    assert pol.secret_kind({"data": {"message": "hi"}}) is None
    assert pol.secret_kind({"a": {"alarm_code": "1"}, "b": {"token": "t"}}) == "code"
    assert pol.mask_secrets({"a": {"token": "t", "n": 1}, "l": [{"code": 1}], "ok": "x"}) == {"a": {"token": "••••", "n": 1}, "l": [{"code": "••••"}], "ok": "x"}
    assert pol.has_mask({"x": ["a••••b"]}) and not pol.has_mask({"x": ["ab"]})


def test_the_input_is_never_mutated_by_masking():
    src = {"data": {"token": "t"}}
    pol.mask_secrets(src)
    assert src == {"data": {"token": "t"}}


# ---------------------------------------------------------------- sensitive classes and grants

def test_sensitive_classes_by_service_and_by_entity_class_with_their_grants():
    assert pol.sensitive_class_of("alarm_control_panel.alarm_disarm") == "alarm"
    assert pol.sensitive_class_of("lock.unlock") == "lock"
    assert pol.sensitive_class_of("siren.turn_on") == "siren"
    assert pol.sensitive_class_of("cover.open_cover") is None
    assert pol.sensitive_class_of("cover.open_cover", "gate") == "gate"
    assert pol.sensitive_class_of("cover.close_cover", "garage") == "garage"
    assert pol.sensitive_class_of("light.turn_on") is None
    assert pol.sensitive_class_of("switch.turn_on", "siren") == "siren"  # a plain service on a siren-class entity is still the siren class
    assert pol.grant_of("alarm_control_panel.alarm_arm_away") == "alarm.disarm"
    assert pol.grant_of("lock.lock") == "door.unlock"
    assert pol.grant_of("cover.open_cover", "door") == "door.unlock"
    assert pol.grant_of("siren.turn_off") == "ha.entity.control"
    assert pol.grant_of("light.turn_off") is None
    assert set(pol.GRANT_OF_CLASS) == set(pol.SENSITIVE_CLASSES)


# ---------------------------------------------------------------- allow-list

def test_action_classification_roles_never_typed_core_vs_custom_and_notify_allow_list():
    c = pol.classify_action
    assert tuple(c("light.turn_on")) == (True, "device", None)
    assert tuple(c("scene.turn_on")) == (True, "scene", None)
    assert tuple(c("script.turn_on")) == (True, "script", None)
    assert tuple(c("script.good_morning")) == (True, "script", None)
    assert tuple(c("script.toggle")) == (False, None, "service_not_allowed")
    assert tuple(c("automation.trigger")) == (True, "automation", None)
    assert tuple(c("automation.reload")) == (False, None, "service_not_allowed")
    assert tuple(c("automation.toggle")) == (False, None, "service_not_allowed")
    assert tuple(c("notify.anything")) == (True, "notify", None)
    assert tuple(c("notify.anything", ["notify.mobile_app_yoni"])) == (False, None, "service_not_allowed")
    assert tuple(c("notify.mobile_app_yoni", ["notify.mobile_app_yoni"])) == (True, "notify", None)
    for a in ("homeassistant.turn_off", "shell_command.blink", "rest_command.x", "hassio.host_reboot", "recorder.purge", "smplwise_bridge.execute", "light.reload", "scheduler.reload"):
        assert tuple(c(a)) == (False, None, "service_not_allowed"), a
    assert tuple(c("light.some_new_service")) == (False, None, "service_not_allowed")
    assert tuple(c("light.toggle")) == (False, None, "service_not_allowed")  # not in the bridge's ALLOWED_SERVICES (deviation from the TS default list)
    assert tuple(c("timer.start")) == (False, None, "service_not_allowed")
    assert tuple(c("scheduler.run_action")) == (False, None, "custom_service")
    assert tuple(c("browser_mod.popup")) == (False, None, "custom_service")
    assert tuple(c("not a service")) == (False, None, "unknown")
    assert tuple(c("light.turn_on", ["switch.turn_on"])) == (False, None, "service_not_allowed")
    assert "alarm_control_panel.alarm_disarm" in pol.DEFAULT_ALLOWED_ACTIONS


def test_every_builder_device_service_is_an_allowed_service_of_the_bridge_and_a_known_action():
    allowed = init_allowed_services()
    for sid in pol.BUILDER_ACTIONS:
        assert tuple(sid.split(".", 1)) in allowed, sid
        assert sid in ha_bridge.ACTIONS and not ha_bridge.ACTIONS[sid].get("route"), sid
    # sensitive services are ordinary entries and never carry a code argument
    for sid, spec in pol.BUILDER_ACTIONS.items():
        assert all(not pol.is_secret_key(a) for a in spec["args"]), sid
    for sid in ("alarm_control_panel.alarm_disarm", "lock.unlock", "siren.turn_on"):
        assert sid in pol.BUILDER_ACTIONS and pol.BUILDER_ACTIONS[sid]["args"] == {}
    assert not pol.NEVER_TYPED_RE.search("light.turn_on") and all(not pol.NEVER_TYPED_RE.search(s) for s in pol.BUILDER_ACTIONS)


# ---------------------------------------------------------------- arguments

def test_args_fit_is_a_closed_set_and_check_arguments_names_the_problem():
    f = pol.args_fit
    assert f("light.turn_on", "device", {"brightness_pct": 40})
    assert f("light.turn_on", "device", {})
    assert not f("light.turn_on", "device", {"brightness_pct": 140})
    assert not f("light.turn_on", "device", {"rgb_color": [1, 2, 3]})
    assert not f("light.turn_on", "device", {"brightness_pct": True})
    assert f("climate.set_temperature", "device", {"temperature": 23.5})
    assert f("climate.set_hvac_mode", "device", {"hvac_mode": "cool"}) and not f("climate.set_hvac_mode", "device", {"hvac_mode": "boil"})
    assert f("notify.mobile_app_yoni", "notify", {"message": "שלום"}) and not f("notify.mobile_app_yoni", "notify", {"message": "x", "data": {"image": "u"}})
    assert f("script.good_morning", "script", {"percent": 40, "shutters": ["cover.a"]}) and not f("script.good_morning", "script", {"Bad Key": 1})
    assert f("script.turn_on", "script", {"variables": {"a": 1}}) and not f("script.turn_on", "script", {"x": 1})
    assert f("automation.trigger", "automation", {"skip_condition": True}) and not f("automation.trigger", "automation", {"skip_condition": "yes"})

    def codes(*a):
        return [p["code"] for p in pol.check_arguments(*a)]

    assert codes("alarm_control_panel.alarm_disarm", "device", {"code": "1234"}) == ["code_not_allowed"]
    assert codes("notify.x", "notify", {"message": "m", "api_key": "k"}) == ["secret_not_allowed"]
    assert codes("light.turn_on", "device", {"nope": 1}) == ["argument_not_allowed"]
    assert codes("light.turn_on", "device", {"brightness_pct": 400}) == ["invalid_value"]
    assert codes("climate.set_temperature", "device", {}) == ["required"]
    assert codes("cover.set_cover_position", "device", {"position": 50}) == []
    assert codes("script.turn_on", "script", {"x": 1}) == ["argument_not_allowed"]
    assert pol.check_arguments("light.turn_on", "device", {}) == []


def test_catalog_arg_specs_have_hebrew_labels_kinds_and_options():
    specs = {s["key"]: s for s in pol.arg_specs_for_catalog("climate.set_temperature")}
    assert specs["temperature"]["kind"] == "number" and specs["temperature"]["required"] is True and specs["temperature"]["unit"] == "°"
    assert specs["hvac_mode"]["kind"] == "select" and {"value": "cool", "label": "קירור"} in specs["hvac_mode"]["options"]
    assert pol.arg_specs_for_catalog("light.turn_off") == [{"key": "transition", "label": "משך מעבר", "kind": "number", "min": 0, "max": 300, "step": 1, "unit": "שנ׳"}]
    assert pol.arg_specs_for_catalog("switch.turn_on") == []
    assert pol.arg_specs_for_catalog("media_player.volume_mute")[0]["kind"] == "boolean"
    assert [s["key"] for s in pol.arg_specs_for_catalog("notify.x", "notify")] == ["message", "title"]


# ---------------------------------------------------------------- loops and storms

def test_self_trigger_needs_an_overlap_and_no_guard():
    assert pol.self_trigger(["light.a", "sensor.b"], ["light.a", "light.c"], guarded=False) == ["light.a"]
    assert pol.self_trigger(["light.a"], ["light.a"], guarded=True) == []
    assert pol.self_trigger(["sensor.b"], ["light.a"], guarded=False) == []


def test_cycles_across_items_are_found_deterministically():
    nodes = {
        "automation:1": {"entity_id": "automation.one", "watches": {"switch.a"}, "drives": {"switch.b"}},
        "automation:2": {"entity_id": "automation.two", "watches": {"switch.b"}, "drives": {"switch.a"}},  # 1 -> 2 -> 1
        "automation:3": {"entity_id": "automation.three", "watches": {"sensor.x"}, "drives": {"automation.one"}},  # 3 -> 1 (calls it), not in a cycle
        "automation:4": {"entity_id": "automation.four", "watches": {"switch.z"}, "drives": {"switch.z"}},  # a self loop
        "script:5": {"entity_id": "script.five", "watches": set(), "drives": {"light.q"}},
    }
    assert pol.find_cycles(nodes) == [["automation:1", "automation:2"], ["automation:4"]]
    assert pol.find_cycles({}) == []
    chain = {f"a{i}": {"entity_id": f"automation.a{i}", "watches": {f"s{i}"}, "drives": {f"s{(i + 1) % 6}"}} for i in range(6)}
    assert pol.find_cycles(chain) == [sorted(chain)]


# ---------------------------------------------------------------- the schedule suggestion (CR section 5)

def _t(type_, **kw):
    return {"kind": "typed", "type": type_, **kw}


def _svc(action, *ids, **data):
    return {"kind": "typed", "type": "service", "role": "device", "action": action, "entity_ids": list(ids), "data": data}


def test_suggest_schedule_only_for_time_or_sun_triggers_with_plain_device_control():
    base = {"alias": "תאורה בערב", "triggers": [_t("time", at="20:00")], "conditions": [], "actions": [_svc("light.turn_on", "light.salon", brightness_pct=60)]}
    s = pol.suggest_schedule(base, scheduler_present=True)
    assert s and s["schedule_draft"]["name"] == "תאורה בערב" and s["schedule_draft"]["weekdays"] == ["daily"] and s["schedule_draft"]["repeat"] == "repeat"
    assert s["schedule_draft"]["slots"] == [{"start": "20:00:00", "stop": None, "actions": [{"service": "light.turn_on", "entity_id": "light.salon", "data": {"brightness_pct": 60}}]}]
    assert pol.suggest_schedule(base, scheduler_present=False) is None
    sun = {**base, "triggers": [_t("sun", event="sunset", offset_min=-15), _t("time", at="06:30:00")]}
    slots = pol.suggest_schedule(sun, scheduler_present=True)["schedule_draft"]["slots"]
    assert [x["start"] for x in slots] == ["sunset-00:15:00", "06:30:00"]
    wk = {**base, "conditions": [_t("time", weekday=["sun", "thu", "mon"])]}
    assert pol.suggest_schedule(wk, scheduler_present=True)["schedule_draft"]["weekdays"] == ["sun", "mon", "thu"]
    assert pol.suggest_schedule({**base, "conditions": [_t("time", weekday=list(pol.WEEKDAYS))]}, scheduler_present=True)["schedule_draft"]["weekdays"] == ["daily"]
    sh = {**base, "conditions": [_t("shabbat", mode="not_holy_days")]}
    cond = pol.suggest_schedule(sh, scheduler_present=True, shabbat_sensor="binary_sensor.shabbat")["schedule_draft"]["conditions"]
    assert cond["items"] == [{"entity_id": "binary_sensor.shabbat", "attribute": "state", "match_type": "is", "value": "off"}]
    # anything else is no suggestion
    assert pol.suggest_schedule({**base, "triggers": [_t("state", entity_ids=["sensor.a"])]}, scheduler_present=True) is None
    assert pol.suggest_schedule({**base, "actions": [_svc("alarm_control_panel.alarm_arm_away", "alarm_control_panel.home")]}, scheduler_present=True) is None
    assert pol.suggest_schedule({**base, "actions": [_svc("cover.open_cover", "cover.gate")]}, scheduler_present=True, class_of=lambda e: "gate") is None
    assert pol.suggest_schedule({**base, "actions": [{"kind": "typed", "type": "delay", "delay": {"minutes": 1}}]}, scheduler_present=True) is None
    assert pol.suggest_schedule({**base, "conditions": [_t("state", entity_ids=["person.a"], state="home")]}, scheduler_present=True) is None
    assert pol.suggest_schedule({**base, "triggers": [{"kind": "locked", "reason": "device"}]}, scheduler_present=True) is None
