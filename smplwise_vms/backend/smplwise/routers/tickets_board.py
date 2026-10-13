"""CR-038 slice 6 - the manager board and the facet counts (docs/changes/CR-038-TICKETS-MODULE.md 8.1, 13.5-13.7):

    GET /tickets/board    tickets.manage (a manager member of a department) or tickets.all_departments with it: the sections
                          (waiting for me / stuck / in handling by assignee / recently closed), the state-strip counts (D21), the
                          department chips and the floors tree (D19) - over the tickets the caller MANAGES
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
from ..services.tickets import access, board, model, settings_doc, store
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
