"""Schedule policy for `smplwise_bridge.schedule` (CR-014, bridge 0.3.0; more actions in 0.6.1): what the bridge accepts for the scheduler
component, decided WITHOUT trusting the add-on. Dependency-free (standard library only) so the same functions run inside
Home Assistant Core and in plain unit tests, like `signing.py`.

The add-on validates the same rules first (services/schedule_policy.py, services/schedule_model.py); this module is
the independent second check that makes the bridge real defence in depth: a schema with closed key sets and caps, an
allow-list of (domain, service) pairs with typed arguments, no code or PIN anywhere in the payload, and the rule
that lock / alarm / button actions and door-class covers must be declared `sensitive`.

Pure functions: they never read Home Assistant state. The caller (schedule_service.py) supplies the entity's
attributes where a fact about the live entity matters.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import date
from typing import Any, Mapping

# ---------------------------------------------------------------- operations and message shape

OPS = frozenset({"add", "edit", "remove", "copy", "run", "enable", "disable"})
# ops that need the schedule's own switch entity and its component id
OPS_ON_EXISTING = frozenset({"edit", "remove", "copy", "run", "enable", "disable"})

# the signed message; anything else is refused (the signature covers every key, so an unknown key is never innocent)
MESSAGE_KEYS = frozenset({
    "user_id", "op", "request_id", "schedule_id", "schedule_entity_id", "payload", "name", "time", "skip_conditions",
    "sensitive", "ts", "nonce", "sig",
})

# ---------------------------------------------------------------- closed schemas (contract 8.3 item 3)

TOP_KEYS = frozenset({"weekdays", "start_date", "end_date", "timeslots", "repeat_type", "name", "tags"})
SLOT_KEYS = frozenset({"start", "stop", "conditions", "condition_type", "track_conditions", "actions"})
ACTION_KEYS = frozenset({"service", "entity_id", "service_data"})
CONDITION_KEYS = frozenset({"entity_id", "attribute", "value", "match_type"})

WEEKDAY_TOKENS = frozenset({"sun", "mon", "tue", "wed", "thu", "fri", "sat", "daily", "workday", "weekend"})
REPEAT_TYPES = frozenset({"repeat", "pause", "single"})
CONDITION_TYPES = frozenset({"and", "or"})
MATCH_TYPES = frozenset({"is", "not", "above", "below"})

# caps (contract 3.19)
MAX_NAME = 80
MAX_SLOTS = 48
MAX_ACTIONS_PER_SLOT = 20
MAX_CONDITIONS = 10
MAX_ENTITIES = 50
MAX_TAGS = 10
MAX_TAG_LEN = 40
MAX_DATA_KEYS = 8
MAX_CONDITION_VALUE = 100
MAX_DEPTH = 8  # nesting guard for the "no code at any depth" walk

_HMS = r"(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d"
# Phase-0 write verification (lab, real component): a fixed time is accepted as HH:MM:SS and as HH:MM (stored as sent);
# a sun time only as sunrise|sunset +/- HH:MM:SS (a bare "sunset" or "sunset+30" is refused by the component).
FIXED_TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$")
SUN_TIME_RE = re.compile(rf"^(?:sunrise|sunset)[+-]{_HMS}$")
ENTITY_ID_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
SCHEDULE_ENTITY_RE = re.compile(r"^switch\.[a-z0-9_]{1,100}$")
SCHEDULE_ID_RE = re.compile(r"^[0-9A-Za-z_-]{1,64}$")
ATTRIBUTE_RE = re.compile(r"^[a-z_][a-z0-9_]{0,63}$")
REQUEST_ID_RE = re.compile(r"^.{1,80}$", re.DOTALL)
_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")

# a key with one of these names anywhere inside the payload is a stored secret: HA keeps service_data in clear text
FORBIDDEN_KEYS = frozenset({"code", "alarm_code", "pin", "pin_code", "password", "passcode"})

HVAC_MODES = ("off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only")

# 0.6.1: a script's `variables` - a flat object of plain values (no code key: find_forbidden_key walks it too)
MAX_VARS = 10
MAX_VAR_TEXT = 200
VAR_KEY_RE = re.compile(r"^[a-z_][a-z0-9_]{0,63}$")

# ---------------------------------------------------------------- the allow-list (contract 5.2)


@dataclass(frozen=True)
class Arg:
    """One service argument: type `int` / `float` / `enum` / `str`, bounds or choices, required or optional."""

    name: str
    type: str
    lo: float | None = None
    hi: float | None = None
    choices: tuple[str, ...] = ()
    required: bool = False

    def as_spec(self) -> dict[str, Any]:
        spec: dict[str, Any] = {"name": self.name, "type": self.type, "required": self.required}
        if self.type in ("int", "float"):
            spec["min"], spec["max"] = self.lo, self.hi
        elif self.type == "enum":
            spec["choices"] = list(self.choices)
        elif self.type == "str":
            spec["min_len"], spec["max_len"] = int(self.lo or 0), int(self.hi or 0)
        return spec


def _a(name: str, typ: str, lo: float | None = None, hi: float | None = None, *, required: bool = False, choices: tuple[str, ...] = ()) -> Arg:
    return Arg(name, typ, lo, hi, choices, required)


# service id -> its arguments. Everything not listed here is refused with `service_not_allowed`.
ACTION_ARGS: dict[str, tuple[Arg, ...]] = {
    "light.turn_on": (_a("brightness", "int", 0, 255), _a("brightness_pct", "int", 1, 100)),
    "light.turn_off": (),
    "switch.turn_on": (),
    "switch.turn_off": (),
    "cover.open_cover": (),
    "cover.close_cover": (),
    "cover.stop_cover": (),
    "cover.set_cover_position": (_a("position", "int", 0, 100, required=True),),
    "cover.set_cover_tilt_position": (_a("tilt_position", "int", 0, 100, required=True),),
    "climate.set_hvac_mode": (_a("hvac_mode", "enum", choices=HVAC_MODES, required=True),),
    "climate.set_temperature": (_a("temperature", "float", 5, 35, required=True), _a("hvac_mode", "enum", choices=HVAC_MODES)),
    "climate.set_fan_mode": (_a("fan_mode", "str", 1, 40, required=True),),
    "climate.set_preset_mode": (_a("preset_mode", "str", 1, 40, required=True),),
    "climate.turn_off": (),
    "fan.turn_on": (_a("percentage", "int", 1, 100),),
    "fan.turn_off": (),
    "fan.set_percentage": (_a("percentage", "int", 0, 100, required=True),),
    # sensitive classes: no arguments, never a code
    "alarm_control_panel.alarm_arm_home": (),
    "alarm_control_panel.alarm_arm_away": (),
    "alarm_control_panel.alarm_arm_night": (),
    "alarm_control_panel.alarm_arm_vacation": (),
    "alarm_control_panel.alarm_arm_custom_bypass": (),
    "alarm_control_panel.alarm_disarm": (),
    "lock.lock": (),
    "lock.unlock": (),
    # the door layer's buttons (a plain button is not schedulable; the add-on decides which are door buttons)
    "button.press": (),
    # 0.6.1 (schedules: more actions): tilt, swing / humidity, scripts (variables only), scenes, helpers, humidifiers, vacuums. The add-on
    # judges each against the entity's own capabilities first; here the shapes and ranges are checked again without trusting it.
    "cover.open_cover_tilt": (),
    "cover.close_cover_tilt": (),
    "climate.set_swing_mode": (_a("swing_mode", "str", 1, 40, required=True),),
    "climate.set_humidity": (_a("humidity", "int", 0, 100, required=True),),
    "script.turn_on": (_a("variables", "vars"),),
    "scene.turn_on": (),
    "input_boolean.turn_on": (),
    "input_boolean.turn_off": (),
    "input_number.set_value": (_a("value", "float", -1e9, 1e9, required=True),),
    "input_select.select_option": (_a("option", "str", 1, 80, required=True),),
    "humidifier.set_humidity": (_a("humidity", "int", 0, 100, required=True),),
    "humidifier.set_mode": (_a("mode", "str", 1, 40, required=True),),
    "vacuum.start": (),
    "vacuum.return_to_base": (),
    # 0.6.1, the same day's follow-up (owner: "add everything"): sirens (sensitive - the `sensitive` flag is required, SENSITIVE_DOMAINS), media
    # players (the add-on admits only an approved, visible multimedia device, what the player reports and the volume under its ceiling) and
    # number / select values (the entity's own range and options, judged by the add-on; the shape and the outer bounds again here)
    "siren.turn_on": (_a("tone", "str", 1, 80), _a("duration", "int", 1, 3600), _a("volume_level", "float", 0, 1)),
    "siren.turn_off": (),
    "media_player.turn_on": (),
    "media_player.turn_off": (),
    "media_player.media_play": (),
    "media_player.media_pause": (),
    "media_player.media_stop": (),
    "media_player.volume_set": (_a("volume_level", "float", 0, 1, required=True),),
    "media_player.select_source": (_a("source", "str", 1, 120, required=True),),
    "number.set_value": (_a("value", "float", -1e9, 1e9, required=True),),
    "select.select_option": (_a("option", "str", 1, 80, required=True),),
}

SCHEDULE_ACTION_SERVICES: frozenset[tuple[str, str]] = frozenset(tuple(sid.split(".", 1)) for sid in ACTION_ARGS)  # type: ignore[misc]

# arguments of which at most one may be present
EXCLUSIVE_ARGS: dict[str, tuple[frozenset[str], ...]] = {"light.turn_on": (frozenset({"brightness", "brightness_pct"}),)}

# actions whose domain alone makes the schedule sensitive; covers become sensitive by device_class (below)
SENSITIVE_DOMAINS = frozenset({"lock", "alarm_control_panel", "button", "siren"})
SENSITIVE_COVER_CLASSES = frozenset({"door", "garage", "gate"})


class PolicyError(Exception):
    """A refusal: `code` is the answer's `error`, `path` locates the offending element (`timeslots[0].actions[1]`)."""

    def __init__(self, code: str, path: str | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.path = path


@dataclass(frozen=True)
class ActionRef:
    """One validated action of a payload, for the caller's live-state checks."""

    path: str
    domain: str
    service: str
    entity_id: str


# ---------------------------------------------------------------- primitives


def _is_str(v: Any) -> bool:
    return isinstance(v, str)


def _is_int(v: Any) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def _is_number(v: Any) -> bool:
    return (isinstance(v, (int, float)) and not isinstance(v, bool)) and math.isfinite(float(v))


def _bad(path: str | None = None, code: str = "invalid_payload") -> PolicyError:
    return PolicyError(code, path)


def find_forbidden_key(node: Any, path: str = "payload", depth: int = 0) -> str | None:
    """Path of the first key named like a code / PIN at any depth (lists included), else None. Too deep = refuse."""
    if depth > MAX_DEPTH:
        return path
    if isinstance(node, Mapping):
        for k, v in node.items():
            if isinstance(k, str) and k.strip().lower() in FORBIDDEN_KEYS:
                return f"{path}.{k}"
            hit = find_forbidden_key(v, f"{path}.{k}", depth + 1)
            if hit:
                return hit
    elif isinstance(node, (list, tuple)):
        for i, v in enumerate(node):
            hit = find_forbidden_key(v, f"{path}[{i}]", depth + 1)
            if hit:
                return hit
    return None


def _closed(obj: Mapping[str, Any], allowed: frozenset[str], path: str) -> None:
    for k in obj:
        if not isinstance(k, str) or k not in allowed:
            raise _bad(f"{path}.{k}" if path else str(k))


def valid_time(value: Any, *, allow_sun: bool = True) -> bool:
    return _is_str(value) and bool(FIXED_TIME_RE.match(value) or (allow_sun and SUN_TIME_RE.match(value)))


def valid_entity_id(value: Any) -> bool:
    return _is_str(value) and len(value) <= 255 and bool(ENTITY_ID_RE.match(value))


def _valid_text(value: Any, max_len: int, *, min_len: int = 0) -> bool:
    return _is_str(value) and min_len <= len(value) <= max_len and not _CONTROL_RE.search(value)


def _valid_date(value: Any) -> bool:
    if not _is_str(value) or not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


# ---------------------------------------------------------------- arguments


def _check_arg(arg: Arg, value: Any, path: str) -> None:
    if arg.type == "int":
        ok = _is_int(value) and arg.lo <= value <= arg.hi  # type: ignore[operator]
    elif arg.type == "float":
        ok = _is_number(value) and arg.lo <= float(value) <= arg.hi  # type: ignore[operator]
    elif arg.type == "enum":
        ok = _is_str(value) and value in arg.choices
    elif arg.type == "str":
        ok = _valid_text(value, int(arg.hi or 0), min_len=int(arg.lo or 0))
    elif arg.type == "vars":
        ok = _valid_vars(value)
    else:  # unknown spec type: never accept
        ok = False
    if not ok:
        raise PolicyError("argument_not_allowed", path)


def _valid_vars(value: Any) -> bool:
    """0.6.1: a script's variables - at most MAX_VARS keys like field keys, each a plain value (text without control characters, a finite
    number, true / false). Nothing nested: a variable is never a structure a caller could smuggle a call through."""
    if not isinstance(value, Mapping) or len(value) > MAX_VARS:
        return False
    for k, v in value.items():
        if not (_is_str(k) and VAR_KEY_RE.match(k)):
            return False
        if isinstance(v, bool):
            continue
        if _is_str(v):
            if not _valid_text(v, MAX_VAR_TEXT):
                return False
        elif not _is_number(v):
            return False
    return True


def validate_service_data(service_id: str, data: Any, path: str) -> None:
    """Arguments of one action against its spec: known names only, types and ranges, required present, exclusive groups."""
    if not isinstance(data, Mapping):
        raise _bad(path)
    if len(data) > MAX_DATA_KEYS:
        raise PolicyError("argument_not_allowed", path)
    hit = find_forbidden_key(data, path)
    if hit:
        raise PolicyError("code_not_allowed", hit)
    specs = {a.name: a for a in ACTION_ARGS[service_id]}
    for key, value in data.items():
        if not isinstance(key, str) or key not in specs:
            raise PolicyError("argument_not_allowed", f"{path}.{key}")
        _check_arg(specs[key], value, f"{path}.{key}")
    for arg in specs.values():
        if arg.required and arg.name not in data:
            raise PolicyError("argument_not_allowed", f"{path}.{arg.name}")
    for group in EXCLUSIVE_ARGS.get(service_id, ()):
        if len(group & set(data)) > 1:
            raise PolicyError("argument_not_allowed", path)


# ---------------------------------------------------------------- payload pieces


def _validate_condition(cond: Any, path: str) -> None:
    if not isinstance(cond, Mapping):
        raise _bad(path)
    _closed(cond, CONDITION_KEYS, path)
    if not valid_entity_id(cond.get("entity_id")):
        raise _bad(f"{path}.entity_id")
    attribute = cond.get("attribute", "state")
    if not (_is_str(attribute) and ATTRIBUTE_RE.match(attribute)):
        raise _bad(f"{path}.attribute")
    match_type = cond.get("match_type", "is")
    if match_type not in MATCH_TYPES:
        raise _bad(f"{path}.match_type")
    value = cond.get("value")
    if match_type in ("above", "below"):
        numeric = _is_number(value)
        if not numeric and _is_str(value):
            try:
                numeric = math.isfinite(float(value))
            except ValueError:
                numeric = False
        if not numeric:
            raise _bad(f"{path}.value")
    elif not _valid_text(value, MAX_CONDITION_VALUE, min_len=1):
        raise _bad(f"{path}.value")


def _validate_action(action: Any, path: str) -> ActionRef:
    if not isinstance(action, Mapping):
        raise _bad(path)
    _closed(action, ACTION_KEYS, path)
    service_id = action.get("service")
    if not _is_str(service_id) or "." not in service_id:
        raise _bad(f"{path}.service")
    if service_id not in ACTION_ARGS:
        raise PolicyError("service_not_allowed", path)
    domain, service = service_id.split(".", 1)
    entity_id = action.get("entity_id")
    if not valid_entity_id(entity_id):
        raise _bad(f"{path}.entity_id")
    if entity_id.split(".", 1)[0] != domain:  # type: ignore[union-attr]
        raise _bad(f"{path}.entity_id")
    validate_service_data(service_id, action.get("service_data") or {}, f"{path}.service_data")
    return ActionRef(path, domain, service, entity_id)  # type: ignore[arg-type]


def _validate_slot(slot: Any, path: str) -> list[ActionRef]:
    if not isinstance(slot, Mapping):
        raise _bad(path)
    _closed(slot, SLOT_KEYS, path)
    if not valid_time(slot.get("start")):
        raise _bad(f"{path}.start")
    stop = slot.get("stop")
    if stop is not None and not valid_time(stop):
        raise _bad(f"{path}.stop")
    conditions = slot.get("conditions")
    if conditions is None:
        conditions = []
    if not isinstance(conditions, (list, tuple)) or len(conditions) > MAX_CONDITIONS:
        raise _bad(f"{path}.conditions")
    for i, cond in enumerate(conditions):
        _validate_condition(cond, f"{path}.conditions[{i}]")
    ctype = slot.get("condition_type")
    if ctype is not None and ctype not in CONDITION_TYPES:
        raise _bad(f"{path}.condition_type")
    track = slot.get("track_conditions")
    if track is not None and not isinstance(track, bool):
        raise _bad(f"{path}.track_conditions")
    actions = slot.get("actions")
    if not isinstance(actions, (list, tuple)) or not 1 <= len(actions) <= MAX_ACTIONS_PER_SLOT:
        raise _bad(f"{path}.actions")
    return [_validate_action(a, f"{path}.actions[{i}]") for i, a in enumerate(actions)]


def validate_payload(payload: Any, *, op: str) -> list[ActionRef]:
    """Validate the component payload of `add` / `edit` and return every action (so the caller can check the live
    entities). `add` needs the full shape, `edit` a non-empty subset of it (the component's `edit` replaces only the
    fields it is given; `timeslots` always whole)."""
    if not isinstance(payload, Mapping):
        raise _bad("payload")
    hit = find_forbidden_key(payload)
    if hit:
        raise PolicyError("code_not_allowed", hit)
    _closed(payload, TOP_KEYS, "payload")
    if not payload:
        raise _bad("payload")
    if op == "add":
        for key in ("weekdays", "timeslots", "repeat_type", "name"):
            if key not in payload:
                raise _bad(f"payload.{key}")
    if op == "edit":
        # The component's `edit` resets start_date / end_date to null when they are omitted (phase-0 verification): an
        # edit must name both, with the values it wants to keep (null clears), so a name-only edit can never wipe a season.
        for key in ("start_date", "end_date"):
            if key not in payload:
                raise PolicyError("dates_required", f"payload.{key}")
    if "weekdays" in payload:
        days = payload["weekdays"]
        if not isinstance(days, (list, tuple)) or not 1 <= len(days) <= 7 or len(set(map(str, days))) != len(days) or any(d not in WEEKDAY_TOKENS for d in days):
            raise _bad("payload.weekdays")
    for key in ("start_date", "end_date"):
        if payload.get(key) is not None and not _valid_date(payload[key]):
            raise _bad(f"payload.{key}")
    if payload.get("start_date") and payload.get("end_date") and payload["start_date"] > payload["end_date"]:
        raise _bad("payload.end_date")
    if "repeat_type" in payload and payload["repeat_type"] not in REPEAT_TYPES:
        raise _bad("payload.repeat_type")
    if "name" in payload:
        name = payload["name"]
        # add: a name is required; edit: an empty name is allowed (an unnamed schedule stays unnamed)
        if not _valid_text(name, MAX_NAME, min_len=1 if op == "add" else 0):
            raise _bad("payload.name")
    if "tags" in payload:
        tags = payload["tags"]
        if not isinstance(tags, (list, tuple)) or len(tags) > MAX_TAGS or any(not _valid_text(t, MAX_TAG_LEN, min_len=1) for t in tags):
            raise _bad("payload.tags")
    refs: list[ActionRef] = []
    if "timeslots" in payload:
        slots = payload["timeslots"]
        if not isinstance(slots, (list, tuple)) or not 1 <= len(slots) <= MAX_SLOTS:
            raise _bad("payload.timeslots")
        for i, slot in enumerate(slots):
            refs.extend(_validate_slot(slot, f"timeslots[{i}]"))
        if len({r.entity_id for r in refs}) > MAX_ENTITIES:
            raise _bad("payload.timeslots")
    return refs


def normalize_payload(payload: Mapping[str, Any]) -> dict[str, Any]:
    """The payload in the component's real write form (phase-0 verification): the component REJECTS null and empty
    values it reports back on read - `stop: null`, `conditions: []`, `condition_type: null` - so they are omitted when
    there is nothing to say (a slot without a stop, without conditions). Everything else is forwarded exactly as sent;
    in particular start_date / end_date, whose null is meaningful on an edit. Call after validation."""
    out = {k: v for k, v in payload.items() if k != "timeslots"}
    if "timeslots" in payload:
        slots = []
        for slot in payload["timeslots"]:
            s = {k: v for k, v in slot.items()}
            if s.get("stop") is None:
                s.pop("stop", None)
            if not s.get("conditions"):
                s.pop("conditions", None)
                if not s.get("track_conditions"):
                    s.pop("track_conditions", None)
            if s.get("condition_type") is None:
                s.pop("condition_type", None)
            slots.append(s)
        out["timeslots"] = slots
    return out


# ---------------------------------------------------------------- the whole message


def validate_message(msg: Mapping[str, Any]) -> list[ActionRef]:
    """Structural validation of a (signature-verified) `schedule` message; returns the actions of an add / edit.
    Raises PolicyError. Does not look at Home Assistant: entity existence, sensitivity, permissions and the registry
    checks belong to schedule_service.py."""
    for key in msg:
        if key not in MESSAGE_KEYS:
            raise _bad(str(key))
    op = msg.get("op")
    if op not in OPS:
        raise PolicyError("op_not_allowed", "op")
    if not _is_str(msg.get("user_id")) or not msg.get("user_id"):
        raise _bad("user_id")
    if not _is_str(msg.get("request_id")) or not REQUEST_ID_RE.match(msg["request_id"]):
        raise _bad("request_id")
    if not isinstance(msg.get("sensitive", False), bool):
        raise _bad("sensitive")
    if not isinstance(msg.get("skip_conditions", False), bool):
        raise _bad("skip_conditions")
    if msg.get("skip_conditions") and op != "run":
        raise _bad("skip_conditions")
    time_value = msg.get("time")
    if time_value is not None and (op != "run" or not valid_time(time_value, allow_sun=False)):
        raise _bad("time")
    name = msg.get("name")
    if op == "copy":
        if not _valid_text(name, MAX_NAME, min_len=1):
            raise _bad("name")
    elif name is not None:
        raise _bad("name")  # add / edit carry the name inside the payload
    if op in OPS_ON_EXISTING:
        if not (_is_str(msg.get("schedule_id")) and SCHEDULE_ID_RE.match(msg["schedule_id"])):
            raise _bad("schedule_id")
        if not (_is_str(msg.get("schedule_entity_id")) and SCHEDULE_ENTITY_RE.match(msg["schedule_entity_id"])):
            raise _bad("schedule_entity_id")
    elif msg.get("schedule_id") is not None or msg.get("schedule_entity_id") is not None:
        raise _bad("schedule_id")
    payload = msg.get("payload")
    if op in ("add", "edit"):
        return validate_payload(payload, op=op)
    if payload not in (None, {}):
        raise _bad("payload")
    return []


def sensitive_required(domain: str, service: str, attributes: Mapping[str, Any] | None) -> bool:
    """True when this action may only be sent with `sensitive: true`: locks, alarm panels, sirens (0.6.1), buttons (allowed only as
    door buttons), and covers that report a door / garage / gate device class. The bridge cannot see the map's door
    layer, so a door-layer switch or cover without such a class stays the add-on's flag to set (a flag set without need
    is harmless; a missing flag on what the bridge CAN recognise is refused)."""
    if domain in SENSITIVE_DOMAINS:
        return True
    if domain == "cover":
        device_class = (attributes or {}).get("device_class")
        return _is_str(device_class) and device_class.lower() in SENSITIVE_COVER_CLASSES
    return False
