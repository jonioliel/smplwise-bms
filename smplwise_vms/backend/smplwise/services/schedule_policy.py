"""CR-014 (schedules) safety policy: which entities a schedule may act on, with which services and arguments
(docs/architecture/SCHEDULER_API.md §5). Pure functions - no database, no Home Assistant - so the bridge's own copy of
the rules (integration/smplwise_bridge/schedule_policy.py, S2) can be compared with this one by a drift test.

Code, not settings: the capability flags below, the class table and the allow-list ceiling. What an administrator
switches per installation (which classes are on) lives in `schedules.classes` (routers/settings.py).

Shapes a drift test can rely on:

- `SCHEDULE_ACTIONS[class][service]` = `{"args": {name: {"type": "int|float|enum|str", "min", "max", "choices", "required"}},
  "exclusive": [[name, name]], "label": <ha_bridge.ACTIONS label>}` - the services and argument specs of a class.
- `SCHEDULE_ACTION_SERVICES` - every service of every class (a subset of `ha_bridge.ACTIONS`).
- `SERVICE_ARGS[service]` - the argument specs of one service (the same for every class that offers it).
"""
from __future__ import annotations

import math
import re
from typing import Any

from . import ha_bridge

# §1.3: both VERIFIED on the lab component (HA 2026.9.4, 2026-09-30): add / edit accept `tags` (edit replaces, [] clears) and
# `sunrise-00:15:00` works as start and stop (`sunset` without an offset is rejected: canonical_time always writes one).
CAPABILITIES: dict[str, bool] = {"tags": True, "negative_sun_offset": True}

ALL_CLASSES: tuple[str, ...] = ("light", "switch", "cover", "climate", "fan", "alarm", "lock", "door", "script", "scene", "helper", "humidifier", "vacuum",
                                "siren", "media", "number", "select")
# 2026-10-04 follow-up (owner decision 3): a siren is a SENSITIVE class like the alarm, the locks and the doors (schedule.sensitive, the bridge's
# `sensitive: true`, control of the entity itself, the remote channel's alarm rule)
SENSITIVE_CLASSES = frozenset({"alarm", "lock", "door", "siren"})
# 2026-10-04 (schedules: more actions): the classes added with bridge 0.6.1. A script or a scene is sensitive PER ENTITY (what it drives, read
# from the automations mirror - `is_sensitive`), never by its class alone.
ITEM_CLASSES = frozenset({"script", "scene"})
NEWER_CLASSES: tuple[str, ...] = ("script", "scene", "helper", "humidifier", "vacuum", "siren", "media", "number", "select")
# the ORIGINAL eight: an installation whose stored `schedules.classes` lists all of them had "every class on", and keeps it (routers/settings)
ORIGINAL_CLASSES: tuple[str, ...] = ("light", "switch", "cover", "climate", "fan", "alarm", "lock", "door")
DOOR_COVER_CLASSES = frozenset({"door", "garage", "gate"})  # = services/devices.DOOR_COVER_CLASSES (kept here: this module stays pure)

# a key that carries a code / secret anywhere inside a schedule: never stored (HA keeps service_data in clear text)
_CODE_KEYS = frozenset({"code", "alarm_code", "pin", "pin_code", "passcode", "password"})

LOWERING_ARM_OFF = "alarm_control_panel.alarm_disarm"

# script variables (`script.turn_on` `variables`): what a schedule may carry - never a code (the `_CODE_KEYS` rule), plain values only
MAX_VARS, MAX_VAR_TEXT = 10, 200
VAR_KEY = re.compile(r"^[a-z_][a-z0-9_]{0,63}$")


def _arg(kind: str, lo: float | None = None, hi: float | None = None, *, required: bool = False, choices: list[str] | None = None) -> dict[str, Any]:
    spec: dict[str, Any] = {"type": kind, "required": required}
    if lo is not None:
        spec["min"] = lo
    if hi is not None:
        spec["max"] = hi
    if choices is not None:
        spec["choices"] = list(choices)
    return spec


def _svc(service: str, args: dict[str, dict[str, Any]] | None = None, *, exclusive: list[list[str]] | None = None) -> dict[str, Any]:
    return {"args": args or {}, "exclusive": exclusive or [], "label": ha_bridge.ACTIONS[service]["label"]}


_COVER_MOVES = {
    "cover.open_cover": lambda: _svc("cover.open_cover"),
    "cover.close_cover": lambda: _svc("cover.close_cover"),
    "cover.stop_cover": lambda: _svc("cover.stop_cover"),
    "cover.set_cover_position": lambda: _svc("cover.set_cover_position", {"position": _arg("int", 0, 100, required=True)}),
}

SCHEDULE_ACTIONS: dict[str, dict[str, dict[str, Any]]] = {
    "light": {
        "light.turn_on": _svc("light.turn_on", {"brightness": _arg("int", 0, 255), "brightness_pct": _arg("int", 1, 100)}, exclusive=[["brightness", "brightness_pct"]]),
        "light.turn_off": _svc("light.turn_off"),
    },
    "switch": {"switch.turn_on": _svc("switch.turn_on"), "switch.turn_off": _svc("switch.turn_off")},
    "cover": {
        **{k: f() for k, f in _COVER_MOVES.items()},
        "cover.set_cover_tilt_position": _svc("cover.set_cover_tilt_position", {"tilt_position": _arg("int", 0, 100, required=True)}),
        "cover.open_cover_tilt": _svc("cover.open_cover_tilt"),
        "cover.close_cover_tilt": _svc("cover.close_cover_tilt"),
    },
    "climate": {
        "climate.set_hvac_mode": _svc("climate.set_hvac_mode", {"hvac_mode": _arg("enum", required=True, choices=ha_bridge.HVAC_MODES)}),
        "climate.set_temperature": _svc("climate.set_temperature", {"temperature": _arg("float", required=True), "hvac_mode": _arg("enum", choices=ha_bridge.HVAC_MODES)}),
        "climate.set_fan_mode": _svc("climate.set_fan_mode", {"fan_mode": _arg("str", 1, 40, required=True)}),
        "climate.set_preset_mode": _svc("climate.set_preset_mode", {"preset_mode": _arg("str", 1, 40, required=True)}),
        "climate.set_swing_mode": _svc("climate.set_swing_mode", {"swing_mode": _arg("str", 1, 40, required=True)}),
        "climate.set_humidity": _svc("climate.set_humidity", {"humidity": _arg("int", 0, 100, required=True)}),
        "climate.turn_off": _svc("climate.turn_off"),
    },
    "fan": {
        "fan.turn_on": _svc("fan.turn_on", {"percentage": _arg("int", 1, 100)}),
        "fan.turn_off": _svc("fan.turn_off"),
        "fan.set_percentage": _svc("fan.set_percentage", {"percentage": _arg("int", 0, 100, required=True)}),
    },
    "alarm": {f"alarm_control_panel.{m}": _svc(f"alarm_control_panel.{m}") for m in
              ("alarm_arm_home", "alarm_arm_away", "alarm_arm_night", "alarm_arm_vacation", "alarm_arm_custom_bypass", "alarm_disarm")},
    "lock": {"lock.lock": _svc("lock.lock"), "lock.unlock": _svc("lock.unlock")},
    "door": {
        **{k: f() for k, f in _COVER_MOVES.items()},
        "switch.turn_on": _svc("switch.turn_on"),
        "switch.turn_off": _svc("switch.turn_off"),
        "button.press": _svc("button.press"),
    },
    # 2026-10-04 (bridge 0.6.1): scripts (an alarm script is an ordinary script), scenes, helpers, humidifiers, vacuums
    "script": {"script.turn_on": _svc("script.turn_on", {"variables": _arg("vars")})},
    "scene": {"scene.turn_on": _svc("scene.turn_on")},
    "helper": {
        "input_boolean.turn_on": _svc("input_boolean.turn_on"),
        "input_boolean.turn_off": _svc("input_boolean.turn_off"),
        "input_number.set_value": _svc("input_number.set_value", {"value": _arg("float", -1e9, 1e9, required=True)}),
        "input_select.select_option": _svc("input_select.select_option", {"option": _arg("str", 1, 80, required=True)}),
    },
    "humidifier": {
        "humidifier.set_humidity": _svc("humidifier.set_humidity", {"humidity": _arg("int", 0, 100, required=True)}),
        "humidifier.set_mode": _svc("humidifier.set_mode", {"mode": _arg("str", 1, 40, required=True)}),
    },
    "vacuum": {"vacuum.start": _svc("vacuum.start"), "vacuum.return_to_base": _svc("vacuum.return_to_base")},
    # 2026-10-04 follow-up (owner decision 3, "add everything"): sirens (sensitive; a tone / duration / volume only when the siren reports it - the
    # tones from its own `available_tones`), media players (only what the player reports, only an approved and visible device of the multimedia
    # settings, the multimedia permissions at its anchor, the volume under the device's ceiling), and `number` / `select` (the entity's own
    # min / max / step and options; a configuration / diagnostic entity is never offered)
    "siren": {
        "siren.turn_on": _svc("siren.turn_on", {"tone": _arg("str", 1, 80), "duration": _arg("int", 1, 3600), "volume_level": _arg("float", 0, 1)}),
        "siren.turn_off": _svc("siren.turn_off"),
    },
    "media": {
        "media_player.turn_on": _svc("media_player.turn_on"),
        "media_player.turn_off": _svc("media_player.turn_off"),
        "media_player.media_play": _svc("media_player.media_play"),
        "media_player.media_pause": _svc("media_player.media_pause"),
        "media_player.media_stop": _svc("media_player.media_stop"),
        "media_player.volume_set": _svc("media_player.volume_set", {"volume_level": _arg("float", 0, 1, required=True)}),
        "media_player.select_source": _svc("media_player.select_source", {"source": _arg("str", 1, 120, required=True)}),
    },
    "number": {"number.set_value": _svc("number.set_value", {"value": _arg("float", -1e9, 1e9, required=True)})},
    "select": {"select.select_option": _svc("select.select_option", {"option": _arg("str", 1, 80, required=True)})},
}
SCHEDULE_ACTION_SERVICES: frozenset[str] = frozenset(s for c in SCHEDULE_ACTIONS.values() for s in c)
SERVICE_ARGS: dict[str, dict[str, dict[str, Any]]] = {s: spec["args"] for c in SCHEDULE_ACTIONS.values() for s, spec in c.items()}
SERVICE_EXCLUSIVE: dict[str, list[list[str]]] = {s: spec["exclusive"] for c in SCHEDULE_ACTIONS.values() for s, spec in c.items()}

# The services a bridge OLDER than 0.6.1 refuses in a schedule (its allow-list stops at the original eight classes): a new or changed action
# on one of them is refused with `bridge_too_old_for_action` until the bridge is updated (tests/test_schedules_more_actions.py lists them).
NEWER_BRIDGE = "0.6.1"
NEWER_BRIDGE_SERVICES: frozenset[str] = frozenset({
    "cover.open_cover_tilt", "cover.close_cover_tilt", "climate.set_swing_mode", "climate.set_humidity", "script.turn_on", "scene.turn_on",
    "input_boolean.turn_on", "input_boolean.turn_off", "input_number.set_value", "input_select.select_option", "humidifier.set_humidity", "humidifier.set_mode",
    "vacuum.start", "vacuum.return_to_base",
    # the 2026-10-04 follow-up: the same (still unreleased) bridge 0.6.1 takes these too
    "siren.turn_on", "siren.turn_off", "media_player.turn_on", "media_player.turn_off", "media_player.media_play", "media_player.media_pause",
    "media_player.media_stop", "media_player.volume_set", "media_player.select_source", "number.set_value", "select.select_option",
})

# Capability discovery (never invent one): the entity feature bit Home Assistant reports for a service (`<Domain>EntityFeature`), and an
# attribute whose presence proves the same thing. A service without a bit is offered whenever its class is.
FEATURE_BITS: dict[str, int] = {
    "cover.open_cover": 1, "cover.close_cover": 2, "cover.set_cover_position": 4, "cover.stop_cover": 8, "cover.open_cover_tilt": 16, "cover.close_cover_tilt": 32,
    "cover.set_cover_tilt_position": 128, "climate.set_temperature": 1 | 2, "climate.set_humidity": 4, "climate.set_fan_mode": 8, "climate.set_preset_mode": 16,
    "climate.set_swing_mode": 32, "fan.set_percentage": 1, "humidifier.set_mode": 1, "vacuum.start": 8192, "vacuum.return_to_base": 16,
    # SirenEntityFeature: TURN_ON 1, TURN_OFF 2 (TONES 4, VOLUME_SET 8, DURATION 16 gate the arguments - ARG_BITS)
    "siren.turn_on": 1, "siren.turn_off": 2,
    # MediaPlayerEntityFeature: PAUSE 1, VOLUME_SET 4, TURN_ON 128, TURN_OFF 256, SELECT_SOURCE 2048, STOP 4096, PLAY 16384
    "media_player.media_pause": 1, "media_player.volume_set": 4, "media_player.turn_on": 128, "media_player.turn_off": 256, "media_player.select_source": 2048,
    "media_player.media_stop": 4096, "media_player.media_play": 16384,
}
# an optional argument the entity must report by its own feature bit (a siren's tone, volume and duration)
ARG_BITS: dict[tuple[str, str], int] = {("siren.turn_on", "tone"): 4, ("siren.turn_on", "volume_level"): 8, ("siren.turn_on", "duration"): 16}
FEATURE_EVIDENCE: dict[str, str] = {
    "cover.set_cover_position": "current_position", "cover.set_cover_tilt_position": "current_tilt_position", "climate.set_fan_mode": "fan_modes",
    "climate.set_preset_mode": "preset_modes", "climate.set_swing_mode": "swing_modes", "humidifier.set_mode": "available_modes",
    "media_player.select_source": "source_list",
}
# A NEW action on one of these needs positive evidence (the bit or the attribute). The others predate capability discovery: with no feature
# bits reported at all (0 in the mirror) they keep working as before; with bits reported, a missing bit refuses them too.
STRICT_CAPABILITY: frozenset[str] = NEWER_BRIDGE_SERVICES | {"cover.set_cover_position", "cover.set_cover_tilt_position"}


def service_capable(service: str, entity: dict[str, Any] | None, *, strict: bool | None = None) -> bool:
    """Whether the entity really offers `service`: its feature bit, or the attribute that proves it. `strict` (default: the service is in
    STRICT_CAPABILITY) refuses when the entity reports no feature bits at all; otherwise "nothing reported" is not a refusal."""
    bit = FEATURE_BITS.get(service)
    if bit is None or entity is None:
        return True
    feats = int(entity.get("supported_features") or 0)
    if feats & bit:
        return True
    attr = FEATURE_EVIDENCE.get(service)
    value = (entity.get("attributes") or {}).get(attr) if attr else None
    if value is not None and value != []:
        return True
    if strict is None:
        strict = service in STRICT_CAPABILITY
    return feats == 0 and not strict


def arg_capable(service: str, arg: str, entity: dict[str, Any] | None) -> bool:
    """Whether an optional argument is something the entity can take: a light's brightness (not an on/off-only light), a fan's speed."""
    if entity is None:
        return True
    attrs = entity.get("attributes") or {}
    if service == "light.turn_on" and arg in ("brightness", "brightness_pct"):
        modes = attrs.get("supported_color_modes")
        return not (isinstance(modes, list) and modes and all(m == "onoff" for m in modes))
    if service == "fan.turn_on" and arg == "percentage":
        feats = int(entity.get("supported_features") or 0)
        return feats == 0 or bool(feats & 1)
    bit = ARG_BITS.get((service, arg))
    if bit is not None:  # a siren's tone / volume / duration: only what the siren itself reports (never "nothing reported = yes")
        if not int(entity.get("supported_features") or 0) & bit:
            return False
        return arg != "tone" or bool(siren_tones(entity))
    return True


def siren_tones(entity: dict[str, Any] | None) -> list[str]:
    """The tones a siren offers (`available_tones`: a list, or a mapping of tone id -> name - the id is what `tone` takes)."""
    raw = ((entity or {}).get("attributes") or {}).get("available_tones")
    if isinstance(raw, dict):
        return [str(k) for k in raw if isinstance(k, (str, int)) and not isinstance(k, bool)]
    if isinstance(raw, list):
        return [str(v) for v in raw if isinstance(v, (str, int)) and not isinstance(v, bool)]
    return []


def is_sensitive(cls: str | None, entity: dict[str, Any] | None = None) -> bool:
    """A sensitive action: an alarm / lock / door class, or a script / scene that drives one (or whose effects are not known)."""
    if cls in SENSITIVE_CLASSES:
        return True
    return bool(cls in ITEM_CLASSES and entity and entity.get("sensitive"))


# alarm service -> the alarm section's arm-mode name (services/alarm.ARM_MODES)
ARM_MODE_OF = {f"alarm_control_panel.alarm_{m}": m for m in ("arm_home", "arm_away", "arm_night", "arm_vacation", "arm_custom_bypass")}

ARG_LABELS = {
    "temperature": "טמפרטורה", "brightness": "בהירות", "brightness_pct": "בהירות באחוזים", "position": "מיקום", "tilt_position": "מיקום הטיה",
    "hvac_mode": "מצב פעולה", "fan_mode": "מצב מאוורר", "preset_mode": "מצב מוגדר מראש", "percentage": "עוצמה",
    "swing_mode": "מצב נדנוד", "humidity": "לחות", "mode": "מצב", "value": "ערך", "option": "אפשרות", "variables": "משתני הסקריפט",
    "tone": "צליל", "duration": "משך (שניות)", "volume_level": "עוצמה", "source": "מקור",
}


def arg_label(name: str) -> str:
    return ARG_LABELS.get(name, name)


# ---------------------------------------------------------------- entities

def is_scheduler_entity(entity_id: str, platform: str | None) -> bool:
    """A schedule's own switch (platform `scheduler`, V-LIVE; before the first registry refresh - platform unknown - the
    `switch.schedule_` prefix): never a device to schedule."""
    if platform == "scheduler":
        return True
    return platform is None and entity_id.startswith("switch.schedule_")


def classify_entity(entity: dict[str, Any], *, on_door_layer: bool, alarm_managed: bool) -> tuple[str | None, str | None]:
    """(class, refusal code) of a mirrored entity (`entity_id`, `domain`, `device_class`, `platform`), §5.1. The class is
    None when the entity can never be scheduled; the refusal code then says why (`alarm_managed_control`, `action_not_allowed`)."""
    eid, domain, dclass = entity["entity_id"], entity["domain"], entity.get("device_class") or ""
    if is_scheduler_entity(eid, entity.get("platform")):
        return None, "action_not_allowed"
    if domain in ("switch", "select") and alarm_managed:
        return None, "alarm_managed_control"
    if domain == "alarm_control_panel":
        return "alarm", None
    if domain == "lock":
        return "lock", None
    if domain == "cover":
        return ("door" if (on_door_layer or dclass in DOOR_COVER_CLASSES) else "cover"), None
    if domain == "light":
        return "light", None
    if domain == "climate":
        return "climate", None
    if domain == "fan":
        return "fan", None
    if domain == "switch":
        if on_door_layer:
            return "door", None
        return "switch", None  # CR-019: the group-action protection mark never gates a schedule
    if domain == "button" and on_door_layer:
        return "door", None
    if domain == "script":
        return "script", None
    if domain == "scene":
        return "scene", None
    if domain in ("input_boolean", "input_number", "input_select"):
        return "helper", None
    if domain == "humidifier":
        return "humidifier", None
    if domain == "vacuum":
        return "vacuum", None
    if domain == "siren":
        return "siren", None
    if domain == "media_player":
        return "media", None  # the caller (schedule_view.Ctx) narrows it to an approved, visible device of the multimedia settings
    if domain in ("number", "select"):
        if entity.get("entity_category"):
            return None, "action_not_allowed"  # a device's configuration / diagnostic value is never a schedule action
        return domain, None
    return None, "action_not_allowed"


def service_allowed(cls: str | None, service: str, entity_id: str | None = None) -> bool:
    """The class offers the service - and, given the entity, the service is of the entity's own domain (a class spans several domains: the
    helpers, the door layer's covers / switches / buttons; the bridge refuses a service on another domain's entity)."""
    if cls is None or service not in SCHEDULE_ACTIONS.get(cls, {}):
        return False
    return entity_id is None or service.split(".", 1)[0] == entity_id.split(".", 1)[0]


def is_lowering(service: str, cls: str | None, data: dict[str, Any], entity: dict[str, Any] | None = None) -> bool:
    """§5.3: an action that removes protection - disarm, unlock, and on the door class opening / driving / pressing; a script / scene whose
    known steps disarm, unlock or open a door (read from the automations mirror: `entity["lowering"]`)."""
    if service == LOWERING_ARM_OFF or service == "lock.unlock":
        return True
    if cls in ITEM_CLASSES:
        return bool(entity and entity.get("lowering"))
    if cls != "door":
        return False
    if service == "cover.open_cover":
        return True
    if service == "cover.set_cover_position":
        try:
            return float(data.get("position", 0)) > 0
        except (TypeError, ValueError):
            return True
    return service in ("switch.turn_on", "switch.turn_off", "button.press")


# ---------------------------------------------------------------- arguments

def contains_code(value: Any, depth: int = 0) -> bool:
    """A code / PIN / password key at any depth of a (service data) structure - stored schedules must never carry one."""
    if depth > 8:
        return True  # nothing legitimate nests this deep: treat as suspicious
    if isinstance(value, dict):
        return any((isinstance(k, str) and k.lower() in _CODE_KEYS) or contains_code(v, depth + 1) for k, v in value.items())
    if isinstance(value, (list, tuple)):
        return any(contains_code(v, depth + 1) for v in value)
    return False


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return float(value)


def check_arguments(service: str, data: dict[str, Any], entity: dict[str, Any] | None = None, *, dynamic: bool = True) -> tuple[list[dict[str, str]], dict[str, Any]]:
    """Validate a service's argument values (§5.2 types / ranges; with `dynamic` also §5.4: the entity's own modes and
    ranges). Returns (problems, cleaned data). A problem is `{"code", "message", "arg"}`; codes: `code_not_allowed`,
    `argument_not_allowed`, `required`, `out_of_range`, `invalid_value`, `argument_conflict`."""
    problems: list[dict[str, str]] = []
    if contains_code(data):
        return [{"code": "code_not_allowed", "message": "אסור לשמור קוד בתוך תזמון.", "arg": "code"}], {}
    specs = SERVICE_ARGS.get(service, {})
    cleaned: dict[str, Any] = {}
    for name, value in (data or {}).items():
        spec = specs.get(name)
        if spec is None:
            problems.append({"code": "argument_not_allowed", "message": f"ארגומנט לא מאושר: {name}", "arg": name})
            continue
        kind = spec["type"]
        if kind in ("int", "float"):
            num = _number(value)
            if num is None or (kind == "int" and num != int(num)):
                problems.append({"code": "invalid_value", "message": f"{arg_label(name)} חייב להיות מספר{' שלם' if kind == 'int' else ''}.", "arg": name})
                continue
            lo, hi = spec.get("min"), spec.get("max")
            if name == "temperature":
                lo, hi = _temperature_range(entity if dynamic else None)
            elif dynamic and entity is not None and name in ("value", "humidity"):
                lo, hi = _entity_range(entity, name, lo, hi)
            elif dynamic and entity is not None and name == "volume_level":
                ceiling = _number(entity.get("volume_ceiling"))
                if ceiling is not None:
                    hi = min(hi if hi is not None else 1.0, ceiling)  # the multimedia volume ceiling of the device (CR-016 10.1), never above it
            if lo is not None and hi is not None and not lo <= num <= hi:
                problems.append({"code": "out_of_range", "message": f"{arg_label(name)} מחוץ לטווח {_fmt(lo)}–{_fmt(hi)}.", "arg": name})
                continue
            if dynamic and entity is not None and name == "value" and not _on_step(entity, num):
                step = _number((entity.get("attributes") or {}).get("step")) or 1
                problems.append({"code": "out_of_range", "message": f"{arg_label(name)}: רק בקפיצות של {_fmt(step)}.", "arg": name})
                continue
            cleaned[name] = int(num) if kind == "int" or (isinstance(value, int) and not isinstance(value, bool)) else value
        elif kind == "enum":
            choices = list(spec["choices"])
            if not isinstance(value, str) or value not in choices:
                problems.append({"code": "invalid_value", "message": f"{arg_label(name)}: ערך לא מוכר.", "arg": name})
                continue
            if name == "hvac_mode" and dynamic:
                offered = _attr_list(entity, "hvac_modes")
                if offered is not None and value not in offered:
                    problems.append({"code": "invalid_value", "message": "המזגן אינו תומך במצב הפעולה הזה.", "arg": name})
                    continue
            cleaned[name] = value
        elif kind == "str":
            lo, hi = int(spec.get("min", 1)), int(spec.get("max", 40))
            if not isinstance(value, str) or not lo <= len(value.strip()) <= hi or any(ord(c) < 32 or ord(c) == 127 for c in value):
                problems.append({"code": "invalid_value", "message": f"{arg_label(name)}: טקסט באורך {lo}–{hi} תווים.", "arg": name})
                continue
            value = value.strip()
            if dynamic:
                offered = (siren_tones(entity) or None) if name == "tone" else _attr_list(entity, OFFERED_LIST.get(name, ""))
                if name == "source" and entity is not None:
                    hidden = set(entity.get("hidden_sources") or [])  # a source the multimedia administrator hid is never a schedule's value
                    offered = [s for s in (offered or []) if s not in hidden]
                if offered is not None and value not in offered:
                    problems.append({"code": "invalid_value", "message": f"{arg_label(name)}: ערך שההתקן אינו מציע.", "arg": name})
                    continue
            cleaned[name] = value
        elif kind == "vars":
            bad = _check_vars(value, entity if dynamic else None, dynamic)
            if bad:
                problems.append({**bad, "arg": name})
                continue
            cleaned[name] = dict(value)
        else:  # an unknown spec type is never accepted
            problems.append({"code": "argument_not_allowed", "message": f"ארגומנט לא מאושר: {name}", "arg": name})
    if dynamic and entity is not None:
        for name in list(cleaned):
            if not arg_capable(service, name, entity):
                problems.append({"code": "argument_not_allowed", "message": f"{arg_label(name)}: ההתקן אינו תומך בכך.", "arg": name})
                cleaned.pop(name, None)
        if service == "script.turn_on":
            fields = entity.get("script_fields")
            given = (data or {}).get("variables") if isinstance((data or {}).get("variables"), dict) else {}
            for key, f in (fields or {}).items():
                if f.get("required") and "default" not in f and key not in given:
                    problems.append({"code": "required", "message": f"חסר משתנה חובה של הסקריפט: {f.get('name') or key}", "arg": "variables"})
    if service in SERVICE_ARGS:
        for name, spec in specs.items():
            if spec.get("required") and name not in (data or {}):
                problems.append({"code": "required", "message": f"חסר ארגומנט: {arg_label(name)}", "arg": name})
        for group in SERVICE_EXCLUSIVE.get(service, []):
            if sum(1 for n in group if n in (data or {})) > 1:
                problems.append({"code": "argument_conflict", "message": "אי אפשר לציין גם " + " וגם ".join(arg_label(n) for n in group) + ".", "arg": group[0]})
    if dynamic and service == "cover.set_cover_position" and entity is not None:
        attrs = entity.get("attributes") or {}
        if attrs.get("current_position") is None and not int(entity.get("supported_features") or 0) & 4:
            problems.append({"code": "argument_not_allowed", "message": "התריס אינו תומך בקביעת מיקום.", "arg": "position"})
    return problems, cleaned


def _fmt(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else str(v)


def _temperature_range(entity: dict[str, Any] | None) -> tuple[float, float]:
    attrs = (entity or {}).get("attributes") or {}
    lo, hi = _number(attrs.get("min_temp")), _number(attrs.get("max_temp"))
    return (lo if lo is not None else 5.0, hi if hi is not None else 35.0)


OFFERED_LIST = {"fan_mode": "fan_modes", "preset_mode": "preset_modes", "swing_mode": "swing_modes", "mode": "available_modes", "option": "options", "source": "source_list"}


def _on_step(entity: dict[str, Any], value: float) -> bool:
    """An input_number's / number's value on its own grid (`min` + k x `step`); no step reported = any value in range."""
    attrs = entity.get("attributes") or {}
    step, lo = _number(attrs.get("step")), _number(attrs.get("min"))
    if not step or step <= 0:
        return True
    k = (value - (lo or 0.0)) / step
    return abs(k - round(k)) < 1e-6


def _entity_range(entity: dict[str, Any], name: str, lo: float | None, hi: float | None) -> tuple[float | None, float | None]:
    """The entity's own bounds: an input_number's `min` / `max`, a humidifier's / climate's `min_humidity` / `max_humidity`."""
    attrs = entity.get("attributes") or {}
    keys = ("min", "max") if name == "value" else ("min_humidity", "max_humidity")
    a, b = _number(attrs.get(keys[0])), _number(attrs.get(keys[1]))
    return (a if a is not None else lo, b if b is not None else hi)


def _check_vars(value: Any, entity: dict[str, Any] | None, dynamic: bool) -> dict[str, str] | None:
    """A script's `variables`: a flat object of at most MAX_VARS plain values (text, number, true / false), keys like Home Assistant's
    field keys, never a code. With `dynamic` (a new or changed action) every key must be one of the script's own fields as the mirror knows
    them (`entity["script_fields"]`, None = unknown: no variables at all) and every value must fit that field's selector."""
    if not isinstance(value, dict) or len(value) > MAX_VARS:
        return {"code": "invalid_value", "message": f"משתני הסקריפט: עד {MAX_VARS} ערכים."}
    for k, v in value.items():
        if not isinstance(k, str) or not VAR_KEY.match(k) or k.lower() in _CODE_KEYS:
            return {"code": "argument_not_allowed", "message": f"משתנה לא מאושר: {k}"}
        if isinstance(v, str):
            if len(v) > MAX_VAR_TEXT or any(ord(c) < 32 or ord(c) == 127 for c in v):
                return {"code": "invalid_value", "message": f"{k}: טקסט של עד {MAX_VAR_TEXT} תווים."}
        elif isinstance(v, bool):
            pass
        elif _number(v) is None:
            return {"code": "invalid_value", "message": f"{k}: ערך פשוט בלבד (טקסט, מספר, כן / לא)."}
    if not dynamic:
        return None
    fields = (entity or {}).get("script_fields")
    if value and fields is None:
        return {"code": "argument_not_allowed", "message": "המשתנים של הסקריפט אינם ידועים למערכת; אפשר להפעיל אותו בלי משתנים."}
    for k, v in value.items():
        f = (fields or {}).get(k)
        if f is None:
            return {"code": "argument_not_allowed", "message": f"לסקריפט אין משתנה בשם {k}."}
        label, kind = f.get("name") or k, f.get("kind")
        if kind == "number":
            num = _number(v)
            if num is None or (f.get("min") is not None and num < f["min"]) or (f.get("max") is not None and num > f["max"]):
                return {"code": "out_of_range", "message": f"{label}: מחוץ לטווח {_fmt(f.get('min', 0))}–{_fmt(f.get('max', 0))}."}
        elif kind == "boolean":
            if not isinstance(v, bool):
                return {"code": "invalid_value", "message": f"{label}: כן / לא."}
        elif kind == "select":
            if v not in (f.get("options") or []):
                return {"code": "invalid_value", "message": f"{label}: ערך שהסקריפט אינו מציע."}
        elif kind == "text":
            if not isinstance(v, str) or (f.get("max") is not None and len(v) > int(f["max"])):
                return {"code": "invalid_value", "message": f"{label}: טקסט באורך מתאים."}
        else:
            return {"code": "argument_not_allowed", "message": f"{label}: סוג משתנה שהמערכת אינה מציגה."}
    return None


def _attr_list(entity: dict[str, Any] | None, key: str) -> list[str] | None:
    value = ((entity or {}).get("attributes") or {}).get(key) if key else None
    return [v for v in value if isinstance(v, str)] if isinstance(value, list) and value else None


# ---------------------------------------------------------------- times (§2.2)

_FIXED = re.compile(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$")
_SUN = re.compile(r"^(sunrise|sunset)(?:([+-])(\d{1,2}):(\d{2})(?::(\d{2}))?)?$")


def parse_time(raw: Any) -> dict[str, Any] | None:
    """`HH:MM[:SS]` or `sunrise|sunset[(+|-)HH:MM[:SS]]` -> `{"kind": "fixed", "time": "HH:MM", "raw"}` /
    `{"kind": "sun", "event", "offset_min", "raw"}`; None when it is neither (or out of range)."""
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    m = _FIXED.match(text)
    if m:
        h, mi, s = int(m.group(1)), int(m.group(2)), int(m.group(3) or 0)
        if h > 23 or mi > 59 or s > 59:
            return None
        return {"kind": "fixed", "time": f"{h:02d}:{mi:02d}", "raw": raw, "seconds": h * 3600 + mi * 60 + s}
    m = _SUN.match(text)
    if m:
        sign = -1 if m.group(2) == "-" else 1
        h, mi, s = int(m.group(3) or 0), int(m.group(4) or 0), int(m.group(5) or 0)
        if mi > 59 or s > 59 or h > 23:
            return None
        return {"kind": "sun", "event": m.group(1), "offset_min": sign * (h * 60 + mi + s // 60), "raw": raw, "offset_seconds": sign * (h * 3600 + mi * 60 + s)}
    return None


def canonical_time(raw: str) -> str | None:
    """The stored form of a time: `HH:MM:SS`, or `sunrise|sunset+HH:MM:SS` (`-` for a negative offset)."""
    spec = parse_time(raw)
    if spec is None:
        return None
    if spec["kind"] == "fixed":
        s = spec["seconds"]
        return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"
    off = spec["offset_seconds"]
    a = abs(off)
    return f"{spec['event']}{'-' if off < 0 else '+'}{a // 3600:02d}:{a % 3600 // 60:02d}:{a % 60:02d}"
