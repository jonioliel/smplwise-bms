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
from fastapi.responses import FileResponse, JSONResponse
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..config import Settings
from ..db import Database, now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import events_derive, events_ingest, thumbnails
from ..services.access import camera_allowed, visible_camera_ids
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
    principal: Principal = Depends(current_principal),
    conn: sqlite3.Connection = Depends(get_conn),
    date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
    camera_id: str | None = None,
    type: str | None = Query(None, pattern="^[a-z_]+$"),
    unacked: bool = False,
    limit: int = Query(200, ge=1, le=1000),
) -> dict[str, Any]:
    wide, ids = _scope(conn, principal)
    s = read_settings(conn)
    tz_name = s["time.zone"]
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
    if unacked:
        sql += " AND acked_at IS NULL"
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
        if not camera_allowed(conn, principal, ev["camera_id"], "events.read"):
            require(conn, principal, "events.read", INSTALLATION)
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


@router.post("/events/{event_id}/ack")
def ack(event_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    if not row:
        raise ApiError(404, "not_found", "האירוע לא נמצא.")
    ev = events_ingest.row_to_event(row)
    if ev["camera_id"]:
        if not camera_allowed(conn, principal, ev["camera_id"], "events.ack"):
            require(conn, principal, "events.ack", INSTALLATION)
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
