"""BUILDING-PRESENCE-2271 (board r339, plan PLAN_R339 phase 1): anonymous room / building occupancy from the presence sensors the owner TAGS.

Source: binary sensors the installation already mirrors (device class `occupancy`, `presence`, `motion` or `moving` - a Shelly presence or
motion sensor appears exactly like that). Nothing is read from a person: no phone, no door log, no camera. The tag lives in Arx
(`presence_building_sensors`), never in the automation host. With no tagged sensor the feature does not exist: the API answers
`configured: false`, the screens show nothing. Live state only: nothing about the past is stored here.

Per sensor, from the mirror state and its `last_changed`:
- `on`                          -> occupied
- `off`                         -> occupied until `hold_seconds` after it turned off (debounce of a PIR that drops while a person sits
                                   still), then clear
- `unavailable`, `unknown`, none, or a mirror that is not fresh -> unknown (never read as empty)
A room (the sensor's area) is occupied if any sensor is, clear only if all are clear, otherwise unknown. The building follows the same rule
over all tagged sensors. `empty_since` is the moment the last sensor became clear (its `last_changed` + hold); `empty_minutes` counts from
there and `empty_reached` is true after the configurable `empty_minutes` timeout - what the cockpit's "building empty for N minutes" means."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from typing import Any

from ..db import get_setting, now_iso, set_setting

VIEW = "presence.building.view"
CONFIGURE = "system.configure"
CLASSES = ("occupancy", "presence", "motion", "moving")
SETTINGS_KEY = "presence.building.config"
# PRESENCE-2280: `enabled` is the master switch (OFF by default; the system administrator turns it on in Settings > Presence). `retention_days`
# (0 = keep no history), `home_display` (the overview: a card, the thin line or nothing), `map_tint` (rooms painted on the plan).
DEFAULTS: dict[str, Any] = {"enabled": False, "hold_seconds": 60, "empty_minutes": 10, "retention_days": 30, "home_display": "chip", "map_tint": True}
LIMITS = {"hold_seconds": (0, 3600), "empty_minutes": (1, 1440), "retention_days": (0, 365)}
CHOICES = {"home_display": ("card", "chip", "off")}
FLAGS = ("enabled", "map_tint")
MAX_SENSORS = 200
UNKNOWN_STATES = {None, "", "unknown", "unavailable"}


def get_config(conn: sqlite3.Connection) -> dict[str, Any]:
    try:
        stored = json.loads(get_setting(conn, SETTINGS_KEY, "") or "{}")
    except ValueError:
        stored = {}
    out = dict(DEFAULTS)
    if isinstance(stored, dict):
        for k, (lo, hi) in LIMITS.items():
            v = stored.get(k)
            if isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi:
                out[k] = v
        for k, choices in CHOICES.items():
            if stored.get(k) in choices:
                out[k] = stored[k]
        for k in FLAGS:
            if isinstance(stored.get(k), bool):
                out[k] = stored[k]
    return out


def is_enabled(conn: sqlite3.Connection) -> bool:
    return bool(get_config(conn)["enabled"])


def set_config(conn: sqlite3.Connection, values: dict[str, Any]) -> dict[str, Any]:
    cfg = get_config(conn)
    for k, (lo, hi) in LIMITS.items():
        if k in values and values[k] is not None:
            v = values[k]
            if isinstance(v, bool) or not isinstance(v, int) or not lo <= v <= hi:
                raise ValueError(k)
            cfg[k] = v
    for k, choices in CHOICES.items():
        if k in values and values[k] is not None:
            if values[k] not in choices:
                raise ValueError(k)
            cfg[k] = values[k]
    for k in FLAGS:
        if k in values and values[k] is not None:
            if not isinstance(values[k], bool):
                raise ValueError(k)
            cfg[k] = values[k]
    set_setting(conn, SETTINGS_KEY, json.dumps(cfg, separators=(",", ":")))
    return cfg


def parse_iso(text: str | None) -> dt.datetime | None:
    if not isinstance(text, str) or not text:
        return None
    try:
        d = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)


def tagged_ids(conn: sqlite3.Connection) -> list[str]:
    return [r["entity_id"] for r in conn.execute("SELECT entity_id FROM presence_building_sensors ORDER BY entity_id")]


def has_tags(conn: sqlite3.Connection) -> bool:
    return conn.execute("SELECT 1 FROM presence_building_sensors LIMIT 1").fetchone() is not None


def sensor_state(state: str | None, last_changed: str | None, now: dt.datetime, hold_seconds: int, fresh: bool = True) -> tuple[str, dt.datetime | None]:
    """(`occupied` | `clear` | `unknown`, the instant it became clear when `clear`)."""
    if not fresh or state in UNKNOWN_STATES:
        return "unknown", None
    if state == "on":
        return "occupied", None
    if state != "off":
        return "unknown", None
    changed = parse_iso(last_changed)
    if changed is None:
        return "clear", None  # no timestamp to debounce with: believe the sensor
    clear_at = changed + dt.timedelta(seconds=hold_seconds)
    if now < clear_at:
        return "occupied", None
    return "clear", clear_at


def combine(states: list[str]) -> str:
    if "occupied" in states:
        return "occupied"
    if not states or "unknown" in states:
        return "unknown"
    return "clear"


def candidates(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    marks = ",".join("?" for _ in CLASSES)
    return conn.execute(
        f"SELECT * FROM ha_entities WHERE domain = 'binary_sensor' AND removed_at IS NULL AND disabled = 0 AND device_class IN ({marks}) ORDER BY name, entity_id",
        CLASSES,
    ).fetchall()


def _rows(conn: sqlite3.Connection, ids: list[str]) -> dict[str, sqlite3.Row]:
    out: dict[str, sqlite3.Row] = {}
    for i in range(0, len(ids), 100):
        part = ids[i : i + 100]
        for r in conn.execute(f"SELECT * FROM ha_entities WHERE entity_id IN ({','.join('?' for _ in part)})", part):
            out[r["entity_id"]] = r
    return out


def _iso(d: dt.datetime) -> str:
    return d.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def overrides(conn: sqlite3.Connection) -> dict[str, str]:
    return {r["entity_id"]: r["area_override"] for r in conn.execute("SELECT entity_id, area_override FROM presence_building_sensors WHERE area_override IS NOT NULL")}


def area_name_of(conn: sqlite3.Connection, area_id: str) -> str | None:
    r = conn.execute("SELECT area_name FROM ha_entities WHERE area_id = ? AND area_name IS NOT NULL LIMIT 1", (area_id,)).fetchone()
    return r["area_name"] if r else None


def rooms_known(conn: sqlite3.Connection) -> list[dict[str, str]]:
    return [{"area_id": r["area_id"], "name": r["area_name"]} for r in conn.execute(
        "SELECT DISTINCT area_id, area_name FROM ha_entities WHERE area_id IS NOT NULL AND area_name IS NOT NULL AND removed_at IS NULL ORDER BY area_name")]


def set_room(conn: sqlite3.Connection, entity_id: str, area_id: str | None) -> None:
    """Place a TAGGED sensor in a room (or back to the room the mirror knows). LookupError for an untagged sensor or an unknown room."""
    if conn.execute("SELECT 1 FROM presence_building_sensors WHERE entity_id = ?", (entity_id,)).fetchone() is None:
        raise LookupError(entity_id)
    if area_id is not None and area_name_of(conn, area_id) is None:
        raise LookupError(area_id)
    conn.execute("UPDATE presence_building_sensors SET area_override = ? WHERE entity_id = ?", (area_id, entity_id))


def snapshot(conn: sqlite3.Connection, now: dt.datetime | None = None, fresh: bool = True) -> dict[str, Any]:
    """The live aggregate. `configured: false` (and nothing else of substance) while no sensor is tagged."""
    now = now or dt.datetime.now(dt.timezone.utc)
    cfg = get_config(conn)
    if not cfg["enabled"]:  # PRESENCE-2280: the master switch is off - nothing is read, nothing is shown
        return {"configured": False, "enabled": False, "settings": cfg}
    ids = tagged_ids(conn)
    if not ids:
        return {"configured": False, "enabled": True, "settings": cfg}
    rows = _rows(conn, ids)
    over = overrides(conn)
    sensors: list[dict[str, Any]] = []
    rooms: dict[str, dict[str, Any]] = {}
    clear_times: list[dt.datetime] = []
    for eid in ids:
        r = rows.get(eid)
        if r is None or r["removed_at"]:
            status, clear_at, area_id, area_name, name, since = "unknown", None, None, None, eid, None
        else:
            status, clear_at = sensor_state(r["state"], r["last_changed"], now, cfg["hold_seconds"], fresh and bool(r["available"]))
            area_id, area_name, name, since = r["area_id"], r["area_name"], r["name"] or eid, r["last_changed"]
            if eid in over:  # the owner placed this sensor in a room of his own choosing
                area_id, area_name = over[eid], area_name_of(conn, over[eid])
        if clear_at:
            clear_times.append(clear_at)
        sensors.append({"entity_id": eid, "name": name, "area_id": area_id, "status": status, "since": since})
        room = rooms.setdefault(area_id or "", {"area_id": area_id, "name": area_name, "states": [], "clear_times": []})
        room["states"].append(status)
        if clear_at:
            room["clear_times"].append(clear_at)
    room_list = []
    for room in rooms.values():
        st = combine(room["states"])
        room_list.append({"area_id": room["area_id"], "name": room["name"], "status": st, "sensors": len(room["states"]),
                          "empty_since": _iso(max(room["clear_times"])) if st == "clear" and room["clear_times"] else None})
    room_list.sort(key=lambda x: (x["area_id"] is None, x["name"] or ""))
    status = combine([s["status"] for s in sensors])
    empty_since = max(clear_times) if status == "clear" and clear_times else None
    empty_minutes = max(0, int((now - empty_since).total_seconds() // 60)) if empty_since else None
    return {
        "configured": True,
        "enabled": True,
        "fresh": bool(fresh),
        "status": status,
        "occupied_rooms": sum(1 for r in room_list if r["status"] == "occupied"),
        "rooms": room_list,
        "sensors": sensors,
        "empty_since": _iso(empty_since) if empty_since else None,
        "empty_minutes": empty_minutes,
        "empty_reached": bool(empty_minutes is not None and empty_minutes >= cfg["empty_minutes"]),
        "settings": cfg,
        "at": _iso(now),
    }


def list_for_settings(conn: sqlite3.Connection) -> dict[str, Any]:
    tagged = set(tagged_ids(conn))
    cand = candidates(conn)
    seen = {r["entity_id"] for r in cand}
    items = [{"entity_id": r["entity_id"], "name": r["name"] or r["entity_id"], "area_id": r["area_id"], "area_name": r["area_name"],
              "device_class": r["device_class"], "tagged": r["entity_id"] in tagged, "state": r["state"]} for r in cand]
    extra = _rows(conn, sorted(tagged - seen))  # tagged but no longer a candidate (class changed, disabled): still listed so it can be untagged
    for eid in sorted(tagged - seen):
        r = extra.get(eid)
        items.append({"entity_id": eid, "name": (r["name"] if r is not None else None) or eid, "area_id": r["area_id"] if r is not None else None,
                      "area_name": r["area_name"] if r is not None else None, "device_class": r["device_class"] if r is not None else None,
                      "tagged": True, "state": r["state"] if r is not None else None})
    over = overrides(conn)
    for it in items:
        if it["entity_id"] in over:
            it["area_id"], it["area_name"] = over[it["entity_id"]], area_name_of(conn, over[it["entity_id"]])
            it["placed"] = True
    return {"sensors": items, "rooms": rooms_known(conn), "settings": get_config(conn)}


def replace_tags(conn: sqlite3.Connection, entity_ids: list[str], actor_id: str | None) -> tuple[list[str], list[str]]:
    """Make exactly `entity_ids` the tagged set. Each must be a mirrored binary sensor. Returns (added, removed)."""
    wanted = sorted(set(entity_ids))
    if len(wanted) > MAX_SENSORS:
        raise ValueError("too_many")
    known = _rows(conn, wanted)
    bad = [e for e in wanted if e not in known or known[e]["domain"] != "binary_sensor"]
    if bad:
        raise LookupError(bad[0])
    current = set(tagged_ids(conn))
    added = [e for e in wanted if e not in current]
    removed = sorted(current - set(wanted))
    ts = now_iso()
    for e in added:
        conn.execute("INSERT INTO presence_building_sensors(entity_id, added_by, added_at) VALUES(?,?,?)", (e, actor_id, ts))
    for e in removed:
        conn.execute("DELETE FROM presence_building_sensors WHERE entity_id = ?", (e,))
    return added, removed
