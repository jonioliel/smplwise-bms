"""The tickets settings API: departments (`tickets.configure`) - list, create, patch, delete, restore.

CR-SPLIT-TICKETS-ADMIN-2440 (review 05:P2-08): moved unchanged out of routers/tickets_admin.py, which still exports every name."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import Principal
from ..services.tickets import access, policy, settings_doc, sla, store, templates
from ..services.tickets.access import Viewer, text
from ._common import rid as _rid
from ._tickets_common import invalid
from .tickets import ID, module_gate
from .tickets_admin_base import COLOR, ICON, KEY, _clean, _configurer
from .tickets_admin_settings import HoursBody

router = APIRouter(dependencies=[Depends(module_gate)])


# ---------------------------------------------------------------- departments

def _member_dicts(conn: sqlite3.Connection, dept_id: str) -> list[dict[str, Any]]:
    from ..services.tickets import staff_links

    out = []
    for m in store.members(conn, dept_id):
        name = store.display_name(conn, m["subject_id"]) if m["subject_kind"] == "user" else store.group_name(conn, m["subject_id"])
        item = {"kind": m["subject_kind"], "id": m["subject_id"], "name": name, "role": m["member_role"], "notify_new": bool(m["notify_new"]),
                "added_at": m["added_at"]}
        if m["subject_kind"] == "user":  # TKSTAFF1: the mobile for the no-login staff link (a tickets.configure screen: the full number)
            sv = staff_links.view(conn, m["subject_id"])
            item.update({"mobile": sv["phone"], "mobile_confirmed": sv["confirmed"], "notify_whatsapp": sv["notify_whatsapp"], "lang": sv["lang"],
                         # TKNOTIFOTP: the directory row, its "verify with a code" switch, whether a code is required, the manager-mark token
                         "contact_id": sv["contact_id"], "phone_verify": sv["phone_verify"], "verify_required": sv["verify_required"],
                         "mobile_confirm": sv["confirm"]})
        out.append(item)
    return out


def domains_of(c: dict[str, Any]) -> list[str]:
    try:
        raw = json.loads(c.get("domains_json") or "[]")
    except ValueError:
        return []
    return [x for x in raw if isinstance(x, str)] if isinstance(raw, list) else []


def _department_dict(conn: sqlite3.Connection, viewer: Viewer, d: dict[str, Any], installation: dict[str, Any] | None = None) -> dict[str, Any]:
    inst = installation if installation is not None else settings_doc.read(conn)
    return {
        "id": d["id"], "key": d["key"], "name": d["name"], "description": d["description"], "icon": d.get("icon"), "color": d.get("color"),
        "sort_order": d["sort_order"], "active": bool(d["active"]), "open_to_all": bool(d["open_to_all"]), "reopen_days": d["reopen_days"],
        "revision": d["revision"], "open_tickets": store.open_ticket_count(conn, d["id"]),
        "categories": [{"id": c["id"], "name": c["name"], "parent_id": c.get("parent_id"), "default_priority_id": c.get("default_priority_id"),
                        "domains": domains_of(c), "sort_order": c["sort_order"], "active": bool(c["active"])} for c in store.categories(conn, d["id"])],
        "priorities": [{"id": p["id"], "key": p["key"], "name": p["name"], "rank": p["rank"], "severity": p["notify_severity"],
                        "is_default": bool(p["is_default"]), "active": bool(p["active"])} for p in store.priorities(conn, d["id"])],
        "members": _member_dicts(conn, d["id"]),
        "can_edit_members": _may_edit_members(viewer, d["id"]),
        # slice 2: the department's policy (its own overrides, NULL = the installation value) and what is in force
        "auto_close_after_days": d.get("auto_close_after_days"),
        "share_history_external": bool(d.get("share_history_external")),
        "overrides": policy.overrides_of(d),
        "effective": policy.resolve(inst, d).as_dict(),
        "sla": store.sla_rules(conn, d["id"]),
        "templates": [templates.as_dict(t) for t in store.templates(conn, d["id"], kind="ticket")],
    }


def _installation_defaults(inst: dict[str, Any]) -> dict[str, Any]:
    return {"links": dict(inst["links"]), "send_hours": dict(inst["send_hours"]), "urgent_is_critical": inst["urgent_is_critical"]}


def _may_edit_members(viewer: Viewer, dept_id: str) -> bool:
    return viewer.role(dept_id) == "manager" or viewer.holds_installation(access.ALL_DEPARTMENTS)


@router.get("/tickets/admin/departments")
def list_departments(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    inst = settings_doc.read(conn)
    return {"departments": [_department_dict(conn, viewer, d, inst) for d in store.departments(conn)],
            "all_departments": viewer.holds_installation(access.ALL_DEPARTMENTS),
            "installation": _installation_defaults(inst),
            # owner 2026-10-14: the soft-deleted departments, for "מחלקות שנמחקו" and its restore action
            "deleted": [{"id": d["id"], "name": d["name"], "deleted_at": d["deleted_at"], "tickets": store.ticket_count(conn, d["id"])}
                        for d in store.deleted_departments(conn)]}


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
    # slice 2 - the department's policy; an explicit null clears an override (back to the installation value / two-step close)
    auto_close_after_days: StrictInt | None = None
    share_history_external: StrictBool | None = None
    urgent_is_critical: StrictBool | None = None
    link_sliding_days: StrictInt | None = None
    link_cap_days: StrictInt | None = None
    link_grace_hours: StrictInt | None = None
    send_hours: HoursBody | None = None


POLICY_FIELDS = ("auto_close_after_days", "share_history_external", "urgent_is_critical", "link_sliding_days", "link_cap_days",
                 "link_grace_hours", "send_hours_json")


def _policy_fields(conn: sqlite3.Connection, body: DepartmentBody, sent: set[str], current: dict[str, Any] | None) -> dict[str, Any]:
    """The policy columns of a department write, validated with the installation ranges (policy._valid) and the cross-key rule
    against the values that will be in force (an override, or the installation value it falls back to)."""
    fields: dict[str, Any] = {}
    if "auto_close_after_days" in sent:
        v = body.auto_close_after_days
        if v is not None and not policy.AUTO_CLOSE_DAYS[0] <= v <= policy.AUTO_CLOSE_DAYS[1]:
            raise invalid(conn, "auto_close_after_days", "range")
        fields["auto_close_after_days"] = v
    if "share_history_external" in sent:
        if body.share_history_external is None:
            raise invalid(conn, "share_history_external", "required")
        fields["share_history_external"] = 1 if body.share_history_external else 0
    if "urgent_is_critical" in sent:
        fields["urgent_is_critical"] = None if body.urgent_is_critical is None else (1 if body.urgent_is_critical else 0)
    for key in ("link_sliding_days", "link_cap_days", "link_grace_hours"):
        if key in sent:
            v = getattr(body, key)
            if v is not None:
                try:
                    policy._valid(key, v)
                except ValueError as exc:
                    raise invalid(conn, key, str(exc)) from None
            fields[key] = v
    if "send_hours" in sent:
        if body.send_hours is None:
            fields["send_hours_json"] = None
        else:
            try:
                window = settings_doc.send_hours(body.send_hours.window())
            except ValueError as exc:
                raise invalid(conn, "send_hours", str(exc)) from None
            fields["send_hours_json"] = json.dumps(window, separators=(",", ":"))
    if {"link_sliding_days", "link_cap_days"} & set(fields):
        inst = settings_doc.read(conn)["links"]
        merged = {**(current or {}), **fields}
        sliding = merged.get("link_sliding_days") or inst["sliding_days"]
        cap = merged.get("link_cap_days") or inst["cap_days"]
        if cap < sliding:
            raise invalid(conn, "link_cap_days", "below_sliding")
    return fields


def _department_fields(conn: sqlite3.Connection, body: DepartmentBody, *, creating: bool, current: dict[str, Any] | None = None) -> dict[str, Any]:
    sent = body.model_fields_set - {"revision"}
    fields: dict[str, Any] = {}
    # owner 2026-10-14: the new-department form asks for a name only - a missing key is made from the name (create_department)
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
    fields.update(_policy_fields(conn, body, sent, current))
    return fields


# owner 2026-10-14: the department's identifier is made from its name (the form no longer asks for it). Hebrew is transliterated, then
# slugged to KEY; a name that leaves nothing usable gets "dept-" + 6 hex; a taken key gets "-2", "-3", ... (unique among live rows).
_HEB = {"א": "a", "ב": "b", "ג": "g", "ד": "d", "ה": "h", "ו": "v", "ז": "z", "ח": "ch", "ט": "t", "י": "y", "כ": "k", "ך": "k", "ל": "l",
        "מ": "m", "ם": "m", "נ": "n", "ן": "n", "ס": "s", "ע": "a", "פ": "p", "ף": "p", "צ": "tz", "ץ": "tz", "ק": "k", "ר": "r", "ש": "sh",
        "ת": "t"}


def slug_key(name: str) -> str:
    """A KEY-shaped slug of a name ('' when nothing usable is left)."""
    import re
    import unicodedata

    s = "".join(_HEB.get(ch, ch) for ch in (name or "").strip().lower())
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    s = re.sub(r"^[^a-z]+", "", s)[:28].strip("-")
    return s if re.fullmatch(KEY, s) else ""


def department_key_for(conn: sqlite3.Connection, name: str, *, except_id: str | None = None) -> str:
    import secrets

    base = slug_key(name) or f"dept-{secrets.token_hex(3)}"
    key, n = base, 2
    while store.department_key_taken(conn, key, except_id=except_id):
        key, n = f"{base[:28]}-{n}", n + 1
    return key


@router.post("/tickets/admin/departments", status_code=201)
def create_department(body: DepartmentBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    fields = _department_fields(conn, body, creating=True)
    if not fields.get("key"):
        fields["key"] = department_key_for(conn, fields["name"])
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
        raise invalid(conn, "revision", "required")
    fields = _department_fields(conn, body, creating=False, current=d)
    if "key" in fields and store.department_key_taken(conn, fields["key"], except_id=dept_id):
        raise ApiError(409, "department_key_taken", text(conn, "כבר קיימת מחלקה עם המזהה הזה."), details={"key": fields["key"]})
    if not store.update_department(conn, dept_id, fields, body.revision):
        raise ApiError(409, "department_stale", text(conn, "המחלקה השתנתה בינתיים. טענו מחדש."), details={"revision": d["revision"]})
    changed = sorted(k for k in fields if d.get(k) != fields[k])
    # policy values are configuration (numbers, flags, a time window): the audit row carries them before / after; texts never
    values = {k: [d.get(k), fields[k]] for k in changed if k in POLICY_FIELDS}
    if "auto_close_after_days" in changed:
        sla.refresh_many(conn, store.open_ticket_ids(conn, dept_id, status="done"))  # D10: the close time of waiting "done" tickets moves
    pulled = 0
    if {"link_cap_days", "link_sliding_days"} & set(changed):  # D5 (slice 4): a LOWER effective cap pulls the department's live links in
        from ..services.tickets import handler_links

        pulled = handler_links.pull_in_caps(conn, department_id=dept_id)
    audit(conn, actor=principal, action="ticket.department.update", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
          request_id=_rid(request), details={"fields": changed, **({"policy": values} if values else {}), **({"links_capped": pulled} if pulled else {})})
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


class RestoreBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str | None = Field(default=None, pattern=KEY)


@router.post("/tickets/admin/departments/{dept_id}/restore")
def restore_department(request: Request, body: RestoreBody | None = None, dept_id: str = Path(..., pattern=ID),
                       principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Owner request 2026-10-14 (his only department was deleted by mistake): a soft-deleted department comes back as it was - the
    delete only marked the department row, so its categories, priorities, members, SLA rules, templates and tickets were never
    touched and are in force again. Its identifier must be free among live departments: an explicit `key` that is taken answers 409;
    without one, a taken identifier is replaced by a free one made from the name (the form no longer shows identifiers)."""
    viewer = _configurer(conn, principal)
    d = store.department_any(conn, dept_id)
    if d is None or not d.get("deleted_at"):
        raise ApiError(404, "not_found", text(conn, "המחלקה לא נמצאה."))
    key = (body.key if body else None) or d["key"]
    if store.department_key_taken(conn, key, except_id=dept_id):
        if body and body.key:
            raise ApiError(409, "department_key_taken", text(conn, "כבר קיימת מחלקה עם המזהה הזה."), details={"key": key})
        key = department_key_for(conn, d["name"], except_id=dept_id)
    store.restore_department(conn, dept_id, key)
    audit(conn, actor=principal, action="ticket.department.restore", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
          request_id=_rid(request), details={"key": key, "key_changed": key != d["key"]})
    out = _department_dict(conn, viewer, store.department(conn, dept_id) or {})
    out["key_changed"] = key != d["key"]
    return out
