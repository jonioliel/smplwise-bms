"""GDRIVEBK-295 (scaffold, OFF by default): the Google Drive backup destination's settings API. No screen yet.

Every route needs `backup.manage` at installation scope (system administrators, like the other off-box routes) and is audited
without any token, secret or Google answer. The network (connection test, revoke on disconnect) never runs inside the request's
transaction: it is committed first (db.release). The consent flow is a TODO behind services/offbox_gdrive.OAuthFlow: until it
exists `connect/start` and `connect/poll` answer 501 `gdrive_oauth_not_implemented`.

Included in main.py BEFORE routers/backup.py: `/backups/gdrive` would otherwise reach `GET /backups/{name}` (a 404)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, SecretStr

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import release
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import gdrive_runtime as rt
from ..services.backup_offbox import OffboxError

router = APIRouter()

MESSAGES = {
    "gdrive_disabled": "הגיבוי ל־Google Drive כבוי בהגדרות.",
    "gdrive_not_connected": "לא מחובר חשבון Google.",
    "gdrive_client_missing": "לא הוגדר מזהה לקוח של Google.",
    "gdrive_oauth_not_implemented": "חיבור חשבון Google עדיין לא זמין בגרסה הזו.",
    "push_running": "העברה אחרת רצה כרגע.",
    "confirm_required": "נדרש אישור מפורש.",
    "secret_invalid": "ערך סודי לא תקין.",
    "secret_store_unavailable": "מפתח ההתקנה לא זמין; אי אפשר לשמור סודות.",
}


def _err(exc: OffboxError, status: int = 409) -> ApiError:
    if exc.code == "gdrive_oauth_not_implemented":
        status = 501
    return ApiError(status, exc.code, MESSAGES.get(exc.code, "הפעולה נדחתה."))


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class SettingsPutIn(rt.GDriveSettingsIn):
    model_config = ConfigDict(extra="forbid")
    # write-only; absent = keep, "" = clear. For an installed-app / device client Google does not treat it as confidential, but it is
    # still sealed like any credential and never returned.
    client_secret: SecretStr | None = None


class ConfirmIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: str = ""


@router.get("/backups/gdrive")
def gdrive_status(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    return rt.status(conn, settings_of(request))


@router.put("/backups/gdrive/settings")
def gdrive_settings(body: SettingsPutIn, request: Request, principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    before = rt.load_settings(conn)
    cfg = rt.GDriveSettingsIn.model_validate(body.model_dump(exclude={"client_secret"}))
    secret_changed = None
    if body.client_secret is not None:
        raw = body.client_secret.get_secret_value()
        try:
            if raw:
                rt.set_secret(conn, settings_of(request).data_dir, rt.CLIENT_SECRET, raw, principal.user_id)
                secret_changed = "set"
            else:
                rt.clear_secret(conn, rt.CLIENT_SECRET)
                secret_changed = "cleared"
        except OffboxError as exc:
            raise _err(exc, 422) from None
    rt.save_settings(conn, cfg)
    old, new = before.model_dump(), cfg.model_dump()
    audit(conn, actor=principal, action="backup.gdrive.settings_update", decision="allowed", resource_type="installation",
          resource_id="backup_gdrive", request_id=_rid(request),
          details={"changed": sorted(k for k in new if old.get(k) != new.get(k)), "enabled": cfg.enabled,
                   **({"client_secret": secret_changed} if secret_changed else {})})
    return rt.status(conn, settings_of(request))


@router.post("/backups/gdrive/connect/start")
def gdrive_connect_start(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    try:
        out = rt.connect_start(conn)
    except OffboxError as exc:
        audit(conn, actor=principal, action="backup.gdrive.connect_start", decision="denied", resource_type="installation",
              resource_id="backup_gdrive", request_id=_rid(request), reason=exc.code)
        raise _err(exc) from None
    audit(conn, actor=principal, action="backup.gdrive.connect_start", decision="allowed", resource_type="installation",
          resource_id="backup_gdrive", request_id=_rid(request))
    return out


@router.post("/backups/gdrive/connect/poll")
def gdrive_connect_poll(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    try:
        out = rt.connect_poll(conn, settings_of(request), principal.user_id)
    except OffboxError as exc:
        raise _err(exc) from None
    if out.get("state") in ("connected", "denied"):
        audit(conn, actor=principal, action="backup.gdrive.connect", decision="allowed" if out["state"] == "connected" else "denied",
              resource_type="installation", resource_id="backup_gdrive", request_id=_rid(request), details={"state": out["state"]})
    return out


@router.post("/backups/gdrive/disconnect")
def gdrive_disconnect(body: ConfirmIn, request: Request, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    if body.confirm != "DISCONNECT":
        raise ApiError(422, "confirm_required", MESSAGES["confirm_required"])
    release(conn)  # the revoke call goes to Google: no write lock across it
    revoked = rt.revoke_remote(request.app.state.db, settings_of(request))
    with request.app.state.db.write_aside(label="gdrive.disconnect") as wconn:
        had = rt.disconnect(wconn)
        audit(wconn, actor=principal, action="backup.gdrive.disconnect", decision="allowed", resource_type="installation",
              resource_id="backup_gdrive", request_id=_rid(request), details={"had_token": had, "revoked": revoked})
    return {"disconnected": True, "had_token": had, "revoked": revoked}


@router.post("/backups/gdrive/test")
def gdrive_test(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "backup.manage", INSTALLATION)
    audit(conn, actor=principal, action="backup.gdrive.test", decision="allowed", resource_type="installation", resource_id="backup_gdrive",
          request_id=_rid(request))
    release(conn)  # no write lock across the network
    try:
        return rt.run_check(request.app.state.db, settings_of(request))
    except OffboxError as exc:
        raise _err(exc) from None
