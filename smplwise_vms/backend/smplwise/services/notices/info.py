"""NOTICEGB-295 slice B - the building-status chips of the TV feed (`info[]`, CR-NOTICE106 section 8.3): one chip per kind the board
opted into (`display.blocks.info`) and the installation actually has. States only - a word and a colour - never a person, a plate, an
entity id, a count of people or a device name. Read-only: nothing here writes, and a missing or switched-off module yields no chip
(never an error), so a board that asks for a kind the installation lacks simply shows fewer chips.

Kinds and where they come from:
* elevators - the infrastructure elevators (`infra_elevators`, enabled rows) through the same derivation the operator screen uses.
* generator - the detected generators (`generator_devices`), the engine state and the availability of their core roles.
* parking / gym - no module in this product exposes a state for them yet; the kinds are accepted (the picker offers them, the data
  contract is stable) and produce no chip until a provider is registered in PROVIDERS.
"""
from __future__ import annotations

import sqlite3
from typing import Any, Callable

TEXT = {
    "he": {"elevators": "מעליות", "generator": "גנרטור", "parking": "חניה", "gym": "חדר כושר",
           "ok_el": "פועלות", "svc": "בטיפול", "fault": "תקלה", "partial": "מידע חלקי", "na": "לא זמין",
           "ready": "מוכן", "running": "פועל", "starting": "מתניע", "cooling": "מתקרר"},
    "en": {"elevators": "Elevators", "generator": "Generator", "parking": "Parking", "gym": "Gym",
           "ok_el": "Running", "svc": "Service", "fault": "Fault", "partial": "Partial data", "na": "Unavailable",
           "ready": "Ready", "running": "Running", "starting": "Starting", "cooling": "Cooling down"},
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


PROVIDERS: dict[str, Callable[[sqlite3.Connection, str, bool], dict[str, str] | None]] = {"elevators": elevators, "generator": generator}


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
