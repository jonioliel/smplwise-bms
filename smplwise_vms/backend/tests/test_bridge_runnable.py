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


COVER_CLASSES = {"cover.blinds": "blind", "cover.garage": "garage", "cover.gate": "gate", "cover.front_door": "door", "cover.shutter": "shutter",
                 "cover.unknown_class": None,
                 # SAFE2-295 (Fable review 4, V-03): covers that DECLARE a window class but whose platform lets an administrator write any class
                 "cover.template_blind": "blind", "cover.group_blind": "blind", "cover.unregistered_blind": "blind"}
# The covers' entity-registry platforms (a real integration, or one whose class is self-declared); a cover missing here has no registry entry
COVER_PLATFORMS = {"cover.blinds": "zwave_js", "cover.garage": "zwave_js", "cover.gate": "shelly", "cover.front_door": "zwave_js",
                   "cover.shutter": "zwave_js", "cover.unknown_class": "zwave_js", "cover.template_blind": "template", "cover.group_blind": "group"}


def _deps(items: dict[str, tuple[str, object]], *, platform_override: dict[str, str] | None = None, broken: bool = False, policy=POLICY):
    """items: entity id -> (unique id, config). The registry platform follows the domain (script / automation / scene=homeassistant)."""
    plat = {"script": "script", "automation": "automation", "scene": "homeassistant"}
    entries = {eid: ((platform_override or {}).get(eid, plat[eid.split(".")[0]]), uid) for eid, (uid, _cfg) in items.items()}
    entries.update({eid: ((platform_override or {}).get(eid, p), eid.split(".", 1)[1]) for eid, p in COVER_PLATFORMS.items()})
    store = FakeStore({(eid.split(".")[0], uid): cfg for eid, (uid, cfg) in items.items()}, broken=broken)
    registry = FakeRegistry(entries)

    async def run_io(_hass, fn):
        return fn()

    def attributes(entity_id):  # Home Assistant's state attributes (only covers matter); an entity without a state answers None
        if entity_id not in COVER_CLASSES:
            return None
        return {"device_class": COVER_CLASSES[entity_id]} if COVER_CLASSES[entity_id] else {}

    return SimpleNamespace(registry=lambda _h: registry, store=lambda _h: store, run_io=run_io, POLICY_CONTROL=policy, attributes=attributes)


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


def _impact(entity_id: str, items: dict, user=None, runnable=None, **deps_kw) -> str | None:
    """`runnable`: the allowlist; by default every item of the test is on it (so a nested call is judged on its steps)."""
    listed = frozenset(items) if runnable is None else frozenset(runnable)
    return asyncio.run(rn.impact_refusal(None, _deps(items, **deps_kw), user or _user(), entity_id, runnable=listed))


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
    # owner 2026-10-18: notify only with literal content - a template anywhere refuses the step
    ({"action": "notify.mobile_app_phone", "data": {"message": "{{ states('lock.front') }}"}}, "impact_template"),
    ({"action": "notify.mobile_app_phone", "data": {"message": "hi", "title": "{% if x %}a{% endif %}"}}, "impact_template"),
    ({"action": "notify.mobile_app_phone", "data": {"message": "hi", "data": {"url": "{{ x }}"}}}, "impact_template"),
    ({"action": "notify.mobile_app_phone", "data": {"message": "hi"}, "response_variable": "r"}, "impact_step_unknown"),
    # owner 2026-10-18: toggle only for the non-physical-access domains
    (_svc("cover.toggle", "cover.blinds"), "impact_service_not_allowed"),
    (_svc("lock.toggle", "lock.front"), "impact_service_not_allowed"),
    (_svc("climate.toggle", "climate.hall"), "impact_service_not_allowed"),
    (_svc("siren.toggle", "siren.yard"), "impact_service_not_allowed"),
    (_svc("alarm_control_panel.toggle", "alarm_control_panel.h"), "impact_service_not_allowed"),
    (_svc("valve.toggle", "valve.main"), "impact_service_not_allowed"),
    (_svc("homeassistant.toggle", "light.a"), "impact_service_not_allowed"),
    (_svc("input_boolean.toggle", "light.a"), "impact_target_unresolved"),  # a toggle of another domain's entity
    # a cover that is not plainly a window covering (owner 2026-10-18: when unsure, refuse)
    (_svc("cover.open_cover", "cover.garage"), "impact_physical_access"),
    (_svc("cover.close_cover", "cover.gate"), "impact_physical_access"),
    (_svc("cover.set_cover_position", "cover.front_door", data={"position": 50}), "impact_physical_access"),
    (_svc("cover.open_cover", "cover.shutter"), "impact_physical_access"),
    (_svc("cover.open_cover", "cover.unknown_class"), "impact_physical_access"),
    (_svc("cover.stop_cover", "cover.not_in_ha"), "impact_physical_access"),
    (_svc("homeassistant.turn_on", "lock.front"), "impact_service_not_allowed"),
    (_svc("homeassistant.turn_off", "light.a"), "impact_service_not_allowed"),
    (_svc("mqtt.publish", topic="door/open", payload="1"), "impact_service_not_allowed"),
    (_svc("shell_command.open_gate"), "impact_service_not_allowed"),
    (_svc("rest_command.open_gate"), "impact_service_not_allowed"),
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


# ---------------------------------------------------------------- V-01 (Fable review 4, 2026-10-21): a step with more than one type key

# The review's exact shape: for Home Assistant a valid DEVICE ACTION (it runs `lock.unlock` on the device), which carries a decoy `action` key
# naming an allowed service on a matching target. Before 0.9.6 the check tested `action` first and passed it as `lock.lock`.
DECOY = {"device_id": "abc", "domain": "lock", "type": "unlock", "entity_id": "lock.x", "action": "lock.lock"}


@pytest.mark.parametrize("step", [
    DECOY,
    {**{k: v for k, v in DECOY.items() if k != "action"}, "service": "lock.lock"},  # the legacy key as the decoy
    {**DECOY, "target": {"entity_id": "lock.x"}},
    {"device_id": "abc", "domain": "light", "type": "turn_on", "entity_id": "0f3e", "action": "light.turn_on", "target": {"entity_id": "light.a"}},
    {"event": "open_all_doors", "action": "light.turn_on", "target": {"entity_id": "light.a"}},  # an event dressed as a service call
    {"scene": "scene.movie", "action": "light.turn_on", "target": {"entity_id": "light.a"}},
    {"action": "lock.lock", "service": "lock.unlock", "entity_id": "lock.x"},  # two service keys: which one runs is not ours to guess
    {"condition": "device", "device_id": "abc", "domain": "lock", "type": "is_locked", "entity_id": "0f3e"},  # was impact_device_action
])
def test_v01_a_step_with_more_than_one_type_key_is_refused(step):
    assert _impact("script.x", {"script.x": ("x", _script(step))}) == "impact_step_unknown"


@pytest.mark.parametrize("wrap", [
    lambda s: {"choose": [{"conditions": [], "sequence": [s]}]},
    lambda s: {"if": [{"condition": "state", "entity_id": "x.y", "state": "on"}], "then": [_svc("light.turn_on", "light.a")], "else": [s]},
    lambda s: {"repeat": {"count": 1, "sequence": [s]}},
    lambda s: {"parallel": [{"sequence": [s]}]},
])
def test_v01_the_decoy_is_refused_at_any_depth_and_one_level_down(wrap):
    assert _impact("script.x", {"script.x": ("x", _script(_svc("light.turn_on", "light.a"), wrap(DECOY)))}) == "impact_step_unknown"
    items = {"script.a": ("a", _script(_svc("script.turn_on", "script.b"))), "script.b": ("b", _script(wrap(DECOY)))}
    assert _impact("script.a", items) == "impact_step_unknown"
    automation = {"automation.n": ("a1", {"id": "a1", "actions": [wrap(DECOY)]})}
    assert _impact("automation.n", automation) == "impact_step_unknown"


def test_v01_a_plain_device_action_is_still_a_device_action_and_the_decoy_target_alone_passes():
    plain = {k: v for k, v in DECOY.items() if k != "action"}
    assert _impact("script.x", {"script.x": ("x", _script(plain))}) == "impact_device_action"
    assert _impact("script.x", {"script.x": ("x", _script(_svc("lock.lock", "lock.x")))}) is None  # the decoy's own service, alone: allowed


def test_v01_every_pair_of_type_keys_is_refused_whatever_home_assistants_order():
    """Table-driven, documented: the fix must not depend on the order in which Home Assistant picks among several type keys (that order is
    NOT VERIFIED here - no Home Assistant package on this workstation). Every pair of distinct type keys refuses the step."""
    values = {"delay": "00:00:01", "wait_template": "{{ true }}", "condition": "state", "and": [], "or": [], "not": [], "event": "e",
              "device_id": "abc", "action": "light.turn_on", "service": "light.turn_on", "service_template": "light.turn_on", "scene": "scene.s",
              "repeat": {"count": 1, "sequence": []}, "choose": [], "wait_for_trigger": [], "variables": {"x": 1}, "if": [], "parallel": [],
              "stop": "done", "sequence": [], "set_conversation_response": "ok"}
    assert set(values) == set(rn.ACTION_TYPE_KEYS) and len(rn.ACTION_TYPE_KEYS) == len(set(rn.ACTION_TYPE_KEYS))
    keys = list(rn.ACTION_TYPE_KEYS)
    for i, a in enumerate(keys):
        for b in keys[i + 1:]:
            step = {a: values[a], b: values[b], "target": {"entity_id": "light.a"}}
            assert _impact("script.x", {"script.x": ("x", _script(step))}) == "impact_step_unknown", (a, b)


# The single-key classification as this check applies it (one type key only). Home Assistant's order matters only when several keys meet,
# and those steps are refused above; this table documents what each single kind means here.
SINGLE_KEY_OUTCOME = [
    ({"delay": "00:00:01"}, None),
    ({"wait_template": "{{ is_state('light.a', 'on') }}", "timeout": 5}, None),
    ({"condition": "state", "entity_id": "lock.front", "state": "locked"}, None),
    ({"and": []}, "impact_step_unknown"),  # the shorthand condition forms are not walked: refused (conservative)
    ({"event": "e"}, "impact_event"),
    ({"device_id": "abc", "domain": "light", "type": "turn_on", "entity_id": "0f3e"}, "impact_device_action"),
    (_svc("light.turn_on", "light.a"), None),
    ({"service": "light.turn_on", "entity_id": "light.a"}, None),
    ({"service_template": "light.turn_on", "entity_id": "light.a"}, "impact_step_unknown"),
    ({"scene": "scene.unknown"}, "impact_nested_not_runnable"),  # a nested call: judged against the allowlist first
    ({"repeat": {"count": 1, "sequence": [_svc("light.turn_on", "light.a")]}}, None),
    ({"choose": [], "default": [_svc("light.turn_on", "light.a")]}, None),
    ({"wait_for_trigger": [], "timeout": 5}, None),
    ({"variables": {"x": 1}}, None),
    ({"if": [], "then": [_svc("light.turn_on", "light.a")]}, None),
    ({"parallel": [_svc("light.turn_on", "light.a")]}, None),
    ({"stop": "done"}, None),
    ({"sequence": [_svc("light.turn_on", "light.a")]}, None),
    ({"set_conversation_response": "ok"}, None),
]


@pytest.mark.parametrize("step,code", SINGLE_KEY_OUTCOME)
def test_v01_single_type_key_classification_table(step, code):
    assert _impact("script.x", {"script.x": ("x", _script(step))}, runnable={"script.x"}) == code


def test_v01_against_the_installed_home_assistant_schema_when_present():
    """Runs only where the `homeassistant` package is installed (NOT on the development workstation - reported NOT_RUN there). It checks the
    review's premise: Home Assistant decides the decoy step's type as a DEVICE action, and our list of type keys is exactly Home Assistant's."""
    cv = pytest.importorskip("homeassistant.helpers.config_validation")
    assert set(cv.ACTIONS_MAP) == set(rn.ACTION_TYPE_KEYS)
    assert cv.determine_script_action(DECOY) == cv.SCRIPT_ACTION_DEVICE_AUTOMATION
    assert _impact("script.x", {"script.x": ("x", _script(DECOY))}) == "impact_step_unknown"


def test_a_scene_setting_a_garage_or_unknown_cover_is_refused():
    for cover in ("cover.garage", "cover.gate", "cover.front_door", "cover.unknown_class", "cover.not_in_ha"):
        scene = {"id": "s1", "entities": {"light.a": "on", cover: "open"}}
        assert _impact("scene.x", {"scene.x": ("s1", scene)}) == "impact_physical_access", cover
    assert _impact("scene.x", {"scene.x": ("s1", {"id": "s1", "entities": {"cover.blinds": "open"}})}) is None


def test_a_cover_whose_class_is_self_declared_is_refused():
    """SAFE2-295 (Fable review 4, V-03, cheap hardening): a template or group cover declares its own device class - a "blind" can wrap a garage
    door - so its class is not evidence. A cover whose registry platform is `template` / `group`, or that has no registry entry at all (a YAML
    template cover without a unique id), is refused like an unknown class (owner 2026-10-18: when unsure, refuse)."""
    for cover in ("cover.template_blind", "cover.group_blind", "cover.unregistered_blind"):
        step = _script(_svc("cover.open_cover", cover))
        assert _impact("script.x", {"script.x": ("x", step)}) == "impact_physical_access", cover
        scene = {"id": "s1", "entities": {cover: "open"}}
        assert _impact("scene.x", {"scene.x": ("s1", scene)}) == "impact_physical_access", cover
    assert rn.COVER_SELF_DECLARED_PLATFORMS == frozenset({"template", "group"})
    # the same blind on a real integration still passes; a registry that cannot be read refuses
    assert _impact("script.x", {"script.x": ("x", _script(_svc("cover.open_cover", "cover.blinds")))}) is None

    def broken_registry(_hass):
        raise RuntimeError("boom")

    broken = SimpleNamespace(registry=broken_registry, attributes=lambda _e: {"device_class": "blind"})
    assert rn.cover_refusal(None, broken, ["cover.blinds"]) == "impact_physical_access"
    assert rn.cover_refusal(None, broken, []) is None


def test_a_nested_item_must_be_on_the_allowlist_too():
    items = {"script.evening": ("evening", _script(_svc("script.turn_on", "script.music"))), "script.music": ("music", SAFE),
             "scene.movie": ("s9", {"id": "s9", "entities": {"light.hall": "on"}}),
             "script.lights": ("lights", _script({"scene": "scene.movie"})),
             "automation.night": ("a1", {"id": "a1", "actions": [_svc("automation.trigger", "automation.other")]}),
             "automation.other": ("a2", {"id": "a2", "actions": [_svc("light.turn_off", "light.hall")]})}
    assert _impact("script.evening", items, runnable={"script.evening"}) == "impact_nested_not_runnable"
    assert _impact("script.lights", items, runnable={"script.lights"}) == "impact_nested_not_runnable"
    assert _impact("automation.night", items, runnable={"automation.night"}) == "impact_nested_not_runnable"
    assert _impact("script.evening", items, runnable=set()) == "impact_nested_not_runnable"
    one = _script({"action": "script.music"})  # `script.<object id>` too
    assert _impact("script.one", {**items, "script.one": ("one", one)}, runnable={"script.one"}) == "impact_nested_not_runnable"
    assert _impact("script.evening", items, runnable={"script.evening", "script.music"}) is None
    assert _impact("script.lights", items, runnable={"script.lights", "scene.movie"}) is None
    assert _impact("automation.night", items, runnable={"automation.night", "automation.other"}) is None
    # a listed nested item is still judged on its own steps
    items["script.music"] = ("music", _script(_svc("lock.unlock", "lock.front")))
    assert _impact("script.evening", items, runnable={"script.evening", "script.music"}) == "impact_never_local"


def test_each_owner_addition_passes_with_literal_content():
    for step in (
        {"action": "notify.mobile_app_phone", "data": {"message": "The evening scene ran", "title": "Arx"}},
        {"action": "notify.notify", "data": {"message": "hi", "target": ["phone_a"]}},
        {"action": "notify.send_message", "target": {"entity_id": "notify.kitchen_display"}, "data": {"message": "hi"}},
        _svc("light.toggle", "light.hall"), _svc("switch.toggle", "switch.fan"), _svc("fan.toggle", "fan.bedroom"),
        _svc("input_boolean.toggle", "input_boolean.guest_mode"), _svc("media_player.toggle", "media_player.tv"),
        _svc("cover.open_cover", "cover.blinds"), _svc("cover.close_cover", "cover.blinds"),  # a plain window covering
    ):
        assert _impact("script.x", {"script.x": ("x", _script(step))}) is None, step
    assert _impact("script.x", {"script.x": ("x", _script({"action": "notify.send_message", "target": {"entity_id": "notify.kitchen_display"},
                                                           "data": {"message": "hi"}}))}, user=_user({"notify.kitchen_display"})) == "impact_entity_policy"
    assert set(rn.STEP_ADDITIONS) == {"notify.*", "light.toggle", "switch.toggle", "fan.toggle", "input_boolean.toggle", "media_player.toggle"}
    assert all(reason for reason in rn.STEP_ADDITIONS.values())  # each addition carries its reason
    assert not {"cover", "lock", "alarm_control_panel", "climate", "siren", "valve"} & rn.TOGGLE_DOMAINS
    assert rn.COVER_SAFE_CLASSES == frozenset({"blind", "curtain", "shade", "awning"})


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
    assert _impact("script.a", items, runnable={"script.a", "script.gone"}) == "impact_unknown_item"  # a listed nested item that cannot be read
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
             "script.calls": ("calls", _script(_svc("script.turn_on", "script.evening"))),
             "scene.movie": ("s9", {"id": "s9", "entities": {"light.hall": "on"}})}
    assert _exec("script", "turn_on", {"entity_id": "script.evening"}, items=items) == "service_identity_not_runnable"  # empty by default
    assert _exec("script", "turn_on", {"entity_id": "script.evening"}, runnable={"script.other"}, items=items) == "service_identity_not_runnable"
    assert _exec("script", "turn_on", {"entity_id": ["script.evening", "script.night"]}, runnable={"script.evening"}, items=items) == "service_identity_not_runnable"
    assert _exec("scene", "turn_on", {"entity_id": "script.evening"}, runnable={"script.evening"}, items=items) == "service_identity_not_runnable"  # wrong domain
    assert _exec("script", "turn_on", {"entity_id": "script.night"}, runnable={"script.night"}, items=items) == "impact_never_local"  # listed is not enough
    assert _exec("script", "turn_on", {"entity_id": "script.evening"}, runnable={"script.evening"}, items=items) is None
    assert _exec("script", "turn_on", {"entity_id": "script.calls"}, runnable={"script.calls"}, items=items) == "impact_nested_not_runnable"
    assert _exec("script", "turn_on", {"entity_id": "script.calls"}, runnable={"script.calls", "script.evening"}, items=items) is None
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
    # 0.9.4 (EXTID-295): a multi-entity picker replaced the free-text field (test_extid_followups.py holds the details)
    assert "selector.EntitySelector(selector.EntitySelectorConfig(domain=list(RUNNABLE_DOMAINS), multiple=True))" in flow
    assert "CONF_LOCAL_IDENTITY_RUNNABLE: sorted(runnable_ids or ())" in flow
    assert load("const").CONF_LOCAL_IDENTITY_RUNNABLE == "local_identity_runnable"


def test_version_092_both_copies_identical_and_strings():
    for root in (SRC, MIRROR):
        assert json.loads((root / "manifest.json").read_text(encoding="utf-8"))["version"] == "0.10.1"
        assert 'VERSION = "0.10.1"' in (root / "const.py").read_text(encoding="utf-8")
        assert "const VERSION = '0.10.1'" in (root / "www" / "smplwise-card.js").read_text(encoding="utf-8")
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
