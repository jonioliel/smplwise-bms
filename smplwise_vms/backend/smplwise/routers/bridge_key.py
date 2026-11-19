"""Bridge HMAC key rotation, administration (CR-WISKEY-HMAC-ROTATION-295 sections 7, 10, 11).

Every route: `system.configure` on the installation, then a system administrator (`rbac.is_system_admin`; 403 `not_system_admin`,
audited) - GET too. Local sessions only (remote_channel.BLOCKED_ON_REMOTE). Arx RBAC is the only authority: no home-system flag,
token or group grants anything here.

- `GET  /system/bridge-key` - the state: switch, permit, peer capability, current key id / generation / since (never material), the
  active and last rotations, the reminder. Drives the active rotation one round first (`tick`: never starts one).
- `PUT  /system/bridge-key/settings` - `enabled` (the switch `bridge.key_rotation`, on by default since the activation slice; `true`
  refused 409 `rotation_not_permitted` only if `bridge_rotation.GO_LIVE_PERMITTED` were False) and `reminder_days` (0 / 30 / 90 / 180 / 365:
  the interval after which the automatic worker rotates again; 0 = only the first rotation, which retires the legacy pairing secret).
- `POST /system/bridge-key/rotations` - needs `bridge.key.rotate` (HMACACT2-295; system_admin only, still with the system-administrator check). `{mode: routine | hard_cut, confirm: true}`: runs the staged rotation (section 5).
- `POST /system/bridge-key/rotations/{id}/resume` - needs `bridge.key.rotate`; drives a rotation left mid-way (crash, `needs_repair`).
- `PUT  /system/bridge-key/owner-contacts` - WXH-LEFTOVERS-2405 (CR-034 section 7): `{user_ids: [...]}`, up to five active system
  administrators who are "the owner" for the bridge-key notices (`security.owner_contacts`); `[]` clears it. Audited `settings.changed`.
- `GET  /system/bridge-key/notice` - WXH-LEFTOVERS-2405: whether the bridge-key notice banner is up on the Settings screens (an open notice
  while no owner contact is set). Read only: never drives a rotation.
- `POST /system/bridge-key/revoke` - WXH4-EMERGENCY-REVOKE-2407 (CR-034 section 8): needs `bridge.key.rotate` (system_admin only) and the
  system-administrator check; `{confirm: true, wiskey_acknowledged}` (the latter must be true while WisKey is installed: the dialog warned
  that door opening through WisKey stops until the re-pair - owner decision 3). Never refused for want of an owner contact (decision 6).
  The key set is wiped, a fresh pairing code made and announced to the bridge through the existing re-pair path; every bridge operation is
  blocked until the bridge proves the new code (services/bridge_key_revocation.py). Audited `bridge.key.revoked` (name + time); the notice
  names the administrator (decision 4).
- `POST /system/bridge-key/revoke/reveal` - WXH4: `{code}` = the caller's OWN current authenticator code (the step-up: a fresh
  re-authentication, owner decision 2). Any system administrator; answers the new pairing code for the manual entry in the bridge, only
  while the revocation waits for the re-pair. Every reveal and every refused attempt is audited (`bridge.key.code_revealed`).

The switch and the reminder are never taken from a backup (services/backup.SETTINGS_KEEP)."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import database_of, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, is_system_admin, require
from ..services import bridge_key_notice as bkn
from ..services import bridge_key_revocation as bkr
from ..services import bridge_rotation as br
from ..services import second_factor as sf

router = APIRouter()
CONFIGURE = "system.configure"
ROTATE = "bridge.key.rotate"  # HMACACT2-295: starting / resuming a rotation (system_admin only, in SYSTEM_PERMISSIONS)

MESSAGES = {
    "rotation_off": "החלפת מפתח הגשר כבויה.",
    "rotation_not_permitted": "החלפת מפתח הגשר דורשת אישור הפעלה נפרד מבעל המערכת, והאישור הזה אינו פעיל כעת.",
    "peer_unavailable": "הגשר לא דיווח עדיין שהוא תומך בהחלפת מפתח. הוא יתעדכן עם העדכון הרגיל.",
    # BRIDGE-STALE-DISCOVERY-2383: WisKey verifies Arx only against the original pairing code, which a rotation blanks in the bridge
    "wiskey_present": "החלפת מפתח הגשר חסומה כל עוד WisKey מותקן: WisKey מאמת את Arx רק מול קוד הצימוד המקורי, וההחלפה מוחקת אותו מהגשר ומנתקת את WisKey.",
    "rotation_in_progress": "החלפת מפתח כבר מתבצעת.",
    "repair_required": "החלפה קודמת לא הושלמה. יש להשלים אותה קודם.",
    "not_paired": "הגשר לא צומד עדיין.",
    "key_unreadable": "לא ניתן לפענח את מפתח הגשר במכונה זו.",
    "no_key": "אין מפתח גשר פעיל.",
    "not_found": "ההחלפה לא נמצאה.",
    "validation": "בקשה לא תקינה.",
    "contact_not_admin": "אפשר לבחור רק מנהלי מערכת פעילים.",
    # WXH4-EMERGENCY-REVOKE-2407
    "bridge_revoked": bkr.REVOKED_TEXT,
    "confirm_required": "יש לאשר את הביטול.",
    "wiskey_ack_required": "WisKey מותקן: יש לאשר שפתיחת דלתות דרך WisKey תיפסק עד הצימוד מחדש.",
    "revoke_busy": "שלב של החלפת מפתח רץ כרגע. נסו שוב בעוד כמה שניות.",
    "not_revoked": "אין ביטול חירום שממתין לצימוד מחדש.",
    "no_code": "אין קוד צימוד חדש להצגה.",
    "step_up_unavailable": "כדי להציג את הקוד צריך אימות מחדש בקוד מאפליקציית האימות שלך, ולחשבון שלך עוד לא הוגדר אימות דו־שלבי. הפעל אותו בחשבון שלך ונסה שוב.",
    "step_up_required": "הזן את הקוד הנוכחי מאפליקציית האימות שלך.",
}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _gate(conn: sqlite3.Connection, request: Request, principal: Principal, action: str, permission: str = CONFIGURE) -> None:
    require(conn, principal, permission, INSTALLATION)
    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action=action, decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
              request_id=_rid(request), details={"area": "bridge_key"})
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לנהל את מפתח הגשר.")


def _engine(request: Request, conn: sqlite3.Connection, principal: Principal) -> br.Engine:
    db = database_of(conn) or request.app.state.db
    e = br.Engine(db, request.app.state.settings.data_dir, settings=request.app.state.settings)
    e.actor = principal
    return e


def _peer(request: Request) -> Any:
    """The same peer the engine uses (the bridge's announcement is read from this app's database)."""
    return br.peers.get_peer(request.app.state.db, request.app.state.settings)


def _refused(exc: br.RotationRefused) -> ApiError:
    return ApiError(exc.status, exc.code, MESSAGES.get(exc.code, MESSAGES["validation"]))


@router.get("/system/bridge-key")
def get_bridge_key(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "bridge.key.read")
    if not (br.mode(conn) == "on" and br.go_live_permitted()) or bkr.is_revoked(conn):
        return _with_step_up(conn, principal, br.view(conn, request.app.state.settings.data_dir, _peer(request)))
    engine = _engine(request, conn, principal)
    engine.tick()
    with engine.db.connection(mode="read") as fresh:  # the request's snapshot predates the tick
        return _with_step_up(fresh, principal, br.view(fresh, request.app.state.settings.data_dir, _peer(request)))


def _with_step_up(conn: sqlite3.Connection, principal: Principal, view: dict[str, Any]) -> dict[str, Any]:
    """WXH4: whether THIS administrator can pass the reveal's step-up (an active authenticator of their own) - a hint for the card only."""
    rev = view.get("revocation")
    if isinstance(rev, dict):
        view["revocation"] = {**rev, "step_up_ready": sf.is_enrolled(conn, principal.user_id)}
    return view


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
    return br.view(conn, request.app.state.settings.data_dir, _peer(request))


class StartBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["routine", "hard_cut"]
    confirm: bool


@router.post("/system/bridge-key/rotations")
def start_rotation(body: StartBody, request: Request, principal: Principal = Depends(current_principal_ro),
                   conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "bridge.rotation.requested", ROTATE)
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
    _gate(conn, request, principal, "bridge.rotation.resume", ROTATE)
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


class ContactsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_ids: list[str]


@router.put("/system/bridge-key/owner-contacts")
def put_owner_contacts(body: ContactsBody, request: Request, principal: Principal = Depends(current_principal),
                       conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """WXH-LEFTOVERS-2405: the owner contacts for the bridge-key notices (system administrator; active system administrators only)."""
    _gate(conn, request, principal, "settings.changed")
    try:
        bkn.set_contacts(conn, body.user_ids, actor=principal, request_id=_rid(request))
    except bkn.ContactsInvalid as exc:
        audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="installation", resource_id="*", request_id=_rid(request),
              reason=exc.code, details={"key": bkn.CONTACTS_KEY})
        raise ApiError(422, exc.code, MESSAGES.get(exc.code, MESSAGES["validation"])) from None
    return br.view(conn, request.app.state.settings.data_dir, _peer(request))


@router.get("/system/bridge-key/notice")
def get_bridge_key_notice(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """WXH-LEFTOVERS-2405: the Settings banner of an open bridge-key notice while no owner contact is set (read only)."""
    _gate(conn, request, principal, "bridge.key.read")
    return bkn.banner(conn)


# ---------------------------------------------------------------- WXH4-EMERGENCY-REVOKE-2407: emergency revocation + fresh-key re-pair

class RevokeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: bool
    wiskey_acknowledged: bool = False


@router.post("/system/bridge-key/revoke")
def revoke_bridge_key(body: RevokeBody, request: Request, principal: Principal = Depends(current_principal_ro),
                      conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The emergency revocation (system administrator). Runs in a write transaction of its own, under the rotation lock, so no rotation step
    interleaves; the new code is announced after the commit (a Supervisor call never runs inside a transaction)."""
    from ..services import bridge_install

    _gate(conn, request, principal, "bridge.key.revoked", ROTATE)
    if body.confirm is not True:
        raise ApiError(422, "confirm_required", MESSAGES["confirm_required"])
    present = br.wiskey_present()
    if present and body.wiskey_acknowledged is not True:
        audit(conn, actor=principal, action="bridge.key.revoked", decision="denied", resource_type="bridge_key", resource_id="*", reason="wiskey_ack_required",
              request_id=_rid(request))
        raise ApiError(409, "wiskey_ack_required", MESSAGES["wiskey_ack_required"])
    settings = request.app.state.settings
    db = database_of(conn) or request.app.state.db
    if not br._LOCK.acquire(timeout=bkr.LOCK_WAIT_S):
        audit(conn, actor=principal, action="bridge.key.revoked", decision="denied", resource_type="bridge_key", resource_id="*", reason="revoke_busy",
              request_id=_rid(request))
        raise ApiError(409, "revoke_busy", MESSAGES["revoke_busy"], retryable=True)
    try:
        with db.connection(label="bridge key emergency revocation") as w:
            out = bkr.revoke(w, actor=principal, request_id=_rid(request), wiskey_present=present)
    finally:
        br._LOCK.release()
    bkr.after_revoke(db, settings)
    announced = bridge_install.announce_discovery(db, settings)  # the existing re-pair path (owner decision 1); False when it is closed
    with db.connection(mode="read") as fresh:
        view = _with_step_up(fresh, principal, br.view(fresh, settings.data_dir, _peer(request)))
    return {"revoked": True, "revocation_id": out.get("id"), "announced": announced, "notice": out.get("notice"), "status": view}


class RevealBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str | None = Field(default=None, max_length=16)


@router.post("/system/bridge-key/revoke/reveal")
def reveal_new_code(request: Request, body: RevealBody | None = None, principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The new pairing code after an emergency revocation, for the manual entry in the bridge. Any system administrator, after a fresh
    re-authentication with their OWN current authenticator code (owner decision 2). Every outcome is audited."""
    from ..services import bridge_install
    from ..services import ha_user_auth as hua

    _gate(conn, request, principal, "bridge.key.code_revealed")

    def denied(reason: str) -> None:
        audit(conn, actor=principal, action="bridge.key.code_revealed", decision="denied", resource_type="bridge_key",
              resource_id=(bkr.state(conn) or {}).get("id") or "*", reason=reason, request_id=_rid(request),
              details={"actor_name": bkr.actor_name(conn, principal), "step_up": "totp"})

    if not bkr.is_revoked(conn):
        denied("not_revoked")
        raise ApiError(409, "not_revoked", MESSAGES["not_revoked"])
    if not sf.is_enrolled(conn, principal.user_id):
        denied("step_up_unavailable")
        raise ApiError(403, "step_up_unavailable", MESSAGES["step_up_unavailable"])
    code = (request.headers.get(hua.SECOND_FACTOR_HEADER) or (body.code if body else None) or "").strip()
    if not code:
        denied("step_up_required")
        raise ApiError(403, "step_up_required", MESSAGES["step_up_required"])
    try:
        sf.verify(conn, request.app.state.settings, principal.user_id, code)
    except sf.SecondFactorError as exc:
        denied(f"step_up_{exc.code}")
        raise ApiError(429 if exc.code == "locked" else 403 if exc.code == "invalid" else 409, f"second_factor_{exc.code}", exc.message,
                       retryable=exc.code == "locked") from None
    try:
        pairing_code = bkr.reveal(conn, actor=principal, request_id=_rid(request))
    except bkr.RevocationRefused as exc:
        denied(exc.code)
        raise ApiError(exc.status, exc.code, MESSAGES.get(exc.code, MESSAGES["validation"])) from None
    return {"pairing_code": pairing_code, "addon_url": bridge_install.addon_url(), "revocation_id": (bkr.state(conn) or {}).get("id")}
