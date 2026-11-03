"""NOTICEGB-295 slice B - the building-status chips of the TV feed (`info[]`, CR-NOTICE106 section 8.3): one chip per kind the board
opted into (`display.blocks.info`) and the installation actually has. States only - a word and a colour - never a person, a plate, an
entity id, a count of people or a device name. Read-only: nothing here writes, and a missing or switched-off module yields no chip
(never an error), so a board that asks for a kind the installation lacks simply shows fewer chips.

Kinds and where they come from:
* elevators - the infrastructure elevators (`infra_elevators`, enabled rows) through the same derivation the operator screen uses.
* generator - the detected generators (`generator_devices`), the engine state and the availability of their core roles.
* parking / gym - TV-CHIPS-2381 (owner 03.11, Q4 = A): the entities the administrator picked in the notice-board settings
  (`notices.info.parking_entities` / `notices.info.gym_entities`, read from the state mirror `ha_entities`). Nothing picked = no chip
  (never a made-up state). Parking: a number = free spaces (summed over the picked entities), an on / off entity = one space (on =
  taken), a list entity (input_select / select) = its option as written; gym: on / off = open / closed (an occupancy, presence or motion
  sensor: in use / free), a list entity = its option as written. The chip carries the state word only - never the entity, its name or a
  count of people.
"""
from __future__ import annotations

import sqlite3
from typing import Any, Callable

from ...db import get_setting
from . import model

TEXT = {
    "he": {"elevators": "מעליות", "generator": "גנרטור", "parking": "חניה", "gym": "חדר כושר",
           "ok_el": "פועלות", "svc": "בטיפול", "fault": "תקלה", "partial": "מידע חלקי", "na": "לא זמין",
           "ready": "מוכן", "running": "פועל", "starting": "מתניע", "cooling": "מתקרר",
           "free_n": "{n} פנויות", "free_1": "מקום אחד פנוי", "full": "מלאה", "open": "פתוח", "closed": "סגור", "in_use": "בשימוש",
           "vacant": "פנוי"},
    "en": {"elevators": "Elevators", "generator": "Generator", "parking": "Parking", "gym": "Gym",
           "ok_el": "Running", "svc": "Service", "fault": "Fault", "partial": "Partial data", "na": "Unavailable",
           "ready": "Ready", "running": "Running", "starting": "Starting", "cooling": "Cooling down",
           "free_n": "{n} free", "free_1": "1 free", "full": "Full", "open": "Open", "closed": "Closed", "in_use": "In use", "vacant": "Free"},
}
_BAD = {"fault": "alarm", "out_of_service": "warn", "fire_service": "warn"}
_RANK = {"alarm": 3, "warn": 2, "off": 1, "ok": 0}


def _chip(kind: str, state: str, text: str, lang: str) -> dict[str, str]:
    return {"kind": kind, "label": TEXT[lang][kind], "state": state, "text": text}


def elevators(conn: sqlite3.Connection, lang: str, connected: bool) -> dict[str, str] | None:
    from .. import elevators as el

    t = TEXT[lang]
    rows = conn.execute("SELECT id, show_travel FROM infra_elevators WHERE enabled = 1 ORDER BY sort_order, id").fetchall()
    if not rows:
        return None
    if not connected:
        return _chip("elevators", "off", t["na"], lang)
    sensors = el.sensors_of(conn, [r["id"] for r in rows])
    states = [el.live_of(sensors.get(r["id"], []), connected=True, travel=bool(r["show_travel"]))["state"] for r in rows]
    worst = max((_BAD.get(s, "ok") for s in states), key=lambda k: _RANK[k])
    unknown = sum(1 for s in states if s == "unknown")
    if worst == "alarm":
        return _chip("elevators", "alarm", t["fault"], lang)
    if worst == "warn":
        return _chip("elevators", "warn", t["svc"], lang)
    if unknown == len(states):
        return _chip("elevators", "off", t["na"], lang)
    if unknown:
        return _chip("elevators", "warn", t["partial"], lang)
    return _chip("elevators", "ok", t["ok_el"], lang)


def generator(conn: sqlite3.Connection, lang: str, connected: bool) -> dict[str, str] | None:
    from .. import generator_core as core

    t = TEXT[lang]
    rows = conn.execute("SELECT id FROM generator_devices WHERE status <> 'removed' ORDER BY id").fetchall()
    if not rows:
        return None
    values = core.read_values_bulk(conn, [r["id"] for r in rows])
    best: tuple[int, str, str] = (-1, "ok", t["ready"])
    for r in rows:
        v = values.get(r["id"], {})
        if core.availability(v, connected) != "online":
            cand = (_RANK["off"], "off", t["na"])
        else:
            eng = (v.get("engine_state") or {}).get("value")
            cand = {"fault": (_RANK["alarm"], "alarm", t["fault"]), "running": (_RANK["warn"], "warn", t["running"]),
                    "starting": (_RANK["warn"], "warn", t["starting"]), "cooling": (_RANK["warn"], "warn", t["cooling"]),
                    "stopped": (_RANK["ok"], "ok", t["ready"])}.get(eng, (_RANK["off"], "off", t["na"]))
        if cand[0] > best[0]:
            best = cand
    return _chip("generator", best[1], best[2], lang)


# ---------------------------------------------------------------- TV-CHIPS-2381: the entity-backed chips (parking, gym)

_GONE = ("", "unavailable", "unknown", "none")
_OCCUPANCY = ("occupancy", "presence", "motion")
TEXT_MAX = 24  # a list entity's option as written, cut to fit a chip


def _number(v: Any) -> float | None:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    return n if n == n and abs(n) != float("inf") else None


def _ids(conn: sqlite3.Connection, kind: str) -> list[str]:
    return model.info_sources_of(kind, get_setting(conn, f"notices.info.{kind}_entities", "[]") or "[]")


def source_rows(conn: sqlite3.Connection, kind: str) -> list[sqlite3.Row]:
    """The picked entities of a chip that the mirror still knows, in the administrator's order (a removed one is skipped)."""
    ids = _ids(conn, kind)
    if not ids:
        return []
    marks = ",".join("?" * len(ids))
    rows = {r["entity_id"]: r for r in conn.execute(
        f"SELECT entity_id, domain, device_class, state, available FROM ha_entities WHERE entity_id IN ({marks}) AND removed_at IS NULL", ids).fetchall()}
    return [rows[i] for i in ids if i in rows]


def _live(rows: list[sqlite3.Row]) -> list[sqlite3.Row]:
    return [r for r in rows if r["available"] and str(r["state"] or "").strip().lower() not in _GONE]


def _as_text(v: Any) -> str:
    t = " ".join(str(v).split())
    return t if len(t) <= TEXT_MAX else t[: TEXT_MAX - 1].rstrip() + "…"


def parking(conn: sqlite3.Connection, lang: str, connected: bool) -> dict[str, str] | None:
    t = TEXT[lang]
    if not _ids(conn, "parking"):
        return None  # nothing picked: no chip, never a made-up state
    live = _live(source_rows(conn, "parking")) if connected else []
    if not live:
        return _chip("parking", "off", t["na"], lang)
    texts = [r for r in live if r["domain"] in model.INFO_TEXT_DOMAINS]
    if texts:
        return _chip("parking", "ok", _as_text(texts[0]["state"]), lang)
    free = 0
    counted = False
    for r in live:
        if r["domain"] in model.INFO_NUMBER_DOMAINS:
            n = _number(r["state"])
            if n is not None:
                free += max(0, int(n))
                counted = True
        elif r["domain"] in model.INFO_ONOFF_DOMAINS:
            s = str(r["state"]).lower()
            if s in ("on", "off"):
                free += 1 if s == "off" else 0
                counted = True
    if not counted:
        return _chip("parking", "off", t["na"], lang)
    if free <= 0:
        return _chip("parking", "warn", t["full"], lang)
    return _chip("parking", "ok", t["free_1"] if free == 1 else t["free_n"].format(n=free), lang)


def gym(conn: sqlite3.Connection, lang: str, connected: bool) -> dict[str, str] | None:
    t = TEXT[lang]
    if not _ids(conn, "gym"):
        return None
    live = _live(source_rows(conn, "gym")) if connected else []
    if not live:
        return _chip("gym", "off", t["na"], lang)
    texts = [r for r in live if r["domain"] in model.INFO_TEXT_DOMAINS]
    if texts:
        return _chip("gym", "ok", _as_text(texts[0]["state"]), lang)
    onoff = [r for r in live if r["domain"] in model.INFO_ONOFF_DOMAINS and str(r["state"]).lower() in ("on", "off")]
    if not onoff:
        return _chip("gym", "off", t["na"], lang)
    on = any(str(r["state"]).lower() == "on" for r in onoff)
    if all(r["domain"] == "binary_sensor" and (r["device_class"] or "") in _OCCUPANCY for r in onoff):
        return _chip("gym", "ok", t["in_use"] if on else t["vacant"], lang)  # an occupancy sensor: in use / free (no count, no person)
    return _chip("gym", "ok" if on else "off", t["open"] if on else t["closed"], lang)


def candidates(conn: sqlite3.Connection, kind: str) -> list[dict[str, str]]:
    """The entities the settings may offer for a chip: the domains it reads, still in the mirror, not disabled. Parking numbers are offered
    only without a device class (a count, not a temperature); on / off sensors only with a class that can mean a space (parking:
    occupancy, presence or none) or the room (gym: also motion, door, opening). An entity already picked is always offered."""
    domains = model.INFO_SOURCE_DOMAINS.get(kind, ())
    if not domains:
        return []
    picked = set(_ids(conn, kind))
    bin_ok = ("", "occupancy", "presence") if kind == "parking" else ("", "occupancy", "presence", "motion", "door", "opening")
    marks = ",".join("?" * len(domains))
    out: list[dict[str, str]] = []
    for r in conn.execute(f"""SELECT entity_id, domain, device_class, name, state, disabled FROM ha_entities
                              WHERE domain IN ({marks}) AND removed_at IS NULL ORDER BY name, entity_id""", domains).fetchall():
        dc = r["device_class"] or ""
        ok = not r["disabled"]
        if ok and r["domain"] == "binary_sensor":
            ok = dc in bin_ok
        elif ok and r["domain"] == "sensor":
            ok = not dc and _number(r["state"]) is not None
        if ok or r["entity_id"] in picked:
            out.append({"entity_id": r["entity_id"], "name": r["name"] or r["entity_id"], "domain": r["domain"]})
    return out


PROVIDERS: dict[str, Callable[[sqlite3.Connection, str, bool], dict[str, str] | None]] = {
    "elevators": elevators, "generator": generator, "parking": parking, "gym": gym}


def build(conn: sqlite3.Connection, kinds: list[str], lang: str = "he", connected: bool | None = None) -> list[dict[str, str]]:
    """The chips for the kinds a board asked for, in the picker's order; a kind without a provider / module / rows is skipped, and one that
    fails to read is skipped too (a status chip must never break the feed)."""
    if not kinds:
        return []
    lang = lang if lang in TEXT else "he"
    if connected is None:
        from .. import elevators as el

        connected = el.mirror_connected()
    out: list[dict[str, str]] = []
    for kind in kinds:
        fn = PROVIDERS.get(kind)
        if fn is None:
            continue
        try:
            chip = fn(conn, lang, connected)
        except KeyboardInterrupt:
            raise
        except Exception:  # noqa: BLE001 - a missing table (module not migrated) or a bad row: no chip
            chip = None
        if chip:
            out.append(chip)
    return out
