"""CR-017 / bridge 0.6.0: the policy of `smplwise_bridge.config_item` (config_policy.py), decided WITHOUT trusting the add-on and loaded by path (no Home Assistant
needed): the shape of the message per op, the closed block schemas, the builder allow-list and its arguments, secrets and codes at any depth, the rule that makes
delegation safe (a block outside the schemas must be byte-identical to a stored one), extras, the new-schema-only rule, caps, scenes and script fields, the
sensitive flag. Synthetic data only."""
from __future__ import annotations

import copy
import json

import pytest

from bridge_loader import load

policy = load("config_policy")
PolicyError = policy.PolicyError

SECRET_VALUE = "test-key-not-real"


def msg(op="upsert", **kw):
    base = {"upsert": {"kind": "automation", "item_id": "1727700000002", "base_revision": None, "profile": "builder", "config": AUTO(), "preserved": [], "sensitive": False},
            "delete": {"kind": "automation", "item_id": "1727700000002", "base_revision": "0123456789abcdef"}}.get(op, {"kind": "automation", "item_id": "1727700000002"})
    return {"user_id": "u1", "op": op, "request_id": "op-1", "ts": 1, "nonce": "n", "sig": "s", **base, **kw}


def AUTO(**kw):
    c = {"id": "1727700000002", "alias": "תנועה בפרוזדור", "description": "", "triggers": [{"trigger": "state", "entity_id": ["binary_sensor.hall_motion"], "to": "on", "id": "motion"}],
         "conditions": [{"condition": "sun", "after": "sunset"}],
         "actions": [{"action": "light.turn_on", "target": {"entity_id": ["light.hall"]}, "data": {"brightness_pct": 40}}, {"delay": {"hours": 0, "minutes": 3, "seconds": 0}},
                     {"action": "light.turn_off", "target": {"entity_id": ["light.hall"]}}], "mode": "restart"}
    c.update(kw)
    return c


def check(config, *, kind="automation", item_id="1727700000002", profile="builder", preserved=(), stored=None, sensitive=False, attrs=None):
    return policy.validate_config(kind, item_id, config, profile=profile, preserved=frozenset(preserved), stored=stored, sensitive=sensitive, attributes_of=attrs)


def code_of(config, **kw):
    try:
        check(config, **kw)
    except PolicyError as exc:
        return exc.code, exc.path
    return None


# ---------------------------------------------------------------- the message

def test_every_op_has_its_own_closed_key_set_and_unknown_ops_are_refused():
    assert set(policy.OPS) == {"upsert", "delete", "enable", "disable", "trigger", "run_script", "stop_script", "apply_scene"}
    assert policy.validate_message(msg("upsert")).op == "upsert"
    assert policy.validate_message(msg("delete")).base_revision == "0123456789abcdef"
    for op in ("enable", "disable"):
        assert policy.validate_message(msg(op)).kind == "automation"
    for bad in ({"op": "snapshot_scene"}, {"op": "reload"}, {"op": "execute"}, {"op": None}):
        with pytest.raises(PolicyError) as e:
            policy.validate_message({**msg("enable"), **bad})
        assert e.value.code == "op_not_allowed"
    with pytest.raises(PolicyError) as e:
        policy.validate_message({**msg("enable"), "config": {}})  # a key that belongs to another op
    assert (e.value.code, e.value.path) == ("invalid_payload", "config")
    with pytest.raises(PolicyError):
        policy.validate_message({**msg("upsert"), "extra": 1})
    with pytest.raises(PolicyError):
        policy.validate_message({**msg("enable"), "kind": "script"})  # enable is for automations
    with pytest.raises(PolicyError):
        policy.validate_message({**msg("run_script"), "kind": "automation"})


def test_ids_profile_revision_and_fingerprint_formats():
    bad = [{"item_id": "has space"}, {"item_id": "x" * 65}, {"item_id": 5}, {"item_id": ""}, {"profile": "admin"}, {"base_revision": "short"}, {"base_revision": "ZZZZZZZZZZZZZZZZ"},
           {"config": ["not", "a", "dict"]}, {"preserved": ["nothex"]}, {"preserved": "x"}, {"sensitive": "yes"}, {"kind": "blueprint"}, {"request_id": ""}, {"request_id": "x" * 81}]
    for b in bad:
        with pytest.raises(PolicyError):
            policy.validate_message({**msg("upsert"), **b})
    with pytest.raises(PolicyError):
        policy.validate_message({**msg("delete"), "base_revision": None})  # a delete always names the revision it removes
    with pytest.raises(PolicyError):
        policy.validate_message({**msg("upsert", kind="script", item_id="Bad-Key")})  # a script's key is a slug
    assert policy.validate_message(msg("upsert", kind="script", item_id="arx_1727700001234", config={"alias": "s", "sequence": []})).item_id == "arx_1727700001234"
    assert policy.validate_message(msg("upsert", item_id="yaml-style-id_1")).item_id == "yaml-style-id_1"
    p = policy.validate_message(msg("upsert", preserved=["0123456789abcdef", "fedcba9876543210"], sensitive=True, base_revision="0123456789abcdef"))
    assert p.preserved == {"0123456789abcdef", "fedcba9876543210"} and p.sensitive is True and p.profile == "builder"


def test_runtime_ops_variables_skip_condition_and_apply_scene():
    t = policy.validate_message(msg("trigger", skip_condition=False, variables={"who": "yoni", "n": 3}))
    assert t.skip_condition is False and t.variables == {"who": "yoni", "n": 3}
    assert policy.validate_message(msg("trigger")).skip_condition is None
    for bad in ({"variables": {"Bad Key": 1}}, {"variables": {"x": "{{ template }}"}}, {"variables": {"api_key": "k"}}, {"variables": {"code": "1"}}, {"variables": []}, {"skip_condition": "no"}):
        with pytest.raises(PolicyError):
            policy.validate_message(msg("trigger", **bad))
    with pytest.raises(PolicyError) as e:
        policy.validate_message(msg("trigger", variables={"code": "1234"}))
    assert e.value.code == "code_not_allowed"
    assert policy.validate_message({"user_id": "u", "op": "apply_scene", "request_id": "r", "entity_id": "scene.salon_evening", "ts": 1, "nonce": "n", "sig": "s"}).entity_id == "scene.salon_evening"
    for bad in ("light.hall", "scene.", "scene.Bad", None):
        with pytest.raises(PolicyError):
            policy.validate_message({"user_id": "u", "op": "apply_scene", "request_id": "r", "entity_id": bad, "ts": 1, "nonce": "n", "sig": "s"})


# ---------------------------------------------------------------- a clean builder write

def test_a_plain_builder_automation_passes_and_reports_its_targets():
    facts = check(AUTO())
    assert facts.targets == ["light.hall"] and facts.sensitive_services == []
    check({**AUTO(), "max": 5})
    check(AUTO(mode="queued", description="תיאור"))
    # unchanged against the stored item is fine too, and the stored targets are reported for the permission check
    stored = AUTO()
    assert check(AUTO(alias="שם חדש"), stored=stored).stored_targets == ["light.hall"]


def test_head_rules_id_alias_mode_max_icon_and_size():
    assert code_of(AUTO(id="other")) == ("invalid_payload", "id")
    assert code_of({k: v for k, v in AUTO().items() if k != "id"}) == ("invalid_payload", "id")
    assert code_of(AUTO(mode="loop")) == ("invalid_payload", "mode")
    assert code_of(AUTO(max=0)) == ("invalid_payload", "max") and code_of(AUTO(max=True)) == ("invalid_payload", "max") and code_of(AUTO(max=2.5)) == ("invalid_payload", "max")
    assert code_of(AUTO(alias="x" * 121)) == ("invalid_payload", "alias")
    assert code_of(AUTO(alias="x" * 121), profile="code") is None  # the caps are the builder's; an administrator's code view is bounded by the size cap
    assert code_of(AUTO(description="d" * 1001)) == ("invalid_payload", "description")
    assert code_of(AUTO(alias=5)) == ("invalid_payload", "alias")
    big = AUTO(actions=[{"action": "light.turn_on", "target": {"entity_id": ["light.hall"]}, "data": {"brightness_pct": 1}}] + [{"variables": {"v": "x" * 1000}}] * 300)
    assert code_of(big, profile="code") == ("invalid_payload", "config")
    assert code_of(AUTO(triggers=[])) == ("invalid_payload", "triggers") and code_of(AUTO(actions=[])) == ("invalid_payload", "actions")
    assert code_of(AUTO(triggers="x")) == ("invalid_payload", "triggers")


def test_the_new_schema_only_and_extras_are_judged_against_the_stored_item():
    legacy = {"id": "1727700000002", "alias": "x", "trigger": [{"platform": "time", "at": "06:00"}], "action": [{"service": "light.turn_on", "entity_id": "light.hall"}]}
    assert code_of(legacy) == ("legacy_schema", "trigger") and code_of(legacy, profile="code") == ("legacy_schema", "trigger")
    assert code_of({**AUTO(), "condition": []}) == ("legacy_schema", "condition")
    # an extra top-level key (variables, trace, ...) must equal the stored one in the builder profile: kept, never authored
    stored = AUTO(variables={"room": "salon"}, trace={"stored_traces": 10})
    assert check(copy.deepcopy(stored), stored=stored)
    assert code_of(AUTO(variables={"room": "salon"})) == ("preserved_mismatch", "variables")  # a create cannot carry one
    assert code_of(AUTO(variables={"room": "kitchen"}, trace={"stored_traces": 10}), stored=stored) == ("preserved_mismatch", "variables")
    assert code_of(AUTO(variables={"room": "salon"}), stored=stored) == ("preserved_mismatch", "trace")  # dropping a stored extra is not a builder edit either
    assert code_of(AUTO(variables={"room": "salon"}), stored=stored, profile="code") is None  # the code view may
    assert code_of(AUTO(variables={"room": "kitchen"}), profile="code", stored=stored) is None  # the code view may change an extra
    assert code_of(AUTO(variables={"api_key": SECRET_VALUE}), profile="code")[0] == "secret_not_allowed"
    assert code_of(AUTO(note="n"), profile="code") is None


# ---------------------------------------------------------------- the allow-list and its arguments

def action(raw):
    return AUTO(actions=[raw])


def test_services_outside_the_allow_list_are_refused_as_new_content():
    never = ["homeassistant.restart", "shell_command.blink", "rest_command.x", "hassio.host_reboot", "recorder.purge", "smplwise_bridge.execute", "light.reload", "scheduler.reload",
             "automation.reload", "script.reload", "scene.reload"]
    for svc in never:
        got = code_of(action({"action": svc, "target": {"entity_id": ["light.hall"]}}))
        assert got and got[0] == "preserved_mismatch", svc  # not typed -> the builder may only keep what is stored
        got = code_of(action({"action": svc}), profile="code", sensitive=False)
        assert (got and got[0] == "service_not_allowed") if svc.startswith("smplwise_bridge.") else got is None, svc
    for svc in ("light.toggle", "timer.start", "scheduler.run_action", "browser_mod.popup", "light.some_new_service", "cover.open_cover_tilt"):
        assert code_of(action({"action": svc, "target": {"entity_id": ["light.hall"]}}))[0] == "preserved_mismatch", svc
    for svc in ("light.turn_on", "alarm_control_panel.alarm_disarm", "lock.unlock", "siren.turn_on", "media_player.turn_off", "input_boolean.turn_on", "climate.turn_off", "switch.turn_on"):
        sens = svc.split(".")[0] in ("alarm_control_panel", "lock", "siren")
        assert code_of(action({"action": svc, "target": {"entity_id": ["x.y"]}}), sensitive=sens) is None, svc
    assert code_of(action({"action": "scene.turn_on", "target": {"entity_id": ["scene.a"]}})) is None
    assert code_of(action({"action": "script.good_morning", "data": {"percent": 40, "shutters": ["cover.a"]}})) is None
    assert code_of(action({"action": "script.toggle", "target": {"entity_id": ["script.a"]}}))[0] == "preserved_mismatch"
    assert code_of(action({"action": "automation.trigger", "target": {"entity_id": ["automation.a"]}, "data": {"skip_condition": True}})) is None
    assert code_of(action({"action": "automation.toggle", "target": {"entity_id": ["automation.a"]}}))[0] == "preserved_mismatch"
    assert code_of(action({"action": "notify.mobile_app_yoni", "data": {"message": "שלום"}})) is None


def test_arguments_are_a_closed_set_with_ranges_and_never_a_code():
    ok = lambda svc, data, ids=("light.hall",): code_of(action({"action": svc, "target": {"entity_id": list(ids)}, "data": data}), sensitive=True)  # noqa: E731
    assert ok("light.turn_on", {"brightness_pct": 100}) is None and ok("light.turn_on", {}) is None
    assert ok("light.turn_on", {"brightness_pct": 101})[0] == "preserved_mismatch"
    assert ok("light.turn_on", {"rgb_color": [1, 2, 3]})[0] == "preserved_mismatch"
    assert ok("light.turn_on", {"brightness_pct": True})[0] == "preserved_mismatch"
    assert ok("climate.set_hvac_mode", {"hvac_mode": "cool"}) is None and ok("climate.set_hvac_mode", {"hvac_mode": "boil"})[0] == "preserved_mismatch"
    assert ok("climate.set_temperature", {"temperature": 23.5}) is None
    assert ok("alarm_control_panel.alarm_disarm", {"code": "1234"}, ["alarm_control_panel.home"])[0] == "preserved_mismatch"
    assert ok("lock.unlock", {"pin": "1234"}, ["lock.front"])[0] == "preserved_mismatch"
    assert ok("light.turn_on", {"brightness_pct": "{{ x }}"})[0] == "preserved_mismatch"
    # a script's own service takes plain field data; a secret-like field name is not plain
    assert code_of(action({"action": "script.good_morning", "data": {"api_key": "k"}}))[0] == "preserved_mismatch"
    assert code_of(action({"action": "script.good_morning", "data": {"percent": 40}, "continue_on_error": True}))[0] == "preserved_mismatch"
    assert code_of(action({"action": "light.turn_on", "target": {"area_id": "salon"}}))[0] == "preserved_mismatch"
    assert code_of(action({"action": "light.turn_on", "target": {"entity_id": "{{ x }}"}}))[0] == "preserved_mismatch"
    assert code_of(action({"action": "light.turn_on", "target": {"entity_id": ["light.hall"]}, "enabled": False}))[0] == "preserved_mismatch"


# ---------------------------------------------------------------- the rule that makes delegation safe

LOCKED_TRIGGER = {"trigger": "device", "domain": "wall_switch", "device_id": "2f1c9a07", "type": "button_1_short", "id": "short"}
TEMPLATE_ACTION = {"action": "light.turn_on", "target": {"entity_id": "{{ trigger.to_state.attributes.room_light }}"}}


def test_a_block_outside_the_schemas_must_be_stored_and_preserved_in_the_builder_profile():
    stored = AUTO(triggers=[LOCKED_TRIGGER], actions=[TEMPLATE_ACTION, {"action": "light.turn_off", "target": {"entity_id": ["light.hall"]}}])
    fp_t, fp_a = policy.fingerprint_of(LOCKED_TRIGGER), policy.fingerprint_of(TEMPLATE_ACTION)
    same = copy.deepcopy(stored)
    assert check(same, stored=stored, preserved=[fp_t, fp_a])
    assert code_of(same, stored=stored, preserved=[fp_t]) == ("preserved_mismatch", "actions[0]")  # kept but not declared
    assert code_of(same, stored=stored, preserved=[]) == ("preserved_mismatch", "triggers[0]")
    # declared but not in the stored item: a delegated user cannot AUTHOR a locked block, however he spells the claim
    assert code_of(same, stored=AUTO(), preserved=[fp_t, fp_a]) == ("preserved_mismatch", "triggers[0]")
    assert code_of(same, stored=None, preserved=[fp_t, fp_a]) == ("preserved_mismatch", "triggers[0]")
    # the stored block edited by one character is a different block
    edited = copy.deepcopy(stored)
    edited["triggers"][0]["type"] = "button_2_short"
    assert code_of(edited, stored=stored, preserved=[fp_t, fp_a, policy.fingerprint_of(edited["triggers"][0])]) == ("preserved_mismatch", "triggers[0]")
    # moving or removing a stored block is allowed
    moved = copy.deepcopy(stored)
    moved["actions"].reverse()
    assert check(moved, stored=stored, preserved=[fp_t, fp_a])
    removed = copy.deepcopy(stored)
    removed["actions"].pop(0)
    assert check(removed, stored=stored, preserved=[fp_t])
    # a block of ANOTHER item is not this item's (the stored set is of this item only)
    other = AUTO(triggers=[LOCKED_TRIGGER])
    assert code_of(AUTO(triggers=[LOCKED_TRIGGER], actions=[TEMPLATE_ACTION]), stored=other, preserved=[fp_t, fp_a]) == ("preserved_mismatch", "actions[0]")


def test_the_same_rule_holds_inside_containers_and_a_typed_container_with_a_stored_child_is_fine():
    child = {"action": "scheduler.run_action", "data": {"x": 1}}
    stored = AUTO(actions=[{"choose": [{"conditions": [{"condition": "trigger", "id": ["motion"]}], "sequence": [child, {"action": "light.turn_off", "target": {"entity_id": ["light.hall"]}}]}],
                            "default": [{"delay": {"seconds": 5}}]}])
    fp = policy.fingerprint_of(child)
    assert check(copy.deepcopy(stored), stored=stored, preserved=[fp])
    edited = copy.deepcopy(stored)
    edited["actions"][0]["default"] = [{"delay": {"seconds": 9}}]  # an edit next to the stored child (the container changes, the child stays)
    assert check(edited, stored=stored, preserved=[fp])
    smuggled = copy.deepcopy(stored)
    smuggled["actions"][0]["choose"][0]["sequence"].append({"action": "scheduler.disable_all"})
    assert code_of(smuggled, stored=stored, preserved=[fp, policy.fingerprint_of({"action": "scheduler.disable_all"})]) == ("preserved_mismatch", "actions[0].choose[0].sequence[2]")
    # a container the schemas do not know (an extra key) is a block outside the schemas as a whole
    odd = {"choose": [{"conditions": [], "sequence": [{"delay": {"seconds": 1}}]}], "alias": "ok", "metadata": {}, "something": 1}
    assert code_of(AUTO(actions=[odd]))[0] == "preserved_mismatch"
    # one nesting level of and / or / not
    nested = {"condition": "and", "conditions": [{"condition": "or", "conditions": []}]}
    assert code_of(AUTO(conditions=[nested]))[0] == "preserved_mismatch"
    assert code_of(AUTO(conditions=[{"condition": "not", "conditions": [{"condition": "state", "entity_id": ["person.a"], "state": "home"}]}])) is None
    # a condition used as a step, with a stored locked child
    step = {"condition": "and", "conditions": [{"condition": "template", "value_template": "{{ true }}"}, {"condition": "state", "entity_id": "person.a", "state": "home"}]}
    st2 = AUTO(actions=[step, {"delay": {"seconds": 1}}])
    assert check(copy.deepcopy(st2), stored=st2, preserved=[policy.fingerprint_of(step["conditions"][0])])
    # depth beyond the builder's cap
    deep = {"delay": {"seconds": 1}}
    for _ in range(6):
        deep = {"repeat": {"count": 2, "sequence": [deep]}}
    assert code_of(AUTO(actions=[deep])) == ("invalid_payload", "actions[0].repeat.sequence[0].repeat.sequence[0].repeat.sequence[0].repeat.sequence[0].repeat.sequence[0]")
    assert code_of(AUTO(actions=[deep]), profile="code") is None


def test_the_code_profile_may_author_any_block_but_never_a_code_a_secret_or_a_call_of_the_bridge():
    tpl = AUTO(triggers=[{"trigger": "template", "value_template": "{{ states('sensor.lux') | int < 20 }}"}], actions=[TEMPLATE_ACTION])
    assert code_of(tpl) is not None and code_of(tpl, profile="code") is None
    assert code_of(action({"action": "notify.pushover", "data": {"message": "m", "api_key": SECRET_VALUE}}), profile="code") == ("secret_not_allowed", "actions[0]")
    assert code_of(action({"action": "alarm_control_panel.alarm_disarm", "target": {"entity_id": ["alarm_control_panel.home"]}, "data": {"code": "1234"}}), profile="code", sensitive=True) == ("code_not_allowed", "actions[0]")
    assert code_of(AUTO(triggers=[{"trigger": "template", "value_template": "{{ x }}", "token": "t"}]), profile="code") == ("secret_not_allowed", "triggers[0]")
    assert code_of(action({"action": "smplwise_bridge.config_item", "data": {"op": "delete"}}), profile="code") == ("service_not_allowed", "actions[0]")
    # a secret that is ALREADY stored is kept (the old block, byte for byte), in either profile
    stored = AUTO(actions=[{"action": "notify.pushover", "data": {"message": "m", "api_key": SECRET_VALUE}}])
    fp = policy.fingerprint_of(stored["actions"][0])
    assert check(copy.deepcopy(stored), stored=stored, preserved=[fp]) and check(copy.deepcopy(stored), stored=stored, profile="code")
    changed = copy.deepcopy(stored)
    changed["actions"][0]["data"]["message"] = "n"
    assert code_of(changed, stored=stored, profile="code")[0] == "secret_not_allowed"
    assert code_of(changed, stored=stored, preserved=[fp, policy.fingerprint_of(changed["actions"][0])])[0] == "preserved_mismatch"


def test_fingerprints_ignore_key_order_and_float_spelling_like_the_addons():
    a = {"b": 1, "a": {"d": 2.0, "c": [1.0, {"z": 1, "y": 2}]}}
    b = {"a": {"c": [1, {"y": 2, "z": 1}], "d": 2}, "b": 1}
    assert policy.canonical_json(a) == policy.canonical_json(b) == '{"a":{"c":[1,{"y":2,"z":1}],"d":2},"b":1}'
    assert policy.fingerprint_of(a) == policy.fingerprint_of(b) and len(policy.fingerprint_of(a)) == 16
    assert policy.revision_of(a) == policy.fingerprint_of(a)


# ---------------------------------------------------------------- the sensitive flag

def test_a_config_that_calls_an_alarm_a_lock_a_siren_or_a_door_cover_must_declare_sensitive():
    disarm = action({"action": "alarm_control_panel.alarm_disarm", "target": {"entity_id": ["alarm_control_panel.home"]}})
    assert code_of(disarm, sensitive=False) == ("sensitive_flag_mismatch", "actions")
    assert code_of(disarm, sensitive=True) is None
    assert code_of(action({"action": "lock.lock", "target": {"entity_id": ["lock.front"]}}), sensitive=False)[0] == "sensitive_flag_mismatch"
    assert code_of(action({"action": "siren.turn_on", "target": {"entity_id": ["siren.x"]}}), sensitive=False)[0] == "sensitive_flag_mismatch"
    gate = action({"action": "cover.open_cover", "target": {"entity_id": ["cover.gate"]}})
    assert code_of(gate, sensitive=False) is None  # without the entity's class nothing is recognisable
    assert code_of(gate, sensitive=False, attrs=lambda e: {"device_class": "gate"})[0] == "sensitive_flag_mismatch"
    assert code_of(gate, sensitive=False, attrs=lambda e: {"device_class": "shutter"}) is None
    assert code_of(AUTO(), sensitive=True) is None  # declaring more than needed is harmless
    # a sensitive step inside a stored locked block counts as well
    stored = AUTO(actions=[{"action": "alarm_control_panel.alarm_arm_away", "target": {"entity_id": ["alarm_control_panel.home"]}, "continue_on_error": True}])
    fp = policy.fingerprint_of(stored["actions"][0])
    assert code_of(copy.deepcopy(stored), stored=stored, preserved=[fp], sensitive=False)[0] == "sensitive_flag_mismatch"
    assert check(copy.deepcopy(stored), stored=stored, preserved=[fp], sensitive=True).sensitive_services == ["alarm_control_panel.alarm_arm_away"]


# ---------------------------------------------------------------- hostile documents

def test_a_hostile_deep_document_is_refused_not_a_recursion_error():
    deep: object = "x"
    for _ in range(3000):
        deep = [deep]
    for profile in ("builder", "code"):
        assert code_of(AUTO(variables=deep), profile=profile) == ("invalid_payload", "config")
    nested_ok = {"a": {"b": {"c": [1, 2, {"d": 3}]}}}
    assert code_of(AUTO(variables=nested_ok), profile="code") is None


# ---------------------------------------------------------------- caps (the builder profile)

def test_caps_triggers_conditions_steps_targets():
    many = [{"trigger": "time", "at": "20:00:00"}] * 21
    assert code_of(AUTO(triggers=many)) == ("invalid_payload", "triggers") and code_of(AUTO(triggers=many), profile="code") is None
    assert code_of(AUTO(conditions=[{"condition": "sun", "after": "sunset"}] * 21)) == ("invalid_payload", "conditions")
    steps = [{"delay": {"seconds": 1}}] * 61
    assert code_of(AUTO(actions=steps)) == ("invalid_payload", "actions")
    wide = AUTO(actions=[{"action": "light.turn_on", "target": {"entity_id": [f"light.l{i}" for i in range(51)]}}])
    assert code_of(wide) == ("invalid_payload", "actions") and code_of(wide, profile="code") is None


# ---------------------------------------------------------------- scripts and scenes

def script(**kw):
    c = {"alias": "תריסים", "description": "", "mode": "single", "sequence": [{"action": "cover.open_cover", "target": {"entity_id": ["cover.salon_shutter"]}}]}
    c.update(kw)
    return c


def test_scripts_have_no_id_closed_fields_and_the_same_block_rules():
    assert check(script(), kind="script", item_id="good_morning").targets == ["cover.salon_shutter"]
    assert code_of(script(id="x"), kind="script", item_id="good_morning") == ("invalid_payload", "id")
    assert code_of({**script(), "sequence": []}, kind="script", item_id="x") == ("invalid_payload", "sequence")
    fields = {"percent": {"name": "אחוז", "description": "d", "required": True, "default": 50, "selector": {"number": {"min": 0, "max": 100, "step": 10, "unit_of_measurement": "%", "mode": "slider"}}},
              "side": {"name": "צד", "selector": {"select": {"options": ["a", "b"]}}}, "who": {"name": "מי", "selector": {"entity": {"domain": "person"}}}, "x": {"name": "t", "selector": {"text": {"maxlength": 20}}},
              "b": {"name": "b", "default": False, "selector": {"boolean": {}}}}
    assert check(script(fields=fields), kind="script", item_id="x")
    for bad in ({"percent": {"name": "x", "selector": {"number": {"min": 5, "max": 1}}}}, {"p": {"name": "x", "selector": {"time": {}}}}, {"Bad": {"name": "x", "selector": {"boolean": {}}}},
                {"p": {"name": "x", "selector": {"select": {"options": []}}}}, {"p": {"name": "x", "selector": {"boolean": {}}, "api_key": "k"}}, {"p": {"name": "x", "selector": {"entity": {"integration": "x"}}}},
                {"p": {"name": "x", "default": "{{ t }}", "selector": {"boolean": {}}}}):
        assert code_of(script(fields=bad), kind="script", item_id="x") is not None, bad
    stored = script(fields={"p": {"name": "x", "selector": {"time": {}}}})  # a stored field the builder does not model is kept as it is
    assert check(copy.deepcopy(stored), kind="script", item_id="x", stored=stored)
    assert code_of(script(fields={"p": {"name": "y", "selector": {"time": {}}}}), kind="script", item_id="x", stored=stored) is not None
    assert code_of(script(fields={f"f{i}": {"name": "n", "selector": {"boolean": {}}} for i in range(13)}), kind="script", item_id="x") == ("invalid_payload", "fields")


def scene(**kw):
    c = {"id": "1727700000200", "name": "ברוכים הבאים", "icon": "mdi:home-heart", "entities": {"light.entry": {"state": "on", "brightness": 204, "color_temp_kelvin": 3000}, "lock.front": "locked"}}
    c.update(kw)
    return c


def test_scene_members_are_capture_domains_with_known_attributes_and_never_an_alarm():
    facts = check(scene(), kind="scene", item_id="1727700000200")
    assert facts.targets == ["light.entry", "lock.front"]
    assert code_of(scene(entities={"alarm_control_panel.home": {"state": "disarmed"}}), kind="scene", item_id="1727700000200")[0] == "service_not_allowed"
    assert code_of(scene(entities={"sensor.a": {"state": "on"}}), kind="scene", item_id="1727700000200")[0] == "service_not_allowed"
    assert code_of(scene(entities={"light.a": {"state": "on", "effect": "rainbow"}}), kind="scene", item_id="1727700000200")[0] == "argument_not_allowed"
    assert code_of(scene(entities={"light.a": {"state": "on", "code": "1"}}), kind="scene", item_id="1727700000200")[0] == "code_not_allowed"
    assert code_of(scene(entities={"light.a": {"brightness": 1}}), kind="scene", item_id="1727700000200") == ("invalid_payload", "entities.light.a")
    assert code_of(scene(entities={}), kind="scene", item_id="1727700000200") == ("invalid_payload", "entities")
    assert code_of(scene(name=""), kind="scene", item_id="1727700000200") == ("invalid_payload", "name")
    assert code_of(scene(id="other"), kind="scene", item_id="1727700000200") == ("invalid_payload", "id")
    # a stored member with an attribute the builder does not model stays as it is
    stored = scene(entities={"light.a": {"state": "on", "effect": "rainbow"}})
    assert check(copy.deepcopy(stored), kind="scene", item_id="1727700000200", stored=stored)
    assert code_of(scene(entities={"light.a": {"state": "on", "effect": "fire"}}), kind="scene", item_id="1727700000200", stored=stored)[0] == "argument_not_allowed"
    assert code_of(scene(metadata={"x": 1}), kind="scene", item_id="1727700000200")[0] == "preserved_mismatch"  # an extra key of a scene is kept, never authored by a builder save
    assert code_of(scene(entities={f"light.l{i}": "on" for i in range(101)}), kind="scene", item_id="1727700000200") == ("invalid_payload", "entities")
