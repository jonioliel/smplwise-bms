"""Response models of the Frigate provider API, phase F1 (routers/frigate.py, `/api/v1/frigate/...`; CR-029, TKFRIGLIVE, FRIGATE-295).
Read-only toward Frigate; never an address, a user name or a secret. Values Frigate itself reports (its version, retention, detectors,
per-hour counts, storage figures) pass through as Frigate sent them (`Any` / `Num`); the playback and export design documents of
services/recorders/frigate_playback are modelled at their top level. Field order is the order the router and the services build their dicts in."""
from __future__ import annotations

from typing import Any, Literal

from . import Num, WireModel
from .cameras import CameraSync

# routes without a JSON body: pictures, the HLS playlist and its segments, the streamed clips
NO_JSON = frozenset({
    "GET /frigate/{recorder_id}/reviews/{review_id}/thumbnail",
    "GET /frigate/{recorder_id}/cameras/{camera_id}/snapshot",
    "GET /frigate/{recorder_id}/cameras/{camera_id}/playback/index.m3u8",
    "GET /frigate/{recorder_id}/cameras/{camera_id}/playback/{start}/{end}/{name}",
    "GET /frigate/{recorder_id}/cameras/{camera_id}/clip.mp4",
    "GET /frigate/{recorder_id}/events/{event_id}/clip.mp4",
    "GET /frigate/{recorder_id}/reviews/{review_id}/clip.mp4",
})

FrigateDiscover = CameraSync
"""`POST /frigate/{id}/discover` answers the camera import of services/autosync.sync_cameras, as `POST /cameras/sync`."""


class FrigateRecorderBrief(WireModel):
    id: str
    name: str
    enabled: bool
    firmware: str | None


class FrigateRecorderList(WireModel):
    recorders: list[FrigateRecorderBrief]


class FrigateSync(WireModel):
    """The event-sync state of the recorder (services/recorders/frigate_events.FrigateState.as_dict; after a restart the stored poll facts)."""
    ws_state: str | None
    ws_frames: int
    ws_unknown_frames: int
    ws_changed_at: str | None
    last_poll_at: str | None
    last_poll_error: str | None
    last_poll_ts: Num | None
    polls: int
    reviews_seen: int
    ws_review_frames: int
    poll_interval_s: Num | None
    loop_running: bool


class FrigateEventsHealth(WireModel):
    """TKFRIGLIVE: the visible facts of the event path (services/recorders/frigate_events.events_health)."""
    loop_running: bool
    ws_state: str | None
    ws_review_frames: int
    poll_interval_s: Num | None
    last_poll_at: str | None
    last_poll_error: str | None
    last_event_seen_at: str | None
    stored_24h: int | None
    stale: bool


class FrigateWarning(WireModel):
    code: str
    severity: str = None
    dismissible: bool = None
    message: str = None
    since: str | None = None
    """`frigate_events_stale` only: since when no poll succeeded."""


class FrigateLive(WireModel):
    """TKFRIGLIVE: the live block (services/recorders/frigate_restream.summary)."""
    mode: Literal["restream", "still"]
    cameras_live: int
    cameras_total: int
    reason: str | None
    setting: str
    port: int | None
    auth: str | None
    flag: bool


class FrigateDetectorBrief(WireModel):
    name: str
    type: str


class FrigateStatus(WireModel):
    recorder: dict[str, Any]
    """The recorder's row (names, vendor facts; never an address or a secret)."""
    version: str | None
    version_ok: bool
    min_version: str
    features: dict[str, bool]
    """The discovered capabilities (feature -> available)."""
    routes_known: bool
    discovered_at: str | None
    retention: dict[str, Any] | None
    """Frigate's recording retention as read from its config summary (days, mode, pre / post seconds)."""
    detectors: list[FrigateDetectorBrief] | None
    cameras: int
    sync: FrigateSync
    events: FrigateEventsHealth
    health: dict[str, Any] | None
    """The recorder's last health reading (services/recorder_health.view's entry for it), null when it is not monitored."""
    warnings: list[FrigateWarning]
    live: FrigateLive


class FrigateCameraLink(WireModel):
    camera_id: str
    kind: str


class FrigateCamera(WireModel):
    id: str
    key: str | None
    channel: int | None
    name: str | None
    enabled: bool
    frigate_enabled: Any
    disabled_reason: Any
    status: str | None
    snapshots: bool
    ptz: bool
    labels: list[Any]
    zones: list[Any]
    links: list[FrigateCameraLink]
    can_view_live: bool
    can_play: bool


class FrigateCameras(WireModel):
    recorder_id: str
    cameras: list[FrigateCamera]


class FrigateReview(WireModel):
    """A stored review item (services/recorders/frigate_events.review_view); `reviewed` is the CALLER's state."""
    id: str
    recorder_id: str
    camera_id: str | None
    camera_key: str
    severity: str
    start: str
    end: str | None
    open: bool
    duration_s: Num | None
    objects: list[Any]
    zones: list[Any]
    sub_labels: list[Any]
    detections: int
    type: str | None
    event_id: str | None
    reviewed: bool | None
    camera_name: str | None = None
    """The listing only."""
    reviewed_at: str | None = None
    """The one-item answer only."""
    detection_ids: list[Any] = []
    """The one-item answer only."""
    thumbnail: str


class FrigateReviewPage(WireModel):
    recorder_id: str
    items: list[FrigateReview]
    next_before: Num | None
    layers: list[str]
    motion_layer: str


class FrigateReviewCount(WireModel):
    total: int
    unreviewed: int


class FrigateReviewSummary(WireModel):
    recorder_id: str
    days: int
    severity: dict[str, FrigateReviewCount]
    unreviewed_by_camera: dict[str, int]


class FrigateMirror(WireModel):
    """The optional mirror of the reviewed state toward Frigate (services/frigate_control_svc.mirror_reviewed)."""
    state: Literal["off", "not_permitted", "failed", "done"]
    count: int
    code: str = None


class FrigateReviewed(WireModel):
    recorder_id: str
    reviewed: bool
    count: int
    mirror: FrigateMirror


class FrigateWindow(WireModel):
    start: Num
    end: Num


class FrigateMotionBucket(WireModel):
    start: Num
    motion: float
    cameras: list[str]


class FrigateActivity(WireModel):
    recorder_id: str
    layer: Literal["motion"]
    window: FrigateWindow
    bucket_s: int
    buckets: list[FrigateMotionBucket]


class FrigateRange(WireModel):
    start: Num
    end: Num
    segments: int
    motion: Num
    objects: Num
    seconds: Num


class FrigateDensity(WireModel):
    start: Num
    motion: Num
    objects: Num


class FrigateCoverage(WireModel):
    """Recording coverage of a window (services/recorders/frigate_playback.coverage)."""
    window: FrigateWindow
    ranges: list[FrigateRange]
    covered_s: Num
    ratio: Num
    partial: bool
    policy: str
    sparse_by_design: bool
    bucket_s: int
    density: list[FrigateDensity]


class FrigateRecordings(FrigateCoverage):
    recorder_id: str
    camera_id: str
    segments: int


class FrigateHour(WireModel):
    hour: Any
    events: Any
    motion: Any
    objects: Any
    duration: Any


class FrigateDay(WireModel):
    day: str
    events: Any
    hours: list[FrigateHour]


class FrigateRecordingsSummary(WireModel):
    recorder_id: str
    camera_id: str
    timezone: str | None
    days: list[FrigateDay]


class FrigatePlaybackPlan(WireModel):
    """The playback resolution of a window (services/recorders/frigate_playback.playback_plan): an HLS playlist served through Arx."""
    kind: Literal["hls"]
    source: str
    recorder_id: str
    camera_id: str | None
    playlist: str
    assets: str
    window: dict[str, Any]
    anchors: dict[str, Any]
    """The anchor facts, marked unproven."""
    seek: str
    authorisation: str
    lease: str
    coverage: FrigateCoverage


class FrigateExportPlan(WireModel):
    """Clip export DESIGN only (services/recorders/frigate_playback.export_plan): nothing requested, nothing created."""
    executed: bool
    status: str
    recorder_id: str
    camera_id: str | None
    window: FrigateWindow
    frigate_route: str
    verified: bool
    allow_listed: bool
    target: str
    limits: dict[str, Num]
    needs: list[str]
    plan_endpoint: str


class FrigateStorageCamera(WireModel):
    key: str
    name: str
    usage_mb: Any
    bandwidth_mb_per_h: Any
    usage_percent: Any


class FrigateStorage(WireModel):
    recorder_id: str
    cameras: list[FrigateStorageCamera]
    usage_unavailable: Literal["role_limited"] | None
    policy: str
    retention: Any
