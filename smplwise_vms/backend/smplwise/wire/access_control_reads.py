"""Response models of routers/access_control_reads.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from pydantic import Field

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset({'GET /access-control/events/export.csv', 'GET /access-control/events/{event_id}/portrait', 'GET /access-control/people/{user_id}/photo'})
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /access-control/people/{user_id}', 'GET /access-control/stations/{station_id}', 'GET /access-control/stations/{station_id}/doors/{door}/hold'})


class AccessControlReadsFeaturesApi(ExactModel):
    version: Num
    min_client: Num


class AccessControlReadsFeaturesFeaturesPeople(ExactModel):
    available: bool
    reason: Any


class AccessControlReadsFeaturesFeatures(ExactModel):
    people: AccessControlReadsFeaturesFeaturesPeople
    person: AccessControlReadsFeaturesFeaturesPeople
    person_photo: AccessControlReadsFeaturesFeaturesPeople
    events: AccessControlReadsFeaturesFeaturesPeople
    event_detail: AccessControlReadsFeaturesFeaturesPeople
    event_portrait: AccessControlReadsFeaturesFeaturesPeople
    events_export: AccessControlReadsFeaturesFeaturesPeople
    groups: AccessControlReadsFeaturesFeaturesPeople
    group_versions: AccessControlReadsFeaturesFeaturesPeople
    schedules: AccessControlReadsFeaturesFeaturesPeople
    schedule_plans: AccessControlReadsFeaturesFeaturesPeople
    schedule_operations: AccessControlReadsFeaturesFeaturesPeople
    door_programs: AccessControlReadsFeaturesFeaturesPeople
    hold_schedules: AccessControlReadsFeaturesFeaturesPeople
    public_codes: AccessControlReadsFeaturesFeaturesPeople
    health: AccessControlReadsFeaturesFeaturesPeople
    health_history: AccessControlReadsFeaturesFeaturesPeople
    sync_status: AccessControlReadsFeaturesFeaturesPeople
    conflicts: AccessControlReadsFeaturesFeaturesPeople
    alerts: AccessControlReadsFeaturesFeaturesPeople
    wiskey_audit: AccessControlReadsFeaturesFeaturesPeople


class AccessControlReadsFeaturesSync(ExactModel):
    state: str
    connected: bool
    last_error: Any
    reconnects: Num
    started_at: str
    fetched_at: str
    refreshes: Num
    sequence: Num
    wiskey_version: str


class AccessControlReadsFeatures(ExactModel):
    """Which native features the installed WisKey offers (its `api.commands`), per feature: `{available, reason}`; null `available` while there is no served copy yet."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: Any
    client_api: Num
    api: AccessControlReadsFeaturesApi
    features: AccessControlReadsFeaturesFeatures
    sync: AccessControlReadsFeaturesSync


class AccessControlReadsStationsStationZone(ExactModel):
    kind: str
    name: str


class AccessControlReadsStationsStationTechnical(ExactModel):
    loaded: bool
    model: str
    firmware: str
    capabilities: dict[str, Any]
    clock: dict[str, Any] | None
    event_status: dict[str, Any]
    scanned_at: Any
    scanning: bool
    reconciled_at: Any
    last_poll_ms: Num


class AccessControlReadsStationsStationErrors(ExactModel):
    last_error: Any
    scan_error: Any


class AccessControlReadsStationsStation(ExactModel):
    id: str
    name: str
    online: bool
    call_state: str
    sync_state: str
    lock_enabled: bool
    locks: list[dict[str, Any]]
    has_camera: bool
    camera_entity: str | None
    last_seen: str
    zone: AccessControlReadsStationsStationZone | None
    technical: AccessControlReadsStationsStationTechnical
    errors: AccessControlReadsStationsStationErrors


class AccessControlReadsStationsSync(ExactModel):
    state: str
    connected: bool
    last_error: Any
    reconnects: Num
    started_at: str | None
    fetched_at: str | None
    refreshes: Num
    sequence: Num
    wiskey_version: str | None


class AccessControlReadsStations(ExactModel):
    """The stations the caller sees (`access.read` on each): online, call state (no caller name), sync state, doors, camera id; `technical` (model, firmware, capabilities, clock, event stream) with `access.stations.read` on the station, else null;"""
    state: str
    configured: bool
    last_error: str | None
    fetched_at: str | None
    fresh: bool
    stations: list[AccessControlReadsStationsStation] | None
    default_zone: AccessControlReadsStationsStationZone | None
    sync: AccessControlReadsStationsSync


class AccessControlReadsDoorProgramsProgramsProgram(ExactModel):
    door: Num
    revision: Num
    enabled: bool
    removing: bool
    policy: dict[str, Any]
    execution: dict[str, Any]
    error: Any
    checked_at: str


class AccessControlReadsDoorProgramsProgramsSavedItem(ExactModel):
    door: Num
    revision: Num
    policy: dict[str, Any]


class AccessControlReadsDoorProgramsPrograms(ExactModel):
    programs: list[AccessControlReadsDoorProgramsProgramsProgram]
    saved: list[AccessControlReadsDoorProgramsProgramsSavedItem]
    timezone: str
    native_supported: bool


class AccessControlReadsDoorPrograms(ExactModel):
    """The station's door programs (hold-open programs on the device, `programs`) and saved drafts (`saved`), each with its weekly windows and holidays."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    programs: AccessControlReadsDoorProgramsPrograms
    sync: AccessControlReadsFeaturesSync
    fresh: bool


class AccessControlReadsCodesPresenceCodesSlot(ExactModel):
    slot: Num
    configured: bool | None


class AccessControlReadsCodesPresenceCodesCapabilities(ExactModel):
    advertised: bool
    min: Num
    max: Num


class AccessControlReadsCodesPresenceCodes(ExactModel):
    public_pin_state: str
    slots: list[AccessControlReadsCodesPresenceCodesSlot]
    capabilities: AccessControlReadsCodesPresenceCodesCapabilities
    checked_at: str


class AccessControlReadsCodesPresence(ExactModel):
    """Whether the station's public door codes are set - presence only, per slot (`configured` true / false / null); never a value."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    codes: AccessControlReadsCodesPresenceCodes
    sync: AccessControlReadsFeaturesSync
    fresh: bool


class AccessControlReadsStatusStations(ExactModel):
    """The status page's station list (`access.read` and `access.admin.read` on each), as GET /access-control/stations."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    fresh: bool
    stations: list[AccessControlReadsStationsStation]
    default_zone: AccessControlReadsStationsStationZone
    sync: AccessControlReadsFeaturesSync


class AccessControlReadsHealthHealthRequests(ExactModel):
    requests: Num
    failures: Num
    last_ms: Num
    p95_ms: Num


class AccessControlReadsHealthHealthAccessAssignmentStates(ExactModel):
    synced: Num
    pending: Num


class AccessControlReadsHealthHealthAccessErrors(ExactModel):
    device_unavailable: Num


class AccessControlReadsHealthHealthAccess(ExactModel):
    sync_state: str
    last_error: Any
    pending_request: bool
    worker_active: bool
    queue_depth: Num
    assignment_states: AccessControlReadsHealthHealthAccessAssignmentStates
    errors: AccessControlReadsHealthHealthAccessErrors


class AccessControlReadsHealthHealthEvents(ExactModel):
    stream: str
    history: str
    reconnects: Num
    last_frame_at: str
    storage_failed: bool


class AccessControlReadsHealthHealthClock(ExactModel):
    status: str
    skew_seconds: Num
    drift_state: str
    time_mode: str
    checked_at: str
    error: Any


class AccessControlReadsHealthHealth(ExactModel):
    loaded: bool
    online: bool
    firmware: str
    consecutive_poll_failures: Num
    requests: AccessControlReadsHealthHealthRequests
    access: AccessControlReadsHealthHealthAccess
    events: AccessControlReadsHealthHealthEvents
    clock: AccessControlReadsHealthHealthClock
    generated_at: str


class AccessControlReadsHealth(ExactModel):
    """One station's health card: polling, request times, access sync worker, event stream, clock."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    health: AccessControlReadsHealthHealth
    sync: AccessControlReadsFeaturesSync
    fresh: bool


class AccessControlReadsHealthHistoryHistoryRecord(ExactModel):
    at: str
    online: bool
    poll_ms: Num | None
    sync: str
    events: str


class AccessControlReadsHealthHistoryHistory(ExactModel):
    period_days: Num
    records: list[AccessControlReadsHealthHistoryHistoryRecord]
    storage_failed: bool


class AccessControlReadsHealthHistory(ExactModel):
    """Seven days of one station's health samples (online, poll time, sync, event stream)."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    history: AccessControlReadsHealthHistoryHistory
    sync: AccessControlReadsFeaturesSync
    fresh: bool


class AccessControlReadsSyncStatusSyncStatusStation(ExactModel):
    station_id: str
    name: str
    sync_state: str
    reconciled_at: Any
    operations: dict[str, Num]
    pending_users: Num
    managed_users: Num
    revocations_pending: Num
    card_removals_pending: Num
    pin_removals_pending: Num
    deletions_pending: Num
    last_error: Any


class AccessControlReadsSyncStatusSyncStatus(ExactModel):
    stations: list[AccessControlReadsSyncStatusSyncStatusStation]
    totals: dict[str, Any]


class AccessControlReadsSyncStatus(ExactModel):
    """Per-station sync counts (pending people, operations by state, revocations, card / PIN removals, deletions) and their totals - over the stations the caller sees on the status page only."""
    state: str
    configured: bool
    last_error: str | None
    fetched_at: str | None
    sync_status: AccessControlReadsSyncStatusSyncStatus | None
    sync: AccessControlReadsStationsSync
    fresh: bool


class AccessControlReadsConflictsConflictPerson(ExactModel):
    id: str
    display_name: str | None
    employee_no: str | None


class AccessControlReadsConflictsConflict(ExactModel):
    kind: str
    station_id: str
    sync_state: str
    last_error: str
    person: AccessControlReadsConflictsConflictPerson


class AccessControlReadsConflicts(ExactModel):
    """Sync conflicts and errors per (person or removal, station)."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    conflicts: list[AccessControlReadsConflictsConflict]
    sync: AccessControlReadsFeaturesSync


class AccessControlReadsAlertsAlertsItem(ExactModel):
    id: str
    station_id: str
    station_name: str
    kind: str
    severity: str
    observed_since: str | None
    observed_seconds: Num | None
    online: bool
    sync_state: str
    suppressed: bool
    suppression: dict[str, str] | None


class AccessControlReadsAlertsAlertsThresholdsSeconds(ExactModel):
    offline: Num
    sync_stalled: Num
    event_gap: Num


class AccessControlReadsAlertsAlerts(ExactModel):
    items: list[AccessControlReadsAlertsAlertsItem]
    total: Num
    active_count: Num
    suppressed_count: Num
    offset: Num
    limit: Num
    next_offset: Any
    complete: bool
    thresholds_seconds: AccessControlReadsAlertsAlertsThresholdsSeconds
    station_thresholds_seconds: dict[str, Any]
    generated_at: str


class AccessControlReadsAlerts(ExactModel):
    """Fleet alerts of the stations the caller sees on the status page, paged and counted over those (`total`, `active_count`, `suppressed_count`)."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    alerts: AccessControlReadsAlertsAlerts
    sync: AccessControlReadsFeaturesSync
    fresh: bool


class AccessControlReadsWiskeyAuditAuditRecord(ExactModel):
    sequence: Num
    time: str
    action: str
    actor_name: str
    fields_: list[str] = Field(alias='fields')
    revision_before: Num | None
    revision_after: Num
    reason_code: Any
    stations: list[str]
    person: dict[str, str]


class AccessControlReadsWiskeyAuditAudit(ExactModel):
    records: list[AccessControlReadsWiskeyAuditAuditRecord]
    next_cursor: Any
    total: Num
    retention_days: Num


class AccessControlReadsWiskeyAudit(ExactModel):
    """The intercom's own action log ("פעולות שנעשו בחלון האינטרקום": what was done in its own panel; Arx's actions are in Arx's audit)."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    audit: AccessControlReadsWiskeyAuditAudit
    sync: AccessControlReadsFeaturesSync


class AccessControlReadsPeopleSync(ExactModel):
    state: str
    connected: bool
    last_error: Any
    reconnects: Num
    started_at: Any
    fetched_at: Any
    refreshes: Num
    sequence: Num
    wiskey_version: Any


class AccessControlReadsPeople(ExactModel):
    """One page of the people the caller may see (a person is visible through an assignment on a station where the caller holds `access.people.read`)."""
    state: str
    configured: bool
    last_error: str
    fetched_at: Any
    people: Any
    sync: AccessControlReadsPeopleSync


class AccessControlReadsEventsEventsRecord(ExactModel):
    id: str
    station_id: str
    timestamp: str
    received_at: str
    time_source: str
    person_name: str
    authentication: str
    result: str
    event_type: str
    recovered: bool
    door: Num
    employee_no: str
    portrait: bool


class AccessControlReadsEventsEvents(ExactModel):
    records: list[AccessControlReadsEventsEventsRecord]
    next: str
    retention_days: Num
    capacity: Num
    membership_basis: Any
    storage_failed: bool
    stations: dict[str, Any]
    complete: bool
    incomplete_reason: Any


class AccessControlReadsEvents(ExactModel):
    """One page of the entry log as the caller may see it, newest first."""
    state: str
    configured: bool
    last_error: str | None
    fetched_at: str | None
    events: AccessControlReadsEventsEvents | None
    sync: AccessControlReadsStationsSync


class AccessControlReadsEventDetailEventEvidence(ExactModel):
    identity_state: str
    origin: str
    arrival_delay_seconds: Num
    time_source: str
    live_automation: bool


class AccessControlReadsEventDetailEventSourceIdentitySourceFields(ExactModel):
    employeeNoString: str
    employeeNo: str
    name: str


class AccessControlReadsEventDetailEventSourceIdentity(ExactModel):
    source_fields: AccessControlReadsEventDetailEventSourceIdentitySourceFields
    normalized: bool
    time_interpretation: str
    central_name_resolved: bool


class AccessControlReadsEventDetailEvent(ExactModel):
    id: str
    station_id: str
    timestamp: str
    received_at: str
    time_source: str
    person_name: str
    authentication: str
    result: str
    event_type: str
    recovered: bool
    door: Num
    employee_no: str
    evidence: AccessControlReadsEventDetailEventEvidence
    source_identity: AccessControlReadsEventDetailEventSourceIdentity


class AccessControlReadsEventDetail(ExactModel):
    """One event with WisKey's evidence (how the identity and the time were established - flags, no person field); 404 `intercom_event_not_found` when there is no such event or the caller may not see it."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    event: AccessControlReadsEventDetailEvent
    sync: AccessControlReadsFeaturesSync


class AccessControlReadsGroupsGroupsGroup(ExactModel):
    id: str
    label: str
    enabled: bool
    station_ids: list[str] | None


class AccessControlReadsGroupsGroups(ExactModel):
    revision: Num
    photo_enabled: bool
    groups: list[AccessControlReadsGroupsGroupsGroup]
    fields_: list[dict[str, Any]] = Field(alias='fields')


class AccessControlReadsGroups(ExactModel):
    """The person groups the caller may see (all for a caller who sees everyone; otherwise the groups whose every station they see) with the stations each grants, the photo switch and - for `access.people.sensitive` or the Settings status - the cu"""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    groups: AccessControlReadsGroupsGroups
    sync: AccessControlReadsFeaturesSync
    fresh: bool


class AccessControlReadsGroupVersionsVersionsRecord(ExactModel):
    revision: Num
    saved_at: str | None
    action: str
    origin: str
    field_changes: Num
    group_changes: Num


class AccessControlReadsGroupVersionsVersions(ExactModel):
    records: list[AccessControlReadsGroupVersionsVersionsRecord]
    total: Num
    offset: Num
    next_offset: Any
    previous_offset: Any
    current_revision: Num
    retained_from_revision: Num


class AccessControlReadsGroupVersions(ExactModel):
    """The history of the groups and fields policy (revision, when, which kind of change, how many fields / groups changed; never who)."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    versions: AccessControlReadsGroupVersionsVersions
    sync: AccessControlReadsFeaturesSync
    fresh: bool


class AccessControlReadsSchedulesLibraryScheduleWeekly(ExactModel):
    Monday: list[dict[str, str]]
    Tuesday: list[dict[str, str]]
    Wednesday: list[Any]
    Thursday: list[Any]
    Friday: list[Any]
    Saturday: list[Any]
    Sunday: list[dict[str, str]]


class AccessControlReadsSchedulesLibrarySchedule(ExactModel):
    id: str
    revision: Num
    updated_at: str
    name: str
    weekly: AccessControlReadsSchedulesLibraryScheduleWeekly
    holidays: list[dict[str, Any]]


class AccessControlReadsSchedulesLibrary(ExactModel):
    """WisKey's device schedule library ("לוחות זמנים של דלתות"): weekly windows and holidays."""
    state: str
    configured: bool
    last_error: str | None
    fetched_at: str | None
    schedules: list[AccessControlReadsSchedulesLibrarySchedule] | None
    sync: AccessControlReadsStationsSync
    fresh: bool


class AccessControlReadsSchedulesPlansScheduleReport(ExactModel):
    checked_at: str
    blockers: list[str]
    resources: list[dict[str, Any]]
    users: dict[str, Any]


class AccessControlReadsSchedulesPlansSchedule(ExactModel):
    id: str
    revision: Num
    station_id: str
    draft_id: str
    draft_revision: Num
    name: str
    created_at: str
    source_state: str
    can_apply: bool
    drifted_resources: list[str]
    report: AccessControlReadsSchedulesPlansScheduleReport


class AccessControlReadsSchedulesPlans(ExactModel):
    """The schedule deployment plans per station with their last check (blockers, resources)."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    schedules: list[AccessControlReadsSchedulesPlansSchedule]
    sync: AccessControlReadsFeaturesSync
    fresh: bool


class AccessControlReadsSchedulesOperationsSchedulesJob(ExactModel):
    id: str
    revision: Num
    plan_id: str
    station_id: str
    name: str
    status: str
    error: Any
    blockers: list[str]
    ownership: str
    created_at: str
    updated_at: str


class AccessControlReadsSchedulesOperationsSchedulesClaim(ExactModel):
    id: str
    plan_id: str
    station_id: str
    created_at: str


class AccessControlReadsSchedulesOperationsSchedules(ExactModel):
    jobs: list[AccessControlReadsSchedulesOperationsSchedulesJob]
    archive: list[Any]
    journal: list[Any]
    claims: list[AccessControlReadsSchedulesOperationsSchedulesClaim]
    writes_enabled: bool


class AccessControlReadsSchedulesOperations(ExactModel):
    """The schedule operations (jobs, archive, journal, claims; `writes_enabled`)."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    schedules: AccessControlReadsSchedulesOperationsSchedules
    sync: AccessControlReadsFeaturesSync
    fresh: bool


class AccessControlReadsParityReportParityWindow(ExactModel):
    start: str
    end: str


class AccessControlReadsParityReportParitySubject(ExactModel):
    user_id: str
    display_name: str
    self: bool


class AccessControlReadsParityReportParityScreen(ExactModel):
    screen: str
    feature: str | None
    permission: str
    route: str
    source: dict[str, Any]
    expected_count: Num
    native: dict[str, Any] | None
    rule: str | None
    reason: Any
    outcome: str


class AccessControlReadsParityReportParitySummary(ExactModel):
    match: Num
    filtered: Num
    mismatch: Num
    partial: Num
    not_permitted: Num
    unsupported: Num
    unavailable: Num


class AccessControlReadsParityReportParity(ExactModel):
    window_hours: Num
    window: AccessControlReadsParityReportParityWindow
    subject: AccessControlReadsParityReportParitySubject
    screens: list[AccessControlReadsParityReportParityScreen]
    summary: AccessControlReadsParityReportParitySummary


class AccessControlReadsParityReport(ExactModel):
    """Side-by-side check of the native screens: per screen (stations, people, the entry log of the last `hours`, groups, the schedule library, fleet alerts) the count and a keyed digest of what a direct unfiltered read of the same WisKey command """
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    parity: AccessControlReadsParityReportParity
    sync: AccessControlReadsFeaturesSync
