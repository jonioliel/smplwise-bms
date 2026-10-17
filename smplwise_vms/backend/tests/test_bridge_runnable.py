"""SVCIDENT3 (the 2.7.0 security review S1 / S2), the BRIDGE side: custom_components/smplwise_bridge/runnable.py (bridge 0.9.2) - negative first.

For a message the bridge screened ON BEHALF OF an Arx-only person:
- S1 (a) a script / scene / automation runs only when its entity id is on the bridge's own options-flow allowlist (empty by default);
- S1 (b) the impact check reads the item's steps (one nested level) and refuses - fail closed, with a closed list of codes - a door, a disarm,
  arming with the bypass set, a service outside the closed step list, a template, a non-literal target, a device action, an event, an unknown
  step, a second nesting level, an item it cannot read, and a target the service user's entity policy does not allow;
- S2 every entity of a screened `execute` passes the service user's Home Assistant entity policy.
Fakes only: no Home Assistant is imported or contacted."""
from __future__ import annotations

import ast
import asyncio
import json
from types import SimpleNamespace

import pytest

from bridge_loader import MIRROR, SRC, load

rn = load("runnable")
store_mod = load("config_store")

POLICY = "control"


class FakeRegistry:
    def __init__(self, entries: dict[str, tuple[str, str]]):
        self.entries = {eid: SimpleNamespace(entity_id=eid, platform=p, unique_id=u) for eid, (p, u) in entries.items()}
        self.entities = self.entries  # config_service.entity_of iterates `entities.values()`

    def async_get(self, entity_id):
        return self.entries.get(entity_id)


class FakeStore:
    def __init__(self, items: dict[tuple[str, str], object], broken: bool = False):
        self.items = items
        self.broken = broken

    def get(self, kind, item_id):
        if self.broken:
            raise store_mod.StoreError("file_unreadable")
        return self.items.get((kind, item_id))


def _deps(items: dict[str, tuple[str, object]], *, platform_override: dict[str, str] | None = None, broken: bool = False, policy=POLICY):
    """items: entity id -> (unique id, config). The registry platform follows the domain (script / automation / scene=homeassistant)."""
    plat = {"script": "script", "automation": "automation", "scene": "homeassistant"}
    entries = {eid: ((platform_override or {}).get(eid, plat[eid.split(".")[0]]), uid) for eid, (uid, _cfg) in items.items()}
    store = FakeStore({(eid.split(".")[0], uid): cfg for eid, (uid, cfg) in items.items()}, broken=broken)
    registry = FakeRegistry(entries)

    async def run_io(_hass, fn):
        return fn()

    return SimpleNamespace(registry=lambda _h: registry, store=lambda _h: store, run_io=run_io, POLICY_CONTROL=policy)


def _user(denied: set[str] = frozenset(), *, admin=False, raises=False, no_api=False):
    def check(entity_id, policy):
        assert policy == POLICY
        if raises:
            raise RuntimeError("boom")
        return entity_id not in denied

    perms = None if no_api else SimpleNamespace(check_entity=check)
    return SimpleNamespace(id="a" * 32, is_admin=admin, permissions=perms)


def _script(*steps) -> dict:
    return {"alias": "x", "sequence": list(steps)}


def _svc(action: str, *targets: str, **extra) -> dict:
    step = {"action": action, **extra}
    if targets:
        step["target"] = {"entity_id": list(targets)}
    return step


def _impact(entity_id: str, items: dict, user=None, **deps_kw) -> str | None:
    return asyncio.run(rn.impact_refusal(None, _deps(items, **deps_kw), user or _user(), entity_id))


SAFE = _script(_svc("light.turn_on", "light.hall"), {"delay": "00:00:05"}, _svc("switch.turn_off", "switch.fan"))


# ---------------------------------------------------------------- S1 (b): every refusal code first

@pytest.mark.parametrize("step", [
    _svc("lock.unlock", "lock.front"),
    _svc("lock.open", "lock.front"),
    _svc("alarm_control_panel.alarm_disarm", "alarm_control_panel.home"),
    _svc("alarm_control_panel.alarm_arm_custom_bypass", "alarm_control_panel.home"),
    {"service": "lock.unlock", "entity_id": "lock.front"},  # the legacy key
    {"action": "LOCK.UNLOCK", "target": {"area_id": "hall"}},  # case and an unresolvable target: the door decides first
    {"choose": [{"conditions": [], "sequence": [_svc("lock.unlock", "lock.front")]}]},
    {"if": [{"condition": "state", "entity_id": "x.y", "state": "on"}], "then": [_svc("light.turn_on", "light.a")], "else": [_svc("lock.unlock", "lock.b")]},
    {"repeat": {"count": 2, "sequence": [_svc("lock.unlock", "lock.front")]}},
    {"parallel": [_svc("light.turn_on", "light.a"), {"sequence": [_svc("alarm_control_panel.alarm_disarm", "alarm_control_panel.h")]}]},
    {"sequence": [{"sequence": [_svc("lock.unlock", "lock.deep")]}]},
])
def test_a_never_local_step_is_refused_at_any_depth(step):
    assert _impact("script.night", {"script.night": ("night", _script(_svc("light.turn_on", "light.a"), step))}) == "impact_never_local"


@pytest.mark.parametrize("call", [
    _svc("script.turn_on", "script.open_all"),  # script.turn_on with a target
    {"action": "script.open_all"},  # `script.<object id>` as a service
    _svc("automation.trigger", "automation.open_all"),
])
def test_one_nested_level_is_followed_to_the_door(call):
    nested_kind = "automation" if "automation" in json.dumps(call) else "script"
    nested = {"actions": [_svc("lock.unlock", "lock.front")]} if nested_kind == "automation" else _script(_svc("lock.unlock", "lock.front"))
    items = {"script.evening": ("evening", _script(_svc("light.turn_on", "light.a"), call)), f"{nested_kind}.open_all": ("open_all", nested)}
    assert _impact("script.evening", items) == "impact_never_local"


def test_a_scene_reaching_a_lock_or_the_alarm_is_refused_directly_and_nested():
    open_scene = {"id": "s1", "name": "x", "entities": {"light.a": "on", "lock.front": "unlocked"}}
    alarm_scene = {"id": "s2", "name": "y", "entities": {"alarm_control_panel.home": {"state": "disarmed"}}}
    assert _impact("scene.open", {"scene.open": ("s1", open_scene)}) == "impact_never_local"
    assert _impact("scene.alarm", {"scene.alarm": ("s2", alarm_scene)}) == "impact_never_local"
    items = {"script.go": ("go", _script(_svc("scene.turn_on", "scene.open"))), "scene.open": ("s1", open_scene)}
    assert _impact("script.go", items) == "impact_never_local"
    items = {"script.go": ("go", _script({"scene": "scene.open"})), "scene.open": ("s1", open_scene)}  # the `scene:` step shorthand
    assert _impact("script.go", items) == "impact_never_local"
    inline = _script({"action": "scene.apply", "data": {"entities": {"lock.front": "unlocked"}}})
    assert _impact("script.go", {"script.go": ("go", inline)}) == "impact_never_local"


def test_a_second_nesting_level_is_refused():
    items = {
        "script.a": ("a", _script(_svc("script.turn_on", "script.b"))),
        "script.b": ("b", _script(_svc("script.turn_on", "script.c"))),
        "script.c": ("c", SAFE),
    }
    assert _impact("script.a", items) == "impact_nesting_too_deep"
    items["script.b"] = ("b", _script({"action": "scene.apply", "data": {"entities": {"light.a": "on"}}}))
    assert _impact("script.a", items) == "impact_nesting_too_deep"


@pytest.mark.parametrize("step,code", [
    (_svc("notify.mobile_app_phone", message="hi"), "impact_service_not_allowed"),
    (_svc("homeassistant.turn_on", "lock.front"), "impact_service_not_allowed"),
    (_svc("homeassistant.turn_off", "light.a"), "impact_service_not_allowed"),
    (_svc("mqtt.publish", topic="door/open", payload="1"), "impact_service_not_allowed"),
    (_svc("shell_command.open_gate"), "impact_service_not_allowed"),
    (_svc("rest_command.open_gate"), "impact_service_not_allowed"),
    (_svc("light.toggle", "light.a"), "impact_service_not_allowed"),
    (_svc("alarm_control_panel.alarm_trigger", "alarm_control_panel.h"), "impact_service_not_allowed"),
    (_svc("automation.turn_off", "automation.guard"), "impact_service_not_allowed"),
    (_svc("script.turn_off", "script.x"), "impact_service_not_allowed"),
    (_svc("scene.create", scene_id="x"), "impact_service_not_allowed"),
    ({"action": "{{ 'lock' }}.unlock", "target": {"entity_id": "lock.front"}}, "impact_template"),
    (_svc("light.turn_on", "{{ states.light | map(attribute='entity_id') | list }}"), "impact_template"),
    ({"action": "light.turn_on", "target": "{{ x }}"}, "impact_template"),
    ({"action": "light.turn_on", "target": {"area_id": "hall"}}, "impact_target_unresolved"),
    ({"action": "light.turn_on", "target": {"device_id": "abc"}}, "impact_target_unresolved"),
    ({"action": "light.turn_on", "target": {"label_id": "all_lights"}}, "impact_target_unresolved"),
    ({"action": "light.turn_on", "data": {"floor_id": "ground"}}, "impact_target_unresolved"),
    ({"action": "light.turn_on", "entity_id": "all"}, "impact_target_unresolved"),
    ({"action": "light.turn_on"}, "impact_target_unresolved"),
    ({"action": "light.turn_on", "target": {"entity_id": "switch.not_a_light"}}, "impact_target_unresolved"),
    (_svc("script.turn_on"), "impact_target_unresolved"),  # a nested call without a literal target
    ({"device_id": "abc", "domain": "lock", "type": "unlock", "entity_id": "0f3e"}, "impact_device_action"),
    ({"device_id": "abc", "domain": "light", "type": "turn_on", "entity_id": "0f3e"}, "impact_device_action"),
    ({"event": "open_all_doors", "event_data": {}}, "impact_event"),
    ({"wait_for_trigger": [], "something_new": 1}, "impact_step_unknown"),
    ("light.turn_on", "impact_step_unknown"),
    ({"choose": "not a list"}, "impact_step_unknown"),
])
def test_closed_refusal_codes(step, code):
    assert _impact("script.x", {"script.x": ("x", _script(step))}) == code


def test_too_deep_or_too_many_steps_are_refused():
    deep: dict = _svc("light.turn_on", "light.a")
    for _ in range(rn.MAX_DEPTH + 2):
        deep = {"sequence": [deep]}
    assert _impact("script.x", {"script.x": ("x", _script(deep))}) == "impact_too_large"
    many = _script(*[_svc("light.turn_on", "light.a") for _ in range(rn.MAX_STEPS + 1)])
    assert _impact("script.x", {"script.x": ("x", many)}) == "impact_too_large"


def test_an_item_that_cannot_be_read_is_refused():
    assert _impact("script.missing", {}) == "impact_unknown_item"  # not in the registry
    assert _impact("script.x", {"script.x": ("x", SAFE)}, platform_override={"script.x": "python_script"}) == "impact_unknown_item"  # not a UI-file item
    assert _impact("script.x", {"script.x": ("x", None)}) == "impact_unknown_item"  # registered, not in scripts.yaml
    assert _impact("script.x", {"script.x": ("x", SAFE)}, broken=True) == "impact_unknown_item"  # the file is unreadable
    assert _impact("script.x", {"script.x": ("x", ["not", "a", "dict"])}) == "impact_unknown_item"
    items = {"script.a": ("a", _script(_svc("script.turn_on", "script.gone")))}
    assert _impact("script.a", items) == "impact_unknown_item"  # a nested item that cannot be read
    assert _impact("light.kitchen", {}) == "impact_unknown_item"


def test_the_service_users_entity_policy_bounds_every_step_target():
    items = {"script.x": ("x", SAFE)}
    assert _impact("script.x", items, user=_user({"switch.fan"})) == "impact_entity_policy"
    nested = {"script.a": ("a", _script(_svc("script.turn_on", "script.b"))), "script.b": ("b", SAFE)}
    assert _impact("script.a", nested, user=_user({"light.hall"})) == "impact_entity_policy"  # a nested item's targets too
    assert _impact("script.a", nested, user=_user({"script.b"})) == "impact_entity_policy"  # and the nested item itself
    assert _impact("script.x", items, user=_user(admin=True)) == "service_identity_policy_unavailable"  # never skipped for an administrator
    assert _impact("script.x", items, user=_user(raises=True)) == "service_identity_policy_unavailable"
    assert _impact("script.x", items, user=_user(no_api=True)) == "service_identity_policy_unavailable"
    assert _impact("script.x", items, policy=None) == "service_identity_policy_unavailable"


# ---------------------------------------------------------------- what passes

def test_everyday_items_pass():
    items = {
        "script.evening": ("evening", _script(
            _svc("light.turn_on", "light.hall", data={"brightness_pct": 40}),
            {"delay": {"seconds": 5}},
            {"condition": "state", "entity_id": "lock.front", "state": "locked"},  # a condition naming a lock only decides
            {"choose": [{"conditions": [], "sequence": [_svc("cover.close_cover", "cover.blinds")]}], "default": [_svc("lock.lock", "lock.front")]},
            {"variables": {"x": 1}}, {"wait_template": "{{ is_state('light.hall', 'on') }}", "timeout": 10},
            _svc("script.turn_on", "script.music"),
            _svc("alarm_control_panel.alarm_arm_away", "alarm_control_panel.home"),
        )),
        "script.music": ("music", _script(_svc("media_player.volume_set", "media_player.living", data={"volume_level": 0.2}))),
        "scene.movie": ("s9", {"id": "s9", "name": "m", "entities": {"light.hall": {"state": "on", "brightness": 50}, "lock.front": "locked"}}),
        "automation.night": ("1700000000000", {"id": "1700000000000", "triggers": [], "actions": [_svc("light.turn_off", "light.hall")]}),
    }
    for entity_id in items:
        assert _impact(entity_id, items) is None, entity_id


# ---------------------------------------------------------------- the entry points of __init__.py

def _exec(domain, service, data, runnable=frozenset(), user=None, items=None):
    return asyncio.run(rn.execute_refusal(None, user or _user(), domain, service, data, frozenset(runnable), deps=_deps(items or {})))


def test_execute_refuses_non_literal_targets_and_applies_the_entity_policy_to_every_entity():
    assert _exec("light", "turn_on", {"entity_id": "light.a", "area_id": "hall"}) == "service_identity_target"
    assert _exec("light", "turn_on", {"entity_id": "{{ x }}"}) == "service_identity_target"
    assert _exec("light", "turn_on", {"target": {"entity_id": "light.a"}, "entity_id": "light.a"}) == "service_identity_target"
    assert _exec("light", "turn_on", {"entity_id": "all"}) == "service_identity_target"
    assert _exec("light", "turn_on", {}) == "service_identity_target"
    assert _exec("lock", "unlock", {"entity_id": "lock.front"}, user=_user({"lock.front"})) == "service_identity_entity_policy"
    assert _exec("light", "turn_on", {"entity_id": ["light.a", "light.b"]}, user=_user({"light.b"})) == "service_identity_entity_policy"
    assert _exec("light", "turn_on", {"entity_id": "light.a"}, user=_user(raises=True)) == "service_identity_policy_unavailable"
    assert _exec("light", "turn_on", {"entity_id": "light.a"}, user=_user(admin=True)) == "service_identity_policy_unavailable"
    assert _exec("light", "turn_on", {"entity_id": "light.a", "brightness": 10}) is None
    assert _exec("lock", "unlock", {"entity_id": "lock.front"}) is None  # a door: bounded by the policy (and Arx's own grant), no allowlist


def test_execute_runs_a_script_or_scene_only_from_the_allowlist_and_after_the_impact_check():
    items = {"script.evening": ("evening", SAFE), "script.night": ("night", _script(_svc("lock.unlock", "lock.front"))),
             "scene.movie": ("s9", {"id": "s9", "entities": {"light.hall": "on"}})}
    assert _exec("script", "turn_on", {"entity_id": "script.evening"}, items=items) == "service_identity_not_runnable"  # empty by default
    assert _exec("script", "turn_on", {"entity_id": "script.evening"}, runnable={"script.other"}, items=items) == "service_identity_not_runnable"
    assert _exec("script", "turn_on", {"entity_id": ["script.evening", "script.night"]}, runnable={"script.evening"}, items=items) == "service_identity_not_runnable"
    assert _exec("scene", "turn_on", {"entity_id": "script.evening"}, runnable={"script.evening"}, items=items) == "service_identity_not_runnable"  # wrong domain
    assert _exec("script", "turn_on", {"entity_id": "script.night"}, runnable={"script.night"}, items=items) == "impact_never_local"  # listed is not enough
    assert _exec("script", "turn_on", {"entity_id": "script.evening"}, runnable={"script.evening"}, items=items) is None
    assert _exec("scene", "turn_on", {"entity_id": "scene.movie"}, runnable={"scene.movie"}, items=items) is None


def test_config_item_runs_only_from_the_allowlist_and_after_the_impact_check():
    items = {"automation.night": ("a1", {"id": "a1", "actions": [_svc("alarm_control_panel.alarm_disarm", "alarm_control_panel.h")]}),
             "script.evening": ("evening", SAFE), "scene.movie": ("s9", {"id": "s9", "entities": {"light.hall": "on"}})}

    def run(msg, runnable=frozenset()):
        return asyncio.run(rn.config_item_refusal(None, _user(), msg, frozenset(runnable), deps=_deps(items)))

    trigger = {"op": "trigger", "kind": "automation", "item_id": "a1"}
    assert run(trigger) == "service_identity_not_runnable"
    assert run(trigger, {"automation.night"}) == "impact_never_local"
    assert run({"op": "run_script", "kind": "script", "item_id": "nope"}, {"script.evening"}) == "impact_unknown_item"
    assert run({"op": "run_script", "kind": "script", "item_id": "evening"}) == "service_identity_not_runnable"
    assert run({"op": "run_script", "kind": "script", "item_id": "evening"}, {"script.evening"}) is None
    assert run({"op": "apply_scene", "entity_id": "scene.movie"}, {"scene.movie"}) is None
    assert run({"op": "apply_scene", "entity_id": "scene.movie"}) == "service_identity_not_runnable"
    assert run({"op": "upsert", "kind": "script", "item_id": "evening"}, {"script.evening"}) == "service_identity_not_runnable"  # never a write


# ---------------------------------------------------------------- the allowlist option

def test_the_runnable_option_is_empty_by_default_and_malformed_is_empty():
    assert rn.allowlist(None) == frozenset() and rn.allowlist("") == frozenset() and rn.allowlist([]) == frozenset()
    assert rn.allowlist(["script.a", "light.kitchen"]) == frozenset()  # one bad entry: nothing (fail closed)
    assert rn.allowlist({"script.a": True}) == frozenset()
    assert rn.parse_runnable("script.a, scene.b\nautomation.c") == (frozenset({"script.a", "scene.b", "automation.c"}), None)
    assert rn.parse_runnable("light.kitchen") == (None, "runnable_format")
    assert rn.parse_runnable("script.{{x}}") == (None, "runnable_format")
    assert rn.parse_runnable(", ".join(f"script.s{i}" for i in range(rn.MAX_RUNNABLE + 1))) == (None, "runnable_too_many")
    assert rn.allowlist(["Script.A "]) == frozenset({"script.a"})


# ---------------------------------------------------------------- wiring, strings, version, drift with the add-on

def test_init_wires_the_fences_for_screened_messages_only():
    text = (SRC / "__init__.py").read_text(encoding="utf-8")
    tree = ast.parse(text)
    funcs = {n.name: ast.unparse(n) for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef)}
    ex = funcs["execute"]
    assert "on_behalf = 'on_behalf_of' in call.data" in ex
    i_fence = ex.index("runnable.execute_refusal(hass, user, domain, service, data, runnable_ids())")
    assert ex.index("if on_behalf:") < i_fence < ex.index("context = Context(user_id=user.id)")  # before anything runs
    assert ex.index("media_policy.refusal") < i_fence
    ci = funcs["config_item"]
    assert "on_behalf = 'on_behalf_of' in call.data" in ci
    assert ci.index("runnable.config_item_refusal(") < ci.index("async_handle_config_item(")
    assert "runnable.allowlist(entry.options.get(CONF_LOCAL_IDENTITY_RUNNABLE))" in text
    assert '"local_identity_runnable": sorted(runnable_ids())' in text  # the add-on's card learns the bridge's copy
    flow = (SRC / "config_flow.py").read_text(encoding="utf-8")
    assert "vol.Optional(CONF_LOCAL_IDENTITY_RUNNABLE, default=runnable_text): str" in flow
    assert "CONF_LOCAL_IDENTITY_RUNNABLE: sorted(runnable_ids or ())" in flow
    assert load("const").CONF_LOCAL_IDENTITY_RUNNABLE == "local_identity_runnable"


def test_version_092_both_copies_identical_and_strings():
    for root in (SRC, MIRROR):
        assert json.loads((root / "manifest.json").read_text(encoding="utf-8"))["version"] == "0.9.2"
        assert 'VERSION = "0.9.2"' in (root / "const.py").read_text(encoding="utf-8")
        assert "const VERSION = '0.9.2'" in (root / "www" / "smplwise-card.js").read_text(encoding="utf-8")
    for path in sorted(p for p in SRC.rglob("*") if p.is_file() and "__pycache__" not in p.parts):
        rel = path.relative_to(SRC)
        assert (MIRROR / rel).read_bytes() == path.read_bytes(), rel
    for name in ("strings.json", "translations/en.json", "translations/he.json"):
        data = json.loads((SRC / name).read_text(encoding="utf-8"))
        assert "local_identity_runnable" in data["options"]["step"]["init"]["data"], name
        assert {"runnable_format", "runnable_too_many"} <= set(data["options"]["error"]), name


def test_the_refusal_codes_are_a_closed_list_the_addon_knows():
    from smplwise.services import automation_ops

    assert rn.REFUSAL_CODES == rn.IMPACT_CODES | {"service_identity_not_runnable", "service_identity_target", "service_identity_entity_policy",
                                                  "service_identity_policy_unavailable"}
    known = set(automation_ops.BRIDGE_ERRORS)
    assert (rn.IMPACT_CODES | {"service_identity_not_runnable", "service_identity_policy_unavailable"}) <= known
    for code in rn.IMPACT_CODES:
        err = automation_ops.bridge_error({"ok": False, "error": code}, "run_script")
        assert err.status == 403 and err.code == "run_impact_refused" and err.details["reason"] == code


def test_the_step_list_never_contains_a_never_local_pair_and_matches_the_addon():
    from smplwise.services import service_identity as addon

    assert not rn.IMPACT_NEVER & rn.IMPACT_STEP_PAIRS
    assert not {("script", "turn_on"), ("scene", "turn_on"), ("lock", "unlock"), ("lock", "open")} & rn.IMPACT_STEP_PAIRS
    assert addon.RUNNABLE_RE.pattern == rn.RUNNABLE_RE.pattern and addon.MAX_RUNNABLE == rn.MAX_RUNNABLE
