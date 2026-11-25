"""LEGACY-MIGRATION-2550 (T070): import from the legacy "Hikvision NVR Panel" add-on (v1.5.27), system administrators only.

- GET  /migration/legacy          the runs so far, the upload limit, the confirm word
- POST /migration/legacy/dry-run  the body is the file (a JSON document, a ZIP / TAR of the legacy files, the export written by
                                  scripts/migrate_legacy.py --export, or an unprotected Home Assistant backup up to the limit):
                                  the report of what would be created / changed / kept / skipped / left to a person, and its
                                  `plan_digest`. Nothing is written (an audit row only).
- POST /migration/legacy/apply?plan_digest=&confirm=   the SAME file again: the plan is made again, compared with the digest the
                                  administrator looked at (409 `legacy_plan_changed` otherwise), a project backup is written first
                                  and then only the empty camera aliases are filled. Interactive session (a person in a browser)
                                  and the typed confirm word (confirm_words `legacy_import_apply`) are required.

The file is never stored (its SHA-256 is, in the run record); the reader reduces every password / PIN to set / empty and every
host to a digest before anything else sees it (services/legacy_source.py). Each permission gate runs before the body is read."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn, settings_of
from ..errors import ApiError
from ..i18n import lang_of
from ..rbac import Principal, require_system_admin
from ..services import confirm_words
from ..services import legacy_import as li
from ..services import legacy_source as ls
from ._common import db_of as _db, rid as _rid
from ..wire import legacy_migration as W
from ..wire import wire

router = APIRouter()
BASE = "/migration/legacy"
CONFIRM_KEY = "legacy_import_apply"
NOT_ADMIN_HE = "רק מנהל מערכת יכול לייבא מהמערכת הישנה."


def _admin(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    require_system_admin(conn, principal, action="migration.legacy.read", request_id=_rid(request), text=NOT_ADMIN_HE)
    return principal


async def _file_body(request: Request) -> bytes:
    """The uploaded bytes with the cap (a larger body stops being read at once: 413). Declared after the permission gate."""
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > ls.MAX_INPUT_BYTES:
            raise ApiError(413, "legacy_file_too_large", "הקובץ גדול מדי. אפשר להעלות את קובצי המערכת הישנה עצמם או ייצוא שלהם.",
                           details={"max_bytes": ls.MAX_INPUT_BYTES})
    return bytes(data)


def _read(conn: sqlite3.Connection, principal: Principal, request: Request, data: bytes, action: str) -> ls.LegacySource:
    try:
        return ls.read_bytes(data)
    except ls.SourceError as exc:
        audit(conn, actor=principal, action=action, decision="denied", resource_type="installation", resource_id="legacy", reason=exc.code,
              request_id=_rid(request), details={"bytes": len(data)})
        if exc.code == "protected_backup":
            raise ApiError(422, "legacy_backup_protected", "הגיבוי מוצפן. יש להעלות את קובצי המערכת הישנה עצמם או ייצוא שלהם.",
                           details={"reason": exc.code}) from None
        raise ApiError(422, "legacy_source_invalid", "הקובץ אינו קובץ של המערכת הישנה שאפשר לקרוא.", details={"reason": exc.code}) from None


@router.get(BASE, **wire(W.LegacyImportStatus))
def status(request: Request, principal: Principal = Depends(_admin), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return {"runs": li.runs(conn), "max_bytes": ls.MAX_INPUT_BYTES, "backup_kind": li.BACKUP_KIND,
            "confirm": {"he": confirm_words.he(CONFIRM_KEY), "en": confirm_words.en(CONFIRM_KEY)}, "legacy_version": ls.LEGACY_VERSION_KNOWN}


@router.post(f"{BASE}/dry-run", **wire(W.LegacyImportReport))
def dry_run(request: Request, principal: Principal = Depends(_admin), data: bytes = Depends(_file_body)) -> dict[str, Any]:
    """The report of what an apply would do; nothing is written (an audit row only)."""
    with _db(request).connection(label="legacy_migration.dry_run") as conn:
        src = _read(conn, principal, request, data, "migration.legacy.dry_run")
        report = li.plan(conn, settings_of(request), src, lang_of(conn, principal))
        audit(conn, actor=principal, action="migration.legacy.dry_run", decision="allowed", resource_type="installation", resource_id="legacy",
              request_id=_rid(request), details={"sha256": src.sha256, "container": src.container, "summary": report["summary"]})
        return report


def _apply_gate(request: Request, principal: Principal = Depends(_admin), conn: sqlite3.Connection = Depends(get_read_conn),
                confirm: str = Query("", max_length=64)) -> tuple[Principal, str]:
    from ..services.intercom_writes import interactive

    if not interactive(principal):
        audit(conn, actor=principal, action="migration.legacy.apply", decision="denied", resource_type="installation", resource_id="legacy",
              reason="not_interactive", request_id=_rid(request))
        raise ApiError(403, "interactive_session_required", "ייבוא מהמערכת הישנה זמין רק מהפעלה אינטראקטיבית בדפדפן.")
    lang = confirm_words.typed_lang(CONFIRM_KEY, confirm)
    if lang is None:
        raise ApiError(422, "confirm_required", "לאישור הייבוא יש להקליד את מילת האישור.",
                       details={"confirm_he": confirm_words.he(CONFIRM_KEY), "confirm_en": confirm_words.en(CONFIRM_KEY)})
    return principal, lang


@router.post(f"{BASE}/apply", **wire(W.LegacyImportApply))
def apply(request: Request, plan_digest: str = Query(min_length=64, max_length=64, pattern=r"^[0-9a-f]{64}$"),
          gate: tuple[Principal, str] = Depends(_apply_gate), data: bytes = Depends(_file_body)) -> dict[str, Any]:
    """Apply the plan the administrator looked at: backup first, then only the empty camera aliases; idempotent and audited."""
    principal, confirm_lang = gate
    settings = settings_of(request)
    with _db(request).connection(label="legacy_migration.apply") as conn:
        src = _read(conn, principal, request, data, "migration.legacy.apply")
        try:
            out = li.apply(conn, settings, src, plan_digest=plan_digest, actor=principal, request_id=_rid(request), confirm_word=confirm_lang,
                           lang=lang_of(conn, principal))
        except li.PlanChanged:  # an expected refusal commits: the audit row stays, nothing else was written
            audit(conn, actor=principal, action="migration.legacy.apply", decision="denied", resource_type="installation", resource_id="legacy",
                  reason="plan_changed", request_id=_rid(request), details={"sha256": src.sha256})
            raise ApiError(409, "legacy_plan_changed", "התוכנית השתנתה מאז הבדיקה (הקובץ או Arx). יש להריץ את הבדיקה שוב.") from None
        except li.BackupFailed as exc:
            audit(conn, actor=principal, action="migration.legacy.apply", decision="denied", resource_type="installation", resource_id="legacy",
                  reason="backup_failed", request_id=_rid(request), details={"sha256": src.sha256, "error": str(exc)})
            raise ApiError(409, "legacy_backup_failed", "לא ניתן היה לכתוב גיבוי לפני הייבוא, ולכן שום דבר לא שונה.",
                           details={"error": str(exc)}) from None
    if out["backup"]:
        from ..services import backup as backup_svc

        backup_svc.prune(settings)
    return out
