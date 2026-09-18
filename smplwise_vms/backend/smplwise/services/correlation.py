"""Door–camera–sensor correlation (T053). Security-relevant Home Assistant state transitions (door and window
contacts, motion sensors, locks, gates) are kept as VMS events with source 'ha', and an event's neighbourhood in
time and space is assembled with the certainty of every link: a contact sensor transition is measured, a camera
event is measured or inferred as the NVR said, and a pulse unlock is a command that was sent — never proof that
a door opened. Nothing here triggers an action; delayed clocks and missing states are named, not guessed."""
from __future__ import annotations

import datetime as dt
import json
import re
import math
import sqlite3
import uuid
from typing import Any

from ..db import now_iso
from .events_ingest import row_to_event
from .timeutil import iso_utc, parse_utc

DOOR_CLASSES = {"door", "opening", "garage_door", "window", "gate"}
MOTION_CLASSES = {"motion", "occupancy", "moving", "presence", "vibration"}
DOOR_WORDS = ("door", "gate", "דלת", "שער", "כניסה")
NEAR_RADIUS = 0.12  # normalized plan units: a room-scale neighbourhood on a typical floor plan
DELAYED_CLOCK_S = 30
OPEN_STATES = {"on", "open", "opening", "unlocked", "unlocking", "triggered", "detected"}
POLICY = "הקורלציה מציגה ראיות בלבד. שום פעולה (פתיחה, נטרול, unlock/disarm) אינה מופעלת אוטומטית מתוצאה של קורלציה או של ניתוח וידאו."


def tracked_kind(entity_id: str, domain: str, device_class: str | None, name: str = "") -> str | None:
    """The VMS event type this entity's transitions are recorded as, or None when the entity is not security-relevant."""
    dc = (device_class or "").lower()
    if domain == "binary_sensor":
        if dc in DOOR_CLASSES:
            return "door"
        if dc in MOTION_CLASSES:
            return "motion"
        hay = f"{entity_id} {name}".lower()
        return "door" if any(w in hay for w in DOOR_WORDS) else None
    if domain == "lock":
        return "door"
    if domain == "cover":
        return "door" if dc in ("door", "garage", "gate") else None
    if domain == "alarm_control_panel":
        return "other"
    return None


def record_transition(conn: sqlite3.Connection, old: dict[str, Any] | None, new: dict[str, Any]) -> dict[str, Any] | None:
    """Keep one HA state transition as an event (source 'ha'); None when the entity is not tracked or nothing changed.
    Availability changes are kept too (severity alert when the sensor is lost) — a missing state is a fact to show."""
    eid = new.get("entity_id", "")
    domain = eid.split(".", 1)[0]
    attrs = new.get("attributes") or {}
    name = attrs.get("friendly_name") or eid
    kind = tracked_kind(eid, domain, attrs.get("device_class"), name)
    if not kind:
        return None
    if old is None:
        # the entity just appeared (HA start-up, integration reload): there is no previous state, so nothing moved.
        # Without this every HA restart wrote one "None → state" door event per lock and sensor (live review F11).
        return None
    old_state = old.get("state")
    state = new.get("state")
    if state is None or old_state == state:
        return None
    try:
        occurred = iso_utc(parse_utc(new.get("last_changed") or ""))
    except (ValueError, TypeError):
        occurred = now_iso()
    key = f"ha:{eid}:{occurred}"
    if conn.execute("SELECT 1 FROM events WHERE dedup_key = ?", (key,)).fetchone():
        return None
    availability = "lost" if state in ("unavailable", "unknown") else ("restored" if old_state in ("unavailable", "unknown") else None)
    severity = "alert" if availability == "lost" or (availability is None and str(state).lower() in OPEN_STATES) else "info"
    details = {"entity_id": eid, "name": name, "domain": domain, "device_class": attrs.get("device_class"), "from": old_state, "to": state, "availability": availability, "area": attrs.get("area_id")}
    now = now_iso()
    event_id = uuid.uuid4().hex[:12]
    camera_id, channel = nvr_entity_camera(conn, eid)
    conn.execute(
        "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (event_id, "ha", f"{domain}.{attrs.get('device_class') or ''}".rstrip("."), kind, camera_id, channel, occurred, None, now, "none", 1, severity, "measured", json.dumps(details, ensure_ascii=False), key, now),
    )
    return row_to_event(conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone())



NVR_ENTITY_RE = re.compile(r"_(\d{1,2})_(motiondetection|linedetection|fielddetection|regionentrance|regionexiting|scenechangedetection|shelteralarm|videoloss)$")


def nvr_entity_camera(conn: sqlite3.Connection, entity_id: str) -> tuple[str | None, int | None]:
    """0.1.74: the Home Assistant Hikvision integration names its sensors `<device>_<channel>_<event>`; such an event
    belongs to the camera on that channel (pictures, hover frames, playback). Anything else has no camera."""
    m = NVR_ENTITY_RE.search(entity_id or "")
    if not m:
        return None, None
    ch = int(m.group(1))
    row = conn.execute("SELECT id FROM cameras WHERE channel = ? AND enabled = 1 ORDER BY sort_order LIMIT 1", (ch,)).fetchone()
    return (row["id"], ch) if row else (None, None)


def backfill_ha_event_cameras(conn: sqlite3.Connection) -> int:
    """One pass over stored HA events without a camera (cheap: only rows whose entity id matches the pattern)."""
    n = 0
    for r in conn.execute("SELECT id, details_json FROM events WHERE source = 'ha' AND camera_id IS NULL").fetchall():
        try:
            eid = json.loads(r["details_json"] or "{}").get("entity_id") or ""
        except ValueError:
            continue
        cam, ch = nvr_entity_camera(conn, eid)
        if cam:
            conn.execute("UPDATE events SET camera_id = ?, channel = ? WHERE id = ?", (cam, ch, r["id"]))
            n += 1
    return n

def _inside(x: float, y: float, poly: list[dict[str, float]]) -> bool:
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        a, b = poly[i], poly[j]
        if (a["y"] > y) != (b["y"] > y) and x < (b["x"] - a["x"]) * (y - a["y"]) / (b["y"] - a["y"]) + a["x"]:
            inside = not inside
        j = i
    return inside


def _zone_at(conn: sqlite3.Connection, floor_id: str, x: float, y: float) -> tuple[str | None, list[dict[str, float]] | None]:
    best: tuple[float, str, list[dict[str, float]]] | None = None
    for z in conn.execute("SELECT name, polygon_json FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL", (floor_id,)).fetchall():
        poly = json.loads(z["polygon_json"])
        if len(poly) >= 3 and _inside(x, y, poly):
            area = abs(sum(poly[i]["x"] * poly[(i + 1) % len(poly)]["y"] - poly[(i + 1) % len(poly)]["x"] * poly[i]["y"] for i in range(len(poly)))) / 2
            if best is None or area < best[0]:
                best = (area, z["name"], poly)
    return (best[1], best[2]) if best else (None, None)


def _anchor(conn: sqlite3.Connection, resource_type: str, resource_id: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT a.*, f.name AS floor_name, b.name AS building_name FROM map_anchors a JOIN floors f ON f.id = a.floor_id JOIN buildings b ON b.id = f.building_id "
        "WHERE a.resource_type = ? AND a.resource_id = ? AND a.effective_to IS NULL ORDER BY a.updated_at DESC LIMIT 1",
        (resource_type, resource_id),
    ).fetchone()


def _delta(at: str, t: dt.datetime) -> float:
    return round((parse_utc(at) - t).total_seconds(), 1)


def correlate(conn: sqlite3.Connection, ev: dict[str, Any], window_s: int = 120, camera_ids_allowed: set[str] | None = None, include_entities: bool = True) -> dict[str, Any]:
    """What nearby sensors, locks, commands and cameras reported within ±window_s of the event, each with its certainty."""
    t = parse_utc(ev["occurred_at"])
    lo, hi = iso_utc(t - dt.timedelta(seconds=window_s)), iso_utc(t + dt.timedelta(seconds=window_s))
    notes: list[dict[str, str]] = []
    if ev.get("received_at"):
        try:
            lag = (parse_utc(ev["received_at"]) - t).total_seconds()
        except ValueError:
            lag = 0.0
        if abs(lag) > DELAYED_CLOCK_S:
            notes.append({"code": "delayed_clock", "text": f"האירוע התקבל {int(lag)} שניות אחרי זמן ההתרחשות שדווח; ייתכן שעון מכשיר לא מסונכרן או עיכוב מסירה. חלון ההשוואה מבוסס על זמן ההתרחשות המדווח."})
    details = ev.get("details") or {}
    if ev.get("camera_id"):
        subject = {"kind": "camera", "id": ev["camera_id"]}
        anchor = _anchor(conn, "camera", ev["camera_id"])
    elif ev.get("source") == "ha" and details.get("entity_id"):
        subject = {"kind": "entity", "id": details["entity_id"]}
        anchor = _anchor(conn, "ha_entity", details["entity_id"])
    else:
        subject = {"kind": "system", "id": None}
        anchor = None
    location = None
    neighbours: list[dict[str, Any]] = []
    if anchor is not None:
        zone_name, poly = _zone_at(conn, anchor["floor_id"], anchor["x"], anchor["y"])
        location = {"floor_id": anchor["floor_id"], "floor_name": anchor["floor_name"], "building_name": anchor["building_name"], "x": anchor["x"], "y": anchor["y"], "zone": zone_name, "radius": NEAR_RADIUS}
        for a in conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL AND id != ?", (anchor["floor_id"], anchor["id"])).fetchall():
            dist = math.hypot(a["x"] - anchor["x"], a["y"] - anchor["y"])
            same_zone = bool(poly) and _inside(a["x"], a["y"], poly)
            if dist <= NEAR_RADIUS or same_zone:
                neighbours.append({"resource_type": a["resource_type"], "resource_id": a["resource_id"], "distance": round(dist, 3), "same_zone": same_zone})
    else:
        notes.append({"code": "unplaced", "text": "הפריט אינו מוצב על תוכנית קומה; ההשוואה לפי זמן בלבד, מול כל החיישנים הנעקבים."})
    entity_ids = [n["resource_id"] for n in neighbours if n["resource_type"] == "ha_entity"]
    if subject["kind"] == "entity":
        entity_ids.insert(0, subject["id"])
    camera_ids = [n["resource_id"] for n in neighbours if n["resource_type"] == "camera"]
    if subject["kind"] == "camera":
        camera_ids.insert(0, subject["id"])
    if camera_ids_allowed is not None:
        camera_ids = [c for c in camera_ids if c in camera_ids_allowed]
    dist_of = {n["resource_id"]: n for n in neighbours}
    entities: list[dict[str, Any]] = []
    if include_entities and (entity_ids or anchor is None):
        q = "SELECT * FROM ha_entities WHERE removed_at IS NULL" + (f" AND entity_id IN ({','.join('?' * len(entity_ids))})" if entity_ids else "")
        for r in conn.execute(q, entity_ids).fetchall():
            kind = tracked_kind(r["entity_id"], r["domain"], r["device_class"], r["name"])
            if anchor is None and not kind:
                continue  # time-only mode lists tracked sensors only
            missing = not r["available"] or r["state"] in (None, "unknown", "unavailable")
            entities.append({
                "entity_id": r["entity_id"], "name": r["name"] or r["entity_id"], "domain": r["domain"], "device_class": r["device_class"], "tracked_as": kind,
                "state": r["state"], "last_changed": r["last_changed"], "state_missing": missing,
                "distance": dist_of.get(r["entity_id"], {}).get("distance"), "same_zone": dist_of.get(r["entity_id"], {}).get("same_zone", False),
            })
            if missing:
                notes.append({"code": "missing_state", "text": f"{r['name'] or r['entity_id']}: אין מצב ידוע כרגע ({r['state'] or 'ללא מצב'}); היעדר אירוע מחיישן זה אינו הוכחה שדבר לא קרה."})
        if anchor is None:
            entity_ids = [e["entity_id"] for e in entities]
    elif not include_entities:
        notes.append({"code": "entities_hidden", "text": "אין הרשאה לקרוא מצבי ישויות HA; מוצגים אירועי מצלמות בלבד."})
        entity_ids = []
    links: list[dict[str, Any]] = []
    if entity_ids:
        for r in conn.execute("SELECT * FROM events WHERE source = 'ha' AND occurred_at >= ? AND occurred_at <= ? AND id != ? ORDER BY occurred_at", (lo, hi, ev["id"])).fetchall():
            e = row_to_event(r)
            d = e["details"]
            if d.get("entity_id") not in entity_ids:
                continue
            avail = d.get("availability")
            links.append({
                "kind": "sensor", "event_id": e["id"], "entity_id": d["entity_id"], "name": d.get("name") or d["entity_id"], "type": e["type"], "at": e["occurred_at"], "delta_s": _delta(e["occurred_at"], t),
                "label": f"{d.get('name') or d['entity_id']}: {d.get('from') or 'לא ידוע'} → {d.get('to')}", "certainty": "measured" if not avail else "availability",
                "note": "החיישן איבד קשר" if avail == "lost" else "החיישן חזר לדווח" if avail == "restored" else "מצב שנמדד בחיישן (זמן HA)",
            })
        q = f"SELECT * FROM ha_actions WHERE entity_id IN ({','.join('?' * len(entity_ids))}) AND requested_at >= ? AND requested_at <= ? ORDER BY requested_at"
        for a in conn.execute(q, (*entity_ids, lo, hi)).fetchall():
            confirmed = a["status"] == "confirmed"
            links.append({
                "kind": "command", "action_id": a["id"], "entity_id": a["entity_id"], "name": a["entity_id"], "action": a["action_id"], "status": a["status"], "by": a["principal_username"],
                "at": a["requested_at"], "delta_s": _delta(a["requested_at"], t), "label": f"פקודה {a['action_id']} ({a['status']}) על {a['entity_id']}", "certainty": "command",
                "note": ("הפקודה אושרה לפי מצב הישות" if confirmed else "הפקודה לא אושרה לפי מצב") + " · פקודת פתיחה אינה הוכחה שהדלת נפתחה בפועל",
            })
    if camera_ids:
        q = f"SELECT * FROM events WHERE camera_id IN ({','.join('?' * len(camera_ids))}) AND occurred_at >= ? AND occurred_at <= ? AND id != ? ORDER BY occurred_at"
        names = {r["id"]: (r["alias"] or r["name_source"] or f"ערוץ {r['channel']}") for r in conn.execute("SELECT id, alias, name_source, channel FROM cameras").fetchall()}
        for r in conn.execute(q, (*camera_ids, lo, hi, ev["id"])).fetchall():
            e = row_to_event(r)
            links.append({
                "kind": "camera", "event_id": e["id"], "camera_id": e["camera_id"], "name": names.get(e["camera_id"], e["camera_id"]), "type": e["type"], "at": e["occurred_at"], "delta_s": _delta(e["occurred_at"], t),
                "label": f"{names.get(e['camera_id'], e['camera_id'])}: {e['type']}", "certainty": e["confidence"],
                "note": "נגזר ממטא־דאטה של הקלטה" if e["confidence"] == "inferred" else "התראה מה־NVR",
            })
    links.sort(key=lambda l: abs(l["delta_s"]))
    return {
        "event_id": ev["id"], "window_s": window_s, "subject": subject, "spatial": anchor is not None, "location": location,
        "entities": entities, "cameras": [{"camera_id": c, "distance": dist_of.get(c, {}).get("distance"), "same_zone": dist_of.get(c, {}).get("same_zone", False)} for c in camera_ids],
        "links": links, "notes": notes, "policy": POLICY,
    }


# ---------------------------------------------------------------- suggested path (T064): topology only, always hypothetical

ROUTE_RADIUS = 0.2
ROUTE_BEFORE_S = 15
ROUTE_POLICY = "הצעה לפי טופולוגיית המפה בלבד (אותו חדר, חדר סמוך, קרבה). אין כאן טענה שמדובר באותו אדם או רכב; המפעיל בוחר את הרצף ומאשר אותו בתיק. שום פעולת אבטחה אינה מופעלת מהצעה."
RELATION_LABEL = {"same_zone": "אותו חדר", "adjacent_zone": "חדר סמוך", "nearby": "בקרבת מקום"}


def _seg_dist(px: float, py: float, a: dict[str, float], b: dict[str, float]) -> float:
    ax, ay, bx, by = a["x"], a["y"], b["x"], b["y"]
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    u = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + u * dx), py - (ay + u * dy))


def polygons_touch(pa: list[dict[str, float]], pb: list[dict[str, float]], eps: float = 0.01) -> bool:
    """Two rooms are adjacent when they share a border (a vertex of one lies on or inside the other, within eps)."""
    for poly, other in ((pa, pb), (pb, pa)):
        for p in poly:
            if _inside(p["x"], p["y"], other):
                return True
            for i in range(len(other)):
                if _seg_dist(p["x"], p["y"], other[i], other[(i + 1) % len(other)]) <= eps:
                    return True
    return False


def suggest_route(conn: sqlite3.Connection, ev: dict[str, Any], window_s: int = 90, camera_ids_allowed: set[str] | None = None) -> dict[str, Any]:
    """Cameras worth looking at next after `ev`, ranked same room → adjacent room → within reach, with the time window
    and the activity each camera reported in it. Every suggestion is hypothetical linkage, never an identification."""
    t = parse_utc(ev["occurred_at"])
    lo, hi = iso_utc(t - dt.timedelta(seconds=ROUTE_BEFORE_S)), iso_utc(t + dt.timedelta(seconds=window_s))
    out: dict[str, Any] = {"event_id": ev["id"], "hypothetical": True, "spatial": False, "subject": None, "location": None, "window": {"from": lo, "to": hi}, "suggestions": [], "notes": [], "policy": ROUTE_POLICY}
    names = {r["id"]: (r["alias"] or r["name_source"] or f"ערוץ {r['channel']}") for r in conn.execute("SELECT id, alias, name_source, channel FROM cameras").fetchall()}
    if not ev.get("camera_id"):
        out["notes"].append("אירוע ללא מצלמה; אין נקודת מוצא למסלול.")
        return out
    out["subject"] = {"camera_id": ev["camera_id"], "name": names.get(ev["camera_id"], ev["camera_id"]), "zone": None}
    anchor = _anchor(conn, "camera", ev["camera_id"])
    if anchor is None:
        out["notes"].append("המצלמה אינה מוצבת על תוכנית קומה; אין טופולוגיה להציע ממנה.")
        return out
    out["spatial"] = True
    out["location"] = {"floor_id": anchor["floor_id"], "floor_name": anchor["floor_name"], "building_name": anchor["building_name"]}
    zones = [(z["name"], json.loads(z["polygon_json"])) for z in conn.execute("SELECT name, polygon_json FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL", (anchor["floor_id"],)).fetchall()]
    zones = [(n, p) for n, p in zones if len(p) >= 3]

    def zone_of(x: float, y: float) -> tuple[str | None, list[dict[str, float]] | None]:
        best = None
        for name, poly in zones:
            if _inside(x, y, poly):
                area = abs(sum(poly[i]["x"] * poly[(i + 1) % len(poly)]["y"] - poly[(i + 1) % len(poly)]["x"] * poly[i]["y"] for i in range(len(poly)))) / 2
                if best is None or area < best[0]:
                    best = (area, name, poly)
        return (best[1], best[2]) if best else (None, None)

    zname, zpoly = zone_of(anchor["x"], anchor["y"])
    out["subject"]["zone"] = zname
    others = conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND resource_type = 'camera' AND effective_to IS NULL AND id != ?", (anchor["floor_id"], anchor["id"])).fetchall()
    ids = [a["resource_id"] for a in others]
    activity: dict[str, int] = {}
    if ids:
        q = f"SELECT camera_id, COUNT(*) AS n FROM events WHERE camera_id IN ({','.join('?' * len(ids))}) AND occurred_at >= ? AND occurred_at <= ? AND id != ? GROUP BY camera_id"
        activity = {r["camera_id"]: r["n"] for r in conn.execute(q, (*ids, lo, hi, ev["id"])).fetchall()}
    rank = {"same_zone": 0, "adjacent_zone": 1, "nearby": 2}
    for a in others:
        if camera_ids_allowed is not None and a["resource_id"] not in camera_ids_allowed:
            continue
        dist = math.hypot(a["x"] - anchor["x"], a["y"] - anchor["y"])
        cz, cpoly = zone_of(a["x"], a["y"])
        if zpoly is not None and cpoly is zpoly:
            relation = "same_zone"
        elif zpoly is not None and cpoly is not None and polygons_touch(zpoly, cpoly):
            relation = "adjacent_zone"
        elif dist <= ROUTE_RADIUS:
            relation = "nearby"
        else:
            continue
        out["suggestions"].append({
            "camera_id": a["resource_id"], "name": names.get(a["resource_id"], a["resource_id"]), "relation": relation, "relation_label": RELATION_LABEL[relation],
            "distance": round(dist, 3), "zone": cz, "activity_events": activity.get(a["resource_id"], 0), "playback_at": ev["occurred_at"],
        })
    out["suggestions"].sort(key=lambda s_: (rank[s_["relation"]], s_["distance"]))
    if not zones:
        out["notes"].append("אין חדרים או אזורים מוגדרים בקומה; ההצעה לפי מרחק בלבד.")
    out["notes"].append("מעברי קומה (מדרגות, מעליות) אינם מוגדרים עדיין; ההצעה נשארת באותה קומה.")
    if not out["suggestions"]:
        out["notes"].append("אין מצלמות נוספות בסביבה על התוכנית.")
    return out
