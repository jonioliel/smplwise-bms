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

WisKey's W10 is `WiskeyBridgeProvider` (W10CLIENT-295 / WKDIRECT-295: signed commands on the direct API or the signed Home
Assistant path - the unsigned feed provider is removed); it implements the same three calls (`describe`, `video_stream`, `talk_open`)
and the screens do not change. The descriptor is parsed by `parse_descriptor` whoever produced it - the fake goes through it too,
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
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

from ..config import Settings
from ..db import database_of, get_setting
from ..errors import ApiError
from . import wiskey_media_bridge as bridge
from . import wiskey_media_contract as w10
from .wiskey_talk_pump import TalkPump

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
SCHEMA_V11 = w10.SCHEMA_V11  # W10CLIENT-295: WisKey's registered descriptor (one `main` profile, unknown codec / size, signed talk batches)
PROFILES = ("sub", "main")
VIDEO_TRANSPORTS = ("webrtc", "mse")
VIDEO_CODECS = ("h264", "h265")
TALK_TRANSPORTS_ARX = ("pcmu_frames",)  # what this build implements (to the browser); `webrtc` is in the contract for a later build
TALK_TRANSPORTS_KNOWN = ("pcmu_frames", "webrtc")
FRAME_CODECS = ("pcmu", "pcma")  # G.711 mu-law / A-law, 8 kHz mono: what the frames transport carries
AUDIO_CODECS = ("pcmu", "pcma", "opus", "aac")
HANDLE_RE = re.compile(r"^[A-Za-z0-9_-]{16,128}$")
MAX_TALK_S = 300  # the ceiling of a v1 descriptor's own limit (and the legacy default)
MIN_TALK_S = 10
# W10CLIENT-295 (owner 24.10): the longest talk is an Arx SETTING; the effective limit is the smaller of the setting and the descriptor's
# own `max_talk_seconds`. WKDIRECT-295: WisKey publishes `station_media_max_talk_seconds` per station (exact int 1..86400, default 300,
# no hidden 180 s clamp) and advertises it as the v1.1 descriptor's `audio.max_talk_seconds`; Arx's setting takes the same range.
TALK_MAX_KEY = "access.station_media_max_talk_s"
TALK_MAX_DEFAULT_S = 300
TALK_MAX_LOW_S = 1
TALK_MAX_HIGH_S = 86400
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
    if raw.get("schema") not in (SCHEMA, SCHEMA_V11):
        raise DescriptorError("descriptor_schema_unknown")
    v11 = raw.get("schema") == SCHEMA_V11
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
        if v11:  # one `main` profile whose source is private: Arx's own go2rtc relays it to browsers as mse / webrtc (unknown codec / size stay None)
            if p.get("id") != w10.V11_PROFILE or w10.V11_VIDEO_TRANSPORT not in (p.get("transports") or []):
                continue
            transports = ("mse", "webrtc")
        else:
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
    if v11:
        # signed batches are the only talk: browsers still send 160-byte frames (`pcmu_frames`); the codec is learned from `talk_open` and is
        # always PCMU; the descriptor knows neither listen nor duplex (null) and names no limit once WisKey drops its 180 s (null = none)
        talk = audio.get("talk_transports") is not None and w10.V11_TALK_TRANSPORT in (audio.get("talk_transports") or [])
        # WKDIRECT-295: the station's published limit, exact int 1..86400 (required by WisKey's result schema); anything else - missing,
        # null, a bool, a float, out of range - is not a limit Arx can honour, so the descriptor offers no talk (video is unaffected)
        published = audio.get("max_talk_seconds")
        if type(published) is int and TALK_MAX_LOW_S <= published <= TALK_MAX_HIGH_S:
            max_talk = published
        else:
            talk, max_talk = False, TALK_MAX_DEFAULT_S
        talk_transports = ("pcmu_frames",) if talk else ()
        duplex, codec = "half", (w10.V11_CODEC if talk else "unknown")

    limits = raw.get("limits") if isinstance(raw.get("limits"), dict) else {}
    max_viewers = _int(limits.get("max_viewers"), 1, MAX_VIEWERS_CAP, MAX_VIEWERS_CAP if v11 else 1) or 1
    # Arx allows exactly one talker per station whatever a descriptor says (half-duplex intercom, WisKey's `audio_busy`)
    max_talkers = 1

    # The transport is a software offer; physical listen/duplex metadata stays
    # untouched in the source descriptor. Explicit False still refuses.
    listen = audio.get("listen") is True or (v11 and talk and audio.get("listen") is None
        and isinstance(audio.get("listen_transports"), list)
        and "signed_ws_pcmu_v1" in audio["listen_transports"])
    return Descriptor(station_id=station_id, session=session, revision=revision, issued_at=issued, expires_at=expires,
                      profiles=tuple(profiles), listen=listen, talk=talk, duplex=duplex or "half",
                      audio_codec=codec, talk_transports=talk_transports, max_talk_seconds=max_talk, max_viewers=max_viewers,
                      max_talkers=max_talkers, provider=provider)


def _ts(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def talk_limit_s(conn: Any, d: "Descriptor | None" = None) -> int:
    """The longest a talk may last: the setting `access.station_media_max_talk_s` (default 300, bounds 1..86400 - WisKey's own range;
    unreadable = default), and the smaller of that and the descriptor's own limit (WisKey's published per-station value) when there is one."""
    try:
        value = int(str(get_setting(conn, TALK_MAX_KEY, str(TALK_MAX_DEFAULT_S))))
    except Exception:  # noqa: BLE001 - an unreadable setting is the default, never a failed screen
        value = TALK_MAX_DEFAULT_S
    value = max(TALK_MAX_LOW_S, min(TALK_MAX_HIGH_S, value))
    return min(value, d.max_talk_seconds) if d is not None else value


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
        # WKAUDIN-295: the synthetic downlink of `listen_open`
        self.listen_log: list[tuple[str, str, str | None]] = []
        self.listen_packets: list[bytes] = []
        self.listen_gap_s = 0.0
        self.listen_end: str | None = "upstream_closed"
        self.listen_fail_open = False

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

    def listen_open(self, settings: Settings, station_id: str, descriptor: Descriptor, *, actor_id: str, actor_name: str, request_id: str | None,
                    expires_at: float | None = None) -> Any:
        """WKAUDIN-295: a synthetic downlink (tests only): `listen_packets` are played like AudioSession.receive() hands them over."""
        from .wiskey_listen_adapter import SyntheticDownlink

        self.listen_log.append((station_id, actor_id, request_id))
        return SyntheticDownlink(list(self.listen_packets), gap_s=self.listen_gap_s, end_reason=self.listen_end, fail_open=self.listen_fail_open)


# ---------------------------------------------------------------- WisKey's W10: shared pieces (AVW10-295)
#
# WKDIRECT-295 (S6): the unsigned feed path of AVW10-295 - `SyncTransport`'s read / act / post on the feed's session under the `media`
# channel, `WiskeyTalkChannel` (one flat `talk_frame` per frame), the `_TalkRegistry` the feed's `_media_hook` ended talks through, and
# the `WiskeyProvider` built on them - is REMOVED. What W10 keeps of the feed is its read-only discovery (`overview.api.commands`).

def _feed_discovery(settings: Settings) -> dict[str, Any] | None:
    """WisKey's discovery as the feed last read it (`overview.api`): which W10 commands WisKey lists. Read only; no command is sent."""
    from . import intercom_sync

    return intercom_sync.SYNC.api_facts(settings)


def _rid() -> str:
    return "arx-" + secrets.token_hex(10)


# WKLIVE-295: the leased streams this process registered in go2rtc: stream name -> its `_Lease` record (station id, lease expiry, ...). A
# lease is valid for a few seconds only, but the stream it created stays in go2rtc's memory under the private source; it is removed again
# when the station's last viewer leaves (`release_leased_streams`) and, as a janitor, when a later lease finds an old one with no viewer left.
#
# WKF01F02-295 (F01): the Mac lease lifecycle (WisKey delta be2c1c05, `_LEASE_STREAMS` / `_retire_stream_lease` / `close_leased_streams`)
# merged INTO this registry - not a parallel table. Each record also names its owner (the `VideoChannel` that obtained the lease), the go2rtc
# registration it made (`digest`), and one timer per record with a generation, so a renewed lease invalidates the earlier timer. Rules:
# - a stream is deleted only while go2rtc's registration is still the record's own (`_REGISTERED[name] == digest`); a foreign registration of
#   the name is never deleted, only the record is dropped;
# - a delete go2rtc does not confirm keeps the record and the registration (`quarantined`): it is not forgotten and not retried by the timer
#   or the janitor; the last viewer leaving, the owner's close and the application shutdown try again (explicit events, one attempt each);
# - a station with a viewer keeps its streams (the timer and the janitor never delete under a viewer); only the owner's close ignores that;
# - names stay in the `smplwise_wiskey_` namespace (`Go2rtc.discard_leased_stream` refuses anything else); every change runs under _LEASE_LOCK;
# - the owner's close (`close_leased_streams`, called by `VideoChannel.close`) and the shutdown (`shutdown_bridge`) cancel and join every
#   timer generation of that owner.
LEASE_GRACE_S = 60.0
LEASE_MAX = 128  # leased streams this process keeps at once (Mac delta: "no room for another stream")


@dataclass(repr=False, eq=False)
class _Lease:
    """One leased stream (no source is kept here: only the digest of it, as `go2rtc._REGISTERED` holds it)."""

    station: str
    expires_at: float
    owner: Any = None
    profile: str = "main"
    digest: str | None = None  # None: a record without a registration of its own (treated as owned)
    settings: Any = None
    generation: int = 0
    timer: Any = None
    timers: list[Any] = field(default_factory=list)
    quarantined: bool = False

    def __getitem__(self, index: int) -> Any:  # WKLIVE-295 read the record as (station, expires_at)
        return (self.station, self.expires_at)[index]


_LEASED: dict[str, _Lease] = {}
# Cleanup handles only, never a second stream registry. Retirement cannot lose
# an owner or a callback generation still waiting to leave the registry lock.
_LEASE_TIMERS: list[tuple[Any, Any]] = []
_LEASE_TIMER_JOIN_S = 5.0
_LEASE_LOCK = threading.RLock()  # registering and releasing never interleave: a new viewer's stream is not deleted under it


def _owned(name: str, rec: _Lease) -> bool:
    from . import go2rtc as g2

    if rec.digest is None:
        return True
    with g2._REGISTERED_LOCK:
        return g2._REGISTERED.get(name) == rec.digest


def _arm(name: str, rec: _Lease) -> None:
    """(Re)arms the record's one timer for `expires_at + LEASE_GRACE_S`; a new generation invalidates every earlier one. Under _LEASE_LOCK."""
    if rec.timer is not None:
        rec.timer.cancel()
    rec.timers[:] = [t for t in rec.timers if t.is_alive()]
    rec.generation += 1
    generation = rec.generation
    timer = threading.Timer(max(0.001, rec.expires_at + LEASE_GRACE_S - time.time()), _on_timer, args=(name, rec, generation))
    timer.daemon = True
    rec.timer = timer
    rec.timers.append(timer)
    # Reap finished generations, retaining every live generation until joined.
    for who, old in tuple(_LEASE_TIMERS):
        if not old.is_alive():
            old.join(0)
            _LEASE_TIMERS[:] = [(owner, t) for owner, t in _LEASE_TIMERS if t is not old]
    _LEASE_TIMERS.append((rec.owner, timer))
    timer.start()


def _on_timer(name: str, rec: _Lease, generation: int) -> None:
    try:
        with _LEASE_LOCK:
            if _LEASED.get(name) is not rec or generation != rec.generation or rec.quarantined:
                return  # a renewed lease, a removed record or an unresolved delete: this generation has nothing to do
            if time.time() < rec.expires_at + LEASE_GRACE_S:
                _arm(name, rec)
                return
            _retire(rec.settings, name, rec)
    except Exception as exc:  # noqa: BLE001 - a timer never raises into its thread
        log.warning("station media: leased stream timer failed (%s)", type(exc).__name__)


def _retire(settings: Any, name: str, rec: _Lease, *, force: bool = False) -> bool:
    """Removes one record (under _LEASE_LOCK). True: the record is gone (deleted, or the name is no longer this record's in go2rtc). False:
    it stays - its station has a viewer (not `force`), or go2rtc did not confirm the delete (quarantined, registration kept)."""
    from . import go2rtc as g2

    if _LEASED.get(name) is not rec:
        return True
    if not force and MEDIA.viewers(rec.station) > 0:
        return False
    if rec.timer is not None:
        rec.timer.cancel()
    if _owned(name, rec):
        target = settings if settings is not None else rec.settings
        try:
            ok = target is not None and g2.Go2rtc(target).discard_leased_stream(name, rec.digest)
        except ValueError:  # not one of ours (cannot happen: only names this module registered are kept)
            log.warning("station media: a stream name was refused for removal")
            ok = True
        except ApiError as exc:  # no go2rtc configured any more: nothing confirmed the delete
            log.warning("station media: leased stream cleanup failed (%s)", exc.code)
            ok = False
        if not ok:
            rec.quarantined = True
            return False
    _LEASED.pop(name, None)
    return True


def _register_lease(settings: Settings, sid: str, profile: str, source: str, expires_at: float | None = None, *, owner: Any = None) -> str:
    """The leased source into Arx's own go2rtc, IN MEMORY (go2rtc's GetOrPatch; no configuration write), under a name of its own owner
    `smplwise_wiskey_<station>[.sub].w10.<random>`; the stream name is all that leaves. A fresh signed lease of the same owner, station and
    profile with an unchanged source renews the existing registration (it is not sent again) and re-arms its timer; a changed source retires
    the earlier stream first and is refused (`intercom_media_cleanup_failed`) while that delete is unconfirmed."""
    from . import go2rtc as g2

    now = time.time()
    if expires_at is not None and expires_at <= now:
        raise ApiError(503, "intercom_media_unavailable", "תוקף השידור מהעמדה הסתיים.")
    until = expires_at if expires_at is not None else now
    digest = hashlib.sha256(source.encode()).hexdigest()
    with _LEASE_LOCK:
        if owner is not None and getattr(owner, "closed", False):
            raise ApiError(503, "intercom_media_unavailable", "בעל השידור נסגר.")
        _sweep_leased(settings, skip_station=sid)
        for name, rec in list(_LEASED.items()):
            if rec.owner is not owner or rec.station != sid or rec.profile != profile:
                continue
            if rec.digest == digest and _owned(name, rec):
                rec.expires_at = max(rec.expires_at, until)
                rec.settings = settings
                rec.quarantined = False  # a fresh signed lease for the very same source makes the stream valid again
                _arm(name, rec)
                return name
            if MEDIA.viewers(sid) > 0 and not rec.quarantined:
                continue  # a viewer still watches the earlier stream: it stays until the station's last viewer leaves (WKLIVE-295)
            if not _retire(settings, name, rec, force=True):
                raise ApiError(503, "intercom_media_cleanup_failed", "סגירת השידור הקודם מהעמדה טרם אושרה.")
        if len(_LEASED) >= LEASE_MAX:
            raise ApiError(503, "intercom_media_unavailable", "אין מקום לשידור נוסף מהעמדה.")
        base = g2.wiskey_stream_name(sid)
        name = (base if profile == "main" else f"{base}.sub") + ".w10." + secrets.token_hex(8)
        try:
            g2.Go2rtc(settings).frame_jpeg(name, source)  # registers in memory (go2rtc's GetOrPatch); no configuration write
        except ApiError as exc:
            with g2._REGISTERED_LOCK:
                registered = g2._REGISTERED.get(name) == digest
            if not registered:  # go2rtc refused the stream itself (a frame that failed after registering is fine)
                raise ApiError(503, "intercom_media_unavailable", "השידור מהעמדה אינו זמין כרגע.", details={"reason": exc.code}) from None
        rec = _Lease(sid, until, owner=owner, profile=profile, digest=digest, settings=settings)
        _LEASED[name] = rec
        _arm(name, rec)
    return name


def _sweep_leased(settings: Settings, *, skip_station: str | None = None, now: float | None = None) -> list[str]:
    """Removes leased streams whose lease ended more than `LEASE_GRACE_S` ago and whose station has no viewer (a viewer keeps its stream).
    A quarantined record (an unconfirmed delete) is not retried here."""
    now = time.time() if now is None else now
    gone: list[str] = []
    with _LEASE_LOCK:
        for name, rec in list(_LEASED.items()):
            if rec.station == skip_station or rec.quarantined or rec.expires_at + LEASE_GRACE_S > now or MEDIA.viewers(rec.station) > 0:
                continue
            if _retire(settings, name, rec):
                gone.append(name)
    return gone


def release_leased_streams(settings: Settings, station_id: str) -> list[str]:
    """Called when a viewer of a station has gone: when it was the last one, the station's leased streams are removed from go2rtc (its
    private source is forgotten, nothing else of go2rtc is touched). Never raises. A delete go2rtc does not confirm keeps its record
    (quarantined, WKF01F02-295) - it is not reported as removed. Returns the removed stream names."""
    gone: list[str] = []
    try:
        with _LEASE_LOCK:
            if MEDIA.viewers(station_id) > 0:
                return gone
            for name, rec in list(_LEASED.items()):
                if rec.station == station_id and _retire(settings, name, rec):
                    gone.append(name)
    except Exception as exc:  # noqa: BLE001 - a cleanup problem never breaks the viewer's end
        log.warning("station media: leased streams not released (%s)", type(exc).__name__)
    return gone


def close_leased_streams(owner: Any) -> bool:
    """The owner's close (`VideoChannel.close`) and the shutdown: every stream of THIS owner is retired (a viewer does not keep it - its
    owner is gone) and every timer generation of the owner is cancelled and joined (outside the lock: a firing timer waits for it). True when
    nothing of the owner is left; False when go2rtc did not confirm a delete (that record stays, quarantined)."""
    with _LEASE_LOCK:
        rows = [(name, rec) for name, rec in _LEASED.items() if rec.owner is owner]
        timers = [timer for who, timer in _LEASE_TIMERS if who is owner]
        results = [_retire(None, name, rec, force=True) for name, rec in rows]
        for _name, rec in rows:
            if rec.timer is not None:
                rec.timer.cancel()
    current = threading.current_thread()
    joined = True
    for timer in timers:
        timer.cancel()
        if timer is not current:
            timer.join(_LEASE_TIMER_JOIN_S)
        if timer.is_alive():
            joined = False
        else:
            with _LEASE_LOCK:
                _LEASE_TIMERS[:] = [(who, t) for who, t in _LEASE_TIMERS if t is not timer]
    return all(results) and joined


# ---------------------------------------------------------------- WisKey's W10 over the signed bridge (W10CLIENT-295)

def _valid_request_id(value: str | None) -> bool:
    return isinstance(value, str) and 1 <= len(value) <= 128 and all(32 <= ord(ch) != 127 for ch in value)


class WiskeyBridgeTalkChannel:
    """One talk through WisKey's signed bridge (contract v1.1): a DEDICATED connection that lives exactly as long as the talk. On that
    connection and as the operator (one actor) it reads a fresh descriptor, opens the talk, and then the `TalkPump` is the only sender
    (floor, 5-frame batches, close). Lives on the web server's loop; nothing here keeps audio.

    WK4ADOPT-295 (W-002, WisKey `arx.station_talk_audio.v1` contract revision 2, CODE 924df3e9): NO periodic floor heartbeat - WisKey
    keeps the original signed talk deadline (`retain_execution`) and its own 12 s activity clock is refreshed only by genuine traffic
    (real uplink frames, an explicit floor change, a fresh admitted downlink packet on this talk's subscription). Taken TOGETHER with that
    native lifetime change: against an older WisKey a muted talk simply ends with `idle_timeout` after 12 s (no authority is extended
    either way). There is no wire field naming the revision; the pairing is by WisKey CODE (docs/changes/WK4ADOPT-295.md). Arx's own 30 s
    idle timer of a muted session (frontend/src/wiskey/talk-session.ts) is separate and is re-armed only by a verified 800-byte packet.

    Ends (`wait_closed`) when WisKey closes the talk (`media/talk_closed`), when the connection drops, or when any request is refused, left
    unanswered or answered unexpectedly; nothing is retried. `close` sends `talk_close` once on the same connection; a `cleanup_failed`
    or unconfirmed close is logged (rule code only) - WisKey keeps its station lock then and Arx does not try again."""

    OPEN_TIMEOUT_S = 10.0
    CLOSE_TIMEOUT_S = 5.0

    def __init__(self, provider: "WiskeyBridgeProvider", settings: Settings, descriptor: Descriptor, actor: w10.Actor, request_id: str | None, expires_at: float) -> None:
        self.provider = provider
        self.settings = settings
        self.descriptor = descriptor
        self.actor = actor
        self.request_id = request_id if _valid_request_id(request_id) else _rid()
        self.expires_at = expires_at
        self.ref: str | None = None
        self.link: Any = None
        self.pump: Any = None
        self._close_sent = False
        # WKF01F02-295 (F02, Mac delta `arx.station_talk_audio.v1`): the station's sound inside the SAME talk - `talk_open(listen=true)` when
        # WisKey's descriptor offers `signed_ws_pcmu_v1`; WisKey then sends `media/talk_audio` events (800-byte PCMU packets, sequence from 0)
        # on this talk's own signed connection. Newest wins: at most INCOMING_MAX packets wait, none older than INCOMING_MAX_AGE_S is served.
        self._listen = False
        self._receive_sequence = 0
        self._incoming: asyncio.Queue[tuple[float, bytes]] = asyncio.Queue(maxsize=self.INCOMING_MAX)
        self._opening_events: list[dict[str, Any]] = []
        self._closed: asyncio.Future[str] | None = None

    INCOMING_MAX = 3
    INCOMING_MAX_AGE_S = 0.3
    LISTEN_TRANSPORT = "signed_ws_pcmu_v1"
    LISTEN_REPLY = {"transport": "signed_ws_pcmu_v1", "schema": "arx.station_talk_audio.v1", "sample_rate": 8000, "channels": 1, "packet_bytes": 800}

    def _future(self) -> asyncio.Future[str]:
        if self._closed is None:
            self._closed = asyncio.get_running_loop().create_future()
        return self._closed

    def _end(self, reason: str) -> None:
        fut = self._closed
        if fut is not None and not fut.done():
            fut.set_result(reason)

    @property
    def listening(self) -> bool:
        """True once a talk opened WITH the station's sound (WisKey confirmed the listen block of `talk_open`)."""
        return self._listen and self.pump is not None

    @classmethod
    def _offers_listen(cls, raw: Any) -> bool:
        audio = raw.get("audio") if isinstance(raw, dict) else None
        transports = audio.get("listen_transports") if isinstance(audio, dict) else None
        return isinstance(transports, list) and cls.LISTEN_TRANSPORT in transports

    @property
    def dropped(self) -> int:
        return self.pump.dropped_frames if self.pump is not None else 0

    def _unavailable(self, reason: str) -> ApiError:
        return ApiError(503, "intercom_talk_upstream_unavailable", "העמדה לא פתחה ערוץ דיבור.", details={"reason": reason})

    async def _abandon(self, ref: str | None = None) -> None:
        """A failed open: if WisKey named a talk, close it (it holds the station lock); then drop the connection."""
        link = self.link
        if link is not None and ref is not None and not link.closed:
            try:
                await link.call(w10.TALK_CLOSE, w10.talk_close_params(ref, "ended"), timeout=self.CLOSE_TIMEOUT_S)
            except Exception as exc:  # noqa: BLE001 - nothing is retried
                log.info("station media: an unused talk was not confirmed closed (%s)", getattr(exc, "code", type(exc).__name__))
        if link is not None:
            self.link = None
            await link.close()

    async def open(self) -> None:
        self._future()
        d = self.descriptor
        try:
            self.link = await self.provider.media.connect(bridge.PURPOSE_TALK)
        except bridge.MediaBridgeError as exc:
            raise self._unavailable(w10.unavailable_reason(exc.code)) from None
        link = self.link
        link.set_event_handler(self._on_event)
        link.set_closed_handler(self._on_link_closed)
        opened_ref: str | None = None
        try:
            # the descriptor of THIS connection and actor (a handle is owned by the connection and the actor that read it)
            raw = await link.call(w10.DESCRIBE, w10.descriptor_params(d.station_id, self.actor, _rid()), timeout=self.OPEN_TIMEOUT_S)
            fresh = parse_descriptor(w10.project_descriptor(raw), station_id=d.station_id, provider=self.provider.name)
            if fresh.talk_transport is None:
                raise Unavailable("talk_not_offered")
            until = min(self.expires_at, fresh.expires_at, time.time() + fresh.max_talk_seconds)
            self._listen = self._offers_listen(raw)
            reply = await link.call(w10.TALK_OPEN, w10.talk_open_params(fresh.session, self.actor, self.request_id, _ts(until), listen=self._listen),
                                    timeout=self.OPEN_TIMEOUT_S)
            opened_ref = w10.talk_ref_of(reply)
            if self._listen and (not isinstance(reply, dict) or reply.get("listen") != self.LISTEN_REPLY):
                raise w10.ContractError("talk_listen_unavailable")
            if isinstance(reply, dict) and "listen" in reply:
                reply = {k: v for k, v in reply.items() if k != "listen"}
            opened = w10.parse_talk_open_v11(reply)
        except bridge.MediaBridgeError as exc:
            await self._abandon(opened_ref)
            if exc.code in w10.BUSY_CODES:  # the panel or another operator holds the station: who is never said
                raise ApiError(409, "intercom_talk_busy", "מישהו אחר כבר מדבר עם העמדה.", retryable=True) from None
            raise self._unavailable(w10.unavailable_reason(exc.code)) from None
        except (w10.ContractError, DescriptorError, Unavailable) as exc:
            log.warning("station media: a talk open refused (%s)", exc.code)
            await self._abandon(opened_ref)
            raise self._unavailable(exc.code) from None
        except BaseException:
            await self._abandon(opened_ref)
            raise
        self.ref = opened.talk_ref
        # Current WisKey retains the original signed talk deadline and origin.
        # Repeating floor is not caller activity; no synthetic heartbeat frames.
        options = dict(self.provider.pump_options)
        options["heartbeat_s"] = float("inf")
        self.pump = TalkPump(link, self.ref, on_end=self._end, **options)
        self.pump.start()
        pending, self._opening_events = self._opening_events, []
        for event in pending:  # events that arrived between WisKey's answer and the pump: handled now, in order
            self._on_event(event)

    def _on_event(self, event: dict[str, Any]) -> None:
        if self.pump is None:
            if len(self._opening_events) < self.INCOMING_MAX:
                self._opening_events.append(event)
            else:
                self._end("upstream_closed")
            return
        if self._listen and self.ref is not None:
            try:
                packet = w10.talk_audio_v1(event, self.ref, self._receive_sequence)
            except w10.ContractError:  # another talk's, out of sequence or malformed: the talk ends (nothing of it is kept)
                self.pump.fail("talk_audio_invalid")
                return
            if packet is not None:
                self._receive_sequence += 1
                if self._incoming.full():
                    self._incoming.get_nowait()  # newest wins: the oldest waiting packet goes
                self._incoming.put_nowait((time.monotonic(), packet))
                return
        hit = w10.talk_closed_v11(event)
        if hit is None or hit[0] != self.ref or self.pump is None:
            return
        log.info("station media: WisKey ended a talk (%s)", hit[1])
        self.pump.remote_closed(hit[1])

    def _on_link_closed(self) -> None:
        if self.pump is not None:
            self.pump.fail("connection_closed")
        else:
            self._end("upstream_closed")

    async def receive_audio(self) -> bytes:
        """The next packet of the station's sound (800 bytes PCMU). Raises `MediaBridgeError("connection_closed")` once the talk is over (its
        connection gone, closed or expired); a packet older than INCOMING_MAX_AGE_S is dropped, never served late."""
        while True:
            received, packet = await self._incoming.get()
            if self.link is None or self.link.closed or self._future().done() or time.time() >= self.expires_at:
                raise bridge.MediaBridgeError("connection_closed", "closed")
            if time.monotonic() - received <= self.INCOMING_MAX_AGE_S:
                return packet

    async def send_frame(self, frame: bytes) -> None:
        if self.pump is not None:
            self.pump.push(frame)

    async def floor(self, held: bool) -> None:
        if self.pump is not None:
            await self.pump.set_floor(held)

    async def wait_closed(self) -> str:
        return await self._future()

    async def close(self, reason: str) -> None:
        self._future()
        pump, link, ref = self.pump, self.link, self.ref
        if pump is not None:
            await pump.stop()  # the only sender is gone before the close goes out: one request at a time to the end
        if link is not None and ref is not None and not self._close_sent and not (pump is not None and pump.closed_by_wiskey) and not link.closed:
            self._close_sent = True
            try:
                w10.parse_close(await link.call(w10.TALK_CLOSE, w10.talk_close_params(ref, reason), timeout=self.CLOSE_TIMEOUT_S))
            except Exception as exc:  # noqa: BLE001 - `cleanup_failed` and an unanswered close are reported, never retried
                log.info("station media: talk close not confirmed (%s)", getattr(exc, "code", type(exc).__name__))
        if link is not None:
            self.link = None
            await link.close()
        while not self._incoming.empty():  # no sound outlives its talk
            self._incoming.get_nowait()
        self._opening_events.clear()
        self._end(reason)


class _DiscoveryOnly:
    """What the bridge provider keeps of the old feed transport: the read-only discovery list (`overview.api.commands`). It has no
    read / act / post - there is no way left to send a W10 command without a signature (WKDIRECT-295, S6)."""

    def __init__(self, discovery: Callable[[Settings], dict[str, Any] | None]) -> None:
        self._discovery = discovery

    def api(self, settings: Settings) -> dict[str, Any] | None:
        return self._discovery(settings)


class WiskeyBridgeProvider:
    """WisKey's W10 v1.1 over a `MediaTransport` (`AutoTransport`: the direct API, else the signed bridge over the Home Assistant
    WebSocket - both signed): video from ONE shared connection (the descriptor and the lease, both as the actor `Arx`), talk on a
    dedicated connection per talk (`WiskeyBridgeTalkChannel`, as the operator). Selected only by `access.station_media_provider = auto`
    while WisKey's discovery lists the six commands and the pairing key can sign (`provider_for`); a failed WisKey answer falls back to
    Arx's own source (REL2140 M-3). Implemented and tested on fakes; NOT run against a real WisKey."""

    name = "wiskey"
    cache = True  # one WisKey read per station until 30 s before the descriptor expires (MediaState.descriptor)
    # REL2140 review M-3: WisKey's reasons that do NOT fall back to Arx's own source (the station itself is offline - Arx's path
    # reaches the same station and would only hang); every other failure of WisKey's answer serves Arx's own stream when it exists
    NO_FALLBACK = frozenset({"offline"})

    def __init__(self, media: bridge.MediaTransport, *, discovery: Callable[[Settings], dict[str, Any] | None] | None = None,
                 video: bridge.VideoChannel | None = None, pump_options: dict[str, Any] | None = None) -> None:
        self.transport = _DiscoveryOnly(discovery or _feed_discovery)
        self.media = media
        self.video = video or bridge.VideoChannel(media)
        self.pump_options = dict(pump_options or {})

    def listed(self, settings: Settings) -> tuple[bool, bool]:
        video, talk, _why = w10.listed(self.transport.api(settings))
        return video, talk

    def describe(self, conn: Any, settings: Settings, station: dict[str, Any]) -> Descriptor:
        """WisKey's descriptor; when WisKey's commands disappear or its answer fails (any reason but `offline`), Arx's own source
        (`LocalProvider`) - the station keeps its video when the local path exists. If that fails too, WisKey's reason is served.
        A fallback descriptor names provider `local`, so the stream and the talk follow it and it is never cached as WisKey's."""
        try:
            return self._describe(conn, settings, station)
        except (Unavailable, DescriptorError) as exc:
            code = exc.code
            if code in self.NO_FALLBACK:
                raise
            try:
                d = _local.describe(conn, settings, station)
            except Exception:  # noqa: BLE001 - no local path either: WisKey's own reason stands
                raise exc from None
            log.info("station media: WisKey unavailable (%s), serving Arx's own source", code)
            return d

    def video_stream(self, conn: Any, settings: Settings, station: dict[str, Any], profile: str, *, actor: w10.Actor | None = None) -> str:
        sid = station["id"]
        try:
            d = MEDIA.descriptor(self, conn, settings, station)
        except Unavailable as exc:
            raise ApiError(503, "intercom_media_unavailable", "השידור מהעמדה אינו זמין כרגע.", details={"reason": exc.code}) from exc
        if d.provider == _local.name:  # REL2140 M-3: the descriptor is Arx's own (WisKey failed): so is the stream
            return _local.video_stream(conn, settings, station, profile, actor=actor)
        if d.profile(profile) is None:
            raise ApiError(409, "intercom_media_profile_unavailable", "האיכות הזו אינה זמינה לעמדה.")
        try:
            return self._leased_stream(settings, d, sid, profile, actor)
        except ApiError as exc:
            if exc.status != 503:
                raise
            try:  # REL2140 M-3: a lease WisKey could not give (or go2rtc refused): Arx's own main stream when that path exists
                name = _local.video_stream(conn, settings, station, "main", actor=actor)
            except Exception:  # noqa: BLE001 - no local path either: WisKey's own refusal stands
                raise exc from None
            log.info("station media: WisKey lease unavailable (%s), serving Arx's own source", (exc.details or {}).get("reason", exc.code))
            return name

    def _describe_raw(self, sid: str) -> dict[str, Any]:
        try:
            return w10.project_descriptor(self.video.describe(sid, w10.SYSTEM_ACTOR, _rid()))
        except bridge.MediaBridgeError as exc:
            raise Unavailable(w10.unavailable_reason(exc.code)) from None
        except w10.ContractError as exc:
            raise Unavailable(exc.code) from None

    def _describe(self, conn: Any, settings: Settings, station: dict[str, Any]) -> Descriptor:
        sid = station["id"]
        video, talk = self.listed(settings)
        if not video:
            raise Unavailable("not_listed")
        if not settings.go2rtc_url:  # the private source is relayed through Arx's own go2rtc
            raise Unavailable("no_media")
        raw = self._describe_raw(sid)
        if not talk and isinstance(raw.get("audio"), dict):
            raw = {**raw, "audio": {**raw["audio"], "talk_transports": []}}  # the talk commands are not all listed: talk stays in the classic panel
        return parse_descriptor(raw, station_id=sid, provider=self.name)

    def _leased_stream(self, settings: Settings, d: Descriptor, sid: str, profile: str, actor: w10.Actor | None) -> str:
        """The lease as the actor `Arx` on the shared connection (the video actor is never the operator). A descriptor that the shared
        connection no longer knows (it was reopened) answers `Unauthorized` / `session_expired`: ONE fresh descriptor is read and the lease
        asked once more - reads only; nothing else is retried."""
        if profile != w10.V11_PROFILE:
            raise ApiError(409, "intercom_media_profile_unavailable", "האיכות הזו אינה זמינה לעמדה.")
        session = d.session
        raw: Any = None
        for attempt in (0, 1):
            try:
                raw = self.video.lease(session, w10.SYSTEM_ACTOR, _rid())
                break
            except bridge.MediaBridgeError as exc:
                if attempt == 0 and exc.code in ("Unauthorized", "session_expired"):
                    MEDIA.forget(self.name, sid)
                    try:
                        session = parse_descriptor(self._describe_raw(sid), station_id=sid, provider=self.name).session
                    except (Unavailable, DescriptorError) as inner:
                        raise ApiError(503, "intercom_media_unavailable", "השידור מהעמדה אינו זמין כרגע.", details={"reason": inner.code}) from None
                    continue
                raise ApiError(503, "intercom_media_unavailable", "השידור מהעמדה אינו זמין כרגע.", details={"reason": w10.unavailable_reason(exc.code)}) from None
            except w10.ContractError as exc:
                raise ApiError(503, "intercom_media_unavailable", "השידור מהעמדה אינו זמין כרגע.", details={"reason": exc.code}) from None
        try:
            lease = w10.parse_lease_v11(raw)
        except w10.ContractError as exc:
            log.warning("station media: a stream lease refused (%s)", exc.code)  # the rule only, never the value
            raise ApiError(503, "intercom_media_unavailable", "השידור מהעמדה אינו זמין כרגע.", details={"reason": exc.code}) from None
        finally:
            raw = None  # the source lives on only inside the lease
        return _register_lease(settings, sid, profile, lease.source or "", lease.expires_at, owner=self.video)

    def talk_open(self, settings: Settings, station_id: str, descriptor: Descriptor, *, actor_id: str, actor_name: str, request_id: str | None,
                  expires_at: float | None = None) -> TalkChannel:
        if descriptor.provider == _local.name or not self.listed(settings)[1] or descriptor.talk_transport is None:
            raise ApiError(409, "intercom_talk_unsupported", "דיבור עם העמדה זמין בלוח הקלאסי בלבד.")
        until = expires_at if expires_at is not None else time.time() + min(descriptor.max_talk_seconds, TALK_MAX_DEFAULT_S)
        return WiskeyBridgeTalkChannel(self, settings, descriptor, w10.Actor(actor_id, actor_name), request_id, until)

    def listen_open(self, settings: Settings, station_id: str, descriptor: Descriptor, *, actor_id: str, actor_name: str, request_id: str | None,
                    expires_at: float | None = None) -> Any:
        """Listen through the original signed channel, without floor or uplink."""
        from .wiskey_listen_adapter import WiskeyDownlinkChannel

        until = expires_at if expires_at is not None else time.time() + min(descriptor.max_talk_seconds, TALK_MAX_DEFAULT_S)
        return WiskeyDownlinkChannel(self, settings, descriptor, actor_id=actor_id,
            actor_name=actor_name, request_id=request_id, expires_at=until)


class _CachedKey:
    """The pairing key for the signer: read from the settings database at most every `TTL_S` (a rotation is picked up within it); the
    event loop never waits on the database for each of the ten requests a second a talk makes."""

    TTL_S = 30.0

    def __init__(self, conn: Any) -> None:
        self._db = database_of(conn) if conn is not None else None
        self._at = 0.0
        self._key: Any = None

    def __call__(self) -> Any:
        if self._db is None:
            return None
        now = time.monotonic()
        if now - self._at >= self.TTL_S:
            from . import ha_bridge

            with self._db.connection(mode="read", label="w10 bridge key") as c:
                self._key = ha_bridge.signing_key(c)
            self._at = now
        return self._key

    def __repr__(self) -> str:
        return "_CachedKey()"


FAKE_ENV = "SW_FAKE_STATION_MEDIA"
_override: MediaProvider | None = None
_local = LocalProvider()
_bridge: WiskeyBridgeProvider | None = None
_bridge_for: tuple[int, int | None] | None = None
_fake_from_env: FakeProvider | None = None


def bridge_provider(settings: Settings, conn: Any) -> WiskeyBridgeProvider:
    """The one signed W10 provider of the process (built on first use; the transports read the pairing key through `conn`'s database).
    WKDIRECT-295: its transport is `AutoTransport` - WisKey's direct API (DIRECT_API_V1.md) when the key signs and the direct socket
    authenticates, else the existing signed bridge over the Home Assistant WebSocket (the service channel). Both sign every command."""
    global _bridge, _bridge_for
    marker = (id(settings), id(database_of(conn)) if conn is not None else None)
    if _bridge is None or _bridge_for != marker:
        if _bridge is not None:
            # WKF01F02-295 (Mac delta): the earlier provider's video owner is closed first - its leased streams and timers go with it. An
            # unconfirmed delete raises `media_cleanup_failed` here and the earlier provider stays: no replacement while that is unresolved.
            _bridge.video.close()
            _bridge = None
            _bridge_for = None
        key = _CachedKey(conn)
        signer = bridge.BridgeSigner(key)
        media = bridge.AutoTransport(bridge.DirectApiTransport(bridge.websocket_opener(settings), key),
                                     bridge.SignedBridgeTransport(bridge.ha_connector(settings), signer))
        _bridge = WiskeyBridgeProvider(media)
        _bridge.signing_ready = signer.ready  # type: ignore[attr-defined]
        _bridge_for = marker  # only once the new provider exists: a failed build never adopts the closed earlier owner
    return _bridge


def shutdown_bridge() -> bool:
    """WKF01F02-295 (Mac delta): the application shutdown closes the signed provider's video owner - its leased streams leave go2rtc and its
    timers are joined. Never raises. False (logged by rule only) when go2rtc did not confirm a delete: the provider and the exact record stay."""
    global _bridge, _bridge_for
    if _bridge is None:
        return True
    try:
        _bridge.video.close()
    except bridge.MediaBridgeError:
        log.warning("station media: leased stream cleanup at shutdown remains unresolved")
        return False
    except Exception as exc:  # noqa: BLE001 - shutdown goes on
        log.warning("station media: provider shutdown failed (%s)", type(exc).__name__)
        return False
    _bridge = None
    _bridge_for = None
    return True


def set_provider(provider: MediaProvider | None) -> None:
    """Tests: install a provider (None restores the default selection). Clears the descriptor cache."""
    global _override
    _override = provider
    MEDIA.reset()


PROVIDER_KEY = "access.station_media_provider"  # REL2140 review M-3: local (default) | auto - an Arx switch, never WisKey's discovery alone
PROVIDER_CHOICES = ("local", "auto")


def provider_choice(conn: Any) -> str:
    """The installation's choice; `local` when unknown (no connection, an older database, a stored value this build does not know)."""
    if conn is None:
        return "local"
    try:
        value = get_setting(conn, PROVIDER_KEY, "local") or "local"
    except Exception:  # noqa: BLE001 - an older database without the settings row keeps Arx's own source
        return "local"
    return value if value in PROVIDER_CHOICES else "local"


def provider_for(settings: Settings, conn: Any = None) -> MediaProvider:
    """A test's provider; else the fake on a developer backend that asked for it (never in the add-on); else - only when the
    installation chose `access.station_media_provider = auto` (REL2140 review M-3; default `local`) - WisKey's signed W10 provider while
    WisKey's discovery (`overview.api.commands`) lists its video commands AND the pairing key can sign (WKDIRECT-295: no unsigned path
    exists any more), which itself falls back to Arx's own source when WisKey's answer fails; else Arx's own source, exactly as before
    W10. A WisKey upgrade alone never changes Arx's live path."""
    global _fake_from_env
    if _override is not None:
        return _override
    if os.environ.get(FAKE_ENV) == "1" and not settings.in_addon:
        if _fake_from_env is None:
            _fake_from_env = FakeProvider()
        return _fake_from_env
    if provider_choice(conn) != "auto":
        return _local
    try:
        video, _talk, _why = w10.listed(_feed_discovery(settings))
    except Exception:  # noqa: BLE001 - an unreadable discovery keeps Arx's own source
        video = False
    if not video:
        return _local
    try:
        chosen = bridge_provider(settings, conn)
    except bridge.MediaBridgeError as exc:  # WKF01F02-295: the earlier provider's cleanup is unresolved - Arx's own source meanwhile
        log.warning("station media: signed provider not replaced (%s)", exc.code)
        return _local
    # WKDIRECT-295 (S6): `auto` requires the signed path - no pairing key that can sign (absent, unreadable, rotated) is Arx's own source
    ready = getattr(chosen, "signing_ready", None)
    try:
        signed = bool(ready()) if ready is not None else True
    except Exception:  # noqa: BLE001
        signed = False
    return chosen if signed else _local


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
        # REL2140 M-3: a fallback descriptor (Arx's own, handed out by WisKey's provider) is never served from the cache, so WisKey is
        # asked again on the next read - exactly LocalProvider's own `cache = False`
        if d is not None and not fresh and getattr(provider, "cache", True) and d.provider == provider.name and d.expires_at - 30 > now:
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

    def forget(self, provider_name: str, station_id: str) -> None:
        """Drops a cached descriptor (its WisKey session is gone: the next read asks WisKey again)."""
        with self._lock:
            self._descriptors.pop((provider_name, station_id), None)

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


def new_talk(station_id: str, user_id: str, username: str, request_id: str | None, d: Descriptor, *, limit_s: int | None = None) -> TalkSession:
    now = time.time()
    seconds = limit_s if limit_s is not None else min(d.max_talk_seconds, MAX_TALK_S)
    return TalkSession(id=secrets.token_urlsafe(24), station_id=station_id, user_id=user_id, username=username, request_id=request_id,
                       transport=d.talk_transport or "", codec=d.audio_codec, duplex=d.duplex, created_at=now,
                       expires_at=now + seconds)


def iso(epoch: float) -> str:
    return _ts(epoch)
