"""CR-017: the ADD-ON's automation policy and block model (services/automation_policy.py, services/automation_model.py) and the BRIDGE's independent copy
(config_policy.py) must not drift. Same services (a subset of the bridge's ALLOWED_SERVICES) with the same closed arguments and ranges, the same refusal
words, the same secret keys, the same canonical JSON and fingerprints, the same caps - and, over every block of the whole seed and of mutations of each, the
same answer to "is this block inside the builder's schemas?" (typed on one side exactly when authorable on the other). Also the structural facts of the bridge:
version, schema keys vs op key sets, services.yaml, strings, registration and unload, and that `execute` was not widened. Synthetic data only."""
from __future__ import annotations

import ast
import copy
import json
import re
from pathlib import Path

import pytest
import yaml

import automations_seed as seed
from bridge_loader import MIRROR, REPO, SRC, init_allowed_services, init_tree, load
from fake_ha_config import FakeHaConfig
from smplwise.services import automation_model as am
from smplwise.services import automation_policy as pol
from smplwise.services import ha_bridge
from smplwise.services.automation_text import ModelContext

bp = load("config_policy")
const = load("const")


@pytest.fixture(scope="module")
def house():
    return FakeHaConfig.seed_probe_like()


# ---------------------------------------------------------------- services and arguments

def _bridge_specs(args):
    return {a.name: a.as_spec() for a in args}


def test_same_services_same_closed_arguments_and_ranges():
    assert set(pol.BUILDER_ACTIONS) == set(bp.DEVICE_ACTIONS)
    for sid, spec in pol.BUILDER_ACTIONS.items():
        assert pol.BUILDER_ACTIONS[sid]["args"] == _bridge_specs(bp.DEVICE_ACTIONS[sid]), sid
    assert set(pol.ROLE_ACTIONS) == set(bp.ROLE_ACTIONS)
    for sid in pol.ROLE_ACTIONS:
        assert pol.ROLE_ACTIONS[sid]["args"] == _bridge_specs(bp.ROLE_ACTIONS[sid]), sid
    assert pol.NOTIFY_ARGS == _bridge_specs(bp.NOTIFY_ARGS)
    assert pol.BUILDER_DEVICE_SERVICES == bp.BUILDER_SERVICES


def test_the_builder_services_are_inside_the_bridges_allowed_services_and_the_add_ons_action_table():
    allowed = init_allowed_services()
    for sid in bp.DEVICE_ACTIONS:
        assert tuple(sid.split(".", 1)) in allowed, sid
        assert sid in ha_bridge.ACTIONS and not ha_bridge.ACTIONS[sid].get("route"), sid
    for sid in ("scene.turn_on", "script.turn_on"):
        assert tuple(sid.split(".", 1)) in allowed
    # `execute` was not widened by this bridge version: nothing of the authoring layer (and nothing administrative) is executable through it
    assert not {d for d, _ in allowed} & {"automation", "notify", "homeassistant", "shell_command", "rest_command", "hassio", "recorder", "smplwise_bridge", "scheduler"}


def test_same_refusal_words_secret_keys_and_sensitive_classes():
    assert bp.NEVER_TYPED_RE.pattern == pol.NEVER_TYPED_RE.pattern
    assert bp.SENSITIVE_ACTION_RE.pattern == pol.SENSITIVE_ACTION_RE.pattern
    assert set(bp.SENSITIVE_COVER_CLASSES) == {"door", "garage", "gate"} == {c for c in pol.SENSITIVE_CLASSES if c in ("door", "garage", "gate")}
    assert set(bp.SCENE_CAPTURE_DOMAINS) == set(am.SCENE_CAPTURE_DOMAINS)
    keys = ["code", "password", "passwd", "token", "access_token", "api_key", "apikey", "apiKey", "secret", "pin", "alarm-code", "PIN", "shipping", "unicode", "encoded", "message", "entity_id",
            "brightness_pct", "tokenizer_x", "Code", "alarmCode", "my_pin_code", "pincode", "api", "key", "keyboard", "secretary", "secret_word", "ApiKeyValue"]
    for k in keys:
        assert bp.is_secret_key(k) == pol.is_secret_key(k), k
    corpus = [{"a": {"alarm_code": 1}}, {"a": [{"token": 1}]}, {"x": {"y": {"api_key": 1}}}, {"ok": {"message": "x"}}, [], "str", 5, {"code": 1, "token": 2}, [{"pin": 1}, {"b": 2}]]
    for v in corpus:
        assert bp.secret_kind(v) == pol.secret_kind(v), v
    for v in ("{{ x }}", "{% if %}", "{# c #}", "plain", ["{{ x }}"], {"a": "{{ x }}"}, {"a": 1}):
        assert bp.has_template(v) == pol.has_template(v)


def test_same_canonical_json_fingerprints_and_revisions_on_every_seed_item_and_edge_values(house):
    for items in (house.automations, list(house.scripts.values()), house.scenes):
        for c in items:
            assert bp.canonical_json(c) == am.canonical_json(c) and bp.fingerprint_of(c) == am.fingerprint_of(c) and bp.revision_of(c) == am.revision_of(c)
    for v in ({"t": 24.0, "u": 23.5, "z": [1.0, 2.5]}, {"s": "עברית ✓   \U0001f600"}, {"b": True, "n": None}, {"big": 1e21, "small": 1e-7}, [3, 2, 1], "x"):
        assert bp.canonical_json(v) == am.canonical_json(v), v


def test_the_sensitive_flag_rule_is_the_same_function_on_both_sides():
    attrs = {"cover.gate": {"device_class": "gate"}, "cover.shutter": {"device_class": "shutter"}, "cover.door": {"device_class": "door"}, "cover.none": {}}
    cases = [(["alarm_control_panel.alarm_disarm"], []), (["lock.lock"], []), (["siren.turn_on"], []), (["light.turn_on"], ["light.a"]), (["cover.open_cover"], ["cover.gate"]),
             (["cover.open_cover"], ["cover.shutter"]), (["cover.close_cover"], ["cover.door"]), (["cover.open_cover"], ["cover.none"]), (["cover.open_cover"], ["cover.missing"]),
             (["switch.turn_on"], ["switch.a"]), ([], []), (["alarm_control_panel.alarm_trigger"], []), (["lock.open"], [])]
    for services, ents in cases:
        for lookup in (None, attrs.get):
            assert bp.sensitive_required(list(services), list(ents), lookup) == pol.sensitive_required(services, ents, lookup), (services, ents)
    assert bp.SENSITIVE_COVER_CLASSES == pol.SENSITIVE_COVER_CLASSES


def test_same_caps():
    for k_bridge, k_addon in (("alias", "alias_max"), ("description", "description_max"), ("triggers", "triggers_max"), ("conditions", "conditions_max"), ("steps", "steps_max"),
                              ("depth", "depth_max"), ("targets", "targets_max"), ("fields", "fields_max"), ("members", "members_max"), ("options", "choose_options_max")):
        assert bp.CAPS[k_bridge] == pol.CAPS[k_addon], k_bridge
    assert bp.MODES == pol.MODES and bp.WEEKDAYS == pol.WEEKDAYS
    assert set(bp.MANAGED_KEYS["automation"]) | set(bp.LEGACY_KEYS["automation"]) == set(am.AUTOMATION_MANAGED)
    assert set(bp.MANAGED_KEYS["script"]) == set(am.SCRIPT_MANAGED) and set(bp.MANAGED_KEYS["scene"]) == set(am.SCENE_MANAGED)


# ---------------------------------------------------------------- the block classification: typed on the add-on's side == authorable on the bridge's

def _check_block(block, section, in_group, where, problems):
    """Compare one add-on block with the bridge's judgment of its raw; descend into typed containers the way both sides do."""
    raw = block["raw"]
    typed = block["kind"] == "typed"
    if section == "action" and typed and block.get("type") == "condition":
        authorable = bp.condition_authorable(raw)
    elif section == "trigger":
        authorable = bp.trigger_authorable(raw)
    elif section == "condition":
        authorable = bp.condition_authorable(raw, in_group)
    else:
        authorable = bp.action_authorable(raw)
    if authorable != typed:
        problems.append((where, "typed" if typed else block.get("reason"), "authorable" if authorable else "outside", json.dumps(raw, ensure_ascii=False)[:160]))
    if not typed:
        return
    for name, kids, sec in am.child_lists(block):
        group = block.get("type") in ("and", "or", "not") or (section == "action" and block.get("type") == "condition")
        for i, kid in enumerate(kids):
            _check_block(kid, sec, group and sec == "condition", f"{where}.{name}[{i}]", problems)
    if section == "action" and block.get("type") == "condition":
        _check_block(block["condition"], "condition", False, f"{where}.condition", problems)


def _compare_config(kind, config, ctx, problems, label):
    d = am.config_to_draft(kind, config, ctx).draft
    if kind == "automation":
        for i, b in enumerate(d["triggers"]):
            _check_block(b, "trigger", False, f"{label}.triggers[{i}]", problems)
        for i, b in enumerate(d["conditions"]):
            _check_block(b, "condition", False, f"{label}.conditions[{i}]", problems)
        for i, b in enumerate(d["actions"]):
            _check_block(b, "action", False, f"{label}.actions[{i}]", problems)
    elif kind == "script":
        for i, b in enumerate(d["sequence"]):
            _check_block(b, "action", False, f"{label}.sequence[{i}]", problems)


def test_typed_blocks_are_exactly_the_authorable_ones_on_every_seed_item(house):
    ctx = ModelContext(shabbat_sensor=seed.SHABBAT_SENSOR)
    problems: list = []
    n = 0
    for kind, items in (("automation", house.automations), ("script", list(house.scripts.values()))):
        for c in items:
            _compare_config(kind, c, ctx, problems, f"{kind}:{c.get('id') or c.get('alias')}")
            n += 1
    assert n == len(house.automations) + len(house.scripts)
    assert problems == []


def _variants(raw):
    """Small mutations of one block: the cases where the two implementations could disagree."""
    if not isinstance(raw, dict):
        return
    yield {**raw, "extra_key": 1}
    yield {**raw, "enabled": False}
    yield {**raw, "enabled": True}
    yield {**raw, "enabled": "yes"}
    yield {**raw, "continue_on_error": True}
    yield {**raw, "alias": "name"}
    yield {**raw, "metadata": {}}
    yield {**raw, "api_key": "k"}
    yield {**raw, "id": 5}
    yield {**raw, "data": {"rgb_color": [1, 2, 3]}}
    yield {**raw, "data": {"brightness_pct": 150}}
    yield {**raw, "data": {"code": "1"}}
    yield {**raw, "target": {"area_id": "x"}}
    yield {**raw, "target": {"entity_id": "{{ x }}"}}
    yield {**raw, "target": {"entity_id": ["light.a", "Bad Id"]}}
    for k in list(raw):
        yield {kk: v for kk, v in raw.items() if kk != k}
        if isinstance(raw[k], str):
            yield {**raw, k: raw[k] + "{{ t }}"}
            yield {**raw, k: ""}
        if isinstance(raw[k], (int, float)) and not isinstance(raw[k], bool):
            yield {**raw, k: -5}
            yield {**raw, k: 1.5}
            yield {**raw, k: "5"}
        if isinstance(raw[k], list):
            yield {**raw, k: []}
        if isinstance(raw[k], dict):
            yield {**raw, k: {}}
            yield {**raw, k: {**raw[k], "zzz": 1}}
        yield {**raw, k: None}
        yield {**raw, k: True}


def test_the_same_answer_over_mutations_of_every_block_of_the_seed(house):
    """Mutate each top-level block (trigger, condition, action step) of every seed item and compare the add-on's parse with the bridge's judgment."""
    ctx = ModelContext(shabbat_sensor=seed.SHABBAT_SENSOR)
    problems: list = []
    n = 0
    for c in house.automations:
        for section_key, section in (("triggers", "trigger"), ("trigger", "trigger"), ("conditions", "condition"), ("condition", "condition"), ("actions", "action"), ("action", "action")):
            for raw in c.get(section_key) or []:
                for v in _variants(raw):
                    parse = {"trigger": am.parse_trigger, "condition": am.parse_condition, "action": am.parse_action}[section]
                    blk = parse(copy.deepcopy(v), ctx)
                    bridge = {"trigger": bp.trigger_authorable, "condition": lambda r: bp.condition_authorable(r, False), "action": bp.action_authorable}[section](v)
                    typed = blk["kind"] == "typed"
                    n += 1
                    if bridge != typed:
                        problems.append((section, "typed" if typed else blk.get("reason"), "authorable" if bridge else "outside", json.dumps(v, ensure_ascii=False)[:200]))
    assert n > 1500
    assert problems == [], problems[:8]


def test_services_classification_is_the_same_for_a_corpus_of_names():
    names = ["light.turn_on", "light.toggle", "scene.turn_on", "script.turn_on", "script.my_script", "script.toggle", "script.reload", "automation.trigger", "automation.reload", "automation.toggle",
             "notify.mobile_app_x", "notify.notify", "homeassistant.restart", "shell_command.x", "rest_command.x", "hassio.x", "recorder.purge", "smplwise_bridge.execute", "scheduler.run_action",
             "browser_mod.popup", "light.reload", "timer.start", "x.reload_all", "not a service", "alarm_control_panel.alarm_disarm", "alarm_control_panel.alarm_trigger", "lock.open", "siren.turn_on",
             "cover.open_cover", "cover.open_cover_tilt", "climate.set_temperature", "media_player.play_media", "select.select_option", "persistent_notification.create"]
    for a in names:
        mine = pol.classify_action(a)
        role, reason = bp.classify_service(a)
        # the bridge does not tell a custom integration from a core service that is not allowed (a label for the add-on's sentence); both are "not typed"
        assert mine.role == role and mine.ok == (role is not None) and (role is not None or reason in ("service_not_allowed", "invalid_payload")), (a, tuple(mine), (role, reason))


# ---------------------------------------------------------------- the bridge's structural facts

def _schema_keys(tree) -> set[str]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "CONFIG_ITEM_SCHEMA" for t in node.targets):
            keys = set()
            for sub in ast.walk(node.value):
                if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Attribute) and sub.func.attr in ("Required", "Optional") and sub.args and isinstance(sub.args[0], ast.Constant):
                    keys.add(sub.args[0].value)
            return keys
    raise AssertionError("CONFIG_ITEM_SCHEMA not found")


def test_the_service_schema_services_yaml_and_strings_match_the_op_key_sets():
    union = set().union(*bp.OP_KEYS.values())
    assert _schema_keys(init_tree()) == union
    services = yaml.safe_load((SRC / "services.yaml").read_text(encoding="utf-8"))
    assert set(services["config_item"]["fields"]) == union
    for name in ("strings.json", "translations/en.json", "translations/he.json"):
        data = json.loads((SRC / name).read_text(encoding="utf-8"))
        assert "config_item" in data["services"] and data["services"]["config_item"]["name"] and data["services"]["config_item"]["description"], name
        init = data["options"]["step"]["init"]
        assert init["title"] and init["description"] and init["data"][const.CONF_DELEGATED_AUTHORING], name
    he = json.loads((SRC / "translations/he.json").read_text(encoding="utf-8"))["options"]["step"]["init"]["data"][const.CONF_DELEGATED_AUTHORING]
    assert "אוטומציות" in he and "שאינם מנהלים" in he and "העורך הפשוט בלבד" in he  # the owner's wording: names the effect plainly


def test_the_service_is_registered_with_a_response_and_removed_on_unload_and_the_switch_is_off_by_default():
    text = (SRC / "__init__.py").read_text(encoding="utf-8")
    assert "SERVICE_CONFIG_ITEM, config_item, schema=CONFIG_ITEM_SCHEMA, supports_response=SupportsResponse.ONLY" in text
    assert "hass.services.async_remove(DOMAIN, SERVICE_CONFIG_ITEM)" in text
    assert 'entry.options.get(CONF_DELEGATED_AUTHORING, False)' in text  # off unless an HA administrator turned it on
    flow = (SRC / "config_flow.py").read_text(encoding="utf-8")
    assert "default=current" in flow and "OptionsFlow" in flow and "async_get_options_flow" in flow
    assert "delegated_authoring" in text and "delegated_changed_at" in text  # the add-on reads the state (and its change time) with the directory push
    assert const.SERVICE_CONFIG_ITEM == "config_item" and const.CONF_DELEGATED_AUTHORING == "delegated_authoring"


def test_one_version_everywhere_and_the_mirror_equals_the_source():
    manifest = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["version"] == const.VERSION == "0.6.0"
    assert f"const VERSION = '{const.VERSION}'" in (SRC / "www" / "smplwise-card.js").read_text(encoding="utf-8")
    if MIRROR.exists():  # the add-on's build context holds a generated copy (scripts/sync_integration.py)
        assert json.loads((MIRROR / "manifest.json").read_text(encoding="utf-8"))["version"] == const.VERSION
        for name in ("config_policy.py", "config_store.py", "config_service.py", "__init__.py", "config_flow.py", "const.py", "services.yaml"):
            assert (MIRROR / name).read_bytes() == (SRC / name).read_bytes(), name


def test_the_bridge_modules_import_without_home_assistant_and_ban_nothing_they_should_not_use():
    for module in ("config_policy", "config_store"):
        text = (SRC / f"{module}.py").read_text(encoding="utf-8")
        tree = ast.parse(text)
        top_imports = {n.names[0].name.split(".")[0] for n in tree.body if isinstance(n, ast.Import)} | {n.module.split(".")[0] for n in tree.body if isinstance(n, ast.ImportFrom) and n.module}
        assert "homeassistant" not in top_imports and "voluptuous" not in top_imports, module
    # no service of the authoring layer is ever called but the reload of the item written (the service text names them all)
    svc = (SRC / "config_service.py").read_text(encoding="utf-8")
    called = set(re.findall(r'async_call\((?:domain|"[a-z_]+")\s*,\s*(?:service|"[a-z_]+")', svc))
    assert "hassio" not in svc.replace("`hassio.*`", "") and "homeassistant.restart" not in svc and "restart" not in re.sub(r"#.*|\"\"\"[\s\S]*?\"\"\"", "", svc)
    assert called  # the two call sites exist
