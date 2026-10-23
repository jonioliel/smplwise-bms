"""CR-MAINT215: the pure part of the maintenance module - the closed lists, the checklist and answer validation and the date
maths (due states, the fixed schedule). No database, no clock of its own: every function takes `today` (a local date) so a test
crosses every boundary with plain dates and no sleep.

Due state of a task on `today` (D = its due date, L = its lead days):
    overdue   today > D                (a certificate / document: expired - valid THROUGH its date)
    due_soon  D - L <= today <= D
    ok        today < D - L
    none      no due date (a paused task, or a plan without a first date)

The fixed schedule: occurrence k = anchor + k x interval (months / years clamp to the month's last day, measured from the
ANCHOR every time, so 31 Jan -> 28/29 Feb -> 31 Mar never drifts to the 28th). Completing a task moves its due date to the first
occurrence strictly after max(the current due date, the completion date): doing it early never skips the next cycle, doing it
late never asks for the missed ones."""
from __future__ import annotations

import calendar
import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

KINDS = ("certificate", "preventive", "round", "vendor_document")
CATEGORIES = ("elevator", "generator", "fire", "kitchen_hood", "electrical", "pumps", "hvac", "water", "safety", "other")
DOC_TYPES = ("insurance", "electrician_license", "work_at_height", "other")
UNITS = ("day", "week", "month", "year")
ITEM_KINDS = ("check", "number", "text")
DEFAULT_LEAD = {"certificate": 30, "vendor_document": 30, "preventive": 7, "round": 0}
STATES = ("overdue", "due_soon", "ok", "none")

TITLE_MAX, NOTES_MAX, LABEL_MAX, NOTE_MAX, TEXT_ANSWER_MAX = 120, 2000, 120, 300, 300
CHECKLIST_MAX = 60
LEAD_MAX = 365
INTERVAL_MAX = 366
KEY_RE = re.compile(r"^[a-z0-9_]{1,32}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class Invalid(ValueError):
    """A field problem: `field` and a short code (the router turns it into the 422 envelope)."""

    def __init__(self, field: str, code: str) -> None:
        super().__init__(f"{field}: {code}")
        self.field = field
        self.code = code


# ---------------------------------------------------------------- text and dates

def text(value: Any, field: str, *, max_len: int, required: bool = False, multiline: bool = False) -> str:
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise Invalid(field, "type")
    value = value.strip()
    for ch in value:
        o = ord(ch)
        if (o < 32 and not (multiline and ch in "\n\t")) or o == 127 or 0x202A <= o <= 0x202E or 0x2066 <= o <= 0x2069:
            raise Invalid(field, "control_characters")
    if required and not value:
        raise Invalid(field, "required")
    if len(value) > max_len:
        raise Invalid(field, "too_long")
    return value


def parse_date(value: Any, field: str) -> date | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str) or not DATE_RE.match(value):
        raise Invalid(field, "date")
    try:
        d = date.fromisoformat(value)
    except ValueError:
        raise Invalid(field, "date") from None
    if not 2000 <= d.year <= 2200:
        raise Invalid(field, "date_range")
    return d


def iso(d: date | None) -> str | None:
    return d.isoformat() if d else None


def add_months(anchor: date, months: int) -> date:
    """`anchor` plus `months` calendar months, the day clamped to the target month's length (always measured from the anchor)."""
    y, m = divmod(anchor.month - 1 + months, 12)
    year, month = anchor.year + y, m + 1
    return date(year, month, min(anchor.day, calendar.monthrange(year, month)[1]))


def occurrence(anchor: date, unit: str, count: int, k: int) -> date:
    if unit == "day":
        return anchor + timedelta(days=count * k)
    if unit == "week":
        return anchor + timedelta(weeks=count * k)
    if unit == "month":
        return add_months(anchor, count * k)
    if unit == "year":
        return add_months(anchor, 12 * count * k)
    raise Invalid("interval_unit", "unknown")


def next_after(anchor: date, unit: str, count: int, after: date) -> date:
    """The first occurrence anchor + k x interval (k >= 0) strictly after `after`."""
    if anchor > after:
        return anchor
    if unit in ("day", "week"):
        step = count * (7 if unit == "week" else 1)
        k = (after - anchor).days // step + 1
        return anchor + timedelta(days=step * k)
    months = count * (12 if unit == "year" else 1)
    k = max(0, ((after.year - anchor.year) * 12 + (after.month - anchor.month)) // months - 1)
    while True:
        d = add_months(anchor, months * k)
        if d > after:
            return d
        k += 1


def advance(anchor: date | None, unit: str | None, count: int | None, due: date | None, done_on: date) -> date | None:
    """The due date after a completion on `done_on` (module docstring). None for a task without an interval."""
    if not unit or not count:
        return None
    base = anchor or due or done_on
    after = max(d for d in (due, done_on) if d is not None)
    return next_after(base, unit, count, after)


@dataclass(frozen=True)
class Due:
    state: str
    days_left: int | None  # negative once overdue


def due_state(due: date | None, lead_days: int, today: date, *, active: bool = True) -> Due:
    if due is None or not active:
        return Due("none", None)
    left = (due - today).days
    if left < 0:
        return Due("overdue", left)
    if left <= lead_days:
        return Due("due_soon", left)
    return Due("ok", left)


# ---------------------------------------------------------------- checklists and answers

def checklist(raw: Any) -> list[dict[str, Any]]:
    """A validated checklist: unique keys, known kinds, a number range only on a number item."""
    if raw is None:
        return []
    if not isinstance(raw, list) or len(raw) > CHECKLIST_MAX:
        raise Invalid("checklist", "too_many" if isinstance(raw, list) else "type")
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for i, item in enumerate(raw):
        f = f"checklist.{i}"
        if not isinstance(item, dict) or set(item) - {"key", "label", "kind", "required", "min", "max"}:
            raise Invalid(f, "shape")
        key = item.get("key")
        if not isinstance(key, str) or not KEY_RE.match(key) or key in seen:
            raise Invalid(f"{f}.key", "invalid" if key not in seen else "duplicate")
        seen.add(key)
        kind = item.get("kind", "check")
        if kind not in ITEM_KINDS:
            raise Invalid(f"{f}.kind", "unknown")
        row: dict[str, Any] = {"key": key, "label": text(item.get("label"), f"{f}.label", max_len=LABEL_MAX, required=True), "kind": kind,
                               "required": bool(item.get("required", True))}
        for bound in ("min", "max"):
            v = item.get(bound)
            if v is None:
                continue
            if kind != "number" or isinstance(v, bool) or not isinstance(v, (int, float)) or abs(v) > 1e9:
                raise Invalid(f"{f}.{bound}", "invalid")
            row[bound] = float(v)
        if "min" in row and "max" in row and row["min"] > row["max"]:
            raise Invalid(f"{f}.min", "range")
        out.append(row)
    return out


def answer(item: dict[str, Any], raw: Any, at: str) -> dict[str, Any]:
    """One checklist answer, judged: `ok` False on a failed check or a number outside its range."""
    f = f"answers.{item['key']}"
    if not isinstance(raw, dict) or set(raw) - {"ok", "value", "note"}:
        raise Invalid(f, "shape")
    note = text(raw.get("note"), f"{f}.note", max_len=NOTE_MAX, multiline=True)
    kind = item["kind"]
    if kind == "check":
        ok = raw.get("ok")
        if not isinstance(ok, bool):
            raise Invalid(f"{f}.ok", "required")
        return {"ok": ok, "value": None, "note": note, "at": at}
    if kind == "number":
        v = raw.get("value")
        if isinstance(v, bool) or not isinstance(v, (int, float)) or abs(v) > 1e9:
            raise Invalid(f"{f}.value", "number")
        v = float(v)
        ok = not (("min" in item and v < item["min"]) or ("max" in item and v > item["max"]))
        if isinstance(raw.get("ok"), bool) and raw["ok"] is False:
            ok = False  # a person may still mark an in-range reading as a problem
        return {"ok": ok, "value": v, "note": note, "at": at}
    value = text(raw.get("value"), f"{f}.value", max_len=TEXT_ANSWER_MAX, multiline=True)
    ok = raw.get("ok") if isinstance(raw.get("ok"), bool) else True
    return {"ok": ok, "value": value, "note": note, "at": at}


def missing_required(items: list[dict[str, Any]], answers: dict[str, Any]) -> list[str]:
    return [i["key"] for i in items if i.get("required") and i["key"] not in answers]


def result_of(answers: dict[str, Any]) -> str:
    return "issues" if any(a.get("ok") is False for a in answers.values()) else "ok"
