"""Response models of routers/storage.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class StorageStorageReportNvr(ExactModel):
    configured: bool
    reachable: bool
    error: Any


class StorageStorageReportDisk(ExactModel):
    id: str
    name: str
    kind: str
    status: str
    capacity_mb: Num
    free_mb: Num
    used_mb: Num
    property: str
    path: str


class StorageStorageReportCamera(ExactModel):
    camera_id: str
    name: str
    channel: Num
    track_id: Num | None
    has_schedule: bool
    enable_flag: bool | None
    default_mode: str | None
    modes: list[str]
    summary: str
    pre_s: Num | None
    post_s: Num | None
    expiry: str | None
    save_audio: bool | None
    bitrate_kbps: Num | None
    resolution: str | None
    fps: Num | None
    oldest_recording_at: str | None
    retention_days: Num | None
    retention_reason: str


class StorageStorageReportRetention(ExactModel):
    measured_days_min: Num | None
    measured_days_max: Num | None
    measured_reason: str
    estimated_days: Num | None
    estimated_reason: str
    bitrate_total_kbps: Num
    lookback_days: Num


class StorageStorageReportLimits(ExactModel):
    writes: bool
    notes: list[str]


class StorageStorageReportLocalImported(ExactModel):
    cases: Num
    bytes: Num


class StorageStorageReportLocal(ExactModel):
    total_bytes: Num
    free_bytes: Num
    imported: StorageStorageReportLocalImported
    exports_bytes: Num
    cases_bytes: Num


class StorageStorageReport(ExactModel):
    """Disks, per-camera recording schedule, retention measured vs."""
    generated_at: str
    cached: bool
    nvr: StorageStorageReportNvr
    disks: list[StorageStorageReportDisk]
    nas: list[Any]
    totals: dict[str, Any] | None
    work_mode: str | None
    schedule_error: Any
    cameras: list[StorageStorageReportCamera]
    retention: StorageStorageReportRetention
    limits: StorageStorageReportLimits
    recorder_id: str
    local: StorageStorageReportLocal


class StorageStorageLocalDataDisk(ExactModel):
    free_mb: Num
    total_mb: Num
    min_free_mb: Num
    low: bool


class StorageStorageLocalExportsCounters(ExactModel):
    refused_disk: Num
    refused_queue_full: Num
    paused_disk_full: Num
    resumed: Num


class StorageStorageLocalExports(ExactModel):
    by_state: dict[str, Num]
    paused_disk_full: Num
    waiting: Num
    max_waiting: Num
    max_per_owner: Num
    counters: StorageStorageLocalExportsCounters


class StorageStorageLocalIngestQueue(ExactModel):
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


class StorageStorageLocalPortalStart(ExactModel):
    running: bool
    depth: Num
    max: Num
    accepted: Num
    dropped: Num
    dropped_1h: Num
    last_drop_at: Any


class StorageStorageLocal(ExactModel):
    """No device call: the local disk and the queues (T068)."""
    data_disk: StorageStorageLocalDataDisk
    exports: StorageStorageLocalExports
    ingest_queue: StorageStorageLocalIngestQueue
    portal_start: StorageStorageLocalPortalStart


class StorageResumeExports(ExactModel):
    """Resume the exports paused by a full disk now (they also resume on their own once there is room): 507 while free space is still under the minimum."""
    resumed: Num
    data_disk: StorageStorageLocalDataDisk
    exports: StorageStorageLocalExports
    ingest_queue: StorageStorageLocalIngestQueue
    portal_start: StorageStorageLocalPortalStart
