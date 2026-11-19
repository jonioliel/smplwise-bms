"""The tickets settings API: a department's categories, the priorities, the SLA matrix and the ticket templates.

CR-SPLIT-TICKETS-ADMIN-2440 (review 05:P2-08): moved unchanged out of routers/tickets_admin.py, which still exports every name."""
from __future__ import annotations

import json
import sqlite3
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt

from ..audit import audit
from ..auth import current_principal, get_conn
from ..errors import ApiError
from ..rbac import Principal
from ..services.tickets import model, sla, store, templates
from ..services.tickets.access import text
from ._common import rid as _rid
from ._tickets_common import invalid, invalid_fields
from .tickets import ID, module_gate
from .tickets_admin_base import DOMAIN, _clean, _configurer
from .tickets_admin_departments import _department_dict, _dept_or_404

router = APIRouter(dependencies=[Depends(module_gate)])


# ---------------------------------------------------------------- categories and priorities

class CategoryBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, max_length=200)
    parent_id: str | None = Field(default=None, pattern=ID)
    default_priority_id: str | None = Field(default=None, pattern=ID)
    sort_order: int | None = Field(default=None, ge=0, le=9999)
    active: bool | None = None
    # slice 2: device domains / types that preselect this category from a device (slice 3 reads them), e.g. ["climate", "fan"]
    domains: list[Annotated[str, Field(pattern=DOMAIN)]] | None = Field(default=None, max_length=20)


def _category_fields(conn: sqlite3.Connection, body: CategoryBody, dept_id: str, category_id: str | None, *, creating: bool) -> dict[str, Any]:
    sent = body.model_fields_set
    fields: dict[str, Any] = {}
    if creating or "name" in sent:
        fields["name"] = _clean(conn, body.name, "name", required=True, max_len=60)
    if "parent_id" in sent:
        if body.parent_id:
            parent = store.category(conn, body.parent_id)
            if parent is None or parent["department_id"] != dept_id or parent.get("parent_id") or parent["id"] == category_id:
                raise invalid(conn, "parent_id", "unknown")  # one level only, inside the same department
        fields["parent_id"] = body.parent_id or None
    if "default_priority_id" in sent:
        if body.default_priority_id:
            p = store.priority(conn, body.default_priority_id)
            if p is None or p["department_id"] != dept_id:
                raise invalid(conn, "default_priority_id", "unknown")
        fields["default_priority_id"] = body.default_priority_id or None
    if "sort_order" in sent and body.sort_order is not None:
        fields["sort_order"] = body.sort_order
    if "active" in sent and body.active is not None:
        fields["active"] = 1 if body.active else 0
    if "domains" in sent:
        fields["domains_json"] = json.dumps(sorted(set(body.domains or [])), separators=(",", ":"))
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


# ---------------------------------------------------------------- the SLA matrix (slice 2: every threshold per department x priority, 13.1 / D11)

class SlaRowBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    priority_id: str = Field(pattern=ID)
    revision: int = Field(ge=0)
    unassigned_after_min: StrictInt | None = None
    link_unopened_min: StrictInt | None = None
    ack_within_min: StrictInt | None = None
    stuck_after_min: StrictInt | None = None
    stuck_waiting_min: StrictInt | None = None
    resolve_within_min: StrictInt | None = None
    remind_every_min: StrictInt | None = None
    max_reminders: StrictInt | None = None
    manager_alert_after_steps: StrictInt | None = None


class SlaBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rows: list[SlaRowBody] = Field(min_length=1, max_length=8)


@router.put("/tickets/admin/departments/{dept_id}/sla")
def put_sla(body: SlaBody, request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
            conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Save rows of the department's SLA grid. Only the fields SENT change (an explicit null turns a threshold off). All rows are
    checked first - priority, values, revision - and nothing is written unless every row passes (409 `sla_stale` names the rows
    whose revision moved). Open tickets of a changed priority get their dues recomputed at once."""
    viewer = _configurer(conn, principal)
    _dept_or_404(conn, dept_id)
    prios = {p["id"]: p for p in store.priorities(conn, dept_id)}
    plans: list[tuple[dict[str, Any], dict[str, Any] | None, dict[str, Any], int]] = []
    problems: list[dict[str, str]] = []
    stale_rows: list[str] = []
    seen_ids: set[str] = set()
    for i, row in enumerate(body.rows):
        p = prios.get(row.priority_id)
        if p is None or row.priority_id in seen_ids:
            problems.append({"field": f"rows.{i}.priority_id", "code": "unknown"})
            continue
        seen_ids.add(row.priority_id)
        sent = {k: getattr(row, k) for k in row.model_fields_set - {"priority_id", "revision"}}
        try:
            clean = sla.validate_rule(sent)
        except model.Invalid as exc:
            problems.extend({"field": f"rows.{i}.{pr.field}", "code": pr.code} for pr in exc.problems)
            continue
        current = store.sla_rule(conn, dept_id, row.priority_id)
        if (current["revision"] if current else 0) != row.revision:
            stale_rows.append(row.priority_id)
            continue
        plans.append((p, current, clean, row.revision))
    if problems:
        raise invalid_fields(conn, problems)
    if stale_rows:
        raise ApiError(409, "sla_stale", text(conn, "הספים השתנו בינתיים. טענו מחדש."), details={"priority_ids": stale_rows})
    for p, current, clean, revision in plans:
        changes = {k: [(current or {}).get(k), v] for k, v in clean.items() if (current or {}).get(k) != v}
        if not changes and current is not None:
            continue
        if not store.write_sla_rule(conn, dept_id, p["id"], clean, revision, principal.user_id):
            raise ApiError(409, "sla_stale", text(conn, "הספים השתנו בינתיים. טענו מחדש."), details={"priority_ids": [p["id"]]})
        sla.refresh_many(conn, store.open_ticket_ids(conn, dept_id, priority_id=p["id"]))
        audit(conn, actor=principal, action="ticket.sla.update", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
              request_id=_rid(request), details={"priority_id": p["id"], "priority_key": p["key"], "changes": changes})
    return _department_dict(conn, viewer, store.department(conn, dept_id) or {})


# ---------------------------------------------------------------- ticket templates (slice 2; message templates are slice 5b's)

class TemplateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["ticket", "message"] | None = None
    name: str | None = Field(default=None, max_length=200)
    title: str | None = Field(default=None, max_length=1000)
    body: str | None = Field(default=None, max_length=20000)
    category_id: str | None = Field(default=None, pattern=ID)
    priority_key: str | None = Field(default=None, max_length=20)
    active: StrictBool | None = None
    revision: int | None = Field(default=None, ge=1)


def _template_fields(conn: sqlite3.Connection, body: TemplateBody, dept_id: str, *, creating: bool) -> dict[str, Any]:
    if (body.kind or "ticket") not in templates.KINDS_BUILT:
        raise invalid(conn, "kind", "not_supported")  # message templates arrive with the message channel (slice 5b)
    sent = {k: getattr(body, k) for k in body.model_fields_set - {"kind", "revision"}}
    try:
        fields = templates.validate_ticket(sent, creating=creating)
    except model.Invalid as exc:
        raise invalid_fields(conn, [{"field": p.field, "code": p.code} for p in exc.problems]) from None
    if fields.get("category_id"):
        cat = store.category(conn, fields["category_id"])
        if cat is None or cat["department_id"] != dept_id:
            raise invalid(conn, "category_id", "unknown")
    return fields


def _template_or_404(conn: sqlite3.Connection, template_id: str) -> dict[str, Any]:
    t = store.template(conn, template_id)
    if t is None or t["department_id"] is None or store.department(conn, t["department_id"]) is None:
        raise ApiError(404, "not_found", text(conn, "התבנית לא נמצאה."))
    return t


@router.post("/tickets/admin/departments/{dept_id}/templates", status_code=201)
def create_template(body: TemplateBody, request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    _dept_or_404(conn, dept_id)
    fields = _template_fields(conn, body, dept_id, creating=True)
    if len(store.templates(conn, dept_id, kind="ticket")) >= 50:
        raise ApiError(409, "too_many_templates", text(conn, "הגעתם למספר התבניות המרבי למחלקה."), details={"max": 50})
    tid = store.insert_template(conn, dept_id, "ticket", fields, principal.user_id)
    audit(conn, actor=principal, action="ticket.template.create", decision="allowed", resource_type="ticket_template", resource_id=tid,
          request_id=_rid(request), details={"department_id": dept_id, "kind": "ticket", "diff": templates.text_diff(None, store.template(conn, tid))})
    return _department_dict(conn, viewer, store.department(conn, dept_id) or {})


@router.patch("/tickets/admin/templates/{template_id}")
def patch_template(body: TemplateBody, request: Request, template_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    before = _template_or_404(conn, template_id)
    if body.revision is None:
        raise invalid(conn, "revision", "required")
    if body.kind is not None and body.kind != before["kind"]:
        raise invalid(conn, "kind", "immutable")
    fields = _template_fields(conn, body, before["department_id"], creating=False)
    if not store.update_template(conn, template_id, fields, body.revision, principal.user_id):
        raise ApiError(409, "template_stale", text(conn, "התבנית השתנתה בינתיים. טענו מחדש."), details={"revision": before["revision"]})
    after = store.template(conn, template_id)
    changed = sorted(k for k in fields if before.get(k) != fields[k])
    audit(conn, actor=principal, action="ticket.template.update", decision="allowed", resource_type="ticket_template", resource_id=template_id,
          request_id=_rid(request), details={"department_id": before["department_id"], "kind": before["kind"], "fields": changed,
                                             "diff": templates.text_diff(before, after)})
    return _department_dict(conn, viewer, store.department(conn, before["department_id"]) or {})


@router.delete("/tickets/admin/templates/{template_id}")
def delete_template(request: Request, template_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    before = _template_or_404(conn, template_id)
    store.soft_delete_template(conn, template_id, principal.user_id)
    audit(conn, actor=principal, action="ticket.template.delete", decision="allowed", resource_type="ticket_template", resource_id=template_id,
          request_id=_rid(request), details={"department_id": before["department_id"], "kind": before["kind"], "diff": templates.text_diff(before, None)})
    return _department_dict(conn, viewer, store.department(conn, before["department_id"]) or {})
