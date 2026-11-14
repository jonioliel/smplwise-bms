"""Synthetic seed for the CR-017 fake (`fake_ha_config.FakeHaConfig`): configs shaped like the anonymised probe of four real systems
(docs/research/AUTOMATIONS_PROBE_2026-10-01.md) - NEW keys everywhere (`triggers` / `conditions` / `actions`, `trigger:`, `action:`), one or two legacy
items, state / time / time_pattern / template / device / HA-start triggers and one purpose-specific trigger, `choose` and `if`, trigger ids, all four modes,
custom `scheduler.*` / `shell_command` services, an alarm arm and disarm, notify, a missing entity, a YAML-managed item, a no-id item, an invalid one, 20
integration scenes, nine scripts (one with fields). 42 automations, like the probe.

Every name and id is generic and invented; nothing here comes from a real installation. The first twelve automations, three scripts and one scene are
the "fixture house" of the TypeScript client (`frontend/src/api/automations-mock.ts`), so the Hebrew sentence goldens are the same on both sides.
"""
from __future__ import annotations

from typing import Any

SHABBAT_SENSOR = "binary_sensor.shabbat_or_holiday"


def dur(h: int, m: int, s: int) -> dict[str, int]:
    return {"hours": h, "minutes": m, "seconds": s}


# ---------------------------------------------------------------- the world: entities the configs refer to (name, area)

WORLD: dict[str, tuple[str, str | None]] = {
    "light.entry": ("תאורת כניסה", "entry"), "light.hall": ("תאורת פרוזדור", "hall"), "light.salon": ("תאורת סלון", "salon"), "light.salon_spots": ("ספוטים סלון", "salon"),
    "light.kitchen": ("תאורת מטבח", "kitchen"), "light.bed": ("תאורת חדר שינה", "bed"), "light.kids": ("תאורת חדר ילדים", "kids"), "light.garden": ("תאורת גינה", "entry"),
    "light.stairs": ("תאורת מדרגות", "hall"), "light.office": ("תאורת חדר עבודה", "office"),
    "switch.irrigation": ("השקיה", "entry"), "switch.kids_fan": ("מאוורר חדר ילדים", "kids"), "switch.wall_1": ("מפסק קיר 1", "salon"), "switch.wall_8": ("מפסק קיר 8", "kitchen"),
    "climate.bed": ("מזגן חדר שינה", "bed"), "climate.salon": ("מזגן סלון", "salon"), "climate.kids": ("מזגן חדר ילדים", "kids"), "climate.office": ("מזגן חדר עבודה", "office"),
    "binary_sensor.hall_motion": ("חיישן תנועה פרוזדור", "hall"), "binary_sensor.stairs_motion": ("חיישן תנועה מדרגות", "hall"), "binary_sensor.office_motion": ("חיישן תנועה חדר עבודה", "office"),
    "binary_sensor.front_door": ("דלת הכניסה", "entry"), "binary_sensor.garage_door": ("דלת חניה", "garage"), "binary_sensor.leak": ("חיישן הצפה", "laundry"),
    "binary_sensor.kids_window": ("חלון חדר ילדים", "kids"), SHABBAT_SENSOR: ("שבת וחג", None),
    "sensor.bed_temp": ("טמפרטורה חדר שינה", "bed"), "sensor.lux": ("עוצמת אור", None), "sensor.power_total": ("צריכת חשמל", None),
    "person.yoni": ("יוני", None), "person.dana": ("דנה", None), "zone.home": ("הבית", None),
    "alarm_control_panel.home": ("אזעקה", "entry"), "lock.front": ("מנעול דלת כניסה", "entry"), "cover.gate": ("שער חניה", "garage"), "cover.salon_shutter": ("תריס סלון", "salon"),
    "cover.kids_shutter": ("תריס חדר ילדים", "kids"), "siren.outdoor": ("צופר חיצוני", "entry"), "media_player.salon_tv": ("טלוויזיה סלון", "salon"),
    "select.ac_mode": ("מצב מיזוג", "salon"), "number.boiler_target": ("טמפרטורת דוד", "laundry"), "timer.stairs": ("טיימר מדרגות", "hall"),
    "input_boolean.vacation": ("מצב חופשה", None), "input_select.house_mode": ("מצב הבית", None),
}
# entities that exist in the registry but have NO state (and one that does not exist at all: `switch.old_boiler`, `binary_sensor.old_door`)
WORLD_STATES: dict[str, dict[str, Any]] = {
    "light.entry": {"state": "off"}, "light.hall": {"state": "off"}, "light.salon": {"state": "on", "attributes": {"brightness": 128, "color_mode": "color_temp", "color_temp_kelvin": 2700}},
    "light.kitchen": {"state": "on", "attributes": {"brightness": 255, "color_mode": "brightness"}}, "light.kids": {"state": "on", "attributes": {"brightness": 77, "color_mode": "brightness"}},
    "climate.salon": {"state": "cool", "attributes": {"temperature": 23, "fan_mode": "auto", "hvac_modes": ["off", "cool", "heat"]}}, "climate.bed": {"state": "off", "attributes": {"temperature": 24}},
    "cover.salon_shutter": {"state": "open", "attributes": {"current_position": 100}}, "lock.front": {"state": "locked"}, "alarm_control_panel.home": {"state": "disarmed"},
    "binary_sensor.hall_motion": {"state": "off", "attributes": {"device_class": "motion"}}, "binary_sensor.front_door": {"state": "off", "attributes": {"device_class": "door"}},
    "person.yoni": {"state": "home"}, "person.dana": {"state": "not_home"}, "zone.home": {"state": "1"}, "sensor.bed_temp": {"state": "25.4", "attributes": {"unit_of_measurement": "°C"}},
    "sensor.lux": {"state": "320"}, SHABBAT_SENSOR: {"state": "off"}, "media_player.salon_tv": {"state": "off", "attributes": {"volume_level": 0.3}},
}

AREAS = {"entry": "כניסה", "salon": "סלון", "kitchen": "מטבח", "hall": "פרוזדור", "bed": "חדר שינה", "kids": "חדר ילדים", "office": "חדר עבודה", "garage": "חניה", "laundry": "חדר כביסה"}
FLOORS = {"g": "קרקע", "f1": "קומה א׳", "b": "מרתף"}
AREA_FLOOR = {"entry": "g", "salon": "g", "kitchen": "g", "hall": "f1", "bed": "f1", "kids": "f1", "office": "f1", "garage": "b", "laundry": "b"}

NOTIFY_SERVICES = ("notify.mobile_app_yoni", "notify.mobile_app_dana", "notify.notify")

# services of the fake `get_services` (domain -> service names): the core ones the builder types, plus the custom ones the probe found
SERVICES: dict[str, list[str]] = {
    "light": ["turn_on", "turn_off", "toggle"], "switch": ["turn_on", "turn_off", "toggle"], "fan": ["turn_on", "turn_off", "set_percentage"],
    "climate": ["turn_on", "turn_off", "set_temperature", "set_hvac_mode", "set_fan_mode", "set_preset_mode"], "cover": ["open_cover", "close_cover", "stop_cover", "set_cover_position"],
    "lock": ["lock", "unlock"], "alarm_control_panel": ["alarm_arm_home", "alarm_arm_away", "alarm_arm_night", "alarm_disarm"], "siren": ["turn_on", "turn_off"],
    "media_player": ["turn_on", "turn_off", "media_play", "media_pause", "volume_set", "volume_mute"], "select": ["select_option"], "number": ["set_value"],
    "input_boolean": ["turn_on", "turn_off"], "input_select": ["select_option"], "timer": ["start", "cancel", "pause", "finish"],
    "scene": ["turn_on", "apply", "create", "delete", "reload"], "script": ["turn_on", "turn_off", "toggle", "reload"],
    "automation": ["turn_on", "turn_off", "toggle", "trigger", "reload"], "notify": ["mobile_app_yoni", "mobile_app_dana", "notify"],
    "homeassistant": ["turn_on", "turn_off", "restart", "reload_all"], "shell_command": ["blink"], "scheduler": ["disable_all", "enable_all", "run_action"],
    "browser_mod": ["popup"],
}


# ---------------------------------------------------------------- the fixture house (12 automations, 3 scripts, 1 native scene) = the TS mock's

def fixture_house_automations() -> list[tuple[str, str, dict[str, Any]]]:
    """(entity_id, config id, config): the stored items of `automations-mock.ts`, key order included."""
    def A(i: str, entity: str, config: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
        return entity, i, {"id": i, **config}

    return [
        A("1727700000001", "automation.entry_sunset", {
            "alias": "תאורת כניסה בשקיעה", "description": "", "triggers": [{"trigger": "sun", "event": "sunset", "offset": "-00:20:00"}, {"trigger": "homeassistant", "event": "start"}],
            "conditions": [], "actions": [{"action": "light.turn_on", "target": {"entity_id": ["light.entry", "light.garden"]}, "data": {"brightness_pct": 70}}], "mode": "single"}),
        A("1727700000002", "automation.hall_motion", {
            "alias": "תנועה בפרוזדור", "description": "תאורת לילה בפרוזדור", "triggers": [{"trigger": "state", "entity_id": ["binary_sensor.hall_motion"], "to": "on", "id": "motion"}],
            "conditions": [{"condition": "sun", "after": "sunset"}],
            "actions": [{"action": "light.turn_on", "target": {"entity_id": ["light.hall"]}, "data": {"brightness_pct": 40}}, {"delay": dur(0, 3, 0)},
                        {"action": "light.turn_off", "target": {"entity_id": ["light.hall"]}}], "mode": "restart", "trace": {"stored_traces": 10}}),
        A("1727700000003", "automation.all_left", {
            "alias": "כולם יצאו", "description": "כיבוי וחימוש כשהבית מתרוקן", "triggers": [{"trigger": "numeric_state", "entity_id": ["zone.home"], "below": 1}], "conditions": [],
            "actions": [{"action": "light.turn_off", "target": {"entity_id": ["light.salon", "light.kitchen", "light.kids"]}},
                        {"action": "climate.turn_off", "target": {"entity_id": ["climate.salon", "climate.bed"]}},
                        {"action": "alarm_control_panel.alarm_arm_away", "target": {"entity_id": ["alarm_control_panel.home"]}}], "mode": "single"}),
        A("1727700000004", "automation.door_open", {
            "alias": "דלת פתוחה יותר מ־5 דקות", "description": "", "triggers": [{"trigger": "state", "entity_id": ["binary_sensor.front_door"], "to": "on", "for": dur(0, 5, 0)}],
            "conditions": [], "actions": [{"action": "notify.mobile_app_yoni", "data": {"message": "דלת הכניסה פתוחה כבר 5 דקות"}}], "mode": "single"}),
        A("1727700000005", "automation.bed_ac_clock", {
            "alias": "מזגן חדר שינה לפי שעה", "description": "הפעלה בלילה וכיבוי בבוקר",
            "triggers": [{"trigger": "time", "at": "22:00:00", "id": "night"}, {"trigger": "time", "at": "06:30:00", "id": "morning"}], "conditions": [],
            "actions": [{"choose": [
                {"conditions": [{"condition": "trigger", "id": ["night"]}], "sequence": [{"action": "climate.set_temperature", "target": {"entity_id": ["climate.bed"]}, "data": {"temperature": 24}}]},
                {"conditions": [{"condition": "trigger", "id": ["morning"]}], "sequence": [{"action": "climate.turn_off", "target": {"entity_id": ["climate.bed"]}}]}]}], "mode": "single"}),
        A("1727700000006", "automation.salon_buttons", {
            "alias": "כפתורי מפסק סלון", "description": "",
            "triggers": [{"trigger": "device", "domain": "wall_switch", "device_id": "2f1c9a07", "type": "button_1_short", "id": "short"},
                         {"trigger": "device", "domain": "wall_switch", "device_id": "2f1c9a07", "type": "button_1_long", "id": "long"}], "conditions": [],
            "actions": [{"choose": [
                {"conditions": [{"condition": "trigger", "id": ["short"]}], "sequence": [{"action": "scene.turn_on", "target": {"entity_id": ["scene.salon_evening"]}}]},
                {"conditions": [{"condition": "trigger", "id": ["long"]}], "sequence": [{"action": "scene.turn_on", "target": {"entity_id": ["scene.salon_off"]}}]}]}], "mode": "parallel"}),
        A("1727700000007", "automation.light_by_lux", {
            "alias": "תאורה לפי תבנית", "description": "תבנית בוחרת את החדר לפי החיישן",
            "triggers": [{"trigger": "template", "value_template": "{{ states('sensor.lux') | int < 20 }}"}], "conditions": [{"condition": "time", "after": "17:00:00", "before": "23:30:00"}],
            "actions": [{"action": "light.turn_on", "target": {"entity_id": "{{ trigger.to_state.attributes.room_light }}"}}], "mode": "queued", "max": 10, "variables": {"room": "salon"}}),
        A("1727700000008", "automation.vacation_freeze", {
            "alias": "הקפאת תזמונים בחופשה", "description": "", "triggers": [{"trigger": "state", "entity_id": ["person.yoni", "person.dana"], "to": "not_home", "for": dur(24, 0, 0)}],
            "conditions": [], "actions": [{"action": "scheduler.disable_all"}, {"action": "notify.mobile_app_yoni", "data": {"message": "התזמונים הוקפאו"}}], "mode": "single"}),
        A("1727700000009", "automation.boiler_morning", {
            "alias": "דוד שמש בבוקר", "description": "", "triggers": [{"trigger": "time", "at": "05:30:00"}], "conditions": [{"condition": "time", "weekday": ["sun", "mon", "tue", "wed", "thu"]}],
            "actions": [{"action": "switch.turn_on", "target": {"entity_id": ["switch.boiler"]}}, {"delay": dur(0, 45, 0)},
                        {"action": "switch.turn_off", "target": {"entity_id": ["switch.boiler"]}, "continue_on_error": True}], "mode": "single"}),
        # the pre-2024.10 key schema (`trigger` / `platform` / `service`): read in memory, rewritten in the new schema only when someone saves it
        A("1727700000010", "automation.alarm_morning", {
            "alias": "נטרול אזעקה בבוקר", "description": "רק כשמישהו בבית", "trigger": [{"platform": "time", "at": "06:45:00"}],
            "condition": [{"condition": "state", "entity_id": "person.yoni", "state": "home"}],
            "action": [{"service": "alarm_control_panel.alarm_disarm", "target": {"entity_id": "alarm_control_panel.home"}},
                       {"if": [{"condition": "numeric_state", "entity_id": "sensor.bed_temp", "above": 26}], "then": [{"service": "cover.open_cover", "target": {"entity_id": "cover.salon_shutter"}}],
                        "else": [{"service": "light.turn_on", "target": {"entity_id": "light.kitchen"}}]}], "mode": "single"}),
        A("1727700000011", "automation.leak_alert", {
            "alias": "הצפה בחדר כביסה", "description": "", "triggers": [{"trigger": "state", "entity_id": ["binary_sensor.leak"], "to": "on"}], "conditions": [],
            "actions": [{"action": "notify.notify", "data": {"message": "זוהתה הצפה בחדר כביסה!"}},
                        {"repeat": {"count": 3, "sequence": [{"action": "siren.turn_on", "target": {"entity_id": ["siren.outdoor"]}}, {"delay": dur(0, 0, 10)},
                                                              {"action": "siren.turn_off", "target": {"entity_id": ["siren.outdoor"]}}]}}], "mode": "single"}),
    ]


def fixture_house_scripts() -> list[tuple[str, dict[str, Any]]]:
    return [
        ("good_morning", {"alias": "בוקר טוב", "description": "תריס, אור ומזגן", "icon": "mdi:weather-sunset-up", "mode": "single",
                          "sequence": [{"action": "cover.open_cover", "target": {"entity_id": ["cover.salon_shutter"]}}, {"action": "light.turn_on", "target": {"entity_id": ["light.kitchen"]}},
                                       {"action": "climate.set_temperature", "target": {"entity_id": ["climate.salon"]}, "data": {"temperature": 23}}]}),
        ("vacation", {"alias": "מצב חופשה", "description": "חימוש, כיבוי הכל, הודעה", "mode": "single",
                      "sequence": [{"action": "light.turn_off", "target": {"entity_id": ["light.salon", "light.kitchen", "light.bed"]}},
                                   {"action": "climate.turn_off", "target": {"entity_id": ["climate.salon", "climate.bed"]}},
                                   {"action": "alarm_control_panel.alarm_arm_away", "target": {"entity_id": ["alarm_control_panel.home"]}},
                                   {"action": "notify.mobile_app_yoni", "data": {"message": "מצב חופשה הופעל"}}]}),
        ("shutters", {"alias": "תריסים לפי אחוז", "description": "עם שדות", "mode": "single",
                      "fields": {"percent": {"name": "אחוז פתיחה", "description": "מ־0 עד 100", "required": True, "default": 50,
                                             "selector": {"number": {"min": 0, "max": 100, "step": 10, "unit_of_measurement": "%", "mode": "slider"}}},
                                 "shutters": {"name": "תריסים", "default": ["cover.salon_shutter"], "selector": {"entity": {"domain": "cover"}}},
                                 "slow": {"name": "תנועה איטית", "default": False, "selector": {"boolean": {}}},
                                 "side": {"name": "צד", "default": "שניהם", "selector": {"select": {"options": ["שניהם", "ימין", "שמאל"]}}}},
                      "sequence": [{"action": "cover.set_cover_position", "target": {"entity_id": "{{ shutters }}"}, "data": {"position": "{{ percent }}"}}]}),
    ]


def fixture_house_scene() -> tuple[str, str, dict[str, Any]]:
    return "scene.arx_welcome", "1727700000200", {
        "id": "1727700000200", "name": "ברוכים הבאים", "icon": "mdi:home-heart",
        "entities": {"light.entry": {"state": "on", "brightness": 204, "color_temp_kelvin": 3000}, "light.salon": {"state": "on", "brightness": 128, "color_temp_kelvin": 2700},
                     "cover.salon_shutter": {"state": "open", "current_position": 100}, "climate.salon": {"state": "cool", "temperature": 23}, "media_player.salon_tv": {"state": "off"}},
        "metadata": {}}


# ---------------------------------------------------------------- the rest of the probe-like population (30 more automations, 6 more scripts)

def _st(entity: str | list[str], to: str | None = None, **kw: Any) -> dict[str, Any]:
    t: dict[str, Any] = {"trigger": "state", "entity_id": [entity] if isinstance(entity, str) else entity}
    if to is not None:
        t["to"] = to
    t.update(kw)
    return t


def _svc(action: str, entity: str | list[str] | None = None, **data: Any) -> dict[str, Any]:
    s: dict[str, Any] = {"action": action}
    if entity is not None:
        s["target"] = {"entity_id": [entity] if isinstance(entity, str) else entity}
    if data:
        s["data"] = data
    return s


def extra_automations() -> list[tuple[str, str, dict[str, Any], bool]]:
    """(entity_id, config id, config, enabled) - 30 items; ids 1727710000001 ... ."""
    n = [0]

    def A(entity: str, alias: str, description: str, triggers: list[Any], actions: list[Any], conditions: list[Any] | None = None, mode: str = "single", enabled: bool = True, **extra: Any):
        n[0] += 1
        i = f"17277100{n[0]:05d}"
        cfg: dict[str, Any] = {"id": i, "alias": alias, "description": description, "triggers": triggers, "conditions": conditions or [], "actions": actions, "mode": mode}
        cfg.update(extra)
        return entity, i, cfg, enabled

    return [
        A("automation.hall_night", "פרוזדור: אור לילה", "נדלק בתנועה ונכבה אחרי שתי דקות בלי תנועה",
          [_st("binary_sensor.hall_motion", "on", id="on"), _st("binary_sensor.hall_motion", "off", id="off", **{"for": dur(0, 2, 0)})],
          [{"choose": [{"conditions": [{"condition": "trigger", "id": ["on"]}], "sequence": [_svc("light.turn_on", "light.hall", brightness_pct=30)]},
                       {"conditions": [{"condition": "trigger", "id": ["off"]}], "sequence": [_svc("light.turn_off", "light.hall")]}]}], mode="restart"),
        A("automation.stairs_light", "מדרגות", "", [_st("binary_sensor.stairs_motion", "on")],
          [_svc("light.turn_on", "light.stairs"), {"delay": dur(0, 1, 30)}, _svc("light.turn_off", "light.stairs")], mode="restart"),
        A("automation.office_motion", "חדר עבודה בתנועה", "", [_st("binary_sensor.office_motion", "on", id="m")],
          [_svc("light.turn_on", "light.office"), {"delay": dur(0, 10, 0)}, _svc("light.turn_off", "light.office")], mode="queued", max=5),
        A("automation.salon_ac_morning", "מזגן סלון בבוקר", "רק כשמישהו בבית", [{"trigger": "time", "at": "06:00:00"}],
          [_svc("climate.set_hvac_mode", "climate.salon", hvac_mode="cool"), _svc("climate.set_temperature", "climate.salon", temperature=23)],
          conditions=[{"condition": "state", "entity_id": ["person.yoni"], "state": "home"}]),
        A("automation.salon_ac_off", "מזגן סלון כיבוי", "", [{"trigger": "time", "at": "23:30:00"}], [_svc("climate.turn_off", "climate.salon")], enabled=False),
        A("automation.kids_ac_by_temp", "מזגן ילדים לפי טמפרטורה", "",
          [{"trigger": "numeric_state", "entity_id": ["sensor.bed_temp"], "above": 27, "for": dur(0, 5, 0), "id": "hot"},
           {"trigger": "numeric_state", "entity_id": ["sensor.bed_temp"], "below": 24, "id": "cool"}],
          [{"choose": [{"conditions": [{"condition": "trigger", "id": ["hot"]}], "sequence": [_svc("climate.set_hvac_mode", "climate.kids", hvac_mode="cool")]},
                       {"conditions": [{"condition": "trigger", "id": ["cool"]}], "sequence": [_svc("climate.turn_off", "climate.kids")]}]}], mode="queued", max=3),
        A("automation.irrigation", "השקיה כל שש שעות", "", [{"trigger": "time_pattern", "hours": "/6", "minutes": "0"}],
          [_svc("switch.turn_on", "switch.irrigation"), {"delay": dur(0, 10, 0)}, _svc("switch.turn_off", "switch.irrigation")], mode="queued", max=2),
        A("automation.five_min_check", "בדיקה כל חמש דקות", "", [{"trigger": "time_pattern", "minutes": "/5"}],
          [_svc("number.set_value", "number.boiler_target", value=45)], conditions=[{"condition": "state", "entity_id": ["input_boolean.vacation"], "state": "off"}], mode="parallel", max=2),
        A("automation.start_restore", "שחזור אחרי הפעלה", "", [{"trigger": "homeassistant", "event": "start"}],
          [{"delay": dur(0, 0, 30)}, _svc("select.select_option", "select.ac_mode", option="auto"), _svc("automation.turn_on", "automation.salon_ac_off")]),
        A("automation.start_scene", "הפעלה: סצנת בוקר", "", [{"trigger": "homeassistant", "event": "start"}, {"trigger": "time", "at": "00:05:00"}],
          [_svc("scene.turn_on", "scene.wall_1")]),
        A("automation.garage_open", "דלת חניה פתוחה", "", [_st("binary_sensor.garage_door", "on", **{"for": dur(0, 10, 0)})],
          [_svc("notify.mobile_app_yoni", message="דלת החניה פתוחה כבר 10 דקות")]),
        A("automation.water_floor", "מים על הרצפה", "", [_st("binary_sensor.leak", "on")],
          [_svc("notify.notify", message="מים על הרצפה"), _svc("switch.turn_off", "switch.irrigation")], mode="parallel"),
        A("automation.kids_window_ac", "חלון ילדים פתוח עם מזגן", "", [_st("binary_sensor.kids_window", "on", **{"for": dur(0, 1, 0)})],
          [_svc("climate.turn_off", "climate.kids"), _svc("notify.mobile_app_dana", message="החלון פתוח והמזגן כבה")],
          conditions=[{"condition": "state", "entity_id": ["climate.kids"], "state": "cool"}]),
        A("automation.alarm_disarm_home", "נטרול אזעקה בחזרה הביתה", "", [_st("person.yoni", "home", **{"from": "not_home"})],
          [_svc("alarm_control_panel.alarm_disarm", "alarm_control_panel.home")], conditions=[{"condition": "time", "after": "05:00:00", "before": "23:00:00"}]),
        A("automation.alarm_night", "חימוש לילה", "", [{"trigger": "time", "at": "23:00:00"}], [_svc("alarm_control_panel.alarm_arm_night", "alarm_control_panel.home")],
          conditions=[{"condition": "state", "entity_id": ["person.yoni"], "state": "home"}]),
        A("automation.bed_buttons", "כפתורי חדר שינה", "",
          [{"trigger": "device", "domain": "wall_switch", "device_id": "a1b2c3d4", "type": "button_1_short", "id": "b1"},
           {"trigger": "device", "domain": "wall_switch", "device_id": "a1b2c3d4", "type": "button_2_short", "id": "b2"}],
          [{"choose": [{"conditions": [{"condition": "trigger", "id": ["b1"]}], "sequence": [_svc("light.turn_on", "light.bed", brightness_pct=20)]},
                       {"conditions": [{"condition": "trigger", "id": ["b2"]}], "sequence": [_svc("light.turn_off", "light.bed")]}]}], mode="parallel"),
        A("automation.kitchen_button", "כפתור מטבח", "", [{"trigger": "device", "domain": "wall_switch", "device_id": "e5f6a7b8", "type": "button_1_short"}],
          [_svc("light.turn_on", "light.kitchen")]),
        A("automation.kids_fan_template", "מאוורר לפי תבנית", "",
          [{"trigger": "template", "value_template": "{{ is_state('binary_sensor.kids_window','on') and states('sensor.bed_temp')|float > 28 }}"}],
          [_svc("switch.turn_on", "switch.kids_fan")], mode="restart"),
        A("automation.dynamic_target", "יעד דינמי", "", [_st("person.dana", "home")],
          [{"action": "light.turn_on", "target": {"entity_id": "{{ 'light.' ~ trigger.to_state.object_id }}"}}], mode="queued", max=4),
        A("automation.template_condition", "תנאי תבנית", "", [{"trigger": "time", "at": "19:00:00"}],
          [{"choose": [{"conditions": [{"condition": "template", "value_template": "{{ states('sensor.power_total')|float > 5000 }}"}], "sequence": [_svc("notify.notify", message="צריכה גבוהה")]}],
            "default": [_svc("light.turn_on", "light.salon", brightness_pct=50)]}]),
        A("automation.wall_purpose", "מפסק קיר: טריגר ייעודי", "", [{"trigger": "switch.turned_on", "target": {"entity_id": "switch.wall_1"}, "options": {"behavior": "any"}}],
          [_svc("light.turn_on", "light.salon_spots")]),
        A("automation.salon_evening", "סלון בערב", "", [{"trigger": "time", "at": "20:00:00"}],
          [_svc("light.turn_on", "light.salon", brightness_pct=60, color_temp_kelvin=2700)], mode="restart"),
        A("automation.shabbat_scene", "סצנת שבת", "", [{"trigger": "time", "at": "17:30:00"}], [_svc("scene.turn_on", "scene.wall_2")],
          conditions=[{"condition": "time", "weekday": ["fri"]}, {"condition": "state", "entity_id": [SHABBAT_SENSOR], "state": "off"}]),
        A("automation.garden_sunset", "גינה בשקיעה", "", [{"trigger": "sun", "event": "sunset", "offset": "-00:15:00"}], [_svc("light.turn_on", "light.garden", brightness_pct=80)]),
        A("automation.scheduler_resume", "חזרה מחופשה: הפעלת תזמונים", "", [_st("input_boolean.vacation", "off")], [{"action": "scheduler.enable_all"}, _svc("notify.mobile_app_yoni", message="התזמונים חזרו")]),
        A("automation.wall_shell", "מפסק 8: סקריפט מערכת", "", [_st("switch.wall_8", "on")], [{"action": "shell_command.blink"}, {"delay": dur(0, 0, 5)}, _svc("light.turn_off", "light.kitchen")]),
        A("automation.toggle_others", "שליטה באוטומציות", "", [_st("person.dana", "home", id="home")],
          [_svc("automation.turn_off", "automation.salon_ac_off", stop_actions=True), _svc("automation.trigger", "automation.stairs_light", skip_condition=True)]),
        A("automation.morning_if", "בוקר: תריס או אור", "", [{"trigger": "time", "at": "07:00:00"}],
          [{"if": [{"condition": "state", "entity_id": "person.yoni", "state": "home"}], "then": [_svc("cover.open_cover", "cover.salon_shutter")], "else": [_svc("notify.mobile_app_yoni", message="לא בבית")]}]),
        A("automation.door_blink", "דלת כניסה: הבהוב", "", [_st("binary_sensor.front_door", "on", id="door")],
          [{"repeat": {"count": 2, "sequence": [_svc("light.turn_on", "light.entry"), {"delay": dur(0, 0, 1)}, _svc("light.turn_off", "light.entry")]}}], mode="queued", max=3),
        A("automation.advanced_mix", "אוטומציה מתקדמת", "משתנים, המתנה ואירוע",
          [{"trigger": "event", "event_type": "arx_demo_event", "id": "ev"}],
          [{"variables": {"who": "{{ trigger.event.data.who }}"}}, {"wait_template": "{{ is_state('light.hall', 'on') }}", "timeout": "00:00:30", "continue_on_timeout": True},
           {"parallel": [_svc("light.turn_off", "light.hall"), _svc("light.turn_off", "light.stairs")]}], mode="restart", variables={"floor": "f1"}, trigger_variables={"limit": 5},
          initial_state=True, note="נשמר כמו שהוא"),
        A("automation.secret_notify", "התראה עם מפתח", "", [_st("binary_sensor.leak", "on")],
          [{"action": "notify.pushover", "data": {"message": "מים", "api_key": "test-key-not-real"}}]),
        A("automation.missing_entity", "בדיקה: ישות שנעלמה", "", [_st("binary_sensor.old_door", "on")], [_svc("switch.turn_on", "switch.old_boiler")], enabled=False),
    ]


def legacy_extra() -> tuple[str, str, dict[str, Any], bool]:
    """A second pre-2024.10 item with `data_template`: the 42nd automation (`automation.legacy_dt`)."""
    return ("automation.legacy_dt", "172771009999", {
        "id": "172771009999", "alias": "ישן: הודעה", "description": "", "trigger": [{"platform": "state", "entity_id": "binary_sensor.front_door", "to": "on"}], "condition": [],
        "action": [{"service": "notify.mobile_app_yoni", "data_template": {"message": "{{ trigger.to_state.name }}"}}], "mode": "single"}, True)


def extra_scripts() -> list[tuple[str, dict[str, Any]]]:
    return [
        ("goodnight", {"alias": "לילה טוב", "description": "", "mode": "single",
                       "sequence": [_svc("light.turn_off", ["light.salon", "light.kitchen"]), _svc("alarm_control_panel.alarm_arm_night", "alarm_control_panel.home")]}),
        ("all_off", {"alias": "כבה הכל", "mode": "single", "sequence": [_svc("light.turn_off", ["light.salon", "light.kitchen", "light.bed", "light.kids"]), _svc("climate.turn_off", ["climate.salon", "climate.bed"])]}),
        ("arm_away", {"alias": "חימוש מלא", "mode": "single", "sequence": [_svc("alarm_control_panel.alarm_arm_away", "alarm_control_panel.home")]}),
        ("disarm", {"alias": "נטרול אזעקה", "mode": "single", "sequence": [_svc("alarm_control_panel.alarm_disarm", "alarm_control_panel.home")]}),
        ("ac_boost", {"alias": "מזגן חזק", "description": "", "mode": "restart",
                      "sequence": [_svc("climate.set_hvac_mode", "climate.salon", hvac_mode="cool"), _svc("climate.set_temperature", "climate.salon", temperature=20), {"delay": dur(0, 30, 0)},
                                   _svc("climate.set_temperature", "climate.salon", temperature=24)]}),
        ("kids_blink", {"alias": "הבהוב בחדר ילדים", "mode": "single",
                        "sequence": [{"repeat": {"count": 3, "sequence": [_svc("light.turn_on", "light.kids"), {"delay": dur(0, 0, 1)}, _svc("light.turn_off", "light.kids")]}},
                                     {"action": "browser_mod.popup", "data": {"title": "בוצע"}}]}),
    ]


INTEGRATION_SCENES = [f"scene.wall_{i}" for i in range(1, 17)] + ["scene.salon_evening", "scene.salon_movie", "scene.salon_off", "scene.hub_arrive"]  # 20

# a YAML-managed automation (defined in a file Arx cannot write: the entity has an id, the config API answers 404) and one without any id
YAML_AUTOMATION = ("automation.shabbat_irrigation", "yaml-shabbat-irrigation", {
    "alias": "השקיה בשבת", "description": "", "triggers": [{"trigger": "time", "at": "06:00:00"}], "conditions": [{"condition": "state", "entity_id": [SHABBAT_SENSOR], "state": "on"}],
    "actions": [_svc("switch.turn_on", "switch.irrigation"), {"delay": dur(0, 20, 0)}, _svc("switch.turn_off", "switch.irrigation")], "mode": "single"})
NO_ID_AUTOMATION = ("automation.no_id", {
    "alias": "ללא מזהה", "description": "", "triggers": [{"trigger": "time", "at": "04:00:00"}], "conditions": [], "actions": [_svc("light.turn_off", "light.garden")], "mode": "single"})
