"""Response models of the cold-chain / temperature API (routers/temperature.py, `/api/v1/infra/temperature...`; CR-INFRA-TEMPERATURE
2.9.1, phases 2 and 3, TEMPEXPLAIN093-295, TEMPLINK-295, TEMPVENDOR-295, TEMPREPORT-297). Temperatures, bands and rates are `Num`: a stored
REAL, a rounded float or a configured integer keep their own JSON number type. Computed documents the router passes through (a unit's
effective rules, the sensor health, the hourly insights, a report unit, an explanation factor's evidence, the alert settings' kinds) are
`dict` / `Any` here and typed by the frontend where it reads them. Entity ids come only to holders of infra.temperature.manage (absent
otherwise). Field order is the order the router builds its dicts in."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from . import Num, WireModel

# routes without a JSON body: the PDF, the CSV and the 204 deletes
NO_JSON = frozenset({
    "GET /infra/temperature/report.pdf", "GET /infra/temperature/events.csv", "DELETE /infra/temperature/report/links/{link_id}",
    "DELETE /infra/temperature/report/schedules/{schedule_id}", "DELETE /infra/temperature/{unit_id}", "DELETE /infra/temperature/{unit_id}/defrost/learned",
})

UnitStatus = Literal["ok", "warning", "alarm", "offline", "off", "unknown"]


# ---------------------------------------------------------------- the operator view

class TempEvent(WireModel):
    """One alert-log row (routers/temperature._event_out). `alarm_at` only on an open warning in a unit's view (when it turns into an
    alarm; null = the alarm is off); `unit_name` only in the log."""
    id: str
    unit_id: str
    kind: str
    severity: Literal["info", "warning", "alarm"]
    started_at: str
    warned_at: str | None
    alarmed_at: str | None
    ended_at: str | None
    value: Num | None
    peak: Num | None
    threshold: Num | None
    suppressed: str | None
    ack_at: str | None
    escalation_level: int
    ticket_id: str | None
    ack_by_name: str | None
    notified: bool
    detail: dict[str, Any]
    alarm_at: str | None = None
    unit_name: str = None


class TempHvac(WireModel):
    setpoint: Num | None
    setpoint_low: Num | None
    setpoint_high: Num | None
    hvac_mode: str | None
    hvac_action: str | None


class TempDoor(WireModel):
    open: bool | None
    since: str | None
    sensor_name: str


class TempDefrostWindow(WireModel):
    start_min: int
    minutes: Num
    status: str
    repeats: int = None


class TempDefrost(WireModel):
    mode: Literal["fixed", "learn", "none"]
    in_window: bool
    next_at: str | None
    state: str
    days: Num
    """Days of learning so far (the learner may store a fraction)."""
    windows: list[TempDefrostWindow]


class TempStats24h(WireModel):
    min: Num | None
    max: Num | None
    avg: Num | None
    out_min: int
    out_min_raw: int
    door_opens: int
    door_total_min: int
    door_longest_min: int
    alarms: int
    warnings: int


class TempStats(TempStats24h):
    """The statistics of a range (history): the 24-hour set plus how many samples and from which table."""
    samples: int
    source: Literal["raw", "5m"]


class TempPrediction(WireModel):
    side: Literal["high", "low"]
    threshold: Num
    eta_min: int
    rate_h: Num


class TempInsights(WireModel):
    """Recomputed hourly (phase 3, ideas 2 and 6): the door effect and the compressor duty cycle (computed documents)."""
    door: dict[str, Any] | None
    duty: dict[str, Any] | None
    computed_at: str | None


class TempPower(WireModel):
    w: Num | None
    on: bool | None
    sensor_name: str


class TempMaintenance(WireModel):
    until: str
    reason: str | None
    by_name: str | None


class TempLinkedTicket(WireModel):
    ticket_id: str
    number: int
    event_id: str | None
    status: str | None
    created_at: str


class TempUnit(WireModel):
    """One unit with its live status (routers/temperature._unit_out). `spark`, `doors_24h`, `defrost_24h` with spark=1; the entity ids
    only to managers."""
    id: str
    name: str
    kind: str
    area_id: str | None
    area_name: str | None
    low: Num
    high: Num
    hard_max: Num
    band_mode: Literal["fixed", "setpoint"]
    source: Literal["sensor", "climate"]
    hvac: TempHvac | None
    status: UnitStatus
    value: Num | None
    value_last: Num | None
    updated_at: str | None
    trend: Literal["up", "down", "flat"] | None
    temp_sensor_name: str
    door: TempDoor | None
    events: list[TempEvent]
    defrost: TempDefrost
    muted_until: str | None
    rules: dict[str, Any]
    """The unit's effective rules (the installation defaults with its overrides)."""
    stats_24h: TempStats24h
    stale: bool
    floor_id: str | None
    floor_name: str | None
    floor_level: Num | None
    prediction: TempPrediction | None
    health: dict[str, Any]
    """The temperature sensor's own device: battery, signal, reading age, a frozen value, `issues`."""
    insights: TempInsights
    power: TempPower | None
    maintenance: TempMaintenance | None
    tickets: list[TempLinkedTicket]
    spark: list[list[Num | None]] = None
    doors_24h: list[list[int]] = None
    defrost_24h: list[list[int]] = None
    temp_entity_id: str = None
    door_entity_id: str | None = None
    power_entity_id: str | None = None


class TempUnits(WireModel):
    """`GET /infra/temperature`: every enabled unit the caller may see, the status counts and the module switches the grid reads."""
    units: list[TempUnit]
    summary: dict[str, int]
    stale: bool
    at: str
    can_manage: bool
    can_ack: bool
    grouping: str
    home_widget: bool
    ticket_department_id: str | None
    explain: bool


class TempEvents(WireModel):
    events: list[TempEvent]
    total: int


class TempHistory(WireModel):
    """`GET /infra/temperature/{id}/history`: points [ts, avg, min, max, defrost 0/1, setpoint|null], door openings, defrost windows."""
    from_: int = Field(alias="from")
    to: int
    step: int
    source: Literal["raw", "5m"]
    points: list[list[Num | None]]
    low: Num
    high: Num
    doors: list[list[int]]
    defrost: list[list[int]]
    stats: TempStats
    zone: str


class TempAcked(WireModel):
    acked: int
    at: str


class TempMuted(WireModel):
    muted_until: str | None


class TempMaintenanceAnswer(WireModel):
    maintenance: TempMaintenance | None


class TempDefrostDecided(WireModel):
    """The unit's learned defrost windows after a confirm / reject (the stored rows)."""
    windows: list[dict[str, Any]]


# ---------------------------------------------------------------- management

class TempRecipients(WireModel):
    roles: list[str]
    users: list[str]
    groups: list[str]


class TempFixedWindow(WireModel):
    start: str
    minutes: int


class TempManagedUnit(WireModel):
    """One unit as the management screen edits it (every unit, enabled or not)."""
    id: str
    name: str
    kind: str
    area_id: str | None
    enabled: bool
    sort_order: int
    revision: int
    temp_entity_id: str
    temp_sensor_name: str
    temp_missing: bool
    door_entity_id: str | None
    door_sensor_name: str
    door_missing: bool
    door_invert: bool
    low: Num
    high: Num
    band_mode: Literal["fixed", "setpoint"]
    power_entity_id: str | None
    power_sensor_name: str
    power_missing: bool
    source: Literal["sensor", "climate"]
    rules: dict[str, Any]
    """The unit's own overrides only."""
    recipients: TempRecipients | None
    defrost_mode: Literal["fixed", "learn", "none"]
    defrost_windows: list[TempFixedWindow]


class TempRuleSpec(WireModel):
    type: str
    min: Num | None
    max: Num | None
    choices: list[str] = None


class TempArea(WireModel):
    area_id: str
    name: str
    floor_name: str | None


class TempManage(WireModel):
    units: list[TempManagedUnit]
    defaults: dict[str, Any]
    rule_specs: dict[str, TempRuleSpec]
    kinds: list[str]
    templates: dict[str, list[Num]]
    areas: list[TempArea]


class TempCandidate(WireModel):
    """A sensor the setter may link (friendly name first; the id for the setter, who manages the module)."""
    entity_id: str
    name: str
    device_class: str | None
    area_name: str | None
    group: Literal["sensor", "climate", "door", "power"]
    value: Num | None
    setpoint: Num | None
    hvac_mode: str | None
    state: str | None
    watts: Num | None


class TempCandidates(WireModel):
    items: list[TempCandidate]


class TempSettings(WireModel):
    """The installation defaults of every rule, the code defaults, the settings row version and the specs of every rule."""
    rules: dict[str, Any]
    code_defaults: dict[str, Any]
    row_version: int
    rule_specs: dict[str, TempRuleSpec]


class TempRoleLabel(WireModel):
    id: str
    label: str


class TempAlertSettings(WireModel):
    """Who is alerted per alert kind, the escalation chain (phase 3, idea 4) and what the editor offers."""
    kinds: dict[str, dict[str, Any]]
    escalation: dict[str, Any]
    row_version: int
    roles: list[TempRoleLabel]
    channels: list[str]
    kinds_order: list[str]
    steps_max: int
    can_edit: bool


# ---------------------------------------------------------------- tickets and the explanation

class TempDepartment(WireModel):
    id: str
    name: str


class TempTicketDraft(WireModel):
    """The prefilled ticket and the departments the caller may open it in."""
    title: str
    description: str
    departments: list[TempDepartment]
    department_id: str | None
    attach_chart: bool


class TempTicketOpened(WireModel):
    ticket_id: str
    number: int
    result: Literal["created", "absorbed"]
    chart_attached: bool


class TempExplainFactor(WireModel):
    key: str
    score: int
    vars: dict[str, Any]


class TempExplainProfile(WireModel):
    rate_h: Num | None
    duration_min: int
    ongoing: bool


class TempExplanation(WireModel):
    """TEMPEXPLAIN093-295: why an excursion happened (rule-based). Without samples: no factors, `reason` no_samples and no band."""
    unit_id: str
    event_id: str | None
    kind: Literal["high", "low"]
    started_at: str | None
    ended_at: str | None
    peak: Num | None
    low: Num = None
    high: Num = None
    factors: list[TempExplainFactor]
    primary: str | None
    confidence: Literal["high", "medium", "low", "none"]
    profile: TempExplainProfile | None
    reason: Literal["no_samples"] | None
    neighbors_scope: str
    generated_at: str


# ---------------------------------------------------------------- the report, its links and the WhatsApp summary

class TempReportSignature(WireModel):
    mode: Literal["line"]


class TempReportInstaller(WireModel):
    name: str
    contact: str


class TempReportPreview(WireModel):
    """`GET /infra/temperature/report/preview`: the report model (the sample lists cut for the dialog) with its texts. A report unit is a
    computed document (stats, points, events, the HACCP daily table, the samples)."""
    v: int
    lang: Literal["he", "en"]
    from_: int = Field(alias="from")
    to: int
    zone: str
    generated: int
    units: list[dict[str, Any]]
    chart: bool
    events: bool
    signature: TempReportSignature | None
    layout: Literal["standard", "haccp"]
    samples: bool
    installer: TempReportInstaller = None
    digest: str
    range_text: str
    text_summary: str
    filename: str


class TempReportLink(WireModel):
    """A temporary report link as the dialog may see it: ids, times and counts - never the token."""
    id: str
    filename: str
    created_at: str
    expires_at: str
    opens: int
    max_opens: int
    state: Literal["live", "expired", "revoked", "used"]
    created_by: str | None
    sent: bool
    recipient: str | None


class TempReportLinkCreated(TempReportLink):
    """The new link with its URL (returned once)."""
    url: str


class TempAvailable(WireModel):
    available: bool


class TempReportLinks(WireModel):
    available: bool
    hours: int
    max_opens: int
    whatsapp: TempAvailable
    links: list[TempReportLink]


class TempRevoked(WireModel):
    revoked: int


class TempLinkSendResult(WireModel):
    user_id: str
    name: str
    status: Literal["sent", "not_sendable", "failed"]
    reason: str | None


class TempLinkSent(WireModel):
    """WALINK-295: one typed result per recipient; `not_sendable` is never a sent."""
    status: Literal["sent", "partial", "not_sendable", "failed"]
    sent: int
    not_sendable: int
    failed: int
    results: list[TempLinkSendResult]


class TempReportUser(WireModel):
    id: str
    name: str
    reach: Literal["ok", "no_address", "no_consent"]
    selectable: bool


class TempReportVendor(WireModel):
    """A vendor: selectable only while vendor reports are on and a channel can carry the report (`channels`: per channel `ok` or why not)."""
    id: str
    name: str
    company: str | None
    has_phone: bool
    selectable: bool
    reason: str | None
    channels: dict[str, str] = None
    channel: Literal["whatsapp", "email"] = None


class TempSendHours(WireModel):
    from_: str = Field(alias="from")
    to: str


class TempVendorReports(WireModel):
    enabled: bool
    email: bool


class TempReportRecipients(WireModel):
    users: list[TempReportUser]
    vendors: list[TempReportVendor]
    attachment: Literal["link", "none"]
    user_attachment: Literal["link", "none"]
    attachment_modes: list[str]
    vendor_reports: TempVendorReports
    send_hours: TempSendHours


class TempSendRow(WireModel):
    id: str
    name: str
    status: str
    reason: str | None
    not_before: str
    finished_at: str | None
    kind: Literal["vendor"] = None
    channel: str | None = None


class TempSends(WireModel):
    sends: list[TempSendRow]


class TempReportSent(WireModel):
    """`POST /infra/temperature/report/send` (202): the batch, how many sends were queued (vendors among them) and each send."""
    batch_id: str
    queued: int
    vendors: int
    sends: list[TempSendRow]


class TempScheduleRecipient(WireModel):
    kind: Literal["user", "vendor"]
    id: str
    channel: Literal["whatsapp", "email"] = None


class TempSchedule(WireModel):
    """A report schedule (the stored row with its units and recipients)."""
    id: str
    range_key: str
    lang: Literal["he", "en"]
    freq: Literal["daily", "weekly", "monthly"]
    dow: int | None
    dom: int | None
    at: str
    enabled: bool
    created_by: str | None
    created_at: str
    updated_at: str
    last_run_at: str | None
    next_run_at: str
    units: list[str]
    recipients: list[TempScheduleRecipient]


class TempSchedules(WireModel):
    schedules: list[TempSchedule]
