"""CR-AUTODOORS-295: the API of the "open a door" blocks of automations (services/door_automation.py decides everything).

- GET    /door-automations/status            visibility, the feature and kill switches, the caller's rights
- GET    /door-automations?automation_id=     the blocks (holders of access.doors.automate anywhere)
- GET    /door-automations/doors              the editor's door picker (names only, `can_arm` per door)
- POST   /door-automations                    create a draft {automation_id, name, policy}
- GET    /door-automations/{id}
- PUT    /door-automations/{id}               edit {name, policy, policy_revision} - an armed block is disarmed
- POST   /door-automations/{id}/arm           the human arm step {confirmed: true, policy_revision}
- POST   /door-automations/{id}/disarm        always allowed to a holder
- POST   /door-automations/{id}/simulate      every gate, read only, nothing sent {at?, source?}
- DELETE /door-automations/{id}
- GET    /door-automations/{id}/fires         the block's recent decisions
- PUT    /door-automations/kill               {on, confirmed}: ON for any holder, OFF for a system administrator
- PUT    /door-automations/settings           {feature?, limits?, excluded_roles?, confirmed}: system administrator; feature `on`
                                              refused while GO_LIVE_PERMITTED is False; every limit is an administrator setting
- PUT    /door-automations/users/{user_id}    {removed, confirmed}: take the right to arm away from one person (or give it back)

Nothing here sends anything to a door: the fire path runs from the automations mirror's `automation_triggered` hook."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..auth import current_principal, get_conn, settings_of
from ..errors import ApiError, forbidden
from ..rbac import Principal
from ..services import door_automation as da

router = APIRouter()
_ID = r"^da_[0-9a-f]{32}$"
_ITEM = r"^[A-Za-z0-9_.:-]{1,128}$"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _dev(request: Request) -> bool:
    return bool(settings_of(request).dev_user)


def _row(conn: sqlite3.Connection, principal: Principal, block_id: str) -> sqlite3.Row:
    if not da.holds_anywhere(conn, principal):
        raise forbidden(permission=da.AUTOMATE)
    row = da.get(conn, block_id)
    if row is None:
        raise ApiError(404, "not_found", "ההגדרה לא נמצאה.")
    return row


class CreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    automation_id: str = Field(pattern=_ITEM)
    name: Any = None
    policy: Any = None


class UpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Any = None
    policy: Any = None
    policy_revision: Any = None


class ArmBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirmed: Any = None
    policy_revision: Any = None


class SimulateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    at: Any = None
    source: Any = Field(None)


class KillBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    on: Any = None
    confirmed: Any = None


class SettingsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    feature: Any = None
    limits: Any = None
    excluded_roles: Any = None
    confirmed: Any = None


class UserBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    removed: Any = None
    confirmed: Any = None


@router.get("/door-automations/status")
def status(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return da.status(conn, principal)


@router.get("/door-automations")
def list_blocks(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn),
                automation_id: str | None = Query(None, pattern=_ITEM)) -> dict[str, Any]:
    if not da.holds_anywhere(conn, principal):
        raise forbidden(permission=da.AUTOMATE)
    if automation_id:
        rows = conn.execute("SELECT * FROM door_automations WHERE deleted_at IS NULL AND automation_item_id = ?", (automation_id,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM door_automations WHERE deleted_at IS NULL ORDER BY created_at").fetchall()
    return {"items": [da.view(conn, r) for r in rows], "status": da.status(conn, principal)}


@router.post("/door-automations", status_code=201)
def create(body: CreateBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return da.create(conn, principal, body.automation_id, body.name, body.policy, _rid(request))


# the fixed paths are declared before /{block_id}
@router.get("/door-automations/doors")
def doors(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return {"doors": da.doors_for(conn, principal, dev_mode=_dev(request))}


@router.put("/door-automations/kill")
def kill(body: KillBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return da.set_kill(conn, principal, body.on, body.confirmed, _rid(request))


@router.put("/door-automations/settings")
def settings(body: SettingsBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return da.set_settings(conn, principal, body.model_dump(), _rid(request))


@router.put("/door-automations/users/{user_id}")
def user_removed(body: UserBody, request: Request, user_id: str = Path(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_.@-]+$"),
                 principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return da.set_user_removed(conn, principal, user_id, body.removed, body.confirmed, _rid(request))


@router.get("/door-automations/{block_id}")
def get_block(block_id: str = Path(pattern=_ID), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return da.view(conn, _row(conn, principal, block_id))


@router.put("/door-automations/{block_id}")
def update(body: UpdateBody, request: Request, block_id: str = Path(pattern=_ID), principal: Principal = Depends(current_principal),
           conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return da.update(conn, principal, _row(conn, principal, block_id), body.name, body.policy, body.policy_revision, _rid(request))


@router.post("/door-automations/{block_id}/arm")
def arm(body: ArmBody, request: Request, block_id: str = Path(pattern=_ID), principal: Principal = Depends(current_principal),
        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return da.arm(conn, principal, _row(conn, principal, block_id), body.confirmed, body.policy_revision, dev_mode=_dev(request), rid=_rid(request))


@router.post("/door-automations/{block_id}/disarm")
def disarm(request: Request, block_id: str = Path(pattern=_ID), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return da.disarm(conn, principal, _row(conn, principal, block_id), _rid(request))


@router.post("/door-automations/{block_id}/simulate")
def simulate(body: SimulateBody, request: Request, block_id: str = Path(pattern=_ID), principal: Principal = Depends(current_principal),
             conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return da.simulate(conn, principal, _row(conn, principal, block_id), body.at, body.source, dev_mode=_dev(request), rid=_rid(request))


@router.delete("/door-automations/{block_id}")
def delete(request: Request, block_id: str = Path(pattern=_ID), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    da.delete(conn, principal, _row(conn, principal, block_id), _rid(request))
    return {"deleted": True}


@router.get("/door-automations/{block_id}/fires")
def fires(block_id: str = Path(pattern=_ID), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn),
          limit: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    return {"fires": da.fires(conn, _row(conn, principal, block_id), limit)}
