"""CR-MAINT215 slice 1 - the maintenance module's API (`/api/v1/maintenance/...`, docs/changes/CR-MAINT215.md section 7).

Order of every gated route: the signed-in principal -> the module switch (404 `feature_disabled` while `maintenance.enabled` is
off - a router-level dependency, so a route added later is gated too; `GET /maintenance/module` is the one route that answers while
off) -> the permission (maintenance.view / perform / manage, an audited 403) -> the visibility rule (services/maintenance/access.py:
a task the caller may not see is the same 404 as an unknown id). Nothing here reaches a device, Home Assistant or the outside world;
a service request is created only through the tickets module, only while that module is on."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Path, Query, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import Principal
from ..services.maintenance import access, files as mfiles, model, service
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
                                        "open_request": enabled and service.tickets_can_create(v)},
            "tickets_on": service._tickets_on(conn),
            # MAINT215B: the installation's default of the phone round (step | list) - every performer's screen starts from it
            "round_view": access.round_view(conn)}  # slice 2: the screens hide every request affordance while the tickets module is off


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


# ---------------------------------------------------------------- the certificate / document file (MAINT215B)

@router.post("/maintenance/tasks/{task_id}/files", status_code=201)
def add_file(request: Request, task_id: str = Path(..., pattern=ID), file: UploadFile = File(...), principal: Principal = Depends(current_principal),
             conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Attach the scanned certificate / the policy to a certificate or a supplier document (maintenance.manage on its place): a PDF
    (the tickets cost-file check) or a photographed page (the tickets image pipeline). Validated outside the write lock."""
    viewer = Viewer(conn, principal)
    service.file_precheck(viewer, task_id)
    data = file.file.read(mfiles.cost_files.PDF_MAX_BYTES + 1)
    data_dir = settings_of(request).data_dir
    try:
        with unlocked(conn):  # the decode never holds the database write lock
            stored = mfiles.store(data_dir, task_id, data)
    except mfiles.Refused as exc:
        audit(conn, actor=principal, action="maintenance.file.add", decision="denied", resource_type="maint_task", resource_id=task_id, reason=exc.code, request_id=_rid(request))
        raise ApiError(exc.status, exc.code, exc.message, retryable=exc.status == 429, details=dict(exc.details)) from None
    try:
        service.file_precheck(viewer, task_id)  # the write lock was released for the decode: the task may have changed meanwhile
        return service.file_record(viewer, task_id, stored, file.filename or "", _rid(request))
    except Exception:
        mfiles.remove(data_dir, stored.rel_path)
        raise


@router.get("/maintenance/tasks/{task_id}/files/{file_id}")
def get_file(request: Request, task_id: str = Path(..., pattern=ID), file_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro),
             conn: sqlite3.Connection = Depends(get_read_conn)) -> FileResponse:
    """The file of a task the caller may see: a PDF only as a download, never inline."""
    row = service.file_get(Viewer(conn, principal), task_id, file_id)
    try:
        path = mfiles.path_of(settings_of(request).data_dir, row["path"])
    except ValueError:
        raise ApiError(404, "maint_file_not_found", "הקובץ לא נמצא.") from None
    if not path.is_file():
        raise ApiError(404, "maint_file_not_found", "הקובץ לא נמצא.")
    h = mfiles.download_headers(row["name"], row["kind"])
    return FileResponse(path, media_type=h.pop("Content-Type"), headers=h)


@router.delete("/maintenance/tasks/{task_id}/files/{file_id}")
def delete_file(request: Request, task_id: str = Path(..., pattern=ID), file_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Remove a file (maintenance.manage on the task's place); the row stays for the audit trail, the bytes go."""
    row = service.file_delete(Viewer(conn, principal), task_id, file_id, _rid(request))
    mfiles.remove(settings_of(request).data_dir, row["path"])
    return {"id": file_id, "deleted": True}


# ---------------------------------------------------------------- the reminder log (MAINT215B)

@router.get("/maintenance/reminder-log")
def reminder_log(event: str | None = Query(None, max_length=20), task_id: str | None = Query(None, max_length=128), limit: int = Query(100, ge=1, le=service.LOG_MAX),
                 principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """What the worker sent (reminders and requests on schedule), newest first; only tasks the caller may see."""
    return service.reminder_log(Viewer(conn, principal), event, task_id, limit)


# ---------------------------------------------------------------- closing the request a plan opened (MAINT215B)

@router.get("/maintenance/close-proposal/{ticket_id}")
def close_proposal(ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """After a request was closed: the plan it belongs to (when the installation asks, and the caller may mark it done), or null."""
    return service.close_proposal(Viewer(conn, principal), ticket_id)


@router.post("/maintenance/close-proposal/{ticket_id}/confirm")
def confirm_close(request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The person said yes: the plan is marked done for its due date, he is recorded as the performer."""
    return service.confirm_close(Viewer(conn, principal), ticket_id, _rid(request))


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


@router.get("/maintenance/vendors")
def list_vendors(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Slice 2: the suppliers with the state of their documents (the picker's "insurance expired" mark)."""
    return service.vendors(Viewer(conn, principal))


@router.get("/maintenance/options")
def form_options(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Slice 2: what the task form offers a manager (places he manages, suppliers, departments, people, the defaults)."""
    return service.options(Viewer(conn, principal))


# ---------------------------------------------------------------- QR / NFC tags

class TagBody(_Body):
    target_kind: Literal["task", "entity"]
    target_id: str = Field(min_length=1, max_length=255)
    label: str | None = Field(default=None, max_length=model.LABEL_MAX)
    medium: Literal["qr", "nfc"] | None = None  # slice 2


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
def scan(token: str = Path(..., pattern=TOKEN), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A scanned sticker, for a signed-in person: the task or the device it opens (unknown, revoked or not visible: the same 404)."""
    return service.scan(Viewer(conn, principal), token)
