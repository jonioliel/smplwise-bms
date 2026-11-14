"""EXTERNALBUILD-297 (CR-VISITOR105): the visitor invitations API, on the external-access grant engine (services/access_visitors.py).

OFF by default: while `access.visitors` is off (or the external access is off) every route but the settings answers 404.

- GET    /access/visitors                       the caller's invitations + those on stations he manages (`?mine=1`: his own only)
- POST   /access/visitors                       invite (interactive; `access.visitor.invite` on every chosen station)
- GET    /access/visitors/{id}
- DELETE /access/visitors/{id}                  cancel (the host) / revoke (a manager of one of its stations)
- POST   /access/visitors/{id}/verify/send      the verification code to the visitor's number (the host)
- POST   /access/visitors/{id}/verify/check     the code the visitor read to the host (the host)
- PUT    /access/visitors/entrances/{station}   the "visitor entrance" flag (access.external.grant on the station + system.configure)
- POST   /access/visitors/revoke-all            system administrator, typed word
- GET|PUT /access/visitors/settings             system administrator (switch, envelope values, retention)"""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, is_system_admin, require
from ..services import access_visitors as av

router = APIRouter()
_ID = r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _db(request: Request):
    return request.app.state.db


class InviteIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    visitor_name: str = Field(max_length=80)
    phone: str = Field(max_length=32)
    lang: Literal["he", "en", "ar", "ru"] = "he"
    doors: dict[str, list[int]]
    valid_from: str = Field(max_length=20)
    valid_until: str = Field(max_length=20)
    timing: dict[str, Any] | None = None
    mode: Literal["window", "single_entry"] | None = None
    purpose: Literal["guest", "meeting", "delivery", "service", "other"] = "guest"
    told: bool = False
    client_request_id: str | None = Field(default=None, max_length=64, pattern=_ID)


class CodeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(max_length=16)


class FlagIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    visitor_entrance: bool


class ConfirmIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: str = Field(max_length=32)


class VisitorSettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    visitors: Literal["off", "on"] | None = None
    max_hours: int | None = Field(default=None, ge=1, le=72)
    max_ahead_days: int | None = Field(default=None, ge=1, le=90)
    host_live_max: int | None = Field(default=None, ge=1, le=10)
    host_day_max: int | None = Field(default=None, ge=1, le=20)
    installation_live_max: int | None = Field(default=None, ge=1, le=100)
    erase_after_days: int | None = Field(default=None, ge=1, le=365)
    single_entry_default: Literal["off", "on"] | None = None


def _admin_or_403(conn: sqlite3.Connection, principal: Principal, request: Request, action: str) -> None:
    require(conn, principal, "system.configure", INSTALLATION)
    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action=action, decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
              request_id=_rid(request))
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לשנות הגדרה זו.")


@router.get("/access/visitors/settings")
def get_settings(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _admin_or_403(conn, principal, request, "settings.read")
    return av.settings_view(conn)


@router.put("/access/visitors/settings")
def put_settings(body: VisitorSettingsIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    with _db(request).connection(label="access_visitors.settings") as conn:
        _admin_or_403(conn, principal, request, "settings.changed")
        changes = {k: v for k, v in body.model_dump().items() if v is not None}
        if not changes:
            raise ApiError(422, "validation", "לא נשלחה הגדרה לשינוי.")
        for key, before, after in av.apply_settings(conn, changes):
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
                  details={"key": key, "before": before, "after": after})
        return av.settings_view(conn)


@router.put("/access/visitors/entrances/{station_id}")
def entrance(body: FlagIn, request: Request, station_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return av.set_visitor_entrance(_db(request), principal, station_id, body.visitor_entrance, _rid(request))


@router.post("/access/visitors/revoke-all")
def revoke_all(body: ConfirmIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return {"revoked": av.revoke_all(_db(request), principal, body.confirm, _rid(request))}


@router.get("/access/visitors")
def list_visitors(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
                  mine: bool = Query(False)) -> dict[str, Any]:
    if not av.enabled(conn):
        raise av._hidden()
    return {"visitors": av.list_for(conn, principal, mine_only=mine), "settings": {k: v for k, v in av.settings_view(conn).items() if k != "caps"}}


@router.post("/access/visitors")
def create(body: InviteIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return {"visitor": av.invite(_db(request), principal, body.model_dump(), _rid(request))}


@router.get("/access/visitors/{invite_id}")
def one(invite_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro),
        conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    if not av.enabled(conn):
        raise av._hidden()
    rows = [v for v in av.list_for(conn, principal, limit=1000) if v["id"] == invite_id]
    if not rows:
        raise av._hidden()
    return {"visitor": rows[0]}


@router.delete("/access/visitors/{invite_id}")
def cancel(request: Request, invite_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return {"visitor": av.cancel(_db(request), principal, invite_id, _rid(request))}


@router.post("/access/visitors/{invite_id}/verify/send")
def verify_send(request: Request, invite_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return av.verify_send(_db(request), principal, invite_id, _rid(request))


@router.post("/access/visitors/{invite_id}/verify/check")
def verify_check(body: CodeIn, request: Request, invite_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return {"visitor": av.verify_check(_db(request), principal, invite_id, body.code, _rid(request))}
