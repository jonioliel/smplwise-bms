"""STATIONPERM-295 (docs/changes/CR-STATION-PERMISSIONS-295.md): the API of a person's access per access-control station.

Authority is decided in services/access_station_permissions.py (rbac.authorize over the station chain, deny-overrides); refusals are
audited there. Every route answers 404 `station_permissions_off` while the switch is off, and the switch cannot be turned on in this
build (access_grants.GO_LIVE_PERMITTED is False).

- GET  /access-station-permissions/settings                                   system administrator
- PUT  /access-station-permissions/settings                                   system administrator; `on` refused without the go-live permit
- GET  /access-station-permissions/people/{person_id}                         the person's stations, sources, decisions and the caller's actions
- PUT  /access-station-permissions/people/{person_id}/stations/{station_id}   {effect, relays, revision}: decide, or request a widening
- POST /access-station-permissions/people/{person_id}/stations/{station_id}/approve   {revision}
- POST /access-station-permissions/people/{person_id}/stations/{station_id}/refuse    {revision}
- POST /access-station-permissions/people/{person_id}/stations/{station_id}/sync      {revision}: send again / read back"""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, ConfigDict, Field, StrictInt

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn
from ..db import set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, is_system_admin, require
from ..services import access_station_permissions as sp

router = APIRouter()
_ID = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
_BASE = "/access-station-permissions"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _db(request: Request):
    return request.app.state.db


class DecideIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    effect: Literal["allow", "deny", "inherit"]
    relays: list[StrictInt] | None = Field(default=None, max_length=8)
    revision: StrictInt = Field(ge=0)


class RevisionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: StrictInt = Field(ge=1)


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    station_permissions: Literal["off", "on"]


def _admin_only(conn: sqlite3.Connection, principal: Principal, request: Request, action: str, keys: list[str]) -> None:
    require(conn, principal, "system.configure", INSTALLATION)
    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action=action, decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
              request_id=_rid(request), details={"keys": keys})
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לטפל בהגדרה זו.")


@router.get(f"{_BASE}/settings")
def get_settings(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _admin_only(conn, principal, request, "settings.read", list(sp.KEYS))
    return sp.settings_view(conn)


@router.put(f"{_BASE}/settings")
def put_settings(body: SettingsIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    with _db(request).connection(label="station_permissions.settings") as conn:
        _admin_only(conn, principal, request, "settings.changed", list(sp.KEYS))
        if body.station_permissions == "on" and not sp.ag.go_live_permitted():
            audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="installation", resource_id="*", request_id=_rid(request),
                  reason="station_permissions_not_permitted", details={"key": sp.FLAG_KEY, "requested": "on"})
            raise ApiError(409, "station_permissions_not_permitted", "הפעלת הרשאות לפי עמדה דורשת אישור הפעלה נפרד מבעל המערכת, וגרסה זו אינה כוללת אותו.")
        before = sp.settings_view(conn)["station_permissions"]
        set_setting(conn, sp.FLAG_KEY, body.station_permissions)
        audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"key": sp.FLAG_KEY, "before": before, "after": body.station_permissions})
        return sp.settings_view(conn)


@router.get(f"{_BASE}/people/{{person_id}}")
def person(request: Request, person_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return sp.person_view(_db(request), principal, person_id)


@router.put(f"{_BASE}/people/{{person_id}}/stations/{{station_id}}")
def decide(body: DecideIn, request: Request, person_id: str = Path(..., pattern=_ID), station_id: str = Path(..., pattern=_ID),
           principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return sp.decide(_db(request), principal, person_id, station_id, body.effect, body.relays, body.revision, _rid(request))


@router.post(f"{_BASE}/people/{{person_id}}/stations/{{station_id}}/approve")
def approve(body: RevisionIn, request: Request, person_id: str = Path(..., pattern=_ID), station_id: str = Path(..., pattern=_ID),
            principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return sp.approve(_db(request), principal, person_id, station_id, body.revision, _rid(request))


@router.post(f"{_BASE}/people/{{person_id}}/stations/{{station_id}}/refuse")
def refuse(body: RevisionIn, request: Request, person_id: str = Path(..., pattern=_ID), station_id: str = Path(..., pattern=_ID),
           principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return sp.refuse(_db(request), principal, person_id, station_id, body.revision, _rid(request))


@router.post(f"{_BASE}/people/{{person_id}}/stations/{{station_id}}/sync")
def sync(body: RevisionIn, request: Request, person_id: str = Path(..., pattern=_ID), station_id: str = Path(..., pattern=_ID),
         principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return sp.push(_db(request), principal, person_id, station_id, _rid(request), check_rights=True, revision=body.revision)
