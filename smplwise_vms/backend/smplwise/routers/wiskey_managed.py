"""WISKEY-MANAGED-INSTALL-2382: the owner's screen of "WisKey installs and upgrades through Arx" (services/wiskey_managed_install.py).

- GET  /wiskey/managed            versions (installed, shipped), ownership, plan, the switches, the last run (secret-free, path-free)
- PUT  /wiskey/managed/switch     `{switch: "enabled" | "core_risk" | "startup", value: "off" | "on", confirm?: str}` - ON needs the typed
                                  phrase (owner decision 04.11 Q3 = B: `startup` lets a run also start at add-on start-up; default off)
- PUT  /wiskey/managed/keep-runs  `{value: 1..10}` - how many recent runs keep their previous tree and private backup (04.11 Q8 = B)
- POST /wiskey/managed/check      the dry run: preflight, Core gate, full-backup check (reads only)
- POST /wiskey/managed/adopt      `{confirm: str}` - the owner's conversion of the manual install (private backup, audit, no config write)
- POST /wiskey/managed/upgrade    202: install / upgrade / convert by plan (never a downgrade)
- POST /wiskey/managed/rollback   202: back to the tree the last run replaced

All need `system.configure` at the installation AND a system administrator. Every refusal after the permission check and every change
is audited (closed codes only)."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, is_system_admin, require
from ..services import wiskey_managed_install as wmi

router = APIRouter()
BASE = "/wiskey/managed"
RID = "wiskey.managed"
_TEXT = {
    "validation": "הבקשה אינה תקינה.",
    "unknown_switch": "מתג לא מוכר.",
    "confirmation_required": "יש להקליד את משפט האישור בדיוק כפי שהוא מוצג.",
    "managed_off": "ההתקנה דרך המערכת כבויה. יש להפעיל אותה קודם.",
    "job_running": "פעולת התקנה כבר רצה. יש להמתין לסיומה.",
    "ha_config_not_mapped": "תיקיית ההגדרות של תשתית המערכת אינה זמינה לתוסף.",
    "already_adopted": "ההתקנה הקיימת כבר עברה לניהול המערכת.",
    "manual_marker_invalid": "סימון ההתקנה הידנית אינו תקין. אין לגעת בהתקנה: נדרשת בדיקה ידנית.",
    "installed_tree_not_recognized": "הרכיב המותקן אינו מזוהה. הוא נשאר כפי שהוא ונדרשת בדיקה ידנית.",
    "installed_tree_changed": "הרכיב המותקן השתנה בזמן הבדיקה. לא בוצע שינוי.",
    "backup_failed": "הגיבוי הפרטי נכשל. לא בוצע שינוי.",
    "bundle_invalid": "חבילת הרכיב שבגרסה זו אינה תקינה. לא בוצע שינוי.",
    "adoption_required": "ההתקנה הקיימת הותקנה ידנית. יש להעביר אותה לניהול המערכת קודם.",
    "plan_refused": "אין עדכון שאפשר לבצע: הגרסה שבמערכת אינה חדשה מהמותקנת.",
    "not_enough_space": "אין מספיק מקום פנוי בתיקיית ההגדרות.",
    "rollback_unavailable": "אין גרסה קודמת שאפשר לחזור אליה.",
}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class SwitchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    switch: Literal["enabled", "core_risk", "startup"]
    value: str = Field(max_length=8)
    confirm: str | None = Field(default=None, max_length=200)


class KeepRunsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: Any = None  # checked by the service (an integer 1..10; never a bool, a string or a float) so the refusal is audited


class ConfirmIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: str | None = Field(default=None, max_length=200)


def _admin_or_403(conn: sqlite3.Connection, principal: Principal, request: Request, action: str) -> None:
    require(conn, principal, "system.configure", INSTALLATION)
    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action=action, decision="denied", resource_type="installation", resource_id=RID, reason="not_system_admin",
              request_id=_rid(request), details={})
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לבצע פעולה זו.")


def _refused(conn: sqlite3.Connection | None, request: Request, principal: Principal, action: str, exc: wmi.ManagedRefused) -> ApiError:
    details = {k: v for k, v in exc.details.items() if k in ("plan", "ownership", "code")}
    if conn is not None:
        audit(conn, actor=principal, action=action, decision="denied", resource_type="installation", resource_id=RID, reason=exc.code,
              request_id=_rid(request), details=details)
    else:
        with request.app.state.db.connection(label="wiskey.managed refusal") as c:
            audit(c, actor=principal, action=action, decision="denied", resource_type="installation", resource_id=RID, reason=exc.code,
                  request_id=_rid(request), details=details)
    return ApiError(exc.status, exc.code, _TEXT.get(exc.code, _TEXT["validation"]), details=details)


@router.get(BASE)
def get_managed(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """WISKEY-MANAGED-INSTALL-2382: installed / shipped WisKey versions, ownership, plan, switches and the last run (system administrator)."""
    _admin_or_403(conn, principal, request, "settings.read")
    return wmi.view(conn)


@router.put(BASE + "/switch")
def put_switch(body: SwitchIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """WISKEY-MANAGED-INSTALL-2382: turn the managed installation (or the accepted Core-image risk) on with the typed phrase, or off (system administrator)."""
    key = wmi.SWITCH_NAMES[body.switch]
    with request.app.state.db.connection(label="wiskey.managed.switch") as conn:
        _admin_or_403(conn, principal, request, "settings.changed")
        try:
            changes = wmi.set_switch(conn, key, body.value, body.confirm)
        except wmi.ManagedRefused as exc:
            raise _refused(conn, request, principal, "settings.changed", exc) from None
        for k, before, after in changes:
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id=RID,
                  request_id=_rid(request), details={"key": k, "before": before, "after": after})
        return wmi.view(conn)


@router.put(BASE + "/keep-runs")
def put_keep_runs(body: KeepRunsIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """Owner decision 04.11 Q8 = B: how many recent managed runs keep their previous tree and private backup (1-10, default 5; system administrator, audited)."""
    with request.app.state.db.connection(label="wiskey.managed.keep_runs") as conn:
        _admin_or_403(conn, principal, request, "settings.changed")
        try:
            before, after = wmi.set_keep_runs(conn, body.value)
        except wmi.ManagedRefused as exc:
            raise _refused(conn, request, principal, "settings.changed", exc) from None
        audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id=RID,
              request_id=_rid(request), details={"key": wmi.K_KEEP_RUNS, "before": before, "after": after})
        return wmi.view(conn)


def _admin(request: Request, principal: Principal, action: str) -> None:
    with request.app.state.db.connection(label="wiskey.managed admin") as conn:
        _admin_or_403(conn, principal, request, action)


@router.post(BASE + "/check")
def post_check(request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """WISKEY-MANAGED-INSTALL-2382: the dry run of a managed upgrade - preflight, Core gate, full-backup check; reads only (system administrator)."""
    _admin(request, principal, "settings.read")
    return wmi.check(request.app.state.db, request.app.state.settings)


@router.post(BASE + "/adopt")
def post_adopt(body: ConfirmIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """WISKEY-MANAGED-INSTALL-2382: convert the manual WisKey install into "managed by Arx" (typed phrase, private backup, audited; no config write)."""
    _admin(request, principal, "wiskey.managed.adopt")
    db, settings = request.app.state.db, request.app.state.settings
    try:
        wmi.adopt(db, settings, body.confirm, actor=principal, request_id=_rid(request))
    except wmi.ManagedRefused as exc:
        raise _refused(None, request, principal, "wiskey.managed.adopt", exc) from None
    with db.connection(mode="read", label="wiskey.managed view") as c:
        return wmi.view(c)


def _start(kind: str, request: Request, principal: Principal) -> dict[str, Any]:
    _admin(request, principal, "wiskey.managed.run_started")
    db, settings = request.app.state.db, request.app.state.settings
    try:
        job = wmi.start(db, settings, kind, actor=principal, request_id=_rid(request))
    except wmi.ManagedRefused as exc:
        raise _refused(None, request, principal, "wiskey.managed.run_started", exc) from None
    return {"job": job}


@router.post(BASE + "/upgrade", status_code=202)
def post_upgrade(request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """WISKEY-MANAGED-INSTALL-2382: start the managed install / upgrade / conversion (backup check, Core stop/start, verified swap, compare, rollback)."""
    return _start("forward", request, principal)


@router.post(BASE + "/rollback", status_code=202)
def post_rollback(request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """WISKEY-MANAGED-INSTALL-2382: put back the WisKey tree the last managed run replaced (Core stop/start, compare)."""
    return _start("rollback", request, principal)
