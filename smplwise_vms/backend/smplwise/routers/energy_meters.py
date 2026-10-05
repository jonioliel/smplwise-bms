"""CR-023 P1 - electricity meters and readings API (`/api/v1/energy/...`). Binding contract:
docs/architecture/ELECTRICITY_INTERFACES.md section 3.

Routes: `GET candidates`, `GET / POST meters`, `GET / PATCH / DELETE meters/{id}`, `POST meters/{id}/replace`,
`GET meters/{id}/series`, `GET meters/{id}/readings`, `GET consumption`, `GET / PATCH settings`.

Permissions (owner decision: three electricity permissions): reads need `energy.view`; the registry, the candidates and the
operational settings need `energy.manage`; the retention values need `system.configure` and the backup switch
`backup.manage`. Every write route checks the permission on a read connection BEFORE the body is read (read_gate; the 403
is audited), then opens the write connection. No money in any of these routes. Nothing here calls the infrastructure:
validation reads the state mirror, readings come from energy.db."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..audit import audit
from ..auth import current_principal, get_conn, get_read_conn, read_gate, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, effective_permissions, require
from ..services import energy_calibration as ecal
from ..services import energy_meters as meters
from ..services import energy_settings as es
from ..services import energy_store as st
from ..services.energy_provider import EnergyProvider, coverage_of
from ..services.timeutil import parse_utc
from .devices import _is_json, _raw_body

router = APIRouter()
VIEW, MANAGE = es.VIEW, es.MANAGE
UTC = dt.timezone.utc
MAX_POINTS = 3000
STEP_S = {"15m": 900, "1h": 3600, "1d": 86400}


# ---------------------------------------------------------------- plumbing

class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _parse(request: Request, raw: bytes, model: type[BaseModel]) -> Any:
    if not _is_json(request.headers.get("content-type")):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields}) from None


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


_viewer = read_gate(lambda conn, principal: require(conn, principal, VIEW, INSTALLATION))
_manager = read_gate(lambda conn, principal: require(conn, principal, MANAGE, INSTALLATION))


def _settings_editor_check(conn: sqlite3.Connection, principal: Principal) -> None:
    """Any permission that may change at least one electricity setting; the audited 403 (energy.manage) otherwise."""
    perms = {s.permission for s in es.SPECS.values()}
    if not any(authorize(conn, principal, p, INSTALLATION).allowed for p in perms):
        require(conn, principal, MANAGE, INSTALLATION)


_settings_editor = read_gate(_settings_editor_check)


def _provider(request: Request, conn: sqlite3.Connection) -> EnergyProvider:
    return EnergyProvider(conn, st.store_for(settings_of(request)))


def _instant(value: str | None, name: str, default: dt.datetime | None = None) -> dt.datetime:
    if value is None:
        if default is None:
            raise ApiError(422, "validation", f"חסר {name}.", details={"fields": [name]})
        return default
    try:
        return parse_utc(value)
    except ValueError:
        raise ApiError(422, "validation", f"{name} חייב להיות זמן UTC (ISO 8601).", details={"fields": [name]}) from None


def _kwh(wh: int | None) -> float | None:
    return None if wh is None else round(wh / 1000.0, 3)


def _iso(value: dt.datetime | None) -> str | None:
    return None if value is None else value.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _today_start(p: EnergyProvider, now: int) -> int:
    return st.day_bounds(st.local_date(now, p.tz), p.tz)[0]


def _month_start(p: EnergyProvider, now: int) -> int:
    return st.day_bounds(st.local_date(now, p.tz).replace(day=1), p.tz)[0]


def _meter_out(p: EnergyProvider, row: sqlite3.Row, status: Any, now: int, accounts_count: int = 0) -> dict[str, Any]:
    today_wh = month_wh = None
    if row["status"] != "retired":
        today_wh = p.consumption_live(row["id"], _today_start(p, now), now)
        month_wh = p.consumption_live(row["id"], _month_start(p, now), now)
    seg = ecal.segment_at(p.segments(row["id"]), now)
    return {
        "id": row["id"], "display_name": row["display_name"], "source_kind": row["source_kind"], "source_ref": row["source_ref"], "unit": row["unit"],
        "device_id": row["device_id"], "device_name": row["device_name"], "entity_name": row["entity_name"],
        "area_id": row["eff_area_id"], "area_name": row["area_name"], "floor_id": row["floor_id"], "floor_name": row["floor_name"],
        "status": row["status"], "status_reason": row["status_reason"],
        "max_kw": row["max_kw"], "revision": row["revision"], "created_at": row["created_at"], "retired_at": row["retired_at"],
        "state": status.state, "last_report_at": _iso(status.last_report_at), "value_kwh": _kwh(status.last_value_wh), "today_kwh": _kwh(today_wh),
        "month_kwh": _kwh(month_wh), "accounts_count": accounts_count,
        # EL6: the calibration in force now (null = none); readings and kWh above are already on the physical meter's scale
        "calibration": None if seg.identity else {"factor": ecal.factor_text(seg.factor), "offset_kwh": _kwh(seg.offset_wh), "effective_date": seg.effective_date},
    }


def _epoch_out(e: sqlite3.Row) -> dict[str, Any]:
    return {"id": e["id"], "started_at": e["started_at"], "ended_at": e["ended_at"], "start_reading_kwh": _kwh(e["start_reading_wh"]),
            "end_reading_kwh": _kwh(e["end_reading_wh"]), "start_reading_wh": e["start_reading_wh"], "end_reading_wh": e["end_reading_wh"],
            "reason": e["reason"], "note": e["note"]}


def _one(request: Request, conn: sqlite3.Connection, meter_id: str, *, detail: bool = False) -> dict[str, Any]:
    p = _provider(request, conn)
    row = meters.require(conn, meter_id)
    now = p.now()
    used = meters.accounts_using(conn, meter_id)
    out = _meter_out(p, row, p.statuses([meter_id])[meter_id], now, len(used))
    if detail:
        out["epochs"] = [_epoch_out(e) for e in meters.epochs(conn, meter_id)]
        out["used_in"] = used
    return out


# ---------------------------------------------------------------- candidates and meters

@router.get("/energy/candidates")
def list_candidates(q: str | None = Query(None, max_length=80), area_id: str | None = Query(None, max_length=80), include_rejected: bool = Query(True),
                    limit: int = Query(50, ge=1, le=200), principal: Principal = Depends(_manager), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Infrastructure sensors that could be electricity meters, with the kWh/kW verdict (energy.manage)."""
    return {"items": meters.candidates(conn, q, area_id, include_rejected, limit)}


@router.get("/energy/meters")
def list_meters(request: Request, include_retired: bool = Query(False), principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Electricity meters with their status (reporting / not reporting / paused), current value and today's kWh (energy.view)."""
    p = _provider(request, conn)
    rows = meters.list_rows(conn, include_retired)
    ids = [r["id"] for r in rows]
    statuses = p.statuses(ids)
    counts = meters.accounts_counts(conn, ids)
    now = p.now()
    return {"items": [_meter_out(p, r, statuses[r["id"]], now, counts[r["id"]]) for r in rows], "stale_after_minutes": int(es.value(conn, "energy.stale_after_minutes"))}


@router.get("/energy/meters/{meter_id}")
def get_meter(meter_id: str, request: Request, principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """One meter with its counter lives (epochs) and the accounts that use it (energy.view)."""
    return _one(request, conn, meter_id, detail=True)


class MeterCreate(_Body):
    source_ref: str = Field(min_length=3, max_length=255, pattern=r"^[a-z_][a-z0-9_]*\.[A-Za-z0-9_]+$")
    display_name: str | None = Field(None, max_length=120)
    area_id: str | None = Field(None, max_length=80)
    max_kw: float | None = Field(None, gt=0, le=10000)


@router.post("/energy/meters", status_code=201)
def create_meter(request: Request, principal: Principal = Depends(_manager), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Register an infrastructure sensor as an electricity meter; the server repeats the kWh validation (energy.manage)."""
    body: MeterCreate = _parse(request, raw, MeterCreate)
    require(conn, principal, MANAGE, INSTALLATION)
    try:
        mid, verdict = meters.create(conn, source_ref=body.source_ref, display_name=body.display_name, area_id=body.area_id, max_kw=body.max_kw, actor=principal.user_id)
    except ApiError as exc:
        audit(conn, actor=principal, action="energy.meter.create", decision="refused", resource_type="energy_meter", resource_id=None, reason=exc.code, request_id=_rid(request))
        raise
    audit(conn, actor=principal, action="energy.meter.create", decision="allowed", resource_type="energy_meter", resource_id=mid, request_id=_rid(request),
          details={"unit": verdict.unit, "verdict": verdict.code})
    out = _one(request, conn, mid, detail=True)
    out["warning"] = verdict.message if verdict.verdict == "warning" else None
    return out


class MeterPatch(_Body):
    revision: int = Field(ge=1)
    display_name: str | None = Field(None, max_length=120)
    area_id: str | None = Field(None, max_length=80)
    max_kw: float | None = Field(None, gt=0, le=10000)
    status: Literal["active", "paused"] | None = None


@router.patch("/energy/meters/{meter_id}")
def patch_meter(meter_id: str, request: Request, principal: Principal = Depends(_manager), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Rename, move to an area, change the plausibility cap, pause or resume (energy.manage; revision-checked)."""
    body: MeterPatch = _parse(request, raw, MeterPatch)
    require(conn, principal, MANAGE, INSTALLATION)
    fields = body.model_dump(exclude_unset=True)
    revision = fields.pop("revision")
    before = meters.get(conn, meter_id)
    changed = meters.update(conn, meter_id, revision, fields)
    if changed:
        details: dict[str, Any] = {"fields": changed}
        if "display_name" in changed and before is not None:  # a meter's friendly name is not a secret; the audit trail shows old and new
            details["name_from"] = before["display_name"]
            details["name_to"] = meters.require(conn, meter_id)["display_name"]
        audit(conn, actor=principal, action="energy.meter.update", decision="allowed", resource_type="energy_meter", resource_id=meter_id, request_id=_rid(request),
              details=details)
    return _one(request, conn, meter_id, detail=True)


@router.delete("/energy/meters/{meter_id}")
def retire_meter(meter_id: str, request: Request, revision: int = Query(ge=1), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Retire a meter (its data is kept); refused while an active account uses it (energy.manage)."""
    require(conn, principal, MANAGE, INSTALLATION)
    meters.retire(conn, meter_id, revision)
    audit(conn, actor=principal, action="energy.meter.retire", decision="allowed", resource_type="energy_meter", resource_id=meter_id, request_id=_rid(request))
    return _one(request, conn, meter_id, detail=True)


class MeterReplace(_Body):
    revision: int = Field(ge=1)
    at: str | None = Field(None, max_length=40)
    old_final_reading_kwh: float | None = Field(None, ge=0, le=1e9)
    new_start_reading_kwh: float | None = Field(None, ge=0, le=1e9)
    new_source_ref: str | None = Field(None, min_length=3, max_length=255, pattern=r"^[a-z_][a-z0-9_]*\.[A-Za-z0-9_]+$")
    note: str | None = Field(None, max_length=500)


@router.post("/energy/meters/{meter_id}/replace")
def replace_meter(meter_id: str, request: Request, principal: Principal = Depends(_manager), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Meter replacement or a new source sensor: closes the counter life and starts a new one (energy.manage)."""
    body: MeterReplace = _parse(request, raw, MeterReplace)
    require(conn, principal, MANAGE, INSTALLATION)
    now = dt.datetime.now(UTC).replace(microsecond=0)
    at = _instant(body.at, "at", now)
    if at > now + dt.timedelta(minutes=5):
        raise ApiError(422, "validation", "מועד ההחלפה בעתיד.", details={"fields": ["at"]})
    final_wh = None if body.old_final_reading_kwh is None else int(round(body.old_final_reading_kwh * 1000))
    start_wh = None if body.new_start_reading_kwh is None else int(round(body.new_start_reading_kwh * 1000))
    at_iso = _iso(at)
    # EL6: the old meter's final reading is typed from the physical meter (kept so on the epoch); the store gets it on the counter's
    # own scale through the calibration in force just before the replacement. The new counter life starts uncalibrated.
    counter_final = None if final_wh is None else ecal.segment_at(ecal.segments(conn, meter_id), int(at.timestamp()) - 1).counter(final_wh)
    epoch_id, reason = meters.replace(conn, meter_id, body.revision, at=at_iso, final_wh=final_wh, start_wh=start_wh, new_ref=body.new_source_ref,
                                      note=body.note, actor=principal.user_id)
    p = _provider(request, conn)
    res = p.store.start_epoch(meter_id, at=int(at.timestamp()), epoch_id=epoch_id, tz=p.tz, final_wh=counter_final, start_wh=start_wh)
    audit(conn, actor=principal, action="energy.meter.replace", decision="allowed", resource_type="energy_meter", resource_id=meter_id, request_id=_rid(request),
          details={"reason": reason, "manual_wh": res["manual_wh"], "typed_final": final_wh is not None, "typed_start": start_wh is not None})
    return _one(request, conn, meter_id, detail=True)


# ---------------------------------------------------------------- EL6: manual readings and calibration

class ManualReadingBody(_Body):
    read_at: str = Field(max_length=40)
    value: float | str = Field()
    unit: Literal["kWh", "Wh", "MWh"] = "kWh"
    note: str | None = Field(None, max_length=500)
    dry_run: bool = False


class CalibrationBody(_Body):
    effective_date: dt.date
    factor: float | str = "1"
    offset_kwh: float | str | None = None
    anchor_reading_id: str | None = Field(None, max_length=40)
    note: str | None = Field(None, max_length=500)
    dry_run: bool = False


class UndoBody(_Body):
    reason: str | None = Field(None, max_length=300)


def _now_s() -> int:
    return int(dt.datetime.now(UTC).timestamp())


def _log(request: Request, conn: sqlite3.Connection, meter_id: str) -> dict[str, Any]:
    p = _provider(request, conn)
    return ecal.meter_log(conn, p.store, p.tz, meters.require(conn, meter_id), now=_now_s())


@router.get("/energy/meters/{meter_id}/manual-readings")
def manual_log(meter_id: str, request: Request, principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The meter's manual readings and calibrations (undone ones included, with who and when), the calibration in force, a suggested
    factor from two compared readings, and the first date a calibration may start (after the last issued bill) (energy.view)."""
    return _log(request, conn, meter_id)


@router.post("/energy/meters/{meter_id}/manual-readings")
def add_manual_reading(meter_id: str, request: Request, principal: Principal = Depends(_manager), raw: bytes = Depends(_raw_body),
                       conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A reading of the physical meter at an instant (energy.manage). Validated (not in the future, not before the meter, never lower
    than an earlier manual reading of the same counter, a known unit); `dry_run` answers what it would do without saving. It closes
    or re-splits a reporting gap when it can, else it is kept for comparison (`effect`, `effect_reason`, `message`)."""
    body: ManualReadingBody = _parse(request, raw, ManualReadingBody)
    require(conn, principal, MANAGE, INSTALLATION)
    at = _instant(body.read_at, "read_at")
    p = _provider(request, conn)
    meter = meters.require(conn, meter_id)
    try:
        out = ecal.save_reading(conn, p.store, p.tz, meter, read_at=int(at.timestamp()), value=body.value, unit=body.unit, note=body.note,
                                actor=principal.user_id, now=_now_s(), dry_run=body.dry_run)
    except ApiError as exc:
        if not body.dry_run:
            audit(conn, actor=principal, action="energy.meter.manual_reading", decision="refused", resource_type="energy_meter", resource_id=meter_id,
                  reason=exc.code, request_id=_rid(request))
        raise
    if body.dry_run:
        return {"dry_run": True, "reading": out}
    audit(conn, actor=principal, action="energy.meter.manual_reading", decision="allowed", resource_type="energy_meter", resource_id=meter_id, request_id=_rid(request),
          details={"reading_id": out["id"], "read_at": out["read_at"], "value_wh": out["value_wh"], "unit": body.unit, "effect": out["effect"],
                   "effect_reason": out["effect_reason"]})
    return {"dry_run": False, "reading": out, "log": _log(request, conn, meter_id)}


@router.post("/energy/meters/{meter_id}/manual-readings/{reading_id}/undo")
def undo_manual_reading(meter_id: str, reading_id: str, request: Request, principal: Principal = Depends(_manager), raw: bytes = Depends(_raw_body),
                        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Undo a manual reading within 24 hours of saving it, while no issued bill depends on it (energy.manage). It stays in the list,
    marked as undone."""
    body: UndoBody = _parse(request, raw, UndoBody)
    require(conn, principal, MANAGE, INSTALLATION)
    p = _provider(request, conn)
    meter = meters.require(conn, meter_id)
    try:
        r = ecal.undo_reading(conn, p.store, p.tz, meter, reading_id, reason=body.reason, actor=principal.user_id, now=_now_s())
    except ApiError as exc:
        audit(conn, actor=principal, action="energy.meter.manual_reading.undo", decision="refused", resource_type="energy_meter", resource_id=meter_id,
              reason=exc.code, request_id=_rid(request), details={"reading_id": reading_id})
        raise
    audit(conn, actor=principal, action="energy.meter.manual_reading.undo", decision="allowed", resource_type="energy_meter", resource_id=meter_id,
          request_id=_rid(request), details={"reading_id": reading_id, "effect": r["effect"], "read_at": r["read_at"]})
    return _log(request, conn, meter_id)


@router.post("/energy/meters/{meter_id}/calibrations")
def add_calibration(meter_id: str, request: Request, principal: Principal = Depends(_manager), raw: bytes = Depends(_raw_body),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Calibrate the system counter against the physical meter from a date on (energy.manage): physical = factor x counter + offset.
    The offset comes from a manual reading (`anchor_reading_id`) or is typed. Starts after the previous calibration and after the
    last issued bill with the meter; history is never rewritten."""
    body: CalibrationBody = _parse(request, raw, CalibrationBody)
    require(conn, principal, MANAGE, INSTALLATION)
    p = _provider(request, conn)
    meter = meters.require(conn, meter_id)
    try:
        out = ecal.save_calibration(conn, p.store, p.tz, meter, effective_date=body.effective_date, factor=body.factor, offset_kwh=body.offset_kwh,
                                    anchor_reading_id=body.anchor_reading_id, note=body.note, actor=principal.user_id, now=_now_s(), dry_run=body.dry_run)
    except ApiError as exc:
        if not body.dry_run:
            audit(conn, actor=principal, action="energy.meter.calibrate", decision="refused", resource_type="energy_meter", resource_id=meter_id,
                  reason=exc.code, request_id=_rid(request))
        raise
    if body.dry_run:
        return {"dry_run": True, "calibration": out}
    audit(conn, actor=principal, action="energy.meter.calibrate", decision="allowed", resource_type="energy_meter", resource_id=meter_id, request_id=_rid(request),
          details={"calibration_id": out["id"], "effective_date": out["effective_date"], "factor": out["factor"], "offset_wh": out["offset_wh"],
                   "anchor_reading_id": out["anchor_reading_id"]})
    return {"dry_run": False, "calibration": out, "log": _log(request, conn, meter_id)}


@router.post("/energy/meters/{meter_id}/calibrations/{calibration_id}/undo")
def undo_calibration(meter_id: str, calibration_id: str, request: Request, principal: Principal = Depends(_manager), raw: bytes = Depends(_raw_body),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Undo a calibration within 24 hours of saving it, while no issued bill uses it (energy.manage)."""
    body: UndoBody = _parse(request, raw, UndoBody)
    require(conn, principal, MANAGE, INSTALLATION)
    meter = meters.require(conn, meter_id)
    try:
        ecal.undo_calibration(conn, meter, calibration_id, reason=body.reason, actor=principal.user_id, now=_now_s())
    except ApiError as exc:
        audit(conn, actor=principal, action="energy.meter.calibration.undo", decision="refused", resource_type="energy_meter", resource_id=meter_id,
              reason=exc.code, request_id=_rid(request), details={"calibration_id": calibration_id})
        raise
    audit(conn, actor=principal, action="energy.meter.calibration.undo", decision="allowed", resource_type="energy_meter", resource_id=meter_id,
          request_id=_rid(request), details={"calibration_id": calibration_id})
    return _log(request, conn, meter_id)


# ---------------------------------------------------------------- readings and consumption

def _range(frm: str | None, to: str | None, default_span: dt.timedelta) -> tuple[dt.datetime, dt.datetime]:
    end = _instant(to, "to", dt.datetime.now(UTC).replace(microsecond=0))
    start = _instant(frm, "from", end - default_span)
    if end <= start:
        raise ApiError(422, "validation", "טווח הזמן אינו תקין.", details={"fields": ["from", "to"]})
    return start, end


@router.get("/energy/meters/{meter_id}/series")
def meter_series(meter_id: str, request: Request, frm: str | None = Query(None, alias="from", max_length=40), to: str | None = Query(None, max_length=40),
                 step: Literal["15m", "1h", "1d"] = Query("1h"), principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Consumption series of one meter in kWh per 15 minutes, hour or local day (energy.view; at most 3000 points)."""
    meters.require(conn, meter_id)
    p = _provider(request, conn)
    start, end = _range(frm, to, dt.timedelta(days=1 if step != "1d" else 31))
    items: list[dict[str, Any]] = []
    if step == "1d":
        d0 = start.astimezone(p.tz).date()
        d1 = end.astimezone(p.tz).date()
        if st.day_bounds(d1, p.tz)[0] < int(end.timestamp()):
            d1 += dt.timedelta(days=1)
        if (d1 - d0).days > MAX_POINTS:
            raise ApiError(422, "range_too_large", "טווח הזמן ארוך מדי.")
        rows = p.daily_rows(meter_id, d0, d1)
        d = d0
        while d < d1:
            a, b = st.day_bounds(d, p.tz)
            r = rows.get(d)
            wh = r[0] if r and r[1] > 0 else None
            items.append({"start": _iso(dt.datetime.fromtimestamp(a, UTC)), "end": _iso(dt.datetime.fromtimestamp(b, UTC)), "date": d.isoformat(),
                          "wh": wh, "kwh": _kwh(wh), "coverage": coverage_of(r[1] if r else 0, b - a, wh)})
            d += dt.timedelta(days=1)
    else:
        size = STEP_S[step]
        a = int(start.timestamp()) // size * size
        b = int(end.timestamp())
        if (b - a) / size > MAX_POINTS:
            raise ApiError(422, "range_too_large", "טווח הזמן ארוך מדי לרזולוציה הזו.")
        buckets = {bk: (wh, cov) for bk, wh, cov, _q in p.store.intervals(meter_id, a, b)}
        segs = p.segments(meter_id)
        t = a
        while t < b:
            wh_sum, cov_sum, any_row = Decimal(0), 0, False
            for bk in range(t, t + size, st.BUCKET_S):
                hit = buckets.get(bk)
                if hit is not None:
                    any_row = True
                    wh_sum += ecal.segment_at(segs, bk).energy(hit[0])  # EL6: the calibration factor of the quarter hour
                    cov_sum += hit[1]
            wh = ecal.round_int(wh_sum) if any_row and cov_sum > 0 else None
            items.append({"start": _iso(dt.datetime.fromtimestamp(t, UTC)), "end": _iso(dt.datetime.fromtimestamp(t + size, UTC)), "wh": wh, "kwh": _kwh(wh),
                          "coverage": coverage_of(cov_sum, size, wh)})
            t += size
    return {"meter_id": meter_id, "step": step, "unit": "kWh", "items": items}


@router.get("/energy/meters/{meter_id}/readings")
def meter_readings(meter_id: str, request: Request, frm: str | None = Query(None, alias="from", max_length=40), to: str | None = Query(None, max_length=40),
                   limit: int = Query(500, ge=1, le=5000), principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Raw cumulative readings of one meter (kept for the raw retention; energy.view)."""
    from ..services.energy_counter import flag_names

    meters.require(conn, meter_id)
    p = _provider(request, conn)
    start, end = _range(frm, to, dt.timedelta(days=1))
    rows = p.store.readings(meter_id, int(start.timestamp()), int(end.timestamp()), limit + 1)
    items = [{"at": _iso(dt.datetime.fromtimestamp(ts, UTC)), "wh": v, "kwh": _kwh(v), "flags": flag_names(f)} for ts, v, f in rows[:limit]]
    return {"meter_id": meter_id, "items": items, "truncated": len(rows) > limit}


@router.get("/energy/consumption")
def consumption(request: Request, meter_ids: str = Query(min_length=1, max_length=2000), frm: str = Query(alias="from", max_length=40), to: str = Query(max_length=40),
                principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """kWh of each meter between two instants, allocated by time, with coverage and the last report (energy.view)."""
    ids = [m for m in dict.fromkeys(x.strip() for x in meter_ids.split(",")) if m]
    if not ids or len(ids) > 50:
        raise ApiError(422, "validation", "רשימת המונים אינה תקינה (עד 50).", details={"fields": ["meter_ids"]})
    start, end = _range(frm, to, dt.timedelta(days=1))
    p = _provider(request, conn)
    for m in ids:
        meters.require(conn, m)
    statuses = p.statuses(ids)
    items = []
    for m in ids:
        try:
            c = p.consumption(m, start, end)
        except ValueError:
            raise ApiError(422, "validation", "מחוץ לתקופת נתוני הרבע שעה אפשר לשאול רק מחצות לחצות.", details={"fields": ["from", "to"]}) from None
        items.append({"meter_id": m, "wh": c.wh, "kwh": _kwh(c.wh), "coverage": c.coverage, "covered_seconds": c.covered_seconds, "total_seconds": c.total_seconds,
                      "source": c.source, "last_report_at": _iso(statuses[m].last_report_at), "state": statuses[m].state,
                      "events": [{"at": _iso(e.at), "kind": e.kind} for e in c.events]})
    return {"from": _iso(start), "to": _iso(end), "items": items}


# ---------------------------------------------------------------- settings

def _draft_usage(conn: sqlite3.Connection) -> dict[str, int]:
    """Draft bills of the billing branch (retention "טיוטות"): rows and the bytes of their JSON columns; zeros before its table exists."""
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(energy_bills)").fetchall()}
        if not cols:
            return {"rows": 0, "bytes_estimate": 0}
        size = " + ".join(f"COALESCE(LENGTH({c}), 0)" for c in ("snapshot_json", "totals_json") if c in cols) or "0"
        row = conn.execute(f"SELECT COUNT(*), COALESCE(SUM({size}), 0) FROM energy_bills WHERE state = 'draft'").fetchone()
        return {"rows": int(row[0]), "bytes_estimate": int(row[1])}
    except sqlite3.Error:
        return {"rows": 0, "bytes_estimate": 0}


def _settings_out(request: Request, conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    perms = set(effective_permissions(conn, principal, INSTALLATION))
    vals = es.values(conn, perms | {VIEW})
    store = st.store_for(settings_of(request))
    counts = store.counts()
    n_meters = int(conn.execute("SELECT COUNT(*) FROM energy_meters WHERE status <> 'retired'").fetchone()[0])
    est = es.estimate(n_meters, int(vals["energy.raw_retention_days"]), int(vals["energy.interval_retention_months"]), int(vals["energy.bill_retention_years"]))
    storage = {"energy_db_bytes": store.file_bytes(), "classes": {
        "raw": {"rows": counts["readings"], "bytes_estimate": counts["readings"] * es.RAW_ROW_BYTES},
        "intervals": {"rows": counts["intervals"], "bytes_estimate": counts["intervals"] * es.INTERVAL_ROW_BYTES},
        "daily": {"rows": counts["daily"], "bytes_estimate": counts["daily"] * es.DAILY_ROW_BYTES},
        "drafts": _draft_usage(conn)}, "estimate": est}
    editable = {k: s.permission in perms for k, s in es.SPECS.items() if k in vals}
    return {"values": vals, "editable": editable, "ranges": {k: v for k, v in es.ranges().items() if k in vals}, "storage": storage}


@router.get("/energy/settings")
def get_settings(request: Request, principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Electricity settings: retention values with the storage estimate, the not-reporting threshold (energy.view)."""
    return _settings_out(request, conn, principal)


@router.patch("/energy/settings")
def patch_settings(request: Request, principal: Principal = Depends(_settings_editor), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Change electricity settings; each key is checked against its own permission (retention: system.configure)."""
    if not _is_json(request.headers.get("content-type")):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    if not isinstance(data, dict) or not data or len(data) > 50:
        raise ApiError(422, "validation", "יש לשלוח אובייקט של הגדרות.", details={"fields": ["body"]})
    changes: dict[str, str] = {}
    for key, value in data.items():
        text = es.validate(str(key), value)
        require(conn, principal, es.SPECS[key].permission, INSTALLATION)
        changes[key] = text
    before = es.values(conn)
    es.store(conn, changes)
    after = es.values(conn)
    changed = sorted(k for k in changes if before.get(k) != after.get(k))
    if changed:
        audit(conn, actor=principal, action="energy.settings.update", decision="allowed", resource_type="settings", resource_id="energy", request_id=_rid(request),
              details={"keys": changed})
    return _settings_out(request, conn, principal)
