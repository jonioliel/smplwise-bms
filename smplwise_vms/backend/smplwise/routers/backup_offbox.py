"""DATASTORE-295 phase 2: the off-box copies API (Settings > Diagnostics > Backup and restore > Off-box copies).

Every route needs `backup.manage` at installation scope (system administrators) and is audited without any credential value.
Credentials arrive as SecretStr, are sealed at once (services/offbox_store.set_secret) and never come back: the answer says only
which fields are set. A connection test, a dry run and a push touch the network: the request's transaction is committed first
(db.release), so no SQLite write lock is held across a transfer. The push itself runs on a thread (202); its result is the target's
last `push` run.

Included in main.py BEFORE routers/backup.py: `/backups/offbox` would otherwise reach `GET /backups/{name}` (a 404)."""
from __future__ import annotations

import importlib.util
import sqlite3
import threading
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, SecretStr

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import release
from ..errors import ApiError, not_found
from ..rbac import INSTALLATION, Principal, require
from ..services import offbox_keys, offbox_runtime, offbox_store
from ..services.backup_offbox import ALLOWED_FIELDS, CREDENTIAL_FIELDS, OffboxError, RetentionPolicy, build_destination

router = APIRouter()

MESSAGES = {
    "destination_invalid": "אחד השדות של היעד לא תקין.",
    "host_key_required": "יש להדביק את מפתח השרת (או טביעת ה־SHA256 שלו).",
    "credential_ref_invalid": "פרטי הגישה לא תקינים.",
    "secrets_missing": "חסרים פרטי גישה ליעד פעיל.",
    "secret_invalid": "ערך סודי לא תקין.",
    "secret_store_unavailable": "מפתח ההתקנה לא זמין; אי אפשר לשמור סודות.",
    "retention_invalid": "ערכי השמירה לא תקינים.",
    "kind_immutable": "אי אפשר לשנות את סוג היעד; יש ליצור יעד חדש.",
    "target_missing": "היעד לא נמצא.",
    "push_running": "העברה אחרת רצה כרגע.",
    "confirm_required": "נדרש אישור מפורש.",
    "key_already_exported": "המפתח כבר יוצא פעם אחת. לייצוא נוסף יש להחליף מפתח.",
    "key_missing": "אין מפתח הצפנה.",
    "key_import_invalid": "זה לא מפתח מיוצא תקין.",
    "keyring_invalid": "קובץ המפתחות פגום.",
    "destination_not_offbox": "תיקייה בתוך תיקיית הנתונים אינה עותק מחוץ למכונה.",
}


def _err(exc: OffboxError, status: int = 422) -> ApiError:
    return ApiError(status, exc.code, MESSAGES.get(exc.code, "הפעולה נדחתה."))


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _db(request: Request) -> Any:
    return request.app.state.db


class RetentionIn(BaseModel):
    keep_last: int = Field(default=3, ge=1, le=1000)
    keep_daily: int = Field(default=14, ge=0, le=1000)
    keep_weekly: int = Field(default=4, ge=0, le=1000)
    keep_monthly: int = Field(default=6, ge=0, le=1000)


class TargetIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: Literal["s3", "sftp", "local"]
    enabled: bool = False
    config: dict[str, Any] = Field(default_factory=dict)
    # field -> new value; absent = keep; "" = clear. Never echoed back.
    secrets: dict[str, SecretStr] = Field(default_factory=dict)
    retention: RetentionIn = Field(default_factory=RetentionIn)


class EnabledIn(BaseModel):
    enabled: bool


class PushIn(BaseModel):
    dry_run: bool = False


class ConfirmIn(BaseModel):
    confirm: str = ""


class ImportIn(BaseModel):
    key: SecretStr


def _clean_config(kind: str, config: dict[str, Any]) -> dict[str, Any]:
    allowed = ALLOWED_FIELDS[kind] - set(CREDENTIAL_FIELDS.get(kind, ())) - {"kind"}
    extra = sorted(set(config) - allowed)
    if extra:
        raise ApiError(422, "destination_invalid", MESSAGES["destination_invalid"], details={"fields": extra[:10]})
    out = {k: v for k, v in config.items() if v is not None}
    if kind == "sftp" and "port" in out:
        try:
            out["port"] = int(out["port"])
        except (TypeError, ValueError):
            raise ApiError(422, "destination_invalid", MESSAGES["destination_invalid"], details={"fields": ["port"]}) from None
    if kind == "s3" and "path_style" in out:
        out["path_style"] = bool(out["path_style"])
    for k, v in out.items():
        if isinstance(v, str) and len(v) > 2000:
            raise ApiError(422, "destination_invalid", MESSAGES["destination_invalid"], details={"fields": [k]})
    return out


def _validate(kind: str, config: dict[str, Any], settings: Any) -> None:
    probe = {"kind": kind, **config, **{f: f"store:offbox.probe.{f}" for f in CREDENTIAL_FIELDS.get(kind, ())}}
    try:
        build_destination(probe, data_dir=Path(settings.data_dir))
    except OffboxError as exc:
        raise _err(exc) from None


def _apply_secrets(conn: sqlite3.Connection, request: Request, target_id: str, kind: str, secrets: dict[str, SecretStr],
                   actor: str | None) -> list[str]:
    changed: list[str] = []
    for field, value in secrets.items():
        if field not in CREDENTIAL_FIELDS.get(kind, ()):
            raise ApiError(422, "secret_field_invalid", MESSAGES["destination_invalid"], details={"fields": [field]})
        raw = value.get_secret_value()
        try:
            if raw == "":
                offbox_store.clear_secret(conn, target_id, field)
            else:
                offbox_store.set_secret(conn, settings_of(request).data_dir, target_id, field, raw, actor)
        except OffboxError as exc:
            raise _err(exc) from None
        changed.append(field)
    return changed


def _precheck(kind: str, secrets: dict[str, SecretStr], enabled: bool, have: set[str]) -> None:
    """Before anything is written (an ApiError still commits the request's transaction): the secret field names, and - for an
    enabled target - that every credential is set after this request."""
    bad = sorted(f for f in secrets if f not in CREDENTIAL_FIELDS.get(kind, ()))
    if bad:
        raise ApiError(422, "secret_field_invalid", MESSAGES["destination_invalid"], details={"fields": bad[:10]})
    for f, v in secrets.items():
        if len(v.get_secret_value()) > 16384:
            raise ApiError(422, "secret_invalid", MESSAGES["secret_invalid"], details={"fields": [f]})
    after = (have | {f for f, v in secrets.items() if v.get_secret_value()}) - {f for f, v in secrets.items() if not v.get_secret_value()}
    missing = [f for f in CREDENTIAL_FIELDS.get(kind, ()) if f not in after]
    if enabled and missing:
        raise ApiError(422, "secrets_missing", MESSAGES["secrets_missing"], details={"fields": missing})


def _require_secrets(conn: sqlite3.Connection, target_id: str, kind: str, enabled: bool) -> None:
    if not enabled:
        return
    have = offbox_store.secret_state(conn, target_id)
    missing = [f for f in CREDENTIAL_FIELDS.get(kind, ()) if f not in have]
    if missing:
        raise ApiError(422, "secrets_missing", MESSAGES["secrets_missing"], details={"fields": missing})


def _target_or_404(conn: sqlite3.Connection, target_id: str) -> dict[str, Any]:
    t = offbox_store.get_target(conn, target_id)
    if t is None:
        raise not_found(MESSAGES["target_missing"])
    return t


@router.get("/backups/offbox")
def offbox_status(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    try:
        ring = offbox_keys.load(Path(settings_of(request).data_dir)).summary()
    except OffboxError as exc:
        ring = {"active": None, "keys": [], "error": exc.code}
    return {"targets": [offbox_runtime.view(conn, t) for t in offbox_store.list_targets(conn)], "key": ring,
            "running": offbox_runtime._LOCK.locked(), "transports": {"s3": True, "sftp": importlib.util.find_spec("paramiko") is not None, "local": True}}


@router.post("/backups/offbox/targets", status_code=201)
def create_target(body: TargetIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    config = _clean_config(body.kind, body.config)
    _validate(body.kind, config, settings_of(request))
    _precheck(body.kind, body.secrets, body.enabled, set())
    tid = offbox_store.insert_target(conn, name=body.name.strip(), kind=body.kind, enabled=False, config=config,
                                     retention=RetentionPolicy(**body.retention.model_dump()), actor=principal.user_id)
    changed = _apply_secrets(conn, request, tid, body.kind, body.secrets, principal.user_id)
    if body.enabled:  # only once its credentials are sealed (a sealing failure leaves a disabled target)
        offbox_store.set_enabled(conn, tid, True, principal.user_id)
    audit(conn, actor=principal, action="backup.offbox.target_create", decision="allowed", resource_type="backup_offbox_target", resource_id=tid,
          request_id=_rid(request), details={"kind": body.kind, "enabled": body.enabled, "secrets_set": sorted(changed)})
    return offbox_runtime.view(conn, _target_or_404(conn, tid))


@router.put("/backups/offbox/targets/{target_id}")
def update_target(target_id: str, body: TargetIn, request: Request, principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    cur = _target_or_404(conn, target_id)
    if body.kind != cur["kind"]:
        raise ApiError(422, "kind_immutable", MESSAGES["kind_immutable"])
    config = _clean_config(body.kind, body.config)
    _validate(body.kind, config, settings_of(request))
    _precheck(body.kind, body.secrets, body.enabled, set(offbox_store.secret_state(conn, target_id)))
    changed = _apply_secrets(conn, request, target_id, body.kind, body.secrets, principal.user_id)
    offbox_store.update_target(conn, target_id, name=body.name.strip(), enabled=body.enabled, config=config,
                               retention=RetentionPolicy(**body.retention.model_dump()), actor=principal.user_id)
    audit(conn, actor=principal, action="backup.offbox.target_update", decision="allowed", resource_type="backup_offbox_target", resource_id=target_id,
          request_id=_rid(request), details={"kind": body.kind, "enabled": body.enabled, "secrets_changed": sorted(changed)})
    return offbox_runtime.view(conn, _target_or_404(conn, target_id))


@router.patch("/backups/offbox/targets/{target_id}")
def toggle_target(target_id: str, body: EnabledIn, request: Request, principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    cur = _target_or_404(conn, target_id)
    _require_secrets(conn, target_id, cur["kind"], body.enabled)
    offbox_store.set_enabled(conn, target_id, body.enabled, principal.user_id)
    audit(conn, actor=principal, action="backup.offbox.target_update", decision="allowed", resource_type="backup_offbox_target", resource_id=target_id,
          request_id=_rid(request), details={"enabled": body.enabled})
    return offbox_runtime.view(conn, _target_or_404(conn, target_id))


@router.delete("/backups/offbox/targets/{target_id}", status_code=204)
def delete_target(target_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    require(conn, principal, "backup.manage", INSTALLATION)
    cur = _target_or_404(conn, target_id)
    offbox_store.delete_target(conn, target_id)
    audit(conn, actor=principal, action="backup.offbox.target_delete", decision="allowed", resource_type="backup_offbox_target", resource_id=target_id,
          request_id=_rid(request), details={"kind": cur["kind"]})


@router.post("/backups/offbox/targets/{target_id}/test")
def test_target(target_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    _target_or_404(conn, target_id)
    audit(conn, actor=principal, action="backup.offbox.test", decision="allowed", resource_type="backup_offbox_target", resource_id=target_id,
          request_id=_rid(request))
    release(conn)  # no write lock across the network
    try:
        return offbox_runtime.run_check(_db(request), settings_of(request), target_id)
    except OffboxError as exc:
        raise _err(exc, 409) from None


@router.post("/backups/offbox/targets/{target_id}/push", status_code=202)
def push_target(target_id: str, body: PushIn, request: Request, principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    _target_or_404(conn, target_id)
    if offbox_runtime._LOCK.locked():
        raise ApiError(409, "push_running", MESSAGES["push_running"])
    audit(conn, actor=principal, action="backup.offbox.push", decision="allowed", resource_type="backup_offbox_target", resource_id=target_id,
          request_id=_rid(request), details={"dry_run": body.dry_run})
    release(conn)
    db, st = _db(request), settings_of(request)
    if body.dry_run:  # list + plan only: quick, answered at once
        try:
            r = offbox_runtime.run_push(db, st, target_id, trigger="manual", dry_run=True)
        except OffboxError as exc:
            raise _err(exc, 409) from None
        return {"started": False, "dry_run": True, "result": {k: r.get(k) for k in ("ok", "error", "plan", "object", "timings_ms")}}

    def _go() -> None:
        try:
            offbox_runtime.run_push(db, st, target_id, trigger="manual")
        except OffboxError:
            pass

    threading.Thread(target=_go, name="offbox-push", daemon=True).start()
    return {"started": True, "dry_run": False}


@router.post("/backups/offbox/key/export")
def export_key(body: ConfirmIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The active key, ONCE per key, after the administrator typed EXPORT. The answer is the only place the key ever appears."""
    require(conn, principal, "backup.manage", INSTALLATION)
    if body.confirm != "EXPORT":
        raise ApiError(422, "confirm_required", MESSAGES["confirm_required"])
    try:
        offbox_keys.load(Path(settings_of(request).data_dir), create=True)
        kid, text = offbox_keys.export_key(Path(settings_of(request).data_dir))
    except OffboxError as exc:
        audit(conn, actor=principal, action="backup.offbox.key_export", decision="denied", resource_type="backup_offbox_key", resource_id="active",
              request_id=_rid(request), reason=exc.code)
        raise _err(exc, 409) from None
    audit(conn, actor=principal, action="backup.offbox.key_export", decision="allowed", resource_type="backup_offbox_key", resource_id=kid,
          request_id=_rid(request))
    return {"key_id": kid, "key": text}


@router.post("/backups/offbox/key/rotate")
def rotate_key(body: ConfirmIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    if body.confirm != "ROTATE":
        raise ApiError(422, "confirm_required", MESSAGES["confirm_required"])
    try:
        kr = offbox_keys.rotate(Path(settings_of(request).data_dir))
    except OffboxError as exc:
        raise _err(exc, 409) from None
    audit(conn, actor=principal, action="backup.offbox.key_rotate", decision="allowed", resource_type="backup_offbox_key", resource_id=kr.active or "",
          request_id=_rid(request), details={"keys": len(kr.keys)})
    return kr.summary()


@router.post("/backups/offbox/key/import")
def import_key(body: ImportIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    try:
        kid = offbox_keys.import_key(Path(settings_of(request).data_dir), body.key.get_secret_value())
    except OffboxError as exc:
        raise _err(exc) from None
    audit(conn, actor=principal, action="backup.offbox.key_import", decision="allowed", resource_type="backup_offbox_key", resource_id=kid,
          request_id=_rid(request))
    return offbox_keys.load(Path(settings_of(request).data_dir)).summary()
