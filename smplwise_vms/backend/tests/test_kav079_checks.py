"""KAV079-295: the pre-save checks and the on-device test plan, pure (services/automation_ext.py): which device switches an automation or a schedule
makes at a fixed time, the conflict window between DIFFERENT items (owner answer 365: schedule / automation against schedule / automation), the Hebrew
lines as drawn in the mockup, and the restore plan of the on-device test."""
from __future__ import annotations

from smplwise.services import automation_ext as ext
from smplwise.services import schedule_model as smodel

AC = "climate.bedroom"


def t_time(at: str, tid: str | None = None, i: int = 0) -> dict:
    b = {"uid": f"t{i}", "kind": "typed", "type": "time", "at": at, "raw": None}
    if tid:
        b["id"] = tid
    return b


def svc(action: str, ent: str, data: dict | None = None) -> dict:
    return {"uid": "s", "kind": "typed", "type": "service", "action": action, "entity_ids": [ent], "data": data or {}, "role": "device", "raw": None}


def by_trigger(tid: str) -> dict:
    return {"uid": "c", "kind": "typed", "type": "trigger", "ids": [tid], "raw": None}


def ac_by_hour() -> dict:
    """The mockup's "מזגן חדר שינה לפי שעה": 22:00 (night) -> 24°, 06:30 (morning) -> off."""
    return {"alias": "מזגן חדר שינה לפי שעה", "triggers": [t_time("22:00", "night", 0), t_time("06:30", "morning", 1)], "conditions": [],
            "actions": [{"uid": "ch", "kind": "typed", "type": "choose", "raw": None, "default": None, "options": [
                {"conditions": [by_trigger("night")], "sequence": [svc("climate.set_temperature", AC, {"temperature": 24})]},
                {"conditions": [by_trigger("morning")], "sequence": [svc("climate.turn_off", AC)]}]}]}


def cooling_on_shabbat_core() -> dict:
    """The mockup's schedule "חדר הורים – קירור בשבת": ... 21:55 off."""
    item = {"schedule_id": "s1", "name": "חדר הורים – קירור בשבת", "enabled": True, "weekdays": ["daily"],
            "timeslots": [{"start": "12:00:00", "stop": "17:00:00", "actions": [{"service": "climate.set_temperature", "entity_id": AC, "service_data": {"temperature": 24}}]},
                          {"start": "21:55:00", "stop": None, "actions": [{"service": "climate.set_hvac_mode", "entity_id": AC, "service_data": {"hvac_mode": "off"}}]}]}
    return smodel.normalize(item)


def test_polarity():
    assert ext.polarity("light.turn_on") == "on" and ext.polarity("light.turn_off") == "off"
    assert ext.polarity("climate.set_hvac_mode", {"hvac_mode": "off"}) == "off" and ext.polarity("climate.set_hvac_mode", {"hvac_mode": "cool"}) == "on"
    assert ext.polarity("cover.set_cover_position", {"position": 0}) == "off" and ext.polarity("cover.set_cover_position", {"position": 40}) == "on"
    assert ext.polarity("light.toggle") is None and ext.polarity("media_player.volume_set", {"volume_level": 0.3}) is None


def test_automation_events_follow_the_trigger_ids_and_delays():
    evs = ext.automation_events(ac_by_hour(), "a1", "x")
    assert sorted((e.minute, e.pol, e.path) for e in evs) == [(6 * 60 + 30, "off", "actions.0.choose.1.sequence.0"), (22 * 60, "on", "actions.0.choose.0.sequence.0")]
    d = {"triggers": [t_time("07:00")], "conditions": [{"kind": "typed", "type": "time", "weekday": ["sun", "mon"]}],
         "actions": [svc("light.turn_on", "light.hall"), {"uid": "d", "kind": "typed", "type": "delay", "delay": {"minutes": 3}, "raw": None}, svc("light.turn_off", "light.hall")]}
    evs = ext.automation_events(d, "a2", "y")
    assert [(e.minute, e.pol) for e in evs] == [(420, "on"), (423, "off")] and all(e.days == frozenset({"sun", "mon"}) for e in evs)
    assert ext.automation_events({"triggers": [{"kind": "typed", "type": "state", "entity_ids": ["x.y"]}], "conditions": [], "actions": [svc("light.turn_on", "light.hall")]}, "a3", "z") == []


def test_schedule_events_use_the_fixed_start_of_each_slot():
    evs = ext.schedule_events(cooling_on_shabbat_core(), "s1", "חדר הורים – קירור בשבת")
    assert [(e.minute, e.pol) for e in evs] == [(720, "on"), (21 * 60 + 55, "off")]
    draft = {"weekdays": ["sat"], "slots": [{"start": "21:55:00", "stop": None, "actions": [{"service": "climate.turn_off", "entity_id": AC, "data": {}}]}]}
    evs = ext.schedule_events(ext.schedule_draft_core(draft), "new", "")
    assert [(e.minute, e.pol, e.days) for e in evs] == [(21 * 60 + 55, "off", frozenset({"sat"}))]


def test_the_mockups_conflict_and_its_hebrew_lines():
    mine = ext.automation_events(ac_by_hour(), "a1", "מזגן חדר שינה לפי שעה")
    others = ext.schedule_events(cooling_on_shabbat_core(), "s1", "חדר הורים – קירור בשבת")
    rows = ext.find_conflicts(mine, others, 10)
    assert len(rows) == 1
    c = rows[0]
    assert c["other"] == {"kind": "schedule", "id": "s1", "name": "חדר הורים – קירור בשבת"} and c["mine_at"] == "22:00" and c["other_at"] == "21:55" and c["delta_min"] == 5
    assert c["path"] == "actions.0.choose.0.sequence.0"
    title, detail = ext.conflict_text(c, "מזגן חדר שינה", 10)
    assert title == "התנגשות עם התזמון ״חדר הורים – קירור בשבת״"
    assert detail == "התזמון מכבה את מזגן חדר שינה ב־21:55, וכאן הוא נדלק ב־22:00: פעולות הפוכות בהפרש של 5 דקות, בתוך חלון של 10 דקות."
    assert ext.find_conflicts(mine, others, 4) == [], "outside the window"


def test_no_conflict_for_the_same_item_the_same_direction_or_disjoint_days():
    mine = ext.automation_events(ac_by_hour(), "a1", "x")
    assert ext.find_conflicts(mine, mine, 60) == [], "an item never conflicts with itself"
    same = ext.schedule_events(smodel.normalize({"schedule_id": "s2", "weekdays": ["daily"], "timeslots": [{"start": "21:58:00", "actions": [{"service": "climate.set_temperature", "entity_id": AC, "service_data": {"temperature": 22}}]}]}), "s2", "y")
    assert ext.find_conflicts(mine, same, 10) == [], "both switch it on"
    fri = ext.automation_events({"triggers": [t_time("21:57")], "conditions": [{"kind": "typed", "type": "time", "weekday": ["fri"]}], "actions": [svc("climate.turn_off", AC)]}, "a9", "z")
    mon = ext.automation_events({"triggers": [t_time("22:00")], "conditions": [{"kind": "typed", "type": "time", "weekday": ["mon"]}], "actions": [svc("climate.turn_on", AC)]}, "a8", "w")
    assert ext.find_conflicts(mon, fri, 10) == [], "no common day"
    midnight_a = ext.automation_events({"triggers": [t_time("23:58")], "conditions": [], "actions": [svc("light.turn_on", "light.x")]}, "m1", "")
    midnight_b = ext.automation_events({"triggers": [t_time("00:03")], "conditions": [], "actions": [svc("light.turn_off", "light.x")]}, "m2", "")
    assert ext.find_conflicts(midnight_a, midnight_b, 10)[0]["delta_min"] == 5, "across midnight"


def test_button_keys_of_typed_and_locked_triggers():
    typed = {"kind": "typed", "type": "button", "device_id": "d1", "domain": "zha", "ha_type": "remote_button_short_press", "ha_subtype": "button_1", "button": 2, "press": "long"}
    locked = {"kind": "locked", "raw": {"trigger": "device", "device_id": "d1", "domain": "zha", "type": "remote_button_double_press", "subtype": "button_1"}}
    keys = ext.button_keys({"triggers": [typed, locked]})
    assert keys == [("d1|button_2|remote_button_long_press", "triggers.0"), ("d1|button_1|remote_button_double_press", "triggers.1")]


def test_restore_actions_put_each_device_back():
    snap = [{"entity_id": "light.living", "state": "off", "attributes": {}},
            {"entity_id": "light.desk", "state": "on", "attributes": {"brightness": 128}},
            {"entity_id": "switch.pump", "state": "on", "attributes": {}},
            {"entity_id": "climate.bedroom", "state": "cool", "attributes": {"temperature": 23}},
            {"entity_id": "cover.shutter", "state": "open", "attributes": {"current_position": 70}},
            {"entity_id": "sensor.ignored", "state": "unavailable", "attributes": {}}]
    now = {"light.living": {"state": "on", "attributes": {"brightness": 153}}, "light.desk": {"state": "off", "attributes": {}}, "switch.pump": {"state": "on"},
           "climate.bedroom": {"state": "off", "attributes": {"temperature": 23}}, "cover.shutter": {"state": "open", "attributes": {"current_position": 20}}}
    acts = ext.restore_actions(snap, lambda e: now.get(e))
    assert [(a["entity_id"], a["action"], a["arguments"]) for a in acts] == [
        ("light.living", "light.turn_off", {}), ("light.desk", "light.turn_on", {"brightness_pct": 50}), ("climate.bedroom", "climate.set_hvac_mode", {"hvac_mode": "cool"}),
        ("cover.shutter", "cover.set_cover_position", {"position": 70})], "the pump is already where it was"
