"""WISKEY-INBOUND-CALLS-2382: incoming door-station calls - the banner's read, the call log and the banner setting
(services/intercom_calls.py). Its own router and its own line in main.py, like the other access-control slices.

  GET  intercom/calls/active     access.call somewhere a station can be; the ringing calls this caller may answer (per station:
                                 access.read + access.call on the station's chain, the setting's role / station filter), the
                                 calls this caller answered from Arx, and whether the ring may sound now.
  GET  intercom/calls            the call log, newest first (per row: access.read + access.events.read or access.call on the station).
  GET  intercom/calls/settings   system.configure; the setting + the roles and stations it can name.
  PUT  intercom/calls/settings   system.configure; audited.

Nothing here sends anything to WisKey: answer / reject / hang up stay on POST intercom/stations/{id}/call, the door on
POST intercom/stations/{id}/release, talk on POST access-control/stations/{id}/talk - each with its own checks and audit."""
from __future__ import annotations

import sqlite3
import time
from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from ..audit import audit
from ..auth import current_principal, get_conn, get_read_conn, read_gate, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, ROLES, custom_roles, require, role_name
from ..services import door_authority, intercom_calls, intercom_sync, wiskey_camera
from ..services import intercom_authority as ia

router = APIRouter()
CONFIGURE = "system.configure"
MAX_STATION_ID = 128

_caller_ro = read_gate(lambda conn, principal: ia.require_anywhere(conn, principal, ia.CALL))
_history_ro = read_gate(lambda conn, principal: ia.require_anywhere(conn, principal, ia.READ))
_admin_ro = read_gate(lambda conn, principal: require(conn, principal, CONFIGURE, INSTALLATION))


def _stations(request: Request) -> tuple[str, dict[str, Any] | None]:
    """The feed state and the served copy - without counting as someone looking (a banner polling on every screen must not keep
    WisKey's overview polling alive; the ring itself arrives through the station entities the feed subscribes to)."""
    return intercom_sync.SYNC.served(settings_of(request))


@router.get("/intercom/calls/active")
def active_calls(request: Request, principal: Principal = Depends(_caller_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`{enabled, mode, feed, sound, sound_reason, server_time_ms, calls: [...]}`. `calls` is empty unless the feed is live: a ring
    on a last-known copy is never offered (the station may have stopped ringing long ago)."""
    state, overview = _stations(request)
    stations = {s["id"]: s for s in (overview or {}).get("stations") or [] if isinstance(s, dict) and s.get("id")}
    settings = settings_of(request)
    camera = wiskey_camera.camera_access(conn, settings, overview) if overview else {}
    open_ids = [c.station_id for c in intercom_calls.BOOK.open_calls() if c.station_id in stations]
    doors = door_authority.door_access_map(conn, principal, open_ids, dev_mode=bool(settings.dev_user)) if open_ids else {}
    body = intercom_calls.active_for(conn, principal, stations=stations, camera=camera, doors=doors)
    if state != "ready":
        body["calls"] = []
    body["feed"] = state
    body["server_time_ms"] = int(time.time() * 1000)
    return body


@router.get("/intercom/calls")
def call_log(request: Request, station_id: str | None = Query(default=None, max_length=MAX_STATION_ID), limit: int = Query(default=20, ge=1, le=intercom_calls.MAX_LIST),
             before: str | None = Query(default=None, max_length=40), principal: Principal = Depends(_history_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The call log, newest first. `before` = the previous page's last `rang_at`. Rows of stations the caller may not read are left out.
    Calls still queued for the writer (a second or less) are included from memory."""
    rows = intercom_calls.history(conn, principal, station_id, limit, before)
    seen = {r["id"] for r in rows}
    live = [c for c in intercom_calls.BOOK.open_calls() + intercom_calls.BOOK.recent() if c.id not in seen and (not station_id or c.station_id == station_id) and (not before or c.rang_at < before)]
    if live:
        auth = ia.Authority(conn, principal)
        for c in live:
            if auth.station(ia.READ, c.station_id) and any(auth.station(p, c.station_id) for p in intercom_calls.HISTORY_PERMISSIONS):
                row = c.row()
                rows.append({k: v for k, v in row.items() if k not in ("answered_by", "ended_by", "door_opened_by")} | {"answered_by_me": row["answered_by"] == principal.user_id})
        rows.sort(key=lambda r: r["rang_at"], reverse=True)
        rows = rows[:limit]
    return {"calls": rows, "next": rows[-1]["rang_at"] if len(rows) >= limit else None, "retention_days": intercom_calls.RETENTION_DAYS}


def _settings_view(conn: sqlite3.Connection, request: Request) -> dict[str, Any]:
    _state, overview = _stations(request)
    roles = [{"id": rid, "name": role_name(conn, rid)} for rid in ROLES] + [{"id": rid, "name": role_name(conn, rid)} for rid in custom_roles(conn)]
    stations = [{"id": s["id"], "name": s.get("name") or ""} for s in (overview or {}).get("stations") or [] if isinstance(s, dict) and s.get("id")]
    return {"settings": intercom_calls.load_settings(conn), "roles": roles, "stations": stations, "defaults": dict(intercom_calls.DEFAULT_SETTINGS)}


@router.get("/intercom/calls/settings")
def get_call_settings(request: Request, principal: Principal = Depends(_admin_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return _settings_view(conn, request)


@router.put("/intercom/calls/settings")
def put_call_settings(request: Request, body: dict[str, Any], principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """`{mode: off|everyone|roles, roles: [role id], stations: [station id] (empty = all), sound: bool}`. Audited with the old and new value."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    known = set(ROLES) | set(custom_roles(conn))
    try:
        value = intercom_calls.validate_settings(body, known)
    except intercom_calls.SettingsInvalid as exc:
        raise ApiError(422, "validation", str(exc), details={"field": exc.field}) from None
    old = intercom_calls.load_settings(conn)
    intercom_calls.save_settings(conn, value)
    audit(conn, actor=principal, action="intercom.call_banner.settings", decision="allowed", resource_type="setting", resource_id=intercom_calls.SETTING_KEY,
          request_id=getattr(request.state, "correlation_id", None), details={"old": old, "new": value})
    return _settings_view(conn, request)
