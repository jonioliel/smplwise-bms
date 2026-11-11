"""Live media (T015/T016/T017 server side).

- `POST /media/streams/sync` — create/refresh the product's go2rtc streams for enabled cameras.
- `WS /media/live/{camera_id}/ws?profile=sub|main` — authorized relay to go2rtc's `/api/ws`. The browser
  speaks go2rtc's signalling (WebRTC offer/answer/candidates or MSE fragments) through this socket, so
  neither the go2rtc address nor any source URL is exposed. Sessions are counted and capped.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import sqlite3
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable

from fastapi import APIRouter, Depends, Query, Request, WebSocket
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, get_conn, maybe_bootstrap, resolve_principal, settings_of, touch_user
from ..config import Settings
from ..db import Database, retry_locked, unlocked
from ..errors import ApiError
from ..capabilities import ensure_capability  # NN1: 409 capability_unavailable, after ensure_nvr
from ..mode import ensure_nvr  # NVR-less mode: 409 nvr_not_configured
from ..rbac import INSTALLATION, Decision, Principal, authorize, require
from ..services import autosync
from ..services import camera_cards as cc
from ..services import ha_camera_streams as hls
from ..services import go2rtc as g2
from ..services import live_codec as lc
from ..services.access import camera_decision, require_camera
from ..services.leases import CameraLease
from ..services.relay import relay_ws
from .settings import read_settings

log = logging.getLogger("smplwise.media")
router = APIRouter()


@dataclass
class LiveSession:
    id: str
    camera_id: str
    stream: str
    user_id: str
    username: str
    started_at: float = field(default_factory=time.time)
    bytes_down: int = 0
    remote_chain: str | None = None  # CR-008 P2: the remote sign-in (session chain) this stream runs under; None = local


class SessionRegistry:
    def __init__(self) -> None:
        self.sessions: dict[str, LiveSession] = {}

    def count(self) -> int:
        return len(self.sessions)

    def by_user(self, user_id: str) -> int:
        return sum(1 for s in self.sessions.values() if s.user_id == user_id)


REGISTRY = SessionRegistry()


def remote_live_by_chain() -> dict[str, int]:
    """CR-008 P2: live streams per remote sign-in (the sessions list, the per-session cap, /health)."""
    out: dict[str, int] = {}
    for s in list(REGISTRY.sessions.values()):
        if s.remote_chain:
            out[s.remote_chain] = out.get(s.remote_chain, 0) + 1
    return out


REMOTE_CAP_HE = "הגעת למכסת הזרמים החיים בגישה מרחוק ({cap} במקביל לכל כניסה). סגור צפייה אחרת ונסה שוב."


def _remote_chain(conn) -> str | None:
    """The remote sign-in (session chain) a remote request / WebSocket runs under; None on the local channel."""
    from ..remote_channel import is_remote

    if not is_remote(conn):
        return None
    from ..services import ha_user_auth

    s = ha_user_auth.session_of(conn)
    return s.sign_in() if s is not None else None


CAP_AUDIT_EVERY_S = 60.0
_cap_audited: dict[str, tuple[float, int]] = {}  # sign-in -> (last audit row, refusals since)


def cap_audit_details(chain: str | None, cap: int) -> dict[str, Any] | None:
    """Review L2: a player retrying against the cap must not flood the audit log - one row per sign-in per minute, with
    the number of refusals folded into it (`suppressed`); None = count this one and write nothing."""
    key = chain or ""
    now = time.time()
    last, since = _cap_audited.get(key, (0.0, 0))
    if now - last < CAP_AUDIT_EVERY_S:
        _cap_audited[key] = (last, since + 1)
        return None
    if len(_cap_audited) > 2000:
        for k in [k for k, v in _cap_audited.items() if now - v[0] > CAP_AUDIT_EVERY_S]:
            _cap_audited.pop(k, None)
    _cap_audited[key] = (now, 0)
    return {"max": cap, **({"suppressed": since} if since else {})}


def remote_cap_refusal(chain: str | None, cap: int) -> ApiError | None:
    """CR-008 P2 `remote.max_live_streams`: the N+1st live stream of one remote sign-in is refused (429)."""
    if chain is None:
        return None
    active = remote_live_by_chain().get(chain, 0)
    if active < cap:
        return None
    return ApiError(429, "remote_live_cap", REMOTE_CAP_HE.format(cap=cap), retryable=True, details={"max": cap, "active": active})


def _stream_for(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row:
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    if not cam["enabled"]:
        raise ApiError(409, "camera_disabled", "המצלמה מושבתת במערכת.")
    return cam


def ensure_camera_stream(settings: Settings, cam: sqlite3.Row, profile: str) -> str:
    from ..services import camera_sources

    if camera_sources.manual_of(cam) is not None:
        # CAMERA-STREAM-SOURCES-2410: the camera's own RTSP address (a `with_source` row) - its `smplwise_cam_` stream, never the recorder's
        return camera_sources.ensure_stream(settings, cam, profile)
    if camera_sources.is_standalone(cam):  # a camera without a recorder that was not given its source: never a recorder connection
        raise ApiError(409, "source_missing", camera_sources.MSG["source_missing"])
    name = g2.stream_name(cam["recorder_id"], cam["channel"], profile)
    client = g2.Go2rtc(settings)
    from ..recorder_scope import camera_settings

    from ..services.recorders import vendor_io

    rs = camera_settings(settings, cam)  # CR-024: the camera's recorder
    from ..services.recorders import frigate_io

    if frigate_io.handles(rs):
        # TKFRIGLIVE: live video only through Frigate's own restream (read-only toward Frigate, our `smplwise_` stream as the
        # consumer); without one the client keeps the refreshing still (GET /cameras/{id}/snapshot.jpg)
        from ..mode import ensure_recorder_enabled
        from ..services.recorders import frigate_restream

        ensure_recorder_enabled(rs)  # CR-024: a disabled recorder's stream is never (re)created
        try:
            found = frigate_io.restream_source(rs, cam["recorder_id"], cam["source_ref"] if "source_ref" in cam.keys() else None, profile, fetch=True)
        except ApiError as exc:
            if not exc.code.startswith("frigate_restream"):
                raise
            found = None
        if found is None:
            raise ApiError(409, "live_not_available", "למצלמה הזו אין כרגע וידאו חי; מוצגת תמונה מתעדכנת.", details={"fallback": "still", "recorder_id": cam["recorder_id"]})
        client.ensure_stream(name, found[1], check=frigate_restream.refuse_foreign(found[0]))
        return name
    if not vendor_io.handles(rs):
        client.ensure_stream(name, g2.hikvision_rtsp_url(rs, cam["channel"], profile))
        return name
    try:
        src = vendor_io.LiveSources().url(rs, cam["recorder_id"], cam["channel"], profile)
    except ApiError as exc:
        if not _keep_existing_stream(client, name, exc):
            raise
        return name
    client.ensure_stream(name, src)
    return name


def _base_name(cam: Any, profile: str) -> str:
    """The camera's own go2rtc stream name of `profile`: `smplwise_cam_<id>_<profile>` for a manual source (CAMERA-STREAM-SOURCES-2410),
    else the recorder channel's `smplwise_<recorder>_ch<n>_<profile>`."""
    from ..services import camera_sources

    if camera_sources.manual_of(cam) is not None:
        return camera_sources.stream_name(str(cam["id"]), profile)
    return g2.stream_name(cam["recorder_id"], cam["channel"], profile)


def transcode_name(cam: Any, profile: str) -> str:
    """LIVE-H265-2341's H.264 variant of the camera's own stream (`<base>_h264`), for a manual source too."""
    from ..services import camera_sources

    if camera_sources.manual_of(cam) is not None:
        return camera_sources.transcode_name(str(cam["id"]), profile)
    return lc.transcode_stream_name(cam["recorder_id"], cam["channel"], profile)


def live_choice(settings: Settings, cam: sqlite3.Row, profile: str, can_h265: bool | None, policy: str, max_transcodes: int) -> lc.Choice:
    """LIVE-H265-2341: which stream this viewer gets (services/live_codec.py). The registry's codecs first; a profile the
    registry does not know is looked up in what go2rtc's producer reported (read-only `GET /api/streams`) - only when the
    browser said it cannot decode H.265, so an ordinary open costs nothing extra."""
    codecs = lc.registry_codecs(cam)
    if can_h265 is False and lc.normalize_policy(policy) != "off" and (codecs.get(profile) is None or codecs.get(lc.other_profile(profile)) is None):
        try:
            listed = g2.Go2rtc(settings).list_streams()
            observed = {p: getattr(listed.get(_base_name(cam, p)), "video_codec", None) for p in lc.PROFILES}
            codecs = lc.merge_observed(codecs, observed)
        except (ApiError, ValueError):
            pass  # go2rtc not reachable for the listing: the registry alone decides (the socket's own open reports an outage)
    return lc.choose(policy, profile, codecs, can_h265, max_transcodes=max_transcodes)


def ensure_live_stream(settings: Settings, cam: sqlite3.Row, choice: lc.Choice) -> str:
    """The go2rtc stream for a choice: the camera's own stream of the chosen profile, or (transcode) that stream plus its
    H.264 variant in our namespace (`smplwise_<recorder>_ch<n>_<profile>_h264`, source `ffmpeg:<our stream>#video=h264`)."""
    base = ensure_camera_stream(settings, cam, choice.profile)
    if choice.kind != "transcode":
        return base
    name = transcode_name(cam, choice.profile)
    g2.Go2rtc(settings).ensure_stream(name, lc.transcode_source(base))
    return name


async def _refuse_choice(websocket: WebSocket, value: str, message: str, code: int, **extra: Any) -> None:
    """LIVE-H265-2341: a live socket refused for its codec (`h265_unsupported`, close 4415) or the transcode cap
    (`transcode_cap`, close 4430): accepted first so the player sees the reason and its Hebrew text."""
    import json as _json

    with contextlib.suppress(Exception):
        if websocket.client_state.name == "CONNECTING":
            await websocket.accept()
        await websocket.send_text(_json.dumps({"type": "error", "value": value, "message": message, **extra}, ensure_ascii=False))
        await websocket.close(code=code)


VIDEO_SERVICE_DOWN_HE = "שירות הווידאו לא זמין"
MEDIA_DOWN_CODES = frozenset({"media_unavailable", "media_not_configured"})


def _json_dumps_error(code: str, settings: Settings) -> str:
    """The relay's upstream-failure frame, with the video service's state so the player can tell "down" from "this stream" (HEALTH-GO2RTC-2430)."""
    import json as _json

    from ..services import media_reach

    return _json.dumps({"type": "error", "value": code, "media": media_reach.REACH.view(settings)["state"]})


async def refuse_media(websocket: WebSocket, settings: Settings, code: str) -> None:
    """HEALTH-GO2RTC-2430: a live / playback socket that cannot get its stream because the video service is down or not set (or is
    known unreachable): accepted first and told why in one
    `{"type":"error","value":<code>,"message":…,"media":<state>}` frame, then closed 4503. Lab 11.11: a close before accept (or a bare
    4503) reached the browser through HA ingress as a plain close 1000, so the player never knew the video service was down and
    retried blind. `media` is services/media_reach's state (reachable / unreachable / ...), never an address."""
    import json as _json

    from ..services import media_reach

    state = media_reach.REACH.view(settings)["state"]
    with contextlib.suppress(Exception):
        if code not in MEDIA_DOWN_CODES and state != media_reach.UNREACHABLE:
            # a stream-level refusal (a recorder read, a station offline): unchanged - the bare 4503 each player already handles
            await websocket.close(code=4503)
            return
        if websocket.client_state.name == "CONNECTING":
            await websocket.accept()
        await websocket.send_text(_json.dumps({"type": "error", "value": code, "message": VIDEO_SERVICE_DOWN_HE, "media": state}, ensure_ascii=False))
        await websocket.close(code=4503)


# AZIA-LIVE-2331: device reads that fail for a moment (the NVR's HTTP server busy or slow while many tiles open). A disabled
# recorder, a missing connection, a refused login or a changed TLS certificate are not here: those still refuse the socket.
LIVE_SOURCE_TRANSIENT = frozenset({"source_unavailable", "source_timeout", "deadline_exceeded", "nvr_busy", "source_invalid", "source_too_large"})


def _keep_existing_stream(client: g2.Go2rtc, name: str, exc: ApiError) -> bool:
    """A Provision live source could not be rebuilt from the device (transient read failure): when go2rtc already holds our
    stream with a source (written by the stream sync or an earlier viewer), the viewer gets that stream instead of a refused
    socket. Nothing is written to go2rtc here."""
    if exc.code not in LIVE_SOURCE_TRANSIENT:
        return False
    try:
        existing = client.list_streams().get(name)
    except ApiError:
        return False
    if existing is None or not existing.sources:
        return False
    log.warning("live source for %s not re-read from the recorder (%s); the existing go2rtc stream is used", name, exc.code)
    return True


@router.post("/media/streams/sync")
def sync_streams(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Pre-create our namespaced streams in go2rtc for every enabled camera (idempotent, bounded). Also runs
    automatically after each discovery when go2rtc is configured."""
    require(conn, principal, "sources.configure", INSTALLATION)
    ensure_nvr(settings_of(request))  # NVR-less mode: no camera streams to create (after the permission check)
    ensure_capability(settings_of(request), "live_video")  # NN1: no go2rtc = 409 capability_unavailable, never a 503
    return autosync.ensure_streams(settings_of(request), conn, actor=principal, request_id=getattr(request.state, "correlation_id", None), reason="manual")


@router.get("/media/streams")
def list_streams(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "sources.configure", INSTALLATION)
    ensure_capability(settings_of(request), "go2rtc")  # NN1: no go2rtc = 409 capability_unavailable, never a 503
    client = g2.Go2rtc(settings_of(request))
    with unlocked(conn):
        streams = client.list_streams()
    ours = [{"name": s.name, "online": s.online, "sources": [g2.redact_source(s.name, u) for u in s.sources]} for s in streams.values() if s.name.startswith(g2.STREAM_PREFIX)]
    return {"go2rtc": client.info(), "streams": ours, "foreign_streams": len(streams) - len(ours)}


@router.get("/media/sessions")
def list_sessions(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    now = time.time()
    return {
        "sessions": [
            {"id": s.id, "camera_id": s.camera_id, "stream": s.stream, "username": s.username, "seconds": int(now - s.started_at), "bytes_down": s.bytes_down}
            for s in REGISTRY.sessions.values()
        ],
        "max_live_sessions": read_settings(conn)["media.max_live_sessions"],
    }


def video_policy_for(conn: sqlite3.Connection, principal: Principal, channel: str) -> dict[str, Any]:
    """VIDEO-TRANSPORT-2400: the transport policy of THIS viewer on THIS channel (services/video_transport.py) - the installation's
    `media.transport_default`, the viewer's own `video.transport` (/me/prefs) and the remote settings."""
    from ..services import user_prefs
    from ..services import video_transport as vt

    s = read_settings(conn)
    personal = user_prefs.get_prefs(conn, principal.user_id)["prefs"].get(vt.PERSONAL_KEY)
    remote = {k: v for k, v in s.items() if k.startswith("remote.")} if channel == "remote" else None
    return vt.policy(s[vt.INSTALLATION_KEY], personal, channel, remote)


@router.get("/media/video-policy")
def video_policy(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """VIDEO-TRANSPORT-2400: how every live player of the caller travels on this channel (`choice` auto | webrtc | mse, its `source`
    personal | installation | default, the ordered `order`, the remote settings that shape a remote plan). The one decision every
    player executes; an explicit choice is never overridden. Any signed-in caller (it reads only the caller's own preference and
    product settings every player already follows); no permission is granted by it."""
    from ..remote_channel import channel_of

    return video_policy_for(conn, principal, channel_of(request))


@router.get("/media/live/{camera_id}")
def live_info(camera_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), profile: str = Query("sub", pattern="^(sub|main)$")) -> dict[str, Any]:
    """What the player needs before opening the socket: permission, transport default and the relay path."""
    require_camera(conn, principal, camera_id, "video.live")  # T055: 403 before 404
    from ..services import camera_sources

    cam = camera_sources.with_source(conn, conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone())
    if camera_sources.manual_of(cam) is None:
        ensure_nvr(settings_of(request))  # NVR-less mode: 409 after the permission check (CAMERA-STREAM-SOURCES-2410: not for a manual source)
    cam = camera_sources.with_source(conn, _stream_for(conn, camera_id))
    s = read_settings(conn)
    chain = _remote_chain(request)
    refusal = remote_cap_refusal(chain, s["remote.max_live_streams"])
    if refusal is not None:
        details = cap_audit_details(chain, s["remote.max_live_streams"])
        if details is not None:
            audit(conn, actor=principal, action="video.live", decision="denied", resource_type="camera", resource_id=camera_id, reason="remote_live_cap",
                  details=details)
        raise refusal
    return {
        "camera_id": cam["id"],
        "profile": profile,
        "ws_path": f"api/v1/media/live/{cam['id']}/ws?profile={profile}",
        "transport_default": s["media.transport_default"],
        # VIDEO-TRANSPORT-2400: the caller's policy and the steps a player of this profile walks (services/video_transport.py)
        "video_plan": _live_plan(conn, principal, request, cam, profile),
        "max_live_sessions": s["media.max_live_sessions"],
        "active_sessions": REGISTRY.count(),
        "media_configured": bool(settings_of(request).go2rtc_url),
        # LIVE-H265-2341: the codec of each profile as the registry knows it, and how an H.265 stream is handled
        "codecs": lc.registry_codecs(cam),
        "h265": {"policy": lc.normalize_policy(s["media.h265_policy"]), "max_transcodes": s["media.h265_max_transcodes"], "active_transcodes": len(lc.BUDGET.active())},
        **({"remote_live": {"max": s["remote.max_live_streams"], "active": remote_live_by_chain().get(chain, 0)}} if chain else {}),
    }


def _live_plan(conn: sqlite3.Connection, principal: Principal, request: Request, cam: Any, profile: str) -> dict[str, Any]:
    from ..remote_channel import channel_of
    from ..services import video_transport as vt

    pol = video_policy_for(conn, principal, channel_of(request))
    import json as _json

    try:
        caps = _json.loads(cam["capabilities_json"] or "{}")
        encoding = caps.get("encoding") if isinstance(caps, dict) and isinstance(caps.get("encoding"), dict) else None
    except (ValueError, TypeError, KeyError, IndexError):  # the plan stays without the registry's WebRTC verdicts
        encoding = None
    remote = pol.get("remote") or {}
    steps = vt.plan_steps(pol["choice"], pol["channel"], profile, mse_fallback=remote.get("mse_fallback", True),
                          webrtc_ok=vt.webrtc_ok_from_encoding(encoding) if encoding else None)
    return {**pol, "steps": steps, "plan": vt.encode(steps)}


# VIDEO-SUB-FALLBACK-2402: why a player opened the MAIN stream of a tile whose quality is automatic (sw-live-player `subFallback`)
PROFILE_FALLBACKS = ("sub_no_media", "sub_connect", "sub_error", "sub_remembered")
PROFILE_FALLBACK_PATTERN = "^(" + "|".join(PROFILE_FALLBACKS) + ")$"


def profile_fallback_details(profile: str, fallback: str | None) -> dict[str, Any] | None:
    """The audit details of a sub -> main fallback socket (only a main-profile socket can be one); None otherwise."""
    if not fallback or fallback not in PROFILE_FALLBACKS or profile != "main":
        return None
    log.info("live stream: sub -> main fallback (%s)", fallback)
    return {"profile_fallback": {"from": "sub", "to": "main", "reason": fallback}}


def _tail(resource_id: str) -> str:
    """The last characters of a resource id for a log line (a station id is a device serial - never logged whole)."""
    return ("..." + resource_id[-6:]) if len(resource_id) > 6 else resource_id


async def _principal_for_ws(websocket: WebSocket) -> Principal | None:
    settings: Settings = websocket.app.state.settings
    db: Database = websocket.app.state.db

    from ..remote_channel import is_remote

    if is_remote(websocket):
        # CR-008: the /arx channel - Origin must be this host, then the Arx session cookie (or an HA bearer token,
        # validated without blocking the event loop); the socket closes when its session is revoked
        from ..services import ha_user_auth

        principal = await ha_user_auth.remote_principal_ws(websocket, settings)
        if principal is None:
            return None
    else:
        class _Req:  # duck-typed view of the websocket for resolve_principal
            headers = websocket.headers
            client = websocket.client
            scope = websocket.scope

        try:
            principal = resolve_principal(_Req(), settings)  # type: ignore[arg-type]
        except ApiError:
            return None

    def _touch() -> None:
        # XSECFOLLOW-297 (review follow-up a): the same checks as auth._principal on an HTTP request - the service Home Assistant user is
        # refused (403 service_account) and the required-sensors policy blocks a socket of a blocked user (presence.enforce: exact /
        # whole-segment exempt routes; no socket route is exempt, `/me/ws` included - it carries notifications). Every socket of the
        # product (live / Home Assistant camera / playback / intercom live, talk and listen / events / wall / me / ha) resolves its
        # caller here, so none of them is a way around the block. The refusal's audit row commits (Database.connection on ApiError).
        from ..services import presence, service_identity

        with db.connection() as conn:
            service_identity.refuse_service_principal(conn, principal, None)
            touch_user(conn, principal)
            maybe_bootstrap(conn, settings, principal, None)
            presence.enforce(conn, principal, websocket.scope.get("path") or "", websocket.headers.get("user-agent"), None,
                             root_path=websocket.scope.get("root_path") or "")

    try:
        await run_in_threadpool(_touch)
    except ApiError as exc:
        await _refuse_socket(websocket, exc)
    return principal


async def _refuse_socket(websocket: WebSocket, exc: ApiError) -> None:
    """XSECFOLLOW-297: a socket refused after its caller was identified (presence_required, service_account). Accepted first so the
    client sees the reason (a close before accept is a bare handshake failure), one `{"type":"error","value":<code>,"message":…}`
    frame, then close 4403 - raised as WebSocketException, so no route handler runs past _principal_for_ws (its own `None -> 4401`
    branch would read as "signed out" and send the app back to the sign-in page)."""
    import json as _json

    from starlette.exceptions import WebSocketException

    with contextlib.suppress(Exception):
        if websocket.client_state.name == "CONNECTING":
            await websocket.accept()
        await websocket.send_text(_json.dumps({"type": "error", "value": exc.code, "message": exc.user_message}, ensure_ascii=False))
    raise WebSocketException(code=4403, reason=exc.code)


async def _refuse_remote_cap(websocket: WebSocket, db: Database, principal: Principal, camera_id: str, refusal: ApiError, chain: str | None, resource_type: str = "camera") -> None:
    """The remote live cap on the socket: accepted first so the browser sees the reason (a close before accept is a
    bare handshake failure), then `{"type":"error","value":"remote_live_cap","message":…}` and close 4429 (the player
    shows its "stream quota reached" state for 4429). Audited like the HTTP refusal (throttled per sign-in)."""
    import json as _json

    details = cap_audit_details(chain, int(refusal.details.get("max") or 0))

    def _write() -> None:
        with db.connection() as conn:
            audit(conn, actor=principal, action="video.live", decision="denied", resource_type=resource_type, resource_id=camera_id, reason="remote_live_cap",
                  details=details)

    if details is not None:
        with contextlib.suppress(Exception):
            await run_in_threadpool(_write)
    with contextlib.suppress(Exception):
        if websocket.client_state.name == "CONNECTING":
            await websocket.accept()
        await websocket.send_text(_json.dumps({"type": "error", "value": "remote_live_cap", "message": refusal.user_message,
                                              "max": refusal.details.get("max")}, ensure_ascii=False))
        await websocket.close(code=4429)


async def _live_relay(
    websocket: WebSocket,
    *,
    settings: Settings,
    db: Database,
    principal: Principal,
    decision: Decision,
    resource_type: str,
    resource_id: str,
    make_stream: Callable[[], str],
    lease: CameraLease,
    chain: str | None,
    remote_cap: int,
    on_text: Callable[[str], str | None] | None = None,
    on_end: Callable[[str, float], None] | None = None,
    hello: dict[str, Any] | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """The part of a live socket that is the same for every source, once the viewer is authorized and both caps passed:
    make the go2rtc stream (sync, thread pool), register the session in the shared budget, relay, audit start / stop.
    `lease` (T055) keeps the stream only while the viewer still holds video.live on the resource (re-checked on every access
    change of the user and every leases.RECHECK_S). `on_text` rewrites go2rtc's text frames, `on_end(reason, seconds)` sees how
    the session ended - the Home Assistant camera's route uses both (services/ha_camera_streams.py)."""
    try:
        name = await run_in_threadpool(make_stream)
    except ApiError as exc:
        log.warning("live stream for %s %s refused: %s", resource_type, resource_id, exc.code)
        await refuse_media(websocket, settings, exc.code)
        return

    client = g2.Go2rtc(settings)
    session = LiveSession(id=uuid.uuid4().hex[:10], camera_id=resource_id, stream=name, user_id=principal.user_id, username=principal.username,
                          remote_chain=chain)

    def _audit(action: str, details: dict[str, Any]) -> None:
        def _write() -> None:
            with db.connection() as conn:
                audit(conn, actor=principal, action=action, decision="allowed", resource_type=resource_type, resource_id=resource_id, details=details, under=decision)

        try:
            retry_locked(_write, what=f"audit {action}")  # a busy database delays the row, it does not lose it
        except sqlite3.Error as exc:  # never let bookkeeping kill or leak a live session
            log.error("audit %s for live session %s failed: %s", action, session.id, exc)

    await websocket.accept()
    # re-checked with nothing awaited before the registration: two starts of one sign-in cannot both pass the cap
    refusal = remote_cap_refusal(chain, remote_cap)
    if refusal is not None:
        await _refuse_remote_cap(websocket, db, principal, resource_id, refusal, chain, resource_type)
        return
    REGISTRY.sessions[session.id] = session
    if hello is not None:
        # LIVE-H265-2341: which stream the server chose (`arx/stream`), before go2rtc's own signalling; a player that does not
        # know the frame ignores it (an unknown `type`)
        import json as _json

        with contextlib.suppress(Exception):
            await websocket.send_text(_json.dumps({"type": "arx/stream", "value": hello}, ensure_ascii=False))

    # VIDEO-TRANSPORT-2400 (lab audit finding 8): what the sockets said - the transport asked for, the first media byte, go2rtc's
    # first error frame (sanitized) - so a session that ends at once is explainable (services/live_diag.py)
    from ..services.live_diag import LiveDiag

    diag = LiveDiag()

    def on_down(n: int) -> None:
        session.bytes_down += n
        diag.down_bytes()

    def observed_text(text: str) -> str | None:
        try:
            diag.down_text(text)
        except Exception:  # noqa: BLE001 - an observer never breaks the relay
            pass
        return on_text(text) if on_text is not None else text

    reason = "ended"
    try:
        await run_in_threadpool(_audit, "video.live.start", {"session": session.id, "stream": name, **(extra or {})})
        reason = await relay_ws(websocket, client.ws_url(name), client.ws_headers(), on_down, should_stop=lease.should_stop, on_text=observed_text)
        if lease.lost:
            reason = "access_lost"
        # T074: `answer N ms` appended (WebRTC media flows outside this socket, so its first media is "-"; the answer is the
        # server-side time-to-camera proxy). scripts/gate/video_timing.py parses this line; keep the prefix stable.
        log.info("live session %s ended: %s (transport %s, first media %s ms, answer %s ms)", session.id, reason, diag.transport or "-",
                 diag.ttff_ms if diag.ttff_ms is not None else "-", diag.answer_ms if diag.answer_ms is not None else "-")
    except Exception as exc:  # upstream refused / dropped
        reason = "upstream_failure"
        log.warning("live session %s upstream failure: %s", session.id, type(exc).__name__)
        with contextlib.suppress(Exception):
            await websocket.send_text(_json_dumps_error("upstream_unavailable", settings))
    finally:
        REGISTRY.sessions.pop(session.id, None)
        with contextlib.suppress(Exception):
            if reason == "access_lost":
                await websocket.send_text('{"type":"error","value":"access_lost"}')
                await websocket.close(code=4403)
            else:
                await websocket.close()
        seconds = time.time() - session.started_at
        diag_details = diag.details()
        if diag_details.get("upstream_error"):
            log.warning("live session %s (%s %s): go2rtc error %s: %s", session.id, resource_type, _tail(resource_id), diag_details["upstream_error"],
                        diag_details.get("upstream_error_text", ""))
        await run_in_threadpool(_audit, "video.live.stop", {"session": session.id, "seconds": int(seconds), "bytes_down": session.bytes_down, "reason": reason,
                                                            **diag_details, **(extra or {})})
        if on_end is not None:
            with contextlib.suppress(Exception):
                on_end(reason, seconds)


@router.websocket("/media/live/{camera_id}/ws")
async def live_ws(websocket: WebSocket, camera_id: str, profile: str = Query("sub", pattern="^(sub|main)$"),
                  h265: str | None = Query(None, pattern="^(0|1)$"),
                  fallback: str | None = Query(None, pattern=PROFILE_FALLBACK_PATTERN)) -> None:
    """`h265` (LIVE-H265-2341): whether this browser decodes H.265 over the transport the player is about to use; absent =
    an older player, the stream as it is. `fallback` (VIDEO-SUB-FALLBACK-2402): this main-profile socket replaces a sub stream that
    gave no media (`sub_no_media`), never connected (`sub_connect`), was refused by go2rtc (`sub_error`) or is remembered as such for
    this browser session (`sub_remembered`); recorded on the session's audit rows as `profile_fallback` (a closed set: anything else is
    refused by the route's validation)."""
    settings: Settings = websocket.app.state.settings
    db: Database = websocket.app.state.db

    principal = await _principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return

    h265_conf: dict[str, Any] = {}

    def _authorize() -> tuple[Decision | None, sqlite3.Row | None, int, int]:
        with db.connection() as conn:
            cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
            if not cam or not cam["enabled"]:
                return None, None, 0, 0
            from ..services import camera_sources

            cam = camera_sources.with_source(conn, cam)  # CAMERA-STREAM-SOURCES-2410: a manual source streams from its own address
            decision = camera_decision(conn, principal, camera_id, "video.live")
            if not decision.allowed:
                audit(conn, actor=principal, action="video.live", decision="denied", resource_type="camera", resource_id=camera_id, reason=decision.reason, under=decision)
            s = read_settings(conn)
            h265_conf.update(policy=s["media.h265_policy"], max=int(s["media.h265_max_transcodes"]))
            return decision, cam, s["media.max_live_sessions"], s["remote.max_live_streams"]

    decision, cam, cap, remote_cap = await run_in_threadpool(_authorize)
    allowed = bool(decision and decision.allowed)
    if not allowed or cam is None:
        await websocket.close(code=4403)
        return
    if REGISTRY.count() >= cap:
        await websocket.close(code=4429)
        return
    chain = _remote_chain(websocket)  # CR-008 P2: the remote sign-in's own budget (remote.max_live_streams)
    refusal = remote_cap_refusal(chain, remote_cap)
    if refusal is not None:
        await _refuse_remote_cap(websocket, db, principal, camera_id, refusal, chain)
        return

    can_h265 = None if h265 is None else h265 == "1"
    choice = await run_in_threadpool(live_choice, settings, cam, profile, can_h265, h265_conf.get("policy", lc.DEFAULT_POLICY),
                                     h265_conf.get("max", lc.DEFAULT_MAX_TRANSCODES))
    if choice.kind == "unsupported":
        log.info("live stream for camera %s (%s): H.265 the browser cannot decode, no alternative under the policy", camera_id, profile)
        await _refuse_choice(websocket, "h265_unsupported", choice.message, 4415)
        return
    token = uuid.uuid4().hex
    if choice.kind == "transcode":
        tname = transcode_name(cam, choice.profile)
        max_tc = h265_conf.get("max", lc.DEFAULT_MAX_TRANSCODES)
        if not lc.BUDGET.acquire(token, tname, max_tc):
            log.info("live stream for camera %s (%s): transcode cap %s reached", camera_id, profile, max_tc)
            await _refuse_choice(websocket, "transcode_cap", lc.TRANSCODE_CAP_HE.format(cap=max_tc), 4430, max=max_tc)
            return
    hello = {"requested": profile, "profile": choice.profile, "variant": choice.variant, "kind": choice.kind, "codec": choice.codec,
             **({"message": choice.message} if choice.fallback else {})} if can_h265 is not None else None
    try:
        await _live_relay(
            websocket, settings=settings, db=db, principal=principal, decision=decision, resource_type="camera", resource_id=camera_id,
            make_stream=lambda: ensure_live_stream(settings, cam, choice),
            # T055: the relay keeps the camera only while the viewer still holds video.live on it (re-checked on every access
            # change of the user and every leases.RECHECK_S) - a revoke of an unrelated camera no longer ends this stream
            lease=CameraLease(db, principal, camera_id, "video.live"), chain=chain, remote_cap=remote_cap, hello=hello,
            extra=profile_fallback_details(profile, fallback),
        )
    finally:
        lc.BUDGET.release(token)


@router.websocket("/media/live-ha/{entity_id}/ws")
async def live_ha_ws(websocket: WebSocket, entity_id: str) -> None:
    """Live video of a standalone Home Assistant camera the owner enabled (services/ha_camera_streams.py): the same relay,
    session budget, remote cap, lease and transport as an NVR camera's socket. Authorization: video.live installation-wide
    (a non-NVR camera has no camera scope - the rule of its picture), devices.read on the entity, and the camera opted in.
    go2rtc's error frames never reach the viewer (a fixed code replaces them: their text may carry the camera's address)."""
    settings: Settings = websocket.app.state.settings
    db: Database = websocket.app.state.db

    principal = await _principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return
    if not cc.HA_CAMERA_RE.fullmatch(entity_id):
        await websocket.close(code=4403)
        return

    def _authorize() -> tuple[Decision | None, int, int]:
        with db.connection() as conn:
            decision = authorize(conn, principal, "video.live", INSTALLATION)
            if not (decision.allowed and hls.viewer_allowed(conn, principal, entity_id)):
                audit(conn, actor=principal, action="video.live", decision="denied", resource_type="ha_entity", resource_id=entity_id,
                      reason=decision.reason if not decision.allowed else "not_available", under=decision)
                return None, 0, 0
            s = read_settings(conn)
            return decision, s["media.max_live_sessions"], s["remote.max_live_streams"]

    decision, cap, remote_cap = await run_in_threadpool(_authorize)
    if decision is None:
        await websocket.close(code=4403)
        return
    if REGISTRY.count() >= cap:
        await websocket.close(code=4429)
        return
    chain = _remote_chain(websocket)
    refusal = remote_cap_refusal(chain, remote_cap)
    if refusal is not None:
        await _refuse_remote_cap(websocket, db, principal, entity_id, refusal, chain, "ha_entity")
        return

    await _live_relay(
        websocket, settings=settings, db=db, principal=principal, decision=decision, resource_type="ha_entity", resource_id=entity_id,
        make_stream=lambda: hls.ensure_ready(db, settings, entity_id),
        lease=hls.HaLiveLease(db, principal, entity_id), chain=chain, remote_cap=remote_cap,
        on_text=lambda text: hls.sanitize_frame(entity_id, text), on_end=lambda reason, seconds: hls.note_session_end(entity_id, reason, seconds),
    )
