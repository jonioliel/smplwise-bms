"""Response models of the water meters API (routers/water.py, `/api/v1/infra/water/...`; docs/changes/CR-WATER78.md sections 6-10, 16).
Volumes are litres as a float rounded to 3 places; `value` / `today` / `month` are the display form (m3 with 3 decimals, litres below
1 m3). `source_ref` and `rules` are answered only to water.manage (absent otherwise). Field order is the order the router builds its
dicts in."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from . import WireModel

Coverage = Literal["full", "partial", "none"]
MeterKind = Literal["main", "sub", "irrigation", "cooling", "pool", "other"]
MeterState = Literal["reporting", "not_reporting", "paused", "retired"]
EventKind = Literal["night_flow", "abnormal", "burst", "offline", "health"]


class WaterDisplay(WireModel):
    """A volume for display: m3 with 3 decimals, or litres with 1 below 1 m3."""
    value: float
    unit: Literal["m3", "L"]


class WaterStatus(WireModel):
    """The tab gate: the module switch and what the caller may do (any signed-in user; never module_off)."""
    enabled: bool
    can_view: bool
    can_manage: bool
    can_configure: bool
    can_ack: bool
    can_bills: bool
    meters: int


class WaterCandidate(WireModel):
    """An infrastructure sensor that could be a water meter, with the server's volume verdict."""
    ref: str
    name: str
    device_name: str | None
    area_id: str | None
    area_name: str | None
    floor_id: str | None
    floor_name: str | None
    unit: str | None
    device_class: str | None
    state_class: str | None
    state: str | None
    verdict: Literal["ok", "warning", "rejected"]
    code: str
    message: str
    already_meter_id: str | None


class WaterCandidateList(WireModel):
    items: list[WaterCandidate]


class WaterMeterRules(WireModel):
    """The meter's own leak-rule overrides (a key absent = the installation default)."""
    night_rule: bool = None
    abnormal_rule: bool = None
    burst_rule: bool = None
    offline_rule: bool = None
    night_min_lph: float = None
    night_min_intervals: int = None
    abnormal_factor: str = None
    abnormal_min_l: int = None
    burst_lph: float = None
    offline_min: int = None


class WaterEpoch(WireModel):
    id: str
    started_at: str
    ended_at: str | None
    start_reading_l: float | None
    end_reading_l: float | None
    reason: Literal["first", "replaced", "source_changed"]
    note: str | None


class WaterMeter(WireModel):
    """A meter as the list and the detail answer it: `source_ref` and `rules` only for water.manage, `epochs` only on the detail,
    `warning` only on create."""
    id: str
    display_name: str
    medium: Literal["water", "gas"]
    kind: MeterKind
    unit: Literal["L", "m3", "gal", "ft3"]
    device_name: str | None
    area_id: str | None
    area_name: str | None
    floor_id: str | None
    floor_name: str | None
    status: Literal["active", "paused", "retired"]
    status_reason: str | None
    max_flow_lph: float
    revision: int
    created_at: str
    retired_at: str | None
    muted_until: str | None
    state: MeterState
    last_report_at: str | None
    value_l: float | None
    value: WaterDisplay | None
    today_l: float | None
    today: WaterDisplay | None
    month_l: float | None
    month: WaterDisplay | None
    source_ref: str = None
    rules: WaterMeterRules = None
    epochs: list[WaterEpoch] = None
    warning: str | None = None


class WaterMeterList(WireModel):
    items: list[WaterMeter]
    stale_after_minutes: int


# ---------------------------------------------------------------- series, readings, consumption

class WaterSeriesPoint(WireModel):
    start: str
    end: str
    date: str = Field(default=None, description="The local day (`bucket=1d` only).")
    litres: float | None
    value: WaterDisplay | None
    coverage: Coverage


class WaterSeries(WireModel):
    meter_id: str
    bucket: Literal["15m", "1h", "1d"]
    unit: Literal["L"]
    items: list[WaterSeriesPoint]


class WaterReading(WireModel):
    at: str
    litres: float | None
    flags: list[str]


class WaterReadings(WireModel):
    meter_id: str
    items: list[WaterReading]
    truncated: bool


class WaterConsumptionItem(WireModel):
    meter_id: str
    display_name: str
    kind: MeterKind
    area_name: str | None
    floor_name: str | None
    litres: float | None
    value: WaterDisplay | None
    coverage: Coverage
    source: str
    previous_litres: float | None
    share: float | None


class WaterTotalPoint(WireModel):
    start: str
    end: str
    date: str = Field(default=None, description="The local day (`bucket=1d` only).")
    litres: float | None


class WaterConsumption(WireModel):
    """Litres of each visible meter in the range (with the previous range of the same length and its share of the total), the
    installation total and - with `bucket` - the total per hour / local day."""
    from_: str = Field(alias="from")
    to: str
    items: list[WaterConsumptionItem]
    unit: Literal["L"]
    total_litres: float | None
    total: WaterDisplay | None
    previous_total_litres: float | None
    bucket: Literal["1h", "1d"] = None
    series: list[WaterTotalPoint] = None


# ---------------------------------------------------------------- manual readings

class WaterManualReading(WireModel):
    id: str
    read_at: str
    litres: float | None
    typed_value: str
    typed_unit: Literal["L", "m3"]
    effect: Literal["allocation", "record"]
    effect_reason: str
    note: str | None
    created_at: str
    voided_at: str | None


class WaterManualReadings(WireModel):
    meter_id: str
    items: list[WaterManualReading]


class WaterManualReadingResult(WireModel):
    """What a typed reading does (`allocation` / `record` and why); `id` once it is stored (not on a dry run)."""
    effect: Literal["allocation", "record"]
    reason: str | None
    litres: float | None
    dry_run: bool
    id: str = None


# ---------------------------------------------------------------- settings

class WaterSettingRange(WireModel):
    min: int | None
    max: int | None
    kind: str
    label_he: str
    permission: str


class WaterStorageRows(WireModel):
    readings: int
    intervals: int
    daily: int


class WaterStorage(WireModel):
    water_db_bytes: int
    rows: WaterStorageRows


class WaterSettings(WireModel):
    """The `water.*` settings (keys are the setting names); while the module is off only the switch, and no `storage`."""
    values: dict[str, int | bool]
    editable: dict[str, bool]
    ranges: dict[str, WaterSettingRange]
    sampler_running: bool
    storage: WaterStorage = None


# ---------------------------------------------------------------- alerts

class WaterEvent(WireModel):
    """One row of the alert log. `value` holds what fired (litres, a rate, the baseline), as recorded."""
    id: str
    meter_id: str
    meter_name: str
    meter_kind: MeterKind
    area_name: str | None
    floor_name: str | None
    kind: EventKind
    severity: Literal["warning", "alarm"]
    opened_at: str
    closed_at: str | None
    close_reason: str | None
    value: dict[str, Any]
    suppressed: Literal["off", "quiet", "mute", "maintenance"] | None
    ack_at: str | None
    ack_by_display: str | None
    notified: bool
    can_ack: bool
    snoozed_until: str | None
    can_snooze: bool


class WaterEventsKpi(WireModel):
    open: int
    acked: int
    last_7d: int
    open_leaks: int
    snoozed: int


class WaterEvents(WireModel):
    items: list[WaterEvent]
    summary: WaterEventsKpi


class WaterHomeTile(WireModel):
    show: bool
    leaks: int
    link: str


class WaterEventsSummary(WaterEventsKpi):
    """The KPI row and the home tile (shown only while a leak is open and `water.home_kpi` is on)."""
    home_tile: WaterHomeTile


class WaterMute(WireModel):
    meter_id: str
    muted_until: str | None


class WaterRules(WireModel):
    """The installation defaults of the leak rules ('HH:MM' local times)."""
    night_from: str
    night_to: str
    night_min_lph: float
    night_min_intervals: int
    abnormal_factor: str
    abnormal_min_l: int
    baseline_days: int
    offline_min: int
    alerts_enabled: bool
    quiet_enabled: bool
    quiet_from: str
    quiet_to: str
    quiet_includes_alarms: bool
    mute_includes_alarms: bool


class WaterRecipients(WireModel):
    roles: list[str]
    users: list[str]
    groups: list[str]


class WaterRoute(WireModel):
    enabled: bool
    recipients: WaterRecipients
    channels: list[str]


class WaterRouting(WireModel):
    leak: WaterRoute
    abnormal: WaterRoute
    offline: WaterRoute


class WaterSnooze(WireModel):
    durations: list[int]
    default: int
    max: int


class WaterRole(WireModel):
    id: str
    label: str


class WaterSnoozeLimits(WireModel):
    min: int
    max: int
    count: int


class WaterRuleRange(WireModel):
    kind: str
    min: int | float | None
    max: int | float | None


class WaterAlerts(WireModel):
    """The leak rules' defaults, the routing per alert kind, the snooze settings and the choices the editor offers."""
    rules: WaterRules
    kinds: WaterRouting
    snooze: WaterSnooze
    row_version: int
    roles: list[WaterRole]
    channels: list[str]
    kinds_order: list[str]
    mute_minutes: list[int]
    snooze_limits: WaterSnoozeLimits
    ranges: dict[str, WaterRuleRange]
    can_edit: bool
