"""TKSTAFF2 (owner 2026-10-16): the ONE assignee abstraction of the module - who may hold a ticket.

A handler is either
- an ACCOUNT HOLDER (`kind = "user"`): an active user who is a member of the ticket's department and holds tickets.view where the
  ticket lies (service.eligible_assignees); told in the app, signs in; or
- a STAFF CONTACT without an account (`kind = "contact"`, `account = False`): a directory row of the API kind "employee" (0084:
  `ticket_contacts.kind = 'person' AND employee = 1`, never a `user_id`, never a vendor), active, not erased, allowed in the ticket's
  department. It never signs in: it gets the SAME scoped personal handler link (and the same assignment message through the same
  dispatcher) as every contact (services/tickets/external.py).

Both are addressed by one reference, `{kind, id}` (wire key `user:<id>` / `contact:<id>` - the board / table filter key), stored in
`ticket_assignments` (`assignee_kind`, `user_id` / `contact_id`, `assignee_name` frozen at assignment time - a later erase or
deactivation of the row never orphans the history: the assignment, its timeline rows and the name stay).

Who may assign a staff contact (decision recorded in docs/architecture/TICKETS_ASSIGNEES.md): exactly who may assign an account holder
- manager rights in the ticket's department. `tickets.external` ("send outside": vendors and contacts) is NOT asked for a staff
contact, because a staff contact is placed in the directory as staff by a `tickets.configure` holder (the same authority that adds
department members). No permission is added to any role; the full phone of a staff contact stays visible only under the directory's
existing rule (contacts.full_phone_for). `STAFF_NEEDS_EXTERNAL = True` restores the earlier rule in one place.

Outside contacts (vendors, persons) keep their own picker group and every rule of slice 4 (`tickets.external`, D25)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from . import access, phone_verify, store_links

STAFF_NEEDS_EXTERNAL = False
KINDS = ("user", "contact")


@dataclass(frozen=True)
class AssigneeRef:
    kind: str  # 'user' | 'contact'
    id: str

    @property
    def key(self) -> str:
        return f"{self.kind}:{self.id}"


def parse_key(raw: str | None) -> AssigneeRef | None:
    """'user:<id>' / 'contact:<id>' -> AssigneeRef; anything else -> None."""
    kind, _, ident = (raw or "").partition(":")
    return AssigneeRef(kind, ident) if kind in KINDS and ident else None


def is_staff(contact: dict[str, Any] | None) -> bool:
    """A staff contact without an account: the 0084 employee row (a flagged person, no internal user, no vendor)."""
    return bool(contact) and contact.get("kind") == "person" and bool(contact.get("employee")) and not contact.get("user_id") \
        and not contact.get("vendor_id")


def needs_external(contact: dict[str, Any] | None) -> bool:
    """Whether sending this contact a link needs `tickets.external` where the ticket lies."""
    return STAFF_NEEDS_EXTERNAL or not is_staff(contact)


def may_send(viewer: access.Viewer, row: dict[str, Any], contact: dict[str, Any] | None) -> bool:
    """The permission part of a link-bearing action (assign, preview, copy / new / resend link) for this contact; the caller has
    already checked manager rights in the ticket's department."""
    return not needs_external(contact) or viewer.holds(access.EXTERNAL, row)


def link_contact_is_staff(conn, ticket: dict[str, Any]) -> bool:
    """Whether the ticket's current (or last) handler link belongs to a staff contact (the link panel's actions follow may_send) -
    or is a TKSTAFF1 staff link of an internal employee with an account (`ticket_links.kind = 'staff'`): its actions need manager
    rights only, like the assignment that made it."""
    link = store_links.link_for_assignment(conn, ticket.get("current_assignment_id")) or store_links.latest_link_of_ticket(conn, ticket["id"])
    if not link:
        return False
    return link.get("kind") == "staff" or is_staff(store_links.contact(conn, link["contact_id"]))


def staff_for(conn, department_id: str) -> list[dict[str, Any]]:
    """The staff contacts that may hold a ticket of this department: active, not erased, allowed in it (no department rows = all)."""
    rows = [r for r in store_links.contacts(conn, kind="employee", include_inactive=False) if is_staff(r)]
    dmap = store_links.departments_map(conn, [r["id"] for r in rows])
    return [r for r in rows if not dmap.get(r["id"]) or department_id in dmap[r["id"]]]


def handlers(viewer: access.Viewer, department_id: str, row: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Every handler a manager may assign in this department (or for this ticket), account holders first (managers, then members),
    then staff contacts - one shape:
    {key, kind, id, name, account, member_role, phone, has_phone, preferred_channel}. Names, roles and (masked unless the directory
    allows the full number) phones only."""
    from . import contacts, service

    conn = viewer.conn
    out: list[dict[str, Any]] = []
    configure = contacts.may_configure(viewer)
    for u in service.eligible_assignees(conn, department_id, row):
        # TKSTAFF1: an account holder with a mobile on their directory row also gets the WhatsApp staff link (masked unless configure)
        mrow = store_links.contact_by_user(conn, u["id"]) or {}
        mobile = mrow.get("phone_e164")
        out.append({"key": f"user:{u['id']}", "kind": "user", "id": u["id"], "name": u["name"], "account": True, "member_role": u["member_role"],
                    "phone": (contacts.display_phone(mobile) if configure else contacts.mask_phone(mobile)) if mobile else None,
                    "has_phone": bool(mobile), "phone_confirmed": phone_verify.confirmed(conn, mrow),  # review F3; TKNOTIFOTP: by code when required
                    "preferred_channel": "inapp"})
    managed = None if configure else contacts.managed_departments(viewer)
    where = row or {"department_id": department_id}
    staff = [c for c in staff_for(conn, department_id) if may_send(viewer, where, c)]
    dmap = store_links.departments_map(conn, [r["id"] for r in staff])
    for c in sorted(staff, key=lambda r: r["display_name"]):
        full = contacts.full_phone_for(viewer, dmap.get(c["id"], []), managed, configure)
        phone = c.get("phone_e164")
        out.append({"key": f"contact:{c['id']}", "kind": "contact", "id": c["id"], "name": c["display_name"], "account": False, "member_role": None,
                    "phone": contacts.display_phone(phone) if full else contacts.mask_phone(phone), "has_phone": bool(phone),
                    "preferred_channel": c["preferred_channel"]})
    return out


def check_new(conn, viewer: access.Viewer, department: dict[str, Any], ref: AssigneeRef) -> None:
    """Everything an assignment at creation time would refuse, checked BEFORE the ticket is written (create.py): ApiError otherwise.
    A ticket being created is placeless and in `department`; the same refusals as the assignment itself."""
    from ...errors import ApiError
    from . import external, service
    from .access import text

    not_allowed = ApiError(409, "assignee_not_allowed", text(conn, "אי אפשר להעביר את {the_ticket} למשתמש הזה (הוא אינו חבר במחלקה או אינו רשאי לצפות ב{tickets})."))
    if ref.kind == "user":
        if not any(u["id"] == ref.id for u in service.eligible_assignees(conn, department["id"], None)):
            raise not_allowed
        return
    contact = store_links.contact(conn, ref.id)
    if not is_staff(contact):
        # an outside contact at creation time stays refused as before (slice 4: from the ticket's assign dialog only)
        if access.EXTERNAL not in viewer.anywhere:
            raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"permission": access.EXTERNAL})
        raise ApiError(409, "public_link_unavailable", text(conn, "שליחה לגורם חיצוני עדיין אינה זמינה בהתקנה זו."))
    if not may_send(viewer, {"department_id": department["id"]}, contact):
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"permission": access.EXTERNAL})
    found, vendor = external.contact_for(conn, {"department_id": department["id"]}, ref.id)
    if not access.public_ready(conn):
        raise external._unavailable(conn)
    external._code_check(conn, found, external.contact_requires_code(found, vendor))
