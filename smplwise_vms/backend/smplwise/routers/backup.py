"""Backups API (T026 / T036): list, create, download, upload, delete and restore project backups. Requires
`backup.manage` at installation scope; every write is audited."""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..errors import ApiError, not_found
from ..rbac import INSTALLATION, Principal, require
from ..services import backup as svc

router = APIRouter()


class CreateIn(BaseModel):
    note: str = Field(default="", max_length=200)
    include_audit: bool = False
    include_events: bool = False


class RestoreIn(BaseModel):
    mode: str = Field(default="replace", pattern="^(replace|merge)$")
    scope: str = Field(default="project", pattern="^(project|project\\+access)$")
    confirm: str = ""


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
    e = svc.create(settings_of(request), conn, "manual", body.note, include_audit=body.include_audit, include_events=body.include_events)
    audit(conn, actor=principal, action="backup.create", decision="allowed", resource_type="backup", resource_id=e["name"], request_id=_rid(request), details={"bytes": e["bytes"], "tables": e["tables"], "files": e["files"]})
    return e


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
        raise ApiError(422, "invalid_backup", "הקובץ אינו גיבוי SMPLWISE תקין.", details={"error": str(exc)})
    audit(conn, actor=principal, action="backup.upload", decision="allowed", resource_type="backup", resource_id=e["name"], request_id=_rid(request), details={"bytes": e["bytes"], "original_name": file.filename})
    return e


@router.post("/backups/{name}/restore")
def restore_backup(name: str, body: RestoreIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    if body.confirm != "RESTORE":
        raise ApiError(422, "confirm_required", "לאישור השחזור יש להקליד RESTORE.")
    p = _path(request, name)
    try:
        result = svc.restore(settings_of(request), conn, p, body.mode, body.scope, actor_user_id=principal.user_id)
    except ValueError as exc:
        raise ApiError(409, "restore_refused", f"השחזור נדחה: {exc}")
    audit(conn, actor=principal, action="backup.restore", decision="allowed", resource_type="backup", resource_id=name, request_id=_rid(request), details={"mode": body.mode, "scope": body.scope, "tables": result["tables"], "files": result["files"]})
    return {"name": name, **result}
