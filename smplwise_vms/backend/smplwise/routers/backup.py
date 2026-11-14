"""Backups API (T026 / T036): list, create, download, upload, delete and restore project backups. Requires
`backup.manage` at installation scope; every write is audited. BACKUP-HASH-ENC: `backup_password` (create / restore) protects the
encrypted section (local account password hashes, the media HMAC keys); it is a SecretStr, never echoed, logged or audited -
the audit rows record only whether the section was encrypted / restored / skipped."""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, SecretStr

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..errors import ApiError, not_found
from ..rbac import INSTALLATION, Principal, require
from ..db import set_setting
from ..services import backup as svc
from ..services import backup_drill as drill
from ..services import backup_sensitive as sens
from ..services import restore_safety

router = APIRouter()


class CreateIn(BaseModel):
    note: str = Field(default="", max_length=200)
    include_audit: bool = False
    include_events: bool = False
    # BACKUP-HASH-ENC: without it the archive leaves the sensitive section out (never plaintext). Length rules are checked in
    # the service (backup_sensitive.password_bytes) so a refusal never echoes the value.
    backup_password: SecretStr | None = None


class RestoreIn(BaseModel):
    mode: str = Field(default="replace", pattern="^(replace|merge)$")
    # None: the setting `backup.local_restore_scope` (default "project+access"; owner answer 2026-10-30)
    scope: str | None = Field(default=None, pattern="^(project|project\\+access)$")
    confirm: str = ""
    backup_password: SecretStr | None = None
    # the operator's explicit choice to restore WITHOUT the encrypted section (local accounts then need an administrator's link)
    skip_sensitive: bool = False
    # OFFBOX-RESTORE-2300 (owner 2026-10-30): seals the sensitive section of the pre-restore safety archive (written first while the
    # setting `backup.safety_before_local_restore` is on, the default). Never echoed, logged or audited.
    safety_backup_password: SecretStr | None = None


SENSITIVE_MESSAGES = {
    "backup_password_required": "הגיבוי מכיל סיסמאות מוצפנות של חשבונות מקומיים. יש להקליד את סיסמת הגיבוי, או לבחור שחזור בלי הסיסמאות.",
    "backup_password_wrong": "סיסמת הגיבוי שגויה, או שהקובץ שונה. אפשר לנסות שוב, או לבחור שחזור בלי הסיסמאות.",
    "backup_password_too_long": "סיסמת הגיבוי ארוכה מדי.",
    "backup_sensitive_damaged": "החלק המוצפן של הגיבוי חסר או פגום. אפשר לבחור שחזור בלי הסיסמאות.",
    "backup_sensitive_invalid": "החלק המוצפן של הגיבוי לא עקבי (ייתכן שהקובץ שונה). השחזור נדחה.",
}


def _sensitive_error(exc: sens.SensitiveError) -> ApiError:
    can_skip = exc.code in ("backup_password_required", "backup_password_wrong", "backup_sensitive_damaged")
    if exc.code == "backup_password_weak":  # the minimum in force (setting `backup.password_min`) is named in the message
        n = exc.min_chars or sens.PASSWORD_MIN_CHARS
        return ApiError(422, exc.code, f"סיסמת הגיבוי צריכה לפחות {n} תווים.", details={"can_skip": False, "min_chars": n})
    # OFFBOX-RESTORE-2300: the password of the pre-restore safety archive (refused before anything is written)
    if exc.code == "safety_password_weak":
        n = exc.min_chars or sens.PASSWORD_MIN_CHARS
        return ApiError(422, exc.code, f"הסיסמה לגיבוי הביטחון צריכה לפחות {n} תווים.", details={"can_skip": False, "min_chars": n, "field": "safety_backup_password"})
    if exc.code == "safety_password_too_long":
        return ApiError(422, exc.code, "הסיסמה לגיבוי הביטחון ארוכה מדי.", details={"can_skip": False, "field": "safety_backup_password"})
    return ApiError(422 if exc.code == "backup_password_too_long" else 409, exc.code,
                    SENSITIVE_MESSAGES.get(exc.code, "השחזור נדחה."), details={"can_skip": can_skip})


def _secret(v: SecretStr | None) -> str | None:
    return v.get_secret_value() if v is not None else None


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _path(request: Request, name: str) -> Path:
    if not svc.NAME_RE.match(name):
        raise not_found("הגיבוי לא נמצא.")
    p = svc.backups_dir(settings_of(request)) / name
    if not p.is_file():
        raise not_found("הגיבוי לא נמצא.")
    return p


@router.get("/backups")
def list_backups_api(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    items = svc.list_backups(settings_of(request))
    return {"backups": items, "policy": svc.KEEP, "bytes": sum(i["bytes"] for i in items), "schema_version": svc.schema_version(conn)}


@router.post("/backups", status_code=201)
def create_backup(body: CreateIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    try:
        e = svc.create(settings_of(request), conn, "manual", body.note, include_audit=body.include_audit, include_events=body.include_events,
                       backup_password=_secret(body.backup_password))
    except sens.SensitiveError as exc:
        raise _sensitive_error(exc) from None
    audit(conn, actor=principal, action="backup.create", decision="allowed", resource_type="backup", resource_id=e["name"], request_id=_rid(request),
          details={"bytes": e["bytes"], "tables": e["tables"], "files": e["files"], "sensitive": (e.get("sensitive") or {}).get("state")})
    return e


# ---- DATASTORE-295: the restore drill (declared before /backups/{name}, which would otherwise match `drill`)


class DrillRunIn(BaseModel):
    name: str | None = Field(default=None, max_length=160)  # an archive of the list; default: the newest valid one
    # phase 2: drill the newest encrypted copy at this off-box target instead (downloaded and decrypted with the keyring)
    target_id: str | None = Field(default=None, max_length=64)


class DrillScheduleIn(BaseModel):
    monthly: bool


def _drill_status(request: Request, conn: sqlite3.Connection) -> dict[str, Any]:
    st = settings_of(request)
    last = drill.read_last(st)
    enabled = drill.schedule_enabled(conn)
    nxt = drill.next_due(last) if enabled else None
    return {"running": drill.running(), "last": last, "last_offbox": drill.read_last(st, drill.LAST_OFFBOX_FILE), "history": drill.read_history(st),
            "schedule": {"monthly": enabled, "next_due_at": nxt.replace(microsecond=0).isoformat().replace("+00:00", "Z") if nxt else None,
                         "due_now": enabled and nxt is None}}


@router.get("/backups/drill")
def drill_status(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    return _drill_status(request, conn)


@router.post("/backups/drill", status_code=202)
def drill_run(body: DrillRunIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    archive = _path(request, body.name) if body.name else None
    if body.target_id:
        from ..services import offbox_store

        if offbox_store.get_target(conn, body.target_id) is None:
            raise not_found("היעד לא נמצא.")
    if not drill.start_background(settings_of(request), archive, trigger="manual", db=request.app.state.db, offbox_target=body.target_id):
        raise ApiError(409, "drill_running", "בדיקת שחזור כבר רצה.")
    audit(conn, actor=principal, action="backup.drill.run", decision="allowed", resource_type="backup",
          resource_id=f"offbox:{body.target_id}" if body.target_id else (body.name or "latest"), request_id=_rid(request))
    return {"started": True, "archive": body.name, "target_id": body.target_id}


@router.put("/backups/drill/schedule")
def drill_schedule(body: DrillScheduleIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    set_setting(conn, drill.SCHEDULE_KEY, "true" if body.monthly else "false")
    audit(conn, actor=principal, action="backup.drill.schedule", decision="allowed", resource_type="installation", resource_id="backup_drill",
          request_id=_rid(request), details={"monthly": body.monthly})
    return _drill_status(request, conn)


@router.get("/backups/{name}")
def get_backup(name: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    p = _path(request, name)
    e = svc.entry(p)
    try:
        e["manifest"] = svc.read_manifest(p)
    except ValueError as exc:
        e["manifest"] = None
        e["error"] = str(exc)
    return e


@router.get("/backups/{name}/download")
def download_backup(name: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> FileResponse:
    require(conn, principal, "backup.manage", INSTALLATION)
    p = _path(request, name)
    audit(conn, actor=principal, action="backup.download", decision="allowed", resource_type="backup", resource_id=name, request_id=_rid(request))
    return FileResponse(p, media_type="application/zip", filename=name)


@router.delete("/backups/{name}", status_code=204)
def delete_backup(name: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    require(conn, principal, "backup.manage", INSTALLATION)
    p = _path(request, name)
    p.unlink()
    audit(conn, actor=principal, action="backup.delete", decision="allowed", resource_type="backup", resource_id=name, request_id=_rid(request))


@router.post("/backups/upload", status_code=201)
def upload_backup(request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    content = file.file.read(svc.MAX_UPLOAD + 1)
    try:
        e = svc.save_upload(settings_of(request), content)
    except ValueError as exc:
        raise ApiError(422, "invalid_backup", "הקובץ אינו גיבוי Arx תקין.", details={"error": str(exc)})
    audit(conn, actor=principal, action="backup.upload", decision="allowed", resource_type="backup", resource_id=e["name"], request_id=_rid(request), details={"bytes": e["bytes"], "original_name": file.filename})
    return e


@router.post("/backups/{name}/restore")
def restore_backup(name: str, body: RestoreIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    if body.confirm != "RESTORE":
        raise ApiError(422, "confirm_required", "לאישור השחזור יש להקליד RESTORE.")
    p = _path(request, name)
    st = settings_of(request)
    scope = body.scope or restore_safety.local_scope(conn)
    safety = None
    try:
        if restore_safety.local_safety_enabled(conn):  # OFFBOX-RESTORE-2300: a way back, written before anything is replaced
            restore_safety.check_password(conn, _secret(body.safety_backup_password))
            try:
                safety = restore_safety.write(st, conn, f"before restore of {name}", _secret(body.safety_backup_password))
            except sens.SensitiveError:
                raise
            except Exception as exc:  # noqa: BLE001 - a restore without its way back is never started
                raise ApiError(409, "safety_failed", "לא ניתן היה לכתוב גיבוי ביטחון לפני השחזור, ולכן השחזור לא התחיל.",
                               details={"error": type(exc).__name__}) from None
        try:
            result = svc.restore(st, conn, p, body.mode, scope, actor_user_id=principal.user_id,
                                 backup_password=_secret(body.backup_password), skip_sensitive=body.skip_sensitive)
        except BaseException:
            restore_safety.remove(st, safety)
            raise
    except sens.SensitiveError as exc:
        raise _sensitive_error(exc) from None
    except ValueError as exc:
        raise ApiError(409, "restore_refused", f"השחזור נדחה: {exc}")
    if safety:
        svc.prune(st)
    audit(conn, actor=principal, action="backup.restore", decision="allowed", resource_type="backup", resource_id=name, request_id=_rid(request), details={"mode": body.mode, "scope": scope, "tables": result["tables"], "files": result["files"],
                   "safety": safety["name"] if safety else None,
                   **({"roles_pruned": result["roles_pruned"]} if result.get("roles_pruned") else {}),
                   "sensitive": {k: result["sensitive"][k] for k in ("state", "restored", "skipped", "plaintext_ignored")},
                   **({"passwords": {k: result["passwords"][k] for k in ("restored", "kept_current", "need_reset_count", "legacy_plaintext")}} if result.get("passwords") else {})})
    switch = result.get("update_apply_enabled") or {}
    # SEC246 L4: the self-update switch is never taken from an archive; its own audit row records what was kept and what the archive held
    audit(conn, actor=principal, action="system.update.apply_enabled", decision="allowed", resource_type="installation", resource_id="update",
          request_id=_rid(request), reason="kept_on_restore",
          details={"via": "restore", "backup": name, "mode": body.mode, "to": switch.get("kept"), "kept": switch.get("kept"),
                   "archive": switch.get("archive"), "archive_differed": bool(switch.get("differed"))})
    return {"name": name, **result, "safety_archive": restore_safety.summary(safety)}
