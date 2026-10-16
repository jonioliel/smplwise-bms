"""CR-038 section 18: `create_ticket()` - the ONE code path every ticket is created by (manual creation in slice 1, device creation
in slice 3, and phase 2's rule action). A rule or an automation (phase 2) adds an actor of its own and `dedupe_key`
"rule:<rule id>:<entity|camera>": an OPEN ticket with the same key absorbs the repeat (a timeline row) instead of a new ticket.

Slice 1 created placeless manual tickets; slice 3 adds `entity_id` (a device's ticket, origin 'device'): the creator must be able to read
the device (device_context.readable_entity - else 422 entity_id unknown, so a hidden device does not leak), the place is resolved
server-side (place.locate_entity; tickets.create is then needed WHERE the ticket lies) and the 24 h history is captured as the creator
and frozen (device_context, section 12.3)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from ...audit import audit
from ...db import new_id, now_iso
from ...errors import ApiError
from . import access, assignees, device_context, model, notify_bridge, org_locations, place, service, sla, store
from .access import Viewer, text

PLACE_OTHER_MAX = 200  # CR-ORG-LOCATIONS: the free-text place of a manual request (the RFQ's PLACE_MAX)
AssigneeRef = assignees.AssigneeRef  # TKSTAFF2: the module's one assignee reference (kind 'user' | 'contact', id)


@dataclass(frozen=True)
class TicketSpec:
    department_id: str
    title: str
    description: str = ""
    category_id: str | None = None
    priority_id: str | None = None
    priority_key: str | None = None
    entity_id: str | None = None  # slice 3: a device's ticket
    origin: Literal["manual", "device", "rule", "inbound"] = "manual"
    rule_ref: str | None = None
    dedupe_key: str | None = None
    assign_to: AssigneeRef | None = None
    assign_note: str = ""
    assign_note_external: bool = True
    location_id: str | None = None  # CR-ORG-LOCATIONS: an organisation location (reference + snapshot at creation)
    place_other: str = ""  # CR-ORG-LOCATIONS: "other (free text)" - the old free-text place


@dataclass(frozen=True)
class CreateResult:
    kind: Literal["created", "absorbed"]
    ticket_id: str
    number: int


def create_ticket(conn, spec: TicketSpec, viewer: Viewer, *, rid: str | None = None) -> CreateResult:
    """Validate and create one ticket as `viewer` (a signed-in person in slice 1). Raises ApiError (403 audited, 422 field problems)."""
    dept = store.department(conn, spec.department_id) if spec.department_id else None
    if dept is None or not dept["active"]:
        raise service.invalid(conn, model.Invalid([model.Problem("department_id", "unknown")]))
    if not viewer.can_create_in(dept):
        audit(conn, actor=viewer.principal, action="ticket.create", decision="denied", resource_type="ticket_department", resource_id=dept["id"],
              reason="create_not_allowed", request_id=rid)
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפתוח {tickets} במחלקה הזו."), details={"permission": access.CREATE, "department_id": dept["id"]})
    if spec.origin not in ("manual", "rule", "inbound", "device"):
        raise service.invalid(conn, model.Invalid([model.Problem("origin", "unknown")]))
    # slice 3: a device's ticket - the creator must be able to read the device (an entity they cannot see is "unknown", never "forbidden",
    # so its existence does not leak); the place is resolved here (the client never sends one) and the ticket lies there for RBAC
    entity = None
    where = place.Place()
    if spec.entity_id:
        entity = device_context.readable_entity(conn, viewer.principal, spec.entity_id)
        if entity is None:
            raise service.invalid(conn, model.Invalid([model.Problem("entity_id", "unknown")]))
        where = place.locate_entity(conn, spec.entity_id, entity)
        placed = where.columns()
        if not viewer.holds(access.CREATE, placed):
            audit(conn, actor=viewer.principal, action="ticket.create", decision="denied", resource_type="ticket_department", resource_id=dept["id"],
                  reason="create_not_allowed_here", request_id=rid)
            raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפתוח {tickets} במחלקה הזו."), details={"permission": access.CREATE, "department_id": dept["id"]})
    try:
        title = model.text_field(spec.title, "title", required=True, max_len=model.TITLE_MAX)
        description = model.text_field(spec.description, "description", required=False, max_len=model.DESCRIPTION_MAX, multiline=True)
        assign_note = model.text_field(spec.assign_note, "assign_note", required=False, max_len=model.NOTE_MAX, multiline=True)
        place_other = model.text_field(spec.place_other, "place_text", required=False, max_len=PLACE_OTHER_MAX)
    except model.Invalid as exc:
        raise service.invalid(conn, exc) from None
    location: dict[str, Any] = {}
    if spec.location_id:
        try:
            lid, snap = org_locations.resolve(conn, spec.location_id)
        except org_locations.Invalid as exc:
            raise service.invalid(conn, model.Invalid([model.Problem(exc.field, exc.code)])) from None
        location = {"location_id": lid, "location_snapshot": snap}
    category = None
    if spec.category_id:
        category = store.category(conn, spec.category_id)
        if category is None or category["department_id"] != dept["id"] or not category["active"]:
            raise service.invalid(conn, model.Invalid([model.Problem("category_id", "unknown")]))
    priority = None
    if spec.priority_id:
        priority = store.priority(conn, spec.priority_id)
    elif spec.priority_key:
        priority = store.priority_by_key(conn, dept["id"], spec.priority_key)
    elif category and category.get("default_priority_id"):
        priority = store.priority(conn, category["default_priority_id"])
    else:
        priority = store.default_priority(conn, dept["id"])
    if priority is None or priority["department_id"] != dept["id"] or not priority["active"]:
        raise service.invalid(conn, model.Invalid([model.Problem("priority_id", "unknown")]))
    if spec.assign_to is not None:
        # everything the assignment needs is checked BEFORE anything is written: an API error commits the request's transaction
        # (the audit row of a refusal survives), so a refused assignment must not leave a half-made ticket behind
        # a placed (device) ticket: the manager must hold view and manage WHERE it lies, or the assignment below would fail after the write
        placed_ok = entity is None or (viewer.holds(access.VIEW, where.columns()) and viewer.holds(access.MANAGE, where.columns()))
        if not viewer.manages_department(dept["id"]) or access.VIEW not in viewer.anywhere or not placed_ok:
            audit(conn, actor=viewer.principal, action="ticket.assign", decision="denied", resource_type="ticket_department", resource_id=dept["id"],
                  reason="not_manager", request_id=rid)
            raise ApiError(403, "forbidden", text(conn, "רק מנהל המחלקה מעביר {tickets} לטיפול."), details={"reason": "not_manager"})
        # TKSTAFF2: one assignee abstraction - an account holder or a staff contact without an account (services/tickets/assignees.py);
        # an outside contact stays refused here (it is sent from the ticket's assign dialog)
        if spec.assign_to.kind not in assignees.KINDS:
            raise ApiError(409, "assignee_not_allowed", text(conn, "אי אפשר להעביר את {the_ticket} למשתמש הזה (הוא אינו חבר במחלקה או אינו רשאי לצפות ב{tickets})."))
        assignees.check_new(conn, viewer, dept, assignees.AssigneeRef(spec.assign_to.kind, spec.assign_to.id))
    if spec.dedupe_key:
        existing = access.visible_open_by_dedupe_key(viewer, spec.dedupe_key)
        if existing is not None:
            store.insert_event(conn, existing.row["id"], "note", actor_kind="system", actor_name="", data={"absorbed": True, "rule_ref": spec.rule_ref})
            store.update_ticket(conn, existing.row["id"], {"last_activity_at": now_iso()}, bump=False)
            return CreateResult("absorbed", existing.row["id"], existing.row["number"])
    now = now_iso()
    ticket_id = new_id()
    number = store.next_number(conn)
    waiting_on, waiting_reason = model.waiting_for("new")
    device: dict[str, Any] = {}
    if entity is not None:
        device = {"entity_id": entity["entity_id"], "registry_id": entity.get("registry_id") or None,
                  "device_name": model.clean_text(entity.get("name") or entity.get("original_name") or entity["entity_id"])[:200], **where.columns()}
    store.insert_ticket(conn, {
        "id": ticket_id, "number": number, "department_id": dept["id"], "category_id": category["id"] if category else None,
        "priority_id": priority["id"], "title": title, "description": description, "status": "new", "origin": spec.origin,
        "place_text": place_other, "created_by": viewer.uid, "created_by_name": service.actor_name(viewer), "last_activity_at": now,
        "waiting_on": waiting_on, "waiting_reason": waiting_reason, "rule_ref": spec.rule_ref, "dedupe_key": spec.dedupe_key,
        "revision": 1, "created_at": now, "updated_at": now, **device, **location,
    })
    if entity is not None and not where.place_text and place_other:
        store.update_ticket(conn, ticket_id, {"place_text": place_other}, bump=False)
    store.insert_event(conn, ticket_id, "created", actor_kind="user", actor_user_id=viewer.uid, actor_name=service.actor_name(viewer),
                       to_status="new", data={"origin": spec.origin}, at=now)
    details: dict[str, Any] = {"number": number, "department_id": dept["id"], "origin": spec.origin}
    if entity is not None:
        # section 12.3: the 24 h history, as the creator may read it, frozen with the ticket (person names removed)
        snap = device_context.capture(conn, viewer.principal, entity["entity_id"], connected=device_context.ha_connected())
        device_context.freeze(conn, ticket_id, snap)
        store.insert_event(conn, ticket_id, "device_context", actor_kind="system", actor_name="", at=now,
                           data={"source": snap["source"], "count": len(snap["items"]), "truncated": bool(snap["truncated"]), "withheld": snap["withheld"]})
        details.update(entity_id=entity["entity_id"], floor_id=where.floor_id, history=snap["source"], history_items=len(snap["items"]))
    if location:
        details["location_id"] = location["location_id"]
    audit(conn, actor=viewer.principal, action="ticket.create", decision="allowed", resource_type="ticket", resource_id=ticket_id, request_id=rid,
          details=details)
    sla.refresh(conn, ticket_id)  # slice 2: the dues of the new ticket (section 13.1)
    notify_bridge.ticket_created(conn, ticket_id)
    if spec.assign_to is not None:
        seen = access.require_visible(viewer, ticket_id)  # checked above: the manager holds tickets.view and the ticket is placeless
        service.assign(conn, viewer, seen, spec.assign_to.kind, spec.assign_to.id, assign_note, spec.assign_note_external, seen.row["revision"], rid)
    return CreateResult("created", ticket_id, number)
