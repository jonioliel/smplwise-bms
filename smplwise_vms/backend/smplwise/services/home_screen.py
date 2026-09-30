"""The home screen's own settings (owner notes 2026-09-30, and the home redesign of the same day): an editable page title,
the order of the floors, the direction of the layout (a: control centre, b: side panel, c: compact row) and the widgets
- clock, weather, Shabbat, the alarm status card and the quick actions - each one editable and read-only.

Everything is a `home.*` product setting (routers/settings.py validates the values; changed with system.configure, audited
like every setting; the widget configuration itself - `home.widgets` - is services/home_config.py). The widgets show what
Home Assistant already reported: the weather comes from a `weather.*` entity, the Jewish-calendar fields from `sensor.*`
entities the owner picked (per field), the alarm card from the alarm panel the caller may see - all read from the mirrored
catalogue (ha_entities), never from the network and never with a key. Nothing here writes to Home Assistant or controls a
device.

A user who holds `screen.personalize` may also have a PERSONAL override (direction, widget on / off / size, order; /me/prefs
`home.personal`). It is applied here, on every read, only while the permission is held (`payload`): a stored value of a user
who lost the permission is ignored."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from ..db import get_setting
from . import ha_sync, home_config

ORDER_MAX = 100
ID_MAX = 100


def parse_floor_order(raw: str | None) -> list[str]:
    """The stored ordered floor ids; anything that is not a list of strings (an old / hand-edited value) is 'no order'."""
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except ValueError:
        return []
    if not isinstance(data, list):
        return []
    out: list[str] = []
    for x in data:
        if isinstance(x, str) and x and x not in out:
            out.append(x)
    return out[:ORDER_MAX]


def normalise_floor_order(value: Any) -> list[str] | None:
    """Validates a floor order coming from a client: a JSON list (string or list) of unique non-empty ids. None = refused."""
    data = value
    if isinstance(value, str):
        if not value.strip():
            return []
        try:
            data = json.loads(value)
        except ValueError:
            return None
    if not isinstance(data, list) or len(data) > ORDER_MAX:
        return None
    out: list[str] = []
    for x in data:
        if not isinstance(x, str) or not x.strip() or len(x) > ID_MAX or any(ord(c) < 32 for c in x) or x in out:
            return None
        out.append(x)
    return out


def order_floors(floors: list[dict[str, Any]], order: list[str]) -> list[dict[str, Any]]:
    """The listed floors first, in the listed order; every other floor after them in its default order (so a floor added
    in Home Assistant since simply appends). An id in the list that no floor has is ignored."""
    if not order:
        return floors
    rank = {fid: i for i, fid in enumerate(order)}
    tail = len(order)
    return sorted(floors, key=lambda f: rank.get(f["floor_id"], tail))  # sorted() is stable: the default order survives


def floor_order(conn: sqlite3.Connection) -> list[str]:
    return parse_floor_order(get_setting(conn, "home.floor_order", "[]"))


def is_jewish_calendar(e: dict[str, Any]) -> bool:
    """Whether a mirrored entity looks like one of the Jewish Calendar integration's (platform `jewish_calendar`, or
    "jewish" in its id) - the home screen's edit mode and the schedules' Shabbat-sensor picker (CR-014) share it."""
    return (e.get("platform") or "") == "jewish_calendar" or "jewish" in (e.get("entity_id") or "")


# ------------------------------------------------------------------------------------------------ the configuration


def direction(conn: sqlite3.Connection) -> str:
    v = get_setting(conn, "home.direction", home_config.DEFAULT_DIRECTION) or home_config.DEFAULT_DIRECTION
    return v if v in home_config.DIRECTIONS else home_config.DEFAULT_DIRECTION


def side(conn: sqlite3.Connection) -> str:
    v = get_setting(conn, "home.side", home_config.DEFAULT_SIDE) or home_config.DEFAULT_SIDE
    return v if v in home_config.SIDES else home_config.DEFAULT_SIDE


def _catalogue_ids(conn: sqlite3.Connection) -> tuple[list[str], list[str]]:
    """The mirrored `weather.*` ids and the Jewish Calendar integration's `sensor.*` ids (for the default's suggestions)."""
    weather = [r[0] for r in conn.execute("SELECT entity_id FROM ha_entities WHERE domain = 'weather' AND removed_at IS NULL AND disabled = 0 AND available = 1 ORDER BY entity_id LIMIT 50").fetchall()]
    calendar = []
    for r in conn.execute("SELECT entity_id, platform FROM ha_entities WHERE domain = 'sensor' AND removed_at IS NULL AND disabled = 0 AND (platform = 'jewish_calendar' OR entity_id LIKE '%jewish%') ORDER BY entity_id LIMIT 200").fetchall():
        calendar.append(r[0])
    return weather, calendar


def stored_config(conn: sqlite3.Connection) -> dict[str, Any] | None:
    """The saved `home.widgets`, or None when nothing was saved (or it is unreadable)."""
    return home_config.parse_stored(get_setting(conn, "home.widgets", ""))


def effective_config(conn: sqlite3.Connection) -> dict[str, Any]:
    """The installation's configuration: what an administrator saved; else the 0.1.146 keys of an installation that used
    them; else the built-in default with the catalogue's suggestions (a weather entity, the Jewish Calendar's sensors) - the
    same answer for GET /settings and for the tree, so a screen and its editor always agree."""
    saved = stored_config(conn)
    if saved is not None:
        return saved
    legacy = home_config.from_legacy(lambda k, d: get_setting(conn, k, d) or d)
    if legacy is not None:
        return legacy
    weather, calendar = _catalogue_ids(conn)
    return home_config.with_suggestions(home_config.default_config(), weather, calendar)


# ------------------------------------------------------------------------------------------------ what the widgets show


def _entity(conn: sqlite3.Connection, entity_id: str, *domains: str) -> dict[str, Any] | None:
    """The mirrored row of one configured entity, trimmed to what a widget shows; None when not configured / not there."""
    if not entity_id or entity_id.split(".", 1)[0] not in domains:
        return None
    row = conn.execute("SELECT * FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()
    if row is None:
        return None
    return _trim(ha_sync.entity_row(row))


def _trim(e: dict[str, Any]) -> dict[str, Any]:
    state = e.get("state")
    return {
        "entity_id": e["entity_id"],
        "name": e.get("name") or (e.get("attributes") or {}).get("friendly_name") or e["entity_id"],
        "state": state,
        "available": bool(e.get("available")) and state not in (None, "", "unavailable", "unknown"),
        "device_class": e.get("device_class"),
        "platform": e.get("platform"),
        "unit": e.get("unit"),
        "last_changed": e.get("last_changed"),
        "attributes": e.get("attributes") or {},
    }


def _num(v: Any) -> float | None:
    if isinstance(v, bool):
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f and abs(f) < 1e6 else None


FORECAST_MAX = 14


def _forecast(raw: Any) -> list[dict[str, Any]]:
    """The first entries of a weather entity's own `forecast` attribute (what Home Assistant already reported; no request
    is made): time, condition, temperature (and the low / rain chance when reported). Absent or malformed = no forecast."""
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        when, cond = item.get("datetime"), item.get("condition")
        if not isinstance(when, str) or not isinstance(cond, str):
            continue
        entry: dict[str, Any] = {"datetime": when[:40], "condition": cond[:40], "temperature": _num(item.get("temperature"))}
        low, prob = _num(item.get("templow")), _num(item.get("precipitation_probability"))
        if low is not None:
            entry["templow"] = low
        if prob is not None:
            entry["precipitation_probability"] = prob
        out.append(entry)
        if len(out) >= FORECAST_MAX:
            break
    return out


# (widget field, the attribute holding it, the attribute holding its unit, the default unit)
_WEATHER_ATTRS: tuple[tuple[str, str, str, str | None], ...] = (
    ("temperature", "temperature", "temperature_unit", "°C"),
    ("apparent", "apparent_temperature", "temperature_unit", "°C"),
    ("humidity", "humidity", "", "%"),
    ("wind", "wind_speed", "wind_speed_unit", None),
    ("pressure", "pressure", "pressure_unit", None),
    ("visibility", "visibility", "visibility_unit", None),
    ("uv", "uv_index", "", ""),
    ("precipitation", "precipitation", "precipitation_unit", None),
)


def weather_data(w: dict[str, Any]) -> dict[str, Any]:
    """A weather entity as the widget reads it: the current condition, every value the entity really reports (with its unit;
    a field the entity does not report is simply not in `values`, so the editor lists only what can be shown), the forecast
    it carries and `offers` - the fields the owner may choose from."""
    a = w["attributes"]
    values: dict[str, Any] = {}
    for field, attr, unit_attr, default_unit in _WEATHER_ATTRS:
        v = _num(a.get(attr))
        if v is None:
            continue
        unit = a.get(unit_attr) if unit_attr and isinstance(a.get(unit_attr), str) else default_unit
        item: dict[str, Any] = {"v": v, "unit": unit}
        if field == "wind":
            bearing = a.get("wind_bearing")
            if isinstance(bearing, (int, float)) and not isinstance(bearing, bool):
                item["bearing"] = float(bearing)
            elif isinstance(bearing, str) and bearing and len(bearing) <= 6:
                item["bearing_text"] = bearing
        values[field] = item
    forecast = _forecast(a.get("forecast"))
    offers = ["condition", *[f for f in home_config.WEATHER_FIELDS if f in values], *(["forecast"] if forecast else [])]
    return {
        "entity_id": w["entity_id"],
        "name": w["name"],
        "available": w["available"],
        "condition": w["state"] if w["available"] else None,
        "values": values,
        "forecast": forecast,
        "forecast_len": len(forecast),
        "offers": offers,
    }


def _sensor_data(s: dict[str, Any]) -> dict[str, Any]:
    return {"state": str(s["state"]) if s["available"] else "", "name": s["name"], "unit": s["unit"], "device_class": s["device_class"], "available": s["available"]}


def _active(w: dict[str, Any]) -> bool:
    """A widget shown on the desktop or - `phone_on` - on the phone only: only such a widget computes data."""
    return bool(w["on"]) or w.get("phone_on") is True


def _config_sensor_ids(cfg: dict[str, Any]) -> list[str]:
    """Every sensor the configuration reads FOR A WIDGET THAT IS ON: the Jewish-calendar fields and extras (Shabbat; the Hebrew
    date also feeds the clock) and the weather field sources. A widget that is off computes nothing."""
    ids: list[str] = []
    cal = cfg["calendar"]
    if _active(cfg["clock"]) or _active(cfg["shabbat"]):
        ids.append(cal["date"])
    if _active(cfg["shabbat"]):
        ids += [cal[f] for f in ("parsha", "candles", "havdalah", "holiday")]
        ids += [x["entity_id"] for x in cal["extras"]]
    if _active(cfg["weather"]):
        ids += list(cfg["weather"]["sources"].values())
    out: list[str] = []
    for i in ids:
        if i and i not in out:
            out.append(i)
    return out

_ALARM_RANK = {"triggered": 0, "pending": 1, "arming": 2, "disarming": 3, "armed_away": 4, "armed_home": 5, "armed_night": 6, "armed_vacation": 7, "armed_custom_bypass": 8, "disarmed": 9}


def alarm_data(cfg: dict[str, Any], entities: list[dict[str, Any]] | None) -> dict[str, Any] | None:
    """The alarm card's panel among the entities the caller may see: the chosen one, else the most urgent panel (a triggered
    one first, then arming, then armed, disarmed last). None = no panel to show (the card then takes no room)."""
    panels = [e for e in (entities or []) if e.get("domain") == "alarm_control_panel"]
    chosen = cfg["alarm"]["entity"]
    if chosen:
        panels = [e for e in panels if e["entity_id"] == chosen]
    if not panels:
        return None
    best = sorted(panels, key=lambda e: (_ALARM_RANK.get(e.get("state") or "", 20), e["entity_id"]))[0]
    return {"entity_id": best["entity_id"], "name": best.get("name") or best["entity_id"], "state": best.get("state"), "since": best.get("last_changed"), "available": bool(best.get("available")) and best.get("state") not in (None, "", "unavailable", "unknown")}


def _may_read(sensor: dict[str, Any], visible: set[str]) -> bool:
    """A configured sensor's state reaches the caller only when it is in the caller's visible entity set (the tree's own, narrowed
    to their floors), except the Jewish Calendar integration's sensors - the calendar is the whole site's, not a place - which
    is what the widgets showed before the redesign."""
    return sensor["entity_id"] in visible or (sensor.get("platform") or "") == "jewish_calendar"


def widget_data(conn: sqlite3.Connection, cfg: dict[str, Any], entities: list[dict[str, Any]] | None) -> dict[str, Any]:
    """What the widgets show right now, for the entities `cfg` points at and the widgets that are on. A missing, out-of-scope or
    switched-off source is absent (null / not in the map): the screen draws no card for it and gives it no room. `entities` =
    the entities the caller may see (the tree's own set, narrowed to a floor-scoped caller's floors); None means none, so the
    alarm card is absent and only the weather entity and the Jewish Calendar's sensors are read. The `weather.*` entity is the
    one other exception (the site's weather, as before)."""
    visible = {e["entity_id"] for e in (entities or [])}
    w = _entity(conn, cfg["weather"]["entity"], "weather") if _active(cfg["weather"]) else None
    sensors: dict[str, Any] = {}
    for sid in _config_sensor_ids(cfg):
        s = _entity(conn, sid, "sensor", "binary_sensor")
        if s is not None and _may_read(s, visible):
            sensors[sid] = _sensor_data(s)
    return {"weather": weather_data(w) if w else None, "sensors": sensors, "alarm": alarm_data(cfg, entities) if _active(cfg["alarm"]) else None}

def payload(conn: sqlite3.Connection, entities: list[dict[str, Any]] | None, *, personalize: bool = False, personal: dict[str, Any] | None = None) -> dict[str, Any]:
    """The `home` block of GET /devices/tree: the direction, the widget configuration as THIS caller sees it (the personal
    override applied only while `personalize` - the caller holds screen.personalize - is true) and the data behind it."""
    cfg, dirn = effective_config(conn), direction(conn)
    if personalize and not home_config.personal_is_empty(personal):
        cfg, dirn = home_config.apply_personal(cfg, dirn, personal)
    return {
        "direction": dirn,
        "side": side(conn),
        "time_zone": get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem",
        "personalize": personalize,
        "config": cfg,
        "data": widget_data(conn, cfg, entities),
    }


CANDIDATES_MAX = 1500


def candidates(conn: sqlite3.Connection) -> dict[str, Any]:
    """What edit mode offers for the widgets: every mirrored `weather.*` entity with what it can show (its values, forecast and
    `offers`, so the field checklist follows the entity being chosen), every `alarm_control_panel.*`, and every `sensor.*`
    (the Jewish Calendar integration's flagged `suggested`, so they come first; its binary sensors are offered for the extra
    fields). `suggested_calendar` = the sensor the catalogue suggests per Jewish-calendar field. Names and current states only."""
    weather = []
    for r in conn.execute("SELECT * FROM ha_entities WHERE domain = 'weather' AND removed_at IS NULL AND disabled = 0 ORDER BY name, entity_id LIMIT 200").fetchall():
        w = _trim(ha_sync.entity_row(r))
        weather.append({"entity_id": w["entity_id"], "name": w["name"], "state": w["state"], **{k: v for k, v in weather_data(w).items() if k in ("values", "forecast", "forecast_len", "offers")}})
    alarms = []
    for r in conn.execute("SELECT entity_id, name, state FROM ha_entities WHERE domain = 'alarm_control_panel' AND removed_at IS NULL AND disabled = 0 ORDER BY name, entity_id LIMIT 50").fetchall():
        alarms.append({"entity_id": r["entity_id"], "name": r["name"] or r["entity_id"], "state": r["state"]})
    sensors = []
    for r in conn.execute("SELECT * FROM ha_entities WHERE domain = 'sensor' AND removed_at IS NULL AND disabled = 0 ORDER BY name, entity_id LIMIT ?", (CANDIDATES_MAX,)).fetchall():
        e = ha_sync.entity_row(r)
        sensors.append(_candidate_sensor(e))
    for r in conn.execute("SELECT * FROM ha_entities WHERE domain = 'binary_sensor' AND removed_at IS NULL AND disabled = 0 AND (platform = 'jewish_calendar' OR entity_id LIKE '%jewish%') ORDER BY name, entity_id LIMIT 50").fetchall():
        sensors.append(_candidate_sensor(ha_sync.entity_row(r), binary=True))
    sensors.sort(key=lambda s: (not s["suggested"], s["name"].casefold(), s["entity_id"]))
    suggested_ids = [s["entity_id"] for s in sensors if s["suggested"] and not s["binary"]]
    return {"weather": weather, "alarms": alarms, "sensors": sensors, "suggested_calendar": home_config.suggest_calendar(suggested_ids)}


def _candidate_sensor(e: dict[str, Any], binary: bool = False) -> dict[str, Any]:
    eid = e["entity_id"]
    return {
        "entity_id": eid,
        "name": e.get("name") or (e.get("attributes") or {}).get("friendly_name") or eid,
        "state": e.get("state"),
        "unit": e.get("unit"),
        "device_class": e.get("device_class"),
        "suggested": is_jewish_calendar(e),
        "binary": binary,
    }
