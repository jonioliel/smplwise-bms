"""CR-EMERG104 - the emergency readiness view's API (`/api/v1/emergency-readiness/...`, docs/changes/CR-EMERG104.md section 6).

Order of every route: signed-in principal -> the module switch (uniform 404 `feature_disabled` while `emergency_readiness.enabled` is off,
a router-level dependency) -> the permission (maintenance.view / emergency.view to read; maintenance.manage / emergency.manage to configure; an
audited 403) -> row redaction. The view is READ ONLY: no route here reaches a device, Home Assistant, WisKey or the network; the writes are the
configuration (slots, thresholds, emergency cameras, not-applicable marks) and the emergency contact list, all audited."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..rbac import Principal
from ..services.emergency import access, service
from ..services.emergency.access import Viewer

ID = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"


def module_gate(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> None:
    access.require_module(conn)


open_router = APIRouter()
router = APIRouter(dependencies=[Depends(module_gate)])


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


@open_router.get("/emergency-readiness/module")
def module_state(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`{enabled, can: {view, manage}}` for every signed-in user (the shell's tab switch)."""
    enabled = access.module_on(conn)
    v = Viewer(conn, principal)
    return {"enabled": enabled, "can": {"view": enabled and v.can_view(), "manage": enabled and v.can_manage()}}


@router.get("/emergency-readiness")
def get_page(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    v = Viewer(conn, principal)
    v.require_view()
    return service.page(conn, settings_of(request), v)


@router.get("/emergency-readiness/history")
def get_history(days: int = Query(90, ge=1, le=3650), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return service.history(conn, Viewer(conn, principal), days)


@router.get("/emergency-readiness/config")
def get_config(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    v = Viewer(conn, principal)
    v.require_manage()
    return service.get_config(conn, settings_of(request), v)


class ConfigBody(_Body):
    revision: int | None = None
    thresholds: dict[str, Any] | None = None
    cameras: list[Any] | None = None
    bindings: dict[str, Any] | None = None
    not_applicable: dict[str, Any] | None = None


@router.put("/emergency-readiness/config")
def put_config(body: ConfigBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return service.put_config(conn, settings_of(request), Viewer(conn, principal), body.model_dump(exclude_unset=True), _rid(request))


class ContactBody(_Body):
    display_name: str | None = None
    role_title: str | None = None
    phone: str | None = None
    email: str | None = None
    user_id: str | None = None
    priority: int | None = None
    active: bool | None = None
    revision: int | None = None


@router.get("/emergency-readiness/contacts")
def list_contacts(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return service.list_contacts(conn, Viewer(conn, principal))


@router.post("/emergency-readiness/contacts", status_code=201)
def create_contact(body: ContactBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    data = body.model_dump(exclude_unset=True)
    data.pop("revision", None)
    return service.create_contact(conn, Viewer(conn, principal), data, _rid(request))


@router.patch("/emergency-readiness/contacts/{contact_id}")
def update_contact(body: ContactBody, request: Request, contact_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return service.update_contact(conn, Viewer(conn, principal), contact_id, body.model_dump(exclude_unset=True), _rid(request))


@router.post("/emergency-readiness/contacts/{contact_id}/verify")
def verify_contact(request: Request, contact_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return service.verify_contact(conn, Viewer(conn, principal), contact_id, _rid(request))


@router.delete("/emergency-readiness/contacts/{contact_id}", status_code=204)
def delete_contact(request: Request, contact_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    service.delete_contact(conn, Viewer(conn, principal), contact_id, _rid(request))


@router.get("/emergency-readiness/items/{item_id}")
def get_item(request: Request, item_id: str = Path(..., pattern=r"^E[0-9]{2}b?$"), principal: Principal = Depends(current_principal_ro),
             conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    v = Viewer(conn, principal)
    v.require_view()
    return service.item(conn, settings_of(request), v, item_id)
