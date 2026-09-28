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

from . import ha_sync

ControlChecker = Callable[[str], bool]

CARD_IDS = ("lighting", "switches", "climate", "covers", "security", "media", "sensors")
CARD_LABELS = {
    "lighting": "תאורה",
    "switches": "מתגים",
    "climate": "מיזוג ואקלים",
    "covers": "תריסים",
    "security": "אבטחה",
    "media": "מסכים והקרנה",
    "sensors": "חיישנים",
}
SECURITY_BINARY_CLASSES = {"door", "window", "opening", "garage_door", "motion", "occupancy", "presence", "lock", "safety", "smoke", "gas", "carbon_monoxide", "tamper", "vibration", "sound", "moving"}
OFF_STATES = {"off", "unavailable", "unknown", None, ""}
MEDIA_OFF_STATES = {"off", "standby", "unavailable", "unknown", None, ""}
UNASSIGNED = "unassigned"  # the pseudo area id of "ללא שיוך"
NO_FLOOR = "none"  # the pseudo floor id of "ללא קומה"
UNASSIGNED_NAME = "ללא שיוך"
NO_FLOOR_NAME = "ללא קומה"


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
        "SELECT * FROM ha_entities WHERE removed_at IS NULL AND disabled = 0 AND hidden = 0 AND (entity_category IS NULL OR entity_category = '') ORDER BY domain, name, entity_id"
    ).fetchall()
    out = []
    for r in rows:
        e = ha_sync.entity_row(r)
        e["card"] = card_of(e["domain"], e.get("device_class"))
        if e["card"]:
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


def build_tree(conn: sqlite3.Connection, entities: list[dict[str, Any]], *, scoped: bool) -> dict[str, Any]:
    """Floors → areas with counts over `entities` (already filtered to what the caller may see). A scoped caller gets
    only the floors and areas that hold something visible - an empty area would say more than they may know."""
    floors, areas = load_structure(conn, entities)
    area_counts: dict[str, dict[str, Any]] = {}
    area_has_camera: dict[str, bool] = {}
    unassigned = empty_counts()
    building = empty_counts()
    for e in entities:
        count_into(building, e)
        aid = e.get("area_id")
        if not aid:
            count_into(unassigned, e)
            continue
        count_into(area_counts.setdefault(aid, empty_counts()), e)
        if e["domain"] == "camera":
            area_has_camera[aid] = True
    by_floor: dict[str | None, list[dict[str, Any]]] = {}
    for a in areas:
        counts = area_counts.get(a["area_id"])
        if scoped and counts is None:
            continue
        by_floor.setdefault(a.get("floor_id") or None, []).append(
            {"area_id": a["area_id"], "name": a["name"], "icon": a.get("icon"), "floor_id": a.get("floor_id") or None, "counts": counts or empty_counts(), "has_camera": area_has_camera.get(a["area_id"], False)}
        )
    out_floors = []
    for f in floors:
        fl_areas = by_floor.pop(f["floor_id"], [])
        if scoped and not fl_areas:
            continue
        out_floors.append({"floor_id": f["floor_id"], "name": f["name"], "level": f.get("level"), "icon": f.get("icon"), "areas": fl_areas, "counts": _sum_counts([a["counts"] for a in fl_areas])})
    loose = by_floor.pop(None, [])
    for fid, rest in by_floor.items():  # an area whose floor id names no floor: shown as "ללא קומה" rather than dropped
        loose.extend(rest)
    if loose:
        out_floors.append({"floor_id": NO_FLOOR, "name": NO_FLOOR_NAME, "level": None, "icon": None, "areas": loose, "counts": _sum_counts([a["counts"] for a in loose])})
    return {
        "floors": out_floors,
        "unassigned": {"area_id": UNASSIGNED, "name": UNASSIGNED_NAME, "counts": unassigned},
        "building": building,
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
    }


def card_row(e: dict[str, Any], can_control: bool) -> dict[str, Any]:
    a = e.get("attributes") or {}
    row = _row(e)
    row["can_control"] = can_control
    card = e["card"]
    if card == "lighting":
        row["brightness_pct"] = _pct(a.get("brightness"), 100 / 255) if row["state"] == "on" else None
        row["color_mode"] = a.get("color_mode") if isinstance(a.get("color_mode"), str) else None
    elif card == "climate":
        if e["domain"] == "climate":
            row["hvac_mode"] = row["state"] if row["state"] not in ("unavailable", "unknown", None) else None
            row["hvac_action"] = a.get("hvac_action") if isinstance(a.get("hvac_action"), str) else None
            row["current_temperature"] = _num(a.get("current_temperature"))
            row["target_temperature"] = _num(a.get("temperature"))
            row["target_temp_low"] = _num(a.get("target_temp_low"))
            row["target_temp_high"] = _num(a.get("target_temp_high"))
            row["fan_mode"] = a.get("fan_mode") if isinstance(a.get("fan_mode"), str) else None
            row["preset_mode"] = a.get("preset_mode") if isinstance(a.get("preset_mode"), str) else None
            row["unit"] = e.get("unit") or "°C"
        else:  # fan / humidifier
            row["percentage"] = _pct(a.get("percentage"))
            row["current_humidity"] = _num(a.get("current_humidity"))
            row["target_humidity"] = _num(a.get("humidity"))
    elif card == "covers":
        row["position"] = _pct(a.get("current_position"))
        row["tilt"] = _pct(a.get("current_tilt_position"))
        row["moving"] = row["state"] in ("opening", "closing")
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
    return row


def build_cards(entities: list[dict[str, Any]], control_of: ControlChecker) -> dict[str, Any]:
    cards: dict[str, Any] = {cid: {"id": cid, "label": CARD_LABELS[cid], "entities": []} for cid in CARD_IDS}
    counts = empty_counts()
    for e in entities:
        cards[e["card"]]["entities"].append(card_row(e, control_of(e["entity_id"])))
        count_into(counts, e)
    for c in cards.values():
        c["count"] = len(c["entities"])
        c["active"] = sum(1 for r in c["entities"] if r["active"])
    return {"cards": cards, "counts": counts}


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
        "area": {"area_id": area["area_id"], "name": area["name"], "icon": area["icon"], "floor_id": floor["floor_id"], "floor_name": floor["name"], "level": floor["level"]},
        "floor_areas": siblings,
        **body,
        "scoped": scoped,
    }
