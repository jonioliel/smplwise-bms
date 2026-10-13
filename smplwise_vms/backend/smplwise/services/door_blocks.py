"""WXUNBLK: the system administrator's view of what the door path blocks, and what may be released by hand
(Settings > חיבורים > "חסימות פתיחת דלתות"; routers/doors.py `GET /doors/blocks`, `PUT /doors/blocks/entities/{entity_id}`).

Two lists, one switch:
- ENTITIES - every entity of a script-backed platform (template, universal) while a WisKey door exists: blocked, or released by
  an administrator (services/door_overrides.py: why, who, when). An entity a WisKey lock, one mapped to an intercom door, and any
  other platform is never offered a switch: there is nothing to release (a real door, or nothing blocks it).
- ITEMS - the saved automations, scripts, scenes, schedules and launcher buttons the door path refuses to run or enable, from the
  same static resolver as the "פריטים שפותחים דלתות" report (services/door_path.py), with the reason: a real WisKey door step (stays
  refused whatever is released - its own message, until WisKey's automation-actor appendix exists) or only virtual devices (freed by
  releasing them, one by one). The switch is on the entity, never on an item.

Read-only over Arx's own mirror: no call, no write. The writes are `door_overrides.release` / `reblock`, done by the route with
its audit rows."""
from __future__ import annotations

import sqlite3
from typing import Any

from ..db import now_iso
from ..errors import ApiError
from . import door_overrides, door_path, door_run_guard, intercom_doors

# Entities of these domains have no service to call: a template sensor cannot open a door, so listing hundreds of them would only
# hide the ones that can. They are still blocked where a guard asks about them (a service call targeting one), and one that holds
# a release is always listed.
PASSIVE_DOMAINS = frozenset({"sensor", "binary_sensor", "weather", "image", "event", "device_tracker"})
MAX_ENTITIES = 1000
MAX_NAMES = 5  # names of items / devices shown on one row; the rest are counted

# why an entity cannot be released: (HTTP status, error code, Hebrew text). The reason code itself is `details.reason`.
REFUSALS: dict[str, tuple[int, str, str]] = {
    "unknown_entity": (404, "entity_not_found", "ההתקן לא נמצא."),
    "wiskey_door": (409, "not_overridable", "מנעול אינטרקום הוא דלת ואינו ניתן לשחרור."),
    "door_mapped": (409, "not_overridable", "ההתקן משויך לדלת אינטרקום ואינו ניתן לשחרור. אפשר לבטל קודם את השיוך."),
    "not_blocked": (409, "not_overridable", "ההתקן אינו חסום."),
}
NOTE_ERRORS: dict[str, str] = {
    "note_required": "נדרשת סיבה לשחרור (לפחות 3 תווים).",
    "note_too_long": f"הסיבה ארוכה מדי (עד {door_overrides.NOTE_MAX} תווים).",
    "bad_entity": "מזהה ההתקן אינו תקין.",
    "too_many": f"אי אפשר לשחרר יותר מ-{door_overrides.MAX_ENTRIES} התקנים.",
}


def refusal(reason: str) -> ApiError:
    status, code, text = REFUSALS[reason]
    return ApiError(status, code, text, details={"reason": reason})


def note_error(code: str) -> ApiError:
    """The refusal of a release the list cannot store (`OverrideError.code`): a bad id, a missing or long note, a full list."""
    if code == "too_many":
        return ApiError(409, "too_many_overrides", NOTE_ERRORS[code], details={"reason": code})
    return ApiError(422, "validation", NOTE_ERRORS.get(code, NOTE_ERRORS["note_required"]), details={"field": "entity_id" if code == "bad_entity" else "note", "reason": code})


def releasable(conn: sqlite3.Connection, r: door_path.Resolver, entity_id: str) -> str | None:
    """None when `entity_id` is an entity the door path blocks and an administrator may release; otherwise why not (a key of
    REFUSALS). `r` is a resolver built to ignore releases: a release already in place does not make an entity "not blocked"."""
    ent = r.entity(entity_id)
    if ent is None:
        return "unknown_entity"
    platform = ent["platform"] or ""
    if platform in intercom_doors.WISKEY_PLATFORMS:
        return "wiskey_door"
    if intercom_doors.map_row(conn, entity_id) is not None:
        return "door_mapped"
    if platform not in door_path.SCRIPT_BACKED_PLATFORMS or not r.present():
        return "not_blocked"
    return None


def _names(rows: list[str], limit: int = MAX_NAMES) -> tuple[list[str], int]:
    """The first `limit` distinct names in alphabetical order, and how many more there are."""
    every = sorted(dict.fromkeys(rows))
    return every[:limit], max(0, len(every) - limit)


def listing(conn: sqlite3.Connection, *, dev_mode: bool = False) -> dict[str, Any]:
    """The Settings screen's two lists and their counts. Entity ids are keys for the switch; the item rows carry names only."""
    r = door_path.Resolver(conn, ignore_overrides=True)  # what the guards say with no release at all
    present = r.present()
    overrides = door_overrides.read(conn)
    released = set(overrides)

    inv_all = door_path.inventory(conn, dev_mode=dev_mode, ignore_overrides=True, with_entities=True) if present else {"items": []}
    blocked_without = [i for i in inv_all["items"] if i["run_guard"] != "unchanged"]
    if released and blocked_without:
        live = door_path.inventory(conn, dev_mode=dev_mode)  # with the releases: which of them still stay refused
        blocked_now = {i["key"] for i in live["items"] if i["run_guard"] != "unchanged"}
    else:
        blocked_now = {i["key"] for i in blocked_without}

    # --- entities
    rows: list[sqlite3.Row] = []
    if present:
        marks = ",".join("?" * len(door_path.SCRIPT_BACKED_PLATFORMS))
        rows = conn.execute(
            f"SELECT entity_id, domain, platform, name, area_name FROM ha_entities WHERE platform IN ({marks}) AND removed_at IS NULL ORDER BY name COLLATE NOCASE, entity_id",
            tuple(sorted(door_path.SCRIPT_BACKED_PLATFORMS)),
        ).fetchall()
    mapped = {m["entity_id"] for m in intercom_doors.map_rows(conn)}
    names = {e["entity_id"]: (e["name"] or e["entity_id"]) for e in rows}
    used_by: dict[str, list[str]] = {}
    for i in blocked_without:
        for eid in i.get("_entities", []):
            used_by.setdefault(eid, []).append(i["name"])

    seen = {e["entity_id"] for e in rows}
    entities: list[dict[str, Any]] = []
    truncated = False
    for e in rows:
        eid = e["entity_id"]
        held = eid in released
        if e["domain"] in PASSIVE_DOMAINS and not held:
            continue
        if len(entities) >= MAX_ENTITIES and not held:
            truncated = True  # a release is always listed, whatever the limit: it is what an administrator must be able to take back
            continue
        is_door = eid in mapped
        shown, more = _names(used_by.get(eid, []))
        entities.append({
            "entity_id": eid, "name": e["name"] or eid, "domain": e["domain"], "platform": e["platform"], "area": e["area_name"] or None,
            "state": "door" if is_door else ("unblocked" if held else "blocked"),
            "overridable": not is_door, "stale": False,
            "override": overrides[eid].public() if held else None,
            "used_by": shown, "used_more": more,
        })
    # a release whose entity is gone, is no longer script-backed, or whose installation has no WisKey door any more: listed so it can be taken back
    for eid, ov in sorted(overrides.items()):
        if eid in seen:
            continue
        ent = r.entity(eid)
        entities.append({
            "entity_id": eid, "name": (ent or {}).get("name") or eid, "domain": eid.split(".", 1)[0], "platform": (ent or {}).get("platform"), "area": None,
            "state": "unblocked", "overridable": True, "stale": True, "override": ov.public(), "used_by": [], "used_more": 0,
        })

    # --- items
    items: list[dict[str, Any]] = []
    for i in blocked_without:
        ents = i.get("_entities", [])
        devs = sorted(({"name": names.get(eid) or (r.entity(eid) or {}).get("name") or eid, "state": "unblocked" if eid in released else "blocked"} for eid in ents), key=lambda d: d["name"])
        shown_devs = devs[:MAX_NAMES]
        items.append({
            "key": i["key"], "kind": i["kind"], "kind_text": i["kind_text"], "name": i["name"], "state": i["state"],
            "blocked": i["key"] in blocked_now,
            "opens_door": i["door_steps"] > 0,
            # what the guard does (its own words), and for a real door step why it stays - the run / enable refusal's own sentence
            "guard": i["run_guard_text"], "why": door_run_guard.NOT_YET if i["door_steps"] > 0 else None,
            "reasons": i["unresolved"],
            "devices": shown_devs, "devices_more": max(0, len(devs) - len(shown_devs)),
        })
    items.sort(key=lambda x: (not x["blocked"], not x["opens_door"], x["kind"], x["name"]))

    counts = {
        "entities": len(entities),
        "blocked": sum(1 for e in entities if e["state"] == "blocked"),
        "unblocked": sum(1 for e in entities if e["state"] == "unblocked"),
        "items": len(items),
        "items_blocked": sum(1 for x in items if x["blocked"]),
    }
    return {"wiskey_present": present, "generated_at": now_iso(), "entities": entities, "items": items, "counts": counts, "truncated": truncated}
