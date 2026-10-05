"""CR-028 phase 1: "שדר למסך" - cast one camera to a media screen (services/cast_sessions.py; docs/changes/CR-028-CAST-TO-SCREENS.md
section 12). All under /api/v1/multimedia/cast. The relay itself (`/cast/<token>/...`) is NOT here: it listens on its own port
(services/cast_relay.py) and is never reachable through Ingress or /arx.

Operators (media.cast at the screen's anchor; video.live on the camera):
  GET    targets[?camera=<id>]           the screens the caller may cast to (this camera to), with their state; blocked ones per the setting
  GET    sessions                        the casts the caller may see (their own, their floors' screens; everything for an administrator)
  GET    sessions/{id}                   one cast (also after it ended: the pill shows why)
  POST   sessions                        start (202; 200 `refused` when the bridge / HA said no); idempotent on client_request_id
  POST   sessions/{id}/extend            +minutes, at most 8 times; never a permanent or a test cast
  POST   sessions/{id}/switch            another camera on the same screen
  DELETE sessions/{id}[?power_off=false] stop (the screen is switched off again only if it was off before and the option is on)

Administrators (system.configure; LOCAL ONLY - remote_channel.BLOCKED_ON_REMOTE):
  GET / PUT config, POST origin/check, GET screens, PUT screens/{key}, POST test (a 60-second cast to any capable screen).

A remote user (/arx) may press start / extend / switch / stop: the playback itself runs on the LAN (the TV pulls from the relay) and
does not use the remote live-stream quota; casts have their own cap (`max_sessions`)."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..remote_channel import channel_of
from ..services import cast_sessions as cs
from ..services import media_store as store

router = APIRouter()
SID = r"^[0-9a-f]{32}$"
KEY = Field(min_length=1, max_length=64)
RID = Field(min_length=8, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class StartBody(_Body):
    target_key: str = KEY
    camera_id: str = Field(min_length=1, max_length=64)
    profile: Literal["sub", "main"] = "sub"
    duration: Literal["default", "permanent"] = "default"
    client_request_id: str = RID
    confirmed: bool | None = None
    power_off_after: bool | None = None


class SwitchBody(_Body):
    camera_id: str = Field(min_length=1, max_length=64)
    profile: Literal["sub", "main"] = "sub"


class TestBody(_Body):
    target_key: str = KEY
    camera_id: str = Field(min_length=1, max_length=64)


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _configure(conn: sqlite3.Connection, principal: Principal) -> None:
    require(conn, principal, cs.CONFIGURE, INSTALLATION)


def _caster(conn: sqlite3.Connection, principal: Principal) -> store.Access:
    """media.cast somewhere (installation or a floor) - the audited 403 otherwise; 404 feature_disabled when multimedia is off."""
    access = store.Access(conn, principal, (cs.PERM_CAST,))
    if not access.anywhere(cs.PERM_CAST):
        require(conn, principal, cs.PERM_CAST, INSTALLATION)
    if not store.enabled(conn):
        raise ApiError(404, "feature_disabled", "המולטימדיה כבויה בהגדרות המערכת.")
    return access


def _sid(session_id: str) -> str:
    import re

    if not re.fullmatch(SID, session_id or ""):
        raise ApiError(404, "not_found", cs.MESSAGES["not_found"])
    return session_id


# ---------------------------------------------------------------- administration (local only)

@router.get("/multimedia/cast/config")
def get_config(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _configure(conn, principal)
    settings = settings_of(request)
    ready, why = cs.readiness(conn, settings)
    b = store.bridge_state(conn)
    b_ok, b_why = cs.bridge_ready(conn)
    return {"config": cs.config(conn), "relay": cs.relay_status(settings), "bridge": {"paired": b["paired"], "version": b["version"], "required": cs.BRIDGE_CAST_REQUIRED, "ready": b_ok},
            "ready": ready and b_ok, "reason": why or b_why}


@router.put("/multimedia/cast/config")
def put_config(body: dict[str, Any], request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _configure(conn, principal)
    changed = cs.update_config(conn, settings_of(request), body)
    if changed:
        details = {k: (v if k != "origin" else bool(v)) for k, v in body.items() if k in changed}  # never the origin's address
        audit(conn, actor=principal, action="media.cast.config", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"changed": changed, **details})
    return {"changed": changed, **get_config(request, principal, conn)}


@router.post("/multimedia/cast/origin/check")
def check_origin(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _configure(conn, principal)
    out = cs.check_origin(conn, settings_of(request))
    audit(conn, actor=principal, action="media.cast.config", decision="allowed" if out["ok"] else "denied", resource_type="installation", resource_id="*",
          reason=out.get("reason"), request_id=_rid(request), details={"origin_check": out["ok"]})
    return out


@router.get("/multimedia/cast/screens")
def admin_screens(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _configure(conn, principal)
    return {"screens": cs.admin_screens(conn)}


@router.put("/multimedia/cast/screens/{key}")
def put_screen(key: str, body: dict[str, Any], request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _configure(conn, principal)
    new, changed = cs.update_screen(conn, key, body)
    if changed:
        audit(conn, actor=principal, action="media.cast.screen", decision="allowed", resource_type="media_device", resource_id=key, request_id=_rid(request),
              details={"changed": changed, **{k: new[k] for k in changed}})
    return {"key": key, "settings": new, "changed": changed}


@router.post("/multimedia/cast/test", status_code=202)
def test_cast(body: TestBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """The administrator's 60-second test cast to one capable screen (owner decision Q12): allowed even before the screen's own switch is on."""
    _configure(conn, principal)
    status, result = cs.start(conn, settings_of(request), principal, _rid(request), {"target_key": body.target_key, "camera_id": body.camera_id, "profile": "sub"},
                              channel=channel_of(request), kind="test")
    return JSONResponse(status_code=status, content=result)


# ---------------------------------------------------------------- operators

@router.get("/multimedia/cast/targets")
def get_targets(request: Request, camera: str | None = Query(None, min_length=1, max_length=64), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _caster(conn, principal)
    return cs.targets(conn, settings_of(request), principal, camera)


@router.get("/multimedia/cast/sessions")
def list_sessions(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    access = store.Access(conn, principal, (store.PERM_READ, cs.PERM_CAST))
    if not (access.anywhere(store.PERM_READ) or access.anywhere(cs.PERM_CAST)):
        require(conn, principal, store.PERM_READ, INSTALLATION)
    return {"sessions": cs.list_sessions(conn, principal), "max_sessions": cs.config(conn)["max_sessions"]}


@router.get("/multimedia/cast/sessions/{session_id}")
def get_session(session_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return cs.get_session(conn, principal, _sid(session_id))


@router.post("/multimedia/cast/sessions", status_code=202)
def start_session(body: StartBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    _caster(conn, principal)
    status, result = cs.start(conn, settings_of(request), principal, _rid(request), body.model_dump(), channel=channel_of(request))
    return JSONResponse(status_code=status, content=result)


@router.post("/multimedia/cast/sessions/{session_id}/extend")
def extend_session(session_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return cs.extend(conn, principal, _rid(request), _sid(session_id))


@router.post("/multimedia/cast/sessions/{session_id}/switch", status_code=202)
def switch_session(session_id: str, body: SwitchBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    status, result = cs.switch(conn, settings_of(request), principal, _rid(request), _sid(session_id), body.camera_id, body.profile)
    return JSONResponse(status_code=status, content=result)


@router.delete("/multimedia/cast/sessions/{session_id}")
def stop_session(session_id: str, request: Request, power_off: bool | None = Query(None), principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return cs.stop(conn, settings_of(request), principal, _rid(request), _sid(session_id), power_off=power_off)
