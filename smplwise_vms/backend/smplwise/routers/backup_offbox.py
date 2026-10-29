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
from ..services import backup as backup_svc
from ..services import backup_sensitive as sens
from ..services import offbox_keys, offbox_restore, offbox_runtime, offbox_store
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
    # OFFBOX-RESTORE-2300
    "object_missing": "העותק לא נמצא ביעד.",
    "object_name_invalid": "שם העותק לא תקין.",
    "key_mismatch": "העותק הוצפן במפתח שאינו מותקן כאן. יש לייבא את מפתח ההצפנה שיוצא (ייבוא מפתח) ולנסות שוב.",
    "sealed_invalid": "הקובץ אינו עותק מוצפן של Arx.",
    "sealed_damaged": "העותק פגום או שונה (נחתך, שונה או הוצפן במפתח אחר). אפשר לנסות עותק אחר.",
    "archive_invalid": "העותק נפתח אך הארכיון שבו אינו גיבוי Arx תקין.",
    "schema_newer": "העותק חדש יותר מהגרסה המותקנת. יש לעדכן את התוסף ואז לנסות שוב.",
    "disk_insufficient": "אין מספיק מקום פנוי בדיסק להורדה ולשחזור.",
    "verify_hash_mismatch": "העותק שהורד אינו תואם לגיבוב שהוזן.",
    "hash_invalid": "הגיבוב שהוזן אינו תקין (64 תווים הקסדצימליים).",
    "stage_missing": "ההכנה לשחזור לא נמצאה או שפג תוקפה. יש להכין מחדש.",
    "stage_changed": "הקובץ המוכן השתנה אחרי האימות. יש להכין מחדש.",
    "safety_failed": "לא ניתן היה לכתוב גיבוי ביטחון לפני השחזור, ולכן השחזור לא התחיל.",
    "transport_error": "שגיאת תקשורת מול היעד.",
    "io_error": "שגיאת קובץ בעת ההורדה.",
    "auth_failed": "הפרטים לכניסה ליעד נדחו.",
    "host_key_mismatch": "מפתח השרת לא תואם למפתח השמור.",
    "destination_unavailable": "היעד לא זמין.",
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


# ---------------------------------------------------------------- OFFBOX-RESTORE-2300: restore from an off-box copy

_TRANSPORT_CODES = ("destination_unavailable", "transport_error", "auth_failed", "host_key_mismatch")


class PrepareIn(BaseModel):
    target_id: str = Field(min_length=1, max_length=64)
    object: str = Field(min_length=1, max_length=200)
    # optional: the sealed copy's SHA-256 as recorded by the upload (the operator's notes); checked before decryption
    expected_sha256: str | None = Field(default=None, max_length=64)


class RestoreFromIn(BaseModel):
    stage_id: str = Field(min_length=1, max_length=64)
    confirm: str = ""
    mode: str = Field(default="replace", pattern="^(replace|merge)$")
    scope: str = Field(default="project", pattern=r"^(project|project\+access)$")
    backup_password: SecretStr | None = None
    skip_sensitive: bool = False
    # the pre-restore safety archive normally omits the sensitive section; with a password it carries it (sealed)
    safety_backup_password: SecretStr | None = None


def _secret(v: SecretStr | None) -> str | None:
    return v.get_secret_value() if v is not None else None


def _status_of(code: str) -> int:
    if code in ("push_running", "schema_newer"):
        return 409
    return 502 if code in _TRANSPORT_CODES else 422


def _audit_aside(request: Request, principal: Principal, action: str, decision: str, resource_id: str, *, reason: str | None = None,
                 details: dict[str, Any] | None = None) -> None:
    """After `release(conn)` the request connection is query-only: the outcome row is written on its own short transaction."""
    try:
        with _db(request).write_aside(label="offbox.restore.audit") as c:
            audit(c, actor=principal, action=action, decision=decision, resource_type="backup_offbox_target", resource_id=resource_id,
                  request_id=_rid(request), reason=reason, details=details)
    except Exception:  # noqa: BLE001 - the outcome row never turns a result into a 500
        pass


@router.get("/backups/offbox/targets/{target_id}/copies")
def list_copies_api(target_id: str, request: Request, principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """What the target holds, newest first (name, bytes, the time stamp in the name). Read-only at the destination."""
    require(conn, principal, "backup.manage", INSTALLATION)
    _target_or_404(conn, target_id)
    release(conn)  # no transaction across the network
    try:
        copies = offbox_restore.list_target_copies(_db(request), settings_of(request), target_id)
    except OffboxError as exc:
        raise _err(exc, _status_of(exc.code)) from None
    return {"target_id": target_id, "copies": copies}


@router.post("/backups/offbox/restore/prepare")
def restore_prepare(body: PrepareIn, request: Request, principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """STEP 1: download + decrypt + verify the copy and stage it. Changes nothing in the database or the project files."""
    require(conn, principal, "backup.manage", INSTALLATION)
    _target_or_404(conn, body.target_id)
    schema = backup_svc.schema_version(conn)
    audit(conn, actor=principal, action="backup.offbox.restore_prepare", decision="allowed", resource_type="backup_offbox_target",
          resource_id=body.target_id, request_id=_rid(request), details={"object": body.object, "phase": "start"})
    release(conn)  # no write lock across the network
    try:
        meta = offbox_restore.prepare_from_target(_db(request), settings_of(request), body.target_id, body.object, current_schema=schema,
                                                  expected_sealed_sha256=body.expected_sha256, actor=principal.user_id)
    except OffboxError as exc:
        _audit_aside(request, principal, "backup.offbox.restore_prepare", "denied", body.target_id, reason=exc.code, details={"object": body.object})
        raise _err(exc, _status_of(exc.code)) from None
    _audit_aside(request, principal, "backup.offbox.restore_prepare", "allowed", body.target_id,
                 details={"object": meta["object"], "stage_id": meta["id"], "key_id": meta["key_id"], "schema_version": meta["schema_version"],
                          "bytes": meta["plain_bytes"], "phase": "done"})
    keys = ("id", "object", "key_id", "sealed_sha256", "sealed_bytes", "plain_sha256", "plain_bytes", "app_version", "schema_version", "kind",
            "archive_created_at", "tables", "files", "sensitive", "warnings", "timings_ms")
    return {**{k: meta[k] for k in keys}, "expires_in_s": offbox_restore.STAGE_TTL_S}


@router.delete("/backups/offbox/restore/{stage_id}", status_code=204)
def restore_discard(stage_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    require(conn, principal, "backup.manage", INSTALLATION)
    offbox_restore.discard(settings_of(request), stage_id)
    audit(conn, actor=principal, action="backup.offbox.restore_discard", decision="allowed", resource_type="backup_offbox_restore", resource_id=stage_id[:16],
          request_id=_rid(request))


@router.post("/backups/offbox/restore")
def restore_from_copy(body: RestoreFromIn, request: Request, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """STEP 2 (destructive): needs the stage id of step 1 and `confirm == "RESTORE"`. Writes a pre-restore safety archive, then runs
    the existing restore (schema-newer refusal, encrypted sensitive section, capture-lease cancellation, ...)."""
    from .backup import _sensitive_error  # the one translation of a backup-password problem

    require(conn, principal, "backup.manage", INSTALLATION)
    if body.confirm != "RESTORE":
        raise ApiError(422, "confirm_required", "לאישור השחזור יש להקליד RESTORE.")
    try:
        out = offbox_restore.restore_staged(settings_of(request), conn, body.stage_id, mode=body.mode, scope=body.scope, actor_user_id=principal.user_id,
                                            backup_password=_secret(body.backup_password), skip_sensitive=body.skip_sensitive,
                                            safety_password=_secret(body.safety_backup_password))
    except sens.SensitiveError as exc:
        raise _sensitive_error(exc) from None
    except OffboxError as exc:
        raise _err(exc, 409) from None
    except ValueError as exc:
        raise ApiError(409, "restore_refused", f"השחזור נדחה: {exc}")
    meta, result = out["meta"], out["result"]
    audit(conn, actor=principal, action="backup.offbox.restore", decision="allowed", resource_type="backup_offbox_target", resource_id=meta.get("target_id") or "",
          request_id=_rid(request),
          details={"object": meta["object"], "key_id": meta["key_id"], "safety": out["safety"]["name"], "mode": body.mode, "scope": body.scope,
                   "tables": result["tables"], "files": result["files"],
                   "sensitive": {k: result["sensitive"][k] for k in ("state", "restored", "skipped", "plaintext_ignored")}})
    switch = result.get("update_apply_enabled") or {}
    audit(conn, actor=principal, action="system.update.apply_enabled", decision="allowed", resource_type="installation", resource_id="update",
          request_id=_rid(request), reason="kept_on_restore",
          details={"via": "offbox_restore", "backup": meta["object"], "mode": body.mode, "to": switch.get("kept"), "kept": switch.get("kept"),
                   "archive": switch.get("archive"), "archive_differed": bool(switch.get("differed"))})
    return {"object": meta["object"], "safety_archive": out["safety"], **result}
