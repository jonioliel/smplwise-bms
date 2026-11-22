"""Response models of routers/backup.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from pydantic import Field

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset({'DELETE /backups/{name}', 'GET /backups/{name}/download'})
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class BackupBackupsApiBackupSensitive(ExactModel):
    state: str
    counts: dict[str, Any] = None


class BackupBackupsApiBackup(ExactModel):
    name: str
    bytes: Num
    created_at: str
    kind: str
    note: str
    app_version: str
    schema_version: Num
    tables: dict[str, Num]
    files: Num
    valid: bool
    sensitive: BackupBackupsApiBackupSensitive


class BackupBackupsApi(ExactModel):
    backups: list[BackupBackupsApiBackup]
    policy: dict[str, Num]
    bytes: Num
    schema_version: Num


class BackupCreateBackupSensitive(ExactModel):
    state: str
    counts: dict[str, Any]


class BackupCreateBackup(ExactModel):
    name: str
    bytes: Num
    created_at: str
    kind: str
    note: str
    app_version: str
    schema_version: Num
    tables: dict[str, Num]
    files: Num
    valid: bool
    sensitive: BackupCreateBackupSensitive


class BackupDrillStatusLastArchive(ExactModel):
    name: str
    bytes: Num
    sha256: str
    kind: str
    created_at: str
    app_version: str
    schema_version: Num
    sensitive: str


class BackupDrillStatusLastSchema(ExactModel):
    archive: Num
    code: Num
    restored: Num


class BackupDrillStatusLastRestore(ExactModel):
    files: Num
    files_skipped: Num
    skipped_unsafe: dict[str, Any]
    kept_current: list[Any]
    roles_pruned: list[Any]
    backgrounds_rejected: list[Any]
    sensitive: str
    sensitive_checked: Any


class BackupDrillStatusLastSource(ExactModel):
    kind: str


class BackupDrillStatusLastCheck(ExactModel):
    name: str
    ok: bool
    severity: str
    detail: dict[str, Num] = None


class BackupDrillStatusLastTimingsMs(ExactModel):
    archive_check: Num
    scratch_schema: Num
    restore: Num
    verify: Num
    total: Num


class BackupDrillStatusLast(ExactModel):
    result: str
    trigger: str
    started_at: str
    archive: BackupDrillStatusLastArchive
    schema_: BackupDrillStatusLastSchema = Field(alias='schema')
    tables: dict[str, Any]
    restore: BackupDrillStatusLastRestore
    error: Any
    source: BackupDrillStatusLastSource
    checks: list[BackupDrillStatusLastCheck]
    timings_ms: BackupDrillStatusLastTimingsMs
    finished_at: str


class BackupDrillStatusHistoryItem(ExactModel):
    result: str
    trigger: str
    started_at: str
    finished_at: str
    archive: str
    source: str
    target_id: Any
    total_ms: Num
    failed: list[Any]


class BackupDrillStatusSchedule(ExactModel):
    monthly: bool
    next_due_at: Any
    due_now: bool


class BackupDrillStatus(ExactModel):
    running: bool
    last: BackupDrillStatusLast | None
    last_offbox: Any
    history: list[BackupDrillStatusHistoryItem]
    schedule: BackupDrillStatusSchedule


class BackupDrillRun(ExactModel):
    started: bool
    archive: str
    target_id: Any


class BackupDrillScheduleSchedule(ExactModel):
    monthly: bool
    next_due_at: str
    due_now: bool


class BackupDrillSchedule(ExactModel):
    running: bool
    last: BackupDrillStatusLast
    last_offbox: Any
    history: list[BackupDrillStatusHistoryItem]
    schedule: BackupDrillScheduleSchedule


class BackupBackupManifestEnergy(ExactModel):
    daily: Num
    history: bool


class BackupBackupManifestSensitiveKdf(ExactModel):
    name: str
    ln: Num
    r: Num
    p: Num
    salt: str


class BackupBackupManifestSensitive(ExactModel):
    v: Num
    state: str
    id: str = None
    aead: str = None
    kdf: BackupBackupManifestSensitiveKdf = None
    nonce: str = None
    member: str = None
    counts: dict[str, Any]


class BackupBackupManifest(ExactModel):
    format: Num
    app_version: str
    schema_version: Num
    created_at: str
    kind: str
    note: str
    tables: dict[str, Num]
    files: Num
    missing_files: list[Any]
    energy: BackupBackupManifestEnergy
    water: BackupBackupManifestEnergy
    sensitive: BackupBackupManifestSensitive


class BackupBackup(ExactModel):
    name: str
    bytes: Num
    created_at: str
    kind: str
    note: str
    app_version: str
    schema_version: Num
    tables: dict[str, Num]
    files: Num
    valid: bool
    sensitive: BackupCreateBackupSensitive
    manifest: BackupBackupManifest


class BackupRestoreBackupDoorAutomations(ExactModel):
    disarmed: Num
    dropped: Num


class BackupRestoreBackupEnergy(ExactModel):
    daily: Num
    history: dict[str, Any]


class BackupRestoreBackupUpdateApplyEnabled(ExactModel):
    kept: bool
    archive: Any
    differed: bool


class BackupRestoreBackupCaptureLeaseSettings(ExactModel):
    kept: dict[str, str]
    dropped: dict[str, Any]


class BackupRestoreBackupSensitive(ExactModel):
    state: str
    restored: bool
    skipped: str | None
    plaintext_ignored: Num
    settings_kept_current: list[str]


class BackupRestoreBackupPasswords(ExactModel):
    restored: Num
    kept_current: Num
    need_reset: list[str]
    need_reset_count: Num
    legacy_plaintext: bool


class BackupRestoreBackupSafetyArchive(ExactModel):
    name: str
    bytes: Num
    created_at: str


class BackupRestoreBackup(ExactModel):
    name: str
    mode: str
    scope: str
    tables: dict[str, Num]
    files: Num
    files_skipped: Num
    skin_controls_swept: Num
    bakes_swept: Num
    skipped_unsafe: dict[str, Any]
    kept_current: list[str]
    roles_pruned: list[Any]
    door_automations: BackupRestoreBackupDoorAutomations
    energy: BackupRestoreBackupEnergy
    water: BackupRestoreBackupEnergy
    app_version: str
    created_at: str
    update_apply_enabled: BackupRestoreBackupUpdateApplyEnabled
    backgrounds_rejected: list[Any]
    capture_lease_settings: BackupRestoreBackupCaptureLeaseSettings
    sensitive: BackupRestoreBackupSensitive
    passwords: BackupRestoreBackupPasswords | None
    safety_archive: BackupRestoreBackupSafetyArchive
