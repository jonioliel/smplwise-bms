"""CR-038 slice 9, section 11A.9: the cost report and its CSV export.

    GET /tickets/costs/report?group_by=vendor|department|device|room|month&from=&to=&status=&currency=
    GET /tickets/costs/export.csv?<same filters>&rows=claim|line

- Sums are PER CURRENCY (never summed across currencies, no FX), in integer minor units: approved (approved + paid) and
  submitted-pending (submitted); counts of tickets and claims; per-kind totals (labor, parts, travel, other).
- The period is the approval date for approved / paid claims and the submission date of the current revision otherwise; `from` /
  `to` are local dates (the installation's zone), `to` inclusive.
- Every row passes the visibility rule: the claim's ticket through access.visible() (members' full view) AND tickets.costs.view
  on its place. A claim whose ticket was purged (ticket_id NULL, 11A.11) is reported only to a caller holding tickets.costs.view
  and tickets.all_departments at installation scope.
- The CSV follows the table export's rules (13.6): at most 5,000 rows, one export a minute per user, UTF-8 with a BOM, every cell
  through the formula guard, times in the installation zone, amounts as plain decimals with a separate currency column; never a
  phone number, an internal note or a file."""
from __future__ import annotations

import csv
import datetime as dt
import io
import json
import threading
import time
from dataclasses import dataclass
from typing import Any, Iterator

from ...db import get_setting
from ..timeutil import parse_utc, zone
from . import access, money, store_costs
from .access import Viewer
from .costs import COSTS_VIEW
from .text_hygiene import csv_cell

GROUPS: tuple[str, ...] = ("vendor", "department", "device", "room", "month")
STATUSES: tuple[str, ...] = ("submitted", "approved", "paid")
EXPORT_MAX_ROWS = 5000
RATE_S = 60.0
_last: dict[str, float] = {}
_lock = threading.Lock()


class ReportError(ValueError):
    def __init__(self, field: str, code: str = "invalid") -> None:
        super().__init__(f"{field}:{code}")
        self.field = field
        self.code = code


@dataclass(frozen=True)
class Filters:
    group_by: str = "vendor"
    date_from: str | None = None  # UTC instant (start of the local day)
    date_to: str | None = None  # UTC instant (start of the day AFTER the local `to`)
    statuses: tuple[str, ...] = STATUSES
    currency: str | None = None


def parse_filters(conn, *, group_by: str, date_from: str | None, date_to: str | None, status: str | None, currency: str | None) -> Filters:
    if group_by not in GROUPS:
        raise ReportError("group_by")
    tz = zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")

    def day(value: str | None, field: str, plus: int = 0) -> str | None:
        if not value:
            return None
        try:
            d = dt.date.fromisoformat(value)
        except ValueError:
            raise ReportError(field, "date") from None
        local = dt.datetime.combine(d + dt.timedelta(days=plus), dt.time(0, 0), tzinfo=tz)
        return local.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    statuses = STATUSES
    if status:
        statuses = tuple(dict.fromkeys(s.strip() for s in status.split(",") if s.strip()))
        if not statuses or any(s not in STATUSES for s in statuses):
            raise ReportError("status")
    if currency is not None and currency not in money.CURRENCIES:
        raise ReportError("currency")
    f, t = day(date_from, "from"), day(date_to, "to", plus=1)
    if f and t and f >= t:
        raise ReportError("to", "before_from")
    return Filters(group_by=group_by, date_from=f, date_to=t, statuses=statuses, currency=currency)


class _Gate:
    """Visibility per ticket, asked once per ticket."""

    def __init__(self, viewer: Viewer) -> None:
        self.viewer = viewer
        self._cache: dict[str, dict[str, Any] | None] = {}
        self._orphans: bool | None = None

    def ticket(self, ticket_id: str | None) -> dict[str, Any] | None | bool:
        """The visible ticket row, False when invisible; None for a claim of a purged ticket the caller may see."""
        if not ticket_id:
            if self._orphans is None:
                v = self.viewer
                self._orphans = v.holds_installation(COSTS_VIEW) and v.holds_installation(access.ALL_DEPARTMENTS)
            return None if self._orphans else False
        if ticket_id not in self._cache:
            seen = access.visible_by_id(self.viewer, ticket_id)
            ok = seen is not None and seen.full and self.viewer.holds(COSTS_VIEW, seen.row)
            self._cache[ticket_id] = seen.row if ok else None
        row = self._cache[ticket_id]
        return row if row is not None else False


def visible_rows(conn, viewer: Viewer, f: Filters) -> list[dict[str, Any]]:
    gate = _Gate(viewer)
    out: list[dict[str, Any]] = []
    for r in store_costs.report_rows(conn, date_from=f.date_from, date_to=f.date_to, statuses=f.statuses, currency=f.currency):
        t = gate.ticket(r["ticket_id"])
        if t is False:
            continue
        try:
            snap = json.loads(r.get("snapshot_json") or "{}")
        except ValueError:
            snap = {}
        r["snapshot"] = snap if isinstance(snap, dict) else {}
        r["ticket"] = t
        out.append(r)
    return out


def _local_month(iso: str | None, tz) -> str:
    if not iso:
        return ""
    try:
        return parse_utc(iso).astimezone(tz).strftime("%Y-%m")
    except ValueError:
        return ""


def _group_key(r: dict[str, Any], group_by: str, tz) -> tuple[str, str]:
    snap, t = r["snapshot"], (r["ticket"] or {})
    if group_by == "vendor":
        return (snap.get("vendor_id") or r["contact_id"], snap.get("vendor") or snap.get("contact_name") or "")
    if group_by == "department":
        return (r["department_id"], snap.get("department") or "")
    if group_by == "device":
        ent = t.get("entity_id") or snap.get("entity_id") or ""
        return (ent, t.get("device_name") or snap.get("device_name") or "")
    if group_by == "room":
        z = t.get("zone_id") or snap.get("zone_id") or ""
        return (z, t.get("place_text") or snap.get("place_text") or "")
    m = _local_month(r["period_at"], tz)
    return (m, m)


def report(conn, viewer: Viewer, f: Filters) -> dict[str, Any]:
    tz = zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")
    rows = visible_rows(conn, viewer, f)
    groups: dict[tuple[str, str], dict[str, Any]] = {}
    totals: dict[str, dict[str, Any]] = {}
    for r in rows:
        key, label = _group_key(r, f.group_by, tz)
        cur = r["currency"]
        g = groups.setdefault((key, cur), {"key": key, "label": label, "currency": cur, "approved_minor": 0, "pending_minor": 0, "claims": 0,
                                           "_tickets": set(), "labor_minor": 0, "parts_minor": 0, "travel_minor": 0, "other_minor": 0})
        tot = totals.setdefault(cur, {"currency": cur, "approved_minor": 0, "pending_minor": 0, "claims": 0, "_tickets": set()})
        amount = int(r["approved_total_minor"] if r["status"] in ("approved", "paid") and r["approved_total_minor"] is not None else r["total_minor"])
        bucket = "approved_minor" if r["status"] in ("approved", "paid") else "pending_minor"
        for target in (g, tot):
            target[bucket] += amount
            target["claims"] += 1
            target["_tickets"].add(r["ticket_id"] or r["claim_id"])
        for k in ("labor_minor", "parts_minor", "travel_minor", "other_minor"):
            g[k] += int(r[k])

    def done(d: dict[str, Any]) -> dict[str, Any]:
        d = dict(d)
        d["tickets"] = len(d.pop("_tickets"))
        return d

    return {"group_by": f.group_by, "groups": sorted((done(g) for g in groups.values()), key=lambda g: (g["currency"], -g["approved_minor"] - g["pending_minor"], g["label"])),
            "totals": [done(t) for t in sorted(totals.values(), key=lambda t: t["currency"])], "claims": len(rows)}


# ---------------------------------------------------------------- CSV

HEADERS = {
    "claim": ["מס׳ {ticket}", "כותרת", "מחלקה", "ספק", "מיקום", "התקן", "מצב", "הוגש", "אושר", "שולם", "אסמכתת תשלום", "מטבע", "עבודה", "חלקים",
              "נסיעות", "אחר", "לפני מע״מ", "מע״מ", "סה״כ", "חשבונית ספק"],
    "line": ["מס׳ {ticket}", "ספק", "מצב", "מטבע", "סוג שורה", "תיאור", "כמות / שעות", "מחיר יחידה", "סכום שורה"],
}
STATUS_TEXT = {"submitted": "הוגשה", "approved": "אושרה", "paid": "שולמה"}
KIND_TEXT = {"labor": "עבודה", "parts": "חלקים", "travel": "נסיעות", "other": "אחר"}


def _local(iso: str | None, tz) -> str:
    if not iso:
        return ""
    try:
        return parse_utc(iso).astimezone(tz).strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return ""


def build_csv(conn, viewer: Viewer, f: Filters, rows_kind: str) -> list[list[Any]]:
    """Header + rows, in memory (the database work ends before the body is sent). ReportError("rows", "too_many") past 5,000."""
    from . import naming

    if rows_kind not in HEADERS:
        raise ReportError("rows")
    tz = zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")
    rows = visible_rows(conn, viewer, f)
    out: list[list[Any]] = [[csv_cell(naming.render_for(conn, h, "he")) for h in HEADERS[rows_kind]]]
    for r in rows:
        snap, t = r["snapshot"], (r["ticket"] or {})
        number = t.get("number") or snap.get("number") or ""
        vendor = snap.get("vendor") or snap.get("contact_name") or ""
        if rows_kind == "claim":
            out.append([csv_cell(v) for v in (
                str(number), t.get("title") or snap.get("title") or "", snap.get("department") or "", vendor, t.get("place_text") or snap.get("place_text") or "",
                t.get("device_name") or snap.get("device_name") or "", STATUS_TEXT.get(r["status"], r["status"]), _local(r["submitted_at"], tz),
                _local(r["approved_at"], tz), _local(r["paid_at"], tz), r.get("payment_ref") or "", r["currency"],
                money.format_minor(r["labor_minor"]), money.format_minor(r["parts_minor"]), money.format_minor(r["travel_minor"]),
                money.format_minor(r["other_minor"]), money.format_minor(int(r["total_minor"]) - int(r["vat_minor"])), money.format_minor(r["vat_minor"]),
                money.format_minor(r["total_minor"]), r.get("vendor_ref") or "")])
        else:
            try:
                lines = json.loads(r.get("lines_json") or "[]")
            except ValueError:
                lines = []
            for ln in lines if isinstance(lines, list) else []:
                qty = ln.get("hours") if ln.get("kind") == "labor" else ln.get("quantity") if ln.get("kind") == "parts" else ""
                unit = ln.get("rate_minor") if ln.get("kind") == "labor" else ln.get("unit_minor") if ln.get("kind") == "parts" else None
                out.append([csv_cell(v) for v in (str(number), vendor, STATUS_TEXT.get(r["status"], r["status"]), r["currency"],
                                                  KIND_TEXT.get(ln.get("kind"), ""), ln.get("description") or "", qty or "",
                                                  money.format_minor(int(unit)) if unit is not None else "", money.format_minor(int(ln.get("total_minor") or 0)))])
        if len(out) - 1 > EXPORT_MAX_ROWS:
            raise ReportError("rows", "too_many")
    return out


def stream(cells: list[list[Any]]) -> Iterator[bytes]:
    yield "﻿".encode("utf-8")
    for i in range(0, len(cells), 200):
        buf = io.StringIO(newline="")
        csv.writer(buf, quoting=csv.QUOTE_ALL, lineterminator="\r\n").writerows(cells[i:i + 200])
        yield buf.getvalue().encode("utf-8")


def rate_check(user_id: str, now: float | None = None) -> float:
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


def filename(conn) -> str:
    stamp = dt.datetime.now(zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")).strftime("%Y%m%d-%H%M")
    return f"ticket-costs-{stamp}.csv"

