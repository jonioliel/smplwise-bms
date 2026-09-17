"""Event centre API (chapter 26, T032): scoped listing, per-camera markers for the timeline, acknowledge,
summary and a WebSocket that pushes new events as they are stored."""
from __future__ import annotations

import asyncio
import datetime as dt
import json
import queue
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, WebSocket
from pydantic import BaseModel, Field
from fastapi.responses import FileResponse, JSONResponse
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..config import Settings
from ..db import Database, now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import correlation, events_derive, events_ingest, thumbnails
from ..services.access import camera_allowed, require_camera, visible_camera_ids
from ..services.timeutil import iso_utc, local_day_bounds, parse_utc, zone
from .media import _principal_for_ws
from .settings import read_settings

router = APIRouter()
TYPES = ("motion", "person", "vehicle", "line", "field", "offline", "tamper", "door", "io", "storage", "system", "coverage_gap", "manual", "other")


def _scope(conn: sqlite3.Connection, principal: Principal) -> tuple[bool, set[str] | None]:
    """(installation_wide, visible camera ids). Camera-less events are shown to installation-wide readers only."""
    ids = visible_camera_ids(conn, principal, "events.read")
    if ids is None:
        return True, None
    if not ids and not authorize(conn, principal, "events.read", INSTALLATION).allowed:
        # no floor grants either → make the denial explicit (audited)
        require(conn, principal, "events.read", INSTALLATION)
    return False, ids


def _visible(row: dict[str, Any], wide: bool, ids: set[str] | None) -> bool:
    if wide:
        return True
    return bool(row.get("camera_id")) and row["camera_id"] in (ids or set())


def _with_names(conn: sqlite3.Connection, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    names = {r["id"]: (r["alias"] or r["name_source"] or r["id"]) for r in conn.execute("SELECT id, alias, name_source FROM cameras").fetchall()}
    for r in rows:
        r["camera_name"] = names.get(r.get("camera_id") or "", None)
        if r.get("source") == "ha" and not r["camera_name"]:
            r["camera_name"] = (r.get("details") or {}).get("name")  # a sensor transition is shown under the sensor's name (T053)
    return rows


def _with_thumbs(settings: Settings, rows: list[dict[str, Any]], queue_first: int = 0) -> list[dict[str, Any]]:
    """Thumbnail state per row; the first `queue_first` rows without one are queued for generation."""
    ask: list[str] = []
    for i, r in enumerate(rows):
        if not thumbnails.eligible(r):
            r["thumbnail"] = "unavailable"
            continue
        st = thumbnails.status_for(settings, r["id"])
        if st == "none" and i < queue_first:
            ask.append(r["id"])
            st = "pending"
        r["thumbnail"] = st
    if ask:
        thumbnails.WORKER.request(settings, ask)
    return rows


@router.get("/events")
def list_events(
    request: Request,
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
    camera_id: str | None = None,
    type: str | None = Query(None, pattern="^[a-z_]+$"),
    unacked: bool = False,
    acked: bool = False,
    limit: int = Query(200, ge=1, le=1000),
    site_id: str | None = None,
    building_id: str | None = None,
    floor_id: str | None = None,
    zone_id: str | None = None,
    source: str | None = Query(None, pattern="^(alertstream|recording|system|ha)$"),
    severity: str | None = Query(None, pattern="^(info|alert|critical)$"),
) -> dict[str, Any]:
    """Events by time, camera, type, place (site / building / floor / zone, through the current anchors) and source.
    A filter that cannot match by construction — a type this installation never produced, a place without placed
    items — is reported in `filters.unsupported` instead of an empty list that looks like "nothing happened" (T062)."""
    # list_windows calls this function directly: Query defaults arrive as Query objects, never as values
    type = type if isinstance(type, str) else None
    source = source if isinstance(source, str) else None
    severity = severity if isinstance(severity, str) else None
    wide, ids = _scope(conn, principal)
    s = read_settings(conn)
    tz_name = s["time.zone"]
    unsupported: list[dict[str, str]] = []
    applied = {k: v for k, v in {"camera_id": camera_id, "type": type, "site_id": site_id, "building_id": building_id, "floor_id": floor_id, "zone_id": zone_id, "source": source, "severity": severity}.items() if v}
    place = _place_filter(conn, site_id, building_id, floor_id, zone_id)
    if place is not None:
        cams, ents, note = place
        if note:
            unsupported.append(note)
    if type and type not in _types_present(conn, 90):
        unsupported.append({"field": "type", "value": type, "reason": _type_reason(type, 90)})
    if date:
        start, end = local_day_bounds(dt.date.fromisoformat(date), zone(tz_name))
    elif from_ and to:
        try:
            start, end = parse_utc(from_), parse_utc(to)
        except ValueError:
            raise ApiError(422, "validation", "זמן חייב להיות UTC (Z).")
    else:
        # default: the last 24 h, with a little slack for events that arrive as we ask
        end = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5)
        start = end - dt.timedelta(hours=24, minutes=5)
    sql = "SELECT * FROM events WHERE occurred_at >= ? AND occurred_at < ?"
    args: list[Any] = [iso_utc(start), iso_utc(end)]
    if camera_id:
        sql += " AND camera_id = ?"
        args.append(camera_id)
    if type:
        sql += " AND type = ?"
        args.append(type)
    if source:
        sql += " AND source = ?"
        args.append(source)
    if severity:
        sql += " AND severity = ?"
        args.append(severity)
    if place is not None:
        cams, ents, _ = place
        parts = []
        if cams:
            parts.append(f"camera_id IN ({','.join('?' * len(cams))})")
            args.extend(sorted(cams))
        if ents:
            parts.append(f"(source = 'ha' AND json_extract(details_json, '$.entity_id') IN ({','.join('?' * len(ents))}))")
            args.extend(sorted(ents))
        sql += " AND (" + " OR ".join(parts) + ")" if parts else " AND 0"
    if unacked:
        sql += " AND acked_at IS NULL"
    if acked:
        sql += " AND acked_at IS NOT NULL"
    sql += " ORDER BY occurred_at DESC LIMIT ?"
    args.append(limit * 3 if not wide else limit)
    rows = [events_ingest.row_to_event(r) for r in conn.execute(sql, args).fetchall()]
    rows = [r for r in rows if _visible(r, wide, ids)][:limit]
    _with_thumbs(settings_of(request), rows, queue_first=30)
    return {
        "events": _with_names(conn, rows),
        "from": iso_utc(start),
        "to": iso_utc(end),
        "timezone": tz_name,
        "ingest": events_ingest.STATE.as_dict(),
        "derive": events_derive.STATE,
        "types": TYPES,
        "filters": {"applied": applied, "unsupported": unsupported},
    }


# ---------------------------------------------------------------- spatial metadata search (T062)

TYPE_REASON = {
    "person": "ה־NVR לא שלח אירוע זיהוי אדם ב־{days} הימים האחרונים; דורש אירועים חכמים (VCA) במצלמה או ב־NVR",
    "vehicle": "ה־NVR לא שלח אירוע זיהוי רכב ב־{days} הימים האחרונים; דורש אירועים חכמים (VCA) במצלמה או ב־NVR",
    "line": "ה־NVR לא שלח חציית קו ב־{days} הימים האחרונים; דורש הגדרת line crossing במצלמה",
    "field": "ה־NVR לא שלח חדירה לאזור ב־{days} הימים האחרונים; דורש הגדרת intrusion במצלמה",
    "door": "לא נרשמו מעברי מצב של חיישני דלת או מנעולים מ־Home Assistant ב־{days} הימים האחרונים",
    "coverage_gap": "לא נרשמו פערי כיסוי ב־{days} הימים האחרונים (זה טוב)",
}


def _type_reason(t: str, days: int) -> str:
    return TYPE_REASON.get(t, "סוג האירוע לא הופיע ב־{days} הימים האחרונים; המערכת מציגה רק סוגים שהמקורות שלה מפיקים בפועל").format(days=days)


def _types_present(conn: sqlite3.Connection, days: int) -> dict[str, int]:
    since = iso_utc(dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days))
    return {r["type"]: r["n"] for r in conn.execute("SELECT type, COUNT(*) AS n FROM events WHERE occurred_at >= ? GROUP BY type", (since,)).fetchall()}


def _place_filter(conn: sqlite3.Connection, site_id: str | None, building_id: str | None, floor_id: str | None, zone_id: str | None) -> tuple[set[str], set[str], dict[str, str] | None] | None:
    """Cameras and HA entities whose current anchor lies in the requested place; None when no place was asked for.
    The third element names why the filter cannot match (nothing placed there), so the caller can say so."""
    if not any((site_id, building_id, floor_id, zone_id)):
        return None
    if zone_id:
        z = conn.execute("SELECT * FROM spatial_zones WHERE id = ? AND deleted_at IS NULL", (zone_id,)).fetchone()
        if not z:
            raise ApiError(404, "not_found", "האזור לא נמצא.")
        poly = json.loads(z["polygon_json"])
        anchors = conn.execute("SELECT resource_type, resource_id, x, y FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL", (z["floor_id"],)).fetchall()
        cams = {a["resource_id"] for a in anchors if a["resource_type"] == "camera" and correlation._inside(a["x"], a["y"], poly)}
        ents = {a["resource_id"] for a in anchors if a["resource_type"] == "ha_entity" and correlation._inside(a["x"], a["y"], poly)}
        note = None if cams or ents else {"field": "zone_id", "value": zone_id, "reason": f"באזור \"{z['name']}\" לא מוצבות מצלמות או חיישנים, ולכן אין אירועים שאפשר לשייך אליו"}
        return cams, ents, note
    if floor_id:
        if not conn.execute("SELECT 1 FROM floors WHERE id = ? AND deleted_at IS NULL", (floor_id,)).fetchone():
            raise ApiError(404, "not_found", "הקומה לא נמצאה.")
        floors, field, value = {floor_id}, "floor_id", floor_id
    elif building_id:
        floors = {r["id"] for r in conn.execute("SELECT id FROM floors WHERE building_id = ? AND deleted_at IS NULL", (building_id,)).fetchall()}
        field, value = "building_id", building_id
    else:
        floors = {r["id"] for r in conn.execute("SELECT f.id FROM floors f JOIN buildings b ON b.id = f.building_id WHERE b.site_id = ? AND f.deleted_at IS NULL", (site_id,)).fetchall()}
        field, value = "site_id", site_id or ""
    cams: set[str] = set()
    ents: set[str] = set()
    if floors:
        q = ",".join("?" * len(floors))
        for a in conn.execute(f"SELECT resource_type, resource_id FROM map_anchors WHERE floor_id IN ({q}) AND effective_to IS NULL", sorted(floors)).fetchall():
            (cams if a["resource_type"] == "camera" else ents).add(a["resource_id"])
    note = None if cams or ents else {"field": field, "value": value, "reason": "במקום הזה לא מוצבות מצלמות או חיישנים על תוכנית; הצב פריטים בעורך התוכנית כדי לחפש לפי מיקום"}
    return cams, ents, note


@router.get("/events/facets")
def event_facets(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn), days: int = Query(90, ge=1, le=365)) -> dict[str, Any]:
    """Which search fields have data in this installation and why the others are empty (T062): types, sources and
    severities seen in the last `days`, the places (site / building / floor / zone) with what is placed in them."""
    wide, ids = _scope(conn, principal)
    since = iso_utc(dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days))
    types: dict[str, int] = {}
    sources: dict[str, int] = {}
    severities: dict[str, int] = {}
    for r in conn.execute("SELECT type, source, severity, camera_id, COUNT(*) AS n FROM events WHERE occurred_at >= ? GROUP BY type, source, severity, camera_id", (since,)).fetchall():
        if not wide and (r["camera_id"] is None or r["camera_id"] not in (ids or set())):
            continue
        types[r["type"]] = types.get(r["type"], 0) + r["n"]
        sources[r["source"]] = sources.get(r["source"], 0) + r["n"]
        severities[r["severity"]] = severities.get(r["severity"], 0) + r["n"]
    placed: dict[str, dict[str, int]] = {}
    zone_hits: dict[str, dict[str, int]] = {}
    anchors = conn.execute("SELECT floor_id, resource_type, resource_id, x, y FROM map_anchors WHERE effective_to IS NULL").fetchall()
    zones = conn.execute("SELECT id, floor_id, name, kind, polygon_json FROM spatial_zones WHERE deleted_at IS NULL ORDER BY name").fetchall()
    for a in anchors:
        if not wide and a["resource_type"] == "camera" and a["resource_id"] not in (ids or set()):
            continue
        p = placed.setdefault(a["floor_id"], {"cameras": 0, "sensors": 0})
        p["cameras" if a["resource_type"] == "camera" else "sensors"] += 1
        for z in zones:
            if z["floor_id"] == a["floor_id"] and correlation._inside(a["x"], a["y"], json.loads(z["polygon_json"])):
                zh = zone_hits.setdefault(z["id"], {"cameras": 0, "sensors": 0})
                zh["cameras" if a["resource_type"] == "camera" else "sensors"] += 1
    places = []
    for site in conn.execute("SELECT id, name FROM sites WHERE deleted_at IS NULL ORDER BY sort_order, name").fetchall():
        buildings = []
        for b in conn.execute("SELECT id, name FROM buildings WHERE site_id = ? AND deleted_at IS NULL ORDER BY sort_order, name", (site["id"],)).fetchall():
            floors = []
            for f in conn.execute("SELECT id, name FROM floors WHERE building_id = ? AND deleted_at IS NULL ORDER BY sort_order, level", (b["id"],)).fetchall():
                counts = placed.get(f["id"], {"cameras": 0, "sensors": 0})
                floors.append({"id": f["id"], "name": f["name"], **counts, "zones": [{"id": z["id"], "name": z["name"], "kind": z["kind"], **zone_hits.get(z["id"], {"cameras": 0, "sensors": 0})} for z in zones if z["floor_id"] == f["id"]]})
            buildings.append({"id": b["id"], "name": b["name"], "floors": floors})
        places.append({"id": site["id"], "name": site["name"], "buildings": buildings})
    notes = []
    if "ha" not in sources:
        notes.append("אין אירועי חיישנים (HA) בתקופה: או ש־Home Assistant לא מחובר, או שאין חיישני דלת / תנועה / מנעולים שהשתנו")
    if not any(p["cameras"] for p in placed.values()):
        notes.append("אף מצלמה לא מוצבת על תוכנית: חיפוש לפי מקום אינו אפשרי עד שמציבים מצלמות בעורך התוכנית")
    return {
        "days": days, "since": since,
        "types": [{"type": t, "count": n} for t, n in sorted(types.items(), key=lambda kv: -kv[1])],
        "sources": [{"source": t, "count": n} for t, n in sorted(sources.items(), key=lambda kv: -kv[1])],
        "severities": [{"severity": t, "count": n} for t, n in sorted(severities.items(), key=lambda kv: -kv[1])],
        "unavailable_types": [{"type": t, "reason": _type_reason(t, days)} for t in TYPES if t not in types],
        "places": places, "notes": notes,
    }


@router.get("/events/summary")
def summary(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    wide, ids = _scope(conn, principal)
    s = read_settings(conn)
    start, end = local_day_bounds(dt.datetime.now(zone(s["time.zone"])).date(), zone(s["time.zone"]))
    rows = [events_ingest.row_to_event(r) for r in conn.execute("SELECT * FROM events WHERE occurred_at >= ? AND occurred_at < ?", (iso_utc(start), iso_utc(end))).fetchall()]
    rows = [r for r in rows if _visible(r, wide, ids)]
    by_type: dict[str, int] = {}
    for r in rows:
        by_type[r["type"]] = by_type.get(r["type"], 0) + 1
    return {
        "today": {"total": len(rows), "unacked": sum(1 for r in rows if not r["acked_at"]), "by_type": by_type, "measured": sum(1 for r in rows if r["confidence"] == "measured"), "inferred": sum(1 for r in rows if r["confidence"] == "inferred")},
        "ingest": events_ingest.STATE.as_dict(),
        "derive": events_derive.STATE,
    }


SEVERITY_RANK = {"info": 0, "alert": 1, "critical": 2}


GROUP_MODES = ("camera", "all", "zone", "floor")


def camera_groups(conn: sqlite3.Connection, by: str) -> dict[str, tuple[str, str]]:
    """camera_id -> (group key, label) for the zone / floor grouping modes, from the current map anchors."""
    out: dict[str, tuple[str, str]] = {}
    if by not in ("zone", "floor"):
        return out
    floors = {r["id"]: f"{r['bname']} · {r['fname']}" for r in conn.execute(
        "SELECT f.id, f.name AS fname, b.name AS bname FROM floors f JOIN buildings b ON b.id = f.building_id WHERE f.deleted_at IS NULL").fetchall()}
    zones: dict[str, list[tuple[str, str, list[dict[str, float]]]]] = {}
    if by == "zone":
        for z in conn.execute("SELECT id, floor_id, name, polygon_json FROM spatial_zones WHERE deleted_at IS NULL ORDER BY name").fetchall():
            try:
                poly = json.loads(z["polygon_json"] or "[]")
            except ValueError:
                poly = []
            if len(poly) >= 3:
                zones.setdefault(z["floor_id"], []).append((z["id"], z["name"], poly))
    for a in conn.execute("SELECT floor_id, resource_id, x, y FROM map_anchors WHERE resource_type = 'camera' AND effective_to IS NULL").fetchall():
        if by == "floor":
            out[a["resource_id"]] = (f"floor:{a['floor_id']}", floors.get(a["floor_id"], "קומה"))
            continue
        hit = next(((zid, name) for zid, name, poly in zones.get(a["floor_id"], []) if correlation._inside(a["x"], a["y"], poly)), None)
        out[a["resource_id"]] = (f"zone:{hit[0]}", hit[1]) if hit else (f"nozone:{a['floor_id']}", f"ללא חדר · {floors.get(a['floor_id'], 'קומה')}")
    return out


def group_windows(events: list[dict[str, Any]], gap_seconds: int, by: str = "camera", groups: dict[str, tuple[str, str]] | None = None) -> list[dict[str, Any]]:
    """Merge events whose gaps are at most `gap_seconds` into review windows (newest first). `by` picks what a window
    spans: one camera (default), every camera together, a room (zone) or a floor - `groups` maps camera ids to the
    (key, label) of the last two; cameras without a place fall into "לא ממופה". System events (no camera) form one
    window each. The raw events keep their ids inside the window."""
    groups = groups or {}

    def key_of(ev: dict[str, Any]) -> tuple[str | None, str | None]:
        cam = ev.get("camera_id")
        if cam is None:
            return None, None
        if by == "camera":
            return cam, None
        if by == "all":
            return "all", "כל המצלמות"
        g = groups.get(cam)
        return (g[0], g[1]) if g else ("unplaced", "לא ממופה")

    by_key: dict[str | None, list[dict[str, Any]]] = {}
    labels: dict[str | None, str | None] = {}
    for ev in events:
        k, label = key_of(ev)
        by_key.setdefault(k, []).append(ev)
        labels[k] = label
    windows: list[dict[str, Any]] = []
    for k, items in by_key.items():
        items.sort(key=lambda e: e["occurred_at"])
        current: dict[str, Any] | None = None
        for ev in items:
            start = parse_utc(ev["occurred_at"])
            end = parse_utc(ev["ended_at"]) if ev.get("ended_at") else start
            if current is not None and k is not None and (start - current["_end"]).total_seconds() <= gap_seconds:
                current["_end"] = max(current["_end"], end)
                current["_events"].append(ev)
            else:
                cam = ev.get("camera_id") if by == "camera" else None
                current = {"_start": start, "_end": end, "_events": [ev], "camera_id": cam, "_key": k, "_label": labels.get(k)}
                windows.append(current)
    out: list[dict[str, Any]] = []
    for w in windows:
        evs = w["_events"]
        types: dict[str, int] = {}
        for ev in evs:
            types[ev["type"]] = types.get(ev["type"], 0) + 1
        dominant = max(types.items(), key=lambda kv: (kv[1], kv[0]))[0]
        severity = max((ev["severity"] for ev in evs), key=lambda sv: SEVERITY_RANK.get(sv, 0))
        acked = sum(1 for ev in evs if ev.get("acked_at"))
        thumb_ev = next((ev for ev in evs if ev.get("thumbnail") == "ready"), None) or next((ev for ev in evs if ev.get("thumbnail") == "pending"), None) or evs[0]
        cameras = sorted({ev.get("camera_id") for ev in evs if ev.get("camera_id")})
        out.append({
            "id": f"{w['_key'] or 'system'}:{iso_utc(w['_start'])}",
            "camera_id": w["camera_id"],
            "camera_name": evs[0].get("camera_name") if by == "camera" or w["_key"] is None else w["_label"],
            "channel": evs[0].get("channel") if by == "camera" or w["_key"] is None else None,
            "group": by,
            "group_label": w["_label"],
            "camera_ids": cameras,
            "camera_names": sorted({ev.get("camera_name") for ev in evs if ev.get("camera_name")}),
            "start": iso_utc(w["_start"]),
            "end": iso_utc(w["_end"]),
            "count": len(evs),
            "types": types,
            "dominant_type": dominant,
            "severity": severity,
            "acked_count": acked,
            "acked": acked == len(evs),
            "first_event_id": evs[0]["id"],
            "last_event_id": evs[-1]["id"],
            "event_ids": [ev["id"] for ev in evs],
            "thumbnail": thumb_ev.get("thumbnail", "none"),
            "thumbnail_event_id": thumb_ev["id"],
            "confidence": "measured" if any(ev.get("confidence") == "measured" for ev in evs) else "inferred",
        })
    out.sort(key=lambda w: w["start"], reverse=True)
    return out


@router.get("/events/windows")
def list_windows(
    request: Request,
    principal: Principal = Depends(current_principal),
    conn: sqlite3.Connection = Depends(get_conn),
    date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
    camera_id: str | None = None,
    gap: int = Query(180, ge=30, le=3600),
    limit: int = Query(200, ge=1, le=1000),
    by: str = Query("camera", pattern="^(camera|all|zone|floor)$"),
) -> dict[str, Any]:
    """Review windows (design M26): the day's events grouped by proximity - per camera, all cameras together, per
    room or per floor (`by`, 0.1.62); nothing is deleted or merged in the store, the raw events stay reachable
    through their ids."""
    raw = list_events(request, principal, conn, date=date, from_=from_, to=to, camera_id=camera_id, type=None, unacked=False, acked=False, limit=1000)
    windows = group_windows(raw["events"], gap, by, camera_groups(conn, by))[:limit]
    return {"windows": windows, "from": raw["from"], "to": raw["to"], "timezone": raw["timezone"], "gap_seconds": gap, "group": by, "events_total": len(raw["events"]), "ingest": raw["ingest"]}


class AckManyIn(BaseModel):
    event_ids: list[str] = Field(min_length=1, max_length=500)


@router.post("/events/ack-many")
def ack_many(body: AckManyIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Handle a whole window: every event is checked for scope like a single ack; each ack is audited by name."""
    acked: list[str] = []
    skipped: list[str] = []
    for eid in dict.fromkeys(body.event_ids):
        row = conn.execute("SELECT * FROM events WHERE id = ?", (eid,)).fetchone()
        if not row:
            skipped.append(eid)
            continue
        ev = events_ingest.row_to_event(row)
        allowed = camera_allowed(conn, principal, ev["camera_id"], "events.ack") if ev["camera_id"] else authorize(conn, principal, "events.ack", INSTALLATION).allowed
        if not allowed and not authorize(conn, principal, "events.ack", INSTALLATION).allowed:
            skipped.append(eid)
            continue
        if not ev["acked_at"]:
            conn.execute("UPDATE events SET acked_at = ?, acked_by = ?, acked_by_username = ? WHERE id = ?", (now_iso(), principal.user_id, principal.username, eid))
            audit(conn, actor=principal, action="event.ack", decision="allowed", resource_type="event", resource_id=eid,
                  request_id=getattr(request.state, "correlation_id", None), details={"type": ev["type"], "camera_id": ev["camera_id"], "occurred_at": ev["occurred_at"], "window": True})
        acked.append(eid)
    if not acked and skipped:
        require(conn, principal, "events.ack", INSTALLATION)
    return {"acked": acked, "skipped": skipped}


@router.get("/cameras/{camera_id}/events")
def camera_events(camera_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$")) -> dict[str, Any]:
    """Timeline markers for one camera and local day (events.read or video.playback on that camera)."""
    if not conn.execute("SELECT 1 FROM cameras WHERE id = ?", (camera_id,)).fetchone():
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    if not (camera_allowed(conn, principal, camera_id, "events.read") or camera_allowed(conn, principal, camera_id, "video.playback")):
        require(conn, principal, "events.read", INSTALLATION)
    s = read_settings(conn)
    start, end = local_day_bounds(dt.date.fromisoformat(date), zone(s["time.zone"]))
    rows = [events_ingest.row_to_event(r) for r in conn.execute("SELECT * FROM events WHERE camera_id = ? AND occurred_at >= ? AND occurred_at < ? ORDER BY occurred_at", (camera_id, iso_utc(start), iso_utc(end))).fetchall()]
    return {"camera_id": camera_id, "date": date, "timezone": s["time.zone"], "events": rows}


@router.get("/events/{event_id}/thumbnail")
def thumbnail(event_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)):
    """The event's picture from the recording: 200 image/jpeg when ready, 202 while it is being grabbed,
    404 when the recording has no usable frame (remembered for an hour)."""
    row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    if not row:
        raise ApiError(404, "not_found", "האירוע לא נמצא.")
    ev = events_ingest.row_to_event(row)
    if ev["camera_id"]:
        require_camera(conn, principal, ev["camera_id"], "events.read")
    else:
        require(conn, principal, "events.read", INSTALLATION)
    settings = settings_of(request)
    if not thumbnails.eligible(ev):
        raise ApiError(404, "thumbnail_unavailable", "לאירוע הזה אין הקלטה לתמונה.")
    st = thumbnails.status_for(settings, event_id)
    if st == "ready":
        return FileResponse(thumbnails.path_for(settings, event_id), media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})
    if st == "unavailable":
        raise ApiError(404, "thumbnail_unavailable", "לא נמצא פריים בהקלטה בזמן האירוע.")
    if st == "none":
        thumbnails.WORKER.request(settings, [event_id])
    return JSONResponse(status_code=202, content={"status": "pending", "queued": thumbnails.STATE["queued"]}, headers={"Retry-After": "4"})


def _inside(x: float, y: float, poly: list[dict[str, float]]) -> bool:
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        a, b = poly[i], poly[j]
        if (a["y"] > y) != (b["y"] > y) and x < (b["x"] - a["x"]) * (y - a["y"]) / (b["y"] - a["y"]) + a["x"]:
            inside = not inside
        j = i
    return inside


def _area(poly: list[dict[str, float]]) -> float:
    return abs(sum(poly[i]["x"] * poly[(i + 1) % len(poly)]["y"] - poly[(i + 1) % len(poly)]["x"] * poly[i]["y"] for i in range(len(poly)))) / 2


def _location(conn: sqlite3.Connection, camera_id: str) -> dict[str, Any] | None:
    """Where the camera sits: its current anchor, the floor and building, the smallest zone containing it (M27)."""
    a = conn.execute(
        "SELECT a.id AS anchor_id, a.floor_id, a.x, a.y, f.name AS floor_name, f.building_id, b.name AS building_name FROM map_anchors a "
        "JOIN floors f ON f.id = a.floor_id JOIN buildings b ON b.id = f.building_id "
        "WHERE a.resource_type = 'camera' AND a.resource_id = ? AND a.effective_to IS NULL ORDER BY a.updated_at DESC LIMIT 1",
        (camera_id,),
    ).fetchone()
    if not a:
        return None
    zone = None
    best = None
    for z in conn.execute("SELECT name, polygon_json FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL", (a["floor_id"],)).fetchall():
        poly = json.loads(z["polygon_json"])
        if len(poly) >= 3 and _inside(a["x"], a["y"], poly):
            area = _area(poly)
            if best is None or area < best:
                best, zone = area, z["name"]
    has_plan = conn.execute("SELECT 1 FROM plan_versions WHERE floor_id = ? AND status = 'published'", (a["floor_id"],)).fetchone() is not None
    return {
        "anchor_id": a["anchor_id"],
        "floor_id": a["floor_id"],
        "floor_name": a["floor_name"],
        "building_id": a["building_id"],
        "building_name": a["building_name"],
        "x": a["x"],
        "y": a["y"],
        "zone": zone,
        "has_plan": has_plan,
    }


@router.get("/events/{event_id}")
def get_event(event_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """One event with its picture state and the camera's place on the floor (event page, design M27)."""
    row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    if not row:
        raise ApiError(404, "not_found", "האירוע לא נמצא.")
    ev = events_ingest.row_to_event(row)
    if ev["camera_id"]:
        require_camera(conn, principal, ev["camera_id"], "events.read")
    else:
        require(conn, principal, "events.read", INSTALLATION)
    _with_thumbs(settings_of(request), [ev], queue_first=1)
    _with_names(conn, [ev])
    ev["location"] = _location(conn, ev["camera_id"]) if ev["camera_id"] else None
    ev["timezone"] = read_settings(conn)["time.zone"]
    return ev


@router.get("/events/{event_id}/correlation")
def event_correlation(event_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), window: int = Query(120, ge=10, le=3600)) -> dict[str, Any]:
    """Door–camera–sensor neighbourhood of an event (T053): what nearby sensors, locks, commands and cameras reported
    within ±window seconds, each with its certainty. A command is never proof; nothing here triggers an action."""
    row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    if not row:
        raise ApiError(404, "not_found", "האירוע לא נמצא.")
    ev = events_ingest.row_to_event(row)
    if ev["camera_id"]:
        require_camera(conn, principal, ev["camera_id"], "events.read")
    else:
        require(conn, principal, "events.read", INSTALLATION)
    wide, ids = _scope(conn, principal)
    can_entities = authorize(conn, principal, "entity.state.read", INSTALLATION).allowed
    out = correlation.correlate(conn, ev, window_s=window, camera_ids_allowed=None if wide else (ids or set()), include_entities=can_entities)
    _with_names(conn, [ev])
    out["event"] = {k: ev.get(k) for k in ("id", "type", "source", "camera_id", "camera_name", "occurred_at", "received_at", "confidence", "details")}
    return out


@router.get("/events/{event_id}/route")
def event_route(event_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), window: int = Query(90, ge=10, le=900)) -> dict[str, Any]:
    """Suggested next cameras for a hypothetical path after the event (T064): same room, adjacent room, within reach —
    ranked, with the window to look at and the activity each camera reported. Never an identification; never an action."""
    row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    if not row:
        raise ApiError(404, "not_found", "האירוע לא נמצא.")
    ev = events_ingest.row_to_event(row)
    if ev["camera_id"]:
        require_camera(conn, principal, ev["camera_id"], "events.read")
    else:
        require(conn, principal, "events.read", INSTALLATION)
    wide, ids = _scope(conn, principal)
    return correlation.suggest_route(conn, ev, window_s=window, camera_ids_allowed=None if wide else (ids or set()))


@router.post("/events/{event_id}/ack")
def ack(event_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    if not row:
        raise ApiError(404, "not_found", "האירוע לא נמצא.")
    ev = events_ingest.row_to_event(row)
    if ev["camera_id"]:
        require_camera(conn, principal, ev["camera_id"], "events.ack")
    else:
        require(conn, principal, "events.ack", INSTALLATION)
    if not ev["acked_at"]:
        conn.execute("UPDATE events SET acked_at = ?, acked_by = ?, acked_by_username = ? WHERE id = ?", (now_iso(), principal.user_id, principal.username, event_id))
        audit(conn, actor=principal, action="event.ack", decision="allowed", resource_type="event", resource_id=event_id,
              request_id=getattr(request.state, "correlation_id", None), details={"type": ev["type"], "camera_id": ev["camera_id"], "occurred_at": ev["occurred_at"]})
    out = events_ingest.row_to_event(conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone())
    return _with_names(conn, [out])[0]


@router.websocket("/events/ws")
async def events_ws(websocket: WebSocket) -> None:
    """Pushes each newly stored event (scoped to the caller) as {"type":"event_added","payload":event}; a
    heartbeat every 30 s carries the ingestion state so the client can show coverage honestly."""
    db: Database = websocket.app.state.db
    principal = await _principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return

    def _scope_now() -> tuple[bool, set[str] | None]:
        with db.connection() as conn:
            ids = visible_camera_ids(conn, principal, "events.read")
            if ids is None:
                return True, None
            if not ids and not authorize(conn, principal, "events.read", INSTALLATION).allowed:
                return False, set()
            return False, ids

    try:
        wide, ids = await run_in_threadpool(_scope_now)
    except ApiError:
        await websocket.close(code=4403)
        return
    await websocket.accept()
    q = events_ingest.subscribe()
    seq = 0
    last_scope = asyncio.get_event_loop().time()
    try:
        while True:
            try:
                ev = await asyncio.wait_for(asyncio.get_event_loop().run_in_executor(None, q.get, True, 30), timeout=31)
            except (asyncio.TimeoutError, queue.Empty):
                seq += 1
                await websocket.send_text(json.dumps({"version": 1, "type": "heartbeat", "sequence": seq, "subscription_id": principal.user_id, "occurred_at": now_iso(), "received_at": now_iso(), "payload": {"ingest": events_ingest.STATE.as_dict()}}))
                continue
            if asyncio.get_event_loop().time() - last_scope > 60:  # permission changes apply within a minute
                wide, ids = await run_in_threadpool(_scope_now)
                last_scope = asyncio.get_event_loop().time()
            if not _visible(ev, wide, ids):
                continue
            msg_type = ev.get("_type", "event_added")
            seq += 1
            await websocket.send_text(json.dumps({"version": 1, "type": msg_type, "sequence": seq, "subscription_id": principal.user_id, "occurred_at": ev["occurred_at"], "received_at": now_iso(), "payload": {k: v for k, v in ev.items() if k != "_type"}}, ensure_ascii=False))
    except Exception:
        pass
    finally:
        events_ingest.unsubscribe(q)
