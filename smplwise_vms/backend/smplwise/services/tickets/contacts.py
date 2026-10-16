"""CR-038 slice 4, spec 7.2 / 8 / 15.2: the directory of people who are not users - contacts and vendors (a vendor is a company;
a person may work for a vendor) - and the rules around it.

Who may do what (section 8, D15, D25, review T19):
- create / edit / erase / export, the "require verification code" flag: `tickets.configure` (sensitive) at installation scope;
- read the list: `tickets.configure` (every row), or `tickets.manage` for the contacts allowed in a department the caller
  manages (a contact with no department rows is allowed everywhere);
- the FULL phone number: `tickets.configure`, or `tickets.external` together with managing a department the contact is allowed
  for (D25); everyone else sees the last four digits only;
- a row that names an internal user (`user_id`: the phone / e-mail of a user) can never receive a handler link (409
  `assignee_not_allowed` at assignment, Q4 / D16);
- a phone or e-mail change (TKSTAFF1: or the row set inactive) while the contact holds live links revokes those links at once
  (`contact_changed`; their queued messages are cancelled - handler_links.revoke), puts each
  ticket in "waiting for the manager" and tells the managers (review T19-4: a directory editor cannot redirect a live link to a
  phone of their choosing);
- erase replaces the person's data by a tombstone and revokes the links (`contact_erased`); export returns the row and what
  the person wrote through their links (section 15.2).
Phone numbers are stored as E.164 digits (no '+', `ha-whatsapp` target format) with a keyed match index `phone_key` =
HMAC(k_tickets, digits) under the current module key; a number never reaches an audit row, a log line or an error message."""
from __future__ import annotations

import re
from typing import Any, Iterable

from ...audit import audit
from ...errors import ApiError
from ...rbac import INSTALLATION, require
from . import access, handler_links, links, model, notify_bridge, store, store_links
from .access import Viewer, text
from .keyring import KEYS
from .module_key import ModuleKeyError

KINDS = ("person", "vendor", "employee")  # "employee" (0084): stored as kind 'person' with employee = 1 - see api_kind()
CHANNELS = ("whatsapp", "email", "manual")
LANGS = ("he", "en", "ar", "ru")
NAME_MAX = 80
COMPANY_MAX = 80
NOTES_MAX = 1000
EMAIL_MAX = 254
DEPARTMENTS_MAX = 50
TOMBSTONE = "איש קשר שנמחק"
DEFAULT_COUNTRY = "972"  # a local number (leading 0) is an Israeli number (the product's installations); E.164 keeps the code
_EMAIL_RE = re.compile(r"[^@\s]{1,64}@[^@\s.]+(\.[^@\s.]+)+")
_PHONE_SEP = re.compile(r"[\s\-().]")


class ContactInvalid(ValueError):
    def __init__(self, field: str, code: str) -> None:
        super().__init__(f"{field}:{code}")
        self.field = field
        self.code = code


def invalid(conn, field: str, code: str) -> ApiError:
    return ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": field, "code": code}]})


# ---------------------------------------------------------------- values


def normalize_phone(raw: Any) -> str | None:
    """E.164 digits (8-15, the country code included, no '+') or None for an empty value; ContactInvalid otherwise.
    Accepts what people type: spaces, dashes, dots, parentheses, a leading '+' or '00', a local number with a leading 0."""
    if raw is None:
        return None
    if not isinstance(raw, str):
        raise ContactInvalid("phone", "type")
    s = _PHONE_SEP.sub("", raw.strip())
    if not s:
        return None
    if s.startswith("+"):
        s = s[1:]
    elif s.startswith("00"):
        s = s[2:]
    elif s.startswith("0"):
        s = DEFAULT_COUNTRY + s[1:]
    if not s.isascii() or not s.isdigit() or not 8 <= len(s) <= 15 or s.startswith("0"):
        raise ContactInvalid("phone", "format")
    return s


def normalize_email(raw: Any) -> str | None:
    if raw is None:
        return None
    if not isinstance(raw, str):
        raise ContactInvalid("email", "type")
    s = raw.strip()
    if not s:
        return None
    if len(s) > EMAIL_MAX or not s.isascii() or not _EMAIL_RE.fullmatch(s):
        raise ContactInvalid("email", "format")
    return s


def mask_phone(digits: str | None) -> str | None:
    """The last four digits only (spec 8: managers without `tickets.external` see masked numbers)."""
    if not digits:
        return None
    return "•••• " + digits[-4:]


def display_phone(digits: str | None) -> str | None:
    """+972 50-123-4567 style for an Israeli number, '+<digits>' otherwise."""
    if not digits:
        return None
    if digits.startswith("972") and len(digits) == 12:
        local = "0" + digits[3:]
        return f"{local[:3]}-{local[3:6]}-{local[6:]}"
    return "+" + digits


def api_kind(row: dict[str, Any]) -> str:
    """The kind the API speaks: 'employee' for an employee without an account (0084: a person row with employee = 1)."""
    return "employee" if row.get("kind") == "person" and row.get("employee") else row["kind"]


def phone_key_for(digits: str | None) -> tuple[str | None, str | None]:
    """(phone_key, key_id) under the current module key (minted by the "module on" path only - keyring.py, W12)."""
    if not digits:
        return None, None
    key_id, key = KEYS.current(create=False)
    return links.phone_key(key, digits), key_id


# ---------------------------------------------------------------- permission predicates


def may_configure(viewer: Viewer) -> bool:
    return viewer.holds_installation(access.CONFIGURE)


def managed_departments(viewer: Viewer) -> set[str] | None:
    """The departments whose contacts the caller may read: None = every department (tickets.all_departments with manage)."""
    if access.MANAGE not in viewer.anywhere:
        return set()
    if access.ALL_DEPARTMENTS in viewer.anywhere:
        return None
    return {d for d, role in viewer.roles.items() if role == "manager"}


def allowed_in(contact_depts: Iterable[str], department_id: str) -> bool:
    depts = list(contact_depts)
    return not depts or department_id in depts


def readable(viewer: Viewer, contact_depts: list[str], managed: set[str] | None) -> bool:
    if managed is None:
        return True
    if not contact_depts:
        return bool(managed)
    return bool(managed & set(contact_depts))


def full_phone_for(viewer: Viewer, contact_depts: list[str], managed: set[str] | None, configure: bool) -> bool:
    if configure:
        return True
    if access.EXTERNAL not in viewer.anywhere:
        return False
    return readable(viewer, contact_depts, managed)


# ---------------------------------------------------------------- presentation


def present(conn, row: dict[str, Any], *, depts: list[str], full_phone: bool, open_count: int = 0,
            vendors: dict[str, str] | None = None, configure: bool = False, rates: bool = False) -> dict[str, Any]:
    """One directory row for the caller: the full phone / e-mail only when `full_phone`; the internal notes only for the
    directory's editors (`configure`)."""
    phone = row.get("phone_e164")
    return {
        "id": row["id"],
        "kind": api_kind(row),
        "vendor_id": row.get("vendor_id"),
        "vendor_name": (vendors or {}).get(row.get("vendor_id") or "") if row.get("vendor_id") else None,
        "user_linked": bool(row.get("user_id")),
        "user_id": row.get("user_id") if full_phone else None,
        "display_name": row["display_name"],
        "company": row.get("company") or "",
        "phone": display_phone(phone) if full_phone else mask_phone(phone),
        "phone_full": bool(phone) and full_phone,
        "has_phone": bool(phone),
        "email": row.get("email") if full_phone else (("•••@" + row["email"].split("@", 1)[1]) if row.get("email") else None),
        "preferred_channel": row["preferred_channel"],
        "require_code": bool(row["require_code"]),
        "share_history": None if row.get("share_history") is None else bool(row["share_history"]),
        "lang": row["lang"],
        "notes": (row.get("notes") or "") if configure else "",
        "active": bool(row["active"]),
        "erased": bool(row.get("erased_at")),
        "departments": depts,
        "open_tickets": open_count,
        "last_assigned_at": row.get("last_assigned_at"),
        "revision": row["revision"],
        # S9 (11A.1 / 11A.2): the cost-claim defaults of this contact; the hourly rate only for tickets.costs.view holders (11A.8)
        "cost_claim": row.get("cost_claim"),
        "vat_exempt": bool(row.get("vat_exempt")),
        "vat_default": row.get("vat_default") or "excluded",
        "labor_rate_minor": row.get("labor_rate_minor") if rates else None,
        "rate_currency": row.get("rate_currency") if rates else None,
    }


def list_for(viewer: Viewer, *, query: str = "", kind: str | None = None, department_id: str | None = None,
             include_inactive: bool = True) -> dict[str, Any]:
    conn = viewer.conn
    configure = may_configure(viewer)
    managed = None if configure else managed_departments(viewer)
    if not configure and managed is not None and not managed:
        return {"contacts": [], "can_edit": False}
    rows = store_links.contacts(conn, query=model.clean_text(query), kind=kind, include_inactive=include_inactive)
    dmap = store_links.departments_map(conn, [r["id"] for r in rows])
    counts = store_links.open_ticket_counts(conn, [r["id"] for r in rows])
    vendors = {r["id"]: r["display_name"] for r in rows if r["kind"] == "vendor"}
    out = []
    for r in rows:
        depts = dmap.get(r["id"], [])
        if not configure and not readable(viewer, depts, managed):
            continue
        if department_id and not allowed_in(depts, department_id):
            continue
        out.append(present(conn, r, depts=depts, full_phone=full_phone_for(viewer, depts, managed, configure),
                           open_count=counts.get(r["id"], 0), vendors=vendors, configure=configure, rates="tickets.costs.view" in viewer.anywhere))
    return {"contacts": out, "can_edit": configure}


def assignable_for(viewer: Viewer, ticket: dict[str, Any]) -> list[dict[str, Any]]:
    """The assign dialog's outside contacts for one ticket (section 8 "assignee picker"): active, not erased, not an internal
    user's row, allowed in the ticket's department - only for a caller who may send outside (D25). TKSTAFF2: staff contacts
    (employees without an account) are handlers, listed with the account holders by services/tickets/assignees.handlers."""
    from . import assignees

    conn = viewer.conn
    if not viewer.holds(access.EXTERNAL, ticket):
        return []
    rows = store_links.contacts(conn, include_inactive=False)
    dmap = store_links.departments_map(conn, [r["id"] for r in rows])
    vendors = {r["id"]: r for r in rows if r["kind"] == "vendor"}
    out = []
    for r in rows:
        if r.get("user_id") or not allowed_in(dmap.get(r["id"], []), ticket["department_id"]):
            continue
        if assignees.is_staff(r):
            continue
        vendor = vendors.get(r.get("vendor_id") or "")
        require = bool(r["require_code"]) or bool(vendor and vendor["require_code"])
        share = r.get("share_history")
        if share is None and vendor is not None:
            share = vendor.get("share_history")
        out.append({
            "kind": "contact", "id": r["id"], "contact_kind": api_kind(r), "name": r["display_name"], "company": r.get("company") or "",
            "vendor_name": vendor["display_name"] if vendor else None, "phone": display_phone(r.get("phone_e164")),
            "has_phone": bool(r.get("phone_e164")), "has_email": bool(r.get("email")), "preferred_channel": r["preferred_channel"],
            "require_code": require, "share_history": None if share is None else bool(share), "lang": r["lang"],
        })
    order = {"employee": 0, "vendor": 1, "person": 2}  # the dialog groups them: employees, vendors, contacts
    return sorted(out, key=lambda c: (order.get(c["contact_kind"], 3), c["name"]))


# ---------------------------------------------------------------- writes


def _fields(conn, body: dict[str, Any], *, creating: bool, current: dict[str, Any] | None) -> dict[str, Any]:
    f: dict[str, Any] = {}
    try:
        if creating or "kind" in body:
            if body.get("kind") not in KINDS:
                raise ContactInvalid("kind", "choice")
            # 0084: the API kind "employee" is a person row with employee = 1; every other kind clears the flag
            f["kind"] = "person" if body["kind"] == "employee" else body["kind"]
            f["employee"] = 1 if body["kind"] == "employee" else 0
        if creating or "display_name" in body:
            f["display_name"] = model.text_field(body.get("display_name"), "display_name", required=True, max_len=NAME_MAX)
        if "company" in body:
            f["company"] = model.text_field(body.get("company"), "company", required=False, max_len=COMPANY_MAX)
        if "notes" in body:
            f["notes"] = model.text_field(body.get("notes"), "notes", required=False, max_len=NOTES_MAX, multiline=True)
        if "phone" in body:
            f["phone_e164"] = normalize_phone(body.get("phone"))
        if "email" in body:
            f["email"] = normalize_email(body.get("email"))
        if "preferred_channel" in body:
            if body["preferred_channel"] not in CHANNELS:
                raise ContactInvalid("preferred_channel", "choice")
            f["preferred_channel"] = body["preferred_channel"]
        if "lang" in body:
            if body["lang"] not in LANGS:
                raise ContactInvalid("lang", "choice")
            f["lang"] = body["lang"]
        for flag in ("require_code", "active"):
            if flag in body:
                if not isinstance(body[flag], bool):
                    raise ContactInvalid(flag, "type")
                f[flag] = 1 if body[flag] else 0
        if "share_history" in body:
            v = body["share_history"]
            if v is not None and not isinstance(v, bool):
                raise ContactInvalid("share_history", "type")
            f["share_history"] = None if v is None else (1 if v else 0)
        kind = f.get("kind") or (current or {}).get("kind")
        employee = bool(f["employee"] if "employee" in f else (current or {}).get("employee"))
        if "vendor_id" in body:
            vid = body.get("vendor_id") or None
            if vid is not None:
                vendor = store_links.contact(conn, vid)
                if kind != "person" or employee or vendor is None or vendor["kind"] != "vendor" or vendor.get("erased_at") or vid == (current or {}).get("id"):
                    raise ContactInvalid("vendor_id", "unknown")
            f["vendor_id"] = vid
        elif (kind == "vendor" or employee) and (current or {}).get("vendor_id"):
            f["vendor_id"] = None  # a vendor or an employee works for no vendor
        # S9 (11A.1 / 11A.2, D32): the claim requirement default, VAT handling and the hourly-rate prefill
        if "cost_claim" in body:
            if body["cost_claim"] not in (None, "required", "optional", "off"):
                raise ContactInvalid("cost_claim", "choice")
            f["cost_claim"] = body["cost_claim"]
        if "vat_exempt" in body:
            if not isinstance(body["vat_exempt"], bool):
                raise ContactInvalid("vat_exempt", "type")
            f["vat_exempt"] = 1 if body["vat_exempt"] else 0
        if "vat_default" in body:
            if body["vat_default"] not in ("included", "excluded"):
                raise ContactInvalid("vat_default", "choice")
            f["vat_default"] = body["vat_default"]
        if "labor_rate" in body:
            from .money import CURRENCIES, MoneyError, parse_amount

            rate = body.get("labor_rate")
            try:
                f["labor_rate_minor"] = None if rate in (None, "") else parse_amount(rate, "labor_rate")
            except MoneyError as exc:
                raise ContactInvalid("labor_rate", exc.code) from None
            cur = body.get("rate_currency") or (current or {}).get("rate_currency") or "ILS"
            if cur not in CURRENCIES:
                raise ContactInvalid("rate_currency", "choice")
            f["rate_currency"] = cur if f["labor_rate_minor"] is not None else None
        if "user_id" in body:
            uid = body.get("user_id") or None
            if uid is not None and employee:
                raise ContactInvalid("user_id", "employee")  # an employee without an account never names an internal user
            if uid is not None and uid not in store.active_user_ids(conn):
                raise ContactInvalid("user_id", "unknown")
            f["user_id"] = uid
        elif employee and (current or {}).get("user_id"):
            raise ContactInvalid("kind", "user_linked")  # a row that names a user cannot become an employee without an account
    except model.Invalid as exc:
        raise ContactInvalid(exc.problems[0].field, exc.problems[0].code) from None
    return f


def _departments(conn, body: dict[str, Any]) -> list[str] | None:
    if "departments" not in body:
        return None
    ids = body.get("departments")
    if not isinstance(ids, list) or len(ids) > DEPARTMENTS_MAX or not all(isinstance(i, str) for i in ids):
        raise ContactInvalid("departments", "type")
    for dept_id in ids:
        if store.department(conn, dept_id) is None:
            raise ContactInvalid("departments", "unknown")
    return list(dict.fromkeys(ids))


def _keyed(conn, fields: dict[str, Any]) -> None:
    if "phone_e164" in fields:
        try:
            fields["phone_key"], fields["phone_key_id"] = phone_key_for(fields["phone_e164"])
        except ModuleKeyError:
            raise ApiError(409, "module_key_missing", text(conn, "מפתח המודול חסר (שחזור ללא secrets/). שחזרו את התיקייה מהגיבוי."),
                           details={"field": "phone"}) from None


def create(conn, viewer: Viewer, body: dict[str, Any], rid: str | None = None) -> dict[str, Any]:
    require(conn, viewer.principal, access.CONFIGURE, INSTALLATION)
    try:
        fields = _fields(conn, body, creating=True, current=None)
        depts = _departments(conn, body)
    except ContactInvalid as exc:
        raise invalid(conn, exc.field, exc.code) from None
    if fields.get("user_id") and store_links.contact_by_user(conn, fields["user_id"]):
        raise ApiError(409, "contact_user_taken", text(conn, "למשתמש הזה כבר יש רשומה בספר."))
    _keyed(conn, fields)
    cid = store_links.insert_contact(conn, fields, viewer.uid)
    if depts:
        store_links.set_contact_departments(conn, cid, depts)
    audit(conn, actor=viewer.principal, action="ticket.contact.create", decision="allowed", resource_type="ticket_contact", resource_id=cid,
          request_id=rid, details={"kind": api_kind(fields), "departments": len(depts or []), "has_phone": bool(fields.get("phone_e164")),
                                   "has_email": bool(fields.get("email")), "require_code": bool(fields.get("require_code"))})
    return one(conn, viewer, cid)


def one(conn, viewer: Viewer, contact_id: str) -> dict[str, Any]:
    row = store_links.contact(conn, contact_id)
    if row is None:
        raise ApiError(404, "contact_not_found", text(conn, "איש הקשר לא נמצא."))
    depts = store_links.contact_departments(conn, contact_id)
    configure = may_configure(viewer)
    managed = None if configure else managed_departments(viewer)
    if not configure and not readable(viewer, depts, managed):
        raise ApiError(404, "contact_not_found", text(conn, "איש הקשר לא נמצא."))
    vendors = {}
    if row.get("vendor_id"):
        v = store_links.contact(conn, row["vendor_id"])
        if v:
            vendors[v["id"]] = v["display_name"]
    counts = store_links.open_ticket_counts(conn, [contact_id])
    out = present(conn, row, depts=depts, full_phone=full_phone_for(viewer, depts, managed, configure),
                  open_count=counts.get(contact_id, 0), vendors=vendors, configure=configure, rates="tickets.costs.view" in viewer.anywhere)
    out["live_links"] = len(store_links.live_links_of_contact(conn, contact_id))
    out["persons"] = [{"id": p["id"], "display_name": p["display_name"]} for p in store_links.persons_of(conn, contact_id)] if row["kind"] == "vendor" else []
    return out


def update(conn, viewer: Viewer, contact_id: str, body: dict[str, Any], revision: int, rid: str | None = None) -> dict[str, Any]:
    require(conn, viewer.principal, access.CONFIGURE, INSTALLATION)
    row = store_links.contact(conn, contact_id)
    if row is None or row.get("erased_at"):
        raise ApiError(404, "contact_not_found", text(conn, "איש הקשר לא נמצא."))
    if row["revision"] != revision:
        raise ApiError(409, "contact_stale", text(conn, "הרשומה השתנתה בינתיים. טענו מחדש."), details={"revision": row["revision"]})
    try:
        fields = _fields(conn, body, creating=False, current=row)
        depts = _departments(conn, body)
    except ContactInvalid as exc:
        raise invalid(conn, exc.field, exc.code) from None
    if fields.get("kind") == "vendor" and row["kind"] == "person" and store_links.persons_of(conn, contact_id):
        raise invalid(conn, "kind", "has_persons")
    if fields.get("kind") == "person" and row["kind"] == "vendor" and store_links.persons_of(conn, contact_id):
        raise invalid(conn, "kind", "has_persons")
    if fields.get("user_id") and fields["user_id"] != row.get("user_id"):
        other = store_links.contact_by_user(conn, fields["user_id"])
        if other and other["id"] != contact_id:
            raise ApiError(409, "contact_user_taken", text(conn, "למשתמש הזה כבר יש רשומה בספר."))
    phone_changed = "phone_e164" in fields and fields["phone_e164"] != row.get("phone_e164")
    email_changed = "email" in fields and fields["email"] != row.get("email")
    if phone_changed:
        _keyed(conn, fields)
        fields["phone_confirmed_at"] = None  # TKSTAFF1 (review F3): a staff member confirms every new number again
    elif "phone_e164" in fields:
        fields.pop("phone_e164")
    user_changed = "user_id" in fields and fields["user_id"] != row.get("user_id")  # TKSTAFF1 (review F6): an unlink revokes too
    if user_changed:
        fields["phone_confirmed_at"] = None  # 2.5.8 review F1: a confirmation belongs to the user who gave it, never to the row
    changed = sorted(k for k, v in fields.items() if row.get(k) != v and k not in ("phone_key", "phone_key_id", "phone_confirmed_at"))
    if not store_links.update_contact(conn, contact_id, fields, revision):
        raise ApiError(409, "contact_stale", text(conn, "הרשומה השתנתה בינתיים. טענו מחדש."), details={"revision": row["revision"]})
    if depts is not None:
        store_links.set_contact_departments(conn, contact_id, depts)
        changed.append("departments")
    revoked = 0
    now = handler_links.now_utc()
    deactivated = fields.get("active") == 0 and bool(row["active"])  # TKSTAFF1 (security design R7 c): an inactive row holds no live link
    if phone_changed or email_changed or user_changed or deactivated:
        revoked = revoke_contact_links(conn, contact_id, "contact_changed", now, rid=rid)
    if fields.get("require_code") == 1 and not row["require_code"]:
        raise_code_requirement(conn, contact_id)
    if (phone_changed or user_changed) and (row.get("user_id") or fields.get("user_id")):
        from . import staff_links  # TKSTAFF1 (review F3 / 2.5.8 F1): each affected employee is told in the app

        for uid in {u for u in (row.get("user_id"), fields.get("user_id") if user_changed else None) if u}:
            staff_links.tell_user(conn, uid)
    audit(conn, actor=viewer.principal, action="ticket.contact.update", decision="allowed", resource_type="ticket_contact", resource_id=contact_id,
          request_id=rid, details={"fields": changed, "links_revoked": revoked})
    return one(conn, viewer, contact_id)


def raise_code_requirement(conn, contact_id: str) -> None:
    """Turning "require code" on raises the contact's live links (and its persons' when it is a vendor) at once (spec 10.5)."""
    ids = [contact_id] + [p["id"] for p in store_links.persons_of(conn, contact_id)]
    for cid in ids:
        for link_row in store_links.live_links_of_contact(conn, cid):
            store_links.update_link(conn, link_row["id"], {"require_code": 1})
    from . import rfq_links  # TKRFQ1: the contact's live RFQ vendor links ask for the code too

    rfq_links.raise_code(conn, ids)


def revoke_contact_links(conn, contact_id: str, reason: str, now, *, rid: str | None = None) -> int:
    """Every live link of the contact dies at once; each affected open ticket waits for its manager."""
    n = 0
    for link_row in store_links.live_links_of_contact(conn, contact_id):
        if not handler_links.revoke(conn, link_row, reason, now):
            continue
        n += 1
        ticket_id = link_row["ticket_id"]
        if reason == "contact_changed":
            store.update_ticket(conn, ticket_id, {"waiting_on": "manager", "waiting_reason": "contact_changed"}, bump=False)
            store.insert_event(conn, ticket_id, "contact_changed", actor_kind="system", data={"reason": reason})
            notify_bridge.contact_changed(conn, ticket_id)
    from . import rfq_links  # TKRFQ1: the contact's live RFQ vendor links die with the change / erase too

    n += rfq_links.revoke_contact_links(conn, contact_id, reason, now)
    return n


def erase(conn, viewer: Viewer, contact_id: str, *, history: bool, rid: str | None = None) -> dict[str, Any]:
    require(conn, viewer.principal, access.CONFIGURE, INSTALLATION)
    row = store_links.contact(conn, contact_id)
    if row is None or row.get("erased_at"):
        raise ApiError(404, "contact_not_found", text(conn, "איש הקשר לא נמצא."))
    if row["kind"] == "vendor" and store_links.persons_of(conn, contact_id):
        raise ApiError(409, "contact_has_persons", text(conn, "לספק יש אנשי קשר. מחקו אותם קודם."))
    revoked = revoke_contact_links(conn, contact_id, "contact_erased", handler_links.now_utc(), rid=rid)
    store_links.erase_contact(conn, contact_id, TOMBSTONE)
    store_links.set_contact_departments(conn, contact_id, [])
    if history:
        store_links.rewrite_contact_names(conn, contact_id, TOMBSTONE)
    from . import costs  # S9 (11A.11): the claims keep the company, the amounts and the files; the person's name goes

    costs.on_contact_erased(conn, contact_id, TOMBSTONE)
    audit(conn, actor=viewer.principal, action="ticket.contact.erase", decision="allowed", resource_type="ticket_contact", resource_id=contact_id,
          request_id=rid, details={"history": bool(history), "links_revoked": revoked})
    return {"id": contact_id, "erased": True, "links_revoked": revoked}


def export(conn, viewer: Viewer, contact_id: str, rid: str | None = None) -> dict[str, Any]:
    """Section 15.2: the person's data on request - the row and what they wrote through their links."""
    require(conn, viewer.principal, access.CONFIGURE, INSTALLATION)
    row = store_links.contact(conn, contact_id)
    if row is None:
        raise ApiError(404, "contact_not_found", text(conn, "איש הקשר לא נמצא."))
    audit(conn, actor=viewer.principal, action="ticket.contact.export", decision="allowed", resource_type="ticket_contact", resource_id=contact_id,
          request_id=rid)
    keep = ("id", "kind", "display_name", "company", "phone_e164", "email", "preferred_channel", "require_code", "share_history", "lang",
            "notes", "active", "created_at", "updated_at", "last_assigned_at", "erased_at")
    return {
        "contact": {**{k: row.get(k) for k in keep}, "kind": api_kind(row)},
        "departments": store_links.contact_departments(conn, contact_id),
        "assignments": [{"ticket_number": a["number"], "assigned_at": a["assigned_at"], "ended_at": a.get("ended_at"), "end_reason": a.get("end_reason"),
                         "return_kind": a.get("return_kind"), "return_reason": a.get("return_reason")} for a in store_links.contact_assignments(conn, contact_id)],
        "timeline": [{"ticket_number": e["number"], "at": e["at"], "kind": e["kind"], "from": e.get("from_status"), "to": e.get("to_status"),
                      "body": e.get("body")} for e in store_links.contact_events(conn, contact_id)],
        "cost_claims": _cost_claims(conn, contact_id),  # S9 (11A.11 / 15.2)
    }


def _cost_claims(conn, contact_id: str) -> list[dict[str, Any]]:
    from . import costs

    return costs.contact_export(conn, contact_id)
