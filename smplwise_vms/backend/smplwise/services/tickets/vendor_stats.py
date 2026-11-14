"""CR-SVC215 slice 1 (docs/changes/CR-SVC215.md section 2; owner answers 2026-10-24 items 28 and 30): the computed vendor card - six
numbers, each with the count behind it, NEVER a score, a ranking or a grade. A read model: computed on request, never stored.

    response   median minutes from the assignment to the vendor's first signal (the first open of his link, the first thing he did
               through it, or the acknowledgement), wall clock; with its base (the assignments that had a signal)
    arrival    visits that reached `arrived` on time, of the visits that ended (arrived or missed) - the vendor's own declaration counts
               (owner answer 31); empty while no visit ended
    repeat     of the requests the vendor brought to "done" in the window, those reopened within `vendor_stats.repeat_days` (30), or
               followed within it by a new request on the SAME device assigned to the same vendor
    quote      MONEY: of the approved demands that named a quote basis, those at or below the basis, and the median overshoot of the
               others (basis points) - only for the money permission (`vendor_stats.money_permission`, default tickets.costs.view);
               the field is absent otherwise, never null
    returned   assignments the vendor gave back (cannot_handle / not_mine) of his assignments in the window
    volume     requests brought to done in the window, and the requests open with him now

The unit is the vendor COMPANY (a technician's events count for his `vendor_id`); a person without a vendor is a business of one. An
employee row, a row naming an Arx user and an erased row never get a card (the uniform 404 of the directory). Which numbers are shown is
`vendor_stats.numbers` (owner answer 28: editable); the window chips are 3 / 12 / 36 months (default `vendor_stats.default_months`)."""
from __future__ import annotations

import datetime as dt
import json
import statistics
from typing import Any

from . import settings_doc, store_vendor_stats as sv

UTC = dt.timezone.utc
MONTHS = (3, 12, 36)


class NoCard(Exception):
    """The contact gets no card (unknown, erased, an employee or an Arx user): the caller answers the uniform 404."""


def cfg(conn) -> dict[str, Any]:
    return settings_doc.read(conn)["vendor_stats"]


def _iso(v: dt.datetime) -> str:
    return v.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse(s: Any) -> dt.datetime | None:
    if not s or not isinstance(s, str):
        return None
    try:
        v = dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    return (v if v.tzinfo else v.replace(tzinfo=UTC)).astimezone(UTC)


def unit_of(conn, contact_id: str) -> tuple[dict[str, Any], str]:
    c = sv.contact(conn, contact_id)
    if c is None or c.get("erased_at") or c.get("employee") or c.get("user_id"):
        raise NoCard()
    unit = c["vendor_id"] if c["kind"] == "person" and c.get("vendor_id") else c["id"]
    if unit != c["id"]:
        root = sv.contact(conn, unit)
        if root is None or root.get("erased_at"):
            raise NoCard()
    return c, unit


def _months_back(now: dt.datetime, months: int) -> dt.datetime:
    m = now.month - 1 - months
    year, month = now.year + m // 12, m % 12 + 1
    day = min(now.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return now.replace(year=year, month=month, day=day)


def compute(conn, contact_id: str, *, months: int, now: dt.datetime, money: bool, only: set[str] | None = None) -> dict[str, Any]:
    """The card of the contact's unit over the last `months` months up to `now`. Raises NoCard. `only` narrows the numbers (the strip of
    the quote comparison, slice 2); the shown set of the settings still applies."""
    if months not in MONTHS:
        raise ValueError("months")
    since, until = _iso(_months_back(now, months)), _iso(now + dt.timedelta(seconds=1))
    out = card_between(conn, contact_id, since=since, until=until, money=money, only=only)
    out["months"], out["to"] = months, _iso(now)
    return out


def card_between(conn, contact_id: str, *, since: str, until: str, money: bool, only: set[str] | None = None) -> dict[str, Any]:
    """The card over [since, until) (UTC ISO instants) - the window of `compute` or of one line of the monthly CSV (slice 2). Raises NoCard."""
    c = cfg(conn)
    _contact, unit = unit_of(conn, contact_id)
    ids = sv.unit_contact_ids(conn, unit)
    asg = sv.assignments(conn, ids, since, until)
    shown = set(c["numbers"]) if only is None else set(c["numbers"]) & only
    numbers: dict[str, Any] = {}
    if "response" in shown:
        numbers["response"] = _response(conn, asg)
    if "arrival" in shown:
        numbers["arrival"] = _arrival(conn, unit, since, until)
    done = sv.done_events(conn, [a["id"] for a in asg], since, until) if shown & {"repeat", "volume"} else []
    if "repeat" in shown:
        numbers["repeat"] = _repeat(conn, done, ids, int(c["repeat_days"]))
    if "quote" in shown and money:
        numbers["quote"] = _quote(conn, ids, since, until)
    if "returned" in shown:
        ret = sum(1 for a in asg if a.get("return_kind"))
        numbers["returned"] = {"count": ret, "base": len(asg), "share_bp": (ret * 10000 // len(asg)) if asg else None}
    if "volume" in shown:
        numbers["volume"] = {"done": len(done), "open_now": sv.open_now(conn, ids)}
    return {"contact_id": contact_id, "unit_id": unit, "from": since, "to": until, "numbers": numbers,
            "shown": [k for k in settings_doc.STAT_NUMBERS if k in shown and (k != "quote" or money)]}


# ---------------------------------------------------------------- the list behind a number (slice 2)

# metric -> (the card number it explains, whether it needs the money permission)
METRICS: dict[str, tuple[str, bool]] = {
    "response": ("response", False), "on_time": ("arrival", False), "late": ("arrival", False), "missed": ("arrival", False),
    "repeat": ("repeat", False), "kept": ("quote", True), "overshoot": ("quote", True), "returned": ("returned", False),
    "done": ("volume", False), "open": ("volume", False),
}


class MetricHidden(Exception):
    """The number behind the metric is switched off in `vendor_stats.numbers`."""


class MoneyNeeded(Exception):
    """A money metric asked for without the money permission."""


def tickets_behind(conn, contact_id: str, metric: str, *, months: int, now: dt.datetime, money: bool) -> list[dict[str, Any]]:
    """The requests that make up one number of the card, newest first, one row per request: {ticket_id, at, detail}. The caller filters
    by the ticket visibility and cuts the list - this function knows nothing of the viewer. Raises NoCard, MetricHidden, MoneyNeeded."""
    number, needs_money = METRICS[metric]
    if needs_money and not money:
        raise MoneyNeeded(metric)
    c = cfg(conn)
    if number not in c["numbers"]:
        raise MetricHidden(metric)
    _contact, unit = unit_of(conn, contact_id)
    since, until = _iso(_months_back(now, months)), _iso(now + dt.timedelta(seconds=1))
    ids = sv.unit_contact_ids(conn, unit)
    rows: list[dict[str, Any]] = []
    if metric in ("on_time", "late", "missed"):
        for v in sv.visits(conn, unit, since, until):
            if v["state"] == "missed":
                kind = "missed"
            elif v["state"] == "arrived":
                kind = "late" if v.get("late") else "on_time"
            else:
                continue
            if kind == metric:
                rows.append({"ticket_id": v["ticket_id"], "at": v["planned_from"], "detail": {"visit_id": v["id"]}})
    elif metric in ("response", "returned", "done", "repeat"):
        asg = sv.assignments(conn, ids, since, until)
        if metric == "response":
            signals = sv.first_link_signals(conn, [a["id"] for a in asg])
            for a in asg:
                start = _parse(a["assigned_at"])
                cands = [t for t in (_parse(signals.get(a["id"])), _parse(a.get("acknowledged_at"))) if t is not None]
                if start is not None and cands:
                    mins = int(round(max(0.0, (min(cands) - start).total_seconds() / 60.0)))
                    rows.append({"ticket_id": a["ticket_id"], "at": a["assigned_at"], "detail": {"minutes": mins}})
        elif metric == "returned":
            rows = [{"ticket_id": a["ticket_id"], "at": a["assigned_at"], "detail": {"kind": a["return_kind"]}} for a in asg if a.get("return_kind")]
        else:
            done = sv.done_events(conn, [a["id"] for a in asg], since, until)
            if metric == "repeat":
                days = int(c["repeat_days"])
                rows = [{"ticket_id": d["ticket_id"], "at": d["at"], "detail": {"days": days}} for d in _repeat_matches(conn, done, ids, days)]
            else:
                rows = [{"ticket_id": d["ticket_id"], "at": d["at"], "detail": {}} for d in done]
    elif metric == "open":
        rows = [{"ticket_id": r["ticket_id"], "at": r["at"], "detail": {}} for r in sv.open_tickets(conn, ids)]
    else:  # kept / overshoot
        for r in sv.settled_claims_with_basis(conn, ids, since, until):
            basis = _basis(r)
            if basis is None:
                continue
            total = int(r["total_minor"])
            over = total > basis
            if (metric == "overshoot") == over:
                rows.append({"ticket_id": r["ticket_id"], "at": r.get("approved_at") or "",
                             "detail": {"basis_minor": basis, "total_minor": total, "currency": r["currency"],
                                        "overshoot_bp": ((total - basis) * 10000 // basis) if over else 0}})
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for r in sorted(rows, key=lambda x: x["at"] or "", reverse=True):
        if r["ticket_id"] in seen:
            continue
        seen.add(r["ticket_id"])
        out.append(r)
    return out


def _response(conn, asg: list[dict[str, Any]]) -> dict[str, Any]:
    signals = sv.first_link_signals(conn, [a["id"] for a in asg])
    mins: list[float] = []
    for a in asg:
        start = _parse(a["assigned_at"])
        cands = [t for t in (_parse(signals.get(a["id"])), _parse(a.get("acknowledged_at"))) if t is not None]
        if start is None or not cands:
            continue
        mins.append(max(0.0, (min(cands) - start).total_seconds() / 60.0))
    return {"median_min": int(round(statistics.median(mins))) if mins else None, "base": len(mins), "assignments": len(asg), "clock": "wall"}


def _arrival(conn, unit: str, since: str, until: str) -> dict[str, Any]:
    ended = [v for v in sv.visits(conn, unit, since, until) if v["state"] in ("arrived", "missed")]
    on_time = sum(1 for v in ended if v["state"] == "arrived" and not v.get("late"))
    late = sum(1 for v in ended if v["state"] == "arrived" and v.get("late"))
    return {"on_time": on_time, "late": late, "missed": len(ended) - on_time - late, "base": len(ended),
            "share_bp": (on_time * 10000 // len(ended)) if ended else None}


def _repeat_matches(conn, done: list[dict[str, Any]], ids: list[str], days: int) -> list[dict[str, Any]]:
    out = []
    for d in done:
        at = _parse(d["at"])
        if at is None:
            continue
        end = _iso(at + dt.timedelta(days=days))
        if sv.reopened_between(conn, d["ticket_id"], d["at"], end) or sv.same_device_followup(conn, d["ticket_id"], d.get("entity_id") or "", ids, d["at"], end):
            out.append(d)
    return out


def _repeat(conn, done: list[dict[str, Any]], ids: list[str], days: int) -> dict[str, Any]:
    count = len(_repeat_matches(conn, done, ids, days))
    return {"count": count, "base": len(done), "share_bp": (count * 10000 // len(done)) if done else None, "days": days}


def _basis(r: dict[str, Any]) -> int | None:
    try:
        b = json.loads(r["basis_json"] or "null")
    except (ValueError, TypeError):
        return None
    if not isinstance(b, dict) or not isinstance(b.get("basis_minor"), int) or b["basis_minor"] <= 0:
        return None
    return int(b["basis_minor"])


def _quote(conn, ids: list[str], since: str, until: str) -> dict[str, Any]:
    kept, over_bp, base = 0, [], 0
    for r in sv.settled_claims_with_basis(conn, ids, since, until):
        basis = _basis(r)
        if basis is None:
            continue
        base += 1
        total = int(r["total_minor"])
        if total <= basis:
            kept += 1
        else:
            over_bp.append((total - basis) * 10000 // basis)
    return {"kept": kept, "base": base, "share_bp": (kept * 10000 // base) if base else None,
            "overshoot_median_bp": int(statistics.median(over_bp)) if over_bp else None}
