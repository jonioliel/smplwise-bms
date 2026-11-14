"""CR-WATER78 slice 3 (section 16, owner review 24.10 - mockup v4 APPROVED): water accounts, water + sewage tariffs, bills and tenant
chargeback, on the electricity billing engine's parts.

What is SHARED with electricity and read as it is (owner correction 24.10 - never a water copy):
- VAT (`energy_vat_rates`, energy_billing.vat_rates), the business details on the bill, the payment terms, the customer-number digits and
  the automatic-generation delay (the `energy.billing` settings document, energy_billing.read_settings), the bill retention keys
  (`energy.draft_retention_days`, `energy.bill_retention_years`);
- the customers (`energy_customers`): one tenant card for electricity and water (energy_billing's customer functions);
- the number space: a water bill takes the electricity format YYYY-MM-CCCC[/S][-R] and is registered in the same ledger of numbers ever
  used (`energy_bill_numbers`), so an electricity bill and a water bill never carry the same number.

What is reused as code: the period cycle (energy_periods), the signed meter formula (energy_formula: "+ / -", so "main minus every
sub-meter" = the losses account), the price / VAT pieces and rounding (energy_pricing), the meter window with carried late reports
(energy_consumption.meter_window). Water's own: the readings provider over water.db (`WaterReadings`, millilitres in the integer slots
the engine calls `wh`), two price components per m3 (water, sewage) and the m3 quantity (3 places).

Not built in this slice (recorded in the CR): the PDF of a water bill (the PDF model is the electricity snapshot's), time-of-use prices,
the tariff correction planner (a version a sealed bill used is never changed - a new version is added instead)."""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
import time
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from .. import __version__
from ..audit import audit
from ..db import Database, new_id, now_iso
from ..errors import ApiError, conflict, not_found
from . import energy_billing as eb
from . import energy_counter as ec
from . import energy_formula as fx
from . import energy_periods as per
from . import energy_pricing as px
from . import energy_store as st
from . import water_meters as wm
from . import water_settings as ws
from .energy_billing_provider import BoundaryReading, Consumption, MeterEvent, MeterInfo
from .energy_consumption import MeterWindow, data_until, meter_window
from .energy_provider import coverage_of

log = logging.getLogger("smplwise.water_billing")

SCHEMA = "arx.water.bill_snapshot/1"
ENGINE = "arx.water.billing/1"
VIEW, MANAGE, BILLS = "water.view", "water.manage", "water.bills"
ISSUED_STATES = eb.ISSUED_STATES
STATE_HE = eb.STATE_HE
HISTORY_PERIODS = 12
AUTO_MAX_PER_ACCOUNT = 24
AUTO_RETRY = dt.timedelta(hours=6)
ML_PER_M3 = Decimal(1_000_000)
EXACT_S = 900
MAX_NOTES = 40
COMPONENT_HE = {"water": "צריכת מים", "sewage": "דמי ביוב"}

now_utc = eb.now_utc
_iso, _parse_iso, _date, _fmt_date, _fmt_local, _err = eb._iso, eb._parse_iso, eb._date, eb._fmt_date, eb._fmt_local, eb._err
read_settings = eb.read_settings  # the SHARED billing settings document
vat_rates = eb.vat_rates          # the SHARED VAT rates


def m3(ml: Decimal | int | None) -> Decimal:
    return Decimal(int(ml or 0)) / ML_PER_M3 if not isinstance(ml, Decimal) else ml / ML_PER_M3


def s3(x: Decimal) -> str:
    return str(px.r3(x))


# ====================================================================== the readings provider over water.db

class WaterReadings:
    """The billing subset of the readings protocol (energy_billing_provider) over the water store. Volumes are integer millilitres in the
    slots the engine names `*_wh`; nothing is estimated (the store's allocation by time between accepted readings, like electricity)."""

    def __init__(self, conn: sqlite3.Connection, store: st.EnergyStore, *, now: float | None = None):
        self.conn = conn
        self.store = store
        self.tz = wm.tz_of(conn)
        self._now = now

    def now(self) -> int:
        return int(self._now if self._now is not None else time.time())

    def get_meter(self, meter_id: str) -> MeterInfo | None:
        r = wm.get(self.conn, meter_id)
        return MeterInfo(r["id"], r["display_name"], r["status"]) if r is not None else None

    def list_meters(self, *, include_retired: bool = False) -> list[MeterInfo]:
        return [MeterInfo(r["id"], r["display_name"], r["status"]) for r in wm.list_rows(self.conn, include_retired)]

    def last_report_at(self, meter_id: str) -> dt.datetime | None:
        c = self.store.cursor_info([meter_id]).get(meter_id)
        return _dt(c.seen_ts) if c else None

    def data_until(self, meter_id: str) -> dt.datetime | None:
        c = self.store.cursor_info([meter_id]).get(meter_id)
        if c is None:
            return None
        return _dt(max([t for t in (c.seen_ts, c.last_ts) if t is not None], default=None))

    def consumption(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> Consumption:
        a, b = int(start.timestamp()), int(end.timestamp())
        if b < a:
            raise ValueError("range_invalid")
        r = self.store.consumption(meter_id, a, b, tz=self.tz, interval_floor=wm.interval_floor(self.conn, self.now()))
        return Consumption(meter_id, start, end, r["wh"], coverage_of(r["covered_s"], r["total_s"], r["wh"]), tuple(self.events(meter_id, a, b)))

    def events(self, meter_id: str, a: int, b: int) -> list[MeterEvent]:
        out = [MeterEvent(_dt(ts), "reset", value) for ts, value, flags in self.store.events(meter_id, a, b) if flags & ec.F_RESET and not flags & ec.F_MANUAL]
        for e in wm.epochs(self.conn, meter_id):
            if e["reason"] != "first":
                at = _parse_iso(e["started_at"]) if e["started_at"].endswith("Z") else dt.datetime.fromisoformat(e["started_at"])
                if a <= at.timestamp() < b:
                    out.append(MeterEvent(at, "replaced", e["start_reading_ml"]))
        return sorted(out, key=lambda e: e.at)

    def reading_at(self, meter_id: str, at: dt.datetime) -> BoundaryReading:
        t = int(at.timestamp())
        before, after = self.store.reading_around(meter_id, t)
        value: int | None = None
        exact = (before is not None and t - before[0] <= EXACT_S) or (after is not None and after[0] - t <= EXACT_S)
        if before is not None and after is not None and after[1] >= before[1] and after[0] > before[0]:
            value = before[1] + int(round((after[1] - before[1]) * (t - before[0]) / (after[0] - before[0])))
        elif before is not None and t - before[0] <= EXACT_S:
            value = before[1]
        elif after is not None and before is None and after[0] - t <= EXACT_S:
            value = after[1]
        return BoundaryReading(meter_id, at, _dt(before[0]) if before else None, before[1] if before else None,
                               _dt(after[0]) if after else None, after[1] if after else None, value, bool(exact))

    def manual_readings(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> list[tuple[dt.datetime, int, str]]:
        rows = self.conn.execute("""SELECT read_at, value_ml, effect FROM water_meter_manual_readings WHERE meter_id = ? AND voided_at IS NULL
                                    AND read_at >= ? AND read_at < ? ORDER BY read_at""", (meter_id, _iso(start), _iso(end))).fetchall()
        return [(_parse_iso(r["read_at"]), int(r["value_ml"]), r["effect"]) for r in rows]


def _dt(ts: int | None) -> dt.datetime | None:
    return dt.datetime.fromtimestamp(int(ts), dt.timezone.utc) if ts is not None else None


_OVERRIDE: dict[str, Any] = {}


def provider_for(conn: sqlite3.Connection, settings: Any) -> WaterReadings:
    """The provider for one request / job (tests may pin `now` through set_now)."""
    return WaterReadings(conn, wm.store_for(settings), now=_OVERRIDE.get("now"))


def set_now(ts: float | None) -> None:
    """Tests: pin the provider's clock (the retention floor of the quarter-hour data)."""
    if ts is None:
        _OVERRIDE.pop("now", None)
    else:
        _OVERRIDE["now"] = ts


def stale_after(conn: sqlite3.Connection) -> dt.timedelta:
    try:
        return dt.timedelta(minutes=int(ws.value(conn, "water.stale_after_minutes")))
    except (sqlite3.Error, KeyError, TypeError, ValueError):
        return dt.timedelta(minutes=120)


# ====================================================================== customers (the shared card, water's view of it)

def water_accounts_of(conn: sqlite3.Connection, cid: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT id, name, status FROM water_accounts WHERE customer_id = ? AND deleted_at IS NULL ORDER BY name", (cid,)).fetchall()


def customer_dict(conn: sqlite3.Connection, row: sqlite3.Row, contact: bool, money: bool) -> dict[str, Any]:
    """The shared customer card as the water screens show it: the water accounts count, the open water balance (money only)."""
    out = eb.customer_dict(conn, row, contact)
    out["energy_account_count"] = out.pop("account_count")
    out["account_count"] = len(water_accounts_of(conn, row["id"]))
    if money:
        open_ = conn.execute("SELECT total FROM water_bills WHERE customer_id = ? AND state IN ('issued', 'sent')", (row["id"],)).fetchall()
        out["open_balance"] = str(px.r2(sum((Decimal(r["total"] or "0") for r in open_), Decimal("0.00"))))
    return out


def delete_customer(conn: sqlite3.Connection, cid: str, base_revision: int) -> None:
    """The shared delete (energy_billing.delete_customer also refuses while a water account exists)."""
    eb.get_customer(conn, cid)
    if water_accounts_of(conn, cid):
        raise conflict("customer_has_accounts", "ללקוח יש חשבונות פעילים. יש להעביר או למחוק אותם קודם.")
    eb.delete_customer(conn, cid, base_revision)


# ====================================================================== tariffs (water + sewage per m3)

@dataclass(frozen=True)
class WaterPrice:
    id: str
    effective_from: dt.date
    water: Decimal
    sewage: Decimal
    mode: str


def parse_component(value: Any, field: str, *, allow_zero: bool) -> Decimal:
    """A price per m3 as typed: at most 4 decimals, at most 1000; > 0 for water, >= 0 for sewage."""
    try:
        d = Decimal(str(value).strip())
    except (InvalidOperation, AttributeError):
        d = Decimal("NaN")
    ok = d.is_finite() and (d >= 0 if allow_zero else d > 0) and d <= 1000 and d == d.quantize(px.Q4)
    if not ok:
        raise ApiError(422, "validation", "המחיר חייב להיות מספר " + ("אי-שלילי" if allow_zero else "חיובי") + " עם עד 4 ספרות אחרי הנקודה.",
                       details={"fields": [field], "message_en": "The price must be a number with up to 4 decimals."})
    return d.quantize(px.Q4)


def get_tariff(conn: sqlite3.Connection, tid: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM water_tariffs WHERE id = ? AND deleted_at IS NULL", (tid,)).fetchone()
    if not row:
        raise not_found("התעריף לא נמצא.")
    return row


def price_versions(conn: sqlite3.Connection, tid: str) -> list[WaterPrice]:
    return [WaterPrice(r["id"], _date(r["effective_from"]), Decimal(r["water_price"]), Decimal(r["sewage_price"]), r["price_mode"])
            for r in conn.execute("SELECT * FROM water_tariff_versions WHERE tariff_id = ? ORDER BY effective_from", (tid,)).fetchall()]


def _inc_vat(water: Decimal, sewage: Decimal, mode: str, rate: Decimal | None) -> str | None:
    if rate is None:
        return None
    unit = water + sewage
    return str(px.r2(unit if mode == "inc_vat" else unit * (1 + rate / px.HUNDRED)))


def tariff_dict(conn: sqlite3.Connection, row: sqlite3.Row, today: dt.date) -> dict[str, Any]:
    vat = px.in_force(vat_rates(conn), today)
    sealed = _sealed_version_ids(conn)
    vs = [{"id": v.id, "effective_from": v.effective_from.isoformat(), "water_price": str(v.water), "sewage_price": str(v.sewage), "price_mode": v.mode,
           "price_inc_vat": _inc_vat(v.water, v.sewage, v.mode, vat.rate if vat else None), "locked": v.id in sealed}
          for v in price_versions(conn, row["id"])]
    cur = None
    for v in vs:
        if v["effective_from"] <= today.isoformat():
            cur = v
    used = conn.execute("SELECT COUNT(*) FROM water_accounts WHERE tariff_id = ? AND deleted_at IS NULL", (row["id"],)).fetchone()[0]
    return {"id": row["id"], "name": row["name"], "currency": row["currency"], "versions": vs, "current": cur, "used_by": used,
            "vat_rate_percent": px.pct_str(vat.rate) if vat else None}


def _sealed_version_ids(conn: sqlite3.Connection) -> set[str]:
    out: set[str] = set()
    for (snap,) in conn.execute("SELECT snapshot_json FROM water_bills WHERE number IS NOT NULL").fetchall():
        try:
            out |= {ln.get("tariff_version_id") for ln in (json.loads(snap).get("lines") or [])}
        except ValueError:
            continue
    return out


def create_tariff(conn: sqlite3.Connection, actor_id: str | None, name: str, effective_from: dt.date, water: Decimal, sewage: Decimal, mode: str) -> str:
    tid = new_id()
    now = now_iso()
    conn.execute("INSERT INTO water_tariffs(id, name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", (tid, name.strip(), actor_id, now, now))
    add_version(conn, tid, actor_id, effective_from, water, sewage, mode)
    return tid


def add_version(conn: sqlite3.Connection, tid: str, actor_id: str | None, effective_from: dt.date, water: Decimal, sewage: Decimal, mode: str) -> str:
    if conn.execute("SELECT 1 FROM water_tariff_versions WHERE tariff_id = ? AND effective_from = ?", (tid, effective_from.isoformat())).fetchone():
        raise conflict("version_exists", "כבר קיים מחיר מאותו תאריך.")
    vid = new_id()
    conn.execute("""INSERT INTO water_tariff_versions(id, tariff_id, effective_from, water_price, sewage_price, price_mode, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", (vid, tid, effective_from.isoformat(), str(water), str(sewage), mode, actor_id, now_iso()))
    conn.execute("UPDATE water_tariffs SET updated_at = ? WHERE id = ?", (now_iso(), tid))
    return vid


def _version_row(conn: sqlite3.Connection, tid: str, vid: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM water_tariff_versions WHERE id = ? AND tariff_id = ?", (vid, tid)).fetchone()
    if not row:
        raise not_found("גרסת המחיר לא נמצאה.")
    return row


def update_version(conn: sqlite3.Connection, tid: str, vid: str, effective_from: dt.date, water: Decimal, sewage: Decimal, mode: str) -> int:
    """Correct a version no issued bill used (a sealed bill never changes: such a version is locked; add a later version instead).
    Returns the number of draft bills that should be recalculated (the caller recomputes them)."""
    _version_row(conn, tid, vid)
    if vid in _sealed_version_ids(conn):
        raise conflict("tariff_period_sealed", "חיובים שכבר הונפקו נשענים על המחיר הזה ולא ניתן לתקן אותו. הוסיפו מחיר חדש מתאריך מאוחר יותר.")
    clash = conn.execute("SELECT 1 FROM water_tariff_versions WHERE tariff_id = ? AND effective_from = ? AND id != ?", (tid, effective_from.isoformat(), vid)).fetchone()
    if clash:
        raise conflict("version_exists", "כבר קיים מחיר מהתאריך הזה. יש לערוך אותו במקום.")
    conn.execute("UPDATE water_tariff_versions SET effective_from = ?, water_price = ?, sewage_price = ?, price_mode = ? WHERE id = ?",
                 (effective_from.isoformat(), str(water), str(sewage), mode, vid))
    conn.execute("UPDATE water_tariffs SET updated_at = ? WHERE id = ?", (now_iso(), tid))
    return len(drafts_on_tariff(conn, tid))


def drafts_on_tariff(conn: sqlite3.Connection, tid: str) -> list[sqlite3.Row]:
    return conn.execute("""SELECT b.* FROM water_bills b JOIN water_accounts a ON a.id = b.account_id
                           WHERE b.state = 'draft' AND a.tariff_id = ? AND a.deleted_at IS NULL""", (tid,)).fetchall()


def delete_version(conn: sqlite3.Connection, tid: str, vid: str) -> None:
    _version_row(conn, tid, vid)
    if conn.execute("SELECT COUNT(*) FROM water_tariff_versions WHERE tariff_id = ?", (tid,)).fetchone()[0] <= 1:
        raise conflict("tariff_in_use", "זה המחיר היחיד של התעריף.")
    if vid in _sealed_version_ids(conn):
        raise conflict("tariff_in_use", "המחיר שימש בחיוב שהונפק ואינו ניתן למחיקה.")
    conn.execute("DELETE FROM water_tariff_versions WHERE id = ?", (vid,))


def delete_tariff(conn: sqlite3.Connection, tid: str) -> None:
    get_tariff(conn, tid)
    if conn.execute("SELECT 1 FROM water_accounts WHERE tariff_id = ? AND deleted_at IS NULL LIMIT 1", (tid,)).fetchone():
        raise conflict("tariff_in_use", "התעריף משמש חשבון פעיל.")
    conn.execute("UPDATE water_tariffs SET deleted_at = ?, updated_at = ? WHERE id = ?", (now_iso(), now_iso(), tid))


# ====================================================================== accounts

def get_account(conn: sqlite3.Connection, aid: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM water_accounts WHERE id = ? AND deleted_at IS NULL", (aid,)).fetchone()
    if not row:
        raise not_found("החשבון לא נמצא.")
    return row


def get_account_any(conn: sqlite3.Connection, aid: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM water_accounts WHERE id = ?", (aid,)).fetchone()
    if not row:
        raise not_found("החשבון לא נמצא.")
    return row


def _account_fields(conn: sqlite3.Connection, provider: WaterReadings, body: dict[str, Any], current: sqlite3.Row | None, installation_tz: str) -> dict[str, Any]:
    f: dict[str, Any] = {}
    if body.get("name") is not None:
        f["name"] = body["name"].strip()
    if body.get("customer_id") is not None:
        eb.get_customer(conn, body["customer_id"])
        f["customer_id"] = body["customer_id"]
    if body.get("tariff_id") is not None:
        get_tariff(conn, body["tariff_id"])
        f["tariff_id"] = body["tariff_id"]
    if body.get("formula") is not None:
        try:
            comp = eb.formula_from_input(provider, body["formula"])
        except fx.FormulaError as e:
            raise eb.formula_error(e) from None
        f["formula_json"] = fx.dumps(comp.ast)
        f["_meters"] = comp.meter_ids
    for k in ("period_months", "period_anchor_day", "period_anchor_month", "auto_mode", "status"):
        if body.get(k) is not None:
            f[k] = body[k]
    if body.get("first_period_start") is not None:
        v = body["first_period_start"]
        f["first_period_start"] = v.isoformat() if isinstance(v, dt.date) else v
    if body.get("timezone") is not None:
        if not per.valid_zone(body["timezone"]):
            raise _err(422, "validation", "אזור זמן לא מוכר.", fields=["timezone"])
        f["timezone"] = body["timezone"]
    elif current is None:
        f["timezone"] = installation_tz
    return f


def create_account(conn: sqlite3.Connection, provider: WaterReadings, actor_id: str | None, body: dict[str, Any], installation_tz: str) -> str:
    f = _account_fields(conn, provider, body, None, installation_tz)
    for k in ("name", "customer_id", "tariff_id", "formula_json", "period_months", "period_anchor_day", "first_period_start"):
        if k not in f:
            raise _err(422, "validation", "חסר שדה חובה.", fields=[k])
    aid = new_id()
    now = now_iso()
    meters = f.pop("_meters")
    conn.execute(
        """INSERT INTO water_accounts(id, name, customer_id, formula_json, tariff_id, period_months, period_anchor_day, period_anchor_month,
             first_period_start, timezone, auto_mode, status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)""",
        (aid, f["name"], f["customer_id"], f["formula_json"], f["tariff_id"], f["period_months"], f["period_anchor_day"], f.get("period_anchor_month", 1),
         f["first_period_start"], f["timezone"], f.get("auto_mode", "draft"), actor_id, now, now))
    _set_meters(conn, aid, meters)
    return aid


def _set_meters(conn: sqlite3.Connection, aid: str, meters: list[str]) -> None:
    conn.execute("DELETE FROM water_account_meters WHERE account_id = ?", (aid,))
    conn.executemany("INSERT INTO water_account_meters(account_id, meter_id) VALUES (?, ?)", [(aid, m) for m in meters])


def update_account(conn: sqlite3.Connection, provider: WaterReadings, aid: str, body: dict[str, Any], installation_tz: str) -> list[str]:
    row = get_account(conn, aid)
    if body["base_revision"] != row["revision"]:
        raise conflict("revision_conflict", "החשבון שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=row["revision"])
    f = _account_fields(conn, provider, body, row, installation_tz)
    meters = f.pop("_meters", None)
    if f:
        sets = ", ".join(f"{k} = ?" for k in f)
        conn.execute(f"UPDATE water_accounts SET {sets}, revision = revision + 1, updated_at = ? WHERE id = ?", (*f.values(), now_iso(), aid))
    if meters is not None:
        _set_meters(conn, aid, meters)
    return sorted(f)


def delete_account(conn: sqlite3.Connection, aid: str, base_revision: int) -> int:
    row = get_account(conn, aid)
    if base_revision != row["revision"]:
        raise conflict("revision_conflict", "החשבון שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=row["revision"])
    drafts = conn.execute("DELETE FROM water_bills WHERE account_id = ? AND state = 'draft'", (aid,)).rowcount
    conn.execute("UPDATE water_accounts SET deleted_at = ?, revision = revision + 1, updated_at = ? WHERE id = ?", (now_iso(), now_iso(), aid))
    conn.execute("DELETE FROM water_account_meters WHERE account_id = ?", (aid,))
    return drafts


def meters_in_use(conn: sqlite3.Connection, meter_id: str) -> list[str]:
    """Names of the live accounts whose formula uses the meter (the retire guard, `meter_in_use`)."""
    return [r[0] for r in conn.execute("""SELECT a.name FROM water_account_meters m JOIN water_accounts a ON a.id = m.account_id
                                          WHERE m.meter_id = ? AND a.deleted_at IS NULL ORDER BY a.name""", (meter_id,)).fetchall()]


def account_dict(conn: sqlite3.Connection, provider: WaterReadings, row: sqlite3.Row, money: bool, today: dt.date | None = None) -> dict[str, Any]:
    cust = conn.execute("SELECT id, customer_number, name, address FROM energy_customers WHERE id = ?", (row["customer_id"],)).fetchone()
    tar = conn.execute("SELECT id, name FROM water_tariffs WHERE id = ?", (row["tariff_id"],)).fetchone()
    tariff: dict[str, Any] = {"id": row["tariff_id"], "name": tar["name"] if tar else ""}
    today = today or per.local_date(now_utc(), row["timezone"])
    if money:
        cur = _in_force(price_versions(conn, row["tariff_id"]), today)
        vat = px.in_force(vat_rates(conn), today)
        tariff.update({"water_price": str(cur.water) if cur else None, "sewage_price": str(cur.sewage) if cur else None, "price_mode": cur.mode if cur else None,
                       "vat_rate_percent": px.pct_str(vat.rate) if vat else None,
                       "price_inc_vat": _inc_vat(cur.water, cur.sewage, cur.mode, vat.rate if vat else None) if cur else None})
    c = eb.cycle_of(row)
    nxt = per.period_containing(c, max(today, c.first_start))
    last = conn.execute("SELECT * FROM water_bills WHERE account_id = ? ORDER BY period_end DESC, revision DESC, created_at DESC LIMIT 1", (row["id"],)).fetchone()
    names = eb.meter_names(provider)
    stale_ids = [m for m in fx.meter_ids(json.loads(row["formula_json"])) if _is_stale(conn, provider, m)]
    return {
        "id": row["id"], "name": row["name"],
        "customer": {"id": cust["id"], "customer_number": cust["customer_number"], "name": cust["name"], "address": cust["address"]} if cust else None,
        "formula": eb.formula_api(provider, json.loads(row["formula_json"])),
        "tariff": tariff,
        "period_months": row["period_months"], "period_anchor_day": row["period_anchor_day"], "period_anchor_month": row["period_anchor_month"],
        "first_period_start": row["first_period_start"], "timezone": row["timezone"], "auto_mode": row["auto_mode"], "status": row["status"],
        "revision": row["revision"], "created_at": row["created_at"], "updated_at": row["updated_at"],
        "next_period": nxt.as_api() if nxt else None,
        "last_bill": bill_summary(conn, last, money) if last else None,
        "stale_meters": [{"meter_id": m, "name": names.get(m, m)} for m in stale_ids],
    }


def _in_force(items: list[WaterPrice], day: dt.date) -> WaterPrice | None:
    best = None
    for it in items:
        if it.effective_from <= day and (best is None or it.effective_from > best.effective_from):
            best = it
    return best


def _is_stale(conn: sqlite3.Connection, provider: WaterReadings, meter_id: str) -> bool:
    last = provider.last_report_at(meter_id)
    return last is None or last < now_utc() - stale_after(conn)


# ====================================================================== the computation

@dataclass
class Computed:
    snapshot: dict[str, Any]
    m3: str
    total: str


def _line(piece: px.Piece, component: str, m3_exact: Decimal, price: Decimal) -> dict[str, Any]:
    """One charge line, the electricity rounding (energy_pricing.line) with the quantity in m3 to 3 places."""
    qty = px.r3(m3_exact)
    rate = piece.vat.rate
    if piece.price.mode == "ex_vat":
        amount = px.r2(qty * price)
        vat = px.r2(amount * rate / px.HUNDRED)
        total = amount + vat
        unit = px.r4(price)
    else:
        total = px.r2(qty * price)
        amount = px.r2(total / (1 + rate / px.HUNDRED))
        vat = total - amount
        unit = px.r4(price / (1 + rate / px.HUNDRED))
    return {"component": component, "label_he": COMPONENT_HE[component], "from": piece.start.isoformat(), "to": (piece.end - dt.timedelta(days=1)).isoformat(),
            "m3": str(qty), "price_entered": str(price), "price_mode": piece.price.mode, "unit_price_ex_vat": str(unit), "amount_ex_vat": str(amount),
            "vat_rate_percent": px.pct_str(rate), "vat_amount": str(vat), "total": str(total), "tariff_version_id": piece.price.id, "vat_rate_id": piece.vat.id}


def _totals(lines: list[dict[str, Any]]) -> dict[str, Any]:
    z = Decimal("0.00")
    qty = sum((Decimal(ln["m3"]) for ln in lines if ln["component"] == "water"), Decimal("0.000"))
    amount = sum((Decimal(ln["amount_ex_vat"]) for ln in lines), z)
    vat = sum((Decimal(ln["vat_amount"]) for ln in lines), z)
    total = sum((Decimal(ln["total"]) for ln in lines), z)
    by_comp = {c: str(px.r2(sum((Decimal(ln["amount_ex_vat"]) for ln in lines if ln["component"] == c), z))) for c in ("water", "sewage")}
    breakdown: dict[str, dict[str, Decimal]] = {}
    for ln in lines:
        b = breakdown.setdefault(ln["vat_rate_percent"], {"base": z, "vat": z})
        b["base"] += Decimal(ln["amount_ex_vat"])
        b["vat"] += Decimal(ln["vat_amount"])
    return {"currency": "ILS", "m3": str(px.r3(qty)), "amount_ex_vat": str(px.r2(amount)), "vat_amount": str(px.r2(vat)), "total": str(px.r2(total)),
            "by_component_ex_vat": by_comp,
            "vat_breakdown": [{"rate_percent": k, "base": str(px.r2(v["base"])), "vat": str(px.r2(v["vat"]))} for k, v in breakdown.items()],
            "price_mode_note_he": "המחיר נקבע כולל מע״מ" if any(ln["price_mode"] == "inc_vat" for ln in lines) else None}


def _prev_bill(conn: sqlite3.Connection, aid: str, start: dt.date) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM water_bills WHERE account_id = ? AND period_end = ? AND state IN ('issued','sent','paid') ORDER BY revision DESC, issued_at DESC LIMIT 1",
                        (aid, start.isoformat())).fetchone()


def _carried_from(conn: sqlite3.Connection, aid: str, period: per.Period, w_start: dt.datetime) -> dict[str, dt.datetime]:
    prev = _prev_bill(conn, aid, period.start)
    out: dict[str, dt.datetime] = {}
    if prev:
        for m in json.loads(prev["snapshot_json"]).get("meters") or []:
            at = _parse_iso((m.get("end") or {}).get("at"))
            if at is not None and at < w_start:
                out[m["meter_id"]] = at
    return out


def _end_caps(conn: sqlite3.Connection, aid: str, period: per.Period, replaces: sqlite3.Row | None, w_end: dt.datetime) -> dict[str, dt.datetime]:
    """A correction of a bill that already has a successor keeps the original's per-meter end points (never billed twice)."""
    if replaces is None:
        return {}
    if not conn.execute("SELECT 1 FROM water_bills WHERE account_id = ? AND period_start = ? AND state IN ('issued','sent','paid') LIMIT 1",
                        (aid, period.end.isoformat())).fetchone():
        return {}
    out: dict[str, dt.datetime] = {}
    for m in json.loads(replaces["snapshot_json"]).get("meters") or []:
        at = _parse_iso((m.get("end") or {}).get("at"))
        if at is not None and at < w_end:
            out[m["meter_id"]] = at
    return out


def _reading(v: Decimal | None) -> str | None:
    return s3(m3(v)) if v is not None else None


def compute(conn: sqlite3.Connection, provider: WaterReadings, account: sqlite3.Row, period: per.Period, *, origin: str = "manual",
            replaces: sqlite3.Row | None = None, bill_id: str | None = None, now: dt.datetime | None = None) -> Computed:
    """The draft snapshot of `account` for `period`: per price / VAT piece, the formula over the meters' measured m3, a water line and
    (when the sewage price is not 0) a sewage line, then VAT. Raises ApiError: formula_invalid / formula_negative / tariff_missing /
    vat_missing. Reads only."""
    now = now or now_utc()
    tz = account["timezone"]
    customer = conn.execute("SELECT * FROM energy_customers WHERE id = ?", (account["customer_id"],)).fetchone()
    tariff = conn.execute("SELECT * FROM water_tariffs WHERE id = ?", (account["tariff_id"],)).fetchone()
    settings = read_settings(conn)
    names_all = eb.meter_names(provider)
    try:
        comp = fx.compile_formula(json.loads(account["formula_json"]), known=names_all.keys())
    except fx.FormulaError as e:
        raise eb.formula_error(e) from None
    prices = price_versions(conn, account["tariff_id"])
    sewage_of = {p.id: p.sewage for p in prices}
    try:
        pieces = px.pieces(period.start, period.end, [px.PriceVersion(p.id, p.effective_from, p.water, p.mode) for p in prices], vat_rates(conn))
    except px.MissingRate as e:
        msg = "אין מחיר מים בתוקף לתאריך " if e.code == "tariff_missing" else "אין שיעור מע״מ בתוקף לתאריך "
        raise _err(422, e.code, msg + _fmt_date(e.day) + ".", date=e.day.isoformat()) from None
    bounds = [per.local_midnight_utc(p.start, tz) for p in pieces] + [per.local_midnight_utc(period.end, tz)]
    w_start, w_end = bounds[0], bounds[-1]
    carried = _carried_from(conn, account["id"], period, w_start)
    caps = _end_caps(conn, account["id"], period, replaces, w_end)
    windows: dict[str, MeterWindow] = {mid: meter_window(provider, mid, bounds, carried.get(mid), caps.get(mid)) for mid in comp.meter_ids}
    lines: list[dict[str, Any]] = []
    for i, piece in enumerate(pieces):
        exact = m3(comp.evaluate({mid: windows[mid].pieces_wh[i] for mid in comp.meter_ids}))
        if px.r3(exact) < 0:
            last = piece.end - dt.timedelta(days=1)
            raise _err(422, "formula_negative", "התוצאה של נוסחת החשבון שלילית בתקופה " + _fmt_date(piece.start) + " - " + _fmt_date(last)
                       + ". יש לתקן את הנוסחה או את המונים.", period={"from": piece.start.isoformat(), "to": last.isoformat()}, m3=s3(exact))
        lines.append(_line(piece, "water", exact, piece.price.price))
        sewage = sewage_of.get(piece.price.id, Decimal(0))
        if sewage > 0:
            lines.append(_line(piece, "sewage", exact, sewage))
    totals = _totals(lines)
    notes: list[dict[str, Any]] = []
    meters_out: list[dict[str, Any]] = []
    stale = stale_after(conn)
    for mid in comp.meter_ids:
        w = windows[mid]
        name = names_all.get(mid, mid)
        cons = m3(w.wh)
        coef = comp.coefficients[mid]
        last_report = provider.last_report_at(mid)
        known_to = data_until(provider, mid)
        if known_to is None or (last_report is not None and last_report > known_to):
            known_to = last_report
        manual = provider.manual_readings(mid, w.start.at, w_end + dt.timedelta(seconds=1))
        meters_out.append({
            "meter_id": mid, "name": name, "coefficient": fx._dec_str(coef),
            "start": {"at": _iso(w.start.at), "reading_m3": _reading(w.start.reading_wh), "kind": w.start.kind},
            "end": {"at": _iso(w.end.at), "reading_m3": _reading(w.end.reading_wh), "kind": w.end.kind},
            "consumption_m3": s3(cons), "contribution_m3": s3(cons * coef), "carried_in_m3": s3(m3(w.carried_in_wh)),
            "resets": [{"at": _iso(r)} for r in w.resets], "last_report_at": _iso(last_report),
            "reported_to_end": bool(known_to is not None and known_to >= w_end - stale),
        })
        if w.start.kind == "first_reading":
            notes.append({"code": "opening_first_reading", "meter_id": mid, "at": _iso(w.start.at),
                          "text_he": f"קריאת הפתיחה של המונה {name} היא הקריאה הראשונה שנקלטה במערכת, ב-{_fmt_local(w.start.at, tz)}. צריכה שלפניה לא נמדדה ולא חויבה."})
        if known_to is None or known_to < w_end - stale:
            since = f"מאז {_fmt_local(known_to, tz)}" if known_to else "מעולם"
            notes.append({"code": "meter_not_reporting", "meter_id": mid, "at": _iso(known_to),
                          "text_he": f"המונה {name} לא מדווח {since}. הצריכה שלאחר מכן תחויב בחיוב הבא."})
        if any(eff == "allocation" for _a, _v, eff in manual):
            at = next(a for a, _v, eff in manual if eff == "allocation")
            notes.append({"code": "manual_reading", "meter_id": mid, "at": _iso(at), "text_he": f"כולל קריאה ידנית של המונה {name} מ-{_fmt_local(at, tz)}."})
        if w.carried_in_wh > 0:
            notes.append({"code": "carried_in", "meter_id": mid, "text_he": f"כולל {s3(m3(w.carried_in_wh))} מ״ק של {name} מתקופה קודמת שדווחו באיחור."})
        for r in w.resets:
            notes.append({"code": "meter_reset", "meter_id": mid, "at": _iso(r), "text_he": f"כולל איפוס או החלפה של המונה {name} ב-{_fmt_local(r, tz)}."})
    if len(pieces) > 1:
        notes.append({"code": "period_split", "text_he": "התקופה פוצלה ב-" + ", ".join(_fmt_date(p.start) for p in pieces[1:]) + " בגלל שינוי מחיר או שיעור מע״מ."})
    terms = settings["payment_terms"]
    names = {mid: names_all.get(mid, mid) for mid in comp.meter_ids}
    biz = dict(settings["business"])
    biz["logo"] = settings["logo"]
    snapshot = {
        "schema": SCHEMA, "medium": "water",
        "doc": {"title_he": "חשבון צריכת מים ודרישת תשלום", "subtitle_he": "אינו חשבונית מס", "is_tax_invoice": False},
        "bill": {"id": bill_id, "number": None, "revision": (replaces["revision"] + 1) if replaces is not None else 1,
                 "replaces": {"bill_id": replaces["id"], "number": replaces["number"]} if replaces is not None else None,
                 "state": "draft", "origin": origin, "issue_date": None, "due_date": None,
                 "expected_due_date": px.due_date(per.local_date(now, tz), terms).isoformat(), "payment_terms": terms, "issued_at": None, "issued_by": None},
        "period": {"from": period.start.isoformat(), "to": period.last_day.isoformat(), "end_exclusive": period.end.isoformat(), "days": period.days,
                   "timezone": tz, "start_utc": _iso(w_start), "end_utc": _iso(w_end)},
        "business": biz,
        "customer": {"id": customer["id"], "customer_number": customer["customer_number"], "name": customer["name"],
                     **{k: customer[k] for k in ("address", "phone", "email", "tax_id")}},
        "account": {"id": account["id"], "name": account["name"], "tariff": {"id": tariff["id"], "name": tariff["name"]},
                    "formula": {"ast": comp.ast, "text": fx.to_text(comp.ast, names), "sentence_he": fx.sentence_he(comp.ast, names)}},
        "meters": meters_out, "lines": lines, "totals": totals, "notes": notes[:MAX_NOTES],
        "rounding": {"rule": "half_up", "m3_places": 3, "unit_price_places": 4, "money_places": 2, "order": "per_line_then_sum", "vat": "per_line"},
        "meta": {"engine": ENGINE, "software_version": __version__, "computed_at": _iso(now)},
    }
    return Computed(snapshot, totals["m3"], totals["total"])


# ====================================================================== status and history for the account page

def account_status(conn: sqlite3.Connection, provider: WaterReadings, acc: sqlite3.Row, money: bool) -> dict[str, Any]:
    """The open period so far: each meter of the formula with its opening and current reading, its consumption and whether it reports
    (a stale meter is not counted until it reports again - the electricity rule; the account says so)."""
    now = now_utc()
    tz = acc["timezone"]
    c = eb.cycle_of(acc)
    today = per.local_date(now, tz)
    p = per.period_containing(c, max(today, c.first_start))
    out: dict[str, Any] = {"period": p.as_api() if p else None, "day_of_period": None, "days": None, "m3_so_far": None, "meters": [], "stale": []}
    if p is None:
        return out
    out["day_of_period"], out["days"] = min(p.days, (today - p.start).days + 1), p.days
    a = per.local_midnight_utc(p.start, tz)
    names = eb.meter_names(provider)
    try:
        comp = fx.compile_formula(json.loads(acc["formula_json"]), known=names.keys())
    except fx.FormulaError as e:
        raise eb.formula_error(e) from None
    carried = _carried_from(conn, acc["id"], p, a)
    values: dict[str, Decimal] = {}
    for mid in comp.meter_ids:
        w = meter_window(provider, mid, [a, max(a, now)], carried.get(mid))
        values[mid] = w.wh
        stale = _is_stale(conn, provider, mid)
        cur = provider.reading_at(mid, now) if not stale else None
        last = provider.last_report_at(mid)
        out["meters"].append({"meter_id": mid, "name": names.get(mid, mid), "coefficient": fx._dec_str(comp.coefficients[mid]),
                              "start_m3": _reading(w.start.reading_wh), "current_m3": _reading(Decimal(cur.value_wh) if cur and cur.value_wh is not None else w.end.reading_wh),
                              "consumption_m3": s3(m3(w.wh)), "contribution_m3": s3(m3(w.wh) * comp.coefficients[mid]),
                              "reporting": not stale, "last_report_at": _iso(last)})
        if stale:
            out["stale"].append({"meter_id": mid, "name": names.get(mid, mid), "since": _iso(last)})
    total = m3(comp.evaluate(values))
    out["m3_so_far"] = s3(max(total, Decimal(0)))
    if out["day_of_period"]:
        out["m3_forecast"] = s3(max(total, Decimal(0)) / out["day_of_period"] * p.days)
    if money:
        cur = _in_force(price_versions(conn, acc["tariff_id"]), today)
        vat = px.in_force(vat_rates(conn), today)
        if cur and vat:
            out["amount_so_far"] = str(px.r2(Decimal(out["m3_so_far"]) * Decimal(_inc_vat(cur.water, cur.sewage, cur.mode, vat.rate) or "0")))
    return out


def period_m3(conn: sqlite3.Connection, provider: WaterReadings, account: sqlite3.Row, p: per.Period, comp: fx.Compiled) -> dict[str, Any]:
    """m3 of one period: from an issued bill of exactly that period, else from the store with the formula; missing stays null."""
    base = {"from": p.start.isoformat(), "to": p.last_day.isoformat()}
    row = conn.execute("SELECT m3 FROM water_bills WHERE account_id = ? AND period_start = ? AND period_end = ? AND state IN ('issued','sent','paid') ORDER BY revision DESC LIMIT 1",
                       (account["id"], p.start.isoformat(), p.end.isoformat())).fetchone()
    if row and row["m3"] is not None:
        return {**base, "m3": row["m3"], "status": "measured", "source": "bill"}
    a, b = per.utc_window(p, account["timezone"])
    total, complete, got = Decimal(0), True, 0
    for mid, coef in comp.coefficients.items():
        try:
            c = provider.consumption(mid, a, b)
        except ValueError:
            continue
        if c.wh is None or c.coverage == "none":
            continue
        got += 1
        total += coef * Decimal(int(c.wh))
        complete = complete and c.coverage == "full"
    if got == 0 or got < len(comp.coefficients) or total < 0:
        return {**base, "m3": None, "status": "missing", "source": None}
    return {**base, "m3": s3(m3(total)), "status": "measured" if complete else "partial", "source": "readings"}


def account_history(conn: sqlite3.Connection, provider: WaterReadings, account: sqlite3.Row, past: int, money: bool) -> dict[str, Any]:
    """m3 per billing period (ended periods and the open one marked partial), oldest first; each with its bill when there is one."""
    cycle = eb.cycle_of(account)
    today = per.local_date(now_utc(), account["timezone"])
    ref = per.period_containing(cycle, max(today, cycle.first_start))
    if ref is None:
        return {"periods": []}
    names = eb.meter_names(provider)
    try:
        comp = fx.compile_formula(json.loads(account["formula_json"]), known=names.keys())
    except (fx.FormulaError, ValueError):
        return {"periods": []}
    rows: list[dict[str, Any]] = []
    for p in per.previous_like(ref, cycle, past) + [ref]:
        if p.start > today:
            continue
        entry = period_m3(conn, provider, account, p, comp)
        if p.end > today:
            entry["status"] = "open"
        b = conn.execute("SELECT * FROM water_bills WHERE account_id = ? AND period_start = ? AND period_end = ? AND state != 'void' ORDER BY revision DESC LIMIT 1",
                         (account["id"], p.start.isoformat(), p.end.isoformat())).fetchone()
        entry["bill"] = bill_summary(conn, b, money) if b is not None else None
        rows.append(entry)
    while rows and rows[0]["m3"] is None and rows[0]["bill"] is None:
        rows.pop(0)
    return {"periods": rows}


# ====================================================================== bills

def get_bill(conn: sqlite3.Connection, bid: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM water_bills WHERE id = ?", (bid,)).fetchone()
    if not row:
        raise not_found("החיוב לא נמצא.")
    return row


def bill_actions(row: sqlite3.Row) -> list[str]:
    return {"draft": ["recalculate", "delete", "issue"], "issued": ["sent", "paid", "correct", "void"], "sent": ["paid", "correct", "void"],
            "paid": ["correct"]}.get(row["state"], [])


def bill_summary(conn: sqlite3.Connection, row: sqlite3.Row, money: bool = True) -> dict[str, Any]:
    acc = conn.execute("SELECT name FROM water_accounts WHERE id = ?", (row["account_id"],)).fetchone()
    snap_c = json.loads(row["snapshot_json"]).get("customer") or {}
    out = {"id": row["id"], "account_id": row["account_id"], "account_name": acc["name"] if acc else "",
           "customer": {"id": row["customer_id"], "customer_number": snap_c.get("customer_number"), "name": snap_c.get("name")},
           "number": row["number"], "revision": row["revision"], "state": row["state"], "origin": row["origin"],
           "period": {"from": row["period_start"], "to": (_date(row["period_end"]) - dt.timedelta(days=1)).isoformat()},
           "issue_date": row["issue_date"], "due_date": row["due_date"], "m3": row["m3"],
           "replaces_bill_id": row["replaces_bill_id"], "replaced_by_bill_id": row["replaced_by_bill_id"],
           "row_version": row["row_version"], "created_at": row["created_at"], "updated_at": row["updated_at"]}
    if money:
        out["total"] = row["total"]
    return out


def bill_dict(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    out = bill_summary(conn, row)
    out.update({"snapshot": json.loads(row["snapshot_json"]), "snapshot_sha256": row["snapshot_sha256"],
                "sent": {"at": row["sent_at"], "how": row["sent_how"], "note": row["sent_note"]} if row["sent_at"] else None,
                "paid": {"at": row["paid_at"], "reference": row["paid_ref"]} if row["paid_at"] else None,
                "void": {"at": row["voided_at"], "reason": row["void_reason"]} if row["state"] == "void" else None,
                "actions": bill_actions(row), "pdf": {"state": "unavailable", "error_code": "pdf_later"}})
    return out


def _event(conn: sqlite3.Connection, bid: str, action: str, actor: Any | None, details: dict[str, Any] | None = None) -> None:
    conn.execute("INSERT INTO water_bill_events(id, bill_id, at, action, actor_kind, actor_id, actor_name, details_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                 (new_id(), bid, now_iso(), action, "user" if actor is not None else "system", getattr(actor, "user_id", None),
                  (getattr(actor, "display_name", None) or getattr(actor, "username", None)) if actor is not None else None,
                  json.dumps(details, ensure_ascii=False) if details else None))


def _audit(conn: sqlite3.Connection, actor: Any | None, action: str, rid: str, request_id: str | None = None, details: dict[str, Any] | None = None) -> None:
    audit(conn, actor=actor, action=f"infra.water.{action}", decision="allowed", resource_type="water_bill", resource_id=rid, request_id=request_id, details=details)


resolve_period = eb.resolve_period  # the account rows carry the same cycle columns


def overlapping(conn: sqlite3.Connection, aid: str, p: per.Period, exclude: tuple[str, ...] = ()) -> sqlite3.Row | None:
    for r in conn.execute("SELECT * FROM water_bills WHERE account_id = ? AND state IN ('issued','sent','paid') AND period_start < ? AND period_end > ?",
                          (aid, p.end.isoformat(), p.start.isoformat())).fetchall():
        if r["id"] not in exclude:
            return r
    return None


def overlap_error(r: sqlite3.Row) -> ApiError:
    return conflict("period_overlap", f"התקופה חופפת לחיוב {r['number']} שכבר הונפק.", bill_id=r["id"], number=r["number"])


def by_create_request(conn: sqlite3.Connection, client_request_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM water_bills WHERE create_request_id = ?", (client_request_id,)).fetchone()


def insert_draft(conn: sqlite3.Connection, account: sqlite3.Row, p: per.Period, comp: Computed, *, actor: Any | None, origin: str,
                 request_id: str | None, client_request_id: str | None, replaces: sqlite3.Row | None = None) -> str:
    if replaces is None:
        hit = overlapping(conn, account["id"], p)
        if hit:
            raise overlap_error(hit)
    dup = conn.execute("SELECT id FROM water_bills WHERE account_id = ? AND period_start = ? AND period_end = ? AND state = 'draft'",
                       (account["id"], p.start.isoformat(), p.end.isoformat())).fetchone()
    if dup:
        raise conflict("draft_exists", "כבר קיימת טיוטה לתקופה זו.", bill_id=dup["id"])
    bid = new_id()
    snap = comp.snapshot
    snap["bill"]["id"] = bid
    now = now_iso()
    conn.execute(
        """INSERT INTO water_bills(id, account_id, customer_id, revision, replaces_bill_id, period_start, period_end, state, origin, m3, total,
             snapshot_json, create_request_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (bid, account["id"], account["customer_id"], snap["bill"]["revision"], replaces["id"] if replaces is not None else None, p.start.isoformat(),
         p.end.isoformat(), origin, comp.m3, comp.total, json.dumps(snap, ensure_ascii=False), client_request_id, getattr(actor, "user_id", None), now, now))
    action = "correct" if replaces is not None else ("auto_draft" if origin == "auto" and actor is None else "draft")
    _event(conn, bid, action, actor, {"replaces": replaces["number"]} if replaces is not None else None)
    _audit(conn, actor, f"bill.{action}", bid, request_id, {"account_id": account["id"], "period": p.as_api()})
    return bid


def store_recalculated(conn: sqlite3.Connection, bill: sqlite3.Row, comp: Computed, actor: Any | None, request_id: str | None, row_version: int) -> None:
    cur = get_bill(conn, bill["id"])
    if cur["state"] != "draft":
        raise conflict("bill_not_draft", "החיוב אינו טיוטה.", state=cur["state"])
    if cur["row_version"] != row_version:
        raise conflict("revision_conflict", "החיוב שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=cur["row_version"])
    snap = comp.snapshot
    snap["bill"]["id"] = bill["id"]
    conn.execute("UPDATE water_bills SET m3 = ?, total = ?, snapshot_json = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
                 (comp.m3, comp.total, json.dumps(snap, ensure_ascii=False), now_iso(), bill["id"]))
    _event(conn, bill["id"], "recalculate", actor)
    _audit(conn, actor, "bill.recalculate", bill["id"], request_id)


def recompute_drafts(conn: sqlite3.Connection, provider: WaterReadings, tid: str, actor: Any | None, request_id: str | None) -> dict[str, Any]:
    """After a price correction: every draft on the tariff is recomputed (one savepoint each; a failure is reported, never a rollback)."""
    done, failed = 0, []
    for bill in drafts_on_tariff(conn, tid):
        conn.execute("SAVEPOINT water_recompute")
        try:
            acc = get_account(conn, bill["account_id"])
            p = per.Period(_date(bill["period_start"]), _date(bill["period_end"]))
            replaces = get_bill(conn, bill["replaces_bill_id"]) if bill["replaces_bill_id"] else None
            store_recalculated(conn, bill, compute(conn, provider, acc, p, origin=bill["origin"], replaces=replaces, bill_id=bill["id"]), actor, request_id, bill["row_version"])
            conn.execute("RELEASE SAVEPOINT water_recompute")
            done += 1
        except Exception as e:  # noqa: BLE001 - reported to the caller, the correction stays
            conn.execute("ROLLBACK TO SAVEPOINT water_recompute")
            conn.execute("RELEASE SAVEPOINT water_recompute")
            failed.append({"bill_id": bill["id"], "reason": getattr(e, "user_message", None) or "החישוב נכשל"})
    return {"recomputed": done, "failed": failed}


def delete_draft(conn: sqlite3.Connection, bid: str, row_version: int, actor: Any, request_id: str | None) -> None:
    row = get_bill(conn, bid)
    if row["state"] != "draft":
        raise conflict("bill_not_draft", "אפשר למחוק רק טיוטה.", state=row["state"])
    if row["row_version"] != row_version:
        raise conflict("revision_conflict", "החיוב שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=row["row_version"])
    conn.execute("DELETE FROM water_bills WHERE id = ?", (bid,))
    conn.execute("DELETE FROM water_bill_events WHERE bill_id = ?", (bid,))
    _audit(conn, actor, "bill.delete", bid, request_id, {"account_id": row["account_id"]})


def number_for(conn: sqlite3.Connection, bill: sqlite3.Row, customer_number: str) -> tuple[str, str, int]:
    """(number, base, seq) in the SHARED number space: YYYY-MM-CCCC[/S][-R] (the electricity format, month of the period's last day);
    the sequence and the uniqueness are checked against the shared ledger and both bill tables."""
    last = _date(bill["period_end"]) - dt.timedelta(days=1)
    rev = int(bill["revision"])
    if bill["replaces_bill_id"]:
        root = get_bill(conn, bill["replaces_bill_id"])
        while root["replaces_bill_id"]:
            root = get_bill(conn, root["replaces_bill_id"])
        base, seq = root["number_base"], int(root["number_seq"])
    else:
        base = f"{last.year:04d}-{last.month:02d}-{customer_number}"
        seq = 1 + max(int(conn.execute(f"SELECT MAX(number_seq) FROM {t} WHERE number_base = ?", (base,)).fetchone()[0] or 0)
                      for t in ("energy_bill_numbers", "energy_bills", "water_bills"))
    number = base + (f"/{seq}" if seq > 1 else "") + (f"-{rev}" if rev > 1 else "")
    for t in ("energy_bill_numbers", "energy_bills", "water_bills"):
        if conn.execute(f"SELECT 1 FROM {t} WHERE number = ?", (number,)).fetchone():
            raise conflict("number_taken", "מספר החיוב כבר נוצל. יש לנסות שוב.", number=number)
    return number, base, seq


def seal(conn: sqlite3.Connection, bill: sqlite3.Row, comp: Computed, *, actor: Any | None, issue_date: dt.date, request_id: str | None,
         client_request_id: str | None) -> None:
    """Issue a draft inside the caller's write transaction: overlap check, number (shared ledger), sealed snapshot + hash, the original of a
    correction cancelled."""
    p = per.Period(_date(bill["period_start"]), _date(bill["period_end"]))
    hit = overlapping(conn, bill["account_id"], p, exclude=(bill["replaces_bill_id"],) if bill["replaces_bill_id"] else ())
    if hit:
        raise overlap_error(hit)
    snap = comp.snapshot
    number, base, seq = number_for(conn, bill, snap["customer"]["customer_number"])
    due = px.due_date(issue_date, snap["bill"]["payment_terms"])
    at = now_utc()
    snap["bill"].update({"id": bill["id"], "number": number, "state": "issued", "issue_date": issue_date.isoformat(), "due_date": due.isoformat(),
                         "expected_due_date": due.isoformat(), "issued_at": _iso(at),
                         "issued_by": {"kind": "user", "display_name": getattr(actor, "display_name", "") or getattr(actor, "username", "")} if actor is not None else {"kind": "system"}})
    digest = eb.sha256_of(snap)
    conn.execute("""UPDATE water_bills SET state = 'issued', number = ?, number_base = ?, number_seq = ?, m3 = ?, total = ?, snapshot_json = ?, snapshot_sha256 = ?,
                      issue_date = ?, due_date = ?, issued_by = ?, issued_at = ?, issue_request_id = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?""",
                 (number, base, seq, comp.m3, comp.total, json.dumps(snap, ensure_ascii=False), digest, issue_date.isoformat(), due.isoformat(),
                  getattr(actor, "user_id", None), _iso(at), client_request_id, now_iso(), bill["id"]))
    conn.execute("INSERT INTO energy_bill_numbers(number, number_base, number_seq, revision, bill_id, assigned_at) VALUES (?, ?, ?, ?, ?, ?)",
                 (number, base, seq, int(bill["revision"]), bill["id"], now_iso()))
    action = "issue" if actor is not None else "auto_issue"
    _event(conn, bill["id"], action, actor, {"number": number})
    _audit(conn, actor, f"bill.{action}", bill["id"], request_id, {"number": number, "sha256": digest[:12], "account_id": bill["account_id"]})
    if bill["replaces_bill_id"]:
        orig = get_bill(conn, bill["replaces_bill_id"])
        if orig["state"] != "void":
            reason = f"הוחלף ב-{number}"
            conn.execute("UPDATE water_bills SET state = 'void', void_reason = ?, voided_at = ?, replaced_by_bill_id = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
                         (reason, now_iso(), bill["id"], now_iso(), orig["id"]))
            _event(conn, orig["id"], "void", actor, {"reason": reason, "replaced_by": number})
            _audit(conn, actor, "bill.void", orig["id"], request_id, {"replaced_by": number})
        else:
            conn.execute("UPDATE water_bills SET replaced_by_bill_id = ? WHERE id = ?", (bill["id"], orig["id"]))


def _check_version(row: sqlite3.Row, row_version: int | None) -> None:
    if row_version is not None and row["row_version"] != row_version:
        raise conflict("revision_conflict", "החיוב שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=row["row_version"])


def mark_sent(conn: sqlite3.Connection, bid: str, at: str, how: str, note: str, actor: Any, request_id: str | None, row_version: int | None = None) -> None:
    row = get_bill(conn, bid)
    _check_version(row, row_version)
    if row["state"] not in ("issued", "sent"):
        raise conflict("bill_state", f"אי אפשר לסמן כנשלח חיוב במצב {STATE_HE[row['state']]}.", state=row["state"])
    conn.execute("UPDATE water_bills SET state = 'sent', sent_at = ?, sent_how = ?, sent_note = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
                 (at, how, note, now_iso(), bid))
    _event(conn, bid, "sent", actor, {"how": how})
    _audit(conn, actor, "bill.sent", bid, request_id, {"how": how})


def mark_paid(conn: sqlite3.Connection, bid: str, at: str, reference: str, actor: Any, request_id: str | None, row_version: int | None = None) -> None:
    row = get_bill(conn, bid)
    _check_version(row, row_version)
    if row["state"] not in ("issued", "sent"):
        raise conflict("bill_state", f"אי אפשר לסמן כשולם חיוב במצב {STATE_HE[row['state']]}.", state=row["state"])
    conn.execute("UPDATE water_bills SET state = 'paid', paid_at = ?, paid_ref = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?", (at, reference, now_iso(), bid))
    _event(conn, bid, "paid", actor)
    _audit(conn, actor, "bill.paid", bid, request_id)


def void_bill(conn: sqlite3.Connection, bid: str, reason: str, actor: Any, request_id: str | None, row_version: int | None = None) -> None:
    row = get_bill(conn, bid)
    _check_version(row, row_version)
    if not reason or not reason.strip():
        raise _err(422, "reason_required", "חובה לציין סיבת ביטול.")
    if row["state"] not in ("issued", "sent"):
        raise conflict("bill_state", f"אי אפשר לבטל חיוב במצב {STATE_HE[row['state']]}.", state=row["state"])
    conn.execute("UPDATE water_bills SET state = 'void', void_reason = ?, voided_at = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
                 (reason.strip(), now_iso(), now_iso(), bid))
    _event(conn, bid, "void", actor, {"reason": reason.strip()})
    _audit(conn, actor, "bill.void", bid, request_id)


def check_correctable(conn: sqlite3.Connection, row: sqlite3.Row) -> None:
    if row["state"] not in ISSUED_STATES:
        raise conflict("bill_state", f"אי אפשר לתקן חיוב במצב {STATE_HE[row['state']]}.", state=row["state"])
    existing = conn.execute("SELECT id FROM water_bills WHERE replaces_bill_id = ? AND state = 'draft'", (row["id"],)).fetchone()
    if existing:
        raise conflict("bill_state", "כבר קיימת טיוטת תיקון לחיוב זה.", bill_id=existing["id"], state=row["state"])


# ====================================================================== automatic generation and retention (the shared keys)

@dataclass
class AutoOutcome:
    created: int = 0
    issued: int = 0
    failed: int = 0
    skipped: int = 0


def _due_periods(conn: sqlite3.Connection, acc: sqlite3.Row, now: dt.datetime, delay: dt.timedelta) -> list[per.Period]:
    tz = acc["timezone"]
    created_local = per.local_date(_parse_iso(acc["created_at"]) or now, tz)
    out: list[per.Period] = []
    for p in per.regular_periods(eb.cycle_of(acc), per.local_date(now, tz)):
        if p.end <= created_local or per.local_midnight_utc(p.end, tz) + delay > now:
            continue
        run = conn.execute("SELECT status, next_attempt_at FROM water_auto_runs WHERE account_id = ? AND period_start = ? AND period_end = ?",
                           (acc["id"], p.start.isoformat(), p.end.isoformat())).fetchone()
        if run is not None and not (run["status"] == "failed" and (run["next_attempt_at"] or "") <= _iso(now)):
            continue
        out.append(p)
        if len(out) >= AUTO_MAX_PER_ACCOUNT:
            break
    return out


def _record_run(conn: sqlite3.Connection, acc_id: str, p: per.Period, status: str, bill_id: str | None, error: str | None, now: dt.datetime) -> None:
    conn.execute(
        """INSERT INTO water_auto_runs(account_id, period_start, period_end, status, bill_id, error_code, attempts, next_attempt_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
           ON CONFLICT(account_id, period_start, period_end) DO UPDATE SET status = excluded.status, bill_id = excluded.bill_id, error_code = excluded.error_code,
             attempts = water_auto_runs.attempts + 1, next_attempt_at = excluded.next_attempt_at, updated_at = excluded.updated_at""",
        (acc_id, p.start.isoformat(), p.end.isoformat(), status, bill_id, error, _iso(now + AUTO_RETRY) if status == "failed" else None, now_iso(), now_iso()))


def auto_generate(db: Database, settings: Any, now: dt.datetime | None = None) -> AutoOutcome:
    """One pass (the electricity rule): idempotent per (account, period); the computation before the write lock; nothing while the module is off."""
    now = now or now_utc()
    out = AutoOutcome()
    with db.connection(mode="read", label="water.auto.scan") as rconn:
        if not ws.enabled(rconn):
            return out
        delay = dt.timedelta(hours=int(read_settings(rconn)["auto"]["delay_hours"]))
        accounts = rconn.execute("SELECT * FROM water_accounts WHERE deleted_at IS NULL AND status = 'active' AND auto_mode != 'off' ORDER BY created_at").fetchall()
        work = [(acc, _due_periods(rconn, acc, now, delay)) for acc in accounts]
    for acc, periods in work:
        for p in periods:
            try:
                with db.connection(mode="read", label="water.auto.compute") as rconn:
                    if rconn.execute("SELECT 1 FROM water_bills WHERE account_id = ? AND period_start < ? AND period_end > ? AND state != 'void' LIMIT 1",
                                     (acc["id"], p.end.isoformat(), p.start.isoformat())).fetchone():
                        comp, error = None, "exists"
                    else:
                        comp, error = compute(rconn, provider_for(rconn, settings), acc, p, origin="auto", now=now), None
            except ApiError as e:
                comp, error = None, e.code
            except Exception:  # noqa: BLE001 - one account never stops the others
                log.warning("automatic water bill computation failed", exc_info=True)
                comp, error = None, "internal"
            with db.connection(label="water.auto.write") as conn:
                run = conn.execute("SELECT status, next_attempt_at FROM water_auto_runs WHERE account_id = ? AND period_start = ? AND period_end = ?",
                                   (acc["id"], p.start.isoformat(), p.end.isoformat())).fetchone()
                if run is not None and not (run["status"] == "failed" and (run["next_attempt_at"] or "") <= _iso(now)):
                    continue
                if error == "exists":
                    _record_run(conn, acc["id"], p, "skipped", None, None, now)
                    out.skipped += 1
                    continue
                if comp is None:
                    _record_run(conn, acc["id"], p, "failed", None, error, now)
                    audit(conn, actor=None, action="infra.water.bill.auto_failed", decision="allowed", resource_type="water_account", resource_id=acc["id"],
                          details={"period": p.as_api(), "error": error})
                    out.failed += 1
                    continue
                cur = conn.execute("SELECT * FROM water_accounts WHERE id = ? AND deleted_at IS NULL", (acc["id"],)).fetchone()
                if cur is None or cur["revision"] != acc["revision"]:
                    continue
                try:
                    bid = insert_draft(conn, cur, p, comp, actor=None, origin="auto", request_id=None, client_request_id=None)
                except ApiError as e:
                    _record_run(conn, acc["id"], p, "skipped" if e.code in ("draft_exists", "period_overlap") else "failed", None, e.code, now)
                    out.skipped += 1
                    continue
                status = "created"
                if cur["auto_mode"] == "issue":
                    try:
                        seal(conn, get_bill(conn, bid), comp, actor=None, issue_date=per.local_date(now, cur["timezone"]), request_id=None, client_request_id=None)
                        status = "issued"
                        out.issued += 1
                    except ApiError as e:
                        log.warning("automatic water issue refused: %s", e.code)
                _record_run(conn, acc["id"], p, status, bid, None, now)
                out.created += 1
    return out


def retention(db: Database, now: dt.datetime | None = None) -> dict[str, int]:
    """The SHARED retention keys (energy.draft_retention_days, energy.bill_retention_years); the number ledger and the run rows stay."""
    now = now or now_utc()
    with db.connection(label="water.billing.retention") as conn:
        days = eb._int_setting(conn, "energy.draft_retention_days", 30, 7, 365)
        years = eb._int_setting(conn, "energy.bill_retention_years", 7, 1, 15)
        draft_cut = _iso(now - dt.timedelta(days=days))
        today = per.local_date(now, "UTC")
        bill_cut = today.replace(year=today.year - years, day=1).isoformat()
        drafts = [r[0] for r in conn.execute("SELECT id FROM water_bills WHERE state = 'draft' AND updated_at < ?", (draft_cut,)).fetchall()]
        old = [r[0] for r in conn.execute("SELECT id FROM water_bills WHERE state != 'draft' AND period_end < ?", (bill_cut,)).fetchall()]
        for bid in drafts + old:
            conn.execute("DELETE FROM water_bill_events WHERE bill_id = ?", (bid,))
            conn.execute("DELETE FROM water_bills WHERE id = ?", (bid,))
        if drafts or old:
            audit(conn, actor=None, action="infra.water.bill.retention", decision="allowed", resource_type="water_bill", resource_id="*",
                  details={"drafts": len(drafts), "bills": len(old)})
    return {"drafts": len(drafts), "bills": len(old)}


_LAST: dict[str, float] = {}
AUTO_EVERY_S = 300
RETENTION_EVERY_S = 3600


def janitor(db: Database, settings: Any) -> AutoOutcome | None:
    """main.janitor_tick: the automatic generation at most every 5 minutes, retention hourly; nothing while the module is off."""
    key = str(getattr(db, "path", ""))
    with db.connection(mode="read", label="water.billing.gate") as conn:
        try:
            if not ws.enabled(conn) or conn.execute("SELECT 1 FROM sqlite_master WHERE name = 'water_bills'").fetchone() is None:
                return None
        except sqlite3.Error:
            return None
    mono = time.monotonic()
    if mono - _LAST.get("ret:" + key, -1e9) >= RETENTION_EVERY_S:
        _LAST["ret:" + key] = mono
        retention(db)
    if mono - _LAST.get("auto:" + key, -1e9) < AUTO_EVERY_S:
        return None
    _LAST["auto:" + key] = mono
    return auto_generate(db, settings)


def reset() -> None:
    _LAST.clear()
    _OVERRIDE.clear()


def data_dir_of(settings: Any) -> Path:
    return Path(settings.data_dir)
