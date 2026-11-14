"""TKMAP1 (owner 16.10) - the map element of a service request (services/tickets/map_element.py).

    GET    /tickets/{id}/map-element                 visible: the snapshot, whether it is still on the map, where to show it (map readers)
    PUT    /tickets/{id}/map-element                 a manager of the ticket or its creator, open ticket, map.read on the element's floor:
                                                     {element: {floor_id, kind: anchor|object, id}} or {resource: {type: camera|ha_entity, id}}
    DELETE /tickets/{id}/map-element                 the same people
    GET    /tickets/{id}/map-element/vendor.svg      visible + map.read on the floor: exactly the picture the vendor page shows

Order of every route: signed in -> the module switch (router dependency) -> the ticket's visibility (the uniform 404) -> the role on the
ticket (an audited 403) -> the map permission on the element's floor. A camera is attachable by a reader whose map reach
of the floor is only camera-scoped when that camera is in their camera scope. An element the caller cannot see is the same 422
`element_not_found` as an unknown one. Audit rows carry ids only (ticket, floor, element kind / id) - never names."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import Principal
from ..services.access import camera_scope, floor_reach
from ..services.tickets import access, map_element, model
from ..services.tickets.access import Seen, Viewer, text
from .tickets import ID, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])
NO_STORE = {"Cache-Control": "private, no-store"}


class ElementRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    floor_id: str = Field(pattern=ID)
    kind: Literal["anchor", "object"]
    id: str = Field(min_length=1, max_length=64, pattern=ID)


class ResourceRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["camera", "ha_entity"]
    id: str = Field(min_length=1, max_length=255, pattern=r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,254}$")


class AttachBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    element: ElementRef | None = None
    resource: ResourceRef | None = None


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _can_edit(seen: Seen) -> bool:
    return (seen.manager or "creator" in seen.reasons) and seen.row["status"] not in model.FINAL


def _sees_element(conn: sqlite3.Connection, principal: Principal, floor_id: str, etype: str, resource_id: str | None) -> bool:
    """map.read reach of the floor: the whole floor, or (camera-scoped reach) this very camera."""
    reach = floor_reach(conn, principal, floor_id)
    if reach == "floor":
        return True
    return reach == "cameras" and etype == "camera" and bool(resource_id) and camera_scope(conn, principal, "map.read").allows(resource_id)


def _answer(conn: sqlite3.Connection, viewer: Viewer, seen: Seen) -> dict[str, Any]:
    row = map_element.stored(conn, seen.row["id"])
    can = {"attach": _can_edit(seen), "detach": _can_edit(seen) and row is not None}
    if row is None:
        return {"ticket_id": seen.row["id"], "element": None, "can": can}
    el = map_element.live(conn, row)
    sees = _sees_element(conn, viewer.principal, row["floor_id"], row["element_type"], row["resource_id"])
    out: dict[str, Any] = {
        "kind": row["element_kind"], "type": row["element_type"], "name": row["name_snapshot"], "floor_name": row["floor_snapshot"],
        "room_name": row["room_snapshot"], "attached_at": row["attached_at"], "present": el is not None,
        "vendor_image": el is not None and el.plan_version_id is not None,
    }
    if sees:  # where to show it - only for a reader of that map (the ids of another floor are not everybody's business)
        out.update({"floor_id": row["floor_id"], "element_id": row["element_id"], "resource_id": row["resource_id"], "level_id": row["level_id"],
                    "plan_version_id": row["plan_version_id"], "x_px": row["x_px"], "y_px": row["y_px"]})
    return {"ticket_id": seen.row["id"], "element": out, "can": can}


def _need_editor(conn: sqlite3.Connection, viewer: Viewer, seen: Seen, rid: str | None) -> None:
    if seen.row["status"] in model.FINAL:
        raise ApiError(409, "ticket_closed", text(conn, "{the_ticket} {f:סגורה|m:סגור}."))
    if not (seen.manager or "creator" in seen.reasons):
        audit(conn, actor=viewer.principal, action="ticket.map_element", decision="denied", resource_type="ticket", resource_id=seen.row["id"],
              reason="not_manager_or_creator", request_id=rid)
        raise ApiError(403, "forbidden", "אין הרשאה לשנות את רכיב המפה של הבקשה.")


@router.get("/tickets/{ticket_id}/map-element")
def get_element(ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro),
                conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    return _answer(conn, viewer, access.require_visible(viewer, ticket_id))


@router.put("/tickets/{ticket_id}/map-element")
def put_element(body: AttachBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    rid = _rid(request)
    if (body.element is None) == (body.resource is None):
        raise ApiError(422, "validation", "ערך לא תקין.", details={"fields": [{"field": "element", "code": "one_of_element_or_resource"}]})
    _need_editor(conn, viewer, seen, rid)
    if body.element is not None:
        el = map_element.find(conn, body.element.floor_id, body.element.kind, body.element.id)
    else:
        assert body.resource is not None
        el = map_element.find_resource(conn, body.resource.type, body.resource.id)
    if el is None or not _sees_element(conn, principal, el.floor_id, el.type, el.resource_id):
        raise ApiError(422, "element_not_found", "הרכיב לא נמצא במפה הנוכחית.")
    row = map_element.attach(conn, ticket_id, el, principal.user_id)
    audit(conn, actor=principal, action="ticket.map_element.attach", decision="allowed", resource_type="ticket", resource_id=ticket_id, request_id=rid,
          details={"number": seen.row["number"], "floor_id": el.floor_id, "kind": el.kind, "element_id": el.element_id, "revision": row.get("revision")})
    return _answer(conn, viewer, access.require_visible(viewer, ticket_id))


@router.delete("/tickets/{ticket_id}/map-element")
def delete_element(request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    rid = _rid(request)
    _need_editor(conn, viewer, seen, rid)
    row = map_element.stored(conn, ticket_id)
    if row is not None and map_element.detach(conn, ticket_id):
        audit(conn, actor=principal, action="ticket.map_element.detach", decision="allowed", resource_type="ticket", resource_id=ticket_id, request_id=rid,
              details={"number": seen.row["number"], "floor_id": row["floor_id"], "kind": row["element_kind"], "element_id": row["element_id"]})
    return _answer(conn, viewer, access.require_visible(viewer, ticket_id))


@router.get("/tickets/{ticket_id}/map-element/vendor.svg", response_model=None)
def vendor_preview(ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro),
                   conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    row = map_element.stored(conn, ticket_id)
    if row is None or not _sees_element(conn, principal, row["floor_id"], row["element_type"], row["resource_id"]):
        raise ApiError(404, "no_map_image", "אין תמונת מפה לבקשה הזו.")
    svg = map_element.picture(conn, seen.row["id"])
    if svg is None:
        raise ApiError(404, "no_map_image", "אין תמונת מפה לבקשה הזו.")
    return Response(content=svg.encode("utf-8"), media_type="image/svg+xml; charset=utf-8",
                    headers={**NO_STORE, "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff",
                             "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox"})
