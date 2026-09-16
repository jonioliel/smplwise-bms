"""Playback groups API (chapter 25): create → seek (all members, new generation) → close."""
from __future__ import annotations

import datetime as dt
import sqlite3
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..config import Settings
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize
from ..services import playback as pb
from ..services import playback_groups as pg
from ..services.timeutil import iso_utc, parse_utc
from .playback import SeekBody, _segment_for
from .recordings import camera_for_playback
from .settings import read_settings

router = APIRouter()
GAP_TOLERANCE_S = 60  # a member whose next recording starts later than this is a gap, not a late starter


class GroupBody(BaseModel):
    camera_ids: list[str]
    start_at: str


def _owned(conn: sqlite3.Connection, principal: Principal, group_id: str) -> pg.PlaybackGroup:
    group = pg.GROUPS.get(group_id)
    if not group:
        raise ApiError(404, "not_found", "קבוצת הניגון לא נמצאה (אולי פגה).")
    if group.user_id != principal.user_id and not authorize(conn, principal, "system.configure", INSTALLATION).allowed:
        raise ApiError(403, "forbidden", "קבוצת הניגון שייכת למשתמש אחר.")
    return group


def _start_many(settings: Settings, conn: sqlite3.Connection, principal: Principal, cams: list[sqlite3.Row], start: dt.datetime, tz_name: str, cap: int, group: pg.PlaybackGroup, existing: dict[str, pb.PlaybackSession]) -> None:
    """One session per camera (create, or seek the member's existing session). Searches are serialized by the
    recordings service; go2rtc stream creation runs in parallel so the tiles start together."""

    def one(cam: sqlite3.Row) -> tuple[str, pb.PlaybackSession | None, str | None]:
        try:
            actual_start, seg_end = _segment_for(settings, conn, cam, start, tz_name)
        except ApiError as exc:
            return cam["id"], None, exc.code
        if (actual_start - start).total_seconds() > GAP_TOLERANCE_S:
            return cam["id"], None, "gap"
        try:
            if cam["id"] in existing:
                return cam["id"], pb.seek(settings, existing[cam["id"]], actual_start, seg_end), None
            return cam["id"], pb.create(settings, principal, cam, actual_start, seg_end, tz_name, cap), None
        except ApiError as exc:
            return cam["id"], None, exc.code

    with unlocked(conn), ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(one, cams))
    group.session_ids = [s.id for _, s, _ in results if s]
    group.missing = {cid: reason for cid, s, reason in results if not s and reason}
    for cid, x in existing.items():  # a member that fell into a gap this time releases its stream
        if x.id not in group.session_ids and x.state not in ("closed", "expired", "failed"):
            pb.close(settings, x)


@router.post("/playback/groups", status_code=201)
def create_group(body: GroupBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    settings = settings_of(request)
    ids = list(dict.fromkeys(body.camera_ids))
    if not 1 <= len(ids) <= 4:
        raise ApiError(422, "validation", "קבוצת ניגון: 1 עד 4 מצלמות.")
    cams = [camera_for_playback(conn, principal, cid) for cid in ids]
    if any(not c["main_track"] for c in cams):
        raise ApiError(409, "no_track", "לאחת המצלמות אין track הקלטה ידוע.")
    try:
        start = parse_utc(body.start_at)
    except ValueError:
        raise ApiError(422, "validation", "start_at חייב להיות UTC (Z).")
    s = read_settings(conn)
    if not settings.go2rtc_url:
        raise ApiError(503, "media_not_configured", "כתובת go2rtc לא הוגדרה בהגדרות ה־Add-on.")
    if len(pb.REGISTRY.active()) + len(ids) > s["playback.max_sessions"]:
        raise ApiError(429, "playback_quota", f"קבוצה של {len(ids)} מצלמות חורגת ממכסת סשני הניגון ({s['playback.max_sessions']}).", retryable=True)
    group = pg.PlaybackGroup(id=uuid.uuid4().hex[:10], user_id=principal.user_id, requested_at=start)
    _start_many(settings, conn, principal, cams, start, s["time.zone"], s["playback.max_sessions"], group, {})
    if not group.session_ids:
        raise ApiError(409, "no_recording", "אין הקלטה בזמן הזה באף אחת מהמצלמות.", details={"missing": group.missing})
    pg.GROUPS[group.id] = group
    audit(conn, actor=principal, action="video.playback.group", decision="allowed", resource_type="installation", resource_id="*",
          request_id=getattr(request.state, "correlation_id", None), details={"group": group.id, "cameras": ids, "sessions": group.session_ids, "missing": group.missing, "start_at": iso_utc(start)})
    return pg.to_dict(group, s["playback.lease_s"])


@router.post("/playback/groups/{group_id}/seek")
def seek_group(group_id: str, body: SeekBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    settings = settings_of(request)
    group = _owned(conn, principal, group_id)
    try:
        start = parse_utc(body.start_at)
    except ValueError:
        raise ApiError(422, "validation", "start_at חייב להיות UTC (Z).")
    s = read_settings(conn)
    existing = {x.camera_id: x for x in pg.sessions_of(group) if x.state not in ("closed", "expired", "failed")}
    cam_ids = list(existing) + [c for c in group.missing if c not in existing]
    cams = [c for c in (conn.execute("SELECT * FROM cameras WHERE id = ?", (cid,)).fetchone() for cid in cam_ids) if c]
    group.generation += 1
    group.requested_at = start
    _start_many(settings, conn, principal, cams, start, s["time.zone"], s["playback.max_sessions"], group, existing)
    audit(conn, actor=principal, action="video.playback.group.seek", decision="allowed", resource_type="installation", resource_id="*",
          request_id=getattr(request.state, "correlation_id", None), details={"group": group.id, "generation": group.generation, "start_at": iso_utc(start), "missing": group.missing})
    return pg.to_dict(group, s["playback.lease_s"])


class SyncReport(BaseModel):
    """What the browser measured against its master clock (T042): |drift| p95 per member, quality, sample count."""
    p95_s: float | None = None
    quality: str
    samples: int = 0
    partial: bool = False
    members: dict[str, Any] = {}


SYNC_QUALITIES = ("waiting", "synced", "slight", "out_of_sync")


@router.post("/playback/groups/{group_id}/sync")
def report_sync(group_id: str, body: SyncReport, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Store the measurement on the group (owner only). Nothing is seeked here: the browser re-seeks a late tile alone."""
    group = _owned(conn, principal, group_id)
    if body.quality not in SYNC_QUALITIES:
        raise ApiError(422, "validation", "quality לא מוכר.", details={"allowed": list(SYNC_QUALITIES)})
    if body.p95_s is not None and not 0 <= body.p95_s <= 3600:
        raise ApiError(422, "validation", "p95_s מחוץ לטווח.")
    if body.samples < 0:
        raise ApiError(422, "validation", "samples חייב להיות אי־שלילי.")
    members = {k: v for k, v in list(body.members.items())[:8]}
    group.sync_report = {"p95_s": body.p95_s, "quality": body.quality, "samples": body.samples, "partial": body.partial, "members": members, "reported_at": iso_utc(dt.datetime.now(dt.timezone.utc))}
    return {"ok": True, "sync_report": group.sync_report}


@router.get("/playback/groups/{group_id}")
def get_group(group_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    group = _owned(conn, principal, group_id)
    return pg.to_dict(group, read_settings(conn)["playback.lease_s"])


@router.delete("/playback/groups/{group_id}")
def close_group(group_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    group = _owned(conn, principal, group_id)
    pg.close_group(settings_of(request), group)
    audit(conn, actor=principal, action="video.playback.group.stop", decision="allowed", resource_type="installation", resource_id="*",
          request_id=getattr(request.state, "correlation_id", None), details={"group": group.id})
    return {"id": group.id, "state": "closed"}
