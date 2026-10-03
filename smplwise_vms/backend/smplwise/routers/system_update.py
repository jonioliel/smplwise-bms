"""Self-update API (CR-021 section 5). S1: the state, the manual check and the interval. S3: `POST /apply` (install the store's latest
version of this add-on), `POST /restart-platform` (restart the platform core after a configuration check) and `GET /runs/{run_id}` (the
status screen). One permission, `system.update` (system administrators only, never delegable, installation scope; owner answer 3).

Mounted under /api/v1 like every router, so the paths are /api/v1/system/update/... Errors use the project envelope; a missing permission is the
usual 403 `forbidden` (the CR called it `permission_denied`). The infrastructure's answer is never echoed: only the class of failure and its
numeric status.

S3 request order (the `auth.read_gate` pattern, review L7): the permission on the READ connection first - a refusal is 403 and audited
before a byte of the body is read -, then a cross-site request is refused (`Sec-Fetch-Site` other than `same-origin`), then the raw body
(JSON only, `confirm: true` - plain confirmation everywhere, owner answer 4), and only then the write connection. Refusals after the
permission are audited as `system.update.apply` / `system.update.restart_platform` with decision `denied`. The remote channel (CR-008) may
use these routes (owner decision D5); its cookie sessions pass the channel's own CSRF gate first."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool, ValidationError

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, read_gate, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..remote_channel import is_remote
from ..services import self_update as svc
from ..services import update_runs

router = APIRouter(prefix="/system/update")

PERMISSION = "system.update"


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    interval_hours: Literal[0, 1, 3, 6, 12, 24]


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.get("/state")
def get_state(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The page data for a holder of `system.update`. Everyone else gets `{update_available: false}` and nothing more, so the user-menu
    marker call leaks no version and no note (CR-021 section 5.1)."""
    if not authorize(conn, principal, PERMISSION, INSTALLATION).allowed:
        return {"update_available": False}
    return svc.view(conn)


@router.post("/check")
def check(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """Manual check: the store reload first, then the read. 429 `rate_limited` (1 per 30 s, 20 per hour). When the reload is refused but the
    read works the answer is 200 with `refreshed: false` and `check_result: "refresh_failed_read_ok"`. 503 `platform_not_permitted`
    (`required_role: manager`), 503 `infrastructure_unreachable`, 502 `infrastructure_error` when the read itself fails."""
    require(conn, principal, PERMISSION, INSTALLATION)
    allowed, wait = svc.take_check()
    if not allowed:
        err = ApiError(429, "rate_limited", "הבדיקה בוצעה זה עתה. נסו שוב בעוד רגע.", retryable=True, details={"retry_after_s": wait})
        return JSONResponse(status_code=429, content=err.payload(_rid(request) or ""), headers={"Retry-After": str(wait)})
    settings = settings_of(request)
    with unlocked(conn):  # the infrastructure is called without the request's write lock
        out = svc.run_check(settings, refresh=True)
    now = dt.datetime.now(dt.timezone.utc)
    svc.record(conn, out, now, refresh=True)
    audit(conn, actor=principal, action="system.update.check", decision="allowed", resource_type="installation", resource_id="update", request_id=_rid(request),
          details={"result": out.result, "refreshed": out.refreshed, "installed": out.info.installed if out.info else None, "latest": out.info.latest if out.info else None})
    if out.info is None:
        if out.result == "not_permitted":
            raise ApiError(503, "platform_not_permitted", "ל-Arx אין הרשאה לבדוק עדכונים בתשתית המערכת.", details={"required_role": "manager"})
        if out.result == "unreachable":
            raise ApiError(503, "infrastructure_unreachable", "תשתית המערכת אינה זמינה.", retryable=True)
        raise ApiError(502, "infrastructure_error", "תשתית המערכת החזירה שגיאה.", retryable=True, details={"upstream_status": out.upstream_status})
    v = svc.view(conn)
    return {"checked_at": v["checked_at"], "check_result": out.result, "installed": out.info.installed, "latest": out.info.latest,
            "update_available": out.info.update_available, "refreshed": out.refreshed}


@router.put("/settings")
def put_settings(body: SettingsIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    before = svc.get_interval(conn)
    svc.set_interval(conn, body.interval_hours)
    audit(conn, actor=principal, action="system.update.settings", decision="allowed", resource_type="installation", resource_id="update", request_id=_rid(request),
          details={"from": before, "to": body.interval_hours})
    return {"interval_hours": body.interval_hours}


# ---------------------------------------------------------------- S3: apply, restart-platform, runs

MAX_BODY_BYTES = 4096
VERSION_PATTERN = r"^[0-9A-Za-z._+-]{1,40}$"
KEY_PATTERN = r"^[A-Za-z0-9_-]{8,64}$"

_holder_ro = read_gate(lambda conn, principal: require(conn, principal, PERMISSION, INSTALLATION))


async def _capped_body(request: Request) -> bytes:
    """The raw body, read only AFTER the permission dependency, never more than MAX_BODY_BYTES."""
    declared = request.headers.get("content-length") or ""
    if declared.isdigit() and int(declared) > MAX_BODY_BYTES:
        raise ApiError(413, "payload_too_large", "הבקשה גדולה מדי.")
    data = bytearray()
    async for chunk in request.stream():
        data += chunk
        if len(data) > MAX_BODY_BYTES:
            raise ApiError(413, "payload_too_large", "הבקשה גדולה מדי.")
    return bytes(data)


class ApplyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_version: str = Field(pattern=VERSION_PATTERN)
    backup: StrictBool
    confirm: StrictBool
    idempotency_key: str = Field(pattern=KEY_PATTERN)


class RestartIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: StrictBool
    idempotency_key: str = Field(pattern=KEY_PATTERN)


def _is_json(content_type: str | None) -> bool:
    media = (content_type or "").split(";", 1)[0].strip().lower()
    return media == "application/json" or (media.startswith("application/") and media.endswith("+json"))


def _refused(conn: sqlite3.Connection, principal: Principal, request: Request, action: str, resource_id: str, exc: ApiError) -> ApiError:
    """An authorized request refused before anything was sent: one audited `denied` row, the error to raise."""
    audit(conn, actor=principal, action=action, decision="denied", resource_type="installation", resource_id=resource_id, reason=exc.code,
          request_id=_rid(request), details={"phase": "request", "remote": is_remote(request)})
    return exc


def _parse(request: Request, raw: bytes, model: type[BaseModel]) -> Any:
    """Same origin, JSON content type, body shape and `confirm: true` (the JSON literal) - in this order."""
    site = request.headers.get("sec-fetch-site")
    if site is not None and site != "same-origin":
        raise ApiError(403, "cross_site_refused", "הבקשה נדחתה: היא לא הגיעה מדף של SmplWise Arx.")
    if not _is_json(request.headers.get("content-type")):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "invalid_request", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    try:
        body = model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise ApiError(422, "invalid_request", "הבקשה אינה תקינה.", details={"fields": fields}) from None
    if body.confirm is not True:
        raise ApiError(422, "confirm_required", "יש לאשר את הפעולה.")
    return body


def _answer(request: Request, view: dict[str, Any], created: bool) -> JSONResponse:
    return JSONResponse(status_code=202 if created else 200, content=view)


def _rate_limited(request: Request, exc: ApiError) -> JSONResponse:
    wait = int(exc.details.get("retry_after_s") or 1)
    return JSONResponse(status_code=429, content=exc.payload(_rid(request) or ""), headers={"Retry-After": str(wait)})


@router.post("/apply", status_code=202)
def apply(request: Request, principal: Principal = Depends(_holder_ro), raw: bytes = Depends(_capped_body),
          conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """Install the store's latest version of this add-on (S3). Body `{target_version, backup, confirm: true, idempotency_key}`; 202 `{run_id, state}`
    (200 with the same run for a replayed key). 409 `update_in_progress` / `update_not_available` / `target_version_mismatch` / `platform_busy`
    / `nvr_write_in_progress`, 429 `rate_limited` (1 per 10 min), 503 `platform_not_permitted` / `infrastructure_unreachable`, 502."""
    try:
        body = _parse(request, raw, ApplyIn)
    except ApiError as exc:
        raise _refused(conn, principal, request, "system.update.apply", "update", exc) from None
    req = update_runs.ApplyRequest(target_version=body.target_version, backup=body.backup, idempotency_key=body.idempotency_key)
    try:
        view, created = update_runs.start_update(conn, request.app.state.db, settings_of(request), principal, req, remote=is_remote(request), request_id=_rid(request))
    except ApiError as exc:
        _refused(conn, principal, request, "system.update.apply", "update", exc)
        if exc.status == 429:
            return _rate_limited(request, exc)
        raise
    return _answer(request, view, created)


@router.post("/restart-platform", status_code=202)
def restart_platform(request: Request, principal: Principal = Depends(_holder_ro), raw: bytes = Depends(_capped_body),
                     conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """Restart the platform core (S3): a configuration check first, then the restart; Arx keeps running. Body `{confirm: true, idempotency_key}`;
    202 `{run_id, state}`. No rate limit (owner answer 8); 409 `update_in_progress` while any run is active; the outcome
    (`platform_config_invalid`, `platform_not_back`, ...) is on the run."""
    try:
        body = _parse(request, raw, RestartIn)
    except ApiError as exc:
        raise _refused(conn, principal, request, "system.update.restart_platform", "platform", exc) from None
    try:
        view, created = update_runs.start_platform_restart(conn, request.app.state.db, settings_of(request), principal,
                                                           update_runs.RestartRequest(idempotency_key=body.idempotency_key),
                                                           remote=is_remote(request), request_id=_rid(request))
    except ApiError as exc:
        raise _refused(conn, principal, request, "system.update.restart_platform", "platform", exc) from None
    return _answer(request, view, created)


@router.get("/runs/{run_id}")
def get_run(request: Request, run_id: str = Path(pattern=r"^[0-9a-f]{16}$"), principal: Principal = Depends(current_principal_ro),
            conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The status of one update / platform restart run (what the status screen polls). A run past its timeout is settled as `abandoned` here."""
    require(conn, principal, PERMISSION, INSTALLATION)
    row = update_runs.get_run(conn, run_id)
    if row is None:
        raise ApiError(404, "not_found", "הפעולה לא נמצאה.")
    if update_runs.overdue(row):
        with request.app.state.db.write_aside(label="update_runs.sweep") as w:
            update_runs.sweep_overdue(w)
            row = update_runs.get_run(w, run_id)
    return update_runs.run_view(row)
