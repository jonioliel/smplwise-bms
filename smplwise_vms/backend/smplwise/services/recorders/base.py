"""The recorder adapter seam (CR-020, docs/architecture/NVR_VENDOR_ADAPTERS.md).

Slice S1 brought the read methods; slice S2 adds the ONE guarded write of the design: a single stream's encoding
(`stream_options` / `read_stream` / `write_stream_encoding`). Add / remove a channel (S3) is deliberately not declared
yet, so no code path can reach those device writes through an adapter.

Rules every adapter keeps (ADP section 1):
- device I/O only: an adapter never receives a SQLite connection, never writes audit rows and never decides permissions;
  the service layer calls it inside `with unlocked(conn):` and records everything itself;
- synchronous and bounded: plain httpx calls with explicit timeouts, never on the event loop;
- declared, not guessed: every optional ability is in `capabilities()`;
- errors are `ApiError` with the shared codes (`source_unavailable`, `source_forbidden`, ...);
- secrets stay inside: no address, user name, password, serial number or MAC leaves an adapter;
- normalized values: codec `H.264` / `H.265` / `MJPEG` / raw string, resolution `"WxH"`, fps float, bitrate kbps, booleans
  for SVC / smart codec / B-frames, `None` = the device does not say.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import ClassVar, Literal, Protocol

Role = Literal["main", "sub", "third", "other"]


@dataclass(frozen=True)
class RecorderCapabilities:
    vendor: str  # "hikvision" | "provision_isr" | "frigate"
    read_encodings: bool
    write_encodings: bool
    encoding_fields: frozenset[str]  # the fields this vendor can carry at all
    add_channel: bool
    remove_channel: bool
    max_channels: int | None
    live: Literal["rtsp", "none"]
    playback: Literal["rtsp", "hls", "none"]
    events: Literal["push", "poll", "none"]
    health_detail: bool = False  # CR-026: the adapter implements `read_health` (disks, recording, channels, clock, certificate)
    # NN5: abilities DISCOVERED from the device (never guessed from a version): "review_items", "object_events", "snapshots", ...
    # Empty for Hikvision and Provision-ISR, so their declarations are unchanged.
    features: frozenset[str] = frozenset()


@dataclass(frozen=True)
class RecorderHealth:
    online: bool
    model: str | None
    firmware: str | None
    error: str | None  # an ApiError code
    clock_drift_s: float | None = None


@dataclass(frozen=True)
class ChannelInfo:
    source_ref: str  # the vendor's own key: "1" (Hikvision channel id)
    channel: int | None
    name: str
    online: bool | None


@dataclass(frozen=True)
class StreamEncoding:
    stream_ref: str  # "101"
    role: Role
    enabled: bool | None
    encoding: dict[str, object]  # the normalized fields (nvr.parse_streaming_channels_all)
    fields: dict[str, dict[str, bool]] = field(default_factory=dict)  # only the exceptions: {"svc": {"supported": False, "editable": False}}
    etag: str | None = None


@dataclass(frozen=True)
class StreamOptions:
    """What the device accepts for one stream (API 3.3), from its capability document. `writable` False when no capability
    document answers (owner rule: no write without one); `write_via` names the path the document came from."""
    writable: bool
    reason: str | None  # why not writable: the device's sub status or "http_<code>"
    options: dict[str, object] | None
    write_via: Literal["direct", "proxy"] | None
    source: str | None = None  # "capabilities" | "proxy_capabilities"


@dataclass(frozen=True)
class StreamSnapshot:
    """One stream as the device's LIST shows it now: the exact element text, its etag and its parsed fields."""
    stream_ref: str
    element: str
    etag: str
    parsed: dict[str, object]


@dataclass(frozen=True)
class WriteOutcome:
    """The device accepted the PUT (statusCode 1 or 7) and the LIST was read again. Whether the fields really changed is
    decided by the service (applied / no_effect / diverged), which knows what was asked."""
    device_status: str
    reboot_required: bool
    verified: StreamSnapshot


# ---------------------------------------------------------------------------------------------- health detail (CR-026)

# Normalized disk states. A vendor maps its own words onto these; `raw` keeps the device's word as evidence.
DISK_STATES = ("ok", "read_only", "locked", "unformatted", "formatting", "error", "missing", "unknown")


@dataclass(frozen=True)
class DiskReading:
    ref: str  # the disk's position on the device ("1", "2", ...), never its serial or UUID
    state: str  # one of DISK_STATES
    raw: str | None
    total_mb: int | None
    free_mb: int | None


@dataclass(frozen=True)
class ChannelReading:
    channel: int
    connected: bool | None  # None = the device does not say
    record_state: str | None  # "recording" | "idle" | "exception" | None (not reported)


@dataclass(frozen=True)
class HealthReading:
    """One health read of a recorder (`HealthReader.read_health`). Every part is None when it could not be read; `errors`
    names the part and the ApiError code (a partial read is still a reading). `clock_drift_s` = device clock minus the host's,
    seconds, positive when the device is ahead. `certificate` only for pinned HTTPS connections: {"not_after": ISO UTC,
    "self_signed": bool | None}."""
    disks: tuple[DiskReading, ...] | None = None
    channels: tuple[ChannelReading, ...] | None = None
    clock_drift_s: float | None = None
    clock_sync: str | None = None  # "NTP" | "manually" | ... (the device's word)
    disk_alarms: tuple[str, ...] = ()  # active device-level disk alarm kinds (the device's own names)
    certificate: dict[str, object] | None = None
    errors: dict[str, str] = field(default_factory=dict)
    # NN5: vendor-specific rows a vendor adds beyond the common ones (Frigate: detector inference, skipped fps, per-camera fps,
    # hours of recording left). Plain JSON values; no address, credential or stream URL.
    details: dict[str, object] | None = None


class HealthReader(Protocol):
    """Optional adapter ability, declared by `RecorderCapabilities.health_detail`. Read-only, bounded, device I/O only."""

    def read_health(self) -> HealthReading: ...


class RecorderAdapter(Protocol):
    vendor: ClassVar[str]
    recorder_id: str

    def capabilities(self) -> RecorderCapabilities: ...

    def health(self) -> RecorderHealth: ...

    def list_channels(self) -> list[ChannelInfo]: ...

    def read_stream_encodings(self) -> dict[str, list[StreamEncoding]]:
        """Every stream of every channel, by the channel's `source_ref`."""
        ...

    def stream_options(self, stream_ref: str, codec: str | None = None) -> StreamOptions:
        """Capability discovery for one stream (cached per process by recorder + stream + codec: a positive answer for 10 minutes,
        a negative one for 60 s; a hit makes no device call)."""
        ...

    def read_stream(self, stream_ref: str) -> StreamSnapshot:
        """One stream from a fresh LIST read (404 `not_found` when the device has no such stream)."""
        ...

    def write_stream_encoding(self, stream_ref: str, expect_etag: str, element: str, write_via: str) -> WriteOutcome:
        """Read the LIST again and refuse 409 `stale` when the stream's etag moved; PUT `element`; read the LIST again.
        Never retried. Refusals are ApiErrors (`nvr_busy`, `nvr_not_supported`, `nvr_rejected`, `source_forbidden`); an
        answer that leaves the device state unknown (timeout after the PUT was sent, verify read failed) is a 503
        `source_unavailable` whose `details["outcome"]` is `"unknown"`."""
        ...
