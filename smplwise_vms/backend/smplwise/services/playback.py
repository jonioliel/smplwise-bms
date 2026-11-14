"""Playback session engine (chapter 24, ADR-013, T028 server side).

A session owns one go2rtc stream built from the NVR's RTSP playback URL for a track and a start time.
Seek = new generation: the old stream is deleted, a new one is created, and a relay socket of an old
generation is closed so the client never shows a frame from the previous request. Idle sessions expire
after a lease and their streams are deleted; on startup every `smplwise_pb_*` stream left in go2rtc is
removed (sessions do not survive a restart). Streams outside the `smplwise_` namespace are never touched.
"""
from __future__ import annotations

import collections
import datetime as dt
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable

from ..config import Settings
from ..errors import ApiError
from . import go2rtc as g2
from .timeutil import UTC, compact_wall, iso_utc, zone

log = logging.getLogger("smplwise.playback")

PB_PREFIX = g2.STREAM_PREFIX + "pb_"
_INSTANCE: dict[str, str] = {"id": ""}
MAX_SPAN = dt.timedelta(hours=6)  # one RTSP playback request covers at most this much; the NVR concatenates files inside it
# PLAYBACK-SCRUB-2341 (docs/changes/PLAYBACK-SCRUB-2341.md): a seek is strictly ordered - the superseded generation's relay socket
# is told to stop and its go2rtc upstream socket is closed BEFORE its stream is deleted, and only then is the new stream created
# (no open-while-closing race between two generations of one session). RELAY_CLOSE_WAIT_S bounds the wait for that close.
RELAY_CLOSE_WAIT_S = 3.0
UPSTREAM_CLOSE_TIMEOUT_S = 1.5  # the relay's close handshake with go2rtc, bounded below RELAY_CLOSE_WAIT_S
SEEK_LOCK_WAIT_S = 15.0  # one seek per session at a time; a second one waits for the first (never two generations in flight)
SEEK_RATE_WINDOW_S = 60.0
DEFAULT_MAX_SEEKS_PER_MIN = 30  # the `playback.max_seeks_per_min` setting's default
SEEK_MEDIA_KEEP = 20  # T074: how many seek timings one session keeps for its stop row (the newest)


class RelayHandle:
    """The relay socket of one generation: how to stop it from another thread, and when it is really closed."""

    def __init__(self) -> None:
        self.closed = threading.Event()
        self._stop: Callable[[], None] | None = None

    def bind_stop(self, stop: Callable[[], None]) -> None:
        self._stop = stop

    def stop(self) -> None:
        if self._stop is not None:
            try:
                self._stop()
            except RuntimeError:  # the socket's event loop is already gone: nothing left to stop
                self.closed.set()


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
    # T074 (docs/changes/T074-VISUAL-METRICS-2405.md): time to recording. `gen_started` = when this generation was asked for (the
    # create request for generation 0, the seek request for every later one); the first relayed media byte of the generation is
    # measured against it. Numbers only - never a frame, a URL or a name.
    gen_started: float = field(default_factory=time.monotonic)
    gen_media_ms: int | None = None  # this generation's request -> first media byte (ms); reset by a seek
    first_media_ms: int | None = None  # generation 0: the start request -> first media byte (the "time to recording")
    seek_media_ms: list[int] = field(default_factory=list)  # every later generation: seek request -> first media byte (last SEEK_MEDIA_KEEP)
    recorder_id: str = "nvr-1"  # CR-024: the camera's recorder - the playback source is built from ITS connection
    # CR-024 experimental cross-recorder sync: the recorder's clock minus this server's (s); the RTSP request asks for
    # [start + offset, end + offset] in `tz_name`, the recorder's own zone. 0 everywhere else (the proven path).
    clock_offset_s: float = 0.0
    # PLAYBACK-SCRUB-2341: the open relay socket per generation, the per-session seek lock and the seek times of the last minute
    relays: dict[int, RelayHandle] = field(default_factory=dict)
    seek_lock: threading.Lock = field(default_factory=threading.Lock)
    seek_times: collections.deque = field(default_factory=collections.deque)

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


# CR-GO2RTC-OWNED-2436 (review 03 F09): this instance's playback streams through the shared owned-streams helper. A generation's stream
# is noted right before it is written, so the orphan sweep never deletes a stream written a moment ago whose session has not recorded
# it yet (`session.stream` is set after the write). The startup sweep has no notes and removes every orphan at once, as before.
_OWNED = g2.OwnedStreams(own_prefix)
SWEEP_GRACE_S = 60.0


def playback_rtsp_url(settings: Settings, track_id: int, start: dt.datetime, end: dt.datetime, tz_name: str) -> str:
    from .recorders import vendor_io

    if vendor_io.handles(settings):  # CR-025 P3: Provision-ISR plays by channel (track_id = channel) in the device's wall clock
        return vendor_io.playback_url(settings, getattr(settings, "nvr_recorder_id", None) or "nvr-1", track_id, start, end, tz_name)
    return _hikvision_playback_rtsp_url(settings, track_id, start, end, tz_name)


def _hikvision_playback_rtsp_url(settings: Settings, track_id: int, start: dt.datetime, end: dt.datetime, tz_name: str) -> str:
    """rtsp://user:pass@host:rtsp/Streaming/tracks/<track>?starttime=<local compact>&endtime=<local compact>.
    Times are the NVR's local wall clock (KNOWN_QUIRKS T4). Server-side only."""
    from ..mode import ensure_nvr

    ensure_nvr(settings)  # NVR-less mode: 409 nvr_not_configured
    from ..mode import ensure_recorder_enabled

    ensure_recorder_enabled(settings)  # CR-024: a disabled recorder is never asked for a recording
    if not settings.nvr_host or not settings.nvr_user or not settings.nvr_password:
        raise ApiError(503, "source_not_configured", "פרטי ה־NVR לא הוגדרו בהגדרות ה־Add-on.")
    tz = zone(tz_name)
    return g2.rtsp_url(settings.nvr_host, settings.nvr_rtsp_port, f"/Streaming/tracks/{int(track_id)}", settings.nvr_user, settings.nvr_password,
                       query=f"starttime={compact_wall(start, tz)}&endtime={compact_wall(end, tz)}")


def _create_stream(settings: Settings, session: PlaybackSession, start: dt.datetime) -> None:
    client = g2.Go2rtc(settings)
    name = stream_name(session.id, session.generation)
    from ..recorder_scope import settings_for

    off = dt.timedelta(seconds=session.clock_offset_s or 0)  # CR-024: the recorder's clock offset (cross-recorder sync)
    rs = settings_for(settings, session.recorder_id)
    src = playback_rtsp_url(rs, session.track_id, start + off, session.end_at + off, session.tz_name)
    from .recorders import vendor_io

    if vendor_io.handles(rs):
        src = vendor_io.go2rtc_source(rs, src)  # CR-025 live finding: go2rtc plays this NVR through its ffmpeg source
    # CR-GO2RTC-ADAPTER-2436 (review 03 F03): a generation's name is new by construction - written without listing go2rtc first
    create = getattr(client, "create_stream", None) or client.ensure_stream
    _OWNED.note_written(name)
    try:
        create(name, src)
    except Exception:
        _OWNED.forget(name)
        raise
    session.stream = name
    log.info("playback session %s g%s stream %s from %s", session.id, session.generation, name, iso_utc(start))


def _delete_stream(settings: Settings, name: str) -> None:
    if not name.startswith(PB_PREFIX):
        return
    _OWNED.forget(name)
    try:
        g2.Go2rtc(settings).delete_stream(name)
    except ApiError as exc:
        log.warning("could not delete playback stream %s: %s", name, exc.code)


def create(settings: Settings, principal: Any, camera: Any, start: dt.datetime, segment_end: dt.datetime, tz_name: str, cap: int,
           clock_offset_s: float = 0.0) -> PlaybackSession:
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
            recorder_id=str(camera["recorder_id"]) if "recorder_id" in camera.keys() else "nvr-1",
            clock_offset_s=float(clock_offset_s or 0),
        )
        REGISTRY.sessions[session.id] = session
    try:
        _create_stream(settings, session, start)
    except ApiError:
        session.state = "failed"
        raise
    _settle_after_stream(settings, session)
    return session


def note_first_media(session: PlaybackSession, generation: int, now: float | None = None) -> int | None:
    """T074: the first relayed media byte of `generation` arrived. Records the generation's request -> first media time once
    (generation 0 -> `first_media_ms`, a later one -> `seek_media_ms`) and returns it; None when the socket's generation is no longer
    the session's (a seek landed meanwhile: that byte belongs to nobody's measurement) or the generation was already measured."""
    with REGISTRY.lock:
        if generation != session.generation or session.gen_media_ms is not None:
            return None
        ms = max(0, int(((time.monotonic() if now is None else now) - session.gen_started) * 1000))
        session.gen_media_ms = ms
        if generation == 0:
            session.first_media_ms = ms
        else:
            session.seek_media_ms.append(ms)
            del session.seek_media_ms[:-SEEK_MEDIA_KEEP]
        return ms


def media_timing(session: PlaybackSession) -> dict[str, Any]:
    """The T074 fields of a `video.playback.stop` audit row: numbers only. `first_media_ms` is ALWAYS written (null = the start
    never relayed media), so a reader tells "no media" from a row of an older version that measured nothing."""
    out: dict[str, Any] = {"first_media_ms": session.first_media_ms}
    if session.seek_media_ms:
        out["seek_media_ms"] = list(session.seek_media_ms)
    return out


def _settle_after_stream(settings: Settings, session: PlaybackSession) -> None:
    """The stream took seconds to create; if the session was closed meanwhile (user left, group closed, lease
    expired) it must not come back to life — that would run a relay stream against the playback quota until the
    janitor noticed. Drop the new stream and refuse instead."""
    with REGISTRY.lock:
        if session.state in ("closed", "expired", "failed"):
            orphan, session.stream = session.stream, ""
        else:
            session.state = "buffering"
            orphan = ""
    if orphan:
        _delete_stream(settings, orphan)
        raise ApiError(409, "session_over", "סשן הניגון נסגר בזמן ההכנה; פתח ניגון חדש.")


def seek_retry_after(session: PlaybackSession, max_per_min: int | None, now: float | None = None) -> int | None:
    """Seconds until the session may seek again under the cap, or None when a seek is allowed now (nothing is recorded)."""
    if not max_per_min or max_per_min <= 0:
        return None
    t = time.time() if now is None else now
    q = session.seek_times
    while q and t - q[0] >= SEEK_RATE_WINDOW_S:
        q.popleft()
    if len(q) < max_per_min:
        return None
    return max(1, int(SEEK_RATE_WINDOW_S - (t - q[0])) + 1)


def seek_rate_error(max_per_min: int, retry: int) -> ApiError:
    return ApiError(429, "seek_rate", f"יותר מדי קפיצות בזמן בדקה האחרונה (עד {max_per_min} בדקה); הניגון ממשיך מהנקודה הנוכחית. אפשר לקפוץ שוב בעוד {retry} שניות.",
                    retryable=True, details={"max_per_min": max_per_min, "retry_after_s": retry})


def check_seek_rate(session: PlaybackSession, max_per_min: int | None, now: float | None = None) -> None:
    """At most `max_per_min` new generations per session in a rolling minute (0 / None = no cap). Over the cap: 429 seek_rate with a
    Hebrew notice and the seconds until the next seek is accepted; the session itself keeps playing its current generation.
    Allowed: the seek is counted."""
    t = time.time() if now is None else now
    retry = seek_retry_after(session, max_per_min, t)
    if retry is not None:
        raise seek_rate_error(int(max_per_min or 0), retry)
    if max_per_min and max_per_min > 0:
        session.seek_times.append(t)


def register_relay(session: PlaybackSession, generation: int) -> RelayHandle:
    """Called by the relay socket of `generation` once it is accepted; it sets `closed` after its upstream socket is closed."""
    handle = RelayHandle()
    with REGISTRY.lock:
        session.relays[generation] = handle
    return handle


def release_relay(session: PlaybackSession, generation: int, handle: RelayHandle) -> None:
    handle.closed.set()
    with REGISTRY.lock:
        if session.relays.get(generation) is handle:
            session.relays.pop(generation, None)


def _stop_relays_before(session: PlaybackSession, generation: int, wait_s: float | None = None) -> bool:
    """Tell every relay socket of a generation older than `generation` to stop and wait (bounded) until each one has closed its
    upstream socket. True = all closed in time."""
    with REGISTRY.lock:
        old = [(g, h) for g, h in session.relays.items() if g < generation]
    if wait_s is None:
        wait_s = RELAY_CLOSE_WAIT_S
    deadline = time.monotonic() + wait_s
    for _g, h in old:
        h.stop()
    ok = True
    for g, h in old:
        if not h.closed.wait(max(0.0, deadline - time.monotonic())):
            ok = False
            log.warning("playback session %s g%s relay did not close within %.1f s; deleting its stream anyway", session.id, g, wait_s)
    return ok


def seek(settings: Settings, session: PlaybackSession, start: dt.datetime, segment_end: dt.datetime, max_per_min: int | None = None) -> PlaybackSession:
    """New generation of the session at `start`, strictly ordered (PLAYBACK-SCRUB-2341): (1) one seek per session at a time, (2) the
    rate cap, (3) the generation bump (an old socket that reconnects now gets 4410), (4) the old generation's relay socket stops and
    closes its go2rtc socket, (5) the old stream is deleted, (6) the new stream is created."""
    if not session.seek_lock.acquire(timeout=SEEK_LOCK_WAIT_S):
        raise ApiError(409, "seek_busy", "קפיצה קודמת עדיין בטיפול; נסה שוב בעוד רגע.", retryable=True)
    try:
        if session.state in ("closed", "expired", "failed"):
            raise ApiError(409, "session_over", "סשן הניגון הסתיים; פתח ניגון חדש.")
        check_seek_rate(session, max_per_min)
        with REGISTRY.lock:
            old = session.stream
            session.generation += 1
            session.state = "seeking"
            session.requested_at = start
            session.end_at = min(segment_end, start + MAX_SPAN)
            session.first_frame_at = None
            session.gen_started = time.monotonic()  # T074: the seek request is the start of this generation's time to media
            session.gen_media_ms = None
            session.bytes_down = 0
            session.stream = ""
            session.touch()
            new_gen = session.generation
        _stop_relays_before(session, new_gen)
        if old:
            _delete_stream(settings, old)
        try:
            _create_stream(settings, session, start)
        except ApiError:
            session.state = "failed"
            raise
        _settle_after_stream(settings, session)
        return session
    finally:
        session.seek_lock.release()


def close(settings: Settings, session: PlaybackSession, state: str = "closed") -> None:
    with REGISTRY.lock:
        session.state = state
        name = session.stream
        session.stream = ""
        gen = session.generation
    # the same order as a seek: the relay socket (any generation) stops and closes its go2rtc socket before the stream goes
    _stop_relays_before(session, gen + 1)
    if name:
        _delete_stream(settings, name)


NEVER_CONNECTED_S = 90  # a session nobody ever connected to (page left during start-up, a lost tab) is dropped early


def expire_idle(settings: Settings, lease_s: int) -> list[str]:
    """Close sessions without a socket whose lease ran out — and, much sooner, sessions that never relayed a byte:
    they hold a relay stream and a quota slot for a viewer who is not there. Returns the expired ids."""
    now = time.time()
    expired: list[str] = []
    for session in list(REGISTRY.active()):
        never_connected = not session.ws_open and session.first_frame_at is None and session.bytes_down == 0 and now - session.created > NEVER_CONNECTED_S
        if never_connected or (not session.ws_open and now - session.last_activity > lease_s):
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
    removed: list[str] = []

    def live() -> set[str]:
        return {s.stream for s in REGISTRY.active() if s.stream}

    try:
        # only this instance's prefix (another instance sharing go2rtc keeps its streams); asked again right before each delete
        _OWNED.reconcile(g2.Go2rtc(settings), live, grace_s=SWEEP_GRACE_S, on_deleted=removed.append)
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
        # T066: slow motion and frame stepping are real on the MSE path (the buffer fills at real time and is consumed
        # slower or stepped through); faster speeds need a source that sends faster than real time — the relay does not
        "capabilities": {"seek": True, "pause": True, "frame_step": True, "supported_speeds": [0.25, 0.5, 1]},
        "playback_end_at": iso_utc(session.end_at),
        "username": session.username,
        "bytes_down": session.bytes_down,
        "seconds": int(time.time() - session.created),
    }
