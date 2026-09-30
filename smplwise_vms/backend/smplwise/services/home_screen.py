"""The home screen's own settings (owner notes 2026-09-30, "ראשי" › חשמל והתקנים): an editable page title, the order of
the floors, and three optional header widgets - a clock, the weather and the Jewish-calendar times - each one read-only
and off by default.

Everything is a `home.*` product setting (routers/settings.py validates the values; changed with system.configure,
audited like every setting). The widgets show what Home Assistant already reported: the weather comes from a
`weather.*` entity and the Jewish-calendar times from `sensor.*` entities the owner picked in edit mode - both are read
from the mirrored catalogue (ha_entities), never from the network and never with a key. Nothing here writes to Home
Assistant or controls a device."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from ..db import get_setting
from . import ha_sync

CLOCK_MODES = ("off", "time", "datetime")
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


def _flag(conn: sqlite3.Connection, key: str) -> bool:
    return (get_setting(conn, key, "false") or "false") == "true"


def _entity(conn: sqlite3.Connection, entity_id: str, domain: str) -> dict[str, Any] | None:
    """The mirrored row of one configured entity, trimmed to what a widget shows; None when not configured / not there."""
    if not entity_id or not entity_id.startswith(f"{domain}."):
        return None
    row = conn.execute("SELECT * FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()
    if row is None:
        return None
    e = ha_sync.entity_row(row)
    state = e.get("state")
    return {
        "entity_id": e["entity_id"],
        "name": e.get("name") or (e.get("attributes") or {}).get("friendly_name") or e["entity_id"],
        "state": state,
        "available": bool(e.get("available")) and state not in (None, "", "unavailable", "unknown"),
        "device_class": e.get("device_class"),
        "attributes": e.get("attributes") or {},
    }


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f and abs(f) < 1e6 else None


def widgets(conn: sqlite3.Connection) -> dict[str, Any]:
    """What the header widgets show right now. A widget that is off, not configured or whose entity is gone / has no
    state is null - the screen then draws nothing and gives it no room. The clock has no data of its own: the browser
    draws it in the site's time zone (`time_zone`)."""
    clock = get_setting(conn, "home.clock", "off") or "off"
    out: dict[str, Any] = {
        "clock": clock if clock in CLOCK_MODES else "off",
        "time_zone": get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem",
        "weather": None,
        "jewish": None,
    }
    if _flag(conn, "home.weather"):
        w = _entity(conn, get_setting(conn, "home.weather_entity", "") or "", "weather")
        if w and w["available"]:
            a = w["attributes"]
            out["weather"] = {
                "entity_id": w["entity_id"],
                "condition": w["state"],
                "temperature": _num(a.get("temperature")),
                "unit": a.get("temperature_unit") if isinstance(a.get("temperature_unit"), str) else "°C",
                "humidity": _num(a.get("humidity")),
            }
    if _flag(conn, "home.jewish"):
        parts: dict[str, Any] = {}
        for part, key in (("parsha", "home.jewish_parsha"), ("candles", "home.jewish_candles"), ("havdalah", "home.jewish_havdalah")):
            s = _entity(conn, get_setting(conn, key, "") or "", "sensor")
            if s and s["available"]:
                parts[part] = {"entity_id": s["entity_id"], "state": str(s["state"]), "device_class": s["device_class"]}
        if parts:
            out["jewish"] = parts
    return out


CANDIDATES_MAX = 1500


def is_jewish_calendar(e: dict[str, Any]) -> bool:
    """Whether a mirrored entity looks like one of the Jewish Calendar integration's (platform `jewish_calendar`, or
    "jewish" in its id) - the home screen's edit mode and the schedules' Shabbat-sensor picker (CR-014) share it."""
    return (e.get("platform") or "") == "jewish_calendar" or "jewish" in (e.get("entity_id") or "")


def candidates(conn: sqlite3.Connection) -> dict[str, Any]:
    """What edit mode offers for the widgets: every mirrored `weather.*` entity and every `sensor.*` entity (the Jewish
    Calendar integration's ones flagged `suggested`, so they come first). Names and current states only."""
    weather = []
    for r in conn.execute("SELECT * FROM ha_entities WHERE domain = 'weather' AND removed_at IS NULL AND disabled = 0 ORDER BY name, entity_id LIMIT 200").fetchall():
        e = ha_sync.entity_row(r)
        weather.append({"entity_id": e["entity_id"], "name": e.get("name") or (e.get("attributes") or {}).get("friendly_name") or e["entity_id"], "state": e.get("state")})
    sensors = []
    for r in conn.execute("SELECT * FROM ha_entities WHERE domain = 'sensor' AND removed_at IS NULL AND disabled = 0 ORDER BY name, entity_id LIMIT ?", (CANDIDATES_MAX,)).fetchall():
        e = ha_sync.entity_row(r)
        eid = e["entity_id"]
        suggested = is_jewish_calendar(e)
        sensors.append(
            {
                "entity_id": eid,
                "name": e.get("name") or (e.get("attributes") or {}).get("friendly_name") or eid,
                "state": e.get("state"),
                "device_class": e.get("device_class"),
                "suggested": suggested,
            }
        )
    sensors.sort(key=lambda s: (not s["suggested"], s["name"].casefold(), s["entity_id"]))
    return {"weather": weather, "sensors": sensors}
