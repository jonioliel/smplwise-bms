"""Plan Studio 6 look settings of a person (CR-029 S0; services/plan_view.py): GET returns the installation's dials, the
caller's own override and the effective values the 3D view applies; PUT sets or resets (null) the caller's own dials.
Anyone who may read a map (map.read at some scope) may keep their own look; nobody reads or writes another person's.
Every write is audited (plan.view_prefs). The installation's dials are the `plan.view` setting (PATCH /settings,
system.configure)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import get_setting
from ..errors import forbidden, validation
from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere
from ..services import plan_view

router = APIRouter()
ACTION = "plan.view_prefs"


class OwnPatch(BaseModel):
    """A partial update of the caller's own dials (unknown dials are a 422 from the service, never stored)."""

    model_config = ConfigDict(extra="forbid")
    prefs: dict[str, Any] = Field(max_length=len(plan_view.USER_DIALS))


def _may_view(conn: sqlite3.Connection, principal: Principal) -> bool:
    return "map.read" in permissions_anywhere(conn, principal)


def _site(conn: sqlite3.Connection) -> dict[str, Any]:
    from .settings import DEFAULTS  # local: the settings router imports services only

    return plan_view.stored_site(get_setting(conn, plan_view.KEY, DEFAULTS[plan_view.KEY]))


def _payload(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    site = _site(conn)
    mine = plan_view.own(conn, principal.user_id)
    return {"site": site, "own": mine, "effective": plan_view.effective(site, mine), "personal_dials": list(plan_view.USER_DIALS),
            "choices": {k: list(v) for k, v in plan_view.CHOICES.items()}, "ranges": {k: list(v) for k, v in plan_view.RANGES.items()},
            "can_edit_site": authorize(conn, principal, "system.configure", INSTALLATION).allowed}


@router.get("/plan-view/prefs")
def get_prefs(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    if not _may_view(conn, principal):
        raise forbidden(permission="map.read")
    return _payload(conn, principal)


@router.put("/plan-view/prefs")
def put_prefs(body: OwnPatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    rid = getattr(request.state, "correlation_id", None)
    if not _may_view(conn, principal):
        audit(conn, actor=principal, action=ACTION, decision="denied", resource_type="user", resource_id=principal.user_id, reason="permission_missing", request_id=rid)
        raise forbidden(permission="map.read")
    try:
        stored = plan_view.set_own(conn, principal.user_id, body.prefs)
    except ValueError as exc:
        raise validation("העדפת התלת־ממד שנשלחה אינה תקינה.", reason=str(exc)) from exc
    audit(conn, actor=principal, action=ACTION, decision="allowed", resource_type="user", resource_id=principal.user_id, request_id=rid,
          details={"changes": body.prefs, "own": stored})
    return _payload(conn, principal)
