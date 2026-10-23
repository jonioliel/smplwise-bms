"""CR-WATER78 slice 1: the water meter registry (main DB `water_meters`, `water_meter_epochs`, `water_meter_manual_readings`,
migration 0150, built as provisional 0152), the source validation (section 4.4: a cumulative volume, never a flow rate), the floor scope and the
small read helpers of the API (routers/water.py).

The model is the electricity one (CR-023), parameterised by the medium (D1): the time-series is the energy store's code on its
own file `water.db` with the water counter profile (thresholds in mL), the counter rules are energy_counter.py's. Volumes are
integer millilitres inside; the API answers litres (and m3 for display). Nothing here calls the infrastructure: validation reads
the state mirror (`ha_entities`), readings come from water.db. No valve, no shut-off, no device write - ever (owner Q6)."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from ..db import get_setting, new_id, now_iso
from ..errors import ApiError, conflict
from ..rbac import Principal
from . import energy_counter as ec
from . import energy_store as st
from . import ha_scope
from . import water_settings as ws
from .timeutil import zone

FILE_NAME = "water.db"
# CR-WATER78 4.5: noise = a drop under 10 % AND under 20 L; a drop to <= 10 % or <= 20 L is a reset; cap = max_flow x hours x 1.5 + 20 L
WATER_PROFILE = ec.CounterProfile(reset_abs=20_000, noise_abs=20_000, cap_slack=20_000)
DEFAULT_MAX_FLOW_LPH = 20000.0
KINDS = ("main", "sub", "irrigation", "cooling", "pool", "other")

# accepted spellings -> (canonical unit, MICRO-litres per source unit). uL keeps gallons / cubic feet exact integers (CR C2).
UNITS: dict[str, tuple[str, int]] = {
    "l": ("L", 1_000_000), "m³": ("m3", 1_000_000_000), "m3": ("m3", 1_000_000_000),
    "gal": ("gal", 3_785_412), "ft³": ("ft3", 28_316_847), "ft3": ("ft3", 28_316_847),
}
ALLOWED_CLASSES = {None, "water"}
NOT_NUMERIC_STATES = {None, "", "unavailable", "unknown", "none"}

# Hebrew messages (CR 4.4) with their English twin for `details.message_en`
MSG: dict[str, tuple[str, str]] = {
    "domain_rejected": ("אפשר לבחור רק חיישן שמודד צריכת מים מצטברת.", "Only a sensor that counts cumulative water consumption can be chosen."),
    "flow_rate": ("החיישן מודד ספיקה רגעית (ליטר לדקה), לא צריכה מצטברת. למונה מים צריך מונה שמציג מ״ק או ליטר מצטברים.",
                  "The sensor measures an instantaneous flow rate, not cumulative consumption. A water meter must show cumulative m³ or litres."),
    "gas_later": ("זהו מונה גז. מוני גז יתווספו בהמשך.", "This is a gas meter. Gas meters will be added later."),
    "unit_rejected": ("יחידת המידה היא {unit}. אפשר לבחור רק מונה שמודד ליטר, מ״ק, גלון או רגל מעוקב.",
                      "The unit is {unit}. Only a meter in litres, m³, gallons or cubic feet can be chosen."),
    "unit_missing": ("לחיישן אין יחידת מידה. אפשר לבחור רק מונה שמודד ליטר, מ״ק, גלון או רגל מעוקב.",
                     "The sensor has no unit. Only a meter in litres, m³, gallons or cubic feet can be chosen."),
    "device_class_rejected": ("החיישן אינו מונה מים. בחרו מונה שמציג מ״ק או ליטר.", "The sensor is not a water meter. Choose a meter in m³ or litres."),
    "measurement": ("החיישן מציג ערך רגעי ולא מונה מצטבר. בחרו מונה צריכה.", "The sensor shows an instantaneous value, not a cumulative counter."),
    "state_not_numeric": ("החיישן אינו מציג מספר. בחרו מונה שמציג מ״ק או ליטר.", "The sensor does not show a number."),
    "state_negative": ("המונה מציג ערך שלילי. בחרו מונה צריכה.", "The meter shows a negative value."),
    "warn_total": ("המונה מתאפס מדי פעם. מתאים, אבל מונה מצטבר עדיף.", "The meter resets periodically. Usable, a cumulative counter is better."),
    "warn_no_device_class": ("סוג החיישן לא מוגדר; היחידה מתאימה.", "The sensor type is not set; the unit fits."),
    "warn_unavailable": ("המונה לא מדווח כרגע. אפשר לשמור; הוא יוצג כלא מדווח עד שיחזור.", "The meter is not reporting now. It can be saved."),
    "warn_same_device": ("כבר נבחר מונה מאותו מכשיר. ודאו שהצריכה לא תיספר פעמיים.", "A meter of the same device is already chosen."),
    "ok": ("", ""),
}
# the API error code of each refusal (CR section 6)
API_CODE = {"flow_rate": "meter_flow_rate", "gas_later": "meter_gas_later"}


@dataclass(frozen=True)
class Verdict:
    verdict: str          # ok | warning | rejected
    code: str
    message: str
    message_en: str
    unit: str | None      # canonical unit when accepted
    unit_factor: int | None


def _attrs(row: Any) -> dict[str, Any]:
    try:
        a = json.loads(row["attributes_json"] or "{}")
    except (ValueError, TypeError, KeyError, IndexError):
        return {}
    return a if isinstance(a, dict) else {}


def _is_flow_unit(unit: str) -> bool:
    if "/" not in unit:
        return False
    left = unit.split("/", 1)[0].strip()
    return left in UNITS or left in {"ml", "gallon", "gallons", "cf", "ccf"}


def judge(row: Any, *, same_device_meter: bool = False) -> Verdict:
    """The validation verdict of one mirror row (CR-WATER78 section 4.4)."""
    domain = (row["domain"] or "").lower()
    unit_raw = (row["unit"] or "").strip()
    unit = unit_raw.lower()
    dclass = (row["device_class"] or "").lower() or None
    sclass = str(_attrs(row).get("state_class") or "").lower() or None

    def out(verdict: str, code: str, canon: str | None = None, factor: int | None = None) -> Verdict:
        he, en = MSG[code]
        return Verdict(verdict, code, he.format(unit=unit_raw or "-"), en.format(unit=unit_raw or "-"), canon, factor)

    if domain != "sensor":
        return out("rejected", "domain_rejected")
    if dclass == "gas":
        return out("rejected", "gas_later")
    if dclass == "volume_flow_rate" or _is_flow_unit(unit):
        return out("rejected", "flow_rate")
    if not unit:
        return out("rejected", "unit_missing")
    if unit not in UNITS:
        return out("rejected", "unit_rejected")
    if dclass not in ALLOWED_CLASSES:
        return out("rejected", "device_class_rejected")
    if sclass == "measurement":
        return out("rejected", "measurement")
    canon, factor = UNITS[unit]
    state = row["state"]
    warn: str | None = None
    if state is None or str(state).strip().lower() in NOT_NUMERIC_STATES:
        warn = "warn_unavailable"
    else:
        try:
            v = float(state)
        except (TypeError, ValueError):
            return out("rejected", "state_not_numeric")
        if v != v or v in (float("inf"), float("-inf")):
            return out("rejected", "state_not_numeric")
        if v < 0:
            return out("rejected", "state_negative")
    if warn is None and sclass == "total":
        warn = "warn_total"
    if warn is None and dclass is None:
        warn = "warn_no_device_class"
    if warn is None and same_device_meter:
        warn = "warn_same_device"
    if warn:
        return out("warning", warn, canon, factor)
    return out("ok", "ok", canon, factor)


def to_ml(state: Any, factor_ul: int) -> int | None:
    """The counter value in mL (exact decimal arithmetic, half up), or None when the state is not a usable number."""
    if state is None:
        return None
    text = str(state).strip()
    if text.lower() in NOT_NUMERIC_STATES:
        return None
    try:
        v = Decimal(text)
    except InvalidOperation:
        return None
    if not v.is_finite() or v < 0:
        return None
    return int((v * factor_ul / 1000).to_integral_value(rounding=ROUND_HALF_UP))


def typed_ml(value: Any, unit: str) -> int:
    """A typed reading (litres or m3, decimal text or number) in mL; 422 when it is not a non-negative number."""
    try:
        v = Decimal(str(value).strip().replace(",", "."))
    except InvalidOperation:
        v = Decimal(-1)
    if not v.is_finite() or v < 0 or v > Decimal("1e12"):
        raise ApiError(422, "validation", "הערך אינו מספר תקין.", details={"fields": ["value"], "message_en": "The value is not a valid number."})
    per = Decimal(1_000_000) if unit == "m3" else Decimal(1000)
    return int((v * per).to_integral_value(rounding=ROUND_HALF_UP))


def litres(ml: int | None) -> float | None:
    return None if ml is None else round(ml / 1000.0, 3)


def display(ml: int | None) -> dict[str, Any] | None:
    """Owner Q10: m3 with 3 decimals, litres below 1 m3 (`unit` is 'm3' or 'L')."""
    if ml is None:
        return None
    if abs(ml) >= 1_000_000:
        return {"value": round(ml / 1_000_000.0, 3), "unit": "m3"}
    return {"value": round(ml / 1000.0, 1), "unit": "L"}


# ---------------------------------------------------------------- the store and the installation zone

def store_for(settings: Any) -> st.EnergyStore:
    """The water time-series store (`<data_dir>/water.db`, the energy store's schema and code, the water counter profile)."""
    return st.store_at(Path(settings.data_dir) / FILE_NAME, WATER_PROFILE)


def tz_of(conn: sqlite3.Connection):
    return zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")


def interval_floor(conn: sqlite3.Connection, now: int) -> int:
    months = int(ws.value(conn, "water.interval_retention_months"))
    floor = now - int(months * 30.44 * 86400)
    return floor - floor % st.BUCKET_S + st.BUCKET_S


# ---------------------------------------------------------------- candidates

DEVICE_NAME_SQL = "COALESCE(NULLIF(d.name_by_user, ''), NULLIF(d.name, ''))"


def _live_refs(conn: sqlite3.Connection) -> dict[str, str]:
    return {r["source_ref"]: r["id"] for r in conn.execute("SELECT id, source_ref FROM water_meters WHERE status <> 'retired'").fetchall()}


def _live_devices(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute(
        "SELECT e.device_id FROM water_meters m JOIN ha_entities e ON e.entity_id = m.source_ref WHERE m.status <> 'retired' AND e.device_id IS NOT NULL").fetchall()}


def candidates(conn: sqlite3.Connection, q: str | None, area_id: str | None, include_rejected: bool, limit: int) -> list[dict[str, Any]]:
    """Mirror sensors that could be water meters, with their verdict; water-like sensors first. Names and the verdict only."""
    where = ["e.removed_at IS NULL", "e.disabled = 0", "e.domain = 'sensor'"]
    args: list[Any] = []
    if q:
        where.append("(e.name LIKE ? OR e.original_name LIKE ? OR e.entity_id LIKE ? OR d.name LIKE ? OR d.name_by_user LIKE ?)")
        like = f"%{q.strip()}%"
        args += [like] * 5
    if area_id:
        where.append("e.area_id = ?")
        args.append(area_id)
    rows = conn.execute(
        f"""SELECT e.entity_id, e.name, e.original_name, e.domain, e.device_class, e.unit, e.state, e.attributes_json, e.area_id, e.area_name, e.device_id,
                   e.ha_floor_id, e.ha_floor_name, {DEVICE_NAME_SQL} AS device_name
            FROM ha_entities e LEFT JOIN ha_devices d ON d.device_id = e.device_id AND d.removed_at IS NULL
            WHERE {' AND '.join(where)}
            ORDER BY CASE WHEN e.device_class = 'water' THEN 0 WHEN lower(COALESCE(e.unit, '')) IN ('l', 'm³', 'm3', 'gal', 'ft³') THEN 1 ELSE 2 END, e.name, e.entity_id
            LIMIT ?""",
        (*args, max(limit * 4, limit)),
    ).fetchall()
    live = _live_refs(conn)
    devices = _live_devices(conn)
    out: list[dict[str, Any]] = []
    for r in rows:
        v = judge(r, same_device_meter=bool(r["device_id"]) and r["device_id"] in devices and r["entity_id"] not in live)
        if v.verdict == "rejected" and not include_rejected:
            continue
        out.append({
            "ref": r["entity_id"], "name": r["name"] or r["original_name"] or r["entity_id"], "device_name": r["device_name"],
            "area_id": r["area_id"], "area_name": r["area_name"], "floor_id": r["ha_floor_id"], "floor_name": r["ha_floor_name"],
            "unit": r["unit"], "device_class": r["device_class"], "state_class": _attrs(r).get("state_class"), "state": r["state"],
            "verdict": v.verdict, "code": v.code, "message": v.message, "already_meter_id": live.get(r["entity_id"]),
        })
        if len(out) >= limit:
            break
    return out


# ---------------------------------------------------------------- registry

COLUMNS = ("m.id, m.medium, m.source_kind, m.source_ref, m.display_name, m.unit, m.unit_factor, m.area_id, m.kind, m.status, m.status_reason, "
           "m.max_flow_lph, m.revision, m.created_at, m.created_by, m.updated_at, m.retired_at")
AREA_SQL = f"""SELECT {COLUMNS}, {DEVICE_NAME_SQL} AS device_name, COALESCE(a.name, e.area_name) AS area_name, COALESCE(m.area_id, e.area_id) AS eff_area_id,
                      CASE WHEN a.area_id IS NOT NULL THEN a.floor_id ELSE e.ha_floor_id END AS floor_id,
                      CASE WHEN a.area_id IS NOT NULL THEN f.name ELSE e.ha_floor_name END AS floor_name
               FROM water_meters m LEFT JOIN ha_entities e ON e.entity_id = m.source_ref
               LEFT JOIN ha_devices d ON d.device_id = e.device_id AND d.removed_at IS NULL
               LEFT JOIN ha_areas a ON a.area_id = COALESCE(m.area_id, e.area_id)
               LEFT JOIN ha_floors f ON f.floor_id = a.floor_id"""
NOT_FOUND_HE, NOT_FOUND_EN = "המונה לא נמצא.", "The meter was not found."


def not_found() -> ApiError:
    return ApiError(404, "not_found", NOT_FOUND_HE, details={"message_en": NOT_FOUND_EN})


def get(conn: sqlite3.Connection, meter_id: str) -> sqlite3.Row | None:
    return conn.execute(f"{AREA_SQL} WHERE m.id = ?", (meter_id,)).fetchone()


def list_rows(conn: sqlite3.Connection, include_retired: bool = False) -> list[sqlite3.Row]:
    where = "" if include_retired else " WHERE m.status <> 'retired'"
    return conn.execute(f"{AREA_SQL}{where} ORDER BY m.display_name, m.id").fetchall()


def require_row(conn: sqlite3.Connection, meter_id: str) -> sqlite3.Row:
    row = get(conn, meter_id)
    if row is None:
        raise not_found()
    return row


def _mirror(conn: sqlite3.Connection, ref: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (ref,)).fetchone()


def _refuse(v: Verdict) -> ApiError:
    return ApiError(422, API_CODE.get(v.code, "meter_unit_rejected"), v.message, details={"code": v.code, "message_en": v.message_en})


def _check_source(conn: sqlite3.Connection, ref: str, *, ignore_meter: str | None = None) -> Verdict:
    row = _mirror(conn, ref)
    if row is None:
        raise ApiError(422, "meter_unit_rejected", "החיישן לא נמצא בתשתית המערכת.", details={"code": "source_missing", "message_en": "The sensor was not found."})
    dup = conn.execute("SELECT id FROM water_meters WHERE source_ref = ? AND status <> 'retired' AND id IS NOT ?", (ref, ignore_meter)).fetchone()
    if dup:
        raise conflict("meter_duplicate", "החיישן כבר רשום כמונה.", meter_id=dup["id"], message_en="The sensor is already a meter.")
    v = judge(row)
    if v.verdict == "rejected":
        raise _refuse(v)
    return v


NAME_TAKEN = "קיים כבר מונה בשם הזה, לא ניתן להקים שני מונים באותו שם"


def check_name_free(conn: sqlite3.Connection, name: str, exclude_id: str | None = None) -> None:
    key = name.strip().casefold()
    for r in conn.execute("SELECT id, display_name FROM water_meters WHERE status != 'retired'").fetchall():
        if r["id"] != exclude_id and (r["display_name"] or "").strip().casefold() == key:
            raise conflict("meter_name_taken", NAME_TAKEN, fields=["display_name"], message_en="A meter with this name already exists.")


def create(conn: sqlite3.Connection, *, source_ref: str, display_name: str | None, area_id: str | None, kind: str | None,
           max_flow_lph: float | None, actor: str | None) -> tuple[str, Verdict]:
    v = _check_source(conn, source_ref)
    row = _mirror(conn, source_ref)
    name = ((display_name or "").strip() or (row["name"] if row is not None else "") or source_ref)[:120]
    check_name_free(conn, name)
    mid, now = new_id(), now_iso()
    conn.execute(
        """INSERT INTO water_meters(id, medium, source_kind, source_ref, display_name, unit, unit_factor, area_id, kind, status, max_flow_lph, revision, created_at, created_by, updated_at)
           VALUES (?, 'water', 'ha_entity', ?, ?, ?, ?, ?, ?, 'active', ?, 1, ?, ?, ?)""",
        (mid, source_ref, name, v.unit, v.unit_factor, area_id, kind or "main", float(max_flow_lph) if max_flow_lph else DEFAULT_MAX_FLOW_LPH, now, actor, now),
    )
    conn.execute("INSERT INTO water_meter_epochs(id, meter_id, started_at, reason, source_ref, created_by, created_at) VALUES (?, ?, ?, 'first', ?, ?, ?)",
                 (new_id(), mid, now, source_ref, actor, now))
    return mid, v


def _check_revision(row: sqlite3.Row, revision: int) -> None:
    if row["revision"] != revision:
        raise conflict("revision_conflict", "המונה השתנה בינתיים. רעננו ונסו שוב.", current_revision=row["revision"], message_en="The meter changed meanwhile.")


def _retired() -> ApiError:
    return conflict("meter_retired", "המונה הוצא משימוש.", message_en="The meter is retired.")


def update(conn: sqlite3.Connection, meter_id: str, revision: int, fields: dict[str, Any]) -> list[str]:
    row = require_row(conn, meter_id)
    _check_revision(row, revision)
    if row["status"] == "retired":
        raise _retired()
    sets: list[str] = []
    args: list[Any] = []
    changed: list[str] = []
    if fields.get("display_name") is not None:
        name = str(fields["display_name"]).strip()[:120]
        if not name:
            raise ApiError(422, "validation", "שם המונה חסר.", details={"fields": ["display_name"], "message_en": "The meter name is missing."})
        if name.casefold() != (row["display_name"] or "").strip().casefold():
            check_name_free(conn, name, meter_id)
        sets.append("display_name = ?"); args.append(name); changed.append("display_name")
    if "area_id" in fields:
        sets.append("area_id = ?"); args.append(fields["area_id"] or None); changed.append("area_id")
    if fields.get("kind") is not None:
        sets.append("kind = ?"); args.append(fields["kind"]); changed.append("kind")
    if fields.get("max_flow_lph") is not None:
        sets.append("max_flow_lph = ?"); args.append(float(fields["max_flow_lph"])); changed.append("max_flow_lph")
    if fields.get("status") is not None and fields["status"] != row["status"]:
        status = fields["status"]
        if status == "active":
            m = _mirror(conn, row["source_ref"])
            if m is not None and UNITS.get((m["unit"] or "").strip().lower(), (None,))[0] != row["unit"]:
                raise ApiError(422, "meter_unit_rejected", "יחידת המדידה של המונה השתנתה. אי אפשר להפעיל אותו מחדש; החליפו מונה.",
                               details={"code": "unit_changed", "message_en": "The meter's unit changed; replace the meter."})
        sets.append("status = ?"); args.append(status)
        sets.append("status_reason = ?"); args.append("manual" if status == "paused" else None)
        changed.append("status")
    if not sets:
        return []
    sets.append("revision = revision + 1"); sets.append("updated_at = ?"); args.append(now_iso())
    conn.execute(f"UPDATE water_meters SET {', '.join(sets)} WHERE id = ?", (*args, meter_id))
    return changed


def retire(conn: sqlite3.Connection, meter_id: str, revision: int) -> None:
    row = require_row(conn, meter_id)
    _check_revision(row, revision)
    if row["status"] == "retired":
        raise _retired()
    now = now_iso()
    conn.execute("UPDATE water_meters SET status = 'retired', status_reason = NULL, retired_at = ?, updated_at = ?, revision = revision + 1 WHERE id = ?", (now, now, meter_id))
    conn.execute("UPDATE water_meter_epochs SET ended_at = ? WHERE meter_id = ? AND ended_at IS NULL", (now, meter_id))


def current_epoch(conn: sqlite3.Connection, meter_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM water_meter_epochs WHERE meter_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1", (meter_id,)).fetchone()


def epochs(conn: sqlite3.Connection, meter_id: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM water_meter_epochs WHERE meter_id = ? ORDER BY started_at, created_at", (meter_id,)).fetchall()


def replace(conn: sqlite3.Connection, meter_id: str, revision: int, *, at: str, final_ml: int | None, start_ml: int | None,
            new_ref: str | None, note: str | None, actor: str | None) -> tuple[str, str]:
    """Close the current counter life and open a new one (main DB side; the store side is EnergyStore.start_epoch)."""
    row = require_row(conn, meter_id)
    _check_revision(row, revision)
    if row["status"] == "retired":
        raise _retired()
    reason, ref, unit, factor = "replaced", row["source_ref"], row["unit"], row["unit_factor"]
    if new_ref and new_ref != row["source_ref"]:
        v = _check_source(conn, new_ref, ignore_meter=meter_id)
        reason, ref, unit, factor = "source_changed", new_ref, v.unit, v.unit_factor
    last = current_epoch(conn, meter_id)
    if last is not None and last["started_at"] >= at:
        raise ApiError(422, "validation", "מועד ההחלפה חייב להיות אחרי תחילת המונה הנוכחי.", details={"fields": ["at"], "message_en": "The replacement must be after the current counter life began."})
    conn.execute("UPDATE water_meter_epochs SET ended_at = ?, end_reading_ml = ? WHERE meter_id = ? AND ended_at IS NULL", (at, final_ml, meter_id))
    eid = new_id()
    conn.execute("""INSERT INTO water_meter_epochs(id, meter_id, started_at, start_reading_ml, reason, source_ref, note, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""", (eid, meter_id, at, start_ml, reason, ref, (note or None) and note[:500], actor, now_iso()))
    status, sreason = row["status"], row["status_reason"]
    if status == "paused" and sreason == "unit_changed":
        status, sreason = "active", None
    conn.execute("UPDATE water_meters SET source_ref = ?, unit = ?, unit_factor = ?, status = ?, status_reason = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
                 (ref, unit, factor, status, sreason, now_iso(), meter_id))
    return eid, reason


def pause_for_unit_change(conn: sqlite3.Connection, meter_id: str) -> None:
    conn.execute("UPDATE water_meters SET status = 'paused', status_reason = 'unit_changed', revision = revision + 1, updated_at = ? WHERE id = ? AND status = 'active'",
                 (now_iso(), meter_id))


# ---------------------------------------------------------------- floor scope (owner Q5: apply ha_scope)

class Reach:
    """Which meters a caller may see: `water.view` installation-wide sees all; a floor-scoped holder sees a meter only when its
    entity is placed on one of his floors (the temperature / elevators rule, ha_scope.entity_visible). Built once per request."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal):
        self.wide, self.floors = ha_scope.visible_floors(conn, principal, ws.VIEW)
        self._placed = None if self.wide else ha_scope.placements(conn)

    @property
    def any(self) -> bool:
        return self.wide or bool(self.floors)

    def sees(self, row: Any) -> bool:
        return self.wide or ha_scope.entity_visible(False, self.floors, self._placed or {}, row["source_ref"])

    def require(self, conn: sqlite3.Connection, meter_id: str) -> sqlite3.Row:
        """The meter, or the uniform 404 (an invisible meter and a missing one answer the same)."""
        row = get(conn, meter_id)
        if row is None or not self.sees(row):
            raise not_found()
        return row


# ---------------------------------------------------------------- status and consumption

def status_of(row: Any, cursor: st.CursorInfo | None, now: int, stale_s: int) -> str:
    if row["status"] == "retired":
        return "retired"
    if row["status"] == "paused":
        return "paused"
    seen = cursor.seen_ts if cursor else None
    return "reporting" if seen is not None and now - seen <= stale_s else "not_reporting"


def day_start(ts: int, tz: Any) -> int:
    return st.day_bounds(st.local_date(ts, tz), tz)[0]


def month_start(ts: int, tz: Any) -> int:
    return st.day_bounds(st.local_date(ts, tz).replace(day=1), tz)[0]


def epoch_to_iso(ts: int | None) -> str | None:
    if ts is None:
        return None
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
