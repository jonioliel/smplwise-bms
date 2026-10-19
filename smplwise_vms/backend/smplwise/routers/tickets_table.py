"""CR-038 slice 6b (D24, docs/changes/CR-038-TICKETS-MODULE.md section 13.6): the board TABLE's API -

    GET    /tickets/table          a visibility-filtered page with server-side sort, filters and keyset pagination (tickets.view)
    GET    /tickets/export.csv     the table's rows as CSV (tickets.manage in at least one department; 5,000 rows; 1 per minute)
    GET    /tickets/reports/monthly.csv  monthly counts per department or vendor (same gate; date range required, <= 366 days; audited)
    POST   /tickets/bulk           assign / remind / change priority / close up to 50 tickets, each checked and saved on its own
    POST   /tickets/bulk-delete    owner 14.10: full deletion of up to 50 tickets (tickets.delete; services/tickets/deletion.py)
    GET    /tickets/views          the caller's saved filters / layouts (tickets.view; own rows only)
    POST   /tickets/views          save one (at most 20)
    PATCH  /tickets/views/{view_id}
    DELETE /tickets/views/{view_id}

Mounted BEFORE routers/tickets.py (main.py), so `/tickets/table`, `/tickets/views` ... are never read as `/tickets/{ticket_id}`.
Every route sits behind the same module gate as slice 1's (404 `feature_disabled` while the module is off). Every row and every bulk
item reaches a ticket through services/tickets/access.py (visible_table_page / visible_export_rows / visible_by_id): an invisible
ticket is never listed, never exported and answers `not_found` in a bulk result. The inline status and assignee changes of the table
use slice 1's single-ticket routes (POST /tickets/{id}/status, /assign) - nothing new here."""
from __future__ import annotations

import datetime as dt
import json
import re
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import Principal
from ..services.tickets import access, bulk, export, model, monthly_report, present, store, table, table_present, views
from ..services.tickets.access import Viewer, text
from .tickets import ID, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])
BULK_ROUTE = "POST /tickets/bulk"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _invalid(conn: sqlite3.Connection, exc: table.TableError) -> ApiError:
    return ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": exc.field, "code": exc.code}]})


def _need(conn: sqlite3.Connection, viewer: Viewer, permission: str, rid: str | None = None) -> None:
    if permission in viewer.anywhere:
        return
    audit(conn, actor=viewer.principal, action=permission, decision="denied", resource_type="installation", resource_id="*", reason="no_binding", request_id=rid)
    raise ApiError(403, "forbidden", text(conn, "אין הרשאה ל{tickets}."), details={"permission": permission})


def _manages_some_department(viewer: Viewer) -> bool:
    """tickets.manage in at least one department: a manager member somewhere, or tickets.all_departments (section 13.6, export)."""
    if access.MANAGE not in viewer.anywhere:
        return False
    return access.ALL_DEPARTMENTS in viewer.anywhere or any(r == "manager" for r in viewer.roles.values())


def _query(conn: sqlite3.Connection, params: dict[str, Any], viewer: Viewer | None = None) -> tuple[table.Query, int, tuple[list[Any], str] | None]:
    try:
        query, limit, cursor = table.from_query_params(params)
        after = table.decode_cursor(cursor, query.sort, uid=viewer.uid if viewer is not None else "",
                                    fingerprint=table.filters_fingerprint(query))
    except table.TableError as exc:
        raise _invalid(conn, exc) from None
    if query.uses_costs and viewer is not None:
        _need_costs(conn, viewer)
    return query, limit, after


def _need_costs(conn: sqlite3.Connection, viewer: Viewer) -> None:
    """Slice 9: sorting / filtering by cost needs tickets.costs.view at installation scope (11A.9)."""
    if viewer.holds_installation("tickets.costs.view"):
        return
    audit(conn, actor=viewer.principal, action="ticket.costs.table", decision="denied", resource_type="installation", resource_id="*", reason="no_binding")
    raise ApiError(403, "forbidden", text(conn, "אין הרשאה לצפייה בעלויות."), details={"permission": "tickets.costs.view"})


def filter_params(
    scope: str = Query("visible", max_length=16),
    status: str = Query("open", max_length=200),
    department: str | None = Query(None, max_length=1400),
    priority: str | None = Query(None, max_length=60),
    assignee: str | None = Query(None, max_length=80),
    floor: str | None = Query(None, max_length=64),
    area: str | None = Query(None, max_length=64),
    stuck: str | None = Query(None, max_length=16),
    waiting: str | None = Query(None, max_length=16),
    created_from: str | None = Query(None, max_length=40),
    created_to: str | None = Query(None, max_length=40),
    q: str = Query("", max_length=80),
    cost_status: str | None = Query(None, max_length=80),
) -> dict[str, Any]:
    """The filter query parameters shared by the list and the export (the section 13.6 whitelist; table.py validates the values)."""
    return {"scope": scope, "status": status, "department": department, "priority": priority, "assignee": assignee, "floor": floor, "area": area,
            "stuck": stuck, "waiting": waiting, "created_from": created_from, "created_to": created_to, "q": q, "cost_status": cost_status}


# ---------------------------------------------------------------- the table's list

@router.get("/tickets/table")
def table_page(
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    filters: dict[str, Any] = Depends(filter_params),
    sort: str | None = Query(None, max_length=60),
    limit: int | None = Query(None),
    cursor: str | None = Query(None, max_length=table.CURSOR_MAX),  # TK251: the sealed cursor
) -> dict[str, Any]:
    """`{items, next_cursor, sort, limit}`: one page in the requested order, each row checked by access.visible(); a page may come back
    SHORT with a `next_cursor` (5 x limit candidates scanned) - the client keeps loading."""
    viewer = Viewer(conn, principal)
    _need(conn, viewer, access.VIEW)
    params = {**filters, "sort": sort, "limit": limit, "cursor": cursor}
    query, size, after = _query(conn, params, viewer)
    seen, position = access.visible_table_page(viewer, query, after, size)
    now = dt.datetime.now(dt.timezone.utc)
    lk = present.Lookups(conn)
    last = store.last_assignee_names(conn, [s.row["id"] for s in seen if not s.row.get("current_assignment_id")])
    items = [table_present.table_row(conn, viewer, s, lk, last, now) for s in seen]
    next_cursor = (table.encode_cursor(query.sort, position[0], position[1], uid=viewer.uid, fingerprint=table.filters_fingerprint(query))
                   if position else None)
    return {"items": items, "next_cursor": next_cursor, "sort": query.sort_text, "limit": size, "filters": query.filters.as_dict()}


# ---------------------------------------------------------------- CSV export

@router.get("/tickets/export.csv")
def export_csv(
    request: Request,
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    filters: dict[str, Any] = Depends(filter_params),
    sort: str | None = Query(None, max_length=60),
    columns: str | None = Query(None, max_length=200),
    lang: Literal["he", "en"] = Query("he"),
) -> StreamingResponse:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    if not _manages_some_department(viewer):
        audit(conn, actor=principal, action="ticket.export", decision="denied", resource_type="installation", resource_id="*", reason="not_manager", request_id=rid)
        raise ApiError(403, "forbidden", text(conn, "ייצוא זמין למנהלי מחלקות."), details={"permission": access.MANAGE})
    wait = export.rate_check(principal.user_id)
    if wait > 0:
        raise ApiError(429, "export_rate", text(conn, "אפשר לייצא פעם בדקה. נסו שוב בעוד רגע."), retryable=True, details={"retry_after_s": int(wait) + 1})
    query, _limit, _after = _query(conn, {**filters, "sort": sort}, viewer)
    try:
        cols = table.parse_columns(columns, require=False)
    except table.TableError as exc:
        raise _invalid(conn, exc) from None
    if set(cols) & set(table.COST_KEYS):
        _need_costs(conn, viewer)  # slice 9: the cost columns of the CSV need tickets.costs.view
    try:
        rows = access.visible_export_rows(viewer, query)
    except access.ExportTooLarge:
        raise ApiError(413, "export_too_large", text(conn, "יותר מדי שורות לייצוא. צמצמו את הסינון."), details={"max_rows": access.EXPORT_MAX_ROWS}) from None
    cells = export.build(conn, viewer, rows, cols, lang)
    audit(conn, actor=principal, action="ticket.export", decision="allowed", resource_type="ticket", resource_id="*", request_id=rid,
          details={**export.describe(query, cols), "rows": len(rows)})
    export.mark(principal.user_id)
    return StreamingResponse(export.stream(cells), media_type="text/csv; charset=utf-8", headers={
        "Content-Disposition": f'attachment; filename="{export.filename(conn, lang)}"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Export-Rows": str(len(rows)),
    })


@router.get("/tickets/reports/monthly.csv")
def monthly_report_csv(
    request: Request,
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    date_from: str | None = Query(None, alias="from", max_length=10),
    date_to: str | None = Query(None, alias="to", max_length=10),
    group: Literal["department", "vendor"] = Query("department"),
    lang: Literal["he", "en"] = Query("he"),
) -> StreamingResponse:
    """Backlog item of section 18A: opened / closed counts per month and department or vendor over the caller's VISIBLE tickets."""
    from ..db import get_setting

    viewer = Viewer(conn, principal)
    rid = _rid(request)
    if not _manages_some_department(viewer):
        audit(conn, actor=principal, action="ticket.report_export", decision="denied", resource_type="installation", resource_id="*", reason="not_manager", request_id=rid)
        raise ApiError(403, "forbidden", text(conn, "ייצוא זמין למנהלי מחלקות."), details={"permission": access.MANAGE})
    try:
        d_from, d_to, start, end = monthly_report.parse_range(date_from, date_to, get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")
    except monthly_report.RangeError as exc:
        raise ApiError(422, "validation", text(conn, "טווח תאריכים לא תקין."), details={"fields": [{"field": exc.field, "code": exc.code}]}) from None
    key = monthly_report.RATE_PREFIX + principal.user_id
    wait = export.rate_check(key)
    if wait > 0:
        raise ApiError(429, "export_rate", text(conn, "אפשר לייצא פעם בדקה. נסו שוב בעוד רגע."), retryable=True, details={"retry_after_s": int(wait) + 1})
    query, _limit, _after = _query(conn, {"scope": "visible", "status": "all", "created_from": start, "created_to": end}, viewer)
    try:
        rows = access.visible_export_rows(viewer, query)
    except access.ExportTooLarge:
        raise ApiError(413, "export_too_large", text(conn, "יותר מדי שורות לייצוא. צמצמו את הסינון."), details={"max_rows": access.EXPORT_MAX_ROWS}) from None
    cells = monthly_report.build(conn, rows, group, lang)
    audit(conn, actor=principal, action="ticket.report_export", decision="allowed", resource_type="ticket", resource_id="*", request_id=rid,
          details={"report": "monthly", "group": group, "from": d_from.isoformat(), "to": d_to.isoformat(), "tickets": len(rows), "lines": len(cells) - 1})
    export.mark(key)
    return StreamingResponse(export.stream(cells), media_type="text/csv; charset=utf-8", headers={
        "Content-Disposition": f'attachment; filename="{monthly_report.filename(conn, group, d_from, d_to)}"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Export-Rows": str(len(cells) - 1),
    })


# ---------------------------------------------------------------- bulk actions

class BulkItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=64, pattern=ID)
    revision: int = Field(ge=1)


class BulkAssignee(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["user", "contact"]
    id: str = Field(min_length=1, max_length=64, pattern=ID)


class BulkParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    assignee: BulkAssignee | None = None
    priority_key: str | None = Field(default=None, max_length=16)
    note: str | None = Field(default=None, max_length=20000)


class BulkBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: str = Field(min_length=1, max_length=16)
    items: list[BulkItem] = Field(max_length=200)  # the real cap (50) is the service's: a 422 that names it
    params: BulkParams = Field(default_factory=BulkParams)
    client_request_id: str = Field(min_length=8, max_length=64, pattern=model.CLIENT_REQUEST_RE.pattern)


@router.post("/tickets/bulk")
def post_bulk(body: BulkBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """`{action, total, done, counts, results: [{id, number?, result}]}` - one result per ticket, not all-or-nothing (13.6)."""
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    _need(conn, viewer, access.MANAGE, rid)
    scope = f"user:{principal.user_id}"
    prev = store.request_get(conn, scope, body.client_request_id)
    if prev is not None:  # a retry after a lost answer: the first answer, nothing done twice
        if prev["route"] != BULK_ROUTE:
            raise ApiError(409, "request_id_reused", text(conn, "מזהה הבקשה כבר שימש לפעולה אחרת."))
        return JSONResponse(json.loads(prev["response_json"]), status_code=int(prev["status_code"]))
    items = [(i.id, i.revision) for i in body.items]
    raw = {"assignee_kind": body.params.assignee.kind if body.params.assignee else "", "assignee_id": body.params.assignee.id if body.params.assignee else "",
           "priority_key": body.params.priority_key or "", "note": body.params.note}
    params = bulk.validate(conn, body.action, items, raw)
    answer = bulk.run(conn, viewer, body.action, items, params, rid)
    store.request_put(conn, scope, body.client_request_id, BULK_ROUTE, 200, answer)
    return answer


class BulkDeleteBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[str] = Field(max_length=200)  # the real cap (50) is the service's: a 422 that names it
    reason: str = Field(max_length=2000)
    confirm_count: int = Field(ge=0)  # the number of selected tickets as the manager typed it
    client_request_id: str = Field(min_length=8, max_length=64, pattern=model.CLIENT_REQUEST_RE.pattern)


BULK_DELETE_ROUTE = "POST /tickets/bulk-delete"


@router.post("/tickets/bulk-delete")
def post_bulk_delete(body: BulkDeleteBody, request: Request, principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """Owner 14.10: delete up to 50 tickets, each checked on its own exactly as the single route (services/tickets/deletion.py) and
    removed in its own savepoint: `{total, done, counts, results: [{id, number?, result}]}`, result ok | not_found | forbidden |
    cost_claim_approved. The whole request: an interactive session, tickets.delete held somewhere, the typed count equal to the number
    of ids, a reason, and room for all of them in the hour's budget (429 `delete_rate` otherwise)."""
    from ..db import commit_now
    from ..auth import settings_of
    from ..services.tickets import attachments, deletion

    viewer = Viewer(conn, principal)
    rid = _rid(request)
    deletion.require_interactive(conn, viewer, rid)
    _need(conn, viewer, access.DELETE, rid)
    scope = f"user:{principal.user_id}"
    prev = store.request_get(conn, scope, body.client_request_id)
    if prev is not None:
        if prev["route"] != BULK_DELETE_ROUTE:
            raise ApiError(409, "request_id_reused", text(conn, "מזהה הבקשה כבר שימש לפעולה אחרת."))
        return JSONResponse(json.loads(prev["response_json"]), status_code=int(prev["status_code"]))
    problems: list[model.Problem] = []
    if not body.ids:
        problems.append(model.Problem("ids", "required"))
    elif len(body.ids) > deletion.BULK_MAX:
        problems.append(model.Problem("ids", "too_many"))
    elif len(set(body.ids)) != len(body.ids) or any(not re.fullmatch(ID, i) for i in body.ids):
        problems.append(model.Problem("ids", "invalid"))
    elif body.confirm_count != len(body.ids):
        problems.append(model.Problem("confirm_count", "mismatch"))
    if problems:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": p.field, "code": p.code} for p in problems]})
    reason = deletion.clean_reason(conn, body.reason)
    deletion.require_rate(conn, viewer, len(body.ids), rid)
    results: list[dict[str, Any]] = []
    deleted: list[str] = []
    for ticket_id in body.ids:
        seen = access.visible_by_id(viewer, ticket_id)
        if seen is None:
            audit(conn, actor=principal, action=deletion.ACTION, decision="denied", resource_type="ticket", resource_id=ticket_id, reason="not_found",
                  request_id=rid, details={"bulk": True})
            results.append({"id": ticket_id, "result": "not_found"})
            continue
        chk = deletion.check(viewer, seen)
        if chk.result != "ok":
            deletion.refuse(conn, viewer, seen, chk, rid, bulk=True)
            results.append({"id": ticket_id, "number": seen.row["number"], "result": chk.result})
            continue
        with store.item_transaction(conn, "ticket_delete"):
            done = deletion.delete(conn, viewer, seen, chk, reason, rid, bulk=True)
        deletion.rate_mark(principal.user_id)
        deleted.append(done.ticket_id)
        results.append({"id": ticket_id, "number": done.number, "result": "ok"})
    counts: dict[str, int] = {}
    for r in results:
        counts[r["result"]] = counts.get(r["result"], 0) + 1
    audit(conn, actor=principal, action="ticket.bulk", decision="allowed", resource_type="ticket", resource_id="*", request_id=rid,
          details={"action": "delete", "total": len(body.ids), "counts": counts})
    answer = {"action": "delete", "total": len(body.ids), "done": counts.get("ok", 0), "counts": counts, "results": results}
    store.request_put(conn, scope, body.client_request_id, BULK_DELETE_ROUTE, 200, answer)
    commit_now(conn, keep_reading=False)
    if deleted:
        deletion.remove_files(settings_of(request).data_dir / attachments.DIR, deleted)
    return answer


# ---------------------------------------------------------------- saved views (private to the user)

class ViewBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(max_length=2000)
    view: dict[str, Any]


class ViewPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, max_length=2000)
    view: dict[str, Any] | None = None


def _view_not_found(conn: sqlite3.Connection) -> ApiError:
    return ApiError(404, "view_not_found", text(conn, "התצוגה השמורה לא נמצאה."))


def _clean(conn: sqlite3.Connection, name: Any, view: Any) -> tuple[str | None, dict[str, Any] | None]:
    try:
        clean_name = views.clean_name(name) if name is not None else None
    except model.Invalid as exc:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": p.field, "code": p.code} for p in exc.problems]}) from None
    try:
        doc = views.normalize(view) if view is not None else None
    except table.TableError as exc:
        raise _invalid(conn, exc) from None
    return clean_name, doc


@router.get("/tickets/views")
def list_views(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    _need(conn, viewer, access.VIEW)
    return {"items": [views.present(r) for r in store.saved_views(conn, principal.user_id)], "max": views.MAX_PER_USER}


@router.post("/tickets/views", status_code=201)
def create_view(body: ViewBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    _need(conn, viewer, access.VIEW)
    name, doc = _clean(conn, body.name, body.view)
    assert name is not None and doc is not None
    if store.saved_view_count(conn, principal.user_id) >= views.MAX_PER_USER:
        raise ApiError(409, "too_many_views", text(conn, "אפשר לשמור עד 20 תצוגות."), details={"max": views.MAX_PER_USER})
    if store.saved_view_name_taken(conn, principal.user_id, name):
        raise ApiError(409, "view_name_taken", text(conn, "כבר יש תצוגה בשם הזה."))
    view_id = store.insert_saved_view(conn, principal.user_id, name, views.dump(doc))
    return views.present(store.saved_view(conn, principal.user_id, view_id) or {})


@router.patch("/tickets/views/{view_id}")
def patch_view(body: ViewPatch, view_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    _need(conn, viewer, access.VIEW)
    if store.saved_view(conn, principal.user_id, view_id) is None:
        raise _view_not_found(conn)
    name, doc = _clean(conn, body.name, body.view)
    fields: dict[str, Any] = {}
    if name is not None:
        if store.saved_view_name_taken(conn, principal.user_id, name, except_id=view_id):
            raise ApiError(409, "view_name_taken", text(conn, "כבר יש תצוגה בשם הזה."))
        fields["name"] = name
    if doc is not None:
        fields["view_json"] = views.dump(doc)
    store.update_saved_view(conn, principal.user_id, view_id, fields)
    return views.present(store.saved_view(conn, principal.user_id, view_id) or {})


@router.delete("/tickets/views/{view_id}")
def delete_view(view_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    _need(conn, viewer, access.VIEW)
    if not store.delete_saved_view(conn, principal.user_id, view_id):
        raise _view_not_found(conn)
    return {"deleted": view_id}
