"""SCHEDIMPACT-295 (Fable security review 4 of 2026-10-21, finding V-02), the BRIDGE side: a `schedule` message screened on behalf of an
Arx-only person runs nothing the run fences would refuse to a direct run (custom_components/smplwise_bridge/schedule_fence.py, wired into
schedule_service.async_handle_schedule by the `local` argument) - negative cases first.

Before the fix the schedule handler checked only the service user's entity policy for the payload's entities: a local person with the
`schedules` feature could schedule `script.turn_on` of any script (a relay, a template switch, a door script) under the service user.
Fakes only: the fake Home Assistant of test_bridge_schedule_service.py and the fake item store of test_bridge_runnable.py; nothing here
reaches a real Home Assistant, Scheduler or device."""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

import test_bridge_runnable as trn
import test_bridge_schedule_service as tbs
from bridge_loader import MIRROR, SRC, load

service = load("schedule_service")
fence = load("schedule_fence")
rn = load("runnable")
signing = load("signing")

SID = "s" * 32  # the service user (a regular Home Assistant user)
V01_FIXED = hasattr(rn, "ACTION_TYPE_KEYS")  # the V-01 fix (pilot/EXTID-295): a step with more than one type key is refused


@pytest.fixture(autouse=True)
def fake_ha(monkeypatch):
    monkeypatch.setattr(service, "_ha", lambda: SimpleNamespace(Context=tbs.FakeContext, Unauthorized=tbs.FakeUnauthorized, ServiceValidationError=ValueError,
                                                                POLICY_CONTROL="control"))
    monkeypatch.setattr(service, "_registry", lambda hass: hass.registry)
    monkeypatch.setattr(service, "ID_POLL_INTERVAL_S", 0.01)
    monkeypatch.setattr(service, "ID_POLL_TIMEOUT_S", 0.3)


# ---------------------------------------------------------------- the items Home Assistant holds (the UI files)

RELAY = trn._script(trn._svc("switch.turn_on", "switch.gate_relay"))  # an "ordinary" script: one relay - the reach V-02 names
SAFE = trn._script(trn._svc("light.turn_on", "light.hall"))
DOOR = trn._script(trn._svc("light.turn_on", "light.hall"), trn._svc("lock.unlock", "lock.front"))
CALLS_UNLISTED = trn._script(trn._svc("script.turn_on", "script.relay"))
DECOY = trn._script({"device_id": "abc123", "domain": "lock", "type": "unlock", "entity_id": "lock.front", "action": "lock.lock"})  # V-01
OPEN_SCENE = {"id": "s-open", "name": "Open", "entities": {"light.hall": "on", "lock.front": "unlocked"}}
CALM_SCENE = {"id": "s-calm", "name": "Calm", "entities": {"light.hall": "on"}}
ITEMS = {"script.relay": ("relay", RELAY), "script.safe": ("safe", SAFE), "script.door": ("door", DOOR), "script.calls_unlisted": ("calls", CALLS_UNLISTED),
         "script.decoy": ("decoy", DECOY), "scene.open": ("s-open", OPEN_SCENE), "scene.calm": ("s-calm", CALM_SCENE)}


def _hass(user=None) -> tbs.FakeHass:
    hass = tbs.FakeHass(user or tbs.FakeUser(SID, admin=False))
    for eid in ITEMS:
        hass.states.set(eid, "off")
    # an existing schedule (made by somebody else) whose second slot runs the relay script: the switch reports every action entity
    hass.registry.add("ev1", "switch.schedule_evening")
    hass.states.set("switch.schedule_evening", "on", weekdays=["daily"], timeslots=["18:00:00", "19:00:00"],
                    actions=[{"service": "light.turn_on", "data": {}}, {"service": "script.turn_on", "data": {}}], entities=["light.hall", "script.relay"])
    hass.registry.add("ev2", "switch.schedule_lights")
    hass.states.set("switch.schedule_lights", "on", weekdays=["daily"], timeslots=["18:00:00"], actions=[{"service": "light.turn_on", "data": {}}], entities=["light.hall"])
    return hass


def _local(runnable=(), extended=True):
    return SimpleNamespace(runnable=frozenset(runnable), extended=extended, deps=trn._deps(ITEMS))


def _payload(*actions):
    return {"weekdays": ["daily"], "repeat_type": "repeat", "name": "Evening", "start_date": None, "end_date": None,
            "timeslots": [tbs.slot("18:00:00", None, list(actions))]}


def _body(op, **kw):
    return tbs.body(op, user_id=SID, **kw)


def _existing(op, entity="switch.schedule_evening", sid="ev1", **kw):
    return _body(op, schedule_id=sid, schedule_entity_id=entity, **kw)


def _call(hass, message, local):
    msg = signing.sign(tbs.SECRET, message)
    return asyncio.run(service.async_handle_schedule(hass, signing.Verifier(tbs.SECRET), msg, local=local))


def _refused(hass, message, local) -> str:
    out = _call(hass, message, local)
    assert out["ok"] is False, out
    assert hass.services.calls == [], "nothing reaches the Scheduler component"
    return out["error"]


# ---------------------------------------------------------------- 1. basic mode: scripts, scenes and the never-list are refused

@pytest.mark.parametrize("action,sensitive", [
    (tbs.act("script.turn_on", "script.relay"), False),  # the V-02 case: an "ordinary" relay script
    (tbs.act("script.turn_on", "script.safe"), False),  # even a harmless one: the basic mode never runs a script for a local person
    (tbs.act("scene.turn_on", "scene.calm"), False),
    (tbs.act("lock.unlock", "lock.front"), True),  # a door: on the basic never-list, also through a schedule
    (tbs.act("alarm_control_panel.alarm_arm_custom_bypass", "alarm_control_panel.house"), True),
])
def test_basic_mode_refuses_a_local_persons_script_scene_door_or_bypass_schedule(action, sensitive):
    assert _refused(_hass(), _body("add", payload=_payload(action), sensitive=sensitive), _local(runnable=ITEMS, extended=False)) == "service_identity_refused"
    p = _payload(tbs.act("light.turn_on", "light.hall"), action)
    assert _refused(_hass(), _body("edit", payload={"start_date": None, "end_date": None, "timeslots": p["timeslots"]}, sensitive=sensitive),
                    _local(runnable=ITEMS, extended=False)) == "service_identity_refused"


@pytest.mark.parametrize("op", ["enable", "run", "copy"])
def test_basic_mode_refuses_setting_going_an_existing_schedule_that_runs_a_script(op):
    kw = {"name": "Copy"} if op == "copy" else {}
    assert _refused(_hass(), _existing(op, **kw), _local(runnable=ITEMS, extended=False)) == "service_identity_refused"


def test_an_edit_that_keeps_the_slots_is_judged_on_the_current_content():
    out = _refused(_hass(), _existing("edit", payload={"weekdays": ["mon"], "start_date": None, "end_date": None}), _local(runnable=ITEMS, extended=False))
    assert out == "service_identity_refused", "widening the days of a script schedule sets the script going more often"


def test_unreadable_current_content_is_refused_fail_closed():
    hass = _hass()
    hass.states.set("switch.schedule_evening", "on", weekdays=["daily"], timeslots=["18:00:00"], actions=[{"service": "light.turn_on", "data": {}}])  # no `entities`
    assert _refused(hass, _existing("run"), _local()) == "schedule_content_unverifiable"
    hass.states.data.pop("switch.schedule_evening")
    assert _refused(hass, _existing("enable"), _local()) == "schedule_content_unverifiable"


# ---------------------------------------------------------------- 2. extended mode: the allowlist and the impact check

def test_an_unlisted_script_or_scene_is_not_runnable():
    for action in (tbs.act("script.turn_on", "script.relay"), tbs.act("scene.turn_on", "scene.calm")):
        assert _refused(_hass(), _body("add", payload=_payload(action)), _local(runnable={"script.safe"})) == "service_identity_not_runnable"
    assert _refused(_hass(), _existing("enable"), _local(runnable={"script.safe"})) == "service_identity_not_runnable"


@pytest.mark.parametrize("entity,code", [
    ("script.door", "impact_never_local"),  # a listed script whose steps reach a door
    ("script.calls_unlisted", "impact_nested_not_runnable"),  # a nested call of a script that is not itself listed
    ("scene.open", "impact_never_local"),  # a scene that unlocks
])
def test_a_listed_item_that_fails_the_impact_check_is_refused(entity, code):
    service_name = entity.split(".")[0] + ".turn_on"
    assert _refused(_hass(), _body("add", payload=_payload(tbs.act(service_name, entity))), _local(runnable={entity})) == code


def test_the_v01_decoy_script_is_refused_through_a_schedule_too():
    # the crafted step: a device action `unlock` carrying a decoy `action: lock.lock`. With the V-01 fix (pilot/EXTID-295, runnable.ACTION_TYPE_KEYS)
    # it is `impact_step_unknown`; without it the step's `device_id` key is still refused as an unresolvable target - never allowed either way
    code = _refused(_hass(), _body("add", payload=_payload(tbs.act("script.turn_on", "script.decoy"))), _local(runnable={"script.decoy"}))
    assert code == ("impact_step_unknown" if V01_FIXED else "impact_target_unresolved")
    hass = _hass()
    hass.states.set("switch.schedule_evening", "on", weekdays=["daily"], timeslots=["18:00:00"], actions=[{"service": "script.turn_on", "data": {}}], entities=["script.decoy"])
    assert _refused(hass, _existing("run"), _local(runnable={"script.decoy"})) == code


def test_a_listed_script_that_passes_the_impact_check_is_scheduled_and_run():
    hass = _hass()
    out = _call(hass, _body("add", payload=_payload(tbs.act("script.turn_on", "script.safe"), tbs.act("scene.turn_on", "scene.calm"))),
                _local(runnable={"script.safe", "scene.calm"}))
    assert out["ok"] is True and [(c["domain"], c["service"]) for c in hass.services.calls] == [("scheduler", "add")]
    hass = _hass()
    assert _call(hass, _existing("run"), _local(runnable={"script.relay"}))["ok"] is True  # the relay script is accepted residual risk R1 once listed
    assert [(c["domain"], c["service"]) for c in hass.services.calls] == [("scheduler", "run_action")]


def test_the_items_entity_policy_of_the_service_user_still_applies():
    deps = trn._deps(ITEMS)
    local = SimpleNamespace(runnable=frozenset({"script.safe"}), extended=True, deps=deps)
    hass = _hass(tbs.FakeUser(SID, admin=False, allowed={"script.safe", "switch.schedule_evening"}))  # light.hall (a step's target) is not allowed
    assert _refused(hass, _body("add", payload=_payload(tbs.act("script.turn_on", "script.safe"))), local) == "impact_entity_policy"


@pytest.mark.parametrize("attrs", [
    {"actions": [{"service": "automation.trigger", "data": {}}], "entities": ["automation.open_all"]},  # an automation: never judged, refused
    {"actions": [{"service": "light.turn_on", "data": {}}], "entities": ["automation.open_all"]},

    {"actions": [{"service": "script.turn_off", "data": {}}], "entities": []},
    {"actions": [{"service": "{{ 'lock.unlock' }}", "data": {}}], "entities": []},  # a template / malformed service
])
def test_existing_content_of_an_unjudgeable_shape_is_refused(attrs):
    hass = _hass()
    hass.states.set("switch.schedule_evening", "on", weekdays=["daily"], timeslots=["18:00:00"], **attrs)
    assert _refused(hass, _existing("enable"), _local(runnable=ITEMS)) == "service_identity_refused"


def test_a_script_named_as_its_own_service_in_existing_content_is_judged_as_that_script():
    hass = _hass()
    hass.states.set("switch.schedule_evening", "on", weekdays=["daily"], timeslots=["18:00:00"], actions=[{"service": "script.door", "data": {}}], entities=[])
    assert _refused(hass, _existing("run"), _local(runnable={"script.door"})) == "impact_never_local"
    assert _refused(_hass(), _existing("run"), _local(runnable=set())) == "service_identity_not_runnable"


def test_a_fence_that_cannot_judge_refuses():
    class Boom:
        POLICY_CONTROL = "control"

        def registry(self, _hass):
            raise RuntimeError("registry unreadable")

    local = SimpleNamespace(runnable=frozenset({"script.safe"}), extended=True, deps=Boom())
    assert _refused(_hass(), _body("add", payload=_payload(tbs.act("script.turn_on", "script.safe"))), local) == "impact_unknown_item"


# ---------------------------------------------------------------- 3. what stays unchanged

def test_stopping_ops_and_plain_schedules_of_a_local_person_are_unchanged():
    for op in ("disable", "remove"):
        hass = _hass()
        assert _call(hass, _existing(op), _local(runnable=(), extended=False))["ok"] is True, op
    hass = _hass()
    assert _call(hass, _body("add", payload=_payload(tbs.act("light.turn_on", "light.hall"))), _local(runnable=(), extended=False))["ok"] is True
    for op in ("enable", "run", "copy"):
        hass = _hass()
        kw = {"name": "Copy"} if op == "copy" else {}
        assert _call(hass, _existing(op, entity="switch.schedule_lights", sid="ev2", **kw), _local(runnable=(), extended=False))["ok"] is True, op


def test_a_home_assistant_users_own_schedule_is_never_judged_here():
    hass = _hass()
    out = _call(hass, _body("add", payload=_payload(tbs.act("script.turn_on", "script.relay"))), None)
    assert out["ok"] is True, "a Home Assistant user's schedule: unchanged (no allowlist, no impact check)"
    hass = _hass()
    assert _call(hass, _existing("enable"), None)["ok"] is True


def test_the_fence_codes_are_a_closed_list_and_answers_carry_no_content():
    assert fence.REFUSAL_CODES >= {"service_identity_refused", "schedule_content_unverifiable", "service_identity_not_runnable"} | rn.IMPACT_CODES
    out = _call(_hass(), _body("add", payload=_payload(tbs.act("script.turn_on", "script.door"))), _local(runnable={"script.door"}))
    assert set(out) == {"ok", "request_id", "error"} and out["error"] in fence.REFUSAL_CODES


# ---------------------------------------------------------------- 4. wiring (structural: __init__.py needs Home Assistant to import)

def test_the_schedule_handler_passes_the_fence_only_for_a_message_on_behalf_of_a_local_person():
    src = (SRC / "__init__.py").read_text(encoding="utf-8")
    handler = src[src.index("    async def schedule(call: ServiceCall)"):src.index("hass.services.async_register(DOMAIN, SERVICE_SCHEDULE")]
    assert 'on_behalf = "on_behalf_of" in call.data' in handler and handler.index("on_behalf =") < handler.index("await screened(SERVICE_SCHEDULE")
    assert "local = SimpleNamespace(runnable=runnable_ids(), extended=local_extended()) if on_behalf else None" in handler
    assert "async_handle_schedule(hass, service_identity.PREVERIFIED, msg, local=local)" in handler
    assert '"schedule_fences": True' in src, "the directory push announces the fences (the add-on sends no script schedule to a bridge without them)"


def test_both_copies_of_the_bridge_are_byte_identical():
    for name in ("schedule_fence.py", "schedule_service.py", "__init__.py"):
        assert (SRC / name).read_bytes() == (MIRROR / name).read_bytes(), name
