"""CR-017 (automations, scenes, scripts) safety policy: which services the builder may type, with which arguments, which
action classes are sensitive and which manual-control grant guards each (CR section 9.1-9.4, AUTOMATIONS_API.md sections 2.1 and 4),
how secret-like values are recognised and masked, and the static loop / storm checks and the schedule suggestion.

Pure functions - no database, no Home Assistant, no import of the block model (the model imports THIS module) - so the bridge's
own copy of the rules (custom_components/smplwise_bridge/config_policy.py) can be compared with this one by a drift test
(tests/test_bridge_config_drift.py). The add-on validates first; the bridge re-checks independently.

Shapes a drift test can rely on:

- `BUILDER_ACTIONS[service]` = `{"role": "device", "args": {name: {"type": "int|float|enum|str|bool", "min", "max", "choices", "required"}},
  "exclusive": [[name, name]]}` - the device services of the builder (a subset of the bridge's ALLOWED_SERVICES).
- `ROLE_ACTIONS` - the services of the other roles (scene / script / automation); `notify.<target>` is any notify service the
  administrator approved; `script.<key>` is any script of the installation.
- `NEVER_TYPED_RE`, `SENSITIVE_ACTION_RE`, `GRANT_OF_CLASS`, `is_secret_key`, `secret_kind` - the same words in the bridge.
"""
from __future__ import annotations

import math
import re
from typing import Any, Collection, Iterable, Mapping, NamedTuple

# ---------------------------------------------------------------- vocabulary

ITEM_KINDS = ("automation", "script", "scene")
MODES = ("single", "restart", "queued", "parallel")
WEEKDAYS = ("sun", "mon", "tue", "wed", "thu", "fri", "sat")

# Caps of AUTOMATIONS_API.md section 2.2 (the client's CAPS)
CAPS: dict[str, int] = {
    "alias_max": 120, "description_max": 1000, "triggers_max": 20, "conditions_max": 20, "steps_max": 60, "depth_max": 4, "targets_max": 50,
    "fields_max": 12, "members_max": 100, "choose_options_max": 6,
}

ENTITY_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
SERVICE_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
TIME_RE = re.compile(r"^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$")
TEMPLATE_RE = re.compile(r"\{\{|\{%|\{#")


def is_entity_id(v: Any) -> bool:
    return isinstance(v, str) and bool(ENTITY_RE.match(v))


def is_number(v: Any) -> bool:
    """A JSON number (a bool is not one; NaN / infinity never are)."""
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(float(v))


def has_template(v: Any) -> bool:
    """A Jinja template marker anywhere inside a value (a string, a list, a mapping)."""
    if isinstance(v, str):
        return bool(TEMPLATE_RE.search(v))
    if isinstance(v, list):
        return any(has_template(x) for x in v)
    if isinstance(v, dict):
        return any(has_template(x) for x in v.values())
    return False


def first_template(v: Any) -> str | None:
    if isinstance(v, str):
        return v if TEMPLATE_RE.search(v) else None
    kids = v if isinstance(v, list) else list(v.values()) if isinstance(v, dict) else []
    for k in kids:
        t = first_template(k)
        if t:
            return t
    return None


# ---------------------------------------------------------------- secrets (CR section 9.3)

MASK = "••••"
_SECRET_WORDS = frozenset({"password", "passwd", "token", "secret", "code", "pin", "apikey"})
_CAMEL_RE = re.compile(r"([a-z0-9])([A-Z])")


def _key_parts(key: str) -> list[str]:
    return [p for p in re.split(r"[^a-z0-9]+", _CAMEL_RE.sub(r"\1_\2", key).lower()) if p]


def is_secret_key(key: str) -> bool:
    """`password|passwd|token|api_key|apikey|secret|code|pin`, matched as whole words of the key (snake, kebab or camel
    case): `shipping` or `unicode` are not secrets while `access_token`, `alarm_code` and `apiKey` are."""
    parts = _key_parts(key)
    if any(p in _SECRET_WORDS for p in parts):
        return True
    return any(p == "api" and i + 1 < len(parts) and parts[i + 1] == "key" for i, p in enumerate(parts))


def secret_kind(v: Any) -> str | None:
    """`"code"` when some key (any depth) is the alarm-code word, `"secret"` for any other secret-like key, else None."""
    found: str | None = None

    def walk(x: Any, depth: int = 0) -> None:
        nonlocal found
        if found == "code" or depth > 40:
            return
        if isinstance(x, list):
            for i in x:
                walk(i, depth + 1)
        elif isinstance(x, dict):
            for k, val in x.items():
                if isinstance(k, str) and is_secret_key(k):
                    found = "code" if "code" in _key_parts(k) else (found or "secret")
                walk(val, depth + 1)

    walk(v)
    return found


def mask_secrets(v: Any) -> Any:
    """A copy with the value under every secret-like key (any depth) replaced by the mask (traces and every API answer)."""
    if isinstance(v, list):
        return [mask_secrets(x) for x in v]
    if isinstance(v, dict):
        return {k: (MASK if isinstance(k, str) and is_secret_key(k) else mask_secrets(x)) for k, x in v.items()}
    return v


def has_mask(v: Any) -> bool:
    if isinstance(v, str):
        return MASK in v
    if isinstance(v, list):
        return any(has_mask(x) for x in v)
    if isinstance(v, dict):
        return any(has_mask(x) for x in v.values())
    return False


# ---------------------------------------------------------------- sensitive classes and the manual-control grants (CR section 9.2)

# alarm panels (any alarm_* service), lock.lock / unlock / open, any siren service
SENSITIVE_ACTION_RE = re.compile(r"^(alarm_control_panel\.alarm_[a-z_]+|lock\.(lock|unlock|open)|siren\.[a-z_]+)$")
SENSITIVE_CLASSES = ("alarm", "lock", "gate", "door", "garage", "siren")
SENSITIVE_CLASS_LABEL = {"alarm": "אזעקה", "lock": "מנעול", "gate": "שער", "door": "דלת", "garage": "חניה", "siren": "צופר"}
# the manual-control grant that guards each class (CR-014 section 4.4 mapped by the approved mockup): the same grant the device screen needs
GRANT_OF_CLASS = {"alarm": "alarm.disarm", "lock": "door.unlock", "gate": "door.unlock", "door": "door.unlock", "garage": "door.unlock", "siren": "ha.entity.control"}


def sensitive_class_of(action: str, entity_class: str | None = None) -> str | None:
    """The sensitive class of one call: by the service, else (`cover.*`) by the entity's class (gate / door / garage); a service on an alarm / lock /
    siren class entity counts as that class too. None when the call is plain."""
    if action.startswith("alarm_control_panel."):
        return "alarm"
    if action in ("lock.lock", "lock.unlock", "lock.open"):
        return "lock"
    if action.startswith("siren."):
        return "siren"
    if action.startswith("cover.") and entity_class in ("gate", "door", "garage"):
        return entity_class
    return entity_class if entity_class in ("alarm", "lock", "siren") else None


def grant_of(action: str, entity_class: str | None = None) -> str | None:
    cls = sensitive_class_of(action, entity_class)
    return GRANT_OF_CLASS[cls] if cls else None


# an alarm / lock / siren service, or (a cover service) a door-class cover by its `device_class`: what the bridge recognises on its own (config_policy.sensitive_required)
SENSITIVE_COVER_CLASSES = frozenset({"door", "garage", "gate"})


def sensitive_required(services: Iterable[str], entity_ids: Iterable[str], attributes_of: Any = None) -> bool:
    """Whether a config that calls `services` on `entity_ids` must be sent with `sensitive: true`: the bridge refuses a false flag on what it can recognise (the same
    function, drift-tested). `attributes_of(entity_id)` = the entity's state attributes (its `device_class`), or None."""
    svcs = list(services)
    if any(SENSITIVE_ACTION_RE.match(s) for s in svcs):
        return True
    if any(s.startswith("cover.") for s in svcs) and attributes_of:
        for e in entity_ids:
            if e.startswith("cover."):
                attrs = attributes_of(e)
                if attrs and attrs.get("device_class") in SENSITIVE_COVER_CLASSES:
                    return True
    return False


# ---------------------------------------------------------------- the allow-list (CR section 9.1)

# Never typed (locked `service_not_allowed`): homeassistant, shell_command, rest_command, hassio, recorder, smplwise_bridge and any `*.reload`
NEVER_TYPED_RE = re.compile(r"^(homeassistant|shell_command|rest_command|hassio|recorder|smplwise_bridge)\.|\.reload(_[a-z_]+)?$")
# Core service domains: a service of one of these that is not allowed is `service_not_allowed`; any other domain is a custom integration (`custom_service`)
CORE_DOMAINS = frozenset({
    "light", "switch", "fan", "climate", "cover", "lock", "alarm_control_panel", "siren", "media_player", "select", "number", "input_boolean",
    "input_select", "input_number", "input_text", "input_button", "input_datetime", "button", "timer", "humidifier", "water_heater", "vacuum", "valve", "lawn_mower", "remote",
    "scene", "script", "automation", "notify", "persistent_notification", "tts", "counter", "text", "datetime", "camera", "event", "update", "weather", "todo", "group", "zone",
})


def _arg(kind: str, lo: float | None = None, hi: float | None = None, *, required: bool = False, choices: Iterable[str] | None = None) -> dict[str, Any]:
    spec: dict[str, Any] = {"type": kind, "required": required}
    if lo is not None:
        spec["min"] = lo
    if hi is not None:
        spec["max"] = hi
    if choices is not None:
        spec["choices"] = list(choices)
    return spec


HVAC_MODES = ("off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only")


def _dev(args: dict[str, dict[str, Any]] | None = None, exclusive: list[list[str]] | None = None) -> dict[str, Any]:
    return {"role": "device", "args": args or {}, "exclusive": exclusive or []}


# Device services of the builder: every one is a service of the bridge's ALLOWED_SERVICES and of ha_bridge.ACTIONS (a drift test holds both).
# The arguments are a CLOSED set: a stored step with another argument (a colour, a template, a nested `data`) is read as a locked block and kept as it is.
# A sensitive service (alarm / lock / siren, and door-class covers) is an ordinary entry here: it needs the manual-control grant, never a `code`.
BUILDER_ACTIONS: dict[str, dict[str, Any]] = {
    "light.turn_on": _dev({"brightness_pct": _arg("int", 0, 100), "color_temp_kelvin": _arg("int", 1000, 10000), "transition": _arg("float", 0, 300)}),
    "light.turn_off": _dev({"transition": _arg("float", 0, 300)}),
    "switch.turn_on": _dev(), "switch.turn_off": _dev(),
    "fan.turn_on": _dev({"percentage": _arg("int", 1, 100)}), "fan.turn_off": _dev(),
    "fan.set_percentage": _dev({"percentage": _arg("int", 0, 100, required=True)}),
    "climate.turn_off": _dev(),
    "climate.set_temperature": _dev({"temperature": _arg("float", -30, 120, required=True), "hvac_mode": _arg("enum", choices=HVAC_MODES)}),
    "climate.set_hvac_mode": _dev({"hvac_mode": _arg("enum", required=True, choices=HVAC_MODES)}),
    "climate.set_fan_mode": _dev({"fan_mode": _arg("str", 1, 40, required=True)}),
    "climate.set_preset_mode": _dev({"preset_mode": _arg("str", 1, 40, required=True)}),
    "cover.open_cover": _dev(), "cover.close_cover": _dev(), "cover.stop_cover": _dev(),
    "cover.set_cover_position": _dev({"position": _arg("int", 0, 100, required=True)}),
    "lock.lock": _dev(), "lock.unlock": _dev(),
    "alarm_control_panel.alarm_arm_home": _dev(), "alarm_control_panel.alarm_arm_away": _dev(), "alarm_control_panel.alarm_arm_night": _dev(),
    "alarm_control_panel.alarm_disarm": _dev(),
    "siren.turn_on": _dev(), "siren.turn_off": _dev(),
    "media_player.turn_on": _dev(), "media_player.turn_off": _dev(), "media_player.media_play": _dev(), "media_player.media_pause": _dev(),
    "media_player.volume_set": _dev({"volume_level": _arg("float", 0, 1, required=True)}),
    "media_player.volume_mute": _dev({"is_volume_muted": _arg("bool", required=True)}),
    "select.select_option": _dev({"option": _arg("str", 1, 80, required=True)}),
    "number.set_value": _dev({"value": _arg("float", -1e9, 1e9, required=True)}),
    "input_boolean.turn_on": _dev(), "input_boolean.turn_off": _dev(),
    "input_select.select_option": _dev({"option": _arg("str", 1, 80, required=True)}),
}
BUILDER_DEVICE_SERVICES: frozenset[str] = frozenset(BUILDER_ACTIONS)

# The services of the other roles. `script.<key>` (a script's own service, fields as data) and `notify.<approved target>` are open families.
ROLE_ACTIONS: dict[str, dict[str, Any]] = {
    "scene.turn_on": {"role": "scene", "args": {"transition": _arg("float", 0, 300)}, "exclusive": []},
    "script.turn_on": {"role": "script", "args": {}, "exclusive": []},
    "script.turn_off": {"role": "script", "args": {}, "exclusive": []},
    "automation.turn_on": {"role": "automation", "args": {}, "exclusive": []},
    "automation.turn_off": {"role": "automation", "args": {"stop_actions": _arg("bool")}, "exclusive": []},
    "automation.trigger": {"role": "automation", "args": {"skip_condition": _arg("bool")}, "exclusive": []},
}
NOTIFY_ARGS: dict[str, dict[str, Any]] = {"message": _arg("str", 1, 500, required=True), "title": _arg("str", 1, 100)}

# What the bridge adds to ALLOWED_SERVICES for authored content (CR section 9.1): none of these is a device the add-on controls itself.
DEFAULT_ALLOWED_ACTIONS: tuple[str, ...] = tuple(BUILDER_ACTIONS)

ROLES = ("device", "scene", "script", "notify", "automation")


class Classified(NamedTuple):
    """`ok` with the `role` of a typed service, or not ok with the locked `reason`."""

    ok: bool
    role: str | None
    reason: str | None


def classify_action(action: str, allowed: Collection[str] | None = None) -> Classified:
    """How a service is handled: typed with a role, or locked with the reason (CR section 9.1). `allowed` = the catalogue's approved list (device
    services and approved `notify.<target>` services); None = the built-in list, any notify service."""
    if NEVER_TYPED_RE.search(action):
        return Classified(False, None, "service_not_allowed")
    if not SERVICE_RE.match(action):
        return Classified(False, None, "unknown")
    domain, svc = action.split(".", 1)
    allow = allowed if allowed is not None else BUILDER_DEVICE_SERVICES
    if action == "scene.turn_on":
        return Classified(True, "scene", None)
    if domain == "script":
        return Classified(False, None, "service_not_allowed") if svc == "toggle" else Classified(True, "script", None)
    if domain == "automation":
        return Classified(True, "automation", None) if svc in ("turn_on", "turn_off", "trigger") else Classified(False, None, "service_not_allowed")
    if domain == "notify":
        return Classified(True, "notify", None) if allowed is None or action in allow else Classified(False, None, "service_not_allowed")
    if action in allow and action in BUILDER_ACTIONS:
        return Classified(True, "device", None)
    return Classified(False, None, "service_not_allowed" if domain in CORE_DOMAINS else "custom_service")


# ---------------------------------------------------------------- argument specs

def _fits(spec: Mapping[str, Any], value: Any) -> bool:
    t = spec["type"]
    if t in ("int", "float"):
        if not is_number(value):
            return False
        if t == "int" and float(value) != int(value):
            return False
        return float(spec.get("min", -math.inf)) <= float(value) <= float(spec.get("max", math.inf))
    if t == "enum":
        return isinstance(value, str) and value in spec["choices"]
    if t == "str":
        return isinstance(value, str) and float(spec.get("min", 0)) <= len(value.strip()) <= float(spec.get("max", 10**6)) and not has_template(value)
    if t == "bool":
        return isinstance(value, bool)
    return False


_FREE_KEY_RE = re.compile(r"^[a-z_][a-z0-9_]*$")


def _plain_value(v: Any, depth: int = 0) -> bool:
    """A value a script's field may carry: scalars and lists / mappings of scalars, a few levels deep, no template."""
    if depth > 3:
        return False
    if v is None or isinstance(v, (str, bool)):
        return not isinstance(v, str) or not has_template(v)
    if is_number(v):
        return True
    if isinstance(v, list):
        return len(v) <= 50 and all(_plain_value(x, depth + 1) for x in v)
    if isinstance(v, dict):
        return len(v) <= 50 and all(isinstance(k, str) and _plain_value(x, depth + 1) for k, x in v.items())
    return False


def args_of(action: str, role: str | None = None) -> dict[str, dict[str, Any]] | None:
    """The closed argument specs of a service, or None for an open family (a script's own service, whose data are its fields)."""
    if action in BUILDER_ACTIONS:
        return BUILDER_ACTIONS[action]["args"]
    if action in ROLE_ACTIONS:
        return ROLE_ACTIONS[action]["args"]
    if role == "notify" or action.startswith("notify."):
        return NOTIFY_ARGS
    return None


def args_fit(action: str, role: str | None, data: Mapping[str, Any]) -> bool:
    """Whether the `data` of a step is expressible by the typed block: every key is an argument of the service and every value is in range (a
    required argument may be missing - that is a validation problem of a CHANGED block, not a reason to lock a stored one). Open families (a
    script's own service): plain field names and values; `script.turn_on` / `turn_off`: only `variables`."""
    specs = args_of(action, role)
    if specs is None:
        return all(isinstance(k, str) and _FREE_KEY_RE.match(k) and _plain_value(v) for k, v in data.items())
    if action in ("script.turn_on", "script.turn_off"):
        return set(data) <= {"variables"} and _plain_value(data.get("variables"))
    return all(k in specs and _fits(specs[k], v) for k, v in data.items())


def check_arguments(action: str, role: str | None, data: Mapping[str, Any]) -> list[dict[str, str]]:
    """Problems of the `data` of a NEW or CHANGED step: `{"code", "arg"}` with the codes `code_not_allowed`, `secret_not_allowed`, `argument_not_allowed`,
    `required`, `invalid_value`, `argument_conflict`."""
    kind = secret_kind(data)
    if kind == "code":
        return [{"code": "code_not_allowed", "arg": "code"}]
    if kind == "secret":
        return [{"code": "secret_not_allowed", "arg": ""}]
    out: list[dict[str, str]] = []
    specs = args_of(action, role)
    if specs is None:
        for k, v in data.items():
            if not (isinstance(k, str) and _FREE_KEY_RE.match(k)):
                out.append({"code": "argument_not_allowed", "arg": str(k)})
            elif not _plain_value(v):
                out.append({"code": "invalid_value", "arg": k})
        return out
    if action in ("script.turn_on", "script.turn_off"):
        specs = {"variables": {"type": "free", "required": False}}
        for k in data:
            if k not in specs:
                out.append({"code": "argument_not_allowed", "arg": str(k)})
        if "variables" in data and not _plain_value(data["variables"]):
            out.append({"code": "invalid_value", "arg": "variables"})
        return out
    for k, v in data.items():
        spec = specs.get(k)
        if spec is None:
            out.append({"code": "argument_not_allowed", "arg": str(k)})
        elif not _fits(spec, v):
            out.append({"code": "invalid_value", "arg": str(k)})
    for name, spec in specs.items():
        if spec.get("required") and name not in data:
            out.append({"code": "required", "arg": name})
    for group in (BUILDER_ACTIONS.get(action) or {}).get("exclusive", []):
        if sum(1 for g in group if g in data) > 1:
            out.append({"code": "argument_conflict", "arg": group[0]})
    return out


# Hebrew labels / units / steps of the arguments the form shows (AutomationCatalog `ArgSpec`)
_ARG_META: dict[str, dict[str, Any]] = {
    "brightness_pct": {"label": "בהירות", "step": 1, "unit": "%"}, "color_temp_kelvin": {"label": "טמפרטורת צבע", "step": 100, "unit": "K"},
    "transition": {"label": "משך מעבר", "step": 1, "unit": "שנ׳"}, "percentage": {"label": "מהירות", "step": 10, "unit": "%"},
    "temperature": {"label": "טמפרטורה", "step": 0.5, "unit": "°"}, "hvac_mode": {"label": "מצב פעולה"}, "fan_mode": {"label": "מצב מאוורר"},
    "preset_mode": {"label": "מצב מוגדר מראש"}, "position": {"label": "מיקום", "step": 5, "unit": "%"}, "volume_level": {"label": "עוצמה", "step": 0.05},
    "is_volume_muted": {"label": "השתקה"}, "option": {"label": "אפשרות"}, "value": {"label": "ערך"}, "message": {"label": "הודעה"}, "title": {"label": "כותרת"},
    "skip_condition": {"label": "דלג על התנאים"}, "stop_actions": {"label": "עצור פעולות רצות"},
}
_HVAC_LABEL = {"off": "כבוי", "heat": "חימום", "cool": "קירור", "heat_cool": "חימום/קירור", "auto": "אוטומטי", "dry": "ייבוש", "fan_only": "מאוורר"}


def arg_specs_for_catalog(action: str, role: str | None = None) -> list[dict[str, Any]]:
    """The `ArgSpec[]` of the client for one action: key, Hebrew label, kind (`number|text|select|boolean`), required, range, step, unit, options."""
    specs = args_of(action, role) or {}
    out: list[dict[str, Any]] = []
    for key, spec in specs.items():
        meta = _ARG_META.get(key, {})
        kind = {"int": "number", "float": "number", "enum": "select", "str": "text", "bool": "boolean"}[spec["type"]]
        item: dict[str, Any] = {"key": key, "label": meta.get("label", key), "kind": kind}
        if spec.get("required"):
            item["required"] = True
        if kind == "number":
            item["min"], item["max"] = spec.get("min"), spec.get("max")
            if "step" in meta:
                item["step"] = meta["step"]
            if "unit" in meta:
                item["unit"] = meta["unit"]
        if kind == "select":
            item["options"] = [{"value": c, "label": _HVAC_LABEL.get(c, c) if key == "hvac_mode" else c} for c in spec["choices"]]
        out.append(item)
    return out


# ---------------------------------------------------------------- loops and storms (CR section 9.4)

def self_trigger(trigger_entities: Iterable[str], action_targets: Iterable[str], *, guarded: bool) -> list[str]:
    """The entities an automation both WATCHES and DRIVES while nothing guards it (no condition): a static warning (`self_trigger`), sorted."""
    if guarded:
        return []
    return sorted(set(trigger_entities) & set(action_targets))


def find_cycles(nodes: Mapping[str, Mapping[str, Any]]) -> list[list[str]]:
    """Cycles across items. `nodes[key] = {"entity_id": str | None, "watches": set[str], "drives": set[str]}`; an edge A -> B exists when A drives an entity
    that B watches (or B's own entity: `automation.trigger` / `script.turn_on` of B). Returns the strongly connected groups of two or more items
    and the items with an edge to themselves, each sorted, the list sorted by its first key (deterministic)."""
    keys = sorted(nodes)
    edges: dict[str, list[str]] = {k: [] for k in keys}
    for a in keys:
        drives = set(nodes[a].get("drives") or ())
        for b in keys:
            seen = set(nodes[b].get("watches") or ())
            if nodes[b].get("entity_id"):
                seen.add(nodes[b]["entity_id"])
            if drives & seen:
                edges[a].append(b)
    # Tarjan, iteratively (the installation has tens of items, but never recurse on data)
    index: dict[str, int] = {}
    low: dict[str, int] = {}
    on: set[str] = set()
    stack: list[str] = []
    out: list[list[str]] = []
    counter = 0
    for root in keys:
        if root in index:
            continue
        work: list[tuple[str, int]] = [(root, 0)]
        while work:
            v, i = work.pop()
            if i == 0:
                index[v] = low[v] = counter
                counter += 1
                stack.append(v)
                on.add(v)
            advanced = False
            for j in range(i, len(edges[v])):
                w = edges[v][j]
                if w not in index:
                    work.append((v, j + 1))
                    work.append((w, 0))
                    advanced = True
                    break
                if w in on:
                    low[v] = min(low[v], index[w])
            if advanced:
                continue
            if low[v] == index[v]:
                comp: list[str] = []
                while True:
                    w = stack.pop()
                    on.discard(w)
                    comp.append(w)
                    if w == v:
                        break
                if len(comp) > 1 or v in edges[v]:
                    out.append(sorted(comp))
            if work:
                parent = work[-1][0]
                low[parent] = min(low[parent], low[v])
    return sorted(out)


# ---------------------------------------------------------------- the schedule suggestion (CR section 5)

SCHEDULE_DOMAINS = frozenset({"light", "switch", "climate", "fan", "cover"})
_WD_SHORT = ("sun", "mon", "tue", "wed", "thu", "fri", "sat")


def _hms(t: str) -> str:
    parts = t.split(":")
    return f"{parts[0].rjust(2, '0')}:{parts[1]}:{parts[2] if len(parts) > 2 else '00'}"


def _fmt_offset(minutes: int) -> str:
    return f"{'-' if minutes < 0 else ''}{abs(minutes) // 60:02d}:{abs(minutes) % 60:02d}:00"


def suggest_schedule(draft: Mapping[str, Any], *, scheduler_present: bool, shabbat_sensor: str | None = None, class_of: Any = None) -> dict[str, Any] | None:
    """"צור כתזמון": when a draft has only `time` / `sun` triggers and only plain device control (lights, switches, climate, fans, covers; nothing sensitive)
    and the scheduler is present, `{"schedule_draft": <CR-014 ScheduleDraft>}`; else None. A suggestion, never a refusal. Time -> slot start (one slot per
    trigger), weekdays -> days, the Shabbat condition -> a condition on CR-014's sensor. Anything else (other conditions, choose, delay, notify ...) -> None."""
    triggers, conditions, actions = draft.get("triggers") or [], draft.get("conditions") or [], draft.get("actions") or []
    if not scheduler_present or not triggers or not actions:
        return None
    if not all(t.get("kind") == "typed" and t.get("type") in ("time", "sun") for t in triggers):
        return None
    weekdays: list[str] = []
    shabbat: str | None = None
    for c in conditions:
        if c.get("kind") != "typed":
            return None
        if c.get("type") == "time" and not c.get("after") and not c.get("before"):
            weekdays = list(c.get("weekday") or [])
        elif c.get("type") == "shabbat" and shabbat_sensor:
            shabbat = "on" if c.get("mode") == "only_holy_days" else "off"
        else:
            return None
    acts: list[dict[str, Any]] = []
    for a in actions:
        if a.get("kind") != "typed" or a.get("type") != "service" or a.get("role") != "device" or not a.get("entity_ids"):
            return None
        if a["action"].split(".")[0] not in SCHEDULE_DOMAINS:
            return None
        for eid in a["entity_ids"]:
            if sensitive_class_of(a["action"], class_of(eid) if class_of else None):
                return None
            acts.append({"service": a["action"], "entity_id": eid, "data": dict(a.get("data") or {})})
    slots = []
    for t in triggers:
        if t["type"] == "time":
            start = _hms(t["at"])
        else:
            off = int(t.get("offset_min") or 0)
            start = f"{t['event']}{'-' if off < 0 else '+'}{_fmt_offset(abs(off))}"
        slots.append({"start": start, "stop": None, "actions": [dict(x, data=dict(x["data"])) for x in acts]})
    tokens = [d for d in _WD_SHORT if d in weekdays] if weekdays and len(weekdays) < 7 else ["daily"]
    cond = ({"items": [{"entity_id": shabbat_sensor, "attribute": "state", "match_type": "is", "value": shabbat}], "type": None, "track": False}
            if shabbat and shabbat_sensor else {"items": [], "type": None, "track": False})
    return {"schedule_draft": {"name": (draft.get("alias") or "").strip() or None, "weekdays": tokens, "start_date": None, "end_date": None, "repeat": "repeat", "tags": [],
                               "conditions": cond, "slots": slots}}
