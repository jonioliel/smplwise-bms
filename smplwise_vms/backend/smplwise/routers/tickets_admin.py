"""CR-038 slice 1 - the module's settings API: the display settings document (D18 / D22, `system.configure`), the display name
(D33, `tickets.configure`), departments with their categories, priorities and members (`tickets.configure`), the people pickers
and the list of who holds a ticket permission (the "הרשאות" tab, section 8.2).

Escalation rules (review T19, section 8): `tickets.configure` is sensitive; a member edit needs `tickets.configure` AND (a manager
member of that department OR `tickets.all_departments`); nobody makes themself a manager of a department they do not already manage
(directly or through a group they belong to); the creator of a department who does not hold `tickets.all_departments` becomes its first
manager. Department configuration is installation-wide, so these permissions are checked at installation scope. Every write is audited
(ids and field names, never free text). Mounted BEFORE routers/tickets.py (its `/tickets/{ticket_id}` would match these paths)."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, ROLES, Principal, require, role_permissions, scope_name
from ..services.tickets import access, model, naming, settings_doc, store
from ..services.tickets.access import Viewer, text
from .tickets import ID, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])

KEY = r"^[a-z][a-z0-9_-]{1,31}$"
ICON = r"^[a-z][a-zA-Z0-9_-]{0,31}$"
COLOR = r"^--sw-[a-z0-9-]{1,40}$"
GRANT_ROLES = ("tickets_view", "tickets_create", "tickets_manage", "tickets_all_departments", "tickets_external", "tickets_configure",
               "tickets_costs_view", "tickets_costs")  # S9 (D31, 11A.8)


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _invalid(conn: sqlite3.Connection, field: str, code: str) -> ApiError:
    return ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": field, "code": code}]})


def _configurer(conn: sqlite3.Connection, principal: Principal) -> Viewer:
    require(conn, principal, access.CONFIGURE, INSTALLATION)
    return Viewer(conn, principal)


def _clean(conn: sqlite3.Connection, value: Any, field: str, *, required: bool, max_len: int) -> str:
    try:
        return model.text_field(value, field, required=required, max_len=max_len)
    except model.Invalid as exc:
        raise _invalid(conn, exc.problems[0].field, exc.problems[0].code) from None


# ---------------------------------------------------------------- the display settings document (D18 / D22)

@router.get("/tickets/settings")
def get_settings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    return settings_doc.read(conn)


class UiPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    detail: Literal["drawer", "fullscreen", "drawer_fullscreen"] | None = None
    new_ticket: Literal["sheet", "dialog"] | None = None


class PublicPatch(BaseModel):  # slice 4: the handler page's address and the peers whose CF-Connecting-IP is believed
    model_config = ConfigDict(extra="forbid")
    base_url: str | None = Field(default=None, max_length=300)
    trusted_proxy_cidrs: list[str] | None = Field(default=None, max_length=8)


class LinksPatch(BaseModel):  # slice 4 (D5): the link lifetime; per-department overrides live on the department
    model_config = ConfigDict(extra="forbid")
    sliding_days: int | None = Field(default=None, ge=1, le=90)
    cap_days: int | None = Field(default=None, ge=7, le=365)
    grace_hours: int | None = Field(default=None, ge=0, le=168)


class CostsPatch(BaseModel):  # slice 9 (11A.14, D31 / D32): cost claims; department / vendor overrides live on their rows
    model_config = ConfigDict(extra="forbid")
    mode: Literal["required", "optional", "off"] | None = None
    currencies: list[str] | None = Field(default=None, max_length=5)
    vat_rate_bp: int | None = Field(default=None, ge=0, le=5000)
    claim_window_days: int | None = Field(default=None, ge=1, le=90)
    require_invoice: bool | None = None
    max_claim_total_minor: int | None = Field(default=None, ge=100, le=99_999_999_999)
    review_flag_above_minor: int | None = Field(default=None, ge=0, le=99_999_999_999)
    notify_vendor_approved: bool | None = None
    retention_days: int | None = Field(default=None, ge=730, le=3650)


class SettingsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=0)
    ui: UiPatch | None = None
    organization_name: str | None = Field(default=None, max_length=400)
    public: PublicPatch | None = None
    links: LinksPatch | None = None
    costs: CostsPatch | None = None


@router.put("/tickets/settings")
def put_settings(body: SettingsBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    current = settings_doc.read(conn)
    if body.revision != current["revision"]:
        raise ApiError(409, "settings_stale", text(conn, "ההגדרות השתנו בינתיים. טענו מחדש."), details={"revision": current["revision"]})
    patch: dict[str, Any] = {}
    if body.ui is not None:
        ui = {k: v for k, v in body.ui.model_dump().items() if v is not None}
        if ui:
            patch["ui"] = ui
    if body.organization_name is not None:
        patch["organization_name"] = body.organization_name
    for block in ("public", "links", "costs"):  # slice 4, slice 9
        sent = getattr(body, block)
        if sent is not None:
            values = {k: v for k, v in sent.model_dump().items() if v is not None}
            if values:
                patch[block] = values
    links_after = {**current["links"], **patch.get("links", {})}
    if links_after["cap_days"] < links_after["sliding_days"]:
        raise _invalid(conn, "links.cap_days", "below_sliding_days")  # the cap is never shorter than the sliding window (14.1)
    try:
        doc, changed = settings_doc.apply_patch(conn, patch)
    except ValueError as exc:
        raise _invalid(conn, str(exc).split(":")[0], "invalid") from None
    pulled = 0
    if doc["links"]["cap_days"] < current["links"]["cap_days"]:  # D5: a LOWER cap shrinks the exposure of live links at once
        from ..services.tickets import handler_links

        pulled = handler_links.pull_in_caps(conn, doc["links"]["cap_days"])
    if "public.trusted_proxy_cidrs" in changed:  # W13: the running listener follows without a restart
        from ..services.tickets.public_runtime import RUNTIME

        RUNTIME.set_trusted(doc["public"]["trusted_proxy_cidrs"])
    audit(conn, actor=principal, action="tickets.settings.update", decision="allowed", resource_type="installation", resource_id="tickets",
          request_id=_rid(request), details={"revision": doc["revision"], "changed": changed, **({"links_capped": pulled} if pulled else {})})
    return doc


# ---------------------------------------------------------------- the display name (D33)

class NameEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    one: str = Field(max_length=200)
    many: str = Field(max_length=200)
    gender: str = Field(default="", max_length=2)


class NameBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=0)
    he: NameEntry | None = None
    en: NameEntry | None = None
    ar: NameEntry | None = None
    ru: NameEntry | None = None


@router.put("/tickets/name")
def put_name(body: NameBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The module's display name (D33): one entry per language, edited with the module's settings permission."""
    require(conn, principal, access.CONFIGURE, INSTALLATION)
    current = naming.read(conn)
    if body.revision != current["revision"]:
        raise ApiError(409, "settings_stale", text(conn, "ההגדרות השתנו בינתיים. טענו מחדש."), details={"revision": current["revision"]})
    raw = {lang: getattr(body, lang).model_dump() for lang in naming.LANGS if getattr(body, lang) is not None}
    try:
        languages = naming.validate(raw)
    except naming.NameInvalid as exc:
        raise _invalid(conn, exc.field, exc.code) from None
    doc = naming.store(conn, languages, current["revision"] + 1)
    changed = sorted(lang for lang in languages if languages[lang] != current[lang])
    audit(conn, actor=principal, action="tickets.name.update", decision="allowed", resource_type="installation", resource_id="tickets",
          request_id=_rid(request), details={"revision": doc["revision"], "languages": changed})
    return doc


# ---------------------------------------------------------------- departments

def _member_dicts(conn: sqlite3.Connection, dept_id: str) -> list[dict[str, Any]]:
    out = []
    for m in store.members(conn, dept_id):
        name = store.display_name(conn, m["subject_id"]) if m["subject_kind"] == "user" else store.group_name(conn, m["subject_id"])
        out.append({"kind": m["subject_kind"], "id": m["subject_id"], "name": name, "role": m["member_role"], "notify_new": bool(m["notify_new"]),
                    "added_at": m["added_at"]})
    return out


def _department_dict(conn: sqlite3.Connection, viewer: Viewer, d: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": d["id"], "key": d["key"], "name": d["name"], "description": d["description"], "icon": d.get("icon"), "color": d.get("color"),
        "sort_order": d["sort_order"], "active": bool(d["active"]), "open_to_all": bool(d["open_to_all"]), "reopen_days": d["reopen_days"],
        "revision": d["revision"], "open_tickets": store.open_ticket_count(conn, d["id"]),
        "categories": [{"id": c["id"], "name": c["name"], "parent_id": c.get("parent_id"), "default_priority_id": c.get("default_priority_id"),
                        "sort_order": c["sort_order"], "active": bool(c["active"])} for c in store.categories(conn, d["id"])],
        "priorities": [{"id": p["id"], "key": p["key"], "name": p["name"], "rank": p["rank"], "severity": p["notify_severity"],
                        "is_default": bool(p["is_default"]), "active": bool(p["active"])} for p in store.priorities(conn, d["id"])],
        "members": _member_dicts(conn, d["id"]),
        "can_edit_members": _may_edit_members(viewer, d["id"]),
    }


def _may_edit_members(viewer: Viewer, dept_id: str) -> bool:
    return viewer.role(dept_id) == "manager" or viewer.holds_installation(access.ALL_DEPARTMENTS)


@router.get("/tickets/admin/departments")
def list_departments(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    return {"departments": [_department_dict(conn, viewer, d) for d in store.departments(conn)],
            "all_departments": viewer.holds_installation(access.ALL_DEPARTMENTS)}


class DepartmentBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str | None = Field(default=None, pattern=KEY)
    name: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    icon: str | None = Field(default=None, pattern=ICON)
    color: str | None = Field(default=None, pattern=COLOR)
    sort_order: int | None = Field(default=None, ge=0, le=9999)
    active: bool | None = None
    open_to_all: bool | None = None
    reopen_days: int | None = Field(default=None, ge=1, le=90)
    revision: int | None = Field(default=None, ge=1)


def _department_fields(conn: sqlite3.Connection, body: DepartmentBody, *, creating: bool) -> dict[str, Any]:
    sent = body.model_fields_set - {"revision"}
    fields: dict[str, Any] = {}
    if creating and not body.key:
        raise _invalid(conn, "key", "required")
    if "key" in sent and body.key:
        fields["key"] = body.key
    if creating or "name" in sent:
        fields["name"] = _clean(conn, body.name, "name", required=True, max_len=40)
    if "description" in sent:
        fields["description"] = _clean(conn, body.description, "description", required=False, max_len=200)
    for k in ("icon", "color"):
        if k in sent:
            fields[k] = getattr(body, k) or None
    for k in ("sort_order", "reopen_days"):
        if k in sent and getattr(body, k) is not None:
            fields[k] = getattr(body, k)
    for k in ("active", "open_to_all"):
        if k in sent and getattr(body, k) is not None:
            fields[k] = 1 if getattr(body, k) else 0
    return fields


@router.post("/tickets/admin/departments", status_code=201)
def create_department(body: DepartmentBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    fields = _department_fields(conn, body, creating=True)
    if store.department_key_taken(conn, fields["key"]):
        raise ApiError(409, "department_key_taken", text(conn, "כבר קיימת מחלקה עם המזהה הזה."), details={"key": fields["key"]})
    dept_id = store.insert_department(conn, fields)
    first_manager = None
    if not viewer.holds_installation(access.ALL_DEPARTMENTS):
        # section 8: the creator who does not see every department becomes the first manager of the new one
        store.upsert_member(conn, dept_id, "user", principal.user_id, "manager", 1, principal.user_id)
        first_manager = principal.user_id
    audit(conn, actor=principal, action="ticket.department.create", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
          request_id=_rid(request), details={"key": fields["key"], "first_manager": first_manager})
    viewer = Viewer(conn, principal)
    return _department_dict(conn, viewer, store.department(conn, dept_id) or {})


def _dept_or_404(conn: sqlite3.Connection, dept_id: str) -> dict[str, Any]:
    d = store.department(conn, dept_id)
    if d is None:
        raise ApiError(404, "not_found", text(conn, "המחלקה לא נמצאה."))
    return d


@router.patch("/tickets/admin/departments/{dept_id}")
def patch_department(body: DepartmentBody, request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    d = _dept_or_404(conn, dept_id)
    if body.revision is None:
        raise _invalid(conn, "revision", "required")
    fields = _department_fields(conn, body, creating=False)
    if "key" in fields and store.department_key_taken(conn, fields["key"], except_id=dept_id):
        raise ApiError(409, "department_key_taken", text(conn, "כבר קיימת מחלקה עם המזהה הזה."), details={"key": fields["key"]})
    if not store.update_department(conn, dept_id, fields, body.revision):
        raise ApiError(409, "department_stale", text(conn, "המחלקה השתנתה בינתיים. טענו מחדש."), details={"revision": d["revision"]})
    changed = sorted(k for k in fields if d.get(k) != fields[k])
    audit(conn, actor=principal, action="ticket.department.update", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
          request_id=_rid(request), details={"fields": changed})
    return _department_dict(conn, viewer, store.department(conn, dept_id) or {})


@router.delete("/tickets/admin/departments/{dept_id}")
def delete_department(request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _configurer(conn, principal)
    _dept_or_404(conn, dept_id)
    open_n = store.open_ticket_count(conn, dept_id)
    if open_n:
        raise ApiError(409, "department_in_use", text(conn, "במחלקה יש {tickets} פתוחות. העבירו או סגרו אותן קודם."), details={"open_tickets": open_n})
    store.soft_delete_department(conn, dept_id)
    audit(conn, actor=principal, action="ticket.department.delete", decision="allowed", resource_type="ticket_department", resource_id=dept_id, request_id=_rid(request))
    return {"deleted": dept_id}


# ---------------------------------------------------------------- categories and priorities

class CategoryBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, max_length=200)
    parent_id: str | None = Field(default=None, pattern=ID)
    default_priority_id: str | None = Field(default=None, pattern=ID)
    sort_order: int | None = Field(default=None, ge=0, le=9999)
    active: bool | None = None


def _category_fields(conn: sqlite3.Connection, body: CategoryBody, dept_id: str, category_id: str | None, *, creating: bool) -> dict[str, Any]:
    sent = body.model_fields_set
    fields: dict[str, Any] = {}
    if creating or "name" in sent:
        fields["name"] = _clean(conn, body.name, "name", required=True, max_len=60)
    if "parent_id" in sent:
        if body.parent_id:
            parent = store.category(conn, body.parent_id)
            if parent is None or parent["department_id"] != dept_id or parent.get("parent_id") or parent["id"] == category_id:
                raise _invalid(conn, "parent_id", "unknown")  # one level only, inside the same department
        fields["parent_id"] = body.parent_id or None
    if "default_priority_id" in sent:
        if body.default_priority_id:
            p = store.priority(conn, body.default_priority_id)
            if p is None or p["department_id"] != dept_id:
                raise _invalid(conn, "default_priority_id", "unknown")
        fields["default_priority_id"] = body.default_priority_id or None
    if "sort_order" in sent and body.sort_order is not None:
        fields["sort_order"] = body.sort_order
    if "active" in sent and body.active is not None:
        fields["active"] = 1 if body.active else 0
    return fields


@router.post("/tickets/admin/departments/{dept_id}/categories", status_code=201)
def create_category(body: CategoryBody, request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    _dept_or_404(conn, dept_id)
    fields = _category_fields(conn, body, dept_id, None, creating=True)
    cid = store.insert_category(conn, dept_id, fields)
    audit(conn, actor=principal, action="ticket.category.create", decision="allowed", resource_type="ticket_category", resource_id=cid,
          request_id=_rid(request), details={"department_id": dept_id})
    return _department_dict(conn, viewer, store.department(conn, dept_id) or {})


def _category_or_404(conn: sqlite3.Connection, category_id: str) -> dict[str, Any]:
    c = store.category(conn, category_id)
    if c is None:
        raise ApiError(404, "not_found", text(conn, "הקטגוריה לא נמצאה."))
    return c


@router.patch("/tickets/admin/categories/{category_id}")
def patch_category(body: CategoryBody, request: Request, category_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    c = _category_or_404(conn, category_id)
    fields = _category_fields(conn, body, c["department_id"], category_id, creating=False)
    store.update_category(conn, category_id, fields)
    audit(conn, actor=principal, action="ticket.category.update", decision="allowed", resource_type="ticket_category", resource_id=category_id,
          request_id=_rid(request), details={"fields": sorted(fields)})
    return _department_dict(conn, viewer, store.department(conn, c["department_id"]) or {})


@router.delete("/tickets/admin/categories/{category_id}")
def delete_category(request: Request, category_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    c = _category_or_404(conn, category_id)
    store.soft_delete_category(conn, category_id)
    audit(conn, actor=principal, action="ticket.category.delete", decision="allowed", resource_type="ticket_category", resource_id=category_id, request_id=_rid(request))
    return _department_dict(conn, viewer, store.department(conn, c["department_id"]) or {})


class PriorityBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, max_length=200)
    notify_severity: Literal["info", "alert", "critical"] | None = None
    is_default: bool | None = None
    active: bool | None = None


@router.patch("/tickets/admin/priorities/{priority_id}")
def patch_priority(body: PriorityBody, request: Request, priority_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    p = store.priority(conn, priority_id)
    if p is None or store.department(conn, p["department_id"]) is None:
        raise ApiError(404, "not_found", text(conn, "העדיפות לא נמצאה."))
    sent = body.model_fields_set
    fields: dict[str, Any] = {}
    if "name" in sent:
        fields["name"] = _clean(conn, body.name, "name", required=True, max_len=30)
    if "notify_severity" in sent and body.notify_severity:
        fields["notify_severity"] = body.notify_severity
    if body.is_default:
        fields["is_default"] = 1
    if "active" in sent and body.active is not None:
        if not body.active and (p["is_default"] or body.is_default):
            raise ApiError(409, "priority_is_default", text(conn, "אי אפשר להשבית את עדיפות ברירת המחדל."))
        fields["active"] = 1 if body.active else 0
    if fields.get("is_default") and not p["active"] and fields.get("active") != 1:
        raise ApiError(409, "priority_inactive", text(conn, "עדיפות מושבתת אינה יכולה להיות ברירת המחדל."))
    store.update_priority(conn, priority_id, fields)
    audit(conn, actor=principal, action="ticket.priority.update", decision="allowed", resource_type="ticket_priority", resource_id=priority_id,
          request_id=_rid(request), details={"fields": sorted(fields)})
    return _department_dict(conn, viewer, store.department(conn, p["department_id"]) or {})


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
    if concerns_me and role == "manager" and viewer.role(dept_id) != "manager":
        raise deny("self_escalation")  # nobody makes themself a manager of a department they do not already manage


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
          details={"subject_kind": kind, "subject_id": subject_id, "role": body.role, "before": before["member_role"] if before else None})
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
    audit(conn, actor=principal, action="ticket.member.remove", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
          request_id=_rid(request), details={"subject_kind": kind, "subject_id": subject_id, "role": before["member_role"]})
    return _department_dict(conn, Viewer(conn, principal), store.department(conn, dept_id) or {})


# ---------------------------------------------------------------- pickers and the permissions overview (section 8.2)

@router.get("/tickets/admin/directory")
def directory(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
              q: str = Query("", max_length=60)) -> dict[str, Any]:
    """The people and groups a department's member list may name - names only (the member editor's picker)."""
    _configurer(conn, principal)
    needle = model.clean_text(q).casefold()
    users = [{"id": uid, "name": store.display_name(conn, uid)} for uid in store.active_user_ids(conn)]
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
    for b in store.active_bindings(conn, now_iso()):
        perms = [p for p in role_permissions(conn, b["role_id"]) if p in access.TICKET_PERMISSIONS]
        if not perms:
            continue
        via = "grant" if b["role_id"] in GRANT_ROLES and b["subject_kind"] == "user" else "group" if b["subject_kind"] == "group" else "role"
        targets = [b["subject_id"]] if b["subject_kind"] == "user" else store.group_member_ids(conn, b["subject_id"])
        for uid in targets:
            entry = people.setdefault(uid, {"id": uid, "name": store.display_name(conn, uid), "active": store.user_is_active(conn, uid), "grants": []})
            entry["grants"].append({
                "binding_id": b["id"], "permissions": perms, "via": via, "role_id": b["role_id"], "role_name": role_name(conn, b["role_id"]),
                "group_name": store.group_name(conn, b["subject_id"]) if b["subject_kind"] == "group" else None,
                "scope_type": b["scope_type"], "scope_id": b["scope_id"], "scope_name": scope_name(conn, b["scope_type"], b["scope_id"]),
                "effect": b["effect"], "expires_at": b["expires_at"],
            })
    return {"users": sorted(people.values(), key=lambda u: u["name"]), "grant_roles": [r for r in GRANT_ROLES if r in ROLES]}
