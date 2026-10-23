"""XSCENARIO109-295 (docs/changes/CR-SCENARIO109.md, section 17 binds): the HTTP surface of cross-module scenarios.

    GET    /scenarios/status              never 403: module switch, kill switch, what the caller may do
    GET    /scenarios/signals             the catalogue filtered by the caller's reach (read-only mirror of Arx data, 17.1)  scenario.view
    GET    /scenarios                     the list (leaves the caller cannot see are redacted)                              scenario.view
    POST   /scenarios                     create (always disabled)                                                          scenario.manage
    GET    /scenarios/{id}                one, with its definition                                                          scenario.view
    PUT    /scenarios/{id}                edit (optimistic `version`)                                                       scenario.manage
    DELETE /scenarios/{id}                                                                                                  scenario.manage
    POST   /scenarios/{id}/enable|disable {version, confirm?}: enabling needs a dry run of this version first               scenario.manage
    POST   /scenarios/{id}/test           the dry run of the saved rule (optional simulated values); no action runs         scenario.manage
    POST   /scenarios/simulate            the dry run of an unsaved definition; nothing is written                           scenario.manage
    GET    /scenarios/{id}/runs           the run history with snapshots                                                    scenario.view
    POST   /scenarios/{id}/reassign       {owner_user_id}: a defective rule gets a new author                               scenario.admin
    GET    /scenarios/flags                                                                                                 scenario.view
    GET    /scenarios/settings            every threshold, window, cap and recipient                                        scenario.admin
    PUT    /scenarios/settings            {changes, confirmed: true}                                                        scenario.admin

While `scenarios.enabled` is false every route but status and settings answers 409 scenarios_disabled. No route here calls the HA bridge,
a recorder, go2rtc or a door: a scenario never operates a device (section 6.1)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, ConfigDict, Field

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import scenario_settings as cfg
from ..services import scenario_signals as sig
from ..services import scenarios as svc

router = APIRouter()
_ID_PATTERN = r"^[A-Za-z0-9_\-]+$"


def RID_():
    return Path(min_length=1, max_length=64, pattern=_ID_PATTERN)


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RuleBody(_Body):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=1000)
    definition: dict[str, Any]


class UpdateBody(RuleBody):
    version: int = Field(ge=1)


class EnableBody(_Body):
    version: int = Field(ge=1)
    confirm: bool = False


class TestBody(_Body):
    overrides: dict[str, Any] | None = None


class SimulateBody(_Body):
    definition: dict[str, Any]
    overrides: dict[str, Any] | None = None


class ReassignBody(_Body):
    owner_user_id: str = Field(min_length=1, max_length=120)


class SettingsBody(_Body):
    changes: dict[str, Any]
    confirmed: Any = None


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _gate(conn: sqlite3.Connection, principal: Principal, permission: str) -> None:
    require(conn, principal, permission, INSTALLATION)
    svc.require_on(conn)


def _overrides(v: dict[str, Any] | None) -> dict[str, Any] | None:
    if v is None:
        return None
    if len(v) > 12 or not all(isinstance(k, str) and len(k) <= 80 for k in v):
        raise ApiError(422, "validation", "ערכי הדמיה לא תקינים.", details={"errors": [{"path": "overrides", "code": "bad_value", "message": "ערכי הדמיה לא תקינים."}]})
    for val in v.values():
        if not (val is None or isinstance(val, (bool, int, float))):
            raise ApiError(422, "validation", "ערכי הדמיה לא תקינים.", details={"errors": [{"path": "overrides", "code": "bad_value", "message": "ערכי הדמיה לא תקינים."}]})
    return v


@router.get("/scenarios/status")
def status(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Never 403."""
    can = {k: svc.allowed(conn, principal, p) for k, p in (("view", svc.VIEW), ("manage", svc.MANAGE), ("admin", svc.ADMIN))}
    return {"enabled": svc.module_on(conn), "kill_switch": cfg.on(conn, "scenarios.kill_switch"), "can": can, "can_use": can["view"],
            "actions": {k: cfg.on(conn, v) for k, v in (("notify", "scenarios.actions.notify"), ("create_service_request", "scenarios.actions.create_ticket"),
                                                         ("set_flag", "scenarios.actions.set_flag"))},
            "tickets_on": svc._tickets_on(conn), "schema": svc.m.SCHEMA_VERSION}


@router.get("/scenarios/signals")
def signals(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, principal, svc.VIEW)
    return {"signals": sig.catalogue_view(sig.Reach(conn, principal)), "limits": {"depth": svc.m.MAX_DEPTH, "leaves": svc.m.MAX_LEAVES, "actions": svc.m.MAX_ACTIONS},
            "actions": list(svc.m.ACTIONS), "tickets_on": svc._tickets_on(conn), "option_defaults": svc.m.OPTION_DEFAULTS,
            "option_ranges": {k: list(v) for k, v in svc.m.OPTION_RANGES.items()}}


@router.get("/scenarios/flags")
def list_flags(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, principal, svc.VIEW)
    return {"flags": svc.flags(conn)}


@router.get("/scenarios/settings")
def get_settings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, svc.ADMIN, INSTALLATION)
    return {"settings": cfg.view(conn)}


@router.put("/scenarios/settings")
def put_settings(body: SettingsBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.ADMIN, INSTALLATION)
    if body.confirmed is not True:
        raise ApiError(409, "confirmation_required", "הפעולה דורשת אישור מפורש.")
    changed = cfg.update(conn, principal, body.changes, _rid(request))
    return {"settings": cfg.view(conn), "changed": changed}


@router.post("/scenarios/simulate")
def simulate(body: SimulateBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, principal, svc.MANAGE)
    svc.rate_test(conn, principal.user_id)
    return svc.dry_run(conn, principal, body.definition, overrides=_overrides(body.overrides))


@router.get("/scenarios")
def list_rules(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, principal, svc.VIEW)
    return {"scenarios": svc.list_view(conn, principal), "can_manage": svc.allowed(conn, principal, svc.MANAGE)}


@router.post("/scenarios", status_code=201)
def create_rule(body: RuleBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, principal, svc.MANAGE)
    return svc.create(conn, principal, body.name.strip(), body.description.strip(), body.definition, _rid(request))


@router.get("/scenarios/{rule_id}")
def one(rule_id: str = RID_(), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, principal, svc.VIEW)
    return svc.view(conn, principal, svc.get_row(conn, rule_id))


@router.put("/scenarios/{rule_id}")
def update_rule(body: UpdateBody, request: Request, rule_id: str = RID_(), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, principal, svc.MANAGE)
    return svc.update(conn, principal, rule_id, body.version, body.name.strip(), body.description.strip(), body.definition, _rid(request))


@router.delete("/scenarios/{rule_id}")
def delete_rule(request: Request, rule_id: str = RID_(), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, principal, svc.MANAGE)
    svc.delete(conn, principal, rule_id, _rid(request))
    return {"deleted": rule_id}


@router.post("/scenarios/{rule_id}/enable")
def enable(body: EnableBody, request: Request, rule_id: str = RID_(), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, principal, svc.MANAGE)
    return svc.set_enabled(conn, principal, rule_id, True, body.version, body.confirm, _rid(request))


@router.post("/scenarios/{rule_id}/disable")
def disable(body: EnableBody, request: Request, rule_id: str = RID_(), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, principal, svc.MANAGE)
    return svc.set_enabled(conn, principal, rule_id, False, body.version, False, _rid(request))


@router.post("/scenarios/{rule_id}/test")
def test(body: TestBody, request: Request, rule_id: str = RID_(), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, principal, svc.MANAGE)
    svc.rate_test(conn, principal.user_id)
    return svc.test_rule(conn, principal, rule_id, _overrides(body.overrides), _rid(request))


@router.get("/scenarios/{rule_id}/runs")
def rule_runs(rule_id: str = RID_(), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, principal, svc.VIEW)
    return {"runs": svc.runs(conn, principal, rule_id)}


@router.post("/scenarios/{rule_id}/reassign")
def reassign(body: ReassignBody, request: Request, rule_id: str = RID_(), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, principal, svc.ADMIN)
    return svc.reassign(conn, principal, rule_id, body.owner_user_id, _rid(request))
