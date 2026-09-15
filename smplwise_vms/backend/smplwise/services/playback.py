"""Playback session engine (chapter 24, ADR-013, T028 server side).

A session owns one go2rtc stream built from the NVR's RTSP playback URL for a track and a start time.
Seek = new generation: the old stream is deleted, a new one is created, and a relay socket of an old
generation is closed so the client never shows a frame from the previous request. Idle sessions expire
after a lease and their streams are deleted; on startup every `smplwise_pb_*` stream left in go2rtc is
removed (sessions do not survive a restart). Streams outside the `smplwise_` namespace are never touched.
"""
from __future__ import annotations

import datetime as dt
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote

from ..config import Settings
from ..errors import ApiError
from . import go2rtc as g2
from .timeutil import UTC, compact_wall, iso_utc, zone

log = logging.getLogger("smplwise.playback")

PB_PREFIX = g2.STREAM_PREFIX + "pb_"
_INSTANCE: dict[str, str] = {"id": ""}
MAX_SPAN = dt.timedelta(hours=6)  # one RTSP playback request covers at most this much; the NVR concatenates files inside it


@dataclass
class PlaybackSession:
    id: str
    camera_id: str
    channel: int
    track_id: int
    user_id: str
    username: str
    requested_at: dt.datetime  # media time the client asked for (UTC)
    end_at: dt.datetime  # end of the RTSP playback request (UTC)
    stream: str
    tz_name: str
    generation: int = 0
    state: str = "creating"
    created: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    bytes_down: int = 0
    ws_open: bool = False
    first_frame_at: float | None = None  # wall-clock when the first media bytes were relayed (this generation)

    def touch(self) -> None:
        self.last_activity = time.time()


class PlaybackRegistry:
    def __init__(self) -> None:
        self.sessions: dict[str, PlaybackSession] = {}
        self.lock = threading.Lock()

    def active(self) -> list[PlaybackSession]:
        return [s for s in self.sessions.values() if s.state not in ("closed", "expired", "failed")]

    def by_user(self, user_id: str) -> list[PlaybackSession]:
        return [s for s in self.active() if s.user_id == user_id]


REGISTRY = PlaybackRegistry()


def set_instance_id(instance_id: str) -> None:
    """Called at start-up with the persistent instance id (settings table). Playback stream names carry it so a
    second product instance sharing the same go2rtc (a developer workstation next to the add-on) never treats
    this instance's streams as orphans."""
    _INSTANCE["id"] = instance_id


def own_prefix() -> str:
    return f"{PB_PREFIX}{_INSTANCE['id']}_" if _INSTANCE["id"] else PB_PREFIX


def stream_name(session_id: str, generation: int) -> str:
    return f"{own_prefix()}{session_id}_g{generation}"


def playback_rtsp_url(settings: Settings, track_id: int, start: dt.datetime, end: dt.datetime, tz_name: str) -> str:
    """rtsp://user:pass@host:rtsp/Streaming/tracks/<track>?starttime=<local compact>&endtime=<local compact>.
    Times are the NVR's local wall clock (KNOWN_QUIRKS T4). Server-side only."""
    if not settings.nvr_host or not settings.nvr_user or not settings.nvr_password:
        raise ApiError(503, "source_not_configured", "פרטי ה־NVR לא הוגדרו בהגדרות ה־Add-on.")
    tz = zone(tz_name)
    return (
        f"rtsp://{quote(settings.nvr_user, safe='')}:{quote(settings.nvr_password, safe='')}@{settings.nvr_host}:{settings.nvr_rtsp_port}"
        f"/Streaming/tracks/{int(track_id)}?starttime={compact_wall(start, tz)}&endtime={compact_wall(end, tz)}"
    )


def _create_stream(settings: Settings, session: PlaybackSession, start: dt.datetime) -> None:
    client = g2.Go2rtc(settings)
    name = stream_name(session.id, session.generation)
    src = playback_rtsp_url(settings, session.track_id, start, session.end_at, session.tz_name)
    client.ensure_stream(name, src)
    session.stream = name
    log.info("playback session %s g%s stream %s from %s", session.id, session.generation, name, iso_utc(start))


def _delete_stream(settings: Settings, name: str) -> None:
    if not name.startswith(PB_PREFIX):
        return
    try:
        g2.Go2rtc(settings).delete_stream(name)
    except ApiError as exc:
        log.warning("could not delete playback stream %s: %s", name, exc.code)


def create(settings: Settings, principal: Any, camera: Any, start: dt.datetime, segment_end: dt.datetime, tz_name: str, cap: int) -> PlaybackSession:
    with REGISTRY.lock:
        if len(REGISTRY.active()) >= cap:
            raise ApiError(429, "playback_quota", "הגיע למכסת סשני הניגון; סגור ניגון אחר ונסה שוב.", retryable=True, details={"max": cap})
        session = PlaybackSession(
            id=uuid.uuid4().hex[:10],
            camera_id=camera["id"],
            channel=int(camera["channel"]),
            track_id=int(camera["main_track"]),
            user_id=principal.user_id,
            username=principal.username,
            requested_at=start,
            end_at=min(segment_end, start + MAX_SPAN),
            stream="",
            tz_name=tz_name,
        )
        REGISTRY.sessions[session.id] = session
    try:
        _create_stream(settings, session, start)
    except ApiError:
        session.state = "failed"
        raise
    session.state = "buffering"
    return session


def seek(settings: Settings, session: PlaybackSession, start: dt.datetime, segment_end: dt.datetime) -> PlaybackSession:
    old = session.stream
    with REGISTRY.lock:
        session.generation += 1
        session.state = "seeking"
        session.requested_at = start
        session.end_at = min(segment_end, start + MAX_SPAN)
        session.first_frame_at = None
        session.bytes_down = 0
        session.touch()
    if old:
        _delete_stream(settings, old)
    try:
        _create_stream(settings, session, start)
    except ApiError:
        session.state = "failed"
        raise
    session.state = "buffering"
    return session


def close(settings: Settings, session: PlaybackSession, state: str = "closed") -> None:
    with REGISTRY.lock:
        session.state = state
        name = session.stream
        session.stream = ""
    if name:
        _delete_stream(settings, name)


def expire_idle(settings: Settings, lease_s: int) -> list[str]:
    """Close sessions without a socket whose lease ran out. Returns the expired ids."""
    now = time.time()
    expired: list[str] = []
    for session in list(REGISTRY.active()):
        if not session.ws_open and now - session.last_activity > lease_s:
            close(settings, session, "expired")
            expired.append(session.id)
    # drop finished sessions from memory after a while so the listing stays small
    for sid, session in list(REGISTRY.sessions.items()):
        if session.state in ("closed", "expired", "failed") and now - session.last_activity > 300:
            REGISTRY.sessions.pop(sid, None)
    return expired


def sweep_orphans(settings: Settings) -> list[str]:
    """Delete `smplwise_pb_*` streams in go2rtc that belong to no active session (startup + janitor)."""
    if not settings.go2rtc_url:
        return []
    live = {s.stream for s in REGISTRY.active() if s.stream}
    removed: list[str] = []
    prefix = own_prefix()
    try:
        client = g2.Go2rtc(settings)
        for name in client.list_streams():
            if name.startswith(prefix) and name not in live:
                client.delete_stream(name)
                removed.append(name)
    except ApiError as exc:
        log.warning("orphan sweep skipped: %s", exc.code)
    if removed:
        log.info("removed %d orphan playback streams", len(removed))
    return removed


def to_dict(session: PlaybackSession, lease_s: int) -> dict[str, Any]:
    """Contract shape (contracts/schemas/playback-session.schema.json)."""
    expires = max(session.last_activity, session.created) + lease_s
    return {
        "id": session.id,
        "camera_id": session.camera_id,
        "generation": session.generation,
        "state": session.state,
        "requested_at": iso_utc(session.requested_at),
        "actual_start_at": None,  # only a verified media anchor may fill this (chapter 24)
        "actual_end_at": None,
        "media_anchor": None,
        "time_precision": "keyframe_limited",
        "media_handle": f"api/v1/playback/sessions/{session.id}/ws?generation={session.generation}" if session.state not in ("closed", "expired", "failed") else None,
        "expires_at": iso_utc(dt.datetime.fromtimestamp(expires, UTC)),
        "capabilities": {"seek": True, "pause": True, "frame_step": False, "supported_speeds": [1]},
        "playback_end_at": iso_utc(session.end_at),
        "username": session.username,
        "bytes_down": session.bytes_down,
        "seconds": int(time.time() - session.created),
    }
