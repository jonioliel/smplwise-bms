"""CR-038 section 18A backlog item: monthly ticket counts per department or per vendor, as CSV.

The counted rows are the caller's VISIBLE set (access.visible_export_rows: every row through visible(); the same 5,000-row cap as the
table export -> 413 `export_too_large`) created inside a REQUIRED date range of at most MAX_DAYS days. Months are cut in the
installation zone (`time.zone`). A "vendor" is the contact (external handler) of the ticket's current assignment; tickets without one
are counted under one "no external vendor" line so the lines add up to the total. The file is UTF-8 with a BOM, every cell goes
through the shared formula guard (text_hygiene.csv_cell) and carries only names and counts - never a phone, a note or a link.

CR-SVC215 slice 2: the VENDOR group gains the card's numbers of each (month, vendor) line over that month (clipped to the requested range) -
`response_median_min`, `arrival_on_time`, `arrival_total`, `repeat_visits`, `repeat_base` and, for a caller who holds the money permission,
`quote_kept`, `quote_base`, `quote_overshoot_median_bp`. The columns are ABSENT (not blank) when the caller may not read the card, when
`vendor_stats.csv_columns` is off, or when the number is hidden in `vendor_stats.numbers`; a line that gets no card (no vendor, an employee,
an erased contact) has empty cells; an empty base is an empty cell, never 0. The numbers are the vendor COMPANY's, so two technicians of one
company in one month show the company's figures on both lines."""
from __future__ import annotations

import datetime as dt
import sqlite3
from collections import defaultdict
from typing import Any

from ...db import get_setting
from ..timeutil import iso_utc, parse_utc, zone
from . import naming, present
from .access import Seen
from .text_hygiene import csv_cell

MAX_DAYS = 366
GROUPS = ("department", "vendor")
RATE_PREFIX = "monthly:"  # the per-user rate key (services/tickets/export.py's limiter, a separate bucket)
CLOSED = ("closed", "cancelled")
HEADERS: dict[str, dict[str, list[str]]] = {
    "he": {"department": ["חודש", "מחלקה", "נפתחו", "מתוכן סגורות"], "vendor": ["חודש", "ספק", "נפתחו", "מתוכן סגורות"]},
    "en": {"department": ["Month", "Department", "Opened", "Of them closed"], "vendor": ["Month", "Vendor", "Opened", "Of them closed"]},
}
NO_VENDOR = {"he": "ללא ספק חיצוני", "en": "No external vendor"}
# slice 2: the vendor columns - (number, key, header he, header en, money)
VENDOR_COLUMNS: tuple[tuple[str, str, str, str, bool], ...] = (
    ("response", "response_median_min", "חציון תגובה (דקות)", "response_median_min", False),
    ("arrival", "arrival_on_time", "הגעות בזמן", "arrival_on_time", False),
    ("arrival", "arrival_total", "ביקורים שהסתיימו", "arrival_total", False),
    ("repeat", "repeat_visits", "ביקורים חוזרים", "repeat_visits", False),
    ("repeat", "repeat_base", "בסיס לביקורים חוזרים", "repeat_base", False),
    ("quote", "quote_kept", "לפי ההצעה", "quote_kept", True),
    ("quote", "quote_base", "בסיס להצעות", "quote_base", True),
    ("quote", "quote_overshoot_median_bp", "חריגה חציונית (נקודות בסיס)", "quote_overshoot_median_bp", True),
)


class RangeError(ValueError):
    def __init__(self, field: str, code: str):
        super().__init__(f"{field}:{code}")
        self.field, self.code = field, code


def parse_range(raw_from: str | None, raw_to: str | None, tzname: str) -> tuple[dt.date, dt.date, str, str]:
    """(first day, last day, UTC instant of the first day's start, UTC instant of the last day's end) - both days required, inclusive."""
    tz = zone(tzname)
    days: list[dt.date] = []
    for field, raw in (("from", raw_from), ("to", raw_to)):
        if not raw:
            raise RangeError(field, "required")
        try:
            days.append(dt.date.fromisoformat(raw))
        except ValueError:
            raise RangeError(field, "format") from None
    d_from, d_to = days
    if d_from > d_to:
        raise RangeError("to", "before_from")
    if (d_to - d_from).days + 1 > MAX_DAYS:
        raise RangeError("to", "range_too_long")
    start = dt.datetime.combine(d_from, dt.time.min, tzinfo=tz)
    end = dt.datetime.combine(d_to + dt.timedelta(days=1), dt.time.min, tzinfo=tz) - dt.timedelta(seconds=1)
    return d_from, d_to, iso_utc(start), iso_utc(end)


def vendor_columns(conn: sqlite3.Connection, viewer: Any) -> dict[str, Any] | None:
    """The vendor columns the caller gets, or None: `{"money": bool}` - the card is readable (vendor_stats.card_permission or
    tickets.directory), the switch and the CSV columns are on."""
    from . import vendor_marks, vendor_stats

    c = vendor_stats.cfg(conn)
    if not c["csv_columns"] or not vendor_marks.may_read_stats(viewer, conn):
        return None
    return {"money": c["money_permission"] in viewer.anywhere}


def _month_window(month: str, tz: Any, start: str, end: str) -> tuple[str, str]:
    """[since, until) of one 'YYYY-MM' line in UTC instants, cut to the report range [start, end] (both inclusive instants)."""
    y, m = int(month[:4]), int(month[5:7])
    first = dt.datetime(y, m, 1, tzinfo=tz)
    nxt = dt.datetime(y + (m == 12), m % 12 + 1, 1, tzinfo=tz)
    since = max(first.astimezone(dt.timezone.utc), parse_utc(start))
    until = min(nxt.astimezone(dt.timezone.utc), parse_utc(end) + dt.timedelta(seconds=1))
    return iso_utc(since), iso_utc(until)


def build(conn: sqlite3.Connection, rows: list[Seen], group: str, lang: str = "he", *, vendor: dict[str, Any] | None = None,
          window: tuple[str, str] | None = None) -> list[list[Any]]:
    """Header + one line per (month, department | vendor), months ascending, names in order; every cell formula-guarded. `vendor` (the
    result of vendor_columns) and `window` (the report range as UTC instants) add the card columns to the vendor group."""
    lang = lang if lang in HEADERS else "he"
    tz = zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")
    lk = present.Lookups(conn)
    counts: dict[tuple[str, str], list[int]] = defaultdict(lambda: [0, 0])
    contact_of: dict[tuple[str, str], str] = {}
    for seen in rows:
        row = seen.row
        active = False
        try:
            month = parse_utc(row["created_at"]).astimezone(tz).strftime("%Y-%m")
        except (ValueError, KeyError, TypeError):
            continue
        if group == "department":
            name = ((lk.department(row.get("department_id")) or {}).get("name")) or ""
        else:
            active = bool(row.get("current_assignment_id") and not row.get("asg_ended_at"))
            name = (row.get("asg_name") or "") if active and row.get("asg_kind") == "contact" else NO_VENDOR[lang]
        cell = counts[(month, name)]
        if group == "vendor" and active and row.get("asg_kind") == "contact" and row.get("asg_contact_id"):
            contact_of.setdefault((month, name), row["asg_contact_id"])
        cell[0] += 1
        if row.get("status") in CLOSED:
            cell[1] += 1
    head = [csv_cell(naming.render_for(conn, h, lang)) for h in HEADERS[lang][group]]
    cols = _wanted_columns(conn, vendor) if group == "vendor" and vendor is not None and window is not None else []
    lines = sorted(counts.items())
    if not cols:
        return [head] + [[csv_cell(m), csv_cell(n), a, c] for (m, n), (a, c) in lines]
    head += [csv_cell(col[3] if lang == "en" else col[2]) for col in cols]
    out = [head]
    for (m, n), (a, c) in lines:
        out.append([csv_cell(m), csv_cell(n), a, c] + _card_cells(conn, contact_of.get((m, n)), _month_window(m, tz, *window), cols, vendor["money"]))
    return out


def _wanted_columns(conn: sqlite3.Connection, vendor: dict[str, Any]) -> list[tuple[str, str, str, str, bool]]:
    from . import vendor_stats

    shown = set(vendor_stats.cfg(conn)["numbers"])
    return [col for col in VENDOR_COLUMNS if col[0] in shown and (vendor["money"] or not col[4])]


def _card_cells(conn: sqlite3.Connection, contact_id: str | None, window: tuple[str, str], cols: list[tuple[str, str, str, str, bool]], money: bool) -> list[Any]:
    """The cells of one line: empty for a line that gets no card or whose base is empty; plain integers otherwise."""
    from . import vendor_stats

    blank: list[Any] = [""] * len(cols)
    if not contact_id:
        return blank
    try:
        numbers = vendor_stats.card_between(conn, contact_id, since=window[0], until=window[1], money=money)["numbers"]
    except vendor_stats.NoCard:
        return blank
    return [_pick(numbers, key) for _num, key, _he, _en, _m in cols]


def _pick(numbers: dict[str, Any], key: str) -> Any:
    r, a, p, q = numbers.get("response") or {}, numbers.get("arrival") or {}, numbers.get("repeat") or {}, numbers.get("quote") or {}
    table = {"response_median_min": r.get("median_min"), "arrival_on_time": a.get("on_time") if a.get("base") else None, "arrival_total": a.get("base") or None,
             "repeat_visits": p.get("count") if p.get("base") else None, "repeat_base": p.get("base") or None,
             "quote_kept": q.get("kept") if q.get("base") else None, "quote_base": q.get("base") or None,
             "quote_overshoot_median_bp": q.get("overshoot_median_bp")}
    v = table.get(key)
    return "" if v is None else v


def filename(conn: sqlite3.Connection, group: str, d_from: dt.date, d_to: dt.date) -> str:
    return f"tickets-monthly-{group}-{d_from:%Y%m%d}-{d_to:%Y%m%d}.csv"
