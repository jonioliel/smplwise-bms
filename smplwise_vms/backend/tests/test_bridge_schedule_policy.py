"""CR-014 / bridge 0.3.0: the bridge's own schedule policy (integration schedule_policy.py), independent of the add-on.
Payload shapes are the anonymised V-LIVE shapes of SCHEDULER_API.md 1.1 / 9.3: HH:MM:SS times, `sunset+HH:MM:SS`, a null
stop (point action), uniform conditions in every slot, `brightness` 0-255, integer and float temperatures, an alarm
arm action without code. Synthetic data only."""
from __future__ import annotations

import ast
import copy
import sys

import pytest

from bridge_loader import SRC, init_allowed_services, load

policy = load("schedule_policy")

COND = {"entity_id": "binary_sensor.shabbat_mode", "attribute": "state", "value": "on", "match_type": "is"}


def act(service: str, entity_id: str, data: dict | None = None) -> dict:
    return {"service": service, "entity_id": entity_id, "service_data": data if data is not None else {}}


def slot(start: str, stop: str | None, actions: list[dict], conditions: list[dict] | None = None) -> dict:
    return {"start": start, "stop": stop, "conditions": copy.deepcopy(conditions if conditions is not None else [COND]),
            "condition_type": "or" if conditions != [] else None, "track_conditions": False, "actions": actions}


def shabbat_cooling(temp: float = 25) -> dict:
    """The most common V-LIVE shape: contiguous slots 00:00 -> 00:00, cool / off, one uniform condition."""
    cool = act("climate.set_temperature", "climate.living_room", {"hvac_mode": "cool", "temperature": temp})
    off = act("climate.turn_off", "climate.living_room")
    return {
        "weekdays": ["daily"], "start_date": None, "end_date": None, "repeat_type": "repeat", "name": "Living room Shabbat cooling",
        "tags": ["shabbat"],
        "timeslots": [slot("00:00:00", "06:00:00", [cool]), slot("06:00:00", "12:00:00", [off]), slot("12:00:00", "18:00:00", [cool]), slot("18:00:00", "22:00:00", [off]), slot("22:00:00", "00:00:00", [cool])],
    }


def msg(op: str, **kw) -> dict:
    base = {"user_id": "u1", "op": op, "request_id": "req-1", "ts": 1, "nonce": "n", "sig": "s"}
    if op == "add":
        base["payload"] = shabbat_cooling()
    elif op in policy.OPS_ON_EXISTING:
        base.update(schedule_id="3f9a1c", schedule_entity_id="switch.schedule_shbt_slvn")
    base.update(kw)
    return base


def refused(fn, *args, **kw) -> "policy.PolicyError":
    with pytest.raises(policy.PolicyError) as info:
        fn(*args, **kw)
    return info.value


# ---------------------------------------------------------------- accepted shapes


def test_live_shapes_are_accepted_and_every_action_is_returned():
    p = shabbat_cooling(25.5)  # float temperature seen live
    refs = policy.validate_payload(p, op="add")
    assert len(refs) == 5 and {r.entity_id for r in refs} == {"climate.living_room"}
    assert refs[0].path == "timeslots[0].actions[0]" and (refs[0].domain, refs[0].service) == ("climate", "set_temperature")
    # brightness 0-255 (what the card writes), sun start with offset, stop "00:00:00" (end of day), season dates
    p = {
        "weekdays": ["daily"], "repeat_type": "pause", "name": "Plain light", "start_date": "2026-10-31", "end_date": "2027-03-31",
        "timeslots": [slot("sunset+00:30:00", "23:00:00", [act("light.turn_on", "light.hall", {"brightness": 51})], []), slot("23:00:00", "00:00:00", [act("light.turn_off", "light.hall")], [])],
    }
    assert len(policy.validate_payload(p, op="add")) == 2
    # a point action: stop null; an alarm arm without code and without arguments; covers; a switch pair
    p = {"weekdays": ["daily"], "repeat_type": "repeat", "name": "Arm",
         "timeslots": [slot("22:00:00", None, [act("alarm_control_panel.alarm_arm_home", "alarm_control_panel.house")], []),
                       slot("07:00:00", "08:00:00", [act("cover.close_cover", "cover.gym_shutter"), act("cover.set_cover_position", "cover.gym_shutter", {"position": 10})], []),
                       slot("08:00:00", None, [act("switch.turn_on", "switch.sockets"), act("switch.turn_off", "switch.sockets")], [])]}
    assert len(policy.validate_payload(p, op="add")) == 5


def test_unnamed_schedule_is_editable_but_not_creatable():
    p = shabbat_cooling()
    p["name"] = ""
    assert refused(policy.validate_payload, p, op="add").path == "payload.name"
    assert policy.validate_payload({"name": ""}, op="edit") == []


def test_edit_takes_any_non_empty_subset_and_add_needs_the_full_shape():
    assert policy.validate_payload({"weekdays": ["mon", "tue"]}, op="edit") == []
    assert policy.validate_payload({"repeat_type": "single", "end_date": "2027-01-01"}, op="edit") == []
    assert refused(policy.validate_payload, {}, op="edit").path == "payload"
    for missing in ("weekdays", "timeslots", "repeat_type", "name"):
        p = shabbat_cooling()
        del p[missing]
        assert refused(policy.validate_payload, p, op="add").path == f"payload.{missing}"


def test_optional_slot_keys_may_be_omitted_the_stored_form_is_accepted_either_way():
    s = {"start": "07:00:00", "actions": [act("switch.turn_on", "switch.sockets")]}  # no stop / conditions / condition_type / track
    assert len(policy.validate_payload({"timeslots": [s]}, op="edit")) == 1
    s2 = {"start": "07:00:00", "stop": None, "conditions": [], "condition_type": None, "track_conditions": False, "actions": [act("switch.turn_on", "switch.sockets")]}
    assert len(policy.validate_payload({"timeslots": [s2]}, op="edit")) == 1


# ---------------------------------------------------------------- closed schemas


@pytest.mark.parametrize("mutate,path", [
    (lambda p: p.update(surprise=1), "payload.surprise"),
    (lambda p: p["timeslots"][0].update(surprise=1), "timeslots[0].surprise"),
    (lambda p: p["timeslots"][0]["actions"][0].update(target={"entity_id": "climate.x"}), "timeslots[0].actions[0].target"),
    (lambda p: p["timeslots"][0]["conditions"][0].update(surprise=1), "timeslots[0].conditions[0].surprise"),
])
def test_unknown_keys_are_refused_at_every_level(mutate, path):
    p = shabbat_cooling()
    mutate(p)
    e = refused(policy.validate_payload, p, op="add")
    assert e.code == "invalid_payload" and e.path == path


def test_message_level_unknown_keys_and_ops():
    assert refused(policy.validate_message, msg("add", extra="x")).path == "extra"
    for op in ("enable_all", "disable_all", "reload_storage", "run_action", "", None):
        m = msg("remove")
        m["op"] = op
        assert refused(policy.validate_message, m).code == "op_not_allowed"
    assert policy.OPS == {"add", "edit", "remove", "copy", "run", "enable", "disable"}


def test_message_field_rules_per_op():
    assert policy.validate_message(msg("edit", payload={"weekdays": ["daily"]})) == []
    assert policy.validate_message(msg("remove")) == [] and policy.validate_message(msg("enable")) == [] and policy.validate_message(msg("disable")) == []
    assert policy.validate_message(msg("copy", name="Copy of it")) == []
    assert refused(policy.validate_message, msg("copy")).path == "name"
    assert refused(policy.validate_message, msg("add", name="x")).path == "name"
    assert policy.validate_message(msg("run", time="07:00:00", skip_conditions=True)) == []
    assert refused(policy.validate_message, msg("run", time="sunset+00:30:00")).path == "time", "the add-on resolves sun times for a run"
    assert refused(policy.validate_message, msg("enable", skip_conditions=True)).path == "skip_conditions"
    assert refused(policy.validate_message, msg("enable", time="07:00:00")).path == "time"
    assert refused(policy.validate_message, msg("remove", payload={"weekdays": ["daily"]})).path == "payload"
    assert refused(policy.validate_message, msg("remove", schedule_entity_id="light.kitchen")).path == "schedule_entity_id"
    assert refused(policy.validate_message, msg("remove", schedule_entity_id="switch.schedule_x/../y")).path == "schedule_entity_id"
    m = msg("remove")
    del m["schedule_id"]
    assert refused(policy.validate_message, m).path == "schedule_id"
    assert refused(policy.validate_message, msg("add", schedule_id="3f9a1c")).path == "schedule_id", "add names no existing schedule"
    assert refused(policy.validate_message, msg("edit", payload={"weekdays": ["daily"]}, sensitive="yes")).path == "sensitive"


# ---------------------------------------------------------------- the allow-list and the arguments


@pytest.mark.parametrize("service,entity", [
    ("script.turn_on", "script.night"), ("scene.turn_on", "scene.movie"), ("media_player.media_play", "media_player.tv"),
    ("input_boolean.turn_on", "input_boolean.x"), ("siren.turn_on", "siren.hall"), ("vacuum.start", "vacuum.robo"),
    ("alarm_control_panel.alarm_trigger", "alarm_control_panel.house"), ("climate.set_swing_mode", "climate.living_room"),
    ("switch.toggle", "switch.sockets"), ("scheduler.remove", "switch.schedule_x"), ("homeassistant.turn_off", "light.hall"),
    ("switch", "switch.sockets"), ("", "switch.sockets"),
])
def test_unlisted_services_are_refused(service, entity):
    p = shabbat_cooling()
    p["timeslots"][0]["actions"] = [{"service": service, "entity_id": entity, "service_data": {}}]
    e = refused(policy.validate_payload, p, op="add")
    assert e.code in ("service_not_allowed", "invalid_payload") and e.path.startswith("timeslots[0].actions[0]")
    assert e.code == "service_not_allowed" or service in ("switch", "")


def test_an_action_without_entity_or_with_another_domain_is_refused():
    for bad in (None, "", "climate", "Climate.Living", ["climate.living_room"], "switch.sockets"):
        p = shabbat_cooling()
        p["timeslots"][1]["actions"] = [{"service": "climate.turn_off", "entity_id": bad, "service_data": {}}]
        e = refused(policy.validate_payload, p, op="add")
        assert e.code == "invalid_payload" and e.path == "timeslots[1].actions[0].entity_id", bad
    # the real-world "script with no entity" is not something the bridge ever writes
    p = shabbat_cooling()
    p["timeslots"][1]["actions"] = [{"service": "script.missing_script", "entity_id": None, "service_data": {}}]
    assert refused(policy.validate_payload, p, op="add").code == "service_not_allowed"


@pytest.mark.parametrize("service,entity,data", [
    ("light.turn_on", "light.hall", {"brightness": 256}), ("light.turn_on", "light.hall", {"brightness": -1}), ("light.turn_on", "light.hall", {"brightness": 5.5}),
    ("light.turn_on", "light.hall", {"brightness_pct": 0}), ("light.turn_on", "light.hall", {"brightness": 10, "brightness_pct": 10}),
    ("light.turn_on", "light.hall", {"color_name": "red"}), ("light.turn_on", "light.hall", {"brightness": True}), ("light.turn_on", "light.hall", {"brightness": "50"}),
    ("light.turn_off", "light.hall", {"transition": 3}),
    ("climate.set_temperature", "climate.a", {"temperature": 4.9}), ("climate.set_temperature", "climate.a", {"temperature": 35.1}),
    ("climate.set_temperature", "climate.a", {"temperature": True}), ("climate.set_temperature", "climate.a", {"temperature": "25"}),
    ("climate.set_temperature", "climate.a", {"temperature": float("nan")}), ("climate.set_temperature", "climate.a", {"hvac_mode": "cool"}),
    ("climate.set_temperature", "climate.a", {"temperature": 25, "hvac_mode": "turbo"}),
    ("climate.set_hvac_mode", "climate.a", {}), ("climate.set_hvac_mode", "climate.a", {"hvac_mode": "warm"}),
    ("climate.set_fan_mode", "climate.a", {"fan_mode": ""}), ("climate.set_preset_mode", "climate.a", {"preset_mode": "x" * 41}),
    ("cover.set_cover_position", "cover.a", {}), ("cover.set_cover_position", "cover.a", {"position": 101}), ("cover.set_cover_position", "cover.a", {"position": 50.0}),
    ("cover.set_cover_tilt_position", "cover.a", {"position": 10}), ("cover.close_cover", "cover.a", {"position": 10}),
    ("fan.set_percentage", "fan.a", {"percentage": 101}), ("fan.turn_on", "fan.a", {"percentage": 0}),
    ("switch.turn_on", "switch.a", {"entity_id": "switch.b"}),  # a second target smuggled into the data
    ("cover.close_cover", "cover.a", {"device_id": "abc"}), ("cover.close_cover", "cover.a", {"area_id": "gym"}),
    ("switch.turn_on", "switch.a", "not a mapping"),
])
def test_arguments_are_checked_by_type_range_and_name(service, entity, data):
    p = shabbat_cooling()
    p["timeslots"][0]["actions"] = [{"service": service, "entity_id": entity, "service_data": data}]
    e = refused(policy.validate_payload, p, op="add")
    assert e.code in ("argument_not_allowed", "invalid_payload") and e.path.startswith("timeslots[0].actions[0]"), (service, data, e.code, e.path)


def test_argument_edges_that_are_allowed():
    ok = [("light.turn_on", "light.a", {"brightness": 0}), ("light.turn_on", "light.a", {"brightness": 255}), ("light.turn_on", "light.a", {"brightness_pct": 100}),
          ("light.turn_on", "light.a", {}), ("climate.set_temperature", "climate.a", {"temperature": 5}), ("climate.set_temperature", "climate.a", {"temperature": 35}),
          ("climate.set_temperature", "climate.a", {"temperature": 25.5, "hvac_mode": "heat_cool"}), ("cover.set_cover_position", "cover.a", {"position": 0}),
          ("cover.set_cover_tilt_position", "cover.a", {"tilt_position": 100}), ("fan.set_percentage", "fan.a", {"percentage": 0}), ("fan.turn_on", "fan.a", {"percentage": 100})]
    for service, entity, data in ok:
        p = shabbat_cooling()
        p["timeslots"][0]["actions"] = [{"service": service, "entity_id": entity, "service_data": data}]
        refs = policy.validate_payload(p, op="add")
        assert refs[0].service == service.split(".")[1], (service, data)


# ---------------------------------------------------------------- no code, at any depth


@pytest.mark.parametrize("where", ["top", "slot", "action", "service_data", "condition", "nested_list", "deep"])
def test_a_code_key_is_refused_wherever_it_hides(where):
    p = shabbat_cooling()
    p["timeslots"][0]["actions"] = [act("lock.unlock", "lock.front")]
    if where == "top":
        p["code"] = "1234"
    elif where == "slot":
        p["timeslots"][0]["code"] = "1234"
    elif where == "action":
        p["timeslots"][0]["actions"][0]["code"] = "1234"
    elif where == "service_data":
        p["timeslots"][0]["actions"][0]["service_data"] = {"code": "1234"}
    elif where == "condition":
        p["timeslots"][0]["conditions"][0]["code"] = "1234"
    elif where == "nested_list":
        p["timeslots"][0]["actions"][0]["service_data"] = {"extras": [{"a": 1}, {"PIN": "1234"}]}
    else:
        node = p
        for _ in range(12):
            node["x"] = {}
            node = node["x"]
        node["code"] = "1234"
    e = refused(policy.validate_payload, p, op="add")
    assert e.code == "code_not_allowed" or (where == "deep" and e.code == "code_not_allowed"), (where, e.code)


@pytest.mark.parametrize("service,entity", [("alarm_control_panel.alarm_disarm", "alarm_control_panel.house"), ("alarm_control_panel.alarm_arm_away", "alarm_control_panel.house"),
                                            ("lock.unlock", "lock.front"), ("lock.lock", "lock.front")])
@pytest.mark.parametrize("key", ["code", "Code", "alarm_code", "pin", "pin_code", " code "])
def test_sensitive_actions_never_take_a_code_or_pin(service, entity, key):
    p = shabbat_cooling()
    p["timeslots"][0]["actions"] = [act(service, entity, {key: "1234"})]
    assert refused(policy.validate_payload, p, op="edit").code == "code_not_allowed"
    assert not any(a.name in policy.FORBIDDEN_KEYS for args in policy.ACTION_ARGS.values() for a in args), "no allow-listed service has a code argument"


# ---------------------------------------------------------------- times, days, dates, tags, caps, conditions


@pytest.mark.parametrize("field,value", [("start", "6:00"), ("start", "06:00"), ("start", "24:00:00"), ("start", "07:60:00"), ("start", "sunset"),
                                         ("start", "noon"), ("start", "sunset+25:00:00"), ("start", "sunset*00:30:00"), ("start", 600), ("start", None),
                                         ("stop", "06:00"), ("stop", "later")])
def test_times_must_be_in_the_stored_form(field, value):
    p = shabbat_cooling()
    p["timeslots"][0][field] = value
    assert refused(policy.validate_payload, p, op="add").path == f"timeslots[0].{field}"


def test_sun_times_with_either_sign_are_accepted():
    for t in ("sunrise+00:00:00", "sunset+00:30:00", "sunset-00:30:00", "sunrise-01:15:00"):
        p = shabbat_cooling()
        p["timeslots"][0]["start"] = t
        p["timeslots"][0]["stop"] = "23:59:59"
        policy.validate_payload(p, op="add")


@pytest.mark.parametrize("days,ok", [(["daily"], True), (["sun", "mon", "tue"], True), (["workday"], True), (["weekend"], True), (["sun", "sun"], False),
                                     ([], False), (["someday"], False), ("daily", False), (["sun", "mon", "tue", "wed", "thu", "fri", "sat", "daily"], False), ([1], False)])
def test_weekday_tokens(days, ok):
    p = shabbat_cooling()
    p["weekdays"] = days
    if ok:
        policy.validate_payload(p, op="add")
    else:
        assert refused(policy.validate_payload, p, op="add").path == "payload.weekdays"


def test_dates_repeat_and_tags():
    for bad in ("2026-13-01", "2026-02-30", "31-10-2026", "2026-1-1", 20261031):
        p = shabbat_cooling()
        p["start_date"] = bad
        assert refused(policy.validate_payload, p, op="add").path == "payload.start_date"
    p = shabbat_cooling()
    p["start_date"], p["end_date"] = "2027-03-31", "2026-10-31"
    assert refused(policy.validate_payload, p, op="add").path == "payload.end_date"
    p = shabbat_cooling()
    p["repeat_type"] = "forever"
    assert refused(policy.validate_payload, p, op="add").path == "payload.repeat_type"
    for tags in (["x"] * 11, [""], ["x" * 41], [1], "shabbat", ["a\nb"]):
        p = shabbat_cooling()
        p["tags"] = tags
        assert refused(policy.validate_payload, p, op="add").path == "payload.tags", tags
    p = shabbat_cooling()
    p["tags"] = ["x"] * 10 + []
    policy.validate_payload(p, op="add")


def test_caps():
    def add_with(**patch):
        p = shabbat_cooling()
        p.update(patch)
        return p

    assert refused(policy.validate_payload, add_with(name="x" * 81), op="add").path == "payload.name"
    assert refused(policy.validate_payload, add_with(name="bad\x00name"), op="add").path == "payload.name"
    policy.validate_payload(add_with(name="x" * 80), op="add")
    one = slot("00:00:00", "01:00:00", [act("switch.turn_on", "switch.a")], [])
    assert refused(policy.validate_payload, add_with(timeslots=[one] * 49), op="add").path == "payload.timeslots"
    policy.validate_payload(add_with(timeslots=[one] * 48), op="add")
    assert refused(policy.validate_payload, add_with(timeslots=[]), op="add").path == "payload.timeslots"
    many = slot("00:00:00", "01:00:00", [act("switch.turn_on", "switch.a")] * 21, [])
    assert refused(policy.validate_payload, add_with(timeslots=[many]), op="add").path == "timeslots[0].actions"
    assert refused(policy.validate_payload, add_with(timeslots=[slot("00:00:00", "01:00:00", [], [])]), op="add").path == "timeslots[0].actions"
    conds = [dict(COND, entity_id=f"binary_sensor.s{i}") for i in range(11)]
    assert refused(policy.validate_payload, add_with(timeslots=[slot("00:00:00", "01:00:00", [act("switch.turn_on", "switch.a")], conds)]), op="add").path == "timeslots[0].conditions"
    fifty_one = [slot("00:00:00", "01:00:00", [act("switch.turn_on", f"switch.s{k * 17 + i}") for i in range(17)], []) for k in range(3)]
    assert refused(policy.validate_payload, add_with(timeslots=fifty_one), op="add").path == "payload.timeslots", "51 distinct action entities"


@pytest.mark.parametrize("cond,ok", [
    ({"entity_id": "binary_sensor.shabbat_mode", "attribute": "state", "value": "on", "match_type": "is"}, True),
    ({"entity_id": "binary_sensor.shabbat_mode", "attribute": "state", "value": "off", "match_type": "not"}, True),
    ({"entity_id": "sensor.temp", "attribute": "state", "value": 20.5, "match_type": "above"}, True),
    ({"entity_id": "sensor.temp", "attribute": "temperature", "value": "18", "match_type": "below"}, True),
    ({"entity_id": "sun.sun", "attribute": "elevation", "value": -4, "match_type": "below"}, True),
    ({"entity_id": "sensor.temp", "attribute": "state", "value": "warm", "match_type": "above"}, False),
    ({"entity_id": "sensor.temp", "attribute": "state", "value": True, "match_type": "above"}, False),
    ({"entity_id": "binary_sensor.x", "attribute": "state", "value": "", "match_type": "is"}, False),
    ({"entity_id": "binary_sensor.x", "attribute": "state", "value": "x" * 101, "match_type": "is"}, False),
    ({"entity_id": "binary_sensor.x", "attribute": "state", "value": 1, "match_type": "is"}, False),
    ({"entity_id": "binary_sensor.x", "attribute": "State", "value": "on", "match_type": "is"}, False),
    ({"entity_id": "binary_sensor.x", "attribute": "state", "value": "on", "match_type": "equals"}, False),
    ({"entity_id": "not an entity", "attribute": "state", "value": "on", "match_type": "is"}, False),
    ({"attribute": "state", "value": "on", "match_type": "is"}, False),
])
def test_condition_shapes(cond, ok):
    p = shabbat_cooling()
    p["timeslots"][0]["conditions"] = [cond]
    if ok:
        policy.validate_payload(p, op="add")
    else:
        assert refused(policy.validate_payload, p, op="add").path.startswith("timeslots[0].conditions[0]")


def test_condition_type_and_track_flags():
    for field, value in (("condition_type", "xor"), ("track_conditions", "yes"), ("track_conditions", 1)):
        p = shabbat_cooling()
        p["timeslots"][0][field] = value
        assert refused(policy.validate_payload, p, op="add").path == f"timeslots[0].{field}"


# ---------------------------------------------------------------- the sensitive flag


@pytest.mark.parametrize("domain,service,attrs,needed", [
    ("lock", "unlock", None, True), ("lock", "lock", {}, True), ("alarm_control_panel", "alarm_arm_home", {}, True), ("alarm_control_panel", "alarm_disarm", None, True),
    ("button", "press", {}, True),
    ("cover", "open_cover", {"device_class": "gate"}, True), ("cover", "close_cover", {"device_class": "Garage"}, True), ("cover", "open_cover", {"device_class": "door"}, True),
    ("cover", "close_cover", {"device_class": "shutter"}, False), ("cover", "close_cover", {}, False), ("cover", "close_cover", None, False),
    ("light", "turn_on", {}, False), ("switch", "turn_on", {"device_class": "outlet"}, False), ("climate", "turn_off", {}, False), ("fan", "turn_on", {}, False),
])
def test_sensitive_required(domain, service, attrs, needed):
    assert policy.sensitive_required(domain, service, attrs) is needed


# ---------------------------------------------------------------- the allow-list against its neighbours


def test_allow_list_is_inside_the_bridges_allowed_services_and_the_addons_actions():
    assert policy.SCHEDULE_ACTION_SERVICES <= init_allowed_services(), "SCHEDULE_ACTION_SERVICES must be a subset of ALLOWED_SERVICES"
    from smplwise.services import ha_bridge

    addon = {(a["domain"], a["service"]) for a in ha_bridge.ACTIONS.values()}
    assert policy.SCHEDULE_ACTION_SERVICES <= addon, sorted(policy.SCHEDULE_ACTION_SERVICES - addon)
    domains = {d for d, _ in policy.SCHEDULE_ACTION_SERVICES}
    assert domains == {"light", "switch", "cover", "climate", "fan", "alarm_control_panel", "lock", "button"}
    assert not {"script", "scene", "siren", "media_player", "vacuum", "input_boolean", "number", "select", "humidifier"} & domains
    assert ("alarm_control_panel", "alarm_trigger") not in policy.SCHEDULE_ACTION_SERVICES


def test_policy_module_is_dependency_free():
    tree = ast.parse((SRC / "schedule_policy.py").read_text(encoding="utf-8"))
    imported = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported |= {a.name.split(".")[0] for a in node.names}
        elif isinstance(node, ast.ImportFrom) and node.level == 0:
            imported.add((node.module or "").split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            raise AssertionError("schedule_policy.py must not import its siblings")
    assert imported <= set(sys.stdlib_module_names) | {"__future__"}, imported - set(sys.stdlib_module_names)
