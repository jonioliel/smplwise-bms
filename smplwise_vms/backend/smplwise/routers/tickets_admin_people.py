"""The tickets settings API: department members (the escalation rule, review T19), a staff member's mobile, the people pickers
and the permissions overview (section 8.2).

CR-SPLIT-TICKETS-ADMIN-2440 (review 05:P2-08): moved unchanged out of routers/tickets_admin.py, which still exports every name."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field, StrictBool

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import now_iso
from ..errors import ApiError
from ..rbac import Principal, ROLES, all_roles, role_permissions, scope_name
from ..services.tickets import access, model, store
from ..services.tickets.access import Viewer, text
from ._common import rid as _rid
from .tickets import ID, module_gate
from .tickets_admin_base import GRANT_ROLES, _configurer
from .tickets_admin_departments import _department_dict, _dept_or_404, _may_edit_members

router = APIRouter(dependencies=[Depends(module_gate)])


# ---------------------------------------------------------------- members (the escalation rule, review T19)

class MemberBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["manager", "member"]
    notify_new: bool | None = None


def _member_guard(conn: sqlite3.Connection, viewer: Viewer, dept_id: str, kind: str, subject_id: str, role: str | None, request: Request) -> None:
    def deny(reason: str) -> ApiError:
        audit(conn, actor=viewer.principal, action="ticket.member.change", decision="denied", resource_type="ticket_department", resource_id=dept_id,
              reason=reason, request_id=_rid(request), details={"subject_kind": kind, "subject_id": subject_id, "role": role})
        return ApiError(403, "forbidden", text(conn, "אין הרשאה לשנות את חברי המחלקה הזו."), details={"reason": reason})

    if not _may_edit_members(viewer, dept_id):
        raise deny("not_manager_of_department")
    me = viewer.uid
    concerns_me = (kind == "user" and subject_id == me) or (kind == "group" and subject_id in store.group_ids_of(conn, me))
    # nobody makes themself a manager of a department they do not already manage - except a holder of tickets.all_departments at the
    # installation (PENDING owner confirmation, 2026-10-14: a solo system administrator could not add himself as a manager). Such a
    # holder already sees and manages every department; the add is audited as usual with `self: true` (put_member).
    if concerns_me and role == "manager" and viewer.role(dept_id) != "manager" and not viewer.holds_installation(access.ALL_DEPARTMENTS):
        raise deny("self_escalation")


@router.put("/tickets/admin/departments/{dept_id}/members/{kind}/{subject_id}")
def put_member(body: MemberBody, request: Request, dept_id: str = Path(..., pattern=ID), kind: Literal["user", "group"] = Path(...),
               subject_id: str = Path(..., min_length=1, max_length=200), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    _dept_or_404(conn, dept_id)
    _member_guard(conn, viewer, dept_id, kind, subject_id, body.role, request)
    if kind == "user" and subject_id not in store.active_user_ids(conn):
        raise ApiError(404, "user_unknown", text(conn, "המשתמש לא נמצא או אינו פעיל."))
    if kind == "group" and not any(g["id"] == subject_id for g in store.groups(conn)):
        raise ApiError(404, "group_unknown", text(conn, "הקבוצה לא נמצאה."))
    before = store.member_row(conn, dept_id, kind, subject_id)
    notify_new = body.notify_new
    if notify_new is None:  # the department's FIRST manager is told about new tickets; later ones opt in (review: notification fatigue)
        notify_new = bool(before["notify_new"]) if before else (body.role == "manager" and store.manager_count(conn, dept_id) == 0)
    store.upsert_member(conn, dept_id, kind, subject_id, body.role, 1 if notify_new and body.role == "manager" else 0, principal.user_id)
    audit(conn, actor=principal, action="ticket.member.add" if before is None else "ticket.member.update", decision="allowed",
          resource_type="ticket_department", resource_id=dept_id, request_id=_rid(request),
          details={"subject_kind": kind, "subject_id": subject_id, "role": body.role, "before": before["member_role"] if before else None,
                   "self": (kind == "user" and subject_id == principal.user_id) or (kind == "group" and subject_id in store.group_ids_of(conn, principal.user_id))})
    return _department_dict(conn, Viewer(conn, principal), store.department(conn, dept_id) or {})


@router.delete("/tickets/admin/departments/{dept_id}/members/{kind}/{subject_id}")
def delete_member(request: Request, dept_id: str = Path(..., pattern=ID), kind: Literal["user", "group"] = Path(...),
                  subject_id: str = Path(..., min_length=1, max_length=200), principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    _dept_or_404(conn, dept_id)
    _member_guard(conn, viewer, dept_id, kind, subject_id, None, request)
    before = store.member_row(conn, dept_id, kind, subject_id)
    if before is None:
        raise ApiError(404, "not_found", text(conn, "החבר לא נמצא במחלקה."))
    store.delete_member(conn, dept_id, kind, subject_id)
    from ..services.tickets import staff_links  # TKSTAFF1 (R7 b): a user who left the department holds no live staff link

    staff_links.safe_recheck(conn)
    audit(conn, actor=principal, action="ticket.member.remove", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
          request_id=_rid(request), details={"subject_kind": kind, "subject_id": subject_id, "role": before["member_role"]})
    return _department_dict(conn, Viewer(conn, principal), store.department(conn, dept_id) or {})


# ---------------------------------------------------------------- TKSTAFF1: a staff member's mobile (the no-login staff link)

class StaffMobileBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phone: str | None = Field(default=None, max_length=40)
    lang: Literal["he", "en", "ar", "ru"] | None = None
    notify_whatsapp: StrictBool | None = None
    phone_verify: StrictBool | None = None  # TKNOTIFOTP: "verify the number with a code" for this person


@router.put("/tickets/admin/staff/{user_id}")
def put_staff_mobile(body: StaffMobileBody, request: Request, user_id: str = Path(..., min_length=1, max_length=200),
                     principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """"מטפלים וספקים" › מטפלים › "עם חשבון במערכת": the mobile (E.164), the message language and the user's WhatsApp switch of an
    internal employee with an account (services/tickets/staff_links.set_mobile; tickets.configure; audited without the number)."""
    from ..services.tickets import staff_links

    viewer = _configurer(conn, principal)
    sent = body.model_dump(exclude_unset=True)
    return staff_links.set_mobile(conn, viewer, user_id, sent, _rid(request))


# ---------------------------------------------------------------- pickers and the permissions overview (section 8.2)

@router.get("/tickets/admin/directory")
def directory(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
              q: str = Query("", max_length=60)) -> dict[str, Any]:
    """The people and groups a department's member list may name - names only (the member editor's picker)."""
    _configurer(conn, principal)
    needle = model.clean_text(q).casefold()
    names = store.display_names(conn, store.active_user_ids(conn))  # 01:F-08: two statements, not two per person
    users = [{"id": uid, "name": name} for uid, name in names.items()]
    users = sorted((u for u in users if not needle or needle in u["name"].casefold()), key=lambda u: u["name"])[:200]
    groups = [g for g in store.groups(conn) if not needle or needle in g["name"].casefold()][:100]
    return {"users": users, "groups": groups}


@router.get("/tickets/admin/holders")
def holders(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Who holds a ticket permission and through what - a role, a group, or a single-permission grant to that person (D25, section
    8.2): one place that shows every grant the bindings lists hold. Grants are made with the ordinary binding route (rbac.assign)."""
    _configurer(conn, principal)
    from ..rbac import role_name

    people: dict[str, dict[str, Any]] = {}
    active = store.active_user_ids(conn)  # 01:F-08: the active set and the names are read once, not per person
    for b in store.active_bindings(conn, now_iso()):
        perms = [p for p in role_permissions(conn, b["role_id"]) if p in access.TICKET_PERMISSIONS]
        if not perms:
            continue
        via = "grant" if b["role_id"] in GRANT_ROLES and b["subject_kind"] == "user" else "group" if b["subject_kind"] == "group" else "role"
        targets = [b["subject_id"]] if b["subject_kind"] == "user" else store.group_member_ids(conn, b["subject_id"])
        for uid in targets:
            entry = people.setdefault(uid, {"id": uid, "name": "", "active": uid in active, "grants": []})
            entry["grants"].append({
                "binding_id": b["id"], "permissions": perms, "via": via, "role_id": b["role_id"], "role_name": role_name(conn, b["role_id"]),
                "group_name": store.group_name(conn, b["subject_id"]) if b["subject_kind"] == "group" else None,
                "scope_type": b["scope_type"], "scope_id": b["scope_id"], "scope_name": scope_name(conn, b["scope_type"], b["scope_id"]),
                "effect": b["effect"], "expires_at": b["expires_at"],
            })
    for uid, name in store.display_names(conn, people).items():
        people[uid]["name"] = name
    # slice 2 - the "מי רשאי" matrix: every role (built-in and organisation-defined) with the ticket permissions it carries; the
    # single-permission grant roles are the personal-grant card's, not rows here
    roles = []
    for role_id, perms in all_roles(conn).items():
        if role_id in GRANT_ROLES:
            continue
        roles.append({"id": role_id, "name": role_name(conn, role_id), "builtin": role_id in ROLES,
                      "permissions": [p for p in access.TICKET_PERMISSIONS if p in perms]})
    order = {r: i for i, r in enumerate(("viewer", "kiosk", "operator", "editor", "door_opener", "site_admin", "system_admin"))}
    roles.sort(key=lambda r: (not r["builtin"], order.get(r["id"], 50), r["name"]))
    from ..i18n import localize_for

    return localize_for(conn, principal, {"users": sorted(people.values(), key=lambda u: u["name"]), "grant_roles": [r for r in GRANT_ROLES if r in ROLES], "roles": roles})  # I18N-BACKEND-2490 (third pass): role / scope names in the reader's language
