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

ALL_CLASSES: tuple[str, ...] = ("light", "switch", "cover", "climate", "fan", "alarm", "lock", "door")
SENSITIVE_CLASSES = frozenset({"alarm", "lock", "door"})
DOOR_COVER_CLASSES = frozenset({"door", "garage", "gate"})  # = services/devices.DOOR_COVER_CLASSES (kept here: this module stays pure)

# a key that carries a code / secret anywhere inside a schedule: never stored (HA keeps service_data in clear text)
_CODE_KEYS = frozenset({"code", "alarm_code", "pin", "pin_code", "passcode", "password"})

LOWERING_ARM_OFF = "alarm_control_panel.alarm_disarm"


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
    },
    "climate": {
        "climate.set_hvac_mode": _svc("climate.set_hvac_mode", {"hvac_mode": _arg("enum", required=True, choices=ha_bridge.HVAC_MODES)}),
        "climate.set_temperature": _svc("climate.set_temperature", {"temperature": _arg("float", required=True), "hvac_mode": _arg("enum", choices=ha_bridge.HVAC_MODES)}),
        "climate.set_fan_mode": _svc("climate.set_fan_mode", {"fan_mode": _arg("str", 1, 40, required=True)}),
        "climate.set_preset_mode": _svc("climate.set_preset_mode", {"preset_mode": _arg("str", 1, 40, required=True)}),
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
}
SCHEDULE_ACTION_SERVICES: frozenset[str] = frozenset(s for c in SCHEDULE_ACTIONS.values() for s in c)
SERVICE_ARGS: dict[str, dict[str, dict[str, Any]]] = {s: spec["args"] for c in SCHEDULE_ACTIONS.values() for s, spec in c.items()}
SERVICE_EXCLUSIVE: dict[str, list[list[str]]] = {s: spec["exclusive"] for c in SCHEDULE_ACTIONS.values() for s, spec in c.items()}

# alarm service -> the alarm section's arm-mode name (services/alarm.ARM_MODES)
ARM_MODE_OF = {f"alarm_control_panel.alarm_{m}": m for m in ("arm_home", "arm_away", "arm_night", "arm_vacation", "arm_custom_bypass")}

ARG_LABELS = {
    "temperature": "טמפרטורה", "brightness": "בהירות", "brightness_pct": "בהירות באחוזים", "position": "מיקום", "tilt_position": "מיקום הטיה",
    "hvac_mode": "מצב פעולה", "fan_mode": "מצב מאוורר", "preset_mode": "מצב מוגדר מראש", "percentage": "עוצמה",
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


def classify_entity(entity: dict[str, Any], *, bulk_safe: bool, on_door_layer: bool, alarm_managed: bool) -> tuple[str | None, str | None]:
    """(class, refusal code) of a mirrored entity (`entity_id`, `domain`, `device_class`, `platform`), §5.1. The class is
    None when the entity can never be scheduled; the refusal code then says why (`switch_not_marked`,
    `alarm_managed_control`, `action_not_allowed`)."""
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
        return ("switch", None) if bulk_safe else (None, "switch_not_marked")
    if domain == "button" and on_door_layer:
        return "door", None
    return None, "action_not_allowed"


def service_allowed(cls: str | None, service: str) -> bool:
    return cls is not None and service in SCHEDULE_ACTIONS.get(cls, {})


def is_lowering(service: str, cls: str | None, data: dict[str, Any]) -> bool:
    """§5.3: an action that removes protection - disarm, unlock, and on the door class opening / driving / pressing."""
    if service == LOWERING_ARM_OFF or service == "lock.unlock":
        return True
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
            if lo is not None and hi is not None and not lo <= num <= hi:
                problems.append({"code": "out_of_range", "message": f"{arg_label(name)} מחוץ לטווח {_fmt(lo)}–{_fmt(hi)}.", "arg": name})
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
                offered = _attr_list(entity, {"fan_mode": "fan_modes", "preset_mode": "preset_modes"}.get(name, ""))
                if offered is not None and value not in offered:
                    problems.append({"code": "invalid_value", "message": f"{arg_label(name)}: ערך שההתקן אינו מציע.", "arg": name})
                    continue
            cleaned[name] = value
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
