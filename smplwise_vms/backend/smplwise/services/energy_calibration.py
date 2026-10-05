"""EL6: manual readings of the physical electricity meter and calibration of the system counter against it.

Design and the reasons: docs/changes/EL6-MANUAL-READING-CALIBRATION.md. In short:

- A **calibration** says: physical reading = factor x system counter + offset, from local midnight of a date until the next
  calibration of the same counter life (a meter replacement starts uncalibrated). Consumption is factor x the system's
  consumption; the offset only moves the printed readings. It is applied in ONE place - the readings provider
  (services/energy_provider.py) - so the meters screen, the bill computation, the time-of-use split, the history chart and the
  bill PDF (which prints the sealed snapshot) all see the same numbers. Stored readings are never rewritten: the factor is applied
  when energy is read. A calibration may not start before the end of the last issued bill that contains the meter, and each one
  starts after the previous one: issued bills stay reproducible.
- A **manual reading** is what the physical meter showed at an instant. It is always kept (audit trail, deviation from the
  system). It changes the series only inside a reporting gap (services/energy_store.EnergyStore.manual_reading): it closes an
  open gap (the meter has not reported since) or re-splits a closed gap at its instant - never more energy than the counter
  itself recorded in a closed gap, and never inside a billed range.
- Undo: within UNDO_WINDOW_S of saving, by a holder of energy.manage, and only while no issued bill depends on it. An undone
  item stays in the list (voided, with who and when).

Main-DB tables: migration 0058_energy_manual_readings.sql. Permissions: reads energy.view, writes energy.manage."""
from __future__ import annotations

import datetime as dt
import sqlite3
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any, Sequence
from zoneinfo import ZoneInfo

from ..db import new_id, now_iso
from ..errors import ApiError, conflict
from . import energy_store as st
from .timeutil import parse_utc

UTC = dt.timezone.utc
UNDO_WINDOW_S = 24 * 3600
FUTURE_SLACK_S = 300
FACTOR_MIN, FACTOR_MAX = Decimal("0.5"), Decimal("2")
FACTOR_PLACES = 6
MAX_VALUE_WH = 10**15          # 1e12 kWh: beyond any real meter
MAX_OFFSET_WH = 10**15
UNIT_WH = {"kWh": 1000, "Wh": 1, "MWh": 1_000_000}
ONE = Decimal(1)

EFFECT_TEXT = {
    "open_gap": "הקריאה השלימה את הפער מאז הדיווח האחרון. הצריכה עד הקריאה חולקה לפי זמן.",
    "closed_gap": "הקריאה חילקה מחדש את הצריכה בפער הדיווח. הסכום הכולל לא השתנה.",
    "reported": "המונה דיווח בזמן הזה. הקריאה נשמרה להשוואה בלבד.",
    "outside_counter": "הקריאה שונה מערך המונה במערכת. היא נשמרה להשוואה; לתיקון קבוע אפשר להגדיר כיול.",
    "no_counter_data": "אין במערכת קריאות סביב הזמן הזה. הקריאה נשמרה להשוואה בלבד.",
    "counter_events": "בזמן הזה היה איפוס או קפיצה במונה. הקריאה נשמרה להשוואה בלבד.",
    "implausible": "הקריאה גבוהה מהסביר להספק המרבי של המונה. היא נשמרה להשוואה בלבד.",
    "billed": "התקופה הזו כבר חויבה. הקריאה נשמרה להשוואה בלבד.",
}
UNDO_REFUSED = {
    "counter_events": "אחרי הקריאה היה איפוס או קפיצה במונה, ולכן אי אפשר לבטל אותה.",
    "counter_changed": "המונה השתנה מאז הקריאה, ולכן אי אפשר לבטל אותה.",
    "missing": "הקריאה כבר לא נמצאת בנתוני המונה, ולכן אי אפשר לבטל אותה.",
}


# ---------------------------------------------------------------- numbers

def to_decimal(value: Any, field: str) -> Decimal:
    if isinstance(value, bool) or value is None:
        raise ApiError(422, "validation", "הערך חסר או אינו מספר.", details={"fields": [field]})
    try:
        d = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        raise ApiError(422, "validation", "הערך אינו מספר.", details={"fields": [field]}) from None
    if not d.is_finite():
        raise ApiError(422, "validation", "הערך אינו מספר.", details={"fields": [field]})
    return d


def round_int(value: Decimal) -> int:
    return int(value.to_integral_value(rounding=ROUND_HALF_UP))


def reading_wh(value: Any, unit: str) -> tuple[int, str]:
    """A typed meter reading -> (Wh, the decimal text as typed). Non-negative, at most 1e12 kWh, rounded half up to whole Wh."""
    if unit not in UNIT_WH:
        raise ApiError(422, "validation", "יחידת המידה חייבת להיות קוט״ש, וואט־שעה או מגוואט־שעה.", details={"fields": ["unit"]})
    d = to_decimal(value, "value")
    if d < 0:
        raise ApiError(422, "validation", "קריאת מונה אינה יכולה להיות שלילית.", details={"fields": ["value"]})
    wh = round_int(d * UNIT_WH[unit])
    if wh > MAX_VALUE_WH:
        raise ApiError(422, "validation", "הקריאה גדולה מדי.", details={"fields": ["value"]})
    return wh, format(d.normalize(), "f")


def parse_factor(value: Any) -> Decimal:
    f = to_decimal(value, "factor")
    exp = f.as_tuple().exponent
    if isinstance(exp, int) and exp < -FACTOR_PLACES:
        raise ApiError(422, "validation", f"המקדם יכול לכלול עד {FACTOR_PLACES} ספרות אחרי הנקודה.", details={"fields": ["factor"]})
    if not FACTOR_MIN <= f <= FACTOR_MAX:
        raise ApiError(422, "validation", "המקדם חייב להיות בין 0.5 ל-2.", details={"fields": ["factor"]})
    return f


def factor_text(f: Decimal) -> str:
    text = format(f.normalize(), "f")
    return text if "." in text else text + ".0"


# ---------------------------------------------------------------- calibration segments (used by the provider)

@dataclass(frozen=True)
class Segment:
    """[start, end) on the UTC epoch-second line with one calibration (end None = open). Identity: factor 1, offset 0."""

    start: int
    end: int | None
    factor: Decimal
    offset_wh: int
    calibration_id: str | None
    effective_date: str | None

    @property
    def identity(self) -> bool:
        return self.factor == ONE and self.offset_wh == 0

    def physical(self, raw_wh: int | None) -> int | None:
        if raw_wh is None:
            return None
        if self.identity:
            return raw_wh
        return round_int(self.factor * raw_wh) + self.offset_wh

    def counter(self, physical_wh: int) -> int:
        if self.identity:
            return physical_wh
        return round_int((Decimal(physical_wh) - self.offset_wh) / self.factor)

    def energy(self, raw_wh: int) -> Decimal:
        return Decimal(raw_wh) if self.factor == ONE else self.factor * raw_wh


IDENTITY = Segment(0, None, ONE, 0, None, None)


def _ts(text: str | None) -> int | None:
    return None if not text else int(parse_utc(text).timestamp())


def has_tables(conn: sqlite3.Connection) -> bool:
    try:
        return conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'energy_meter_calibrations'").fetchone() is not None
    except sqlite3.Error:
        return False


def active_calibrations(conn: sqlite3.Connection, meter_id: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM energy_meter_calibrations WHERE meter_id = ? AND voided_at IS NULL ORDER BY effective_from, created_at",
                        (meter_id,)).fetchall()


def segments(conn: sqlite3.Connection, meter_id: str) -> list[Segment]:
    """The calibration line of one meter, covering all time, adjacent equal calibrations merged. Without any calibration: one
    identity segment (and nothing else is read)."""
    if not has_tables(conn):
        return [IDENTITY]
    cals = active_calibrations(conn, meter_id)
    if not cals:
        return [IDENTITY]
    epochs = conn.execute("SELECT id, started_at, ended_at FROM energy_meter_epochs WHERE meter_id = ? ORDER BY started_at, created_at", (meter_id,)).fetchall()
    out: list[Segment] = []
    for i, e in enumerate(epochs):
        lo = 0 if i == 0 else int(_ts(e["started_at"]) or 0)
        hi = _ts(e["ended_at"])
        if i + 1 < len(epochs):
            hi = _ts(epochs[i + 1]["started_at"]) if hi is None else hi
        mine = [c for c in cals if c["epoch_id"] == e["id"]]
        cur_start, cur = lo, IDENTITY
        for c in mine:
            at = max(int(_ts(c["effective_from"]) or 0), lo)
            if hi is not None and at >= hi:
                continue
            if at > cur_start:
                out.append(Segment(cur_start, at, cur.factor, cur.offset_wh, cur.calibration_id, cur.effective_date))
            cur_start = at
            cur = Segment(at, None, Decimal(c["factor"]), int(c["offset_wh"]), c["id"], c["effective_date"])
        out.append(Segment(cur_start, hi, cur.factor, cur.offset_wh, cur.calibration_id, cur.effective_date))
    if not out:
        return [IDENTITY]
    merged: list[Segment] = [out[0]]
    for s in out[1:]:
        last = merged[-1]
        if s.factor == last.factor and s.offset_wh == last.offset_wh and s.calibration_id == last.calibration_id:
            merged[-1] = Segment(last.start, s.end, last.factor, last.offset_wh, last.calibration_id, last.effective_date)
        else:
            merged.append(s)
    first = merged[0]
    if first.start > 0:
        merged.insert(0, Segment(0, first.start, ONE, 0, None, None))
    last = merged[-1]
    if last.end is not None:
        merged.append(Segment(last.end, None, ONE, 0, None, None))
    return merged


def segment_at(segs: Sequence[Segment], ts: int) -> Segment:
    for s in segs:
        if s.start <= ts and (s.end is None or ts < s.end):
            return s
    return IDENTITY


def pieces(segs: Sequence[Segment], a: int, b: int) -> list[tuple[int, int, Segment]]:
    """[a, b) cut at the segment edges: [(x, y, segment)]."""
    out: list[tuple[int, int, Segment]] = []
    for s in segs:
        x, y = max(a, s.start), min(b, s.end if s.end is not None else b)
        if y > x:
            out.append((x, y, s))
    return out or [(a, b, IDENTITY)]


def all_identity(segs: Sequence[Segment], a: int, b: int) -> bool:
    return all(s.identity for _x, _y, s in pieces(segs, a, b))


# ---------------------------------------------------------------- billed guard

def billed_until(conn: sqlite3.Connection, meter_id: str) -> int | None:
    """The end (UTC epoch seconds) of the last issued / sent / paid bill whose sealed snapshot contains the meter; None = never billed.
    A calibration may not start before it, a manual reading may not re-split energy before it, and an undo that would change
    energy before it is refused: issued bills stay reproducible."""
    try:
        row = conn.execute(
            """SELECT MAX(json_extract(b.snapshot_json, '$.period.end_utc')) FROM energy_bills b
               WHERE b.state IN ('issued', 'sent', 'paid')
                 AND EXISTS (SELECT 1 FROM json_each(b.snapshot_json, '$.meters') j WHERE json_extract(j.value, '$.meter_id') = ?)""",
            (meter_id,),
        ).fetchone()
    except sqlite3.Error:
        return None
    return _ts(row[0]) if row and row[0] else None


# ---------------------------------------------------------------- reading side helpers

def epoch_of(conn: sqlite3.Connection, meter_id: str, ts: int) -> tuple[sqlite3.Row | None, int, int | None]:
    """(the counter life that contains ts, its start, its end or None). The first life also covers anything before its start."""
    rows = conn.execute("SELECT * FROM energy_meter_epochs WHERE meter_id = ? ORDER BY started_at, created_at", (meter_id,)).fetchall()
    for i, e in enumerate(rows):
        lo = 0 if i == 0 else int(_ts(e["started_at"]) or 0)
        hi = _ts(e["ended_at"])
        if i + 1 < len(rows):
            nxt = int(_ts(rows[i + 1]["started_at"]) or 0)
            hi = nxt if hi is None else min(hi, nxt)
        if ts >= lo and (hi is None or ts < hi):
            return e, lo, hi
    return None, 0, None


def raw_reading_at(store: st.EnergyStore, meter_id: str, ts: int) -> tuple[int | None, bool]:
    """The system counter (its own scale) at ts, interpolated by time between the accepted readings around it - the provider's
    reading_at rule - and whether a reading lies within 15 minutes."""
    before, after = store.reading_around(meter_id, ts)
    exact = (before is not None and ts - before[0] <= 900) or (after is not None and after[0] - ts <= 900)
    if before is not None and after is not None and after[1] >= before[1] and after[0] > before[0]:
        return before[1] + round_int(Decimal(after[1] - before[1]) * (ts - before[0]) / (after[0] - before[0])), exact
    if before is not None and ts - before[0] <= 900:
        return before[1], exact
    if after is not None and before is None and after[0] - ts <= 900:
        return after[1], exact
    return None, exact


def _iso(ts: int | None) -> str | None:
    return None if ts is None else dt.datetime.fromtimestamp(ts, UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _kwh(wh: int | None) -> float | None:
    return None if wh is None else round(wh / 1000.0, 3)


def _user_names(conn: sqlite3.Connection, ids: set[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for uid in ids:
        r = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (uid,)).fetchone()
        if r is not None:
            out[uid] = (r["display_name"] or "").strip() or r["username"]
    return out


def _can_undo(created_at: str, voided_at: str | None, now: int) -> tuple[bool, str | None]:
    until = int(parse_utc(created_at).timestamp()) + UNDO_WINDOW_S
    return (voided_at is None and now <= until), _iso(until)


# ---------------------------------------------------------------- manual readings

def _monotonic(conn: sqlite3.Connection, meter_id: str, epoch_id: str, ts: int, value_wh: int) -> None:
    """Readings of the same physical meter (counter life) never go down in time; one reading per instant."""
    at = _iso(ts)
    same = conn.execute("SELECT 1 FROM energy_meter_manual_readings WHERE meter_id = ? AND read_at = ? AND voided_at IS NULL", (meter_id, at)).fetchone()
    if same:
        raise conflict("reading_exists", "כבר נשמרה קריאה למונה הזה באותו זמן.", fields=["read_at"])
    prev = conn.execute("SELECT read_at, value_wh FROM energy_meter_manual_readings WHERE meter_id = ? AND epoch_id = ? AND voided_at IS NULL AND read_at < ? "
                        "ORDER BY read_at DESC LIMIT 1", (meter_id, epoch_id, at)).fetchone()
    nxt = conn.execute("SELECT read_at, value_wh FROM energy_meter_manual_readings WHERE meter_id = ? AND epoch_id = ? AND voided_at IS NULL AND read_at > ? "
                       "ORDER BY read_at LIMIT 1", (meter_id, epoch_id, at)).fetchone()
    if prev is not None and value_wh < prev["value_wh"]:
        raise ApiError(422, "reading_not_monotonic", "הקריאה נמוכה מקריאה ידנית קודמת של אותו מונה.",
                       details={"fields": ["value"], "neighbour": {"read_at": prev["read_at"], "value_kwh": _kwh(prev["value_wh"])}})
    if nxt is not None and value_wh > nxt["value_wh"]:
        raise ApiError(422, "reading_not_monotonic", "הקריאה גבוהה מקריאה ידנית מאוחרת יותר של אותו מונה.",
                       details={"fields": ["value"], "neighbour": {"read_at": nxt["read_at"], "value_kwh": _kwh(nxt["value_wh"])}})


def save_reading(conn: sqlite3.Connection, store: st.EnergyStore, tz: ZoneInfo, meter: sqlite3.Row, *, read_at: int, value: Any, unit: str,
                 note: str | None, actor: str | None, now: int, dry_run: bool) -> dict[str, Any]:
    """Validate a typed reading, work out what it does, and - unless dry_run - store it (energy.db first, then the row)."""
    if meter["status"] == "retired":
        raise conflict("meter_retired", "המונה הוצא משימוש.")
    value_wh, typed = reading_wh(value, unit)
    if read_at > now + FUTURE_SLACK_S:
        raise ApiError(422, "validation", "זמן הקריאה בעתיד.", details={"fields": ["read_at"]})
    created = int(parse_utc(meter["created_at"]).timestamp())
    epoch, lo, hi = epoch_of(conn, meter["id"], read_at)
    if epoch is None or read_at < created - FUTURE_SLACK_S:
        raise ApiError(422, "validation", "זמן הקריאה לפני הוספת המונה למערכת.", details={"fields": ["read_at"]})
    _monotonic(conn, meter["id"], epoch["id"], read_at, value_wh)
    segs = segments(conn, meter["id"])
    seg = segment_at(segs, read_at)
    counter_wh = seg.counter(value_wh)
    sys_raw, exact = raw_reading_at(store, meter["id"], read_at)
    billed = billed_until(conn, meter["id"])
    plan = store.manual_reading(meter["id"], ts=read_at, raw_wh=counter_wh, max_kw=float(meter["max_kw"]), epoch_lo=lo, epoch_hi=hi,
                                billed_until=billed, tz=tz, dry_run=dry_run)
    system_wh = seg.physical(sys_raw)
    row = {
        "id": None, "meter_id": meter["id"], "epoch_id": epoch["id"], "read_at": _iso(read_at), "value_wh": value_wh, "typed_value": typed, "typed_unit": unit,
        "counter_wh": counter_wh, "system_raw_wh": sys_raw, "system_exact": 1 if exact else 0, "effect": plan.effect, "effect_reason": plan.reason,
        "span_from": _iso(plan.prev[0]) if plan.effect == "allocation" and plan.prev else None,
        "span_to": _iso(plan.next[0]) if plan.effect == "allocation" and plan.next else None,
        "note": (note or "").strip()[:500] or None, "created_by": actor, "created_at": _iso(now), "voided_at": None, "voided_by": None, "void_reason": None,
    }
    if dry_run:
        return reading_out(row, seg_physical=system_wh, now=now, names={})
    rid = new_id()
    row["id"] = rid
    try:
        conn.execute(
            """INSERT INTO energy_meter_manual_readings(id, meter_id, epoch_id, read_at, value_wh, typed_value, typed_unit, counter_wh, system_raw_wh,
               system_exact, effect, effect_reason, span_from, span_to, note, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (rid, row["meter_id"], row["epoch_id"], row["read_at"], value_wh, typed, unit, counter_wh, sys_raw, row["system_exact"], plan.effect, plan.reason,
             row["span_from"], row["span_to"], row["note"], actor, row["created_at"]))
    except sqlite3.Error:
        if plan.effect == "allocation":  # keep energy.db and the main database in step
            store.undo_manual_reading(meter["id"], ts=read_at, raw_wh=counter_wh, epoch_lo=lo, epoch_hi=hi, tz=tz)
        raise
    return reading_out(row, seg_physical=system_wh, now=now, names=_user_names(conn, {actor} if actor else set()))


def reading_out(r: Any, *, seg_physical: int | None, now: int, names: dict[str, str]) -> dict[str, Any]:
    can, until = _can_undo(r["created_at"], r["voided_at"], now)
    deviation = None if seg_physical is None else r["value_wh"] - seg_physical
    return {
        "id": r["id"], "read_at": r["read_at"], "value_wh": r["value_wh"], "value_kwh": _kwh(r["value_wh"]), "typed_value": r["typed_value"], "typed_unit": r["typed_unit"],
        "counter_kwh": _kwh(r["counter_wh"]), "system_kwh": _kwh(seg_physical), "system_exact": bool(r["system_exact"]), "deviation_kwh": _kwh(deviation),
        "effect": r["effect"], "effect_reason": r["effect_reason"], "message": EFFECT_TEXT.get(r["effect_reason"], ""),
        "span_from": r["span_from"], "span_to": r["span_to"], "note": r["note"],
        "created_at": r["created_at"], "created_by": r["created_by"], "created_by_name": names.get(r["created_by"] or "", None),
        "voided_at": r["voided_at"], "voided_by": r["voided_by"], "voided_by_name": names.get(r["voided_by"] or "", None), "void_reason": r["void_reason"],
        "can_undo": can, "undo_until": until,
    }


def undo_reading(conn: sqlite3.Connection, store: st.EnergyStore, tz: ZoneInfo, meter: sqlite3.Row, reading_id: str, *, reason: str | None,
                 actor: str | None, now: int) -> sqlite3.Row:
    r = conn.execute("SELECT * FROM energy_meter_manual_readings WHERE id = ? AND meter_id = ?", (reading_id, meter["id"])).fetchone()
    if r is None:
        raise ApiError(404, "not_found", "הקריאה לא נמצאה.")
    if r["voided_at"] is not None:
        raise conflict("already_undone", "הקריאה כבר בוטלה.")
    if now > int(parse_utc(r["created_at"]).timestamp()) + UNDO_WINDOW_S:
        raise conflict("undo_window_passed", "עבר הזמן שבו אפשר לבטל את הקריאה (24 שעות).")
    anchored = conn.execute("SELECT 1 FROM energy_meter_calibrations WHERE anchor_reading_id = ? AND voided_at IS NULL", (reading_id,)).fetchone()
    if anchored:
        raise conflict("reading_anchors_calibration", "כיול מבוסס על הקריאה הזו. בטלו קודם את הכיול.")
    if r["effect"] == "allocation":
        billed = billed_until(conn, meter["id"])
        start = _ts(r["span_from"]) or 0
        if billed is not None and billed > start:
            raise conflict("reading_billed", "הצריכה שהקריאה שינתה כבר חויבה, ולכן אי אפשר לבטל אותה.")
        _e, lo, hi = epoch_of(conn, meter["id"], int(parse_utc(r["read_at"]).timestamp()))
        refused = store.undo_manual_reading(meter["id"], ts=int(parse_utc(r["read_at"]).timestamp()), raw_wh=int(r["counter_wh"]), epoch_lo=lo, epoch_hi=hi, tz=tz)
        if refused:
            raise conflict("undo_refused", UNDO_REFUSED.get(refused, UNDO_REFUSED["counter_changed"]), reason=refused)
    conn.execute("UPDATE energy_meter_manual_readings SET voided_at = ?, voided_by = ?, void_reason = ? WHERE id = ?",
                 (_iso(now), actor, (reason or "").strip()[:300] or None, reading_id))
    return conn.execute("SELECT * FROM energy_meter_manual_readings WHERE id = ?", (reading_id,)).fetchone()


# ---------------------------------------------------------------- calibrations

def local_midnight(day: dt.date, tz: ZoneInfo) -> int:
    return st.day_bounds(day, tz)[0]


def save_calibration(conn: sqlite3.Connection, store: st.EnergyStore, tz: ZoneInfo, meter: sqlite3.Row, *, effective_date: dt.date, factor: Any,
                     offset_kwh: Any | None, anchor_reading_id: str | None, note: str | None, actor: str | None, now: int, dry_run: bool) -> dict[str, Any]:
    if meter["status"] == "retired":
        raise conflict("meter_retired", "המונה הוצא משימוש.")
    f = parse_factor(factor)
    at = local_midnight(effective_date, tz)
    epoch = conn.execute("SELECT * FROM energy_meter_epochs WHERE meter_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1", (meter["id"],)).fetchone()
    if epoch is None:
        raise conflict("meter_retired", "למונה אין תקופת מונה פעילה.")
    epoch_start = int(parse_utc(epoch["started_at"]).timestamp())
    if at < local_midnight(st.local_date(epoch_start, tz), tz):
        raise ApiError(422, "calibration_before_counter", "התאריך מוקדם מתחילת המונה הנוכחי.", details={"fields": ["effective_date"]})
    if at > now + 366 * 86400:
        raise ApiError(422, "validation", "אפשר לקבוע כיול עד שנה קדימה.", details={"fields": ["effective_date"]})
    last = conn.execute("SELECT effective_date, effective_from FROM energy_meter_calibrations WHERE meter_id = ? AND epoch_id = ? AND voided_at IS NULL "
                        "ORDER BY effective_from DESC LIMIT 1", (meter["id"], epoch["id"])).fetchone()
    if last is not None and at <= int(parse_utc(last["effective_from"]).timestamp()):
        raise conflict("calibration_not_after_last", "כיול חדש חייב להתחיל אחרי הכיול האחרון (" + _fmt_date(last["effective_date"]) + ").",
                       fields=["effective_date"], last_date=last["effective_date"])
    billed = billed_until(conn, meter["id"])
    if billed is not None and at < billed:
        day = st.local_date(billed, tz)
        raise conflict("calibration_billed", "התקופה עד " + _fmt_date(day.isoformat()) + " כבר חויבה. אפשר לכייל רק מהתאריך הזה והלאה.",
                       fields=["effective_date"], first_date=day.isoformat())
    if anchor_reading_id:
        a = conn.execute("SELECT * FROM energy_meter_manual_readings WHERE id = ? AND meter_id = ? AND voided_at IS NULL", (anchor_reading_id, meter["id"])).fetchone()
        if a is None:
            raise ApiError(422, "validation", "הקריאה שנבחרה לא נמצאה.", details={"fields": ["anchor_reading_id"]})
        if a["epoch_id"] != epoch["id"]:
            raise ApiError(422, "validation", "הקריאה שנבחרה שייכת למונה קודם.", details={"fields": ["anchor_reading_id"]})
        raw = a["counter_wh"] if a["effect"] == "allocation" else a["system_raw_wh"]
        if raw is None:
            raise ApiError(422, "anchor_without_counter", "אין ערך מונה במערכת לזמן הקריאה הזו, ולכן אי אפשר לכייל לפיה.", details={"fields": ["anchor_reading_id"]})
        offset_wh = int(a["value_wh"]) - round_int(f * int(raw))
    else:
        offset_wh = 0 if offset_kwh is None else round_int(to_decimal(offset_kwh, "offset_kwh") * 1000)
    if abs(offset_wh) > MAX_OFFSET_WH:
        raise ApiError(422, "validation", "ההפרש גדול מדי.", details={"fields": ["offset_kwh"]})
    row = {"id": None, "meter_id": meter["id"], "epoch_id": epoch["id"], "effective_date": effective_date.isoformat(), "effective_from": _iso(at),
           "factor": factor_text(f), "offset_wh": offset_wh, "anchor_reading_id": anchor_reading_id or None, "note": (note or "").strip()[:500] or None,
           "created_by": actor, "created_at": _iso(now), "voided_at": None, "voided_by": None, "void_reason": None}
    if dry_run:
        return calibration_out(row, now=now, names={}, in_force=False)
    row["id"] = new_id()
    conn.execute("""INSERT INTO energy_meter_calibrations(id, meter_id, epoch_id, effective_date, effective_from, factor, offset_wh, anchor_reading_id, note,
                    created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                 (row["id"], row["meter_id"], row["epoch_id"], row["effective_date"], row["effective_from"], row["factor"], offset_wh, row["anchor_reading_id"],
                  row["note"], actor, row["created_at"]))
    return calibration_out(row, now=now, names=_user_names(conn, {actor} if actor else set()), in_force=False)


def _fmt_date(iso_date: str) -> str:
    d = dt.date.fromisoformat(iso_date)
    return f"{d.day:02d}.{d.month:02d}.{d.year}"


def calibration_out(c: Any, *, now: int, names: dict[str, str], in_force: bool) -> dict[str, Any]:
    can, until = _can_undo(c["created_at"], c["voided_at"], now)
    return {
        "id": c["id"], "effective_date": c["effective_date"], "effective_from": c["effective_from"], "factor": c["factor"], "offset_wh": c["offset_wh"],
        "offset_kwh": _kwh(c["offset_wh"]), "anchor_reading_id": c["anchor_reading_id"], "note": c["note"], "in_force": in_force,
        "created_at": c["created_at"], "created_by": c["created_by"], "created_by_name": names.get(c["created_by"] or "", None),
        "voided_at": c["voided_at"], "voided_by": c["voided_by"], "voided_by_name": names.get(c["voided_by"] or "", None), "void_reason": c["void_reason"],
        "can_undo": can, "undo_until": until,
    }


def undo_calibration(conn: sqlite3.Connection, meter: sqlite3.Row, calibration_id: str, *, reason: str | None, actor: str | None, now: int) -> None:
    c = conn.execute("SELECT * FROM energy_meter_calibrations WHERE id = ? AND meter_id = ?", (calibration_id, meter["id"])).fetchone()
    if c is None:
        raise ApiError(404, "not_found", "הכיול לא נמצא.")
    if c["voided_at"] is not None:
        raise conflict("already_undone", "הכיול כבר בוטל.")
    if now > int(parse_utc(c["created_at"]).timestamp()) + UNDO_WINDOW_S:
        raise conflict("undo_window_passed", "עבר הזמן שבו אפשר לבטל את הכיול (24 שעות). אפשר להגדיר כיול חדש.")
    billed = billed_until(conn, meter["id"])
    if billed is not None and billed > int(parse_utc(c["effective_from"]).timestamp()):
        raise conflict("calibration_billed", "חיוב שהופק כבר משתמש בכיול הזה, ולכן אי אפשר לבטל אותו. אפשר להגדיר כיול חדש.")
    conn.execute("UPDATE energy_meter_calibrations SET voided_at = ?, voided_by = ?, void_reason = ? WHERE id = ?",
                 (_iso(now), actor, (reason or "").strip()[:300] or None, calibration_id))


# ---------------------------------------------------------------- the log of one meter

def suggestion(rows: Sequence[sqlite3.Row], current_epoch_id: str | None) -> dict[str, Any] | None:
    """A factor from the two latest readings of the current counter life that the system measured itself (a system reading within
    15 minutes, saved for comparison), at least a day apart: factor = physical change / system change. Only a hint - nothing applies
    it unless a person saves a calibration."""
    usable = [r for r in rows if r["voided_at"] is None and r["epoch_id"] == current_epoch_id and r["system_exact"] and r["system_raw_wh"] is not None
              and r["effect"] == "record"]
    usable.sort(key=lambda r: r["read_at"])
    for i in range(len(usable) - 1, 0, -1):
        b = usable[i]
        for a in reversed(usable[:i]):
            if int(parse_utc(b["read_at"]).timestamp()) - int(parse_utc(a["read_at"]).timestamp()) < 86400:
                continue
            d_sys = int(b["system_raw_wh"]) - int(a["system_raw_wh"])
            d_phys = int(b["value_wh"]) - int(a["value_wh"])
            if d_sys <= 0 or d_phys <= 0:
                return None
            f = (Decimal(d_phys) / Decimal(d_sys)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            if not FACTOR_MIN <= f <= FACTOR_MAX:
                return None
            return {"factor": factor_text(f), "from_reading_id": a["id"], "to_reading_id": b["id"], "anchor_reading_id": b["id"]}
    return None


def meter_log(conn: sqlite3.Connection, store: st.EnergyStore, tz: ZoneInfo, meter: sqlite3.Row, *, now: int) -> dict[str, Any]:
    readings = conn.execute("SELECT * FROM energy_meter_manual_readings WHERE meter_id = ? ORDER BY read_at DESC, created_at DESC", (meter["id"],)).fetchall()
    cals = conn.execute("SELECT * FROM energy_meter_calibrations WHERE meter_id = ? ORDER BY effective_from DESC, created_at DESC", (meter["id"],)).fetchall()
    ids = {x for r in [*readings, *cals] for x in (r["created_by"], r["voided_by"]) if x}
    names = _user_names(conn, ids)
    segs = segments(conn, meter["id"])
    current = segment_at(segs, now)
    epoch = conn.execute("SELECT id FROM energy_meter_epochs WHERE meter_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1", (meter["id"],)).fetchone()
    items = []
    for r in readings:
        seg = segment_at(segs, int(parse_utc(r["read_at"]).timestamp()))
        items.append(reading_out(r, seg_physical=seg.physical(r["system_raw_wh"]), now=now, names=names))
    billed = billed_until(conn, meter["id"])
    return {
        "meter_id": meter["id"],
        "items": items,
        "calibrations": [calibration_out(c, now=now, names=names, in_force=c["id"] == current.calibration_id) for c in cals],
        "calibration": {"factor": factor_text(current.factor), "offset_kwh": _kwh(current.offset_wh), "calibration_id": current.calibration_id,
                        "effective_date": current.effective_date, "identity": current.identity},
        "suggestion": suggestion(readings, epoch["id"] if epoch else None),
        "billed_until": _iso(billed),
        "first_calibration_date": (st.local_date(billed, tz).isoformat() if billed else None),
        "undo_window_hours": UNDO_WINDOW_S // 3600,
        "units": list(UNIT_WH),
    }


def readings_between(conn: sqlite3.Connection, meter_id: str, start: int, end: int) -> list[sqlite3.Row]:
    """Non-voided manual readings with start <= read_at < end (bill notes)."""
    if not has_tables(conn):
        return []
    return conn.execute("SELECT * FROM energy_meter_manual_readings WHERE meter_id = ? AND voided_at IS NULL AND read_at >= ? AND read_at < ? ORDER BY read_at",
                        (meter_id, _iso(start), _iso(end))).fetchall()
