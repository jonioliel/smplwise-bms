"""CR-038 slice 4 - the contact / vendor directory API (spec 8.1 "contacts", 15.2): list, one row, create, edit, erase, export.

Gates (services/tickets/contacts.py): writes, erase and export need `tickets.configure` (sensitive, installation scope; refusals
audited by rbac.require); the list is readable with `tickets.configure` or by the managers of the departments a contact is
allowed for (`tickets.manage`), with the full phone number only for `tickets.configure` or `tickets.external` holders. Every route
answers the module's uniform 404 while the module is off (the router-level `module_gate`). Mounted BEFORE routers/tickets.py (its
`/tickets/{ticket_id}` would match `/tickets/contacts`)."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import Principal
from ..services.tickets import access, contacts
from ..services.tickets.access import Viewer, text
from .tickets import ID, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class ContactBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["person", "vendor", "employee"] | None = None  # "employee": an employee without an account (0084)
    display_name: str | None = Field(default=None, max_length=400)
    company: str | None = Field(default=None, max_length=400)
    vendor_id: str | None = Field(default=None, max_length=64, pattern=ID)
    user_id: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=320)
    preferred_channel: Literal["whatsapp", "email", "manual"] | None = None
    require_code: bool | None = None
    share_history: bool | None = None
    lang: Literal["he", "en", "ar", "ru"] | None = None
    notes: str | None = Field(default=None, max_length=5000)
    active: bool | None = None
    departments: list[str] | None = Field(default=None, max_length=50)
    # S9 (11A.1 / 11A.2, D32): cost-claim defaults of the contact / vendor
    cost_claim: Literal["required", "optional", "off"] | None = None
    vat_exempt: bool | None = None
    vat_default: Literal["included", "excluded"] | None = None
    labor_rate: str | None = Field(default=None, max_length=20)
    rate_currency: str | None = Field(default=None, max_length=3)
    phone_verify: bool | None = None  # TKNOTIFOTP: "verify the number with a code" for this row (raises the installation switch)
    revision: int | None = Field(default=None, ge=1)


def _body(body: ContactBody) -> dict[str, Any]:
    """Only the fields the client sent (an explicit null clears a nullable field)."""
    sent = body.model_fields_set - {"revision"}
    out = {k: getattr(body, k) for k in sent}
    for flag in ("require_code", "active", "vat_exempt", "vat_default", "phone_verify"):
        if flag in out and out[flag] is None:
            out.pop(flag)
    return out


@router.get("/tickets/contacts")
def list_contacts(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
                  q: str = Query("", max_length=60), kind: Literal["person", "vendor", "employee"] | None = Query(None),
                  department_id: str | None = Query(None, pattern=ID), include_inactive: bool = Query(True)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    if not (contacts.may_configure(viewer) or access.MANAGE in viewer.anywhere):
        audit(conn, actor=principal, action="ticket.contacts", decision="denied", resource_type="installation", resource_id="*", reason="no_permission")
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"permission": access.CONFIGURE})
    return contacts.list_for(viewer, query=q, kind=kind, department_id=department_id, include_inactive=include_inactive)


@router.get("/tickets/readiness")
def get_readiness(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
                  department_id: str | None = Query(None, pattern=ID)) -> dict[str, Any]:
    """What sending outside still needs (the "מטפלים וספקים" page's strip): booleans and counts only, for the readers of the directory."""
    from ..services.tickets import readiness

    viewer = Viewer(conn, principal)
    if not (contacts.may_configure(viewer) or access.MANAGE in viewer.anywhere):
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"permission": access.CONFIGURE})
    return readiness.readiness(conn, department_id)


@router.post("/tickets/contacts", status_code=201)
def create_contact(body: ContactBody, request: Request, principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    return contacts.create(conn, viewer, _body(body), _rid(request))


@router.get("/tickets/contacts/{contact_id}")
def get_contact(contact_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal_ro),
                conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    if not (contacts.may_configure(viewer) or access.MANAGE in viewer.anywhere):
        raise ApiError(404, "contact_not_found", text(conn, "איש הקשר לא נמצא."))
    return contacts.one(conn, viewer, contact_id)


@router.patch("/tickets/contacts/{contact_id}")
def patch_contact(body: ContactBody, request: Request, contact_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    if body.revision is None:
        raise contacts.invalid(conn, "revision", "required")
    return contacts.update(conn, viewer, contact_id, _body(body), body.revision, _rid(request))


# ---------------------------------------------------------------- VPORTALRFQ: the vendor portal's technician requests (the editors' side)


class TechDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)


@router.get("/tickets/portal-requests")
def list_portal_requests(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
                         state: Literal["pending", "approved", "rejected", "cancelled", "all"] = Query("pending")) -> dict[str, Any]:
    """The company technician requests vendors sent from the portal (services/tickets/portal_more.py): a directory editor
    (`tickets.configure`) sees all of them; a holder of `tickets.technician_requests` those of the vendors of the departments he
    manages (all with tickets.all_departments); anyone else the audited 403. A request out of scope is never listed (and is the
    404 `tech_request_not_found` on approve / reject)."""
    from ..services.tickets import portal_more

    return portal_more.editor_list(conn, Viewer(conn, principal), None if state == "all" else state)


@router.post("/tickets/portal-requests/{request_id}/approve")
def approve_portal_request(body: TechDecision, request: Request, request_id: str = Path(..., pattern=ID),
                           principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    from ..services.tickets import portal_more

    return portal_more.approve(conn, Viewer(conn, principal), request_id, body.revision, _rid(request))


@router.post("/tickets/portal-requests/{request_id}/reject")
def reject_portal_request(body: TechDecision, request: Request, request_id: str = Path(..., pattern=ID),
                          principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    from ..services.tickets import portal_more

    return portal_more.reject(conn, Viewer(conn, principal), request_id, body.revision, _rid(request))


class EraseBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: Literal[True]
    history: bool = False


@router.post("/tickets/contacts/{contact_id}/erase")
def erase_contact(body: EraseBody, request: Request, contact_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    return contacts.erase(conn, viewer, contact_id, history=body.history, rid=_rid(request))


@router.get("/tickets/contacts/{contact_id}/export")
def export_contact(request: Request, contact_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    return contacts.export(conn, viewer, contact_id, _rid(request))


# ---------------------------------------------------------------- TKNOTIFOTP: verifying a vendor's / contact's number (optional)
# tickets.configure; never for a row that names a user (409 `user_only`: the user verifies their own number in "החשבון שלי").
# No number and no code in any answer, audit row or log line (services/tickets/phone_verify.py).


class CodeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(max_length=32)


class ConfirmBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: str = Field(min_length=1, max_length=64)


@router.post("/tickets/contacts/{contact_id}/phone-verify/send")
def contact_verify_send(request: Request, contact_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Send the fixed code message to the contact's number (WhatsApp only)."""
    from ..services.tickets import phone_verify

    return phone_verify.admin_send(conn, Viewer(conn, principal), contact_id, _rid(request))


@router.post("/tickets/contacts/{contact_id}/phone-verify/check")
def contact_verify_check(body: CodeBody, request: Request, contact_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                         conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The code the vendor read out, typed by the configurer: a match confirms the number by code (uniform 422 otherwise)."""
    from ..services.tickets import phone_verify

    return phone_verify.admin_check(conn, Viewer(conn, principal), contact_id, {"code": body.code}, _rid(request))


@router.post("/tickets/contacts/{contact_id}/phone-confirm")
def contact_phone_confirm(body: ConfirmBody, request: Request, contact_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                          conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """"אני בטוח שזה המספר שלו" - only while verification is off for the row (409 `code_required` otherwise); audited."""
    from ..services.tickets import phone_verify

    return phone_verify.manager_confirm(conn, Viewer(conn, principal), contact_id, {"confirm": body.confirm}, _rid(request))
