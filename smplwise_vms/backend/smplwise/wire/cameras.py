"""Response models of the camera registry API (routers/cameras.py, `/api/v1/cameras...`; T013, CR-024 multi-NVR, T075 detection zones,
T045 capability facts). Field order is the order the router builds its dicts in. The stored camera documents (`stream`, `encoding` from
`capabilities_json`, the media settings) are passed through as stored."""
from __future__ import annotations

from typing import Any, Literal

from . import WireModel

# routes without a JSON body
NO_JSON = frozenset({"GET /cameras/{camera_id}/snapshot.jpg"})


class CameraRow(WireModel):
    """One camera as `routers/anchors.camera_row` builds it (the registry row; `name` = alias, else the NVR's name, else "ערוץ N")."""
    id: str
    recorder_id: str
    channel: int
    name: str
    name_source: str
    alias: str | None
    enabled: bool
    sort_order: int
    main_track: int | None
    sub_track: int | None
    status: str
    last_seen_at: str | None
    stream: Any = None
    """The stream summary the discovery stored (a stored document; absent from the stored capabilities = null)."""
    encoding: dict[str, Any] | None
    """CR-008 D7: the main / sub stream encodings and their WebRTC verdicts (the stored registry document)."""
    grid_col_span: int
    wall_hidden: bool


class CameraListed(CameraRow):
    """A camera in `GET /cameras`: the row plus what the caller may do with it (CR-024, NN5-F1B, CAMERA-STREAM-SOURCES-2410)."""
    can_view_live: bool
    recorder_enabled: bool
    recorder_name: str | None
    """The recorder's name - only when the installation has two or more recorders (null otherwise)."""
    live_kind: Literal["stream", "still"] = None
    """Only for a camera of a Frigate recorder: `still` when it has no restream Arx may pull."""
    video_source: Literal["manual", "nvr"]
    standalone: bool
    area_id: str | None = None
    """Only for a camera without a recorder: its home-platform area (null when none was chosen)."""


class CameraRecorderRef(WireModel):
    id: str
    name: str
    vendor: str | None


class CameraRecorder(WireModel):
    """The first recorder (`nvr-1`) of the installation."""
    id: str
    name: str
    model: str | None
    firmware: str | None
    last_seen_at: str | None


class CameraList(WireModel):
    cameras: list[CameraListed]
    recorders: list[CameraRecorderRef]
    """The recorders of the visible cameras (the operator screens show a recorder filter with two or more)."""
    recorder: CameraRecorder | None
    can_sync: bool
    media: dict[str, Any]
    """The media settings document (routers/settings.read_settings)."""


class CameraSyncRecorder(WireModel):
    model: str | None
    firmware: str | None


class CameraSyncOutcome(WireModel):
    """One recorder's outcome in a sync of every recorder: `ok` plus its counts, or `ok: false` and the error code."""
    ok: bool
    channels: int = None
    created: int = None
    updated: int = None
    recorder_id: str = None
    recorder: CameraSyncRecorder = None
    error: str = None


class CameraSync(WireModel):
    """`POST /cameras/sync`: the discovery counts (services/autosync.sync_cameras); with several recorders the counts are the sums and
    `recorders` holds each one's outcome."""
    channels: int
    created: int
    updated: int
    recorder_id: str = None
    """The synced recorder (absent when a sync of several recorders had no successful one)."""
    recorder: CameraSyncRecorder | None
    recorders: dict[str, CameraSyncOutcome] = None


class CameraZoneFrame(WireModel):
    width: int
    height: int


class CameraZoneMotion(WireModel):
    """The motion grid (services/nvr.parse_motion_grid)."""
    enabled: bool
    region_type: str
    sensitivity: int | None
    rows: int
    cols: int
    cells: list[list[bool]]
    coverage_pct: float
    target_types: list[str]


class CameraZoneMaskRegion(WireModel):
    """NVRMASK-295: `enabled` is the parser's verdict (master on + polygon); `device_enabled` is the device's own flag."""
    id: str
    enabled: bool
    device_enabled: bool | None
    points: list[list[int]]


class CameraZoneMask(WireModel):
    enabled: bool
    normalized: CameraZoneFrame
    regions: list[CameraZoneMaskRegion]
    active_regions: int


class CameraZoneRegion(WireModel):
    id: str
    sensitivity: int
    points: list[list[int]]


class CameraZoneIntrusion(WireModel):
    enabled: bool
    normalized: CameraZoneFrame
    regions: list[CameraZoneRegion]


class CameraZoneLine(WireModel):
    id: str
    enabled: bool
    direction: str
    points: list[list[int]]


class CameraZoneLines(WireModel):
    enabled: bool
    normalized: CameraZoneFrame
    lines: list[CameraZoneLine]


class CameraSensitivityCaps(WireModel):
    min: int
    max: int
    step: int


class CameraZones(WireModel):
    """`GET /cameras/{id}/zones`: the camera's detection configuration as the NVR holds it (read-only, cached a minute). A source the
    device refuses or lacks is null, with its reason in `unsupported`."""
    camera_id: str
    channel: int
    source: Literal["nvr"]
    read_only: bool
    write_reason: str
    can_edit_motion: bool
    writes_enabled: bool
    sensitivity_caps: CameraSensitivityCaps | None
    fetched_at: str
    cached: bool
    motion: CameraZoneMotion | None
    privacy_mask: CameraZoneMask | None
    intrusion: CameraZoneIntrusion | None
    line_crossing: CameraZoneLines | None
    unsupported: dict[str, str]


class CameraWrites(WireModel):
    ptz_move: str
    preset_recall: str
    talk: str
    reason: str


class CameraPreset(WireModel):
    id: str
    name: str


class CameraPtz(WireModel):
    state: Literal["supported", "unsupported", "unknown"]
    reason: str | None
    presets: list[CameraPreset] | None
    preset_count: int | None


class CameraAudio(WireModel):
    state: Literal["available", "disabled", "unsupported", "unknown"]
    reason: str | None
    channel_id: str | None
    codec: str | None


class CameraCapabilities(WireModel):
    """`GET /cameras/{id}/capabilities`: what the NVR says this camera can do (read-only, cached five minutes) and the stored stream
    encodings with the Hebrew settings hint (`video`, from the last discovery)."""
    camera_id: str
    channel: int
    source: Literal["nvr"]
    read_only: bool
    writes: CameraWrites
    digital_zoom: Literal["browser_only"]
    fetched_at: str
    cached: bool
    ptz: CameraPtz
    audio: CameraAudio
    video: dict[str, Any] | None
    """The stored encodings document plus `hint` (null when the discovery stored none)."""

