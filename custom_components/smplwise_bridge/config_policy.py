"""Config policy for `smplwise_bridge.config_item` (CR-017, bridge 0.6.0): what the bridge accepts when it writes an automation, a script or a scene,
or runs one, decided WITHOUT trusting the add-on. Dependency-free (standard library only) so the same functions run inside Home Assistant Core and in
plain unit tests, like `signing.py` and `schedule_policy.py`.

The add-on validates the same rules first (services/automation_policy.py, services/automation_model.py); this module is the independent second check:

- the message: a closed key set per op, ids, the profile (`builder` | `code`), fingerprints, caps;
- the config (upsert): top-level keys per kind (new schema only), the closed schemas of the typed blocks (the JSON of AUTOMATIONS_API.md section 2.1),
  the builder service allow-list (a subset of ALLOWED_SERVICES plus scene / script / automation / notify; never homeassistant, shell_command, rest_command,
  hassio, recorder, smplwise_bridge or any `*.reload`), closed argument specs, no secret-like key and no `code` at any depth in anything that is authored;
- the rule that makes delegation safe (CR section 8.3): in the `builder` profile every block OUTSIDE the typed schemas must be byte-identical to a block of
  the item as it is stored now - its fingerprint is in the message's `preserved` list AND in the stored item - so a delegated user can keep, move or delete
  such a block but never author one. The `code` profile (an HA administrator only) is exempt from that rule, never from the secret rule;
- the sensitive flag: a config that calls an alarm, lock, siren or door-class cover service must declare `sensitive`.

Pure functions: they never read Home Assistant state. The caller (config_service.py) supplies the stored item and, where a fact about a live entity matters,
its attributes. `PolicyError.code` is the answer's `error`, `path` locates the offending element.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping

# ---------------------------------------------------------------- operations and the message

WRITE_OPS = frozenset({"upsert", "delete"})
RUNTIME_OPS = frozenset({"enable", "disable", "trigger", "run_script", "stop_script", "apply_scene"})
OPS = WRITE_OPS | RUNTIME_OPS  # `snapshot_scene` (slice C, CR section 14) is not in 0.6.0: it is refused as `op_not_allowed`
KINDS = ("automation", "script", "scene")
PROFILES = ("builder", "code")

COMMON_KEYS = frozenset({"user_id", "op", "request_id", "ts", "nonce", "sig"})
OP_KEYS: dict[str, frozenset[str]] = {
    "upsert": COMMON_KEYS | {"kind", "item_id", "base_revision", "profile", "config", "preserved", "sensitive"},
    "delete": COMMON_KEYS | {"kind", "item_id", "base_revision", "profile"},
    "enable": COMMON_KEYS | {"kind", "item_id"},
    "disable": COMMON_KEYS | {"kind", "item_id"},
    "trigger": COMMON_KEYS | {"kind", "item_id", "skip_condition", "variables"},
    "run_script": COMMON_KEYS | {"kind", "item_id", "variables"},
    "stop_script": COMMON_KEYS | {"kind", "item_id"},
    "apply_scene": COMMON_KEYS | {"entity_id"},
}
OP_KIND = {"enable": "automation", "disable": "automation", "trigger": "automation", "run_script": "script", "stop_script": "script"}

AUTOMATION_ID_RE = re.compile(r"^[0-9A-Za-z_-]{1,64}$")  # an automation / scene config id: any string (the HA frontend uses the epoch ms)
SCRIPT_KEY_RE = re.compile(r"^[a-z0-9_]{1,64}$")  # a script's object id (slug)
FINGERPRINT_RE = re.compile(r"^[0-9a-f]{16}$")
REVISION_RE = FINGERPRINT_RE
ENTITY_ID_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
SERVICE_RE = ENTITY_ID_RE
SCENE_ENTITY_RE = re.compile(r"^scene\.[a-z0-9_]{1,100}$")
REQUEST_ID_RE = re.compile(r"^.{1,80}$", re.DOTALL)
TIME_RE = re.compile(r"^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$")
_TEMPLATE_RE = re.compile(r"\{\{|\{%|\{#")

# caps (AUTOMATIONS_API.md section 2.2; the builder profile only - an administrator's code view is bounded by the size cap)
CAPS = {"alias": 120, "description": 1000, "triggers": 20, "conditions": 20, "steps": 60, "depth": 4, "targets": 50, "fields": 12, "members": 100, "options": 6, "preserved": 400}
MAX_CONFIG_BYTES = 262144
MAX_VARIABLES = 50
MAX_DEPTH = 24  # the nesting guard of every recursive walk

MODES = ("single", "restart", "queued", "parallel")
WEEKDAYS = ("sun", "mon", "tue", "wed", "thu", "fri", "sat")

# top-level keys per kind: the keys the builder models. Anything else is an "extra": carried from the stored item unchanged (builder) or free (code).
MANAGED_KEYS = {
    "automation": ("id", "alias", "description", "triggers", "conditions", "actions", "mode", "max"),
    "script": ("alias", "description", "icon", "mode", "max", "fields", "sequence"),
    "scene": ("id", "name", "icon", "entities"),
}
LEGACY_KEYS = {"automation": ("trigger", "condition", "action"), "script": (), "scene": ()}
CARRY_KEYS = ("alias", "metadata", "enabled")

# ---------------------------------------------------------------- secrets (CR section 9.3)

_SECRET_WORDS = frozenset({"password", "passwd", "token", "secret", "code", "pin", "apikey"})
_CAMEL_RE = re.compile(r"([a-z0-9])([A-Z])")


def _key_parts(key: str) -> list[str]:
    return [p for p in re.split(r"[^a-z0-9]+", _CAMEL_RE.sub(r"\1_\2", key).lower()) if p]


def is_secret_key(key: str) -> bool:
    parts = _key_parts(key)
    if any(p in _SECRET_WORDS for p in parts):
        return True
    return any(p == "api" and i + 1 < len(parts) and parts[i + 1] == "key" for i, p in enumerate(parts))


def secret_kind(v: Any, depth: int = 0) -> str | None:
    """`"code"` when some key at any depth is the alarm-code word, `"secret"` for another secret-like key, else None. Too deep = a secret (closed)."""
    found: str | None = None
    if depth > MAX_DEPTH:
        return "secret"
    if isinstance(v, list):
        for x in v:
            k = secret_kind(x, depth + 1)
            if k == "code":
                return "code"
            found = found or k
    elif isinstance(v, dict):
        for key, val in v.items():
            if isinstance(key, str) and is_secret_key(key):
                if "code" in _key_parts(key):
                    return "code"
                found = found or "secret"
            k = secret_kind(val, depth + 1)
            if k == "code":
                return "code"
            found = found or k
    return found


def has_template(v: Any) -> bool:
    if isinstance(v, str):
        return bool(_TEMPLATE_RE.search(v))
    if isinstance(v, list):
        return any(has_template(x) for x in v)
    if isinstance(v, dict):
        return any(has_template(x) for x in v.values())
    return False


# ---------------------------------------------------------------- canonical JSON, fingerprints, revisions (the SAME as the add-on's automation_model)

def _norm_numbers(x: Any) -> Any:
    if isinstance(x, float) and x.is_integer() and abs(x) < 1e21:
        return int(x)
    if isinstance(x, list):
        return [_norm_numbers(i) for i in x]
    if isinstance(x, dict):
        return {k: _norm_numbers(v) for k, v in x.items()}
    return x


def canonical_json(v: Any) -> str:
    return json.dumps(_norm_numbers(v), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def fingerprint_of(raw: Any) -> str:
    return hashlib.sha256(canonical_json(raw).encode("utf-8")).hexdigest()[:16]


revision_of = fingerprint_of


# ---------------------------------------------------------------- errors and primitives

class PolicyError(Exception):
    """A refusal: `code` is the answer's `error`, `path` locates the offending element (`config.actions[1]`)."""

    def __init__(self, code: str, path: str | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.path = path


def _bad(path: str | None = None, code: str = "invalid_payload") -> PolicyError:
    return PolicyError(code, path)


def _is_str(v: Any) -> bool:
    return isinstance(v, str)


def _is_num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(float(v))


def _is_entity(v: Any) -> bool:
    return isinstance(v, str) and len(v) <= 255 and bool(ENTITY_ID_RE.match(v))


def _to_list(v: Any) -> list[Any]:
    return [] if v is None else v if isinstance(v, list) else [v]


def _entity_list(v: Any) -> list[str] | None:
    arr = _to_list(v)
    return arr if all(_is_entity(x) for x in arr) else None


# ---------------------------------------------------------------- the allow-list (CR section 9.1) - the SAME services and closed arguments as the add-on's

@dataclass(frozen=True)
class Arg:
    """One service argument: type `int` / `float` / `enum` / `str` / `bool`, bounds or choices, required or optional."""

    name: str
    type: str
    lo: float | None = None
    hi: float | None = None
    choices: tuple[str, ...] = ()
    required: bool = False

    def as_spec(self) -> dict[str, Any]:
        spec: dict[str, Any] = {"type": self.type, "required": self.required}
        if self.lo is not None:
            spec["min"] = self.lo
        if self.hi is not None:
            spec["max"] = self.hi
        if self.type == "enum":
            spec["choices"] = list(self.choices)
        return spec


def _a(name: str, typ: str, lo: float | None = None, hi: float | None = None, *, required: bool = False, choices: tuple[str, ...] = ()) -> Arg:
    return Arg(name, typ, lo, hi, choices, required)


HVAC_MODES = ("off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only")

# device services of the builder -> their closed arguments. Every key is a (domain, service) of ALLOWED_SERVICES in __init__.py (a drift test holds it).
DEVICE_ACTIONS: dict[str, tuple[Arg, ...]] = {
    "light.turn_on": (_a("brightness_pct", "int", 0, 100), _a("color_temp_kelvin", "int", 1000, 10000), _a("transition", "float", 0, 300)),
    "light.turn_off": (_a("transition", "float", 0, 300),),
    "switch.turn_on": (), "switch.turn_off": (),
    "fan.turn_on": (_a("percentage", "int", 1, 100),), "fan.turn_off": (), "fan.set_percentage": (_a("percentage", "int", 0, 100, required=True),),
    "climate.turn_off": (),
    "climate.set_temperature": (_a("temperature", "float", -30, 120, required=True), _a("hvac_mode", "enum", choices=HVAC_MODES)),
    "climate.set_hvac_mode": (_a("hvac_mode", "enum", required=True, choices=HVAC_MODES),),
    "climate.set_fan_mode": (_a("fan_mode", "str", 1, 40, required=True),),
    "climate.set_preset_mode": (_a("preset_mode", "str", 1, 40, required=True),),
    "cover.open_cover": (), "cover.close_cover": (), "cover.stop_cover": (), "cover.set_cover_position": (_a("position", "int", 0, 100, required=True),),
    "lock.lock": (), "lock.unlock": (),
    "alarm_control_panel.alarm_arm_home": (), "alarm_control_panel.alarm_arm_away": (), "alarm_control_panel.alarm_arm_night": (), "alarm_control_panel.alarm_disarm": (),
    "siren.turn_on": (), "siren.turn_off": (),
    "media_player.turn_on": (), "media_player.turn_off": (), "media_player.media_play": (), "media_player.media_pause": (),
    "media_player.volume_set": (_a("volume_level", "float", 0, 1, required=True),), "media_player.volume_mute": (_a("is_volume_muted", "bool", required=True),),
    "select.select_option": (_a("option", "str", 1, 80, required=True),), "number.set_value": (_a("value", "float", -1e9, 1e9, required=True),),
    "input_boolean.turn_on": (), "input_boolean.turn_off": (), "input_select.select_option": (_a("option", "str", 1, 80, required=True),),
}
# the other roles (CR section 9.1 additions): scene / script / automation control and notify.<target>
ROLE_ACTIONS: dict[str, tuple[Arg, ...]] = {
    "scene.turn_on": (_a("transition", "float", 0, 300),),
    "script.turn_on": (), "script.turn_off": (),
    "automation.turn_on": (), "automation.turn_off": (_a("stop_actions", "bool"),), "automation.trigger": (_a("skip_condition", "bool"),),
}
NOTIFY_ARGS: tuple[Arg, ...] = (_a("message", "str", 1, 500, required=True), _a("title", "str", 1, 100))
BUILDER_SERVICES: frozenset[str] = frozenset(DEVICE_ACTIONS)

NEVER_TYPED_RE = re.compile(r"^(homeassistant|shell_command|rest_command|hassio|recorder|smplwise_bridge)\.|\.reload(_[a-z_]+)?$")
SENSITIVE_ACTION_RE = re.compile(r"^(alarm_control_panel\.alarm_[a-z_]+|lock\.(lock|unlock|open)|siren\.[a-z_]+)$")
SENSITIVE_COVER_CLASSES = frozenset({"door", "garage", "gate"})
SCENE_CAPTURE_DOMAINS = ("light", "switch", "fan", "cover", "climate", "media_player", "lock")
SCENE_ATTRIBUTES = frozenset({"brightness", "color_temp_kelvin", "hs_color", "rgb_color", "current_position", "current_tilt_position", "temperature", "target_temp_high",
                              "target_temp_low", "fan_mode", "preset_mode", "swing_mode", "volume_level", "source", "percentage"})
FREE_KEY_RE = re.compile(r"^[a-z_][a-z0-9_]*$")


def _fits(arg: Arg, value: Any) -> bool:
    if arg.type in ("int", "float"):
        if not _is_num(value) or (arg.type == "int" and float(value) != int(value)):
            return False
        return (arg.lo is None or float(value) >= arg.lo) and (arg.hi is None or float(value) <= arg.hi)
    if arg.type == "enum":
        return isinstance(value, str) and value in arg.choices
    if arg.type == "str":
        return isinstance(value, str) and (arg.lo or 0) <= len(value.strip()) <= (arg.hi or 10**6) and not has_template(value)
    if arg.type == "bool":
        return isinstance(value, bool)
    return False


def _plain_value(v: Any, depth: int = 0) -> bool:
    if depth > 3:
        return False
    if v is None or isinstance(v, bool):
        return True
    if isinstance(v, str):
        return not has_template(v)
    if _is_num(v):
        return True
    if isinstance(v, list):
        return len(v) <= 50 and all(_plain_value(x, depth + 1) for x in v)
    if isinstance(v, dict):
        return len(v) <= 50 and all(isinstance(k, str) and _plain_value(x, depth + 1) for k, x in v.items())
    return False


def classify_service(action: str) -> tuple[str | None, str | None]:
    """(role, refusal): the role of a service the builder may type (`device`, `scene`, `script`, `notify`, `automation`), or (None, reason)."""
    if NEVER_TYPED_RE.search(action):
        return None, "service_not_allowed"
    if not SERVICE_RE.match(action):
        return None, "invalid_payload"
    domain, svc = action.split(".", 1)
    if action == "scene.turn_on":
        return "scene", None
    if domain == "script":
        return (None, "service_not_allowed") if svc == "toggle" else ("script", None)
    if domain == "automation":
        return ("automation", None) if svc in ("turn_on", "turn_off", "trigger") else (None, "service_not_allowed")
    if domain == "notify":
        return "notify", None
    if action in BUILDER_SERVICES:
        return "device", None
    return None, "service_not_allowed"


def args_fit(action: str, role: str, data: Mapping[str, Any]) -> bool:
    """The `data` of a typed step: every key is an argument of the service and every value is in range. Open family (`script.<key>`): plain field names and values."""
    if role == "notify":
        specs = {a.name: a for a in NOTIFY_ARGS}
    elif action in DEVICE_ACTIONS:
        specs = {a.name: a for a in DEVICE_ACTIONS[action]}
    elif action in ROLE_ACTIONS:
        if action in ("script.turn_on", "script.turn_off"):
            return set(data) <= {"variables"} and _plain_value(data.get("variables"))
        specs = {a.name: a for a in ROLE_ACTIONS[action]}
    elif role == "script":
        return all(isinstance(k, str) and FREE_KEY_RE.match(k) and _plain_value(v) for k, v in data.items())
    else:
        return False
    return all(k in specs and _fits(specs[k], v) for k, v in data.items())


# ---------------------------------------------------------------- typed blocks: is a raw block inside the builder's closed schemas?

def _only_keys(raw: Mapping[str, Any], allowed: tuple[str, ...] | list[str]) -> bool:
    ok = set(allowed) | set(CARRY_KEYS)
    return all(k in ok for k in raw)


_DUR_RE = re.compile(r"^(\d+):([0-5]?\d)(?::([0-5]?\d))?$")
_OFFSET_RE = re.compile(r"^([+-])?(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$")
_CONTAINER_KEYS = frozenset({"conditions", "sequence", "then", "else", "default", "choose", "if", "repeat", "condition"})


def _duration_ok(v: Any) -> bool:
    """A `for` / `delay` value: an object of hours / minutes / seconds, "H:MM[:SS]", or a non-negative number of seconds."""
    if isinstance(v, bool) or v is None:
        return False
    if _is_num(v):
        return v >= 0
    if isinstance(v, str):
        return bool(_DUR_RE.match(v))
    if isinstance(v, dict):
        return bool(v) and all(k in ("hours", "minutes", "seconds") and _is_num(x) and x >= 0 for k, x in v.items())
    return False


def _opt_num(v: Any) -> bool:
    return v is None or _is_num(v)


def _opt_text(v: Any) -> bool:
    return v is None or (isinstance(v, str) and not has_template(v))


def _offset_ok(v: Any) -> bool:
    if v is None:
        return True
    if isinstance(v, bool):
        return False
    if _is_num(v):
        return float(v) % 60 == 0
    m = _OFFSET_RE.match(v) if isinstance(v, str) else None
    if not m:
        return False
    return (int(m.group(2)) * 3600 + int(m.group(3)) * 60 + int(m.group(4) or 0)) % 60 == 0


def _preflight(raw: Any, deep: bool) -> bool:
    """False when the block is outside the schemas for a reason common to every block: not an object, a secret-like key, `enabled: false` /
    `continue_on_error` / an `enabled` that is not true."""
    if not isinstance(raw, dict):
        return False
    own = raw if deep else {k: v for k, v in raw.items() if k not in _CONTAINER_KEYS}
    if secret_kind(own):
        return False
    if raw.get("enabled") is False or "continue_on_error" in raw:
        return False
    if "enabled" in raw and raw["enabled"] is not True:
        return False
    return True


def trigger_authorable(raw: Any) -> bool:
    if not _preflight(raw, True):
        return False
    typ = raw.get("trigger") if raw.get("trigger") is not None else raw.get("platform")
    if not isinstance(typ, str) or typ in ("device", "template") or "." in typ or has_template(raw):
        return False
    if "id" in raw and not isinstance(raw["id"], str):
        return False
    head = ["trigger", "platform", "id"]
    if typ == "state":
        return (_only_keys(raw, [*head, "entity_id", "from", "to", "for"]) and _entity_list(raw.get("entity_id")) is not None and _opt_text(raw.get("from")) and _opt_text(raw.get("to"))
                and (raw.get("for") is None or _duration_ok(raw["for"])))
    if typ == "numeric_state":
        return (_only_keys(raw, [*head, "entity_id", "above", "below", "for"]) and _entity_list(raw.get("entity_id")) is not None and _opt_num(raw.get("above"))
                and _opt_num(raw.get("below")) and (raw.get("for") is None or _duration_ok(raw["for"])))
    if typ == "time":
        return _only_keys(raw, [*head, "at"]) and isinstance(raw.get("at"), str) and bool(TIME_RE.match(raw["at"]))
    if typ == "time_pattern":
        return _only_keys(raw, [*head, "hours", "minutes", "seconds"]) and all(raw.get(k) is None or (isinstance(raw[k], (str, int, float)) and not isinstance(raw[k], bool)) for k in ("hours", "minutes", "seconds"))
    if typ == "sun":
        return _only_keys(raw, [*head, "event", "offset"]) and raw.get("event") in ("sunrise", "sunset") and _offset_ok(raw.get("offset"))
    if typ == "homeassistant":
        return _only_keys(raw, [*head, "event"]) and raw.get("event") == "start"
    return False


def condition_authorable(raw: Any, in_group: bool = False) -> bool:
    """Whether a condition is inside the schemas. A container (and / or / not) is judged by its own keys; its children are judged one by one by the caller."""
    if isinstance(raw, str):
        return False
    typ = raw.get("condition") if isinstance(raw, dict) else None
    container = typ in ("and", "or", "not")
    if not _preflight(raw, not container):
        return False
    if not isinstance(typ, str) or typ in ("device", "template"):
        return False
    if not container and has_template(raw):
        return False
    if typ == "state":
        st = raw["state"] if isinstance(raw.get("state"), list) else [raw.get("state")]
        return _only_keys(raw, ["condition", "entity_id", "state", "for"]) and _entity_list(raw.get("entity_id")) is not None and bool(st) and all(isinstance(s, str) for s in st) \
            and (raw.get("for") is None or _duration_ok(raw["for"]))
    if typ == "numeric_state":
        return _only_keys(raw, ["condition", "entity_id", "above", "below"]) and _entity_list(raw.get("entity_id")) is not None and _opt_num(raw.get("above")) and _opt_num(raw.get("below"))
    if typ == "time":
        def okt(k: str) -> bool:
            return k not in raw or (isinstance(raw[k], str) and bool(TIME_RE.match(raw[k])))

        wd = _to_list(raw["weekday"]) if "weekday" in raw else None
        return _only_keys(raw, ["condition", "after", "before", "weekday"]) and okt("after") and okt("before") and (wd is None or all(isinstance(d, str) and d in WEEKDAYS for d in wd))
    if typ == "sun":
        return _only_keys(raw, ["condition", "after", "before"]) and all(k not in raw or raw[k] in ("sunrise", "sunset") for k in ("after", "before"))
    if typ == "trigger":
        ids = _to_list(raw.get("id"))
        return _only_keys(raw, ["condition", "id"]) and bool(ids) and all(isinstance(i, str) for i in ids)
    if typ in ("and", "or", "not"):
        return (not in_group) and _only_keys(raw, ["condition", "conditions"]) and isinstance(raw.get("conditions"), list)
    return False


def _service_of(raw: Mapping[str, Any]) -> Any:
    a = raw.get("action")
    return a if a is not None else raw.get("service")


def action_authorable(raw: Any) -> bool:
    """Whether an action step is inside the schemas (a container is judged by its own keys; children by the caller)."""
    if not isinstance(raw, dict):
        return False
    container = "choose" in raw or "if" in raw or "repeat" in raw
    if not _preflight(raw, not container):
        return False
    if "choose" in raw:
        return _only_keys(raw, ["choose", "default"]) and isinstance(raw["choose"], list) and all(isinstance(o, dict) and all(k in ("conditions", "sequence") for k in o) for o in raw["choose"])
    if "if" in raw:
        return _only_keys(raw, ["if", "then", "else"]) and "then" in raw
    if "repeat" in raw:
        rp = raw["repeat"]
        return (_only_keys(raw, ["repeat"]) and isinstance(rp, dict) and all(k in ("count", "sequence") for k in rp) and _is_num(rp.get("count"))
                and float(rp["count"]) == int(rp["count"]) and rp["count"] >= 1)
    if "delay" in raw:
        return _only_keys(raw, ["delay"]) and _duration_ok(raw["delay"])
    if "stop" in raw:
        return _only_keys(raw, ["stop"]) and isinstance(raw["stop"], str)
    if isinstance(raw.get("condition"), str) and "action" not in raw and "service" not in raw:
        return condition_authorable(raw)
    if "type" in raw and "device_id" in raw and "domain" in raw:
        return False
    svc = _service_of(raw)
    if not isinstance(svc, str) or has_template(raw) or not _only_keys(raw, ["action", "service", "target", "data", "entity_id"]):
        return False
    role, _ = classify_service(svc)
    if role is None:
        return False
    if "target" in raw:
        if not isinstance(raw["target"], dict) or any(k != "entity_id" for k in raw["target"]):
            return False
        ids = _entity_list(raw["target"].get("entity_id"))
    elif "entity_id" in raw:
        ids = _entity_list(raw["entity_id"])
    else:
        ids = []
    if ids is None:
        return False
    if "data" in raw and not isinstance(raw["data"], dict):
        return False
    data = raw.get("data") if isinstance(raw.get("data"), dict) else {}
    return "entity_id" not in data and args_fit(svc, role, data)


def _children(section: str, raw: Mapping[str, Any]) -> list[tuple[str, str, Any, bool]]:
    """(path segment, section, raw, in_group) of the child blocks of an AUTHORABLE container."""
    out: list[tuple[str, str, Any, bool]] = []
    if section == "condition":
        for i, c in enumerate(raw.get("conditions") or []):
            out.append((f"conditions[{i}]", "condition", c, True))
        return out
    if section != "action":
        return out
    if "choose" in raw:
        for i, o in enumerate(raw["choose"]):
            for j, c in enumerate(_to_list(o.get("conditions"))):
                out.append((f"choose[{i}].conditions[{j}]", "condition", c, False))
            for j, s in enumerate(_to_list(o.get("sequence"))):
                out.append((f"choose[{i}].sequence[{j}]", "action", s, False))
        for j, s in enumerate(_to_list(raw.get("default"))):
            out.append((f"default[{j}]", "action", s, False))
    elif "if" in raw:
        for j, c in enumerate(_to_list(raw["if"])):
            out.append((f"if[{j}]", "condition", c, False))
        for key in ("then", "else"):
            for j, s in enumerate(_to_list(raw.get(key))):
                out.append((f"{key}[{j}]", "action", s, False))
    elif "repeat" in raw:
        for j, s in enumerate(_to_list(raw["repeat"].get("sequence"))):
            out.append((f"repeat.sequence[{j}]", "action", s, False))
    return out


def _is_container(section: str, raw: Any) -> bool:
    if not isinstance(raw, dict):
        return False
    if section == "condition":
        return raw.get("condition") in ("and", "or", "not")
    if section == "action":
        return "choose" in raw or "if" in raw or "repeat" in raw
    return False


def all_block_fingerprints(config: Any) -> set[str]:
    """The fingerprint of every block (triggers, conditions, action steps and their children, at any depth) of a stored config."""
    out: set[str] = set()

    def visit(section: str, raw: Any, depth: int = 0) -> None:
        if depth > MAX_DEPTH:
            return
        out.add(fingerprint_of(raw))
        if isinstance(raw, dict):
            if section == "condition" or (section == "action" and _is_condition_step(raw)):
                for c in _to_list(raw.get("conditions")):
                    visit("condition", c, depth + 1)
            elif section == "action":
                if "choose" in raw and isinstance(raw["choose"], list):
                    for o in raw["choose"]:
                        if isinstance(o, dict):
                            for c in _to_list(o.get("conditions")):
                                visit("condition", c, depth + 1)
                            for s in _to_list(o.get("sequence")):
                                visit("action", s, depth + 1)
                    for s in _to_list(raw.get("default")):
                        visit("action", s, depth + 1)
                if "if" in raw:
                    for c in _to_list(raw["if"]):
                        visit("condition", c, depth + 1)
                    for key in ("then", "else"):
                        for s in _to_list(raw.get(key)):
                            visit("action", s, depth + 1)
                if isinstance(raw.get("repeat"), dict):
                    for s in _to_list(raw["repeat"].get("sequence")):
                        visit("action", s, depth + 1)

    if isinstance(config, dict):
        for key, section in (("triggers", "trigger"), ("trigger", "trigger"), ("conditions", "condition"), ("condition", "condition"), ("actions", "action"), ("action", "action"),
                             ("sequence", "action")):
            for raw in _to_list(config.get(key)):
                visit(section, raw)
    return out


# ---------------------------------------------------------------- the message

@dataclass
class Message:
    op: str
    kind: str | None = None
    item_id: str | None = None
    base_revision: str | None = None
    profile: str = "builder"
    config: dict[str, Any] | None = None
    preserved: frozenset[str] = frozenset()
    sensitive: bool = False
    variables: dict[str, Any] | None = None
    skip_condition: bool | None = None
    entity_id: str | None = None
    request_id: str = ""


def _check_item_id(kind: str, item_id: Any) -> str:
    rx = SCRIPT_KEY_RE if kind == "script" else AUTOMATION_ID_RE
    if not isinstance(item_id, str) or not rx.match(item_id):
        raise _bad("item_id")
    return item_id


def _check_variables(v: Any) -> dict[str, Any] | None:
    if v is None:
        return None
    if not isinstance(v, dict) or len(v) > MAX_VARIABLES or not all(isinstance(k, str) and FREE_KEY_RE.match(k) for k in v):
        raise _bad("variables")
    if secret_kind(v) == "code":
        raise PolicyError("code_not_allowed", "variables")
    if secret_kind(v):
        raise PolicyError("secret_not_allowed", "variables")
    if not all(_plain_value(x) for x in v.values()):
        raise _bad("variables")
    return dict(v)


def validate_message(msg: Mapping[str, Any]) -> Message:
    """Shape of one signed message: the op, the closed key set of that op, ids, profile, revision and fingerprint formats. The config itself is judged by
    `validate_config`. Raises PolicyError (`op_not_allowed`, `invalid_payload`)."""
    op = msg.get("op")
    if op not in OPS:
        raise PolicyError("op_not_allowed", "op")
    for k in msg:
        if not isinstance(k, str) or k not in OP_KEYS[op]:
            raise _bad(str(k))
    if not isinstance(msg.get("request_id"), str) or not REQUEST_ID_RE.match(msg["request_id"]):
        raise _bad("request_id")
    out = Message(op=op, request_id=msg["request_id"])
    if op == "apply_scene":
        if not isinstance(msg.get("entity_id"), str) or not SCENE_ENTITY_RE.match(msg["entity_id"]):
            raise _bad("entity_id")
        out.entity_id = msg["entity_id"]
        return out
    kind = msg.get("kind")
    if kind not in KINDS or (op in OP_KIND and kind != OP_KIND[op]):
        raise _bad("kind")
    out.kind = kind
    out.item_id = _check_item_id(kind, msg.get("item_id"))
    if op in WRITE_OPS:
        profile = msg.get("profile", "builder")
        if profile not in PROFILES:
            raise _bad("profile")
        out.profile = profile
        br = msg.get("base_revision")
        if br is not None and (not isinstance(br, str) or not REVISION_RE.match(br)):
            raise _bad("base_revision")
        if op == "delete" and br is None:
            raise _bad("base_revision")
        out.base_revision = br
        if op == "upsert":
            cfg = msg.get("config")
            if not isinstance(cfg, dict):
                raise _bad("config")
            out.config = cfg
            pres = msg.get("preserved", [])
            if not isinstance(pres, list) or len(pres) > CAPS["preserved"] or not all(isinstance(p, str) and FINGERPRINT_RE.match(p) for p in pres):
                raise _bad("preserved")
            out.preserved = frozenset(pres)
            sens = msg.get("sensitive", False)
            if not isinstance(sens, bool):
                raise _bad("sensitive")
            out.sensitive = sens
    if op == "trigger":
        sc = msg.get("skip_condition")
        if sc is not None and not isinstance(sc, bool):
            raise _bad("skip_condition")
        out.skip_condition = sc
        out.variables = _check_variables(msg.get("variables"))
    if op == "run_script":
        out.variables = _check_variables(msg.get("variables"))
    return out


# ---------------------------------------------------------------- the config of an upsert

@dataclass
class ConfigFacts:
    """What the caller needs from a validated config: the entities its typed device steps drive (for the non-admin permission check), the entities of the
    stored item too, and whether it calls anything sensitive."""

    targets: list[str] = field(default_factory=list)
    stored_targets: list[str] = field(default_factory=list)
    sensitive_services: list[str] = field(default_factory=list)
    door_cover_targets: list[str] = field(default_factory=list)


def _walk_steps(raw: Any, out: list[Mapping[str, Any]], depth: int = 0) -> None:
    """Every step dictionary of an action tree (choose / if / repeat / parallel / sequence / default / then / else), typed or not."""
    if depth > MAX_DEPTH:
        return
    if isinstance(raw, list):
        for x in raw:
            _walk_steps(x, out, depth + 1)
    elif isinstance(raw, dict):
        out.append(raw)
        for key in ("sequence", "then", "else", "default", "parallel"):
            _walk_steps(raw.get(key), out, depth + 1)
        if isinstance(raw.get("choose"), list):
            for o in raw["choose"]:
                if isinstance(o, dict):
                    _walk_steps(o.get("sequence"), out, depth + 1)
        if isinstance(raw.get("repeat"), dict):
            _walk_steps(raw["repeat"].get("sequence"), out, depth + 1)


def step_targets(config: Mapping[str, Any]) -> tuple[list[str], list[str]]:
    """(entity ids the steps' plain `target` / `entity_id` lists name, the services called) of a config's action tree."""
    steps: list[Mapping[str, Any]] = []
    for key in ("actions", "action", "sequence"):
        _walk_steps(config.get(key), steps)
    ents: dict[str, None] = {}
    svcs: dict[str, None] = {}
    for s in steps:
        svc = _service_of(s)
        if isinstance(svc, str):
            svcs[svc] = None
        tgt = s.get("target", {}).get("entity_id") if isinstance(s.get("target"), dict) else s.get("entity_id")
        for e in _to_list(tgt):
            if _is_entity(e):
                ents[e] = None
    return list(ents), list(svcs)


def sensitive_required(services: list[str], entity_ids: list[str], attributes_of: Callable[[str], Mapping[str, Any] | None] | None = None) -> bool:
    """Whether a config that calls `services` on `entity_ids` must declare `sensitive`: an alarm / lock / siren service, or (a cover service) a door-class cover."""
    if any(SENSITIVE_ACTION_RE.match(s) for s in services):
        return True
    if any(s.startswith("cover.") for s in services) and attributes_of:
        for e in entity_ids:
            if e.startswith("cover."):
                attrs = attributes_of(e)
                if attrs and attrs.get("device_class") in SENSITIVE_COVER_CLASSES:
                    return True
    return False


def _is_condition_step(raw: Any) -> bool:
    """An action step that is a condition (`{"condition": "state", ...}` as a step)."""
    return isinstance(raw, dict) and isinstance(raw.get("condition"), str) and "action" not in raw and "service" not in raw and not any(k in raw for k in ("choose", "if", "repeat", "delay", "stop"))


def _check_blocks(section: str, raws: Any, path: str, ctx: "_Ctx", depth: int, counter: list[int]) -> None:
    for i, raw in enumerate(_to_list(raws)):
        _check_block(section, raw, f"{path}[{i}]", ctx, depth, counter)


def _check_block(section: str, raw: Any, path: str, ctx: "_Ctx", depth: int, counter: list[int], in_group: bool = False) -> None:
    if section == "action":
        counter[0] += 1
        if depth > (MAX_DEPTH if ctx.profile == "code" else CAPS["depth"]):
            raise _bad(path)  # nesting beyond the builder's depth cap
    eff = "condition" if section == "action" and _is_condition_step(raw) else section
    ok = trigger_authorable(raw) if eff == "trigger" else condition_authorable(raw, in_group) if eff == "condition" else action_authorable(raw)
    fp = fingerprint_of(raw)
    unchanged = fp in ctx.stored_fps
    if ok:  # inside the closed schemas: the schemas leave no room for a secret, a template or a service outside the allow-list
        if _is_container(eff, raw):
            for seg, sec, child, grp in _children(eff, raw):
                _check_block(sec, child, f"{path}.{seg}", ctx, depth + 1 if sec == "action" else depth, counter, grp)
        return
    # outside the typed schemas: a delegated (builder) save may only keep what is stored
    if ctx.profile == "builder" and (fp not in ctx.preserved or not unchanged):
        raise PolicyError("preserved_mismatch", path)
    if not unchanged:  # the code view authored something new: still never a code or a secret, never a call of the bridge
        _authored_checks(raw, path)
        svc = _service_of(raw) if isinstance(raw, dict) else None
        if isinstance(svc, str) and svc.startswith("smplwise_bridge."):
            raise PolicyError("service_not_allowed", path)


def _authored_checks(raw: Any, path: str) -> None:
    """A block that is new or changed: no code, no secret-like key at any depth (CR section 9.3)."""
    kind = secret_kind(raw)
    if kind == "code":
        raise PolicyError("code_not_allowed", path)
    if kind:
        raise PolicyError("secret_not_allowed", path)


@dataclass
class _Ctx:
    profile: str
    preserved: frozenset[str]
    stored_fps: set[str]


def _check_extras(kind: str, config: Mapping[str, Any], stored: Mapping[str, Any] | None, profile: str) -> None:
    managed = set(MANAGED_KEYS[kind]) | set(LEGACY_KEYS[kind])
    if profile == "builder" and stored:
        for k in stored:  # the add-on carries every extra key unchanged: dropping one (`variables`, `trigger_variables` ...) is not a builder edit
            if k not in managed and k not in config:
                raise PolicyError("preserved_mismatch", k)
    for k, v in config.items():
        if not isinstance(k, str):
            raise _bad()
        if k in LEGACY_KEYS[kind]:
            raise PolicyError("legacy_schema", k)  # new-schema-only writes (CR section 6.2): the add-on rewrites a legacy item in the new schema when it is saved
        if k in managed:
            continue
        # an extra top-level key (variables, trace, trigger_variables, initial_state, note, use_blueprint, metadata ...)
        if profile == "builder":
            if stored is None or k not in stored or canonical_json(stored[k]) != canonical_json(v):
                raise PolicyError("preserved_mismatch", k)
        elif stored is None or k not in stored or canonical_json(stored[k]) != canonical_json(v):
            _authored_checks(v, k)  # the code view may add or change an extra key, never with a code or a secret in it


def _check_text(config: Mapping[str, Any], key: str, limit: int, builder: bool) -> None:
    if key in config and (not isinstance(config[key], str) or (builder and len(config[key]) > limit)):
        raise _bad(key)


def _check_head(kind: str, item_id: str, config: Mapping[str, Any], builder: bool) -> None:
    if kind in ("automation", "scene"):
        if config.get("id") != item_id:
            raise _bad("id")
    elif "id" in config:
        raise _bad("id")  # a script is keyed by its object id; an `id` inside would be stored as a field
    if kind == "scene":
        if not isinstance(config.get("name"), str) or not config["name"].strip() or (builder and len(config["name"]) > CAPS["alias"]):
            raise _bad("name")
    else:
        _check_text(config, "alias", CAPS["alias"], builder)
        _check_text(config, "description", CAPS["description"], builder)
        if "mode" in config and config["mode"] not in MODES:
            raise _bad("mode")
        if "max" in config and (not _is_num(config["max"]) or float(config["max"]) != int(config["max"]) or not 1 <= config["max"] <= 1000):
            raise _bad("max")
    if "icon" in config and (not isinstance(config["icon"], str) or len(config["icon"]) > 80):
        raise _bad("icon")


def _check_scene(config: Mapping[str, Any], stored: Mapping[str, Any] | None, profile: str) -> None:
    ents = config.get("entities")
    if not isinstance(ents, dict) or (profile == "builder" and (not ents or len(ents) > CAPS["members"])):
        raise _bad("entities")
    old = stored.get("entities") if stored and isinstance(stored.get("entities"), dict) else {}
    for eid, val in ents.items():
        p = f"entities.{eid}"
        if not _is_entity(eid):
            raise _bad(p)
        if eid in old and canonical_json(old[eid]) == canonical_json(val):
            continue  # a member as it is stored is kept (an HA-made scene may carry attributes the builder does not model)
        domain = eid.split(".")[0]
        if domain == "alarm_control_panel" or domain not in SCENE_CAPTURE_DOMAINS:
            raise _bad(p, "service_not_allowed")  # an alarm panel needs a code to be reproduced: never a scene member
        kind = secret_kind(val)
        if kind == "code":
            raise PolicyError("code_not_allowed", p)
        if kind:
            raise PolicyError("secret_not_allowed", p)
        if isinstance(val, str):
            if not val or len(val) > 40:
                raise _bad(p)
            continue
        if not isinstance(val, dict) or not isinstance(val.get("state"), str) or not val["state"] or len(val["state"]) > 40:
            raise _bad(p)
        for k, x in val.items():
            if k == "state":
                continue
            if k not in SCENE_ATTRIBUTES or not (_is_num(x) or isinstance(x, str) or isinstance(x, bool) or (isinstance(x, list) and len(x) <= 4 and all(_is_num(y) for y in x))):
                raise _bad(f"{p}.{k}", "argument_not_allowed")


_SELECTOR_KEYS = {"number": {"min", "max", "step", "unit_of_measurement", "mode"}, "boolean": set(), "select": {"options", "mode", "translation_key"}, "text": {"maxlength", "multiline", "type"},
                  "entity": {"domain"}}


def _selector_ok(sel: Any) -> bool:
    if not isinstance(sel, dict) or len(sel) != 1:
        return False
    kind, cfg = next(iter(sel.items()))
    cfg = {} if cfg is None else cfg
    if kind not in _SELECTOR_KEYS or not isinstance(cfg, dict) or not set(cfg) <= _SELECTOR_KEYS[kind]:
        return False
    if kind == "number":
        return _is_num(cfg.get("min")) and _is_num(cfg.get("max")) and cfg["min"] < cfg["max"] and all(_is_num(cfg[k]) for k in ("step",) if k in cfg)
    if kind == "select":
        return isinstance(cfg.get("options"), list) and bool(cfg["options"]) and all(isinstance(o, str) and len(o) <= 80 for o in cfg["options"]) and len(cfg["options"]) <= 50
    if kind == "entity":
        d = _to_list(cfg.get("domain"))
        return all(isinstance(x, str) and re.match(r"^[a-z_]+$", x) for x in d)
    return True


def _check_fields(config: Mapping[str, Any], stored: Mapping[str, Any] | None, profile: str) -> None:
    fields = config.get("fields")
    if fields is None:
        return
    if not isinstance(fields, dict) or (profile == "builder" and len(fields) > CAPS["fields"]):
        raise _bad("fields")
    old = stored.get("fields") if stored and isinstance(stored.get("fields"), dict) else {}
    for key, f in fields.items():
        p = f"fields.{key}"
        if not isinstance(key, str) or not FREE_KEY_RE.match(key):
            raise _bad(p)
        if key in old and canonical_json(old[key]) == canonical_json(f):
            continue
        if not isinstance(f, dict) or not set(f) <= {"name", "description", "required", "default", "example", "selector"}:
            raise _bad(p)
        if not isinstance(f.get("name", ""), str) or not isinstance(f.get("description", ""), str) or not isinstance(f.get("required", False), bool):
            raise _bad(p)
        if "selector" not in f or not _selector_ok(f["selector"]) or not _plain_value(f.get("default")) or not _plain_value(f.get("example")):
            raise _bad(p)
        kind = secret_kind(f)
        if kind:
            raise PolicyError("code_not_allowed" if kind == "code" else "secret_not_allowed", p)


def _nesting_exceeds(v: Any, limit: int) -> bool:
    """Whether a JSON value nests deeper than `limit` (iterative: the answer to a hostile document must not be a RecursionError)."""
    stack: list[tuple[Any, int]] = [(v, 1)]
    while stack:
        node, depth = stack.pop()
        if depth > limit:
            return True
        if isinstance(node, dict):
            stack.extend((x, depth + 1) for x in node.values())
        elif isinstance(node, list):
            stack.extend((x, depth + 1) for x in node)
    return False


MAX_NESTING = 48  # deeper than any item a person or the Home Assistant editor writes


def validate_config(kind: str, item_id: str, config: Mapping[str, Any], *, profile: str, preserved: frozenset[str], stored: Mapping[str, Any] | None,
                    sensitive: bool, attributes_of: Callable[[str], Mapping[str, Any] | None] | None = None) -> ConfigFacts:
    """Judge the config of an upsert (module docstring). `stored` = the item as it is stored now (None for a create). Raises PolicyError; returns the facts the
    caller needs for the permission check and the sensitive flag (already checked here)."""
    builder = profile == "builder"
    if _nesting_exceeds(config, MAX_NESTING) or (stored is not None and _nesting_exceeds(stored, MAX_NESTING + 8)):
        raise _bad("config")
    if len(canonical_json(config).encode("utf-8")) > MAX_CONFIG_BYTES:
        raise _bad("config")
    _check_head(kind, item_id, config, builder)
    _check_extras(kind, config, stored, profile)
    stored_fps = all_block_fingerprints(stored) if stored else set()
    ctx = _Ctx(profile, preserved, stored_fps)
    if kind == "scene":
        _check_scene(config, stored, profile)
    else:
        counter = [0]
        if kind == "automation":
            trig = config.get("triggers")
            if not isinstance(trig, list) or (builder and not 1 <= len(trig) <= CAPS["triggers"]):
                raise _bad("triggers")
            if "conditions" in config and (not isinstance(config["conditions"], list) or (builder and len(config["conditions"]) > CAPS["conditions"])):
                raise _bad("conditions")
            if not isinstance(config.get("actions"), list) or (builder and not config["actions"]):
                raise _bad("actions")
            _check_blocks("trigger", trig, "triggers", ctx, 0, counter)
            _check_blocks("condition", config.get("conditions"), "conditions", ctx, 0, counter)
            _check_blocks("action", config["actions"], "actions", ctx, 0, counter)
        else:
            if not isinstance(config.get("sequence"), list) or (builder and not config["sequence"]):
                raise _bad("sequence")
            _check_fields(config, stored, profile)
            _check_blocks("action", config["sequence"], "sequence", ctx, 0, counter)
        if builder and counter[0] > CAPS["steps"]:
            raise _bad("actions" if kind == "automation" else "sequence")
    targets, services = step_targets(config)
    if builder and len(targets) > CAPS["targets"]:
        raise _bad("actions" if kind == "automation" else "sequence")
    if not sensitive and sensitive_required(services, targets, attributes_of):
        raise PolicyError("sensitive_flag_mismatch", "actions" if kind == "automation" else "sequence")
    stored_targets = step_targets(stored)[0] if stored else []
    scene_members = [e for e in (config.get("entities") or {}) if _is_entity(e)] if kind == "scene" else []
    return ConfigFacts(targets=list(dict.fromkeys(targets + scene_members)), stored_targets=stored_targets,
                       sensitive_services=[s for s in services if SENSITIVE_ACTION_RE.match(s)])
