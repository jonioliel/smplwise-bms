"""CR-038 slice 6b (D24, section 13.6): the CSV export of the board table.

The rows are the caller's VISIBLE set for the table's filter and sort (access.visible_export_rows: every row through visible()), at
most 5,000 (more -> 413 `export_too_large`); only the table's columns - never a phone number, an internal note or a link; UTF-8 with a
BOM (Excel and Hebrew), every cell quoted, CRLF; times in the installation's zone (`time.zone`); every cell through the shared
formula guard (text_hygiene.csv_cell: a cell starting with = + - @, a tab or a line break is prefixed with an apostrophe).
Column headers name the module with its configured name (D33). Columns a limited viewer may not see (stuck reason, SLA) are blank
on their rows, exactly as on the screen."""
from __future__ import annotations

import csv
import datetime as dt
import io
import sqlite3
import threading
import time
from typing import Any, Iterator

from ...db import get_setting
from .text_hygiene import csv_cell
from ..timeutil import parse_utc, zone
from . import naming, present, store, table_present
from .access import Seen, Viewer

RATE_S = 60.0  # one export per minute per user
_last: dict[str, float] = {}
_lock = threading.Lock()

HEADERS: dict[str, dict[str, str]] = {
    "he": {"number": "מס׳ {ticket}", "title": "כותרת", "department": "מחלקה", "priority": "עדיפות", "status": "מצב", "assignee": "מטפל",
           "place": "מיקום", "device": "התקן", "created": "נפתח", "activity": "עדכון אחרון", "stuck": "סיבת תקיעה", "sla": "יעד זמן",
           "cost": "עלות", "cost_status": "סטטוס עלות"},
    "en": {"number": "{ticket} no.", "title": "Title", "department": "Department", "priority": "Priority", "status": "State", "assignee": "Handler",
           "place": "Location", "device": "Device", "created": "Opened", "activity": "Last update", "stuck": "Stuck reason", "sla": "Due",
           "cost": "Cost", "cost_status": "Cost status"},
}
STATUS_TEXT: dict[str, dict[str, str]] = {
    "he": {"new": "חדש", "assigned": "שויך", "acknowledged": "התקבל", "in_progress": "בטיפול", "waiting_part": "ממתין לחלק", "done": "הסתיים",
           "returned": "הוחזר", "closed": "סגור", "cancelled": "בוטל"},
    "en": {"new": "New", "assigned": "Assigned", "acknowledged": "Accepted", "in_progress": "In progress", "waiting_part": "Waiting for a part",
           "done": "Done", "returned": "Returned", "closed": "Closed", "cancelled": "Cancelled"},
}
STUCK_TEXT: dict[str, dict[str, str]] = {
    "he": {"unassigned": "ללא מטפל", "unopened": "הקישור לא נפתח", "ack": "לא אושרה קבלה", "stuck": "אין עדכון", "waiting": "ממתין לחלק זמן רב",
           "overdue": "חריגה מיעד"},
    "en": {"unassigned": "Unassigned", "unopened": "Link not opened", "ack": "Not acknowledged", "stuck": "No update", "waiting": "Waiting too long",
           "overdue": "Overdue"},
}
OVERDUE_TEXT = {"he": "חריגה", "en": "overdue"}
COST_STATUS_TEXT: dict[str, dict[str, str]] = {  # slice 9
    "he": {"not_required": "", "awaiting": "ממתין לדרישת עלות", "submitted": "הוגשה", "rejected": "נדחתה", "approved": "אושרה", "paid": "שולמה"},
    "en": {"not_required": "", "awaiting": "Awaiting claim", "submitted": "Submitted", "rejected": "Rejected", "approved": "Approved", "paid": "Paid"},
}


def _cost_text(cost: dict[str, Any] | None) -> str:
    if not cost:
        return ""
    from .money import format_minor

    return f"{format_minor(int(cost['total_minor']))} {cost.get('currency') or ''}".strip()


def rate_check(user_id: str, now: float | None = None) -> float:
    """Seconds the user must still wait (0 = may export now). Only a successful export counts (`mark`)."""
    now = time.monotonic() if now is None else now
    with _lock:
        last = _last.get(user_id)
    return 0.0 if last is None else max(0.0, RATE_S - (now - last))


def mark(user_id: str, now: float | None = None) -> None:
    with _lock:
        _last[user_id] = time.monotonic() if now is None else now


def reset_rate() -> None:
    """Tests only."""
    with _lock:
        _last.clear()


def _local(iso: str | None, tz) -> str:
    if not iso:
        return ""
    try:
        return parse_utc(iso).astimezone(tz).strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return ""


def cell_values(conn: sqlite3.Connection, viewer: Viewer, seen: Seen, lk: present.Lookups, last: dict[str, str], tz, lang: str,
                now: dt.datetime) -> dict[str, str]:
    row = table_present.table_row(conn, viewer, seen, lk, last, now)
    assignee = (row.get("assignee") or {}).get("name") or ""
    stuck = row.get("stuck")
    sla = row.get("sla")
    return {
        "number": str(row["number"]),
        "title": row["title"],
        "department": (row.get("department") or {}).get("name") or "",
        "priority": (row.get("priority") or {}).get("name") or "",
        "status": STATUS_TEXT[lang].get(row["status"], row["status"]),
        "assignee": assignee,
        "place": row.get("place_text") or "",
        "device": row.get("device_name") or "",
        "created": _local(row.get("created_at"), tz),
        "activity": _local(row.get("last_activity_at"), tz),
        "stuck": STUCK_TEXT[lang].get(stuck["kind"], stuck["kind"]) if stuck else "",
        "sla": (f"{_local(sla['due_at'], tz)}{' · ' + OVERDUE_TEXT[lang] if sla['overdue'] else ''}") if sla else "",
        "cost": _cost_text(row.get("cost")),
        "cost_status": COST_STATUS_TEXT[lang].get(row.get("cost_status") or "", "") if row.get("cost_status") else "",
    }


def build(conn: sqlite3.Connection, viewer: Viewer, rows: list[Seen], columns: tuple[str, ...], lang: str = "he") -> list[list[str]]:
    """Header + one list of cells per row (formula-guarded), in memory: the request's database work ends before the body is sent."""
    lang = lang if lang in HEADERS else "he"
    tz = zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")
    lk = present.Lookups(conn)
    last = store.last_assignee_names(conn, [s.row["id"] for s in rows if not s.row.get("current_assignment_id")])
    now = dt.datetime.now(dt.timezone.utc)
    out = [[csv_cell(naming.render_for(conn, HEADERS[lang][c], lang)) for c in columns]]
    for seen in rows:
        values = cell_values(conn, viewer, seen, lk, last, tz, lang, now)
        out.append([csv_cell(values[c]) for c in columns])
    return out


def stream(cells: list[list[str]]) -> Iterator[bytes]:
    """The CSV body in chunks of 200 rows (UTF-8 with a BOM, every cell quoted, CRLF)."""
    yield "﻿".encode("utf-8")
    for i in range(0, len(cells), 200):
        buf = io.StringIO(newline="")
        writer = csv.writer(buf, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
        writer.writerows(cells[i:i + 200])
        yield buf.getvalue().encode("utf-8")


def filename(conn: sqlite3.Connection, lang: str = "he") -> str:
    """An ASCII file name (the module's internal id - the display name may be any script)."""
    stamp = dt.datetime.now(zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")).strftime("%Y%m%d-%H%M")
    return f"tickets-{stamp}.csv"


def describe(query: Any, columns: tuple[str, ...]) -> dict[str, Any]:
    """The audit details of an export: the filter and the columns (never a row)."""
    return {"filters": query.filters.as_dict(), "sort": query.sort_text, "columns": list(columns)}
