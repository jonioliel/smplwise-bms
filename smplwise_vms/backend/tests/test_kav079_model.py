"""KAV079-295: the block model's new typed blocks (pure): the wall-button trigger, the "who is in the building" condition and the critical sound of a
notify step. Each round-trips byte for byte while unchanged, is rebuilt in the stored vocabulary when changed, and stays exactly as before while its
switch is off (a device trigger is then a locked block, as today)."""
from __future__ import annotations

import copy
import json

from smplwise.services import automation_model as model
from smplwise.services import wall_buttons as wb
from smplwise.services.automation_text import ModelContext

ON = ModelContext(wall_buttons=True)
PRES = "binary_sensor.anyone_in_building"


def zha(press: str = "remote_button_double_press", sub: str = "button_1", **extra) -> dict:
    return {"trigger": "device", "device_id": "dev_living_switch", "domain": "zha", "type": press, "subtype": sub, **extra}


def cfg_with(trigger: dict, actions: list | None = None, conditions: list | None = None) -> dict:
    return {"id": "1", "alias": "כפתורי מפסק סלון", "description": "", "mode": "single", "triggers": [trigger], "conditions": conditions or [],
            "actions": actions or [{"action": "light.turn_on", "target": {"entity_id": ["light.living"]}, "data": {"brightness_pct": 60}}]}


def test_a_wall_button_trigger_is_typed_only_while_the_switch_is_on():
    raw = zha(id="double", metadata={})
    off = model.parse_trigger(copy.deepcopy(raw), ModelContext())
    assert off["kind"] == "locked" and off["reason"] == "device"
    on = model.parse_trigger(copy.deepcopy(raw), ON)
    assert on["kind"] == "typed" and on["type"] == "button" and on["button"] == 1 and on["press"] == "double" and on["id"] == "double"
    assert on["ha_type"] == "remote_button_double_press" and on["ha_subtype"] == "button_1" and on["domain"] == "zha"


def test_an_unchanged_stored_item_round_trips_byte_for_byte():
    cfg = cfg_with(zha(id="double", metadata={}, discovery_id="0x1234_button_1"))
    rd = model.config_to_draft("automation", copy.deepcopy(cfg), ON)
    assert rd.draft["triggers"][0]["kind"] == "typed"
    out = model.draft_to_config("automation", rd.draft, cfg, ON, item_id="1")
    assert model.dumps_exact(out) == model.dumps_exact(cfg)


def test_a_changed_press_and_button_keep_the_integrations_own_words():
    cfg = cfg_with(zha(id="double", metadata={}, discovery_id="0x1234_button_1"))
    rd = model.config_to_draft("automation", copy.deepcopy(cfg), ON)
    t = rd.draft["triggers"][0]
    t["press"], t["button"] = "long", 3
    out = model.draft_to_config("automation", rd.draft, cfg, ON, item_id="1")["triggers"][0]
    assert out["type"] == "remote_button_long_press" and out["subtype"] == "button_3" and out["discovery_id"] == "0x1234_button_1"
    assert out["id"] == "double" and out["metadata"] == {} and out["device_id"] == "dev_living_switch" and out["domain"] == "zha"
    shelly = model.parse_trigger({"trigger": "device", "device_id": "s1", "domain": "shelly", "type": "single", "subtype": "button1"}, ON)
    shelly["press"], shelly["button"] = "double", 2
    built = model.emit_block(shelly, "trigger", ON)
    assert built["type"] == "double" and built["subtype"] == "button2", "the Shelly family stays the Shelly family"


def test_unknown_vocabularies_and_extra_keys_stay_locked():
    for raw in ({"trigger": "device", "domain": "wall_switch", "device_id": "2f1c9a07", "type": "button_1_short", "id": "short"},  # the seed's words: not a family
                zha(sub="turn_on"),  # not a numbered button
                zha(entity_id="sensor.x"),  # a key the typed block cannot hold
                zha(sub="button_99")):  # out of range
        assert model.parse_trigger(copy.deepcopy(raw), ON)["kind"] == "locked", raw


def test_button_sentence_and_validation():
    ctx = ModelContext(wall_buttons=True, device_name=lambda d: "מפסק סלון")
    b = model.parse_trigger(zha(), ctx)
    assert b["sentence"] == "לחיצה כפולה על כפתור 1 · מפסק סלון"
    d = {"alias": "x", "description": "", "mode": "single", "max": None, "triggers": [b], "conditions": [],
         "actions": [{"uid": "a", "kind": "typed", "type": "delay", "delay": {"minutes": 1}, "raw": None}]}
    assert not [i for i in model.validate_draft("automation", d, wall_buttons=True) if i["path"].startswith("triggers")]
    bad = copy.deepcopy(d)
    bad["triggers"][0].update(press="triple", raw=None)
    codes = {i["code"] for i in model.validate_draft("automation", bad, wall_buttons=True)}
    assert "press_invalid" in codes
    new = copy.deepcopy(d)
    new["triggers"][0]["raw"] = None
    assert "wall_buttons_off" in {i["code"] for i in model.validate_draft("automation", new, wall_buttons=False)}, "a NEW button block while the switch is off"


def test_presence_condition_round_trip_and_build():
    ctx = ModelContext(presence_entity=PRES)
    cond = {"condition": "state", "entity_id": [PRES], "state": "off"}
    b = model.parse_condition(copy.deepcopy(cond), ctx)
    assert b["type"] == "presence" and b["mode"] == "nobody" and b["sentence"] == "אין אף אחד במבנה"
    assert model.emit_block(b, "condition", ctx) == cond
    b["mode"] = "someone"
    assert model.emit_block(b, "condition", ctx) == {"condition": "state", "entity_id": [PRES], "state": "on"}
    plain = model.parse_condition(copy.deepcopy(cond), ModelContext())
    assert plain["type"] == "state", "without the setting it is the ordinary state condition"
    fresh = {"uid": "p", "kind": "typed", "type": "presence", "mode": "nobody", "raw": None}
    try:
        model.emit_block(fresh, "condition", ModelContext())
        raise AssertionError("must refuse without an entity")
    except model.ModelError as exc:
        assert exc.code == "presence_entity_missing"
    d = {"alias": "x", "description": "", "mode": "single", "max": None, "triggers": [{"uid": "t", "kind": "typed", "type": "time", "at": "07:00", "raw": None}],
         "conditions": [fresh], "actions": [{"uid": "a", "kind": "typed", "type": "delay", "delay": {"minutes": 1}, "raw": None}]}
    assert "presence_entity_missing" in {i["code"] for i in model.validate_draft("automation", d)}
    assert "presence_entity_missing" not in {i["code"] for i in model.validate_draft("automation", d, presence_entity=PRES)}


def test_critical_sound_is_a_flag_of_the_notify_step():
    step = {"action": "notify.mobile_app_owner", "data": {"message": "זוהתה הצפה בחדר כביסה", "data": copy.deepcopy(model.CRITICAL_DATA)}}
    b = model.parse_action(copy.deepcopy(step), ModelContext())
    assert b["kind"] == "typed" and b["role"] == "notify" and b["critical"] is True and "data" not in b["data"]
    assert b["sentence"].endswith("עם צליל קריטי")
    assert model.emit_block(b, "action", ModelContext()) == step, "unchanged: the stored step"
    b2 = copy.deepcopy(b)
    b2["critical"] = False
    assert model.emit_block(b2, "action", ModelContext()) == {"action": "notify.mobile_app_owner", "data": {"message": "זוהתה הצפה בחדר כביסה"}}
    other = {"action": "notify.mobile_app_owner", "data": {"message": "x", "data": {"push": {"sound": "custom"}}}}
    assert model.parse_action(copy.deepcopy(other), ModelContext())["kind"] == "locked", "any other nested payload stays locked, as before"


def test_buttons_from_home_assistants_trigger_list():
    triggers = [
        {"device_id": "d", "domain": "zha", "type": "remote_button_short_press", "subtype": "button_1", "platform": "device"},
        {"device_id": "d", "domain": "zha", "type": "remote_button_double_press", "subtype": "button_1", "platform": "device"},
        {"device_id": "d", "domain": "zha", "type": "remote_button_long_press", "subtype": "button_2", "platform": "device"},
        {"device_id": "d", "domain": "zha", "type": "device_offline", "subtype": "device_offline", "platform": "device"},
    ]
    out = wb.buttons_from_triggers(triggers)
    assert [b["button"] for b in out] == [1, 2]
    assert [p["press"] for p in out[0]["presses"]] == ["short", "double"] and out[1]["presses"][0]["ha_type"] == "remote_button_long_press"
    assert wb.type_for("single_push", "long") == "long_push" and wb.subtype_for("button_1", 4) == "button_4" and wb.button_of("1") == 1
    assert json.dumps(out)  # plain data


def test_the_bridge_accepts_exactly_what_the_add_on_types():
    """The bridge's closed schema (custom_components/smplwise_bridge/config_policy.py) and the add-on's model agree on the new blocks."""
    from bridge_loader import load

    bp = load("config_policy")
    assert bp.CRITICAL_NOTIFY_DATA == model.CRITICAL_DATA
    assert tuple(tuple(f[p] for p in wb.PRESSES) for f in wb.FAMILIES) == bp.BUTTON_FAMILIES
    assert set(bp.BUTTON_KEYS) == set(wb.TRIGGER_KEYS)
    for raw in (zha(), zha(id="x", metadata={}, discovery_id="d"), zha(sub="turn_on"), zha(entity_id="sensor.x"), zha(sub="button_99"), zha(device_id=""),
                zha(press="remote_button_triple_press"), zha(id=3), {"trigger": "device", "device_id": "d", "domain": "zha", "type": "single", "subtype": "{{ x }}1"}):
        typed = model.parse_trigger(copy.deepcopy(raw), ON)["kind"] == "typed"
        assert bp.trigger_authorable(raw) is typed, raw
    crit = {"action": "notify.mobile_app_owner", "data": {"message": "x", "data": copy.deepcopy(model.CRITICAL_DATA)}}
    assert bp.action_authorable(crit) is True and model.parse_action(copy.deepcopy(crit), ModelContext())["kind"] == "typed"
    bad = {"action": "notify.mobile_app_owner", "data": {"message": "x", "data": {"push": {}}}}
    assert bp.action_authorable(bad) is False and model.parse_action(copy.deepcopy(bad), ModelContext())["kind"] == "locked"
