"""CR-038 slice 6 - the manager board and the facet counts (docs/changes/CR-038-TICKETS-MODULE.md 8.1, 13.5-13.7):

    GET /tickets/board    tickets.manage (a manager member of a department) or tickets.all_departments with it: the sections
                          (waiting for me / stuck / in handling by assignee / recently closed), the state-strip counts (D21), the
                          department chips and the floors tree (D19) - over the tickets the caller MANAGES
    GET /tickets/handler-load?days=1|7|30   the board's gate: how many requests each handler resolved in the period (HANDLERLOAD, count per
                          assignee key only; services/tickets/handler_load.py has the definition)
    GET /tickets/dashboard?department_id=&period=today|7d|30d   the board's gate: MGRDASH phase 2, the manager overview's summary
                          (throughput, opened vs closed, waiting for my decision, RFQs to decide, the department comparison)
    GET /tickets/facets   tickets.view: counts per status / group / department / place / stuck kind over the caller's VISIBLE set
                          (the state strip and the tree of every tickets screen; slice 6b's table uses it too)

Mounted BEFORE routers/tickets.py's `/tickets/{ticket_id}` (main.py), behind the same module gate (404 `feature_disabled` while off).
Every row passes services/tickets/access.visible() - board.scan() reads through access.visible_page() only."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn
from ..errors import ApiError
from ..rbac import Principal
from ..services.tickets import access, board, dashboard, handler_load, messaging, model, settings_doc, store
from ..services.tickets.access import Viewer, text
from .tickets import ID, STATUS_FILTER, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])

PLACE = r"^(none|(site|building|floor|zone|area):[A-Za-z0-9][A-Za-z0-9_.:-]{0,95})$"
ASSIGNEE = r"^(none|(user|contact):[A-Za-z0-9][A-Za-z0-9_.-]{0,63})$"
PRIORITIES = r"^(urgent|high|normal|low)(,(urgent|high|normal|low)){0,3}$"
STUCK = r"^(any|unassigned|overdue|unopened|ack|stuck|waiting)$"


def _filters(department_id: str | None, priority: str | None, assignee: str | None, place: str | None, stuck_kind: str | None,
             waiting: bool, q: str) -> board.Filters:
    return board.Filters(department_id=department_id or None, priorities=tuple(priority.split(",")) if priority else (), assignee=assignee or None,
                         place=place or None, stuck_kind=stuck_kind or None, waiting=waiting, q=model.clean_text(q))


def _manager_gate(conn: sqlite3.Connection, viewer: Viewer) -> None:
    """The board is for managers: tickets.manage somewhere AND (a manager member of a department OR tickets.all_departments)."""
    if access.MANAGE in viewer.anywhere and (any(r == "manager" for r in viewer.roles.values()) or access.ALL_DEPARTMENTS in viewer.anywhere):
        return
    audit(conn, actor=viewer.principal, action="ticket.board", decision="denied", resource_type="installation", resource_id="*", reason="not_manager")
    raise ApiError(403, "forbidden", text(conn, "לוח המנהל פתוח למנהלי מחלקות בלבד."), details={"permission": access.MANAGE})


@router.get("/tickets/board")
def get_board(
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    department_id: str | None = Query(None, pattern=ID),
    priority: str | None = Query(None, pattern=PRIORITIES),
    assignee: str | None = Query(None, pattern=ASSIGNEE),
    place: str | None = Query(None, pattern=PLACE),
    stuck_kind: str | None = Query(None, alias="stuck", pattern=STUCK),
    waiting: bool = False,
    state: str = Query("all", pattern=r"^(all|waiting|stuck|unassigned|closed)$"),
    q: str = Query("", max_length=80),
) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    _manager_gate(conn, viewer)
    ui = settings_doc.read(conn)["ui"]
    out = board.board(conn, viewer, _filters(department_id, priority, assignee, place, stuck_kind, waiting, q), state,
                      dt.datetime.now(dt.timezone.utc), closed_since_days=7 if ui.get("closed_strip") == "week" else None)
    out["ui"] = ui
    return out


@router.get("/tickets/facets")
def get_facets(
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    scope: str = Query("visible", pattern=r"^(visible|mine|department|all)$"),
    status: str = Query("all", pattern=STATUS_FILTER),
    department_id: str | None = Query(None, pattern=ID),
    priority: str | None = Query(None, pattern=PRIORITIES),
    assignee: str | None = Query(None, pattern=ASSIGNEE),
    place: str | None = Query(None, pattern=PLACE),
    stuck_kind: str | None = Query(None, alias="stuck", pattern=STUCK),
    waiting: bool = False,
    q: str = Query("", max_length=80),
) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    if access.VIEW not in viewer.anywhere:
        audit(conn, actor=principal, action=access.VIEW, decision="denied", resource_type="installation", resource_id="*", reason="no_binding")
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה ל{tickets}."), details={"permission": access.VIEW})
    statuses = None if status == "all" else store.STATUS_GROUPS.get(status, (status,))
    return board.facets(conn, viewer, scope=scope, statuses=statuses, f=_filters(department_id, priority, assignee, place, stuck_kind, waiting, q))


@router.get("/tickets/handler-load")
def get_handler_load(
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    days: str | None = Query(None, pattern=r"^(1|7|30)$"),
) -> dict[str, Any]:
    """HANDLERLOAD: the "handled" count per handler for the period (`days` allow-list 1 / 7 / 30; omitted = the installation default
    `ui.handled_days`). The open / waiting / stuck numbers stay the board's - they are the current state, the period is for this one."""
    viewer = Viewer(conn, principal)
    _manager_gate(conn, viewer)
    ui = settings_doc.read(conn)["ui"]
    chosen = int(days) if days else int(ui["handled_days"])
    out = handler_load.handled_counts(conn, viewer, chosen, dt.datetime.now(dt.timezone.utc), messaging.time_zone(conn))
    out["default_days"] = int(ui["handled_days"])
    return out


@router.get("/tickets/dashboard")
def get_dashboard(
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    department_id: str | None = Query(None, pattern=ID),
    period: str | None = Query(None, pattern=r"^(today|7d|30d)$"),
) -> dict[str, Any]:
    """MGRDASH phase 2: the manager overview's summary route (services/tickets/dashboard.py has the definitions). The board's manager gate;
    a department the caller does not manage is an audited 403 (never an empty answer that would say the department exists). `period`
    omitted = the installation default `ui.handled_days` (the handler cards' period)."""
    viewer = Viewer(conn, principal)
    _manager_gate(conn, viewer)
    if department_id and not viewer.manages_department(department_id):
        audit(conn, actor=principal, action="ticket.dashboard", decision="denied", resource_type="ticket_department", resource_id=department_id,
              reason="department_not_managed")
        raise ApiError(403, "forbidden", text(conn, "הסקירה פתוחה רק למחלקות שבניהולך."), details={"permission": access.MANAGE})
    ui = settings_doc.read(conn)["ui"]
    chosen, _days = dashboard.period_days(period, int(ui["handled_days"]))
    out = dashboard.cached_summary(conn, viewer, department_id=department_id or None, period=chosen, now=dt.datetime.now(dt.timezone.utc),
                                   tz=messaging.time_zone(conn))
    if dashboard.CACHE.audit_due(dashboard.db_key(conn), viewer.uid):
        audit(conn, actor=principal, action="ticket.dashboard", decision="allowed", resource_type="installation", resource_id="*",
              details={"department_id": department_id, "period": chosen})
    return out
