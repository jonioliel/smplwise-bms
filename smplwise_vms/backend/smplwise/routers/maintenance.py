"""CR-MAINT215 slice 1 - the maintenance module's API (`/api/v1/maintenance/...`, docs/changes/CR-MAINT215.md section 7).

Order of every gated route: the signed-in principal -> the module switch (404 `feature_disabled` while `maintenance.enabled` is
off - a router-level dependency, so a route added later is gated too; `GET /maintenance/module` is the one route that answers while
off) -> the permission (maintenance.view / perform / manage, an audited 403) -> the visibility rule (services/maintenance/access.py:
a task the caller may not see is the same 404 as an unknown id). Nothing here reaches a device, Home Assistant or the outside world;
a service request is created only through the tickets module, only while that module is on."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..rbac import Principal
from ..services.maintenance import access, model, service
from ..services.maintenance.access import Viewer

ID = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
TOKEN = r"^[A-Za-z0-9_-]{16,64}$"
ITEM_KEY = r"^[a-z0-9_]{1,32}$"


def module_gate(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> None:
    """Every gated maintenance route: a signed-in caller first (401), then the module switch (the uniform 404 while it is off)."""
    access.require_module(conn)


open_router = APIRouter()  # GET /maintenance/module only
router = APIRouter(dependencies=[Depends(module_gate)])


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------- the module state (answers while the module is off)

@open_router.get("/maintenance/module")
def module_state(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`{enabled, can: {view, perform, manage, open_request}}` for every signed-in user (the shell's switch)."""
    enabled = access.module_on(conn)
    v = Viewer(conn, principal)
    held = v.anywhere if enabled else frozenset()
    return {"enabled": enabled, "can": {"view": access.VIEW in held, "perform": access.PERFORM in held, "manage": access.MANAGE in held,
                                        "open_request": enabled and service.tickets_can_create(v)}}


# ---------------------------------------------------------------- tasks

class TaskBody(_Body):
    kind: Literal["certificate", "preventive", "round", "vendor_document"] | None = None
    title: str | None = Field(default=None, max_length=model.TITLE_MAX)
    category: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=model.NOTES_MAX)
    place: dict[str, Any] | None = None
    entity_id: str | None = Field(default=None, max_length=255)
    elevator_id: str | None = Field(default=None, max_length=128)
    generator_id: str | None = Field(default=None, max_length=128)
    vendor_id: str | None = Field(default=None, max_length=128)
    doc_type: str | None = Field(default=None, max_length=40)
    owner_user_id: str | None = Field(default=None, max_length=255)
    interval: dict[str, Any] | None = None
    anchor_date: str | None = Field(default=None, max_length=10)
    due_date: str | None = Field(default=None, max_length=10)
    lead_days: int | None = None
    checklist: list[dict[str, Any]] | None = Field(default=None, max_length=model.CHECKLIST_MAX)
    auto_ticket: bool | None = None
    department_id: str | None = Field(default=None, max_length=128)
    active: bool | None = None
    revision: int | None = None


@router.get("/maintenance/tasks")
def list_tasks(kind: Literal["certificate", "preventive", "round", "vendor_document"] | None = None,
               state: Literal["overdue", "due_soon", "ok", "none"] | None = None, category: str | None = Query(None, max_length=40),
               q: str = Query("", max_length=80), include_inactive: bool = False, principal: Principal = Depends(current_principal_ro),
               conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The ledger: every task the caller may see, nearest due first, with the counts per state."""
    return service.list_tasks(Viewer(conn, principal), kind=kind, state=state, category=category, q=q, include_inactive=include_inactive)


@router.post("/maintenance/tasks", status_code=201)
def create_task(body: TaskBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A certificate / inspection, a preventive plan, a round or a supplier document (maintenance.manage on its place)."""
    data = body.model_dump(exclude_unset=True)
    data.pop("revision", None)
    return service.create_task(Viewer(conn, principal), data, _rid(request))


@router.get("/maintenance/tasks/{task_id}")
def get_task(task_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """One task with its checklist, its open round and what the caller may do."""
    return service.get_task(Viewer(conn, principal), task_id)


@router.patch("/maintenance/tasks/{task_id}")
def update_task(body: TaskBody, request: Request, task_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Edit a task (maintenance.manage on its place, and on the new place when it moves); `revision` guards a concurrent edit."""
    data = body.model_dump(exclude_unset=True)
    if "kind" in data:
        from ..errors import ApiError

        raise ApiError(422, "validation", "סוג המשימה אינו ניתן לשינוי.", details={"fields": ["kind"]})
    return service.update_task(Viewer(conn, principal), task_id, data, _rid(request))


@router.delete("/maintenance/tasks/{task_id}")
def delete_task(request: Request, task_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Remove a task from the ledger (kept for the audit trail; its open round ends, its tags stop resolving)."""
    return service.delete_task(Viewer(conn, principal), task_id, _rid(request))


class CompleteBody(_Body):
    performed_on: str | None = Field(default=None, max_length=10)
    valid_until: str | None = Field(default=None, max_length=10)
    next_due: str | None = Field(default=None, max_length=10)
    note: str | None = Field(default=None, max_length=model.NOTE_MAX)
    revision: int | None = None


@router.post("/maintenance/tasks/{task_id}/complete")
def complete(body: CompleteBody, request: Request, task_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
             conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A certificate / document renewed (manage) or a plan carried out (perform): the record and the next due date."""
    return service.complete(Viewer(conn, principal), task_id, body.model_dump(exclude_unset=True), _rid(request))


@router.get("/maintenance/tasks/{task_id}/records")
def task_records(task_id: str = Path(..., pattern=ID), limit: int = Query(50, ge=1, le=service.RECORDS_MAX), principal: Principal = Depends(current_principal_ro),
                 conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The task's history: completions and rounds, newest first."""
    return service.records(Viewer(conn, principal), task_id, limit)


# ---------------------------------------------------------------- rounds

@router.post("/maintenance/tasks/{task_id}/runs", status_code=201)
def start_run(request: Request, task_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
              conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Start walking a round (maintenance.perform): one open run per round."""
    return service.start_run(Viewer(conn, principal), task_id, _rid(request))


@router.get("/maintenance/runs/{run_id}")
def get_run(run_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """A round run with its checklist snapshot and answers."""
    return service.run_out(Viewer(conn, principal), run_id)


class AnswersBody(_Body):
    answers: dict[str, dict[str, Any]] = Field(max_length=model.CHECKLIST_MAX)
    revision: int | None = None


@router.put("/maintenance/runs/{run_id}/answers")
def save_answers(body: AnswersBody, request: Request, run_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Mark checkpoints (the person who started the run, or a manager); the time of each mark is kept, never a position."""
    return service.save_answers(Viewer(conn, principal), run_id, body.model_dump(exclude_unset=True), _rid(request))


class FinishBody(_Body):
    note: str | None = Field(default=None, max_length=model.NOTE_MAX)


@router.post("/maintenance/runs/{run_id}/finish")
def finish_run(request: Request, body: FinishBody | None = None, run_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Finish a round: every required checkpoint marked; the round's next date follows."""
    return service.finish_run(Viewer(conn, principal), run_id, body.model_dump(exclude_unset=True) if body else {}, _rid(request))


@router.post("/maintenance/runs/{run_id}/cancel")
def cancel_run(request: Request, run_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Abandon an open round (its due date stays)."""
    return service.cancel_run(Viewer(conn, principal), run_id, _rid(request))


class RequestBody(_Body):
    department_id: str | None = Field(default=None, max_length=128)
    title: str | None = Field(default=None, max_length=model.TITLE_MAX)
    description: str | None = Field(default=None, max_length=model.NOTES_MAX)


@router.post("/maintenance/runs/{run_id}/items/{key}/request", status_code=201)
def request_from_item(body: RequestBody, request: Request, run_id: str = Path(..., pattern=ID), key: str = Path(..., pattern=ITEM_KEY),
                      principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Open a service request from a checkpoint (the tickets module's own path, as the person; absent while that module is off)."""
    return service.request_from_item(Viewer(conn, principal), run_id, key, body.model_dump(exclude_unset=True), _rid(request))


# ---------------------------------------------------------------- the elevator / generator / device / supplier cards

@router.get("/maintenance/by-subject/{kind}/{subject_id}")
def by_subject(kind: Literal["elevator", "generator", "entity", "vendor"], subject_id: str = Path(..., max_length=255),
               principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The tasks of one elevator, generator, device or supplier ("inspection valid until ...")."""
    return service.by_subject(Viewer(conn, principal), kind, subject_id)


@router.get("/maintenance/vendors/{vendor_id}/documents")
def vendor_documents(vendor_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro),
                     conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """A supplier's documents with their validity (insurance, electrician licence, work at height)."""
    return service.vendor_documents(Viewer(conn, principal), vendor_id)


# ---------------------------------------------------------------- QR / NFC tags

class TagBody(_Body):
    target_kind: Literal["task", "entity"]
    target_id: str = Field(min_length=1, max_length=255)
    label: str | None = Field(default=None, max_length=model.LABEL_MAX)


@router.get("/maintenance/tags")
def list_tags(include_revoked: bool = False, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The tags the caller manages (to print or revoke)."""
    return service.list_tags(Viewer(conn, principal), include_revoked)


@router.post("/maintenance/tags", status_code=201)
def create_tag(body: TagBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A new tag for a task (a round, a plan, a certificate) or a device: an opaque random token."""
    return service.create_tag(Viewer(conn, principal), body.model_dump(), _rid(request))


@router.delete("/maintenance/tags/{tag_id}")
def revoke_tag(request: Request, tag_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Revoke a tag: a scan of it then finds nothing."""
    return service.revoke_tag(Viewer(conn, principal), tag_id, _rid(request))


@router.get("/maintenance/scan/{token}")
def scan(token: str = Path(..., pattern=TOKEN), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """A scanned sticker, for a signed-in person: the task or the device it opens (unknown, revoked or not visible: the same 404)."""
    return service.scan(Viewer(conn, principal), token)
