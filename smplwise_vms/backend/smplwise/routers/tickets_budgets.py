"""CR-SVC215 slice 1 (docs/changes/CR-SVC215.md sections 6 and 7; owner answers 2026-10-24 items 33, 34): budgets against approved costs.

    GET    /tickets/costs/budgets                       the money permission (tickets.costs.view): the budgets this caller may see, with
                                                        consumption; filters scope_kind, scope_id, period_kind, currency
    GET    /tickets/costs/budgets/summary               the same permission: the budgets of the period that holds `day` (default today,
                                                        the installation's zone), one row each with approved / committed / remaining /
                                                        the state; `period_kind` narrows
    POST   /tickets/costs/budgets                       tickets.configure (installation): {scope_kind, scope_id, period_kind, period_start,
                                                        amount_minor, currency, warn_bp?, note?} -> 201 (409 budget_exists)
    PATCH  /tickets/costs/budgets/{id}                  tickets.configure: {revision, amount_minor?, warn_bp?, note?}
    DELETE /tickets/costs/budgets/{id}?revision=        tickets.configure: a soft delete; its open notifications are resolved
    GET    /tickets/{id}/costs/{claim_id}/budget-check  the decision permissions of the cost routes: what approving the claim's current
                                                        revision would do to each covering budget (the approval dialog's numbers)

The approval itself (POST /tickets/{id}/costs/{claim_id}/approve | adjust, routers/tickets_costs.py) asks for `budget_confirm` when a
covering budget ends exceeded - never a refusal (owner answer 33). Everything sits behind the module switch and `budgets.enabled`
(404 `feature_disabled`). Audit: tickets.budget.create | update | delete (ids, scope, period, currency, amounts - never a note).
Mounted BEFORE routers/tickets_costs.py and routers/tickets.py."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, StrictInt

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services.tickets import access, budgets, costs, store_budgets, store_costs
from ..services.tickets.access import Viewer, text
from .tickets import ID, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])

MESSAGES = {"budget_exists": "כבר קיים תקציב לתחום, לתקופה ולמטבע האלה.", "budget_stale": "התקציב השתנה בינתיים. טענו מחדש.",
            "budget_not_found": "התקציב לא נמצא."}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _err(conn: sqlite3.Connection, exc: budgets.BudgetRefused) -> ApiError:
    if exc.status == 422:
        return ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": exc.field or "body", "code": exc.code}]})
    return ApiError(exc.status, exc.code, text(conn, MESSAGES.get(exc.code, "הפעולה נדחתה.")), details=dict(exc.extra))


def _money(conn: sqlite3.Connection, viewer: Viewer, action: str, rid: str | None) -> None:
    budgets.require_enabled(conn)
    if costs.COSTS_VIEW not in viewer.anywhere:
        audit(conn, actor=viewer.principal, action=action, decision="denied", resource_type="ticket_budget", resource_id="*", reason="permission_missing",
              request_id=rid, details={"permission": costs.COSTS_VIEW})
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"permission": costs.COSTS_VIEW})


def _configure(conn: sqlite3.Connection, principal: Principal) -> None:
    budgets.require_enabled(conn)
    require(conn, principal, access.CONFIGURE, INSTALLATION)


def _today(conn: sqlite3.Connection) -> dt.date:
    return dt.datetime.now(dt.timezone.utc).astimezone(budgets._zone(conn)).date()


@router.get("/tickets/costs/budgets")
def list_budgets(request: Request, scope_kind: str | None = Query(None, max_length=16), scope_id: str | None = Query(None, max_length=64),
                 period_kind: str | None = Query(None, max_length=8), currency: str | None = Query(None, max_length=3),
                 principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    _money(conn, viewer, "tickets.budget.list", _rid(request))
    if scope_kind is not None and scope_kind not in budgets.SCOPES or period_kind is not None and period_kind not in budgets.PERIODS:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "scope_kind" if scope_kind not in (None, *budgets.SCOPES) else "period_kind", "code": "invalid"}]})
    rows = [b for b in store_budgets.budgets(conn, scope_kind=scope_kind, scope_id=scope_id, period_kind=period_kind, currency=currency)
            if budgets.visible_to(viewer, b)]
    return {"budgets": [budgets.present_row(conn, b, with_consumption=True) for b in rows],
            "can_edit": viewer.holds_installation(access.CONFIGURE), "default_warn_bp": int(budgets.cfg(conn)["warn_bp"]),
            "scopes": list(budgets.SCOPES), "periods": list(budgets.PERIODS)}


@router.get("/tickets/costs/budgets/summary")
def budget_summary(request: Request, period_kind: str | None = Query(None, max_length=8), day: str | None = Query(None, max_length=10),
                   principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    _money(conn, viewer, "tickets.budget.summary", _rid(request))
    if period_kind is not None and period_kind not in budgets.PERIODS:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "period_kind", "code": "invalid"}]})
    try:
        d = dt.date.fromisoformat(day) if day else _today(conn)
    except ValueError:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "day", "code": "format"}]}) from None
    return {"day": d.isoformat(), "rows": budgets.summary(conn, viewer, period_kind=period_kind, day=d)}


class CreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scope_kind: str = Field(max_length=16)
    scope_id: str | None = Field(default=None, max_length=64)
    period_kind: str = Field(max_length=8)
    period_start: str = Field(max_length=10)
    amount_minor: StrictInt
    currency: str = Field(max_length=3)
    warn_bp: StrictInt | None = None
    note: str | None = Field(default=None, max_length=400)


class UpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: StrictInt = Field(ge=1)
    amount_minor: StrictInt | None = None
    warn_bp: StrictInt | None = None
    note: str | None = Field(default=None, max_length=400)


def _details(b: dict[str, Any]) -> dict[str, Any]:
    return {"scope_kind": b["scope_kind"], "scope_id": b["scope_id"], "period_kind": b["period_kind"], "period_start": b["period_start"],
            "currency": b["currency"], "amount_minor": int(b["amount_minor"]), "warn_bp": int(b["warn_bp"])}


@router.post("/tickets/costs/budgets", status_code=201)
def create_budget(body: CreateBody, request: Request, principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _configure(conn, principal)
    try:
        b = budgets.create(conn, body.model_dump(), by=principal.user_id)
    except budgets.BudgetRefused as exc:
        raise _err(conn, exc) from None
    audit(conn, actor=principal, action="tickets.budget.create", decision="allowed", resource_type="ticket_budget", resource_id=b["id"],
          request_id=_rid(request), details=_details(b))
    return budgets.present_row(conn, b, with_consumption=True)


def _budget(conn: sqlite3.Connection, budget_id: str) -> dict[str, Any]:
    b = store_budgets.budget(conn, budget_id)
    if b is None:
        raise ApiError(404, "budget_not_found", text(conn, MESSAGES["budget_not_found"]))
    return b


@router.patch("/tickets/costs/budgets/{budget_id}")
def update_budget(body: UpdateBody, request: Request, budget_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _configure(conn, principal)
    b = _budget(conn, budget_id)
    try:
        fresh, changed = budgets.update(conn, b, body.model_dump(), by=principal.user_id)
    except budgets.BudgetRefused as exc:
        raise _err(conn, exc) from None
    audit(conn, actor=principal, action="tickets.budget.update", decision="allowed", resource_type="ticket_budget", resource_id=b["id"],
          request_id=_rid(request), details={**_details(fresh), "changed": changed, "amount_before": int(b["amount_minor"])})
    return budgets.present_row(conn, fresh, with_consumption=True)


@router.delete("/tickets/costs/budgets/{budget_id}", status_code=204)
def delete_budget(request: Request, budget_id: str = Path(..., pattern=ID), revision: int = Query(..., ge=1),
                  principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    _configure(conn, principal)
    b = _budget(conn, budget_id)
    try:
        budgets.delete(conn, b, revision=revision, by=principal.user_id)
    except budgets.BudgetRefused as exc:
        raise _err(conn, exc) from None
    audit(conn, actor=principal, action="tickets.budget.delete", decision="allowed", resource_type="ticket_budget", resource_id=b["id"],
          request_id=_rid(request), details=_details(b))
    return Response(status_code=204)


@router.get("/tickets/{ticket_id}/costs/{claim_id}/budget-check")
def budget_check(request: Request, ticket_id: str = Path(..., pattern=ID), claim_id: str = Path(..., pattern=ID),
                 principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The approval dialog's numbers (section 6.2: "אישור זה חורג מהתקציב השנתי ב-4,200 ₪"): the claim's current revision against every
    covering budget. Read-only; the same visibility and cost permissions as the decision itself (tickets.costs.view + tickets.costs)."""
    viewer = Viewer(conn, principal)
    budgets.require_enabled(conn)
    seen = access.require_visible(viewer, ticket_id)
    if not seen.full or not viewer.holds(costs.COSTS_VIEW, seen.row) or not viewer.holds(costs.COSTS, seen.row):
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"permission": costs.COSTS})
    claim = store_costs.claim(conn, claim_id)
    if claim is None or claim.get("ticket_id") != seen.row["id"]:
        raise ApiError(404, "claim_not_found", text(conn, "דרישת התשלום לא נמצאה."))
    rev = store_costs.revision(conn, claim.get("current_revision_id") or "") or {}
    if rev.get("total_minor") is None:
        return {"claim_id": claim_id, "budgets": [], "confirm_required": False}
    rows = budgets.preview(conn, seen.row, int(rev["total_minor"]), str(rev.get("currency") or claim["currency"]), costs.now_utc())
    need = bool(budgets.cfg(conn)["require_confirmation"]) and any(r["after"] == "exceeded" for r in rows)
    return {"claim_id": claim_id, "amount_minor": int(rev["total_minor"]), "currency": rev.get("currency") or claim["currency"], "budgets": rows,
            "confirm_required": need}
