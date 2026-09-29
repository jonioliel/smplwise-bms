"""Setup wizard API (T071): the six steps install → NVR → Home Assistant → go2rtc → floor → camera with their evidence,
explanations and links (services/setup_wizard.py). Both routes need system.configure at installation scope; nothing
here writes to a device."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn, settings_of
from ..errors import not_found
from ..rbac import INSTALLATION, Principal, require
from ..services import setup_wizard as wizard

router = APIRouter()


@router.get("/setup/state")
def setup_state(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Every step's status without a device probe: the add-on's own facts, the last on-demand check of a device step
    (kept `live_ttl_s`) or what the background jobs know. Cheap enough for the shell's "complete the setup" hint."""
    require(conn, principal, "system.configure", INSTALLATION)
    return wizard.build_state(settings_of(request), conn, principal.source)


@router.post("/setup/check/{step}")
def setup_check(step: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Run one step's check now (the device steps probe the NVR / Home Assistant / go2rtc with read-only calls; the
    local steps re-read the database, install with SQLite's quick_check). One per user and step every
    `check_every_s` (429 `check_rate_limited` with `retry_after_s`); audited as `setup.check` with the outcome."""
    require(conn, principal, "system.configure", INSTALLATION)
    if step not in wizard.STEPS:
        raise not_found("שלב האשף לא נמצא.")
    wizard.rate_limit(principal.user_id, step)
    settings = settings_of(request)
    wizard.run_check(settings, conn, step)  # network calls on a read-mode connection: no write lock is held
    state = wizard.build_state(settings, conn, principal.source, deep_install=step == "install")
    result = next(s for s in state["steps"] if s["id"] == step)
    audit(conn, actor=principal, action="setup.check", decision="allowed", resource_type="installation", resource_id="*",
          request_id=getattr(request.state, "correlation_id", None),
          details={"step": step, "status": result["status"], "source": result["source"], "problem": (result["problem"] or {}).get("code")})
    return {**state, "checked": step}
