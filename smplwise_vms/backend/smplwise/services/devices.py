"""Electricity and device control (CR-007 slice 1, read-only): Home Assistant floors → areas → per-domain cards
with live counts, projected from the synced catalogue (ha_entities) and the mirrored registries (ha_floors, ha_areas).

Pure projection over the caller's visible entity set: the router decides who sees which entities (installation-wide
readers everything, floor-scoped readers only what is placed on their floors, as /ha/entities), this module never
touches permissions. Nothing here talks to Home Assistant; a state change reaches the UI through the existing /ha/ws
push and the UI refetches.

Card rules (CR-007 §3, DomusUI's adapted): light → lighting; switch / input_boolean → switches; climate / fan /
humidifier → climate; cover → covers; lock / alarm_control_panel / camera and the binary_sensor device classes that
guard something (door, window, motion, ...) → security; media_player → media; sensor and every other binary_sensor →
sensors. Other domains (scripts, scenes, buttons, numbers, ...) are not part of this area. Disabled, hidden and removed
entities and HA's config / diagnostic entities are left out, as HA's own area dashboard leaves them out."""
from __future__ import annotations

import sqlite3
from typing import Any, Callable

from . import ha_sync, home_screen, plan_area_links
from .device_activity import ACTIVITY_DOMAINS, SECURITY_PERMISSIONS, activity_kind

ControlChecker = Callable[[str], bool]

CARD_IDS = ("lighting", "switches", "climate", "heating", "covers", "security", "media", "sensors")
CARD_LABELS = {
    "lighting": "תאורה",
    "switches": "מתגים",
    "climate": "מיזוג ואקלים",
    "heating": "חימום",
    "covers": "תריסים",
    "security": "אבטחה",
    "media": "מסכים והקרנה",
    "sensors": "חיישנים",
}
SECURITY_BINARY_CLASSES = {"door", "window", "opening", "garage_door", "motion", "occupancy", "presence", "lock", "safety", "smoke", "gas", "carbon_monoxide", "tamper", "vibration", "sound", "moving"}
# CR-007 slice 4 (review MEDIUM 9: one definition, not two): a door / garage / gate cover is a passage, not a
# shutter - read-only in the covers card, excluded from every bulk action (services/device_bulk.py) and, since the
# slice-4 review, refused server-side under devices.control too (services/ha_scope.py devices_control_reaches).
# `DOOR_LAYER`: a cover or switch placed on this map layer is a door / gate release, whatever its device_class -
# the same exclusion, by placement rather than by class.
DOOR_COVER_CLASSES = frozenset({"door", "garage", "gate"})
DOOR_LAYER = "doors"
# the binary sensors an area row counts as "open" when on (devices.area_row item `openings`)
OPENING_CLASSES = frozenset({"door", "window", "opening", "garage_door"})
# Sensor card grouping (CR-007 slice 4): a device_class bucket label, compact and predictable regardless of the
# entity's own wording; anything not named here (an illuminance/CO2/generic numeric sensor, or a binary sensor
# outside the security set) groups under its own device_class, or "other" with none.
SENSOR_GROUP_CLASSES = {"temperature": "temperature", "humidity": "humidity", "power": "power", "energy": "power", "illuminance": "illuminance", "carbon_dioxide": "co2", "battery": "battery"}
# Heating versus air conditioning (owner 2026-09-30): a climate entity whose own hvac_modes offer none of these cannot
# cool, dry or blow - a thermostat, a heat pump, floor / pool / water heating: the "חימום" group. An administrator's
# override (table device_climate_kind) wins; an entity that reports no modes (unavailable) stays "מיזוג".
CLIMATE_KINDS = ("ac", "heating")
AC_ONLY_MODES = frozenset({"cool", "dry", "fan_only"})
OFF_STATES = {"off", "unavailable", "unknown", None, ""}
MEDIA_OFF_STATES = {"off", "standby", "unavailable", "unknown", None, ""}
# CR-014 (SCHEDULER_API.md 5.5): the Scheduler component's own switches (`switch.schedule_*`) are not devices. They have an
# HA device and could otherwise be placed in the devices area, marked protected, bulk-controlled or dropped on a map.
# platform `scheduler` is the truth (V-LIVE); an entity id starting `switch.schedule_` with no platform yet (before the
# first registry refresh) is treated the same, so a fresh sync cannot leak one in for ten minutes.
SCHEDULER_PLATFORM = "scheduler"
SCHEDULER_SWITCH_PREFIX = "switch.schedule_"
IS_SCHEDULER_SQL = "(COALESCE(platform, '') = 'scheduler' OR (platform IS NULL AND entity_id LIKE 'switch.schedule\\_%' ESCAPE '\\'))"
NOT_SCHEDULER_SQL = f"NOT {IS_SCHEDULER_SQL}"  # both terms are never NULL, so NOT is safe in a WHERE clause
UNASSIGNED = "unassigned"  # the pseudo area id of "ללא שיוך"
NO_FLOOR = "none"  # the pseudo floor id of "ללא קומה"
UNASSIGNED_NAME = "ללא שיוך"
NO_FLOOR_NAME = "ללא קומה"


def is_scheduler_entity(entity_id: str, platform: str | None) -> bool:
    """True for a switch of the Scheduler component: platform `scheduler`, or - platform still unknown - the
    `switch.schedule_` id prefix. The same rule as IS_SCHEDULER_SQL."""
    if platform == SCHEDULER_PLATFORM:
        return True
    return platform is None and entity_id.startswith(SCHEDULER_SWITCH_PREFIX)


def is_scheduler(conn: sqlite3.Connection, entity_id: str) -> bool:
    """`is_scheduler_entity` for a catalogue entity id (one lookup; an unknown id falls back to the prefix rule)."""
    row = conn.execute("SELECT platform FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
    return is_scheduler_entity(entity_id, row["platform"] if row else None)


def climate_kind_auto(attributes: dict[str, Any] | None) -> str:
    """"heating" when the entity reports modes and none of them is cool / dry / fan_only, else "ac"."""
    modes = (attributes or {}).get("hvac_modes")
    if not isinstance(modes, list):
        return "ac"
    named = {m for m in modes if isinstance(m, str)} - {"off"}
    return "heating" if named and not named & AC_ONLY_MODES else "ac"


def climate_kind_overrides(conn: sqlite3.Connection) -> dict[str, str]:
    try:
        return {r["entity_id"]: r["kind"] for r in conn.execute("SELECT entity_id, kind FROM device_climate_kind").fetchall()}
    except sqlite3.OperationalError:  # a database from before migration 0040
        return {}


def annotate_climate(e: dict[str, Any], overrides: dict[str, str]) -> None:
    """Puts `climate_kind` (the effective group), `climate_kind_auto` and `climate_kind_set` (the override or None) on a
    climate entity row and moves a heating one to the heating card."""
    auto = climate_kind_auto(e.get("attributes"))
    set_kind = overrides.get(e["entity_id"])
    e["climate_kind_auto"], e["climate_kind_set"] = auto, set_kind
    e["climate_kind"] = set_kind or auto
    if e["climate_kind"] == "heating":
        e["card"] = "heating"


def card_of(domain: str, device_class: str | None) -> str | None:
    if domain == "light":
        return "lighting"
    if domain in ("switch", "input_boolean"):
        return "switches"
    if domain in ("climate", "fan", "humidifier"):
        return "climate"
    if domain == "cover":
        return "covers"
    if domain in ("lock", "alarm_control_panel", "camera"):
        return "security"
    if domain == "binary_sensor":
        return "security" if (device_class or "") in SECURITY_BINARY_CLASSES else "sensors"
    if domain == "media_player":
        return "media"
    if domain == "sensor":
        return "sensors"
    return None


def _num(v: Any) -> float | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(v) if isinstance(v, str) and v.strip() else None
    except ValueError:
        return None


def _str_list(v: Any, limit: int = 20) -> list[str] | None:
    """A short list of short strings (an entity's own hvac_modes / fan_modes), or None when HA reports none."""
    if not isinstance(v, list):
        return None
    out = [x for x in v if isinstance(x, str) and 0 < len(x) <= 40][:limit]
    return out or None


def _pct(v: Any, scale: float = 1.0) -> int | None:
    n = _num(v)
    return None if n is None else max(0, min(100, round(n * scale)))


def empty_counts() -> dict[str, Any]:
    return {
        "entities": 0,
        "lights": 0, "lights_on": 0,
        "switches": 0, "switches_on": 0,
        "covers": 0, "covers_open": 0,
        "climate": 0, "climate_active": 0,
        "heating": 0, "heating_active": 0,
        "media": 0, "media_on": 0,
        "locks": 0, "locks_locked": 0,
        "alarm": None,
        "cameras": 0,
        "sensors": 0,
    }


def is_active(domain: str, state: str | None) -> bool:
    """The "on" of each domain as the counts and the tiles read it."""
    if domain in ("light", "switch", "input_boolean", "fan", "humidifier"):
        return state == "on"
    if domain == "cover":
        return state in ("open", "opening")
    if domain == "climate":
        return state not in OFF_STATES
    if domain == "media_player":
        return state not in MEDIA_OFF_STATES
    if domain == "lock":
        return state == "locked"
    return False


def count_into(counts: dict[str, Any], e: dict[str, Any]) -> None:
    domain, state = e["domain"], e.get("state")
    counts["entities"] += 1
    if domain == "light":
        counts["lights"] += 1
        counts["lights_on"] += is_active(domain, state)
    elif domain in ("switch", "input_boolean"):
        counts["switches"] += 1
        counts["switches_on"] += is_active(domain, state)
    elif domain == "cover":
        counts["covers"] += 1
        counts["covers_open"] += is_active(domain, state)
    elif domain == "climate" and e.get("climate_kind") == "heating":
        counts["heating"] += 1
        counts["heating_active"] += is_active(domain, state)
    elif domain in ("climate", "fan", "humidifier"):
        counts["climate"] += 1
        counts["climate_active"] += is_active(domain, state)
    elif domain == "media_player":
        counts["media"] += 1
        counts["media_on"] += is_active(domain, state)
    elif domain == "lock":
        counts["locks"] += 1
        counts["locks_locked"] += is_active(domain, state)
    elif domain == "alarm_control_panel":
        # one panel per area is the norm; with several the first "not disarmed" one wins so an armed state is never hidden
        if counts["alarm"] is None or (counts["alarm"] == "disarmed" and state not in ("disarmed", None)):
            counts["alarm"] = state or "unknown"
    elif domain == "camera":
        counts["cameras"] += 1
    elif domain in ("sensor", "binary_sensor"):
        counts["sensors"] += 1


def load_entities(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Every entity this area can show, in a stable order (domain, name)."""
    rows = conn.execute(
        "SELECT * FROM ha_entities WHERE removed_at IS NULL AND disabled = 0 AND hidden = 0 AND (entity_category IS NULL OR entity_category = '') AND " + NOT_SCHEDULER_SQL + " ORDER BY domain, name, entity_id"
    ).fetchall()
    overrides = climate_kind_overrides(conn)
    out = []
    for r in rows:
        e = ha_sync.entity_row(r)
        e["card"] = card_of(e["domain"], e.get("device_class"))
        if e["card"]:
            if e["domain"] == "climate":
                annotate_climate(e, overrides)
            out.append(e)
    return out


def load_structure(conn: sqlite3.Connection, entities: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Floors and areas: the mirrored registries, plus anything the entity rows name that the mirror does not have yet
    (a catalogue synced before the mirror existed, or an area created between two registry refreshes)."""
    floors = [dict(r) for r in conn.execute("SELECT floor_id, name, level, icon, position FROM ha_floors").fetchall()]
    areas = [dict(r) for r in conn.execute("SELECT area_id, name, floor_id, icon, position FROM ha_areas").fetchall()]
    known_floors = {f["floor_id"] for f in floors}
    known_areas = {a["area_id"] for a in areas}
    for e in entities:
        fid, aid = e.get("ha_floor_id"), e.get("area_id")
        if fid and fid not in known_floors:
            floors.append({"floor_id": fid, "name": e.get("ha_floor_name") or fid, "level": None, "icon": None, "position": 10_000})
            known_floors.add(fid)
        if aid and aid not in known_areas:
            areas.append({"area_id": aid, "name": e.get("area_name") or aid, "floor_id": fid, "icon": None, "position": 10_000})
            known_areas.add(aid)
    floors.sort(key=lambda f: (f["level"] is None, f["level"] if f["level"] is not None else 0, f["position"], f["name"]))
    areas.sort(key=lambda a: (a["position"], a["name"]))
    return floors, areas


def _climate_summary(e: dict[str, Any]) -> dict[str, Any]:
    """CR-007 slice 4: the building/floor "מזגני הקומה" strip - mode + target only, never the full card."""
    a = e.get("attributes") or {}
    return {
        "entity_id": e["entity_id"],
        "name": e.get("name") or e.get("original_name") or e["entity_id"],
        "area_name": e.get("area_name"),
        "hvac_mode": e.get("state") if e.get("state") not in ("unavailable", "unknown", None) else None,
        "hvac_action": a.get("hvac_action") if isinstance(a.get("hvac_action"), str) else None,
        "current_temperature": _num(a.get("current_temperature")),
        "target_temperature": _num(a.get("temperature")),
        "unit": e.get("unit") or "°C",
        "available": bool(e.get("available")),
    }


def _area_indicators(climate: list[dict[str, Any]], temps: list[float], open_count: int) -> dict[str, Any]:
    """What an area's row on the home screen can show next to its name (release 0.1.149, devices.area_row): the area's own
    climate.* summaries (one indicator is drawn from them), the room temperature - the area's temperature sensor(s), else the
    air conditioners' own current temperature - and how many doors / windows are open. Read only; nothing here classifies anything."""
    if temps:
        temperature: float | None = round(sum(temps) / len(temps), 1)
    else:
        own = [c["current_temperature"] for c in climate if c["available"] and c["current_temperature"] is not None]
        temperature = round(sum(own) / len(own), 1) if own else None
    return {"climate": climate, "temperature": temperature, "open_count": open_count}


def build_tree(conn: sqlite3.Connection, entities: list[dict[str, Any]], *, scoped: bool) -> dict[str, Any]:
    """Floors → areas with counts over `entities` (already filtered to what the caller may see). A scoped caller gets
    only the floors and areas that hold something visible - an empty area would say more than they may know."""
    floors, areas = load_structure(conn, entities)
    area_counts: dict[str, dict[str, Any]] = {}
    area_has_camera: dict[str, bool] = {}
    climate_by_area: dict[str, list[dict[str, Any]]] = {}
    temp_by_area: dict[str, list[float]] = {}
    open_by_area: dict[str, int] = {}
    unassigned = empty_counts()
    building = empty_counts()
    for e in entities:
        count_into(building, e)
        aid = e.get("area_id")
        if e["domain"] == "climate" and aid and e.get("climate_kind") != "heating":  # the strip is the A/C one
            climate_by_area.setdefault(aid, []).append(_climate_summary(e))
        if aid:
            if e["domain"] == "sensor" and (e.get("device_class") or "") == "temperature" and e.get("available"):
                t = _num(e.get("state"))
                if t is not None and -60 <= t <= 100:
                    temp_by_area.setdefault(aid, []).append(t)
            elif e["domain"] == "binary_sensor" and (e.get("device_class") or "") in OPENING_CLASSES and e.get("state") == "on":
                open_by_area[aid] = open_by_area.get(aid, 0) + 1
        if not aid:
            count_into(unassigned, e)
            continue
        count_into(area_counts.setdefault(aid, empty_counts()), e)
        if e["domain"] == "camera":
            area_has_camera[aid] = True
    by_floor: dict[str | None, list[dict[str, Any]]] = {}
    on_map = plan_area_links.area_to_zone(conn)  # K88: the plan room linked to the area, for "הצג על המפה"
    for a in areas:
        counts = area_counts.get(a["area_id"])
        if scoped and counts is None:
            continue
        by_floor.setdefault(a.get("floor_id") or None, []).append(
            {"area_id": a["area_id"], "name": a["name"], "icon": a.get("icon"), "floor_id": a.get("floor_id") or None, "counts": counts or empty_counts(), "has_camera": area_has_camera.get(a["area_id"], False),
             "map": on_map.get(a["area_id"]),
             **_area_indicators(climate_by_area.get(a["area_id"], []), temp_by_area.get(a["area_id"], []), open_by_area.get(a["area_id"], 0))}
        )
    def _climate_strip(fl_areas: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out = [cs for a in fl_areas for cs in climate_by_area.get(a["area_id"], [])]
        out.sort(key=lambda c: (c["area_name"] or "", c["name"]))
        return out[:60]

    out_floors = []
    for f in floors:
        fl_areas = by_floor.pop(f["floor_id"], [])
        if scoped and not fl_areas:
            continue
        out_floors.append({"floor_id": f["floor_id"], "name": f["name"], "level": f.get("level"), "icon": f.get("icon"), "areas": fl_areas, "counts": _sum_counts([a["counts"] for a in fl_areas]), "climate": _climate_strip(fl_areas)})
    loose = by_floor.pop(None, [])
    for fid, rest in by_floor.items():  # an area whose floor id names no floor: shown as "ללא קומה" rather than dropped
        loose.extend(rest)
    if loose:
        out_floors.append({"floor_id": NO_FLOOR, "name": NO_FLOOR_NAME, "level": None, "icon": None, "areas": loose, "counts": _sum_counts([a["counts"] for a in loose]), "climate": _climate_strip(loose)})
    # owner 2026-09-30: the installation's own floor order (home.floor_order) - listed floors first, the rest after in level order
    out_floors = home_screen.order_floors(out_floors, home_screen.floor_order(conn))
    building_climate = [cs for lst in climate_by_area.values() for cs in lst]
    building_climate.sort(key=lambda c: (c["area_name"] or "", c["name"]))
    return {
        "floors": out_floors,
        "unassigned": {"area_id": UNASSIGNED, "name": UNASSIGNED_NAME, "counts": unassigned},
        "building": building,
        "building_climate": building_climate[:80],
        "scoped": scoped,
    }


def _sum_counts(items: list[dict[str, Any]]) -> dict[str, Any]:
    total = empty_counts()
    for c in items:
        for k, v in c.items():
            if k == "alarm":
                if v is not None and (total["alarm"] is None or (total["alarm"] == "disarmed" and v != "disarmed")):
                    total["alarm"] = v
            else:
                total[k] += v
    return total


# ---------------------------------------------------------------- area cards

def _row(e: dict[str, Any]) -> dict[str, Any]:
    """The fields every card row carries. Attributes are picked by name per card below - never the whole bag."""
    return {
        "entity_id": e["entity_id"],
        "name": e.get("name") or e.get("original_name") or e["entity_id"],
        "domain": e["domain"],
        "device_class": e.get("device_class"),
        "state": e.get("state"),
        "available": bool(e.get("available")),
        "fresh": bool(e.get("fresh")),
        "active": is_active(e["domain"], e.get("state")),
        "icon": e.get("icon"),
        "last_changed": e.get("last_changed"),
        # DEVHIST: the long press / "פעילות" menu item exists for the electrical domains only (the same table that decides the controls);
        # the caller's own devices.activity grant is checked by GET /devices/{id}/activity
        "activity": e["domain"] in ACTIVITY_DOMAINS,
        "activity_kind": activity_kind(e["domain"], e.get("device_class"), e.get("climate_kind")),
        # a lock / alarm panel's activity is behind the permission that operates it (door.unlock / alarm.arm), not just the one that shows it
        **({"activity_permission": SECURITY_PERMISSIONS[e["domain"]]} if e["domain"] in SECURITY_PERMISSIONS else {}),
        # seam: the alarm screen's own devices (another branch adds the column / predicate); absent = not managed
        **({"alarm_managed": bool(e.get("alarm_managed"))} if "alarm_managed" in e else {}),
    }


def card_row(e: dict[str, Any], can_control: bool) -> dict[str, Any]:
    a = e.get("attributes") or {}
    row = _row(e)
    row["can_control"] = can_control
    card = e["card"]
    if card == "lighting":
        row["brightness_pct"] = _pct(a.get("brightness"), 100 / 255) if row["state"] == "on" else None
        row["color_mode"] = a.get("color_mode") if isinstance(a.get("color_mode"), str) else None
    elif card in ("climate", "heating"):
        if e["domain"] == "climate":
            row["climate_kind"] = e.get("climate_kind") or climate_kind_auto(a)
            row["hvac_mode"] = row["state"] if row["state"] not in ("unavailable", "unknown", None) else None
            row["hvac_action"] = a.get("hvac_action") if isinstance(a.get("hvac_action"), str) else None
            row["current_temperature"] = _num(a.get("current_temperature"))
            row["target_temperature"] = _num(a.get("temperature"))
            row["target_temp_low"] = _num(a.get("target_temp_low"))
            row["target_temp_high"] = _num(a.get("target_temp_high"))
            row["fan_mode"] = a.get("fan_mode") if isinstance(a.get("fan_mode"), str) else None
            row["preset_mode"] = a.get("preset_mode") if isinstance(a.get("preset_mode"), str) else None
            row["unit"] = e.get("unit") or "°C"
            # CR-007 slice 2: the controls offer only what this entity reports (its own modes, its own target range)
            row["hvac_modes"] = _str_list(a.get("hvac_modes"))
            row["fan_modes"] = _str_list(a.get("fan_modes"))
            row["min_temp"] = _num(a.get("min_temp"))
            row["max_temp"] = _num(a.get("max_temp"))
            row["target_temp_step"] = _num(a.get("target_temp_step"))
            # CR-007 slice 4: climate in full - preset, swing and (for the climate entities that support it) a target
            # humidity alongside the temperature one; each offered only when the entity itself reports it
            row["preset_modes"] = _str_list(a.get("preset_modes"))
            row["swing_mode"] = a.get("swing_mode") if isinstance(a.get("swing_mode"), str) else None
            row["swing_modes"] = _str_list(a.get("swing_modes"))
            row["current_humidity"] = _num(a.get("current_humidity"))
            row["target_humidity"] = _num(a.get("humidity"))
            row["min_humidity"] = _num(a.get("min_humidity"))
            row["max_humidity"] = _num(a.get("max_humidity"))
        else:  # fan / humidifier
            row["percentage"] = _pct(a.get("percentage"))
            row["current_humidity"] = _num(a.get("current_humidity"))
            row["target_humidity"] = _num(a.get("humidity"))
            if e["domain"] == "humidifier":
                row["mode"] = a.get("mode") if isinstance(a.get("mode"), str) else None
                row["available_modes"] = _str_list(a.get("available_modes"))
                row["min_humidity"] = _num(a.get("min_humidity"))
                row["max_humidity"] = _num(a.get("max_humidity"))
    elif card == "covers":
        row["position"] = _pct(a.get("current_position"))
        row["tilt"] = _pct(a.get("current_tilt_position"))
        row["moving"] = row["state"] in ("opening", "closing")
        # CR-007 slice 4: a door / garage / gate cover is a passage, not a shutter - read-only here too (the same
        # device classes device_bulk.DOOR_COVER_CLASSES excludes from every bulk action), device-class-aware wording
        row["door_class"] = (row["device_class"] or "") in DOOR_COVER_CLASSES
        if row["door_class"]:
            row["can_control"] = False
    elif card == "security":
        kind = {"lock": "lock", "alarm_control_panel": "alarm", "camera": "camera"}.get(e["domain"], "binary_sensor")
        row["kind"] = kind
        if kind == "camera":
            # the product serves stills only for NVR / WisKey cameras (go2rtc); an HA camera entity has no still here yet
            row["has_camera"] = True
            row["still_url"] = None
        if kind == "alarm":
            row["armed"] = row["state"] not in ("disarmed", "unavailable", "unknown", None)
        if kind == "lock":
            row["locked"] = row["state"] == "locked"
    elif card == "media":
        row["media_title"] = a.get("media_title") if isinstance(a.get("media_title"), str) else None
        row["source"] = a.get("source") if isinstance(a.get("source"), str) else None
        row["volume_pct"] = _pct(a.get("volume_level"), 100)
        row["muted"] = bool(a.get("is_volume_muted")) if a.get("is_volume_muted") is not None else None
    elif card == "sensors":
        row["unit"] = e.get("unit")
        row["value"] = _num(row["state"]) if e["domain"] == "sensor" else None
        row["on"] = row["state"] == "on" if e["domain"] == "binary_sensor" else None
        row["battery_level"] = _pct(a.get("battery_level"))
        # CR-007 slice 4: grouped by device class, compact - display only, no controls
        row["group"] = (row["device_class"] or "other") if e["domain"] == "binary_sensor" else SENSOR_GROUP_CLASSES.get(row["device_class"] or "", "other")
    return row


def _outlet_power(entities: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """outlet entity id -> {entity_id, value, unit} of the power sensor registered on the same device (among `entities`)."""
    by_device: dict[str, dict[str, Any]] = {}
    for e in entities:
        if e["domain"] == "sensor" and e.get("device_class") == "power" and e.get("device_id") and e["device_id"] not in by_device:
            by_device[e["device_id"]] = {"entity_id": e["entity_id"], "value": _num(e.get("state")), "unit": e.get("unit") or "W"}
    return {e["entity_id"]: by_device[e["device_id"]] for e in entities if e["domain"] == "switch" and e.get("device_class") == "outlet" and e.get("device_id") in by_device}


def build_cards(entities: list[dict[str, Any]], control_of: ControlChecker) -> dict[str, Any]:
    cards: dict[str, Any] = {cid: {"id": cid, "label": CARD_LABELS[cid], "entities": []} for cid in CARD_IDS}
    counts = empty_counts()
    power = _outlet_power(entities)
    for e in entities:
        row = card_row(e, control_of(e["entity_id"]))
        if row.get("activity_kind") == "outlet":
            row["power"] = power.get(e["entity_id"])  # only a power sensor of the SAME device; None = show no power
        cards[e["card"]]["entities"].append(row)
        count_into(counts, e)
    for c in cards.values():
        c["count"] = len(c["entities"])
        c["active"] = sum(1 for r in c["entities"] if r["active"])
    return {"cards": cards, "counts": counts}


# ---------------------------------------------------------------- one domain across a scope (the overview tiles' panel)

# CR-007 overview tiles (owner 2026-09-29): a building / floor summary tile ("0/33 מתגים פעילים") opens a panel with
# every entity of that kind in the scope, grouped by floor › area. The kinds are the tiles' own (the DeviceCounts keys).
ITEM_KINDS: dict[str, tuple[str, ...]] = {
    "lights": ("light",),
    "switches": ("switch", "input_boolean"),
    "covers": ("cover",),
    "climate": ("climate", "fan", "humidifier"),
    "heating": ("climate",),
    "media": ("media_player",),
    "locks": ("lock",),
    "alarm": ("alarm_control_panel",),
}
ITEMS_MAX = 500  # a panel lists at most this many rows (an installation has far fewer of one kind); `truncated` says so


def _unavailable(row: dict[str, Any]) -> bool:
    return not row["available"] or row["state"] in ("unavailable", None)


def build_items(conn: sqlite3.Connection, entities: list[dict[str, Any]], kind: str, scope: str, scope_id: str, *, scoped: bool, control_of: ControlChecker) -> dict[str, Any] | None:
    """Every entity of `kind` in the scope (the building, one floor - `none` for the areas on no floor - or one area,
    `unassigned` for the entities in no area), as card rows grouped by floor › area in the tree's own order, with the
    counts the panel's header and filter need. None when the scope is unknown to this caller (404). Pure projection
    over `entities` (already the caller's visible set); `control_of` is the same per-row control check as the area
    cards (services/ha_scope.control_checker)."""
    domains = ITEM_KINDS[kind]
    tree = build_tree(conn, entities, scoped=scoped)
    areas_in: set[str | None] | None = None  # None = every area and the unassigned bucket
    name = "המבנה"
    floor_name: str | None = None
    if scope == "floor":
        floor = next((f for f in tree["floors"] if f["floor_id"] == scope_id), None)
        if floor is None:
            return None
        areas_in = {a["area_id"] for a in floor["areas"]}
        name = floor["name"]
    elif scope == "area":
        if scope_id == UNASSIGNED:
            if scoped and not any(not e.get("area_id") for e in entities):
                return None
            areas_in = {None}
            name = UNASSIGNED_NAME
        else:
            hit = next(((f, a) for f in tree["floors"] for a in f["areas"] if a["area_id"] == scope_id), None)
            if hit is None:
                return None
            areas_in = {scope_id}
            name = hit[1]["name"]
            floor_name = hit[0]["name"] if hit[0]["floor_id"] != NO_FLOOR else None
    by_area: dict[str | None, list[dict[str, Any]]] = {}
    for e in entities:
        if e["domain"] not in domains or (e["domain"] == "climate" and kind in ("climate", "heating") and (e.get("climate_kind") == "heating") != (kind == "heating")):
            continue
        aid = e.get("area_id") or None
        if areas_in is not None and aid not in areas_in:
            continue
        by_area.setdefault(aid, []).append(e)
    counts = {"total": 0, "active": 0, "inactive": 0, "unavailable": 0}
    total_rows = 0

    def rows_of(aid: str | None, area_name: str, floor_id: str | None, fname: str | None) -> list[dict[str, Any]]:
        nonlocal total_rows
        out = []
        for e in sorted(by_area.get(aid, []), key=lambda x: ((x.get("name") or x["entity_id"]).casefold(), x["entity_id"])):
            row = card_row(e, control_of(e["entity_id"]))
            row["area_id"], row["area_name"], row["floor_id"], row["floor_name"] = aid or UNASSIGNED, area_name, floor_id, fname
            if kind == "alarm":
                row["active"] = bool(row.get("armed"))
            counts["total"] += 1
            if _unavailable(row):
                counts["unavailable"] += 1
            elif row["active"]:
                counts["active"] += 1
            else:
                counts["inactive"] += 1
            total_rows += 1
            if total_rows <= ITEMS_MAX:
                out.append(row)
        return out

    groups: list[dict[str, Any]] = []
    for f in tree["floors"]:
        fid = f["floor_id"]
        fname = f["name"] if fid != NO_FLOOR else NO_FLOOR_NAME
        fareas = []
        for a in f["areas"]:
            if areas_in is not None and a["area_id"] not in areas_in:
                continue
            rows = rows_of(a["area_id"], a["name"], fid, fname)
            if rows:
                fareas.append({"area_id": a["area_id"], "name": a["name"], "items": rows})
        if fareas:
            groups.append({"floor_id": fid, "name": fname, "level": f.get("level"), "areas": fareas})
    if areas_in is None or None in areas_in:
        rows = rows_of(None, UNASSIGNED_NAME, None, None)
        if rows:
            groups.append({"floor_id": UNASSIGNED, "name": UNASSIGNED_NAME, "level": None, "areas": [{"area_id": UNASSIGNED, "name": UNASSIGNED_NAME, "items": rows}]})
    return {
        "kind": kind,
        "scope": scope,
        "id": scope_id,
        "name": name,
        "floor_name": floor_name,
        "counts": counts,
        "floors": groups,
        "truncated": total_rows > ITEMS_MAX,
        "scoped": scoped,
    }


def build_area(conn: sqlite3.Connection, entities: list[dict[str, Any]], area_id: str, *, scoped: bool, control_of: ControlChecker) -> dict[str, Any] | None:
    """One area's cards, plus the areas of the same floor for the chip row. None when the area is unknown (or holds
    nothing the caller may see, for a scoped caller). `control_of` (CR-007 slice 2) is the devices.control /
    ha.entity.control floor check (services/ha_scope.control_checker), evaluated once per row so a card can render
    its one-tap controls only for the entities this caller may actually act on."""
    tree = build_tree(conn, entities, scoped=scoped)
    if area_id == UNASSIGNED:
        mine = [e for e in entities if not e.get("area_id")]
        if scoped and not mine:
            return None
        body = build_cards(mine, control_of)
        return {"area": {"area_id": UNASSIGNED, "name": UNASSIGNED_NAME, "icon": None, "floor_id": None, "floor_name": None, "level": None}, "floor_areas": [], **body, "scoped": scoped}
    floor = area = None
    for f in tree["floors"]:
        for a in f["areas"]:
            if a["area_id"] == area_id:
                floor, area = f, a
                break
        if area:
            break
    if not area or not floor:
        return None
    mine = [e for e in entities if e.get("area_id") == area_id]
    body = build_cards(mine, control_of)
    siblings = [{"area_id": a["area_id"], "name": a["name"], "icon": a["icon"], "counts": a["counts"]} for a in floor["areas"]]
    return {
        "area": {"area_id": area["area_id"], "name": area["name"], "icon": area["icon"], "floor_id": floor["floor_id"], "floor_name": floor["name"], "level": floor["level"], "map": area.get("map")},
        "floor_areas": siblings,
        **body,
        "scoped": scoped,
    }
