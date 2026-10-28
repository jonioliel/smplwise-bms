"""BUILDING-PRESENCE-2271 (board r339, phase 1): the cockpit's `building_empty` trigger and `room_occupied` condition.

Typed blocks over a fixed template shape (services/building_presence_blocks.py): round trips byte for byte, Hebrew sentences, validation,
and the guarantee that without tagged sensors (or for any hand-edited template) the step stays a LOCKED template. Synthetic entity ids."""
from __future__ import annotations

import pytest

from smplwise.services import automation_model as m
from smplwise.services import building_presence_blocks as bpb

A, B, C = "binary_sensor.shelly_presence_lobby", "binary_sensor.shelly_motion_hall", "binary_sensor.shelly_presence_office"
NAMES = {A: "לובי", B: "מסדרון", C: "משרד"}


def ctx(*sensors: str) -> m.ModelContext:
    return m.ModelContext(presence_sensors=tuple(sensors), names=lambda e: NAMES.get(e, e))


def trig(minutes: int = 15, sensors=(A, B)) -> dict:
    return {"kind": "typed", "type": "building_empty", "sensors": list(sensors), "minutes": minutes}


def cond(mode: str, sensors=(A,)) -> dict:
    return {"kind": "typed", "type": "room_occupied", "mode": mode, "sensors": list(sensors)}


def test_trigger_compiles_to_a_plain_template_with_for_and_round_trips():
    c = ctx(A, B, C)
    raw = m.emit_block(trig(90), "trigger", c)
    assert raw == {"trigger": "template", "for": {"hours": 1, "minutes": 30, "seconds": 0},
                   "value_template": "{{ ['binary_sensor.shelly_presence_lobby', 'binary_sensor.shelly_motion_hall'] | reject('is_state', 'off') | list | count == 0 }}"}
    parsed = m.parse_trigger(raw, c)
    assert parsed["kind"] == "typed" and parsed["type"] == "building_empty" and parsed["minutes"] == 90 and parsed["sensors"] == [A, B]
    assert parsed["sentence"] == "כשהמבנה ריק במשך 90 דקות"
    assert m.emit_block(parsed, "trigger", c) == raw  # unedited -> stored form untouched


def test_one_minute_sentence():
    assert m.parse_trigger(m.emit_block(trig(1), "trigger", ctx(A)), ctx(A))["sentence"] == "כשהמבנה ריק במשך דקה"


@pytest.mark.parametrize("mode,word", [("occupied", "יש נוכחות"), ("empty", "אין נוכחות")])
def test_condition_modes_round_trip_and_read(mode, word):
    c = ctx(A, B)
    raw = m.emit_block(cond(mode, (A,)), "condition", c)
    assert raw["condition"] == "template" and ("select('is_state', 'on')" in raw["value_template"]) == (mode == "occupied")
    parsed = m.parse_condition(raw, c)
    assert parsed["type"] == "room_occupied" and parsed["mode"] == mode and parsed["sensors"] == [A]
    assert parsed["sentence"] == f"{word} בלובי"
    assert m.emit_block(parsed, "condition", c) == raw


def test_whole_building_sentence_when_the_block_lists_every_tagged_sensor():
    c = ctx(A, B)
    assert m.parse_condition(m.emit_block(cond("occupied", (B, A)), "condition", c), c)["sentence"] == "יש נוכחות במבנה"
    assert m.parse_condition(m.emit_block(cond("empty", (A, B)), "condition", c), c)["sentence"] == "אין נוכחות במבנה"


def test_changing_a_block_rebuilds_it_and_keeps_alias():
    c = ctx(A, B)
    raw = {"alias": "בדיקה", **m.emit_block(cond("occupied", (A,)), "condition", c)}
    parsed = m.parse_condition(raw, c)
    assert parsed["kind"] == "typed"
    out = m.emit_block({**parsed, "mode": "empty"}, "condition", c)
    assert out["alias"] == "בדיקה" and "reject('is_state', 'off')" in out["value_template"]


def test_without_tagged_sensors_the_same_steps_stay_locked_templates():
    raw_t = m.emit_block(trig(), "trigger", ctx(A, B))
    raw_c = m.emit_block(cond("occupied"), "condition", ctx(A, B))
    for plain in (m.ModelContext(), ctx()):
        t, c = m.parse_trigger(raw_t, plain), m.parse_condition(raw_c, plain)
        assert t["kind"] == "locked" and t["reason"] == "template" and c["kind"] == "locked" and c["reason"] == "template"


@pytest.mark.parametrize("text", [
    "{{ ['binary_sensor.a'] | reject('is_state', 'off') | list | count == 1 }}",
    "{{ ['binary_sensor.a'] | reject('is_state', 'off') | list | count == 0 }} and true",
    "{{ states('binary_sensor.a') == 'off' }}",
    "{{ [] | reject('is_state', 'off') | list | count == 0 }}",
    "{{ ['not an entity'] | reject('is_state', 'off') | list | count == 0 }}",
    "{{ ['binary_sensor.a'] | reject('is_state', 'off') | list | count == 0 }}{{ x }}",
])
def test_hand_edited_templates_stay_locked(text):
    c = ctx(A)
    assert m.parse_trigger({"trigger": "template", "value_template": text, "for": {"minutes": 5}}, c)["kind"] == "locked"
    assert m.parse_condition({"condition": "template", "value_template": text}, c)["kind"] == "locked"


def test_extra_keys_or_a_bad_duration_keep_the_trigger_locked():
    c = ctx(A)
    good = m.emit_block(trig(5, (A,)), "trigger", c)
    assert m.parse_trigger({**good, "variables": {"x": 1}}, c)["kind"] == "locked"  # unknown key
    assert m.parse_trigger({k: v for k, v in good.items() if k != "for"}, c)["kind"] == "locked"  # no hold: not "empty for N minutes"
    assert m.parse_trigger({**good, "for": {"hours": 0, "minutes": 0, "seconds": 30}}, c)["kind"] == "locked"  # not whole minutes
    assert m.parse_trigger({**good, "for": {"hours": 30, "minutes": 0, "seconds": 0}}, c)["kind"] == "locked"  # over 1440
    assert m.parse_condition({**m.emit_block(cond("occupied"), "condition", c), "for": {"minutes": 1}}, c)["kind"] == "locked"


def test_the_trigger_template_never_reads_empty_for_an_unavailable_sensor():
    # `reject('is_state', 'off')` keeps `unavailable` / `unknown` in the list: the building is then NOT empty (same as the Arx aggregate)
    assert "reject('is_state', 'off')" in bpb.template_for("empty", [A])


def test_validation_of_new_blocks():
    def issues(trigger=None, condition=None, tagged=(A, B)):
        draft = {"alias": "x", "description": "", "mode": "single", "max": None, "triggers": [trigger] if trigger else [], "conditions": [condition] if condition else [], "actions": []}
        return [i["code"] for i in m.validate_draft("automation", draft, presence_sensors=list(tagged)) if i["code"].startswith("presence") or i["code"] == "building_presence_off"]

    assert issues(trig(15)) == [] and issues(condition=cond("empty")) == []
    assert issues(trig(0)) == ["presence_minutes_invalid"] and issues(trig(1441)) == ["presence_minutes_invalid"]
    assert issues(trig(5, ())) == ["presence_sensors_required"]
    assert issues(trig(5, (C,))) == ["presence_sensor_untagged"]
    assert issues(condition={**cond("empty"), "mode": "sideways"}) == ["presence_mode_invalid"]
    assert issues(trig(15), tagged=()) == ["building_presence_off"]


def test_text_helpers_cover_many_sensors():
    c = ctx(A, B, C)
    many = ["binary_sensor.s1", "binary_sensor.s2", "binary_sensor.s3", "binary_sensor.s4"]
    assert "ועוד 1" in bpb.condition_sentence(cond("occupied", many), [A, B, C], c.names)
    assert bpb.condition_sentence(cond("occupied", (A, B)), None, None) == "יש נוכחות באזור שנבחר"
