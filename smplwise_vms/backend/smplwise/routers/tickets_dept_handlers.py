"""CR-DEPT-MANAGER-HANDLERS (owner 2026-10-17): the department manager's routes of "מטפלים וספקים" - his departments' members with an
account and directory rows, without `tickets.configure`. The rules and THE check live in services/tickets/dept_handlers.py.

| Method | Path | What |
|--------|------|------|
| GET    | /tickets/dept-handlers | the departments the caller manages, their members (phones masked unless allowed), `can_manage` |
| GET    | /tickets/dept-handlers/people | active users to add as members (names only) |
| PUT    | /tickets/dept-handlers/{dept_id}/members/{user_id} | add a user as a plain member (idempotent) |
| DELETE | /tickets/dept-handlers/{dept_id}/members/{user_id} | remove a plain member |
| PUT    | /tickets/dept-handlers/{dept_id}/members/{user_id}/mobile | a plain member's mobile and language |
| POST   | /tickets/dept-handlers/{dept_id}/contacts | create a directory row (his department by default, or shared with every department) |
| POST   | /tickets/dept-handlers/{dept_id}/contacts/lookup | the live vendors with EXACTLY this number (rate limited, masked) |
| POST   | /tickets/dept-handlers/{dept_id}/contacts/attach-by-phone | attach such a vendor (the same number again) |
| PUT    | /tickets/dept-handlers/{dept_id}/contacts/{contact_id} | attach a row to the department (idempotent) |
| DELETE | /tickets/dept-handlers/{dept_id}/contacts/{contact_id} | detach a row (never its last department) |
| PATCH  | /tickets/dept-handlers/{dept_id}/contacts/{contact_id} | edit a row he created that no other department uses |
| POST   | /tickets/dept-handlers/{dept_id}/contacts/{contact_id}/erase | erase such a row |

Every route answers the module's uniform 404 while the module is off (`module_gate`). Mounted BEFORE routers/tickets.py (its
`/tickets/{ticket_id}` would match `/tickets/dept-handlers`)."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..rbac import Principal
from ..services.tickets import contacts, dept_handlers
from ..services.tickets.access import Viewer
from .tickets import ID, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])
USER = Path(..., min_length=1, max_length=200, pattern=r"^[A-Za-z0-9_.:@-]{1,200}$")


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class _Details(BaseModel):
    """The directory fields a department manager may set (no user link, no internal notes, no cost or rate defaults, no
    department list - the attachment has its own routes)."""
    model_config = ConfigDict(extra="forbid")
    display_name: str | None = Field(default=None, max_length=400)
    company: str | None = Field(default=None, max_length=400)
    vendor_id: str | None = Field(default=None, max_length=64, pattern=ID)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=320)
    preferred_channel: Literal["whatsapp", "email", "manual"] | None = None
    require_code: bool | None = None
    share_history: bool | None = None
    lang: Literal["he", "en", "ar", "ru"] | None = None


class CreateBody(_Details):
    kind: Literal["person", "vendor", "employee"]
    shared: bool | None = None  # vendors / contacts: None = his department only (owner 2026-10-17, question 2); employees: never


class PatchBody(_Details):
    active: bool | None = None
    revision: int = Field(ge=1)


def _sent(body: BaseModel, drop: set[str]) -> dict[str, Any]:
    out = {k: getattr(body, k) for k in body.model_fields_set - drop}
    for flag in ("require_code", "active"):
        if flag in out and out[flag] is None:
            out.pop(flag)
    return out


@router.get("/tickets/dept-handlers")
def overview(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return dept_handlers.overview(Viewer(conn, principal))


@router.get("/tickets/dept-handlers/people")
def people(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
           q: str = Query("", max_length=60)) -> dict[str, Any]:
    return dept_handlers.people(Viewer(conn, principal), q)


@router.put("/tickets/dept-handlers/{dept_id}/members/{user_id}")
def add_member(request: Request, dept_id: str = Path(..., pattern=ID), user_id: str = USER, principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return dept_handlers.add_member(Viewer(conn, principal), dept_id, user_id, _rid(request))


@router.delete("/tickets/dept-handlers/{dept_id}/members/{user_id}")
def remove_member(request: Request, dept_id: str = Path(..., pattern=ID), user_id: str = USER, principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return dept_handlers.remove_member(Viewer(conn, principal), dept_id, user_id, _rid(request))


class MobileBody(BaseModel):
    """A plain member's mobile line (owner 2026-10-17, question 4): the number and the language only."""
    model_config = ConfigDict(extra="forbid")
    phone: str | None = Field(default=None, max_length=40)
    lang: Literal["he", "en", "ar", "ru"] | None = None


@router.put("/tickets/dept-handlers/{dept_id}/members/{user_id}/mobile")
def member_mobile(body: MobileBody, request: Request, dept_id: str = Path(..., pattern=ID), user_id: str = USER,
                  principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    sent = {k: getattr(body, k) for k in body.model_fields_set}
    if sent.get("lang", "x") is None:
        sent.pop("lang")
    return dept_handlers.set_member_mobile(Viewer(conn, principal), dept_id, user_id, sent, _rid(request))


class LookupBody(BaseModel):
    """The number travels in the body (never in the URL / the access log)."""
    model_config = ConfigDict(extra="forbid")
    phone: str = Field(min_length=1, max_length=40)


class AttachByPhoneBody(LookupBody):
    contact_id: str = Field(min_length=1, max_length=64, pattern=ID)


@router.post("/tickets/dept-handlers/{dept_id}/contacts/lookup")
def lookup_vendor(body: LookupBody, request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return dept_handlers.lookup_vendor(Viewer(conn, principal), dept_id, body.phone, _rid(request))


@router.post("/tickets/dept-handlers/{dept_id}/contacts/attach-by-phone")
def attach_by_phone(body: AttachByPhoneBody, request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return dept_handlers.attach_by_phone(Viewer(conn, principal), dept_id, body.contact_id, body.phone, _rid(request))


@router.post("/tickets/dept-handlers/{dept_id}/contacts", status_code=201)
def create_contact(body: CreateBody, request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return dept_handlers.create_contact(Viewer(conn, principal), dept_id, _sent(body, set()), _rid(request))


@router.put("/tickets/dept-handlers/{dept_id}/contacts/{contact_id}")
def attach_contact(request: Request, dept_id: str = Path(..., pattern=ID), contact_id: str = Path(..., pattern=ID),
                   principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return dept_handlers.attach_contact(Viewer(conn, principal), dept_id, contact_id, _rid(request))


@router.delete("/tickets/dept-handlers/{dept_id}/contacts/{contact_id}")
def detach_contact(request: Request, dept_id: str = Path(..., pattern=ID), contact_id: str = Path(..., pattern=ID),
                   principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return dept_handlers.detach_contact(Viewer(conn, principal), dept_id, contact_id, _rid(request))


@router.patch("/tickets/dept-handlers/{dept_id}/contacts/{contact_id}")
def patch_contact(body: PatchBody, request: Request, dept_id: str = Path(..., pattern=ID), contact_id: str = Path(..., pattern=ID),
                  principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    sent = _sent(body, {"revision"})
    if not sent:
        raise contacts.invalid(conn, "body", "empty")
    return dept_handlers.update_contact(Viewer(conn, principal), dept_id, contact_id, sent, body.revision, _rid(request))


class EraseBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: Literal[True]


@router.post("/tickets/dept-handlers/{dept_id}/contacts/{contact_id}/erase")
def erase_contact(body: EraseBody, request: Request, dept_id: str = Path(..., pattern=ID), contact_id: str = Path(..., pattern=ID),
                  principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return dept_handlers.erase_contact(Viewer(conn, principal), dept_id, contact_id, _rid(request))
