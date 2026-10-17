"""VPORTALRFQ (owner 2026-10-17: "possible in future", now approved to build, OFF by default): two additions INSIDE the signed-in vendor
portal (services/tickets/vendor_portal.py has the sign-in, the session and the rules this module keeps; docs/changes/CR-VENDOR-PORTAL.md
section 12 has the design and the threat model). A PUBLIC SURFACE: a Fable public-surface review is required before release.

1. OPEN REQUESTS FOR QUOTATION (`vendor_portal.rfqs`, default OFF). The portal lists the requests for quotation addressed to the
   session's own directory rows - keyed by the INVITATION (the `ticket_rfq_vendors` row of that contact), never by an RFQ id - that are
   still open for HIS quote (the request `sent` / `collecting` and not past its deadline, his page `open` / `declined`, his personal
   RFQ link live and not in read-only grace). Each item opens the vendor's EXISTING RFQ page with his own link's token (the token
   already sent to him; the page keeps its own rules - a code-protected link still asks for its code, nothing is widened). The list
   never shows more than the link itself shows before its code: for a code-protected link only the reference, the department and the
   deadline (no title, no quote). Never another vendor, another quote, an amount of someone else, a comparison or an award.
2. COMPANY TECHNICIAN REQUESTS (`vendor_portal.technician_requests`, default OFF). A session whose rows include a vendor COMPANY row
   (kind `vendor`) sees that company's active technicians (names only) and may ask to ADD a technician or REPLACE one of its own (a
   name + a mobile number). Nothing changes in the directory until a directory editor (`tickets.configure`) approves; the approval
   creates the person row through contacts.create (the same validation, keyed number, audit) and, for a replacement, sets the old row
   inactive through contacts.update (its live links are revoked there). NO door or access right of any kind - that is a separate
   WisKey flow. The vendor never learns whether the typed number already exists anywhere (no directory enumeration): the answer is the
   same; only the editor sees "the number is already in the directory".

Ids in the answers are opaque PER SESSION (HMAC of the session hash and the row, each kind its own domain), so an id from another
session or a guessed one matches nothing (the uniform 404). Every answer is an allow-list (RFQ_ITEM_KEYS, TECH_*_KEYS). Never bank data;
amounts + status only, as the portal does today. No number, code, session value or token reaches a log line or an audit row."""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import logging
import unicodedata
from typing import Any, Mapping

from ...audit import audit
from ...db import new_id
from . import links, model, rfq, settings_doc, store, store_links, store_rfq, vendor_portal
from .keyring import KEYS

log = logging.getLogger("smplwise.tickets.vendor_portal")

RFQ_MAX = 100
RFQ_ITEM_KEYS = frozenset({"id", "ref", "title", "department", "due_at", "state", "quote", "code_first"})
RFQ_QUOTE_KEYS = frozenset({"state", "total_minor", "currency"})
QUOTE_STATE = {"submitted": "submitted", "withdrawn": "withdrawn"}  # an open request: never an award state here
TECH_COMPANY_KEYS = frozenset({"id", "name", "techs", "requests"})
TECH_KEYS = frozenset({"id", "name"})
TECH_REQUEST_KEYS = frozenset({"id", "action", "name", "phone", "replaces", "state", "created_at", "decided_at"})
NAME_MAX = 80
NAME_DIGITS_MAX = 4
PENDING_MAX = 5  # per company at a time
PER_DAY = 10  # requests per company per 24 h (cancelled ones count too)
REQUESTS_SHOWN = 20
SHOWN_DAYS = 90
KEEP_DECIDED = dt.timedelta(days=180)
KEEP_PENDING = dt.timedelta(days=90)
NOTIFY_SOURCE = "ticket.portal_tech_request"


class PortalRefused(Exception):
    """A refusal the route answers with a fixed body: `{code}` (+ `fields` for 422)."""

    def __init__(self, status: int, code: str, fields: list[dict[str, str]] | None = None) -> None:
        super().__init__(code)
        self.status, self.code, self.fields = status, code, fields


# ---------------------------------------------------------------- the switches


def _flag(conn, key: str) -> bool:
    try:
        return bool(settings_doc.read(conn)["vendor_portal"][key])
    except Exception:  # noqa: BLE001 - unreadable: off (fail closed)
        return False


def rfqs_on(conn) -> bool:
    return vendor_portal.enabled(conn) and _flag(conn, "rfqs")


def techs_on(conn) -> bool:
    return vendor_portal.enabled(conn) and _flag(conn, "technician_requests")


def _oid(sess: vendor_portal.Session, domain: str, row_id: str) -> str:
    """An opaque id valid in THIS session only; each kind its own domain (an RFQ id never matches a technician, an item, ...)."""
    return hmac.new(sess.id_hash.encode("ascii"), f"{domain}|{row_id}".encode("ascii"), hashlib.sha256).hexdigest()[:24]


def _match(sess: vendor_portal.Session, domain: str, row_id: str, wanted: Any) -> bool:
    return isinstance(wanted, str) and len(wanted) == 24 and hmac.compare_digest(_oid(sess, domain, row_id), wanted)


def _iso(t: dt.datetime) -> str:
    return vendor_portal._iso(t)


# ---------------------------------------------------------------- 1. open requests for quotation


def _open_invitations(conn, contact_ids: list[str], now: dt.datetime, limit: int = RFQ_MAX) -> list[tuple[Any, dict[str, Any], dict[str, Any]]]:
    """(link record, request row, vendor row) of every invitation of these contacts that is open for HIS quote right now."""
    from .public_rfq import fold
    from .rfq_vendor import page_state

    if not contact_ids:
        return []
    marks = ",".join("?" * len(contact_ids))
    ids = [r[0] for r in conn.execute(
        "SELECT v.id FROM ticket_rfq_vendors v JOIN ticket_rfqs r ON r.id = v.rfq_id "
        f"WHERE v.contact_id IN ({marks}) AND r.state IN ('sent', 'collecting') AND v.state NOT IN ('draft', 'removed') "  # noqa: S608 - placeholders only
        "ORDER BY r.due_at, r.number, v.id LIMIT ?", (*contact_ids, limit)).fetchall()]
    out = []
    ts = now.timestamp()
    for vid in ids:
        rec = fold(store_rfq.link_of_vendor_joined(conn, vid))
        if rec is None or not rec.available(ts) or rec.read_only(ts) or rec.contact_id not in contact_ids:
            continue
        row = rfq.row_of_link(conn, rec.rfq_id)
        v = store_rfq.vendor(conn, vid)
        if row is None or v is None or v["rfq_id"] != row["id"] or v["contact_id"] != rec.contact_id:
            continue
        if rfq.effective_state(row, now) not in ("sent", "collecting"):
            continue  # past the deadline: not open for his quote any more (the RFQ page itself still serves it through his link)
        if page_state(conn, row, v, now) not in ("open", "declined"):
            continue
        out.append((rec, row, v))
    return out


def has_rfqs(conn, contacts: list[dict[str, Any]], now: dt.datetime) -> bool:
    """With the switch on, an open invitation is "something to show" for the sign-in (vendor_portal.plan_request)."""
    return rfqs_on(conn) and bool(_open_invitations(conn, [c["id"] for c in contacts], now, limit=5))


def _rfq_quote(conn, v: Mapping[str, Any]) -> dict[str, Any] | None:
    qs = [q for q in store_rfq.quotes_of_vendor(conn, v["id"]) if q["state"] in QUOTE_STATE]
    if not qs:
        return None
    q = qs[-1]
    return {"state": QUOTE_STATE[q["state"]], "total_minor": int(q["total_minor"] or 0), "currency": q["currency"]}


def rfq_view(conn, sess: vendor_portal.Session, now: dt.datetime) -> dict[str, Any]:
    """GET /t/api/portal/rfqs: his open invitations (allow-listed keys only)."""
    contacts = vendor_portal.contacts_of(conn, sess.phone_key)
    depts: dict[str, str] = {}
    items = []
    for rec, row, v in _open_invitations(conn, [c["id"] for c in contacts], now):
        if row["department_id"] not in depts:
            depts[row["department_id"]] = (store.department_any(conn, row["department_id"]) or {}).get("name") or ""
        code_first = bool(rec.require_code)
        items.append({
            "id": _oid(sess, "vpr", v["id"]), "ref": rfq.ref(row["number"]), "department": depts[row["department_id"]], "due_at": row["due_at"],
            # contract 15.3: a code-protected link discloses nothing beyond "a request exists" before its code - the list neither
            "title": None if code_first else row["title"], "quote": None if code_first else _rfq_quote(conn, v),
            "state": "declined" if v["state"] == "declined" else "open", "code_first": code_first,
        })
    return {"items": items}


def open_rfq(conn, sess: vendor_portal.Session, wanted: Any, now: dt.datetime) -> tuple[str, dict[str, Any]] | None:
    """POST /t/api/portal/rfqs/open: the token of HIS live RFQ link for one item of this session, or None (the uniform 404)."""
    if not isinstance(wanted, str) or len(wanted) != 24:
        return None
    contacts = vendor_portal.contacts_of(conn, sess.phone_key)
    for rec, row, v in _open_invitations(conn, [c["id"] for c in contacts], now):
        if not _match(sess, "vpr", v["id"], wanted):
            continue
        try:
            token = links.derive_token(KEYS.get(rec.key_id), rec.link_id, rec.generation, domain="rfq")
        except Exception:  # noqa: BLE001 - the link's key is gone (a retirement): the link cannot serve, nothing to hand over
            return None
        audit(conn, actor=vendor_portal.PortalActor(rec.contact_id), action="ticket.portal.rfq_open", decision="allowed",
              resource_type="ticket_rfq", resource_id=row["id"], details={"source": "vendor_portal", "number": row["number"], "link": rec.link_id[:6]})
        return token, {"ref": rfq.ref(row["number"])}
    return None


# ---------------------------------------------------------------- 2. company technician requests


def companies_of(conn, sess: vendor_portal.Session) -> list[dict[str, Any]]:
    """The vendor COMPANY rows the session's number serves (vendor_portal.contacts_of: proved, active, not staff)."""
    return [c for c in vendor_portal.contacts_of(conn, sess.phone_key) if c.get("kind") == "vendor"]


def techs_of(conn, vendor_id: str) -> list[dict[str, Any]]:
    """The company's own active technicians: live person rows working for it (never an employee row or a row naming a user)."""
    return [dict(r) for r in conn.execute(
        "SELECT id, display_name, revision FROM ticket_contacts WHERE vendor_id = ? AND kind = 'person' AND erased_at IS NULL AND active = 1 "
        "AND user_id IS NULL AND COALESCE(employee, 0) = 0 ORDER BY display_name, id LIMIT 200", (vendor_id,)).fetchall()]


def _requests_of(conn, vendor_id: str, now: dt.datetime) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_portal_tech_requests WHERE vendor_id = ? AND (state = 'pending' OR created_at > ?) "
        "ORDER BY created_at DESC, id LIMIT ?", (vendor_id, _iso(now - dt.timedelta(days=SHOWN_DAYS)), REQUESTS_SHOWN)).fetchall()]


def _name_of(conn, contact_id: str | None) -> str | None:
    row = store_links.contact(conn, contact_id) if contact_id else None
    return None if row is None or row.get("erased_at") else row["display_name"]


def _present_request(conn, sess: vendor_portal.Session, r: Mapping[str, Any]) -> dict[str, Any]:
    from .contacts import mask_phone

    return {"id": _oid(sess, "vpq", r["id"]), "action": r["action"], "name": r["display_name"], "phone": mask_phone(r["phone_e164"]),
            "replaces": _name_of(conn, r["replaces_contact_id"]) if r["action"] == "replace" else None, "state": r["state"],
            "created_at": r["created_at"], "decided_at": r["decided_at"]}


def tech_view(conn, sess: vendor_portal.Session, now: dt.datetime) -> dict[str, Any]:
    """GET /t/api/portal/techs: per company of the session - its technicians (names) and its recent requests (state, masked number)."""
    out = []
    for comp in companies_of(conn, sess):
        out.append({"id": _oid(sess, "vpc", comp["id"]), "name": comp["display_name"],
                    "techs": [{"id": _oid(sess, "vpt", t["id"]), "name": t["display_name"]} for t in techs_of(conn, comp["id"])],
                    "requests": [_present_request(conn, sess, r) for r in _requests_of(conn, comp["id"], now)]})
    return {"companies": out, "limits": {"name": NAME_MAX, "pending": PENDING_MAX}}


def clean_name(value: Any) -> str:
    """The portal's name rule on top of the directory's text hygiene (model.text_field: controls, bidi overrides and zero-width
    characters stripped, whitespace collapsed): a person's name - at least two letters, no address, no markup, at most four digits."""
    try:
        name = model.text_field(value, "name", required=True, max_len=NAME_MAX)
    except model.Invalid as exc:
        raise PortalRefused(422, "invalid", [{"field": "name", "code": exc.problems[0].code}]) from None
    letters = sum(1 for ch in name if unicodedata.category(ch).startswith("L"))
    digits = sum(1 for ch in name if unicodedata.category(ch) == "Nd")
    low = name.lower()
    if letters < 2 or digits > NAME_DIGITS_MAX or any(s in low for s in ("://", "www.", "@", "<", ">", "{", "}")):
        raise PortalRefused(422, "invalid", [{"field": "name", "code": "format"}])
    return name


def clean_phone(value: Any) -> str:
    # the directory's own rule (contacts.normalize_phone, through the portal's reading of what people type: any-script digits, the
    # `+972 0` slip) - the number the editor will put on the row is exactly the key the directory computes
    digits = vendor_portal.canonical_phone(value)
    if not digits:
        raise PortalRefused(422, "invalid", [{"field": "phone", "code": "format"}])
    return digits


def submit_tech(conn, sess: vendor_portal.Session, body: Mapping[str, Any], now: dt.datetime) -> dict[str, Any]:
    """POST /t/api/portal/techs: a request to add / replace a technician of one of the session's companies. Raises PortalRefused;
    None-scope (a company or a technician id not of this session) is the uniform 404 (`not_found`)."""
    comp = next((c for c in companies_of(conn, sess) if _match(sess, "vpc", c["id"], body.get("company"))), None)
    if comp is None:
        raise PortalRefused(404, "not_found")
    action = body.get("action")
    replaces_id = None
    if action == "replace":
        tech = next((t for t in techs_of(conn, comp["id"]) if _match(sess, "vpt", t["id"], body.get("replaces"))), None)
        if tech is None:
            raise PortalRefused(422, "invalid", [{"field": "replaces", "code": "unknown"}])
        replaces_id = tech["id"]
    elif action != "add" or body.get("replaces") is not None:
        raise PortalRefused(422, "invalid", [{"field": "action", "code": "choice"}])
    name = clean_name(body.get("name"))
    phone = clean_phone(body.get("phone"))
    same = conn.execute("SELECT * FROM ticket_portal_tech_requests WHERE vendor_id = ? AND state = 'pending' AND phone_e164 = ? "
                        "AND action = ? AND COALESCE(replaces_contact_id, '') = ?", (comp["id"], phone, action, replaces_id or "")).fetchone()
    if same is not None:
        return _present_request(conn, sess, dict(same))  # a repeated tap: the same pending request (nothing new stored)
    pending = int(conn.execute("SELECT COUNT(*) FROM ticket_portal_tech_requests WHERE vendor_id = ? AND state = 'pending'", (comp["id"],)).fetchone()[0])
    today = int(conn.execute("SELECT COUNT(*) FROM ticket_portal_tech_requests WHERE vendor_id = ? AND created_at > ?",
                             (comp["id"], _iso(now - dt.timedelta(days=1)))).fetchone()[0])
    if pending >= PENDING_MAX or today >= PER_DAY:
        raise PortalRefused(409, "tech_limit")
    rid = new_id()
    sender = comp["id"]  # today the company row itself signed in (a technician's own number never reaches this path)
    conn.execute("INSERT INTO ticket_portal_tech_requests(id, vendor_id, sender_contact_id, action, replaces_contact_id, display_name, phone_e164, "
                 "state, created_at) VALUES (?,?,?,?,?,?,?, 'pending', ?)", (rid, comp["id"], sender, action, replaces_id, name, phone, _iso(now)))
    audit(conn, actor=vendor_portal.PortalActor(comp["id"]), action="ticket.portal.tech_request", decision="allowed", resource_type="ticket_contact",
          resource_id=comp["id"], details={"source": "vendor_portal", "request": rid, "kind": action})
    _notify(conn, rid)
    row = conn.execute("SELECT * FROM ticket_portal_tech_requests WHERE id = ?", (rid,)).fetchone()
    return _present_request(conn, sess, dict(row))


def cancel_tech(conn, sess: vendor_portal.Session, wanted: Any, now: dt.datetime) -> bool:
    """POST /t/api/portal/techs/cancel: the company withdraws one of ITS pending requests. False = nothing of this session (404)."""
    if not isinstance(wanted, str) or len(wanted) != 24:
        return False
    for comp in companies_of(conn, sess):
        for r in conn.execute("SELECT id FROM ticket_portal_tech_requests WHERE vendor_id = ? AND state = 'pending'", (comp["id"],)).fetchall():
            if not _match(sess, "vpq", r["id"], wanted):
                continue
            conn.execute("UPDATE ticket_portal_tech_requests SET state = 'cancelled', decided_at = ?, decided_by = 'vendor_portal', "
                         "revision = revision + 1 WHERE id = ? AND state = 'pending'", (_iso(now), r["id"]))
            audit(conn, actor=vendor_portal.PortalActor(comp["id"]), action="ticket.portal.tech_cancel", decision="allowed",
                  resource_type="ticket_contact", resource_id=comp["id"], details={"source": "vendor_portal", "request": r["id"]})
            _resolve(conn, r["id"])
            return True
    return False


# ---------------------------------------------------------------- the approver's side (internal API: tickets.configure, or
# tickets.technician_requests within the departments the holder manages)


T_TECH = ("בקשה מספק לעדכון טכנאי", "לאישור במטפלים וספקים › ספקים")


def _notify(conn, request_id: str) -> None:
    """The directory editors' notification (installation level, subject `system`): no name, no number, no vendor text."""
    from .. import notify

    try:
        notify.emit_full(conn, notify.Signal(source=NOTIFY_SOURCE, subject_kind="system", subject_id=f"portal-tech:{request_id}",
                                             dedupe_key=f"ticket-portal-tech:{request_id}", params={"title": T_TECH[0], "body": T_TECH[1]},
                                             link="#/tickets/handlers?seg=vendors"))
    except Exception:  # noqa: BLE001 - a notification never fails the request
        log.warning("portal technician notification failed", exc_info=True)


def _resolve(conn, request_id: str) -> None:
    from .. import notify

    try:
        notify.emit_full(conn, notify.Signal(source=NOTIFY_SOURCE, subject_kind="system", subject_id=None,
                                             dedupe_key=f"ticket-portal-tech:{request_id}", resolve=True))
    except Exception:  # noqa: BLE001
        log.warning("portal technician notification resolve failed", exc_info=True)


def approver_scope(conn, viewer) -> set[str] | None:
    """Who may see and decide technician requests (owner 2026-10-17):
    - a directory editor (`tickets.configure` at the installation): every request (None = all), as before;
    - else a holder of `tickets.technician_requests` (installation): with `tickets.all_departments` every request; otherwise only the
      requests of vendors attached to a department he MANAGES (`tickets.manage` + a manager membership). A vendor shared with every
      department (no department rows) is not "his department's" vendor (the stricter reading, like CR-DEPT-MANAGER-HANDLERS);
    - anyone else: the audited 403 `{permission: tickets.technician_requests}` (rbac.require)."""
    from ...rbac import INSTALLATION, require
    from . import access

    if viewer.holds_installation(access.CONFIGURE):
        return None
    require(conn, viewer.principal, access.TECH_REQUESTS, INSTALLATION)
    if access.ALL_DEPARTMENTS in viewer.anywhere:
        return None
    if access.MANAGE not in viewer.anywhere:
        return set()
    return {d for d, role in viewer.roles.items() if role == "manager"}


def _in_scope(conn, scope: set[str] | None, vendor_id: str) -> bool:
    return scope is None or bool(scope & set(store_links.contact_departments(conn, vendor_id)))


def _known_elsewhere(conn, phone: str) -> bool:
    from .contacts import phone_key_for

    try:
        pk, _kid = phone_key_for(phone)
    except Exception:  # noqa: BLE001 - no module key
        return False
    return bool(pk) and conn.execute("SELECT 1 FROM ticket_contacts WHERE phone_key = ? AND erased_at IS NULL LIMIT 1", (pk,)).fetchone() is not None


def editor_list(conn, viewer, state: str | None = "pending") -> dict[str, Any]:
    """GET /api/v1/tickets/portal-requests: the requests for the directory's editors (full number: they hold tickets.configure)."""
    from . import access
    from .contacts import display_phone, managers_unmask, mask_phone

    scope = approver_scope(conn, viewer)
    configure = viewer.holds_installation(access.CONFIGURE)
    unmask = configure or managers_unmask(conn) or access.EXTERNAL in viewer.anywhere
    if state:
        rows = conn.execute("SELECT * FROM ticket_portal_tech_requests WHERE state = ? ORDER BY created_at DESC LIMIT 200", (state,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM ticket_portal_tech_requests ORDER BY created_at DESC LIMIT 200").fetchall()
    out = []
    for r in rows:
        if not _in_scope(conn, scope, r["vendor_id"]):
            continue  # another department's vendor: not listed (never counted, never named)
        out.append({"id": r["id"], "vendor": {"id": r["vendor_id"], "name": _name_of(conn, r["vendor_id"]) or ""}, "action": r["action"],
                    # the full number for an editor, a tickets.external holder, or with "managers see full numbers"; else the last four
                    "display_name": r["display_name"], "phone": display_phone(r["phone_e164"]) if unmask else mask_phone(r["phone_e164"]),
                    "replaces": ({"id": r["replaces_contact_id"], "name": _name_of(conn, r["replaces_contact_id"]) or ""}
                                 if r["replaces_contact_id"] else None),
                    "phone_known": _known_elsewhere(conn, r["phone_e164"]), "state": r["state"], "created_at": r["created_at"],
                    "decided_at": r["decided_at"], "result_contact_id": r["result_contact_id"], "revision": r["revision"]})
    return {"requests": out, "enabled": techs_on(conn)}


def _editor_row(conn, request_id: str, revision: int, scope: set[str] | None) -> dict[str, Any]:
    from ...errors import ApiError
    from .access import text

    r = conn.execute("SELECT * FROM ticket_portal_tech_requests WHERE id = ?", (request_id,)).fetchone()
    if r is None or not _in_scope(conn, scope, r["vendor_id"]):  # out of scope reads exactly like an unknown id
        raise ApiError(404, "tech_request_not_found", text(conn, "הבקשה לא נמצאה."))
    if r["state"] != "pending":
        raise ApiError(409, "tech_request_decided", text(conn, "הבקשה כבר טופלה."), details={"state": r["state"]})
    if r["revision"] != revision:
        raise ApiError(409, "tech_request_stale", text(conn, "הבקשה השתנתה בינתיים. טענו מחדש."), details={"revision": r["revision"]})
    return dict(r)


def approve(conn, viewer, request_id: str, revision: int, rid: str | None = None) -> dict[str, Any]:
    """The editor approves: the technician row is created through contacts.create (person, working for the company, the company's
    language and departments, WhatsApp preferred - its number NOT confirmed: the editor confirms it with the existing code flow) and,
    for a replacement, the old row is set inactive through contacts.update (its live links are revoked by that path)."""
    from ...errors import ApiError
    from . import contacts
    from .access import text

    scope = approver_scope(conn, viewer)
    r = _editor_row(conn, request_id, revision, scope)
    vendor = store_links.contact(conn, r["vendor_id"])
    if vendor is None or vendor.get("erased_at") or not vendor["active"] or vendor["kind"] != "vendor":
        raise ApiError(409, "tech_request_vendor_gone", text(conn, "הספק כבר לא פעיל בספר."))
    old = None
    if r["action"] == "replace":
        old = store_links.contact(conn, r["replaces_contact_id"])
        if old is None or old.get("erased_at") or not old["active"] or old.get("vendor_id") != vendor["id"]:
            raise ApiError(409, "tech_request_replaced_gone", text(conn, "הטכנאי שהספק ביקש להחליף כבר לא פעיל אצל הספק."))
    body: dict[str, Any] = {"kind": "person", "display_name": r["display_name"], "phone": r["phone_e164"], "vendor_id": vendor["id"],
                            "lang": vendor.get("lang") or "he", "preferred_channel": "whatsapp"}
    depts = store_links.contact_departments(conn, vendor["id"])
    if depts:
        body["departments"] = depts
    # the directory's own write path once THIS approver's authority was checked above (contacts.create / update demand
    # tickets.configure; a tickets.technician_requests holder writes through the same validation, keying, revocation and audit)
    try:
        fields = contacts._fields(conn, body, creating=True, current=None)  # noqa: SLF001 - the directory module's own validation
        dept_ids = contacts._departments(conn, body)  # noqa: SLF001
    except contacts.ContactInvalid as exc:
        raise contacts.invalid(conn, exc.field, exc.code) from None
    created = {"id": contacts.insert_checked(conn, viewer, fields, dept_ids, rid, extra_audit={"source": "portal_tech_request"})}
    if old is not None:
        contacts.update_checked(conn, viewer, old, {"active": False}, int(old["revision"]), rid, extra_audit={"source": "portal_tech_request"})
    conn.execute("UPDATE ticket_portal_tech_requests SET state = 'approved', decided_at = ?, decided_by = ?, result_contact_id = ?, "
                 "revision = revision + 1 WHERE id = ?", (vendor_portal._iso(dt.datetime.now(dt.timezone.utc).replace(microsecond=0)),
                                                          viewer.uid, created["id"], request_id))
    audit(conn, actor=viewer.principal, action="ticket.portal.tech_approve", decision="allowed", resource_type="ticket_contact",
          resource_id=vendor["id"], request_id=rid, details={"request": request_id, "kind": r["action"], "created": created["id"],
                                                             **({"deactivated": old["id"]} if old else {})})
    _resolve(conn, request_id)
    return {"ok": True, "contact_id": created["id"]}


def reject(conn, viewer, request_id: str, revision: int, rid: str | None = None) -> dict[str, Any]:
    r = _editor_row(conn, request_id, revision, approver_scope(conn, viewer))
    conn.execute("UPDATE ticket_portal_tech_requests SET state = 'rejected', decided_at = ?, decided_by = ?, revision = revision + 1 WHERE id = ?",
                 (vendor_portal._iso(dt.datetime.now(dt.timezone.utc).replace(microsecond=0)), viewer.uid, request_id))
    audit(conn, actor=viewer.principal, action="ticket.portal.tech_reject", decision="allowed", resource_type="ticket_contact",
          resource_id=r["vendor_id"], request_id=rid, details={"request": request_id, "kind": r["action"]})
    _resolve(conn, request_id)
    return {"ok": True}


# ---------------------------------------------------------------- retention and erase


def prune(conn, now: dt.datetime) -> None:
    """The janitor (vendor_portal.prune): decided requests 180 days after the decision, pending ones 90 days after they were sent."""
    try:
        conn.execute("DELETE FROM ticket_portal_tech_requests WHERE (state != 'pending' AND decided_at < ?) OR (state = 'pending' AND created_at < ?)",
                     (_iso(now - KEEP_DECIDED), _iso(now - KEEP_PENDING)))
    except Exception:  # noqa: BLE001 - a database before 0112
        pass


def forget_contact(conn, contact_id: str) -> None:
    """Erase: every request that names the row (as the company, the sender or the technician to replace) goes - it holds a name and a
    number the erased row's people typed or are."""
    try:
        conn.execute("DELETE FROM ticket_portal_tech_requests WHERE vendor_id = ? OR sender_contact_id = ? OR replaces_contact_id = ?",
                     (contact_id, contact_id, contact_id))
    except Exception:  # noqa: BLE001 - a database before 0112
        pass


def sanitized_rfq(item: Mapping[str, Any]) -> bool:
    """Test helper: an RFQ item carries only allow-listed keys (and its quote too)."""
    return not (set(item) - RFQ_ITEM_KEYS) and not (item.get("quote") is not None and set(item["quote"]) - RFQ_QUOTE_KEYS)
