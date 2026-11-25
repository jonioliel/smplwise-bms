"""The tickets settings API: the organisation's locations (CR-ORG-LOCATIONS, migration 0101).

CR-SPLIT-TICKETS-ADMIN-2440 (review 05:P2-08): moved unchanged out of routers/tickets_admin.py, which still exports every name."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError, field_error
from ..rbac import Principal
from ..services.tickets import access, org_locations, store_locations
from ..services.tickets.access import Viewer, text
from ._common import rid as _rid
from ._tickets_common import invalid
from .tickets import ID, module_gate
from .tickets_admin_base import _configurer
from .tickets_admin_departments import _dept_or_404

router = APIRouter(dependencies=[Depends(module_gate)])


# ---------------------------------------------------------------- CR-ORG-LOCATIONS: the organisation's locations (migration 0101, provisional)

class LocationBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, max_length=400)  # the real limits (40 / 60 / 30 / 200) are the service's: a 422 names the field
    street: str | None = Field(default=None, max_length=400)
    city: str | None = Field(default=None, max_length=400)
    details: str | None = Field(default=None, max_length=1000)
    lat: float | None = None
    lng: float | None = None
    active: StrictBool | None = None
    is_default: StrictBool | None = None
    sort_order: StrictInt | None = None
    plan_zone_id: str | None = Field(default=None, max_length=64)  # ORGPLAN-291: the optional plan room; null clears
    revision: StrictInt | None = Field(default=None, ge=1)  # optional optimistic check on a patch


class DepartmentLocationBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    location_id: str | None = Field(default=None, max_length=64, pattern=ID)


def _loc_invalid(conn: sqlite3.Connection, exc: Any) -> ApiError:
    if exc.code == "duplicate":
        return field_error(text(conn, "כבר קיים מיקום בשם הזה."), problems=[{"field": "name", "code": "duplicate"}], code="location_name_taken",
                           status=409)
    return invalid(conn, exc.field, exc.code)


def _location_or_404(conn: sqlite3.Connection, location_id: str) -> dict[str, Any]:
    loc = store_locations.location(conn, location_id)
    if loc is None:
        raise ApiError(404, "location_not_found", text(conn, "המיקום לא נמצא."))
    return loc


@router.get("/tickets/locations")
def list_locations(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The ACTIVE locations (name + address, no coordinates) for the creation forms' picker, with the organisation and department
    defaults: whoever may see or create requests (tickets.view / create / external anywhere) or configure the module."""
    viewer = Viewer(conn, principal)
    if not org_locations.may_read(viewer):
        audit(conn, actor=principal, action="ticket.location.list", decision="denied", resource_type="installation", resource_id="*", reason="no_binding")
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה ל{tickets}."), details={"permission": access.VIEW})
    return org_locations.reader_list(conn)


@router.get("/tickets/admin/locations")
def admin_locations(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _configurer(conn, principal)
    return org_locations.admin_list(conn)


@router.get("/tickets/admin/locations/plan-areas")
def location_plan_areas(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """ORGPLAN-291: the rooms the location editor's picker offers (only floors the editor may read on the map)."""
    _configurer(conn, principal)
    return {"areas": org_locations.selectable_areas(conn, principal)}


@router.post("/tickets/admin/locations", status_code=201)
def create_location(body: LocationBody, request: Request, principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _configurer(conn, principal)
    if len(store_locations.locations(conn, active_only=False)) >= org_locations.LOCATIONS_MAX:
        raise ApiError(409, "locations_limit", text(conn, "הגעתם למספר המיקומים המרבי."))
    try:
        data = body.model_dump(exclude={"revision"}, exclude_unset=True)
        fields = org_locations.clean_fields(conn, data, current=None)
        if "plan_zone_id" in data:
            fields["plan_zone_id"] = org_locations.check_plan_zone(conn, principal, data)
    except org_locations.Invalid as exc:
        raise _loc_invalid(conn, exc) from None
    if fields.get("is_default"):
        store_locations.clear_default(conn)
    lid = store_locations.insert(conn, fields, principal.user_id)
    audit(conn, actor=principal, action="ticket.location.create", decision="allowed", resource_type="ticket_org_location", resource_id=lid,
          request_id=_rid(request), details={"fields": sorted(fields)})
    out = org_locations.admin_list(conn)
    out["id"] = lid
    return out


@router.patch("/tickets/admin/locations/{location_id}")
def patch_location(body: LocationBody, request: Request, location_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _configurer(conn, principal)
    loc = _location_or_404(conn, location_id)
    if body.revision is not None and body.revision != loc["revision"]:
        raise ApiError(409, "stale", text(conn, "המיקום עודכן בינתיים. רעננו ונסו שוב."), details={"revision": loc["revision"]})
    try:
        data = body.model_dump(exclude={"revision"}, exclude_unset=True)
        fields = org_locations.clean_fields(conn, data, current=loc)
        if "plan_zone_id" in data:
            fields["plan_zone_id"] = org_locations.check_plan_zone(conn, principal, data)
    except org_locations.Invalid as exc:
        raise _loc_invalid(conn, exc) from None
    if fields.get("is_default"):
        store_locations.clear_default(conn, except_id=location_id)
    store_locations.update(conn, location_id, fields, principal.user_id)
    cleared = store_locations.clear_department_defaults_of(conn, location_id) if fields.get("active") == 0 else 0
    audit(conn, actor=principal, action="ticket.location.update", decision="allowed", resource_type="ticket_org_location", resource_id=location_id,
          request_id=_rid(request), details={"fields": sorted(fields), "department_defaults_cleared": cleared})
    return org_locations.admin_list(conn)


@router.delete("/tickets/admin/locations/{location_id}")
def delete_location(request: Request, location_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A hard delete of a location NO request or RFQ names (a department default pointing at it is cleared); a referenced one answers
    409 `location_in_use` - deactivate it instead (history keeps its snapshot either way)."""
    _configurer(conn, principal)
    _location_or_404(conn, location_id)
    refs = store_locations.references(conn, location_id)
    if refs["tickets"] or refs["rfqs"]:
        audit(conn, actor=principal, action="ticket.location.delete", decision="denied", resource_type="ticket_org_location", resource_id=location_id,
              request_id=_rid(request), reason="location_in_use", details={"tickets": refs["tickets"], "rfqs": refs["rfqs"]})
        raise ApiError(409, "location_in_use", text(conn, "המיקום כבר משמש בקשות קיימות. אפשר להשבית אותו במקום למחוק."),
                       details={"tickets": refs["tickets"], "rfqs": refs["rfqs"]})
    store_locations.clear_department_defaults_of(conn, location_id)
    store_locations.delete(conn, location_id)
    audit(conn, actor=principal, action="ticket.location.delete", decision="allowed", resource_type="ticket_org_location", resource_id=location_id,
          request_id=_rid(request))
    return org_locations.admin_list(conn)


@router.put("/tickets/admin/departments/{dept_id}/location")
def put_department_location(body: DepartmentLocationBody, request: Request, dept_id: str = Path(..., pattern=ID),
                            principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Owner answer 17.10 (b): the department's OPTIONAL default location (null = none; it then follows the organisation's default)."""
    _configurer(conn, principal)
    d = _dept_or_404(conn, dept_id)
    if body.location_id:
        loc = store_locations.location(conn, body.location_id)
        if loc is None or not loc["active"]:
            raise invalid(conn, "location_id", "unknown")
    store_locations.set_department_default(conn, d["id"], body.location_id or None)
    audit(conn, actor=principal, action="ticket.location.department_default", decision="allowed", resource_type="ticket_department",
          resource_id=d["id"], request_id=_rid(request), details={"location_id": body.location_id or None})
    return org_locations.admin_list(conn)
