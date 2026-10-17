"""CR-038 slice 1 - the tickets API (docs/changes/CR-038-TICKETS-MODULE.md section 8.1): the module state, the caller's departments,
the list, one ticket with its timeline, creation, edit, status (close / cancel / reopen), assignment to an internal user, return by
the assignee, notes, ETA and photos.

Order of every gated route: the signed-in principal -> the module switch (404 `feature_disabled` while `tickets.enabled` is off -
a router-level dependency, so a route added later is gated too; `GET /tickets/module` is the one route that answers while off) ->
the permission -> the visibility rule (services/tickets/access.py: an invisible ticket is the same 404 `ticket_not_found` as an
unknown id). Errors use the ApiError envelope with Hebrew messages that carry the module's display name (D33)."""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, Path, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import Principal
from ..services import device_activity
from ..services.tickets import access, attachments, create, device_context, model, naming, place, present, service, settings_doc, store
from ..services.tickets.access import Viewer, text

ID = r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$"
ENTITY = r"^[a-z0-9_]{1,64}\.[a-z0-9_]{1,190}$"  # a Home Assistant entity id (slice 3)
STATUS_FILTER = r"^(open|unassigned|handling|done|closed|all|new|assigned|acknowledged|in_progress|waiting_part|returned|cancelled)$"


def module_gate(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> None:
    """Every gated tickets route: a signed-in caller first (401), then the module switch (the uniform 404 while it is off)."""
    access.require_module(conn)


open_router = APIRouter()  # GET /tickets/module only
router = APIRouter(dependencies=[Depends(module_gate)])


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _need_any(conn: sqlite3.Connection, viewer: Viewer, *permissions: str) -> None:
    """At least one of the permissions at any scope (the tickets' own scope rules apply per ticket); an audited 403 otherwise."""
    if any(p in viewer.anywhere for p in permissions):
        return
    audit(conn, actor=viewer.principal, action=permissions[0], decision="denied", resource_type="installation", resource_id="*", reason="no_binding")
    raise ApiError(403, "forbidden", text(conn, "אין הרשאה ל{tickets}."), details={"permission": permissions[0]})


def _detail(conn: sqlite3.Connection, viewer: Viewer, ticket_id: str) -> dict[str, Any]:
    return present.ticket_detail(conn, viewer, access.require_visible(viewer, ticket_id))


# ---------------------------------------------------------------- the module state (answers while the module is off)

@open_router.get("/tickets/module")
def module_state(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`{enabled, public_ready, name, name_revision, ui}` for every signed-in user: the shell's switch, the display name (D33; its
    revision is what a rename in Settings sends back) and the display settings (D18 / D22). `public_ready` is false until the public
    handler page exists (slice 4)."""
    name = naming.read(conn)
    return {"enabled": access.module_on(conn), "public_ready": access.public_ready(conn), "name": {k: name[k] for k in naming.LANGS},
            "name_revision": name["revision"], "ui": settings_doc.read(conn)["ui"]}


# ---------------------------------------------------------------- the caller's departments (filters, the create sheet)

@router.get("/tickets/meta")
def meta(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    _need_any(conn, viewer, access.VIEW, access.CREATE)
    all_depts = access.ALL_DEPARTMENTS in viewer.anywhere
    can_handlers = access.MANAGE in viewer.anywhere and viewer.holds_installation(access.HANDLERS)
    out = []
    for d in store.departments(conn, include_inactive=False):
        role = viewer.role(d["id"])
        can_create = viewer.can_create_in(d)
        can_manage = viewer.manages_department(d["id"])
        if not (role or can_create or all_depts):
            continue
        out.append({
            "id": d["id"], "key": d["key"], "name": d["name"], "icon": d.get("icon"), "color": d.get("color"), "my_role": role,
            "can_create": can_create, "can_manage": can_manage, "open_to_all": bool(d["open_to_all"]),
            # CR-DEPT-MANAGER-HANDLERS: the caller manages this department's handlers (services/tickets/dept_handlers.py, THE check)
            "can_handlers": can_handlers and role == "manager",
            "categories": [{"id": c["id"], "name": c["name"], "parent_id": c.get("parent_id"), "default_priority_id": c.get("default_priority_id"),
                            "domains": _domains(c)}  # slice 3: the device domains a category is preselected for (section 14.2)
                           for c in store.categories(conn, d["id"], include_inactive=False)],
            "priorities": [{"id": p["id"], "key": p["key"], "name": p["name"], "rank": p["rank"], "severity": p["notify_severity"], "is_default": bool(p["is_default"])}
                           for p in store.priorities(conn, d["id"]) if p["active"]],
            # slice 2: the department's ticket templates (the create form prefills from them)
            "templates": [{"id": t["id"], "name": t["name"], "title": t["title"], "body": t["body"], "category_id": t.get("category_id"),
                           "priority_key": t.get("priority_key")} for t in store.templates(conn, d["id"], kind="ticket", include_inactive=False)],
        })
    return {
        "departments": out,
        "can": {
            "view": access.VIEW in viewer.anywhere,
            "create": any(d["can_create"] for d in out),
            "manage": any(d["can_manage"] for d in out),
            "all_departments": all_depts,
            "external": access.EXTERNAL in viewer.anywhere,
            "configure": viewer.holds_installation(access.CONFIGURE),
            "handlers": any(d["can_handlers"] for d in out),  # CR-DEPT-MANAGER-HANDLERS
        },
    }


def _domains(category: dict[str, Any]) -> list[str]:
    try:
        raw = json.loads(category.get("domains_json") or "[]")
    except ValueError:
        return []
    return [d for d in raw if isinstance(d, str)][:32] if isinstance(raw, list) else []


# ---------------------------------------------------------------- the device tab (slice 3, section 12.1; review T18-3)

@router.get("/tickets/by-entity/{entity_id}")
def by_entity(entity_id: str = Path(..., max_length=255, pattern=ENTITY), principal: Principal = Depends(current_principal_ro),
              conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The device window's tab: the device's tickets the caller may see (open first, newest first), whether the caller may open one
    from it, and what a new one would carry (the place and a preview of the 24 h history, as the caller may read it). Gate order:
    module (router) -> tickets.view -> the DEVICE (devices.read on the entity, the lock / alarm rule - a device the caller may not
    read is the same 404 as an unknown one) -> the visibility rule per ticket."""
    viewer = Viewer(conn, principal)
    _need_any(conn, viewer, access.VIEW)
    entity = device_context.readable_entity(conn, principal, entity_id)
    if entity is None:
        raise ApiError(404, "not_found", text(conn, "ההתקן לא נמצא."))
    seen = access.visible_for_entity(viewer, entity_id, entity.get("registry_id"))
    lk = present.Lookups(conn)
    last = store.last_assignee_names(conn, [s.row["id"] for s in seen if not s.row.get("current_assignment_id")])
    where = place.locate_entity(conn, entity_id, entity)
    can_create = viewer.holds(access.CREATE, where.columns()) and any(viewer.can_create_in(d) for d in store.departments(conn, include_inactive=False))
    out: dict[str, Any] = {
        "entity": {"entity_id": entity_id, "name": entity.get("name") or entity.get("original_name") or entity_id, "domain": entity["domain"],
                   "tracked": entity["domain"] in device_activity.ACTIVITY_DOMAINS},
        "items": [present.ticket_item(conn, s, lk, last) for s in seen],
        "open_count": sum(1 for s in seen if s.row["status"] not in model.FINAL),
        "can_create": can_create,
        "place_text": where.place_text,
        "history": None,
    }
    if can_create:
        out["history"] = device_context.summary(device_context.capture(conn, principal, entity_id, connected=device_context.ha_connected()))
    return out


# ---------------------------------------------------------------- the list

@router.get("/tickets")
def list_tickets(
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    scope: str = Query("visible", pattern=r"^(visible|mine|department|all)$"),
    status: str = Query("open", pattern=STATUS_FILTER),
    department_id: str | None = Query(None, pattern=ID),
    q: str = Query("", max_length=80),
    limit: int = Query(access.PAGE_DEFAULT, ge=1, le=access.PAGE_MAX),
    cursor: str | None = Query(None, max_length=200),
) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    _need_any(conn, viewer, access.VIEW)
    statuses = None if status == "all" else store.STATUS_GROUPS.get(status, (status,))
    seen, next_cursor = access.visible_page(viewer, scope=scope, statuses=statuses, department_id=department_id,
                                            query=model.clean_text(q), cursor=cursor, limit=limit)
    lk = present.Lookups(conn)
    last = store.last_assignee_names(conn, [s.row["id"] for s in seen if not s.row.get("current_assignment_id")])
    return {"items": [present.ticket_item(conn, s, lk, last) for s in seen], "next_cursor": next_cursor}


# ---------------------------------------------------------------- create

class AssigneeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["user", "contact"]
    id: str = Field(min_length=1, max_length=64, pattern=ID)


class CreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    department_id: str = Field(min_length=1, max_length=64, pattern=ID)
    category_id: str | None = Field(default=None, max_length=64, pattern=ID)
    priority_id: str | None = Field(default=None, max_length=64, pattern=ID)
    title: str = Field(max_length=2000)  # the real limit (120 after cleaning) is the model's: a 422 names the field
    description: str = Field(default="", max_length=20000)
    assign: AssigneeBody | None = None
    assign_note: str = Field(default="", max_length=20000)
    assign_note_external: bool = True
    client_request_id: str = Field(min_length=8, max_length=64, pattern=model.CLIENT_REQUEST_RE.pattern)
    entity_id: str | None = Field(default=None, max_length=255, pattern=ENTITY)  # slice 3: a device's ticket (place + history server-side)
    location_id: str | None = Field(default=None, max_length=64, pattern=ID)  # CR-ORG-LOCATIONS: an active organisation location
    place_text: str = Field(default="", max_length=2000)  # CR-ORG-LOCATIONS: "other (free text)"; the real limit (200) is the service's


CREATE_ROUTE = "POST /tickets"


@router.post("/tickets", status_code=201)
def create_ticket(body: CreateBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    viewer = Viewer(conn, principal)
    _need_any(conn, viewer, access.CREATE)
    scope = f"user:{principal.user_id}"
    prev = store.request_get(conn, scope, body.client_request_id)
    if prev is not None:  # a repeat of the same request (a retry after a lost answer): the first answer, nothing created twice
        if prev["route"] != CREATE_ROUTE:
            raise ApiError(409, "request_id_reused", text(conn, "מזהה הבקשה כבר שימש לפעולה אחרת."))
        return JSONResponse(json.loads(prev["response_json"]), status_code=int(prev["status_code"]))
    spec = create.TicketSpec(
        department_id=body.department_id, title=body.title, description=body.description, category_id=body.category_id,
        priority_id=body.priority_id, assign_to=create.AssigneeRef(body.assign.kind, body.assign.id) if body.assign else None,
        assign_note=body.assign_note, assign_note_external=body.assign_note_external,
        entity_id=body.entity_id, origin="device" if body.entity_id else "manual",
        location_id=body.location_id, place_other=body.place_text,
    )
    result = create.create_ticket(conn, spec, viewer, rid=_rid(request))
    seen = access.visible_by_id(viewer, result.ticket_id)
    answer: dict[str, Any] = present.ticket_detail(conn, viewer, seen) if seen else {"id": result.ticket_id, "number": result.number, "view": "none"}
    answer["result"] = result.kind
    if body.entity_id:
        # section 8.1: the OTHER open tickets of the same device the caller may see (the create sheet listed them first as well)
        lk = present.Lookups(conn)
        others = [s for s in access.visible_for_entity(viewer, body.entity_id, seen.row.get("registry_id") if seen else None)
                  if s.row["id"] != result.ticket_id and s.row["status"] not in model.FINAL]
        answer["open_for_entity"] = [present.ticket_item(conn, s, lk) for s in others]
    store.request_put(conn, scope, body.client_request_id, CREATE_ROUTE, 201, answer)
    return JSONResponse(answer, status_code=201)


# ---------------------------------------------------------------- the assignee picker

@router.get("/tickets/assignees")
def assignees(
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    department_id: str = Query(..., pattern=ID),
    ticket_id: str | None = Query(None, pattern=ID),
) -> dict[str, Any]:
    """Who a manager may assign in a department (section 8): its members with tickets.view where the ticket lies - names only.
    A manager of one department therefore learns the names of that department's members only (review T18-5, stated)."""
    viewer = Viewer(conn, principal)
    row = None
    if ticket_id:
        seen = access.require_visible(viewer, ticket_id)
        row = seen.row
        if row["department_id"] != department_id:
            raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "department_id", "code": "mismatch"}]})
        allowed = seen.manager
    else:
        allowed = viewer.manages_department(department_id)
    if not allowed or store.department(conn, department_id) is None:
        audit(conn, actor=principal, action="ticket.assignees", decision="denied", resource_type="ticket_department", resource_id=department_id, reason="not_manager")
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"reason": "not_manager"})
    # slice 4: the outside contacts allowed in the department - only for a caller who may send outside (D25)
    from ..services.tickets import assignees as assignees_svc
    from ..services.tickets import contacts as contacts_svc
    from ..services.tickets import readiness as readiness_svc

    outside = contacts_svc.assignable_for(viewer, row or {"department_id": department_id})
    # TKSTAFF2: `handlers` is THE picker list - account holders and staff contacts without an account, one shape
    # (services/tickets/assignees.py); `users` stays for older clients; `contacts` holds the outside contacts only (vendors, persons)
    # owner request 2026-10-14: the dialog always shows its three groups and says in one line what stops the outside ones
    return {"users": service.eligible_assignees(conn, department_id, row), "handlers": assignees_svc.handlers(viewer, department_id, row),
            "contacts": outside,
            "external": access.EXTERNAL in viewer.anywhere, "public_ready": access.public_ready(conn),
            "readiness": readiness_svc.readiness(conn, department_id)}


# ---------------------------------------------------------------- one ticket

@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    return _detail(conn, viewer, ticket_id)


class PatchBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, max_length=2000)
    description: str | None = Field(default=None, max_length=20000)
    category_id: str | None = Field(default=None, max_length=64, pattern=ID)
    priority_id: str | None = Field(default=None, max_length=64, pattern=ID)
    department_id: str | None = Field(default=None, max_length=64, pattern=ID)
    revision: int = Field(ge=1)


@router.patch("/tickets/{ticket_id}")
def patch_ticket(body: PatchBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    patch = {k: getattr(body, k) for k in body.model_fields_set if k != "revision"}
    for k in ("title", "priority_id", "department_id"):
        if k in patch and patch[k] is None:
            raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": k, "code": "required"}]})
    service.edit(conn, viewer, seen, patch, body.revision, _rid(request))
    return _detail(conn, viewer, ticket_id)


class StatusBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    to: str = Field(pattern=r"^(new|assigned|acknowledged|in_progress|waiting_part|done|returned|closed|cancelled)$")
    note: str | None = Field(default=None, max_length=20000)
    duplicate_of: str | None = Field(default=None, max_length=64, pattern=ID)
    override_claim_reason: str | None = Field(default=None, max_length=5000)  # S9 (11A.3): close despite a pending required cost claim
    revision: int = Field(ge=1)


@router.post("/tickets/{ticket_id}/status")
def post_status(body: StatusBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    service.change_status(conn, viewer, seen, body.to, body.note, body.revision, body.duplicate_of, _rid(request),
                          override_claim_reason=body.override_claim_reason)
    return _detail(conn, viewer, ticket_id)


class AssignBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    assignee: AssigneeBody
    note: str | None = Field(default=None, max_length=20000)
    note_external: bool = True
    require_code: bool | None = None  # slice 4: an outside contact only - raise only, never below the contact's own setting
    share_history: bool | None = None  # slice 4 (D23): only where a device snapshot exists, never for security domains
    send_now: bool = False  # slice 5b (D29): release the message outside the send hours
    cost_claim: Literal["required", "optional", "off"] | None = None  # slice 9 (D32): an outside contact only; None = the preselection
    location_nav: bool = False  # CR-ORG-LOCATIONS: add the map link to the outgoing message (default off; an outside contact with a located request only)
    revision: int = Field(ge=1)


@router.post("/tickets/{ticket_id}/assign")
def post_assign(body: AssignBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    if body.assignee.kind == "contact":  # slice 4: a handler link for an outside contact / vendor
        from ..services.tickets import external

        external.assign_contact(conn, viewer, seen, body.assignee.id, note=body.note, note_external=body.note_external,
                                require_code=body.require_code, share_history=body.share_history, send_now=body.send_now,
                                revision=body.revision, rid=_rid(request), cost_claim=body.cost_claim, location_nav=body.location_nav)
    else:
        if body.location_nav and seen.manager:  # the switch exists for an outside contact's message only: refused, not ignored
            raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "location_nav", "code": "not_allowed"}]})
        service.assign(conn, viewer, seen, body.assignee.kind, body.assignee.id, body.note, body.note_external, body.revision, _rid(request))
    return _detail(conn, viewer, ticket_id)


class ReturnBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["cannot_handle", "not_mine"]
    reason: str = Field(max_length=5000)
    revision: int = Field(ge=1)


@router.post("/tickets/{ticket_id}/return")
def post_return(body: ReturnBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    service.return_ticket(conn, viewer, seen, body.kind, body.reason, body.revision, _rid(request))
    seen_after = access.visible_by_id(viewer, ticket_id)  # a non-member assignee loses the ticket the moment it is returned
    return present.ticket_detail(conn, viewer, seen_after) if seen_after else {"id": ticket_id, "view": "none", "status": "returned"}


class NoteBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(max_length=20000)
    external: bool = False


@router.post("/tickets/{ticket_id}/notes", status_code=201)
def post_note(body: NoteBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
              conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    service.add_note(conn, viewer, seen, body.text, body.external, _rid(request))
    return _detail(conn, viewer, ticket_id)


class EtaBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    eta_at: str | None = Field(default=None, max_length=40)


@router.post("/tickets/{ticket_id}/eta")
def post_eta(body: EtaBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
             conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    service.set_eta(conn, viewer, seen, body.eta_at, _rid(request))
    return _detail(conn, viewer, ticket_id)


# ---------------------------------------------------------------- photos (section 10.6; body_limit row `ticket_attachment`)

def _refused(exc: attachments.Refused) -> ApiError:
    return ApiError(exc.status, exc.code, exc.message, retryable=exc.status == 429, details=dict(exc.details))


@router.post("/tickets/{ticket_id}/attachments", status_code=201)
def post_attachment(request: Request, ticket_id: str = Path(..., pattern=ID), file: UploadFile = File(...), external: str = Form("false"),
                    principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    vis = service.check_attach(conn, viewer, seen, external == "true", _rid(request))
    data = file.file.read(attachments.MAX_BYTES + 1)
    data_dir = settings_of(request).data_dir
    try:
        with unlocked(conn):  # the decode never holds the database write lock
            stored = attachments.store(data_dir, ticket_id, data)
    except attachments.Refused as exc:
        audit(conn, actor=principal, action="ticket.photo", decision="denied", resource_type="ticket", resource_id=ticket_id, reason=exc.code,
              request_id=_rid(request))
        raise _refused(exc) from None
    # the write lock was released for the decode: the ticket is read again (it may have been closed or moved meanwhile)
    seen = access.visible_by_id(viewer, ticket_id)
    try:
        if seen is None:
            raise access.not_found(conn)
        vis = service.check_attach(conn, viewer, seen, external == "true", _rid(request))
    except ApiError:
        attachments.remove(data_dir, stored.rel_path)
        raise
    service.record_attachment(conn, viewer, seen, stored, vis, _rid(request))
    return _detail(conn, viewer, ticket_id)


@router.get("/tickets/{ticket_id}/attachments/{attachment_id}")
def get_attachment(request: Request, ticket_id: str = Path(..., pattern=ID), attachment_id: str = Path(..., pattern=ID),
                   principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> FileResponse:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    att = store.attachment(conn, ticket_id, attachment_id)
    if att is None or not access.attachment_visible(seen, att, viewer.uid):
        raise ApiError(404, "not_found", text(conn, "התמונה לא נמצאה."))
    try:
        path = attachments.path_of(settings_of(request).data_dir, att["path"])
    except ValueError:
        raise ApiError(404, "not_found", text(conn, "התמונה לא נמצאה.")) from None
    if not path.is_file():
        raise ApiError(404, "not_found", text(conn, "התמונה לא נמצאה."))
    return FileResponse(path, media_type="image/jpeg", headers={
        "Content-Disposition": f'inline; filename="ticket-{seen.row["number"]}.jpg"',
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
    })


@router.delete("/tickets/{ticket_id}/attachments/{attachment_id}")
def delete_attachment(request: Request, ticket_id: str = Path(..., pattern=ID), attachment_id: str = Path(..., pattern=ID),
                      principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    service.delete_attachment(conn, viewer, seen, attachment_id, settings_of(request).data_dir, _rid(request))
    return _detail(conn, viewer, ticket_id)


# ---------------------------------------------------------------- full deletion (owner 14.10, services/tickets/deletion.py)

class DeleteBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(max_length=2000)  # the real limit (300 after cleaning) is the service's: a 422 names the field
    confirm_number: int = Field(ge=1)  # the ticket's number as the manager typed it
    client_request_id: str = Field(min_length=8, max_length=64, pattern=model.CLIENT_REQUEST_RE.pattern)


DELETE_ROUTE = "POST /tickets/{id}/delete"


@router.post("/tickets/{ticket_id}/delete")
def delete_ticket(body: DeleteBody, request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """Delete the ticket and everything hanging off it: `{deleted: true, id, number, counts}`. 404 for an invisible / unknown / already
    deleted ticket (the uniform answer), 403 without tickets.delete + manager rights or outside an interactive session, 409
    `cost_claim_approved`, 422 for the reason or a typed number that does not match, 429 `delete_rate`."""
    from ..db import commit_now
    from ..services.tickets import deletion

    viewer = Viewer(conn, principal)
    rid = _rid(request)
    deletion.require_interactive(conn, viewer, rid)
    scope = f"user:{principal.user_id}"
    prev = store.request_get(conn, scope, body.client_request_id)
    if prev is not None:  # a retry after a lost answer: the first answer, nothing deleted twice
        if prev["route"] != DELETE_ROUTE:
            raise ApiError(409, "request_id_reused", text(conn, "מזהה הבקשה כבר שימש לפעולה אחרת."))
        return JSONResponse(json.loads(prev["response_json"]), status_code=int(prev["status_code"]))
    seen = access.require_visible(viewer, ticket_id)
    chk = deletion.check(viewer, seen)
    if chk.result != "ok":
        raise deletion.refuse(conn, viewer, seen, chk, rid)
    if body.confirm_number != int(seen.row["number"]):
        raise ApiError(422, "validation", text(conn, "המספר שהוקלד אינו תואם את מספר {the_ticket}."),
                       details={"fields": [{"field": "confirm_number", "code": "mismatch"}]})
    reason = deletion.clean_reason(conn, body.reason)
    deletion.require_rate(conn, viewer, 1, rid)
    done = deletion.delete(conn, viewer, seen, chk, reason, rid)
    deletion.rate_mark(principal.user_id)
    answer = {"deleted": True, "id": done.ticket_id, "number": done.number, "counts": done.counts}
    store.request_put(conn, scope, body.client_request_id, DELETE_ROUTE, 200, answer)
    commit_now(conn, keep_reading=False)  # the rows are gone for good before any file is touched
    deletion.remove_files(settings_of(request).data_dir / attachments.DIR, [done.ticket_id])
    return answer


# ---------------------------------------------------------------- TKSTAFF1 (security review F3 / F4): the caller's own work-link mobile


@router.get("/tickets/me/staff-mobile")
def my_staff_mobile(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The caller's OWN mobile for no-login work links (last four digits), whether they confirmed it, and their WhatsApp switch."""
    from ..services.tickets import staff_links

    return staff_links.my_view(conn, principal.user_id)


@router.put("/tickets/me/staff-mobile")
def set_my_staff_mobile(request: Request, body: dict[str, Any], principal: Principal = Depends(current_principal),
                        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """`{confirm: <token of the GET>}` | `{confirmed: false}` | `{notify_whatsapp: bool}` - only ever for the caller."""
    from ..services.tickets import staff_links

    return staff_links.set_mine(conn, Viewer(conn, principal), body, getattr(request.state, "correlation_id", None))


# ---------------------------------------------------------------- TKNOTIFOTP: the caller verifies their OWN number with a code


@router.post("/tickets/me/phone-verify/send")
def my_phone_verify_send(request: Request, principal: Principal = Depends(current_principal),
                         conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Send the fixed code message to the caller's own directory number (no id, no number in the request)."""
    from ..services.tickets import phone_verify

    return phone_verify.my_send(conn, Viewer(conn, principal), getattr(request.state, "correlation_id", None))


@router.post("/tickets/me/phone-verify/check")
def my_phone_verify_check(request: Request, body: dict[str, Any], principal: Principal = Depends(current_principal),
                          conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """`{code}`: a match confirms the caller's number BY CODE; anything else the uniform 422 `code_invalid`."""
    from ..services.tickets import phone_verify, staff_links

    viewer = Viewer(conn, principal)
    phone_verify.my_check(conn, viewer, body, getattr(request.state, "correlation_id", None))
    return staff_links.my_view(conn, principal.user_id)
