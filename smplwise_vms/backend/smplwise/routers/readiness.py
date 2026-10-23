"""CR-READY96 slice 1: installation readiness - the HTTP surface (services/readiness.py is the rule; Arx RBAC is the only authority).

    GET  /readiness                 the report computed now (read-only: no device is probed, nothing is written)      system.configure
    POST /readiness/check           the same, and one history row when the score or a status moved (once per 30 s)    system.configure
    PUT  /readiness/attest/{id}     record / withdraw the hand-over (a configured check). Never refused for a low score  system.configure
    GET  /readiness/settings        the thresholds and weights                                                         system.configure
    PUT  /readiness/settings        edit them (confirmed, audited)                                                     system.configure

Only whoever configures the system sees any of this (owner decision, review 24.10 form Q7): no other manager gets a card."""
from __future__ import annotations

import sqlite3
import threading
import time
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, Field

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import readiness as svc

router = APIRouter()

CHECK_EVERY_S = 30.0
_last_check: dict[str, float] = {}
_lock = threading.Lock()


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _payload(conn: sqlite3.Connection, request: Request) -> dict[str, Any]:
    report = svc.evaluate(conn, settings_of(request))
    return {**report, "history": svc.last_history(conn, 10), "settings": svc.settings_view(conn), "check_every_s": int(CHECK_EVERY_S)}


class AttestBody(BaseModel):
    done: bool
    note: str = Field(default="", max_length=500)
    customer_name: str = Field(default="", max_length=120)
    printed_guide: bool = False


class SettingsBody(BaseModel):
    changes: dict[str, Any]
    confirmed: Any = None


@router.get("/readiness")
def get_readiness(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, svc.PERMISSION, INSTALLATION)
    return _payload(conn, request)


@router.post("/readiness/check")
def post_check(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.PERMISSION, INSTALLATION)
    now = time.monotonic()
    key = f"{id(request.app)}:{principal.user_id}"
    with _lock:
        prev = _last_check.get(key)
        if prev is not None and now - prev < CHECK_EVERY_S:
            raise ApiError(429, "check_rate_limited", "הבדיקה הורצה הרגע. נסו שוב בעוד רגע.", details={"retry_after_s": int(CHECK_EVERY_S - (now - prev)) + 1})
        _last_check[key] = now
    report = svc.evaluate(conn, settings_of(request))
    svc.record(conn, report)
    return {**report, "history": svc.last_history(conn, 10), "settings": svc.settings_view(conn), "check_every_s": int(CHECK_EVERY_S)}


@router.put("/readiness/attest/{check_id}")
def put_attest(body: AttestBody, request: Request, check_id: str = Path(min_length=1, max_length=64), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.PERMISSION, INSTALLATION)
    payload = {"customer_name": body.customer_name.strip(), "printed_guide": body.printed_guide}
    report = svc.attest(conn, settings_of(request), principal, check_id, body.done, body.note, payload, _rid(request))
    return {**report, "history": svc.last_history(conn, 10), "settings": svc.settings_view(conn), "check_every_s": int(CHECK_EVERY_S)}


@router.get("/readiness/settings")
def get_settings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, svc.PERMISSION, INSTALLATION)
    return {"settings": svc.settings_view(conn)}


@router.put("/readiness/settings")
def put_settings(body: SettingsBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.PERMISSION, INSTALLATION)
    if body.confirmed is not True:
        raise ApiError(409, "confirmation_required", "הפעולה דורשת אישור מפורש.")
    changed = svc.update_settings(conn, principal, body.changes, _rid(request))
    return {"settings": svc.settings_view(conn), "changed": sorted(changed)}
