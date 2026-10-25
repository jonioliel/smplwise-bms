"""AVW10-295: WisKey's W10 station-media contract (`arx.station_media.v1`) - THE ONE adapter layer for its wire names.

Everything WisKey names on the wire for station media lives in this file and nowhere else: the six command names, the request
keys Arx sends, the reply keys Arx reads, the event of a talk WisKey ended, and the mapping of WisKey's error codes. WisKey may
still rename fields (owner directive 2026-10-23: WisKey grants Arx full access through our bridge only, and may adjust field
names), so a rename is a change to the tables below and to the fixtures of tests/test_wiskey_media_v11.py - the provider
(services/intercom_media.py `WiskeyBridgeProvider`), the endpoints and the screens do not change.

The contract text is docs/changes/CR-036-S18-MEDIA.md section 3 (W10). Until WisKey ships its own contract package with these
commands, the request schemas Arx holds them to are Arx's PROPOSAL (docs/integrations/wiskey/catalog/w10-proposal), not an
extraction of WisKey's registry: the frames are checked against what Arx asked for, nothing more.

W10CLIENT-295 (contract v1.1, owner 24.10): the section "contract v1.1" at the end of this file is the signed-bridge shape of the
same six commands as WisKey registered them (tests/fixtures/wiskey_w10/w10_parameters_schemas.json is derived from the fixture
W10_REGISTRATION_AND_SCHEMAS.json of WisKey's pinned source): closed parameter objects, NO `api_contract`, a batch of 5 or 10
frames per `talk_frame`, the sequence from 0, one profile `main`. WKDIRECT-295 closed S6: the unsigned flat-frame senders of the
feed path are gone; the v1 readers above stay only where the signed provider still reads with them (discovery, close reasons).

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
    # contract v1.1 (W10CLIENT-295): the signed bridge's own codes, exactly as WisKey spells them (`Unauthorized` is capitalised there)
    "Unauthorized": "provider_forbidden",
    "invalid_fields": "provider_error",
    "source_changed": "provider_error",
    "session_expired": "provider_error",
    "sequence_invalid": "provider_error",
    "floor_not_held": "provider_error",
    "cleanup_failed": "provider_error",
    "media_outcome_unknown": "provider_error",
    "bridge_command_capacity": "rate_limited",
    "bridge_command_replayed": "provider_error",
    "bridge_not_paired": "provider_forbidden",
    "bridge_key_rotated": "provider_forbidden",
    "connection_closed": "provider_error",
    # WKDIRECT-295: the direct API's own failures (DIRECT_API_V1.md) - an Arx-side reading of the socket, never WisKey's text
    "reply_unauthenticated": "provider_forbidden",
    "direct_identity_invalid": "provider_forbidden",
    "direct_connect_refused": "provider_forbidden",
    "direct_hello_invalid": "provider_error",
    "direct_hello_timeout": "provider_error",
    "direct_connect_timeout": "provider_error",
    "direct_connect_failed": "provider_error",
    "direct_unreachable": "provider_error",
    "direct_output_capacity": "rate_limited",
    "direct_connection_capacity": "rate_limited",
    "connection_exhausted": "provider_error",
    "bridge_outcome_unknown": "provider_error",
    "command_unavailable": "no_media",
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

# WKDIRECT-295 (S6): the unsigned flat-frame senders of AVW10-295 (`station_descriptor(call, ...)`, `stream_lease`, `talk_open`,
# `talk_frame`, `talk_floor`, `talk_close` on the feed's `call`) are REMOVED: every W10 command now leaves only as a signed `bridge`
# envelope built from the v1.1 parameter builders below (services/wiskey_media_bridge.py), on the direct API or the signed HA path.


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


def project_object(raw: Any) -> dict[str, Any]:
    """The feed's projection of `stream_lease` / `talk_open` (intercom_sync `command(..., project=)`): the answer object as it came.
    The contract readers (`parse_lease`, `parse_talk_open`) run in the provider, so a refusal keeps its rule code - and a talk
    WisKey opened but Arx cannot use is still closed by its `talk_ref`."""
    if not isinstance(raw, dict):
        raise ContractError("reply_not_an_object")
    return dict(raw)


def talk_ref_of(raw: Any) -> str | None:
    """The `talk_ref` of a `talk_open` answer when it is a well-formed handle (to close a talk Arx refuses to use), else None."""
    ref = raw.get(R_TALK_REF) if isinstance(raw, dict) else None
    return ref if isinstance(ref, str) and HANDLE_RE.fullmatch(ref) else None


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


# ================================================================ contract v1.1 (W10CLIENT-295): the signed bridge shape
#
# Everything below is pure (no I/O): the closed `bridge.parameters` of the six commands, built and checked BEFORE signing, and
# the readers of the six answers. WisKey's own validators are strict (`additionalProperties: false`, exact key sets, a batch of
# exactly 5 or 10 frames), so a request that would be refused is refused here first and never signed.

SCHEMA_V11 = "arx.station_media.v1.1"
V11_PROFILE = "main"
V11_VIDEO_TRANSPORT = "private_rtsp_source"  # a private RTSP source Arx's own go2rtc pulls; Arx serves it to browsers as mse / webrtc
V11_TALK_TRANSPORT = "signed_ws_batch_v1"  # talk frames in signed batches over a dedicated bridge connection
V11_CODEC = "pcmu"
BATCH_FRAMES = 5  # Arx's batch size (100 ms): 10 leaves no rate-credit margin on WisKey's side (see the change note)
BATCH_SIZES = (5, 10)
FRAME_BYTES = 160  # 20 ms of G.711 at 8 kHz
FRAME_B64_CHARS = 216
MAX_SEQ = 2**53 - 1
SILENCE_PCMU = b"\xff" * FRAME_BYTES  # mu-law digital silence (0xFF is +0 in G.711 mu-law)
LEASE_MAX_AHEAD_S = 15.0
LEASE_CLOCK_SLACK_S = 15.0  # WisKey's clock against ours: a lease named a little later than its 15 s is not refused for that
V11_CLOSE_REASONS = CLOSE_REASONS  # the caller's enum of talk_close
V11_EVENT_REASONS = ("stopped", "ended", "expired", "access_lost", "upstream_closed", "idle_timeout", "source_changed")

_TEXT_RE = re.compile(r"^[^\x00-\x1f\x7f]+$")
_PARAM_KEYS: dict[str, frozenset[str]] = {
    DESCRIBE: frozenset({K_STATION, K_ACTOR, K_REQUEST}),
    STREAM_LEASE: frozenset({K_SESSION, K_PROFILE, K_ACTOR, K_REQUEST}),
    TALK_OPEN: frozenset({K_SESSION, K_ACTOR, K_REQUEST, K_EXPIRES}),
    TALK_FRAME: frozenset({K_TALK_REF, "frames"}),
    TALK_FLOOR: frozenset({K_TALK_REF, K_HELD}),
    TALK_CLOSE: frozenset({K_TALK_REF, K_REASON}),
}


def _text(value: Any, maximum: int, code: str) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= maximum or _TEXT_RE.fullmatch(value) is None:
        raise ContractError(code)
    return value


def actor_wire(actor: Actor) -> dict[str, str]:
    """The `actor` object of the closed schema: `id` (1..128, no control characters) and `display_name` (up to 256)."""
    return {K_ACTOR_ID: _text(actor.id[:128], 128, "actor_id_invalid"), K_ACTOR_NAME: actor.display_name[:256]}


def _handle(value: Any, code: str) -> str:
    if not isinstance(value, str) or not HANDLE_RE.fullmatch(value):
        raise ContractError(code)
    return value


def descriptor_params(station_id: str, actor: Actor, request_id: str) -> dict[str, Any]:
    return {K_STATION: _text(station_id, 128, "station_id_invalid"), K_ACTOR: actor_wire(actor), K_REQUEST: _text(request_id, 128, "request_id_invalid")}


def lease_params(session: str, actor: Actor, request_id: str) -> dict[str, Any]:
    """The profile is always `main` (the only profile of v1.1)."""
    return {K_SESSION: _handle(session, "session_invalid"), K_PROFILE: V11_PROFILE, K_ACTOR: actor_wire(actor), K_REQUEST: _text(request_id, 128, "request_id_invalid")}


def talk_open_params(session: str, actor: Actor, request_id: str, expires_at: str, *, listen: bool = False) -> dict[str, Any]:
    _when(expires_at, "expires_at_invalid")
    if type(listen) is not bool:
        raise ContractError("listen_invalid")
    result = {K_SESSION: _handle(session, "session_invalid"), K_ACTOR: actor_wire(actor), K_REQUEST: _text(request_id, 128, "request_id_invalid"), K_EXPIRES: expires_at}
    if listen:
        result["listen"] = True
    return result


def talk_frame_params(talk_ref: str, first_seq: int, frames: "list[bytes] | tuple[bytes, ...]") -> dict[str, Any]:
    """One batch: 5 or 10 frames of exactly 160 bytes, `seq` consecutive from `first_seq`; `data` is the base64 of one frame (216 chars)."""
    if len(frames) not in BATCH_SIZES:
        raise ContractError("batch_size_invalid")
    if isinstance(first_seq, bool) or not isinstance(first_seq, int) or not 0 <= first_seq <= MAX_SEQ - len(frames):
        raise ContractError("seq_invalid")
    out: list[dict[str, Any]] = []
    for index, frame in enumerate(frames):
        if not isinstance(frame, (bytes, bytearray)) or len(frame) != FRAME_BYTES:
            raise ContractError("frame_size_invalid")
        out.append({K_SEQ: first_seq + index, K_DATA: base64.b64encode(bytes(frame)).decode("ascii")})
    return {K_TALK_REF: _handle(talk_ref, "talk_ref_invalid"), "frames": out}


def talk_floor_params(talk_ref: str, held: bool) -> dict[str, Any]:
    return {K_TALK_REF: _handle(talk_ref, "talk_ref_invalid"), K_HELD: bool(held)}


def talk_close_params(talk_ref: str, reason: str) -> dict[str, Any]:
    return {K_TALK_REF: _handle(talk_ref, "talk_ref_invalid"), K_REASON: close_reason(reason)}


def _actor_pair(actor: Any) -> tuple[str, str]:
    if (not isinstance(actor, dict) or set(actor) != {K_ACTOR_ID, K_ACTOR_NAME} or not isinstance(actor[K_ACTOR_NAME], str)
            or len(actor[K_ACTOR_NAME]) > 256):
        raise ContractError("actor_invalid")
    return _text(actor[K_ACTOR_ID], 128, "actor_id_invalid"), actor[K_ACTOR_NAME]


def validate_parameters(command: str, parameters: Any) -> None:
    """The last check before a request is signed: the exact key set of the command, the shapes of its fields, nothing else. Raises
    `ContractError` (a rule code; never the value). Strict on purpose: WisKey refuses any other shape, and a signed request spends
    one of its single-use nonces whether or not it is accepted."""
    keys = _PARAM_KEYS.get(command)
    actual = set(parameters) if isinstance(parameters, dict) else None
    if command == TALK_OPEN and actual is not None and "listen" in actual:
        if type(parameters["listen"]) is not bool:
            raise ContractError("listen_invalid")
        actual = actual - {"listen"}
    if keys is None or actual != keys:
        raise ContractError("parameters_keys")
    if command == DESCRIBE:
        descriptor_params(parameters[K_STATION], Actor(*_actor_pair(parameters[K_ACTOR])), parameters[K_REQUEST])
    elif command == STREAM_LEASE:
        if parameters[K_PROFILE] != V11_PROFILE:
            raise ContractError("profile_invalid")
        lease_params(parameters[K_SESSION], Actor(*_actor_pair(parameters[K_ACTOR])), parameters[K_REQUEST])
    elif command == TALK_OPEN:
        talk_open_params(parameters[K_SESSION], Actor(*_actor_pair(parameters[K_ACTOR])), parameters[K_REQUEST], parameters[K_EXPIRES])
    elif command == TALK_FRAME:
        frames = parameters["frames"]
        if not isinstance(frames, list) or len(frames) not in BATCH_SIZES:
            raise ContractError("batch_size_invalid")
        first = frames[0].get(K_SEQ) if isinstance(frames[0], dict) else None
        if isinstance(first, bool) or not isinstance(first, int):
            raise ContractError("seq_invalid")
        decoded: list[bytes] = []
        for index, item in enumerate(frames):
            if not isinstance(item, dict) or set(item) != {K_SEQ, K_DATA} or isinstance(item[K_SEQ], bool) or item[K_SEQ] != first + index:
                raise ContractError("seq_invalid")
            data = item[K_DATA]
            if not isinstance(data, str) or len(data) != FRAME_B64_CHARS:
                raise ContractError("frame_size_invalid")
            try:
                raw = base64.b64decode(data, validate=True)
            except ValueError:
                raise ContractError("frame_size_invalid") from None
            if len(raw) != FRAME_BYTES or base64.b64encode(raw).decode("ascii") != data:
                raise ContractError("frame_size_invalid")
            decoded.append(raw)
        talk_frame_params(parameters[K_TALK_REF], first, decoded)
    elif command == TALK_FLOOR:
        if not isinstance(parameters[K_HELD], bool):
            raise ContractError("held_invalid")
        _handle(parameters[K_TALK_REF], "talk_ref_invalid")
    elif command == TALK_CLOSE:
        if parameters[K_REASON] not in V11_CLOSE_REASONS:
            raise ContractError("reason_invalid")
        _handle(parameters[K_TALK_REF], "talk_ref_invalid")


# ---------------------------------------------------------------- the answers (v1.1)

@dataclass(frozen=True)
class FrameAck:
    next_seq: int
    accepted_frames: int


def _int(value: Any, code: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= MAX_SEQ:
        raise ContractError(code)
    return value


def parse_frame_ack(raw: Any, *, first_seq: int, count: int) -> FrameAck:
    """`talk_frame`'s answer `{next_seq, accepted_frames, retry_permitted}`: all of the batch accepted, the sequence advanced by exactly
    the batch, never a retry offer. Anything else ends the talk (a partly accepted or doubtful batch is never replayed)."""
    if not isinstance(raw, dict) or set(raw) != {"next_seq", "accepted_frames", "retry_permitted"}:
        raise ContractError("frame_ack_shape")
    if raw["retry_permitted"] is not False:
        raise ContractError("frame_ack_retry")
    accepted, nxt = _int(raw["accepted_frames"], "frame_ack_shape"), _int(raw["next_seq"], "frame_ack_shape")
    if accepted != count or nxt != first_seq + count:
        raise ContractError("frame_ack_mismatch")
    return FrameAck(next_seq=nxt, accepted_frames=accepted)


def parse_floor(raw: Any, *, held: bool) -> int:
    """`talk_floor`'s answer `{held, next_seq}`: the floor as asked; returns WisKey's next sequence number."""
    if not isinstance(raw, dict) or set(raw) != {"held", "next_seq"} or raw["held"] is not held:
        raise ContractError("floor_ack_shape")
    return _int(raw["next_seq"], "floor_ack_shape")


def parse_close(raw: Any) -> None:
    """`talk_close`'s answer `{state: "closed", cleanup_joined: true, no_effect: null}`; any other state is not a clean close."""
    if (not isinstance(raw, dict) or raw.get("state") != "closed" or raw.get("cleanup_joined") is not True
            or raw.get("no_effect") is not None):
        raise ContractError("close_not_clean")


def parse_talk_open_v11(raw: Any) -> TalkOpened:
    """`talk_open`'s answer `{talk_ref, codec: "pcmu", frame_ms: 20}`; v1.1 carries exactly PCMU (the only codec the pump sends)."""
    if not isinstance(raw, dict):
        raise ContractError("talk_open_not_an_object")
    ref = raw.get(R_TALK_REF)
    if not isinstance(ref, str) or not HANDLE_RE.fullmatch(ref):
        raise ContractError("talk_ref_invalid")
    if raw.get(R_CODEC) != V11_CODEC:
        raise ContractError("talk_codec_unsupported")
    if isinstance(raw.get(R_FRAME_MS), bool) or raw.get(R_FRAME_MS) != FRAME_MS:
        raise ContractError("talk_frame_ms_unsupported")
    return TalkOpened(talk_ref=ref, codec=V11_CODEC, frame_ms=FRAME_MS)


def parse_lease_v11(raw: Any, *, now: float | None = None) -> StreamLease:
    """`stream_lease`'s answer `{source, expires_at}`: a private RTSP source for Arx's own go2rtc, valid for at most 15 s (plus a clock
    allowance). There is no `go2rtc_stream` alternative in v1.1. `source` is the one secret: never in a message, a log or a repr."""
    now = time.time() if now is None else now
    if not isinstance(raw, dict) or set(raw) != {R_SOURCE, R_EXPIRES}:
        raise ContractError("lease_shape")
    expires = _when(raw.get(R_EXPIRES), "lease_expires_at_invalid")
    if expires <= now:
        raise ContractError("lease_expired")
    if expires - now > LEASE_MAX_AHEAD_S + LEASE_CLOCK_SLACK_S:
        raise ContractError("lease_lifetime_too_long")
    source = raw[R_SOURCE]
    if not isinstance(source, str) or not SOURCE_RE.fullmatch(source) or any(ord(ch) < 33 for ch in source):
        raise ContractError("lease_source_invalid")
    return StreamLease(expires_at=expires, source=source)


def talk_closed_v11(event: Any) -> tuple[str, str, bool | None] | None:
    """(talk_ref, reason, cleanup_joined) of WisKey's `media/talk_closed` event for a talk, else None. An unknown reason is read as
    `upstream_closed` (the talk is over either way)."""
    hit = talk_closed(event)
    if hit is None:
        return None
    data = event.get("data") if isinstance(event.get("data"), dict) else event
    reason = hit[1] if hit[1] in V11_EVENT_REASONS else "upstream_closed"
    joined = data.get("cleanup_joined")
    return hit[0], reason, joined if isinstance(joined, bool) else None


def talk_audio_v1(event: Any, talk_ref: str, expected_seq: int) -> bytes | None:
    """Authenticated DirectLink event -> one bounded native PCMU packet."""
    if not isinstance(event, dict) or event.get("type") != "media/talk_audio":
        return None
    if (set(event) != {"type", "schema", "talk_ref", "seq", "codec", "sample_rate", "channels", "data"}
            or event["schema"] != "arx.station_talk_audio.v1" or event["talk_ref"] != talk_ref
            or type(event["seq"]) is not int or event["seq"] != expected_seq
            or event["codec"] != "pcmu" or type(event["sample_rate"]) is not int or event["sample_rate"] != 8000
            or type(event["channels"]) is not int or event["channels"] != 1
            or type(event["data"]) is not str or len(event["data"]) != 1068):
        raise ContractError("talk_audio_invalid")
    try:
        packet = base64.b64decode(event["data"], validate=True)
    except ValueError:
        raise ContractError("talk_audio_invalid") from None
    if len(packet) != 800:
        raise ContractError("talk_audio_invalid")
    return packet
