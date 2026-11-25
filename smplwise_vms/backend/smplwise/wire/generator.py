"""Response models of the generator API (routers/generator.py, `/api/v1/generator/...`; CR-031 GEN1, GENWIDGET 2.9.3, GENALERT-295,
GENLOG092-295). View and alerts only. Operator answers speak in display names and role keys; entity ids only in the mapping screen's
manage answers. A live value's own type follows its role (number, enum text, bool) and passes through as read (`Any`). Field order is the
order the router and services/generator_* build their dicts in."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from . import Num, WireModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()

Availability = Literal["online", "stale", "offline"]
Severity = Literal["critical", "alert", "info"]
DeviceStatus = Literal["detected", "partial", "removed"]
RunKind = Literal["test", "mains_failure", "manual", "other"]


class GeneratorValue(WireModel):
    """One mapped role's live value (normalised to the role's canonical unit; null = no live value)."""
    value: Any
    unit: str
    """The role's canonical unit ("" for a state or a switch)."""
    available: bool
    updated_at: str | None
    label: str


class GeneratorRoleDetail(WireModel):
    role: str
    label: str
    unit: str
    core: bool


class GeneratorCapabilities(WireModel):
    roles: list[str]
    values: int
    values_total: int
    alert_types: int
    alert_types_total: int
    disabled_roles: list[str]
    missing_core: list[str]
    roles_detail: list[GeneratorRoleDetail] = []
    """Detail answers only."""


class GeneratorAlertTypeState(WireModel):
    key: str
    group: str
    title: str
    available: bool
    needs: str | None
    needs_en: str | None = None
    """GEN-SENSOR-NAMES-EN-2520 (additive): the same "requires sensor" names in English; null when the type is available."""


class GeneratorDevice(WireModel):
    """One generator (routers/generator._device_out). `values`, `alert_types` and `thresholds` only in the detail answers."""
    id: str
    name: str
    area_id: str | None
    area_name: str | None
    status: DeviceStatus
    source_kind: Literal["integration", "generic", "manual"]
    rated_kw: float | None
    rated_kva: float | None
    fuel_type: str
    detected_at: str | None
    last_seen_at: str | None
    revision: int
    availability: Availability
    stale: bool
    core_met: bool
    open_alerts: int
    capabilities: GeneratorCapabilities
    values: dict[str, GeneratorValue] = {}
    alert_types: list[GeneratorAlertTypeState] = []
    thresholds: dict[str, float] = {}


class GeneratorDeviceList(WireModel):
    devices: list[GeneratorDevice]
    detected: int
    partial: int
    open_alerts: int
    last_detect_at: str | None
    log_enabled: bool


class GeneratorSummaryValue(WireModel):
    value: Any
    unit: str


class GeneratorLiveBrief(WireModel):
    id: str
    name: str
    area_id: str | None
    status: DeviceStatus
    availability: Availability
    stale: bool
    open_alerts: int
    open_critical: int
    roles: list[str]
    summary: dict[str, GeneratorSummaryValue]
    """The available values of the picker / home widget roles (role key -> value)."""


class GeneratorLiveAll(WireModel):
    devices: list[GeneratorLiveBrief]
    open_alerts: int
    at: str


class GeneratorLive(WireModel):
    id: str
    availability: Availability
    stale: bool
    values: dict[str, GeneratorValue]
    at: str


class GeneratorFound(WireModel):
    id: str
    kind: str
    status: str
    roles: int


class GeneratorDetect(WireModel):
    found: list[GeneratorFound]
    count: int
    last_detect_at: str | None


class GeneratorDeviceCandidate(WireModel):
    ha_device_id: str
    name: str
    entities: int
    mapped_roles: int
    registered: bool


class GeneratorDeviceCandidates(WireModel):
    items: list[GeneratorDeviceCandidate]


class GeneratorEntityCandidate(WireModel):
    entity_id: str
    name: str
    unit: str | None
    score: Num


class GeneratorRoleMapping(WireModel):
    role: str
    label: str
    label_en: str = ""
    """GEN-SENSOR-NAMES-EN-2520 (additive): the role's English name (the sensor-mapping tab on an English page)."""
    kind: str
    unit: str
    core: bool
    mapped: bool
    entity_id: str | None
    entity_name: str | None
    mapped_by: Literal["auto", "manual"] | None
    unmapped_by_user: bool
    disabled_in_source: bool
    candidates: list[GeneratorEntityCandidate]


class GeneratorRoleMappings(WireModel):
    items: list[GeneratorRoleMapping]


class GeneratorHistoryPoint(WireModel):
    t: int
    """Bucket start, epoch seconds (UTC)."""
    v: Num
    min: Num
    max: Num


class GeneratorHistory(WireModel):
    step_s: int
    source: Literal["raw", "rollup_5m"]
    from_: int = Field(alias="from")
    to: int
    series: dict[str, list[GeneratorHistoryPoint]]
    units: dict[str, str]
    labels: dict[str, str]
    range: str


class GeneratorRun(WireModel):
    """One run of the run log (services/generator_log.run_out)."""
    id: str
    kind: RunKind
    kind_reason: str | None
    started_at: str
    ended_at: str | None
    open: bool
    end_reason: str | None
    duration_s: int
    hours: float
    hours_from_counter: bool
    hours_start: float | None
    hours_end: float | None
    took_load: bool
    mode_at_start: str | None
    mains_at_start: bool | None
    fuel_start_pct: float | None
    fuel_end_pct: float | None
    fuel_used_pct: float | None
    fuel_used_l: float | None
    peak_load_pct: float | None
    peak_kw: float | None
    short: bool


class GeneratorFuelEvent(WireModel):
    id: str
    kind: Literal["refill", "drop"]
    started_at: str
    ended_at: str
    from_pct: float
    to_pct: float
    delta_pct: float


class GeneratorRunCounters(WireModel):
    run_hours: Num | None
    starts: Num | None
    fuel_pct: Num | None
    fuel_l: Num | None


class GeneratorRunSummary(WireModel):
    runs: int
    by_kind: dict[str, int]
    run_s: int
    hours: Num
    fuel_used_pct: Num
    fuel_used_l: float | None
    refills: int
    refilled_pct: Num
    drops: int
    short_tests: int
    last_test: GeneratorRun | None
    last_mains_failure: GeneratorRun | None
    test_interval_days: int
    next_test_due: str | None
    test_overdue: bool
    current: GeneratorRun | None
    counters: GeneratorRunCounters


class GeneratorRuns(WireModel):
    runs: list[GeneratorRun]
    total: int
    page: int
    page_size: int
    pages: int
    fuel_events: list[GeneratorFuelEvent]
    summary: GeneratorRunSummary
    range: str
    from_: str | None = Field(alias="from")
    to: str | None
    at: str


class GeneratorAlert(WireModel):
    """One generator alert (services/generator_alerts._alert_dict)."""
    id: str
    device_id: str
    device_name: str | None
    key: str
    group: str | None
    title: str
    severity: Severity
    state: Literal["open", "closed"]
    raised_at: str
    cleared_at: str | None
    last_at: str
    count: int
    acknowledged: bool
    acked_by: str | None
    acked_at: str | None
    ack_note: str | None


class GeneratorAlertList(WireModel):
    alerts: list[GeneratorAlert]
    next_before: str | None
    open_count: int


class GeneratorAlertEvent(WireModel):
    """A timeline entry: raised / acknowledged / cleared, and the notification centre's escalated / delivery_failed / folded."""
    at: str
    kind: str
    step: int | None = None
    count: int | None = None
    channel: str | None = None
    by: str | None = None
    note: str | None = None


class GeneratorAlertDetail(GeneratorAlert):
    snapshot: dict[str, Any]
    """The values when the alert was raised, as stored."""
    timeline: list[GeneratorAlertEvent]
    muted_until: str | None


class GeneratorMuted(WireModel):
    muted_until: str


class GeneratorAcknowledged(WireModel):
    acknowledged: int


class GeneratorRecipients(WireModel):
    roles: list[str]
    users: list[str]


class GeneratorPolicy(WireModel):
    """An alert type's stored routing (services/generator_alerts._policy_dict)."""
    enabled: bool
    severity: Severity
    recipients: GeneratorRecipients
    channels: list[str]
    quiet_mode: Literal["pass", "matrix", "hold"]
    escalate: bool
    after_s: int
    escalate_after_s: int
    template_he: str | None
    row_version: int


class GeneratorSeverityRouting(WireModel):
    """The default recipients and channels of one severity on a generator."""
    recipients: GeneratorRecipients
    channels: list[str]
    row_version: int


class GeneratorPolicyGroup(WireModel):
    key: str
    title: str


class GeneratorPolicyItem(WireModel):
    key: str
    group: str
    title: str
    title_en: str
    default_severity: Severity
    event: bool
    available: bool
    needs: str | None
    needs_en: str | None = None
    """GEN-SENSOR-NAMES-EN-2520 (additive): the "requires sensor" names in English; null when the type is available."""
    message: str
    message_sample: str
    policy: GeneratorPolicy | None


class GeneratorRoutableRole(WireModel):
    id: str
    label: str


class GeneratorPolicies(WireModel):
    groups: list[GeneratorPolicyGroup]
    items: list[GeneratorPolicyItem]
    available: int
    total: int
    severity_defaults: dict[str, GeneratorSeverityRouting | None]
    severity_channels: list[str]
    critical_escalate_after_min: int
    channels: list[str]
    channels_reserved: list[str]
    quiet_modes: list[str]
    placeholders: dict[str, str]
    template_max: int
    note: str
    roles: list[GeneratorRoutableRole]


class GeneratorPreview(WireModel):
    text: str


class GeneratorPoliciesReset(WireModel):
    reset: int


class GeneratorLogSpec(WireModel):
    type: Literal["bool", "int", "float"]
    default: bool | int | float
    min: Num | None
    max: Num | None


class GeneratorSettings(WireModel):
    integration_domains: list[str]
    known_domains: list[str]
    thresholds: dict[str, float]
    threshold_defaults: dict[str, float]
    threshold_limits: dict[str, list[Num]]
    thresholds_set: list[str]
    alert_retention_days: int
    history_retention_days: int
    stale_after_s: int
    critical_escalate_after_min: int
    limits: dict[str, list[int]]
    log_enabled: bool
    log: dict[str, bool | int | float]
    """The run-log settings in force (services/generator_log.LOG_SPECS keys)."""
    log_specs: dict[str, GeneratorLogSpec]
