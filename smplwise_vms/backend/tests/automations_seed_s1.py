"""CR-017: synthetic, anonymised automations / scripts / scenes reproducing the distributions of docs/research/AUTOMATIONS_PROBE_2026-10-01.md
(new-schema keys, Hebrew aliases, state / time / time_pattern / template / device triggers, choose / if, trigger ids, every mode, custom
services, an alarm arm, notify, a missing entity, one legacy item, one purpose-specific trigger, extras). No private data: generic entity ids
of tests/fake_scheduler.py's world. Used by the model, policy and API tests and by tests/fake_ha_config.py."""
from __future__ import annotations

import copy
from typing import Any

SHABBAT = "binary_sensor.shabbat_mode"
NOTIFY = "notify.mobile_app_phone_a"


def automations() -> list[dict[str, Any]]:
    """The stored items of automations.yaml (a list; every item has an `id`)."""
    return [
        {"id": "1727000000001", "alias": "תאורה בפרוזדור בתנועה", "description": "מדליק כשיש תנועה ומכבה אחרי חמש דקות", "mode": "restart",
         "triggers": [{"trigger": "state", "entity_id": ["binary_sensor.motion_hall"], "to": "on", "id": "motion"}],
         "conditions": [{"condition": "sun", "after": "sunset", "after_offset": "-00:30:00"}],
         "actions": [{"action": "light.turn_on", "target": {"entity_id": ["light.office"]}, "data": {"brightness_pct": 40}}, {"delay": {"hours": 0, "minutes": 5, "seconds": 0}},
                     {"action": "light.turn_off", "target": {"entity_id": ["light.office"]}}]},
        {"id": "1727000000002", "alias": "מזגן סלון בבוקר", "description": "", "mode": "single",
         "triggers": [{"trigger": "time", "at": "07:00:00"}],
         "conditions": [{"condition": "time", "weekday": ["sun", "mon", "tue", "wed", "thu"]}],
         "actions": [{"action": "climate.set_temperature", "target": {"entity_id": ["climate.living_room"]}, "data": {"temperature": 24, "hvac_mode": "cool"}}]},
        {"id": "1727000000003", "alias": "מפסק מעבדה – הדלקה וכיבוי", "description": "בוחר לפי מזהה הטריגר", "mode": "queued", "max": 5,
         "triggers": [{"trigger": "state", "entity_id": "switch.garden_pump", "to": "on", "id": "pump_on"}, {"trigger": "state", "entity_id": "switch.garden_pump", "to": "off", "id": "pump_off"}],
         "conditions": [],
         "actions": [{"choose": [{"conditions": [{"condition": "trigger", "id": ["pump_on"]}], "sequence": [{"action": "switch.turn_on", "target": {"entity_id": ["switch.hall_lights"]}}]},
                                 {"conditions": [{"condition": "trigger", "id": ["pump_off"]}], "sequence": [{"action": "switch.turn_off", "target": {"entity_id": ["switch.hall_lights"]}}]}],
                     "default": [{"delay": {"seconds": 30}}]}]},
        {"id": "1727000000004", "alias": "כבוי כשאף אחד לא בבית", "description": "", "mode": "single",
         "triggers": [{"trigger": "numeric_state", "entity_id": ["sensor.outdoor_temperature"], "above": 30, "for": {"hours": 0, "minutes": 10, "seconds": 0}}],
         "conditions": [{"condition": "state", "entity_id": ["binary_sensor.motion_hall"], "state": "off"}],
         "actions": [{"if": [{"condition": "state", "entity_id": ["climate.bedroom_1"], "state": "cool"}], "then": [{"action": "climate.turn_off", "target": {"entity_id": ["climate.bedroom_1"]}}],
                      "else": [{"action": "climate.set_hvac_mode", "target": {"entity_id": ["climate.bedroom_2"]}, "data": {"hvac_mode": "cool"}}]}]},
        {"id": "1727000000005", "alias": "תבניות – התראת טמפרטורה", "description": "יש כאן תבניות (חלקים נעולים)", "mode": "single",
         "triggers": [{"trigger": "template", "value_template": "{{ states('sensor.outdoor_temperature') | float(0) > 28 }}"}],
         "conditions": [{"condition": "template", "value_template": "{{ is_state('binary_sensor.motion_hall', 'off') }}"}],
         "actions": [{"action": "switch.turn_on", "target": {"entity_id": "{{ 'switch.hall_lights' }}"}}, {"action": "light.turn_on", "target": {"entity_id": ["light.office"]}}]},
        {"id": "1727000000006", "alias": "כפתור קיר – תרחיש", "description": "", "mode": "parallel", "max": 3,
         "triggers": [{"trigger": "device", "domain": "zha", "device_id": "dev0001", "type": "remote_button_short_press", "subtype": "button_1"}],
         "conditions": [],
         "actions": [{"device_id": "dev0002", "domain": "light", "entity_id": "reg0001", "type": "toggle"}, {"action": "light.turn_off", "target": {"entity_id": ["light.office"]}}]},
        {"id": "1727000000007", "alias": "שירותים מיוחדים", "description": "", "mode": "single",
         "triggers": [{"trigger": "homeassistant", "event": "start"}],
         "conditions": [],
         "actions": [{"action": "scheduler.run_action", "data": {"entity_id": "switch.schedule_abc123", "time": "00:00:00"}}, {"action": "shell_command.blink", "data": {}},
                     {"action": "homeassistant.turn_on", "target": {"entity_id": ["light.office"]}}, {"action": "automation.turn_off", "target": {"entity_id": ["automation.other"]}, "data": {"stop_actions": True}}]},
        {"id": "1727000000008", "alias": "דריכת אזעקה בלילה", "description": "", "mode": "single",
         "triggers": [{"trigger": "time", "at": "23:30:00"}],
         "conditions": [{"condition": "state", "entity_id": ["alarm_control_panel.home_panel"], "state": "disarmed"}],
         "actions": [{"action": "alarm_control_panel.alarm_arm_home", "target": {"entity_id": ["alarm_control_panel.home_panel"]}}]},
        {"id": "1727000000009", "alias": "ניטרול עם קוד (ישן)", "description": "", "mode": "single",
         "triggers": [{"trigger": "state", "entity_id": ["binary_sensor.motion_hall"], "to": "on"}],
         "conditions": [],
         "actions": [{"action": "alarm_control_panel.alarm_disarm", "target": {"entity_id": ["alarm_control_panel.shed_panel"]}, "data": {"code": "1234"}}]},
        # a legacy item: trigger / platform / service, a single trigger dict, data_template-free
        {"id": "1727000000010", "alias": "פריט בסכמה ישנה", "description": "", "mode": "single",
         "trigger": [{"platform": "state", "entity_id": "switch.garden_pump", "to": "on"}],
         "condition": [],
         "action": [{"service": "switch.turn_off", "entity_id": "switch.hall_lights"}]},
        {"id": "1727000000011", "alias": "טריגר ייעודי", "description": "", "mode": "single",
         "triggers": [{"trigger": "switch.turned_on", "target": {"entity_id": ["switch.garden_pump"]}, "options": {}}],
         "conditions": [], "actions": [{"action": "light.turn_on", "target": {"entity_id": ["light.office"]}}]},
        {"id": "1727000000012", "alias": "זריחה, דפוס זמן ושקיעה", "description": "", "mode": "single",
         "triggers": [{"trigger": "sun", "event": "sunrise", "offset": "-00:15:00"}, {"trigger": "time_pattern", "minutes": "/5"}, {"trigger": "sun", "event": "sunset"}],
         "conditions": [{"condition": "state", "entity_id": [SHABBAT], "state": "off"}],
         "actions": [{"action": "cover.close_cover", "target": {"entity_id": ["cover.gym_shutter"]}}, {"action": "fan.set_percentage", "target": {"entity_id": ["fan.missing_fan"]}, "data": {"percentage": 50}}]},
        {"id": "1727000000013", "alias": "התראה לטלפון", "description": "", "mode": "single",
         "triggers": [{"trigger": "state", "entity_id": ["binary_sensor.motion_hall"], "to": "on", "for": {"hours": 0, "minutes": 2, "seconds": 0}}],
         "conditions": [],
         "actions": [{"action": NOTIFY, "data": {"message": "תנועה בפרוזדור", "title": "בית"}}]},
        {"id": "1727000000014", "alias": "שלבים מתקדמים", "description": "", "mode": "single",
         "triggers": [{"trigger": "time", "at": "06:30:00"}],
         "conditions": [],
         "actions": [{"variables": {"level": 40}}, {"wait_template": "{{ is_state('light.office', 'on') }}", "timeout": "00:01:00"}, {"repeat": {"count": 3, "sequence": [{"delay": {"seconds": 2}}]}},
                     {"repeat": {"while": [{"condition": "state", "entity_id": "light.office", "state": "on"}], "sequence": [{"delay": {"seconds": 1}}]}},
                     {"action": "light.turn_off", "target": {"entity_id": ["light.office"]}, "enabled": False}, {"action": "switch.turn_off", "target": {"entity_id": ["switch.hall_lights"]}, "continue_on_error": True},
                     {"stop": "סיום"}]},
        {"id": "1727000000015", "alias": "ערך סודי בקריאה", "description": "", "mode": "single",
         "triggers": [{"trigger": "time", "at": "05:00:00"}],
         "conditions": [],
         "actions": [{"action": "rest_command.push", "data": {"url": "http://example.invalid/x", "api_key": "abc-not-real"}}]},
        {"id": "1727000000016", "alias": "מפתחות עליונים נוספים", "description": "", "mode": "single", "variables": {"night": True}, "trace": {"stored_traces": 10}, "initial_state": True, "note": "הערה",
         "triggers": [{"trigger": "time", "at": "21:00:00"}],
         "conditions": [{"condition": "and", "conditions": [{"condition": "state", "entity_id": ["light.office"], "state": "off"}, {"condition": "or", "conditions": [{"condition": "state", "entity_id": "switch.hall_lights", "state": "off"}]}]}],
         "actions": [{"condition": "state", "entity_id": "light.office", "state": "off"}, {"action": "light.turn_on", "target": {"entity_id": "light.office"}, "data": {"brightness_pct": 20, "transition": 5}}]},
    ]


def scripts() -> dict[str, dict[str, Any]]:
    return {
        "good_night": {"alias": "לילה טוב", "icon": "mdi:weather-night", "description": "", "mode": "single",
                       "sequence": [{"action": "light.turn_off", "target": {"entity_id": ["light.office"]}}, {"action": "alarm_control_panel.alarm_arm_night", "target": {"entity_id": ["alarm_control_panel.home_panel"]}}]},
        "set_cooling": {"alias": "קירור עם פרמטרים", "mode": "restart",
                        "fields": {"temp": {"name": "טמפרטורה", "required": True, "default": 24, "selector": {"number": {"min": 16, "max": 30, "step": 1, "unit_of_measurement": "°C"}}},
                                   "quiet": {"name": "שקט", "selector": {"boolean": {}}}, "mode_pick": {"name": "מצב", "selector": {"select": {"options": ["cool", "auto"]}}},
                                   "who": {"name": "מכשיר", "selector": {"entity": {"domain": "climate"}}}, "when": {"name": "מתי", "selector": {"time": {}}}},
                        "sequence": [{"action": "climate.set_temperature", "target": {"entity_id": ["climate.living_room"]}, "data": {"temperature": 25}}]},
        "blink_lights": {"alias": "הבהוב", "mode": "single", "variables": {"count": 3},
                         "sequence": [{"repeat": {"count": 3, "sequence": [{"action": "light.toggle_missing", "target": {"entity_id": "light.office"}}, {"delay": {"seconds": 1}}]}}]},
    }


def scenes() -> list[dict[str, Any]]:
    return [
        {"id": "1727100000001", "name": "ערב בסלון", "icon": "mdi:sofa", "entities": {"light.office": {"state": "on", "brightness": 120, "color_mode": "color_temp"}, "switch.hall_lights": "on"},
         "metadata": {"light.office": {"entity_only": True}, "switch.hall_lights": {"entity_only": True}}},
        {"id": "1727100000002", "name": "יציאה מהבית", "entities": {"climate.living_room": {"state": "off"}, "cover.gym_shutter": {"state": "closed", "current_position": 0}}},
    ]


def integration_scenes(n: int = 20) -> list[str]:
    return [f"scene.wall_scene_{i:02d}" for i in range(1, n + 1)]


def seed_probe_like() -> dict[str, Any]:
    """Fresh copies of the three file contents (so a test may edit them)."""
    return {"automations": copy.deepcopy(automations()), "scripts": copy.deepcopy(scripts()), "scenes": copy.deepcopy(scenes())}
