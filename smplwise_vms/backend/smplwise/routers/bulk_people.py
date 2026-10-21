"""CR-BULKPEOPLE-295 (docs/changes/CR-BULKPEOPLE-295.md): bulk edit and CSV import / export of access-control people.

- GET  /access-control/bulk-people/settings          the switch, the go-live permit flag, the limits (people.read or .manage anywhere)
- PUT  /access-control/bulk-people/settings          `{enabled: off | on}` (system administrator; audited)
- GET  /access-control/bulk-people/template.csv      the header row (people.manage anywhere)
- GET  /access-control/bulk-people/export.csv        the people the caller may see (people.read anywhere; one a minute; row count audited)
- POST /access-control/bulk-people/jobs              a CSV file (text/csv body, `Idempotency-Key`): parse + validation report, nothing sent
- POST /access-control/bulk-people/jobs/edit         bulk edit of selected people (JSON, `Idempotency-Key`)
- GET  /access-control/bulk-people/jobs/{id}         the job (creator or system administrator; no row values)
- POST /access-control/bulk-people/jobs/{id}/dry-run the diff at the caller's level (never writes)
- POST /access-control/bulk-people/jobs/{id}/confirm `{plan_digest, confirm}` (system administrator, interactive session)
- POST /access-control/bulk-people/jobs/{id}/apply   the next bounded batch (the confirmer; refused without the go-live permit)
- POST /access-control/bulk-people/jobs/{id}/cancel  stop the job and purge its row data

Every route is refused (409 `bulk_people_off`) while the switch is off, except the settings. Each permission gate runs before the body
is read (audited 403)."""
from __future__ import annotations

import hashlib
import json
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, Path, Request
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import Principal, is_system_admin
from ..services import bulk_people as bp
from ..services import intercom_authority as ia
from ..services.access_grant_engine import EngineError

router = APIRouter()
BASE = "/access-control/bulk-people"
_JOB = r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$"
CSV_HEADERS = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _db(request: Request):
    return request.app.state.db


def _gate(permission: str):
    def dep(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
        return ia.require_anywhere(conn, principal, permission, _rid(request))

    return dep


def _on(conn: sqlite3.Connection) -> None:
    if not bp.enabled(conn):
        raise ApiError(409, "bulk_people_off", "שינוי מרוכז של אנשים כבוי. מנהל מערכת יכול להפעיל אותו בהגדרות.")


async def _file_body(request: Request) -> bytes:
    """The uploaded bytes, read with the cap (a larger body stops being read at once: 413). Declared after the permission gate."""
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > bp.MAX_FILE_BYTES:
            raise ApiError(413, "bulk_file_too_large", "הקובץ גדול מדי.", details={"max_bytes": bp.MAX_FILE_BYTES})
    return bytes(data)


def _engine_error(exc: EngineError) -> ApiError:
    if exc.kind == "not_sent":
        return ApiError(503, "intercom_unavailable", "בקרת הכניסה אינה זמינה כרגע.", retryable=True, details={"reason": exc.code})
    return ApiError(502, "bulk_engine_error", "בקרת הכניסה לא ענתה כמצופה.", details={"kind": exc.kind})


# ---------------------------------------------------------------- settings

class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: Literal["off", "on"]


@router.get(f"{BASE}/settings")
def get_settings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    auth = ia.Authority(conn, principal)
    if not (auth.anywhere(ia.PEOPLE_READ) or auth.anywhere(ia.PEOPLE_MANAGE)):
        ia.require_anywhere(conn, principal, ia.PEOPLE_READ)
    return {**bp.settings_view(conn), "system_admin": is_system_admin(conn, principal.user_id),
            "may_import": auth.anywhere(ia.PEOPLE_MANAGE), "may_export": auth.anywhere(ia.PEOPLE_READ)}


@router.put(f"{BASE}/settings")
def put_settings(body: SettingsIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    with _db(request).connection(label="bulk_people.settings") as conn:
        if not is_system_admin(conn, principal.user_id):
            audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
                  request_id=_rid(request), details={"key": bp.FLAG_KEY})
            raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לשנות הגדרה זו.")
        before = bp.settings_view(conn)["enabled"]
        bp.set_enabled(conn, body.enabled)
        audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"key": bp.FLAG_KEY, "before": before, "after": body.enabled})
        return bp.settings_view(conn)


# ---------------------------------------------------------------- template and export

@router.get(f"{BASE}/template.csv")
def template(auth: ia.Authority = Depends(_gate(ia.PEOPLE_MANAGE))) -> Response:
    _on(auth.conn)
    return Response(content=bp.template_csv(), media_type="text/csv; charset=utf-8",
                    headers={**CSV_HEADERS, "Content-Disposition": 'attachment; filename="people-template.csv"'})


@router.get(f"{BASE}/export.csv")
def export_csv(request: Request, auth: ia.Authority = Depends(_gate(ia.PEOPLE_READ))) -> Response:
    """The people the caller may see, in the import format. One a minute per user; at most 5,000 rows; audited with the row count and
    the column names only."""
    _on(auth.conn)
    principal = auth.principal
    wait = bp.export_wait(principal.user_id)
    if wait > 0:
        raise ApiError(429, "export_rate", "אפשר לייצא פעם בדקה. נסו שוב בעוד רגע.", retryable=True, details={"retry_after_s": int(wait) + 1})
    try:
        cells = bp.export_rows(auth, bp.engine(settings_of(request)))
    except EngineError as exc:
        raise _engine_error(exc) from None
    audit(auth.conn, actor=principal, action="access.bulk.export", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"rows": len(cells) - 1, "columns": list(bp.COLUMNS)})
    bp.export_mark(principal.user_id)
    return Response(content=bp.write_csv(cells), media_type="text/csv; charset=utf-8",
                    headers={**CSV_HEADERS, "Content-Disposition": 'attachment; filename="access-people.csv"', "X-Export-Rows": str(len(cells) - 1)})


# ---------------------------------------------------------------- jobs

def _job_or_404(conn: sqlite3.Connection, principal: Principal, job_id: str) -> dict[str, Any]:
    bp.expire_jobs(conn)
    job = bp._row_of(conn, job_id)
    if job is None or not bp.may_see_job(conn, principal, job):
        raise ApiError(404, "bulk_job_not_found", "המשימה לא נמצאה.")
    return job


@router.post(f"{BASE}/jobs")
def stage_import(request: Request, auth: ia.Authority = Depends(_gate(ia.PEOPLE_MANAGE)), data: bytes = Depends(_file_body),
                 idempotency_key: str = Header("", alias="Idempotency-Key", max_length=64)) -> dict[str, Any]:
    """Upload -> parse -> the validation report. Nothing is sent to WisKey. The bytes are never stored (their SHA-256 is)."""
    principal = auth.principal
    with _db(request).connection(label="bulk_people.stage") as conn:
        _on(conn)
        try:
            rows, report = bp.parse_csv(conn, data)
        except ApiError as exc:
            audit(conn, actor=principal, action="access.bulk.stage", decision="denied", resource_type="installation", resource_id="*", reason=exc.code,
                  request_id=_rid(request), details={"bytes": len(data)})
            raise
        job, replayed = bp.create_job(conn, principal, kind="import", key=idempotency_key, digest=hashlib.sha256(data).hexdigest(), rows=rows,
                                      report=report, request_id=_rid(request))
        return {"job": bp.job_view(job), "replayed": replayed}


class EditIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    person_ids: list[str] = Field(max_length=bp.MAX_EDIT_PEOPLE)
    valid_from: str | None = Field(default=None, max_length=40)
    valid_until: str | None = Field(default=None, max_length=40)
    active: bool | None = None
    doors_add: dict[str, list[int]] | None = None
    doors_remove: list[str] | None = Field(default=None, max_length=100)
    groups_add: list[str] | None = Field(default=None, max_length=bp.MAX_GROUPS)
    groups_remove: list[str] | None = Field(default=None, max_length=bp.MAX_GROUPS)


@router.post(f"{BASE}/jobs/edit")
def stage_edit(body: EditIn, request: Request, auth: ia.Authority = Depends(_gate(ia.PEOPLE_MANAGE)),
               idempotency_key: str = Header("", alias="Idempotency-Key", max_length=64)) -> dict[str, Any]:
    """Bulk edit: validity window, doors add / remove, groups add / remove, activate / deactivate - staged like an import."""
    principal = auth.principal
    request_body = body.model_dump(exclude_none=True)
    with _db(request).connection(label="bulk_people.edit") as conn:
        _on(conn)
        rows = bp.edit_rows(conn, request_body)
        report = [{"row": r["row"], "status": "ok", "codes": [], "fields": sorted(r["set"])} for r in rows]
        digest = hashlib.sha256(json.dumps(request_body, sort_keys=True).encode("utf-8")).hexdigest()
        job, replayed = bp.create_job(conn, principal, kind="edit", key=idempotency_key, digest=digest, rows=rows, report=report, request_id=_rid(request))
        return {"job": bp.job_view(job), "replayed": replayed}


@router.get(f"{BASE}/jobs/{{job_id}}")
def get_job(request: Request, job_id: str = Path(pattern=_JOB), principal: Principal = Depends(current_principal_ro),
            conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _on(conn)
    job = bp._row_of(conn, job_id)
    if job is None or not bp.may_see_job(conn, principal, job):
        raise ApiError(404, "bulk_job_not_found", "המשימה לא נמצאה.")
    return {"job": bp.job_view(job)}


@router.post(f"{BASE}/jobs/{{job_id}}/dry-run")
def dry_run(request: Request, job_id: str = Path(pattern=_JOB), auth: ia.Authority = Depends(_gate(ia.PEOPLE_MANAGE))) -> dict[str, Any]:
    """The diff at the caller's field level against one fresh directory read. Never writes to WisKey."""
    principal = auth.principal
    db = _db(request)
    with db.connection(label="bulk_people.dry_run.load") as conn:
        _on(conn)
        job = _job_or_404(conn, principal, job_id)
        if job["state"] not in ("staged", "previewed"):
            raise ApiError(409, "bulk_job_state", "המשימה כבר אינה בשלב התצוגה המקדימה.")
    try:
        plan, rows, report = bp.dry_run(auth, job, bp.engine(settings_of(request)))  # no write lock while WisKey answers
    except EngineError as exc:
        raise _engine_error(exc) from None
    with db.connection(label="bulk_people.dry_run.store") as conn:
        job = bp.store_preview(conn, job, principal, plan, report, _rid(request))
        return {"job": bp.job_view(job), "rows": rows}


class ConfirmIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plan_digest: str = Field(max_length=64)
    confirm: str = Field(max_length=16)


@router.post(f"{BASE}/jobs/{{job_id}}/confirm")
def confirm(body: ConfirmIn, request: Request, job_id: str = Path(pattern=_JOB), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    with _db(request).connection(label="bulk_people.confirm") as conn:
        _on(conn)
        job = _job_or_404(conn, principal, job_id)
        job = bp.confirm(conn, principal, job, plan_digest=body.plan_digest, typed=body.confirm, request_id=_rid(request))
        return {"job": bp.job_view(job)}


@router.post(f"{BASE}/jobs/{{job_id}}/apply")
def apply(request: Request, job_id: str = Path(pattern=_JOB), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """The next bounded batch. `more` true = call again; `stalled` true = WisKey could not be reached (resume later); the job is
    `done` when every row has a final outcome."""
    return {"job": bp.apply_batch(_db(request), principal, job_id, bp.engine(settings_of(request)), _rid(request))}


@router.post(f"{BASE}/jobs/{{job_id}}/cancel")
def cancel(request: Request, job_id: str = Path(pattern=_JOB), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    with _db(request).connection(label="bulk_people.cancel") as conn:
        job = _job_or_404(conn, principal, job_id)
        return {"job": bp.job_view(bp.cancel(conn, principal, job, _rid(request)))}
