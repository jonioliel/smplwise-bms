"""CR-035: the WisKey importer's minimal administration API (no screen in stage 1).

  GET  /wiskey/import/status            switch, exchange packages, registered profiles, recent intakes, git availability
  PUT  /wiskey/import/switch            the kill switch `wiskey.import_enabled` (default off); `confirm: true` required
  POST /wiskey/import/intakes           run the offline verification of one package folder against one registered profile
  GET  /wiskey/import/intakes/{id}      one stored intake report (and the Arx import manifest when it passed)

Every route is for system administrators only (an active `system_admin` binding at the installation scope, rbac.is_system_admin;
never a delegable permission). A refusal is audited. No route installs anything: for a passing install candidate the intake answer
carries a dry-run plan (install.plan_install), and `apply_install` is not reachable over HTTP in stage 1.
"""
from __future__ import annotations

import sqlite3
import threading
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import now_iso, unlocked
from ..errors import ApiError
from ..rbac import Principal, is_system_admin
from ..services import bridge_install
from ..services.wiskey_import import install, intake, profile, store
from ..services.wiskey_import.common import PACKAGE_NAME
from ..services.wiskey_import.gitbox import git_binary

router = APIRouter()
_RUN = threading.Lock()  # one intake at a time per process


class SwitchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool
    confirm: bool


class IntakeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    package: str = Field(min_length=1, max_length=100)
    profile: str = Field(min_length=1, max_length=100)


def _admin(request: Request, conn: sqlite3.Connection, principal: Principal, action: str) -> None:
    row = conn.execute("SELECT active FROM users WHERE id = ?", (principal.user_id,)).fetchone()
    if (row is not None and not row["active"]) or not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action=action, decision="denied", resource_type="installation", resource_id="wiskey_import",
              reason="not_system_admin", request_id=getattr(request.state, "correlation_id", None))
        raise ApiError(403, "forbidden", "רק מנהל מערכת יכול לנהל את קליטת WisKey.")


@router.get("/wiskey/import/status")
def status(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _admin(request, conn, principal, "wiskey.import.status")
    settings = settings_of(request)
    exchange = store.exchange_root()
    return {
        "enabled": store.enabled(conn),
        "exchange": {"available": exchange is not None, "packages": store.list_packages(exchange)},
        "profiles": [{"id": p.id, "kind": p.kind, "sha256": p.sha256} for p in profile.registered_profiles().values()],
        "invalid_profiles": profile.invalid_profiles(),
        "intakes": store.list_intakes(settings),
        "git_available": git_binary() is not None,
        "install": {"apply_available": False, "reason": "stage1_not_wired", "unfinished_journals": len(install.unfinished(store.journal_dir(settings)))},
    }


@router.put("/wiskey/import/switch")
def switch(body: SwitchIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _admin(request, conn, principal, "wiskey.import.switch")
    if body.confirm is not True:
        raise ApiError(422, "confirm_required", "יש לאשר את השינוי.", details={"field": "confirm"})
    before = store.enabled(conn)
    store.set_enabled(conn, body.enabled)
    audit(conn, actor=principal, action="wiskey.import.switch", decision="allowed", resource_type="installation", resource_id="wiskey_import",
          request_id=getattr(request.state, "correlation_id", None), details={"from": before, "to": body.enabled})
    return {"enabled": body.enabled}


@router.post("/wiskey/import/intakes")
def run_intake(body: IntakeIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _admin(request, conn, principal, "wiskey.import.intake")
    rid = getattr(request.state, "correlation_id", None)
    settings = settings_of(request)
    if not store.enabled(conn):
        audit(conn, actor=principal, action="wiskey.import.intake", decision="denied", resource_type="installation", resource_id="wiskey_import",
              reason="import_disabled", request_id=rid)
        raise ApiError(409, "wiskey_import_disabled", "קליטת WisKey כבויה. מנהל מערכת יכול להפעיל אותה.")
    if not PACKAGE_NAME.match(body.package):
        raise ApiError(422, "validation", "שם החבילה אינו תקין.", details={"field": "package"})
    prof = profile.registered_profiles().get(body.profile)
    if prof is None:
        raise ApiError(409, "profile_not_registered", "אין פרופיל קליטה רשום בשם הזה.", details={"field": "profile"})
    exchange = store.exchange_root()
    if exchange is None or body.package not in store.list_packages(exchange):
        raise ApiError(404, "package_not_found", "החבילה לא נמצאה בתיקיית ההחלפה.", details={"field": "package"})
    if not _RUN.acquire(blocking=False):
        raise ApiError(409, "intake_running", "קליטה אחרת רצה כעת.")
    try:
        audit(conn, actor=principal, action="wiskey.import.intake", decision="allowed", resource_type="wiskey_package", resource_id=body.package,
              request_id=rid, details={"phase": "attempt", "profile_id": prof.id, "profile_sha256": prof.sha256})
        with unlocked(conn):  # the attempt row is committed; the long offline run holds no database lock
            result = intake.run_intake(exchange / body.package, body.package, prof, store.work_root(settings), now=now_iso)
            store.save_intake(settings, result.report, result.manifest)
            plan = None
            if result.passed and prof.installable and result.manifest is not None:
                try:
                    install.stage(result.manifest, result.installable, store.staging_root(settings) / result.report["intake_id"])
                    plan = install.plan_install(result.manifest, bridge_install.ha_config_dir(), switch_on=True)
                except install.InstallRefused as exc:
                    plan = {"refused": {"code": exc.code, "domain": exc.domain}, "domains": [], "steps": []}
    finally:
        _RUN.release()
    audit(conn, actor=principal, action="wiskey.import.intake.result", decision="allowed", resource_type="wiskey_package", resource_id=body.package,
          request_id=rid, details={"phase": "outcome", "intake_id": result.report["intake_id"], "result": result.report["result"],
                                   "first_failure": result.report["first_failure"], "manifest_sha256": result.report["manifest_sha256"]})
    return {"intake": store.summary(result.report), "checks": [{"id": c["id"], "name": c["name"], "status": c["status"]} for c in result.report["checks"]],
            "plan": plan}


@router.get("/wiskey/import/intakes/{intake_id}")
def get_intake(intake_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _admin(request, conn, principal, "wiskey.import.read")
    got = store.load_intake(settings_of(request), intake_id)
    if got is None:
        raise ApiError(404, "not_found", "הקליטה לא נמצאה.")
    return got
