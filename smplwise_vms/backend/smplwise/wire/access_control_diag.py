"""Response models of routers/access_control_diag.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class AccessControlDiagDiagHomeFeaturesPickers(ExactModel):
    available: bool | None
    reason: Any


class AccessControlDiagDiagHomeFeaturesReviewDecide(ExactModel):
    available: bool | None
    reason: str | None


class AccessControlDiagDiagHomeFeatures(ExactModel):
    pickers: AccessControlDiagDiagHomeFeaturesPickers
    scenario: AccessControlDiagDiagHomeFeaturesPickers
    compare: AccessControlDiagDiagHomeFeaturesPickers
    compare_doors: AccessControlDiagDiagHomeFeaturesPickers
    reviews: AccessControlDiagDiagHomeFeaturesPickers
    review_decide: AccessControlDiagDiagHomeFeaturesReviewDecide
    quality: AccessControlDiagDiagHomeFeaturesPickers
    lifecycle: AccessControlDiagDiagHomeFeaturesReviewDecide
    sync: AccessControlDiagDiagHomeFeaturesPickers
    permission_audit: AccessControlDiagDiagHomeFeaturesPickers


class AccessControlDiagDiagHomeCan(ExactModel):
    people: bool
    decide: bool
    sensitive: bool
    employee_no: bool


class AccessControlDiagDiagHomeDoorZone(ExactModel):
    kind: str
    name: str


class AccessControlDiagDiagHomeDoor(ExactModel):
    id: str
    name: str
    online: bool
    zone: AccessControlDiagDiagHomeDoorZone | None
    doors: list[dict[str, Any]]


class AccessControlDiagDiagHome(ExactModel):
    """The views the installed WisKey offers, what this caller may do there, and the doors to pick from."""
    feed: str
    features: AccessControlDiagDiagHomeFeatures
    can: AccessControlDiagDiagHomeCan
    doors: list[AccessControlDiagDiagHomeDoor] | None
    default_zone: AccessControlDiagDiagHomeDoorZone | None


class AccessControlDiagDiagOptions(ExactModel):
    state: str
    last_error: str | None
    fetched_at: str | None
    options: dict[str, Any] | None


class AccessControlDiagDiagScenarioScenarioDesired(ExactModel):
    allowed: bool
    reason: str
    timing_mode: str
    draft_ignored: bool


class AccessControlDiagDiagScenarioScenarioObservedTiming(ExactModel):
    status: str
    mode: str
    checked_at: str
    valid_from: str
    valid_until: str
    interval_contains_target: bool


class AccessControlDiagDiagScenarioScenarioObserved(ExactModel):
    sync_state: str
    last_sync_at: str
    revision_matches: bool
    timing: AccessControlDiagDiagScenarioScenarioObservedTiming


class AccessControlDiagDiagScenarioScenarioSource(ExactModel):
    granted: bool
    configured: bool
    source: str
    groups: list[dict[str, str]]
    override: str | None
    sources_known: bool


class AccessControlDiagDiagScenarioScenarioPerson(ExactModel):
    kind: str
    id: str
    name: str
    active: bool
    archived: bool
    valid_from: Any
    valid_until: str
    timing_mode: str


class AccessControlDiagDiagScenarioScenario(ExactModel):
    person_revision: Num
    station_id: str
    lock_id: Num
    at: str
    desired: AccessControlDiagDiagScenarioScenarioDesired
    observed: AccessControlDiagDiagScenarioScenarioObserved
    station_status: str
    physical_result: str
    source: AccessControlDiagDiagScenarioScenarioSource
    person: AccessControlDiagDiagScenarioScenarioPerson


class AccessControlDiagDiagScenarioStation(ExactModel):
    id: str
    name: str
    online: bool
    door_name: str | None


class AccessControlDiagDiagScenario(ExactModel):
    state: str
    last_error: Any
    fetched_at: str
    scenario: AccessControlDiagDiagScenarioScenario
    station: AccessControlDiagDiagScenarioStation


class AccessControlDiagDiagCompareCompareLeft(ExactModel):
    kind: str
    id: str
    name: str
    active: bool = None
    archived: bool = None
    valid_from: Any = None
    valid_until: str = None
    timing_mode: str = None
    enabled: bool = None


class AccessControlDiagDiagCompareCompareRow(ExactModel):
    station_id: str
    station_name: str
    lock_id: Num
    relation: str
    left: dict[str, Any]
    right: dict[str, Any]


class AccessControlDiagDiagCompareCompareSummary(ExactModel):
    shared: Num
    left_only: Num
    right_only: Num
    neither: Num


class AccessControlDiagDiagCompareCompare(ExactModel):
    left: AccessControlDiagDiagCompareCompareLeft
    right: AccessControlDiagDiagCompareCompareLeft
    rows: list[AccessControlDiagDiagCompareCompareRow]
    summary: AccessControlDiagDiagCompareCompareSummary
    physical_result: str


class AccessControlDiagDiagCompare(ExactModel):
    state: str
    last_error: Any
    fetched_at: str
    compare: AccessControlDiagDiagCompareCompare


class AccessControlDiagDiagCompareDoorsDoorsRow(ExactModel):
    user_id: str
    display_name: str
    relation: str
    left: bool
    right: bool
    left_assigned: bool
    right_assigned: bool
    archived: bool


class AccessControlDiagDiagCompareDoorsDoors(ExactModel):
    rows: list[AccessControlDiagDiagCompareDoorsDoorsRow]
    summary: AccessControlDiagDiagCompareCompareSummary
    complete: bool
    physical_result: str


class AccessControlDiagDiagCompareDoors(ExactModel):
    state: str
    last_error: Any
    fetched_at: str
    doors: AccessControlDiagDiagCompareDoorsDoors


class AccessControlDiagDiagReviewsReviewsRecord(ExactModel):
    user_id: str
    display_name: str
    person_revision: Num
    status: str
    central: dict[str, Any]
    latest: dict[str, Any] | None
    sync_state: str


class AccessControlDiagDiagReviewsReviewsSummary(ExactModel):
    archived: Num
    completed: Num
    due: Num
    followup: Num
    pending: Num
    stale: Num


class AccessControlDiagDiagReviewsReviews(ExactModel):
    snapshot: str
    stale: bool
    total: Num
    offset: Num
    limit: Num
    next_offset: Any
    previous_offset: Any
    records: list[AccessControlDiagDiagReviewsReviewsRecord]
    summary: AccessControlDiagDiagReviewsReviewsSummary
    access_changed: bool


class AccessControlDiagDiagReviews(ExactModel):
    state: str
    last_error: Any
    fetched_at: str
    reviews: AccessControlDiagDiagReviewsReviews


class AccessControlDiagDiagReviewPreviewDecide(ExactModel):
    available: bool
    reason: Any
    allowed: bool


class AccessControlDiagDiagReviewPreview(ExactModel):
    state: str
    last_error: Any
    fetched_at: str
    preview: dict[str, Any]
    decide: AccessControlDiagDiagReviewPreviewDecide


class AccessControlDiagDiagReviewDecideReceipt(ExactModel):
    id: str
    decision: str
    reason: str
    cadence_days: Num
    at: str
    due_at: str
    person_revision: Num
    arx_actor: str


class AccessControlDiagDiagReviewDecide(ExactModel):
    status: str
    command_id: str
    receipt: AccessControlDiagDiagReviewDecideReceipt
    access_changed: bool
    at: str


class AccessControlDiagDiagQualityQualityCoverage(ExactModel):
    scanned: Num
    archived: Num
    unknown_fields: Num


class AccessControlDiagDiagQualityQualitySummary(ExactModel):
    people: Num
    missing: Num
    invalid: Num
    duplicate: Num


class AccessControlDiagDiagQualityQualityRecord(ExactModel):
    id: str
    display_name: str
    employee_no: str | None
    revision: Num
    archived: bool
    issues: list[dict[str, Any]]


class AccessControlDiagDiagQualityQuality(ExactModel):
    snapshot: str
    stale: bool
    coverage: AccessControlDiagDiagQualityQualityCoverage
    summary: AccessControlDiagDiagQualityQualitySummary
    total: Num
    offset: Num
    limit: Num
    next_offset: Any
    previous_offset: Any
    records: list[AccessControlDiagDiagQualityQualityRecord]


class AccessControlDiagDiagQuality(ExactModel):
    state: str
    last_error: str | None
    fetched_at: str | None
    quality: AccessControlDiagDiagQualityQuality | None


class AccessControlDiagDiagLifecycleLifecycleSummary(ExactModel):
    total: Num
    active: Num
    scheduled: Num
    expired: Num
    expiring: Num
    without_credentials: Num
    duplicate_groups: Num
    duplicate_users: Num


class AccessControlDiagDiagLifecycleLifecycleExpiration(ExactModel):
    id: str
    display_name: str
    employee_no: str
    access_category: str
    active: bool
    valid_from: Any
    valid_until: str
    assignment_count: Num
    state: str
    seconds_remaining: Num


class AccessControlDiagDiagLifecycleLifecycleTemporarySummary(ExactModel):
    total: Num
    active: Num
    upcoming: Num
    expired: Num
    inactive: Num
    expiring: Num


class AccessControlDiagDiagLifecycleLifecycleTemporary(ExactModel):
    summary: AccessControlDiagDiagLifecycleLifecycleTemporarySummary
    users: list[dict[str, Any]]


class AccessControlDiagDiagLifecycleLifecycleDuplicate(ExactModel):
    reason: str
    users: list[dict[str, str]]


class AccessControlDiagDiagLifecycleLifecycleWithoutCredential(ExactModel):
    id: str
    display_name: str
    employee_no: str
    access_category: str
    active: bool
    valid_from: Any
    valid_until: str
    assignment_count: Num


class AccessControlDiagDiagLifecycleLifecycleTruncated(ExactModel):
    expirations: bool
    duplicates: bool
    without_credentials: bool
    temporary_access: bool


class AccessControlDiagDiagLifecycleLifecycle(ExactModel):
    generated_at: str
    warning_days: Num
    summary: AccessControlDiagDiagLifecycleLifecycleSummary
    expirations: list[AccessControlDiagDiagLifecycleLifecycleExpiration]
    temporary: AccessControlDiagDiagLifecycleLifecycleTemporary
    duplicates: list[AccessControlDiagDiagLifecycleLifecycleDuplicate]
    without_credentials: list[AccessControlDiagDiagLifecycleLifecycleWithoutCredential] | None
    truncated: AccessControlDiagDiagLifecycleLifecycleTruncated


class AccessControlDiagDiagLifecycle(ExactModel):
    state: str
    last_error: str | None
    fetched_at: str | None
    lifecycle: AccessControlDiagDiagLifecycleLifecycle | None


class AccessControlDiagDiagSyncDiagnosticsStation(ExactModel):
    station_ref: str
    state: str
    last_error: str | None
    loaded: bool
    managed_lock: bool
    worker_active: bool
    pending_request: bool
    reconciliation_targets: Num


class AccessControlDiagDiagSyncDiagnosticsRecentItem(ExactModel):
    at: str
    station_ref: str
    step: str
    outcome: str
    error: str | None
    status_code: Num | None
    sub_status: str | None


class AccessControlDiagDiagSyncDiagnosticsFailures(ExactModel):
    authentication_failed: Num


class AccessControlDiagDiagSyncDiagnostics(ExactModel):
    integration_version: str
    retention: str
    stations: list[AccessControlDiagDiagSyncDiagnosticsStation]
    recent: list[AccessControlDiagDiagSyncDiagnosticsRecentItem]
    failures: AccessControlDiagDiagSyncDiagnosticsFailures


class AccessControlDiagDiagSync(ExactModel):
    state: str
    last_error: str | None
    fetched_at: str | None
    diagnostics: AccessControlDiagDiagSyncDiagnostics | None


class AccessControlDiagDiagPermissionAuditAuditRow(ExactModel):
    user_id: str | None
    display_name: str | None
    employee_no: str
    status: str
    differences: list[str]
    error: Any


class AccessControlDiagDiagPermissionAuditAudit(ExactModel):
    station_id: str
    checked_at: str
    device_writes: Num
    complete: bool
    total_candidates: Num
    counts: dict[str, Any]
    rows: list[AccessControlDiagDiagPermissionAuditAuditRow]


class AccessControlDiagDiagPermissionAudit(ExactModel):
    state: str
    last_error: str | None
    fetched_at: str | None
    audit: AccessControlDiagDiagPermissionAuditAudit | None
