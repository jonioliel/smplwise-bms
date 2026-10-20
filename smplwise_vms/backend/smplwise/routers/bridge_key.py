"""Bridge HMAC key rotation, administration (CR-WISKEY-HMAC-ROTATION-295 sections 7, 10, 11).

Every route: `system.configure` on the installation, then a system administrator (`rbac.is_system_admin`; 403 `not_system_admin`,
audited) - GET too. Local sessions only (remote_channel.BLOCKED_ON_REMOTE). Arx RBAC is the only authority: no home-system flag,
token or group grants anything here.

- `GET  /system/bridge-key` - the state: switch, permit, peer capability, current key id / generation / since (never material), the
  active and last rotations, the reminder. Drives the active rotation one round first (`tick`: never starts one).
- `PUT  /system/bridge-key/settings` - `enabled` (the switch `bridge.key_rotation`; `true` refused 409 `rotation_not_permitted`
  while `bridge_rotation.GO_LIVE_PERMITTED` is False) and `reminder_days` (0 / 30 / 90 / 180 / 365; passive badge only).
- `POST /system/bridge-key/rotations` - `{mode: routine | hard_cut, confirm: true}`: runs the staged rotation (section 5).
- `POST /system/bridge-key/rotations/{id}/resume` - drives a rotation left mid-way (crash, `needs_repair`).

The switch and the reminder are never taken from a backup (services/backup.SETTINGS_KEEP)."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import database_of, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, is_system_admin, require
from ..services import bridge_rotation as br

router = APIRouter()
CONFIGURE = "system.configure"

MESSAGES = {
    "rotation_off": "החלפת מפתח הגשר כבויה.",
    "rotation_not_permitted": "החלפת מפתח הגשר דורשת אישור הפעלה נפרד מבעל המערכת, וגרסה זו אינה כוללת אותו.",
    "peer_unavailable": "הגשר אינו תומך עדיין בהחלפת מפתח.",
    "rotation_in_progress": "החלפת מפתח כבר מתבצעת.",
    "repair_required": "החלפה קודמת לא הושלמה. יש להשלים אותה קודם.",
    "not_paired": "הגשר לא צומד עדיין.",
    "key_unreadable": "לא ניתן לפענח את מפתח הגשר במכונה זו.",
    "no_key": "אין מפתח גשר פעיל.",
    "not_found": "ההחלפה לא נמצאה.",
    "validation": "בקשה לא תקינה.",
}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _gate(conn: sqlite3.Connection, request: Request, principal: Principal, action: str) -> None:
    require(conn, principal, CONFIGURE, INSTALLATION)
    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action=action, decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
              request_id=_rid(request), details={"area": "bridge_key"})
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לנהל את מפתח הגשר.")


def _engine(request: Request, conn: sqlite3.Connection, principal: Principal) -> br.Engine:
    db = database_of(conn) or request.app.state.db
    e = br.Engine(db, request.app.state.settings.data_dir)
    e.actor = principal
    return e


def _refused(exc: br.RotationRefused) -> ApiError:
    return ApiError(exc.status, exc.code, MESSAGES.get(exc.code, MESSAGES["validation"]))


@router.get("/system/bridge-key")
def get_bridge_key(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "bridge.key.read")
    if not (br.mode(conn) == "on" and br.go_live_permitted()):
        return br.view(conn, request.app.state.settings.data_dir)
    engine = _engine(request, conn, principal)
    engine.tick()
    with engine.db.connection(mode="read") as fresh:  # the request's snapshot predates the tick
        return br.view(fresh, request.app.state.settings.data_dir)


class SettingsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool | None = None
    reminder_days: Literal[0, 30, 90, 180, 365] | None = None


@router.put("/system/bridge-key/settings")
def put_bridge_key_settings(body: SettingsBody, request: Request, principal: Principal = Depends(current_principal),
                            conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "settings.changed")
    if body.enabled is None and body.reminder_days is None:
        raise ApiError(422, "validation", "לא נשלחה הגדרה לשינוי.")
    if body.enabled is not None:
        before = br.mode(conn)
        after = "on" if body.enabled else "off"
        if after == "on" and not br.go_live_permitted():
            audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="installation", resource_id="*", request_id=_rid(request),
                  reason="rotation_not_permitted", details={"key": br.FLAG_KEY, "requested": "on"})
            raise ApiError(409, "rotation_not_permitted", MESSAGES["rotation_not_permitted"])
        if after != before:
            set_setting(conn, br.FLAG_KEY, after)
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
                  details={"key": br.FLAG_KEY, "before": before, "after": after})
    if body.reminder_days is not None:
        before_d = br.reminder_days(conn)
        if body.reminder_days != before_d:
            set_setting(conn, br.REMINDER_KEY, str(body.reminder_days))
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
                  details={"key": br.REMINDER_KEY, "before": before_d, "after": body.reminder_days})
    return br.view(conn, request.app.state.settings.data_dir)


class StartBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["routine", "hard_cut"]
    confirm: bool


@router.post("/system/bridge-key/rotations")
def start_rotation(body: StartBody, request: Request, principal: Principal = Depends(current_principal_ro),
                   conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "bridge.rotation.requested")
    if body.confirm is not True:
        raise ApiError(422, "confirm_required", "יש לאשר את ההחלפה.")
    try:
        rot = _engine(request, conn, principal).start(principal, body.mode)
    except br.RotationRefused as exc:
        audit(conn, actor=principal, action="bridge.rotation.requested", decision="denied", resource_type="bridge_rotation", resource_id="*",
              reason=exc.code, request_id=_rid(request), details={"mode": body.mode})
        raise _refused(exc) from None
    return {"rotation": br.public(rot)}


@router.post("/system/bridge-key/rotations/{rotation_id}/resume")
def resume_rotation(rotation_id: str, request: Request, principal: Principal = Depends(current_principal_ro),
                    conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "bridge.rotation.resume")
    if len(rotation_id) > 64:
        raise ApiError(404, "not_found", MESSAGES["not_found"])
    if br.mode(conn) != "on" or not br.go_live_permitted():
        raise ApiError(409, "rotation_off" if br.mode(conn) != "on" else "rotation_not_permitted",
                       MESSAGES["rotation_off" if br.mode(conn) != "on" else "rotation_not_permitted"])
    try:
        rot = _engine(request, conn, principal).resume(rotation_id)
    except br.RotationRefused as exc:
        raise _refused(exc) from None
    return {"rotation": br.public(rot)}
