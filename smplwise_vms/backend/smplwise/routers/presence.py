"""CR-027: the phone app's presence endpoints (docs/api/mobile-presence-contract.md).

Two credentials meet here. A SESSION (the Arx cookie on the remote channel, the Ingress identity locally) registers a device,
lists the caller's own devices and may rename / remove them. A DEVICE TOKEN (`Authorization: Bearer arxd_...`, shown once
at registration, stored hashed) is the app's credential afterwards: config, the notice acknowledgement, event batches,
its own state, rename and unregister. A device token is never an HA token: the routes below resolve it themselves (one
indexed read of the hash) and never hand it to the remote channel's bearer path. Administrators (presence.sensors.view)
see everyone's devices; the settings are system.configure.

Every route opens its own connection, so a device-token call never takes the write gate before it is authenticated
(the same rule the remote channel applies to sessions: refuse from memory first)."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, Body, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import resolve_principal, resolve_remote_first, settings_of, touch_user
from ..db import Database, get_setting
from ..errors import ApiError, forbidden, not_found
from ..rbac import INSTALLATION, Principal, authorize, note_grant, permissions_anywhere, require
from ..remote_channel import is_remote
from ..services import mobile_push
from ..services import presence as svc
from ..services.ha_user_auth import bearer_of

router = APIRouter()

REPORT = "presence.report"
VIEW = "presence.sensors.view"
CONFIGURE = "system.configure"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _db(request: Request) -> Database:
    return request.app.state.db


@dataclass
class Caller:
    principal: Principal
    device: dict[str, Any] | None = None  # set when the credential was a device token

    @property
    def via(self) -> str:
        return "device" if self.device else "session"


def _client_key(request: Request, token: str | None) -> str:
    return "tok:" + svc.token_hash(token)[:8] if token else "ip:" + (request.client.host if request.client else "?")


def device_caller(request: Request) -> Caller:
    """Device token only. 401 `device_token_invalid` for anything else (the app then forgets its registration)."""
    token = bearer_of(request)
    key = _client_key(request, token)
    if svc.TOKEN_FAILURES.blocked(key) or svc.TOKEN_FAILURES_ALL.blocked("all"):
        raise ApiError(429, "rate_limited", "יותר מדי ניסיונות. נסו שוב בעוד דקה.", retryable=True, details={"retry_after_s": 60})
    row = None
    if token and svc.is_device_token(token):
        with _db(request).connection(mode="read", label="presence.device") as conn:
            row = svc.by_token(conn, token)
            principal = svc.principal_of(conn, row) if row is not None else None
    if row is None:
        svc.TOKEN_FAILURES.fail(key)
        svc.TOKEN_FAILURES_ALL.fail("all")
        raise ApiError(401, "device_token_invalid", "רישום המכשיר אינו תקף. יש לרשום את המכשיר מחדש.")
    return Caller(principal, dict(row))


def session_caller(request: Request) -> Caller:
    """A signed-in user (never a device token): the Arx session on the remote channel, the Ingress identity locally."""
    token = bearer_of(request)
    if token and svc.is_device_token(token):
        raise ApiError(401, "session_required", "הפעולה הזו דורשת כניסה למערכת, לא רישום מכשיר.")
    principal = resolve_remote_first(request) if is_remote(request) else resolve_principal(request, settings_of(request))
    return Caller(principal)


def any_caller(request: Request) -> Caller:
    """Device token when one is presented, else a session."""
    token = bearer_of(request)
    if token and svc.is_device_token(token):
        return device_caller(request)
    return session_caller(request)


def _require_anywhere(conn: sqlite3.Connection, principal: Principal, permission: str, request: Request) -> None:
    """A permission held at ANY scope (a floor-scoped viewer registers a phone too)."""
    if permission in permissions_anywhere(conn, principal):
        d = authorize(conn, principal, permission, INSTALLATION)
        note_grant(d if d.allowed else None, permission)
        return
    audit(conn, actor=principal, action=permission, decision="denied", resource_type="installation", resource_id="*", reason="no_binding", request_id=_rid(request))
    raise forbidden(permission=permission)


def _device_or_404(conn: sqlite3.Connection, device_id: str) -> sqlite3.Row:
    row = svc.get_device(conn, device_id)
    if row is None or row["revoked_at"]:
        raise not_found("המכשיר לא נמצא.")
    return row


def _own_device(conn: sqlite3.Connection, caller: Caller, device_id: str, request: Request, *, admin_permission: str | None = None) -> sqlite3.Row:
    """The device the caller may act on: the device of their token (and only that one), one of the session user's own, or -
    with `admin_permission` - anyone's. Another user's device answers like a missing one; the attempt is audited."""
    if caller.device is not None:
        if caller.device["id"] != device_id:
            audit(conn, actor=caller.principal, action="presence.device.access", decision="denied", resource_type="mobile_device", resource_id=device_id, reason="not_own_token",
                  request_id=_rid(request), details={"channel": "app"})
            raise not_found("המכשיר לא נמצא.")
        return _device_or_404(conn, device_id)
    row = _device_or_404(conn, device_id)
    if row["user_id"] == caller.principal.user_id:
        return row
    if admin_permission and authorize(conn, caller.principal, admin_permission, INSTALLATION).allowed:
        note_grant(authorize(conn, caller.principal, admin_permission, INSTALLATION), admin_permission)
        return row
    audit(conn, actor=caller.principal, action="presence.device.access", decision="denied", resource_type="mobile_device", resource_id=device_id, reason="not_owner", request_id=_rid(request))
    raise not_found("המכשיר לא נמצא.")


# ---------------------------------------------------------------- models

class RegisterIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1, max_length=200)
    platform: str = Field(min_length=2, max_length=16)
    install_id: str = Field(min_length=1, max_length=128)
    app_version: str | None = Field(default=None, max_length=80)
    os_version: str | None = Field(default=None, max_length=80)
    model: str | None = Field(default=None, max_length=80)


class AckIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notice_version: int


class EventsIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    events: list[dict[str, Any]] = Field(default_factory=list, max_length=svc.BATCH_MAX)
    status: dict[str, Any] | None = None


class RenameIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)


class BreakGlassIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hours: int = Field(ge=0, le=24 * 14)
    reason: str = Field(default="", max_length=200)


# ---------------------------------------------------------------- registration and the caller's own devices

@router.post("/presence/devices")
def register_device(body: RegisterIn, request: Request, response: Response, caller: Caller = Depends(session_caller)) -> dict[str, Any]:
    """Register this phone for the signed-in user (presence.report, any scope): 201 with the device token shown ONCE; 200 when the
    same install registers again (the token is rotated). The name is unique among the user's devices (409 `device_name_taken`
    with a suggestion)."""
    with _db(request).connection(label="presence.register") as conn:
        touch_user(conn, caller.principal)
        _require_anywhere(conn, caller.principal, REPORT, request)
        try:
            device, token, created = svc.register(conn, caller.principal, body.model_dump(), caller.principal.source)
        except svc.PresenceError as exc:
            audit(conn, actor=caller.principal, action="presence.device.register", decision="denied", resource_type="mobile_device", reason=exc.code, request_id=_rid(request))
            raise
        audit(conn, actor=caller.principal, action="presence.device.register", decision="allowed", resource_type="mobile_device", resource_id=device["device_id"], request_id=_rid(request),
              details={"platform": device["platform"], "created": created, "app_version": device["app_version"]})
        sid = mobile_push.server_id(conn)
    response.status_code = 201 if created else 200
    return {"device_id": device["device_id"], "device_token": token, "name": device["name"], "registered_at": device["registered_at"], "created": created, "server_id": sid}


@router.get("/presence/devices/me")
def my_devices(request: Request, caller: Caller = Depends(session_caller)) -> dict[str, Any]:
    """The caller's own registered devices (session)."""
    with _db(request).connection(mode="read", label="presence.devices.me") as conn:
        touch_user(conn, caller.principal)
        return {"devices": svc.list_own(conn, caller.principal.user_id)}


@router.get("/presence/devices")
def all_devices(request: Request, caller: Caller = Depends(session_caller), user_id: str | None = None) -> dict[str, Any]:
    """Everyone's registered devices, what each shares and its current presence state (presence.sensors.view)."""
    with _db(request).connection(mode="read", label="presence.devices") as conn:
        touch_user(conn, caller.principal)
        require(conn, caller.principal, VIEW, INSTALLATION)
        return {"devices": svc.list_all(conn, user_id[:128] if user_id else None), "sensors": [{"key": k, **v} for k, v in svc.SENSORS.items()]}


# ---------------------------------------------------------------- the app's config, the notice, the events

@router.get("/presence/config")
def get_config(request: Request, caller: Caller = Depends(any_caller)) -> dict[str, Any]:
    """What the app must know: the master switch, cadence, the notice (text + version), the allowed sensors, geofences; empty
    allow-lists while the installation is off (device token or session)."""
    with _db(request).connection(mode="read", label="presence.config") as conn:
        if caller.device is not None:
            with _db(request).write_aside() as w:
                svc.touch(w, caller.device["id"])
        cfg = svc.config_for(conn)
        # The opaque installation id the relay push payload carries as `server` (the app stores it with the origin it registered at).
        sid = get_setting(conn, "push.server_id")
        if not sid:
            with _db(request).write_aside() as w:
                sid = mobile_push.server_id(w)
        cfg["server_id"] = sid
        if caller.device is not None:
            cfg["device"] = {"device_id": caller.device["id"], "name": caller.device["name"], "notice_ack_version": caller.device["notice_ack_version"]}
        return cfg


@router.post("/presence/devices/{device_id}/ack")
def ack_notice(device_id: str, body: AckIn, request: Request, caller: Caller = Depends(device_caller)) -> dict[str, Any]:
    """The employee read the notice at `notice_version` (device token). 409 `notice_version_stale` when a newer one exists."""
    with _db(request).connection(label="presence.ack") as conn:
        row = _own_device(conn, caller, device_id, request)
        out = svc.ack_notice(conn, row, body.notice_version)
        audit(conn, actor=caller.principal, action="presence.notice.ack", decision="allowed", resource_type="mobile_device", resource_id=device_id, request_id=_rid(request),
              details={"notice_version": body.notice_version, "channel": "app"})
        return out


@router.post("/presence/devices/{device_id}/events")
def post_events(device_id: str, body: EventsIn, request: Request, caller: Caller = Depends(device_caller)) -> dict[str, Any]:
    """A batch of presence / sensor events (device token; <= 50 events, body <= 64 KiB, idempotent per client_event_id) with the
    phone's status. 400 `sensor_not_allowed` names the sensor the app must switch off; 409 `presence_disabled` /
    `notice_ack_required` say why nothing was stored."""
    with _db(request).connection(label="presence.events") as conn:
        row = _own_device(conn, caller, device_id, request)
        return svc.ingest(conn, row, body.events, body.status)


@router.get("/presence/devices/{device_id}/state")
def device_state(device_id: str, request: Request, caller: Caller = Depends(any_caller)) -> dict[str, Any]:
    """The current presence state and reported status of one device: its own token, its owner's session, or presence.sensors.view."""
    with _db(request).connection(mode="read", label="presence.state") as conn:
        row = _own_device(conn, caller, device_id, request, admin_permission=VIEW)
        return svc.state_of(conn, row["id"])


# ---------------------------------------------------------------- manage

@router.patch("/presence/devices/{device_id}")
def rename_device(device_id: str, body: RenameIn, request: Request, caller: Caller = Depends(any_caller)) -> dict[str, Any]:
    """Rename (its own token or the owner's session)."""
    with _db(request).connection(label="presence.rename") as conn:
        row = _own_device(conn, caller, device_id, request)
        out = svc.rename(conn, row, body.name)
        audit(conn, actor=caller.principal, action="presence.device.rename", decision="allowed", resource_type="mobile_device", resource_id=device_id, request_id=_rid(request),
              details={"via": caller.via})
        return out


@router.delete("/presence/devices/{device_id}", status_code=204)
def unregister_device(device_id: str, request: Request, caller: Caller = Depends(any_caller)) -> Response:
    """Unregister: its own token, the owner's session, or an administrator (system.configure). The token stops working at once
    and the device's event log is dropped."""
    with _db(request).connection(label="presence.unregister") as conn:
        row = _own_device(conn, caller, device_id, request, admin_permission=CONFIGURE)
        svc.unregister(conn, row)
        audit(conn, actor=caller.principal, action="presence.device.unregister", decision="allowed", resource_type="mobile_device", resource_id=device_id, request_id=_rid(request),
              details={"via": caller.via, "owner": row["user_id"], "by_admin": row["user_id"] != caller.principal.user_id})
    return Response(status_code=204)


# ---------------------------------------------------------------- the caller's gate

@router.get("/presence/gate")
def my_gate(request: Request, caller: Caller = Depends(session_caller)) -> dict[str, Any]:
    """What the required-sensors policy says about the caller on THIS channel (the app's user agent counts as the app)."""
    with _db(request).connection(mode="read", label="presence.gate") as conn:
        touch_user(conn, caller.principal)
        gate = svc.gate_for(conn, caller.principal.user_id, app=svc.is_app_user_agent(request.headers.get("user-agent")))
        return {"gate": gate, "sensors": {k: v["name_he"] for k, v in svc.SENSORS.items()}}


# ---------------------------------------------------------------- settings (system.configure)

@router.get("/presence/settings")
def get_settings(request: Request, caller: Caller = Depends(session_caller)) -> dict[str, Any]:
    with _db(request).connection(mode="read", label="presence.settings") as conn:
        touch_user(conn, caller.principal)
        require(conn, caller.principal, CONFIGURE, INSTALLATION)
        return {"settings": svc.load_settings(conn), "sensors": [{"key": k, **v} for k, v in svc.SENSORS.items()], "devices": len(svc.list_all(conn))}


@router.put("/presence/settings")
def put_settings(request: Request, body: dict[str, Any] = Body(...), caller: Caller = Depends(session_caller)) -> dict[str, Any]:
    """A partial update of the presence settings (system.configure): the master switch, the allowed sensors, the employee notice
    (its version rises by itself), cadence, geofences, retention, the required-sensors policy. Audited `presence.settings.update`."""
    with _db(request).connection(label="presence.settings.update") as conn:
        touch_user(conn, caller.principal)
        require(conn, caller.principal, CONFIGURE, INSTALLATION)
        if not svc.take("settings", "*", svc.RATE_SETTINGS):
            raise ApiError(429, "rate_limited", "יותר מדי שינויים. נסו שוב בעוד דקה.", retryable=True)
        st, changes = svc.update_settings(conn, body, caller.principal.user_id)
        audit(conn, actor=caller.principal, action="presence.settings.update", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request), details=changes)
        return {"settings": st, "sensors": [{"key": k, **v} for k, v in svc.SENSORS.items()], "devices": len(svc.list_all(conn))}


@router.post("/presence/settings/break-glass")
def break_glass(body: BreakGlassIn, request: Request, caller: Caller = Depends(session_caller)) -> dict[str, Any]:
    """Suspend the required-sensors policy for `hours` with a reason (0 ends a suspension). Audited `presence.break_glass`."""
    with _db(request).connection(label="presence.break_glass") as conn:
        touch_user(conn, caller.principal)
        require(conn, caller.principal, CONFIGURE, INSTALLATION)
        out = svc.break_glass(conn, caller.principal.user_id, body.hours, body.reason)
        audit(conn, actor=caller.principal, action="presence.break_glass", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"hours": body.hours, "reason": body.reason[:200], "until": out["until"]})
        return {"break_glass": out}
