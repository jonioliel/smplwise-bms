"""CR-038 section 18A backlog item: monthly ticket counts per department or per vendor, as CSV.

The counted rows are the caller's VISIBLE set (access.visible_export_rows: every row through visible(); the same 5,000-row cap as the
table export -> 413 `export_too_large`) created inside a REQUIRED date range of at most MAX_DAYS days. Months are cut in the
installation zone (`time.zone`). A "vendor" is the contact (external handler) of the ticket's current assignment; tickets without one
are counted under one "no external vendor" line so the lines add up to the total. The file is UTF-8 with a BOM, every cell goes
through the shared formula guard (text_hygiene.csv_cell) and carries only names and counts - never a phone, a note or a link."""
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


def build(conn: sqlite3.Connection, rows: list[Seen], group: str, lang: str = "he") -> list[list[Any]]:
    """Header + one line per (month, department | vendor), months ascending, names in order; every cell formula-guarded."""
    lang = lang if lang in HEADERS else "he"
    tz = zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")
    lk = present.Lookups(conn)
    counts: dict[tuple[str, str], list[int]] = defaultdict(lambda: [0, 0])
    for seen in rows:
        row = seen.row
        try:
            month = parse_utc(row["created_at"]).astimezone(tz).strftime("%Y-%m")
        except (ValueError, KeyError, TypeError):
            continue
        if group == "department":
            name = ((lk.department(row.get("department_id")) or {}).get("name")) or ""
        else:
            active = row.get("current_assignment_id") and not row.get("asg_ended_at")
            name = (row.get("asg_name") or "") if active and row.get("asg_kind") == "contact" else NO_VENDOR[lang]
        cell = counts[(month, name)]
        cell[0] += 1
        if row.get("status") in CLOSED:
            cell[1] += 1
    head = [csv_cell(naming.render_for(conn, h, lang)) for h in HEADERS[lang][group]]
    return [head] + [[csv_cell(m), csv_cell(n), a, c] for (m, n), (a, c) in sorted(counts.items())]


def filename(conn: sqlite3.Connection, group: str, d_from: dt.date, d_to: dt.date) -> str:
    return f"tickets-monthly-{group}-{d_from:%Y%m%d}-{d_to:%Y%m%d}.csv"
