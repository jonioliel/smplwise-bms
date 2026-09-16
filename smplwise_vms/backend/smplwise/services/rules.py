"""Alarm rules with a dry run (T052). A rule is trigger (event types, sources, minimum severity) × scope (site /
building / floor / zone / camera / entity through the current placements) × time window (site-local days and hours)
× cooldown, with one kind of action in the pilot: a VMS notification (an alert row that the UI shows and a person
acknowledges). Rules evaluate stored events only; alerts are not events and no action touches a device or Home
Assistant, so a rule cannot feed itself or another rule. A rule owned by Home Assistant is kept as a reference
(one owner per automation) and never evaluated here. The dry run replays stored events through the same matcher
without writing anything and explains, per event, why an alert would or would not have been raised."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
import uuid
from typing import Any

from ..db import new_id, now_iso
from .correlation import _inside
from .timeutil import iso_utc, parse_utc, zone

SEVERITY_RANK = {"info": 0, "alert": 1, "critical": 2}
DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
ACTION_KINDS = ("notify",)  # webhooks / device commands are not actions in the pilot (loop and blast-radius control)
MAX_ACTIONS = 3
DRY_RUN_MAX_HOURS = 24 * 14


def row_to_rule(r: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": r["id"], "name": r["name"], "description": r["description"], "enabled": bool(r["enabled"]), "owner": r["owner"], "ha_automation_id": r["ha_automation_id"],
        "trigger": json.loads(r["trigger_json"]), "scope": json.loads(r["scope_json"]), "window": json.loads(r["window_json"]), "cooldown_s": r["cooldown_s"],
        "actions": json.loads(r["actions_json"]), "revision": r["revision"], "created_by_username": r["created_by_username"], "updated_by_username": r["updated_by_username"],
        "created_at": r["created_at"], "updated_at": r["updated_at"], "last_fired_at": r["last_fired_at"],
    }


def scope_sets(conn: sqlite3.Connection, scope: dict[str, Any]) -> tuple[set[str] | None, set[str] | None]:
    """Cameras and HA entities a scope covers through the current placements; (None, None) = everything."""
    keys = ("site_ids", "building_ids", "floor_ids", "zone_ids", "camera_ids", "entity_ids")
    if not any(scope.get(k) for k in keys):
        return None, None
    cams: set[str] = set(scope.get("camera_ids") or [])
    ents: set[str] = set(scope.get("entity_ids") or [])
    floors: set[str] = set(scope.get("floor_ids") or [])
    for bid in scope.get("building_ids") or []:
        floors |= {r["id"] for r in conn.execute("SELECT id FROM floors WHERE building_id = ? AND deleted_at IS NULL", (bid,)).fetchall()}
    for sid in scope.get("site_ids") or []:
        floors |= {r["id"] for r in conn.execute("SELECT f.id FROM floors f JOIN buildings b ON b.id = f.building_id WHERE b.site_id = ? AND f.deleted_at IS NULL", (sid,)).fetchall()}
    if floors:
        q = ",".join("?" * len(floors))
        for a in conn.execute(f"SELECT resource_type, resource_id FROM map_anchors WHERE floor_id IN ({q}) AND effective_to IS NULL", sorted(floors)).fetchall():
            (cams if a["resource_type"] == "camera" else ents).add(a["resource_id"])
    for zid in scope.get("zone_ids") or []:
        z = conn.execute("SELECT floor_id, polygon_json FROM spatial_zones WHERE id = ? AND deleted_at IS NULL", (zid,)).fetchone()
        if not z:
            continue
        poly = json.loads(z["polygon_json"])
        for a in conn.execute("SELECT resource_type, resource_id, x, y FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL", (z["floor_id"],)).fetchall():
            if len(poly) >= 3 and _inside(a["x"], a["y"], poly):
                (cams if a["resource_type"] == "camera" else ents).add(a["resource_id"])
    return cams, ents


def in_window(window: dict[str, Any], at: dt.datetime, tz_name: str) -> tuple[bool, str]:
    days = [d for d in (window.get("days") or []) if d in DAYS]
    start, end = window.get("from"), window.get("to")
    if not days and not start and not end:
        return True, "ללא חלון זמן"
    local = at.astimezone(zone(tz_name))
    day = DAYS[local.weekday()]
    if days and day not in days:
        return False, f"מחוץ לימים ({day})"
    if start or end:
        hm = local.strftime("%H:%M")
        s, e = start or "00:00", end or "24:00"
        inside = (s <= hm < e) if s <= e else (hm >= s or hm < e)  # overnight window
        if not inside:
            return False, f"מחוץ לשעות ({hm} לא בטווח {s}–{e})"
    return True, f"בחלון ({day} {local.strftime('%H:%M')})"


def match(conn: sqlite3.Connection, rule: dict[str, Any], ev: dict[str, Any], tz_name: str, last_fired: dict[tuple[str, str], str] | None = None) -> dict[str, Any]:
    """Explain the decision for one event: fire / not, with the reason of every step."""
    reasons: list[str] = []
    trig = rule["trigger"]
    types = trig.get("types") or []
    if types and ev["type"] not in types:
        return {"fire": False, "suppressed": None, "reasons": [f"סוג {ev['type']} אינו ברשימה"]}
    reasons.append("סוג תואם" if types else "כל הסוגים")
    sources = trig.get("sources") or []
    if sources and ev["source"] not in sources:
        return {"fire": False, "suppressed": None, "reasons": reasons + [f"מקור {ev['source']} אינו ברשימה"]}
    if SEVERITY_RANK.get(ev.get("severity", "info"), 0) < SEVERITY_RANK.get(trig.get("severity_min", "info"), 0):
        return {"fire": False, "suppressed": None, "reasons": reasons + [f"חומרה {ev.get('severity')} נמוכה מהסף"]}
    cams, ents = scope_sets(conn, rule["scope"])
    target = ev.get("camera_id") or ((ev.get("details") or {}).get("entity_id") if ev.get("source") == "ha" else None)
    if cams is None:
        reasons.append("היקף: הכל")
    elif ev.get("camera_id"):
        if ev["camera_id"] not in cams:
            return {"fire": False, "suppressed": None, "reasons": reasons + ["המצלמה מחוץ להיקף"]}
        reasons.append("מצלמה בהיקף")
    elif ev.get("source") == "ha":
        if target not in (ents or set()):
            return {"fire": False, "suppressed": None, "reasons": reasons + ["הישות מחוץ להיקף"]}
        reasons.append("ישות בהיקף")
    else:
        return {"fire": False, "suppressed": None, "reasons": reasons + ["אירוע מערכת ללא מיקום; ההיקף מוגבל"]}
    ok, why = in_window(rule["window"], parse_utc(ev["occurred_at"]), tz_name)
    reasons.append(why)
    if not ok:
        return {"fire": False, "suppressed": None, "reasons": reasons}
    key = (rule["id"], target or "")
    cooldown = int(rule.get("cooldown_s") or 0)
    if cooldown:
        prev = None
        if last_fired is not None:
            prev = last_fired.get(key)
        else:
            row = conn.execute("SELECT MAX(occurred_at) FROM rule_alerts WHERE rule_id = ? AND COALESCE(camera_id, entity_id, '') = ?", (rule["id"], target or "")).fetchone()
            prev = row[0] if row else None
        if prev and (parse_utc(ev["occurred_at"]) - parse_utc(prev)).total_seconds() < cooldown:
            return {"fire": False, "suppressed": f"cooldown {cooldown} שנ׳ מאז {prev}", "reasons": reasons}
    return {"fire": True, "suppressed": None, "reasons": reasons + ["פעולה: התראה במערכת"]}


def evaluate_event(conn: sqlite3.Connection, ev: dict[str, Any], tz_name: str | None = None) -> list[dict[str, Any]]:
    """Run every enabled local rule against a freshly stored event; write the alerts. Never raises into ingestion."""
    if tz_name is None:
        from ..routers.settings import read_settings  # local import: settings live in the routers package

        tz_name = read_settings(conn)["time.zone"]
    fired: list[dict[str, Any]] = []
    for r in conn.execute("SELECT * FROM rules WHERE enabled = 1 AND owner = 'local' ORDER BY created_at").fetchall():
        rule = row_to_rule(r)
        try:
            m = match(conn, rule, ev, tz_name)
        except Exception:  # noqa: BLE001 - a broken rule must not stop ingestion
            continue
        if not m["fire"]:
            continue
        target_cam = ev.get("camera_id")
        target_ent = (ev.get("details") or {}).get("entity_id") if ev.get("source") == "ha" else None
        message = next((a.get("message") for a in rule["actions"] if a.get("kind") == "notify" and a.get("message")), "") or rule["name"]
        aid = new_id()
        now = now_iso()
        conn.execute(
            "INSERT OR IGNORE INTO rule_alerts(id, rule_id, event_id, camera_id, entity_id, fired_at, occurred_at, reasons_json, message) VALUES (?,?,?,?,?,?,?,?,?)",
            (aid, rule["id"], ev["id"], target_cam, target_ent, now, ev["occurred_at"], json.dumps(m["reasons"], ensure_ascii=False), message),
        )
        conn.execute("UPDATE rules SET last_fired_at = ? WHERE id = ?", (now, rule["id"]))
        fired.append({"id": aid, "rule_id": rule["id"], "rule_name": rule["name"], "event_id": ev["id"], "message": message, "reasons": m["reasons"]})
    return fired


def dry_run(conn: sqlite3.Connection, rule: dict[str, Any], hours: int, tz_name: str, now: dt.datetime | None = None) -> dict[str, Any]:
    """Replay stored events of the last `hours` through the matcher, with an in-memory cooldown; writes nothing."""
    now = now or dt.datetime.now(dt.timezone.utc)
    hours = max(1, min(DRY_RUN_MAX_HOURS, hours))
    since = iso_utc(now - dt.timedelta(hours=hours))
    from .events_ingest import row_to_event

    rows = [row_to_event(r) for r in conn.execute("SELECT * FROM events WHERE occurred_at >= ? AND occurred_at <= ? ORDER BY occurred_at", (since, iso_utc(now))).fetchall()]
    names = {r["id"]: (r["alias"] or r["name_source"] or f"ערוץ {r['channel']}") for r in conn.execute("SELECT id, alias, name_source, channel FROM cameras").fetchall()}
    last_fired: dict[tuple[str, str], str] = {}
    rule = {**rule, "id": rule.get("id") or "dry-run"}
    would: list[dict[str, Any]] = []
    suppressed: list[dict[str, Any]] = []
    not_matched = 0
    for ev in rows:
        m = match(conn, rule, ev, tz_name, last_fired)
        target = ev.get("camera_id") or ((ev.get("details") or {}).get("entity_id") if ev.get("source") == "ha" else None) or ""
        summary = {"event_id": ev["id"], "occurred_at": ev["occurred_at"], "type": ev["type"], "source": ev["source"], "severity": ev.get("severity"),
                   "camera_id": ev.get("camera_id"), "camera_name": names.get(ev.get("camera_id") or "") or ((ev.get("details") or {}).get("name") if ev.get("source") == "ha" else None), "reasons": m["reasons"]}
        if m["fire"]:
            last_fired[(rule["id"], target)] = ev["occurred_at"]
            would.append(summary)
        elif m["suppressed"]:
            suppressed.append({**summary, "suppressed": m["suppressed"]})
        else:
            not_matched += 1
    return {
        "hours": hours, "since": since, "until": iso_utc(now), "evaluated": len(rows), "would_fire": would, "suppressed": suppressed, "not_matched": not_matched,
        "note": "הרצה יבשה: שום התראה לא נשלחה ושום פקודה לא בוצעה; החוק נבדק מול אירועים שכבר נשמרו.",
    }


def alert_row(r: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": r["id"], "rule_id": r["rule_id"], "rule_name": r["rule_name"] if "rule_name" in r.keys() else None, "event_id": r["event_id"], "camera_id": r["camera_id"], "entity_id": r["entity_id"],
        "fired_at": r["fired_at"], "occurred_at": r["occurred_at"], "reasons": json.loads(r["reasons_json"] or "[]"), "message": r["message"], "acked_at": r["acked_at"], "acked_by_username": r["acked_by_username"],
    }


def unused_uuid() -> str:  # pragma: no cover - kept for symmetry with other services' id helpers
    return uuid.uuid4().hex[:12]
