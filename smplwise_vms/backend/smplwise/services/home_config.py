"""The home screen's widget configuration (home redesign, owner decisions 2026-09-30): pure functions, no database.

One installation config (setting `home.widgets`, a JSON object read back as an object) plus an optional PERSONAL override
of the users who hold `screen.personalize` (/me/prefs `home.personal`). The screen has three directions - a: control
centre (a wide band above everything), b: side panel, c: compact single row - and five widgets: the clock, the weather,
Shabbat (the Jewish calendar), the alarm status card (read-only) and the quick actions. Everything about a widget is
editable: on / off, its size (s / m / l - per direction, because the three layouts pack differently), its heading, the
order, and which entity feeds each field (the weather entity and the fields of it to show, one sensor per Jewish-calendar
field). Nothing here is a permission: the actions, the alarm and the entities are still authorised by the server on their
own routes; this only shapes what is drawn.

Canonical config (what `normalise` returns and the setting stores; every key is optional on input and filled with the
default, an unknown key is refused - this is never free-form client storage):

    {"order": ["clock", "weather", "shabbat", "alarm", "quick"],
     "clock":    {"on", "sizes": {"a", "b", "c"}, "label", "mode": "time|datetime", "seconds", "hebrew"},
     "weather":  {"on", "sizes", "label", "entity", "fields": [...], "forecast": "3|5|max", "sources": {field: sensor}},
     "shabbat":  {"on", "sizes", "label"},
     "alarm":    {"on", "sizes", "label", "entity"},
     "quick":    {"on", "sizes", "label", "actions": ["lights_off", "all_off"]},
     "calendar": {"date", "parsha", "candles", "havdalah", "holiday", "extras": [{"entity_id", "label"}]}}
"""
from __future__ import annotations

import copy
import json
import re
from typing import Any, Callable

DIRECTIONS = ("a", "b", "c")
DEFAULT_DIRECTION = "a"  # owner decision 2026-09-30: the control centre
SIDES = ("start", "end")
DEFAULT_SIDE = "end"
WIDGET_IDS = ("clock", "weather", "shabbat", "alarm", "quick")
SIZES = ("s", "m", "l")
LEGACY_SIZES = {"chip": "s", "medium": "m", "large": "l"}  # the 0.1.146 sizes (home.clock_size ...)
# what each direction packs well: the hero band of a takes the big cards, the side column of b the small ones (the mockup)
DEFAULT_SIZES: dict[str, dict[str, str]] = {
    "clock": {"a": "l", "b": "m", "c": "m"},
    "weather": {"a": "l", "b": "m", "c": "m"},
    "shabbat": {"a": "m", "b": "m", "c": "m"},
    "alarm": {"a": "m", "b": "s", "c": "m"},
    "quick": {"a": "m", "b": "s", "c": "m"},
}
CLOCK_MODES = ("time", "datetime")
WEATHER_FIELDS = ("condition", "temperature", "apparent", "humidity", "wind", "pressure", "visibility", "uv", "precipitation", "forecast")
# the numeric fields a sensor may feed instead of the weather entity's own attribute
WEATHER_SOURCE_FIELDS = ("temperature", "apparent", "humidity", "wind", "pressure", "visibility", "uv", "precipitation")
DEFAULT_WEATHER_FIELDS = ["temperature", "condition", "humidity", "wind", "forecast"]
FORECAST_LENS = ("3", "5", "max")
QUICK_ACTIONS = ("lights_off", "all_off")
CALENDAR_FIELDS = ("date", "parsha", "candles", "havdalah", "holiday")
LABEL_MAX = 30
EXTRAS_MAX = 4
CONFIG_MAX_JSON = 8000

_WEATHER = re.compile(r"^weather\.[a-z0-9_]{1,100}$")
_SENSOR = re.compile(r"^sensor\.[a-z0-9_]{1,100}$")
_EXTRA = re.compile(r"^(sensor|binary_sensor)\.[a-z0-9_]{1,100}$")
_ALARM = re.compile(r"^alarm_control_panel\.[a-z0-9_]{1,100}$")


def _default_widget(wid: str) -> dict[str, Any]:
    base: dict[str, Any] = {"on": True, "sizes": dict(DEFAULT_SIZES[wid]), "label": ""}
    if wid == "clock":
        base.update({"mode": "datetime", "seconds": False, "hebrew": True})
    elif wid == "weather":
        base.update({"entity": "", "fields": list(DEFAULT_WEATHER_FIELDS), "forecast": "5", "sources": {}})
    elif wid == "alarm":
        base.update({"entity": ""})
    elif wid == "quick":
        base.update({"actions": list(QUICK_ACTIONS)})
    return base


def default_config() -> dict[str, Any]:
    """The built-in configuration (no entities: `home_screen.default_config` adds the suggestions the catalogue offers)."""
    cfg: dict[str, Any] = {"order": list(WIDGET_IDS)}
    for wid in WIDGET_IDS:
        cfg[wid] = _default_widget(wid)
    cfg["calendar"] = {**{f: "" for f in CALENDAR_FIELDS}, "extras": []}
    return cfg


# ------------------------------------------------------------------------------------------------ validation helpers


def _obj(value: Any, name: str, allowed: set[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be an object")
    extra = set(value) - allowed
    if extra:
        raise ValueError(f"{name}: unknown key {sorted(extra)[0]}")
    return value


def _bool(value: Any, name: str) -> bool:
    if not isinstance(value, bool):
        raise ValueError(f"{name} must be true or false")
    return value


def _choice(value: Any, allowed: tuple[str, ...], name: str) -> str:
    if not isinstance(value, str) or value not in allowed:
        raise ValueError(f"{name} must be one of {', '.join(allowed)}")
    return value


def _label(value: Any, name: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{name} must be text")
    text = value.strip()
    if len(text) > LABEL_MAX or any(ord(c) < 32 or ord(c) == 127 for c in text):
        raise ValueError(f"{name} must be plain text of at most {LABEL_MAX} characters")
    return text


def _entity(value: Any, pattern: re.Pattern[str], name: str) -> str:
    if not isinstance(value, str) or (value and not pattern.match(value)):
        raise ValueError(f"{name} is not a valid entity id")
    return value


def _sizes(value: Any, wid: str) -> dict[str, str]:
    given = _obj(value, f"{wid}.sizes", set(DIRECTIONS))
    out = dict(DEFAULT_SIZES[wid])
    for d, s in given.items():
        out[d] = _choice(s, SIZES, f"{wid}.sizes.{d}")
    return out


def _ordered_subset(value: Any, allowed: tuple[str, ...], name: str) -> list[str]:
    if not isinstance(value, list) or len(value) > len(allowed):
        raise ValueError(f"{name} must be a list")
    out: list[str] = []
    for item in value:
        _choice(item, allowed, name)
        if item not in out:
            out.append(item)
    return out


def _widget(wid: str, value: Any) -> dict[str, Any]:
    common = {"on", "sizes", "label"}
    extra = {"clock": {"mode", "seconds", "hebrew"}, "weather": {"entity", "fields", "forecast", "sources"}, "shabbat": set(), "alarm": {"entity"}, "quick": {"actions"}}[wid]
    given = _obj(value, wid, common | extra)
    out = _default_widget(wid)
    if "on" in given:
        out["on"] = _bool(given["on"], f"{wid}.on")
    if "sizes" in given:
        out["sizes"] = _sizes(given["sizes"], wid)
    if "label" in given:
        out["label"] = _label(given["label"], f"{wid}.label")
    if wid == "clock":
        if "mode" in given:
            out["mode"] = _choice(given["mode"], CLOCK_MODES, "clock.mode")
        for k in ("seconds", "hebrew"):
            if k in given:
                out[k] = _bool(given[k], f"clock.{k}")
    elif wid == "weather":
        if "entity" in given:
            out["entity"] = _entity(given["entity"], _WEATHER, "weather.entity")
        if "fields" in given:
            out["fields"] = _ordered_subset(given["fields"], WEATHER_FIELDS, "weather.fields")
        if "forecast" in given:
            out["forecast"] = _choice(given["forecast"], FORECAST_LENS, "weather.forecast")
        if "sources" in given:
            src = _obj(given["sources"], "weather.sources", set(WEATHER_SOURCE_FIELDS))
            out["sources"] = {k: _entity(v, _SENSOR, f"weather.sources.{k}") for k, v in src.items() if v}
    elif wid == "alarm":
        if "entity" in given:
            out["entity"] = _entity(given["entity"], _ALARM, "alarm.entity")
    elif wid == "quick":
        if "actions" in given:
            out["actions"] = _ordered_subset(given["actions"], QUICK_ACTIONS, "quick.actions")
    return out


def _calendar(value: Any) -> dict[str, Any]:
    given = _obj(value, "calendar", set(CALENDAR_FIELDS) | {"extras"})
    out = {**{f: "" for f in CALENDAR_FIELDS}, "extras": []}
    for f in CALENDAR_FIELDS:
        if f in given:
            out[f] = _entity(given[f], _SENSOR, f"calendar.{f}")
    if "extras" in given:
        extras = given["extras"]
        if not isinstance(extras, list) or len(extras) > EXTRAS_MAX:
            raise ValueError(f"calendar.extras must be a list of at most {EXTRAS_MAX}")
        seen: set[str] = set()
        for item in extras:
            e = _obj(item, "calendar.extras item", {"entity_id", "label"})
            eid = _entity(e.get("entity_id", ""), _EXTRA, "calendar.extras.entity_id")
            if not eid or eid in seen:
                raise ValueError("calendar.extras needs distinct entities")
            seen.add(eid)
            out["extras"].append({"entity_id": eid, "label": _label(e.get("label", ""), "calendar.extras.label")})
    return out


def normalise(value: Any) -> dict[str, Any]:
    """A config coming from a client or from storage in its canonical form, or ValueError. Missing parts take the default."""
    given = _obj(value, "home.widgets", {"order", "calendar", *WIDGET_IDS})
    cfg = default_config()
    if "order" in given:
        raw = given["order"]
        if not isinstance(raw, list) or len(raw) > len(WIDGET_IDS):
            raise ValueError("order must be a list of widget ids")
        seen: list[str] = []
        for item in raw:
            if not isinstance(item, str) or item not in WIDGET_IDS:
                raise ValueError("order holds an unknown widget id")
            if item not in seen:
                seen.append(item)
        cfg["order"] = seen + [w for w in WIDGET_IDS if w not in seen]
    for wid in WIDGET_IDS:
        if wid in given:
            cfg[wid] = _widget(wid, given[wid])
    if "calendar" in given:
        cfg["calendar"] = _calendar(given["calendar"])
    if len(json.dumps(cfg, ensure_ascii=False)) > CONFIG_MAX_JSON:
        raise ValueError("home.widgets is too large")
    return cfg


def parse_stored(raw: str | None) -> dict[str, Any] | None:
    """The stored setting: a canonical config, or None for 'not set' / anything unreadable (an old or hand-edited value
    reads as the default, never as an error for the screen)."""
    if not raw or not raw.strip():
        return None
    try:
        return normalise(json.loads(raw))
    except (ValueError, TypeError):
        return None


# ------------------------------------------------------------------------------------------------ defaults from the catalogue

# The Jewish Calendar integration's entity ids (platform `jewish_calendar`): the first rule that matches wins for a field.
_CALENDAR_RULES: dict[str, tuple[str, ...]] = {
    "date": (r"_date$", r"hebrew_date"),
    "parsha": (r"weekly_portion", r"parsha", r"parshat"),
    "candles": (r"upcoming_shabbat_candle_lighting", r"upcoming_candle_lighting", r"candle_lighting", r"candle"),
    "havdalah": (r"upcoming_shabbat_havdalah", r"upcoming_havdalah", r"havdalah"),
    "holiday": (r"_holiday$", r"holiday"),
}


def suggest_calendar(sensor_ids: list[str]) -> dict[str, str]:
    """A sensible sensor per Jewish-calendar field from the ids of the Jewish Calendar integration's sensors ('' = none
    found). Deterministic: the ids are looked at in sorted order."""
    ids = sorted(sensor_ids)
    out: dict[str, str] = {}
    for field, rules in _CALENDAR_RULES.items():
        pick = ""
        for rule in rules:
            pick = next((i for i in ids if re.search(rule, i) and i not in out.values()), "")
            if pick:
                break
        out[field] = pick
    return out


def with_suggestions(cfg: dict[str, Any], weather_ids: list[str], calendar_sensor_ids: list[str]) -> dict[str, Any]:
    """`cfg` with the catalogue's suggestions filled in where nothing is chosen (weather entity, calendar sensors)."""
    out = copy.deepcopy(cfg)
    if not out["weather"]["entity"] and weather_ids:
        out["weather"]["entity"] = sorted(weather_ids)[0]
    sug = suggest_calendar(calendar_sensor_ids)
    for f in CALENDAR_FIELDS:
        if not out["calendar"][f]:
            out["calendar"][f] = sug.get(f, "")
    return out


def from_legacy(get: Callable[[str, str], str]) -> dict[str, Any] | None:
    """The 0.1.146 `home.clock` / `home.weather` / `home.jewish` keys as a config, or None when none of them was ever
    switched on (then the built-in default with suggestions applies). `get(key, default)` reads a setting."""
    clock = get("home.clock", "off")
    weather_on = get("home.weather", "false") == "true"
    jewish_on = get("home.jewish", "false") == "true"
    if clock == "off" and not weather_on and not jewish_on:
        return None

    def size(key: str) -> dict[str, str]:
        s = LEGACY_SIZES.get(get(key, "medium"), "m")
        return {d: s for d in DIRECTIONS}

    cfg = default_config()
    cfg["clock"].update({"on": clock in CLOCK_MODES, "mode": clock if clock in CLOCK_MODES else "datetime", "seconds": get("home.clock_seconds", "false") == "true", "sizes": size("home.clock_size")})
    cfg["weather"].update({"on": weather_on, "entity": get("home.weather_entity", ""), "sizes": size("home.weather_size")})
    cfg["shabbat"].update({"on": jewish_on, "sizes": size("home.jewish_size")})
    cfg["calendar"].update({"parsha": get("home.jewish_parsha", ""), "candles": get("home.jewish_candles", ""), "havdalah": get("home.jewish_havdalah", ""), "date": get("home.jewish_date", "")})
    try:
        return normalise(cfg)
    except ValueError:  # a hand-edited legacy value: start from the default instead
        return None


# ------------------------------------------------------------------------------------------------ the personal override

PERSONAL_WIDGET_KEYS = {"on", "size"}


def normalise_personal(value: Any) -> dict[str, Any]:
    """`home.personal` of /me/prefs: {"direction": a|b|c|null, "order": [ids]|null, "widgets": {id: {"on": bool|null,
    "size": s|m|l|null}}}. Canonical form: entries that say nothing are dropped; ValueError for anything else."""
    given = _obj(value, "home.personal", {"direction", "order", "widgets"})
    out: dict[str, Any] = {"direction": None, "order": None, "widgets": {}}
    if given.get("direction") is not None:
        out["direction"] = _choice(given["direction"], DIRECTIONS, "home.personal.direction")
    if given.get("order") is not None:
        raw = given["order"]
        if not isinstance(raw, list) or len(raw) > len(WIDGET_IDS):
            raise ValueError("home.personal.order must be a list of widget ids")
        seen: list[str] = []
        for item in raw:
            _choice(item, WIDGET_IDS, "home.personal.order")
            if item not in seen:
                seen.append(item)
        out["order"] = seen + [w for w in WIDGET_IDS if w not in seen]
    if given.get("widgets") is not None:
        widgets = _obj(given["widgets"], "home.personal.widgets", set(WIDGET_IDS))
        for wid, w in widgets.items():
            e = _obj(w, f"home.personal.widgets.{wid}", PERSONAL_WIDGET_KEYS)
            entry: dict[str, Any] = {}
            if e.get("on") is not None:
                entry["on"] = _bool(e["on"], f"home.personal.widgets.{wid}.on")
            if e.get("size") is not None:
                entry["size"] = _choice(e["size"], SIZES, f"home.personal.widgets.{wid}.size")
            if entry:
                out["widgets"][wid] = entry
    return out


def personal_is_empty(p: dict[str, Any] | None) -> bool:
    return not p or (p.get("direction") is None and p.get("order") is None and not p.get("widgets"))


def apply_personal(cfg: dict[str, Any], direction: str, personal: dict[str, Any] | None) -> tuple[dict[str, Any], str]:
    """The installation config and direction with one user's personal override laid over them: the user's direction, their
    order, and per widget their on / off and their size for the direction that ends up shown. The installation's entities,
    fields and headings are never personal."""
    if personal_is_empty(personal):
        return cfg, direction
    assert personal is not None
    out = copy.deepcopy(cfg)
    if personal.get("direction") in DIRECTIONS:
        direction = personal["direction"]
    if personal.get("order"):
        out["order"] = list(personal["order"])
    for wid, e in (personal.get("widgets") or {}).items():
        if wid not in WIDGET_IDS:
            continue
        if "on" in e:
            out[wid]["on"] = bool(e["on"])
        if e.get("size") in SIZES:
            out[wid]["sizes"][direction] = e["size"]
    return out, direction
