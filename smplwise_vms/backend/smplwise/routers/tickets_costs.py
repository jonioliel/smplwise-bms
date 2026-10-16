"""CR-038 slice 9 - the internal cost-claim API (section 11A.12; owner decisions D31 / D32).

    GET  /tickets/costs/report                         tickets.costs.view (rows: visible tickets with the permission on their place)
    GET  /tickets/costs/export.csv                     tickets.costs.view; 5,000 rows, 1 a minute, audited ticket.costs.export
         (both take the report filters + TK258's optional `vendor` (the vendor grouping's key) and `department`)
    GET  /tickets/costs/claims                         TK258 "חשבון ספקים": tickets.costs.view; one row per claim of the same filters
    POST /tickets/costs/mark-paid                      TK258: tickets.costs; {items: [{ticket_id, claim_id, revision?}], payment_ref,
                                                       payment_date} -> a result per item (idempotent: already_paid)
    GET  /tickets/{id}/costs                           visible; amounts / lines / files / history with tickets.costs.view, else the status
    POST /tickets/{id}/costs/requirement               a manager of the ticket: {assignment_id, mode} while no claim was submitted
    POST /tickets/{id}/costs/files                     tickets.costs: one invoice page or PDF as a PENDING file (on-behalf entry)
    POST /tickets/{id}/costs                           tickets.costs: a claim on the vendor's behalf {assignment_id?, lines, ...}
    POST /tickets/{id}/costs/{claim_id}/approve        tickets.costs + tickets.costs.view: {revision_id, revision}
    POST /tickets/{id}/costs/{claim_id}/adjust         ... {revision_id, revision, lines, reason}
    POST /tickets/{id}/costs/{claim_id}/reject         ... {revision_id, revision, reason}
    POST /tickets/{id}/costs/{claim_id}/mark-paid      ... {revision, payment_ref, payment_date}
    POST /tickets/{id}/costs/{claim_id}/unmark-paid    ... {revision, reason}
    POST /tickets/{id}/costs/{claim_id}/reopen-window  ... {revision}
    GET  /tickets/{id}/costs/files/{file_id}           tickets.costs.view: a PDF as a sandboxed DOWNLOAD (11A.6), a page as an image
    GET  /tickets/{id}/costs/{claim_id}/documents/{revision_id}/{n}[.pdf]   tickets.costs.view: the photographed pages as ONE PDF

Order of every route: signed in -> the module switch (router dependency) -> the ticket's visibility (the uniform 404) -> the cost
permissions on the ticket's place (an audited 403). Every write is one transaction: the claim row, its revision / decision rows, the
ticket's denormalised cost columns, the timeline row and an audit row with ids, statuses and totals only - never a line
description, a note, a vendor reference or a file."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, Path, Query, Request, UploadFile
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import Principal
from ..services.tickets import access, cost_files, cost_storage, costs, costs_report, image_intake, present, quotes, service, store, store_costs
from ..services.tickets.access import Seen, Viewer, text
from .tickets import ID, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])
BULK_PAID_MAX = 200  # TK258: claims per "mark as paid" request


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _root(request: Request):
    root = settings_of(request).data_dir / "tickets"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _deny(conn: sqlite3.Connection, viewer: Viewer, action: str, row: dict[str, Any] | None, permission: str, rid: str | None) -> ApiError:
    audit(conn, actor=viewer.principal, action=action, decision="denied", resource_type="ticket", resource_id=(row or {}).get("id") or "*",
          reason="permission_missing", request_id=rid, details={"permission": permission, **({"number": row.get("number")} if row else {})})
    return ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"permission": permission})


def _need(conn: sqlite3.Connection, viewer: Viewer, ticket_id: str, action: str, rid: str | None, *, decide: bool = False) -> Seen:
    """The ticket (the uniform 404 when invisible) and the cost permissions on its place: tickets.costs.view always (a reviewer
    must see what they approve, 11A.8), tickets.costs for a decision. Cost data needs the members' full view of the ticket."""
    seen = access.require_visible(viewer, ticket_id)
    if not seen.full or not viewer.holds(costs.COSTS_VIEW, seen.row):
        raise _deny(conn, viewer, action, seen.row, costs.COSTS_VIEW, rid)
    if decide and not viewer.holds(costs.COSTS, seen.row):
        raise _deny(conn, viewer, action, seen.row, costs.COSTS, rid)
    return seen


def _claim(conn: sqlite3.Connection, seen: Seen, claim_id: str) -> dict[str, Any]:
    c = store_costs.claim(conn, claim_id)
    if c is None or c.get("ticket_id") != seen.row["id"]:
        raise ApiError(404, "claim_not_found", text(conn, "דרישת התשלום לא נמצאה."))
    return c


def _audit(conn, viewer: Viewer, action: str, seen: Seen, claim: dict[str, Any] | None, rid: str | None, **details: Any) -> None:
    audit(conn, actor=viewer.principal, action=action, decision="allowed", resource_type="ticket", resource_id=seen.row["id"], request_id=rid,
          details={"number": seen.row["number"], **({"claim_id": claim["id"], "status": claim["status"]} if claim else {}), **details})


def _answer(conn: sqlite3.Connection, viewer: Viewer, ticket_id: str) -> dict[str, Any]:
    seen = access.require_visible(viewer, ticket_id)
    full = seen.full and viewer.holds(costs.COSTS_VIEW, seen.row)
    claims = [costs.present_claim(conn, c, full=full) for c in store_costs.claims_of_ticket(conn, ticket_id)]
    s = costs.cost_settings(conn)
    out: dict[str, Any] = {"ticket_id": ticket_id, "number": seen.row["number"], "cost": present.cost_block(viewer, seen), "claims": claims}
    from ..services.tickets import quotes  # TKDETAILBE: quotes, the cost flow, the allowed kinds and the baseline (contract 4.4)

    if full:
        out["settings"] = {"currencies": list(s.currencies), "vat_rate_bp": s.vat_rate_bp, "review_flag_above_minor": s.review_flag_above_minor,
                           "max_claim_total_minor": s.max_claim_total_minor, "require_invoice": s.require_invoice}
        # TKUI3: `quote_capable` (quotes.quote_capable) - false for a staff contact without an account, whose assignment is of kind
        # `contact` too; the Costs tab never offers a quote, a payment demand or a requirement for such an assignment (no money surface)
        # TKFIX260 (review A F3): a staff assignment stays in the list (the tab needs it to say "no money surface") but carries no quote mode
        out["external_assignments"] = []
        for a in store.assignments(conn, ticket_id):
            if a["assignee_kind"] != "contact":
                continue
            capable = quotes.quote_capable(conn, a)
            out["external_assignments"].append({"id": a["id"], "name": a["assignee_name"], "assigned_at": a["assigned_at"], "ended_at": a.get("ended_at"),
                                                "cost_claim": a.get("cost_claim"), "quote_mode": (a.get("quote_mode") or "optional") if capable else None,
                                                "quote_capable": capable})

    out.update(quotes.answer(conn, seen.row, full=full, can_decide=full and viewer.holds(costs.COSTS, seen.row)))
    return out


def _refused(conn, exc: costs.CostRefused) -> ApiError:
    return service.cost_error(conn, exc)


# ---------------------------------------------------------------- report and export (before /tickets/{id}/... by shape anyway)

def _filters(conn, group_by: str, date_from: str | None, date_to: str | None, status: str | None, currency: str | None,
             vendor: str | None = None, department: str | None = None) -> costs_report.Filters:
    try:
        return costs_report.parse_filters(conn, group_by=group_by, date_from=date_from, date_to=date_to, status=status, currency=currency,
                                          vendor=vendor, department=department)
    except costs_report.ReportError as exc:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": exc.field, "code": exc.code}]}) from None


def _need_report(conn, viewer: Viewer, action: str, rid: str | None) -> None:
    if costs.COSTS_VIEW not in viewer.anywhere:
        raise _deny(conn, viewer, action, None, costs.COSTS_VIEW, rid)


@router.get("/tickets/costs/report")
def cost_report(request: Request, group_by: str = Query("vendor", max_length=16), date_from: str | None = Query(None, alias="from", max_length=10),
                date_to: str | None = Query(None, alias="to", max_length=10), status: str | None = Query(None, max_length=40),
                currency: str | None = Query(None, max_length=3), vendor: str | None = Query(None, max_length=64),
                department: str | None = Query(None, max_length=64), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    _need_report(conn, viewer, "ticket.costs.report", _rid(request))
    f = _filters(conn, group_by, date_from, date_to, status, currency, vendor, department)
    out = costs_report.report(conn, viewer, f)
    audit(conn, actor=principal, action="ticket.costs.report", decision="allowed", resource_type="ticket", resource_id="*", request_id=_rid(request),
          details={"group_by": f.group_by, "from": date_from, "to": date_to, "status": list(f.statuses), "currency": currency, "vendor": f.vendor,
                   "department": f.department, "claims": out["claims"]})
    return out


@router.get("/tickets/costs/claims")
def cost_claims(request: Request, date_from: str | None = Query(None, alias="from", max_length=10), date_to: str | None = Query(None, alias="to", max_length=10),
                status: str | None = Query(None, max_length=40), currency: str | None = Query(None, max_length=3),
                vendor: str | None = Query(None, max_length=64), department: str | None = Query(None, max_length=64),
                principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """TK258 "חשבון ספקים": the claims of the report's filters one per row (amounts per currency, never summed across), each with
    its ticket for the link, its revision and whether this caller may mark it paid. tickets.costs.view; audited like the report."""
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    _need_report(conn, viewer, "ticket.costs.claims", rid)
    f = _filters(conn, "vendor", date_from, date_to, status, currency, vendor, department)
    out = costs_report.claim_rows(conn, viewer, f)
    out["can_mark_paid"] = costs.COSTS in viewer.anywhere
    audit(conn, actor=principal, action="ticket.costs.claims", decision="allowed", resource_type="ticket", resource_id="*", request_id=rid,
          details={"from": date_from, "to": date_to, "status": list(f.statuses), "currency": currency, "vendor": f.vendor, "department": f.department,
                   "claims": len(out["rows"])})
    return out


class BulkPaidItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticket_id: str = Field(min_length=1, max_length=64, pattern=ID)
    claim_id: str = Field(min_length=1, max_length=64, pattern=ID)
    revision: int | None = Field(default=None, ge=1)


class BulkPaidBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[BulkPaidItem] = Field(min_length=1, max_length=BULK_PAID_MAX)
    payment_ref: str = Field(max_length=500)
    payment_date: str = Field(max_length=10)


@router.post("/tickets/costs/mark-paid")
def post_mark_paid_bulk(body: BulkPaidBody, request: Request, principal: Principal = Depends(current_principal),
                        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """TK258: "סימון כשולם" for several approved claims at once, one payment reference and date. A result per item, never one
    refusal for all: `paid`, `already_paid` (idempotent - a repeated request changes nothing), `not_found` (an unknown or invisible
    ticket / claim, the uniform answer), `forbidden` (no tickets.costs or tickets.costs.view on that ticket's place; audited),
    `not_approved`, `stale` (the claim's revision moved). Each item is its own savepoint inside the request's transaction. The audit
    rows carry ids, statuses and totals only - never the payment reference."""
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    if costs.COSTS not in viewer.anywhere or costs.COSTS_VIEW not in viewer.anywhere:
        raise _deny(conn, viewer, "ticket.costs.mark_paid_bulk", None, costs.COSTS if costs.COSTS_VIEW in viewer.anywhere else costs.COSTS_VIEW, rid)
    at = costs.now_utc()
    try:  # the shared fields once, so a bad reference / date is one 422 and not N identical item failures
        costs.check_payment(body.payment_ref, body.payment_date, at)
    except costs.CostRefused as exc:
        raise _refused(conn, exc) from None
    results: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for it in body.items:
        if it.claim_id in seen_ids:
            continue
        seen_ids.add(it.claim_id)
        results.append(_mark_one(conn, viewer, it, body.payment_ref, body.payment_date, at, rid))
    counts: dict[str, int] = {}
    for r in results:
        counts[r["result"]] = counts.get(r["result"], 0) + 1
    audit(conn, actor=principal, action="ticket.costs.mark_paid_bulk", decision="allowed", resource_type="ticket", resource_id="*", request_id=rid,
          details={"items": len(results), **counts})
    return {"results": results, "paid": counts.get("paid", 0), "already_paid": counts.get("already_paid", 0),
            "failed": len(results) - counts.get("paid", 0) - counts.get("already_paid", 0)}


def _mark_one(conn: sqlite3.Connection, viewer: Viewer, it: BulkPaidItem, ref: str, day: str, at, rid: str | None) -> dict[str, Any]:
    out: dict[str, Any] = {"ticket_id": it.ticket_id, "claim_id": it.claim_id}
    seen = access.visible_by_id(viewer, it.ticket_id)
    if seen is None:
        return {**out, "result": "not_found"}
    out["number"] = seen.row["number"]
    if not seen.full or not viewer.holds(costs.COSTS_VIEW, seen.row) or not viewer.holds(costs.COSTS, seen.row):
        perm = costs.COSTS_VIEW if not seen.full or not viewer.holds(costs.COSTS_VIEW, seen.row) else costs.COSTS
        audit(conn, actor=viewer.principal, action="ticket.cost.mark_paid", decision="denied", resource_type="ticket", resource_id=seen.row["id"],
              reason="permission_missing", request_id=rid, details={"permission": perm, "number": seen.row["number"], "bulk": True})
        return {**out, "result": "forbidden"}
    claim = store_costs.claim(conn, it.claim_id)
    if claim is None or claim.get("ticket_id") != seen.row["id"]:
        return {**out, "result": "not_found"}
    if claim["status"] == "paid":
        return {**out, "result": "already_paid", "revision": claim["revision"]}
    if claim["status"] != "approved":
        return {**out, "result": "not_approved", "revision": claim["revision"]}
    if it.revision is not None and int(claim["revision"]) != it.revision:
        return {**out, "result": "stale", "revision": claim["revision"]}
    conn.execute("SAVEPOINT tk258_mark_paid")
    try:
        fresh = costs.mark_paid(conn, claim, by=viewer.uid, revision=int(claim["revision"]), payment_ref=ref, payment_date=day, at=at)
        _audit(conn, viewer, "ticket.cost.mark_paid", seen, fresh, rid, revision_id=fresh.get("current_revision_id"),
               total_minor=fresh.get("approved_total_minor"), bulk=True)
        store.insert_event(conn, seen.row["id"], "cost_decision", actor_kind="user", actor_user_id=viewer.uid, actor_name=service.actor_name(viewer),
                           assignment_id=fresh["assignment_id"], data={"claim_id": fresh["id"], "action": "mark_paid"})
    except costs.CostRefused as exc:
        conn.execute("ROLLBACK TO tk258_mark_paid")
        conn.execute("RELEASE tk258_mark_paid")
        return {**out, "result": "stale" if exc.code == "claim_stale" else "not_approved", "revision": claim["revision"]}
    except Exception:
        conn.execute("ROLLBACK TO tk258_mark_paid")
        conn.execute("RELEASE tk258_mark_paid")
        raise
    conn.execute("RELEASE tk258_mark_paid")
    return {**out, "result": "paid", "revision": fresh["revision"]}


@router.get("/tickets/costs/export.csv")
def cost_export(request: Request, group_by: str = Query("vendor", max_length=16), date_from: str | None = Query(None, alias="from", max_length=10),
                date_to: str | None = Query(None, alias="to", max_length=10), status: str | None = Query(None, max_length=40),
                currency: str | None = Query(None, max_length=3), rows: Literal["claim", "line"] = Query("claim"),
                vendor: str | None = Query(None, max_length=64), department: str | None = Query(None, max_length=64),
                principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> StreamingResponse:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    _need_report(conn, viewer, "ticket.costs.export", rid)
    wait = costs_report.rate_check(principal.user_id)
    if wait > 0:
        raise ApiError(429, "export_rate", text(conn, "אפשר לייצא פעם בדקה. נסו שוב בעוד רגע."), retryable=True, details={"retry_after_s": int(wait) + 1})
    f = _filters(conn, group_by, date_from, date_to, status, currency, vendor, department)
    try:
        cells = costs_report.build_csv(conn, viewer, f, rows)
    except costs_report.ReportError:
        raise ApiError(413, "export_too_large", text(conn, "יותר מדי שורות לייצוא. צמצמו את הסינון."), details={"max_rows": costs_report.EXPORT_MAX_ROWS}) from None
    audit(conn, actor=principal, action="ticket.costs.export", decision="allowed", resource_type="ticket", resource_id="*", request_id=rid,
          details={"from": date_from, "to": date_to, "status": list(f.statuses), "currency": currency, "vendor": f.vendor, "department": f.department,
                   "rows_kind": rows, "rows": len(cells) - 1})
    costs_report.mark(principal.user_id)
    return StreamingResponse(costs_report.stream(cells), media_type="text/csv; charset=utf-8", headers={
        "Content-Disposition": f'attachment; filename="{costs_report.filename(conn)}"', "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"})


# ---------------------------------------------------------------- one ticket's claims

@router.get("/tickets/{ticket_id}/costs")
def get_costs(ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _answer(conn, Viewer(conn, principal), ticket_id)


class RequirementBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    assignment_id: str = Field(min_length=1, max_length=64, pattern=ID)
    mode: Literal["required", "optional", "off"]


@router.post("/tickets/{ticket_id}/costs/requirement")
def post_requirement(body: RequirementBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    if not seen.manager:
        raise service.refuse(conn, viewer, "ticket.cost.requirement", seen.row, "not_manager", _rid(request))
    asg = store.assignment(conn, body.assignment_id)
    if asg is None or asg["ticket_id"] != ticket_id:
        raise ApiError(404, "assignment_not_found", text(conn, "השיוך לא נמצא."))
    try:
        costs.set_requirement(conn, seen.row, asg, body.mode, by=viewer.uid, at=costs.now_utc())
    except costs.CostRefused as exc:
        raise _refused(conn, exc) from None
    _audit(conn, viewer, "ticket.cost.requirement", seen, None, _rid(request), assignment_id=asg["id"], mode=body.mode)
    return _answer(conn, viewer, ticket_id)


class DecisionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    revision_id: str | None = Field(default=None, max_length=64, pattern=ID)
    reason: str | None = Field(default=None, max_length=5000)
    lines: list[dict[str, Any]] | None = Field(default=None, max_length=30)
    payment_ref: str | None = Field(default=None, max_length=500)
    payment_date: str | None = Field(default=None, max_length=10)
    exceptional: Literal["include", "exclude"] | None = None  # TKDETAILBE (5.3): approve with / without the exceptional lines
    internal_note: str | None = Field(default=None, max_length=5000)  # TKFIX260: never shown to the vendor (approve / adjust / reject)


ACTIONS =("approve", "adjust", "reject", "mark-paid", "unmark-paid", "reopen-window")
AUDIT_ACTIONS = {"approve": "ticket.cost.approve", "adjust": "ticket.cost.adjust", "reject": "ticket.cost.reject", "mark-paid": "ticket.cost.mark_paid",
                 "unmark-paid": "ticket.cost.unmark_paid", "reopen-window": "ticket.cost.reopen_window"}


@router.post("/tickets/{ticket_id}/costs/{claim_id}/{action}")
def post_decision(body: DecisionBody, request: Request, ticket_id: str = Path(..., pattern=ID), claim_id: str = Path(..., pattern=ID),
                  action: Literal["approve", "adjust", "reject", "mark-paid", "unmark-paid", "reopen-window"] = Path(...),
                  principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    seen = _need(conn, viewer, ticket_id, AUDIT_ACTIONS[action], rid, decide=True)
    claim = _claim(conn, seen, claim_id)
    at = costs.now_utc()
    needs_rev = action in ("approve", "adjust", "reject")
    if needs_rev and not body.revision_id:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "revision_id", "code": "required"}]})
    if body.exceptional is not None and action != "approve":
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "exceptional", "code": "only_with_approve"}]})
    if body.internal_note is not None and not needs_rev:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "internal_note", "code": "only_with_decision"}]})
    try:
        if action == "approve":
            fresh = costs.approve(conn, claim, by=viewer.uid, revision=body.revision, revision_id=body.revision_id or "", at=at,
                                  exceptional=body.exceptional or "include", reason=body.reason, internal_note=body.internal_note)
        elif action == "adjust":
            fresh = costs.adjust(conn, claim, {"lines": body.lines or []}, by=viewer.uid, revision=body.revision, revision_id=body.revision_id or "",
                                 reason=body.reason, at=at, internal_note=body.internal_note)
        elif action == "reject":
            fresh = costs.reject(conn, claim, by=viewer.uid, revision=body.revision, revision_id=body.revision_id or "", reason=body.reason, at=at,
                                 internal_note=body.internal_note)
        elif action == "mark-paid":
            fresh = costs.mark_paid(conn, claim, by=viewer.uid, revision=body.revision, payment_ref=body.payment_ref, payment_date=body.payment_date, at=at)
        elif action == "unmark-paid":
            fresh = costs.unmark_paid(conn, claim, by=viewer.uid, revision=body.revision, reason=body.reason, at=at)
        else:
            fresh = costs.reopen_window(conn, claim, by=viewer.uid, revision=body.revision, at=at)
    except costs.CostRefused as exc:
        raise _refused(conn, exc) from None
    _audit(conn, viewer, AUDIT_ACTIONS[action], seen, fresh, rid, revision_id=fresh.get("current_revision_id"),
           total_minor=fresh.get("approved_total_minor"), **({"exceptional": body.exceptional} if body.exceptional else {}))
    store.insert_event(conn, ticket_id, "cost_decision", actor_kind="user", actor_user_id=viewer.uid, actor_name=service.actor_name(viewer),
                       assignment_id=fresh["assignment_id"], data={"claim_id": fresh["id"], "action": action.replace("-", "_")})
    out = _answer(conn, viewer, ticket_id)
    draft = {"approve": "approved", "adjust": "approved", "reject": "rejected"}.get(action)
    if draft is not None:  # TKDETAILBE (contract 7): the editable draft; a decision never sends it
        from ..services.tickets import quotes
        from .tickets_detail import claim_draft_object

        if action == "approve" and body.exceptional == "exclude" and fresh.get("approved_revision_id") != body.revision_id:
            draft = "approved_without_exceptional"
        out["message_draft"] = quotes.draft_message(conn, seen.row, subject="claim", obj=claim_draft_object(conn, fresh), decision=draft)
    return out


# ---------------------------------------------------------------- TK257: the quote before the work (migration 0085)

class QuoteDecisionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str | None = Field(default=None, max_length=5000)


@router.post("/tickets/{ticket_id}/costs/quotes/{quote_id}/{action}")
def post_quote_decision(body: QuoteDecisionBody, request: Request, ticket_id: str = Path(..., pattern=ID), quote_id: str = Path(..., pattern=ID),
                        action: Literal["approve", "reject"] = Path(...), principal: Principal = Depends(current_principal),
                        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """TK257 (2.5.7) compatibility alias of POST /tickets/{id}/quotes/{quote_id}/{approve|request-fix} (TKDETAILBE, routers/tickets_detail.py):
    "approve" approves every line, "reject" is TK257's correction request (reason required). NOTHING is sent to the vendor; the answer
    carries the editable `message_draft` like the new route."""
    from ..services.tickets import store_quotes

    viewer = Viewer(conn, principal)
    rid = _rid(request)
    act = "approve" if action == "approve" else "request_fix"
    name = f"ticket.quote.{act}"
    seen = _need(conn, viewer, ticket_id, name, rid, decide=True)
    row = store_quotes.quote(conn, quote_id)
    if row is None or row.get("ticket_id") != seen.row["id"]:
        raise ApiError(404, "quote_not_found", text(conn, "ההצעה לא נמצאה."))
    try:
        fresh = quotes.decide(conn, row, act, by=viewer.uid, revision=int(row["revision"]), at=costs.now_utc(), reason=body.reason,
                              actor_name=service.actor_name(viewer))
    except costs.CostRefused as exc:
        if exc.code == "quote_not_submitted":
            raise ApiError(409, "invalid_state", text(conn, "ההצעה כבר טופלה.")) from None
        raise _refused(conn, exc) from None
    _audit(conn, viewer, name, seen, None, rid, quote_id=quote_id, version=fresh["version"], state=fresh["state"])  # TKFIX260: a quote audit carries no amount
    out = _answer(conn, viewer, ticket_id)
    out["message_draft"] = quotes.draft_message(conn, seen.row, subject="quote", obj=fresh,
                                                decision="approved" if act == "approve" else "fix_requested")
    return out


# ---------------------------------------------------------------- on the vendor's behalf (a paper invoice): pending files, then the claim

@router.post("/tickets/{ticket_id}/costs/files", status_code=201)
def post_cost_file(request: Request, ticket_id: str = Path(..., pattern=ID), file: UploadFile = File(...),
                   principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    seen = _need(conn, viewer, ticket_id, "ticket.cost.file_upload", rid, decide=True)
    data = file.file.read(cost_files.PDF_MAX_BYTES + 1)
    root = _root(request)
    now = costs.now_utc()
    since = costs.iso(now - costs.PENDING_TTL)
    if len(store_costs.pending_for_user(conn, ticket_id, viewer.uid, since)) >= cost_files.MAX_PENDING_PER_LINK:
        raise ApiError(409, "file_limit", text(conn, "הגעתם למספר הקבצים המרבי."))
    try:
        with unlocked(conn):  # the decode / PDF scan never holds the database write lock
            stored = cost_storage.store_upload(root, ticket_id, data)
    except image_intake.IntakeError as exc:
        audit(conn, actor=principal, action="ticket.cost.file_upload", decision="denied", resource_type="ticket", resource_id=ticket_id, reason=exc.code,
              request_id=rid)
        raise ApiError(exc.status, exc.code, text(conn, "הקובץ נדחה."), retryable=exc.status == 429, details=dict(exc.details)) from None
    try:
        seen = _need(conn, viewer, ticket_id, "ticket.cost.file_upload", rid, decide=True)
        if store_costs.hash_in_claim_or_pending(conn, stored.sha256, claim_id=None, link_id=None, ticket_id=ticket_id, user_id=viewer.uid, since=since):
            raise ApiError(409, "duplicate_file", text(conn, "הקובץ הזה כבר צורף."))
        fid = store_costs.insert_file(conn, {"ticket_id": ticket_id, "kind": stored.kind, "path": stored.rel_path, "sha256": stored.sha256,
                                             "bytes": stored.bytes, "width": stored.width, "height": stored.height, "uploaded_by_kind": "user",
                                             "uploaded_by": viewer.uid, "created_at": costs.iso(now), "name": ""})
    except ApiError:
        cost_storage.remove(root, stored.rel_path)
        raise
    _audit(conn, viewer, "ticket.cost.file_upload", seen, None, rid, file_id=fid, kind=stored.kind, bytes=stored.bytes)
    return {"id": fid, "kind": stored.kind, "bytes": stored.bytes, "width": stored.width, "height": stored.height}


class OnBehalfBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    assignment_id: str | None = Field(default=None, max_length=64, pattern=ID)
    lines: list[dict[str, Any]] = Field(default_factory=list, max_length=30)
    currency: str | None = Field(default=None, max_length=3)
    amounts_include_vat: bool | None = None
    vendor_ref: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=5000)
    no_charge: bool = False
    documents: list[dict[str, Any]] = Field(default_factory=list, max_length=3)


@router.post("/tickets/{ticket_id}/costs", status_code=201)
def post_on_behalf(body: OnBehalfBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    seen = _need(conn, viewer, ticket_id, "ticket.cost.on_behalf", rid, decide=True)
    at = costs.now_utc()
    try:
        claim = costs.ensure_for_on_behalf(conn, seen.row, body.assignment_id, at)
        fresh = costs.submit(conn, claim, body.model_dump(exclude={"assignment_id"}), by_kind="user", by_id=viewer.uid, link_id=None, at=at,
                             kind="on_behalf", actor_name=service.actor_name(viewer))
    except costs.CostRefused as exc:
        raise _refused(conn, exc) from None
    rev = store_costs.revision(conn, fresh.get("current_revision_id")) or {}
    _audit(conn, viewer, "ticket.cost.on_behalf", seen, fresh, rid, revision_id=rev.get("id"), total_minor=rev.get("total_minor"), currency=rev.get("currency"))
    return _answer(conn, viewer, ticket_id)


# ---------------------------------------------------------------- downloads (11A.6: a PDF only as a sandboxed download)

def _file_of_ticket(conn, seen: Seen, file_id: str) -> dict[str, Any]:
    f = store_costs.file(conn, file_id)
    if f is None or f["ticket_id"] != seen.row["id"] or f.get("claim_id") is None:
        raise ApiError(404, "file_not_found", text(conn, "הקובץ לא נמצא."))
    return f


@router.get("/tickets/{ticket_id}/costs/files/{file_id}")
def get_cost_file(request: Request, ticket_id: str = Path(..., pattern=ID), file_id: str = Path(..., pattern=ID),
                  principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> FileResponse:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    seen = _need(conn, viewer, ticket_id, "ticket.cost.file_download", rid)
    f = _file_of_ticket(conn, seen, file_id)
    try:
        path = cost_storage.path_of(_root(request), f["path"])
    except image_intake.StorePathError:
        raise ApiError(404, "file_not_found", text(conn, "הקובץ לא נמצא.")) from None
    if not path.is_file():
        raise ApiError(404, "file_not_found", text(conn, "הקובץ לא נמצא."))
    n = 1 + [x["id"] for x in store_costs.files_of_claim(conn, f["claim_id"])].index(f["id"])
    headers = cost_files.pdf_download_headers(seen.row["number"], n) if f["kind"] == "pdf" else cost_files.photo_headers(seen.row["number"])
    media = headers.pop("Content-Type")
    _audit(conn, viewer, "ticket.cost.file_download", seen, None, rid, file_id=file_id, kind=f["kind"])
    return FileResponse(path, media_type=media, headers=headers)


@router.get("/tickets/{ticket_id}/costs/{claim_id}/documents/{revision_id}/{doc}")
def get_document_pdf(request: Request, ticket_id: str = Path(..., pattern=ID), claim_id: str = Path(..., pattern=ID),
                     revision_id: str = Path(..., pattern=ID), doc: str = Path(..., pattern=r"^[1-3](\.pdf)?$"),
                     principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """"הורדה כ-PDF" (11A.6A): the photographed pages of one document, assembled on the server from the re-encoded images."""
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    doc_no = int(doc[0])  # "1" or "1.pdf"
    seen = _need(conn, viewer, ticket_id, "ticket.cost.file_download", rid)
    claim = _claim(conn, seen, claim_id)
    rev = store_costs.revision(conn, revision_id)
    if rev is None or rev["claim_id"] != claim["id"]:
        raise ApiError(404, "file_not_found", text(conn, "הקובץ לא נמצא."))
    pages = [f for f in store_costs.revision_files(conn, revision_id) if int(f["doc_no"]) == doc_no]
    if not pages or any(p["kind"] != "photo" for p in pages):
        raise ApiError(404, "file_not_found", text(conn, "הקובץ לא נמצא."))
    root = _root(request)
    try:
        paths = [cost_storage.path_of(root, p["path"]) for p in pages]
    except image_intake.StorePathError:
        raise ApiError(404, "file_not_found", text(conn, "הקובץ לא נמצא.")) from None
    if not all(p.is_file() for p in paths):
        raise ApiError(404, "file_not_found", text(conn, "הקובץ לא נמצא."))
    with unlocked(conn):
        data = cost_storage.assemble_pdf(paths)
    _audit(conn, viewer, "ticket.cost.file_download", seen, claim, rid, revision_id=revision_id, document=doc_no, assembled=True)
    return Response(data, headers=cost_files.pdf_download_headers(seen.row["number"], doc_no))


# ---------------------------------------------------------------- department defaults (Settings; tickets.configure)

class DepartmentCostsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cost_claim: Literal["required", "optional", "off"] | None = None  # None = the installation's `costs.mode`
    claim_window_days: int | None = Field(default=None, ge=1, le=90)  # None = the installation's `costs.claim_window_days`
    # TKDETAILBE: the department's default cost line kinds; null = the installation's; OMITTED = unchanged
    allowed_line_kinds: list[Literal["labor", "parts", "travel", "other"]] | None = Field(default=None, max_length=4)


def _need_configure(conn, viewer: Viewer, action: str, rid: str | None) -> None:
    from ..rbac import INSTALLATION

    if not viewer.holds_installation(access.CONFIGURE):
        audit(conn, actor=viewer.principal, action=action, decision="denied", resource_type="installation", resource_id=str(INSTALLATION[1]),
              reason="permission_missing", request_id=rid, details={"permission": access.CONFIGURE})
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"permission": access.CONFIGURE})


@router.get("/tickets/costs/departments")
def get_department_costs(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    _need_configure(conn, viewer, "ticket.department.costs", _rid(request))
    s = costs.cost_settings(conn)
    from ..services.tickets import quotes, settings_doc

    rows = [{**r, "allowed_line_kinds": quotes.kinds_json(r.get("allowed_line_kinds"))} for r in store_costs.department_cost_rows(conn)]
    return {"departments": rows, "installation": {"mode": s.mode, "claim_window_days": s.claim_window_days,
                                                  "allowed_line_kinds": settings_doc.read(conn)["costs"]["allowed_line_kinds"]}}


@router.put("/tickets/costs/departments/{dept_id}")
def put_department_costs(body: DepartmentCostsBody, request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                         conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    _need_configure(conn, viewer, "ticket.department.costs", rid)
    kinds_sent = "allowed_line_kinds" in body.model_fields_set
    if kinds_sent:
        from ..services.tickets import quotes, store_quotes

        try:
            kinds = quotes.parse_kinds(body.allowed_line_kinds, "allowed_line_kinds")
        except costs.CostRefused as exc:
            raise _refused(conn, exc) from None
    if not store_costs.set_department_costs(conn, dept_id, body.cost_claim, body.claim_window_days, costs.iso(costs.now_utc())):
        raise ApiError(404, "department_not_found", text(conn, "המחלקה לא נמצאה."))
    if kinds_sent:
        store_quotes.set_department_kinds(conn, dept_id, kinds)
    audit(conn, actor=principal, action="ticket.department.costs", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
          request_id=rid, details={"cost_claim": body.cost_claim, "claim_window_days": body.claim_window_days,
                                   **({"allowed_line_kinds": kinds} if kinds_sent else {})})
    return get_department_costs(request, principal, conn)
