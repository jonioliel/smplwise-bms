"""CR-027 phase 2: the phone app's push registration and the text fetch of its notification extension
(docs/api/mobile-presence-contract.md section 7). Device-token routes, resolved like routers/presence.py (never the remote
channel's bearer path, own connection per route). Included BEFORE routers/notifications so that `notifications/categories`
and `notifications/devices` are not swallowed by its `/notifications/{nid}`."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import touch_user
from ..db import Database
from ..errors import ApiError, not_found
from ..services import mobile_push as svc
from .presence import CONFIGURE, Caller, _own_device, _rid, any_caller, device_caller

router = APIRouter()


def _db(request: Request) -> Database:
    return request.app.state.db


class PushRegisterIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    platform: str = Field(min_length=2, max_length=16)
    relay_token: str = Field(min_length=1, max_length=512)
    app_version: str | None = Field(default=None, max_length=80)


class MutedIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    muted: list[str] = Field(default_factory=list, max_length=32)


@router.post("/notifications/devices")
def register_push(body: PushRegisterIn, request: Request, caller: Caller = Depends(device_caller)) -> dict[str, Any]:
    """Register (or refresh) this device's relay token for push (device token). Re-sent whenever the relay token changes."""
    with _db(request).connection(label="mobile_push.register") as conn:
        out = svc.register(conn, caller.device, body.platform, body.relay_token, body.app_version)
        audit(conn, actor=caller.principal, action="notify.app.register", decision="allowed", resource_type="mobile_device", resource_id=caller.device["id"], request_id=_rid(request),
              details={"platform": body.platform, "channel": "app"})
        return out


@router.patch("/notifications/devices/{device_id}")
def set_muted(device_id: str, body: MutedIn, request: Request, caller: Caller = Depends(any_caller)) -> dict[str, Any]:
    """The categories this device mutes (its own token or the owner's session). A critical row and an escalation step pass anyway."""
    with _db(request).connection(label="mobile_push.muted") as conn:
        row = _own_device(conn, caller, device_id, request)
        return svc.set_muted(conn, row, body.muted)


@router.delete("/notifications/devices/{device_id}", status_code=204)
def unregister_push(device_id: str, request: Request, caller: Caller = Depends(any_caller)) -> Response:
    """Stop push to this device (its own token, the owner's session, or system.configure). The device registration itself stays."""
    with _db(request).connection(label="mobile_push.unregister") as conn:
        row = _own_device(conn, caller, device_id, request, admin_permission=CONFIGURE)
        svc.unregister(conn, row["id"])
        audit(conn, actor=caller.principal, action="notify.app.unregister", decision="allowed", resource_type="mobile_device", resource_id=device_id, request_id=_rid(request), details={"via": caller.via})
    return Response(status_code=204)


@router.get("/notifications/categories")
def list_categories(request: Request, caller: Caller = Depends(any_caller)) -> dict[str, Any]:
    """The notification categories the app offers to mute, with the ones that are critical (device token or session)."""
    if caller.device is None:
        with _db(request).connection(mode="read", label="mobile_push.categories") as conn:
            touch_user(conn, caller.principal)
    return {"categories": svc.categories()}


@router.get("/notifications/app/{message_id}")
def app_message(message_id: str, request: Request, caller: Caller = Depends(device_caller)) -> dict[str, Any]:
    """The real title and body of one push for THIS device (its notification extension; device token). 404 for another device's
    message, an unknown id, or one older than 24 hours."""
    with _db(request).connection(label="mobile_push.message") as conn:
        got = svc.message_for(conn, caller.device["id"], message_id[:64])
        if got is None:
            raise not_found("ההתראה לא נמצאה או שפג תוקפה.")
        return got


@router.post("/notifications/app/test")
def test_push(request: Request, caller: Caller = Depends(device_caller)) -> dict[str, Any]:
    """A test push to this device through the relay (3 per minute per device)."""
    if not svc.take_test_token(caller.device["id"]):
        raise ApiError(429, "rate_limited", "יותר מדי התראות בדיקה. נסו שוב בעוד דקה.", retryable=True)
    with _db(request).connection(label="mobile_push.test.audit") as conn:
        audit(conn, actor=caller.principal, action="notify.app.test", decision="allowed", resource_type="mobile_device", resource_id=caller.device["id"], request_id=_rid(request))
    return svc.send_test(_db(request), caller.device["id"])  # the relay is called with no request lock held
