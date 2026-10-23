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


def _category_priority(conn, dept: dict[str, Any], spec: TicketSpec) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    """The category (optional, of the department, active) and the priority (explicit id / key, else the category's, else the
    department's default) of a new ticket - the same rule for a person and for a rule. Raises the 422 of the field."""
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
    return category, priority


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
    category, priority = _category_priority(conn, dept, spec)
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
    _partner_hook(conn, ticket_id)
    if spec.assign_to is not None:
        seen = access.require_visible(viewer, ticket_id)  # checked above: the manager holds tickets.view and the ticket is placeless
        service.assign(conn, viewer, seen, spec.assign_to.kind, spec.assign_to.id, assign_note, spec.assign_note_external, seen.row["revision"], rid)
    return CreateResult("created", ticket_id, number)


# ---------------------------------------------------------------- CR-038 phase 2 (TKRULES-291): the system author

SYSTEM_AUTHOR = "system"  # `tickets.created_by` of a rule ticket: never a user id, so nobody gains the "creator" reason of access.visible
SYSTEM_NAME = "מערכת"


def create_by_rule(conn, spec: TicketSpec, *, source_note: str, absorb_note: str, data: dict[str, Any] | None = None) -> CreateResult:
    """The system branch of the one creation path (phase 2, docs/changes/CR-038-TKRULES-NOTES.md): a rule of the installation opens a
    PLACELESS, UNASSIGNED ticket in its department. Same department / category / priority / text rules as a person's ticket; the author
    is the system (created_by "system", timeline actor `system`, audit actor None with origin `rule`); no device history is captured and
    nothing is assigned or sent. An OPEN ticket with the same `dedupe_key` absorbs the repeat (a system note `absorb_note`).
    `source_note` (the alert the ticket came from) is the first internal note. Raises ApiError 422 like the person path."""
    if spec.origin != "rule" or not spec.dedupe_key or not spec.rule_ref or spec.assign_to is not None or spec.entity_id or spec.location_id:
        raise ValueError("a rule ticket is placeless and unassigned and carries its rule and its key")
    dept = store.department(conn, spec.department_id) if spec.department_id else None
    if dept is None or not dept["active"]:
        raise service.invalid(conn, model.Invalid([model.Problem("department_id", "unknown")]))
    try:
        title = model.text_field(spec.title, "title", required=True, max_len=model.TITLE_MAX)
        description = model.text_field(spec.description, "description", required=False, max_len=model.DESCRIPTION_MAX, multiline=True)
        note = model.text_field(source_note, "text", required=False, max_len=model.NOTE_MAX, multiline=True)
        again = model.text_field(absorb_note, "text", required=False, max_len=model.NOTE_MAX, multiline=True)
    except model.Invalid as exc:
        raise service.invalid(conn, exc) from None
    category, priority = _category_priority(conn, dept, spec)
    now = now_iso()
    existing = access.open_by_dedupe_key_system(conn, spec.dedupe_key)
    if existing is not None:
        store.insert_event(conn, existing["id"], "note", actor_kind="system", actor_name=SYSTEM_NAME, via="system", body=again or None,
                           data={"absorbed": True, "rule_ref": spec.rule_ref, **(data or {})}, at=now)
        store.update_ticket(conn, existing["id"], {"last_activity_at": now}, bump=False)
        return CreateResult("absorbed", existing["id"], existing["number"])
    ticket_id = new_id()
    number = store.next_number(conn)
    waiting_on, waiting_reason = model.waiting_for("new")
    store.insert_ticket(conn, {
        "id": ticket_id, "number": number, "department_id": dept["id"], "category_id": category["id"] if category else None,
        "priority_id": priority["id"], "title": title, "description": description, "status": "new", "origin": "rule",
        "place_text": "", "created_by": SYSTEM_AUTHOR, "created_by_name": SYSTEM_NAME, "last_activity_at": now,
        "waiting_on": waiting_on, "waiting_reason": waiting_reason, "rule_ref": spec.rule_ref, "dedupe_key": spec.dedupe_key,
        "revision": 1, "created_at": now, "updated_at": now,
    })
    store.insert_event(conn, ticket_id, "created", actor_kind="system", actor_name=SYSTEM_NAME, via="system", to_status="new",
                       data={"origin": "rule", "rule_ref": spec.rule_ref, **(data or {})}, at=now)
    if note:
        store.insert_event(conn, ticket_id, "note", actor_kind="system", actor_name=SYSTEM_NAME, via="system", body=note,
                           data={"rule_ref": spec.rule_ref, "source": True, **(data or {})}, at=now)
    audit(conn, actor=None, action="ticket.create", decision="allowed", resource_type="ticket", resource_id=ticket_id,
          details={"number": number, "department_id": dept["id"], "origin": "rule", "rule_ref": spec.rule_ref, "actor": "system", **(data or {})})
    sla.refresh(conn, ticket_id)
    notify_bridge.ticket_created(conn, ticket_id)
    _partner_hook(conn, ticket_id)
    return CreateResult("created", ticket_id, number)


def _partner_hook(conn, ticket_id: str) -> None:
    """PARTNERAPI113-295: `ticket.created` for the partner webhooks (a constant-time no-op while `partner.webhooks` is off; never raises)."""
    try:
        from ..partner import webhooks

        webhooks.on_ticket_created(conn, ticket_id)
    except Exception:  # noqa: BLE001 - a webhook never breaks the creation of a ticket
        pass


# ---------------------------------------------------------------- PARTNERAPI113-295: the partner branch

PARTNER_AUTHOR_PREFIX = "partner:"  # `tickets.created_by` of a partner ticket: `partner:<ptk id>` - never a user id


def create_by_partner(conn, *, token_id: str, client_id: str, client_label: str, department_id: str, title: str, description: str,
                      category_id: str | None, priority_key: str | None, floor_id: str | None, external_ref: str | None) -> CreateResult:
    """The partner branch of the one creation path (CR-PARTNERAPI113 section 5): an UNASSIGNED ticket in an allowed department, placed on a
    floor of the token's restriction when one is given. Same department / category / priority / text rules as a person's ticket. The
    author is the partner token (`partner:<ptk id>`, timeline actor `system` with `via: partner`); origin stays `inbound` (the 0079 CHECK)
    and the partner link is recorded in `partner_ticket_links`. The caller checked the scope, the departments and the restriction."""
    dept = store.department(conn, department_id) if department_id else None
    if dept is None or not dept["active"]:
        raise service.invalid(conn, model.Invalid([model.Problem("department_id", "unknown")]))
    try:
        clean_title = model.text_field(title, "title", required=True, max_len=model.TITLE_MAX)
        clean_desc = model.text_field(description, "description", required=False, max_len=model.DESCRIPTION_MAX, multiline=True)
    except model.Invalid as exc:
        raise service.invalid(conn, exc) from None
    category, priority = _category_priority(conn, dept, TicketSpec(department_id=dept["id"], title=clean_title, category_id=category_id,
                                                                    priority_key=priority_key))
    placed: dict[str, Any] = {}
    if floor_id:
        row = conn.execute("""SELECT f.id AS floor_id, b.id AS building_id, b.site_id AS site_id FROM floors f JOIN buildings b ON b.id = f.building_id
                              WHERE f.id = ? AND f.deleted_at IS NULL AND b.deleted_at IS NULL""", (floor_id,)).fetchone()
        if row is None:
            raise service.invalid(conn, model.Invalid([model.Problem("floor_id", "unknown")]))
        placed = {"site_id": row["site_id"], "building_id": row["building_id"], "floor_id": row["floor_id"]}
    now = now_iso()
    ticket_id = new_id()
    number = store.next_number(conn)
    waiting_on, waiting_reason = model.waiting_for("new")
    author = PARTNER_AUTHOR_PREFIX + token_id
    name = model.clean_text(client_label)[:80]
    store.insert_ticket(conn, {
        "id": ticket_id, "number": number, "department_id": dept["id"], "category_id": category["id"] if category else None,
        "priority_id": priority["id"], "title": clean_title, "description": clean_desc, "status": "new", "origin": "inbound",
        "place_text": "", "created_by": author, "created_by_name": name, "last_activity_at": now,
        "waiting_on": waiting_on, "waiting_reason": waiting_reason, "rule_ref": None, "dedupe_key": None,
        "revision": 1, "created_at": now, "updated_at": now, **placed,
    })
    conn.execute("INSERT INTO partner_ticket_links (ticket_id, token_id, client_id, external_ref, created_at) VALUES (?,?,?,?,?)",
                 (ticket_id, token_id, client_id, external_ref, now))
    store.insert_event(conn, ticket_id, "created", actor_kind="system", actor_name=name, via="system", to_status="new",
                       data={"origin": "inbound", "via": "partner", "partner_token": token_id}, at=now)
    audit(conn, actor=None, action="partner.ticket.created", decision="allowed", resource_type="ticket", resource_id=ticket_id,
          details={"number": number, "department_id": dept["id"], "token_id": token_id, "client_id": client_id, "floor_id": placed.get("floor_id")})
    sla.refresh(conn, ticket_id)
    notify_bridge.ticket_created(conn, ticket_id)  # the normal `ticket.new_unassigned` notification, like any other request
    _partner_hook(conn, ticket_id)
    return CreateResult("created", ticket_id, number)
