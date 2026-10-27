"""SUPPLIERDOCS-297 - reading a supplier certificate attached to a maintenance task (docs/changes/CR-SUPPLIERDOCS-297.md).

Order of every route: the signed-in principal -> the maintenance module switch (404 `feature_disabled`) -> the document-reading switch
`docread.enabled` (404 `feature_disabled`, default OFF; `GET /maintenance/docread/module` is the one route that answers while it is
off) -> the permission (maintenance.manage to read and to decide, an audited 403; maintenance.view to look) -> the task's visibility
rule (an invisible task is the same 404 as an unknown one). Nothing here reaches a device, the network or a model; the only child
process is the text reader, run outside the database write lock.

There is deliberately NO "approve all" route: a field is confirmed, edited or rejected on its own (`PUT .../fields/{field}`)."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import Principal
from ..services.docread import service as dsvc
from ..services.maintenance import access as maccess
from ..services.maintenance import files as mfiles
from ..services.maintenance.access import Viewer

ID = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
FieldName = Literal["supplier", "document_number", "issue_date", "expiry_date", "scope"]


def module_gate(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> None:
    maccess.require_module(conn)


def feature_gate(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> None:
    maccess.require_module(conn)
    dsvc.require_enabled(conn)


open_router = APIRouter(dependencies=[Depends(module_gate)])  # GET /maintenance/docread/module only
router = APIRouter(dependencies=[Depends(feature_gate)])


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@open_router.get("/maintenance/docread/module")
def module_state(conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`{enabled, kinds, fields, text_reader, ocr, model, confirm, provisional}`: what document reading can do on this installation."""
    return dsvc.module_state(conn)


@router.post("/maintenance/tasks/{task_id}/files/{file_id}/read", status_code=201)
def read_file(request: Request, response: Response, task_id: str = Path(..., pattern=ID), file_id: str = Path(..., pattern=ID),
              principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Read an attached certificate into PROPOSED fields (maintenance.manage on the task). The task itself does not change. The live
    proposal of the same file comes back (200) instead of a second read; discard it to read again."""
    viewer = Viewer(conn, principal)
    task, frow = dsvc.read_precheck(viewer, task_id, file_id)
    live = dsvc.live_for(conn, file_id)
    if live is not None:
        response.status_code = 200
        return dsvc.out(conn, live, viewer, task)
    try:
        path = mfiles.path_of(settings_of(request).data_dir, frow["path"])
    except ValueError:
        raise ApiError(404, "maint_file_not_found", "הקובץ לא נמצא.") from None
    if not path.is_file():
        raise ApiError(404, "maint_file_not_found", "הקובץ לא נמצא.")
    with unlocked(conn):  # the child process never holds the database write lock
        res = dsvc.run_reader(frow["kind"], path)
    task, frow = dsvc.read_precheck(viewer, task_id, file_id)  # the lock was released: re-check
    live = dsvc.live_for(conn, file_id)
    if live is not None:
        response.status_code = 200
        return dsvc.out(conn, live, viewer, task)
    if res.status == "unavailable":
        audit(conn, actor=principal, action="docread.read", decision="denied", resource_type="maint_task", resource_id=task_id, reason="reader_unavailable",
              request_id=_rid(request))
        raise ApiError(503, "reader_unavailable", "אין בשרת כלי לקריאת קובצי PDF.", retryable=False)
    return dsvc.out(conn, dsvc.store(viewer, task, frow, res, _rid(request)), viewer, task)


@router.get("/maintenance/tasks/{task_id}/files/{file_id}/extraction")
def file_extraction(task_id: str = Path(..., pattern=ID), file_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro),
                    conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any] | None:
    """The live proposal of an attached file, or null (maintenance.view on the task)."""
    return dsvc.for_file(Viewer(conn, principal), task_id, file_id)


@router.get("/maintenance/docread/extractions/{xid}")
def get_extraction(xid: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro),
                   conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """One proposal with every field's proposed value, confidence, evidence, snippet and decision (maintenance.view on the task)."""
    return dsvc.get(Viewer(conn, principal), xid)


class DecisionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["confirm", "edit", "reject"]
    value: str | None = Field(default=None, max_length=400)
    revision: int


@router.put("/maintenance/docread/extractions/{xid}/fields/{field}")
def decide_field(body: DecisionBody, request: Request, xid: str = Path(..., pattern=ID), field: FieldName = Path(...),
                 principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Decide ONE field (maintenance.manage): confirm the proposed value, edit it (the person's value, validated), or reject it.
    `revision` guards a concurrent decision. When every field is decided the proposal is `reviewed`."""
    return dsvc.decide(Viewer(conn, principal), xid, field, body.model_dump(), _rid(request))


@router.post("/maintenance/docread/extractions/{xid}/discard")
def discard_extraction(request: Request, xid: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                       conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Drop a proposal (maintenance.manage): its values are deleted at once; the file can then be read again."""
    return dsvc.discard(Viewer(conn, principal), xid, _rid(request))
