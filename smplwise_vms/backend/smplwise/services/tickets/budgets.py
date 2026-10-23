"""CR-SVC215 slice 1 (docs/changes/CR-SVC215.md section 6; owner answers 2026-10-24 items 33, 34, 36): budgets against approved costs.

A budget (`ticket_budgets`, migration 0155) is an amount for one scope, one period and one currency:
  scope    department (the CR's unit) | installation (the whole building) | site | building | category  (owner answer 34: "per
           department and period, plus the whole building and other cuts")
  period   year | quarter | month, `period_start` = the local first day (the installation's zone, never a fixed offset)
  money    `amount_minor` in minor units, one currency per row, never summed across currencies; `warn_bp` the warning threshold
           (default `budgets.warn_bp`, 80 %).
Consumption is computed on request (store_budgets): approved + committed against the amount -> `ok` / `warning` / `exceeded`.

The approval of a payment demand that leaves a covering budget `exceeded` shows the overrun and asks for a confirmation (`budget_confirm`
on the decision route; 409 `budget_confirm_required` with the numbers otherwise) - it is NEVER refused (owner answer 33: the invoice is
real, the budget is a management number). `budgets.require_confirmation` off = the approval only records the state. The approval's
audit row carries `budget_state`. A budget that first crosses its warning threshold / its amount notifies once (`ticket.budget_warning`
/ `ticket.budget_exceeded`, the department's managers who see the costs + tickets.configure holders when `budgets.notify_configurers`
is on); falling back (a raised amount, a deleted budget) resolves the rows.

Who: GET needs the money permission (`tickets.costs.view`); a department budget is listed to whoever sees that department (a member or
tickets.all_departments), the other scopes to tickets.all_departments / tickets.configure holders; writes need tickets.configure at the
installation (the hand that sets the cost mode). Everything is behind the module switch and `budgets.enabled` (default ON)."""
from __future__ import annotations

import datetime as dt
from typing import Any, Mapping

from ...db import get_setting
from ...errors import ApiError
from . import money, notify_bridge, settings_doc, store, store_budgets
from .access import Viewer, module_on, text

UTC = dt.timezone.utc
SCOPES = ("installation", "department", "site", "building", "category")
PERIODS = ("year", "quarter", "month")
STATES = ("ok", "warning", "exceeded")
NOTE_MAX = 200
AMOUNT_MAX = 99_999_999_999


class BudgetRefused(Exception):
    def __init__(self, status: int, code: str, field: str | None = None, **extra: Any) -> None:
        super().__init__(code)
        self.status, self.code, self.field, self.extra = status, code, field, extra


def cfg(conn) -> dict[str, Any]:
    return settings_doc.read(conn)["budgets"]


def enabled(conn) -> bool:
    return module_on(conn) and bool(cfg(conn)["enabled"])


def require_enabled(conn) -> None:
    if not enabled(conn):
        raise ApiError(404, "feature_disabled", text(conn, "תקציבים כבויים בהגדרות {the_tickets}."))


def _zone(conn) -> dt.tzinfo:
    from .stuck import _zone as zone_of

    return zone_of(get_setting(conn, "time.zone", None))


# ---------------------------------------------------------------- periods

def parse_period_start(kind: str, raw: Any) -> dt.date:
    if kind not in PERIODS:
        raise BudgetRefused(422, "invalid", "period_kind")
    try:
        d = dt.date.fromisoformat(str(raw))
    except ValueError:
        raise BudgetRefused(422, "format", "period_start") from None
    if d.day != 1 or (kind == "year" and d.month != 1) or (kind == "quarter" and d.month not in (1, 4, 7, 10)):
        raise BudgetRefused(422, "not_period_start", "period_start")
    return d


def period_end(kind: str, start: dt.date) -> dt.date:
    months = {"year": 12, "quarter": 3, "month": 1}[kind]
    m = start.month - 1 + months
    return dt.date(start.year + m // 12, m % 12 + 1, 1)


def period_of(kind: str, day: dt.date) -> dt.date:
    if kind == "year":
        return dt.date(day.year, 1, 1)
    if kind == "quarter":
        return dt.date(day.year, (day.month - 1) // 3 * 3 + 1, 1)
    return dt.date(day.year, day.month, 1)


def bounds(conn, kind: str, start: dt.date) -> tuple[str, str]:
    """The period as UTC instants [start, end) - local midnights of the installation's zone (DST-safe)."""
    tz = _zone(conn)
    a = dt.datetime.combine(start, dt.time.min, tzinfo=tz).astimezone(UTC)
    b = dt.datetime.combine(period_end(kind, start), dt.time.min, tzinfo=tz).astimezone(UTC)
    return _iso(a), _iso(b)


def _iso(v: dt.datetime) -> str:
    return v.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def contains(conn, b: Mapping[str, Any], at: dt.datetime) -> bool:
    start, end = bounds(conn, b["period_kind"], dt.date.fromisoformat(b["period_start"]))
    return start <= _iso(at) < end


# ---------------------------------------------------------------- consumption

def state_of(amount: int, used: int, warn_bp: int) -> str:
    if used > amount:
        return "exceeded"
    if used * 10000 >= amount * warn_bp:
        return "warning"
    return "ok"


def consumption(conn, b: Mapping[str, Any], *, extra_minor: int = 0) -> dict[str, Any]:
    """approved / committed / remaining / used share / state of one budget; `extra_minor` = an approval being considered."""
    start, end = bounds(conn, b["period_kind"], dt.date.fromisoformat(b["period_start"]))
    approved = store_budgets.sum_approved(conn, b["scope_kind"], b["scope_id"], b["currency"], start, end) + int(extra_minor)
    committed = store_budgets.sum_committed(conn, b["scope_kind"], b["scope_id"], b["currency"], start, end) if cfg(conn)["count_committed"] else 0
    amount = int(b["amount_minor"])
    used = approved + committed
    return {"approved_minor": approved, "committed_minor": committed, "remaining_minor": amount - used, "used_bp": used * 10000 // amount if amount else 0,
            "overrun_minor": max(0, used - amount), "state": state_of(amount, used, int(b["warn_bp"])), "from": start, "to": end}


def covering(conn, ticket: Mapping[str, Any], currency: str, at: dt.datetime) -> list[dict[str, Any]]:
    """The live budgets that a demand of this request in `currency` approved at `at` counts against."""
    scopes: list[tuple[str, str]] = [("installation", "*"), ("department", str(ticket.get("department_id") or ""))]
    for kind, col in (("site", "site_id"), ("building", "building_id"), ("category", "category_id")):
        if ticket.get(col):
            scopes.append((kind, str(ticket[col])))
    return [b for b in store_budgets.for_scopes(conn, scopes, currency) if contains(conn, b, at)]


def preview(conn, ticket: Mapping[str, Any], amount_minor: int, currency: str, at: dt.datetime) -> list[dict[str, Any]]:
    """What approving `amount_minor` now would do to each covering budget (the approval dialog's numbers - section 6.2)."""
    out = []
    for b in covering(conn, ticket, currency, at):
        before = consumption(conn, b)
        after = consumption(conn, b, extra_minor=amount_minor)
        out.append({"budget": present_row(conn, b), "before": before["state"], "after": after["state"], "overrun_minor": after["overrun_minor"],
                    "remaining_after_minor": after["remaining_minor"]})
    return out


def after_approval(conn, ticket: Mapping[str, Any], claim: Mapping[str, Any], at: dt.datetime) -> list[dict[str, Any]]:
    """Inside the approval's transaction (the claim is already approved): each covering budget with its state now."""
    if not enabled(conn) or claim.get("approved_total_minor") is None:
        return []
    out = []
    for b in covering(conn, ticket, str(claim.get("currency") or ""), at):
        c = consumption(conn, b)
        out.append({"budget": b, "state": c["state"], "overrun_minor": c["overrun_minor"], "remaining_minor": c["remaining_minor"]})
    return out


def worst(states: list[str]) -> str:
    return max(states, key=STATES.index) if states else "none"


def settle_alerts(conn, b: Mapping[str, Any], ticket_id: str | None) -> str:
    """Compare a budget's state with the last state notified: a NEW warning / exceeded notifies once (needs a request as the subject),
    a fall back resolves the higher rows. Returns the state now."""
    c = consumption(conn, b)
    state = c["state"]
    prev = b.get("alert_state") or "ok"
    if state == prev:
        return state
    if STATES.index(state) < STATES.index(prev):
        notify_bridge.budget_resolved(conn, b["id"], tuple(s for s in ("warning", "exceeded") if STATES.index(s) > STATES.index(state)))
    elif ticket_id:  # one row for the highest state reached (ok -> exceeded raises no warning row retroactively)
        notify_bridge.budget_signal(conn, ticket_id, dict(b), state, scope=scope_label(conn, b), period=period_label(b),
                                    share=f"{c['used_bp'] // 100}%", configurers=bool(cfg(conn)["notify_configurers"]))
    store_budgets.update_budget(conn, b["id"], {"alert_state": state}, bump=False)
    return state


# ---------------------------------------------------------------- labels and presentation

def scope_label(conn, b: Mapping[str, Any]) -> str:
    kind, sid = b["scope_kind"], b["scope_id"]
    if kind == "installation":
        return "כל הבניין"
    if kind == "department":
        return str((store.department_any(conn, sid) or {}).get("name") or "")
    if kind == "category":
        return str((store.category_any(conn, sid) or {}).get("name") or "")
    try:
        row = conn.execute(f"SELECT name FROM {'sites' if kind == 'site' else 'buildings'} WHERE id = ?", (sid,)).fetchone()
    except Exception:  # noqa: BLE001
        row = None
    return str(row[0]) if row else ""


def period_label(b: Mapping[str, Any]) -> str:
    d = dt.date.fromisoformat(b["period_start"])
    if b["period_kind"] == "year":
        return f"{d.year}"
    if b["period_kind"] == "quarter":
        return f"רבעון {(d.month - 1) // 3 + 1} {d.year}"
    return f"{d.month:02d}.{d.year}"


def present_row(conn, b: Mapping[str, Any], *, with_consumption: bool = False) -> dict[str, Any]:
    out: dict[str, Any] = {"id": b["id"], "scope_kind": b["scope_kind"], "scope_id": b["scope_id"], "scope_name": scope_label(conn, b),
                           "period_kind": b["period_kind"], "period_start": b["period_start"], "period_label": period_label(b),
                           "amount_minor": int(b["amount_minor"]), "currency": b["currency"], "warn_bp": int(b["warn_bp"]), "note": b.get("note") or "",
                           "revision": int(b["revision"]), "updated_at": b.get("updated_at")}
    if with_consumption:
        out.update(consumption(conn, b))
    return out


# ---------------------------------------------------------------- who may see which budget

def visible_to(viewer: Viewer, b: Mapping[str, Any]) -> bool:
    if b["scope_kind"] == "department":
        return viewer.holds("tickets.all_departments") or bool(viewer.role(b["scope_id"]))
    if b["scope_kind"] == "category":
        dept = store_budgets.category_department(viewer.conn, b["scope_id"])
        return viewer.holds("tickets.all_departments") or bool(dept and viewer.role(dept))
    return viewer.holds("tickets.all_departments") or viewer.holds_installation("tickets.configure")


# ---------------------------------------------------------------- writes (tickets.configure, checked by the router)

def _clean_note(v: Any) -> str:
    from .text_hygiene import clean_text

    if v is None:
        return ""
    if not isinstance(v, str):
        raise BudgetRefused(422, "type", "note")
    t = clean_text(v)
    if len(t) > NOTE_MAX:
        raise BudgetRefused(422, "too_long", "note")
    return t


def _amount(v: Any) -> int:
    if isinstance(v, bool) or not isinstance(v, int) or not 1 <= v <= AMOUNT_MAX:
        raise BudgetRefused(422, "range", "amount_minor")
    return v


def _warn(conn, v: Any) -> int:
    if v is None:
        return int(cfg(conn)["warn_bp"])
    if isinstance(v, bool) or not isinstance(v, int) or not 1 <= v <= 10000:
        raise BudgetRefused(422, "range", "warn_bp")
    return v


def create(conn, body: Mapping[str, Any], *, by: str) -> dict[str, Any]:
    kind = body.get("scope_kind")
    if kind not in SCOPES:
        raise BudgetRefused(422, "invalid", "scope_kind")
    sid = "*" if kind == "installation" else body.get("scope_id")
    if not isinstance(sid, str) or not store_budgets.scope_exists(conn, kind, sid):
        raise BudgetRefused(422, "unknown", "scope_id")
    pk = body.get("period_kind")
    start = parse_period_start(str(pk), body.get("period_start"))
    cur = body.get("currency")
    if not isinstance(cur, str) or cur not in money.CURRENCIES:
        raise BudgetRefused(422, "invalid", "currency")
    if store_budgets.exists(conn, kind, sid, str(pk), start.isoformat(), cur):
        raise BudgetRefused(409, "budget_exists")
    b = store_budgets.insert_budget(conn, {"scope_kind": kind, "scope_id": sid, "period_kind": pk, "period_start": start.isoformat(),
                                           "amount_minor": _amount(body.get("amount_minor")), "currency": cur, "warn_bp": _warn(conn, body.get("warn_bp")),
                                           "note": _clean_note(body.get("note")), "created_by": by, "updated_by": by})
    state = consumption(conn, b)["state"]  # a new budget starts from the state it is in: nothing is notified retroactively
    store_budgets.update_budget(conn, b["id"], {"alert_state": state}, bump=False)
    return store_budgets.budget(conn, b["id"]) or b


def update(conn, b: Mapping[str, Any], body: Mapping[str, Any], *, by: str) -> tuple[dict[str, Any], list[str]]:
    fields: dict[str, Any] = {"updated_by": by}
    changed: list[str] = []
    if "amount_minor" in body and body["amount_minor"] is not None:
        fields["amount_minor"] = _amount(body["amount_minor"])
        changed.append("amount_minor")
    if "warn_bp" in body and body["warn_bp"] is not None:
        fields["warn_bp"] = _warn(conn, body["warn_bp"])
        changed.append("warn_bp")
    if "note" in body and body["note"] is not None:
        fields["note"] = _clean_note(body["note"])
        changed.append("note")
    if not store_budgets.update_budget(conn, b["id"], fields, expect_revision=int(body.get("revision") or 0)):
        raise BudgetRefused(409, "budget_stale", revision=b["revision"])
    fresh = store_budgets.budget(conn, b["id"]) or dict(b)
    state = consumption(conn, fresh)["state"]
    prev = fresh.get("alert_state") or "ok"
    if STATES.index(state) < STATES.index(prev):  # a raised amount: the higher rows are over
        notify_bridge.budget_resolved(conn, fresh["id"], tuple(s for s in ("warning", "exceeded") if STATES.index(s) > STATES.index(state)))
    store_budgets.update_budget(conn, fresh["id"], {"alert_state": state}, bump=False)  # a lowered amount notifies with the next approval
    return store_budgets.budget(conn, b["id"]) or fresh, changed


def delete(conn, b: Mapping[str, Any], *, revision: int, by: str) -> None:
    from ...db import now_iso

    if not store_budgets.update_budget(conn, b["id"], {"deleted_at": now_iso(), "updated_by": by}, expect_revision=revision):
        raise BudgetRefused(409, "budget_stale", revision=b["revision"])
    notify_bridge.budget_resolved(conn, b["id"])


def summary(conn, viewer: Viewer, *, period_kind: str | None, day: dt.date) -> list[dict[str, Any]]:
    """The budgets whose period holds `day` (all period kinds, or one), with consumption, that this caller may see."""
    out = []
    for b in store_budgets.budgets(conn, period_kind=period_kind):
        if b["period_start"] != period_of(b["period_kind"], day).isoformat() or not visible_to(viewer, b):
            continue
        out.append(present_row(conn, b, with_consumption=True))
    return out
