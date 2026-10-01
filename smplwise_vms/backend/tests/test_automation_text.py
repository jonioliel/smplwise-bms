"""CR-017 Hebrew sentences (services/automation_text.py). The first block holds the golden strings of the TypeScript client's spec
(frontend/tests/unit-automations.spec.ts, "Hebrew sentences"): both sides must say the same thing. The second compares every seed item with
tests/fixtures/automations/sentences_golden.json (regenerate with UPDATE_GOLDEN=1 after a reviewed change of wording). Synthetic data only."""
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from fake_ha_config import FakeHaConfig
from smplwise.services import automation_model as m
from smplwise.services import automation_text as t
from smplwise.services.automation_text import ModelContext

import automations_seed as seed

GOLDEN = Path(__file__).parent / "fixtures" / "automations" / "sentences_golden.json"
SHABBAT = seed.SHABBAT_SENSOR

# the names of the TS spec's ctx (NAMES) plus the extras of its `automationsNames`
TS_NAMES = {
    "light.hall": "תאורת פרוזדור", "light.entry": "תאורת כניסה", "light.garden": "תאורת גינה", "binary_sensor.hall_motion": "חיישן תנועה פרוזדור", "binary_sensor.front_door": "דלת הכניסה",
    "person.yoni": "יוני", "person.dana": "דנה", "zone.home": "הבית", "climate.bed": "מזגן חדר שינה", "climate.salon": "מזגן סלון", "alarm_control_panel.home": "אזעקה", "switch.irrigation": "השקיה",
    "light.salon": "תאורת סלון", "light.kitchen": "תאורת מטבח", "scene.salon_evening": "סלון · ערב", "script.good_morning": "בוקר טוב", "sensor.bed_temp": "טמפרטורה חדר שינה",
    "cover.salon_shutter": "תריס סלון", "switch.boiler": "דוד שמש", "light.kids": "תאורת חדר ילדים", "scene.salon_off": "סלון · הכל כבוי",
}


def ts_ctx(names=True):
    return ModelContext(names=(lambda i: TS_NAMES.get(i, i)) if names else None, shabbat_sensor=SHABBAT,
                        notify_name=lambda a: "הטלפון של יוני" if a == "notify.mobile_app_yoni" else None)


@pytest.fixture(scope="module")
def house():
    return FakeHaConfig.seed_probe_like()


def sentence_of(house, entity, ctx=None):
    ctx = ctx or ts_ctx()
    cid = next(c for (k, c), e in house._entity_of.items() if e == entity)
    kind = entity.split(".")[0]
    return t.draft_sentence(kind, m.config_to_draft(kind, house.file_item(kind, cid), ctx).draft, ctx)


# ---------------------------------------------------------------- the TypeScript goldens

def test_whole_item_sentences_equal_the_typescript_goldens(house):
    s = lambda e: sentence_of(house, e)  # noqa: E731
    assert s("automation.hall_motion") == "כשחיישן תנועה פרוזדור מזהה תנועה, אם אחרי השקיעה – הדלק תאורת פרוזדור ל־40%; המתן 3 דקות; כבה תאורת פרוזדור"
    assert s("automation.entry_sunset") == "20 דק׳ לפני השקיעה או כשהמערכת עולה – הדלק תאורת כניסה ותאורת גינה ל־70%"
    assert s("automation.all_left") == "כשכולם יוצאים מהבית – כבה תאורת סלון, תאורת מטבח ותאורת חדר ילדים; כבה מזגן סלון ומזגן חדר שינה; דרוך את אזעקה (מלא)"
    assert s("automation.door_open") == 'כשדלת הכניסה נפתח/ת במשך 5 דקות – שלח להטלפון של יוני "דלת הכניסה פתוחה כבר 5 דקות"'
    assert s("automation.bed_ac_clock") == 'בשעה 22:00 או בשעה 06:30 – אם הטריגר הוא "night" – כוון טמפרטורה של מזגן חדר שינה ל־24°; אם הטריגר הוא "morning" – כבה מזגן חדר שינה'
    assert s("automation.salon_buttons") == 'כפתור · מכשיר או כפתור · מכשיר – אם הטריגר הוא "short" – הפעל סצנה "סלון · ערב"; אם הטריגר הוא "long" – הפעל סצנה "סלון · הכל כבוי"'
    assert s("automation.light_by_lux") == "תבנית, אם בין 17:00 ל־23:30 – פעולה מתקדמת"
    assert s("automation.vacation_freeze") == 'כשיוני ודנה יוצא/ת מהבית במשך 24 שעות – שלח להטלפון של יוני "התזמונים הוקפאו" ופעולה מתקדמת'
    assert s("automation.alarm_morning") == "בשעה 06:45, אם יוני בבית – נטרל את אזעקה; אם טמפרטורה חדר שינה מעל 26 – פתח תריס סלון, אחרת – הדלק תאורת מטבח"
    assert s("script.good_morning") == "פתח תריס סלון; הדלק תאורת מטבח; כוון טמפרטורה של מזגן סלון ל־23°"


def test_script_sentence_with_a_name_missing_falls_back_to_the_entity_id(house):
    # the TS spec's `ctx` has no name for the shutter: "פתח cover.salon_shutter; ..."
    ctx = ModelContext(names=lambda i: {k: v for k, v in TS_NAMES.items() if k != "cover.salon_shutter"}.get(i, i), shabbat_sensor=SHABBAT)
    assert sentence_of(house, "script.good_morning", ctx) == "פתח cover.salon_shutter; הדלק תאורת מטבח; כוון טמפרטורה של מזגן סלון ל־23°"


def test_pieces_names_durations_triggers_conditions_actions_patterns_presence_locked_labels():
    ctx = ts_ctx()
    assert t.join_names([], ctx) == "…"
    assert t.join_names(["light.hall"], ctx) == "תאורת פרוזדור"
    assert t.join_names(["light.hall", "light.entry"], ctx) == "תאורת פרוזדור ותאורת כניסה"
    assert t.join_names(["light.hall", "light.entry", "light.garden"], ctx) == "תאורת פרוזדור, תאורת כניסה ותאורת גינה"
    assert t.duration_text({"hours": 1, "minutes": 30}) == "שעה ו30 דקות"
    assert t.duration_text({"minutes": 2, "seconds": 1}) == "שתי דקות ושנייה"
    assert t.duration_text({"hours": 3}) == "3 שעות"
    assert t.duration_text(None) == ""
    tr = lambda raw: t.trigger_sentence(m.parse_trigger(raw, ctx), ctx)  # noqa: E731
    assert tr({"trigger": "time_pattern", "minutes": "/15"}) == "כל 15 דקות"
    assert tr({"trigger": "time_pattern", "hours": "/1"}) == "כל שעה"
    assert tr({"trigger": "time_pattern", "minutes": "30"}) == "בדקה 30 של כל שעה"
    assert tr({"trigger": "time_pattern", "seconds": "/10"}) == "כל 10 שניות"
    assert tr({"trigger": "sun", "event": "sunrise", "offset": "00:10:00"}) == "10 דק׳ אחרי הזריחה"
    assert tr({"trigger": "sun", "event": "sunset"}) == "בשקיעה"
    assert tr({"trigger": "numeric_state", "entity_id": "sensor.bed_temp", "above": 26, "for": {"minutes": 10}}) == "כשטמפרטורה חדר שינה מעל 26 במשך 10 דקות"
    assert tr({"trigger": "numeric_state", "entity_id": "sensor.bed_temp", "above": 20.0, "below": 26.5}) == "כשטמפרטורה חדר שינה בין 20 ל־26.5"
    assert tr({"trigger": "state", "entity_id": "person.yoni", "from": "not_home", "to": "home"}) == "כשיוני חוזר/ת הביתה"
    assert tr({"trigger": "state", "entity_id": "person.yoni", "to": "home"}) == "כשיוני בבית"
    assert tr({"trigger": "state", "entity_id": "light.hall"}) == "כשתאורת פרוזדור משתנה"
    assert tr({"trigger": "state", "entity_id": "light.hall", "to": "on"}) == "כשתאורת פרוזדור נדלק/ת"
    assert tr({"trigger": "state", "entity_id": "binary_sensor.leak", "to": "on"}) == "כשbinary_sensor.leak מזהה מים"
    assert tr({"trigger": "time", "at": "06:30:15"}) == "בשעה 06:30:15"
    co = lambda raw: t.condition_sentence(m.parse_condition(raw, ctx), ctx)  # noqa: E731
    assert co({"condition": "time", "weekday": ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]}) == "בכל יום"
    assert co({"condition": "time", "weekday": ["sun", "thu"]}) == "בימים א׳, ה׳"
    assert co({"condition": "time", "after": "17:00:00", "weekday": ["fri"]}) == "אחרי 17:00 בימים ו׳"
    assert co({"condition": "sun", "after": "sunrise", "before": "sunset"}) == "בין הזריחה לשקיעה"
    assert co({"condition": "not", "conditions": [{"condition": "state", "entity_id": "person.yoni", "state": "home"}]}) == "לא (יוני בבית)"
    assert co({"condition": "or", "conditions": [{"condition": "sun", "after": "sunset"}, {"condition": "time", "before": "06:00:00"}]}) == "אחרי השקיעה או לפני 06:00"
    assert co({"condition": "state", "entity_id": [SHABBAT], "state": "off"}) == "לא בשבת וחג"
    assert co({"condition": "state", "entity_id": "climate.bed", "state": ["cool", "heat"]}) == 'מזגן חדר שינה במצב "cool" או "heat"'
    assert co({"condition": "numeric_state", "entity_id": "sensor.bed_temp", "below": 20}) == "טמפרטורה חדר שינה מתחת ל־20"
    ac = lambda raw: m.parse_action(raw, ctx)["sentence"]  # noqa: E731
    assert ac({"action": "climate.set_temperature", "target": {"entity_id": "climate.bed"}, "data": {"temperature": 23.5}}) == "כוון טמפרטורה של מזגן חדר שינה ל־23.5°"
    assert ac({"action": "climate.set_temperature", "target": {"entity_id": "climate.bed"}, "data": {"temperature": 24.0}}) == "כוון טמפרטורה של מזגן חדר שינה ל־24°"  # JavaScript prints 24
    assert ac({"action": "alarm_control_panel.alarm_arm_home", "target": {"entity_id": "alarm_control_panel.home"}}) == "דרוך את אזעקה (בית)"
    assert ac({"action": "lock.unlock", "target": {"entity_id": "lock.front"}}) == "פתח את lock.front"
    assert ac({"repeat": {"count": 3, "sequence": [{"action": "light.turn_on", "target": {"entity_id": "light.hall"}}]}}) == "חזור 3 פעמים: הדלק תאורת פרוזדור"
    assert ac({"stop": "סוף"}) == "עצור: סוף"
    assert ac({"delay": {"seconds": 10}}) == "המתן 10 שניות"
    assert ac({"condition": "sun", "after": "sunset"}) == "המשך רק אם אחרי השקיעה"
    assert ac({"action": "scheduler.run_action"}) == "שירות מיוחד · scheduler"
    assert ac({"action": "media_player.volume_set", "target": {"entity_id": "media_player.tv"}, "data": {"volume_level": 0.35}}) == "כוון עוצמה של media_player.tv ל־35%"
    assert ac({"action": "media_player.volume_set", "target": {"entity_id": "media_player.tv"}, "data": {"volume_level": 0.125}}) == "כוון עוצמה של media_player.tv ל־13%"  # Math.round: half up
    assert ac({"action": "notify.mobile_app_dana", "data": {"message": "x"}}) == 'שלח לdana "x"'
    assert ac({"action": "cover.set_cover_position", "target": {"entity_id": "cover.salon_shutter"}, "data": {"position": 40}}) == "כוון מיקום של תריס סלון ל־40%"
    assert ac({"action": "fan.set_percentage", "target": {"entity_id": "fan.f"}, "data": {"percentage": 70}}) == "כוון מהירות של fan.f ל־70%"
    assert ac({"action": "automation.trigger", "target": {"entity_id": "automation.x"}}) == 'הרץ את האוטומציה "automation.x"'
    assert ac({"action": "scene.turn_on", "target": {"entity_id": "scene.salon_evening"}}) == 'הפעל סצנה "סלון · ערב"'
    assert ac({"action": "script.good_morning"}) == 'הרץ "בוקר טוב"'


def test_locked_labels_by_reason_and_section():
    assert t.locked_label({}, "template", "action") == "תבנית"
    assert t.locked_label({"device_id": "d"}, "device", "trigger", ModelContext(device_name=lambda d: "מפסק")) == "כפתור · מפסק"
    assert t.locked_label({}, "device", "condition") == "תנאי מכשיר · מכשיר"
    assert t.locked_label({}, "device", "action") == "פעולת מכשיר · מכשיר"
    assert t.locked_label({"trigger": "switch.turned_on"}, "purpose_trigger", "trigger") == "טריגר ייעודי · switch.turned_on"
    assert t.locked_label({"action": "scheduler.disable_all"}, "custom_service", "action") == "שירות מיוחד · scheduler"
    assert t.locked_label({"service": "shell_command.x"}, "service_not_allowed", "action") == "שירות לא מותר · shell_command.x"
    assert t.locked_label({"enabled": False}, "disabled_step", "action") == "צעד מושבת" and t.locked_label({"continue_on_error": True}, "disabled_step", "action") == "צעד עם המשך בשגיאה"
    assert (t.locked_label({}, "secret", "action"), t.locked_label({}, "code", "action")) == ("ערך חסוי", "קוד חסוי")
    assert t.locked_label({"variables": {}}, "unsupported_step", "action") == "משתנים" and t.locked_label({"wait_template": "x"}, "unsupported_step", "action") == "המתנה לתנאי"
    assert t.locked_label({"repeat": {"while": []}}, "unsupported_step", "action") == "חזרה מתקדמת"
    assert [t.locked_label({}, "unsupported_step", s) for s in ("trigger", "condition", "action")] == ["טריגר מתקדם", "תנאי מתקדם", "צעד מתקדם"]
    assert [t.locked_label({}, "unknown", s) for s in ("trigger", "condition", "action")] == ["טריגר לא מוכר", "תנאי לא מוכר", "צעד לא מוכר"]


def test_draft_sentences_refresh_block_sentences_scripts_and_scenes(house):
    ctx = ts_ctx()
    cid = next(c for (k, c), e in house._entity_of.items() if e == "automation.hall_motion")
    draft = m.config_to_draft("automation", house.file_item("automation", cid), ctx).draft
    for w in m.walk_draft(draft):
        w.block["sentence"] = "x"
    m.refresh_sentences(draft, ctx)
    assert draft["triggers"][0]["sentence"] == "כשחיישן תנועה פרוזדור מזהה תנועה"
    bs = m.block_sentences(draft, ctx)
    assert len(bs) == len(m.walk_draft(draft)) and bs[draft["actions"][1]["uid"]] == "המתן 3 דקות"
    assert t.draft_sentence("scene", {"name": "x", "icon": None, "members": []}, ctx) == "סצנה ריקה"
    assert t.draft_sentence("scene", {"name": "x", "icon": None, "members": [{"entity_id": "light.hall", "state": "on", "attributes": {}}, {"entity_id": "light.entry", "state": "on", "attributes": {}}]}, ctx) == "מכוון תאורת פרוזדור ותאורת כניסה"
    assert t.draft_sentence("automation", {"alias": "", "description": "", "mode": "single", "max": None, "triggers": [], "conditions": [], "actions": []}, ctx) == "כש… – …"
    assert t.draft_sentence("script", {"alias": "", "sequence": []}, ctx) == "…"
    assert t.action_label("light.turn_on") == "הדלק" and t.action_label("alarm_control_panel.alarm_disarm") == "נטרל את" and t.action_label("media_player.media_play") == "נגן ב"


# ---------------------------------------------------------------- the golden file of the whole seed

def _seed_sentences(house):
    names = {e: s["attributes"].get("friendly_name", e) for e, s in house.states.items()}
    ctx = ModelContext(names=lambda i: names.get(i, i), shabbat_sensor=SHABBAT,
                       notify_name=lambda a: {"notify.mobile_app_yoni": "הטלפון של יוני", "notify.mobile_app_dana": "הטלפון של דנה", "notify.notify": "כל המכשירים"}.get(a))
    out = {}
    for (kind, cid), entity in sorted(house._entity_of.items(), key=lambda kv: kv[1]):
        if kind == "scene":
            continue
        out[entity] = t.draft_sentence(kind, m.config_to_draft(kind, house.file_item(kind, cid), ctx).draft, ctx)
    return out


def test_every_seed_item_has_its_golden_sentence(house):
    got = _seed_sentences(house)
    if os.environ.get("UPDATE_GOLDEN") == "1":
        GOLDEN.parent.mkdir(parents=True, exist_ok=True)
        with GOLDEN.open("w", encoding="utf-8", newline="\n") as fh:
            fh.write(json.dumps(got, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
    want = json.loads(GOLDEN.read_text(encoding="utf-8"))
    assert got == want
    assert len(got) >= 52 and all(s and "undefined" not in s and "null" not in s for s in got.values())
