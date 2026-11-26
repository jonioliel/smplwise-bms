"""WISKEY-A2-EXEC-2530 (owner 25.11, A2 option b: "the owner approves in WisKey's screen, Arx shows status only"): the READ-ONLY status
of WisKey's reviewed schedule execution (`wiskey-schedule-execution.v1`). What the contract lets the add-on identity do, and why Arx
sends only three reads: services/wiskey_schedule_execution.py and docs/changes/WISKEY-A2-EXEC-2530.md.

    GET  /access-control/schedules/execution                     the switch, the support state and the jobs read so far (no WisKey
                                                                 call when the switch is off)
    POST /access-control/schedules/execution/{job_id}/status     one signed status read of one WisKey job (+ its pending reviews when
                                                                 WisKey lists them) - never an approval, an execution or a cancel
    PUT  /access-control/schedules/execution/settings            {enabled}: the installation switch `wiskey.schedule_execution_status`
                                                                 (default off); system administrators only, audited

Permission: GET / POST - the schedules administrator (the gate of routers/access_control_schedule_writes.py, an audited 403); PUT -
a system administrator (require_system_admin, audited). With the switch off the POST answers 409 `feature_disabled` (nothing sent)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, ConfigDict, StrictBool

from ..audit import audit
from ..auth import current_principal_ro
from ..db import Database
from ..errors import ApiError
from ..rbac import Principal, is_system_admin, require_system_admin
from ..services import wiskey_schedule_execution as sx
from ..wire import access_control_schedule_execution as W
from ..wire import wire
from ._common import rid as _rid
from .access_control_schedule_writes import _admin_get, _admin_ro

router = APIRouter()

API = "/access-control/schedules/execution"
JOB_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
OFF = {"state": "off", "reason": None, "contract": sx.CONTRACT}


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: StrictBool


def _view(request: Request, principal: Principal) -> dict[str, Any]:
    db: Database = request.app.state.db
    with db.connection(mode="read", label="wiskey_schedule_execution.view") as conn:
        on = sx.switch_on(conn)
        try:
            can = is_system_admin(conn, principal.user_id)
        except Exception:  # noqa: BLE001 - fail closed
            can = False
    # the support state may open the signed connection and read discovery: never inside a database connection, never when off
    return {"enabled": on, "can_configure": can, "support": sx.support() if on else dict(OFF), "jobs": sx.known_all() if on else []}


@router.get(API, **wire(W.ScheduleExecutionView))
def execution_view(request: Request, principal: Principal = Depends(_admin_get)) -> dict[str, Any]:
    return _view(request, principal)


@router.post(f"{API}/{{job_id}}/status", **wire(W.ScheduleExecutionCheck))
def execution_status(request: Request, principal: Principal = Depends(_admin_ro),  # noqa: ARG001 - the gate
                     job_id: str = Path(min_length=1, max_length=128, pattern=JOB_PATTERN)) -> dict[str, Any]:
    """One signed status read of one WisKey job. Never sends start, approve, execute or cancel - there is nothing to replay."""
    db: Database = request.app.state.db
    with db.connection(mode="read", label="wiskey_schedule_execution.switch") as conn:
        on = sx.switch_on(conn)
    if not on:
        raise ApiError(409, "feature_disabled", "הצגת מצב הביצוע כבויה בהגדרות. לא נשלח דבר.",
                       details={"setting": sx.SWITCH_KEY, "outcome": "not_sent"})
    try:
        return sx.check(job_id)
    except ValueError:
        raise ApiError(422, "validation", "מזהה העבודה אינו תקין", details={"fields": ["job_id"], "outcome": "not_sent"}) from None
    except sx.ReadError as exc:
        if exc.code == "schedule_status_busy":
            raise ApiError(429, exc.code, "בדיקת מצב של העבודה הזו כבר רצה. נסו שוב בעוד רגע.", retryable=True,
                           details={"outcome": "not_sent", "retry_after_s": 2}) from None
        raise ApiError(422, exc.code, "הבקשה אינה תקינה", details={"outcome": "not_sent"}) from None


@router.put(f"{API}/settings", **wire(W.ScheduleExecutionView))
def execution_settings(body: SettingsIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    db: Database = request.app.state.db
    with db.connection(label="wiskey_schedule_execution.settings") as conn:
        require_system_admin(conn, principal, action=sx.AUDIT_SETTINGS, request_id=_rid(request), text="רק מנהל מערכת יכול לשנות הגדרה זו.")
        before, after = sx.set_switch(conn, body.enabled)
        audit(conn, actor=principal, action=sx.AUDIT_SETTINGS, decision="allowed", resource_type="installation", resource_id="*",
              request_id=_rid(request), details={"key": sx.SWITCH_KEY, "before": before, "after": after})
    if after == "off":
        sx.reset()  # nothing read before stays on any screen
    return _view(request, principal)
