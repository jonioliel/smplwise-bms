"""Response models of the electricity meters API (routers/energy_meters.py, `/api/v1/energy/...`; contract
docs/architecture/ELECTRICITY_INTERFACES.md section 3). Energy is kWh as a float rounded to 3 places (`_kwh`), raw counters are
integer Wh. Field order is the order the router builds its dicts in."""
from __future__ import annotations

from typing import Literal

from pydantic import Field

from . import WireModel

Coverage = Literal["full", "partial", "none"]
MeterStatus = Literal["active", "paused", "retired"]
MeterState = Literal["reporting", "not_reporting", "paused", "retired"]


# ---------------------------------------------------------------- candidates

class EnergyCandidate(WireModel):
    """An infrastructure sensor that could be a meter, with the server's kWh verdict."""
    ref: str
    name: str
    device_id: str | None
    device_name: str | None
    entity_name: str | None
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


class EnergyCandidateList(WireModel):
    items: list[EnergyCandidate]


# ---------------------------------------------------------------- meters

class EnergyCalibrationInForce(WireModel):
    factor: str
    offset_kwh: float | None
    effective_date: str | None


class EnergyMeterEpoch(WireModel):
    id: str
    started_at: str
    ended_at: str | None
    start_reading_kwh: float | None
    end_reading_kwh: float | None
    start_reading_wh: int | None
    end_reading_wh: int | None
    reason: Literal["first", "replaced", "source_changed"]
    note: str | None


class EnergyMeterUse(WireModel):
    account_id: str
    name: str


class EnergyMeter(WireModel):
    """A meter as the list and the detail answer it; `epochs` and `used_in` only on the detail, `warning` only on create."""
    id: str
    display_name: str
    source_kind: Literal["ha_entity", "satec"]
    source_ref: str
    unit: Literal["kWh", "Wh", "MWh"]
    device_id: str | None
    device_name: str | None
    entity_name: str | None
    area_id: str | None
    area_name: str | None
    floor_id: str | None
    floor_name: str | None
    status: MeterStatus
    status_reason: str | None
    max_kw: float
    revision: int
    created_at: str
    retired_at: str | None
    state: MeterState
    last_report_at: str | None
    value_kwh: float | None
    today_kwh: float | None
    month_kwh: float | None
    accounts_count: int
    calibration: EnergyCalibrationInForce | None
    epochs: list[EnergyMeterEpoch] = None
    used_in: list[EnergyMeterUse] = None
    warning: str | None = None


class EnergyMeterList(WireModel):
    items: list[EnergyMeter]
    stale_after_minutes: int


# ---------------------------------------------------------------- EL6: manual readings and calibration

class EnergyManualReading(WireModel):
    """A typed reading of the physical meter (`id` is null in a dry run)."""
    id: str | None
    read_at: str
    value_wh: int
    value_kwh: float | None
    typed_value: str
    typed_unit: Literal["kWh", "Wh", "MWh"]
    counter_kwh: float | None
    system_kwh: float | None
    system_exact: bool
    deviation_kwh: float | None
    effect: Literal["allocation", "record"]
    effect_reason: str
    message: str
    span_from: str | None
    span_to: str | None
    note: str | None
    created_at: str
    created_by: str | None
    created_by_name: str | None
    voided_at: str | None
    voided_by: str | None
    voided_by_name: str | None
    void_reason: str | None
    can_undo: bool
    undo_until: str | None


class EnergyCalibration(WireModel):
    """A calibration from a date on: physical = factor x counter + offset (`id` is null in a dry run)."""
    id: str | None
    effective_date: str
    effective_from: str
    factor: str
    offset_wh: int
    offset_kwh: float | None
    anchor_reading_id: str | None
    note: str | None
    in_force: bool
    created_at: str
    created_by: str | None
    created_by_name: str | None
    voided_at: str | None
    voided_by: str | None
    voided_by_name: str | None
    void_reason: str | None
    can_undo: bool
    undo_until: str | None


class EnergyCalibrationCurrent(WireModel):
    factor: str
    offset_kwh: float | None
    calibration_id: str | None
    effective_date: str | None
    identity: bool


class EnergyCalibrationSuggestion(WireModel):
    factor: str
    from_reading_id: str
    to_reading_id: str
    anchor_reading_id: str


class EnergyReadingLog(WireModel):
    """The meter's manual readings and calibrations (undone ones included), the calibration in force and a suggested factor."""
    meter_id: str
    items: list[EnergyManualReading]
    calibrations: list[EnergyCalibration]
    calibration: EnergyCalibrationCurrent
    suggestion: EnergyCalibrationSuggestion | None
    billed_until: str | None
    first_calibration_date: str | None
    undo_window_hours: int
    units: list[str]


class EnergyManualReadingSaved(WireModel):
    """POST manual-readings: the reading, and the meter's log unless it was a dry run."""
    dry_run: bool
    reading: EnergyManualReading
    log: EnergyReadingLog = None


class EnergyCalibrationSaved(WireModel):
    """POST calibrations: the calibration, and the meter's log unless it was a dry run."""
    dry_run: bool
    calibration: EnergyCalibration
    log: EnergyReadingLog = None


# ---------------------------------------------------------------- series, readings, consumption

class EnergySeriesPoint(WireModel):
    start: str
    end: str
    date: str = Field(default=None, description="The local day (`step=1d` only).")
    wh: int | None
    kwh: float | None
    coverage: Coverage


class EnergySeries(WireModel):
    meter_id: str
    step: Literal["15m", "1h", "1d"]
    unit: Literal["kWh"]
    items: list[EnergySeriesPoint]


class EnergyReading(WireModel):
    at: str
    wh: int
    kwh: float | None
    flags: list[str]


class EnergyReadings(WireModel):
    meter_id: str
    items: list[EnergyReading]
    truncated: bool


class EnergyCounterEvent(WireModel):
    at: str
    kind: str


class EnergyConsumptionItem(WireModel):
    meter_id: str
    wh: int | None
    kwh: float | None
    coverage: Coverage
    covered_seconds: int
    total_seconds: int
    source: str
    last_report_at: str | None
    state: MeterState
    events: list[EnergyCounterEvent]


class EnergyConsumption(WireModel):
    from_: str = Field(alias="from")
    to: str
    items: list[EnergyConsumptionItem]


# ---------------------------------------------------------------- settings

class EnergySettingRange(WireModel):
    min: int | None
    max: int | None
    kind: str
    choices: list[str] | None
    label_he: str


class EnergyStorageClass(WireModel):
    rows: int
    bytes_estimate: int


class EnergyStorageClasses(WireModel):
    raw: EnergyStorageClass
    intervals: EnergyStorageClass
    daily: EnergyStorageClass
    drafts: EnergyStorageClass


class EnergyStorageEstimate(WireModel):
    meters: int
    raw_bytes: int
    intervals_bytes: int
    daily_bytes: int
    total_bytes: int


class EnergyStorage(WireModel):
    energy_db_bytes: int
    classes: EnergyStorageClasses
    estimate: EnergyStorageEstimate


class EnergySettings(WireModel):
    """The `energy.*` settings the caller may read (keys are the setting names), whether each is editable, their ranges, and the
    storage in use with the estimate."""
    values: dict[str, int | bool]
    editable: dict[str, bool]
    ranges: dict[str, EnergySettingRange]
    storage: EnergyStorage
