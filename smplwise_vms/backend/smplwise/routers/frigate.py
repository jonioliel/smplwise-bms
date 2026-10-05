"""The Frigate provider API, phase F1 "see and play" (NN5, docs/changes/CR-029-FRIGATE-PROVIDER.md). READ-ONLY toward Frigate.

All routes are under `/frigate/{recorder_id}` and answer only for a recorder whose vendor is `frigate` (the provider selection
is the gate; another vendor's id is a 404). Nothing here writes to Frigate. Arx-side writes are: the camera import (`discover`,
`system.configure`) and the per-user reviewed state.

Authorization (every media asset is authorised, per request):
- status / cameras list of the recorder: whoever may read the recorders (`recorders._may_read`); `discover` and a forced refresh:
  `system.configure`.
- reviews, review thumbnails, reviewed state, motion activity: `events.read`, row-scoped by camera (a camera-less row follows the
  installation-wide grant, like the event centre).
- the latest still of a camera: `video.live` on that camera. Recordings coverage, the HLS playlist and its segments, the
  playback plan and the export design: `video.playback` on that camera.
Credentials and Frigate's address never reach the browser: images and segments are fetched server-side and streamed through Arx.

Severity layers of a review item: `alert` and `detection` (Frigate's own); `motion` is activity density (`/activity`), not an
item. Per-user `reviewed` is Arx's: Frigate's own flag is never written."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
import threading
from typing import Any

from fastapi import APIRouter, Body, Depends, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import autosync
from ..services.access import camera_allowed, require_camera, row_scope
from ..services.recorders import frigate_events as fe
from ..services.recorders import frigate_io
from ..services.recorders import frigate_playback as fp
from ..services.recorders.frigate import FrigateAdapter
from .recorders import PERMISSION, _may_read
from .settings import read_settings

router = APIRouter()

REVIEW_PAGE_MAX = 200
BULK_MAX = 200
ASSET_INFLIGHT = 6
_ASSET_SEMS: dict[str, threading.BoundedSemaphore] = {}
_ASSET_LOCK = threading.Lock()
IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")


# ---------------------------------------------------------------------------------------------- helpers

def _adapter(conn: sqlite3.Connection, request: Request, rid: str) -> FrigateAdapter:
    return frigate_io.adapter_for(conn, settings_of(request), rid)


def _epoch(value: str | float | None, default: float | None = None) -> float | None:
    """An epoch (seconds) or an ISO-8601 instant with an offset -> epoch seconds. 422 `time_invalid` for anything else."""
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        pass
    try:
        from ..services.timeutil import parse_utc

        return parse_utc(str(value)).timestamp()
    except ValueError as exc:
        raise ApiError(422, "time_invalid", "ערך הזמן אינו תקין.", details={"reason": "format"}) from exc


def _camera_row(conn: sqlite3.Connection, principal: Principal, rid: str, camera_id: str, permission: str) -> sqlite3.Row:
    require_camera(conn, principal, camera_id, permission)  # 403 before 404: an unknown id tells a scoped user nothing
    row = conn.execute("SELECT * FROM cameras WHERE id = ? AND recorder_id = ?", (camera_id, rid)).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    if not row["source_ref"]:
        raise ApiError(409, "camera_not_mapped", "למצלמה אין מפתח ב־Frigate; הריצו גילוי מחדש.")
    return row


def _sem(rid: str) -> threading.BoundedSemaphore:
    with _ASSET_LOCK:
        return _ASSET_SEMS.setdefault(rid, threading.BoundedSemaphore(ASSET_INFLIGHT))


def _image(data: bytes, ctype: str, max_age: int) -> Response:
    if ctype not in IMAGE_TYPES:
        raise ApiError(503, "source_invalid", "Frigate לא החזיר תמונה.")
    return Response(data, media_type=ctype, headers={"Cache-Control": f"private, max-age={max_age}", "X-Content-Type-Options": "nosniff"})


def _frigate_info(conn: sqlite3.Connection, rid: str) -> dict[str, Any]:
    rec = conn.execute("SELECT id, name, enabled, removed_at, model, firmware FROM recorders WHERE id = ?", (rid,)).fetchone()
    return dict(rec) if rec else {"id": rid}


# ---------------------------------------------------------------------------------------------- recorders and status

@router.get("/frigate/recorders")
def list_recorders(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The recorders whose vendor is Frigate (names and ids only: never an address, a user name or a secret)."""
    _may_read(conn, principal)
    rows = conn.execute("SELECT id, name, enabled, model, firmware FROM recorders WHERE vendor = 'frigate' AND removed_at IS NULL ORDER BY sort_order, id").fetchall()
    return {"recorders": [{"id": r["id"], "name": r["name"] or r["id"], "enabled": bool(r["enabled"]), "firmware": r["firmware"]} for r in rows]}


@router.get("/frigate/{recorder_id}/status")
def status(recorder_id: str, request: Request, refresh: bool = Query(False), principal: Principal = Depends(current_principal_ro),
           conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Capability discovery (version, minimum, discovered `features` with the scrubbed config summary), the event-sync state and
    the recorder's last health reading. `refresh=true` re-reads Frigate (system.configure); otherwise the cached discovery
    (one minute) is used and read when missing."""
    _may_read(conn, principal)
    if refresh:
        require(conn, principal, PERMISSION, INSTALLATION)
    a = _adapter(conn, request, recorder_id)
    doc = a.discover(refresh=refresh)
    sync = fe.state_of(recorder_id).as_dict()
    row = conn.execute("SELECT * FROM frigate_sync_state WHERE recorder_id = ?", (recorder_id,)).fetchone()
    if row is not None and sync["last_poll_at"] is None:
        sync = {**sync, "last_poll_at": row["last_poll_at"], "ws_state": row["ws_state"], "ws_frames": row["ws_frames"], "last_poll_error": row["last_poll_error"]}
    from ..services import recorder_health as rh

    health = None
    for item in rh.view(conn, settings_of(request)):
        if item["id"] == recorder_id:
            health = item
    return {
        "recorder": _frigate_info(conn, recorder_id), "version": doc["version"], "version_ok": doc["version_ok"], "min_version": doc["min_version"],
        "features": doc["features"], "routes_known": doc["routes_known"], "discovered_at": doc["discovered_at"],
        "retention": doc["summary"].get("retention"), "detectors": doc["summary"].get("detectors"), "cameras": len(doc["summary"]["cameras"]),
        "sync": sync, "health": health, "warnings": a.http.warnings(),
        "live": {"mode": "restream" if doc["features"].get("restream") else "still", "note": "no restream: live tiles are latest-frame stills"},
    }


@router.post("/frigate/{recorder_id}/discover")
def discover(recorder_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Re-read Frigate's camera list and import it into Arx (read-only toward Frigate; `cameras.sync` is audited). Disabled cameras
    are kept as disabled rows; a camera that left the config is marked, never deleted."""
    require(conn, principal, PERMISSION, INSTALLATION)
    _adapter(conn, request, recorder_id)  # 404 unless a Frigate recorder
    return autosync.sync_cameras(settings_of(request), conn, actor=principal, request_id=getattr(request.state, "correlation_id", None), reason="manual", recorder_id=recorder_id)


@router.get("/frigate/{recorder_id}/cameras")
def cameras(recorder_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The recorder's cameras as Arx holds them (id, name, channel, enabled in Arx, enabled in Frigate, status, link to the same
    place on another recorder), limited to the cameras the caller may see."""
    _adapter(conn, request, recorder_id)
    out = []
    links = {}
    for l in conn.execute("SELECT camera_id, linked_camera_id, kind FROM camera_links").fetchall():
        links.setdefault(l["camera_id"], []).append({"camera_id": l["linked_camera_id"], "kind": l["kind"]})
    for r in conn.execute("SELECT * FROM cameras WHERE recorder_id = ? ORDER BY sort_order, channel", (recorder_id,)).fetchall():
        if not (camera_allowed(conn, principal, r["id"], "video.live") or camera_allowed(conn, principal, r["id"], "events.read")):
            continue
        caps = json.loads(r["capabilities_json"] or "{}")
        fr = (caps.get("stream") or {}) if isinstance(caps.get("stream"), dict) else {}
        out.append({"id": r["id"], "key": r["source_ref"], "channel": r["channel"], "name": r["alias"] or r["name_source"], "enabled": bool(r["enabled"]),
                    "frigate_enabled": fr.get("enabled", True), "disabled_reason": fr.get("reason"), "status": r["status"], "snapshots": bool(fr.get("snapshots")),
                    "ptz": bool(fr.get("ptz")), "labels": fr.get("labels") or [], "zones": fr.get("zones") or [], "links": links.get(r["id"], []),
                    "can_view_live": camera_allowed(conn, principal, r["id"], "video.live"), "can_play": camera_allowed(conn, principal, r["id"], "video.playback")})
    if not out and not authorize(conn, principal, "events.read", INSTALLATION).allowed:
        _may_read(conn, principal)
    return {"recorder_id": recorder_id, "cameras": out}


# ---------------------------------------------------------------------------------------------- review items

def _scope_sql(conn: sqlite3.Connection, principal: Principal) -> tuple[str, list[Any]]:
    sc = row_scope(conn, principal, "events.read")
    if not sc.any():
        require(conn, principal, "events.read", INSTALLATION)
    if sc.everything:
        return "", []
    parts, args = [], []
    if sc.cameras.everything:
        parts.append("camera_id IS NOT NULL")
    elif sc.cameras.ids:
        ids = sorted(sc.cameras.ids)
        parts.append(f"camera_id IN ({','.join('?' * len(ids))})")
        args += ids
    if sc.camera_less:
        parts.append("camera_id IS NULL")
    if not parts:
        return " AND 0", []
    return " AND (" + " OR ".join(parts) + ")", args


@router.get("/frigate/{recorder_id}/reviews")
def list_reviews(recorder_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
                 severity: str | None = Query(None, pattern="^(alert|detection)$"), camera_id: str | None = Query(None, max_length=64),
                 reviewed: bool | None = Query(None), from_: str | None = Query(None, alias="from"), to: str | None = Query(None),
                 before: float | None = Query(None), limit: int = Query(50, ge=1, le=REVIEW_PAGE_MAX)) -> dict[str, Any]:
    """Stored review items, newest first, limited to the caller's cameras. `reviewed` is the CALLER's state. Page with `before`
    (the `next_before` of the previous page, an epoch). The motion layer is `/activity`."""
    _adapter(conn, request, recorder_id)
    scope, sargs = _scope_sql(conn, principal)
    sql = ("SELECT r.*, s.reviewed_at AS _reviewed FROM frigate_reviews r LEFT JOIN frigate_review_state s ON s.user_id = ? AND s.recorder_id = r.recorder_id AND s.review_id = r.review_id "
           "WHERE r.recorder_id = ?")
    args: list[Any] = [principal.user_id, recorder_id]
    sc_sql = scope.replace("camera_id", "r.camera_id")
    sql += sc_sql
    args += sargs
    if severity:
        sql += " AND r.severity = ?"
        args.append(severity)
    if camera_id:
        sql += " AND r.camera_id = ?"
        args.append(camera_id)
    if reviewed is True:
        sql += " AND s.reviewed_at IS NOT NULL"
    elif reviewed is False:
        sql += " AND s.reviewed_at IS NULL"
    t_from, t_to = _epoch(from_), _epoch(to)
    if t_from is not None:
        sql += " AND COALESCE(r.end_ts, r.start_ts) >= ?"
        args.append(t_from)
    if t_to is not None:
        sql += " AND r.start_ts < ?"
        args.append(t_to)
    if before is not None:
        sql += " AND r.start_ts < ?"
        args.append(before)
    sql += " ORDER BY r.start_ts DESC LIMIT ?"
    args.append(limit + 1)
    rows = conn.execute(sql, args).fetchall()
    page = rows[:limit]
    names = {c["id"]: (c["alias"] or c["name_source"]) for c in conn.execute("SELECT id, alias, name_source FROM cameras WHERE recorder_id = ?", (recorder_id,)).fetchall()}
    items = []
    for r in page:
        v = fe.review_view(r, reviewed=r["_reviewed"] is not None)
        v["camera_name"] = names.get(v["camera_id"]) or v["camera_key"]
        v["thumbnail"] = f"/api/v1/frigate/{recorder_id}/reviews/{v['id']}/thumbnail"
        items.append(v)
    return {"recorder_id": recorder_id, "items": items, "next_before": page[-1]["start_ts"] if len(rows) > limit and page else None,
            "layers": ["alert", "detection", "motion"], "motion_layer": f"/api/v1/frigate/{recorder_id}/activity"}


def _review_row(conn: sqlite3.Connection, principal: Principal, recorder_id: str, review_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM frigate_reviews WHERE recorder_id = ? AND review_id = ?", (recorder_id, review_id)).fetchone()
    if row is None:
        if not row_scope(conn, principal, "events.read").any():
            require(conn, principal, "events.read", INSTALLATION)  # 403 before 404 for a caller who may see no review at all
        raise ApiError(404, "not_found", "פריט הסקירה לא נמצא.")
    if row["camera_id"]:
        require_camera(conn, principal, row["camera_id"], "events.read")
    else:
        require(conn, principal, "events.read", INSTALLATION)
    return row


@router.get("/frigate/{recorder_id}/reviews/summary")
def reviews_summary(recorder_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
                    days: int = Query(7, ge=1, le=60)) -> dict[str, Any]:
    """Counts of the caller's unreviewed review items per severity and per camera over the last `days` days."""
    _adapter(conn, request, recorder_id)
    scope, sargs = _scope_sql(conn, principal)
    since = dt.datetime.now(dt.timezone.utc).timestamp() - days * 86400
    sql = ("SELECT r.severity, r.camera_id, COUNT(*) AS n, SUM(CASE WHEN s.reviewed_at IS NULL THEN 1 ELSE 0 END) AS unreviewed FROM frigate_reviews r "
           "LEFT JOIN frigate_review_state s ON s.user_id = ? AND s.recorder_id = r.recorder_id AND s.review_id = r.review_id WHERE r.recorder_id = ? AND r.start_ts >= ?"
           + scope.replace("camera_id", "r.camera_id") + " GROUP BY r.severity, r.camera_id")
    by_sev: dict[str, dict[str, int]] = {"alert": {"total": 0, "unreviewed": 0}, "detection": {"total": 0, "unreviewed": 0}}
    by_cam: dict[str, int] = {}
    for r in conn.execute(sql, [principal.user_id, recorder_id, since, *sargs]).fetchall():
        d = by_sev.setdefault(r["severity"], {"total": 0, "unreviewed": 0})
        d["total"] += r["n"]
        d["unreviewed"] += r["unreviewed"] or 0
        if r["camera_id"] and r["unreviewed"]:
            by_cam[r["camera_id"]] = by_cam.get(r["camera_id"], 0) + r["unreviewed"]
    return {"recorder_id": recorder_id, "days": days, "severity": by_sev, "unreviewed_by_camera": by_cam}


@router.get("/frigate/{recorder_id}/reviews/{review_id}")
def get_review(recorder_id: str, review_id: str, request: Request, principal: Principal = Depends(current_principal_ro),
               conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _adapter(conn, request, recorder_id)
    row = _review_row(conn, principal, recorder_id, review_id)
    state = conn.execute("SELECT reviewed_at FROM frigate_review_state WHERE user_id = ? AND recorder_id = ? AND review_id = ?", (principal.user_id, recorder_id, review_id)).fetchone()
    v = fe.review_view(row, reviewed=state is not None)
    v["reviewed_at"] = state["reviewed_at"] if state else None
    v["detection_ids"] = json.loads(row["detections_json"] or "[]")
    v["thumbnail"] = f"/api/v1/frigate/{recorder_id}/reviews/{review_id}/thumbnail"
    return v


@router.get("/frigate/{recorder_id}/reviews/{review_id}/thumbnail")
def review_thumbnail(recorder_id: str, review_id: str, request: Request, principal: Principal = Depends(current_principal_ro),
                     conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    """The review item's thumbnail, fetched by Arx from Frigate with the adapter's session (never a Frigate URL to the browser).
    Falls back to the thumbnail of the first tracked object when the review thumbnail is gone."""
    a = _adapter(conn, request, recorder_id)
    row = _review_row(conn, principal, recorder_id, review_id)
    try:
        data, ctype = a.review_thumbnail(row["source_ref"], review_id)
    except ApiError as exc:
        if exc.code != "not_found":
            raise
        ids = json.loads(row["detections_json"] or "[]")
        if not ids:
            raise ApiError(404, "thumbnail_unavailable", "אין תמונה לפריט הזה.") from exc
        data, ctype = a.event_thumbnail(str(ids[0]))
    return _image(data, ctype, 3600)


class ReviewedIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[str] = Field(min_length=1, max_length=BULK_MAX)
    reviewed: bool = True


@router.post("/frigate/{recorder_id}/reviews/reviewed")
def mark_reviewed(recorder_id: str, body: ReviewedIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Mark review items reviewed (or not) for the CALLER, in bulk. Arx's state only: nothing is written to Frigate. Every item must
    be visible to the caller (events.read on its camera); the first one that is not fails the whole request."""
    _adapter(conn, request, recorder_id)
    ids = list(dict.fromkeys(body.ids))
    for rid in ids:
        _review_row(conn, principal, recorder_id, rid)
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    for rid in ids:
        if body.reviewed:
            conn.execute("INSERT OR IGNORE INTO frigate_review_state(user_id, recorder_id, review_id, reviewed_at) VALUES (?,?,?,?)", (principal.user_id, recorder_id, rid, now))
        else:
            conn.execute("DELETE FROM frigate_review_state WHERE user_id = ? AND recorder_id = ? AND review_id = ?", (principal.user_id, recorder_id, rid))
    return {"recorder_id": recorder_id, "reviewed": body.reviewed, "count": len(ids)}


@router.get("/frigate/{recorder_id}/activity")
def activity(recorder_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
             from_: str | None = Query(None, alias="from"), to: str | None = Query(None)) -> dict[str, Any]:
    """The MOTION layer: Frigate's motion activity density (30 s buckets with the cameras involved) for a window of at most 24 h.
    Limited to the cameras the caller may read."""
    a = _adapter(conn, request, recorder_id)
    scope = row_scope(conn, principal, "events.read")
    if not scope.any():
        require(conn, principal, "events.read", INSTALLATION)
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    end = _epoch(to, now) or now
    start = _epoch(from_, end - 3600) or end - 3600
    fp.validate_window(start, end, 24 * 3600, now)
    allowed_keys = {r["source_ref"] for r in conn.execute("SELECT id, source_ref FROM cameras WHERE recorder_id = ?", (recorder_id,)).fetchall() if scope.allows_row(r["id"])}
    buckets = []
    for b in a.motion_activity(start, end):
        cams = [c for c in str(b.get("camera") or "").split(",") if c in allowed_keys]
        if cams and isinstance(b.get("start_time"), (int, float)) and isinstance(b.get("motion"), (int, float)):
            buckets.append({"start": b["start_time"], "motion": round(float(b["motion"]), 1), "cameras": cams})
    return {"recorder_id": recorder_id, "layer": "motion", "window": {"start": start, "end": end}, "bucket_s": 30, "buckets": buckets}


# ---------------------------------------------------------------------------------------------- stills

@router.get("/frigate/{recorder_id}/cameras/{camera_id}/snapshot")
def snapshot(recorder_id: str, camera_id: str, request: Request, h: int | None = Query(None, ge=1, le=4000), principal: Principal = Depends(current_principal_ro),
             conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    """The latest frame of a camera as a still tile (until a restream exists). `h` is clamped to 120-1440 px. Cached 2 s on the
    server, so any number of viewers cost Frigate one read per camera per interval; at most 4 reads in flight per recorder (429)."""
    cam = _camera_row(conn, principal, recorder_id, camera_id, "video.live")
    if not cam["enabled"]:
        raise ApiError(409, "camera_disabled", "המצלמה מושבתת במערכת.")
    a = _adapter(conn, request, recorder_id)
    data, ctype, cached = frigate_io.still(a, cam["source_ref"], h)
    resp = _image(data, ctype, 2)
    resp.headers["X-Still-Cache"] = "hit" if cached else "miss"
    return resp


# ---------------------------------------------------------------------------------------------- recordings and playback

@router.get("/frigate/{recorder_id}/cameras/{camera_id}/recordings")
def recordings(recorder_id: str, camera_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
               from_: str | None = Query(None, alias="from"), to: str | None = Query(None)) -> dict[str, Any]:
    """Recording coverage of one camera for a window of at most 24 h (default: the last 6 h): merged ranges, the covered ratio, the
    recording POLICY and a motion / object density bar. Partial coverage is partial, not empty: with a motion-only policy
    `sparse_by_design` is true."""
    cam = _camera_row(conn, principal, recorder_id, camera_id, "video.playback")
    a = _adapter(conn, request, recorder_id)
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    end = _epoch(to, now) or now
    start = _epoch(from_, end - 6 * 3600) or end - 6 * 3600
    fp.validate_window(start, end, 24 * 3600, now)
    segs = a.recordings(cam["source_ref"], start, end)
    doc = a.cached_discovery() or a.discover()
    out = fp.coverage(segs, start, end, doc["summary"].get("retention"))
    out.update({"recorder_id": recorder_id, "camera_id": camera_id, "segments": len(segs)})
    return out


@router.get("/frigate/{recorder_id}/cameras/{camera_id}/recordings/summary")
def recordings_summary(recorder_id: str, camera_id: str, request: Request, principal: Principal = Depends(current_principal_ro),
                       conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Per-day (site-local) counts of events, motion, objects and recorded seconds, from Frigate's summary. The site's IANA zone is
    always sent, so a day key is the site's day."""
    cam = _camera_row(conn, principal, recorder_id, camera_id, "video.playback")
    a = _adapter(conn, request, recorder_id)
    tz = read_settings(conn)["time.zone"]
    days = []
    for d in a.recordings_summary(cam["source_ref"], tz):
        day = d.get("day")
        if not isinstance(day, str):
            continue
        hours = [{"hour": h.get("hour"), "events": h.get("events"), "motion": h.get("motion"), "objects": h.get("objects"), "duration": h.get("duration")}
                 for h in (d.get("hours") or []) if isinstance(h, dict)]
        days.append({"day": day, "events": d.get("events"), "hours": hours})
    return {"recorder_id": recorder_id, "camera_id": camera_id, "timezone": tz, "days": days}


@router.get("/frigate/{recorder_id}/cameras/{camera_id}/playback")
def playback_plan(recorder_id: str, camera_id: str, request: Request, start: str = Query(...), end: str = Query(...), principal: Principal = Depends(current_principal_ro),
                  conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The playback resolution for a window: an HLS playlist served through Arx, the anchor facts (marked UNPROVEN) and the coverage
    of the window. The window is at most 6 h."""
    cam = _camera_row(conn, principal, recorder_id, camera_id, "video.playback")
    a = _adapter(conn, request, recorder_id)
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    s, e = _epoch(start), _epoch(end)
    fp.validate_window(s, e, fp.PLAYLIST_MAX_WINDOW_S, now)
    segs = a.recordings(cam["source_ref"], s, e)
    doc = a.cached_discovery() or a.discover()
    return fp.playback_plan(recorder_id, cam["source_ref"], s, e, segs, doc["summary"].get("retention"), camera_ref=camera_id)


@router.get("/frigate/{recorder_id}/cameras/{camera_id}/playback/index.m3u8")
def playback_playlist(recorder_id: str, camera_id: str, request: Request, start: str = Query(...), end: str = Query(...),
                      principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    """The HLS VOD playlist of a window with every segment rewritten to Arx's own authorised asset route. A seek is a new playlist
    at the new start (Frigate builds it on demand); the client keeps its own seek generation."""
    cam = _camera_row(conn, principal, recorder_id, camera_id, "video.playback")
    a = _adapter(conn, request, recorder_id)
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    s, e = _epoch(start), _epoch(end)
    fp.validate_window(s, e, fp.PLAYLIST_MAX_WINDOW_S, now)
    text = a.vod_playlist(cam["source_ref"], s, e)
    prefix = f"/api/v1/frigate/{recorder_id}/cameras/{camera_id}/playback/{int(s)}/{int(e)}/"
    return Response(fp.rewrite_playlist(text, prefix), media_type="application/vnd.apple.mpegurl", headers={"Cache-Control": "private, no-store"})


@router.get("/frigate/{recorder_id}/cameras/{camera_id}/playback/{start}/{end}/{name}")
def playback_asset(recorder_id: str, camera_id: str, start: int, end: int, name: str, request: Request, principal: Principal = Depends(current_principal_ro),
                   conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    """One init / media segment of the VOD playlist, fetched by Arx (the session is re-checked on every request). Only names of the
    VOD pattern are served; at most 6 segment reads in flight per recorder (429)."""
    cam = _camera_row(conn, principal, recorder_id, camera_id, "video.playback")
    if not fp.ASSET_NAME.fullmatch(name):
        raise ApiError(404, "not_found", "הקובץ לא נמצא.")
    a = _adapter(conn, request, recorder_id)
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    fp.validate_window(float(start), float(end), fp.PLAYLIST_MAX_WINDOW_S, now)
    sem = _sem(recorder_id)
    if not sem.acquire(blocking=False):
        raise ApiError(429, "frigate_busy", "יותר מדי קטעי וידאו נקראים במקביל.", retryable=True, details={"max": ASSET_INFLIGHT})
    try:
        data, _ctype = a.vod_asset(cam["source_ref"], float(start), float(end), name)
    finally:
        sem.release()
    return Response(data, media_type="video/mp4", headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"})


@router.get("/frigate/{recorder_id}/cameras/{camera_id}/export-plan")
def export_plan(recorder_id: str, camera_id: str, request: Request, start: str = Query(...), end: str = Query(...), principal: Principal = Depends(current_principal_ro),
                conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Clip export DESIGN only: nothing is requested from Frigate and nothing is created (`executed: false`)."""
    cam = _camera_row(conn, principal, recorder_id, camera_id, "video.playback")
    _adapter(conn, request, recorder_id)
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    s, e = _epoch(start), _epoch(end)
    fp.validate_window(s, e, fp.EXPORT_PLAN_MAX_WINDOW_S, now)
    return fp.export_plan(recorder_id, cam["source_ref"], s, e, camera_ref=camera_id)


@router.get("/frigate/{recorder_id}/storage")
def storage(recorder_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Storage as Frigate reports it: per-camera usage and bandwidth (MB, MB/h) and the recording policy (names of cameras only)."""
    _may_read(conn, principal)
    a = _adapter(conn, request, recorder_id)
    names = {r["source_ref"]: (r["alias"] or r["name_source"]) for r in conn.execute("SELECT source_ref, alias, name_source FROM cameras WHERE recorder_id = ?", (recorder_id,)).fetchall()}
    usage = a.storage_usage()
    cams = [{"key": k, "name": names.get(k) or k, "usage_mb": v.get("usage"), "bandwidth_mb_per_h": v.get("bandwidth"), "usage_percent": v.get("usage_percent")}
            for k, v in usage.items() if isinstance(v, dict)]
    doc = a.cached_discovery() or a.discover()
    return {"recorder_id": recorder_id, "cameras": cams, "policy": fp.recording_policy(doc["summary"].get("retention")), "retention": doc["summary"].get("retention")}
