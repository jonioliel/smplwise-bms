"""CR-BLUEPRINT80 slice 1: ready-made automation blueprints (a read-only built-in library, a closed declarative format, parameter resolution).

A blueprint is declarative JSON: typed parameters plus a template in the SHAPE OF AN AUTOMATION CONFIG (triggers / conditions / actions) whose values may be
`{"$param": "<key>"}` references. It is never code and never a template string. The format is a CLOSED set (docs/changes/CR-BLUEPRINT80.md section 3):

- triggers: state, numeric_state, time, sun; conditions: state, numeric_state, time, sun; actions: a delay, or one service of `ALLOWED_SERVICES` (or the
  approved notify target), with an entity target. No nesting (no choose / if / repeat), no scripts, no automations, no templates.
- NEVER, in any blueprint, built-in or later imported: lock.*, alarm_control_panel.*, siren.*, cover.* (door / gate / garage covers are covers), script.*,
  automation.*, homeassistant.*, shell_command.* and friends, and any service whose name says unlock / open / door / gate / garage. A door-class,
  door-layer or possibly-door (virtual device of a door platform) entity is refused as an action target whatever the service. Automations that open doors stay
  under services/door_automation.py and its own gates; a blueprint can neither create them nor reference them.

`validate_definition` judges a blueprint (the built-in ones in a test, an imported one later); `resolve_params` judges the caller's values against the real
installation (entities exist, are in the caller's reach, are of the allowed domain / class; areas exist; notify targets are approved); `build_config` expands
the template into the config the SAME create path (services/automation_ops.create) receives; `check_config` is a second, independent check of the expanded
config. Nothing here talks to Home Assistant or writes to the database."""
from __future__ import annotations

import copy
import re
from typing import Any

from . import automation_policy as pol

SCHEMA_VERSION = 1
LIBRARY_VERSION = 1

CATEGORIES = ("lights", "alerts", "climate", "schedules")
PARAM_TYPES = ("entity", "entities", "area_entities", "time", "minutes", "int", "number", "text", "weekdays", "notify_target", "scene")
ALLOWED_TRIGGERS = {
    "state": {"trigger", "entity_id", "from", "to", "for", "id"},
    "numeric_state": {"trigger", "entity_id", "above", "below", "for", "id"},
    "time": {"trigger", "at", "id"},
    "sun": {"trigger", "event", "offset", "id"},
}
ALLOWED_CONDITIONS = {
    "state": {"condition", "entity_id", "state", "for"},
    "numeric_state": {"condition", "entity_id", "above", "below"},
    "time": {"condition", "after", "before", "weekday"},
    "sun": {"condition", "after", "before", "after_offset", "before_offset"},
}
# the only fixed services; `{"$param": <notify_target param>}` may stand for the action of a notification step
ALLOWED_SERVICES = frozenset({
    "light.turn_on", "light.turn_off", "switch.turn_on", "switch.turn_off", "fan.turn_on", "fan.turn_off",
    "climate.turn_off", "climate.set_temperature", "climate.set_hvac_mode", "media_player.turn_off", "scene.turn_on",
})
# domains a blueprint action can never touch (service domain or target entity domain)
FORBIDDEN_DOMAINS = frozenset({
    "lock", "alarm_control_panel", "siren", "cover", "script", "automation", "homeassistant", "shell_command", "rest_command", "hassio", "recorder",
    "smplwise_bridge", "valve", "button", "input_button", "remote", "camera",
})
FORBIDDEN_NAME_RE = re.compile(r"unlock|open|door|gate|garage|disarm|\.reload", re.IGNORECASE)
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")

_ID = re.compile(r"^[a-z][a-z0-9_]{2,40}$")
_KEY = re.compile(r"^[a-z][a-z0-9_]{0,30}$")
_ENTITY = re.compile(r"^[a-z_]+\.[a-z0-9_]{1,100}$")
_TIME = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$")
_AREA = re.compile(r"^[A-Za-z0-9_.:-]{1,100}$")
ENTITIES_MAX = 20
AREA_ENTITIES_MAX = 20
TEXT_BAD = re.compile(r"[{}<>\x00-\x08\x0b-\x1f]")


def P(key: str, ptype: str, label: str, **kw: Any) -> dict[str, Any]:
    return {"key": key, "type": ptype, "label": label, **kw}


# ================================================================ the built-in library (read-only)

LIBRARY: tuple[dict[str, Any], ...] = (
    {
        "id": "lights_off_floor_empty_night", "version": 1, "category": "lights", "icon": "mdi:lightbulb-off-outline",
        "title": "כיבוי אורות כשהאזור ריק בלילה",
        "description": "מכבה את התאורה שבחרתם כשאין תנועה באזור במשך כמה דקות, בשעות הלילה שתקבעו.",
        "parameters": [
            P("motion", "entities", "חיישני תנועה באזור", domains=["binary_sensor"], device_classes=["motion", "occupancy", "presence"], role="watch", max=10),
            P("lights", "entities", "תאורה לכיבוי", domains=["light"], role="control", max=20),
            P("minutes", "minutes", "דקות בלי תנועה", default=10, min=1, max=240),
            P("from_time", "time", "תחילת הלילה", default="23:00"),
            P("to_time", "time", "סוף הלילה", default="06:00"),
        ],
        "rules": [{"rule": "ne", "a": "from_time", "b": "to_time", "message": "שעת ההתחלה והסיום חייבות להיות שונות"}],
        "template": {
            "mode": "single",
            "triggers": [{"trigger": "state", "entity_id": {"$param": "motion"}, "to": "off", "for": {"$param": "minutes", "as": "duration"}}],
            "conditions": [{"condition": "state", "entity_id": {"$param": "motion"}, "state": "off"}, {"condition": "time", "after": {"$param": "from_time"}, "before": {"$param": "to_time"}}],
            "actions": [{"action": "light.turn_off", "target": {"entity_id": {"$param": "lights"}}}],
        },
    },
    {
        "id": "door_left_open_notify", "version": 1, "category": "alerts", "icon": "mdi:door-open",
        "title": "התראה על דלת או חלון שנשארו פתוחים",
        "description": "שולח הודעה כשחיישן דלת או חלון נשאר במצב פתוח יותר מהזמן שתקבעו. ההתראה אינה פותחת או סוגרת דבר.",
        "parameters": [
            P("sensors", "entities", "חיישני דלת או חלון", domains=["binary_sensor"], device_classes=["door", "window", "opening", "garage_door"], role="watch", max=10),
            P("minutes", "minutes", "דקות פתוח עד ההתראה", default=5, min=1, max=720),
            P("notify", "notify_target", "ערוץ ההודעה"),
            P("message", "text", "נוסח ההודעה", default="דלת או חלון פתוחים זמן רב", max=200),
        ],
        "template": {
            "mode": "single",
            "triggers": [{"trigger": "state", "entity_id": {"$param": "sensors"}, "to": "on", "for": {"$param": "minutes", "as": "duration"}}],
            "conditions": [],
            "actions": [{"action": {"$param": "notify"}, "data": {"message": {"$param": "message"}}}],
        },
    },
    {
        "id": "temperature_out_of_range", "version": 1, "category": "alerts", "icon": "mdi:thermometer-alert",
        "title": "התראת טמפרטורה חריגה",
        "description": "שולח הודעה כשהטמפרטורה בחיישן עולה מעל הגבול העליון או יורדת מתחת לגבול התחתון.",
        "parameters": [
            P("sensor", "entity", "חיישן טמפרטורה", domains=["sensor"], device_classes=["temperature"], role="watch"),
            P("low", "number", "גבול תחתון (מעלות)", default=16, min=-30, max=60),
            P("high", "number", "גבול עליון (מעלות)", default=30, min=-30, max=60),
            P("notify", "notify_target", "ערוץ ההודעה"),
            P("message", "text", "נוסח ההודעה", default="הטמפרטורה חורגת מהטווח שהוגדר", max=200),
        ],
        "rules": [{"rule": "lt", "a": "low", "b": "high", "message": "הגבול התחתון חייב להיות נמוך מהעליון"}],
        "template": {
            "mode": "single",
            "triggers": [{"trigger": "numeric_state", "entity_id": [{"$param": "sensor"}], "above": {"$param": "high"}},
                         {"trigger": "numeric_state", "entity_id": [{"$param": "sensor"}], "below": {"$param": "low"}}],
            "conditions": [],
            "actions": [{"action": {"$param": "notify"}, "data": {"message": {"$param": "message"}}}],
        },
    },
    {
        "id": "scheduled_scene", "version": 1, "category": "schedules", "icon": "mdi:calendar-clock",
        "title": "הפעלת סצנה בשעה קבועה",
        "description": "מפעיל סצנה קיימת בשעה שתקבעו, בימים שתבחרו.",
        "parameters": [
            P("scene", "scene", "סצנה"),
            P("at", "time", "שעה", default="19:00"),
            P("days", "weekdays", "ימים", default=["sun", "mon", "tue", "wed", "thu", "fri", "sat"]),
        ],
        "template": {
            "mode": "single",
            "triggers": [{"trigger": "time", "at": {"$param": "at"}}],
            "conditions": [{"condition": "time", "weekday": {"$param": "days"}}],
            "actions": [{"action": "scene.turn_on", "target": {"entity_id": [{"$param": "scene"}]}}],
        },
    },
    {
        "id": "motion_light_timer", "version": 1, "category": "lights", "icon": "mdi:motion-sensor",
        "title": "תאורה בתנועה עם כיבוי אוטומטי",
        "description": "מדליק תאורה כשיש תנועה ומכבה אותה אחרי כמה דקות.",
        "parameters": [
            P("motion", "entities", "חיישני תנועה", domains=["binary_sensor"], device_classes=["motion", "occupancy", "presence"], role="watch", max=10),
            P("lights", "entities", "תאורה", domains=["light"], role="control", max=20),
            P("brightness", "int", "עוצמת תאורה (אחוזים)", default=60, min=1, max=100),
            P("minutes", "minutes", "דקות עד הכיבוי", default=5, min=1, max=240),
        ],
        "template": {
            "mode": "restart",
            "triggers": [{"trigger": "state", "entity_id": {"$param": "motion"}, "to": "on"}],
            "conditions": [],
            "actions": [{"action": "light.turn_on", "target": {"entity_id": {"$param": "lights"}}, "data": {"brightness_pct": {"$param": "brightness"}}},
                        {"delay": {"$param": "minutes", "as": "duration"}},
                        {"action": "light.turn_off", "target": {"entity_id": {"$param": "lights"}}}],
        },
    },
    {
        "id": "water_leak_notify", "version": 1, "category": "alerts", "icon": "mdi:water-alert",
        "title": "התראת נזילת מים",
        "description": "שולח הודעה מיד כשחיישן הצפה מזהה מים.",
        "parameters": [
            P("sensors", "entities", "חיישני הצפה", domains=["binary_sensor"], device_classes=["moisture"], role="watch", max=10),
            P("notify", "notify_target", "ערוץ ההודעה"),
            P("message", "text", "נוסח ההודעה", default="זוהתה נזילת מים", max=200),
        ],
        "template": {
            "mode": "single",
            "triggers": [{"trigger": "state", "entity_id": {"$param": "sensors"}, "to": "on"}],
            "conditions": [],
            "actions": [{"action": {"$param": "notify"}, "data": {"message": {"$param": "message"}}}],
        },
    },
    {
        "id": "ac_off_window_open", "version": 1, "category": "climate", "icon": "mdi:air-conditioner",
        "title": "כיבוי מזגן כשחלון פתוח",
        "description": "מכבה מזגן כשחלון נשאר פתוח יותר מכמה דקות.",
        "parameters": [
            P("windows", "entities", "חיישני חלון", domains=["binary_sensor"], device_classes=["window", "opening"], role="watch", max=10),
            P("climate", "entities", "מזגנים לכיבוי", domains=["climate"], role="control", max=10),
            P("minutes", "minutes", "דקות פתוח עד הכיבוי", default=3, min=1, max=120),
        ],
        "template": {
            "mode": "single",
            "triggers": [{"trigger": "state", "entity_id": {"$param": "windows"}, "to": "on", "for": {"$param": "minutes", "as": "duration"}}],
            "conditions": [],
            "actions": [{"action": "climate.turn_off", "target": {"entity_id": {"$param": "climate"}}}],
        },
    },
    {
        "id": "area_lights_at_sunset", "version": 1, "category": "lights", "icon": "mdi:weather-sunset",
        "title": "תאורת אזור בשקיעה",
        "description": "מדליק את כל התאורה של אזור שתבחרו בשקיעה, עם הקדמה או איחור בדקות לפי הצורך.",
        "parameters": [
            P("area", "area_entities", "אזור", domains=["light"], by="area", role="control"),
            P("offset", "int", "הקדמה (מינוס) או איחור (פלוס) בדקות", default=0, min=-120, max=120),
            P("brightness", "int", "עוצמת תאורה (אחוזים)", default=70, min=1, max=100),
        ],
        "template": {
            "mode": "single",
            "triggers": [{"trigger": "sun", "event": "sunset", "offset": {"$param": "offset", "as": "offset_text"}}],
            "conditions": [],
            "actions": [{"action": "light.turn_on", "target": {"entity_id": {"$param": "area"}}, "data": {"brightness_pct": {"$param": "brightness"}}}],
        },
    },
)


def library() -> list[dict[str, Any]]:
    return copy.deepcopy(list(LIBRARY))


def get(blueprint_id: str) -> dict[str, Any] | None:
    for bp in LIBRARY:
        if bp["id"] == blueprint_id:
            return copy.deepcopy(bp)
    return None


def public_view(bp: dict[str, Any]) -> dict[str, Any]:
    """What a client is shown: the metadata and the parameter specs (never the template; the server expands it)."""
    return {"id": bp["id"], "version": bp["version"], "schema": SCHEMA_VERSION, "category": bp["category"], "icon": bp["icon"], "title": bp["title"], "description": bp["description"],
            "parameters": copy.deepcopy(bp["parameters"]), "sensitive": False, "builtin": True}


# ================================================================ definition validation (also the gate of a later import)

def _refs(node: Any, out: list[tuple[str, str | None]]) -> None:
    if isinstance(node, dict):
        if "$param" in node:
            out.append((node["$param"], node.get("as")))
            return
        for v in node.values():
            _refs(v, out)
    elif isinstance(node, list):
        for v in node:
            _refs(v, out)


def validate_definition(bp: Any) -> list[str]:
    """The problems of one blueprint definition (empty = acceptable). Pure; closed: anything not listed is a problem."""
    errs: list[str] = []
    if not isinstance(bp, dict):
        return ["definition is not an object"]
    unknown = set(bp) - {"id", "version", "category", "icon", "title", "description", "parameters", "rules", "template"}
    if unknown:
        errs.append(f"unknown keys {sorted(unknown)}")
    if not isinstance(bp.get("id"), str) or not _ID.match(bp["id"]):
        errs.append("bad id")
    if not isinstance(bp.get("version"), int) or isinstance(bp.get("version"), bool) or bp["version"] < 1:
        errs.append("bad version")
    if bp.get("category") not in CATEGORIES:
        errs.append("bad category")
    for k, lim in (("title", 80), ("description", 300)):
        if not isinstance(bp.get(k), str) or not bp[k].strip() or len(bp[k]) > lim:
            errs.append(f"bad {k}")
    params = bp.get("parameters")
    keys: dict[str, dict[str, Any]] = {}
    if not isinstance(params, list) or not params or len(params) > 12:
        errs.append("parameters: 1-12 required")
        params = []
    for p in params:
        if not isinstance(p, dict) or not isinstance(p.get("key"), str) or not _KEY.match(p["key"]) or p["key"] in keys:
            errs.append("bad or duplicate parameter key")
            continue
        keys[p["key"]] = p
        if p.get("type") not in PARAM_TYPES:
            errs.append(f"{p['key']}: bad type")
        if not isinstance(p.get("label"), str) or not p["label"].strip():
            errs.append(f"{p['key']}: label required")
        if p.get("type") in ("entity", "entities", "area_entities"):
            doms = p.get("domains")
            if not isinstance(doms, list) or not doms or any(not isinstance(d, str) for d in doms):
                errs.append(f"{p['key']}: domains required")
            elif p.get("role") == "control" and set(doms) & FORBIDDEN_DOMAINS:
                errs.append(f"{p['key']}: forbidden domain for a controlled entity")
            if p.get("role") not in ("watch", "control"):
                errs.append(f"{p['key']}: role must be watch or control")
    for r in bp.get("rules") or []:
        if not isinstance(r, dict) or r.get("rule") not in ("lt", "ne") or r.get("a") not in keys or r.get("b") not in keys:
            errs.append("bad rule")
    tpl = bp.get("template")
    if not isinstance(tpl, dict) or set(tpl) - {"mode", "triggers", "conditions", "actions"}:
        return errs + ["template: keys must be mode / triggers / conditions / actions"]
    if tpl.get("mode") not in ("single", "restart"):
        errs.append("template: mode must be single or restart")
    refs: list[tuple[str, str | None]] = []
    _refs(tpl, refs)
    used = {k for k, _a in refs}
    for k, as_ in refs:
        if k not in keys:
            errs.append(f"template uses undeclared parameter {k}")
        elif as_ not in (None, "duration", "offset_text"):
            errs.append(f"{k}: bad conversion {as_}")
    for k in keys:
        if k not in used:
            errs.append(f"parameter {k} is never used")
    for i, t in enumerate(tpl.get("triggers") or []):
        if not isinstance(t, dict) or t.get("trigger") not in ALLOWED_TRIGGERS:
            errs.append(f"triggers.{i}: trigger type not allowed")
        elif set(t) - ALLOWED_TRIGGERS[t["trigger"]]:
            errs.append(f"triggers.{i}: keys not allowed")
    if not tpl.get("triggers"):
        errs.append("template: a trigger is required")
    for i, c in enumerate(tpl.get("conditions") or []):
        if not isinstance(c, dict) or c.get("condition") not in ALLOWED_CONDITIONS:
            errs.append(f"conditions.{i}: condition type not allowed")
        elif set(c) - ALLOWED_CONDITIONS[c["condition"]]:
            errs.append(f"conditions.{i}: keys not allowed")
    if not tpl.get("actions"):
        errs.append("template: an action is required")
    for i, a in enumerate(tpl.get("actions") or []):
        errs.extend(_action_problems(i, a, keys))
    return errs


def _action_problems(i: int, a: Any, keys: dict[str, dict[str, Any]]) -> list[str]:
    if not isinstance(a, dict):
        return [f"actions.{i}: not an object"]
    if set(a) == {"delay"}:
        return []
    if set(a) - {"action", "target", "data"} or "action" not in a:
        return [f"actions.{i}: keys not allowed"]
    svc = a["action"]
    out: list[str] = []
    if isinstance(svc, dict):
        p = keys.get(svc.get("$param"))
        if p is None or p.get("type") != "notify_target" or set(svc) != {"$param"}:
            out.append(f"actions.{i}: a parameter may stand for a notify target only")
    elif not isinstance(svc, str) or svc not in ALLOWED_SERVICES:
        out.append(f"actions.{i}: service not allowed")
    if isinstance(svc, str):
        if svc.split(".", 1)[0] in FORBIDDEN_DOMAINS or FORBIDDEN_NAME_RE.search(svc):
            out.append(f"actions.{i}: forbidden service")
    tgt = a.get("target")
    if tgt is not None and (not isinstance(tgt, dict) or set(tgt) != {"entity_id"}):
        out.append(f"actions.{i}: only an entity target is allowed")
    if tgt is None and isinstance(svc, str) and not svc.startswith("notify."):
        out.append(f"actions.{i}: a device step needs an entity target")
    return out


# ================================================================ parameters against the installation

class Problem(Exception):
    def __init__(self, param: str, code: str, message: str) -> None:
        super().__init__(code)
        self.param, self.code, self.message = param, code, message

    def as_dict(self) -> dict[str, str]:
        return {"param": self.param, "code": self.code, "message": self.message}


class Env:
    """What the installation tells the resolver (the route passes the scope Ctx; tests may pass a fake): `entity(e)`, `can_read(e)`, `sensitive(e)`,
    `area_entities(by, id)`, `scene_ok(e)`, `notify_targets`."""

    def entity(self, entity_id: str) -> dict[str, Any] | None:  # pragma: no cover - interface
        raise NotImplementedError

    def can_read(self, entity_id: str) -> bool:  # pragma: no cover
        raise NotImplementedError

    def sensitive(self, entity_id: str) -> bool:  # pragma: no cover
        raise NotImplementedError

    def area_entities(self, by: str, ident: str, domains: list[str]) -> list[str] | None:  # pragma: no cover
        raise NotImplementedError

    notify_targets: tuple[str, ...] = ()


def _entity_one(p: dict[str, Any], v: Any, env: Env) -> str:
    key = p["key"]
    if not isinstance(v, str) or not _ENTITY.match(v):
        raise Problem(key, "entity_invalid", "מזהה מכשיר לא תקין")
    info = env.entity(v)
    if info is None:
        raise Problem(key, "entity_unknown", "המכשיר לא נמצא במערכת")
    domain = v.split(".", 1)[0]
    if domain not in p["domains"]:
        raise Problem(key, "entity_domain", "סוג המכשיר אינו מתאים לשדה זה")
    classes = p.get("device_classes")
    if classes and (info.get("device_class") or "") not in classes:
        raise Problem(key, "entity_class", "סוג החיישן אינו מתאים לשדה זה")
    if not env.can_read(v):
        raise Problem(key, "entity_not_in_reach", "המכשיר מחוץ להיקף ההרשאות שלכם")
    if p.get("role") == "control" and env.sensitive(v):
        raise Problem(key, "entity_not_allowed", "לא ניתן להשתמש במכשיר רגיש או בקשור לדלת בתבנית מוכנה")
    return v


def _int_in(key: str, v: Any, lo: int, hi: int) -> int:
    if isinstance(v, bool) or not isinstance(v, int) or not lo <= v <= hi:
        raise Problem(key, "out_of_range", f"ערך בין {lo} ל־{hi}")
    return v


def _resolve_one(p: dict[str, Any], v: Any, env: Env) -> Any:
    key, t = p["key"], p["type"]
    if t == "entity":
        return _entity_one(p, v, env)
    if t == "entities":
        if not isinstance(v, list) or not v:
            raise Problem(key, "required", "בחרו לפחות מכשיר אחד")
        mx = min(int(p.get("max", ENTITIES_MAX)), ENTITIES_MAX)
        if len(v) > mx:
            raise Problem(key, "too_many", f"עד {mx} מכשירים")
        out: list[str] = []
        for e in v:
            e = _entity_one(p, e, env)
            if e not in out:
                out.append(e)
        return out
    if t == "area_entities":
        if not isinstance(v, str) or not _AREA.match(v):
            raise Problem(key, "area_invalid", "אזור לא תקין")
        found = env.area_entities(p.get("by", "area"), v, list(p["domains"]))
        if found is None:
            raise Problem(key, "area_unknown", "האזור לא נמצא")
        out = []
        for e in found:
            try:
                out.append(_entity_one({**p, "device_classes": None}, e, env))
            except Problem:
                continue  # an entity of the area that is out of reach, sensitive or of another class is simply not part of it
        if not out:
            raise Problem(key, "area_empty", "באזור אין מכשירים מתאימים שמותר לכם לשלוט בהם")
        return out[:AREA_ENTITIES_MAX]
    if t == "time":
        m = _TIME.match(v) if isinstance(v, str) else None
        if not m:
            raise Problem(key, "time_invalid", "שעה בפורמט HH:MM")
        return f"{m.group(1)}:{m.group(2)}:{m.group(3) or '00'}"
    if t == "minutes":
        return _int_in(key, v, int(p.get("min", 1)), int(p.get("max", 1440)))
    if t == "int":
        return _int_in(key, v, int(p.get("min", 0)), int(p.get("max", 100)))
    if t == "number":
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not float(p.get("min", -1e6)) <= v <= float(p.get("max", 1e6)):
            raise Problem(key, "out_of_range", f"ערך בין {p.get('min')} ל־{p.get('max')}")
        return v
    if t == "text":
        if not isinstance(v, str) or not v.strip() or len(v) > int(p.get("max", 200)) or TEXT_BAD.search(v):
            raise Problem(key, "text_invalid", "טקסט לא תקין (ריק, ארוך מדי או עם תווים אסורים)")
        return v.strip()
    if t == "weekdays":
        if not isinstance(v, list) or not v or any(d not in WEEKDAYS for d in v):
            raise Problem(key, "weekdays_invalid", "בחרו ימים")
        return [d for d in WEEKDAYS if d in v]
    if t == "notify_target":
        if not isinstance(v, str) or v not in env.notify_targets:
            raise Problem(key, "notify_not_approved", "ערוץ ההודעה אינו מאושר בהגדרות")
        return v
    if t == "scene":
        if not isinstance(v, str) or not v.startswith("scene.") or not _ENTITY.match(v):
            raise Problem(key, "entity_invalid", "מזהה סצנה לא תקין")
        if env.entity(v) is None:
            raise Problem(key, "entity_unknown", "הסצנה לא נמצאה")
        if not env.can_read(v):
            raise Problem(key, "entity_not_in_reach", "הסצנה מחוץ להיקף ההרשאות שלכם")
        return v
    raise Problem(key, "type_unknown", "סוג שדה לא מוכר")  # pragma: no cover - validate_definition keeps this out


def resolve_params(bp: dict[str, Any], raw: Any, env: Env) -> tuple[dict[str, Any], list[dict[str, str]]]:
    """(values, problems): every declared parameter judged against the installation; a foreign key is a problem; defaults fill what the caller left out."""
    problems: list[dict[str, str]] = []
    if not isinstance(raw, dict):
        return {}, [{"param": "", "code": "params_invalid", "message": "הפרמטרים חייבים להיות אובייקט"}]
    declared = {p["key"]: p for p in bp["parameters"]}
    for k in raw:
        if k not in declared:
            problems.append({"param": str(k), "code": "unknown_param", "message": "שדה לא מוכר"})
    values: dict[str, Any] = {}
    for p in bp["parameters"]:
        k = p["key"]
        v = raw.get(k, p.get("default"))
        if v is None:
            if k not in raw and p["type"] == "notify_target" and env.notify_targets:
                v = env.notify_targets[0]
            else:
                problems.append({"param": k, "code": "required", "message": "שדה חובה"})
                continue
        try:
            values[k] = _resolve_one(p, v, env)
        except Problem as exc:
            problems.append(exc.as_dict())
    for r in bp.get("rules") or []:
        a, b = values.get(r["a"]), values.get(r["b"])
        if a is None or b is None:
            continue
        if (r["rule"] == "lt" and not a < b) or (r["rule"] == "ne" and a == b):
            problems.append({"param": r["a"], "code": "rule", "message": r["message"]})
    return values, problems


# ================================================================ expansion

def _subst(node: Any, values: dict[str, Any]) -> Any:
    if isinstance(node, dict):
        if "$param" in node:
            v = copy.deepcopy(values[node["$param"]])
            if node.get("as") == "duration":
                return {"hours": 0, "minutes": int(v), "seconds": 0}
            if node.get("as") == "offset_text":
                n = int(v)
                return f"{'-' if n < 0 else ''}{abs(n) // 60:02d}:{abs(n) % 60:02d}:00"
            return v
        return {k: _subst(x, values) for k, x in node.items()}
    if isinstance(node, list):
        out: list[Any] = []
        for x in node:
            s = _subst(x, values)
            if isinstance(x, dict) and "$param" in x and isinstance(s, list):
                out.extend(s)  # a reference to a list inside a list is spliced in
            else:
                out.append(s)
        return out
    return copy.deepcopy(node)


def build_config(bp: dict[str, Any], values: dict[str, Any], alias: str | None = None) -> dict[str, Any]:
    """The automation config a blueprint stands for with these values (new HA schema, key order of the model). No id: the create path assigns it."""
    tpl = _subst(bp["template"], values)
    return {"alias": (alias or bp["title"]).strip(), "description": bp["description"], "mode": tpl["mode"], "triggers": tpl["triggers"], "conditions": tpl.get("conditions") or [],
            "actions": tpl["actions"]}


def check_config(config: dict[str, Any], env: Env, notify_targets: tuple[str, ...]) -> list[dict[str, str]]:
    """The second, independent check of an EXPANDED config (so an imported blueprint with a bug in its definition still cannot slip a door action through):
    only closed services, no forbidden domain or name, no target the installation calls sensitive or door-related."""
    out: list[dict[str, str]] = []
    for i, a in enumerate(config.get("actions") or []):
        if not isinstance(a, dict):
            out.append({"param": f"actions.{i}", "code": "blueprint_forbidden_action", "message": "פעולה לא נתמכת בתבנית מוכנה"})
            continue
        if "delay" in a and len(a) == 1:
            continue
        svc = a.get("action")
        if not isinstance(svc, str):
            out.append({"param": f"actions.{i}", "code": "blueprint_forbidden_action", "message": "פעולה לא נתמכת בתבנית מוכנה"})
            continue
        domain = svc.split(".", 1)[0]
        ok = svc in ALLOWED_SERVICES or (svc in notify_targets and domain == "notify")
        if not ok or domain in FORBIDDEN_DOMAINS or FORBIDDEN_NAME_RE.search(svc):
            out.append({"param": f"actions.{i}", "code": "blueprint_forbidden_action", "message": "תבנית מוכנה אינה יכולה לבצע פעולה זו (דלתות, מנעולים, אזעקה וצופרים אסורים)"})
        ents = (a.get("target") or {}).get("entity_id")
        for e in (ents if isinstance(ents, list) else [ents] if ents else []):
            if not isinstance(e, str) or e.split(".", 1)[0] in FORBIDDEN_DOMAINS or env.sensitive(e):
                out.append({"param": f"actions.{i}", "code": "blueprint_forbidden_target", "message": "לא ניתן להשתמש במכשיר רגיש או בקשור לדלת בתבנית מוכנה"})
    return out
