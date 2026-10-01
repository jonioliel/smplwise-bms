"""CR-017 block model (services/automation_model.py): reading stored items into typed and LOCKED blocks, the raw-preserving writer and the invariant
`write(read(c)) == c` on every seed item, locked blocks byte for byte, fingerprints, the save profile, secrets in drafts, validation (caps).
The cases mirror frontend/tests/unit-automations.spec.ts ("reading blocks", "writing blocks and the round trip"); synthetic data only."""
from __future__ import annotations

import copy
import hashlib
import json

import pytest

import automations_seed as seed
from fake_ha_config import FakeHaConfig
from smplwise.services import automation_model as m
from smplwise.services.automation_text import ModelContext, automation_sentence

SHABBAT = seed.SHABBAT_SENSOR
NAMES = {
    "light.hall": "תאורת פרוזדור", "light.entry": "תאורת כניסה", "light.garden": "תאורת גינה", "binary_sensor.hall_motion": "חיישן תנועה פרוזדור", "binary_sensor.front_door": "דלת הכניסה",
    "person.yoni": "יוני", "person.dana": "דנה", "zone.home": "הבית", "climate.bed": "מזגן חדר שינה", "climate.salon": "מזגן סלון", "alarm_control_panel.home": "אזעקה", "switch.irrigation": "השקיה",
    "light.salon": "תאורת סלון", "light.kitchen": "תאורת מטבח", "scene.salon_evening": "סלון · ערב", "script.good_morning": "בוקר טוב", "sensor.bed_temp": "טמפרטורה חדר שינה",
}
CTX = ModelContext(names=lambda i: NAMES.get(i, i), shabbat_sensor=SHABBAT, notify_name=lambda a: "הטלפון של יוני" if a == "notify.mobile_app_yoni" else None)


@pytest.fixture(scope="module")
def house():
    return FakeHaConfig.seed_probe_like()


def draft_of(config, ctx=CTX):
    return m.config_to_draft("automation", config, ctx).draft


def by_alias(house, alias):
    return next(a for a in house.automations if a.get("alias") == alias)


# ---------------------------------------------------------------- primitives

def test_canonical_json_fingerprint_and_revision_ignore_key_order_and_float_spelling():
    assert m.canonical_json({"b": 1, "a": {"d": 2, "c": [{"z": 1, "y": 2}]}}) == '{"a":{"c":[{"y":2,"z":1}],"d":2},"b":1}'
    a = {"alias": "א", "actions": [{"action": "x.y", "data": {"b": 1, "a": 2}}]}
    b = {"actions": [{"data": {"a": 2, "b": 1}, "action": "x.y"}], "alias": "א"}
    assert m.fingerprint_of(a) == m.fingerprint_of(b)
    assert len(m.fingerprint_of(a)) == 16 and int(m.fingerprint_of(a), 16) >= 0
    assert m.revision_of(a) == hashlib.sha256(m.canonical_json(a).encode("utf-8")).hexdigest()[:16]
    assert m.fingerprint_of({**a, "alias": "ב"}) != m.fingerprint_of(a)
    # JavaScript prints 24.0 as 24: the client and the server hash the same text
    assert m.canonical_json({"t": 24.0, "u": 23.5}) == '{"t":24,"u":23.5}'
    assert m.fingerprint_of({"t": 24.0}) == m.fingerprint_of({"t": 24})
    assert m.canonical_json({"s": "עברית ✓"}) == '{"s":"עברית ✓"}'


# ---------------------------------------------------------------- reading blocks

def test_typed_triggers():
    s = m.parse_trigger({"trigger": "state", "entity_id": ["binary_sensor.front_door"], "to": "on", "for": {"hours": 0, "minutes": 5, "seconds": 0}, "id": "door"}, CTX)
    assert s["kind"] == "typed" and s["type"] == "state" and s["entity_ids"] == ["binary_sensor.front_door"] and s["to"] == "on" and s["for"]["minutes"] == 5 and s["id"] == "door"
    assert s["sentence"] == "כשדלת הכניסה נפתח/ת במשך 5 דקות"
    lg = m.parse_trigger({"platform": "state", "entity_id": "person.yoni", "to": "home", "for": "00:10:00"}, CTX)  # a single entity string, "HH:MM:SS", the legacy `platform`
    assert lg["type"] == "state" and lg["entity_ids"] == ["person.yoni"] and lg["for"] == {"hours": 0, "minutes": 10, "seconds": 0}
    assert m.parse_trigger({"trigger": "numeric_state", "entity_id": "sensor.bed_temp", "above": 26}, CTX)["above"] == 26
    assert m.parse_trigger({"trigger": "time", "at": "06:30"}, CTX)["at"] == "06:30"
    assert m.parse_trigger({"trigger": "time_pattern", "minutes": "/15"}, CTX)["minutes"] == "/15"
    assert m.parse_trigger({"trigger": "sun", "event": "sunset", "offset": "-00:20:00"}, CTX)["offset_min"] == -20
    assert m.parse_trigger({"trigger": "sun", "event": "sunrise", "offset": 600}, CTX)["offset_min"] == 10
    assert m.parse_trigger({"trigger": "homeassistant", "event": "start"}, CTX)["type"] == "homeassistant"
    # absent `to` stays absent (a different thing from null)
    assert "to" not in m.parse_trigger({"trigger": "state", "entity_id": "light.hall"}, CTX)
    assert m.parse_trigger({"trigger": "state", "entity_id": "light.hall", "to": None}, CTX)["to"] is None


def test_locked_triggers_with_reason_label_and_fingerprint():
    dev = m.parse_trigger({"trigger": "device", "domain": "wall_switch", "device_id": "abc", "type": "button_1_short"}, ModelContext(device_name=lambda d: "מפסק סלון"))
    assert (dev["kind"], dev["reason"], dev["label"], dev["effects"], dev["masked"]) == ("locked", "device", "כפתור · מפסק סלון", "none", False)
    assert dev["fingerprint"] == m.fingerprint_of(dev["raw"]) and dev["sentence"] == dev["label"]
    tpl = m.parse_trigger({"trigger": "template", "value_template": "{{ states('sensor.lux') | int < 20 }}"}, CTX)
    assert (tpl["reason"], tpl["label"], tpl["template_text"]) == ("template", "תבנית", "{{ states('sensor.lux') | int < 20 }}")
    assert m.parse_trigger({"trigger": "template", "value_template": "{{ x }}"}, ModelContext(template_text=False))["template_text"] is None
    pt = m.parse_trigger({"trigger": "switch.turned_on", "target": {"entity_id": "switch.x"}}, CTX)
    assert (pt["reason"], pt["label"]) == ("purpose_trigger", "טריגר ייעודי · switch.turned_on")
    assert m.parse_trigger({"trigger": "event", "event_type": "x"}, CTX)["reason"] == "unsupported_step"
    assert m.parse_trigger({"trigger": "zone", "entity_id": "person.yoni", "zone": "zone.home", "event": "enter"}, CTX)["kind"] == "locked"
    dis = m.parse_trigger({"trigger": "state", "entity_id": "light.hall", "to": "on", "enabled": False}, CTX)
    assert (dis["reason"], dis["label"]) == ("disabled_step", "צעד מושבת")
    assert m.parse_trigger({"trigger": "state", "entity_id": "light.hall", "attribute": "brightness"}, CTX)["reason"] == "unsupported_step"
    assert m.parse_trigger({"trigger": "state", "entity_id": "{{ x }}", "to": "on"}, CTX)["reason"] == "template"
    assert m.parse_trigger({"trigger": "sun", "event": "sunset", "offset": "00:00:30"}, CTX)["kind"] == "locked"
    assert m.parse_trigger({"nothing": True}, CTX)["reason"] == "unknown"
    assert m.parse_trigger("{{ trigger }}", CTX)["reason"] == "template"
    assert m.parse_trigger({"trigger": "state", "entity_id": "light.hall", "id": 5}, CTX)["reason"] == "unsupported_step"


def test_conditions_typed_kinds_the_shabbat_preset_one_nesting_level_shorthand_templates():
    p = lambda raw, ctx=CTX: m.parse_condition(raw, ctx)  # noqa: E731
    assert p({"condition": "state", "entity_id": ["climate.bed"], "state": "cool"})["state"] == "cool"
    assert p({"condition": "state", "entity_id": ["climate.bed"], "state": ["cool", "heat"]})["state"] == ["cool", "heat"]
    assert (p({"condition": "state", "entity_id": [SHABBAT], "state": "on"})["type"], p({"condition": "state", "entity_id": [SHABBAT], "state": "on"})["mode"]) == ("shabbat", "only_holy_days")
    assert p({"condition": "state", "entity_id": SHABBAT, "state": "off"})["mode"] == "not_holy_days"
    assert p({"condition": "state", "entity_id": [SHABBAT], "state": "on"}, ModelContext(shabbat_sensor=None))["type"] == "state"
    t = p({"condition": "time", "after": "17:00:00", "before": "23:30:00", "weekday": ["sun", "mon"]})
    assert t["type"] == "time" and t["weekday"] == ["sun", "mon"]
    assert p({"condition": "time", "after": "input_datetime.x"})["kind"] == "locked"
    assert p({"condition": "sun", "after": "sunset"})["after"] == "sunset"
    assert p({"condition": "trigger", "id": "night"})["ids"] == ["night"]
    g = p({"condition": "not", "conditions": [{"condition": "state", "entity_id": "person.yoni", "state": "home"}, {"condition": "or", "conditions": []}]})
    assert g["type"] == "not" and g["conditions"][0]["type"] == "state"
    assert (g["conditions"][1]["kind"], g["conditions"][1]["reason"]) == ("locked", "unsupported_step")  # a second nesting level stays locked
    assert p('{{ is_state("light.x", "on") }}')["reason"] == "template"
    assert p({"condition": "template", "value_template": "{{ true }}"})["reason"] == "template"
    d = p({"condition": "device", "device_id": "x", "domain": "light", "type": "is_on"})
    assert (d["reason"], d["label"]) == ("device", "תנאי מכשיר · מכשיר")


def test_actions_roles_containers_delays_and_everything_else_locked_with_its_reason():
    pa = lambda raw: m.parse_action(raw, CTX)  # noqa: E731
    a = pa({"action": "light.turn_on", "target": {"entity_id": ["light.hall"]}, "data": {"brightness_pct": 40}})
    assert (a["kind"], a["type"], a["role"], a["entity_ids"], a["data"]) == ("typed", "service", "device", ["light.hall"], {"brightness_pct": 40})
    assert a["sentence"] == "הדלק תאורת פרוזדור ל־40%"
    assert pa({"action": "scene.turn_on", "target": {"entity_id": "scene.salon_evening"}})["role"] == "scene"
    sc = pa({"action": "script.good_morning"})
    assert (sc["role"], sc["entity_ids"]) == ("script", ["script.good_morning"])
    n = pa({"action": "notify.mobile_app_yoni", "data": {"message": "שלום"}})
    assert (n["role"], n["entity_ids"]) == ("notify", [])
    assert pa({"service": "light.turn_off", "entity_id": "light.hall"})["entity_ids"] == ["light.hall"]  # legacy keys read in memory
    assert pa({"delay": {"hours": 0, "minutes": 3, "seconds": 0}})["delay"]["minutes"] == 3
    assert pa({"delay": "00:00:10"})["delay"]["seconds"] == 10
    assert pa({"stop": "סיום"})["message"] == "סיום"
    assert pa({"repeat": {"count": 3, "sequence": [{"delay": {"seconds": 1}}]}})["count"] == 3
    assert pa({"condition": "state", "entity_id": "person.yoni", "state": "home"})["condition"]["type"] == "state"
    ch = pa({"choose": [{"conditions": [{"condition": "trigger", "id": ["a"]}], "sequence": [{"action": "light.turn_on", "target": {"entity_id": "light.hall"}}]}], "default": [{"stop": "x"}]})
    assert len(ch["options"]) == 1 and ch["options"][0]["sequence"][0]["type"] == "service" and len(ch["default"]) == 1
    iff = pa({"if": [{"condition": "state", "entity_id": "person.yoni", "state": "home"}], "then": [{"stop": "a"}]})
    assert iff["type"] == "if" and iff["else"] is None

    cases = [
        ({"action": "scheduler.run_action"}, "custom_service"), ({"action": "browser_mod.popup", "data": {"title": "x"}}, "custom_service"), ({"action": "shell_command.blink"}, "service_not_allowed"),
        ({"action": "homeassistant.restart"}, "service_not_allowed"), ({"action": "light.reload"}, "service_not_allowed"), ({"action": "light.turn_on", "target": {"entity_id": "{{ x }}"}}, "template"),
        ({"action": "light.turn_on", "data": {"brightness": "{{ b }}"}, "target": {"entity_id": "light.hall"}}, "template"), ({"action": "light.turn_on", "target": {"area_id": "salon"}}, "unsupported_step"),
        ({"action": "light.turn_on", "target": {"device_id": "abc"}}, "unsupported_step"), ({"action": "light.turn_on", "target": {"entity_id": "light.hall"}, "continue_on_error": True}, "disabled_step"),
        ({"action": "light.turn_on", "target": {"entity_id": "light.hall"}, "enabled": False}, "disabled_step"),
        ({"action": "alarm_control_panel.alarm_disarm", "target": {"entity_id": "alarm_control_panel.home"}, "data": {"code": "1234"}}, "code"),
        ({"action": "x.y", "data": {"api_key": "k"}}, "secret"), ({"type": "turn_on", "domain": "light", "device_id": "abc", "entity_id": "abcdef"}, "device"), ({"variables": {"a": 1}}, "unsupported_step"),
        ({"wait_template": "{{ true }}"}, "template"), ({"wait_for_trigger": [{"trigger": "state", "entity_id": "light.hall"}]}, "unsupported_step"), ({"parallel": [{"delay": {"seconds": 1}}]}, "unsupported_step"),
        ({"repeat": {"while": [{"condition": "state", "entity_id": "light.hall", "state": "on"}], "sequence": []}}, "unsupported_step"), ({"repeat": {"for_each": ["a"], "sequence": []}}, "unsupported_step"),
        ({"stop": "x", "error": True}, "unsupported_step"), ({"delay": {"milliseconds": 10}}, "unsupported_step"), ({"event": "my_event"}, "unsupported_step"), ("{{ x }}", "template"),
        # the deviations from the TS client: a step is typed only when its `data` fits the closed argument specs
        ({"action": "light.turn_on", "target": {"entity_id": "light.hall"}, "data": {"rgb_color": [255, 0, 0]}}, "unsupported_step"),
        ({"action": "light.toggle", "target": {"entity_id": "light.hall"}}, "service_not_allowed"), ({"action": "timer.start", "target": {"entity_id": "timer.x"}}, "service_not_allowed"),
        ({"action": "notify.mobile_app_yoni", "data": {"message": "x", "data": {"image": "/a.png"}}}, "unsupported_step"),
    ]
    for raw, reason in cases:
        assert pa(raw)["reason"] == reason and pa(raw)["kind"] == "locked", json.dumps(raw, ensure_ascii=False)
    assert (lambda b: (b["label"], b["effects"], b["sensitive"]))(pa({"action": "scheduler.run_action"})) == ("שירות מיוחד · scheduler", "unknown", False)
    b = pa({"action": "light.turn_on", "target": {"entity_id": "light.hall"}, "continue_on_error": True})
    assert (b["label"], b["effects"]) == ("צעד עם המשך בשגיאה", ["light.hall"])
    b = pa({"action": "alarm_control_panel.alarm_disarm", "target": {"entity_id": "alarm_control_panel.home"}, "data": {"code": "1"}})
    assert (b["masked"], b["sensitive"], b["label"], b["template_text"]) == (True, True, "קוד חסוי", None)
    assert pa({"action": "shell_command.blink"})["label"] == "שירות לא מותר · shell_command.blink"


def test_the_whole_seed_reads_every_shape_typed_or_locked_never_dropped(house):
    counts: dict[str, int] = {}
    n_blocks = 0
    for kind, items in (("automation", house.automations), ("script", list(house.scripts.values()))):
        for c in items:
            d = m.config_to_draft(kind, c, CTX).draft
            for w in m.walk_draft(d):
                n_blocks += 1
            for b in m.locked_blocks(d):
                counts[b["reason"]] = counts.get(b["reason"], 0) + 1
    assert n_blocks > 150
    # every distribution of the probe is in the seed: device, template, purpose-specific, custom, never-typed, disabled, secret, unsupported
    for reason in ("device", "template", "purpose_trigger", "custom_service", "service_not_allowed", "disabled_step", "secret", "unsupported_step"):
        assert counts.get(reason, 0) >= 1, reason
    assert len(house.automations) >= 42 and len(house.scripts) == 9


# ---------------------------------------------------------------- the round trip (CR section 6.2)

def test_write_of_read_is_byte_identical_for_every_seed_item_in_the_new_schema(house):
    checked = 0
    for kind, items in (("automation", house.automations), ("script", list(house.scripts.values())), ("scene", house.scenes)):
        for c in items:
            read = m.config_to_draft(kind, c, CTX)
            if read.legacy:
                continue
            out = m.draft_to_config(kind, read.draft, c, CTX)
            assert m.dumps_exact(out) == m.dumps_exact(c), f"{kind}:{c.get('id') or c.get('alias')}"
            assert m.canonical_json(out) == m.canonical_json(c)
            assert m.revision_of(out) == m.revision_of(c)
            checked += 1
    assert checked == len(house.automations) + len(house.scripts) + len(house.scenes) - 2  # all but the two legacy items


def test_the_round_trip_does_not_depend_on_the_context(house):
    """Names, the notify allow-list and a missing Shabbat sensor change the sentences and the shabbat block, never the written bytes."""
    plain = ModelContext()
    for c in house.automations:
        if m.config_to_draft("automation", c, plain).legacy:
            continue
        for ctx in (plain, CTX):
            assert m.dumps_exact(m.draft_to_config("automation", m.config_to_draft("automation", c, ctx).draft, c, ctx)) == m.dumps_exact(c)


def test_reading_does_not_alias_or_mutate_the_stored_config(house):
    c = copy.deepcopy(by_alias(house, "תנועה בפרוזדור"))
    snapshot = json.dumps(c, ensure_ascii=False)
    d = draft_of(c)
    d["actions"][0]["data"]["brightness_pct"] = 99
    d["actions"][0]["raw"]["data"]["brightness_pct"] = 98
    assert json.dumps(c, ensure_ascii=False) == snapshot
    out = m.draft_to_config("automation", draft_of(c), c, CTX)
    out["actions"][0]["data"]["brightness_pct"] = 1
    assert json.dumps(c, ensure_ascii=False) == snapshot


def test_every_locked_block_comes_out_byte_for_byte_wherever_it_sits(house):
    cfg = by_alias(house, "כפתורי מפסק סלון")
    draft = draft_of(cfg)
    raws = [json.dumps(b["raw"], ensure_ascii=False) for b in m.locked_blocks(draft)]
    assert len(raws) == 2
    draft["triggers"].reverse()  # move and re-emit: the order may change, the content may not
    out = m.draft_to_config("automation", draft, cfg, CTX)
    assert json.dumps(out["triggers"][0], ensure_ascii=False) == raws[1] and json.dumps(out["triggers"][1], ensure_ascii=False) == raws[0]
    t = by_alias(house, "תאורה לפי תבנית")  # a locked trigger, a locked action, a top-level `variables` key
    td = draft_of(t)
    assert [b["reason"] for b in m.locked_blocks(td)] == ["template", "template"]
    to = m.draft_to_config("automation", td, t, CTX)
    assert to["actions"] == t["actions"] and to["triggers"] == t["triggers"] and to["variables"] == {"room": "salon"}
    assert m.extra_keys("automation", t) == ["variables"]
    adv = by_alias(house, "אוטומציה מתקדמת")
    assert m.extra_keys("automation", adv) == ["variables", "trigger_variables", "initial_state", "note"]
    out = m.draft_to_config("automation", draft_of(adv), adv, CTX)
    assert {k: out[k] for k in ("variables", "trigger_variables", "initial_state", "note")} == {k: adv[k] for k in ("variables", "trigger_variables", "initial_state", "note")}


def test_editing_one_typed_block_rebuilds_only_that_block_the_rest_and_the_key_order_stay(house):
    cfg = by_alias(house, "תנועה בפרוזדור")
    draft = draft_of(cfg)
    draft["actions"][0]["data"]["brightness_pct"] = 60
    out = m.draft_to_config("automation", draft, cfg, CTX)
    assert out["actions"][0] == {"action": "light.turn_on", "target": {"entity_id": ["light.hall"]}, "data": {"brightness_pct": 60}}
    assert json.dumps(out["actions"][1]) == json.dumps(cfg["actions"][1]) and json.dumps(out["actions"][2]) == json.dumps(cfg["actions"][2])
    assert out["trace"] == {"stored_traces": 10} and list(out) == list(cfg)
    # a changed alias / mode / max, and a block appended
    draft["alias"], draft["mode"], draft["max"] = "חדש", "queued", 5
    new = m.parse_action({"action": "switch.turn_on", "target": {"entity_id": ["switch.irrigation"]}}, CTX)
    new["raw"] = None
    draft["actions"].append(new)
    out2 = m.draft_to_config("automation", draft, cfg, CTX)
    assert (out2["alias"], out2["mode"], out2["max"]) == ("חדש", "queued", 5)
    assert out2["actions"][3] == {"action": "switch.turn_on", "target": {"entity_id": ["switch.irrigation"]}}
    assert list(out2) == [*cfg, "max"]


def test_a_new_automation_is_written_in_ha_order_in_the_new_schema_with_empty_optionals_left_out():
    t = m.parse_trigger({"trigger": "time", "at": "20:00"}, CTX)
    t["raw"] = None
    a = m.parse_action({"action": "light.turn_on", "target": {"entity_id": ["light.entry"]}}, CTX)
    a["raw"] = None
    draft = {"alias": "חדשה", "description": "", "mode": "single", "max": None, "triggers": [t], "conditions": [], "actions": [a]}
    out = m.draft_to_config("automation", draft, None, CTX, item_id="1727700009999")
    assert list(out) == ["id", "alias", "description", "triggers", "conditions", "actions", "mode"]
    assert out["triggers"] == [{"trigger": "time", "at": "20:00:00"}] and out["conditions"] == [] and out["mode"] == "single" and out["id"] == "1727700009999"
    # a trigger id, a sun offset and a for-duration are built the way the HA editor writes them
    t2 = {"kind": "typed", "raw": None, "type": "state", "entity_ids": ["binary_sensor.front_door"], "to": "on", "for": {"minutes": 5}, "id": "door"}
    assert m._build_trigger(t2) == {"trigger": "state", "entity_id": ["binary_sensor.front_door"], "to": "on", "for": {"hours": 0, "minutes": 5, "seconds": 0}, "id": "door"}
    assert m._build_trigger({"type": "sun", "event": "sunset", "offset_min": -20}) == {"trigger": "sun", "event": "sunset", "offset": "-00:20:00"}
    assert m._build_trigger({"type": "sun", "event": "sunrise", "offset_min": 0}) == {"trigger": "sun", "event": "sunrise"}


def test_the_shabbat_block_is_a_state_condition_and_needs_the_sensor_to_be_written():
    blk = {"kind": "typed", "raw": None, "type": "shabbat", "mode": "not_holy_days"}
    assert m.emit_block(blk, "condition", CTX) == {"condition": "state", "entity_id": [SHABBAT], "state": "off"}
    with pytest.raises(m.ModelError) as e:
        m.emit_block(blk, "condition", ModelContext())
    assert e.value.code == "shabbat_sensor_missing"


def test_legacy_items_are_rewritten_in_the_new_schema_when_written_stably(house):
    cfg = by_alias(house, "נטרול אזעקה בבוקר")
    read = m.config_to_draft("automation", cfg, CTX)
    assert read.legacy is True
    out = m.draft_to_config("automation", read.draft, cfg, CTX)
    text = json.dumps(out, ensure_ascii=False)
    assert '"platform"' not in text and '"service"' not in text and '"trigger": [' not in text
    assert list(out) == ["id", "alias", "description", "triggers", "conditions", "actions", "mode"]
    assert out["triggers"] == [{"trigger": "time", "at": "06:45:00"}]
    assert out["actions"][0] == {"action": "alarm_control_panel.alarm_disarm", "target": {"entity_id": ["alarm_control_panel.home"]}}
    assert json.dumps(m.draft_to_config("automation", m.config_to_draft("automation", out, CTX).draft, out, CTX), ensure_ascii=False) == text  # idempotent
    assert automation_sentence(read.draft, CTX) == automation_sentence(m.config_to_draft("automation", out, CTX).draft, CTX)
    assert m.config_to_draft("automation", out, CTX).legacy is False
    # a step with `data_template` is not typed: it is a locked block and keeps its legacy form (Home Assistant still loads it); the item's own keys are new
    cfg2 = by_alias(house, "ישן: הודעה")
    r2 = m.config_to_draft("automation", cfg2, CTX)
    assert r2.legacy is True and [b["reason"] for b in m.locked_blocks(r2.draft)] == ["template"]
    out2 = m.draft_to_config("automation", r2.draft, cfg2, CTX)
    assert out2["actions"] == cfg2["action"] and out2["triggers"] == [{"trigger": "state", "entity_id": ["binary_sensor.front_door"], "to": "on"}] and "trigger" not in out2 and "action" not in out2
    leg = m.to_new_schema("automation", {"id": "1", "alias": "x", "trigger": [{"platform": "time", "at": "06:00"}], "condition": [], "action": [{"service": "scheduler.disable_all"}]}, CTX)
    assert leg["actions"] == [{"service": "scheduler.disable_all"}] and leg["triggers"] == [{"trigger": "time", "at": "06:00:00"}]


def test_scripts_keep_their_fields_and_scenes_keep_string_members_and_metadata(house):
    cfg = house.scripts["shutters"]
    d = m.config_to_draft("script", cfg, CTX).draft
    assert [(f["key"], f["selector"]["kind"]) for f in d["fields"]] == [("percent", "number"), ("shutters", "entity"), ("slow", "boolean"), ("side", "select")]
    assert d["fields"][0] == {"key": "percent", "name": "אחוז פתיחה", "required": True, "default": 50, "selector": {"kind": "number", "min": 0, "max": 100, "step": 10, "unit": "%"}}
    d["fields"][0]["selector"] = {"kind": "number", "min": 0, "max": 90, "step": 10, "unit": "%"}
    out = m.draft_to_config("script", d, cfg, CTX)
    f0 = out["fields"]["percent"]
    assert f0["description"] == "מ־0 עד 100"  # not modelled, carried
    assert f0["selector"] == {"number": {"min": 0, "max": 90, "step": 10, "unit_of_measurement": "%", "mode": "slider"}}
    assert out["fields"]["side"]["selector"] == {"select": {"options": ["שניהם", "ימין", "שמאל"]}}
    scene = house.scenes[0]
    sd = m.config_to_draft("scene", scene, CTX).draft
    assert sd["members"][0] == {"entity_id": "light.entry", "state": "on", "attributes": {"brightness": 204, "color_temp_kelvin": 3000}} and len(sd["members"]) == 5
    str_scene = {"name": "x", "entities": {"light.a": "on"}}
    assert m.config_to_draft("scene", str_scene, CTX).draft["members"][0] == {"entity_id": "light.a", "state": "on", "attributes": {}}
    assert m.draft_to_config("scene", m.config_to_draft("scene", str_scene, CTX).draft, str_scene, CTX) == str_scene
    assert m.parse_selector({"time": {}}) == {"kind": "locked", "raw": {"time": {}}}
    assert m.parse_selector({"select": {"options": [{"value": "a", "label": "A"}]}})["kind"] == "locked"
    assert m.selector_out({"kind": "text", "max": 20}) == {"text": {"maxlength": 20}}


# ---------------------------------------------------------------- the save profile and fingerprints

def test_changing_a_locked_block_is_detected_by_the_fingerprint_of_its_raw_not_the_claimed_one(house):
    cfg = by_alias(house, "כפתורי מפסק סלון")
    stored, draft = draft_of(cfg), draft_of(cfg)
    assert m.changed_locked_blocks(draft, stored) == [] and m.save_profile(draft, stored) == "builder"
    assert len(m.preserved_fingerprints(draft)) == 2
    draft["triggers"].pop()  # removing a locked block is still the builder
    assert m.save_profile(draft, stored) == "builder"
    edited = draft_of({**cfg, "triggers": [{"trigger": "device", "domain": "wall_switch", "device_id": "2f1c9a07", "type": "button_2_short", "id": "short"}]})
    assert len(m.changed_locked_blocks(edited, stored)) == 1 and m.save_profile(edited, stored) == "code"
    new_tpl = draft_of({**cfg, "actions": [*cfg["actions"], {"action": "light.turn_on", "target": {"entity_id": "{{ x }}"}}]})
    assert m.save_profile(new_tpl, stored) == "code"
    # a client that claims the fingerprint of a stored block but sends other content is caught: the fingerprint is recomputed from the raw
    forged = draft_of(cfg)
    forged["triggers"][0]["raw"] = {"trigger": "device", "domain": "wall_switch", "device_id": "evil", "type": "x"}
    assert forged["triggers"][0]["fingerprint"] == stored["triggers"][0]["fingerprint"]
    assert m.save_profile(forged, stored) == "code"
    # no stored item (a create): every locked block is new
    assert m.save_profile(draft_of(cfg), None) == "code"


def test_walking_dotted_paths_lookup_by_uid_and_by_issue_path(house):
    cfg = by_alias(house, "מזגן חדר שינה לפי שעה")
    draft = draft_of(cfg)
    paths = [w.path for w in m.walk_draft(draft)]
    assert "triggers.1" in paths and "actions.0" in paths and "actions.0.choose.1.conditions.0" in paths and "actions.0.choose.1.sequence.0" in paths
    inner = next(w.block for w in m.walk_draft(draft) if w.path == "actions.0.choose.1.sequence.0")
    assert inner["sentence"] == "כבה מזגן חדר שינה" and m.find_block(draft, inner["uid"]) is inner
    assert m.block_at_path(draft, "actions[0].choose[1].sequence[0]") is inner
    assert m.block_at_path(draft, "action/0/choose/1/sequence/0/data/x") is inner
    assert m.normalise_path("trigger/0") == "triggers.0" and m.block_at_path(draft, "alias") is None
    assert m.draft_targets(draft) == ["climate.bed"] and m.trigger_entities(draft) == []
    assert m.emit_block(draft["triggers"][0], "trigger", CTX) == {"trigger": "time", "at": "22:00:00", "id": "night"}
    assert m.steps_of_draft(draft) == 3  # the choose and its two steps


def test_facts_unknown_effects_sensitive_steps_and_schedule_controlling_blocks(house):
    d = draft_of(by_alias(house, "הקפאת תזמונים בחופשה"))
    assert m.has_unknown_effects(d) and any(m.controls_schedules(b) for b in m.locked_blocks(d))
    assert not m.has_unknown_effects(draft_of(by_alias(house, "תנועה בפרוזדור")))
    left = draft_of(by_alias(house, "כולם יצאו"))
    steps = m.sensitive_steps(left, lambda e: "alarm" if e.startswith("alarm") else None, lambda g: g == "alarm.disarm")
    assert steps == [{"path": "actions.2", "entity_id": "alarm_control_panel.home", "action": "alarm_control_panel.alarm_arm_away", "grant": "alarm.disarm", "granted": True}]
    assert m.sensitive_steps(left, None, lambda g: False)[0]["granted"] is False
    assert m.sensitive_classes(left) == ["alarm"]
    gate = {"kind": "typed", "raw": None, "type": "service", "role": "device", "action": "cover.open_cover", "entity_ids": ["cover.gate"], "data": {}}
    assert m.block_is_sensitive(gate, lambda e: "gate") and not m.block_is_sensitive(gate)
    assert m.locked_count(draft_of(by_alias(house, "כפתורי מפסק סלון"))) == 2


def test_describe_gives_the_server_everything_about_a_stored_config(house):
    cfg = by_alias(house, "כולם יצאו")
    info = m.describe("automation", cfg, CTX, lambda e: "alarm" if e.startswith("alarm") else None)
    assert info["revision"] == m.revision_of(cfg) and info["targets"][-1] == "alarm_control_panel.home" and info["trigger_entities"] == ["zone.home"]
    assert info["sensitive_classes"] == ["alarm"] and info["locked_count"] == 0 and info["unknown_effects"] is False and info["has_secrets"] is False
    assert info["sentence"].startswith("כשכולם יוצאים מהבית")
    sec = m.describe("automation", by_alias(house, "התראה עם מפתח"), CTX)
    assert sec["has_secrets"] is True and sec["locked_count"] == 1


# ---------------------------------------------------------------- secrets in drafts

def test_a_draft_that_leaves_the_server_is_masked_and_one_that_comes_back_is_restored(house):
    cfg = by_alias(house, "התראה עם מפתח")
    draft = draft_of(cfg)
    block = m.locked_blocks(draft)[0]
    assert block["reason"] == "secret" and block["masked"] is True and "test-key-not-real" in json.dumps(block["raw"])
    masked = m.mask_draft(draft)
    text = json.dumps(masked, ensure_ascii=False)
    assert "test-key-not-real" not in text and "••••" in text
    mb = m.locked_blocks(masked)[0]
    assert mb["fingerprint"] == block["fingerprint"] and mb["masked"] is True  # the fingerprint stays the one of the REAL raw
    assert "test-key-not-real" in json.dumps(block["raw"]) and m.config_has_mask(masked["actions"][0]["raw"])  # the original is untouched
    back = m.unmask_draft(masked, draft)
    assert m.locked_blocks(back)[0]["raw"] == block["raw"]
    assert m.dumps_exact(m.draft_to_config("automation", back, cfg, CTX)) == m.dumps_exact(cfg)
    # a draft with nothing to match keeps the mask (the caller refuses it as masked_values and never writes it)
    assert m.config_has_mask(m.locked_blocks(m.unmask_draft(masked, None))[0]["raw"])
    # a typed container holding a secret child: masked in the answer, restored from the stored one when equal
    nested = {"id": "9", "alias": "x", "triggers": [{"trigger": "time", "at": "01:00:00"}], "conditions": [],
              "actions": [{"if": [{"condition": "state", "entity_id": "person.yoni", "state": "home"}], "then": [{"action": "notify.pushover", "data": {"message": "m", "token": "tk-123"}}]}], "mode": "single"}
    nd = draft_of(nested)
    nm = m.mask_draft(nd)
    assert "tk-123" not in json.dumps(nm)
    nb = m.unmask_draft(nm, nd)
    assert m.dumps_exact(m.draft_to_config("automation", nb, nested, CTX)) == m.dumps_exact(nested)


# ---------------------------------------------------------------- validation (caps and per-block rules)

def valid_base():
    return draft_of({"alias": "בדיקה", "description": "", "triggers": [{"trigger": "time", "at": "20:00:00"}], "conditions": [], "actions": [{"action": "light.turn_on", "target": {"entity_id": ["light.hall"]}}], "mode": "single"})


def codes(draft, kind="automation", **kw):
    return [i["code"] for i in m.validate_draft(kind, draft, shabbat_sensor=SHABBAT, **kw)]


def test_a_valid_draft_has_no_issues_and_the_basics_are_required():
    assert codes(valid_base()) == []
    d = valid_base()
    d["alias"], d["triggers"], d["actions"] = "", [], []
    assert set(codes(d)) == {"alias_required", "trigger_required", "action_required"}
    d = valid_base()
    d["alias"], d["description"] = "x" * 121, "y" * 1001
    assert set(codes(d)) == {"alias_too_long", "description_too_long"}


def test_per_block_rules_entities_values_time_trigger_ids_notify_delay_repeat_options():
    def one(section, block, **kw):
        d = valid_base()
        d[section].append(block)
        return codes(d, **kw)

    t = lambda raw: m.parse_trigger(raw, CTX)  # noqa: E731
    c = lambda raw: m.parse_condition(raw, CTX)  # noqa: E731
    a = lambda raw: m.parse_action(raw, CTX)  # noqa: E731
    assert "entity_required" in one("triggers", t({"trigger": "state", "entity_id": []}))
    assert "value_required" in one("triggers", t({"trigger": "numeric_state", "entity_id": "sensor.bed_temp"}))
    assert "pattern_required" in one("triggers", t({"trigger": "time_pattern"}))
    no_sensor = m.validate_draft("automation", {**valid_base(), "conditions": [c({"condition": "state", "entity_id": SHABBAT, "state": "on"})]}, shabbat_sensor=None)
    assert [i["code"] for i in no_sensor] == ["shabbat_sensor_missing"]
    assert "trigger_id_unknown" in one("conditions", c({"condition": "trigger", "id": "nope"}))
    assert "conditions_required" in one("conditions", c({"condition": "or", "conditions": []}))
    d = valid_base()
    d["triggers"] = [t({"trigger": "time", "at": "20:00:00", "id": "n"}), t({"trigger": "time", "at": "21:00:00", "id": "n"})]
    assert "duplicate_trigger_id" in codes(d)
    d = valid_base()
    d["triggers"] = [t({"trigger": "time", "at": "20:00:00", "id": "n"})]
    d["conditions"] = [c({"condition": "trigger", "id": "n"})]
    assert codes(d) == []
    nb = {"kind": "typed", "raw": None, "type": "service", "role": "notify", "action": "notify.mobile_app_yoni", "entity_ids": [], "data": {"message": ""}}
    assert "message_required" in one("actions", nb)
    nb2 = {**nb, "data": {"message": "hi"}}
    assert "notify_target_not_allowed" in one("actions", nb2, notify_targets=["notify.notify"]) and "notify_target_not_allowed" not in one("actions", nb2, notify_targets=["notify.mobile_app_yoni"])
    assert "duration_required" in one("actions", {"kind": "typed", "raw": None, "type": "delay", "delay": {}})
    assert "count_invalid" in one("actions", {"kind": "typed", "raw": None, "type": "repeat_count", "count": 0, "sequence": []})
    assert "option_required" in one("actions", {"kind": "typed", "raw": None, "type": "choose", "options": [], "default": None})
    dev = {"kind": "typed", "raw": None, "type": "service", "role": "device", "action": "light.turn_on", "entity_ids": [], "data": {}}
    assert "entity_required" in one("actions", dev)
    assert "action_not_allowed" in one("actions", {**dev, "action": "homeassistant.restart", "entity_ids": ["light.a"]})


def test_codes_are_never_stored_a_code_in_a_new_step_is_code_not_allowed_any_other_secret_is_secret_not_allowed():
    base = {"kind": "typed", "raw": None, "type": "service", "role": "device", "action": "alarm_control_panel.alarm_disarm", "entity_ids": ["alarm_control_panel.home"]}
    d = valid_base()
    d["actions"].append({**base, "data": {"code": "1234"}})
    assert "code_not_allowed" in codes(d)
    d = valid_base()
    d["actions"].append({**base, "data": {"api_key": "k"}})
    assert "secret_not_allowed" in codes(d)
    d = valid_base()
    d["actions"].append({**base, "data": {"nope": 1}})
    assert "argument_not_allowed" in codes(d)
    d = valid_base()
    d["actions"].append({**base, "data": {}})  # a sensitive step with no arguments is valid; the manual-control grant is checked by the caller
    assert codes(d) == []


def test_an_unchanged_stored_step_stays_saveable_even_when_a_new_rule_would_refuse_it(house):
    """A stored `notify` step whose target the administrator has not approved (yet) is not re-judged until someone changes it."""
    cfg = by_alias(house, "דלת פתוחה יותר מ־5 דקות")
    d = draft_of(cfg)
    assert codes(d, notify_targets=["notify.notify"]) == []
    d["actions"][0]["data"]["message"] = "חדש"
    assert "notify_target_not_allowed" in codes(d, notify_targets=["notify.notify"])


def test_caps_triggers_conditions_steps_depth_targets_fields_members():
    d = valid_base()
    d["triggers"] = [m.parse_trigger({"trigger": "time", "at": "20:00:00"}, CTX) for _ in range(21)]
    d["conditions"] = [m.parse_condition({"condition": "sun", "after": "sunset"}, CTX) for _ in range(21)]
    assert {"too_many_triggers", "too_many_conditions"} <= set(codes(d))
    d = valid_base()
    d["actions"] = [m.parse_action({"delay": {"seconds": 1}}, CTX) for _ in range(61)]
    assert "too_many_steps" in codes(d)
    deep = {"delay": {"seconds": 1}}
    for _ in range(6):
        deep = {"repeat": {"count": 2, "sequence": [deep]}}
    d = valid_base()
    d["actions"] = [m.parse_action(deep, CTX)]
    assert "too_deep" in codes(d)
    d = valid_base()
    d["actions"] = [m.parse_action({"action": "light.turn_on", "target": {"entity_id": [f"light.l{i}" for i in range(51)]}}, CTX)]
    assert "too_many_targets" in codes(d)
    d = valid_base()
    d["actions"] = [m.parse_action({"choose": [{"conditions": [{"condition": "sun", "after": "sunset"}], "sequence": [{"delay": {"seconds": 1}}]} for _ in range(7)]}, CTX)]
    assert "too_many_options" in codes(d)
    script = m.config_to_draft("script", {"alias": "s", "fields": {f"f{i}": {"name": "n", "selector": {"boolean": {}}} for i in range(13)}, "sequence": [{"delay": {"seconds": 1}}]}, CTX).draft
    assert "too_many_fields" in codes(script, "script")
    bad = m.config_to_draft("script", {"alias": "s", "fields": {"Bad": {"name": "", "selector": {"number": {"min": 5, "max": 1}}}}, "sequence": [{"delay": {"seconds": 1}}]}, CTX).draft
    assert {"field_key_invalid", "alias_required", "range_invalid"} <= set(codes(bad, "script"))
    scene = {"name": "", "icon": None, "members": [{"entity_id": "alarm_control_panel.home", "state": "", "attributes": {"code": "1"}}, {"entity_id": "sensor.a", "state": "on", "attributes": {}}]}
    assert {"alias_required", "domain_not_allowed", "state_required", "code_not_allowed"} <= set(codes(scene, "scene"))
    assert "members_required" in codes({"name": "x", "icon": None, "members": []}, "scene")


def test_issue_paths_group_by_block(house):
    d = draft_of(by_alias(house, "תנועה בפרוזדור"))
    g = m.issues_by_uid(d, [{"path": "actions[0]", "code": "x", "message": "m"}, {"path": "alias", "code": "y", "message": "m"}])
    assert list(g) == [d["actions"][0]["uid"], ""]
