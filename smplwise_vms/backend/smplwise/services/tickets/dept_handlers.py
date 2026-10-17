"""CR-DEPT-MANAGER-HANDLERS (owner decision 2026-10-17, docs/changes/CR-DEPT-MANAGER-HANDLERS.md): a DEPARTMENT MANAGER manages the
handlers and vendors of HIS departments on "מטפלים וספקים" - without `tickets.configure`.

THE check (every write, `gate()`): the module is on (router) AND `tickets.manage` held (any scope, as `Viewer.manages_department`) AND
`tickets.handlers` held at the installation (departments are installation-wide configuration, like `tickets.configure`) AND a MANAGER
membership of the department (direct or through a group, `store.memberships_of`). `tickets.all_departments` alone is NOT a manager
membership here: "his departments" are the departments he manages by membership. `tickets.configure` holders keep the full directory
routes (routers/tickets_contacts.py, routers/tickets_admin.py) and do not need this module.

What a capable manager may do, for the department in the path only:
- members WITH an account: add a user as a plain member, remove a plain member. Manager rows are never created, changed or removed
  here (a manager role is a permission over the department), groups are not added here, the member's mobile stays a configurer's;
- directory rows (employees without an account, vendors, contacts): attach an existing row he can read to the department, detach it
  (never the row's last department: a row with no department rows is allowed everywhere), create a NEW row - attached to the
  department, or shared with every department (vendors / contacts only; an employee belongs to the department) - and edit / erase the
  rows HE created that no department outside his own uses (attached, assigned or asked for a quote elsewhere). Every other row he
  reads: the attachment only. A row that names a user (an employee's mobile row) is never his to touch.
Answers: 403 `forbidden` without the capability (audited, says nothing about departments); the same 404 `not_found` for an unknown
department and for one he does not manage (audited `denied`); the same 404 `contact_not_found` for an unknown row and for a row of
another department; 403 `attachment_only` for a row he may only attach / detach. Audit rows carry ids, field names and counts only.

Owner decisions on the CR's open questions (2026-10-17, docs/changes/CR-DEPT-MANAGER-HANDLERS.md section 8): `tickets.handlers` stays
department managers only, granted manually (no default role, not delegable); a vendor / contact a manager creates is HIS department's
only by default (`shared: true` still opts in); an EXACT-phone lookup finds an existing vendor to attach (no enumeration, rate limited,
the number masked in the answer, attaching needs the same number again); a manager edits a plain member's mobile and language; the
creating department is stored on the row (`created_department_id`, migration 0111) and shown in the directory list."""
from __future__ import annotations

import hmac
import threading
import time
from typing import Any

from ...audit import audit
from ...errors import ApiError
from . import access, contacts, model, store, store_links
from .access import Viewer, text

VIA = "department_manager"
CONTACT_KINDS = ("employee", "vendor", "person")
NOT_FOUND = "המחלקה לא נמצאה."
CONTACT_NOT_FOUND = "איש הקשר לא נמצא."


class HandlerScope:
    """One caller's handler-management view for one request (computed once)."""

    def __init__(self, viewer: Viewer):
        self.viewer = viewer
        self.conn = viewer.conn
        self.manages = access.MANAGE in viewer.anywhere
        self.capable = self.manages and viewer.holds_installation(access.HANDLERS)
        self.manager_of = {d for d, role in viewer.roles.items() if role == "manager" and store.department(self.conn, d) is not None} if self.manages else set()
        self.departments: set[str] = set(self.manager_of) if self.capable else set()
        self._used: dict[str, bool] = {}

    def used_elsewhere(self, contact_id: str) -> bool:
        """Whether a department outside the caller's own uses the row (or, for a vendor, one of its persons): attached there, assigned
        on one of its tickets, or invited to one of its requests for quotation. A boolean only, never which or how many."""
        if contact_id in self._used:
            return self._used[contact_id]
        ids = [contact_id] + [p["id"] for p in store_links.persons_of(self.conn, contact_id)]
        mine = sorted(self.departments)
        if not mine:
            self._used[contact_id] = True
            return True
        cm, dm = ",".join("?" * len(ids)), ",".join("?" * len(mine))
        args = (*ids, *mine)
        used = bool(
            self.conn.execute(f"SELECT 1 FROM ticket_contact_departments WHERE contact_id IN ({cm}) AND department_id NOT IN ({dm}) LIMIT 1", args).fetchone()
            or self.conn.execute(f"SELECT 1 FROM ticket_assignments a JOIN tickets t ON t.id = a.ticket_id WHERE a.contact_id IN ({cm}) "
                                 f"AND t.department_id NOT IN ({dm}) LIMIT 1", args).fetchone()
            or self.conn.execute(f"SELECT 1 FROM ticket_rfq_vendors v JOIN ticket_rfqs r ON r.id = v.rfq_id WHERE v.contact_id IN ({cm}) "
                                 f"AND r.department_id NOT IN ({dm}) LIMIT 1", args).fetchone())
        self._used[contact_id] = used
        return used

    def editable(self, row: dict[str, Any], depts: list[str]) -> bool:
        """The row's directory details (and its erase) are this manager's: he created it, it names no user, it is attached only to
        departments he manages (or shared with every department) and no other department uses it."""
        if not self.capable or row.get("erased_at") or row.get("user_id") or row.get("created_by") != self.viewer.uid:
            return False
        if depts and not set(depts) <= self.departments:
            return False
        return not self.used_elsewhere(row["id"])


# ---------------------------------------------------------------- gates


def _rid_details(dept_id: str, **extra: Any) -> dict[str, Any]:
    return {"department_id": dept_id, "via": VIA, **extra}


def _deny(conn, viewer: Viewer, action: str, resource_type: str, resource_id: str, reason: str, rid: str | None, details: dict[str, Any] | None = None) -> None:
    audit(conn, actor=viewer.principal, action=action, decision="denied", resource_type=resource_type, resource_id=resource_id, reason=reason,
          request_id=rid, details={"via": VIA, **(details or {})})


def gate(viewer: Viewer, dept_id: str, action: str, rid: str | None) -> HandlerScope:
    """THE check of every write (module docstring)."""
    conn = viewer.conn
    scope = HandlerScope(viewer)
    if not scope.capable:
        _deny(conn, viewer, action, "installation", "*", "no_permission", rid)
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"permission": access.HANDLERS})
    if dept_id not in scope.departments:
        _deny(conn, viewer, action, "ticket_department", dept_id, "not_manager_of_department", rid)
        raise ApiError(404, "not_found", text(conn, NOT_FOUND))
    return scope


def reader(viewer: Viewer) -> HandlerScope:
    """The read of the manager view: tickets.manage with at least one manager membership (the capability decides `can_manage`)."""
    scope = HandlerScope(viewer)
    if not scope.manager_of:
        audit(viewer.conn, actor=viewer.principal, action="ticket.handlers.read", decision="denied", resource_type="installation", resource_id="*",
              reason="not_a_manager", details={"via": VIA})
        raise ApiError(403, "forbidden", text(viewer.conn, "אין הרשאה לפעולה הזו."), details={"permission": access.MANAGE})
    return scope


# ---------------------------------------------------------------- the read


def _protected_person(conn, user_id: str) -> bool:
    """Owner 2026-10-17 (DEPTMGR2, second answer to question 3): a department manager may set the mobile / language of a plain member
    of his department EVEN when that person manages another department - EXCEPT the all-departments ("super") manager (holds
    tickets.all_departments anywhere) and a system administrator, whose numbers stay a configurer's."""
    from ...rbac import is_system_admin
    from .service import _user_viewer

    if is_system_admin(conn, user_id):
        return True
    return access.ALL_DEPARTMENTS in _user_viewer(conn, user_id).anywhere


def _member_view(conn, m: dict[str, Any], full: bool, editable: bool = False) -> dict[str, Any]:
    from . import staff_links

    if m["subject_kind"] == "group":
        return {"kind": "group", "id": m["subject_id"], "name": store.group_name(conn, m["subject_id"]), "role": m["member_role"]}
    sv = staff_links.view(conn, m["subject_id"])
    row = staff_links.directory_row(conn, m["subject_id"])
    phone = (row or {}).get("phone_e164")
    return {"kind": "user", "id": m["subject_id"], "name": store.display_name(conn, m["subject_id"]), "role": m["member_role"],
            "has_mobile": bool(phone), "mobile": contacts.display_phone(phone) if full else contacts.mask_phone(phone),
            "mobile_full": bool(phone) and full, "mobile_confirmed": sv["confirmed"], "notify_whatsapp": sv["notify_whatsapp"],
            "lang": sv["lang"],
            # owner 2026-10-17 (question 4 + the second answer to 3): a capable manager edits a PLAIN member's mobile and language - also
            # of one who manages another department - never the super manager's or a system administrator's
            "mobile_editable": editable and m["member_role"] == "member" and not _protected_person(conn, m["subject_id"])}


def department_view(scope: HandlerScope, dept_id: str) -> dict[str, Any]:
    conn, viewer = scope.conn, scope.viewer
    d = store.department(conn, dept_id) or {}
    full = viewer.holds_installation(access.CONFIGURE) or access.EXTERNAL in viewer.anywhere or contacts.managers_unmask(conn)
    can = dept_id in scope.departments
    return {"id": dept_id, "name": d.get("name", ""), "active": bool(d.get("active")), "can_manage": can,
            "members": [_member_view(conn, m, full, can) for m in store.members(conn, dept_id)]}


def overview(viewer: Viewer) -> dict[str, Any]:
    """`GET /tickets/dept-handlers`: the departments the caller manages (never another one, never a count of others) with their
    members; phones masked unless the caller may see them (tickets.external, or the installation setting)."""
    scope = reader(viewer)
    order = {d["id"]: i for i, d in enumerate(store.departments(scope.conn))}
    ids = sorted(scope.manager_of, key=lambda d: order.get(d, 10**6))
    full = viewer.holds_installation(access.CONFIGURE) or access.EXTERNAL in viewer.anywhere or contacts.managers_unmask(scope.conn)
    return {"departments": [department_view(scope, d) for d in ids], "can_manage": bool(scope.departments), "full_phones": bool(full)}


def people(viewer: Viewer, query: str) -> dict[str, Any]:
    """The users a capable manager may add as members (names only, active users, no groups)."""
    scope = HandlerScope(viewer)
    if not scope.departments:
        audit(viewer.conn, actor=viewer.principal, action="ticket.handlers.people", decision="denied", resource_type="installation", resource_id="*",
              reason="no_permission", details={"via": VIA})
        raise ApiError(403, "forbidden", text(viewer.conn, "אין הרשאה לפעולה הזו."), details={"permission": access.HANDLERS})
    conn = viewer.conn
    needle = model.clean_text(query).casefold()
    users = [{"id": uid, "name": store.display_name(conn, uid)} for uid in store.active_user_ids(conn)]
    return {"users": sorted((u for u in users if not needle or needle in u["name"].casefold()), key=lambda u: u["name"])[:200]}


# ---------------------------------------------------------------- members with an account


def add_member(viewer: Viewer, dept_id: str, user_id: str, rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    scope = gate(viewer, dept_id, "ticket.member.change", rid)
    if user_id not in store.active_user_ids(conn):
        raise ApiError(404, "user_unknown", text(conn, "המשתמש לא נמצא או אינו פעיל."))
    before = store.member_row(conn, dept_id, "user", user_id)
    if before is not None and before["member_role"] == "manager":
        _deny(conn, viewer, "ticket.member.change", "ticket_department", dept_id, "manager_row", rid, {"subject_kind": "user", "subject_id": user_id})
        raise ApiError(403, "manager_row", text(conn, "מנהל מחלקה נקבע בהגדרות המערכת בלבד."))
    if before is None:  # idempotent: an existing plain member is answered as is, without a second audit row
        store.upsert_member(conn, dept_id, "user", user_id, "member", 0, viewer.uid)
        audit(conn, actor=viewer.principal, action="ticket.member.add", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
              request_id=rid, details={"subject_kind": "user", "subject_id": user_id, "role": "member", "before": None, "via": VIA})
    return department_view(scope, dept_id)


def remove_member(viewer: Viewer, dept_id: str, user_id: str, rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    scope = gate(viewer, dept_id, "ticket.member.change", rid)
    before = store.member_row(conn, dept_id, "user", user_id)
    if before is None:
        raise ApiError(404, "not_found", text(conn, "החבר לא נמצא במחלקה."))
    if before["member_role"] == "manager":
        _deny(conn, viewer, "ticket.member.change", "ticket_department", dept_id, "manager_row", rid, {"subject_kind": "user", "subject_id": user_id})
        raise ApiError(403, "manager_row", text(conn, "מנהל מחלקה נקבע בהגדרות המערכת בלבד."))
    store.delete_member(conn, dept_id, "user", user_id)
    from . import staff_links  # TKSTAFF1 (R7 b): a user who left the department holds no live staff link

    staff_links.safe_recheck(conn)
    audit(conn, actor=viewer.principal, action="ticket.member.remove", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
          request_id=rid, details={"subject_kind": "user", "subject_id": user_id, "role": "member", "via": VIA})
    return department_view(scope, dept_id)


MOBILE_FIELDS = ("phone", "lang")


def set_member_mobile(viewer: Viewer, dept_id: str, user_id: str, body: dict[str, Any], rid: str | None) -> dict[str, Any]:
    """Owner 2026-10-17 (open question 4): a capable manager sets the mobile and the language of a PLAIN member (with an account) of HIS
    department - the same write as Settings (staff_links.set_mobile_checked: a changed number revokes the person's live links in every
    department and the person confirms the new number again). A person who manages ANOTHER department is allowed (owner, second answer
    to question 3); a manager row of THIS department, the all-departments ("super") manager and a system administrator are 403
    `manager_row`; never the person's WhatsApp switch or number-verification switch (those stay the person's / a configurer's). The answer is the
    department view (the number masked by the usual rule)."""
    from . import staff_links

    conn = viewer.conn
    scope = gate(viewer, dept_id, "ticket.contact.update", rid)
    if set(body) - set(MOBILE_FIELDS) or not body:
        raise contacts.invalid(conn, "body", "fields")
    before = store.member_row(conn, dept_id, "user", user_id)
    if before is None or user_id not in store.active_user_ids(conn):
        raise ApiError(404, "not_found", text(conn, "החבר לא נמצא במחלקה."))
    if before["member_role"] == "manager" or _protected_person(conn, user_id):
        _deny(conn, viewer, "ticket.contact.update", "ticket_department", dept_id, "manager_row", rid, {"subject_kind": "user", "subject_id": user_id})
        raise ApiError(403, "manager_row", text(conn, "את הנייד של האדם הזה משנים בהגדרות המערכת בלבד."))
    staff_links.set_mobile_checked(conn, viewer, user_id, body, rid, extra_audit=_rid_details(dept_id, subject_id=user_id))
    return department_view(scope, dept_id)


# ---------------------------------------------------------------- the exact-phone lookup of an existing vendor (open question 3)

LOOKUP_LIMITS: tuple[tuple[float, int], ...] = ((60.0, 5), (3600.0, 30))  # per caller: 5 a minute, 30 an hour (lookups + attaches)
LOOKUP_MAX = 5
_LOOKUP_HITS: dict[tuple[str, str], list[float]] = {}
_LOOKUP_LOCK = threading.Lock()


def _lookup_rate(viewer: Viewer, dept_id: str, action: str, rid: str | None) -> None:
    """Per caller (and per database, so test databases never share a bucket): over the limit = 429 `rate_limited`, audited once per
    refusal (`denied`, reason `rate_limited`). A miss counts like a hit: the limit is what bounds guessing."""
    db_file = next((r[2] for r in viewer.conn.execute("PRAGMA database_list").fetchall() if r[1] == "main"), "") or ""
    key = (str(db_file), viewer.uid or "")
    now = time.monotonic()
    longest = max(w for w, _ in LOOKUP_LIMITS)
    with _LOOKUP_LOCK:
        hits = [t for t in _LOOKUP_HITS.get(key, []) if now - t < longest]
        over = any(sum(1 for t in hits if now - t < window) >= n for window, n in LOOKUP_LIMITS)
        if not over:
            hits.append(now)
        _LOOKUP_HITS[key] = hits
    if over:
        _deny(viewer.conn, viewer, action, "ticket_department", dept_id, "rate_limited", rid)
        raise ApiError(429, "rate_limited", text(viewer.conn, "יותר מדי חיפושים ברצף. נסו שוב בעוד כמה דקות."), retryable=True)


def _phone_digits(conn, raw: Any) -> str:
    try:
        digits = contacts.normalize_phone(raw)
    except contacts.ContactInvalid:
        raise contacts.invalid(conn, "phone", "format") from None
    if not digits:
        raise contacts.invalid(conn, "phone", "required")
    return digits


def lookup_vendor(viewer: Viewer, dept_id: str, phone: Any, rid: str | None) -> dict[str, Any]:
    """`POST /tickets/dept-handlers/{dept}/contacts/lookup {phone}`: the live vendors whose number is EXACTLY this one (after the usual
    normalisation - spaces, dashes, a leading 0 or +972 - never a prefix or a partial match), so a manager attaches the existing vendor
    instead of creating a duplicate. Rate limited per caller; the number in the answer is masked (he typed it; nothing more is shown);
    no department name, id or count of the vendor's other departments. The phone travels in the body, never in the URL, and never
    reaches the audit row (ids and a count only)."""
    conn = viewer.conn
    gate(viewer, dept_id, "ticket.contact.lookup", rid)
    digits = _phone_digits(conn, phone)
    _lookup_rate(viewer, dept_id, "ticket.contact.lookup", rid)
    rows = store_links.vendors_by_phone(conn, digits, LOOKUP_MAX)
    dmap = store_links.departments_map(conn, [r["id"] for r in rows])
    out = []
    for r in rows:
        depts = dmap.get(r["id"], [])
        out.append({"id": r["id"], "kind": contacts.api_kind(r), "display_name": r["display_name"], "company": r.get("company") or "",
                    "phone": contacts.mask_phone(r.get("phone_e164")), "active": bool(r["active"]),
                    "shared": not depts, "attached": dept_id in depts})
    audit(conn, actor=viewer.principal, action="ticket.contact.lookup", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
          request_id=rid, details={"department_id": dept_id, "via": VIA, "matches": len(out)})
    return {"matches": out}


def attach_by_phone(viewer: Viewer, dept_id: str, contact_id: str, phone: Any, rid: str | None) -> dict[str, Any]:
    """`POST /tickets/dept-handlers/{dept}/contacts/attach-by-phone {contact_id, phone}`: attach a vendor the lookup found - the caller
    must present the same exact number again (the id alone attaches nothing: a vendor of another department is reachable only by its
    number). An unknown id, a row that is not a live vendor, a row naming a user and a number that does not match are the same 404
    `contact_not_found`. Shared with every department already: 409 `shared_entry`. Idempotent; audited `ticket.contact.attach` with
    `by: phone`."""
    conn = viewer.conn
    gate(viewer, dept_id, "ticket.contact.attach", rid)
    digits = _phone_digits(conn, phone)
    _lookup_rate(viewer, dept_id, "ticket.contact.attach", rid)
    row = store_links.contact(conn, contact_id)
    if (row is None or row.get("erased_at") or row.get("user_id") or row.get("kind") != "vendor" or not row.get("phone_e164")
            or not hmac.compare_digest(str(row["phone_e164"]), digits)):
        _deny(conn, viewer, "ticket.contact.attach", "ticket_contact", contact_id, "phone_mismatch", rid, {"department_id": dept_id})
        raise ApiError(404, "contact_not_found", text(conn, CONTACT_NOT_FOUND))
    depts = store_links.contact_departments(conn, contact_id)
    if not depts:
        raise ApiError(409, "shared_entry", text(conn, "הרשומה כבר זמינה לכל המחלקות."))
    if dept_id not in depts:
        store_links.set_contact_departments(conn, contact_id, [*depts, dept_id])
        audit(conn, actor=viewer.principal, action="ticket.contact.attach", decision="allowed", resource_type="ticket_contact", resource_id=contact_id,
              request_id=rid, details=_rid_details(dept_id, by="phone"))
    return contacts.one(conn, viewer, contact_id)


# ---------------------------------------------------------------- directory rows


def _row_in_department(viewer: Viewer, scope: HandlerScope, dept_id: str, contact_id: str, action: str, rid: str | None) -> tuple[dict[str, Any], list[str]]:
    """A live row the department can use (attached to it, or shared with every department); the same 404 otherwise."""
    conn = viewer.conn
    row = store_links.contact(conn, contact_id)
    depts = store_links.contact_departments(conn, contact_id) if row else []
    if row is None or row.get("erased_at") or (depts and dept_id not in depts):
        _deny(conn, viewer, action, "ticket_contact", contact_id, "not_in_department", rid, {"department_id": dept_id})
        raise ApiError(404, "contact_not_found", text(conn, CONTACT_NOT_FOUND))
    return row, depts


def _attachment_only(conn, viewer: Viewer, action: str, contact_id: str, dept_id: str, rid: str | None) -> ApiError:
    _deny(conn, viewer, action, "ticket_contact", contact_id, "attachment_only", rid, {"department_id": dept_id})
    return ApiError(403, "attachment_only", text(conn, "ברשומה הזו אפשר לשנות רק את השיוך למחלקות שלך. את פרטיה עורך מנהל ההגדרות."))


def _check_vendor(scope: HandlerScope, body: dict[str, Any]) -> None:
    """A person may work for a vendor the manager can read (an unreadable vendor is the same 422 as an unknown one)."""
    vid = body.get("vendor_id")
    if not vid:
        return
    managed = contacts.managed_departments(scope.viewer)
    if not contacts.readable(scope.viewer, store_links.contact_departments(scope.conn, vid), managed):
        raise contacts.invalid(scope.conn, "vendor_id", "unknown")


def create_contact(viewer: Viewer, dept_id: str, body: dict[str, Any], rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    scope = gate(viewer, dept_id, "ticket.contact.create", rid)
    kind = body.get("kind")
    shared = body.pop("shared", None)
    if kind not in CONTACT_KINDS:
        raise contacts.invalid(conn, "kind", "choice")
    if kind == "employee":
        if shared:
            raise contacts.invalid(conn, "shared", "employee")  # an employee without an account belongs to the department
        shared = False
    elif shared is None:
        shared = False  # owner 2026-10-17 (open question 2): a vendor / contact a manager creates is his department's only, by default
    _check_vendor(scope, body)
    try:
        fields = contacts._fields(conn, body, creating=True, current=None)
    except contacts.ContactInvalid as exc:
        raise contacts.invalid(conn, exc.field, exc.code) from None
    fields["created_department_id"] = dept_id  # 0111 (open question 5): the creating department is stored on the row
    cid = contacts.insert_checked(conn, viewer, fields, [] if shared else [dept_id], rid,
                                  extra_audit=_rid_details(dept_id, shared=bool(shared)))
    return contacts.one(conn, viewer, cid)  # carries `created_department` {id, name, other} from the row (0111)


def update_contact(viewer: Viewer, dept_id: str, contact_id: str, body: dict[str, Any], revision: int, rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    scope = gate(viewer, dept_id, "ticket.contact.update", rid)
    row, depts = _row_in_department(viewer, scope, dept_id, contact_id, "ticket.contact.update", rid)
    if not scope.editable(row, depts):
        raise _attachment_only(conn, viewer, "ticket.contact.update", contact_id, dept_id, rid)
    _check_vendor(scope, body)
    contacts.update_checked(conn, viewer, row, body, revision, rid, extra_audit=_rid_details(dept_id))
    return contacts.one(conn, viewer, contact_id)


def erase_contact(viewer: Viewer, dept_id: str, contact_id: str, rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    scope = gate(viewer, dept_id, "ticket.contact.erase", rid)
    row, depts = _row_in_department(viewer, scope, dept_id, contact_id, "ticket.contact.erase", rid)
    if not scope.editable(row, depts):
        raise _attachment_only(conn, viewer, "ticket.contact.erase", contact_id, dept_id, rid)
    return contacts.erase_checked(conn, viewer, row, history=False, rid=rid, extra_audit=_rid_details(dept_id))


def attach_contact(viewer: Viewer, dept_id: str, contact_id: str, rid: str | None) -> dict[str, Any]:
    """Attach a row the manager can read (it is attached to another department he manages) to this department; idempotent."""
    conn = viewer.conn
    scope = gate(viewer, dept_id, "ticket.contact.attach", rid)
    row = store_links.contact(conn, contact_id)
    depts = store_links.contact_departments(conn, contact_id) if row else []
    if row is None or row.get("erased_at") or (depts and not set(depts) & scope.manager_of):
        _deny(conn, viewer, "ticket.contact.attach", "ticket_contact", contact_id, "not_readable", rid, {"department_id": dept_id})
        raise ApiError(404, "contact_not_found", text(conn, CONTACT_NOT_FOUND))
    if row.get("user_id"):
        raise _attachment_only(conn, viewer, "ticket.contact.attach", contact_id, dept_id, rid)
    if not depts:
        raise ApiError(409, "shared_entry", text(conn, "הרשומה כבר זמינה לכל המחלקות."))
    if dept_id not in depts:
        store_links.set_contact_departments(conn, contact_id, [*depts, dept_id])
        audit(conn, actor=viewer.principal, action="ticket.contact.attach", decision="allowed", resource_type="ticket_contact", resource_id=contact_id,
              request_id=rid, details=_rid_details(dept_id))
    return contacts.one(conn, viewer, contact_id)


def detach_contact(viewer: Viewer, dept_id: str, contact_id: str, rid: str | None) -> dict[str, Any]:
    """Detach the row from this department. Never its last department (no department rows = allowed everywhere): 409 `last_department`."""
    conn = viewer.conn
    scope = gate(viewer, dept_id, "ticket.contact.detach", rid)
    row, depts = _row_in_department(viewer, scope, dept_id, contact_id, "ticket.contact.detach", rid)
    if row.get("user_id"):
        raise _attachment_only(conn, viewer, "ticket.contact.detach", contact_id, dept_id, rid)
    if not depts:
        raise ApiError(409, "shared_entry", text(conn, "הרשומה זמינה לכל המחלקות. רק מנהל ההגדרות יכול לצמצם אותה."))
    if depts == [dept_id]:
        raise ApiError(409, "last_department", text(conn, "זו המחלקה היחידה של הרשומה. אפשר להשבית אותה במקום להסיר."))
    store_links.set_contact_departments(conn, contact_id, [d for d in depts if d != dept_id])
    audit(conn, actor=viewer.principal, action="ticket.contact.detach", decision="allowed", resource_type="ticket_contact", resource_id=contact_id,
          request_id=rid, details=_rid_details(dept_id))
    return {"id": contact_id, "department_id": dept_id, "detached": True}
