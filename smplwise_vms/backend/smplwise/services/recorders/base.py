"""The recorder adapter seam (CR-020, docs/architecture/NVR_VENDOR_ADAPTERS.md).

Slice S1 is read-only: this Protocol carries the read methods only. The write methods of the design (stream encoding
writes, add / remove a channel) arrive with S2 / S3 and are deliberately not declared yet, so no code path in S1 can reach
a device write through an adapter.

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


class RecorderAdapter(Protocol):
    vendor: ClassVar[str]
    recorder_id: str

    def capabilities(self) -> RecorderCapabilities: ...

    def health(self) -> RecorderHealth: ...

    def list_channels(self) -> list[ChannelInfo]: ...

    def read_stream_encodings(self) -> dict[str, list[StreamEncoding]]:
        """Every stream of every channel, by the channel's `source_ref`."""
        ...
