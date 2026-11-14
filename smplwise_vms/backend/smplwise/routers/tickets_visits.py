"""CR-SVC215 slice 1 (docs/changes/CR-SVC215.md sections 3, 4 and 7): the internal API of vendor visits.

    GET   /tickets/{id}/visits                          visible ticket (the full view: members, managers, all-departments holders)
    POST  /tickets/{id}/visits                          a manager of the ticket: {planned_from, planned_to, grace_min?} - plans the
                                                        current external assignment's visit (or moves the planned one; after a miss it
                                                        reschedules)
    PATCH /tickets/{id}/visits/{vid}                    a manager: {revision, planned_from, planned_to, grace_min?}
    POST  /tickets/{id}/visits/{vid}/cancel             a manager: {revision}
    POST  /tickets/{id}/visits/{vid}/arrived            a manager or the internal assignee: {} - staff mark the arrival (or confirm
                                                        the vendor's reported one)
    POST  /tickets/{id}/visits/{vid}/missed             a manager: {revision} - by hand, no notification
    POST  /tickets/{id}/visits/{vid}/undo-claim         a manager: {revision} - cancel the vendor's declaration (owner answer 31;
                                                        `visits.staff_can_undo_claim`)
    GET   /tickets/admin/departments/{did}/visits       tickets.configure: the department's grace / detector
    PUT   /tickets/admin/departments/{did}/visits       tickets.configure: {grace_min: 0-240 | null (installation default), detect}

Order of every route: signed in -> the module switch (router dependency) -> `visits.enabled` (404 `feature_disabled`) -> the ticket's
visibility (the uniform 404) -> the role (an audited 403). Every write is one transaction with its timeline and audit rows. Mounted
BEFORE routers/tickets.py."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services.tickets import access, service, store, store_visits, visits
from ..services.tickets.access import Seen, Viewer, text
from .tickets import ID, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])

MESSAGES = {
    "no_vendor_assignment": "אין לבקשה שיוך פעיל לספק חיצוני.",
    "visit_not_planned": "הביקור אינו מתוכנן.",
    "visit_stale": "הביקור השתנה בינתיים. טענו מחדש.",
    "undo_not_allowed": "ביטול דיווח הגעה של ספק כבוי בהגדרות.",
    "not_a_claim": "ההגעה לא דווחה על ידי הספק.",
    "visit_not_found": "הביקור לא נמצא.",
}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _err(conn: sqlite3.Connection, exc: visits.VisitRefused) -> ApiError:
    if exc.status == 422:
        return ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": exc.extra.get("fields") or [{"field": "body", "code": exc.code}]})
    return ApiError(exc.status, exc.code, text(conn, MESSAGES.get(exc.code, "הפעולה נדחתה.")), details=dict(exc.extra))


def _seen(conn: sqlite3.Connection, viewer: Viewer, ticket_id: str) -> Seen:
    visits.require_enabled(conn)
    return access.require_visible(viewer, ticket_id)


def _manager(conn: sqlite3.Connection, viewer: Viewer, seen: Seen, action: str, rid: str | None) -> None:
    if not seen.manager:
        raise service.refuse(conn, viewer, action, seen.row, "not_manager", rid)


def _visit(conn: sqlite3.Connection, seen: Seen, visit_id: str) -> dict[str, Any]:
    v = store_visits.visit(conn, visit_id)
    if v is None or v["ticket_id"] != seen.row["id"]:
        raise ApiError(404, "visit_not_found", text(conn, MESSAGES["visit_not_found"]))
    return v


def _answer(conn: sqlite3.Connection, viewer: Viewer, seen: Seen) -> dict[str, Any]:
    now = visits.utcnow()
    rows = store_visits.visits_of_ticket(conn, seen.row["id"])
    asg = seen.row.get("current_assignment_id") if not seen.row.get("asg_ended_at") else None
    return {"ticket_id": seen.row["id"], "number": seen.row["number"], "visits": [visits.present(conn, v, now, manager=seen.manager) for v in rows],
            "can_plan": seen.manager and seen.row.get("asg_kind") == "contact" and bool(asg),
            "grace_min": visits.grace_for(conn, seen.row["department_id"])}


@router.get("/tickets/{ticket_id}/visits")
def get_visits(ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro),
               conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = _seen(conn, viewer, ticket_id)
    if not seen.full:  # a creator / assignee outside the department sees the card, not the management data
        return {"ticket_id": seen.row["id"], "number": seen.row["number"], "visits": [], "can_plan": False}
    return _answer(conn, viewer, seen)


class PlanBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    planned_from: str = Field(max_length=40)
    planned_to: str = Field(max_length=40)
    grace_min: StrictInt | None = Field(default=None, ge=0, le=240)


class MoveBody(PlanBody):
    revision: StrictInt = Field(ge=1)


class RevisionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: StrictInt = Field(ge=1)


class EmptyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")


@router.post("/tickets/{ticket_id}/visits")
def post_visit(body: PlanBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    seen = _seen(conn, viewer, ticket_id)
    _manager(conn, viewer, seen, "tickets.visit.plan", rid)
    now = visits.utcnow()
    try:
        a, b = visits.parse_window(conn, body.planned_from, body.planned_to, now)
        asg = store.assignment(conn, seen.row.get("current_assignment_id"))
        visits.plan(conn, seen.row, asg, planned_from=a, planned_to=b, source="manager", by_kind="user", by=viewer.uid, now=now,
                    grace=body.grace_min, actor=principal, actor_name=service.actor_name(viewer), rid=rid)
    except visits.VisitRefused as exc:
        raise _err(conn, exc) from None
    return _answer(conn, viewer, seen)


@router.patch("/tickets/{ticket_id}/visits/{visit_id}")
def patch_visit(body: MoveBody, request: Request, ticket_id: str = Path(..., pattern=ID), visit_id: str = Path(..., pattern=ID),
                principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    seen = _seen(conn, viewer, ticket_id)
    _manager(conn, viewer, seen, "tickets.visit.move", rid)
    v = _visit(conn, seen, visit_id)
    now = visits.utcnow()
    try:
        a, b = visits.parse_window(conn, body.planned_from, body.planned_to, now)
        visits.move(conn, seen.row, v, planned_from=a, planned_to=b, grace=body.grace_min, revision=body.revision, by=viewer.uid, actor=principal,
                    actor_name=service.actor_name(viewer), now=now, rid=rid)
    except visits.VisitRefused as exc:
        raise _err(conn, exc) from None
    return _answer(conn, viewer, seen)


@router.post("/tickets/{ticket_id}/visits/{visit_id}/{action}")
def post_visit_action(request: Request, body: dict[str, Any] | None = None, ticket_id: str = Path(..., pattern=ID), visit_id: str = Path(..., pattern=ID),
                      action: str = Path(..., pattern=r"^(cancel|arrived|missed|undo-claim)$"), principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    seen = _seen(conn, viewer, ticket_id)
    audit_action = {"cancel": "tickets.visit.cancel", "arrived": "tickets.visit.arrived", "missed": "tickets.visit.missed",
                    "undo-claim": "tickets.visit.undo_claim"}[action]
    if action == "arrived":
        if not (seen.manager or seen.assignee):
            raise service.refuse(conn, viewer, audit_action, seen.row, "not_manager_or_assignee", rid)
    else:
        _manager(conn, viewer, seen, audit_action, rid)
    body = body or {}
    if set(body) - {"revision"}:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": sorted(set(body) - {"revision"})[0], "code": "unknown"}]})
    revision = body.get("revision")
    if action != "arrived" and (isinstance(revision, bool) or not isinstance(revision, int) or revision < 1):
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "revision", "code": "required"}]})
    v = _visit(conn, seen, visit_id)
    now = visits.utcnow()
    name = service.actor_name(viewer)
    try:
        if action == "cancel":
            visits.cancel(conn, seen.row, v, revision=revision, by=viewer.uid, actor=principal, actor_name=name, now=now, rid=rid)
        elif action == "missed":
            visits.mark_missed(conn, seen.row, v, revision=revision, by=viewer.uid, actor=principal, actor_name=name, now=now, rid=rid)
        elif action == "undo-claim":
            visits.undo_claim(conn, seen.row, v, revision=revision, by=viewer.uid, actor=principal, actor_name=name, now=now, rid=rid)
        else:
            visits.arrive(conn, seen.row, v, by="staff", actor_ref=f"user:{viewer.uid}", now=now, actor=principal, actor_user_id=viewer.uid,
                          actor_name=name, rid=rid)
    except visits.VisitRefused as exc:
        raise _err(conn, exc) from None
    return _answer(conn, viewer, seen)


# ---------------------------------------------------------------- the department's grace and detector (owner answer 32: per department)

class DeptVisitsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    grace_min: StrictInt | None = Field(default=None, ge=0, le=240)
    detect: StrictBool


def _dept(conn: sqlite3.Connection, department_id: str) -> dict[str, Any]:
    d = store.department(conn, department_id)
    if d is None:
        raise ApiError(404, "department_not_found", text(conn, "המחלקה לא נמצאה."))
    return d


def _dept_answer(conn: sqlite3.Connection, department_id: str) -> dict[str, Any]:
    own, detect = store_visits.department_visit_settings(conn, department_id)
    return {"department_id": department_id, "grace_min": own, "detect": detect, "effective_grace_min": visits.grace_for(conn, department_id),
            "installation_grace_min": int(visits.cfg(conn)["grace_min"])}


@router.get("/tickets/admin/departments/{department_id}/visits")
def get_dept_visits(department_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro),
                    conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, access.CONFIGURE, INSTALLATION)
    visits.require_enabled(conn)
    _dept(conn, department_id)
    return _dept_answer(conn, department_id)


@router.put("/tickets/admin/departments/{department_id}/visits")
def put_dept_visits(body: DeptVisitsBody, request: Request, department_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, access.CONFIGURE, INSTALLATION)
    visits.require_enabled(conn)
    _dept(conn, department_id)
    before = _dept_answer(conn, department_id)
    store_visits.set_department_visit_settings(conn, department_id, body.grace_min, body.detect)
    audit(conn, actor=principal, action="tickets.department.visits", decision="allowed", resource_type="ticket_department", resource_id=department_id,
          request_id=_rid(request), details={"grace_min": [before["grace_min"], body.grace_min], "detect": [before["detect"], body.detect]})
    return _dept_answer(conn, department_id)
