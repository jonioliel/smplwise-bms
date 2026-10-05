"""Input model of the electricity bill PDF renderer (CR-023, phase P3).

The public input is the frozen bill snapshot v1 (`docs/architecture/ELECTRICITY_BILL_SNAPSHOT.md`, schema
`arx.energy.bill_snapshot/1`) as parsed JSON. `BillSnapshot.from_billing_snapshot` validates it and turns it into the
renderer's own closed, typed shape. Everything here is data: nothing in it is ever interpreted as HTML, CSS or a URL.
The renderer escapes at output time; this module additionally normalises and bounds every string (control and
bidi-override characters removed, length caps) and every list (row caps), so a hostile or enormous snapshot cannot
make a huge or misleading document. The renderer prints stored values and never recomputes an amount.
"""
from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Mapping

SCHEMA_PREFIX = "arx.energy.bill_snapshot/1"
MARKS = (None, "draft", "void", "copy")

# Bounds (a bill beyond these is refused, not truncated: a silently shortened bill would be a wrong bill).
MAX_METER_LINES = 400
MAX_CHARGE_LINES = 96  # EL5: a time-of-use bill has one line per price piece x season x band
MAX_TOU_DAYS = 400
MAX_TOU_BANDS = 8
MAX_HISTORY = 24
MAX_NOTES = 40
MAX_NOTES_CHARS = 2000
MAX_NAME_CHARS = 200
MAX_LINE_CHARS = 300

_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f  ]")
# Bidi embeddings, overrides and isolates (U+202A-202E, U+2066-2069) can visually reorder the surrounding text.
_BIDI_CONTROLS = re.compile(r"[\u202a-\u202e\u2066-\u2069\ufeff￹-￻]")
# 2026-12-0001, 2026-12-0001-2 (revision), 2026-12-0001/2 (running suffix), 2026-12-0001/2-2
NUMBER_RE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{4,10}(?:/[0-9]{1,3})?(?:-[0-9]{1,3})?$")
_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class BillSnapshotError(ValueError):
    """The snapshot is malformed or beyond the renderer's limits (not retryable: rendering again gives the same answer).

    `field` is the name of the offending snapshot field (the text before the colon: "customer.name", "lines"); it holds
    names only, never a value, so it is safe to log and to show. `code` is "no_lines" for a bill that has nothing to
    print, "invalid" for everything else."""

    def __init__(self, message: str):
        super().__init__(message)
        self.field = message.split(":", 1)[0].strip()[:60] if ":" in message else ""
        self.code = "no_lines" if message.startswith("lines: at least one line") else "invalid"


def clean_text(value: Any, max_chars: int = MAX_LINE_CHARS, multiline: bool = False) -> str:
    """Normalise a user-entered string for printing. The result is still untrusted and must be escaped on output."""
    if value is None:
        return ""
    text = unicodedata.normalize("NFC", str(value))
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _BIDI_CONTROLS.sub("", text)
    if multiline:
        text = _CTRL.sub("", text.replace("\t", " "))  # \n is not in _CTRL, so line breaks survive
        text = re.sub(r"\n{3,}", "\n\n", text)
    else:
        text = _CTRL.sub("", text.replace("\n", " ").replace("\t", " "))
        text = re.sub(r" {2,}", " ", text)
    text = text.strip()
    if len(text) > max_chars:
        text = text[: max_chars - 1].rstrip() + "…"
    return text


def to_decimal(value: Any, field_name: str) -> Decimal:
    if isinstance(value, bool) or value is None:
        raise BillSnapshotError(f"{field_name}: a number is required")
    try:
        number = value if isinstance(value, Decimal) else Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as exc:
        raise BillSnapshotError(f"{field_name}: not a number") from exc
    if not number.is_finite() or abs(number) > Decimal("1e12"):
        raise BillSnapshotError(f"{field_name}: out of range")
    return number


def to_date(value: Any, field_name: str) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            pass
    raise BillSnapshotError(f"{field_name}: a date (YYYY-MM-DD) is required")


def _opt_reading(value: Any, field_name: str) -> Decimal | None:
    """A meter reading at a period edge; None when the meter had no reading there (it is printed as a dash)."""
    return None if value is None else to_decimal(value, field_name)


def _opt_date(value: Any, field_name: str) -> date | None:
    return None if value in (None, "") else to_date(value, field_name)


def _local_moment(value: Any, tz_name: str, field_name: str) -> datetime | None:
    """A UTC instant ('...Z') shown in the account's time zone, as a naive local datetime."""
    if value in (None, ""):
        return None
    try:
        moment = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as exc:
        raise BillSnapshotError(f"{field_name}: not an ISO date-time") from exc
    if moment.tzinfo is None:
        return moment
    try:
        from zoneinfo import ZoneInfo

        return moment.astimezone(ZoneInfo(tz_name)).replace(tzinfo=None)
    except Exception:  # unknown zone or no tzdata: keep UTC rather than fail the bill
        return moment.astimezone(timezone.utc).replace(tzinfo=None)


def _obj(parent: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    value = parent.get(key)
    if value is None:
        return {}
    if not isinstance(value, Mapping):
        raise BillSnapshotError(f"{key}: an object is required")
    return value


def _list(parent: Mapping[str, Any], key: str, cap: int) -> list[Any]:
    value = parent.get(key)
    if value is None:
        return []
    if not isinstance(value, list):
        raise BillSnapshotError(f"{key}: a list is required")
    if len(value) > cap:
        raise BillSnapshotError(f"{key}: too many entries")
    return value


@dataclass(frozen=True)
class Business:
    name: str
    reg_no: str = ""
    address: str = ""
    phone: str = ""
    email: str = ""
    logo: bytes | None = None  # raw bytes; the renderer re-encodes them (see bill_pdf_logo)
    accent: str = "#2767ed"  # one colour token from the business settings


@dataclass(frozen=True)
class Customer:
    name: str
    address: str = ""
    number: str = ""
    account_name: str = ""


@dataclass(frozen=True)
class MeterLine:
    name: str
    start_reading: Decimal | None  # None: no reading at the period start (printed as a dash)
    end_reading: Decimal | None
    consumption_kwh: Decimal  # what is billed for this meter before the account formula
    billed_kwh: Decimal  # contribution to the bill after the account formula (coefficient x consumption)
    share_text: str = ""  # "30%", "-" for a subtracted sub-meter, "" when the full reading counts
    last_report: datetime | None = None  # set when the meter did not report up to the period end
    report_note: str = ""  # the server's ready-to-print Hebrew note about that meter, if any


@dataclass(frozen=True)
class ChargeLine:
    """One priced segment (a price or VAT-rate change splits the period, so a bill can have several)."""

    kwh: Decimal
    price_per_kwh: Decimal  # before VAT
    vat_rate_pct: Decimal
    amount: Decimal  # before VAT
    vat_amount: Decimal
    period_start: date | None = None
    period_end: date | None = None
    band: str = ""  # EL5: the time-of-use band name ("פסגה"); empty for a fixed price
    season: str = ""  # EL5: the season name ("קיץ")
    hours: Decimal | None = None  # EL5: how many hours of the period fell in this band and season

    @property
    def label(self) -> str:
        """The printed description of the line (the date range is added by the renderer when the period was split)."""
        if self.band:
            return f"צריכת חשמל - {self.band}" + (f" ({self.season})" if self.season else "")
        return "צריכת חשמל"


@dataclass(frozen=True)
class TouDay:
    """EL5: one row of the daily time-of-use table (kWh per band of that local date)."""

    day: date
    kwh: tuple[Decimal | None, ...]  # in the order of BillSnapshot.tou_bands; None = no energy in that band that day
    total: Decimal
    marker: str = ""  # the special day's name (a holiday or its eve), printed next to the date


@dataclass(frozen=True)
class HistoryPoint:
    period_start: date
    period_end: date
    kwh: Decimal
    partial: bool = False  # some data was missing: the value is a lower bound and the chart marks it


@dataclass(frozen=True)
class BillSnapshot:
    mark: str | None  # None | draft | void | copy (the watermark)
    number: str | None  # None while a draft
    period_start: date  # first day (inclusive)
    period_end: date  # last day (inclusive)
    business: Business
    customer: Customer
    meters: tuple[MeterLine, ...]
    charges: tuple[ChargeLine, ...]
    total_kwh: Decimal
    subtotal: Decimal
    vat_total: Decimal
    total: Decimal
    title: str = "חשבון צריכת חשמל ודרישת תשלום"
    subtitle: str = "אינו חשבונית מס"
    issue_date: date | None = None
    due_date: date | None = None
    tariff_name: str = ""
    formula_text: str = ""
    price_note: str = ""
    replaces_number: str | None = None  # the number of the bill this revision replaces
    notes: tuple[str, ...] = ()  # the server's ready-to-print data notes (except per-meter report notes)
    footer_note: str = ""
    previous_kwh: Decimal | None = None
    history: tuple[HistoryPoint, ...] = ()  # up to 12 previous periods; gaps are simply absent
    same_period_last_year: HistoryPoint | None = None
    snapshot_hash: str = ""  # first 12 hex of sha256(canonical snapshot), printed in the footer
    tou_bands: tuple[str, ...] = ()  # EL5: band names of the daily table, in the tariff's order
    tou_daily: tuple[TouDay, ...] = ()  # EL5: the daily time-of-use table (empty for a fixed price)

    @property
    def days(self) -> int:
        return (self.period_end - self.period_start).days + 1

    # ------------------------------------------------------------------ construction from the billing snapshot v1
    @classmethod
    def from_billing_snapshot(cls, raw: Mapping[str, Any], *, logo: bytes | None = None,
                              watermark: str | None = None) -> "BillSnapshot":
        if not isinstance(raw, Mapping):
            raise BillSnapshotError("snapshot must be an object")
        if not str(raw.get("schema") or "").startswith(SCHEMA_PREFIX):
            raise BillSnapshotError("schema: unsupported snapshot version")
        if watermark not in MARKS:
            raise BillSnapshotError("watermark: unknown value")
        bill, period = _obj(raw, "bill"), _obj(raw, "period")
        doc, biz, cust, acc = _obj(raw, "doc"), _obj(raw, "business"), _obj(raw, "customer"), _obj(raw, "account")
        totals, hist = _obj(raw, "totals"), _obj(raw, "history")
        tz_name = str(period.get("timezone") or "Asia/Jerusalem")

        state = str(bill.get("state") or "")
        if state not in ("draft", "issued"):
            raise BillSnapshotError("bill.state: draft or issued expected")
        number = bill.get("number")
        number = None if number in (None, "") else str(number)
        if number is not None and not NUMBER_RE.match(number):
            raise BillSnapshotError("bill.number: unexpected format")
        if state == "issued" and number is None:
            raise BillSnapshotError("bill.number: required unless the bill is a draft")
        replaces = _obj(bill, "replaces").get("number")
        replaces = None if replaces in (None, "") else str(replaces)
        if replaces is not None and not NUMBER_RE.match(replaces):
            raise BillSnapshotError("bill.replaces.number: unexpected format")
        mark = watermark or ("draft" if state == "draft" else None)  # a draft is never printed without its mark

        accent = str(biz.get("accent_color") or "#2767ed")
        if not _COLOR_RE.match(accent):
            accent = "#2767ed"
        business = Business(
            name=clean_text(biz.get("name"), MAX_NAME_CHARS), reg_no=clean_text(biz.get("registration_no"), 40),
            address=clean_text(biz.get("address"), MAX_LINE_CHARS), phone=clean_text(biz.get("phone"), 40),
            email=clean_text(biz.get("email"), 120), logo=bytes(logo) if logo else None, accent=accent)
        customer = Customer(
            name=clean_text(cust.get("name"), MAX_NAME_CHARS), address=clean_text(cust.get("address"), MAX_LINE_CHARS),
            number=clean_text(cust.get("customer_number"), 40), account_name=clean_text(acc.get("name"), MAX_NAME_CHARS))
        if not customer.name:
            raise BillSnapshotError("customer.name: required")

        # per-meter "did not report" notes written by the server travel with the meter; the rest are general notes
        report_notes: dict[str, str] = {}
        general: list[str] = []
        for n in _list(raw, "notes", MAX_NOTES):
            if not isinstance(n, Mapping):
                raise BillSnapshotError("notes: objects expected")
            text = clean_text(n.get("text_he"), MAX_LINE_CHARS)
            if n.get("code") == "meter_not_reporting" and n.get("meter_id"):
                report_notes[str(n["meter_id"])] = text
            elif text:
                general.append(text)

        meters: list[MeterLine] = []
        for m in _list(raw, "meters", MAX_METER_LINES):
            if not isinstance(m, Mapping):
                raise BillSnapshotError("meters: objects expected")
            coefficient = to_decimal(m.get("coefficient", "1"), "meters.coefficient")
            start, end = _obj(m, "start"), _obj(m, "end")
            flagged = m.get("reported_to_end") is False
            meters.append(MeterLine(
                name=clean_text(m.get("name"), MAX_NAME_CHARS),
                start_reading=_opt_reading(start.get("reading_kwh"), "meters.start.reading_kwh"),
                end_reading=_opt_reading(end.get("reading_kwh"), "meters.end.reading_kwh"),
                consumption_kwh=to_decimal(m.get("consumption_kwh"), "meters.consumption_kwh"),
                billed_kwh=to_decimal(m.get("contribution_kwh", m.get("consumption_kwh")), "meters.contribution_kwh"),
                share_text=_share_text(coefficient),
                last_report=_local_moment(m.get("last_report_at"), tz_name, "meters.last_report_at") if flagged else None,
                report_note=report_notes.get(str(m.get("meter_id")), "") if flagged else ""))

        charges: list[ChargeLine] = []
        for x in _list(raw, "lines", MAX_CHARGE_LINES):
            if not isinstance(x, Mapping):
                raise BillSnapshotError("lines: objects expected")
            band, season = _obj(x, "band"), _obj(x, "season")
            charges.append(ChargeLine(
                kwh=to_decimal(x.get("kwh"), "lines.kwh"),
                price_per_kwh=to_decimal(x.get("unit_price_ex_vat"), "lines.unit_price_ex_vat"),
                vat_rate_pct=to_decimal(x.get("vat_rate_percent"), "lines.vat_rate_percent"),
                amount=to_decimal(x.get("amount_ex_vat"), "lines.amount_ex_vat"),
                vat_amount=to_decimal(x.get("vat_amount"), "lines.vat_amount"),
                period_start=_opt_date(x.get("from"), "lines.from"), period_end=_opt_date(x.get("to"), "lines.to"),
                band=clean_text(band.get("name_he"), 40), season=clean_text(season.get("name_he"), 40),
                hours=to_decimal(x["hours"], "lines.hours") if x.get("hours") is not None else None))
        if not charges and state != "draft":
            raise BillSnapshotError("lines: at least one line is required")
        if not charges:  # a draft with no consumption still prints (watermarked) so the owner can see what the bill holds
            general.append("טיוטה ללא צריכה: המונים לא דיווחו בתקופה, ולכן אין שורות חיוב. החישוב יתעדכן כשיגיעו קריאות.")
        tou_bands, tou_daily = _tou_table(_obj(raw, "tou"))

        p_start, p_end = to_date(period.get("from"), "period.from"), to_date(period.get("to"), "period.to")
        if p_end < p_start:
            raise BillSnapshotError("period.to is before period.from")
        if (p_end - p_start).days > 800:
            raise BillSnapshotError("period is implausibly long")

        previous = _list(hist, "previous", MAX_HISTORY)
        points = tuple(_history_point(p) for p in previous if isinstance(p, Mapping) and p.get("kwh") is not None)
        ly_raw = hist.get("same_period_last_year")
        ly = _history_point(ly_raw) if isinstance(ly_raw, Mapping) and ly_raw.get("kwh") is not None else None
        prev_kwh = None
        if points:
            last = max(points, key=lambda h: h.period_end)
            if (p_start - last.period_end).days == 1 and not last.partial:  # the directly preceding, complete period only
                prev_kwh = last.kwh

        due = _opt_date(bill.get("due_date") or bill.get("expected_due_date"), "bill.due_date")
        return cls(
            mark=mark, number=number, period_start=p_start, period_end=p_end, business=business, customer=customer,
            meters=tuple(meters), charges=tuple(charges),
            total_kwh=to_decimal(totals.get("kwh"), "totals.kwh"),
            subtotal=to_decimal(totals.get("amount_ex_vat"), "totals.amount_ex_vat"),
            vat_total=to_decimal(totals.get("vat_amount"), "totals.vat_amount"),
            total=to_decimal(totals.get("total"), "totals.total"),
            title=clean_text(doc.get("title_he"), MAX_NAME_CHARS) or cls.title,
            subtitle=clean_text(doc.get("subtitle_he"), MAX_NAME_CHARS) or cls.subtitle,
            issue_date=_opt_date(bill.get("issue_date"), "bill.issue_date"), due_date=due,
            tariff_name=clean_text(_obj(acc, "tariff").get("name"), MAX_NAME_CHARS),
            formula_text=clean_text(_obj(acc, "formula").get("sentence_he") or _obj(acc, "formula").get("text"),
                                    MAX_LINE_CHARS),
            price_note=clean_text(totals.get("price_mode_note_he"), MAX_LINE_CHARS),
            replaces_number=replaces, notes=tuple(general),
            footer_note=clean_text(biz.get("footer_note"), MAX_NOTES_CHARS, multiline=True),
            previous_kwh=prev_kwh, history=points, same_period_last_year=ly,
            snapshot_hash=hashlib.sha256(_canonical(raw)).hexdigest()[:12],
            tou_bands=tou_bands, tou_daily=tou_daily)


def _tou_table(t: Mapping[str, Any]) -> tuple[tuple[str, ...], tuple[TouDay, ...]]:
    """EL5: the daily band table from snapshot.tou (absent for a fixed price). Bands in the order of the first definition,
    names from snapshot.tou.names; an unknown band id prints as the id."""
    daily = _list(t, "daily", MAX_TOU_DAYS)
    if not daily:
        return (), ()
    names = _obj(_obj(t, "names"), "bands")
    order: list[str] = []
    for v in _list(t, "versions", 16):
        if isinstance(v, Mapping):
            for b in _list(_obj(v, "definition"), "bands", 16):
                if isinstance(b, Mapping) and isinstance(b.get("id"), str) and b["id"] not in order:
                    order.append(b["id"])
    for d in daily:
        for b in _list(d if isinstance(d, Mapping) else {}, "bands", 16):
            if isinstance(b, Mapping) and isinstance(b.get("band"), str) and b["band"] not in order:
                order.append(b["band"])
    if len(order) > MAX_TOU_BANDS:
        raise BillSnapshotError("tou.daily: too many bands")
    rows: list[TouDay] = []
    for d in daily:
        if not isinstance(d, Mapping):
            raise BillSnapshotError("tou.daily: objects expected")
        per_band = {b.get("band"): to_decimal(b.get("kwh"), "tou.daily.bands.kwh") for b in _list(d, "bands", 16) if isinstance(b, Mapping)}
        special = _obj(d, "special")
        rows.append(TouDay(to_date(d.get("date"), "tou.daily.date"), tuple(per_band.get(b) for b in order),
                           to_decimal(d.get("kwh"), "tou.daily.kwh"), clean_text(special.get("name_he"), 40)))
    return tuple(clean_text(names.get(b) or b, 40) for b in order), tuple(rows)


def _canonical(raw: Mapping[str, Any]) -> bytes:
    return json.dumps(raw, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str).encode("utf-8")


def _history_point(p: Mapping[str, Any]) -> HistoryPoint:
    return HistoryPoint(to_date(p.get("from"), "history.from"), to_date(p.get("to"), "history.to"),
                        to_decimal(p.get("kwh"), "history.kwh"), partial=p.get("status") == "partial")


def _share_text(coefficient: Decimal) -> str:
    if coefficient == 1:
        return ""
    if coefficient == -1:
        return "\u2212"
    pct = format((abs(coefficient) * 100).normalize(), "f")
    return f"{'\u2212' if coefficient < 0 else ''}{pct}%"


def coerce_snapshot(snapshot: "BillSnapshot | Mapping[str, Any]", *, logo: bytes | None = None,
                    watermark: str | None = None) -> BillSnapshot:
    if isinstance(snapshot, BillSnapshot):
        return snapshot
    return BillSnapshot.from_billing_snapshot(snapshot, logo=logo, watermark=watermark)


__all__ = [
    "BillSnapshot", "BillSnapshotError", "Business", "Customer", "MeterLine", "ChargeLine", "HistoryPoint", "TouDay",
    "NUMBER_RE", "clean_text", "coerce_snapshot",
]
