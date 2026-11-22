"""Response models of routers/health.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset({'POST /health/logs/export'})
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class HealthHealthNvr(ExactModel):
    configured: bool
    state: str
    label: str


class HealthHealthDbWriteLockGate(ExactModel):
    held: bool
    waiting: Num


class HealthHealthDbWriteLockConnPool(ExactModel):
    opened: Num
    reused: Num
    pooled: Num
    closed: Num
    discarded: Num
    invalidated: Num
    discarded_by: dict[str, Num]
    enabled: bool


class HealthHealthDbWriteLock(ExactModel):
    holds: Num
    slow_holds: Num
    max_hold_s: Num
    max_hold_by: str = None
    busy_errors: Num
    last_busy: Any = None
    gate_timeouts: Num
    waits_over_1s: Num
    max_wait_s: Num
    max_wait_by: str = None
    max_wait_recent_s: Num
    write_gate: bool
    gate: HealthHealthDbWriteLockGate
    conn_pool: HealthHealthDbWriteLockConnPool


class HealthHealthDb(ExactModel):
    ok: bool
    permission_revision: Num
    write_lock: HealthHealthDbWriteLock
    size_bytes: Num = None
    wal_bytes: Num = None


class HealthHealthProcess(ExactModel):
    uptime_s: Num
    threads: Num
    open_fds: Num | None
    rss_mb: Num | None


class HealthHealthMedia(ExactModel):
    state: str
    configured: bool
    since: str | None
    down_for_s: Num | None
    last_ok_at: str | None
    last_error_at: str | None
    last_error: str | None
    failures: Num
    retry_in_s: Num | None


class HealthHealthDiscovery(ExactModel):
    cameras_last_ok: str | None
    cameras_last_error: str | None
    cameras_last_run: str | None
    streams_last_ok: str | None
    streams_last_error: Any
    streams_last_run: str | None
    last_reason: str | None
    cameras: Num
    interval_s: Num


class HealthHealthVideoCodecsMain(ExactModel):
    ok: Num
    no: Num
    unknown: Num


class HealthHealthVideoCodecs(ExactModel):
    cameras: Num
    checked: Num
    main: HealthHealthVideoCodecsMain
    sub: HealthHealthVideoCodecsMain
    checked_at: str | None


class HealthHealthEventsIngestQueue(ExactModel):
    depth: Num
    max: Num
    high_water: Num
    accepted: Num
    processed: Num
    failed: Num
    coalesced: Num
    dropped: Num
    dropped_repeats: Num
    dropped_shutdown: Num


class HealthHealthEventsIngest(ExactModel):
    connected: bool
    last_heartbeat_at: Any
    last_event_at: str | None
    last_error: str | None
    reconnects: Num
    events_stored: Num
    started_at: str | None
    queue: HealthHealthEventsIngestQueue
    ws_drops: Num


class HealthHealthEventsDerive(ExactModel):
    last_run: Any
    last_ok: Any
    last_error: Any
    derived: Num


class HealthHealthEventsCache(ExactModel):
    enabled: bool
    hits: Num
    misses: Num
    hit_rate: Any
    stale: Num
    expired: Num
    evictions: Num
    oversize: Num
    bypass: Num
    size: Num
    rows: Num
    max_entries: Num
    max_rows: Num
    ttl_s: Num


class HealthHealthEvents(ExactModel):
    ingest: HealthHealthEventsIngest
    derive: HealthHealthEventsDerive
    stored: Num
    cache: HealthHealthEventsCache


class HealthHealthHomeAssistant(ExactModel):
    configured: bool
    connected: bool
    last_snapshot_at: str | None
    last_event_at: Any
    last_registry_at: str | None
    last_error: str | None
    reconnects: Num
    sequence: Num
    entities: Num
    started_at: str | None
    ha_version: str | None
    last_registry_error: str | None
    last_structure_at: str | None
    registry_events: Num
    auth_refusals: Num
    next_attempt_at: Any


class HealthHealthBackpressureDataDisk(ExactModel):
    free_mb: Num
    total_mb: Num
    min_free_mb: Num
    low: bool


class HealthHealthBackpressureExportsCounters(ExactModel):
    refused_disk: Num
    refused_queue_full: Num
    paused_disk_full: Num
    resumed: Num


class HealthHealthBackpressureExports(ExactModel):
    by_state: dict[str, Any]
    paused_disk_full: Num
    waiting: Num
    max_waiting: Num
    max_per_owner: Num
    counters: HealthHealthBackpressureExportsCounters


class HealthHealthBackpressurePortalStart(ExactModel):
    running: bool
    depth: Num
    max: Num
    accepted: Num
    dropped: Num
    dropped_1h: Num
    last_drop_at: Any


class HealthHealthBackpressure(ExactModel):
    data_disk: HealthHealthBackpressureDataDisk
    exports: HealthHealthBackpressureExports
    ingest_queue: HealthHealthEventsIngestQueue
    portal_start: HealthHealthBackpressurePortalStart


class HealthHealthPush(ExactModel):
    queued: Num
    sent: Num
    retried: Num
    gone: Num
    failed: Num
    refused: Num
    retry_skipped: Num
    rate_limited: Num
    dropped_queue: Num
    dropped_shutdown: Num
    last_error: Any
    last_sent_at: Any
    running: bool
    subscriptions: Num
    subscribed_users: Num
    key_created: bool


class HealthHealthRemote(ExactModel):
    enabled: bool
    sessions: Num
    cookie: Num
    bearer: Num
    sign_ins: Num
    users: Num
    sockets: Num
    live_streams: Num
    max_live_streams_per_sign_in: Num


class HealthHealthCapabilitiesRecorder(ExactModel):
    id: str
    vendor: str
    live: bool
    playback: bool
    events: bool
    write_encodings: bool


class HealthHealthCapabilities(ExactModel):
    nvr: bool
    go2rtc: bool
    ha: bool
    live_video: bool
    playback: bool
    events_recorder: bool
    events_ha: bool
    ha_cameras_still: bool
    ha_cameras_live: bool
    cameras_available: bool
    supported: bool
    unsupported_reason: str | None
    webrtc_server_configured: bool
    recorders: list[HealthHealthCapabilitiesRecorder] = None


class HealthHealthInstallation(ExactModel):
    supported: bool
    reason: str | None
    message: str | None
    action: str | None


class HealthHealthRecorder(ExactModel):
    id: str
    discovery_last_ok: str | None
    discovery_last_error: str | None
    events_connected: bool
    events_last_error: str | None


class HealthHealth(ExactModel):
    """The add-on's own cached state."""
    status: str
    degraded_reasons: list[str]
    version: str
    mode: str
    nvr: HealthHealthNvr
    db: HealthHealthDb
    process: HealthHealthProcess = None
    data_dir_writable: bool
    nvr_configured: bool
    go2rtc_configured: bool
    media: HealthHealthMedia
    connection_pending_restart: bool
    discovery: HealthHealthDiscovery
    video_codecs: HealthHealthVideoCodecs
    events: HealthHealthEvents
    home_assistant: HealthHealthHomeAssistant
    backpressure: HealthHealthBackpressure
    identity_source: str
    push: HealthHealthPush = None
    remote: HealthHealthRemote = None
    capabilities: HealthHealthCapabilities
    installation: HealthHealthInstallation
    recorders: list[HealthHealthRecorder]
    renderer: str


class HealthHealthReportCapabilities(ExactModel):
    nvr: bool
    go2rtc: bool
    ha: bool
    live_video: bool
    playback: bool
    events_recorder: bool
    events_ha: bool
    ha_cameras_still: bool
    ha_cameras_live: bool
    cameras_available: bool
    supported: bool
    unsupported_reason: str
    webrtc_server_configured: bool
    recorders: list[HealthHealthCapabilitiesRecorder]


class HealthHealthReportInstallation(ExactModel):
    supported: bool
    reason: str
    message: str
    action: str


class HealthHealthReportCheck(ExactModel):
    id: str
    label: str
    status: str
    detail: str
    meta: dict[str, Any]


class HealthHealthReport(ExactModel):
    """One status per subsystem (T033)."""
    status: str
    mode: str
    version: str
    uptime_s: Num
    checked_at: str
    probe_ttl_s: Num
    capabilities: HealthHealthReportCapabilities
    installation: HealthHealthReportInstallation
    checks: list[HealthHealthReportCheck]


class HealthHealthSummaryItem(ExactModel):
    id: str
    status: str
    label: str
    since: str = None


class HealthHealthSummary(ExactModel):
    """What the top bar shows every signed-in user: cached states only, no device probes, no details that a non-administrator should not see (labels are operator wording, never addresses or credentials)."""
    status: str
    mode: str
    items: list[HealthHealthSummaryItem]
    checked_at: str
    version: str
