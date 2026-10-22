"""CR-036 slice S18: native live video of an intercom station and two-way audio ("talk") inside Arx - the media adapter.

Owner decision 2026-10-12 (binding): live video and talk are part of stage 1. WisKey's answer to W10 (a station stream
descriptor and an audio hook that is not tied to its panel's WebSocket connection) is still open, so everything here is
built against the descriptor contract Arx proposes (docs/changes/CR-036-S18-MEDIA.md) and runs today on two providers:

- `LocalProvider` (production, the interim of D-002 that WisKey accepted in ARX_DECISIONS_REPLY_2 section 4): VIDEO ONLY,
  from Arx's own station source - the in-memory go2rtc stream `smplwise_wiskey_<station>` the entry center's stills already
  use (main profile, channel 101; the sub channel 102 is unverified on stations and stays a future request). It offers no
  talk: the talk button keeps its "talk in the classic panel" mode.
- `FakeProvider` (tests and a developer backend only - refused inside the add-on): video in both profiles and talk over the
  `pcmu_frames` transport, so the whole Arx side (start / stop / signalling, expiry, limits, audit, the screen) is exercised.

When WisKey delivers W10 a `WiskeyProvider` implements the same three calls (`describe`, `video_stream`, `talk_open`) and
the screens do not change. The descriptor is parsed by `parse_descriptor` whoever produced it - the fake goes through it too,
so the contract is what the tests pin.

Rules this module keeps (CLAUDE.md, AGENTS.md security, CR-036 2.1):
- the browser never sees a source, an address, a credential or a WisKey token: the served projection (`Descriptor.public`)
  is built field by field; `parse_descriptor` refuses a descriptor that carries anything that looks like one;
- only `smplwise_` streams are ever named; no go2rtc configuration write (stills' in-memory registration is reused);
- talk sessions are audited (initiator, request id, logical station, outcome, duration, frame count) - never audio content;
- one talker per station, one talk session per user, a hard expiry, no retry after an uncertain outcome.
"""
from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import logging
import os
import re
import secrets
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

from ..config import Settings
from ..db import get_setting
from ..errors import ApiError
from . import wiskey_media_contract as w10

log = logging.getLogger("smplwise.intercom.media")

# ---------------------------------------------------------------- the per-screen setting (owner: OFF by default)

MEDIA_SETTING = "access.station_media"
MEDIA_MODES = ("off", "video", "video_talk")
MEDIA_DEFAULT = "off"


def media_mode(conn: Any) -> str:
    """`off` | `video` | `video_talk`. Anything unreadable is `off` (fail closed: the classic panel keeps both)."""
    try:
        value = str(get_setting(conn, MEDIA_SETTING, MEDIA_DEFAULT))
    except Exception as exc:  # noqa: BLE001 - fail closed
        log.warning("station media: setting unreadable (%s); off", type(exc).__name__)
        return "off"
    return value if value in MEDIA_MODES else "off"


# ---------------------------------------------------------------- the descriptor contract (arx.station_media.v1)

SCHEMA = "arx.station_media.v1"
PROFILES = ("sub", "main")
VIDEO_TRANSPORTS = ("webrtc", "mse")
VIDEO_CODECS = ("h264", "h265")
TALK_TRANSPORTS_ARX = ("pcmu_frames",)  # what this build implements; `webrtc` is in the contract for a later build
TALK_TRANSPORTS_KNOWN = ("pcmu_frames", "webrtc")
FRAME_CODECS = ("pcmu", "pcma")  # G.711 mu-law / A-law, 8 kHz mono: what the frames transport carries
AUDIO_CODECS = ("pcmu", "pcma", "opus", "aac")
HANDLE_RE = re.compile(r"^[A-Za-z0-9_-]{16,128}$")
MAX_TALK_S = 300  # Arx's own ceiling, whatever a descriptor says
MIN_TALK_S = 10
MAX_VIEWERS_CAP = 16
MAX_DESCRIPTOR_TTL_S = 24 * 3600
FRAME_MS = 20
SAMPLE_RATE = 8000
FRAME_MAX_BYTES = 1024  # 20 ms of G.711 is 160 bytes; anything far bigger is not a frame
FRAMES_PER_S_MAX = 100
RESERVE_S = 15.0  # a started talk session must attach its socket within this time

# a string that looks like a place on the network or a secret: never accepted in a descriptor (the browser gets fields
# of a descriptor; a contract that carried one of these would be one bug away from a leak)
_URLISH = re.compile(r"[a-z][a-z0-9+.-]{1,15}://|@|\b(?:rtsp|rtsps|rtmp|http|https|ws|wss|isapi):", re.IGNORECASE)
_SECRET_WORDS = frozenset({"pass", "passwd", "password", "secret", "token", "credential", "credentials", "auth", "authorization", "cookie",
                           "host", "hostname", "address", "url", "uri", "ip", "mac", "serial", "rtsp", "source", "src", "user", "username", "key"})


def _secret_key(key: str) -> bool:
    return any(part in _SECRET_WORDS for part in re.split(r"[^a-z0-9]+", key.lower()) if part)


class DescriptorError(ValueError):
    """A descriptor Arx will not use. `code` is safe to log and to serve; the offending value never is."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class VideoProfile:
    id: str
    codec: str
    transports: tuple[str, ...]
    width: int | None = None
    height: int | None = None
    fps: int | None = None

    def public(self) -> dict[str, Any]:
        return {"id": self.id, "codec": self.codec, "transports": list(self.transports), "width": self.width, "height": self.height, "fps": self.fps}


@dataclass(frozen=True)
class Descriptor:
    station_id: str
    session: str
    revision: int
    issued_at: float
    expires_at: float
    profiles: tuple[VideoProfile, ...]
    listen: bool
    talk: bool
    duplex: str
    audio_codec: str
    talk_transports: tuple[str, ...]
    max_talk_seconds: int
    max_viewers: int
    max_talkers: int
    provider: str

    def expired(self, now: float | None = None) -> bool:
        return (now if now is not None else time.time()) >= self.expires_at

    def profile(self, profile_id: str) -> VideoProfile | None:
        return next((p for p in self.profiles if p.id == profile_id), None)

    @property
    def default_profile(self) -> str | None:
        """The owner's rule: the sub profile first (it decodes over WebRTC); the main profile when it is the only one."""
        ids = [p.id for p in self.profiles]
        return "sub" if "sub" in ids else (ids[0] if ids else None)

    @property
    def talk_transport(self) -> str | None:
        """The talk transport Arx will use with this descriptor, or None (talk then stays in the classic panel)."""
        if not self.talk or self.audio_codec not in FRAME_CODECS:
            return None
        return next((t for t in TALK_TRANSPORTS_ARX if t in self.talk_transports), None)


def _iso(value: Any, name: str) -> float:
    if not isinstance(value, str) or len(value) > 40:
        raise DescriptorError(f"descriptor_{name}_invalid")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise DescriptorError(f"descriptor_{name}_invalid") from exc
    if parsed.tzinfo is None:
        raise DescriptorError(f"descriptor_{name}_invalid")
    return parsed.timestamp()


def _int(value: Any, lo: int, hi: int, default: int | None) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return default
    return max(lo, min(hi, value))


def _scan(value: Any, path: str = "") -> None:
    """Refuse anything that looks like a network place or a secret, anywhere in the descriptor (keys and values)."""
    if isinstance(value, dict):
        for k, v in value.items():
            key = str(k)
            if _secret_key(key) and v not in (None, "", [], {}):
                raise DescriptorError("descriptor_carries_secret")
            _scan(v, f"{path}.{key}")
    elif isinstance(value, list):
        for v in value:
            _scan(v, path)
    elif isinstance(value, str):
        if _URLISH.search(value):
            raise DescriptorError("descriptor_carries_address")
        bare = value.strip("[]")
        try:
            ipaddress.ip_address(bare)
        except ValueError:
            pass
        else:
            raise DescriptorError("descriptor_carries_address")


def parse_descriptor(raw: Any, *, station_id: str, provider: str, now: float | None = None) -> Descriptor:
    """The contract, as Arx enforces it on whatever produced the descriptor (CR-036-S18-MEDIA.md section 3). Strict where a
    mistake would leak or over-grant (schema, station, handle, expiry, addresses, secrets); lenient where it only hides a
    feature (an unknown profile, transport or codec is dropped, never guessed)."""
    now = time.time() if now is None else now
    if not isinstance(raw, dict):
        raise DescriptorError("descriptor_not_an_object")
    if raw.get("schema") != SCHEMA:
        raise DescriptorError("descriptor_schema_unknown")
    _scan(raw)
    if raw.get("station_id") != station_id:
        raise DescriptorError("descriptor_station_mismatch")
    session = raw.get("session")
    if not isinstance(session, str) or not HANDLE_RE.fullmatch(session):
        raise DescriptorError("descriptor_session_invalid")
    issued = _iso(raw.get("issued_at"), "issued_at")
    expires = _iso(raw.get("expires_at"), "expires_at")
    if expires <= now:
        raise DescriptorError("descriptor_expired")
    if expires - max(issued, now - 60) > MAX_DESCRIPTOR_TTL_S:
        raise DescriptorError("descriptor_lifetime_too_long")
    revision = _int(raw.get("revision"), 0, 2**31, 0) or 0

    video = raw.get("video") if isinstance(raw.get("video"), dict) else {}
    profiles: list[VideoProfile] = []
    for p in video.get("profiles") or []:
        if not isinstance(p, dict) or p.get("id") not in PROFILES or any(x.id == p.get("id") for x in profiles):
            continue
        transports = tuple(t for t in (p.get("transports") or []) if t in VIDEO_TRANSPORTS)
        if not transports:
            continue
        codec = p.get("codec") if p.get("codec") in VIDEO_CODECS else "unknown"
        profiles.append(VideoProfile(id=p["id"], codec=codec, transports=transports, width=_int(p.get("width"), 16, 8192, None),
                                     height=_int(p.get("height"), 16, 8192, None), fps=_int(p.get("fps"), 1, 120, None)))

    audio = raw.get("audio") if isinstance(raw.get("audio"), dict) else {}
    duplex = audio.get("duplex") if audio.get("duplex") in ("half", "full") else None
    codec = audio.get("codec") if audio.get("codec") in AUDIO_CODECS else "unknown"
    talk_transports = tuple(t for t in (audio.get("talk_transports") or []) if t in TALK_TRANSPORTS_KNOWN)
    talk = audio.get("talk") is True and duplex is not None and bool(talk_transports)
    max_talk = _int(audio.get("max_talk_seconds"), MIN_TALK_S, MAX_TALK_S, 120) or 120

    limits = raw.get("limits") if isinstance(raw.get("limits"), dict) else {}
    max_viewers = _int(limits.get("max_viewers"), 1, MAX_VIEWERS_CAP, 1) or 1
    # Arx allows exactly one talker per station whatever a descriptor says (half-duplex intercom, WisKey's `audio_busy`)
    max_talkers = 1

    return Descriptor(station_id=station_id, session=session, revision=revision, issued_at=issued, expires_at=expires,
                      profiles=tuple(profiles), listen=audio.get("listen") is True, talk=talk, duplex=duplex or "half",
                      audio_codec=codec, talk_transports=talk_transports, max_talk_seconds=max_talk, max_viewers=max_viewers,
                      max_talkers=max_talkers, provider=provider)


def _ts(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


# ---------------------------------------------------------------- providers

class Unavailable(Exception):
    """No media for this station right now; `code` is served (`no_camera`, `offline`, `no_media`, `no_host`,
    `no_credentials`, `feed`, `descriptor_*`, `provider_error`)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class TalkChannel(Protocol):
    """The upstream end of one talk session (server-side only). Frames are G.711 at 8 kHz, 20 ms each."""

    async def open(self) -> None: ...

    async def send_frame(self, frame: bytes) -> None: ...

    async def floor(self, held: bool) -> None: ...

    async def wait_closed(self) -> str: ...

    async def close(self, reason: str) -> None: ...


class MediaProvider(Protocol):
    name: str

    def describe(self, conn: Any, settings: Settings, station: dict[str, Any]) -> Descriptor: ...

    def video_stream(self, conn: Any, settings: Settings, station: dict[str, Any], profile: str, *, actor: w10.Actor | None = None) -> str: ...

    def talk_open(self, settings: Settings, station_id: str, descriptor: Descriptor, *, actor_id: str, actor_name: str, request_id: str | None,
                  expires_at: float | None = None) -> TalkChannel: ...


class LocalProvider:
    """The interim of D-002: Arx's own station source, video only (main profile, channel 101), no talk."""

    name = "local"
    cache = False  # cheap and local (no network): always current with the credentials and the feed
    MAX_VIEWERS = 4  # Arx's own fan-out: go2rtc pulls one RTSP session per stream whatever the number of viewers
    TTL_S = 600

    def describe(self, conn: Any, settings: Settings, station: dict[str, Any]) -> Descriptor:
        from . import intercom_sync, wiskey_camera

        sid = station["id"]
        if not station.get("camera_entity"):
            raise Unavailable("no_camera")
        if not settings.go2rtc_url:
            raise Unavailable("no_media")
        if not intercom_sync.SYNC.station_host(settings, sid):
            raise Unavailable("no_host")
        try:
            wiskey_camera.credentials(conn, settings, sid)
        except ApiError as exc:
            raise Unavailable("no_credentials") from exc
        now = time.time()
        raw = {
            "schema": SCHEMA,
            "station_id": sid,
            "session": "local-" + hashlib.sha256(f"{sid}:{int(now // self.TTL_S)}".encode()).hexdigest()[:24],
            "revision": 1,
            "issued_at": _ts(now),
            "expires_at": _ts(now + self.TTL_S),
            "video": {"profiles": [{"id": "main", "codec": "h264", "transports": ["mse", "webrtc"]}]},
            "audio": {"listen": True, "talk": False},
            "limits": {"max_viewers": self.MAX_VIEWERS, "max_talkers": 1},
        }
        return parse_descriptor(raw, station_id=sid, provider=self.name, now=now)

    def video_stream(self, conn: Any, settings: Settings, station: dict[str, Any], profile: str, *, actor: w10.Actor | None = None) -> str:
        """The stills' in-memory stream (no go2rtc configuration write): registered once through a frame grab (go2rtc's
        GetOrPatch with the source), then named only. The source never leaves this function."""
        from . import go2rtc as g2
        from . import intercom_sync, wiskey_camera

        if profile != "main":
            raise ApiError(409, "intercom_media_profile_unavailable", "האיכות הזו אינה זמינה לעמדה.")
        sid = station["id"]
        host = intercom_sync.SYNC.station_host(settings, sid)
        if not host:
            raise ApiError(503, "intercom_camera_host_unknown", "כתובת העמדה אינה ידועה.")
        username, password = wiskey_camera.credentials(conn, settings, sid)
        source = g2.wiskey_rtsp_url(host, username, password)
        name = g2.wiskey_stream_name(sid)
        digest = hashlib.sha256(source.encode()).hexdigest()
        with g2._REGISTERED_LOCK:
            known = g2._REGISTERED.get(name) == digest
        if not known:
            g2.Go2rtc(settings).frame_jpeg(name, source)  # registers in memory (raises when go2rtc refuses)
        return name

    def talk_open(self, settings: Settings, station_id: str, descriptor: Descriptor, *, actor_id: str, actor_name: str, request_id: str | None,
                  expires_at: float | None = None) -> TalkChannel:
        raise ApiError(409, "intercom_talk_unsupported", "דיבור עם העמדה אינו זמין כאן.")


@dataclass
class FakeTalkLog:
    """What the fake upstream saw: counts and floor changes only (it never keeps a frame's bytes)."""

    opened: int = 0
    frames: int = 0
    bytes: int = 0
    floors: list[bool] = field(default_factory=list)
    closed: list[str] = field(default_factory=list)
    actors: list[tuple[str, str, str | None]] = field(default_factory=list)


class FakeTalkChannel:
    def __init__(self, log_: FakeTalkLog, fail_open: bool = False, drop_after_frames: int | None = None) -> None:
        self.log = log_
        self.fail_open = fail_open
        self.drop_after = drop_after_frames
        self._closed: asyncio.Future[str] | None = None

    def _future(self) -> asyncio.Future[str]:
        if self._closed is None:
            self._closed = asyncio.get_running_loop().create_future()
        return self._closed

    async def open(self) -> None:
        self._future()
        if self.fail_open:
            raise ApiError(503, "intercom_talk_upstream_unavailable", "העמדה לא פתחה ערוץ דיבור.")
        self.log.opened += 1

    async def send_frame(self, frame: bytes) -> None:
        self.log.frames += 1
        self.log.bytes += len(frame)
        if self.drop_after is not None and self.log.frames >= self.drop_after and not self._future().done():
            self._future().set_result("upstream_closed")

    async def floor(self, held: bool) -> None:
        self.log.floors.append(held)

    async def wait_closed(self) -> str:
        return await self._future()

    async def close(self, reason: str) -> None:
        self.log.closed.append(reason)
        if not self._future().done():
            self._future().set_result(reason)


class FakeProvider:
    """Tests and a developer backend (SW_FAKE_STATION_MEDIA=1, never inside the add-on): a descriptor with both profiles and
    talk over `pcmu_frames`, streams named in Arx's namespace (nothing is registered anywhere), and an in-memory talk
    upstream that counts frames. `raw_override` lets a test hand `parse_descriptor` any descriptor it wants."""

    name = "fake"

    def __init__(self) -> None:
        self.talk_log = FakeTalkLog()
        self.ttl_s = 300
        self.max_viewers = 2
        self.max_talk_seconds = 120
        self.talk = True
        self.codec = "pcmu"
        self.fail_open = False
        self.drop_after_frames: int | None = None
        self.unavailable: dict[str, str] = {}
        self.raw_override: dict[str, Any] | None = None
        self.described = 0

    def raw(self, station_id: str, now: float) -> dict[str, Any]:
        if self.raw_override is not None:
            return {**self.raw_override, "station_id": self.raw_override.get("station_id", station_id)}
        return {
            "schema": SCHEMA,
            "station_id": station_id,
            "session": "fake-" + secrets.token_urlsafe(18),
            "revision": 7,
            "issued_at": _ts(now),
            "expires_at": _ts(now + self.ttl_s),
            "video": {"profiles": [
                {"id": "sub", "codec": "h264", "width": 640, "height": 360, "fps": 15, "transports": ["webrtc", "mse"]},
                {"id": "main", "codec": "h264", "width": 1920, "height": 1080, "fps": 25, "transports": ["mse", "webrtc"]},
            ]},
            "audio": {"listen": True, "talk": self.talk, "duplex": "half", "codec": self.codec, "talk_transports": ["pcmu_frames"],
                      "max_talk_seconds": self.max_talk_seconds},
            "limits": {"max_viewers": self.max_viewers, "max_talkers": 1},
        }

    def describe(self, conn: Any, settings: Settings, station: dict[str, Any]) -> Descriptor:
        sid = station["id"]
        if sid in self.unavailable:
            raise Unavailable(self.unavailable[sid])
        self.described += 1
        now = time.time()
        return parse_descriptor(self.raw(sid, now), station_id=sid, provider=self.name, now=now)

    def video_stream(self, conn: Any, settings: Settings, station: dict[str, Any], profile: str, *, actor: w10.Actor | None = None) -> str:
        from . import go2rtc as g2

        base = g2.wiskey_stream_name(station["id"])
        return base if profile == "main" else f"{base}.sub"

    def talk_open(self, settings: Settings, station_id: str, descriptor: Descriptor, *, actor_id: str, actor_name: str, request_id: str | None,
                  expires_at: float | None = None) -> TalkChannel:
        self.talk_log.actors.append((station_id, actor_id, request_id))
        return FakeTalkChannel(self.talk_log, fail_open=self.fail_open, drop_after_frames=self.drop_after_frames)


# ---------------------------------------------------------------- WisKey's W10 provider (AVW10-295)

class SyncTransport:
    """WiskeyProvider's only way to WisKey: the feed's own live session (intercom_sync.SYNC) under the `media` channel's guard
    (wiskey_channels.MEDIA). The descriptor and the lease are reads (read lane, rate buckets); the talk's open and close are
    actions (action lane, never queued or retried; the close spends no rate token); frames and the floor are posted without a
    lane (`media_post`): their limits are the talk socket's."""

    CHANNEL = "media"

    def api(self, settings: Settings) -> dict[str, Any] | None:
        from . import intercom_sync

        return intercom_sync.SYNC.api_facts(settings)

    def read(self, settings: Settings, key: str, send: Any, project: Any, who: str) -> dict[str, Any]:
        from . import intercom_sync

        return intercom_sync.SYNC.command(settings, key, send, project, who=who, channel=self.CHANNEL)

    def act(self, settings: Settings, key: str, send: Any, project: Any, who: str, *, free: bool = False) -> dict[str, Any]:
        from . import intercom_sync

        return intercom_sync.SYNC.action(settings, key, send, project, who, lane="action", free=free, channel=self.CHANNEL)

    def post(self, send: Any) -> Any:
        from . import intercom_sync

        return intercom_sync.SYNC.media_post(send, self.CHANNEL)


def _rid() -> str:
    return "arx-" + secrets.token_hex(10)


def _wiskey_code(exc: ApiError) -> str:
    details = exc.details if isinstance(exc.details, dict) else {}
    return str(details.get("wiskey_code") or exc.code)


class _TalkRegistry:
    """The open WisKey talks by WisKey's `talk_ref` (in memory): the feed's loop ends them when WisKey says so."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by_ref: dict[str, WiskeyTalkChannel] = {}

    def add(self, ref: str, channel: "WiskeyTalkChannel") -> None:
        with self._lock:
            self._by_ref[ref] = channel

    def drop(self, ref: str | None) -> None:
        if ref is None:
            return
        with self._lock:
            self._by_ref.pop(ref, None)

    def get(self, ref: str) -> "WiskeyTalkChannel | None":
        with self._lock:
            return self._by_ref.get(ref)

    def all(self) -> list["WiskeyTalkChannel"]:
        with self._lock:
            return list(self._by_ref.values())

    def count(self) -> int:
        with self._lock:
            return len(self._by_ref)


WISKEY_TALKS = _TalkRegistry()


def on_wiskey_event(event: dict[str, Any] | None) -> None:
    """Called on the feed's loop (intercom_sync `_media_hook`): `media/talk_closed` ends that talk; None ends every WisKey talk
    (the session is going, or the add-on lost WisKey access). Never raises, never blocks."""
    if event is None:
        for channel in WISKEY_TALKS.all():
            channel.remote_closed("upstream_closed")
        return
    hit = w10.talk_closed(event)
    if hit is None:
        return
    channel = WISKEY_TALKS.get(hit[0])
    if channel is not None:
        log.info("station media: WisKey ended a talk (%s)", hit[1])
        channel.remote_closed(hit[1])


class WiskeyTalkChannel:
    """One talk through WisKey's talk hook (`media/talk_open` ... `media/talk_close`, section 3.3). Lives on the web server's loop;
    the WisKey frames go out on the feed's loop. Frames: one `talk_frame` per G.711 frame with `seq` +1 each, at most
    FRAMES_IN_FLIGHT unanswered (a slower WisKey drops frames, never queues audio); a refused or undeliverable frame or floor ends
    the talk (no retry). Nothing here keeps audio: the bytes go into the frame and are gone."""

    FRAMES_IN_FLIGHT = 8
    FLOOR_TIMEOUT_S = 5.0

    def __init__(self, provider: "WiskeyProvider", settings: Settings, descriptor: Descriptor, actor: w10.Actor, request_id: str | None, expires_at: float) -> None:
        self.provider = provider
        self.settings = settings
        self.descriptor = descriptor
        self.actor = actor
        self.request_id = request_id or _rid()
        self.expires_at = expires_at
        self.ref: str | None = None
        self.seq = 0
        self.in_flight = 0
        self.dropped = 0
        self.closed_by_wiskey = False
        self._close_sent = False
        self._loop: asyncio.AbstractEventLoop | None = None
        self._closed: asyncio.Future[str] | None = None

    def _future(self) -> asyncio.Future[str]:
        if self._closed is None:
            self._loop = asyncio.get_running_loop()
            self._closed = self._loop.create_future()
        return self._closed

    def _end(self, reason: str) -> None:
        fut = self._closed
        if fut is not None and not fut.done():
            fut.set_result(reason)

    def remote_closed(self, reason: str) -> None:
        """WisKey ended it (any thread): no `talk_close` is sent for it, the session ends `upstream_closed`."""
        self.closed_by_wiskey = True
        loop = self._loop
        if loop is not None:
            try:
                loop.call_soon_threadsafe(self._end, "upstream_closed")
            except RuntimeError:  # the web server's loop is gone
                pass

    async def open(self) -> None:
        self._future()
        d = self.descriptor
        when = _ts(self.expires_at)
        try:
            reply = await asyncio.to_thread(self.provider.transport.act, self.settings, "talk",
                                            lambda call: w10.talk_open(call, d.session, self.actor, self.request_id, when), w10.project_object, self.actor.id)
        except ApiError as exc:
            code = _wiskey_code(exc)
            if code in w10.BUSY_CODES:  # the panel or another operator holds the station: who is never said
                raise ApiError(409, "intercom_talk_busy", "מישהו אחר כבר מדבר עם העמדה.", retryable=True) from exc
            raise ApiError(503, "intercom_talk_upstream_unavailable", "העמדה לא פתחה ערוץ דיבור.", details={"reason": w10.unavailable_reason(code)}) from exc
        raw = reply.get("talk")
        try:
            opened = w10.parse_talk_open(raw)
        except w10.ContractError as exc:
            log.warning("station media: a talk open answer refused (%s)", exc.code)
            self.ref = w10.talk_ref_of(raw)  # WisKey may hold its busy lock for it: closed at once when it can be named
            if self.ref is not None:
                await self.close("ended")
            raise ApiError(503, "intercom_talk_upstream_unavailable", "העמדה לא פתחה ערוץ דיבור.", details={"reason": exc.code}) from None
        self.ref = opened.talk_ref
        WISKEY_TALKS.add(opened.talk_ref, self)
        if opened.codec != d.audio_codec:  # the browser encodes the descriptor's codec: a different one would be noise at the door
            await self.close("ended")
            raise ApiError(503, "intercom_talk_upstream_unavailable", "העמדה לא פתחה ערוץ דיבור.", details={"reason": "talk_codec_mismatch"})

    def _post(self, send: Any) -> Any:
        try:
            return self.provider.transport.post(send)
        except Exception:  # noqa: BLE001 - an undeliverable frame ends the talk
            return None

    def _frame_done(self, fut: Any) -> None:
        loop = self._loop
        if loop is None:
            return
        try:
            loop.call_soon_threadsafe(self._after_frame, fut)
        except RuntimeError:
            pass

    def _after_frame(self, fut: Any) -> None:
        self.in_flight = max(0, self.in_flight - 1)
        if fut.cancelled() or fut.exception() is not None:
            self._end("upstream_closed")

    async def send_frame(self, frame: bytes) -> None:
        closed = self._future()
        if self.ref is None or closed.done():
            return
        if self.in_flight >= self.FRAMES_IN_FLIGHT:
            self.dropped += 1
            return
        self.seq += 1
        ref, seq, data = self.ref, self.seq, bytes(frame)
        fut = self._post(lambda call: w10.talk_frame(call, ref, seq, data))
        if fut is None:
            self._end("upstream_closed")
            return
        self.in_flight += 1
        fut.add_done_callback(self._frame_done)

    async def floor(self, held: bool) -> None:
        closed = self._future()
        if self.ref is None or closed.done():
            return
        ref = self.ref
        fut = self._post(lambda call: w10.talk_floor(call, ref, held))
        if fut is None:
            self._end("upstream_closed")
            return
        try:
            await asyncio.wait_for(asyncio.wrap_future(fut), self.FLOOR_TIMEOUT_S)
        except Exception:  # noqa: BLE001 - refused, timed out or the session went: the talk is over, never retried
            self._end("upstream_closed")

    async def wait_closed(self) -> str:
        return await self._future()

    async def close(self, reason: str) -> None:
        self._future()
        ref = self.ref
        if ref is not None and not self.closed_by_wiskey and not self._close_sent:
            self._close_sent = True
            try:
                await asyncio.to_thread(self.provider.transport.act, self.settings, "talk_close",
                                        lambda call: w10.talk_close(call, ref, reason), lambda _raw: {"closed": True}, self.actor.id, free=True)
            except Exception as exc:  # noqa: BLE001 - WisKey's own limit ends it on its side; nothing is retried
                log.info("station media: talk close not confirmed (%s)", getattr(exc, "code", type(exc).__name__))
        WISKEY_TALKS.drop(ref)
        self._end(reason)


class WiskeyProvider:
    """WisKey's W10 (`arx.station_media.v1`): the descriptor from `media/station_descriptor`, each profile's source from
    `media/stream_lease` (registered IN MEMORY in Arx's own go2rtc under `smplwise_wiskey_<station>[.sub]` - never written to a
    configuration, never logged, audited or served), talk through the talk hook. Selected only while WisKey's discovery lists the
    video commands (`provider_for`); talk is offered only while the four talk commands are listed too. Every WisKey wire name is in
    services/wiskey_media_contract.py."""

    name = "wiskey"
    cache = True  # one WisKey read per station until 30 s before the descriptor expires (MediaState.descriptor)

    def __init__(self, transport: Any | None = None) -> None:
        self.transport = transport or SyncTransport()

    def listed(self, settings: Settings) -> tuple[bool, bool]:
        video, talk, _why = w10.listed(self.transport.api(settings))
        return video, talk

    def _read(self, settings: Settings, key: str, send: Any, project: Any, who: str) -> Any:
        try:
            reply = self.transport.read(settings, key, send, project, who)
        except ApiError as exc:
            raise Unavailable(w10.unavailable_reason(_wiskey_code(exc))) from exc
        got = reply.get(key) if isinstance(reply, dict) else None
        if reply.get("state") != "ready" or got is None:
            raise Unavailable(w10.unavailable_reason(reply.get("last_error") if reply.get("state") != "unsupported" else "unknown_command"))
        return got

    def describe(self, conn: Any, settings: Settings, station: dict[str, Any]) -> Descriptor:
        sid = station["id"]
        video, talk = self.listed(settings)
        if not video:
            raise Unavailable("not_listed")
        if not settings.go2rtc_url:  # every profile is relayed through Arx's own go2rtc, whatever the lease names
            raise Unavailable("no_media")
        rid = _rid()
        raw = self._read(settings, "media", lambda call: w10.station_descriptor(call, sid, w10.SYSTEM_ACTOR, rid), w10.project_descriptor, "arx-media")
        if not talk and isinstance(raw.get("audio"), dict):
            raw = {**raw, "audio": {**raw["audio"], "talk": False}}  # the talk hook is not listed: talk stays in the classic panel
        return parse_descriptor(raw, station_id=sid, provider=self.name)

    def video_stream(self, conn: Any, settings: Settings, station: dict[str, Any], profile: str, *, actor: w10.Actor | None = None) -> str:
        from . import go2rtc as g2

        sid = station["id"]
        try:
            d = MEDIA.descriptor(self, conn, settings, station)
        except Unavailable as exc:
            raise ApiError(503, "intercom_media_unavailable", "השידור מהעמדה אינו זמין כרגע.", details={"reason": exc.code}) from exc
        if d.profile(profile) is None:
            raise ApiError(409, "intercom_media_profile_unavailable", "האיכות הזו אינה זמינה לעמדה.")
        who = actor or w10.SYSTEM_ACTOR
        rid = _rid()
        try:
            raw = self._read(settings, "lease", lambda call: w10.stream_lease(call, d.session, profile, who, rid), w10.project_object, who.id)
        except Unavailable as exc:
            raise ApiError(503, "intercom_media_unavailable", "השידור מהעמדה אינו זמין כרגע.", details={"reason": exc.code}) from exc
        try:
            lease = w10.parse_lease(raw)
        except w10.ContractError as exc:
            log.warning("station media: a stream lease refused (%s)", exc.code)  # the rule only, never the value
            raise ApiError(503, "intercom_media_unavailable", "השידור מהעמדה אינו זמין כרגע.", details={"reason": exc.code}) from None
        finally:
            raw = None  # the source lives on only inside the lease
        if lease.stream is not None:
            return lease.stream  # a stream in Arx's own namespace (checked by the contract): named only, never created here
        base = g2.wiskey_stream_name(sid)
        name = base if profile == "main" else f"{base}.sub"
        source = lease.source or ""
        digest = hashlib.sha256(source.encode()).hexdigest()
        with g2._REGISTERED_LOCK:
            known = g2._REGISTERED.get(name) == digest
        if not known:
            try:
                g2.Go2rtc(settings).frame_jpeg(name, source)  # registers in memory (go2rtc's GetOrPatch); no configuration write
            except ApiError as exc:
                with g2._REGISTERED_LOCK:
                    registered = g2._REGISTERED.get(name) == digest
                if not registered:  # go2rtc refused the stream itself (a frame that failed after registering is fine)
                    raise ApiError(503, "intercom_media_unavailable", "השידור מהעמדה אינו זמין כרגע.", details={"reason": exc.code}) from None
        return name

    def talk_open(self, settings: Settings, station_id: str, descriptor: Descriptor, *, actor_id: str, actor_name: str, request_id: str | None,
                  expires_at: float | None = None) -> TalkChannel:
        if not self.listed(settings)[1]:
            raise ApiError(409, "intercom_talk_unsupported", "דיבור עם העמדה זמין בלוח הקלאסי בלבד.")
        until = expires_at if expires_at is not None else time.time() + min(descriptor.max_talk_seconds, MAX_TALK_S)
        return WiskeyTalkChannel(self, settings, descriptor, w10.Actor(actor_id, actor_name), request_id, until)


FAKE_ENV = "SW_FAKE_STATION_MEDIA"
_override: MediaProvider | None = None
_local = LocalProvider()
_wiskey = WiskeyProvider()
_fake_from_env: FakeProvider | None = None


def set_provider(provider: MediaProvider | None) -> None:
    """Tests: install a provider (None restores the default selection). Clears the descriptor cache."""
    global _override
    _override = provider
    MEDIA.reset()


def provider_for(settings: Settings) -> MediaProvider:
    """A test's provider; else the fake on a developer backend that asked for it (never in the add-on); else WisKey's W10
    provider while WisKey's discovery (`overview.api.commands`) lists its video commands (AVW10-295); else Arx's own source,
    exactly as before W10."""
    global _fake_from_env
    if _override is not None:
        return _override
    if os.environ.get(FAKE_ENV) == "1" and not settings.in_addon:
        if _fake_from_env is None:
            _fake_from_env = FakeProvider()
        return _fake_from_env
    try:
        video, _talk = _wiskey.listed(settings)
    except Exception:  # noqa: BLE001 - an unreadable discovery keeps Arx's own source
        video = False
    return _wiskey if video else _local


# ---------------------------------------------------------------- the state: descriptors, viewers, talk sessions

@dataclass
class TalkSession:
    id: str
    station_id: str
    user_id: str
    username: str
    request_id: str | None
    transport: str
    codec: str
    duplex: str
    created_at: float
    expires_at: float
    attached: bool = False
    opened_at: float | None = None
    closed: bool = False
    outcome: str | None = None
    frames: int = 0
    presses: int = 0
    stop_requested: str | None = None

    @property
    def ref(self) -> str:
        """What the audit keeps of the session handle: a digest prefix (the handle itself admits its socket)."""
        return hashlib.sha256(self.id.encode()).hexdigest()[:12]


class MediaState:
    """Process-wide, in memory (a restart ends every talk session and drops every descriptor - nothing is persisted)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._descriptors: dict[tuple[str, str], Descriptor] = {}
        self._viewers: dict[str, set[str]] = {}
        self.talks: dict[str, TalkSession] = {}

    def reset(self) -> None:
        with self._lock:
            self._descriptors.clear()
            self._viewers.clear()
            self.talks.clear()

    # -- descriptors (cached per provider and station until 30 s before they expire)
    def descriptor(self, provider: MediaProvider, conn: Any, settings: Settings, station: dict[str, Any], *, fresh: bool = False) -> Descriptor:
        key = (provider.name, station["id"])
        now = time.time()
        with self._lock:
            d = self._descriptors.get(key)
        if d is not None and not fresh and getattr(provider, "cache", True) and d.expires_at - 30 > now:
            return d
        try:
            d = provider.describe(conn, settings, station)
        except DescriptorError as exc:
            log.warning("station media: descriptor for a station refused (%s)", exc.code)
            raise Unavailable(exc.code) from exc
        except Unavailable:
            with self._lock:
                self._descriptors.pop(key, None)
            raise
        except ApiError as exc:
            raise Unavailable(exc.code) from exc
        except Exception as exc:  # noqa: BLE001 - a provider bug hides the feature, it never breaks the screen
            log.warning("station media: provider %s failed (%s)", provider.name, type(exc).__name__)
            raise Unavailable("provider_error") from exc
        with self._lock:
            self._descriptors[key] = d
        return d

    # -- viewers (per station, against the descriptor's limit)
    def add_viewer(self, station_id: str, token: str, limit: int) -> bool:
        with self._lock:
            current = self._viewers.setdefault(station_id, set())
            if len(current) >= limit:
                return False
            current.add(token)
            return True

    def drop_viewer(self, station_id: str, token: str) -> None:
        with self._lock:
            current = self._viewers.get(station_id)
            if current is not None:
                current.discard(token)
                if not current:
                    self._viewers.pop(station_id, None)

    def viewers(self, station_id: str) -> int:
        with self._lock:
            return len(self._viewers.get(station_id, ()))

    # -- talk sessions
    def prune(self, now: float | None = None) -> list[TalkSession]:
        """Reservations never attached in time are released (outcome `never_connected`); returned so the caller audits them."""
        now = time.time() if now is None else now
        out: list[TalkSession] = []
        with self._lock:
            for sid, t in list(self.talks.items()):
                if not t.attached and not t.closed and now - t.created_at > RESERVE_S:
                    t.closed, t.outcome = True, "never_connected"
                    out.append(t)
                if t.closed:
                    self.talks.pop(sid, None)
        return out

    def busy(self, station_id: str, now: float | None = None) -> bool:
        """Someone holds the station's talker slot (a reservation past its attach time no longer counts; it is released - and
        audited - by the next start)."""
        now = time.time() if now is None else now
        with self._lock:
            return any(t.station_id == station_id and not t.closed and (t.attached or now - t.created_at <= RESERVE_S) for t in self.talks.values())

    def reserve(self, session: TalkSession) -> str | None:
        """Takes the station's single talker slot and the user's single session; None, or the refusal code."""
        with self._lock:
            live = [t for t in self.talks.values() if not t.closed]
            if any(t.user_id == session.user_id for t in live):
                return "intercom_talk_user_busy"
            if any(t.station_id == session.station_id for t in live):
                return "intercom_talk_busy"
            self.talks[session.id] = session
            return None

    def talk(self, session_id: str) -> TalkSession | None:
        with self._lock:
            t = self.talks.get(session_id)
            return t if t is not None and not t.closed else None

    def attach(self, session: TalkSession) -> bool:
        with self._lock:
            if session.closed or session.attached:
                return False
            session.attached = True
            return True

    def finish(self, session: TalkSession, outcome: str) -> bool:
        """Closes the session once; True for the call that closed it (that one writes the end row)."""
        with self._lock:
            if session.closed:
                return False
            session.closed, session.outcome = True, outcome
            self.talks.pop(session.id, None)
            return True


MEDIA = MediaState()


def new_talk(station_id: str, user_id: str, username: str, request_id: str | None, d: Descriptor) -> TalkSession:
    now = time.time()
    seconds = min(d.max_talk_seconds, MAX_TALK_S)
    return TalkSession(id=secrets.token_urlsafe(24), station_id=station_id, user_id=user_id, username=username, request_id=request_id,
                       transport=d.talk_transport or "", codec=d.audio_codec, duplex=d.duplex, created_at=now,
                       expires_at=now + seconds)


def iso(epoch: float) -> str:
    return _ts(epoch)
