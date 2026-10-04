"""Recorder health (CR-026): the per-recorder health cards of הגדרות › בריאות ועבודות and their thresholds.

- GET  /recorder-health            the cards (whoever may read the recorders: system.configure or any NVR permission)
- POST /recorder-health/check      one fresh pass now (system.configure; at most every 15 s; device reads only)
- GET  /recorder-health/settings   the thresholds with their ranges (system.configure)
- PUT  /recorder-health/settings   change thresholds (system.configure, audited)

Names and states only: never an address, a credential, a serial number or a MAC. The path is not under /recorders/ so it
cannot be taken for a recorder id."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Body, Depends, Request

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import database_of, unlocked
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import recorder_health as rh
from .recorders import PERMISSION, _may_read

router = APIRouter()


@router.get("/recorder-health")
def get_health(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CR-026: the health card of every monitored recorder (names and states only; never an address or a credential)."""
    _may_read(conn, principal)
    th = rh.thresholds(conn)
    return {"recorders": rh.view(conn, settings_of(request)), "interval_s": th["interval_s"],
            "can_manage": authorize(conn, principal, PERMISSION, INSTALLATION).allowed}


@router.post("/recorder-health/check")
def check(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CR-026: one fresh read-only health pass of every recorder now (at most every 15 s), then the cards."""
    require(conn, principal, PERMISSION, INSTALLATION)
    db = database_of(conn)
    ran = False
    if db is not None:
        with unlocked(conn):
            ran = rh.check_now(db, settings_of(request))
    return {"checked": ran, "recorders": rh.view(conn, settings_of(request))}


@router.get("/recorder-health/settings")
def get_settings(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CR-026: the recorder health thresholds with their defaults and ranges."""
    require(conn, principal, PERMISSION, INSTALLATION)
    return {"values": rh.thresholds(conn), "ranges": rh.ranges(), "recording_modes": list(rh.RECORDING_MODES)}


@router.put("/recorder-health/settings")
def put_settings(request: Request, body: dict[str, Any] = Body(...), principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CR-026: change recorder health thresholds (validated against their ranges; audited)."""
    require(conn, principal, PERMISSION, INSTALLATION)
    changes = rh.validate(body)
    values = rh.save_thresholds(conn, changes)
    audit(conn, actor=principal, action="recorder_health.settings", decision="allowed", resource_type="settings", resource_id=rh.SETTING_KEY,
          request_id=getattr(request.state, "correlation_id", None), details={"changed": sorted(changes)})
    return {"values": values, "ranges": rh.ranges(), "recording_modes": list(rh.RECORDING_MODES)}
