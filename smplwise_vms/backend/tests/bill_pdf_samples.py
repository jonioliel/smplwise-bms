"""Fake bill snapshots (billing snapshot v1, docs/architecture/ELECTRICITY_BILL_SNAPSHOT.md) for the PDF tests and the
evidence samples. Everything here is invented."""
from __future__ import annotations

import copy
import io
from typing import Any

from PIL import Image

HIST = [("2025-10-01", "2025-10-31", "688.00"), ("2025-11-01", "2025-11-30", "731.50"),
        ("2025-12-01", "2025-12-31", "805.25"), ("2026-01-01", "2026-01-31", "842.00"),
        ("2026-02-01", "2026-02-28", "790.40"), ("2026-03-01", "2026-03-31", "655.00"),
        ("2026-04-01", "2026-04-30", "610.75"), ("2026-05-01", "2026-05-31", "690.00"),
        ("2026-06-01", "2026-06-30", "845.30"), ("2026-07-01", "2026-07-31", "812.40"),
        ("2026-08-01", "2026-08-31", "776.20")]
LAST_YEAR = {"from": "2025-09-01", "to": "2025-09-30", "kwh": "702.10", "status": "measured", "source": "bill"}


def previous(rows=HIST, status: str = "measured") -> list[dict[str, Any]]:
    return [{"from": a, "to": b, "kwh": k, "status": status, "source": "bill"} for a, b, k in rows]


def base() -> dict[str, Any]:
    """A one-page issued bill: two meters (one at a 30% share), one price, previous periods and last year."""
    return {
        "schema": "arx.energy.bill_snapshot/1",
        "doc": {"title_he": "חשבון צריכת חשמל ודרישת תשלום", "subtitle_he": "אינו חשבונית מס", "is_tax_invoice": False},
        "bill": {"id": "a1b2c3d4e5f60718", "number": "2026-09-0001", "revision": 1, "replaces": None, "state": "issued",
                 "origin": "manual", "issue_date": "2026-10-02", "due_date": "2026-10-16",
                 "expected_due_date": "2026-10-16", "issued_at": "2026-10-02T06:12:00Z"},
        "period": {"from": "2026-09-01", "to": "2026-09-30", "end_exclusive": "2026-10-01", "days": 30,
                   "timezone": "Asia/Jerusalem"},
        "business": {"name": "נכסי הדוגמה בע״מ", "registration_no": "510000000", "address": "רחוב הדוגמה 12, עיר לדוגמה",
                     "phone": "03-0000000", "email": "billing@example.co.il", "accent_color": "#2767ed",
                     "footer_note": "התשלום בהעברה בנקאית לפי פרטי ההסכם.", "logo": None},
        "customer": {"id": "c1", "customer_number": "0001", "name": "סטודיו אורן לעיצוב",
                     "address": "רחוב הדוגמה 12, קומה 1, עיר לדוגמה"},
        "account": {"id": "ac1", "name": "סטודיו אורן - קומה 1", "tariff": {"id": "t1", "name": "תעריף קבוע לקוט״ש"},
                    "formula": {"text": "[לוח סטודיו] + 0.3 x [תאורת לובי]", "sentence_he": "לוח סטודיו + 30% מתאורת לובי"}},
        "meters": [
            {"meter_id": "m1", "name": "לוח סטודיו", "coefficient": "1",
             "start": {"reading_kwh": "12480.620", "kind": "reading"}, "end": {"reading_kwh": "13166.100", "kind": "reading"},
             "consumption_kwh": "685.48", "contribution_kwh": "685.48", "reported_to_end": True},
            {"meter_id": "m2", "name": "תאורת לובי", "coefficient": "0.30",
             "start": {"reading_kwh": "4210.300", "kind": "reading"}, "end": {"reading_kwh": "4512.700", "kind": "reading"},
             "consumption_kwh": "302.40", "contribution_kwh": "90.72", "reported_to_end": True},
        ],
        "lines": [{"from": "2026-09-01", "to": "2026-09-30", "kwh": "776.20", "price_entered": "0.5430",
                   "price_mode": "ex_vat", "unit_price_ex_vat": "0.5430", "amount_ex_vat": "421.48",
                   "vat_rate_percent": "18", "vat_amount": "75.87", "total": "497.35"}],
        "totals": {"currency": "ILS", "kwh": "776.20", "amount_ex_vat": "421.48", "vat_amount": "75.87", "total": "497.35",
                   "vat_breakdown": [{"rate_percent": "18", "base": "421.48", "vat": "75.87"}], "price_mode_note_he": None},
        "notes": [],
        "history": {"current": {"from": "2026-09-01", "to": "2026-09-30", "kwh": "776.20"}, "previous": previous(),
                    "same_period_last_year": copy.deepcopy(LAST_YEAR)},
        "rounding": {"rule": "half_up"},
        "meta": {"engine": "arx.energy.billing/1", "software_version": "0.1.157", "computed_at": "2026-10-02T06:12:00Z"},
    }


def variant(**changes: Any) -> dict[str, Any]:
    data = copy.deepcopy(base())
    for key, value in changes.items():
        data[key] = value
    return data


def with_history(prev: list[dict[str, Any]], last_year: dict[str, Any] | None) -> dict[str, Any]:
    data = base()
    data["history"] = {"current": data["history"]["current"], "previous": prev, "same_period_last_year": last_year}
    return data


def no_history() -> dict[str, Any]:
    return with_history([], None)


def draft() -> dict[str, Any]:
    data = base()
    data["bill"].update(number=None, state="draft", issue_date=None, due_date=None, issued_at=None)
    return data


def revision() -> dict[str, Any]:
    data = base()
    data["bill"].update(number="2026-09-0001-2", revision=2, replaces={"bill_id": "x", "number": "2026-09-0001"})
    return data


def missing_report() -> dict[str, Any]:
    data = base()
    data["meters"][1].update(reported_to_end=False, last_report_at="2026-09-29T04:10:00Z")  # 07:10 in Israel (UTC+3)
    data["notes"] = [{"code": "meter_not_reporting", "meter_id": "m2",
                      "text_he": "המונה תאורת לובי לא מדווח מאז 29.09.2026 07:10. הצריכה שלאחר מכן תחויב בחיוב הבא."},
                     {"code": "reading_time", "meter_id": "m1", "text_he": "קריאת סוף התקופה של לוח סטודיו ב-30.09.2026 23:55."}]
    return data


def big(meters: int = 90) -> dict[str, Any]:
    """A bill with many meter lines (several pages: the table header repeats and page numbers advance)."""
    data = base()
    lines = []
    total = 0.0
    for i in range(meters):
        start, used = 1000.0 + i * 13.37, 40.0 + (i * 7) % 50
        total += used
        lines.append({"meter_id": f"m{i}", "name": f"מונה דירה {i + 1:03d} - קומה {i // 6 + 1}", "coefficient": "1",
                      "start": {"reading_kwh": f"{start:.3f}"}, "end": {"reading_kwh": f"{start + used:.3f}"},
                      "consumption_kwh": f"{used:.2f}", "contribution_kwh": f"{used:.2f}", "reported_to_end": True})
    data["meters"] = lines
    sub = round(total * 0.543, 2)
    vat = round(sub * 0.18, 2)
    data["lines"] = [{"from": "2026-09-01", "to": "2026-09-30", "kwh": f"{total:.2f}", "unit_price_ex_vat": "0.5430",
                      "amount_ex_vat": f"{sub:.2f}", "vat_rate_percent": "18", "vat_amount": f"{vat:.2f}",
                      "total": f"{sub + vat:.2f}"}]
    data["totals"].update(kwh=f"{total:.2f}", amount_ex_vat=f"{sub:.2f}", vat_amount=f"{vat:.2f}", total=f"{sub + vat:.2f}")
    return data


def logo_png(size: int = 96) -> bytes:
    img = Image.new("RGB", (size, size), (39, 103, 237))
    for x in range(size // 4, size * 3 // 4):
        for y in range(size // 4, size * 3 // 4):
            img.putpixel((x, y), (255, 255, 255))
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()
