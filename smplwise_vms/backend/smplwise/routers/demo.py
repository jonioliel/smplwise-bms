"""CR-READY96 slice 1: demo mode - the HTTP surface (services/demo_mode.py is the rule; Arx RBAC is the only authority).

    GET  /demo            every signed-in user: is a demo running, until when, started by whom (the banner). Whoever may run one also learns that.
    POST /demo/start      `demo.run` at the installation: {dataset, scenario, hours}. Over the remote channel only when `demo.allow_remote` is on
                          (the installer's own server) or the caller holds `demo.run_anywhere` (the owner).
    POST /demo/extend     `demo.run`: {hours}, never beyond 24 h from the start
    POST /demo/stop       `demo.run`
    PUT  /demo/settings   `system.configure`, confirmed, refused while a demo runs: {allow_remote: on|off}

`demo.run` and `demo.run_anywhere` are sensitive permissions in no built-in role: an administrator grants them by naming them in a custom role."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..remote_channel import channel_of
from ..services import demo_mode as svc

router = APIRouter()


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _db(request: Request):
    return request.app.state.db


class StartBody(BaseModel):
    dataset: Literal["residential", "office", "retail"] = "residential"
    scenario: Literal["normal", "cameras_offline", "new_installation"] = "normal"
    hours: float = Field(default=svc.DEFAULT_HOURS, gt=0, le=svc.MAX_HOURS)


class ExtendBody(BaseModel):
    hours: float = Field(gt=0, le=svc.MAX_HOURS)


class SettingsBody(BaseModel):
    allow_remote: Literal["on", "off"]
    confirmed: Any = None


@router.get("/demo")
def get_demo(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    out = svc.me_block(_db(request))
    can_run = authorize(conn, principal, svc.RUN_PERMISSION, INSTALLATION).allowed
    out["can_run"] = can_run
    out["datasets"] = list(svc.DATASETS)
    out["scenarios"] = list(svc.SCENARIOS)
    out["max_hours"] = svc.MAX_HOURS
    if can_run:
        out["allow_remote"] = svc.setting_allow_remote(conn)
    return out


@router.post("/demo/start")
def post_start(body: StartBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.RUN_PERMISSION, INSTALLATION)
    remote = channel_of(request) == "remote"
    anywhere = authorize(conn, principal, svc.ANYWHERE_PERMISSION, INSTALLATION).allowed
    return svc.start(_db(request), request.app.state.settings, conn, principal, body.dataset, body.scenario, body.hours, remote=remote, holds_anywhere=anywhere, rid=_rid(request))


@router.post("/demo/extend")
def post_extend(body: ExtendBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.RUN_PERMISSION, INSTALLATION)
    return svc.extend(_db(request), principal, body.hours)


@router.post("/demo/stop")
def post_stop(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.RUN_PERMISSION, INSTALLATION)
    return svc.stop(_db(request), request.app.state.settings, principal, conn, _rid(request))


@router.put("/demo/settings")
def put_settings(body: SettingsBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.CONFIGURE, INSTALLATION)
    if svc.active(_db(request)):
        raise ApiError(409, "demo_active", "אי אפשר לשנות הגדרות בזמן הדגמה.")
    if body.confirmed is not True:
        raise ApiError(409, "confirmation_required", "הפעולה דורשת אישור מפורש.")
    before = "on" if svc.setting_allow_remote(conn) else "off"
    set_setting(conn, svc.ALLOW_REMOTE, body.allow_remote)
    audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="setting", resource_id=svc.ALLOW_REMOTE, request_id=_rid(request),
          details={"key": svc.ALLOW_REMOTE, "before": before, "after": body.allow_remote})
    return {"allow_remote": body.allow_remote == "on"}
