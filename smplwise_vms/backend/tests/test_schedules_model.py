"""CR-014 schedules - the pure model and policy (services/schedule_model.py, services/schedule_policy.py): normalisation of
the component's V-LIVE item shapes, the revision hash, the draft -> payload mapping (untouched slots byte-identical), the
validation matrix per class, overlaps (contiguous is fine), computed next runs with dates / repeat / zone, and the safety
policy tables. No database, no app, no Home Assistant."""
from __future__ import annotations

import copy
import datetime as dt
import json

import pytest

from smplwise.services import ha_bridge
from smplwise.services import schedule_model as m
from smplwise.services import schedule_policy as p

SENSOR = "binary_sensor.shabbat_mode"


def _slot(start, stop, actions, cond="on"):
    conds = [{"entity_id": SENSOR, "attribute": "state", "value": cond, "match_type": "is"}] if cond else []
    return {"start": start, "stop": stop, "conditions": conds, "condition_type": "or" if cond else None, "track_conditions": False, "actions": actions}


def _act(service, entity, data=None):
    return {"service": service, "entity_id": entity, "service_data": data if data is not None else {}}


def live_item():
    return {
        "schedule_id": "3f9a1c", "entity_id": "switch.schedule_x", "name": "Cooling", "enabled": True, "weekdays": ["daily"], "start_date": None, "end_date": None, "repeat_type": "repeat", "tags": ["shabbat"],
        "timeslots": [
            _slot("00:00:00", "06:00:00", [_act("climate.set_temperature", "climate.lr", {"hvac_mode": "cool", "temperature": 25.5})]),
            _slot("06:00:00", "sunset+00:30:00", [_act("climate.turn_off", "climate.lr")]),
            _slot("sunset+00:30:00", "00:00:00", [_act("light.turn_on", "light.office", {"brightness": 51})]),
        ],
        "timestamps": ["2026-10-03T00:00:00+03:00", "2026-10-03T06:00:00+03:00", "2026-10-02T18:45:00+03:00"], "next_entries": [2, 0, 1],
    }


ENTITIES = {
    "climate.lr": {"entity_id": "climate.lr", "name": "AC", "domain": "climate", "class": "climate", "refusal": None, "available": True, "state": "cool", "attributes": {"hvac_modes": ["off", "cool", "heat"], "min_temp": 16, "max_temp": 30}, "supported_features": 1},
    "light.office": {"entity_id": "light.office", "name": "Light", "domain": "light", "class": "light", "refusal": None, "available": True, "state": "off", "attributes": {}, "supported_features": 0},
    "switch.hall": {"entity_id": "switch.hall", "name": "Hall", "domain": "switch", "class": "switch", "refusal": None, "available": True, "state": "off", "attributes": {}, "supported_features": 0},
    "switch.pump": {"entity_id": "switch.pump", "name": "Pump", "domain": "switch", "class": None, "refusal": "switch_not_marked", "available": True, "state": "off", "attributes": {}, "supported_features": 0},
    "cover.shutter": {"entity_id": "cover.shutter", "name": "Shutter", "domain": "cover", "class": "cover", "refusal": None, "available": True, "state": "open", "attributes": {"current_position": 100}, "supported_features": 15},
    "cover.plain": {"entity_id": "cover.plain", "name": "No position", "domain": "cover", "class": "cover", "refusal": None, "available": True, "state": "open", "attributes": {}, "supported_features": 3},
    "cover.gate": {"entity_id": "cover.gate", "name": "Gate", "domain": "cover", "class": "door", "refusal": None, "available": True, "state": "closed", "attributes": {"device_class": "gate", "current_position": 0}, "supported_features": 7},
    "fan.hall": {"entity_id": "fan.hall", "name": "Fan", "domain": "fan", "class": "fan", "refusal": None, "available": True, "state": "off", "attributes": {}, "supported_features": 1},
    "alarm_control_panel.a": {"entity_id": "alarm_control_panel.a", "name": "Alarm", "domain": "alarm_control_panel", "class": "alarm", "refusal": None, "available": True, "state": "disarmed", "attributes": {}, "supported_features": 3},
    "alarm_control_panel.coded": {"entity_id": "alarm_control_panel.coded", "name": "Coded alarm", "domain": "alarm_control_panel", "class": "alarm", "refusal": None, "available": True, "state": "disarmed", "attributes": {}, "supported_features": 3},
    "lock.front": {"entity_id": "lock.front", "name": "Lock", "domain": "lock", "class": "lock", "refusal": None, "available": True, "state": "locked", "attributes": {}, "supported_features": 0},
    "binary_sensor.shabbat_mode": {"entity_id": SENSOR, "name": "Rest day", "domain": "binary_sensor", "class": None, "refusal": "action_not_allowed", "available": True, "state": "off", "attributes": {}, "supported_features": 0},
    "sensor.temp": {"entity_id": "sensor.temp", "name": "Temp", "domain": "sensor", "class": None, "refusal": "action_not_allowed", "available": True, "state": "22.5", "attributes": {}, "supported_features": 0},
    "sensor.down": {"entity_id": "sensor.down", "name": "Down", "domain": "sensor", "class": None, "refusal": "action_not_allowed", "available": False, "state": "unavailable", "attributes": {}, "supported_features": 0},
}
PANELS = {"alarm_control_panel.a": {"discovered": True, "arm_modes": ["arm_home", "arm_away"], "needs_code_arm": False, "needs_code_disarm": False},
          "alarm_control_panel.coded": {"discovered": True, "arm_modes": ["arm_home", "arm_away", "arm_night"], "needs_code_arm": True, "needs_code_disarm": True}}


class Ctx:
    tz_name = "Asia/Jerusalem"
    shabbat_sensor = SENSOR

    def __init__(self, classes=None):
        self.classes = set(classes or p.ALL_CLASSES)

    def entity(self, eid):
        return ENTITIES.get(eid)

    def panel(self, eid):
        return PANELS.get(eid, {"discovered": False})

    def enabled_classes(self):
        return self.classes

    def sun_seconds(self):
        return {"sunrise": 6 * 3600 + 30 * 60, "sunset": 18 * 3600 + 15 * 60}


def draft(name="D", slots=None, **kw):
    d = {"name": name, "weekdays": ["daily"], "start_date": None, "end_date": None, "repeat": "repeat", "tags": [], "conditions": {"items": [], "type": None, "track": False},
         "slots": slots if slots is not None else [{"start": "08:00:00", "stop": "09:00:00", "actions": [{"service": "light.turn_on", "entity_id": "light.office", "data": {"brightness": 80}}]}]}
    d.update(kw)
    return d


def errs(d, ctx=None, **kw):
    e, w = m.validate_draft(d, ctx or Ctx(), **kw)
    return e, w


def codes(items):
    return [x["code"] for x in items]


# ---------------------------------------------------------------- normalisation (V-LIVE shapes)

def test_normalize_v_live_shapes():
    core = m.normalize(live_item())
    assert core["id"] == "3f9a1c" and core["entity_id"] == "switch.schedule_x" and core["name"] == "Cooling" and core["repeat"] == "repeat" and core["tags"] == ["shabbat"]
    assert core["days"] == {"tokens": ["daily"], "kind": "daily", "days": ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]}
    s0, s1, s2 = core["slots"]
    assert s0["start"]["time"] == "00:00" and s0["start"]["raw"] == "00:00:00" and s0["stop"]["time"] == "06:00"
    assert s1["stop"]["kind"] == "sun" and s1["stop"]["event"] == "sunset" and s1["stop"]["offset_min"] == 30 and s1["stop"]["raw"] == "sunset+00:30:00"
    assert s2["start"]["kind"] == "sun" and s2["actions"][0]["data"] == {"brightness": 51}
    assert s0["actions"][0]["data"] == {"hvac_mode": "cool", "temperature": 25.5}
    assert core["conditions"]["uniform"] is True and core["conditions"]["type"] == "or" and core["conditions"]["items"][0]["value"] == "on" and core["conditions"]["track"] is False
    assert m.action_entities(core) == ["climate.lr", "light.office"]


def test_normalize_tolerates_the_component_s_variants():
    item = {"schedule_id": "aaaaaa", "weekdays": ["sat", "mon"], "timeslots": [
        {"start": "7:05", "actions": [{"service": "light.turn_on", "entity_id": "light.office", "service_data": {"entity_id": "light.office", "brightness": 10}}]},
        {"start": "08:00:00", "stop": None, "conditions": [], "condition_type": None, "track_conditions": False, "actions": [{"service": "script.x", "entity_id": None, "service_data": {}}]}]}
    core = m.normalize(item)
    assert core["days"]["kind"] == "days" and core["days"]["days"] == ["mon", "sat"]  # any order in, Sunday-first out
    assert core["slots"][0]["start"]["time"] == "07:05" and core["slots"][0]["stop"] is None and core["slots"][0]["actions"][0]["data"] == {"brightness": 10}
    assert core["slots"][1]["actions"][0]["entity_id"] is None and core["name"] is None and core["enabled"] is True and core["tags"] == [] and core["conditions"]["items"] == []
    assert m.normalize({"schedule_id": "bbbbbb"})["slots"] == []
    assert m.days_view(["workday"]) == {"tokens": ["workday"], "kind": "workday", "days": None}
    assert m.days_view(["weekend", "mon"])["kind"] == "mixed" and m.resolve_days(["weekend"]) is None


def test_upcoming_from_timestamps_and_next_entries():
    core = m.normalize(live_item())
    ups = m.upcoming(core)
    assert ups == [{"at": "2026-10-02T15:45:00Z", "slot_index": 2}, {"at": "2026-10-02T21:00:00Z", "slot_index": 0}, {"at": "2026-10-03T03:00:00Z", "slot_index": 1}]
    assert m.upcoming({**core, "next_entries": [7, 1]}) == [{"at": "2026-10-03T03:00:00Z", "slot_index": 1}]  # an index out of range is ignored


def test_revision_is_stable_across_time_and_switch_and_moves_with_content():
    item = live_item()
    rev = m.revision(item)
    assert len(rev) == 16 and int(rev, 16) >= 0
    later = copy.deepcopy(item)
    later["timestamps"] = ["2030-01-01T00:00:00+02:00"] * 3
    later["next_entries"] = [0, 1, 2]
    later["enabled"] = False
    later["entity_id"] = "switch.schedule_renamed"
    assert m.revision(later) == rev
    changed = copy.deepcopy(item)
    changed["timeslots"][0]["actions"][0]["service_data"]["temperature"] = 24
    assert m.revision(changed) != rev
    renamed = copy.deepcopy(item)
    renamed["name"] = "Other"
    assert m.revision(renamed) != rev
    reordered = json.loads(json.dumps(item, sort_keys=True))
    assert m.revision(reordered) == rev  # key order never matters


# ---------------------------------------------------------------- draft -> payload

def draft_from(item):
    core = m.normalize(item)
    return {"name": core["name"], "weekdays": list(core["weekdays"]), "start_date": core["start_date"], "end_date": core["end_date"], "repeat": core["repeat"], "tags": list(core["tags"]),
            "conditions": {"items": [dict(c) for c in core["conditions"]["items"]], "type": core["conditions"]["type"], "track": core["conditions"]["track"]},
            "slots": [{"start": s["start"]["raw"], "stop": s["stop"]["raw"] if s["stop"] else None,
                       "actions": [{"service": a["service"], "entity_id": a["entity_id"], "data": dict(a["data"])} for a in s["actions"]]} for s in core["slots"]]}


def test_an_unchanged_draft_makes_an_empty_edit():
    item = live_item()
    assert m.to_component_payload(draft_from(item), item) == {}


def test_untouched_slots_are_resent_in_their_equivalent_write_form():
    """The component rejects nulls and empties on write, so a slot can never be re-sent byte-identical: it is re-sent as
    `component_slot(stored slot)` (equivalence, verified by the round-trip test with the fake)."""
    item = live_item()
    d = draft_from(item)
    d["slots"][1]["actions"][0]["service"] = "climate.set_hvac_mode"
    d["slots"][1]["actions"][0]["data"] = {"hvac_mode": "heat"}
    payload = m.to_component_payload(d, item)
    assert set(payload) == {"timeslots", "start_date", "end_date"} and len(payload["timeslots"]) == 3
    assert payload["start_date"] is None and payload["end_date"] is None  # an edit without the dates would wipe them
    assert payload["timeslots"][0] == m.component_slot(item["timeslots"][0]) and payload["timeslots"][2] == m.component_slot(item["timeslots"][2])
    assert payload["timeslots"][1]["actions"] == [{"service": "climate.set_hvac_mode", "entity_id": "climate.lr", "service_data": {"hvac_mode": "heat"}}]
    assert payload["timeslots"][1]["conditions"] == item["timeslots"][1]["conditions"] and payload["timeslots"][1]["condition_type"] == "or"
    assert payload["timeslots"][0] is not item["timeslots"][0]  # a copy, never the cached object


def test_changing_conditions_rewrites_every_slot_and_top_level_changes_are_partial():
    item = live_item()
    d = draft_from(item)
    d["conditions"] = {"items": [{"entity_id": SENSOR, "attribute": "state", "match_type": "is", "value": "off"}], "type": "or", "track": True}
    d["name"] = "Renamed"
    d["weekdays"] = ["mon", "tue"]
    payload = m.to_component_payload(d, item)
    assert set(payload) == {"name", "weekdays", "timeslots", "start_date", "end_date"} and payload["name"] == "Renamed" and payload["weekdays"] == ["mon", "tue"]
    assert all(s["conditions"][0]["value"] == "off" and s["track_conditions"] is True and s["condition_type"] == "or" for s in payload["timeslots"])
    # removing them writes NO conditions keys at all: `conditions: []` and a null condition_type are rejected by the component
    d["conditions"] = {"items": [], "type": None, "track": False}
    empty = m.to_component_payload(d, item)["timeslots"]
    assert all("conditions" not in s and "condition_type" not in s and "track_conditions" not in s for s in empty)


def test_the_write_normaliser_drops_nulls_and_empties():
    """Verified on the lab component: stop:null crashes, an action entity_id null / "" is rejected, conditions:[] is rejected,
    condition_type / track_conditions null are rejected, service_data null is rejected."""
    raw = {"start": "03:15", "stop": None, "conditions": [], "condition_type": None, "track_conditions": False,
           "actions": [{"service": "script.turn_on", "entity_id": None, "service_data": {}}, {"service": "light.turn_off", "entity_id": "", "service_data": {}}, {"service": "light.turn_on", "entity_id": "light.a", "service_data": {"brightness": 5}}]}
    assert m.component_slot(raw) == {"start": "03:15", "actions": [{"service": "script.turn_on"}, {"service": "light.turn_off"}, {"service": "light.turn_on", "entity_id": "light.a", "service_data": {"brightness": 5}}]}
    with_cond = {"start": "03:15:00", "stop": "04:00:00", "conditions": [{"entity_id": "sun.sun", "attribute": None, "value": True, "match_type": "is"}], "condition_type": None, "track_conditions": None, "actions": []}
    assert m.component_slot(with_cond) == {"start": "03:15:00", "stop": "04:00:00", "conditions": [{"entity_id": "sun.sun", "match_type": "is", "value": True}], "condition_type": "or", "track_conditions": False, "actions": []}
    assert m.normalize({"schedule_id": "aaaaaa", "timeslots": [{"start": "03:15", "actions": []}]})["slots"][0]["start"]["time"] == "03:15"  # a stored time without seconds is read
    assert m.to_component_payload(draft("D"), None)["timeslots"][0].keys() == {"start", "stop", "actions"}
    dates = m.to_component_payload({**draft("D"), "name": "Renamed", "start_date": "2026-10-31", "end_date": "2027-03-31"},
                                   {"schedule_id": "aaaaaa", "name": "D", "weekdays": ["daily"], "start_date": "2026-10-31", "end_date": "2027-03-31", "repeat_type": "repeat", "timeslots": [], "tags": []})
    assert dates == {"name": "Renamed", "timeslots": [{"start": "08:00:00", "stop": "09:00:00", "actions": [{"service": "light.turn_on", "entity_id": "light.office", "service_data": {"brightness": 80}}]}],
                     "start_date": "2026-10-31", "end_date": "2027-03-31"}


def test_create_payload_maps_the_draft():
    d = draft("Evening", [{"start": "18:00", "stop": None, "actions": [{"service": "light.turn_off", "entity_id": "light.office", "data": {}}]}], repeat="pause", start_date="2026-11-01", tags=["x"],
              conditions={"items": [{"entity_id": SENSOR, "attribute": "state", "match_type": "is", "value": "on"}], "type": None, "track": False})
    payload = m.to_component_payload(d, None)
    assert payload["repeat_type"] == "pause" and payload["name"] == "Evening" and payload["weekdays"] == ["daily"] and payload["start_date"] == "2026-11-01" and "end_date" not in payload
    assert payload["tags"] == ["x"]  # verified 2026-09-30: add / edit accept tags
    slot = payload["timeslots"][0]
    assert slot["start"] == "18:00:00" and "stop" not in slot and slot["condition_type"] == "or"  # a point action has no stop key on write and slot["conditions"] == [{"entity_id": SENSOR, "attribute": "state", "value": "on", "match_type": "is"}]
    assert "tags" not in m.to_component_payload(d, None, tags_supported=False)


def test_diff_summary_names_what_changed_never_values():
    item = live_item()
    old = m.normalize(item)
    d = draft_from(item)
    assert m.diff_summary(old, d) == {"days": False, "dates": False, "repeat": False, "conditions_changed": False, "slots_added": 0, "slots_removed": 0, "slots_changed": 0, "name_changed": False}
    d["slots"].append({"start": "23:00:00", "stop": None, "actions": [{"service": "light.turn_off", "entity_id": "light.office", "data": {}}]})
    d["slots"][0]["actions"][0]["data"]["temperature"] = 20
    d["name"] = "N"
    diff = m.diff_summary(old, d)
    assert diff["slots_added"] == 1 and diff["slots_changed"] == 1 and diff["name_changed"] is True and "temperature" not in json.dumps(diff)


# ---------------------------------------------------------------- classification and the read-only rule

def test_classify_understood_and_the_read_only_reasons():
    core = m.normalize(live_item())
    res = m.classify(core, lambda e: ENTITIES.get(e))
    assert res["understood"] is True and res["sensitive"] is False and res["lowering"] is False
    assert res["slots"][0]["actions"][0] == {"service": "climate.set_temperature", "entity_id": "climate.lr", "data": {"hvac_mode": "cool", "temperature": 25.5}, "supported": True, "class": "climate", "sensitive": False, "lowering": False}
    bad = live_item()
    bad["timeslots"].append(_slot("22:00:00", None, [{"service": "script.gone", "entity_id": None, "service_data": {}}]))
    r = m.classify(m.normalize(bad), lambda e: ENTITIES.get(e))
    assert r["understood"] is False and r["slots"][3]["unsupported"][0]["code"] == "action_without_entity" and r["slots"][0]["supported"] is True
    cases = {
        "action_not_allowed": _act("light.turn_on", "switch.pump"), "argument_not_allowed": _act("light.turn_on", "light.office", {"effect": "rainbow"}),
        "contains_code": _act("alarm_control_panel.alarm_arm_home", "alarm_control_panel.a", {"code": "1234"}),
        "alarm_managed_control": None,
    }
    for code, action in cases.items():
        if action is None:
            continue
        it = live_item()
        it["timeslots"] = [_slot("08:00:00", None, [action], cond=None)]
        got = m.classify(m.normalize(it), lambda e: ENTITIES.get(e))
        assert got["slots"][0]["unsupported"][0]["code"] == code, code
    it = live_item()
    it["timeslots"][1]["conditions"] = []
    it["timeslots"][1]["condition_type"] = None
    got = m.classify(m.normalize(it), lambda e: ENTITIES.get(e))
    assert got["understood"] is False and got["slots"][1]["unsupported"][0]["code"] == "conditions_differ" and m.normalize(it)["conditions"]["uniform"] is False
    unk = live_item()
    unk["timeslots"][0]["mystery"] = 1
    assert m.classify(m.normalize(unk), lambda e: ENTITIES.get(e))["slots"][0]["unsupported"][0]["code"] == "unknown_fields"
    managed = {"switch.bypass": {"class": None, "refusal": "alarm_managed_control"}}
    it = live_item()
    it["timeslots"] = [_slot("08:00:00", None, [_act("switch.turn_on", "switch.bypass")], cond=None)]
    assert m.classify(m.normalize(it), lambda e: managed.get(e))["slots"][0]["unsupported"][0]["code"] == "alarm_managed_control"
    gate = live_item()
    gate["timeslots"] = [_slot("08:00:00", None, [_act("cover.open_cover", "cover.gate")], cond=None)]
    g = m.classify(m.normalize(gate), lambda e: ENTITIES.get(e))
    assert g["sensitive"] is True and g["sensitive_classes"] == ["door"] and g["lowering"] is True and g["slots"][0]["actions"][0]["lowering"] is True


# ---------------------------------------------------------------- validation matrix

def slot_of(service, entity, data=None, start="08:00:00", stop="09:00:00"):
    return {"start": start, "stop": stop, "actions": [{"service": service, "entity_id": entity, "data": data or {}}]}


@pytest.mark.parametrize("service,entity,data,code", [
    ("light.turn_on", "light.office", {"brightness": 256}, "out_of_range"), ("light.turn_on", "light.office", {"brightness": -1}, "out_of_range"),
    ("light.turn_on", "light.office", {"brightness_pct": 0}, "out_of_range"), ("light.turn_on", "light.office", {"brightness": 5, "brightness_pct": 5}, "argument_conflict"),
    ("light.turn_on", "light.office", {"brightness": "high"}, "invalid_value"), ("light.turn_on", "light.office", {"brightness": True}, "invalid_value"),
    ("light.turn_on", "light.office", {"effect": "x"}, "argument_not_allowed"), ("light.turn_off", "light.office", {"brightness": 1}, "argument_not_allowed"),
    ("cover.set_cover_position", "cover.shutter", {}, "required"), ("cover.set_cover_position", "cover.shutter", {"position": 101}, "out_of_range"),
    ("cover.set_cover_position", "cover.plain", {"position": 50}, "argument_not_allowed"),
    ("climate.set_temperature", "climate.lr", {"temperature": 15}, "out_of_range"), ("climate.set_temperature", "climate.lr", {"temperature": 31}, "out_of_range"),
    ("climate.set_temperature", "climate.lr", {"temperature": "hot"}, "invalid_value"), ("climate.set_temperature", "climate.lr", {}, "required"),
    ("climate.set_temperature", "climate.lr", {"temperature": 25, "hvac_mode": "dry"}, "invalid_value"),
    ("climate.set_hvac_mode", "climate.lr", {"hvac_mode": "fan_only"}, "invalid_value"), ("climate.set_hvac_mode", "climate.lr", {}, "required"),
    ("fan.set_percentage", "fan.hall", {"percentage": 101}, "out_of_range"), ("fan.turn_on", "fan.hall", {"percentage": 0}, "out_of_range"),
    ("alarm_control_panel.alarm_arm_home", "alarm_control_panel.a", {"code": "1234"}, "code_not_allowed"), ("lock.lock", "lock.front", {"code": "1"}, "code_not_allowed"),
    ("alarm_control_panel.alarm_arm_home", "alarm_control_panel.a", {"reason": "x"}, "argument_not_allowed"),
])
def test_argument_validation_matrix(service, entity, data, code):
    e, _ = errs(draft("V", [slot_of(service, entity, data)]))
    assert code in codes(e), (service, data, e)


@pytest.mark.parametrize("service,entity,data", [
    ("light.turn_on", "light.office", {"brightness": 0}), ("light.turn_on", "light.office", {"brightness": 255}), ("light.turn_on", "light.office", {"brightness_pct": 100}), ("light.turn_on", "light.office", {}),
    ("switch.turn_on", "switch.hall", {}), ("switch.turn_off", "switch.hall", {}), ("cover.close_cover", "cover.shutter", {}), ("cover.set_cover_position", "cover.shutter", {"position": 0}),
    ("cover.stop_cover", "cover.plain", {}), ("climate.set_temperature", "climate.lr", {"temperature": 25.5, "hvac_mode": "cool"}), ("climate.set_temperature", "climate.lr", {"temperature": 16}),
    ("climate.turn_off", "climate.lr", {}), ("fan.turn_on", "fan.hall", {"percentage": 50}), ("fan.set_percentage", "fan.hall", {"percentage": 0}),
    ("alarm_control_panel.alarm_arm_home", "alarm_control_panel.a", {}), ("alarm_control_panel.alarm_disarm", "alarm_control_panel.a", {}), ("lock.unlock", "lock.front", {}),
    ("cover.open_cover", "cover.gate", {}), ("cover.set_cover_position", "cover.gate", {"position": 0}),
])
def test_valid_actions_pass(service, entity, data):
    e, _ = errs(draft("V", [slot_of(service, entity, data)]))
    assert e == [], (service, data, e)


def test_class_and_service_pairing_and_unknown_entities():
    assert "action_not_allowed" in codes(errs(draft("V", [slot_of("light.turn_on", "switch.hall")]))[0])  # a service of another class
    assert "action_not_allowed" in codes(errs(draft("V", [slot_of("script.turn_on", "light.office")]))[0])
    assert "entity_unknown" in codes(errs(draft("V", [slot_of("light.turn_on", "light.nowhere")]))[0])
    assert "switch_not_marked" in codes(errs(draft("V", [slot_of("switch.turn_on", "switch.pump")]))[0])
    no_entity = draft("V", [{"start": "08:00:00", "stop": None, "actions": [{"service": "light.turn_on", "entity_id": None, "data": {}}]}])
    assert "action_not_allowed" in codes(errs(no_entity)[0])
    e, _ = errs(draft("V", [slot_of("climate.turn_off", "climate.lr")]), Ctx(classes={"light"}))
    assert codes(e) == ["class_not_allowed"]
    # an action that was there before is not refused by a class switched off since (it is only read-only)
    old = m.normalize({"schedule_id": "aaaaaa", "name": "V", "timeslots": [_slot("08:00:00", "09:00:00", [_act("climate.turn_off", "climate.lr")], cond=None)]})
    e, _ = errs(draft("V", [slot_of("climate.turn_off", "climate.lr")]), Ctx(classes={"light"}), old=old, creating=False)
    assert e == []


def test_alarm_and_lock_code_rules_for_new_and_unchanged_actions():
    e, _ = errs(draft("V", [slot_of("alarm_control_panel.alarm_arm_home", "alarm_control_panel.coded")]))
    assert codes(e) == ["alarm_code_needed"]
    e, _ = errs(draft("V", [slot_of("alarm_control_panel.alarm_disarm", "alarm_control_panel.coded")]))
    assert codes(e) == ["alarm_code_needed"]
    assert codes(errs(draft("V", [slot_of("alarm_control_panel.alarm_arm_night", "alarm_control_panel.a")]))[0]) == ["arm_mode_not_supported"]
    assert errs(draft("V", [slot_of("alarm_control_panel.alarm_arm_home", "alarm_control_panel.a")]))[0] == []
    # an existing, unchanged arm action on a panel that now says it needs a code is kept with a warning, not refused
    old = m.normalize({"schedule_id": "aaaaaa", "name": "V", "timeslots": [_slot("08:00:00", "09:00:00", [_act("alarm_control_panel.alarm_arm_home", "alarm_control_panel.coded")], cond=None)]})
    e, w = errs(draft("V", [slot_of("alarm_control_panel.alarm_arm_home", "alarm_control_panel.coded")]), old=old, creating=False)
    assert e == [] and codes(w) == ["alarm_may_need_code"]
    # ... but changing it is a new action
    e, _ = errs(draft("V", [slot_of("alarm_control_panel.alarm_arm_away", "alarm_control_panel.coded")]), old=old, creating=False)
    assert codes(e) == ["alarm_code_needed"]


# ---------------------------------------------------------------- structure

def test_times_and_overlaps():
    def slots(*pairs, entity="light.office"):
        return [{"start": a, "stop": b, "actions": [{"service": "light.turn_off", "entity_id": entity, "data": {}}]} for a, b in pairs]

    assert errs(draft("V", slots(("00:00:00", "06:00:00"), ("06:00:00", "12:00:00"), ("12:00:00", "00:00:00"))))[0] == []  # contiguous, the V-LIVE shape
    assert errs(draft("V", slots(("00:00:00", "06:00:01"), ("06:00:00", "12:00:00"))))[0][0]["code"] == "slots_overlap"
    assert codes(errs(draft("V", slots(("08:00:00", "10:00:00"), ("09:00:00", "09:30:00"), ("11:00:00", "12:00:00"))))[0]) == ["slots_overlap"]  # nested, not just neighbours
    assert errs(draft("V", slots(("08:00:00", None), ("08:00:00", None))))[0][0]["code"] == "slots_overlap"  # two point slots at the same minute
    assert errs(draft("V", slots(("08:00:00", None), ("08:01:00", None))))[0] == []
    assert "validation" in codes(errs(draft("V", slots(("10:00:00", "09:00:00"))))[0])  # stop before start
    assert "validation" in codes(errs(draft("V", slots(("25:00:00", None))))[0])
    assert errs(draft("V", slots(("22:00:00", "00:00:00"))))[0] == []  # "00:00:00" as stop = end of day
    e, w = errs(draft("V", slots(("sunset+00:00:00", "23:00:00"), ("18:00:00", "19:00:00"))))
    assert e == [] and codes(w) == ["sun_overlap_possible"]  # sun slots overlap only as a warning
    assert errs(draft("V", slots(("sunset-00:10:00", None))))[0] == []  # negative offsets: verified 2026-09-30 (`sunrise-00:15:00` works as start and stop)
    assert "validation" in codes(errs(draft("V", slots(("24:00:00", None))))[0]) and "validation" in codes(errs(draft("V", slots(("SUNSET+00:10:00", None))))[0])
    assert errs(draft("V", slots(("sunrise+01:00:00", None))))[0] == []
    assert "validation" in codes(errs(draft("V", []))[0])
    assert "validation" in codes(errs(draft("V", slots(*([("08:00:00", None)] * 49))))[0])  # more than 48 slots


def test_name_days_dates_tags_repeat():
    assert "validation" in codes(errs(draft(""))[0]) and errs(draft(""), creating=False)[0] == []
    assert "validation" in codes(errs(draft("x" * 81))[0]) and "validation" in codes(errs(draft("a\nb"))[0])
    assert "validation" in codes(errs(draft("V", weekdays=["someday"]))[0]) and "validation" in codes(errs(draft("V", weekdays=[]))[0])
    assert "validation" in codes(errs(draft("V", weekdays=["workday"]))[0])  # workday / weekend only when unchanged (P0-1)
    old = m.normalize({"schedule_id": "aaaaaa", "name": "V", "weekdays": ["workday"], "timeslots": []})
    assert "weekdays" not in [x["path"] for x in errs(draft("V", weekdays=["workday"]), old=old, creating=False)[0]]
    assert "validation" in codes(errs(draft("V", start_date="2026-13-40"))[0])
    assert "validation" in codes(errs(draft("V", start_date="2026-12-01", end_date="2026-11-01"))[0])
    assert errs(draft("V", tags=["a"]))[0] == [] and errs(draft("V", tags=[]))[0] == []  # tags are written: verified 2026-09-30
    assert "validation" in codes(errs(draft("V", weekdays=["mon", "mon"]))[0])  # the component refuses duplicates
    p.CAPABILITIES["tags"] = False  # (the capability flag stays honoured for an older component)
    try:
        assert codes(errs(draft("V", tags=["a"]))[0]) == ["tags_not_supported"]
        old_t = m.normalize({"schedule_id": "aaaaaa", "name": "V", "tags": ["a"], "timeslots": []})
        assert "tags_not_supported" not in codes(errs(draft("V", tags=["a"]), old=old_t, creating=False)[0])
    finally:
        p.CAPABILITIES["tags"] = True
    assert codes(errs(draft("V", repeat="single"))[1]) == ["single_deletes"]


def test_unavailable_entity_warns():
    ENTITIES["light.office"]["available"] = False
    try:
        assert codes(errs(draft("V"))[1]) == ["entity_unavailable"]
    finally:
        ENTITIES["light.office"]["available"] = True


# ---------------------------------------------------------------- computed next runs

def test_computed_next_runs_with_zone_dates_and_repeat():
    core = m.normalize({"schedule_id": "aaaaaa", "name": "V", "weekdays": ["sun", "wed"], "repeat_type": "repeat", "timeslots": [_slot("08:00:00", None, [_act("light.turn_on", "light.office")], cond=None), _slot("20:00", None, [_act("light.turn_off", "light.office")], cond=None)]})
    now = dt.datetime(2026, 9, 30, 6, 0, tzinfo=dt.timezone.utc)  # Wednesday 09:00 in Israel (UTC+3, summer time)
    runs = m.next_runs_computed(core, now, "Asia/Jerusalem", None, 4)
    assert [(r["at"], r["slot_index"]) for r in runs] == [("2026-09-30T17:00:00Z", 1), ("2026-10-04T05:00:00Z", 0), ("2026-10-04T17:00:00Z", 1), ("2026-10-07T05:00:00Z", 0)]
    # the winter offset applies after the clock change (2026-10-25): 08:00 is 06:00 UTC, no fixed adjustment
    late = m.next_runs_computed(core, dt.datetime(2026, 10, 20, 0, 0, tzinfo=dt.timezone.utc), "Asia/Jerusalem", None, 6)
    assert {r["at"] for r in late} >= {"2026-10-21T05:00:00Z", "2026-10-25T06:00:00Z", "2026-10-28T06:00:00Z"}
    ranged = {**core, "start_date": "2026-11-01", "end_date": "2026-11-11"}
    r2 = m.next_runs_computed(ranged, now, "Asia/Jerusalem", None, 10)
    assert r2[0]["at"] == "2026-11-01T06:00:00Z" and all(x["at"] <= "2026-11-11T23:59:59Z" for x in r2) and len(r2) == 8
    once = {**core, "repeat": "single"}
    assert len(m.next_runs_computed(once, now, "Asia/Jerusalem", None, 5)) == 1 and len(m.next_runs_computed({**core, "repeat": "pause"}, now, "Asia/Jerusalem", None, 5)) == 1
    assert m.next_runs_computed({**core, "weekdays": ["workday"], "days": None}, now, "Asia/Jerusalem", None, 5) == []  # workday / weekend are not computed
    sun = m.sun_seconds_from("2026-10-01T03:32:00+00:00", "2026-09-30T15:15:00+00:00", "Asia/Jerusalem")
    assert sun == {"sunrise": 6 * 3600 + 32 * 60, "sunset": 18 * 3600 + 15 * 60}
    core_sun = m.normalize({"schedule_id": "aaaaaa", "name": "S", "weekdays": ["daily"], "timeslots": [_slot("sunset+00:30:00", None, [_act("light.turn_on", "light.office")], cond=None)]})
    assert m.next_runs_computed(core_sun, now, "Asia/Jerusalem", sun, 1)[0]["at"] == "2026-09-30T15:45:00Z"
    assert m.next_runs_computed(core_sun, now, "Asia/Jerusalem", None, 1) == []  # no sun figures: nothing invented
    late_night = m.normalize({"schedule_id": "aaaaaa", "name": "S", "weekdays": ["daily"], "timeslots": [_slot("sunset+08:00:00", None, [_act("light.turn_on", "light.office")], cond=None)]})
    assert m.next_runs_computed(late_night, now, "Asia/Jerusalem", sun, 1)[0]["at"] == "2026-09-30T20:59:00Z"  # offsets clamp to 23:59


# ---------------------------------------------------------------- conditions text

def test_condition_summary_and_presets():
    names = {SENSOR: "איסור מלאכה", "sensor.temp": "טמפרטורה"}.get
    on = [{"entity_id": SENSOR, "attribute": "state", "match_type": "is", "value": "on"}]
    off = [{"entity_id": SENSOR, "attribute": "state", "match_type": "is", "value": "off"}]
    assert m.condition_summary(on, "or", SENSOR, names) == ("רק בשבת ובחג", "only_holy_days")
    assert m.condition_summary(off, "or", SENSOR, names) == ("לא בשבת ובחג", "not_holy_days")
    assert m.condition_summary(on, "or", None, names) == ("בתנאי: איסור מלאכה פעיל", None)  # no sensor configured: no preset
    assert m.condition_summary(on, "or", "binary_sensor.other", names) == ("בתנאי: איסור מלאכה פעיל", None)
    multi = on + [{"entity_id": "sensor.temp", "attribute": "state", "match_type": "above", "value": 28}]
    assert m.condition_summary(multi, "or", SENSOR, names)[0] == "בתנאי: איסור מלאכה פעיל או טמפרטורה מעל 28"
    assert m.condition_summary(multi, "and", SENSOR, names)[0].endswith("וגם טמפרטורה מעל 28")
    assert m.condition_summary([{"entity_id": SENSOR, "attribute": "state", "match_type": "not", "value": "on"}], "or", SENSOR, names)[0] == "בתנאי: איסור מלאכה כבוי"
    assert m.condition_summary([], None, SENSOR, names) == (None, None)


def test_condition_validation():
    def cs(*items, ctype="or", slots=None):
        return draft("V", slots, conditions={"items": list(items), "type": ctype, "track": False})

    good = {"entity_id": SENSOR, "attribute": "state", "match_type": "is", "value": "on"}
    assert errs(cs(good))[0] == []
    assert codes(errs(cs({**good, "entity_id": "light.office"}))[0]) == ["condition_domain_not_allowed"]
    assert codes(errs(cs({**good, "entity_id": "binary_sensor.nowhere"}))[0]) == ["entity_unknown"]
    assert codes(errs(cs({**good, "value": 5}))[0]) == ["validation"] and codes(errs(cs({**good, "attribute": "Bad Attr"}))[0]) == ["validation"]
    assert errs(cs({"entity_id": "sensor.temp", "attribute": "state", "match_type": "above", "value": 28}))[0] == []
    assert codes(errs(cs({"entity_id": SENSOR, "attribute": "state", "match_type": "above", "value": 28}))[0]) == ["validation"]  # a numeric compare on a non-numeric state is refused
    assert codes(errs(cs(good, good, good, good, good, good, good, good, good, good, good))[0]) == ["validation"]  # > 10 conditions
    assert codes(errs(cs(good, {**good, "value": "off"}, ctype=None))[0]) == ["validation"]  # several need and / or
    # a sensitive schedule whose condition entity is unavailable warns
    sens = [slot_of("cover.open_cover", "cover.gate")]
    unavailable = {"entity_id": "sensor.down", "attribute": "state", "match_type": "is", "value": "on"}
    e, w = errs(cs(unavailable, slots=sens))
    assert "sensitive_condition_unavailable" in codes(w) and "condition_entity_unavailable" in codes(w)
    assert "sensitive_condition_unavailable" not in codes(errs(cs(unavailable))[1])


# ---------------------------------------------------------------- policy

def test_policy_tables():
    assert p.SCHEDULE_ACTION_SERVICES <= set(ha_bridge.ACTIONS)  # never a service the product's own allow-list lacks
    assert not any(s.startswith(("scene.", "script.", "siren.", "media_player.", "number.", "select.")) for s in p.SCHEDULE_ACTION_SERVICES)
    for cls, services in p.SCHEDULE_ACTIONS.items():
        for service, spec in services.items():
            assert spec["label"] == ha_bridge.ACTIONS[service]["label"], service
            assert "code" not in spec["args"]
    assert set(p.SCHEDULE_ACTIONS["lock"]) == {"lock.lock", "lock.unlock"} and set(p.SCHEDULE_ACTIONS["switch"]) == {"switch.turn_on", "switch.turn_off"}
    assert "button.press" in p.SCHEDULE_ACTIONS["door"] and "button.press" not in p.SCHEDULE_ACTIONS["switch"]
    assert p.SENSITIVE_CLASSES == {"alarm", "lock", "door"} and p.ALL_CLASSES == ("light", "switch", "cover", "climate", "fan", "alarm", "lock", "door")
    assert p.CAPABILITIES == {"tags": True, "negative_sun_offset": True}  # both verified on the lab component, 2026-09-30


def test_classification_of_entities():
    def cls(eid, dclass=None, platform="x", *, safe=False, door=False, managed=False):
        return p.classify_entity({"entity_id": eid, "domain": eid.split(".")[0], "device_class": dclass, "platform": platform}, bulk_safe=safe, on_door_layer=door, alarm_managed=managed)

    assert cls("light.a") == ("light", None) and cls("climate.a") == ("climate", None) and cls("fan.a") == ("fan", None) and cls("lock.a") == ("lock", None)
    assert cls("alarm_control_panel.a") == ("alarm", None) and cls("cover.a", "shutter") == ("cover", None)
    for dc in ("door", "garage", "gate"):
        assert cls("cover.a", dc) == ("door", None)
    assert cls("cover.a", None, door=True) == ("door", None) and cls("switch.a", door=True) == ("door", None) and cls("button.a", door=True) == ("door", None)
    assert cls("switch.a") == (None, "switch_not_marked") and cls("switch.a", safe=True) == ("switch", None)
    assert cls("switch.a", safe=True, managed=True) == (None, "alarm_managed_control")
    assert cls("switch.schedule_x", platform="scheduler", safe=True) == (None, "action_not_allowed")  # a schedule's own switch (platform)
    assert cls("switch.schedule_x", platform=None, safe=True) == (None, "action_not_allowed")  # ... before the first registry refresh
    assert cls("switch.schedule_x", platform="generic", safe=True) == ("switch", None)  # a real switch that merely has the prefix
    for eid in ("script.a", "scene.a", "button.a", "siren.a", "input_boolean.a", "humidifier.a", "media_player.a", "vacuum.a", "number.a", "select.a", "notify.a", "sensor.a"):
        assert cls(eid) == (None, "action_not_allowed"), eid


def test_lowering_and_codes():
    assert p.is_lowering("alarm_control_panel.alarm_disarm", "alarm", {}) and p.is_lowering("lock.unlock", "lock", {})
    assert not p.is_lowering("lock.lock", "lock", {}) and not p.is_lowering("alarm_control_panel.alarm_arm_home", "alarm", {})
    assert p.is_lowering("cover.open_cover", "door", {}) and p.is_lowering("cover.set_cover_position", "door", {"position": 10}) and not p.is_lowering("cover.set_cover_position", "door", {"position": 0})
    assert p.is_lowering("switch.turn_off", "door", {}) and p.is_lowering("switch.turn_on", "door", {}) and p.is_lowering("button.press", "door", {})
    assert not p.is_lowering("cover.close_cover", "door", {}) and not p.is_lowering("cover.open_cover", "cover", {}) and not p.is_lowering("switch.turn_on", "switch", {})
    assert p.contains_code({"a": {"b": [{"Code": "1"}]}}) and p.contains_code({"pin": "1"}) and not p.contains_code({"brightness": 1, "hvac_mode": "cool"})
    assert p.canonical_time("7:05") == "07:05:00" and p.canonical_time("sunset+0:30") == "sunset+00:30:00" and p.canonical_time("sunrise") == "sunrise+00:00:00" and p.canonical_time("nope") is None
    assert p.parse_time("24:00:00") is None and p.parse_time("12:60") is None and p.parse_time(None) is None
