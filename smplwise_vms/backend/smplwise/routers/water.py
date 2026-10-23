"""CR-WATER78 slice 1 - water meters, readings and consumption API (`/api/v1/infra/water/...`). Change record:
docs/changes/CR-WATER78.md sections 6-8 (owner decisions 2026-10-23).

Module switch `water.enabled` (default OFF): every route except `GET /status` and `GET|PUT /settings` answers `module_off` (404)
while it is off - before any permission check, so the answer is the same for everyone (the state is public through /status).

Permissions: reads need `water.view` (operator and above; NOT viewer - owner Q4), scoped by the floors of the meter's entity (owner
Q5: a floor-scoped holder sees only the meters placed on his floors; an invisible meter is the uniform 404); the registry, the
candidates and the manual readings need `water.manage` (installation scope); `source_ref` (the entity id) is answered only to
`water.manage`. The switch and the retention need `system.configure`, the backup choice `backup.manage`. Every write route checks the
permission on a read connection BEFORE the body is read (read_gate), then opens the write connection. Nothing here calls the
infrastructure or a device: validation reads the state mirror, readings come from water.db. No valve, no shut-off (owner Q6)."""
from __future__ import annotations

import collections
import csv
import datetime as dt
import io
import json
import sqlite3
import threading
import time
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, read_gate, settings_of
from ..db import new_id, now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import energy_counter as ec
from ..services import energy_store as st
from ..services import water_alerts as wa
from ..services import water_meters as wm
from ..services import water_runtime as wr
from ..services import water_sampler
from ..services import water_settings as ws
from ..services.energy_provider import coverage_of
from ..services.timeutil import parse_utc
from .devices import _is_json, _raw_body

router = APIRouter()
API = "/infra/water"
UTC = dt.timezone.utc
MAX_POINTS = 3000
STEP_S = {"15m": 900, "1h": 3600, "1d": 86400}
REF_PATTERN = r"^[a-z_][a-z0-9_]*\.[A-Za-z0-9_]+$"


# ---------------------------------------------------------------- plumbing

class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _err(status: int, code: str, he: str, en: str, **details: Any) -> ApiError:
    return ApiError(status, code, he, details={**details, "message_en": en})


def _parse(request: Request, raw: bytes, model: type[BaseModel]) -> Any:
    if not _is_json(request.headers.get("content-type")):
        raise _err(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).", "The request must be JSON.")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise _err(422, "validation", "גוף הבקשה אינו JSON תקין.", "The body is not valid JSON.", fields=["body"]) from None
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise _err(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), "Invalid request: " + ", ".join(fields), fields=fields) from None


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def module_off() -> ApiError:
    return _err(404, "module_off", "המודול כבוי - מוני מים מופעלים בהגדרות המערכת", "The water module is off - water meters are enabled in the system settings.")


def _require_on(conn: sqlite3.Connection) -> None:
    if not ws.enabled(conn):
        raise module_off()


def _view_check(conn: sqlite3.Connection, principal: Principal) -> None:
    _require_on(conn)
    if not wm.Reach(conn, principal).any:
        require(conn, principal, ws.VIEW, INSTALLATION)  # the audited 403


def _manage_check(conn: sqlite3.Connection, principal: Principal) -> None:
    _require_on(conn)
    require(conn, principal, ws.MANAGE, INSTALLATION)


_viewer = read_gate(_view_check)
_manager = read_gate(_manage_check)


def _can(conn: sqlite3.Connection, principal: Principal, permission: str) -> bool:
    return authorize(conn, principal, permission, INSTALLATION).allowed


def _iso(ts: int | None) -> str | None:
    return wm.epoch_to_iso(ts)


def _instant(value: str | None, name: str, default: int | None = None) -> int:
    if value is None:
        if default is None:
            raise _err(422, "validation", f"חסר {name}.", f"Missing {name}.", fields=[name])
        return default
    try:
        return int(parse_utc(value).timestamp())
    except ValueError:
        raise _err(422, "validation", f"{name} חייב להיות זמן UTC (ISO 8601).", f"{name} must be a UTC instant (ISO 8601).", fields=[name]) from None


def _range(frm: str | None, to: str | None, default_span_s: int) -> tuple[int, int]:
    end = _instant(to, "to", int(time.time()))
    start = _instant(frm, "from", end - default_span_s)
    if end <= start:
        raise _err(422, "period_invalid", "טווח הזמן אינו תקין.", "The time range is invalid.", fields=["from", "to"])
    return start, end


class _Limiter:
    """A small per-user sliding window (CR section 10: CSV 10 / minute, manual readings 60 / hour)."""

    def __init__(self, limit: int, window_s: int):
        self.limit, self.window = limit, window_s
        self.hits: dict[str, collections.deque[float]] = {}
        self.lock = threading.Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self.lock:
            q = self.hits.setdefault(key, collections.deque())
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.limit:
                raise _err(429, "rate_limited", "יותר מדי בקשות. נסו שוב בעוד רגע.", "Too many requests. Try again shortly.", retry_after_s=self.window)
            q.append(now)


CSV_LIMIT = _Limiter(10, 60)
MANUAL_LIMIT = _Limiter(60, 3600)


# ---------------------------------------------------------------- output

def _consumption(conn: sqlite3.Connection, store: st.EnergyStore, tz: Any, meter_id: str, a: int, b: int, floor: int | None) -> dict[str, Any]:
    try:
        return store.consumption(meter_id, a, b, tz=tz, interval_floor=floor)
    except ValueError:
        raise _err(422, "period_invalid", "מחוץ לתקופת נתוני הרבע שעה אפשר לשאול רק מחצות לחצות.",
                   "Outside the quarter-hour retention only midnight-to-midnight ranges can be asked.", fields=["from", "to"]) from None


def _meter_out(conn: sqlite3.Connection, store: st.EnergyStore, tz: Any, row: sqlite3.Row, cursor: st.CursorInfo | None, now: int, stale_s: int,
               manage: bool) -> dict[str, Any]:
    today = month = None
    if row["status"] != "retired":
        today = store.consumption(row["id"], wm.day_start(now, tz), now, tz=tz, interval_floor=None)["wh"]
        month = store.consumption(row["id"], wm.month_start(now, tz), now, tz=tz, interval_floor=None)["wh"]
    value = cursor.seen_value_wh if cursor else None
    out = {
        "id": row["id"], "display_name": row["display_name"], "medium": row["medium"], "kind": row["kind"], "unit": row["unit"],
        "device_name": row["device_name"], "area_id": row["eff_area_id"], "area_name": row["area_name"], "floor_id": row["floor_id"], "floor_name": row["floor_name"],
        "status": row["status"], "status_reason": row["status_reason"], "max_flow_lph": row["max_flow_lph"], "revision": row["revision"],
        "created_at": row["created_at"], "retired_at": row["retired_at"], "muted_until": row["muted_until"],
        "state": wm.status_of(row, cursor, now, stale_s), "last_report_at": _iso(cursor.seen_ts if cursor else None),
        "value_l": wm.litres(value), "value": wm.display(value),
        "today_l": wm.litres(today), "today": wm.display(today), "month_l": wm.litres(month), "month": wm.display(month),
    }
    if manage:
        out["source_ref"] = row["source_ref"]
        out["rules"] = wa.overrides_of(row["rules_json"])  # slice 2: the meter's own leak-rule overrides
    return out


def _epoch_out(e: sqlite3.Row) -> dict[str, Any]:
    return {"id": e["id"], "started_at": e["started_at"], "ended_at": e["ended_at"], "start_reading_l": wm.litres(e["start_reading_ml"]),
            "end_reading_l": wm.litres(e["end_reading_ml"]), "reason": e["reason"], "note": e["note"]}


def _stale_s(conn: sqlite3.Connection) -> int:
    return int(ws.value(conn, "water.stale_after_minutes")) * 60


def _one(request: Request, conn: sqlite3.Connection, principal: Principal, row: sqlite3.Row, *, detail: bool = True) -> dict[str, Any]:
    store = wm.store_for(settings_of(request))
    tz = wm.tz_of(conn)
    cur = store.cursor_info([row["id"]]).get(row["id"])
    out = _meter_out(conn, store, tz, row, cur, int(time.time()), _stale_s(conn), _can(conn, principal, ws.MANAGE))
    if detail:
        out["epochs"] = [_epoch_out(e) for e in wm.epochs(conn, row["id"])]
    return out


# ---------------------------------------------------------------- status (the tab gate; never 403, never module_off)

@router.get(f"{API}/status")
def status(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`{enabled, can_view, can_manage, can_configure, meters}` for the tab gate - any signed-in user."""
    on = ws.enabled(conn)
    reach = wm.Reach(conn, principal)
    can_view = reach.any
    n = 0
    if on and can_view:
        try:
            n = sum(1 for r in wm.list_rows(conn) if reach.sees(r))
        except sqlite3.OperationalError:
            n = 0
    return {"enabled": on, "can_view": can_view, "can_manage": _can(conn, principal, ws.MANAGE), "can_configure": _can(conn, principal, ws.CONFIGURE),
            "can_ack": _can(conn, principal, ws.ACK), "can_bills": _can(conn, principal, "water.bills"), "meters": n}


# ---------------------------------------------------------------- candidates and meters

@router.get(f"{API}/candidates")
def list_candidates(q: str | None = Query(None, max_length=80), area_id: str | None = Query(None, max_length=80), include_rejected: bool = Query(True),
                    limit: int = Query(50, ge=1, le=200), principal: Principal = Depends(_manager), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Infrastructure sensors that could be water meters, with the volume / flow-rate verdict (water.manage)."""
    return {"items": wm.candidates(conn, q, area_id, include_rejected, limit)}


@router.get(f"{API}/meters")
def list_meters(request: Request, include_retired: bool = Query(False), principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The water meters the caller may see with their state, last reading, today and this month (water.view, floor-scoped)."""
    reach = wm.Reach(conn, principal)
    rows = [r for r in wm.list_rows(conn, include_retired) if reach.sees(r)]
    store = wm.store_for(settings_of(request))
    tz = wm.tz_of(conn)
    cursors = store.cursor_info([r["id"] for r in rows])
    now, stale, manage = int(time.time()), _stale_s(conn), _can(conn, principal, ws.MANAGE)
    return {"items": [_meter_out(conn, store, tz, r, cursors.get(r["id"]), now, stale, manage) for r in rows], "stale_after_minutes": stale // 60}


@router.get(f"{API}/meters/{{meter_id}}")
def get_meter(meter_id: str, request: Request, principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """One meter with its counter lives (water.view; an invisible meter is the uniform 404)."""
    return _one(request, conn, principal, wm.Reach(conn, principal).require(conn, meter_id))


class MeterCreate(_Body):
    source_ref: str = Field(min_length=3, max_length=255, pattern=REF_PATTERN)
    display_name: str | None = Field(None, max_length=120)
    area_id: str | None = Field(None, max_length=80)
    kind: Literal["main", "sub", "irrigation", "cooling", "pool", "other"] | None = None
    max_flow_lph: float | None = Field(None, gt=0, le=1_000_000)


@router.post(f"{API}/meters", status_code=201)
def create_meter(request: Request, principal: Principal = Depends(_manager), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Register an infrastructure sensor as a water meter; the server repeats the volume validation (water.manage)."""
    body: MeterCreate = _parse(request, raw, MeterCreate)
    _manage_check(conn, principal)
    try:
        mid, verdict = wm.create(conn, source_ref=body.source_ref, display_name=body.display_name, area_id=body.area_id, kind=body.kind,
                                 max_flow_lph=body.max_flow_lph, actor=principal.user_id)
    except ApiError as exc:
        audit(conn, actor=principal, action="infra.water.meter.create", decision="refused", resource_type="water_meter", resource_id=None, reason=exc.code, request_id=_rid(request))
        raise
    audit(conn, actor=principal, action="infra.water.meter.create", decision="allowed", resource_type="water_meter", resource_id=mid, request_id=_rid(request),
          details={"unit": verdict.unit, "verdict": verdict.code})
    out = _one(request, conn, principal, wm.require_row(conn, mid))
    out["warning"] = verdict.message if verdict.verdict == "warning" else None
    return out


class MeterPatch(_Body):
    revision: int = Field(ge=1)
    display_name: str | None = Field(None, max_length=120)
    area_id: str | None = Field(None, max_length=80)
    kind: Literal["main", "sub", "irrigation", "cooling", "pool", "other"] | None = None
    max_flow_lph: float | None = Field(None, gt=0, le=1_000_000)
    status: Literal["active", "paused"] | None = None
    rules: dict[str, Any] | None = None  # slice 2: per-meter leak-rule overrides (water_alerts.OVERRIDE_KEYS); null / {} clears


@router.patch(f"{API}/meters/{{meter_id}}")
def patch_meter(meter_id: str, request: Request, principal: Principal = Depends(_manager), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Rename, move, change kind or the plausibility cap, pause or resume (water.manage; revision-checked)."""
    body: MeterPatch = _parse(request, raw, MeterPatch)
    _manage_check(conn, principal)
    fields = body.model_dump(exclude_unset=True)
    revision = fields.pop("revision")
    if "rules" in fields:
        try:
            fields["rules"] = wa.validate_overrides(fields["rules"])
        except wa.AlertsInvalid as exc:
            raise _err(422, exc.code, exc.message, exc.message_en, **exc.details) from None
    changed = wm.update(conn, meter_id, revision, fields)
    if changed:
        audit(conn, actor=principal, action="infra.water.meter.update", decision="allowed", resource_type="water_meter", resource_id=meter_id, request_id=_rid(request),
              details={"fields": changed})
    return _one(request, conn, principal, wm.require_row(conn, meter_id))


@router.delete(f"{API}/meters/{{meter_id}}")
def retire_meter(meter_id: str, request: Request, revision: int = Query(ge=1), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Retire a meter (its data is kept) (water.manage)."""
    _manage_check(conn, principal)
    from ..services import water_billing as wb

    used = wb.meters_in_use(conn, meter_id)
    if used:  # section 6 / 16: a meter inside a billing account's formula is not retired (the account would stop counting it silently)
        raise _err(409, "meter_in_use", "המונה משמש בחשבון חיוב: " + ", ".join(used[:5]) + ". יש להוציא אותו מהנוסחה קודם.",
                   "The meter is used by a billing account. Remove it from the formula first.", accounts=used[:20])
    wm.retire(conn, meter_id, revision)
    audit(conn, actor=principal, action="infra.water.meter.retire", decision="allowed", resource_type="water_meter", resource_id=meter_id, request_id=_rid(request))
    return _one(request, conn, principal, wm.require_row(conn, meter_id))


class MeterReplace(_Body):
    revision: int = Field(ge=1)
    at: str | None = Field(None, max_length=40)
    old_final_reading_l: float | None = Field(None, ge=0, le=1e12)
    new_start_reading_l: float | None = Field(None, ge=0, le=1e12)
    new_source_ref: str | None = Field(None, min_length=3, max_length=255, pattern=REF_PATTERN)
    note: str | None = Field(None, max_length=500)


@router.post(f"{API}/meters/{{meter_id}}/replace")
def replace_meter(meter_id: str, request: Request, principal: Principal = Depends(_manager), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Meter replacement or a new source sensor: closes the counter life and starts a new one (water.manage)."""
    body: MeterReplace = _parse(request, raw, MeterReplace)
    _manage_check(conn, principal)
    now = int(time.time())
    at = _instant(body.at, "at", now)
    if at > now + 300:
        raise _err(422, "validation", "מועד ההחלפה בעתיד.", "The replacement time is in the future.", fields=["at"])
    final_ml = None if body.old_final_reading_l is None else int(round(body.old_final_reading_l * 1000))
    start_ml = None if body.new_start_reading_l is None else int(round(body.new_start_reading_l * 1000))
    epoch_id, reason = wm.replace(conn, meter_id, body.revision, at=_iso(at) or "", final_ml=final_ml, start_ml=start_ml, new_ref=body.new_source_ref,
                                  note=body.note, actor=principal.user_id)
    res = wm.store_for(settings_of(request)).start_epoch(meter_id, at=at, epoch_id=epoch_id, tz=wm.tz_of(conn), final_wh=final_ml, start_wh=start_ml)
    audit(conn, actor=principal, action="infra.water.meter.replace", decision="allowed", resource_type="water_meter", resource_id=meter_id, request_id=_rid(request),
          details={"reason": reason, "manual_ml": res["manual_wh"], "typed_final": final_ml is not None, "typed_start": start_ml is not None})
    return _one(request, conn, principal, wm.require_row(conn, meter_id))


# ---------------------------------------------------------------- series, readings, consumption

@router.get(f"{API}/meters/{{meter_id}}/series")
def meter_series(meter_id: str, request: Request, frm: str | None = Query(None, alias="from", max_length=40), to: str | None = Query(None, max_length=40),
                 bucket: Literal["15m", "1h", "1d"] = Query("1h"), principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Consumption of one meter in litres per 15 minutes, hour or local day (water.view; at most 3000 points)."""
    wm.Reach(conn, principal).require(conn, meter_id)
    store = wm.store_for(settings_of(request))
    tz = wm.tz_of(conn)
    start, end = _range(frm, to, 86400 if bucket != "1d" else 31 * 86400)
    items: list[dict[str, Any]] = []
    if bucket == "1d":
        d0, d1 = st.local_date(start, tz), st.local_date(end, tz)
        if st.day_bounds(d1, tz)[0] < end:
            d1 += dt.timedelta(days=1)
        if (d1 - d0).days > MAX_POINTS:
            raise _err(422, "range_too_large", "טווח הזמן ארוך מדי.", "The time range is too long.")
        rows = store.daily(meter_id, d0, d1)
        d = d0
        while d < d1:
            a, b = st.day_bounds(d, tz)
            r = rows.get(d)
            ml = r[0] if r and r[1] > 0 else None
            items.append({"start": _iso(a), "end": _iso(b), "date": d.isoformat(), "litres": wm.litres(ml), "value": wm.display(ml), "coverage": coverage_of(r[1] if r else 0, b - a, ml)})
            d += dt.timedelta(days=1)
    else:
        size = STEP_S[bucket]
        a = start // size * size
        if (end - a) / size > MAX_POINTS:
            raise _err(422, "range_too_large", "טווח הזמן ארוך מדי לרזולוציה הזו.", "The time range is too long for this resolution.")
        buckets = {bk: (ml, cov) for bk, ml, cov, _q in store.intervals(meter_id, a, end)}
        t = a
        while t < end:
            ml_sum, cov_sum, any_row = 0, 0, False
            for bk in range(t, t + size, st.BUCKET_S):
                hit = buckets.get(bk)
                if hit is not None:
                    any_row = True
                    ml_sum += hit[0]
                    cov_sum += hit[1]
            ml = ml_sum if any_row and cov_sum > 0 else None
            items.append({"start": _iso(t), "end": _iso(t + size), "litres": wm.litres(ml), "value": wm.display(ml), "coverage": coverage_of(cov_sum, size, ml)})
            t += size
    return {"meter_id": meter_id, "bucket": bucket, "unit": "L", "items": items}


@router.get(f"{API}/meters/{{meter_id}}/readings")
def meter_readings(meter_id: str, request: Request, frm: str | None = Query(None, alias="from", max_length=40), to: str | None = Query(None, max_length=40),
                   limit: int = Query(500, ge=1, le=5000), principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Raw cumulative readings of one meter in litres (kept for the raw retention; water.view)."""
    wm.Reach(conn, principal).require(conn, meter_id)
    start, end = _range(frm, to, 86400)
    rows = wm.store_for(settings_of(request)).readings(meter_id, start, end, limit + 1)
    items = [{"at": _iso(ts), "litres": wm.litres(v), "flags": ec.flag_names(f)} for ts, v, f in rows[:limit]]
    return {"meter_id": meter_id, "items": items, "truncated": len(rows) > limit}


def _consumption_rows(request: Request, conn: sqlite3.Connection, principal: Principal, meter_ids: str | None, a: int, b: int) -> list[dict[str, Any]]:
    reach = wm.Reach(conn, principal)
    if meter_ids:
        ids = [m for m in dict.fromkeys(x.strip() for x in meter_ids.split(",")) if m]
        if not ids or len(ids) > 200:
            raise _err(422, "validation", "רשימת המונים אינה תקינה (עד 200).", "The meter list is invalid (up to 200).", fields=["meter_ids"])
        rows = [reach.require(conn, m) for m in ids]
    else:
        rows = [r for r in wm.list_rows(conn) if reach.sees(r)]
    store = wm.store_for(settings_of(request))
    tz = wm.tz_of(conn)
    floor = wm.interval_floor(conn, int(time.time()))
    span = b - a
    out = []
    for r in rows:
        c = _consumption(conn, store, tz, r["id"], a, b, floor)
        try:
            prev = store.consumption(r["id"], a - span, a, tz=tz, interval_floor=floor)["wh"]
        except ValueError:
            prev = None
        out.append({"meter_id": r["id"], "display_name": r["display_name"], "kind": r["kind"], "area_name": r["area_name"], "floor_name": r["floor_name"],
                    "ml": c["wh"], "litres": wm.litres(c["wh"]), "value": wm.display(c["wh"]), "coverage": coverage_of(c["covered_s"], c["total_s"], c["wh"]),
                    "source": c["source"], "previous_litres": wm.litres(prev)})
    return out


@router.get(f"{API}/consumption")
def consumption(request: Request, meter_ids: str | None = Query(None, max_length=8000), frm: str | None = Query(None, alias="from", max_length=40),
                to: str | None = Query(None, max_length=40), bucket: Literal["1h", "1d"] | None = Query(None),
                principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Litres of each visible meter between two instants (allocated by time, with coverage, the previous range of the same length
    and each meter's share), the installation total, and - with `bucket` - the total per hour / local day (water.view)."""
    a, b = _range(frm, to, 86400)
    items = _consumption_rows(request, conn, principal, meter_ids, a, b)
    total = sum(i["ml"] or 0 for i in items)
    known = any(i["ml"] is not None for i in items)
    prev_known = [i["previous_litres"] for i in items if i["previous_litres"] is not None]
    for i in items:
        i["share"] = round((i["ml"] or 0) / total, 4) if total else None
        i.pop("ml")
    out: dict[str, Any] = {"from": _iso(a), "to": _iso(b), "items": items, "unit": "L",
                           "total_litres": wm.litres(total) if known else None, "total": wm.display(total) if known else None,
                           "previous_total_litres": round(sum(prev_known), 3) if prev_known else None}
    if bucket:
        store = wm.store_for(settings_of(request))
        tz = wm.tz_of(conn)
        ids = [i["meter_id"] for i in items]
        series: list[dict[str, Any]] = []
        if bucket == "1d":
            d, d1 = st.local_date(a, tz), st.local_date(b - 1, tz) + dt.timedelta(days=1)
            if (d1 - d).days > MAX_POINTS:
                raise _err(422, "range_too_large", "טווח הזמן ארוך מדי.", "The time range is too long.")
            per = {m: store.daily(m, d, d1) for m in ids}
            while d < d1:
                x, y = st.day_bounds(d, tz)
                vals = [per[m][d][0] for m in ids if d in per[m] and per[m][d][1] > 0]
                series.append({"start": _iso(x), "end": _iso(y), "date": d.isoformat(), "litres": wm.litres(sum(vals)) if vals else None})
                d += dt.timedelta(days=1)
        else:
            t = a // 3600 * 3600
            if (b - t) / 3600 > MAX_POINTS:
                raise _err(422, "range_too_large", "טווח הזמן ארוך מדי לרזולוציה הזו.", "The time range is too long for this resolution.")
            sums: dict[int, int] = {}
            for m in ids:
                for bk, ml, cov, _q in store.intervals(m, t, b):
                    if cov > 0:
                        h = bk // 3600 * 3600
                        sums[h] = sums.get(h, 0) + ml
            while t < b:
                series.append({"start": _iso(t), "end": _iso(t + 3600), "litres": wm.litres(sums[t]) if t in sums else None})
                t += 3600
        out["bucket"] = bucket
        out["series"] = series
    return out


@router.get(f"{API}/consumption.csv")
def consumption_csv(request: Request, meter_ids: str | None = Query(None, max_length=8000), frm: str | None = Query(None, alias="from", max_length=40),
                    to: str | None = Query(None, max_length=40), lang: Literal["he", "en"] = Query("he"),
                    principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """The consumption table as CSV (UTF-8 with BOM, formula-safe; audited, 10 a minute per user; water.view)."""
    _view_check(conn, principal)
    CSV_LIMIT.check(principal.user_id or principal.username or "-")
    a, b = _range(frm, to, 86400)
    items = _consumption_rows(request, conn, principal, meter_ids, a, b)
    tz = wm.tz_of(conn)
    he = lang == "he"
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["מונה", "סוג", "מיקום", "מ־", "עד", "צריכה (ליטר)", "צריכה (מ״ק)", "טווח קודם (ליטר)", "כיסוי"] if he else
               ["Meter", "Kind", "Place", "From", "To", "Consumption (L)", "Consumption (m³)", "Previous range (L)", "Coverage"])

    def safe(s: Any) -> Any:
        return ("'" + s) if isinstance(s, str) and s[:1] in ("=", "+", "-", "@", "\t", "\r") else s

    loc = lambda ts: dt.datetime.fromtimestamp(ts, tz).strftime("%Y-%m-%d %H:%M")  # noqa: E731
    for i in items:
        ml = i["ml"]
        w.writerow([safe(i["display_name"]), i["kind"], safe(" / ".join(x for x in (i["floor_name"], i["area_name"]) if x)), loc(a), loc(b),
                    "" if ml is None else f"{ml / 1000:.1f}", "" if ml is None else f"{ml / 1_000_000:.3f}",
                    "" if i["previous_litres"] is None else f"{i['previous_litres']:.1f}", i["coverage"]])
    audit(conn, actor=principal, action="infra.water.export", decision="allowed", resource_type="water_meter", resource_id=None, request_id=_rid(request),
          details={"rows": len(items), "lang": lang})
    stamp = dt.datetime.now(tz).strftime("%Y%m%d-%H%M")
    return Response(content="﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="water-consumption-{stamp}.csv"'})


# ---------------------------------------------------------------- manual readings (the 0058 rules on litres)

class ManualReadingBody(_Body):
    read_at: str = Field(max_length=40)
    value: float | str
    unit: Literal["L", "m3"] = "m3"
    note: str | None = Field(None, max_length=500)
    dry_run: bool = False


class UndoBody(_Body):
    reason: str | None = Field(None, max_length=300)


def _reading_out(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "read_at": r["read_at"], "litres": wm.litres(r["value_ml"]), "typed_value": r["typed_value"], "typed_unit": r["typed_unit"],
            "effect": r["effect"], "effect_reason": r["effect_reason"], "note": r["note"], "created_at": r["created_at"], "voided_at": r["voided_at"]}


def _epoch_bounds(conn: sqlite3.Connection, meter_id: str, ts: int) -> tuple[sqlite3.Row, int, int | None]:
    for e in reversed(wm.epochs(conn, meter_id)):
        lo = int(parse_utc(e["started_at"]).timestamp())
        hi = int(parse_utc(e["ended_at"]).timestamp()) if e["ended_at"] else None
        if lo <= ts and (hi is None or ts < hi):
            return e, lo, hi
    raise _err(422, "validation", "מועד הקריאה לפני תחילת המונה.", "The reading is before the meter's counter life began.", fields=["read_at"])


@router.get(f"{API}/meters/{{meter_id}}/manual-readings")
def list_manual(meter_id: str, principal: Principal = Depends(_manager), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    wm.require_row(conn, meter_id)
    rows = conn.execute("SELECT * FROM water_meter_manual_readings WHERE meter_id = ? ORDER BY read_at DESC, created_at DESC", (meter_id,)).fetchall()
    return {"meter_id": meter_id, "items": [_reading_out(r) for r in rows]}


@router.post(f"{API}/meters/{{meter_id}}/manual-readings")
def add_manual(meter_id: str, request: Request, principal: Principal = Depends(_manager), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A typed reading of the physical meter (water.manage; 60 an hour per user). An open or closed reporting gap is allocated; every
    other case is recorded only (the 0058 rules). `dry_run` answers what it would do and stores nothing."""
    body: ManualReadingBody = _parse(request, raw, ManualReadingBody)
    _manage_check(conn, principal)
    row = wm.require_row(conn, meter_id)
    if row["status"] == "retired":
        raise _err(409, "meter_retired", "המונה הוצא משימוש.", "The meter is retired.")
    ts = _instant(body.read_at, "read_at")
    if ts > int(time.time()) + 300:
        raise _err(422, "validation", "מועד הקריאה בעתיד.", "The reading time is in the future.", fields=["read_at"])
    ml = wm.typed_ml(body.value, body.unit)
    epoch, lo, hi = _epoch_bounds(conn, meter_id, ts)
    store = wm.store_for(settings_of(request))
    tz = wm.tz_of(conn)
    if not body.dry_run:
        MANUAL_LIMIT.check(principal.user_id or principal.username or "-")
    plan = store.manual_reading(meter_id, ts=ts, raw_wh=ml, max_kw=float(row["max_flow_lph"]), epoch_lo=lo, epoch_hi=hi, billed_until=None, tz=tz, dry_run=body.dry_run)
    out ={"effect": plan.effect, "reason": plan.reason, "litres": wm.litres(ml), "dry_run": body.dry_run}
    if body.dry_run:
        return out
    rid, now = new_id(), now_iso()
    conn.execute("""INSERT INTO water_meter_manual_readings(id, meter_id, epoch_id, read_at, value_ml, typed_value, typed_unit, effect, effect_reason, note, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 (rid, meter_id, epoch["id"], _iso(ts), ml, str(body.value), body.unit, plan.effect, plan.reason, body.note, principal.user_id, now))
    audit(conn, actor=principal, action="infra.water.reading.manual", decision="allowed", resource_type="water_meter", resource_id=meter_id, request_id=_rid(request),
          details={"reading_id": rid, "effect": plan.effect, "reason": plan.reason})
    out["id"] = rid
    return out


@router.post(f"{API}/meters/{{meter_id}}/manual-readings/{{reading_id}}/undo")
def undo_manual(meter_id: str, reading_id: str, request: Request, principal: Principal = Depends(_manager), raw: bytes = Depends(_raw_body),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Take back a manual reading (an allocated one returns its energy to one linear span) (water.manage)."""
    body: UndoBody = _parse(request, raw, UndoBody)
    _manage_check(conn, principal)
    r = conn.execute("SELECT * FROM water_meter_manual_readings WHERE id = ? AND meter_id = ?", (reading_id, meter_id)).fetchone()
    if r is None:
        raise wm.not_found()
    if r["voided_at"]:
        raise _err(409, "reading_voided", "הקריאה כבר בוטלה.", "The reading was already undone.")
    if r["effect"] == "allocation":
        ts = int(parse_utc(r["read_at"]).timestamp())
        _e, lo, hi = _epoch_bounds(conn, meter_id, ts)
        why = wm.store_for(settings_of(request)).undo_manual_reading(meter_id, ts=ts, raw_wh=int(r["value_ml"]), epoch_lo=lo, epoch_hi=hi, tz=wm.tz_of(conn))
        if why is not None:
            raise _err(409, "reading_undo_refused", "אי אפשר לבטל את הקריאה: המונה המשיך מאז.", "The reading cannot be undone: the counter moved on.", reason=why)
    conn.execute("UPDATE water_meter_manual_readings SET voided_at = ?, voided_by = ?, void_reason = ? WHERE id = ?", (now_iso(), principal.user_id, body.reason, reading_id))
    audit(conn, actor=principal, action="infra.water.reading.undo", decision="allowed", resource_type="water_meter", resource_id=meter_id, request_id=_rid(request),
          details={"reading_id": reading_id})
    return _reading_out(conn.execute("SELECT * FROM water_meter_manual_readings WHERE id = ?", (reading_id,)).fetchone())


# ---------------------------------------------------------------- settings (allowed while the module is off: the switch lives here)

READ_PERMS = (ws.VIEW, ws.MANAGE, ws.CONFIGURE, ws.BACKUP)


def _settings_read_check(conn: sqlite3.Connection, principal: Principal) -> None:
    if not (wm.Reach(conn, principal).any or any(_can(conn, principal, p) for p in READ_PERMS[1:])):
        require(conn, principal, ws.VIEW, INSTALLATION)


def _settings_write_check(conn: sqlite3.Connection, principal: Principal) -> None:
    if not any(_can(conn, principal, s.permission) for s in ws.SPECS.values()):
        require(conn, principal, ws.MANAGE, INSTALLATION)


_settings_reader = read_gate(_settings_read_check)
_settings_editor = read_gate(_settings_write_check)


def _settings_out(request: Request, conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    vals = ws.values(conn)
    on = bool(vals[ws.ENABLED])
    editable = {k: _can(conn, principal, s.permission) for k, s in ws.SPECS.items()}
    if not on:  # module off: the section shows the switch only (CR section 7)
        return {"values": {ws.ENABLED: False}, "editable": {ws.ENABLED: editable[ws.ENABLED]}, "ranges": {ws.ENABLED: ws.ranges()[ws.ENABLED]},
                "sampler_running": water_sampler.SAMPLER.running}
    store = wm.store_for(settings_of(request))
    counts = store.counts()
    return {"values": vals, "editable": editable, "ranges": ws.ranges(), "sampler_running": water_sampler.SAMPLER.running,
            "storage": {"water_db_bytes": store.file_bytes(), "rows": counts}}


@router.get(f"{API}/settings")
def get_settings(request: Request, principal: Principal = Depends(_settings_reader), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The water settings (the switch only while the module is off)."""
    return _settings_out(request, conn, principal)


@router.put(f"{API}/settings")
def put_settings(request: Request, principal: Principal = Depends(_settings_editor), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Change water settings; each key against its own permission (the switch and retention: system.configure). The switch is audited
    as `infra.water.enabled` and starts / stops the sampler thread."""
    if not _is_json(request.headers.get("content-type")):
        raise _err(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).", "The request must be JSON.")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise _err(422, "validation", "גוף הבקשה אינו JSON תקין.", "The body is not valid JSON.", fields=["body"]) from None
    if not isinstance(data, dict) or not data or len(data) > 20:
        raise _err(422, "validation", "יש לשלוח אובייקט של הגדרות.", "Send an object of settings.", fields=["body"])
    changes: dict[str, str] = {}
    for key, value in data.items():
        text = ws.validate(str(key), value)
        require(conn, principal, ws.SPECS[key].permission, INSTALLATION)
        changes[key] = text
    before = ws.values(conn)
    ws.store(conn, changes)
    after = ws.values(conn)
    changed = sorted(k for k in changes if before.get(k) != after.get(k))
    if ws.ENABLED in changed:
        audit(conn, actor=principal, action="infra.water.enabled", decision="allowed", resource_type="settings", resource_id="water", request_id=_rid(request),
              details={"enabled": bool(after[ws.ENABLED])})
        db, cfg = request.app.state.db, settings_of(request)
        if after[ws.ENABLED]:
            water_sampler.SAMPLER.start(db, cfg, assume_on=True)
        else:
            water_sampler.SAMPLER.shutdown()
            wr.close_all(conn, wr.clock(), "alerts_disabled")  # slice 2: open rows end, their notifications resolve (`alerts_disabled`)
    other = [k for k in changed if k != ws.ENABLED]
    if other:
        audit(conn, actor=principal, action="infra.water.settings.update", decision="allowed", resource_type="settings", resource_id="water", request_id=_rid(request),
              details={"keys": other})
    return _settings_out(request, conn, principal)


# ---------------------------------------------------------------- slice 2: leak alerts (the alert log, acknowledge, mute, rules and routing)
# Reads: water.view (floor-scoped like the meters; an invisible meter's rows are never listed, its row ids answer the uniform 404).
# Acknowledge / mute: water.ack on the meter (operator and above; floor-scoped holders on their floors). Mute holds WARNINGS only.
# The rules and the routing: water.manage reads, system.configure writes. Nothing here, and nothing the evaluator does, acts on a device.

class _AckReach:
    """Where the caller holds water.ack: installation-wide, or the floors of the meter's entity (the Reach rule of water.view)."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal):
        from ..services import ha_scope

        self.wide, self.floors = ha_scope.visible_floors(conn, principal, ws.ACK)
        self._placed = None if self.wide else ha_scope.placements(conn)
        self._ha_scope = ha_scope

    @property
    def any(self) -> bool:
        return self.wide or bool(self.floors)

    def allows(self, row: Any) -> bool:
        return self.wide or self._ha_scope.entity_visible(False, self.floors, self._placed or {}, row["source_ref"])


def _ack_check(conn: sqlite3.Connection, principal: Principal) -> None:
    _require_on(conn)
    if not _AckReach(conn, principal).any:
        require(conn, principal, ws.ACK, INSTALLATION)  # the audited 403


def _alerts_read_check(conn: sqlite3.Connection, principal: Principal) -> None:
    _require_on(conn)
    require(conn, principal, ws.MANAGE, INSTALLATION)


def _alerts_write_check(conn: sqlite3.Connection, principal: Principal) -> None:
    _require_on(conn)
    require(conn, principal, ws.CONFIGURE, INSTALLATION)


_acker = read_gate(_ack_check)
_alerts_reader = read_gate(_alerts_read_check)
_alerts_editor = read_gate(_alerts_write_check)


def _event_out(r: sqlite3.Row, can_ack: bool) -> dict[str, Any]:
    try:
        value = json.loads(r["value_json"] or "{}")
    except ValueError:
        value = {}
    if "today_ml" in value or "median_ml" in value:  # litres on the wire (the store's mL stay inside)
        today_ml, median_ml = int(value.get("today_ml") or 0), int(round(float(value.get("median_ml") or 0)))
        value = {**{k: v for k, v in value.items() if k not in ("today_ml", "median_ml")},
                 "today_l": wm.litres(today_ml), "median_l": wm.litres(median_ml), "today": wm.display(today_ml), "median": wm.display(median_ml)}
    return {"id": r["id"], "meter_id": r["meter_id"], "meter_name": r["display_name"], "meter_kind": r["meter_kind"], "area_name": r["area_name"],
            "floor_name": r["floor_name"], "kind": r["kind"], "severity": r["severity"], "opened_at": r["opened_at"], "closed_at": r["closed_at"],
            "close_reason": r["close_reason"], "value": value, "suppressed": r["suppressed"], "ack_at": r["ack_at"], "ack_by_display": r["ack_by_display"],
            "notified": bool(r["notification_id"]), "can_ack": can_ack and r["closed_at"] is None and r["ack_at"] is None,
            "snoozed_until": r["snoozed_until"] if r["closed_at"] is None and r["snoozed_until"] and r["snoozed_until"] > wm.epoch_to_iso(int(wr.clock())) else None,
            "can_snooze": can_ack and r["closed_at"] is None}


EVENTS_SQL = """SELECT e.*, m.display_name, m.kind AS meter_kind, m.source_ref, COALESCE(a.name, x.area_name) AS area_name,
                       CASE WHEN a.area_id IS NOT NULL THEN f.name ELSE x.ha_floor_name END AS floor_name,
                       COALESCE(NULLIF(u.display_name, ''), u.username) AS ack_by_display
                FROM water_alert_events e JOIN water_meters m ON m.id = e.meter_id
                LEFT JOIN ha_entities x ON x.entity_id = m.source_ref
                LEFT JOIN ha_areas a ON a.area_id = COALESCE(m.area_id, x.area_id)
                LEFT JOIN ha_floors f ON f.floor_id = a.floor_id
                LEFT JOIN users u ON u.id = e.ack_by"""


@router.get(f"{API}/events")
def list_events(state: Literal["open", "all"] = Query("open"), kind: Literal["night_flow", "abnormal", "burst", "offline"] | None = Query(None),
                meter_id: str | None = Query(None, max_length=80), limit: int = Query(200, ge=1, le=1000),
                principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The water alert log of the meters the caller may see (water.view, floor-scoped): open rows by default, newest first, with the KPI row."""
    reach = wm.Reach(conn, principal)
    if meter_id:
        reach.require(conn, meter_id)
    where: list[str] = []
    args: list[Any] = []
    if state == "open":
        where.append("e.closed_at IS NULL")
    if kind:
        where.append("e.kind = ?")
        args.append(kind)
    if meter_id:
        where.append("e.meter_id = ?")
        args.append(meter_id)
    sql = EVENTS_SQL + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY e.opened_at DESC, e.id"
    rows = [r for r in conn.execute(sql, args).fetchall() if reach.sees(r)][:limit]
    acker = _AckReach(conn, principal)
    return {"items": [_event_out(r, acker.allows(r)) for r in rows], "summary": wr.summary(conn, reach.sees, wr.clock())}


@router.get(f"{API}/events/summary")
def events_summary(principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The KPI row of the alert log and the home tile (owner Q7: one tile "מים · דליפה חשודה" only while a leak is open and
    `water.home_kpi` is on; tap = the alert log)."""
    s = wr.summary(conn, wm.Reach(conn, principal).sees, wr.clock())
    tile = bool(ws.value(conn, "water.home_kpi")) and s["open_leaks"] > 0
    return {**s, "home_tile": {"show": tile, "leaks": s["open_leaks"] if tile else 0, "link": wr.LINK}}


@router.post(f"{API}/events/{{event_id}}/ack")
def ack_event(event_id: str, request: Request, principal: Principal = Depends(_acker), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Acknowledge one open alert row (water.ack on its meter): who and when go into the log, its notification is acknowledged too. The
    condition itself stays open until it ends."""
    from ..services import notify

    _require_on(conn)
    r = conn.execute(EVENTS_SQL + " WHERE e.id = ?", (event_id,)).fetchone()
    if r is None or not wm.Reach(conn, principal).sees(r):
        raise _err(404, "not_found", "ההתראה לא נמצאה.", "The alert was not found.")
    if not _AckReach(conn, principal).allows(r):
        require(conn, principal, ws.ACK, INSTALLATION)
    if r["closed_at"] is not None:
        raise _err(409, "event_closed", "ההתראה כבר הסתיימה.", "The alert has already ended.")
    if r["ack_at"] is not None:
        raise _err(409, "already_acked", "ההתראה כבר אושרה.", "The alert was already acknowledged.")
    conn.execute("UPDATE water_alert_events SET ack_by = ?, ack_at = ? WHERE id = ?", (principal.user_id, now_iso(), event_id))
    notify.ack_from_alert(conn, r["notification_id"], principal)
    audit(conn, actor=principal, action="infra.water.event.ack", decision="allowed", resource_type="water_meter", resource_id=r["meter_id"], request_id=_rid(request),
          details={"event_id": event_id, "kind": r["kind"]})
    return _event_out(conn.execute(EVENTS_SQL + " WHERE e.id = ?", (event_id,)).fetchone(), True)


class MuteBody(_Body):
    minutes: Literal[15, 30, 60, 120]


def _ack_meter(conn: sqlite3.Connection, principal: Principal, meter_id: str) -> sqlite3.Row:
    _require_on(conn)
    row = wm.Reach(conn, principal).require(conn, meter_id)
    if not _AckReach(conn, principal).allows(row):
        require(conn, principal, ws.ACK, INSTALLATION)
    if row["status"] == "retired":
        raise _err(409, "meter_retired", "המונה הוצא משימוש.", "The meter is retired.")
    return row


@router.post(f"{API}/meters/{{meter_id}}/mute")
def mute_meter(meter_id: str, request: Request, principal: Principal = Depends(_acker), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Hold the meter's WARNING notifications for 15 / 30 / 60 / 120 minutes (water.ack). Alarms are never held unless the installation's
    `mute_includes_alarms` says so; held rows are still logged."""
    body: MuteBody = _parse(request, raw, MuteBody)
    _ack_meter(conn, principal, meter_id)
    until = wm.epoch_to_iso(int(wr.clock()) + body.minutes * 60)
    conn.execute("UPDATE water_meters SET muted_until = ?, muted_by = ? WHERE id = ?", (until, principal.user_id, meter_id))
    audit(conn, actor=principal, action="infra.water.event.mute", decision="allowed", resource_type="water_meter", resource_id=meter_id, request_id=_rid(request),
          details={"minutes": body.minutes})
    return {"meter_id": meter_id, "muted_until": until}


@router.delete(f"{API}/meters/{{meter_id}}/mute")
def unmute_meter(meter_id: str, request: Request, principal: Principal = Depends(_acker), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """End a mute early (water.ack)."""
    _ack_meter(conn, principal, meter_id)
    conn.execute("UPDATE water_meters SET muted_until = NULL, muted_by = NULL WHERE id = ?", (meter_id,))
    audit(conn, actor=principal, action="infra.water.event.unmute", decision="allowed", resource_type="water_meter", resource_id=meter_id, request_id=_rid(request))
    return {"meter_id": meter_id, "muted_until": None}


# ---------------------------------------------------------------- section 16: snooze one open alert ("נדנוד") for a configured duration

class SnoozeBody(_Body):
    minutes: int | None = Field(default=None, ge=1, le=43200)  # omitted = the configured default of the main button


def _ack_event_row(conn: sqlite3.Connection, principal: Principal, event_id: str) -> sqlite3.Row:
    _require_on(conn)
    r = conn.execute(EVENTS_SQL + " WHERE e.id = ?", (event_id,)).fetchone()
    if r is None or not wm.Reach(conn, principal).sees(r):
        raise _err(404, "not_found", "ההתראה לא נמצאה.", "The alert was not found.")
    if not _AckReach(conn, principal).allows(r):
        require(conn, principal, ws.ACK, INSTALLATION)
    if r["closed_at"] is not None:
        raise _err(409, "event_closed", "ההתראה כבר הסתיימה.", "The alert has already ended.")
    return r


@router.post(f"{API}/events/{{event_id}}/snooze")
def snooze_event(event_id: str, request: Request, principal: Principal = Depends(_acker), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Snooze one open alert for one of the configured durations (water.ack on its meter). It is NOT acknowledged: while snoozed its
    warnings are held (an alarm only with `mute_includes_alarms`), and when the time ends it returns if the condition persists."""
    body: SnoozeBody = _parse(request, raw, SnoozeBody)
    r = _ack_event_row(conn, principal, event_id)
    cfg = wa.load(conn)["snooze"]
    minutes = body.minutes if body.minutes is not None else cfg["default"]
    if minutes not in cfg["durations"] or minutes > cfg["max"]:
        raise _err(422, "snooze_duration", "משך הנדנוד אינו אחד מהמשכים שהוגדרו.", "The snooze duration is not one of the configured durations.",
                   fields=["minutes"], durations=cfg["durations"])
    until = wm.epoch_to_iso(int(wr.clock()) + minutes * 60)
    conn.execute("UPDATE water_alert_events SET snoozed_until = ?, snoozed_by = ? WHERE id = ?", (until, principal.user_id, event_id))
    audit(conn, actor=principal, action="infra.water.event.snooze", decision="allowed", resource_type="water_meter", resource_id=r["meter_id"], request_id=_rid(request),
          details={"event_id": event_id, "minutes": minutes})
    return _event_out(conn.execute(EVENTS_SQL + " WHERE e.id = ?", (event_id,)).fetchone(), True)


@router.delete(f"{API}/events/{{event_id}}/snooze")
def unsnooze_event(event_id: str, request: Request, principal: Principal = Depends(_acker), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """End a snooze early (water.ack)."""
    r = _ack_event_row(conn, principal, event_id)
    conn.execute("UPDATE water_alert_events SET snoozed_until = NULL, snoozed_by = NULL WHERE id = ?", (event_id,))
    audit(conn, actor=principal, action="infra.water.event.unsnooze", decision="allowed", resource_type="water_meter", resource_id=r["meter_id"], request_id=_rid(request),
          details={"event_id": event_id})
    return _event_out(conn.execute(EVENTS_SQL + " WHERE e.id = ?", (event_id,)).fetchone(), True)


@router.get(f"{API}/alerts")
def get_alerts(principal: Principal = Depends(_alerts_reader), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The leak rules' installation defaults and the alert routing (water.manage)."""
    return {**wa.view(conn), "can_edit": _can(conn, principal, ws.CONFIGURE)}


@router.put(f"{API}/alerts")
def put_alerts(request: Request, principal: Principal = Depends(_alerts_editor), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Change the defaults and / or the routing (system.configure; `row_version` checked when sent). Audited `infra.water.alerts.update`."""
    if not _is_json(request.headers.get("content-type")):
        raise _err(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).", "The request must be JSON.")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise _err(422, "validation", "גוף הבקשה אינו JSON תקין.", "The body is not valid JSON.", fields=["body"]) from None
    if not isinstance(data, dict) or not data:
        raise _err(422, "validation", "יש לשלוח אובייקט של הגדרות.", "Send an object of settings.", fields=["body"])
    _alerts_write_check(conn, principal)
    try:
        out, changed = wa.save(conn, principal.user_id, data)
    except wa.AlertsInvalid as exc:
        raise _err(409 if exc.code == "revision_conflict" else 422, exc.code, exc.message, exc.message_en, **exc.details) from None
    audit(conn, actor=principal, action="infra.water.alerts.update", decision="allowed", resource_type="settings", resource_id="water.alerts", request_id=_rid(request),
          details={"changed": changed, "on": [k for k in wa.KINDS if out["kinds"][k]["enabled"]]})
    return {**out, "can_edit": True}
