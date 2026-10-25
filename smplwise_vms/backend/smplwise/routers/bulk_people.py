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
- PUT  /access-control/bulk-people/wiskey-csv/settings        `{enabled: off | on}` WKR5ADOPT-295 (W-006), system administrator; audited
- POST /access-control/bulk-people/jobs/{id}/wiskey-preview   the SAME file again (text/csv): WisKey's verified preview; a read, nothing is written
- POST /access-control/bulk-people/jobs/{id}/wiskey-confirm   `{preview_digest, confirm}` (system administrator, interactive): fresh preview, compare, start
- GET  /access-control/bulk-people/jobs/{id}/wiskey-result    the started operation's completion read (never a replay)

Every route is refused (409 `bulk_people_off`) while the switch is off, except the settings. Each permission gate runs before the body
is read (audited 403)."""
from __future__ import annotations

import hashlib
import json
import sqlite3
import time
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
from ..services import intercom_writes as iw
from ..services import wiskey_people_csv as wpc
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
    return {**bp.settings_view(conn), "wiskey_csv": wpc.status(conn), "system_admin": is_system_admin(conn, principal.user_id),
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
        out = {"job": bp.job_view(bp.cancel(conn, principal, job, _rid(request)))}
        wpc.drop(job_id)  # the held CSV text of a verified preview goes with the job
        return out


# ---------------------------------------------------------------- WKR5ADOPT-295 (W-006): WisKey's verified people CSV preview (default OFF)

class WiskeyCsvSettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: Literal["off", "on"]


@router.put(f"{BASE}/wiskey-csv/settings")
def put_wiskey_csv_settings(body: WiskeyCsvSettingsIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    with _db(request).connection(label="bulk_people.wiskey_csv.settings") as conn:
        if not is_system_admin(conn, principal.user_id):
            audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
                  request_id=_rid(request), details={"key": wpc.FLAG_KEY})
            raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לשנות הגדרה זו.")
        before = wpc.status(conn)["enabled"]
        wpc.set_enabled(conn, body.enabled)
        audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"key": wpc.FLAG_KEY, "before": before, "after": body.enabled})
        return wpc.status(conn)


def _csv_on(conn: sqlite3.Connection) -> None:
    _on(conn)
    if not wpc.enabled(conn):
        raise ApiError(409, "people_csv_preview_off", "אימות הקובץ מול מערכת בקרת הכניסה כבוי. מנהל מערכת יכול להפעיל אותו בהגדרות.")


def _csv_error(exc: wpc.CsvError) -> ApiError:
    """A closed set of words: the code, the outcome and (for a file refusal) column NAMES - never a value, never WisKey's text."""
    details: dict[str, Any] = {"reason": exc.code, "outcome": exc.outcome}
    if exc.fields:
        details["fields"] = list(exc.fields)
    if exc.outcome == "not_sent":
        return ApiError(503, "intercom_unavailable", "אימות הקובץ אינו זמין כרגע. דבר לא נשלח.", retryable=True, details=details)
    if exc.outcome == "unknown":
        return ApiError(502, "people_csv_unknown", "בקרת הכניסה לא ענתה כמצופה. לא נשלחה כתיבה נוספת.", details=details)
    if exc.outcome == "refused":
        return ApiError(409, "people_csv_refused", "בקרת הכניסה דחתה את הבקשה.", details=details)
    return ApiError(422, "people_csv_unsupported", "הקובץ אינו נתמך באימות מול בקרת הכניסה.", details=details)


def _csv_job(conn: sqlite3.Connection, principal: Principal, job_id: str) -> dict[str, Any]:
    _csv_on(conn)
    job = bp._row_of(conn, job_id)
    if job is None or not bp.may_see_job(conn, principal, job):
        raise ApiError(404, "bulk_job_not_found", "המשימה לא נמצאה.")
    if job["kind"] != "import":
        raise ApiError(409, "bulk_job_state", "האימות זמין רק לייבוא מקובץ.")
    if job["state"] not in ("staged", "previewed"):
        raise ApiError(409, "bulk_job_state", "המשימה כבר אינה בשלב התצוגה המקדימה.")
    return job


def _preview_view(preview: wpc.Preview, job: dict[str, Any]) -> dict[str, Any]:
    """What the screen shows: WisKey's lines and operations (no value of any cell), WisKey's expiry, Arx's own per-row counts of the job."""
    counts = bp._report_counts(json.loads(job["report_json"] or "[]"))
    creates = sum(1 for r in preview.rows if r.op == "create")
    return {"preview_digest": preview.digest, "expires_at": preview.expires_at.strftime("%Y-%m-%dT%H:%M:%SZ"), "writes": len(preview.rows),
            "creates": creates, "updates": len(preview.rows) - creates, "skipped": counts.get("skip", 0), "errors": counts.get("error", 0),
            "rows": [{"source_line": r.source_line, "op": r.op} for r in preview.rows]}


@router.post(f"{BASE}/jobs/{{job_id}}/wiskey-preview")
def wiskey_preview(request: Request, job_id: str = Path(pattern=_JOB), auth: ia.Authority = Depends(_gate(ia.PEOPLE_MANAGE)),
                   data: bytes = Depends(_file_body)) -> dict[str, Any]:
    """WisKey's own verified preview of the file the job was staged from (the same bytes: their SHA-256 must equal the job's). A READ -
    nothing is stored at WisKey, nothing is written, no intent is logged. The text is held in memory for the confirm step only."""
    principal = auth.principal
    db = _db(request)
    with db.connection(mode="read", label="bulk_people.wiskey_preview") as conn:
        job = _csv_job(conn, principal, job_id)
        if hashlib.sha256(data).hexdigest() != job["source_digest"]:
            raise ApiError(409, "csv_file_changed", "הקובץ שונה מזה שהועלה.")
        if not iw.interactive(principal):
            raise ApiError(403, "bulk_interactive_only", "אימות מול בקרת הכניסה זמין רק בהפעלה אינטראקטיבית של אדם (דפדפן).")
        rows = json.loads(job["rows_json"] or "[]")
        try:
            preview = wpc.request_preview(conn, principal, wpc.adapters_provider(), data=data, rows=rows, job_id=job_id, session_active=True)
        except wpc.CsvError as exc:
            raise _csv_error(exc) from None
    wpc.hold(job_id, wpc.Held(principal.user_id, data, rows, preview.digest, len(preview.rows), time.monotonic() + wpc.STORE_TTL_S))
    view = _preview_view(preview, job)
    with db.connection(label="bulk_people.wiskey_preview.audit") as conn:
        audit(conn, actor=principal, action="access.bulk.wiskey_preview", decision="allowed", resource_type="access_bulk_job", resource_id=job_id,
              request_id=_rid(request), details={"writes": view["writes"], "creates": view["creates"], "skipped": view["skipped"], "errors": view["errors"],
                                                 "digest": preview.digest[:16]})
    return {"job": bp.job_view(job), "preview": view}


class WiskeyConfirmIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    preview_digest: str = Field(max_length=64)
    confirm: str = Field(max_length=16)


@router.post(f"{BASE}/jobs/{{job_id}}/wiskey-confirm")
def wiskey_confirm(body: WiskeyConfirmIn, request: Request, job_id: str = Path(pattern=_JOB), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """The explicit confirm: a system administrator in an interactive session types the number of lines shown. Arx asks WisKey for a FRESH
    preview of the same file, compares it with the one the person saw (same lines, persons, digests and stamps) and only then passes the fresh
    `start` on unchanged to `features/start` (the durable intent log). A changed preview sends nothing."""
    db = _db(request)

    def deny(_conn: sqlite3.Connection, code: str, message: str, status: int = 409) -> ApiError:
        with db.connection(label="bulk_people.wiskey_confirm.denied") as wconn:  # a short write of its own: the read connection below stays a reader
            audit(wconn, actor=principal, action="access.bulk.wiskey_confirm", decision="denied", resource_type="access_bulk_job", resource_id=job_id, reason=code,
                  request_id=_rid(request))
        return ApiError(status, code, message)

    with db.connection(mode="read", label="bulk_people.wiskey_confirm.check") as conn:  # no write lock while WisKey answers the fresh preview
        job = _csv_job(conn, principal, job_id)
        if not is_system_admin(conn, principal.user_id):
            raise deny(conn, "not_system_admin", "רק מנהל מערכת יכול לאשר שינוי מרוכז.", 403)
        if not iw.interactive(principal):
            raise deny(conn, "bulk_interactive_only", "אישור שינוי מרוכז זמין רק בהפעלה אינטראקטיבית של אדם (דפדפן).", 403)
        hold = wpc.held(job_id)
        if hold is None:
            raise deny(conn, "preview_stale", "התצוגה המקדימה פגה. הריצו אותה שוב לפני האישור.")
        if body.preview_digest != hold.shown_digest:
            raise deny(conn, "bulk_plan_changed", "התוכנית השתנתה מאז שהוצגה. הריצו שוב את התצוגה המקדימה.")
        if hold.writes == 0:
            raise deny(conn, "bulk_nothing_to_apply", "אין שורות לכתיבה.")
        if body.confirm.strip() != str(hold.writes):
            raise deny(conn, "bulk_confirm_mismatch", "יש להקליד את מספר השורות שייכתבו.", 422)
        if wpc.already_started(conn, job_id):
            wpc.drop(job_id)
            raise deny(conn, "csv_already_started", "הייבוא של משימה זו כבר נשלח. לא נשלח שוב.")
        try:
            adapters = wpc.adapters_provider()
            fresh = wpc.request_preview(conn, principal, adapters, data=hold.data, rows=hold.rows, job_id=job_id, session_active=True)
        except wpc.CsvError as exc:
            raise _csv_error(exc) from None
        if fresh.digest != hold.shown_digest:
            wpc.drop(job_id)
            raise deny(conn, "preview_changed", "הנתונים בבקרת הכניסה השתנו מאז התצוגה המקדימה. הריצו אותה שוב.")
        wpc.drop(job_id)  # the file text is not needed after this point, whatever the start does
    with db.connection(label="bulk_people.wiskey_confirm.start") as conn:
        try:
            wpc.start(conn, adapters, fresh)  # the intent is stored and committed BEFORE the first byte (the write lock is handed on)
        except wpc.CsvError as exc:
            audit(conn, actor=principal, action="access.bulk.wiskey_confirm", decision="allowed" if exc.outcome == "unknown" else "denied",
                  resource_type="access_bulk_job", resource_id=job_id, reason=exc.code, request_id=_rid(request), details={"writes": hold.writes, "outcome": exc.outcome})
            if exc.outcome == "unknown":
                return {"job": bp.job_view(job), "operation": {"state": "unknown", "code": exc.code, "replay_available": False}}
            raise _csv_error(exc) from None
        audit(conn, actor=principal, action="access.bulk.wiskey_confirm", decision="allowed", resource_type="access_bulk_job", resource_id=job_id,
              request_id=_rid(request), details={"writes": hold.writes, "digest": fresh.digest[:16]})
        return {"job": bp.job_view(job), "operation": {"state": "running", "replay_available": False}}


@router.get(f"{BASE}/jobs/{{job_id}}/wiskey-result")
def wiskey_result(job_id: str = Path(pattern=_JOB), auth: ia.Authority = Depends(_gate(ia.PEOPLE_MANAGE))) -> dict[str, Any]:
    """The original completion read of the started operation (`features/result`, operation_ref only). Missing or failed = `unknown`; never replayed."""
    conn, principal = auth.conn, auth.principal
    _csv_on(conn)
    job = bp._row_of(conn, job_id)
    if job is None or not bp.may_see_job(conn, principal, job):
        raise ApiError(404, "bulk_job_not_found", "המשימה לא נמצאה.")
    operation = wpc.operation_of_job(conn, job_id)
    if operation is None:
        state = "unknown" if wpc.already_started(conn, job_id) else "not_started"
        return {"operation": {"state": state, "replay_available": False}}
    adapters = wpc.adapters_provider()
    if adapters is None:
        raise _csv_error(wpc.CsvError("direct_not_selected", "not_sent"))
    return {"operation": {**wpc.read_result(adapters, operation), "replay_available": False}}
