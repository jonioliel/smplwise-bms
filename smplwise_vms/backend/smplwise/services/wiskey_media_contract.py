"""AVW10-295: WisKey's W10 station-media contract (`arx.station_media.v1`) - THE ONE adapter layer for its wire names.

Everything WisKey names on the wire for station media lives in this file and nowhere else: the six command names, the request
keys Arx sends, the reply keys Arx reads, the event of a talk WisKey ended, and the mapping of WisKey's error codes. WisKey may
still rename fields (owner directive 2026-10-23: WisKey grants Arx full access through our bridge only, and may adjust field
names), so a rename is a change to the tables below and to the fixtures of tests/test_wiskey_media_contract.py - the provider
(services/intercom_media.py `WiskeyProvider`), the endpoints and the screens do not change.

The contract text is docs/changes/CR-036-S18-MEDIA.md section 3 (W10). Until WisKey ships its own contract package with these
commands, the request schemas Arx holds them to are Arx's PROPOSAL (docs/integrations/wiskey/catalog/w10-proposal), not an
extraction of WisKey's registry: the frames are checked against what Arx asked for, nothing more.

Rules kept here (CLAUDE.md, AGENTS.md security, CR-036 S18 2.1):
- a reply is untrusted input: every reader is total (a wrong shape is a `ContractError` with a rule code, never a guess), and an
  error never carries the offending value;
- the stream lease's `source` is the one secret of the contract: it is held in a `StreamLease` whose repr hides it, it is
  returned to the caller that registers it in Arx's own go2rtc and nothing else - never logged, audited, cached on disk or served;
- a `go2rtc_stream` alternative is accepted only inside Arx's own `smplwise_wiskey_` namespace (only `smplwise_` streams belong to
  this product; a stream of another project is never named);
- frames are base64 of one G.711 frame, numbered by `seq`; nothing here keeps audio.
"""
from __future__ import annotations

import base64
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from . import intercom_client

DOMAIN = intercom_client.DOMAIN
API_CONTRACT = intercom_client.API_CONTRACT

# ---------------------------------------------------------------- the wire names (rename here, and only here)

# Arx's logical call -> WisKey's command (under `hikvision_intercom/`)
DESCRIBE = "media/station_descriptor"
STREAM_LEASE = "media/stream_lease"
TALK_OPEN = "media/talk_open"
TALK_FRAME = "media/talk_frame"
TALK_FLOOR = "media/talk_floor"
TALK_CLOSE = "media/talk_close"
VIDEO_COMMANDS = (DESCRIBE, STREAM_LEASE)
TALK_COMMANDS = (TALK_OPEN, TALK_FRAME, TALK_FLOOR, TALK_CLOSE)
COMMANDS = VIDEO_COMMANDS + TALK_COMMANDS
# the commands WisKey's security guard would treat as READ (no `api_contract`); the lease hands out a source, so it is not one
READ_COMMANDS = frozenset({DESCRIBE})

# the event WisKey sends on Arx's `subscribe` when it ends a talk itself (the panel took the station, the station dropped, its limit)
EVENT_TALK_CLOSED = "media/talk_closed"
EVENT_KIND_KEYS = ("kind", "type")  # WisKey's subscription events carry `kind`; `type` is accepted for the same name

# request keys
K_STATION = "station_id"
K_ACTOR = "actor"
K_ACTOR_ID = "id"
K_ACTOR_NAME = "display_name"
K_REQUEST = "request_id"
K_SESSION = "session"
K_PROFILE = "profile"
K_EXPIRES = "expires_at"
K_TALK_REF = "talk_ref"
K_SEQ = "seq"
K_DATA = "data"
K_HELD = "held"
K_REASON = "reason"
K_API = "api_contract"

# reply keys
R_SOURCE = "source"
R_STREAM = "go2rtc_stream"
R_EXPIRES = "expires_at"
R_TALK_REF = "talk_ref"
R_CODEC = "codec"
R_FRAME_MS = "frame_ms"
# the descriptor's own keys (WisKey name -> the name `intercom_media.parse_descriptor` reads). Identity today; a WisKey rename
# of a descriptor field is one entry here (nested: "video.profiles" style paths are not needed yet - add a path map if they move).
DESCRIPTOR_KEYS: dict[str, str] = {
    "schema": "schema", "station_id": "station_id", "session": "session", "revision": "revision", "issued_at": "issued_at",
    "expires_at": "expires_at", "video": "video", "audio": "audio", "limits": "limits",
}

# Arx's close reasons as WisKey knows them (section 3.3); Arx's other outcomes are sent as the nearest one
CLOSE_REASONS = ("stopped", "ended", "expired", "access_lost", "upstream_closed")
_CLOSE_MAP = {"upstream_unavailable": "upstream_closed", "never_connected": "ended"}

# WisKey's error codes -> Arx's `Unavailable` reasons of the media read (served as `reason`; never WisKey's text)
ERRORS: dict[str, str] = {
    "station_not_found": "not_found",
    "intercom_station_not_found": "not_found",  # the feed's own mapping of `station_not_found` (REQUEST_ERRORS) on the read lane
    "station_offline": "offline",
    "media_not_supported": "no_media",
    "rate_limited": "rate_limited",
    "unauthorized": "provider_forbidden",
    "unknown_command": "no_media",
    "api_incompatible": "provider_error",
}
BUSY_CODES = frozenset({"audio_busy"})

HANDLE_RE = re.compile(r"^[A-Za-z0-9_-]{16,128}$")
STREAM_NS = "smplwise_wiskey_"
STREAM_RE = re.compile(r"^smplwise_wiskey_[A-Za-z0-9_.-]{1,96}$")
SOURCE_RE = re.compile(r"^rtsps?://[^\s]{1,2040}$", re.IGNORECASE)
MAX_LEASE_S = 24 * 3600
FRAME_MS = 20
FRAME_CODECS = ("pcmu", "pcma")


class ContractError(ValueError):
    """A WisKey reply Arx will not use. `code` names the rule (safe to log and serve); the value never appears."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Actor:
    id: str
    display_name: str

    def wire(self) -> dict[str, str]:
        return {K_ACTOR_ID: self.id[:128], K_ACTOR_NAME: self.display_name[:128]}


# the identity of a read that is cached for every viewer of a station (the descriptor): Arx itself, never the first caller
SYSTEM_ACTOR = Actor("arx", "Arx")


@dataclass(frozen=True)
class StreamLease:
    """A profile's source for Arx's own go2rtc (`source`) or a stream name in Arx's namespace (`stream`), until `expires_at`.
    `source` never appears in a repr, a log line or an exception."""

    expires_at: float
    source: str | None = field(default=None, repr=False)
    stream: str | None = None

    def __repr__(self) -> str:  # belt and braces: the dataclass repr already omits `source`
        return f"StreamLease(stream={self.stream!r}, has_source={self.source is not None}, expires_at={self.expires_at})"


@dataclass(frozen=True)
class TalkOpened:
    talk_ref: str = field(repr=False)
    codec: str
    frame_ms: int


# ---------------------------------------------------------------- discovery

def listed(api: dict[str, Any] | None) -> tuple[bool, bool, str | None]:
    """(video, talk, reason) from WisKey's discovery (`overview.api.commands`, intercom_sync.api_facts): video needs the
    descriptor and the lease listed, talk all four talk commands as well. No discovery, an incompatible contract or a list
    that is not a list: neither (the classic panel and Arx's own source keep everything, exactly as before)."""
    if not isinstance(api, dict):
        return False, False, "discovery_unknown"
    min_client = api.get("min_client")
    if isinstance(min_client, int) and not isinstance(min_client, bool) and min_client > API_CONTRACT:
        return False, False, "api_incompatible"
    commands = api.get("commands")
    if not isinstance(commands, list):
        return False, False, "commands_unknown"
    names = {c for c in commands if isinstance(c, str)}
    names |= {c[len(DOMAIN) + 1:] for c in names if c.startswith(DOMAIN + "/")}
    video = all(c in names for c in VIDEO_COMMANDS)
    talk = video and all(c in names for c in TALK_COMMANDS)
    return video, talk, None if video else "not_listed"


# ---------------------------------------------------------------- the frames Arx sends

def _type(command: str) -> str:
    return intercom_client.command_type(command)


def _api(command: str) -> dict[str, Any]:
    return {} if command in READ_COMMANDS else {K_API: API_CONTRACT}


async def station_descriptor(call: intercom_client.Call, station_id: str, actor: Actor, request_id: str) -> Any:
    frame = await call(_type(DESCRIBE), **{K_STATION: station_id, K_ACTOR: actor.wire(), K_REQUEST: request_id}, **_api(DESCRIBE))
    return intercom_client._result(frame, DESCRIBE)


async def stream_lease(call: intercom_client.Call, session: str, profile: str, actor: Actor, request_id: str) -> Any:
    frame = await call(_type(STREAM_LEASE), **{K_SESSION: session, K_PROFILE: profile, K_ACTOR: actor.wire(), K_REQUEST: request_id}, **_api(STREAM_LEASE))
    return intercom_client._result(frame, STREAM_LEASE)


async def talk_open(call: intercom_client.Call, session: str, actor: Actor, request_id: str, expires_at: str) -> Any:
    frame = await call(_type(TALK_OPEN), **{K_SESSION: session, K_ACTOR: actor.wire(), K_REQUEST: request_id, K_EXPIRES: expires_at}, **_api(TALK_OPEN))
    return intercom_client._result(frame, TALK_OPEN)


async def talk_frame(call: intercom_client.Call, talk_ref: str, seq: int, data: bytes) -> Any:
    frame = await call(_type(TALK_FRAME), **{K_TALK_REF: talk_ref, K_SEQ: seq, K_DATA: base64.b64encode(data).decode("ascii")}, **_api(TALK_FRAME))
    return intercom_client._result(frame, TALK_FRAME)


async def talk_floor(call: intercom_client.Call, talk_ref: str, held: bool) -> Any:
    frame = await call(_type(TALK_FLOOR), **{K_TALK_REF: talk_ref, K_HELD: bool(held)}, **_api(TALK_FLOOR))
    return intercom_client._result(frame, TALK_FLOOR)


async def talk_close(call: intercom_client.Call, talk_ref: str, reason: str) -> Any:
    frame = await call(_type(TALK_CLOSE), **{K_TALK_REF: talk_ref, K_REASON: close_reason(reason)}, **_api(TALK_CLOSE))
    return intercom_client._result(frame, TALK_CLOSE)


def close_reason(outcome: str) -> str:
    """Arx's session outcome as one of the reasons WisKey's `talk_close` knows."""
    reason = _CLOSE_MAP.get(outcome, outcome)
    return reason if reason in CLOSE_REASONS else "ended"


# ---------------------------------------------------------------- the replies Arx reads

def _when(value: Any, code: str) -> float:
    if not isinstance(value, str) or len(value) > 40:
        raise ContractError(code)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ContractError(code) from exc
    if parsed.tzinfo is None:
        raise ContractError(code)
    return parsed.timestamp()


def project_descriptor(raw: Any) -> dict[str, Any]:
    """`station_descriptor`'s answer -> the descriptor in the names `intercom_media.parse_descriptor` reads (which then enforces
    the contract: schema, station, handle, expiry, no address, no secret). Keys this table does not know are passed through
    unchanged so that `parse_descriptor`'s scan still sees - and refuses - a secret WisKey put under a new name."""
    if not isinstance(raw, dict):
        raise ContractError("descriptor_not_an_object")
    return {DESCRIPTOR_KEYS.get(k, k): v for k, v in raw.items()}


def parse_lease(raw: Any, *, now: float | None = None) -> StreamLease:
    """`stream_lease`'s answer: `{source, expires_at}` (an RTSP source for Arx's own go2rtc) or `{go2rtc_stream}` (a stream in
    Arx's namespace). Anything else - both, neither, a source that is not RTSP, a stream outside `smplwise_wiskey_`, an expiry in
    the past or more than 24 h ahead - is refused with a rule code."""
    now = time.time() if now is None else now
    if not isinstance(raw, dict):
        raise ContractError("lease_not_an_object")
    source, stream = raw.get(R_SOURCE), raw.get(R_STREAM)
    if (source is None) == (stream is None):
        raise ContractError("lease_ambiguous")
    expires = now + 600.0
    if raw.get(R_EXPIRES) is not None or source is not None:
        expires = _when(raw.get(R_EXPIRES), "lease_expires_at_invalid")
        if expires <= now:
            raise ContractError("lease_expired")
        if expires - now > MAX_LEASE_S:
            raise ContractError("lease_lifetime_too_long")
    if source is not None:
        if not isinstance(source, str) or not SOURCE_RE.fullmatch(source) or any(ord(ch) < 33 for ch in source):
            raise ContractError("lease_source_invalid")
        return StreamLease(expires_at=expires, source=source)
    if not isinstance(stream, str) or not STREAM_RE.fullmatch(stream):
        raise ContractError("lease_stream_foreign")  # only Arx's own namespace is ever named
    return StreamLease(expires_at=expires, stream=stream)


def project_lease(raw: Any) -> StreamLease:
    """The feed's projection of `stream_lease` (intercom_sync `command(..., project=)`): the lease object itself."""
    return parse_lease(raw)


def parse_talk_open(raw: Any) -> TalkOpened:
    if not isinstance(raw, dict):
        raise ContractError("talk_open_not_an_object")
    ref = raw.get(R_TALK_REF)
    if not isinstance(ref, str) or not HANDLE_RE.fullmatch(ref):
        raise ContractError("talk_ref_invalid")
    codec = raw.get(R_CODEC)
    if codec not in FRAME_CODECS:
        raise ContractError("talk_codec_unsupported")
    frame_ms = raw.get(R_FRAME_MS, FRAME_MS)
    if isinstance(frame_ms, bool) or frame_ms != FRAME_MS:
        raise ContractError("talk_frame_ms_unsupported")
    return TalkOpened(talk_ref=ref, codec=codec, frame_ms=FRAME_MS)


def project_talk_open(raw: Any) -> TalkOpened:
    """The feed's projection of `talk_open`: the opened talk itself."""
    return parse_talk_open(raw)


def talk_closed(event: Any) -> tuple[str, str] | None:
    """(talk_ref, reason) when `event` is WisKey's `media/talk_closed`, else None. The reason is reduced to a short code."""
    if not isinstance(event, dict) or not any(event.get(k) == EVENT_TALK_CLOSED for k in EVENT_KIND_KEYS):
        return None
    data = event.get("data") if isinstance(event.get("data"), dict) else event
    ref = data.get(K_TALK_REF)
    if not isinstance(ref, str) or not HANDLE_RE.fullmatch(ref):
        return None
    reason = data.get(K_REASON)
    reason = reason if isinstance(reason, str) and re.fullmatch(r"[a-z_]{1,40}", reason) else "upstream_closed"
    return ref, reason


def unavailable_reason(code: Any) -> str:
    """WisKey's (or the feed's) error code -> the media read's `reason`."""
    return ERRORS.get(str(code or ""), "provider_error")
