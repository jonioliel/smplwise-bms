"""TKRFQ1 - requests for quotation, stage C1 (docs/tickets/RFQ_BACKEND_CONTRACT.md; RFQ_SPEC_DRAFT.md sections 1-6 and 9, owner
decisions 16.10). An RFQ asks SEVERAL vendors for a quote with no commitment to award; it is neither a ticket nor the quote a vendor
sends on a ticket assigned to him. Only the awarded quote becomes the approved cost baseline (automatically); the others become
`not_awarded` silently.

    visibility   THE rule for requests (like access.py for tickets): module on + tickets.view on the place + (all departments OR member
                 of the department OR the creator OR the internal owner); everything else is the uniform 404 `rfq_not_found`.
                 store_rfq.rfq_row_unchecked / rfq_candidates_unchecked are called from here only (a test enforces it)
    manager      the creator, the internal owner or a manager of the department (tickets.manage + manager member / all departments),
                 with tickets.external on the place
    amounts      tickets.costs.view; on-behalf quotes need tickets.costs + view; an award needs tickets.costs + view
    award        single approval by default; the department's optional threshold asks for a second approver only when one exists
                 above the requester (never the first approver, never the requester) - owner decision 16.10 (final)
    messages     templated only (rfq_invite / rfq_reminder / rfq_update / rfq_cancelled); an award, a second approval, a close or a
                 `not_awarded` NEVER sends anything - the award returns an editable draft
    vendor page  stage C2: until `VENDOR_PAGE` is true, invitations by WhatsApp / e-mail are refused (409 rfq_vendor_page_unavailable);
                 `channel: manual` works (the manager reached the vendor himself and enters the quote on the vendor's behalf)

Money is money.py's (integers in minor units; the server computes every figure). Timeline and audit rows carry ids, versions, states
and totals only - never a text."""
from __future__ import annotations

import datetime as dt
import json
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence

from ...audit import audit
from ...errors import ApiError
from ...rbac import INSTALLATION, Principal
from . import access, model, money, org_locations, quotes, rfq_files, rfq_links, rfq_notify, rfq_terms, settings_doc, store, store_links, store_quotes, store_rfq
from .access import ALL_DEPARTMENTS, CREATE, DELETE, EXTERNAL, VIEW, Viewer, text
from .costs import COSTS, COSTS_VIEW, CostRefused, cost_settings, iso, now_utc, parse
from .text_hygiene import clean_text

# Stage C2 (TKRFQVP, contract section 15): the public listener serves the vendor page (services/tickets/public_rfq.py), so invitations,
# reminders and the "new message" notice may go by WhatsApp / e-mail whenever the listener is ready (`vendor_page_ready`). Turning this
# off again makes every such message refuse (409 rfq_vendor_page_unavailable) and the manager works with `channel: manual`.
VENDOR_PAGE = True
CHANNEL_CHOICES = ("auto", "whatsapp", "email", "manual")

STATES = ("draft", "sent", "collecting", "due_passed", "awarded", "ordered", "closed", "cancelled")
OPEN = frozenset({"sent", "collecting", "due_passed"})  # invited vendors may answer / the manager may award
ENDED = frozenset({"closed", "cancelled"})
LIST_FILTERS = {"open": ("draft", "sent", "collecting", "due_passed", "awarded", "ordered"), "all": None,
                **{s: (s,) for s in STATES}}
VENDOR_STATES = ("draft", "sent", "opened", "quoted", "declined", "expired", "withdrawn", "awarded", "not_awarded", "removed")
LIVE_QUOTE = frozenset({"submitted", "approved", "partially_approved"})
TITLE_MAX, DESCRIPTION_MAX, PLACE_MAX, REASON_MAX, MESSAGE_MAX, DECLINE_MAX = 120, 4000, 200, 500, 2000, 200
DUE_HORIZON_DAYS = 366
THRESHOLD_MAX = 99_999_999_999
FLEXIBLE = {"he": "גמיש", "en": "flexible", "ar": "مرن", "ru": "гибко"}
_NUMBER_Q = re.compile(r"^(?:rfq-?)?0*(\d{1,9})$", re.I)

MESSAGES = {
    "rfq_not_found": "הבקשה להצעת מחיר לא נמצאה.",
    "vendor_not_found": "הספק לא נמצא בבקשה הזאת.",
    "quote_not_found": "ההצעה לא נמצאה.",
    "award_not_found": "האישור לא נמצא.",
    "rfq_stale": "הבקשה השתנתה בינתיים. טענו מחדש.",
    "rfq_invalid_transition": "הפעולה הזו אינה אפשרית במצב הנוכחי של הבקשה.",
    "rfq_field_locked": "אחרי השליחה לספקים אפשר לשנות רק את המועד האחרון (להאריך), את חלון העבודה ואת האחראי.",
    "rfq_no_vendors": "אין ספקים לשליחה. הוסיפו ספק אחד לפחות.",
    "rfq_due_passed": "המועד האחרון להצעות כבר עבר. קבעו מועד חדש.",
    "vendor_not_allowed": "אי אפשר להזמין את איש הקשר הזה להציע מחיר.",
    "vendor_duplicate": "הספק כבר נמצא בבקשה.",
    "vendor_has_quote": "לספק יש הצעה פעילה. משכו אותה קודם.",
    "rfq_vendor_page_unavailable": "דף הספק לבקשות הצעת מחיר עדיין אינו זמין. אפשר לפנות לספקים ידנית ולהזין את ההצעות בשמם.",
    "public_link_unavailable": "אי אפשר ליצור קישור לספק כרגע (מפתח המודול או הכתובת הציבורית חסרים).",
    "rfq_has_award": "כבר אושרה הצעה בבקשה הזאת; אי אפשר לבטל אותה.",
    "award_pending": "יש אישור שממתין לאישור שני.",
    "quote_not_open": "אי אפשר להגיש או לשנות הצעה במצב הנוכחי.",
    "quote_stale": "ההצעה השתנתה בינתיים. טענו מחדש.",
    "self_approval": "את ההצעה הזאת הזנת בעצמך: אדם אחר צריך לאשר אותה.",
    "second_approver_required": "האישור השני צריך להינתן על ידי מאשר אחר, מעל יוצר הבקשה.",
    "owner_not_allowed": "אי אפשר לבחור את המשתמש הזה כאחראי (הוא אינו חבר במחלקה).",
    "department_not_found": "המחלקה לא נמצאה.",
    "vendor_code_locked": "פרטי איש הקשר דורשים קוד אימות לספק הזה; אי אפשר לבטל אותו כאן.",
    "code_channel_unavailable": "אין כרגע ערוץ שיכול לשלוח קוד אימות לספק הזה. בטלו את הקוד או בחרו פנייה ידנית.",
    # TKRFQ4 (stage C4, the work order)
    "order_exists": "כבר נפתחה הזמנת עבודה לספק הזה.",
    "order_not_found": "עדיין לא נפתחה הזמנת עבודה לספק הזה.",
    "order_channel_unavailable": "אין כרגע ערוץ שיכול לשלוח את הזמנת העבודה לספק. אפשר להעתיק את הקישור מ{the_ticket} ולשלוח בעצמכם.",
    "order_link_unavailable": "הקישור של הספק ב{the_ticket} אינו פעיל. צרו קישור חדש ב{the_ticket}.",
    "order_ticket_closed": "{the_ticket} {f:שנפתחה|m:שנפתח} כבר {f:סגורה|m:סגור}.",
    # CR-RFQ-PAYMENT-SCHEDULE (contract section 20)
    "terms_not_found": "לאישור הזה אין לוח תשלומים ומועד הגעה.",
    "arrival_not_proposed": "הספק לא הציע מועד אחר שממתין להחלטה.",
    "arrival_date_passed": "המועד שהספק הציע כבר עבר. דחו את ההצעה כדי שיציע מועד חדש.",
}


def _err(conn, status: int, code: str, **details: Any) -> ApiError:
    return ApiError(status, code, text(conn, MESSAGES.get(code, "הפעולה נדחתה.")), details=details or None)


def invalid(conn, field_name: str, code: str) -> ApiError:
    return ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": field_name, "code": code}]})


def refuse(conn, viewer: Viewer, action: str, row: Mapping[str, Any] | None, reason: str, rid: str | None = None, **details: Any) -> ApiError:
    """An audited 403 (role, membership or a permission on the request's place)."""
    audit(conn, actor=viewer.principal, action=action, decision="denied", resource_type="ticket_rfq", resource_id=(row or {}).get("id"),
          reason=reason, request_id=rid, details={"number": (row or {}).get("number"), **details})
    return ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"reason": reason, **details})


def _audit(conn, viewer: Viewer, action: str, row: Mapping[str, Any], rid: str | None, **details: Any) -> None:
    audit(conn, actor=viewer.principal, action=action, decision="allowed", resource_type="ticket_rfq", resource_id=row["id"], request_id=rid,
          details={"number": row["number"], **details})


def actor_name(viewer: Viewer) -> str:
    return store.display_name(viewer.conn, viewer.uid) or viewer.principal.display_name or viewer.principal.username


def ref(number: int) -> str:
    return f"RFQ-{int(number):02d}"


# ---------------------------------------------------------------- visibility (THE rule for requests)

@dataclass(frozen=True)
class RfqSeen:
    row: dict[str, Any]
    reasons: frozenset[str] = field(default_factory=frozenset)

    @property
    def creator(self) -> bool:
        return "creator" in self.reasons

    @property
    def owner(self) -> bool:
        return "owner" in self.reasons


def visible(viewer: Viewer, row: dict[str, Any] | None) -> RfqSeen | None:
    if row is None or not access.module_on(viewer.conn):
        return None
    if not viewer.holds(VIEW, row):
        return None
    reasons: set[str] = set()
    if viewer.holds(ALL_DEPARTMENTS, row):
        reasons.add("all_departments")
    role = viewer.role(row["department_id"])
    if role:
        reasons.add(role)
    if row.get("created_by") == viewer.uid:
        reasons.add("creator")
    if row.get("internal_owner_user_id") == viewer.uid:
        reasons.add("owner")
    if not reasons:
        return None
    return RfqSeen(row=row, reasons=frozenset(reasons))


def require_visible(viewer: Viewer, rfq_id: str) -> RfqSeen:
    seen = visible(viewer, store_rfq.rfq_row_unchecked(viewer.conn, rfq_id))
    if seen is None:
        raise _err(viewer.conn, 404, "rfq_not_found")
    return seen


def visible_by_id(viewer: Viewer, rfq_id: str | None) -> RfqSeen | None:
    """TKRFQ4: a request named by another record (the ticket an order opened) - None when the caller may not know it exists."""
    if not rfq_id:
        return None
    return visible(viewer, store_rfq.rfq_row_unchecked(viewer.conn, rfq_id))


def number_of(conn, rfq_id: str | None) -> int | None:
    """TKRFQ4: the running number of a request (the ticket an order opened says "opened from RFQ-07" to its viewers even when they
    cannot open the request itself) - the number only, never another field."""
    row = store_rfq.rfq_row_unchecked(conn, rfq_id) if rfq_id else None
    return int(row["number"]) if row else None


def row_of_link(conn, rfq_id: str) -> dict[str, Any] | None:
    """TKRFQVP (contract 15): the request a vendor's RFQ link names. On the public side the LINK is the authorisation (public_rfq resolved
    and checked it), never a person's visibility - the only read of a request around `visible()`, and it serves that one vendor only."""
    return store_rfq.rfq_row_unchecked(conn, rfq_id)


def system_row(conn, rfq_id: str) -> dict[str, Any] | None:
    """TKRFQ5: the request a notification or an inbound WhatsApp reply names, read by the module itself (the notification engine's
    recipient / visibility hooks, the inbound worker). Never an answer to a person: rfq_notify filters every recipient through
    `visible()` + `is_manager()`, and the inbound worker writes only to the matched vendor's own thread."""
    return store_rfq.rfq_row_unchecked(conn, rfq_id)


def is_manager(viewer: Viewer, seen: RfqSeen) -> bool:
    row = seen.row
    if not viewer.holds(EXTERNAL, row):
        return False
    return seen.creator or seen.owner or viewer.is_manager(row)


def need_manager(conn, viewer: Viewer, seen: RfqSeen, action: str, rid: str | None) -> None:
    row = seen.row
    if not (seen.creator or seen.owner or viewer.is_manager(row)):
        raise refuse(conn, viewer, action, row, "not_manager", rid)
    if not viewer.holds(EXTERNAL, row):
        raise refuse(conn, viewer, action, row, "external_permission_missing", rid, permission=EXTERNAL)


def sees_amounts(viewer: Viewer, seen: RfqSeen) -> bool:
    return viewer.holds(COSTS_VIEW, seen.row)


def can_decide(viewer: Viewer, seen: RfqSeen) -> bool:
    return viewer.holds(COSTS, seen.row) and viewer.holds(COSTS_VIEW, seen.row)


def need_costs(conn, viewer: Viewer, seen: RfqSeen, action: str, rid: str | None) -> None:
    for perm in (COSTS_VIEW, COSTS):
        if not viewer.holds(perm, seen.row):
            raise refuse(conn, viewer, action, seen.row, "costs_permission_missing", rid, permission=perm)


def visible_page(viewer: Viewer, *, state: str = "open", department_id: str | None = None, query: str = "", cursor: str | None = None,
                 limit: int = 50) -> tuple[list[RfqSeen], str | None]:
    """A page of the requests this caller may see, newest activity first (keyset cursor); at most 5 x limit candidates per page."""
    conn = viewer.conn
    limit = max(1, min(int(limit), 200))
    states = LIST_FILTERS.get(state, LIST_FILTERS["open"])
    dept_ids = None if ALL_DEPARTMENTS in viewer.anywhere else list(viewer.roles)
    after = store.decode_cursor(cursor)
    m = _NUMBER_Q.match(query.strip()) if query else None
    out: list[RfqSeen] = []
    scanned, cap = 0, 5 * limit
    exhausted = False
    while len(out) < limit and scanned < cap:
        want = min(limit, cap - scanned)
        batch = store_rfq.rfq_candidates_unchecked(conn, department_ids=dept_ids, user_id=viewer.uid, states=states, department_id=department_id,
                                                   query=query.strip(), after=after, limit=want, number=int(m.group(1)) if m else None)
        for row in batch:
            scanned += 1
            after = (row["updated_at"], row["id"])
            seen = visible(viewer, row)
            if seen is not None:
                out.append(seen)
                if len(out) >= limit:
                    break
        if len(batch) < want:
            exhausted = not batch or after == (batch[-1]["updated_at"], batch[-1]["id"])
            break
    return out, (None if exhausted or after is None else store.encode_cursor(*after))


# ---------------------------------------------------------------- time, states

def _instant(conn, value: Any, field_name: str, now: dt.datetime, *, future: bool = False) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise invalid(conn, field_name, "type")
    at = parse(value)
    if at is None:
        raise invalid(conn, field_name, "format")
    if (future and at <= now) or at < now - dt.timedelta(days=1) or at > now + dt.timedelta(days=DUE_HORIZON_DAYS):
        raise invalid(conn, field_name, "range")
    return iso(at)


def _due_passed(row: Mapping[str, Any], now: dt.datetime) -> bool:
    due = parse(row.get("due_at"))
    return due is not None and due <= now


def effective_state(row: Mapping[str, Any], now: dt.datetime) -> str:
    """Reads never show a stale state: a collecting request whose deadline passed reads `due_passed` before the janitor writes it."""
    if row["state"] in ("sent", "collecting") and _due_passed(row, now):
        return "due_passed"
    return row["state"]


def vendor_state(v: Mapping[str, Any], rfq_due_passed: bool) -> str:
    if v["state"] in ("sent", "opened") and rfq_due_passed:
        return "expired"
    return v["state"]


def apply_due(conn, row: dict[str, Any], now: dt.datetime) -> dict[str, Any]:
    """Every write on a request first applies the deadline (no revision bump: a system move must not make the caller's copy stale)."""
    if row["state"] in ("sent", "collecting") and _due_passed(row, now):
        at = iso(now)
        store_rfq.update_rfq(conn, row["id"], {"state": "due_passed", "due_passed_at": at}, bump=False)
        for v in store_rfq.vendors_of(conn, row["id"]):
            if v["state"] in ("sent", "opened"):
                store_rfq.update_vendor(conn, v["id"], {"state": "expired", "updated_at": at})
        store_rfq.insert_event(conn, row["id"], "due_passed", at=at)
        fresh = store_rfq.rfq_row_unchecked(conn, row["id"]) or row
        vendors = [v for v in store_rfq.vendors_of(conn, row["id"]) if v["state"] not in ("draft", "removed")]
        rfq_notify.due_passed(conn, fresh, invited=len(vendors), quoted=sum(1 for v in vendors if live_quote(conn, v["id"]) is not None))
        return fresh
    return row


def tick(conn, now: dt.datetime) -> int:
    """The janitor: deadlines that passed while the request was collecting."""
    n = 0
    for row in store_rfq.due_rows(conn, iso(now)):
        apply_due(conn, row, now)
        n += 1
    return n


def _stale(conn, row: Mapping[str, Any]) -> ApiError:
    return _err(conn, 409, "rfq_stale", revision=row["revision"])


def _bad_move(conn, row: Mapping[str, Any], action: str, now: dt.datetime) -> ApiError:
    return _err(conn, 409, "rfq_invalid_transition", **{"from": effective_state(row, now), "action": action})


def _touch(conn, row: Mapping[str, Any], fields: dict[str, Any], revision: int | None, now: dt.datetime) -> None:
    fields = {**fields, "updated_at": iso(now)}
    if not store_rfq.update_rfq(conn, row["id"], fields, expect_revision=revision):
        raise _stale(conn, row)


# ---------------------------------------------------------------- vendors: who may be invited

def vendor_problem(conn, contact: Mapping[str, Any] | None, department_id: str) -> str | None:
    """None when the contact may be invited; else the reason (staff-link lessons: never a contact naming an internal user, never an
    employee - the "staff" kind does not quote; never an erased or inactive row; never a contact limited to other departments)."""
    if contact is None or contact.get("erased_at"):
        return "not_found"
    if not contact.get("active"):
        return "inactive"
    if contact.get("user_id"):
        return "internal_user"
    if contact.get("employee"):
        return "employee"
    if contact.get("kind") not in ("vendor", "person"):
        return "kind"
    depts = store_links.contact_departments(conn, contact["id"])
    if depts and department_id not in depts:
        return "department"
    return None


def _vendor_contact(conn, contact: Mapping[str, Any]) -> dict[str, Any] | None:
    return store_links.contact(conn, contact["vendor_id"]) if contact.get("vendor_id") else None


def _require_code(conn, contact: Mapping[str, Any]) -> bool:
    vendor = _vendor_contact(conn, contact)
    return bool(contact.get("require_code") or (vendor or {}).get("require_code"))


def _choice(conn, value: Any) -> str:
    if value is None:
        return "auto"
    if value not in CHANNEL_CHOICES:
        raise invalid(conn, "channel", "unknown")
    return value


def add_vendor(conn, viewer: Viewer, row: Mapping[str, Any], contact_id: str, now: dt.datetime, *, channel: Any = None,
               require_code: Any = None) -> str:
    """A draft vendor. TKRFQVP (contract 15.2 / 15.6, owner decision 16.10): the verification code is OFF by default; the manager may
    turn it on per vendor (`require_code`); the directory's own demand (the contact's / its vendor's) turns it on and is never lowered.
    `channel` is the manager's choice for the invitation (`auto` = the contact's preferred channel)."""
    if require_code is not None and not isinstance(require_code, bool):
        raise invalid(conn, "require_code", "type")
    choice = _choice(conn, channel)
    contact = store_links.contact(conn, contact_id)
    problem = vendor_problem(conn, contact, row["department_id"])
    if problem == "not_found":
        raise invalid(conn, "contact_id", "not_found")
    if problem:
        raise _err(conn, 409, "vendor_not_allowed", reason=problem)
    if store_rfq.vendor_by_contact(conn, row["id"], contact_id):
        raise _err(conn, 409, "vendor_duplicate")
    at = iso(now)
    code = _require_code(conn, contact or {}) or bool(require_code)
    vid = store_rfq.insert_vendor(conn, {"rfq_id": row["id"], "contact_id": contact_id, "channel": "manual", "channel_choice": choice,
                                         "state": "draft", "require_code": 1 if code else 0, "invited_at": at, "created_by": viewer.uid,
                                         "created_at": at, "updated_at": at})
    store_rfq.insert_event(conn, row["id"], "vendor_added", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           rfq_vendor_id=vid, data={"contact_id": contact_id}, at=at)
    return vid


def vendor_of(conn, seen: RfqSeen, rfq_vendor_id: str) -> dict[str, Any]:
    v = store_rfq.vendor(conn, rfq_vendor_id)
    if v is None or v["rfq_id"] != seen.row["id"]:
        raise _err(conn, 404, "vendor_not_found")
    return v


# ---------------------------------------------------------------- create / edit

def _kinds(conn, value: Any, department_id: str) -> list[str]:
    if value is None:
        return list(quotes.effective_kinds(conn, {"department_id": department_id, "allowed_line_kinds": None})[0])
    try:
        return settings_doc.line_kinds(value)
    except ValueError as exc:
        raise invalid(conn, "allowed_line_kinds", "labor_required" if str(exc) == "labor_required" else "invalid") from None


def _owner_ok(conn, department_id: str, row: Mapping[str, Any], user_id: str) -> bool:
    from .service import eligible_assignees

    return any(c["id"] == user_id for c in eligible_assignees(conn, department_id, dict(row)))


def _place(conn, floor_id: str | None) -> dict[str, Any]:
    if not floor_id:
        return {"site_id": None, "building_id": None, "floor_id": None}
    place = store_rfq.place_of_floor(conn, floor_id)
    if place is None:
        raise invalid(conn, "floor_id", "not_found")
    return place


def _text_field(conn, value: Any, field_name: str, max_len: int, *, required: bool = False, multiline: bool = False) -> str:
    try:
        return model.text_field(value, field_name, required=required, max_len=max_len, multiline=multiline)
    except model.Invalid as exc:
        p = exc.problems[0]
        raise invalid(conn, p.field, p.code) from None


def _location(conn, location_id: Any) -> dict[str, Any]:
    """CR-ORG-LOCATIONS: an active organisation location -> its reference and the snapshot taken now; None / "" -> no location."""
    if not location_id:
        return {"location_id": None, "location_snapshot": None}
    try:
        lid, snap = org_locations.resolve(conn, location_id)
    except org_locations.Invalid as exc:
        raise invalid(conn, exc.field, exc.code) from None
    return {"location_id": lid, "location_snapshot": snap}


def location_value(row: Mapping[str, Any]) -> str:
    """The `{location}` of this request's vendor messages: name · street, city; + the map link only when the manager switched it on
    for this request (owner answer 17.10 (c), default off). Empty without a location."""
    snap = org_locations.parse_snapshot(row.get("location_snapshot"))
    return org_locations.message_text(snap, nav=bool(row.get("location_nav")))


def create(conn, viewer: Viewer, body: Mapping[str, Any], rid: str | None = None) -> str:
    now = now_utc()
    dept = store.department(conn, body.get("department_id") or "")
    if dept is None or not dept.get("active") or dept.get("deleted_at"):
        raise invalid(conn, "department_id", "not_found")
    if not viewer.can_create_in(dept):
        raise refuse(conn, viewer, "ticket.rfq.create", None, "create_not_allowed", rid, department_id=dept["id"])
    place = _place(conn, body.get("floor_id"))
    probe = {**place, "department_id": dept["id"]}
    if not viewer.holds(EXTERNAL, probe if place["floor_id"] else None):
        raise refuse(conn, viewer, "ticket.rfq.create", None, "external_permission_missing", rid, permission=EXTERNAL)
    if place["floor_id"] and not viewer.holds(CREATE, probe):
        raise refuse(conn, viewer, "ticket.rfq.create", None, "create_not_allowed", rid, department_id=dept["id"])
    title = _text_field(conn, body.get("title"), "title", TITLE_MAX, required=True)
    description = _text_field(conn, body.get("description"), "description", DESCRIPTION_MAX, multiline=True)
    place_text = _text_field(conn, body.get("place_text"), "place_text", PLACE_MAX) or None
    location = _location(conn, body.get("location_id"))
    source = body.get("source_ticket_id")
    if source:
        seen_ticket = access.visible_by_id(viewer, source)
        if seen_ticket is None:
            raise invalid(conn, "source_ticket_id", "not_found")
        source = seen_ticket.row["id"]
    days = int(settings_doc.read(conn)["rfq"]["default_due_days"])
    due = _instant(conn, body.get("due_at"), "due_at", now, future=True) or iso(now + dt.timedelta(days=days))
    wf = _instant(conn, body.get("work_from"), "work_from", now)
    wt = _instant(conn, body.get("work_to"), "work_to", now)
    if wf and wt and wt < wf:
        raise invalid(conn, "work_to", "order")
    kinds = _kinds(conn, body.get("allowed_line_kinds"), dept["id"])
    owner = body.get("internal_owner_user_id") or viewer.uid
    if owner != viewer.uid and not _owner_ok(conn, dept["id"], probe, owner):
        raise _err(conn, 409, "owner_not_allowed")
    contact_ids = [v.get("contact_id") for v in body.get("vendors") or []]
    if len(set(contact_ids)) != len(contact_ids):
        raise _err(conn, 409, "vendor_duplicate")
    at = iso(now)
    number = store_rfq.next_number(conn)
    rfq_id = store_rfq.insert_rfq(conn, {
        "number": number, "department_id": dept["id"], "title": title, "description": description, **place, "place_text": place_text, **location,
        "location_nav": 1 if (body.get("location_nav") and location["location_id"]) else 0,
        "source_ticket_id": source, "allowed_line_kinds": store_rfq.dumps(kinds), "due_at": due, "work_from": wf, "work_to": wt,
        "internal_owner_user_id": owner, "state": "draft", "created_by": viewer.uid, "created_at": at, "updated_at": at})
    row = store_rfq.rfq_row_unchecked(conn, rfq_id) or {}
    store_rfq.insert_event(conn, rfq_id, "created", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           data={"number": number, "source_ticket_id": source}, at=at)
    for v in body.get("vendors") or []:
        add_vendor(conn, viewer, row, v.get("contact_id"), now, channel=v.get("channel"), require_code=v.get("require_code"))
    _audit(conn, viewer, "ticket.rfq.create", row, rid, department_id=dept["id"], vendors=len(contact_ids), source_ticket_id=source)
    return rfq_id


EDITABLE_IN_DRAFT = ("title", "description", "place_text", "location_id", "location_nav", "floor_id", "due_at", "work_from", "work_to", "allowed_line_kinds", "internal_owner_user_id")
EDITABLE_WHILE_OPEN = ("due_at", "work_from", "work_to", "internal_owner_user_id")
EDITABLE_AFTER_AWARD = ("internal_owner_user_id",)


def edit(conn, viewer: Viewer, seen: RfqSeen, patch: Mapping[str, Any], revision: int, rid: str | None = None) -> list[str]:
    now = now_utc()
    need_manager(conn, viewer, seen, "ticket.rfq.edit", rid)
    row = apply_due(conn, dict(seen.row), now)
    if row["revision"] != revision:
        raise _stale(conn, row)
    state = row["state"]
    allowed = EDITABLE_IN_DRAFT if state == "draft" else EDITABLE_WHILE_OPEN if state in OPEN else EDITABLE_AFTER_AWARD if state in ("awarded", "ordered") else ()
    asked = set(patch)
    if asked - set(allowed):
        raise _err(conn, 409, "rfq_field_locked", fields=sorted(asked - set(allowed)))
    fields: dict[str, Any] = {}
    if "title" in patch:
        fields["title"] = _text_field(conn, patch["title"], "title", TITLE_MAX, required=True)
    if "description" in patch:
        fields["description"] = _text_field(conn, patch["description"], "description", DESCRIPTION_MAX, multiline=True)
    if "place_text" in patch:
        fields["place_text"] = _text_field(conn, patch["place_text"], "place_text", PLACE_MAX) or None
    if "floor_id" in patch:
        fields.update(_place(conn, patch["floor_id"]))
    if "location_id" in patch:
        fields.update(_location(conn, patch["location_id"]))  # a new snapshot only while the request is a draft
    if "location_nav" in patch:
        fields["location_nav"] = 1 if patch["location_nav"] else 0
    if "allowed_line_kinds" in patch:
        fields["allowed_line_kinds"] = store_rfq.dumps(_kinds(conn, patch["allowed_line_kinds"], row["department_id"]))
    if "due_at" in patch:
        due = _instant(conn, patch["due_at"], "due_at", now, future=True)
        if due is None:
            raise invalid(conn, "due_at", "required")
        if state != "draft" and due < row["due_at"]:
            raise invalid(conn, "due_at", "earlier")  # after the send the deadline only moves later
        fields["due_at"] = due
    wf = _instant(conn, patch["work_from"], "work_from", now) if "work_from" in patch else row.get("work_from")
    wt = _instant(conn, patch["work_to"], "work_to", now) if "work_to" in patch else row.get("work_to")
    if wf and wt and wt < wf:
        raise invalid(conn, "work_to", "order")
    if "work_from" in patch:
        fields["work_from"] = wf
    if "work_to" in patch:
        fields["work_to"] = wt
    if "internal_owner_user_id" in patch:
        owner = patch["internal_owner_user_id"]
        if not owner:
            raise invalid(conn, "internal_owner_user_id", "required")
        if owner != row.get("internal_owner_user_id") and not _owner_ok(conn, row["department_id"], row, owner):
            raise _err(conn, 409, "owner_not_allowed")
        fields["internal_owner_user_id"] = owner
    changed = sorted(k for k, v in fields.items() if row.get(k) != v)
    if not changed:
        return []
    if state == "due_passed" and "due_at" in changed:  # a later deadline reopens the collection
        fields["state"] = "collecting" if any(v.get("first_opened_at") or v["state"] in ("quoted", "declined", "withdrawn")
                                              for v in store_rfq.vendors_of(conn, row["id"])) else "sent"
        fields["due_passed_at"] = None
        for v in store_rfq.vendors_of(conn, row["id"]):
            if v["state"] == "expired":
                store_rfq.update_vendor(conn, v["id"], {"state": "opened" if v.get("first_opened_at") else "sent", "updated_at": iso(now)})
    _touch(conn, row, fields, revision, now)
    if "due_at" in changed:
        rfq_links.on_due_changed(conn, {**row, **fields}, now)
        if state == "due_passed":
            rfq_notify.due_moved(conn, row["id"])  # TKRFQ5: the collection reopened
    store_rfq.insert_event(conn, row["id"], "edited", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           data={"fields": changed}, at=iso(now))
    _audit(conn, viewer, "ticket.rfq.edit", row, rid, fields=changed)
    return changed


def add_vendor_route(conn, viewer: Viewer, seen: RfqSeen, contact_id: str, revision: int, rid: str | None = None, *, channel: Any = None,
                     require_code: Any = None) -> str:
    now = now_utc()
    need_manager(conn, viewer, seen, "ticket.rfq.vendor_add", rid)
    row = apply_due(conn, dict(seen.row), now)
    if row["revision"] != revision:
        raise _stale(conn, row)
    if row["state"] not in ("draft", "sent", "collecting", "due_passed"):
        raise _bad_move(conn, row, "vendor_add", now)
    vid = add_vendor(conn, viewer, row, contact_id, now, channel=channel, require_code=require_code)
    _touch(conn, row, {}, revision, now)
    _audit(conn, viewer, "ticket.rfq.vendor_add", row, rid, vendor_id=vid, contact_id=contact_id)
    return vid


def remove_vendor(conn, viewer: Viewer, seen: RfqSeen, rfq_vendor_id: str, revision: int, rid: str | None = None) -> None:
    now = now_utc()
    need_manager(conn, viewer, seen, "ticket.rfq.vendor_remove", rid)
    row = apply_due(conn, dict(seen.row), now)
    v = vendor_of(conn, seen, rfq_vendor_id)
    if row["revision"] != revision:
        raise _stale(conn, row)
    if row["state"] in ENDED or v["state"] in ("removed", "awarded") or _award_live_of_vendor(conn, v["id"]):
        raise _bad_move(conn, row, "vendor_remove", now)
    at = iso(now)
    for q in store_rfq.quotes_of_vendor(conn, v["id"]):
        if q["state"] == "submitted":
            store_quotes.update_quote(conn, q["id"], {"state": "withdrawn"}, now=at)
            store_quotes.insert_decision(conn, {"quote_id": q["id"], "action": "withdrawn", "by_user": viewer.uid, "at": at})
    rfq_links.revoke(conn, store_rfq.link_of_vendor(conn, v["id"]), "removed", now)
    store_rfq.update_vendor(conn, v["id"], {"state": "removed", "removed_at": at, "updated_at": at})
    _touch(conn, row, {}, revision, now)
    store_rfq.insert_event(conn, row["id"], "vendor_removed", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           rfq_vendor_id=v["id"], at=at)
    _audit(conn, viewer, "ticket.rfq.vendor_remove", row, rid, vendor_id=v["id"])


def vendor_options(conn, viewer: Viewer, seen: RfqSeen, rfq_vendor_id: str, revision: int, *, require_code: Any = None, channel: Any = None,
                   rid: str | None = None) -> list[str]:
    """TKRFQVP (contract 15.6): the manager's per-vendor choices after creation - the verification code (until the vendor is awarded /
    removed; it reaches the live link at once) and, for a vendor not invited yet, the invitation channel."""
    now = now_utc()
    need_manager(conn, viewer, seen, "ticket.rfq.vendor_options", rid)
    row = apply_due(conn, dict(seen.row), now)
    v = vendor_of(conn, seen, rfq_vendor_id)
    if row["revision"] != revision:
        raise _stale(conn, row)
    if row["state"] in ENDED or v["state"] in ("removed", "awarded", "not_awarded"):
        raise _bad_move(conn, row, "vendor_options", now)
    if require_code is not None and not isinstance(require_code, bool):
        raise invalid(conn, "require_code", "type")
    fields: dict[str, Any] = {}
    if channel is not None:
        if v["state"] != "draft":
            raise _err(conn, 409, "rfq_field_locked", fields=["channel"])
        choice = _choice(conn, channel)
        if choice != v.get("channel_choice"):
            fields["channel_choice"] = choice
    if require_code is not None and bool(require_code) != bool(v["require_code"]):
        if not require_code and _require_code(conn, store_links.contact(conn, v["contact_id"]) or {}):
            raise _err(conn, 409, "vendor_code_locked")
        fields["require_code"] = 1 if require_code else 0
    changed = sorted(fields)
    if not changed:
        return []
    at = iso(now)
    store_rfq.update_vendor(conn, v["id"], {**fields, "updated_at": at})
    if "require_code" in fields:
        store_rfq.set_vendor_code(conn, v["id"], bool(fields["require_code"]))
    _touch(conn, row, {}, revision, now)
    store_rfq.insert_event(conn, row["id"], "vendor_options", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           rfq_vendor_id=v["id"], data={"fields": changed, "require_code": bool(fields.get("require_code", v["require_code"]))}, at=at)
    _audit(conn, viewer, "ticket.rfq.vendor_options", row, rid, vendor_id=v["id"], fields=changed,
           require_code=bool(fields.get("require_code", v["require_code"])), channel=fields.get("channel_choice"))
    return changed


# ---------------------------------------------------------------- messages through the outbox (templates only)

def vendor_page_ready(conn) -> bool:
    return bool(VENDOR_PAGE) and access.public_ready(conn)


def _local(conn, value: str | None, fmt: str) -> str:
    at = parse(value)
    if at is None:
        return ""
    from .messaging import time_zone

    return at.astimezone(time_zone(conn)).strftime(fmt)


def message_params(conn, row: Mapping[str, Any], contact: Mapping[str, Any]) -> dict[str, str]:
    """The placeholders of an RFQ message (never {link}, a phone number, an address or an amount)."""
    lang = contact.get("lang") if contact.get("lang") in FLEXIBLE else "he"
    a, b = _local(conn, row.get("work_from"), "%d.%m"), _local(conn, row.get("work_to"), "%d.%m")
    window = (a if a == b or not b else f"{a}-{b}" if a else b) or FLEXIBLE[lang]
    dept = store.department_any(conn, row["department_id"]) or {}
    return {"name": "" if contact.get("erased_at") else (contact.get("display_name") or ""), "number": str(row["number"]),
            "title": row.get("title") or "", "place": row.get("place_text") or location_value(row), "department": dept.get("name") or "",
            "organization": settings_doc.read(conn).get("organization_name") or "", "due": _local(conn, row.get("due_at"), "%d.%m %H:%M"),
            "window": window, "files": rfq_attach.files_param(conn, row["id"], lang),  # RFQATT: "N files attached" - a count only
            **({"location": location_value(row)} if row.get("location_snapshot") else {})}


def _enqueue(conn, *, purpose: str, row: Mapping[str, Any], vendor: Mapping[str, Any], contact: Mapping[str, Any], channel: str,
             link_id: str | None, requested_by: str, idempotency_key: str) -> str | None:
    from .messaging import RUNTIME

    if RUNTIME.outbox is None:
        return None
    queued = RUNTIME.enqueue(conn, purpose=purpose, contact_id=contact["id"], link_id=link_id, department_id=row["department_id"],
                             params=message_params(conn, row, contact), channel=channel, requested_by=requested_by,
                             idempotency_key=idempotency_key, rfq_id=row["id"])
    return getattr(queued, "id", None)


def _plan(conn, contact: Mapping[str, Any]) -> str:
    from .messaging import RUNTIME, plan_channel

    return plan_channel(conn, contact, RUNTIME.data_dir)


def _code_channel(conn, contact: Mapping[str, Any], sent_via: str) -> str | None:
    from .code_flow import code_channel_for

    return code_channel_for(conn, dict(contact), link_sent_via=sent_via)


def send(conn, viewer: Viewer, seen: RfqSeen, revision: int, channel: str = "auto", rid: str | None = None,
         location_nav: bool | None = None) -> dict[str, Any]:
    """Every `draft` vendor is invited: by WhatsApp / e-mail through the outbox (a personal link, template `rfq_invite`) or by hand
    (`manual`: no link, no message). The first send moves the request to `sent`. All checks run before the first write."""
    now = now_utc()
    need_manager(conn, viewer, seen, "ticket.rfq.send", rid)
    row = apply_due(conn, dict(seen.row), now)
    if row["revision"] != revision:
        raise _stale(conn, row)
    if row["state"] not in ("draft", "sent", "collecting"):
        raise (_err(conn, 409, "rfq_due_passed") if row["state"] == "due_passed" else _bad_move(conn, row, "send", now))
    if _due_passed(row, now):
        raise _err(conn, 409, "rfq_due_passed")
    todo = [v for v in store_rfq.vendors_of(conn, row["id"]) if v["state"] == "draft"]
    if not todo:
        raise _err(conn, 409, "rfq_no_vendors")
    plans: list[tuple[dict[str, Any], dict[str, Any], str]] = []
    for v in todo:
        contact = store_links.contact(conn, v["contact_id"])
        problem = vendor_problem(conn, contact, row["department_id"])
        if problem:
            raise _err(conn, 409, "vendor_not_allowed", reason=problem, vendor_id=v["id"])
        choice = v.get("channel_choice") or "auto"
        if channel == "manual" or choice == "manual":
            planned = "manual"
        elif choice in ("whatsapp", "email"):
            planned = _plan(conn, {**(contact or {}), "preferred_channel": choice})  # the manager's choice, under the channel rules
        else:
            planned = _plan(conn, contact or {})
        if planned != "manual" and not vendor_page_ready(conn):
            raise _err(conn, 409, "rfq_vendor_page_unavailable", vendor_id=v["id"])
        if planned != "manual" and v["require_code"] and _code_channel(conn, contact or {}, planned) is None:
            raise _err(conn, 409, "code_channel_unavailable", vendor_id=v["id"])  # 15.2: never a code-protected link nobody can open
        plans.append((v, contact or {}, planned))
    at = iso(now)
    if location_nav is not None and row.get("location_snapshot"):
        # owner answer 17.10 (c): the preview dialog's "add the navigation link" switch, for THIS request's messages (default off)
        row["location_nav"] = 1 if location_nav else 0
        store_rfq.update_rfq(conn, row["id"], {"location_nav": row["location_nav"]}, bump=False)
    counts: Counter[str] = Counter()
    for v, contact, planned in plans:
        if planned != "manual":
            try:
                link = rfq_links.mint(conn, rfq=row, vendor=v, now=now)
            except Exception:  # noqa: BLE001 - ModuleKeyError / no public address: nothing was sent (the transaction rolls back)
                raise _err(conn, 409, "public_link_unavailable") from None
            _enqueue(conn, purpose="rfq_invite", row=row, vendor=v, contact=contact, channel=planned, link_id=link["id"], requested_by=viewer.uid,
                     idempotency_key=f"rfqinv:{v['id']}:{link['generation']}")
        store_rfq.update_vendor(conn, v["id"], {"state": "sent", "channel": planned, "sent_at": at, "updated_at": at})
        counts[planned] += 1
    fields: dict[str, Any] = {}
    if row["state"] == "draft":
        fields = {"state": "sent", "sent_at": at}
    _touch(conn, row, fields, revision, now)
    store_rfq.insert_event(conn, row["id"], "sent", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           data={"vendors": len(plans), "channels": dict(counts)}, at=at)
    _audit(conn, viewer, "ticket.rfq.send", row, rid, vendors=len(plans), channels=dict(counts))
    return {"vendors": len(plans), "channels": dict(counts)}


def remind(conn, viewer: Viewer, seen: RfqSeen, vendor_ids: Sequence[str] | None, rid: str | None = None) -> dict[str, int]:
    """A manual reminder (template `rfq_reminder`) to vendors who did not answer; one per vendor per hour (a repeat in the same hour
    returns the queued row - the outbox idempotency key). Vendors reached by hand are counted, never messaged."""
    now = now_utc()
    need_manager(conn, viewer, seen, "ticket.rfq.remind", rid)
    row = apply_due(conn, dict(seen.row), now)
    if row["state"] not in ("sent", "collecting"):
        raise _bad_move(conn, row, "remind", now)
    vendors = store_rfq.vendors_of(conn, row["id"])
    if vendor_ids is not None:
        known = {v["id"] for v in vendors}
        if any(vid not in known for vid in vendor_ids):
            raise _err(conn, 404, "vendor_not_found")
        vendors = [v for v in vendors if v["id"] in set(vendor_ids)]
    out = {"queued": 0, "manual": 0, "skipped": 0}
    bucket = now.strftime("%Y%m%d%H")
    for v in vendors:
        if v["state"] not in ("sent", "opened"):
            out["skipped"] += 1
            continue
        link = store_rfq.link_of_vendor(conn, v["id"])
        contact = store_links.contact(conn, v["contact_id"]) or {}
        if v["channel"] == "manual" or link is None or rfq_links.state(link, now) != "live" or not vendor_page_ready(conn):
            out["manual"] += 1
            continue
        planned = _plan(conn, contact)
        if planned == "manual":
            out["manual"] += 1
            continue
        _enqueue(conn, purpose="rfq_reminder", row=row, vendor=v, contact=contact, channel=planned, link_id=link["id"], requested_by=viewer.uid,
                 idempotency_key=f"rfqrem:{v['id']}:{bucket}")
        out["queued"] += 1
    store_rfq.insert_event(conn, row["id"], "reminder", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer), data=out,
                           at=iso(now))
    _audit(conn, viewer, "ticket.rfq.remind", row, rid, **out)
    return out


def revoke_link(conn, viewer: Viewer, seen: RfqSeen, rfq_vendor_id: str, rid: str | None = None) -> bool:
    now = now_utc()
    need_manager(conn, viewer, seen, "ticket.rfq.link_revoke", rid)
    v = vendor_of(conn, seen, rfq_vendor_id)
    done = rfq_links.revoke(conn, store_rfq.link_of_vendor(conn, v["id"]), "manual", now)
    if done:
        store_rfq.insert_event(conn, seen.row["id"], "link_revoked", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                               rfq_vendor_id=v["id"], data={"reason": "manual"}, at=iso(now))
    _audit(conn, viewer, "ticket.rfq.link_revoke", seen.row, rid, vendor_id=v["id"], revoked=done)
    return done


# ---------------------------------------------------------------- quotes (an RFQ quote is a ticket_quotes row with rfq_vendor_id)

def live_quote(conn, rfq_vendor_id: str) -> dict[str, Any] | None:
    qs = [q for q in store_rfq.quotes_of_vendor(conn, rfq_vendor_id) if q["state"] in LIVE_QUOTE]
    return qs[-1] if qs else None


def _award_live_of_vendor(conn, rfq_vendor_id: str) -> dict[str, Any] | None:
    v = store_rfq.vendor(conn, rfq_vendor_id)
    if v is None:
        return None
    return next((a for a in store_rfq.awards_of(conn, v["rfq_id"]) if a["rfq_vendor_id"] == rfq_vendor_id and a["state"] in ("pending_second", "approved")),
                None)


def allowed_kinds(row: Mapping[str, Any]) -> list[str]:
    return quotes.kinds_json(row.get("allowed_line_kinds")) or ["labor", "parts"]


def submit_quote(conn, viewer: Viewer, seen: RfqSeen, rfq_vendor_id: str, body: Mapping[str, Any], rid: str | None = None) -> dict[str, Any]:
    """A quote entered on the vendor's behalf (stage C2 adds the vendor's own through the link, with the same rules). A new version
    supersedes the vendor's submitted one. Only the request's allowed line kinds; money is computed here."""
    now = now_utc()
    need_manager(conn, viewer, seen, "ticket.rfq.quote_on_behalf", rid)
    need_costs(conn, viewer, seen, "ticket.rfq.quote_on_behalf", rid)
    row = apply_due(conn, dict(seen.row), now)
    v = vendor_of(conn, seen, rfq_vendor_id)
    if row["state"] not in OPEN and row["state"] != "awarded":
        raise _err(conn, 409, "quote_not_open")
    if v["state"] in ("draft", "removed", "awarded", "not_awarded") or _award_live_of_vendor(conn, v["id"]):
        raise _err(conn, 409, "quote_not_open")
    s = cost_settings(conn)
    currency = body.get("currency") or s.currencies[0]
    if currency not in s.currencies:
        raise invalid(conn, "currency", "unknown")
    try:
        vat_mode = quotes._vat_mode(conn, v["contact_id"], body.get("amounts_include_vat"))
        c = quotes.compute_lines(conn, body.get("lines"), allowed_kinds(row), vat_mode)
        work_from = quotes._instant(body.get("work_from"), "work_from", now)
        work_to = quotes._instant(body.get("work_to"), "work_to", now)
        note = quotes._text(body.get("note"), "note", quotes.NOTE_MAX, multiline=True)
        vendor_ref = quotes._text(body.get("vendor_ref"), "vendor_ref", quotes.VENDOR_REF_MAX)
        plan_json = rfq_terms.quote_plan(conn, body, now)  # CR-RFQ-PAYMENT-SCHEDULE: the vendor's proposed instalments (switch on)
    except CostRefused as exc:
        raise invalid(conn, exc.field or "body", exc.code) from None
    if work_from and work_to and work_to < work_from:
        raise invalid(conn, "work_to", "order")
    at = iso(now)
    existing = store_rfq.quotes_of_vendor(conn, v["id"])
    previous = None
    for q in existing:
        if q["state"] == "submitted":
            store_quotes.update_quote(conn, q["id"], {"state": "superseded"}, now=at)
            store_quotes.insert_decision(conn, {"quote_id": q["id"], "action": "superseded", "by_user": viewer.uid, "at": at})
            previous = q["id"]
    extra = {"payment_plan_json": plan_json} if plan_json else {}
    version = store_rfq.next_version_of_vendor(conn, v["id"])
    qid = store_quotes.insert_quote(conn, {
        "ticket_id": None, "rfq_vendor_id": v["id"], "assignment_id": None, "contact_id": v["contact_id"], "department_id": row["department_id"],
        "version": version, "supersedes_id": previous or (existing[-1]["id"] if existing else None), "source": "manager", "state": "submitted",
        "currency": currency, "vat_mode": c.vat_mode, "vat_rate_bp": c.vat_rate_bp, "lines_json": [ln.as_json() for ln in c.lines],
        "labor_minor": c.by_kind["labor"], "parts_minor": c.by_kind["parts"], "travel_minor": c.by_kind["travel"], "other_minor": c.by_kind["other"],
        "subtotal_minor": c.subtotal_minor, "vat_minor": c.vat_minor, "total_minor": c.total_minor, "work_from": work_from, "work_to": work_to,
        "note": note, "vendor_ref": vendor_ref, "created_by_kind": "user", "created_by": viewer.uid, "created_at": at, "updated_at": at, **extra})
    store_rfq.update_vendor(conn, v["id"], {"state": "quoted", "quoted_at": at, "updated_at": at})
    fields = {"state": "collecting"} if row["state"] == "sent" else {}
    _touch(conn, row, fields, None, now)
    late = _due_passed(row, now)
    store_rfq.insert_event(conn, row["id"], "quote_submitted", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           rfq_vendor_id=v["id"], data={"quote_id": qid, "version": version, "on_behalf": True, "late": late}, at=at)
    _audit(conn, viewer, "ticket.rfq.quote_on_behalf", row, rid, vendor_id=v["id"], quote_id=qid, version=version, total_minor=c.total_minor,
           currency=currency)
    return store_quotes.quote(conn, qid) or {}


def quote_of(conn, seen: RfqSeen, v: Mapping[str, Any], quote_id: str) -> dict[str, Any]:
    q = store_quotes.quote(conn, quote_id)
    if q is None or q.get("rfq_vendor_id") != v["id"]:
        raise _err(conn, 404, "quote_not_found")
    return q


def withdraw_quote(conn, viewer: Viewer, seen: RfqSeen, rfq_vendor_id: str, quote_id: str, revision: int, rid: str | None = None) -> None:
    now = now_utc()
    need_manager(conn, viewer, seen, "ticket.rfq.quote_withdraw", rid)
    need_costs(conn, viewer, seen, "ticket.rfq.quote_withdraw", rid)
    v = vendor_of(conn, seen, rfq_vendor_id)
    q = quote_of(conn, seen, v, quote_id)
    if int(q["revision"]) != int(revision):
        raise _err(conn, 409, "quote_stale", revision=q["revision"])
    if any(a["quote_id"] == q["id"] and a["state"] == "pending_second" for a in store_rfq.awards_of(conn, seen.row["id"])):
        raise _err(conn, 409, "award_pending")
    if q["state"] != "submitted":
        raise _err(conn, 409, "quote_not_open")
    at = iso(now)
    if not store_quotes.update_quote(conn, q["id"], {"state": "withdrawn"}, now=at, expect_revision=int(revision)):
        raise _err(conn, 409, "quote_stale", revision=q["revision"])
    store_quotes.insert_decision(conn, {"quote_id": q["id"], "action": "withdrawn", "by_user": viewer.uid, "at": at})
    if v["state"] == "quoted" and live_quote(conn, v["id"]) is None:
        store_rfq.update_vendor(conn, v["id"], {"state": "withdrawn", "updated_at": at})
    _touch(conn, seen.row, {}, None, now)
    store_rfq.insert_event(conn, seen.row["id"], "quote_withdrawn", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           rfq_vendor_id=v["id"], data={"quote_id": q["id"], "version": q["version"], "on_behalf": True}, at=at)
    _audit(conn, viewer, "ticket.rfq.quote_withdraw", seen.row, rid, vendor_id=v["id"], quote_id=q["id"], version=q["version"])


def decline(conn, viewer: Viewer, seen: RfqSeen, rfq_vendor_id: str, reason: Any, rid: str | None = None) -> None:
    """The vendor said "not interested" (phoned): recorded on his behalf. Never a message."""
    now = now_utc()
    need_manager(conn, viewer, seen, "ticket.rfq.decline_on_behalf", rid)
    need_costs(conn, viewer, seen, "ticket.rfq.decline_on_behalf", rid)
    row = apply_due(conn, dict(seen.row), now)
    v = vendor_of(conn, seen, rfq_vendor_id)
    if row["state"] in ENDED or row["state"] == "draft" or v["state"] not in ("sent", "opened", "expired", "withdrawn"):
        raise _bad_move(conn, row, "decline", now)
    if live_quote(conn, v["id"]) is not None:
        raise _err(conn, 409, "vendor_has_quote")
    why = _text_field(conn, reason, "reason", DECLINE_MAX) or None
    at = iso(now)
    store_rfq.update_vendor(conn, v["id"], {"state": "declined", "declined_at": at, "decline_reason": why, "updated_at": at})
    _touch(conn, row, {"state": "collecting"} if row["state"] == "sent" else {}, None, now)
    store_rfq.insert_event(conn, row["id"], "declined", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           rfq_vendor_id=v["id"], data={"on_behalf": True}, at=at)
    _audit(conn, viewer, "ticket.rfq.decline_on_behalf", row, rid, vendor_id=v["id"])


# ---------------------------------------------------------------- the award (single approval; optional second approval)

def chain_level(viewer: Viewer, row: Mapping[str, Any]) -> int:
    """The department's approval chain: member (0) < department manager (1) < all-departments holder (2)."""
    if viewer.holds(ALL_DEPARTMENTS, dict(row)):
        return 2
    return 1 if viewer.role(row["department_id"]) == "manager" else 0


def _user_viewer(conn, user_id: str) -> Viewer:
    from .service import _user_viewer as uv

    return uv(conn, user_id)


def second_approvers(conn, row: Mapping[str, Any], first_by: str, quote: Mapping[str, Any] | None = None) -> list[str]:
    """Who may give the second approval: an active user, not the first approver, not the requester (the creator) and not the user who
    entered the quote on the vendor's behalf, who may decide costs where the request lies, sees the request, and stands ABOVE the
    requester in the department's chain. An empty list = the chain ends at the requester: the first approval is final (owner decision
    16.10 - the system never waits for an approver who does not exist)."""
    requester = row["created_by"]
    req_level = chain_level(_user_viewer(conn, requester), row) if store.user_is_active(conn, requester) else 0
    excluded = {first_by, requester}
    if quote is not None and quote.get("created_by_kind") == "user":
        excluded.add(quote["created_by"])
    out = []
    for uid in store_rfq.active_user_ids(conn):
        if uid in excluded:
            continue
        uv = _user_viewer(conn, uid)
        if not (uv.holds(COSTS, dict(row)) and uv.holds(COSTS_VIEW, dict(row))):
            continue
        if visible(uv, dict(row)) is None:
            continue
        if chain_level(uv, row) > req_level:
            out.append(uid)
    return out


def _lines_for(conn, q: Mapping[str, Any], line_indexes: Sequence[int] | None, kinds: Sequence[str] | None) -> list[int]:
    lines = quotes.lines_of(q)
    if line_indexes is not None and kinds is not None:
        raise invalid(conn, "line_indexes", "conflict")
    if kinds is not None:
        wanted = set(kinds)
        if not wanted or not wanted <= set(money.LINE_KINDS):
            raise invalid(conn, "kinds", "invalid")
        idx = [i for i, ln in enumerate(lines) if ln.get("kind") in wanted]
        if not idx:
            raise invalid(conn, "kinds", "empty")
        return idx
    if line_indexes is None:
        return list(range(len(lines)))
    if not line_indexes or len(set(line_indexes)) != len(line_indexes) or any(
            isinstance(i, bool) or not isinstance(i, int) or not 0 <= i < len(lines) for i in line_indexes):
        raise invalid(conn, "line_indexes", "invalid")
    return sorted(line_indexes)


def _not_awarded(conn, row: Mapping[str, Any], keep_vendor_ids: set[str], by: str, at: str) -> int:
    """Silently (owner decision: no message to vendors who were not selected): every live quote of the other vendors becomes
    `not_awarded` and so does the vendor."""
    n = 0
    for v in store_rfq.vendors_of(conn, row["id"]):
        if v["id"] in keep_vendor_ids:
            continue
        for q in store_rfq.quotes_of_vendor(conn, v["id"]):
            if q["state"] == "submitted":
                store_quotes.update_quote(conn, q["id"], {"state": "not_awarded"}, now=at)
                store_quotes.insert_decision(conn, {"quote_id": q["id"], "action": "not_awarded", "by_user": by, "at": at})
                n += 1
        if v["state"] == "quoted":
            store_rfq.update_vendor(conn, v["id"], {"state": "not_awarded", "updated_at": at})
    return n


def _finalize(conn, viewer: Viewer, row: Mapping[str, Any], award: Mapping[str, Any], now: dt.datetime) -> dict[str, Any]:
    q = store_quotes.quote(conn, award["quote_id"]) or {}
    idx = json.loads(award["line_indexes_json"])
    try:
        fresh = quotes.decide(conn, q, "approve", by=viewer.uid, revision=int(q["revision"]), at=now, line_indexes=idx, actor_name=actor_name(viewer))
    except CostRefused as exc:
        raise _err(conn, exc.status, exc.code if exc.code in MESSAGES else "quote_not_open") from None
    at = iso(now)
    second = bool(award["second_required"])
    store_rfq.update_award(conn, award["id"], {"state": "approved", "updated_at": at,
                                               **({"second_by": viewer.uid, "second_at": at} if second else {})})
    store_rfq.update_vendor(conn, award["rfq_vendor_id"], {"state": "awarded", "updated_at": at})
    rfq_terms.activate(conn, award, q, by_kind="user", by=viewer.uid, by_name=actor_name(viewer), now=now)  # the schedule -> the quote
    fields: dict[str, Any] = {"state": "awarded"} if row["state"] != "awarded" else {}
    if row["state"] != "awarded":
        fields["awarded_at"] = at
    _touch(conn, row, fields, None, now)
    not_awarded = 0
    if award["finalize"]:
        awarded = {a["rfq_vendor_id"] for a in store_rfq.awards_of(conn, row["id"]) if a["state"] == "approved"}
        not_awarded = _not_awarded(conn, row, awarded, viewer.uid, at)
    store_rfq.insert_event(conn, row["id"], "awarded", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           rfq_vendor_id=award["rfq_vendor_id"], data={"award_id": award["id"], "quote_id": q.get("id"), "version": q.get("version"),
                                                                      "state": fresh["state"], "second": second, "not_awarded": not_awarded}, at=at)
    rfq_notify.ended(conn, row["id"])  # TKRFQ5: no more answers can arrive - the request's notifications are over
    return fresh


def award(conn, viewer: Viewer, seen: RfqSeen, *, quote_id: str, revision: int, line_indexes: Sequence[int] | None,
          kinds: Sequence[str] | None, finalize: bool, rid: str | None = None, payment: Any = None, arrival: Any = None,
          payment_source: str | None = None) -> dict[str, Any]:
    """`payment` / `payment_source` / `arrival` (CR-RFQ-PAYMENT-SCHEDULE, switch on): the manager's plan, or his explicit choice of the
    vendor's proposal (`vendor`) or the default single final instalment (`default`) - REQUIRED when the vendor proposed instalments
    (review F1, `rfq_terms.prepare`) - and the planned arrival window (omitted = the quote's / request's window)."""
    now = now_utc()
    need_costs(conn, viewer, seen, "ticket.rfq.award", rid)
    row = apply_due(conn, dict(seen.row), now)
    q = store_quotes.quote(conn, quote_id)
    v = store_rfq.vendor(conn, (q or {}).get("rfq_vendor_id"))
    if q is None or v is None or v["rfq_id"] != row["id"]:
        raise _err(conn, 404, "quote_not_found")
    if row["state"] not in OPEN and row["state"] != "awarded":
        raise _bad_move(conn, row, "award", now)
    awards = store_rfq.awards_of(conn, row["id"])
    if any(a["state"] == "pending_second" for a in awards):
        raise _err(conn, 409, "award_pending")
    if int(q["revision"]) != int(revision):
        raise _err(conn, 409, "quote_stale", revision=q["revision"])
    if q["state"] != "submitted" or v["state"] in ("removed", "awarded", "not_awarded"):
        raise _err(conn, 409, "quote_not_open")
    if q["created_by_kind"] == "user" and q["created_by"] == viewer.uid:
        raise _err(conn, 409, "self_approval")
    idx = _lines_for(conn, q, line_indexes, kinds)
    chosen = [money.line_from_json(quotes.lines_of(q)[i]) for i in idx]
    c = money.compute(chosen, q["vat_mode"], int(q["vat_rate_bp"]))
    threshold = store_rfq.department_threshold(conn, row["department_id"])
    second = bool(threshold is not None and c.total_minor > threshold and second_approvers(conn, row, viewer.uid, q))
    try:  # every refusal of the schedule / arrival before the first write
        terms = rfq_terms.prepare(conn, row, q, total_minor=c.total_minor, currency=q["currency"], payment=payment, arrival=arrival, now=now,
                                  payment_source=payment_source)
    except CostRefused as exc:
        raise invalid(conn, exc.field or "payment", exc.code) from None
    at = iso(now)
    aid = store_rfq.insert_award(conn, {
        "rfq_id": row["id"], "rfq_vendor_id": v["id"], "quote_id": q["id"], "state": "pending_second" if second else "approved",
        "line_indexes_json": store_rfq.dumps(idx), "finalize": 1 if finalize else 0, "currency": q["currency"],
        "approved_subtotal_minor": c.subtotal_minor, "approved_vat_minor": c.vat_minor, "approved_total_minor": c.total_minor,
        "second_required": 1 if second else 0, "threshold_minor": threshold, "first_by": viewer.uid, "first_at": at, "created_at": at,
        "updated_at": at})
    rfq_terms.store_prepared(conn, terms, aid, v["id"], now)
    a = store_rfq.award(conn, aid) or {}
    if second:
        _touch(conn, row, {}, None, now)
        store_rfq.insert_event(conn, row["id"], "award_pending", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                               rfq_vendor_id=v["id"], data={"award_id": aid, "quote_id": q["id"], "version": q["version"]}, at=at)
        fresh = q
    else:
        a = {**a, "state": "pending_second"}  # _finalize moves it to approved (one code path)
        fresh = _finalize(conn, viewer, row, a, now)
    _audit(conn, viewer, "ticket.rfq.award", row, rid, award_id=aid, vendor_id=v["id"], quote_id=q["id"], version=q["version"],
           state="pending_second" if second else fresh["state"], approved_total_minor=c.total_minor, second_required=second,
           **({"schedule_source": terms["schedule_source"]} if terms else {}))
    return {"award": store_rfq.award(conn, aid), "quote": store_quotes.quote(conn, q["id"]), "vendor_id": v["id"]}


def award_of(conn, seen: RfqSeen, award_id: str) -> dict[str, Any]:
    a = store_rfq.award(conn, award_id)
    if a is None or a["rfq_id"] != seen.row["id"]:
        raise _err(conn, 404, "award_not_found")
    return a


def confirm(conn, viewer: Viewer, seen: RfqSeen, award_id: str, revision: int, rid: str | None = None) -> dict[str, Any]:
    now = now_utc()
    need_costs(conn, viewer, seen, "ticket.rfq.award_confirm", rid)
    a = award_of(conn, seen, award_id)
    if int(a["revision"]) != int(revision):
        raise _err(conn, 409, "rfq_stale", revision=a["revision"])
    if a["state"] != "pending_second":
        raise _bad_move(conn, seen.row, "award_confirm", now)
    if viewer.uid not in second_approvers(conn, seen.row, a["first_by"], store_quotes.quote(conn, a["quote_id"])):
        raise _err(conn, 409, "second_approver_required")
    row = dict(seen.row)
    fresh = _finalize(conn, viewer, row, a, now)
    _audit(conn, viewer, "ticket.rfq.award_confirm", row, rid, award_id=a["id"], quote_id=a["quote_id"], state=fresh["state"],
           approved_total_minor=a["approved_total_minor"])
    return {"award": store_rfq.award(conn, a["id"]), "quote": store_quotes.quote(conn, a["quote_id"]), "vendor_id": a["rfq_vendor_id"]}


def decline_award(conn, viewer: Viewer, seen: RfqSeen, award_id: str, revision: int, reason: Any, rid: str | None = None) -> None:
    now = now_utc()
    need_costs(conn, viewer, seen, "ticket.rfq.award_decline", rid)
    a = award_of(conn, seen, award_id)
    if int(a["revision"]) != int(revision):
        raise _err(conn, 409, "rfq_stale", revision=a["revision"])
    if a["state"] != "pending_second":
        raise _bad_move(conn, seen.row, "award_decline", now)
    if viewer.uid not in second_approvers(conn, seen.row, a["first_by"], store_quotes.quote(conn, a["quote_id"])):
        raise _err(conn, 409, "second_approver_required")
    why = _text_field(conn, reason, "reason", REASON_MAX, required=True, multiline=True)
    at = iso(now)
    store_rfq.update_award(conn, a["id"], {"state": "declined", "second_by": viewer.uid, "second_at": at, "decline_reason": why, "updated_at": at})
    rfq_terms.drop(conn, a["id"])  # a declined award agreed nothing
    _touch(conn, seen.row, {}, None, now)
    store_rfq.insert_event(conn, seen.row["id"], "award_declined", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           rfq_vendor_id=a["rfq_vendor_id"], data={"award_id": a["id"]}, at=at)
    _audit(conn, viewer, "ticket.rfq.award_decline", seen.row, rid, award_id=a["id"])


# ---------------------------------------------------------------- cancel / close

def cancel(conn, viewer: Viewer, seen: RfqSeen, revision: int, reason: Any, notify: bool, rid: str | None = None) -> dict[str, int]:
    """Before any award. Owner decision 2: vendors whose invitation went through the system and who already quoted get the short
    templated notice `rfq_cancelled` (`notify: false` skips it). Their quotes become `not_awarded`."""
    now = now_utc()
    need_manager(conn, viewer, seen, "ticket.rfq.cancel", rid)
    row = apply_due(conn, dict(seen.row), now)
    if row["revision"] != revision:
        raise _stale(conn, row)
    if row["state"] not in ("draft",) + tuple(OPEN):
        raise (_err(conn, 409, "rfq_has_award") if row["state"] in ("awarded", "ordered") else _bad_move(conn, row, "cancel", now))
    if any(a["state"] in ("pending_second", "approved") for a in store_rfq.awards_of(conn, row["id"])):
        raise _err(conn, 409, "rfq_has_award")
    why = _text_field(conn, reason, "reason", REASON_MAX, multiline=True) or None
    at = iso(now)
    store_rfq.cancel_open_outbox(conn, row["id"], at)
    notified = 0
    for v in store_rfq.vendors_of(conn, row["id"]):
        if not (notify and v["channel"] in ("whatsapp", "email") and live_quote(conn, v["id"]) is not None):
            continue
        contact = store_links.contact(conn, v["contact_id"]) or {}
        planned = _plan(conn, contact) if contact and not contact.get("erased_at") else "manual"
        if planned == "manual":
            continue
        link = store_rfq.link_of_vendor(conn, v["id"])
        _enqueue(conn, purpose="rfq_cancelled", row=row, vendor=v, contact=contact, channel=planned, link_id=(link or {}).get("id"),
                 requested_by=viewer.uid, idempotency_key=f"rfqcancel:{v['id']}")
        notified += 1
    for v in store_rfq.vendors_of(conn, row["id"]):
        for q in store_rfq.quotes_of_vendor(conn, v["id"]):
            if q["state"] == "submitted":
                store_quotes.update_quote(conn, q["id"], {"state": "not_awarded"}, now=at)
                store_quotes.insert_decision(conn, {"quote_id": q["id"], "action": "not_awarded", "by_user": viewer.uid, "at": at})
    rfq_links.on_end(conn, row["id"], "cancelled", now)
    _touch(conn, row, {"state": "cancelled", "cancelled_at": at, "closed_at": at, "cancel_reason": why}, revision, now)
    rfq_notify.ended(conn, row["id"])
    store_rfq.insert_event(conn, row["id"], "cancelled", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           data={"notified": notified}, at=at)
    _audit(conn, viewer, "ticket.rfq.cancel", row, rid, notified=notified)
    return {"notified": notified}


def close(conn, viewer: Viewer, seen: RfqSeen, revision: int, rid: str | None = None) -> dict[str, int]:
    """Ends the request: remaining live quotes become `not_awarded` silently; links turn read-only for the grace. Never a message."""
    now = now_utc()
    need_manager(conn, viewer, seen, "ticket.rfq.close", rid)
    row = apply_due(conn, dict(seen.row), now)
    if row["revision"] != revision:
        raise _stale(conn, row)
    if row["state"] not in tuple(OPEN) + ("awarded", "ordered"):
        raise _bad_move(conn, row, "close", now)
    if any(a["state"] == "pending_second" for a in store_rfq.awards_of(conn, row["id"])):
        raise _err(conn, 409, "award_pending")
    at = iso(now)
    awarded = {a["rfq_vendor_id"] for a in store_rfq.awards_of(conn, row["id"]) if a["state"] == "approved"}
    n = _not_awarded(conn, row, awarded, viewer.uid, at)
    store_rfq.cancel_open_outbox(conn, row["id"], at)
    rfq_links.on_end(conn, row["id"], "closed", now)
    _touch(conn, row, {"state": "closed", "closed_at": at}, revision, now)
    rfq_notify.ended(conn, row["id"])
    store_rfq.insert_event(conn, row["id"], "closed", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           data={"not_awarded": n, "awarded": len(awarded)}, at=at)
    _audit(conn, viewer, "ticket.rfq.close", row, rid, not_awarded=n, awarded=len(awarded))
    return {"not_awarded": n}


# ---------------------------------------------------------------- the private thread with a vendor

def write_message(conn, viewer: Viewer, seen: RfqSeen, rfq_vendor_id: str, body: Any, notify: bool, source: Mapping[str, Any] | None,
                  rid: str | None = None) -> dict[str, Any]:
    """Stored in the vendor's private thread (the vendor page shows it in stage C2). With `notify`, a live link and a channel, the
    templated `rfq_update` ("there is a new message") is queued - the free text itself never travels by WhatsApp / e-mail."""
    now = now_utc()
    need_manager(conn, viewer, seen, "ticket.rfq.message", rid)
    v = vendor_of(conn, seen, rfq_vendor_id)
    if v["state"] in ("draft", "removed"):
        raise _bad_move(conn, seen.row, "message", now)
    msg = _text_field(conn, body, "text", MESSAGE_MAX, required=True, multiline=True)
    if source is not None and source.get("kind") == "award":
        a = store_rfq.award(conn, source.get("id"))
        if a is None or a["rfq_id"] != seen.row["id"] or a["rfq_vendor_id"] != v["id"]:
            raise invalid(conn, "source.id", "not_found")
    kind = (source or {}).get("kind") or "clarify"
    mid, notified = store_out_message(conn, viewer, seen, v, msg, notify, now, source_kind=kind, source_id=(source or {}).get("id"))
    if kind == "award" and notified["queued"]:
        # CR-RFQ-PAYMENT-SCHEDULE: the confirmation clock starts only when the vendor was actually told (review F6: not with notify=false,
        # no live link or a manual channel; `requested` also refuses a pending second approval)
        rfq_terms.requested(conn, (source or {}).get("id"), via="award", now=now)
    if kind == "clarify":  # RFQQUESTIONS: a clarification to the vendor answers his open questions (the TKRFQ5 rule, now stored)
        store_rfq.answer_questions(conn, [q["id"] for q in store_rfq.pending_questions(conn, seen.row["id"]) if q["rfq_vendor_id"] == v["id"]],
                                   by=viewer.uid, at=iso(now), answer_id=mid)
        rfq_notify.answered(conn, seen.row["id"], v["id"])  # TKRFQ5: the vendor's question row is over
    _touch(conn, seen.row, {}, None, now)
    _audit(conn, viewer, "ticket.rfq.message", seen.row, rid, vendor_id=v["id"], message_id=mid, notified=notified["queued"])
    return {"item": present_message(conn, next(m for m in store_rfq.messages_of_vendor(conn, v["id"]) if m["id"] == mid)), "notified": notified}


def store_out_message(conn, viewer: Viewer, seen: RfqSeen, v: Mapping[str, Any], msg: str, notify: bool, now: dt.datetime, *, source_kind: str,
                      source_id: str | None, answers_id: str | None = None, broadcast_id: str | None = None) -> tuple[str, dict[str, Any]]:
    """One outbound thread message (already checked text) + the optional templated `rfq_update` notice + its timeline row. Shared by the
    vendor-message route and RFQQUESTIONS' answers (one copy per vendor)."""
    at = iso(now)
    mid = store_rfq.insert_message(conn, {"rfq_id": seen.row["id"], "rfq_vendor_id": v["id"], "direction": "out", "body": msg, "author_kind": "user",
                                          "author_id": viewer.uid, "source_kind": source_kind, "source_id": source_id, "created_at": at,
                                          "answers_id": answers_id, "broadcast_id": broadcast_id})
    notified: dict[str, Any] = {"queued": False, "channel": None}
    link = store_rfq.link_of_vendor(conn, v["id"])
    contact = store_links.contact(conn, v["contact_id"]) or {}
    if notify and link is not None and rfq_links.state(link, now) == "live" and vendor_page_ready(conn) and not contact.get("erased_at"):
        planned = _plan(conn, contact)
        notified["channel"] = planned
        if planned != "manual":
            oid = _enqueue(conn, purpose="rfq_update", row=seen.row, vendor=v, contact=contact, channel=planned, link_id=link["id"],
                           requested_by=viewer.uid, idempotency_key=f"rfqmsg:{mid}")
            store_rfq.set_message_notified(conn, mid, oid)
            notified["queued"] = True
    data: dict[str, Any] = {"message_id": mid, "notified": notified["queued"]}
    if answers_id:
        data["answers"] = answers_id
    if broadcast_id:
        data["broadcast"] = True
    store_rfq.insert_event(conn, seen.row["id"], "message", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           rfq_vendor_id=v["id"], data=data, at=at)
    return mid, notified


def present_message(conn, m: Mapping[str, Any]) -> dict[str, Any]:
    by = store.display_name(conn, m["author_id"]) if m["author_kind"] == "user" else (store_links.contact(conn, m["author_id"]) or {}).get("display_name", "")
    whatsapp = str(m.get("source_id") or "").startswith("whatsapp:")  # TKRFQ5: a WhatsApp reply matched to the thread (unverified sender)
    out = {"id": m["id"], "direction": m["direction"], "text": m["body"], "at": m["created_at"], "by": by,
           "source": None if whatsapp else ({"kind": m["source_kind"], "id": m["source_id"]} if m.get("source_kind") else None),
           "notified": bool(m["notified"]), "via": "whatsapp" if whatsapp else None, "unverified": whatsapp}
    if m["direction"] == "in":  # RFQQUESTIONS: every inbound message is a question with a state
        out["question"] = {"state": "answered" if m.get("answered_at") else "pending", "read": bool(m.get("read_at")),
                           "answered_at": m.get("answered_at"), "answer_id": m.get("answer_id"), "quote_id": m.get("quote_id")}
    else:
        out["answers_id"] = m.get("answers_id")
        out["to_all"] = bool(m.get("broadcast_id"))
    return out


# ---------------------------------------------------------------- award drafts (never sent by the system)

DRAFTS = {
    "he": {"all": 'שלום {name}, ההצעה שלכם עבור "{title}" אושרה במלואה{window}.',
           "part": 'שלום {name}, ההצעה שלכם עבור "{title}" אושרה חלקית: {kinds}{window}.', "window": " (חלון עבודה: {window})"},
    "en": {"all": 'Hello {name}, your quote for "{title}" was approved in full{window}.',
           "part": 'Hello {name}, your quote for "{title}" was partly approved: {kinds}{window}.', "window": " (work window: {window})"},
    "ar": {"all": 'مرحبًا {name}، تمت الموافقة على عرض السعر الخاص بكم لـ"{title}" بالكامل{window}.',
           "part": 'مرحبًا {name}، تمت الموافقة جزئيًا على عرض السعر الخاص بكم لـ"{title}": {kinds}{window}.', "window": " (موعد العمل: {window})"},
    "ru": {"all": "Здравствуйте, {name}! Ваше предложение по «{title}» утверждено полностью{window}.",
           "part": "Здравствуйте, {name}! Ваше предложение по «{title}» утверждено частично: {kinds}{window}.", "window": " (срок работ: {window})"},
}


TERMS_ASK = {
    "he": "נא לאשר בדף ההצעה את מועד ההגעה לביצוע העבודה (או להציע מועד אחר) ואת לוח התשלומים שאושר.",
    "en": "Please confirm on the quote page the date you will arrive to do the work (or propose another date) and the approved payment schedule.",
    "ar": "يرجى التأكيد في صفحة العرض على موعد وصولكم لتنفيذ العمل (أو اقتراح موعد آخر) وعلى جدول الدفعات المعتمد.",
    "ru": "Пожалуйста, подтвердите на странице предложения дату прибытия для выполнения работ (или предложите другую дату) и утверждённый график платежей.",
}


def award_draft(conn, row: Mapping[str, Any], award_row: Mapping[str, Any]) -> dict[str, Any]:
    """The editable notice of an award in the vendor's language - no amount; the manager may send it with the vendor-message route,
    or not at all (owner decision: an approval never sends a message by itself)."""
    q = store_quotes.quote(conn, award_row["quote_id"]) or {}
    v = store_rfq.vendor(conn, award_row["rfq_vendor_id"]) or {}
    contact = store_links.contact(conn, v.get("contact_id")) or {}
    lang = contact.get("lang") if contact.get("lang") in DRAFTS else "he"
    t = DRAFTS[lang]
    idx = set(json.loads(award_row["line_indexes_json"]))
    lines = quotes.lines_of(q)
    partial = len(idx) != len(lines)
    kinds = ", ".join(quotes.KIND_NAMES[lang][k] for k in money.LINE_KINDS if any(ln.get("kind") == k for i, ln in enumerate(lines) if i in idx))
    a, b = _local(conn, q.get("work_from"), "%d.%m.%Y"), _local(conn, q.get("work_to"), "%d.%m.%Y")
    window = t["window"].format(window=" - ".join(x for x in (a, b) if x)) if (a or b) else ""
    name = "" if contact.get("erased_at") else (contact.get("display_name") or "")
    body = t["part" if partial else "all"].format(name=name, title=clean_text(row.get("title") or ""), kinds=kinds, window=window)
    body = " ".join(body.split()).replace("שלום ,", "שלום,").replace("Hello ,", "Hello,")
    if store_rfq.terms(conn, award_row["id"]) is not None:  # CR-RFQ-PAYMENT-SCHEDULE: he confirms the date and the schedule on the page
        body = f"{body} {TERMS_ASK[lang]}"
    return {"text": body[:MESSAGE_MAX], "lang": lang, "notify_default": True,
            "send": {"route": f"POST /tickets/rfqs/{row['id']}/vendors/{v.get('id')}/messages", "source": {"kind": "award", "id": award_row["id"]}}}


# ---------------------------------------------------------------- department threshold, deletion

def set_threshold(conn, viewer: Viewer, department_id: str, value: Any, rid: str | None = None) -> int | None:
    from ...rbac import require

    require(conn, viewer.principal, access.CONFIGURE, INSTALLATION)
    if value is not None and (isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= THRESHOLD_MAX):
        raise invalid(conn, "second_approval_minor", "range")
    if store.department(conn, department_id) is None:
        raise _err(conn, 404, "department_not_found")
    store_rfq.set_department_threshold(conn, department_id, value)
    audit(conn, actor=viewer.principal, action="ticket.rfq.department", decision="allowed", resource_type="ticket_department",
          resource_id=department_id, request_id=rid, details={"second_approval_minor": value})
    return value


def purge(conn, viewer: Viewer, seen: RfqSeen, rid: str | None = None, files_out: list[str] | None = None) -> dict[str, int]:
    """Full deletion. `files_out` (RFQATT) receives the stored paths of the request's files that no service request references - the
    caller deletes them after the commit (the orphan sweep retries what it could not)."""
    if not viewer.holds_installation(DELETE):
        raise refuse(conn, viewer, "ticket.rfq.delete", seen.row, "delete_permission_missing", rid, permission=DELETE)
    rfq_notify.ended(conn, seen.row["id"])
    if files_out is not None and store_rfq.has_attachments(conn):
        files_out.extend(store_rfq.attachment_paths_of_rfq(conn, seen.row["id"]))
    if files_out is not None and store_rfq.has_vendor_files(conn):  # RFQ-VENDOR-UPLOAD: the vendors' own files go with the request
        files_out.extend(store_rfq.vendor_file_paths_of_rfq(conn, seen.row["id"]))
    counts = store_rfq.purge_rfq(conn, seen.row["id"])
    audit(conn, actor=viewer.principal, action="ticket.rfq.delete", decision="allowed", resource_type="ticket_rfq", resource_id=seen.row["id"],
          request_id=rid, details={"number": seen.row["number"], "rows": counts})
    return counts


# ---------------------------------------------------------------- retention (the janitor, through costs_retention)

def retention(conn, now: dt.datetime) -> dict[str, int]:
    doc = settings_doc.read(conn)["rfq"]
    from .rfq_questions import remind  # RFQQUESTIONS: the "still unanswered" reminder

    out = {"due_passed": tick(conn, now), "links": 0, "purged": 0, "arrival_reminders": rfq_terms.tick(conn, now),
           "question_reminders": remind(conn, now)}
    for row in store_rfq.ended_before(conn, iso(now - dt.timedelta(days=int(doc["link_keep_days"])))):
        out["links"] += store_rfq.drop_links_of_rfq(conn, row["id"])
    months = int(doc["retention_months"])
    for row in store_rfq.ended_before(conn, iso(now - dt.timedelta(days=30 * months))):
        rfq_notify.ended(conn, row["id"])
        store_rfq.purge_rfq(conn, row["id"])
        out["purged"] += 1
    store_rfq.prune_redeems(conn, iso(now))
    out["attachments"] = rfq_attach.janitor(conn)  # RFQATT: files neither a request nor a service request names (files: the orphan sweep)
    if store_rfq.has_vendor_files(conn):  # RFQ-VENDOR-UPLOAD: the same for the vendors' own files
        out["vendor_files"] = store_rfq.drop_orphan_vendor_files(conn)
    return out


# ---------------------------------------------------------------- the outbox worker's view of an RFQ row (messaging.DbHooks)

def on_outbox_outcome(conn, row: Any, state: str, code: str | None, at: str) -> None:
    rfq = store_rfq.rfq_row_unchecked(conn, row.rfq_id)
    if rfq is None:
        return
    link = store_rfq.link(conn, row.link_id) if row.link_id else None
    kind = "message_sent" if state == "sent" else "message_unknown" if state == "unknown" else "message_failed"
    store_rfq.insert_event(conn, rfq["id"], kind, rfq_vendor_id=(link or {}).get("rfq_vendor_id"),
                           data={"outbox_id": row.id, "purpose": row.purpose, "channel": row.channel, "state": state,
                                 "code": None if state == "sent" else code}, at=at)


def on_outbox_fallback(conn, row: Any, step: str, new_id: str | None, at: str) -> None:
    rfq = store_rfq.rfq_row_unchecked(conn, row.rfq_id)
    if rfq is None:
        return
    link = store_rfq.link(conn, row.link_id) if row.link_id else None
    store_rfq.insert_event(conn, rfq["id"], "message_fallback", rfq_vendor_id=(link or {}).get("rfq_vendor_id"),
                           data={"outbox_id": row.id, "step": step, "purpose": row.purpose, "new_outbox_id": new_id}, at=at)


def outbox_still_relevant(conn, row: Any) -> bool:
    """After the module was off: an invitation / reminder / message of a request that ended (or of a removed vendor) is not sent;
    the cancellation notice is."""
    rfq = store_rfq.rfq_row_unchecked(conn, row.rfq_id)
    if rfq is None:
        return False
    if row.purpose == "rfq_cancelled":
        return True
    if rfq["state"] in ENDED:
        return False
    link = store_rfq.link(conn, row.link_id) if row.link_id else None
    v = store_rfq.vendor(conn, (link or {}).get("rfq_vendor_id"))
    return v is not None and v["state"] != "removed"


# ---------------------------------------------------------------- presentation

def _contact_block(conn, contact_id: str) -> dict[str, Any]:
    c = store_links.contact(conn, contact_id) or {}
    vendor = _vendor_contact(conn, c) if c else None
    erased = bool(c.get("erased_at"))
    return {"id": contact_id, "name": c.get("display_name") or "", "company": (vendor or {}).get("display_name") or c.get("company") or "",
            "kind": c.get("kind"), "lang": c.get("lang"), "erased": erased}


def _quote_summary(q: Mapping[str, Any] | None, amounts: bool) -> dict[str, Any] | None:
    if q is None:
        return None
    out: dict[str, Any] = {"id": q["id"], "version": q["version"], "state": q["state"], "created_at": q["created_at"]}
    if amounts:
        out.update({"total_minor": q["total_minor"], "subtotal_minor": q["subtotal_minor"], "currency": q["currency"],
                    "work_from": q.get("work_from"), "work_to": q.get("work_to"), "revision": q["revision"],
                    "has_note": bool((q.get("note") or "").strip())})  # RFQQUESTIONS: the vendor wrote a note (the text is the comparison's)
    return out


def _majority_currency(conn, qs: Sequence[Mapping[str, Any]]) -> str:
    counts = Counter(q["currency"] for q in qs)
    if not counts:
        return cost_settings(conn).currencies[0]
    best = max(counts.values())
    pref = cost_settings(conn).currencies
    tied = sorted(c for c, n in counts.items() if n == best)
    return next((c for c in pref if c in tied), tied[0])


def _lowest_earliest(conn, qs: Sequence[Mapping[str, Any]]) -> tuple[str | None, str | None, str]:
    currency = _majority_currency(conn, qs)
    ranked = [q for q in qs if q["currency"] == currency]
    lowest = min(ranked, key=lambda q: (int(q["total_minor"]), q["created_at"]), default=None)
    dated = [q for q in qs if q.get("work_from")]
    earliest = min(dated, key=lambda q: (q["work_from"], int(q["total_minor"])), default=None)
    return (lowest or {}).get("id"), (earliest or {}).get("id"), currency


def kpis(conn, row: Mapping[str, Any], vendors: Sequence[Mapping[str, Any]], live: Mapping[str, Mapping[str, Any]], now: dt.datetime,
         amounts: bool) -> dict[str, Any]:
    due = _due_passed(row, now)
    active = [v for v in vendors if v["state"] != "removed"]
    states = [vendor_state(v, due) for v in active]
    low_id, _early, currency = _lowest_earliest(conn, [q for q in live.values() if q["state"] == "submitted" or q["state"] in quotes.APPROVED])
    low = next((q for q in live.values() if q["id"] == low_id), None)
    return {"invited": len(active), "sent": sum(1 for v in active if v.get("sent_at")),
            "opened": sum(1 for v in active if v.get("first_opened_at")), "quoted": sum(1 for v in active if v["id"] in live),
            "declined": states.count("declined"), "no_response": sum(1 for s in states if s in ("sent", "opened", "expired")),
            "lowest_total_minor": int(low["total_minor"]) if (amounts and low) else None, "currency": currency if amounts else None}


def _live_by_vendor(conn, vendors: Sequence[Mapping[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for v in vendors:
        q = live_quote(conn, v["id"])
        if q is not None:
            out[v["id"]] = q
    return out


def present_award(conn, a: Mapping[str, Any], amounts: bool) -> dict[str, Any]:
    out = {"id": a["id"], "vendor_id": a["rfq_vendor_id"], "quote_id": a["quote_id"], "state": a["state"], "line_indexes": json.loads(a["line_indexes_json"]),
           "finalize": bool(a["finalize"]), "first_by": store.display_name(conn, a["first_by"]), "first_at": a["first_at"],
           "second_required": bool(a["second_required"]), "second_by": store.display_name(conn, a["second_by"]) if a.get("second_by") else None,
           "second_at": a.get("second_at"), "revision": a["revision"], "currency": a["currency"]}
    if amounts:
        out.update({"subtotal_minor": a["approved_subtotal_minor"], "vat_minor": a["approved_vat_minor"], "total_minor": a["approved_total_minor"],
                    "threshold_minor": a.get("threshold_minor")})
    else:
        out.update({"subtotal_minor": None, "vat_minor": None, "total_minor": None})
    if a["state"] == "declined":
        out["decline_reason"] = a.get("decline_reason")
    return out


def present_events(conn, row: Mapping[str, Any], amounts: bool) -> list[dict[str, Any]]:
    out = []
    for e in store_rfq.events_of(conn, row["id"]):
        try:
            data = json.loads(e["data_json"] or "{}")
        except ValueError:
            data = {}
        if amounts and e["kind"] in ("quote_submitted", "awarded") and data.get("quote_id"):
            q = store_quotes.quote(conn, data["quote_id"])
            if q is not None:
                data["total_minor"] = q["approved_total_minor"] if e["kind"] == "awarded" else q["total_minor"]
                data["currency"] = q["currency"]
        out.append({"id": e["id"], "kind": e["kind"], "at": e["at"], "vendor_id": e.get("rfq_vendor_id"),
                    "actor": {"kind": e["actor_kind"], "name": e["actor_name"] or ""}, "data": data})
    return out


def summary(conn, viewer: Viewer, seen: RfqSeen, now: dt.datetime) -> dict[str, Any]:
    row = seen.row
    amounts = sees_amounts(viewer, seen)
    vendors = store_rfq.vendors_of(conn, row["id"])
    live = _live_by_vendor(conn, vendors)
    dept = store.department_any(conn, row["department_id"]) or {}
    return {"id": row["id"], "number": row["number"], "ref": ref(row["number"]), "state": effective_state(row, now), "title": row["title"],
            "department": {"id": row["department_id"], "name": dept.get("name") or ""}, "place_text": row.get("place_text"),
            "location": org_locations.present_request(row), "due_at": row["due_at"], "work_from": row.get("work_from"), "work_to": row.get("work_to"), "created_at": row["created_at"],
            "updated_at": row["updated_at"], "internal_owner": {"id": row.get("internal_owner_user_id"),
                                                                 "name": store.display_name(conn, row.get("internal_owner_user_id"))},
            "kpis": kpis(conn, row, vendors, live, now, amounts), "questions": _questions().counts(conn, row, now)[0]}


def _questions():
    from . import rfq_questions  # RFQQUESTIONS (imports this module)

    return rfq_questions


def detail(conn, viewer: Viewer, seen: RfqSeen) -> dict[str, Any]:
    now = now_utc()
    row = seen.row
    amounts = sees_amounts(viewer, seen)
    manager = is_manager(viewer, seen)
    decide = can_decide(viewer, seen)
    state = effective_state(row, now)
    due = _due_passed(row, now)
    vendors = store_rfq.vendors_of(conn, row["id"])
    live = _live_by_vendor(conn, vendors)
    counts = store_rfq.message_counts(conn, row["id"])
    q_total, q_per = _questions().counts(conn, row, now)  # RFQQUESTIONS
    deliveries = store_rfq.outbox_states(conn, row["id"]) if manager else {}
    awards = store_rfq.awards_of(conn, row["id"])
    pending = any(a["state"] == "pending_second" for a in awards)
    has_award = any(a["state"] in ("pending_second", "approved") for a in awards)
    open_ = state in OPEN
    out_vendors = []
    for v in vendors:
        vs = vendor_state(v, due)
        link = store_rfq.link_of_vendor(conn, v["id"])
        out_vendors.append({
            "id": v["id"], "contact": _contact_block(conn, v["contact_id"]), "channel": v["channel"], "state": vs, "invited_at": v["invited_at"],
            "sent_at": v.get("sent_at"), "first_opened_at": v.get("first_opened_at"), "open_count": int(v.get("open_count") or 0),
            "quoted_at": v.get("quoted_at"), "declined_at": v.get("declined_at"), "decline_reason": v.get("decline_reason") if manager else None,
            "link": rfq_links.block(link, now) if manager else None,
            "delivery": deliveries.get((link or {}).get("id")) if manager else None,
            "quote": _quote_summary(live.get(v["id"]), amounts), "messages": counts.get(v["id"], 0), "revision": v["revision"],
            "questions": q_per.get(v["id"], {"pending": 0, "unread": 0}),
            "require_code": bool(v["require_code"]), "channel_choice": (v.get("channel_choice") or "auto") if manager else None,
            "can": {"remove": manager and state not in ENDED and vs not in ("removed", "awarded") and not _award_live_of_vendor(conn, v["id"]),
                    "remind": manager and state in ("sent", "collecting") and vs in ("sent", "opened") and v["channel"] != "manual",
                    "quote_on_behalf": manager and decide and (open_ or state == "awarded") and vs not in ("draft", "removed", "awarded", "not_awarded"),
                    "decline_on_behalf": manager and decide and state not in ENDED and state != "draft" and vs in ("sent", "opened", "expired", "withdrawn"),
                    "message": manager and vs not in ("draft", "removed"),
                    "options": manager and state not in ENDED and vs not in ("removed", "awarded", "not_awarded")},
        })
    dept = store.department_any(conn, row["department_id"]) or {}
    source = None
    if row.get("source_ticket_id"):
        s = access.visible_by_id(viewer, row["source_ticket_id"])
        source = {"id": s.row["id"], "number": s.row["number"]} if s else None
    threshold = store_rfq.department_threshold(conn, row["department_id"])
    from .rfq_orders import award_extras  # TKRFQ4 (contract 18.4): the work order of each award

    extras = award_extras(conn, viewer, seen, awards, amounts)
    out_awards = [{**present_award(conn, a, amounts), **extras.get(a["id"], {}), "terms": rfq_terms.present(conn, a, amounts=amounts, manager=manager)}
                  for a in awards]
    files = rfq_attach.detail_block(conn, viewer, seen, state)  # RFQATT (contract 19.3)
    return {
        "id": row["id"], "number": row["number"], "ref": ref(row["number"]), "state": state, "title": row["title"], "description": row["description"],
        "department": {"id": row["department_id"], "name": dept.get("name") or ""},
        "place": {"site_id": row.get("site_id"), "building_id": row.get("building_id"), "floor_id": row.get("floor_id"), "text": row.get("place_text")},
        "location": org_locations.present_request(row), "location_nav": bool(row.get("location_nav")),  # CR-ORG-LOCATIONS
        "source_ticket": source, "due_at": row["due_at"], "work_from": row.get("work_from"), "work_to": row.get("work_to"),
        "allowed_line_kinds": allowed_kinds(row),
        "internal_owner": {"id": row.get("internal_owner_user_id"), "name": store.display_name(conn, row.get("internal_owner_user_id")),
                           "active": store.user_is_active(conn, row["internal_owner_user_id"]) if row.get("internal_owner_user_id") else False},
        "created_by": {"id": row["created_by"], "name": store.display_name(conn, row["created_by"])}, "created_at": row["created_at"],
        "updated_at": row["updated_at"], "sent_at": row.get("sent_at"), "awarded_at": row.get("awarded_at"), "closed_at": row.get("closed_at"),
        "cancelled_at": row.get("cancelled_at"), "cancel_reason": row.get("cancel_reason") if manager else None, "revision": row["revision"],
        "kpis": kpis(conn, row, vendors, live, now, amounts), "vendors": out_vendors,
        "awards": out_awards,
        "second_approval": {"threshold_minor": threshold if amounts else None, "enabled": threshold is not None},
        "timeline": present_events(conn, row, amounts), "vendor_page": vendor_page_ready(conn), "attachments": files["attachments"],
        "questions": {**q_total, "items": _questions().pending_items(conn, viewer, seen, now)},
        "can": {"answer": manager, "edit": manager and state not in ENDED, "add_vendor": manager and (state == "draft" or open_),
                "send": manager and state in ("draft", "sent", "collecting") and any(v["state"] == "draft" for v in vendors),
                "remind": manager and state in ("sent", "collecting"), "cancel": manager and (state == "draft" or open_) and not has_award,
                "close": manager and (open_ or state in ("awarded", "ordered")) and not pending,
                "award": decide and (open_ or state == "awarded") and not pending, "see_amounts": amounts,
                "delete": viewer.holds_installation(DELETE),
                "order": any(a["can"]["order"] for a in out_awards), "send_order": any(a["can"]["send_order"] for a in out_awards),
                "attach": files["attach"]},
    }


def comparison(conn, viewer: Viewer, seen: RfqSeen) -> dict[str, Any]:
    now = now_utc()
    row = seen.row
    vendors = {v["id"]: v for v in store_rfq.vendors_of(conn, row["id"])}
    live = _live_by_vendor(conn, list(vendors.values()))
    counts = store_rfq.message_counts(conn, row["id"])
    _qt, q_per = _questions().counts(conn, row, now)  # RFQQUESTIONS
    awards = {a["quote_id"]: a for a in store_rfq.awards_of(conn, row["id"]) if a["state"] in ("pending_second", "approved")}
    qs = sorted(live.values(), key=lambda q: q["created_at"])
    low_id, early_id, currency = _lowest_earliest(conn, qs)
    due = parse(row["due_at"])
    wf, wt = row.get("work_from"), row.get("work_to")
    decide = can_decide(viewer, seen)
    from . import rfq_vendor_files  # RFQ-VENDOR-UPLOAD (contract 19.10): each vendor's own files (the comparison's costs.view rule)

    vfiles = rfq_vendor_files.by_vendor(conn, row["id"])
    items = []
    for q in qs:
        in_window = None
        if wf and wt and q.get("work_from"):
            in_window = bool(wf <= q["work_from"] and (q.get("work_to") or q["work_from"]) <= wt)
        a = awards.get(q["id"])
        items.append({
            "vendor_id": q["rfq_vendor_id"], "vendor": _contact_block(conn, vendors[q["rfq_vendor_id"]]["contact_id"]), "quote_id": q["id"],
            "version": q["version"], "state": q["state"], "source": q["source"], "submitted_at": q["created_at"],
            "late": bool(due and (parse(q["created_at"]) or now) > due), "currency": q["currency"], "vat_mode": q["vat_mode"],
            "vat_rate_bp": q["vat_rate_bp"], "lines": [{"index": i, **ln} for i, ln in enumerate(quotes.lines_of(q))],
            "by_kind": {"labor": q["labor_minor"], "parts": q["parts_minor"], "travel": q["travel_minor"], "other": q["other_minor"]},
            "subtotal_minor": q["subtotal_minor"], "vat_minor": q["vat_minor"], "total_minor": q["total_minor"],
            "net_minor": q["total_minor"] - q["vat_minor"], "work_from": q.get("work_from"), "work_to": q.get("work_to"), "in_window": in_window,
            "note": q.get("note"), "vendor_ref": q.get("vendor_ref"), "messages": counts.get(q["rfq_vendor_id"], 0),
            "questions": q_per.get(q["rfq_vendor_id"], {"pending": 0, "unread": 0}),
            "lowest": q["id"] == low_id, "earliest": q["id"] == early_id,
            "award": {"id": a["id"], "state": a["state"], "line_indexes": json.loads(a["line_indexes_json"])} if a else None,
            "revision": q["revision"], "payment_proposal": rfq_terms.present_plan(rfq_terms.loads(q.get("payment_plan_json"))),
            "vendor_files": vfiles.get(q["rfq_vendor_id"], []),
            "can": {"award": decide and q["state"] == "submitted" and not (q["created_by_kind"] == "user" and q["created_by"] == viewer.uid)},
        })
    return {"rfq_id": row["id"], "ref": ref(row["number"]), "state": effective_state(row, now), "currency": currency, "quotes": items,
            "lowest_quote_id": low_id, "earliest_quote_id": early_id,
            "filters": {"all": len(items), "in_window": sum(1 for i in items if i["in_window"])}}


def meta(conn, viewer: Viewer) -> dict[str, Any]:
    doc = settings_doc.read(conn)
    depts = []
    for d in store.departments(conn, include_inactive=False):
        if d.get("deleted_at"):
            continue
        member = bool(viewer.role(d["id"])) or ALL_DEPARTMENTS in viewer.anywhere
        if not (member or viewer.can_create_in(d)):
            continue
        t = store_rfq.department_threshold(conn, d["id"])
        depts.append({"id": d["id"], "name": d["name"], "can_create": viewer.can_create_in(d) and EXTERNAL in viewer.anywhere,
                      "second_approval_minor": t if COSTS_VIEW in viewer.anywhere else None, "second_approval_enabled": t is not None})
    return {"vendor_page": vendor_page_ready(conn), "settings": dict(doc["rfq"]), "departments": depts, "line_kinds": list(money.LINE_KINDS),
            "currencies": list(cost_settings(conn).currencies), "vendor_options": True,
            # RFQATT (contract 19): files and pictures on a request - the form's limits (the server enforces them anyway)
            "attachments": store_rfq.has_attachments(conn), "attachment_limits": rfq_files.limits(bool(doc["rfq"]["attachments"]["allow_office"])),
            "schedule_arrival": rfq_terms.enabled(conn),  # CR-RFQ-PAYMENT-SCHEDULE: the award dialog offers the schedule / arrival fields
            "vendor_uploads": _vendor_uploads_on(conn)}  # RFQ-VENDOR-UPLOAD: vendors may attach files to their quotes (switch, OFF by default)


def _vendor_uploads_on(conn) -> bool:
    from . import rfq_vendor_files

    return rfq_vendor_files.available(conn)


def principal_of(viewer: Viewer) -> Principal:
    return viewer.principal


from . import rfq_attach  # noqa: E402 - RFQATT; at the end: rfq_attach imports this module (circular, resolved at call time)
