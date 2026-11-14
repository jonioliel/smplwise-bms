"""CR-038 slice 4, spec 8.1 / 10 / 11.2: sending a ticket to an outside contact or vendor, and the manager's link actions.

Assignment to a contact (`POST /tickets/{id}/assign {assignee: {kind: contact}}`), in this order - every refusal before anything is
written:
1. manager rights in the ticket's department (`seen.manager`) AND `tickets.external` where the ticket lies (D25) - audited 403s;
   TKSTAFF2: a staff contact (an employee without an account) needs manager rights only, like an account holder
   (services/tickets/assignees.py `may_send`; the same rule for the copy / new / resend link actions);
2. the public page exists (`access.public_ready`: the add-on option, its listener, a public address) - else 409
   `public_link_unavailable`;
3. the contact: known, active, not erased, allowed in the ticket's department; NEVER a row that names an internal user (409
   `assignee_not_allowed`: an internal user signs in, a token link would bypass that - Q4 / D16, review T19-3);
4. "require a verification code": the contact's setting (or its vendor's) OR the assignment's - raise only (review T4); the D6
   code-channel rule: a code-protected assignment whose code could not leave on a channel other than the link's is refused (409
   `code_channel_unavailable`) - in slice 4 no message channel exists, so a code-protected assignment is refused until 5b / 7;
5. "share the device history" (D23): only for a ticket with a device snapshot and never for lock / alarm panel / cover / camera
   (422 `share_history` `not_allowed` whatever the client sends);
then: the current assignment ends (`reassigned`) and its link is revoked; a new assignment (`assignee_kind = 'contact'`, channel
`manual` - the link leaves by the manager's "copy link" until the message channel of slice 5b exists); a link is minted; the
ticket is `assigned`; timeline and audit rows; the dispatcher (`DISPATCH`) is asked to prepare the message - in slice 4 it queues
nothing and sends nothing.

Link actions (`POST /tickets/{id}/link/<action>`): `copy` (the URL once, audited - the only place a link is shown; `sent_via =
manual`), `new` (a new generation: new token, new cap, every earlier token / code session / code dead), `revoke` (at once),
`resend` (needs a message channel: 409 `channel_unavailable` in slice 4). copy / new / resend need `tickets.external`."""
from __future__ import annotations

import datetime as dt
from typing import Any, Protocol

from ...audit import audit
from ...errors import ApiError
from . import access, assignees, codes as codes_mod, handler_links, links, model, naming, notify_bridge, org_locations, sla, store, store_links
from .access import Seen, Viewer, text
from .module_key import ModuleKeyError
from .present import can_reopen

EXTERNAL_HISTORY_NEVER = frozenset({"lock", "alarm_control_panel", "cover", "camera"})
LINK_PLACEHOLDER = {"he": "[קישור]", "en": "[link]", "ar": "[رابط]", "ru": "[ссылка]"}
# The assignment message of section 9.7 per language (D26) with the module-name tokens of D33. Slice 5b's message templates
# (department / installation rows, ticket_templates) replace these starters; the placeholders are the spec's allow-list.
STARTERS = {
    "he": "שלום {name},\n{ticket} {number} ({department}): {title}\n{place}\nלעדכון הטיפול: {link}",
    "en": "Hello {name},\n{ticket} {number} ({department}): {title}\n{place}\nTo update the handling: {link}",
    "ar": "مرحبًا {name}،\n{ticket} {number} ({department}): {title}\n{place}\nلتحديث المعالجة: {link}",
    "ru": "Здравствуйте, {name}!\n{ticket} {number} ({department}): {title}\n{place}\nДля обновления: {link}",
}


# ---------------------------------------------------------------- the message seam (slice 5b plugs the outbox in here)


class LinkDispatch(Protocol):
    def channel(self, conn, contact: dict[str, Any]) -> str:
        """The channel a message to this contact would take now: 'whatsapp' | 'email' | 'manual'."""

    def queue(self, conn, *, purpose: str, ticket: dict[str, Any], assignment_id: str, link: dict[str, Any], contact: dict[str, Any],
              send_now: bool, requested_by: str) -> dict[str, Any]:
        """Write the outbox row (inside the caller's transaction) and return {queued, channel, held?}. Never sends inline."""

    def code_ready(self, conn, contact: dict[str, Any]) -> tuple[bool, bool]:
        """(WhatsApp can carry a code now, e-mail can carry a code now) for the D6 rule. WhatsApp means: the `tickets.codes`
        use resolves to an account that is sendable (9.9.2); e-mail means: the e-mail fallback is on and SMTP is configured.
        The contact's own phone / address is checked by the caller."""

    def queue_code(self, conn, *, ticket: dict[str, Any], link: dict[str, Any], contact: dict[str, Any], code: str, code_id: str,
                   channel: str, requested_by: str) -> dict[str, Any]:
        """Slice 7: queue the verification-code message (purpose `code`, priority 0, never held by send hours, the `code`
        template: no link, no title) inside the caller's transaction and return {queued, outbox_id?}. `code` (the six digits)
        is held IN MEMORY only until the row is final - never in the row, its params, a log or an audit line (code review W9);
        `code_id` names the `ticket_link_codes` row. With the msg-core outbox: `Outbox.enqueue(purpose='code', channel=channel,
        code=code, contact_id=..., ticket_id=..., assignment_id=..., link_id=..., department_id=..., requested_by=...)`."""


class ManualDispatch:
    """Slice 4: no message channel exists (slice 5b). Nothing is queued and nothing is sent: the manager copies the link."""

    def channel(self, conn, contact: dict[str, Any]) -> str:
        return "manual"

    def queue(self, conn, **_kw: Any) -> dict[str, Any]:
        return {"queued": False, "channel": "manual"}

    def code_ready(self, conn, contact: dict[str, Any]) -> tuple[bool, bool]:
        return False, False

    def queue_code(self, conn, **_kw: Any) -> dict[str, Any]:
        return {"queued": False}

    def queue_arrival_cancelled(self, conn, **_kw: Any) -> dict[str, Any]:
        return {"queued": False, "channel": "manual"}


DISPATCH: LinkDispatch = ManualDispatch()


# ---------------------------------------------------------------- shared checks


def _refuse(conn, viewer: Viewer, action: str, row: dict[str, Any], reason: str, rid: str | None, **details: Any) -> ApiError:
    audit(conn, actor=viewer.principal, action=action, decision="denied", resource_type="ticket", resource_id=row.get("id"), reason=reason,
          request_id=rid, details={"number": row.get("number"), **details})
    return ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"reason": reason, **details})


def _not_allowed(conn) -> ApiError:
    return ApiError(409, "assignee_not_allowed", text(conn, "לא ניתן לשלוח לאיש הקשר הזה."))


def _unavailable(conn) -> ApiError:
    return ApiError(409, "public_link_unavailable", text(conn, "שליחה לגורם חיצוני אינה זמינה: דף המטפלים אינו מוגדר בהתקנה זו."))


def contact_for(conn, ticket: dict[str, Any], contact_id: str) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """(contact, its vendor) when the contact may receive a link for this ticket; ApiError 409 otherwise."""
    contact = store_links.contact(conn, contact_id)
    if contact is None or contact.get("erased_at") or not contact["active"]:
        raise _not_allowed(conn)
    if contact.get("user_id"):
        raise _not_allowed(conn)  # an internal user signs in: never a token link (Q4 / D16)
    depts = store_links.contact_departments(conn, contact_id)
    if depts and ticket["department_id"] not in depts:
        raise _not_allowed(conn)
    vendor = store_links.contact(conn, contact["vendor_id"]) if contact.get("vendor_id") else None
    return contact, vendor


def contact_requires_code(contact: dict[str, Any], vendor: dict[str, Any] | None) -> bool:
    """The vendor's row applies to its persons unless a person overrides it upward (spec 10.5)."""
    return bool(contact["require_code"]) or bool(vendor and vendor["require_code"])


def history_option(conn, ticket: dict[str, Any], contact: dict[str, Any], vendor: dict[str, Any] | None) -> dict[str, Any]:
    """D23: whether the "share the device history" checkbox exists for this ticket, and its preselection (contact -> vendor ->
    department, default off)."""
    entity = ticket.get("entity_id") or ""
    available = False
    if entity and entity.split(".", 1)[0] not in EXTERNAL_HISTORY_NEVER:
        ctx = store_links.device_context(conn, ticket["id"])
        available = ctx is not None and not ctx.get("withheld") and ctx.get("source") != "none"
    default = contact.get("share_history")
    if default is None and vendor is not None:
        default = vendor.get("share_history")
    if default is None:
        dept = store.department_any(conn, ticket["department_id"]) or {}
        default = dept.get("share_history_external") or 0
    return {"available": available, "default": bool(default) and available}


def render_message(conn, ticket: dict[str, Any], contact: dict[str, Any], link_text: str, *, location_nav: bool = False) -> str:
    lang = contact.get("lang") if contact.get("lang") in STARTERS else "he"
    dept = store.department_any(conn, ticket["department_id"]) or {}
    snap = org_locations.parse_snapshot(ticket.get("location_snapshot"))  # CR-ORG-LOCATIONS: the request's own location, the link only when switched on
    place = ticket.get("place_text") or org_locations.message_text(snap, nav=bool(location_nav) and org_locations.has_coordinates(snap))
    device = ticket.get("device_name") or ""
    where = ", ".join(p for p in (device, place) if p)
    body = STARTERS[lang]
    values = {"{name}": contact.get("display_name") or "", "{number}": str(ticket["number"]), "{department}": dept.get("name") or "",
              "{title}": ticket.get("title") or "", "{place}": where}
    out = naming.render(body, naming.names_for(conn, lang))
    for k, v in values.items():
        out = out.replace(k, v)
    out = out.replace("{link}", link_text)
    return "\n".join(line for line in out.split("\n") if line.strip())


def _code_check(conn, contact: dict[str, Any], require: bool) -> None:
    if not require:
        return
    whatsapp_ok, email_ok = DISPATCH.code_ready(conn, contact)
    channel = codes_mod.code_channel(link_sent_via=DISPATCH.channel(conn, contact), whatsapp_ready=whatsapp_ok,
                                     has_phone=bool(contact.get("phone_e164")), email_ready=email_ok, has_email=bool(contact.get("email")))
    if channel is None:
        raise ApiError(409, "code_channel_unavailable", text(conn, "לא ניתן לשלוח קוד לאיש קשר זה כרגע."))


# ---------------------------------------------------------------- preview and assignment


def _check_location_nav(conn, ticket: dict[str, Any], wanted: bool | None) -> bool:
    """CR-ORG-LOCATIONS: the "add a navigation link to the message" switch of an assignment (default off). Asked for on a request whose
    location has no coordinates (or that has no location) it is REFUSED with a 422 - never silently ignored - so the manager never
    believes a link left that did not."""
    if not wanted:
        return False
    if not org_locations.has_coordinates(org_locations.parse_snapshot(ticket.get("location_snapshot"))):
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "location_nav", "code": "no_coordinates"}]})
    return True


def preview(conn, viewer: Viewer, seen: Seen, contact_id: str, *, require_code: bool = False, location_nav: bool | None = None) -> dict[str, Any]:
    """`POST /tickets/{id}/assign/preview`: the exact outgoing text (the link shown as a placeholder), the channel, what the link
    will do and every refusal the assignment would meet - no side effect (review T13-3)."""
    row = seen.row
    if not seen.manager:
        raise _refuse(conn, viewer, "ticket.assign", row, "not_manager", None)
    if not assignees.may_send(viewer, row, store_links.contact(conn, contact_id)):  # TKSTAFF2: a staff contact is assigned like a user
        raise _refuse(conn, viewer, "ticket.assign", row, "external_permission_missing", None, permission=access.EXTERNAL)
    contact, vendor = contact_for(conn, row, contact_id)
    nav = _check_location_nav(conn, row, location_nav)
    refusals: list[str] = []
    if not access.public_ready(conn):
        refusals.append("public_link_unavailable")
    contact_req = contact_requires_code(contact, vendor)
    req = codes_mod.effective_require_code(contact_req, require_code)
    try:
        _code_check(conn, contact, req)
    except ApiError as exc:
        refusals.append(exc.code)
    lang = contact.get("lang") if contact.get("lang") in STARTERS else "he"
    d = handler_links.durations(conn, row["department_id"])
    now = handler_links.now_utc()
    expires, cap = handler_links.first_expiry(now, d, handler_links.resolve_window_min(conn, row["department_id"], row["priority_id"]))
    out = {
        "channel": DISPATCH.channel(conn, contact),
        "lang": lang,
        "text": render_message(conn, row, contact, LINK_PLACEHOLDER[lang], location_nav=nav),
        "location_nav": {"available": org_locations.has_coordinates(org_locations.parse_snapshot(row.get("location_snapshot"))), "on": nav},
        "require_code": req,
        "require_code_locked": contact_req,
        "code_to_contact_phone": req,
        "share_history": history_option(conn, row, contact, vendor),
        "cost_claim": _cost_option(conn, row, contact, vendor),
        "link": {"sliding_days": d.sliding_days, "cap_days": d.cap_days, "grace_hours": d.grace_hours,
                 "expires_at": handler_links.iso(expires), "cap_at": handler_links.iso(cap)},
        "refusals": refusals,
        # GRANTS3-295: whether this assignment may carry the "access needed" tick (the arrival step on the vendor's page)
        "access_needed": {"available": _access_needed_available(conn, contact)},
    }
    extra = getattr(DISPATCH, "preview_extra", None)  # slice 5b: the template text, the account, the send-hours line, "send now"
    if extra is not None:
        out.update(extra(conn, row, contact, location_nav=nav))
    return out


def _access_needed_available(conn, contact: dict[str, Any]) -> bool:
    """GRANTS3-295: the external-grants feature is on and the contact is an outside vendor / person (services/access_arrival.py)."""
    try:
        from .. import access_arrival

        return access_arrival.flag_available(conn, contact) and not assignees.is_staff(contact)
    except Exception:  # noqa: BLE001 - the assign dialog never fails on the access feature
        return False


def access_needed_block(conn, row: dict[str, Any], link_row: dict[str, Any], *, now: dt.datetime) -> dict[str, Any] | None:
    """PHYSENTRY070-295: the ticket drawer's `link.access_needed` = {available, on}; None (the control is not drawn) while the switch
    `access.external.arrival_after_grant` is off, the external-grants feature is off, the link is not the live current one, or the
    assignment is not a regular outside vendor / person assignment (an RFQ work order has its own window)."""
    try:
        from .. import access_arrival, access_external

        if not access_external.arrival_after_grant(conn):
            return None
        current = row.get("current_assignment_id")
        if not current or link_row.get("assignment_id") != current or row.get("asg_ended_at") or row.get("asg_kind") != "contact":
            return None
        if handler_links.state(link_row, now) != "live" or link_row.get("kind") == "staff":
            return None
        contact = store_links.contact(conn, link_row.get("contact_id"))
        if not _access_needed_available(conn, contact or {}) or access_arrival.is_rfq_order(conn, current):
            return None
        return {"available": True, "on": access_arrival.is_flagged(conn, current)}
    except Exception:  # noqa: BLE001 - the ticket page never fails on this optional control
        return None


def set_access_needed(conn, viewer: Viewer, seen: Seen, *, value: bool, revision: int, rid: str | None = None) -> dict[str, Any]:
    """PHYSENTRY070-295 (owner decision GRANTS3 Q3 = B): the manager ticks / unticks "entry required" on the CURRENT outside assignment AFTER
    it was made. Off by default (setting `access.external.arrival_after_grant`): 409 `arrival_after_grant_off`. A manager holding
    `tickets.external` only; 422 `not_allowed` for a staff / Arx-user / erased contact, an RFQ work order or a feature that is off;
    409 `ticket_stale` on an old revision. Unticking only stops OFFERING the step: requests and grants that exist stay. When an
    untick removed a tick and the link is live, the vendor gets the code-owned notice `arrival_cancelled` (an `update` message through
    the outbox, held by the send hours; nothing when no channel can carry it - the result says `notice.queued: false`)."""
    from .. import access_arrival, access_external

    row = seen.row
    _need(conn, viewer, seen, "ticket.access_needed", rid, external=True)
    if not access_external.arrival_after_grant(conn):
        raise ApiError(409, "arrival_after_grant_off", text(conn, "האפשרות כבויה."))
    if row["revision"] != revision:
        raise ApiError(409, "ticket_stale", text(conn, "הנתונים השתנו בינתיים. טענו מחדש."), details={"revision": row["revision"]})
    link_row = _current_link(conn, seen)
    aid = link_row["assignment_id"]
    contact = store_links.contact(conn, link_row["contact_id"]) or {}
    bad = ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "access_needed", "code": "not_allowed"}]})
    if link_row.get("kind") == "staff" or access_arrival.is_rfq_order(conn, aid) or not _access_needed_available(conn, contact):
        raise bad
    now_dt = handler_links.now_utc()
    now = handler_links.iso(now_dt)
    live = handler_links.state(link_row, now_dt) == "live"
    was = access_arrival.is_flagged(conn, aid)
    notice: dict[str, Any] = {"queued": False}
    if value:
        if not live:
            raise ApiError(409, "link_not_live", text(conn, "הקישור אינו פעיל. צרו קישור חדש."))
        if not was:
            access_arrival.set_flag(conn, assignment_id=aid, ticket_id=row["id"], by=viewer.uid, at=now)
    elif was:
        access_arrival.clear_flag(conn, assignment_id=aid)
        queue = getattr(DISPATCH, "queue_arrival_cancelled", None)
        if live and queue is not None:
            notice = queue(conn, ticket=row, assignment_id=aid, link=link_row, contact=contact, requested_by=viewer.uid, token=now)
    if bool(value) != was:
        audit(conn, actor=viewer.principal, action="ticket.access_needed.set" if value else "ticket.access_needed.clear", decision="allowed",
              resource_type="ticket", resource_id=row["id"], request_id=rid,
              details={"number": row["number"], "assignment_id": aid, "notice_queued": bool(notice.get("queued")), "notice_channel": notice.get("channel")})
    return {"on": bool(value), "notice": {"queued": bool(notice.get("queued")), "channel": notice.get("channel")}}


def _cost_option(conn, row: dict[str, Any], contact: dict[str, Any], vendor: dict[str, Any] | None) -> dict[str, Any]:
    """S9 (D32): the assign dialog's "דרישת עלות: חובה / רשות / בלי" and where its preselection came from."""
    from . import costs

    if assignees.is_staff(contact):  # 2.5.8 review F4 (lead decision): an internal employee is never in the vendor-payment pipeline
        return {"default": "off", "from": "staff", "choices": ["off"]}
    mode, level = costs.preselected_mode(conn, contact=contact, vendor=vendor, department=store.department_any(conn, row["department_id"]))
    return {"default": mode, "from": level, "choices": list(costs.MODES)}


def _lapsed_documents(conn, viewer: Viewer, row: dict[str, Any], contact: dict[str, Any], vendor: dict[str, Any] | None,
                      confirmed: bool | None, rid: str | None) -> list[dict[str, Any]]:
    """The documents (type, valid-through, state) of the vendor being assigned that ask for the manager's confirmation; raises the 409 when
    they exist and the caller did not confirm. Empty - and no query - when the check is not asked, switched off, or MAINT215 holds nothing."""
    if confirmed is None:
        return []
    from . import vendor_documents, vendor_marks

    cfg = vendor_documents.cfg(conn)
    if not cfg["confirm_on_assign"] or assignees.is_staff(contact):
        return []
    unit = vendor["id"] if vendor else contact["id"]
    docs = vendor_documents.lapsed_for(conn, unit, vendor_marks.today(conn), include_expiring=bool(cfg["confirm_expiring"]))
    if docs and not confirmed:
        audit(conn, actor=viewer.principal, action="tickets.assign.lapsed_document", decision="denied", resource_type="ticket", resource_id=row.get("id"),
              reason="confirm_required", request_id=rid, details={"number": row.get("number"), "contact_id": contact["id"], "documents": docs})
        raise ApiError(409, "document_confirm_required", text(conn, "לספק יש מסמך שפג תוקפו. אשרו כדי להמשיך בשליחה."),
                       details={"documents": docs, "vendor": {"id": unit, "name": (vendor or contact).get("display_name") or ""}})
    return docs


def assign_contact(conn, viewer: Viewer, seen: Seen, contact_id: str, *, note: str | None, note_external: bool, require_code: bool | None,
                   share_history: bool | None, send_now: bool, revision: int, rid: str | None = None, cost_claim: str | None = None,
                   dispatch: bool = True, location_nav: bool | None = None, access_needed: bool | None = None,
                   document_confirm: bool | None = None) -> str:
    """`dispatch=False` (TKRFQ4, the RFQ work order): everything an assignment does EXCEPT queueing the assignment message - the order
    message leaves only on the manager's explicit click (owner rule: an approval never sends anything by itself).

    GRANTS3-295 `access_needed`: the manager's "access needed" tick - the vendor's page then offers the arrival step ("who arrives,
    when"), which can only create a grant REQUEST. Refused (422 `not_allowed`, before anything is stored) while the external-grants
    feature is off or for a staff contact.

    CR-SVC215 slice 2 `document_confirm` (None = the check is not asked: the RFQ work order, where the manager chose from the comparison that
    marks the documents): True / False is the manager's answer on the assign route. A vendor with a lapsed document (the expiring ones too
    when `vendor_documents.confirm_expiring`) is assigned only after the confirmation: 409 `document_confirm_required` with the documents,
    nothing written; with `document_confirm: true` the assignment goes ahead and the audit row `tickets.assign.lapsed_document` names the
    document types and dates. Never a refusal (MAINT215 question 5: the only electrician in town tonight)."""
    row = seen.row
    if not seen.manager:
        raise _refuse(conn, viewer, "ticket.assign", row, "not_manager", rid)
    if not assignees.may_send(viewer, row, store_links.contact(conn, contact_id)):  # TKSTAFF2: a staff contact is assigned like a user
        raise _refuse(conn, viewer, "ticket.assign", row, "external_permission_missing", rid, permission=access.EXTERNAL)
    if not access.public_ready(conn):
        raise _unavailable(conn)
    status = row["status"]
    dept = store.department_any(conn, row["department_id"])
    if status == "closed" and not can_reopen(row, dept):
        raise ApiError(409, "reopen_window_passed", text(conn, "חלף הזמן לפתיחה מחדש."))
    if status not in model.ASSIGN_FROM:
        raise ApiError(409, "invalid_transition", text(conn, "המעבר הזה אינו אפשרי במצב הנוכחי."), details={"from": status, "to": "assigned"})
    if row["revision"] != revision:
        raise ApiError(409, "ticket_stale", text(conn, "הנתונים השתנו בינתיים. טענו מחדש."), details={"revision": row["revision"]})
    contact, vendor = contact_for(conn, row, contact_id)
    current = row["current_assignment_id"] if row.get("current_assignment_id") and not row.get("asg_ended_at") else None
    if current and row.get("asg_kind") == "contact" and row.get("asg_contact_id") == contact_id:
        raise ApiError(409, "already_assigned", text(conn, "כבר נשלח למטפל הזה."))
    lapsed = _lapsed_documents(conn, viewer, row, contact, vendor, document_confirm, rid)
    req = codes_mod.effective_require_code(contact_requires_code(contact, vendor), require_code)
    _code_check(conn, contact, req)
    hist = history_option(conn, row, contact, vendor)
    if share_history and not hist["available"]:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "share_history", "code": "not_allowed"}]})
    share = hist["default"] if share_history is None else bool(share_history)
    nav = _check_location_nav(conn, row, location_nav)  # CR-ORG-LOCATIONS: after the permission gates, before any write
    if access_needed and not _access_needed_available(conn, contact):  # GRANTS3-295: before any write
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "access_needed", "code": "not_allowed"}]})
    from . import costs  # S9 (D32): the cost claim requirement of THIS assignment, preselected vendor -> department -> installation

    if cost_claim is not None and cost_claim not in costs.MODES:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "cost_claim", "code": "unknown"}]})
    claim_mode = cost_claim or costs.preselected_mode(conn, contact=contact, vendor=vendor, department=dept)[0]
    if assignees.is_staff(contact):
        claim_mode = "off"  # 2.5.8 review F4 (lead decision, fail closed): no cost claim / quote for a staff contact, whatever was sent
    try:
        note_text = model.text_field(note, "note", required=False, max_len=model.NOTE_MAX, multiline=True)
    except model.Invalid as exc:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": p.field, "code": p.code} for p in exc.problems]}) from None
    now_dt = handler_links.now_utc()
    now = handler_links.iso(now_dt)
    channel = DISPATCH.channel(conn, contact)
    name = contact["display_name"] if not vendor else f"{contact['display_name']} ({vendor['display_name']})"
    previous = row.get("asg_name") if current else None
    if current:
        store.update_assignment(conn, current, {"ended_at": now, "end_reason": "reassigned"})
        handler_links.revoke_for_assignment(conn, current, "reassigned", now_dt)
    aid = store.insert_assignment(conn, {"ticket_id": row["id"], "assignee_kind": "contact", "contact_id": contact_id, "assignee_name": name,
                                         "channel": channel, "assigned_by": viewer.uid, "assigned_at": now,
                                         "share_history": 1 if share else 0, "require_code": 1 if req else 0,
                                         "cost_claim": claim_mode, "location_nav": 1 if nav else 0})
    if access_needed:  # GRANTS3-295: the tick lives beside the assignment (access_arrival_flags), ids only
        from .. import access_arrival

        access_arrival.set_flag(conn, assignment_id=aid, ticket_id=row["id"], by=viewer.uid, at=now)
    try:
        link_row = handler_links.mint(conn, ticket=row, assignment_id=aid, contact_id=contact_id, require_code=req, now=now_dt)
    except ModuleKeyError:
        raise ApiError(409, "module_key_missing", text(conn, "מפתח המודול חסר (שחזור ללא secrets/). שחזרו את התיקייה מהגיבוי.")) from None
    fields: dict[str, Any] = {"status": "assigned", "current_assignment_id": aid, "assigner_user_id": viewer.uid, "last_activity_at": now,
                              "eta_at": None, "done_at": None, "external_stale": 0}
    fields["waiting_on"], fields["waiting_reason"] = model.waiting_for("assigned")
    reopened = status == "closed"
    if reopened:
        fields.update({"closed_at": None, "closed_by": None, "close_note": None, "purge_after": None,
                       "reopen_count": int(row.get("reopen_count") or 0) + 1})
        handler_links.on_reopened(conn, row["id"], now_dt)
    if not store.update_ticket(conn, row["id"], fields, expect_revision=revision):
        raise ApiError(409, "ticket_stale", text(conn, "הנתונים השתנו בינתיים. טענו מחדש."), details={"revision": row["revision"]})
    who = store.display_name(conn, viewer.uid) or viewer.principal.display_name or viewer.principal.username
    if reopened:
        store.insert_event(conn, row["id"], "reopened", actor_kind="user", actor_user_id=viewer.uid, actor_name=who, from_status="closed", to_status="assigned")
    store.insert_event(conn, row["id"], "reassigned" if current else "assigned", actor_kind="user", actor_user_id=viewer.uid, actor_name=who,
                       assignment_id=aid, from_status=status, to_status="assigned",
                       data={"assignee": name, "assignee_kind": "contact", "contact_kind": "employee" if contact.get("employee") else contact["kind"], "channel": channel,
                             "require_code": req, **({"previous": previous} if previous else {})})
    if note_text:
        store.insert_event(conn, row["id"], "note", actor_kind="user", actor_user_id=viewer.uid, actor_name=who, assignment_id=aid, body=note_text,
                           visible_external=bool(note_external))
    from . import owners  # TKDETAILBE: the internal owner defaults to the internal handler of this moment (else the manager)

    owners.on_handoff(conn, row, by=viewer.uid, actor_name=who, at=now)
    store_links.touch_contact_assigned(conn, contact_id, now)
    dispatched = DISPATCH.queue(conn, purpose="assign", ticket=row, assignment_id=aid, link=link_row, contact=contact,
                                send_now=bool(send_now), requested_by=viewer.uid) if dispatch else {"queued": False, "channel": channel}
    audit(conn, actor=viewer.principal, action="ticket.assign", decision="allowed", resource_type="ticket", resource_id=row["id"], request_id=rid,
          details={"number": row["number"], "assignee_kind": "contact", "contact_id": contact_id, "reassign": bool(current), "reopened": reopened,
                   "require_code": req, "share_history": share, "channel": channel, "queued": bool(dispatched.get("queued")),
                   "cost_claim": claim_mode, "location_nav": nav, **({"access_needed": True} if access_needed else {})})
    if lapsed:  # CR-SVC215 slice 2: the confirmed assignment names the documents (types and dates, never a file)
        audit(conn, actor=viewer.principal, action="tickets.assign.lapsed_document", decision="allowed", resource_type="ticket", resource_id=row["id"],
              request_id=rid, details={"number": row["number"], "contact_id": contact_id, "documents": lapsed})
    audit(conn, actor=viewer.principal, action="ticket.link.mint", decision="allowed", resource_type="ticket", resource_id=row["id"], request_id=rid,
          details={"number": row["number"], "link": link_row["id"][:6], "generation": 1, "kind": "external"})
    sla.refresh(conn, row["id"])  # slice 2: the dues follow every change (the acknowledgement clock starts at the assignment)
    notify_bridge.ticket_assigned(conn, row["id"], aid)
    return aid


# ---------------------------------------------------------------- the manager's link actions


def _current_link(conn, seen: Seen) -> dict[str, Any]:
    row = seen.row
    current = row["current_assignment_id"] if row.get("current_assignment_id") and not row.get("asg_ended_at") else None
    link_row = store_links.link_for_assignment(conn, current) if current else None
    if link_row is not None and row.get("asg_kind") != "contact" and link_row.get("kind") != "staff":
        link_row = None  # TKSTAFF1: a user assignment holds a link only when it is a staff link
    if link_row is None:
        raise ApiError(409, "no_link", text(conn, "אין קישור פעיל של מטפל חיצוני."))
    return link_row


def _need(conn, viewer: Viewer, seen: Seen, action: str, rid: str | None, *, external: bool) -> None:
    if not seen.manager:
        raise _refuse(conn, viewer, action, seen.row, "not_manager", rid)
    # TKSTAFF2: the link of a staff contact (an employee without an account) follows assignees.may_send, like its assignment
    staff_link = not assignees.STAFF_NEEDS_EXTERNAL and assignees.link_contact_is_staff(conn, seen.row)
    if external and not staff_link and not viewer.holds(access.EXTERNAL, seen.row):
        raise _refuse(conn, viewer, action, seen.row, "external_permission_missing", rid, permission=access.EXTERNAL)


def copy_link(conn, viewer: Viewer, seen: Seen, rid: str | None = None) -> dict[str, Any]:
    """The handler URL once (the only place a link is shown), and the message to paste with it. Audited; `sent_via = manual`."""
    _need(conn, viewer, seen, "ticket.link.copy", rid, external=True)
    link_row = _current_link(conn, seen)
    if link_row.get("kind") == "staff":
        # TKSTAFF1 (security design 2 / 3): a staff link goes to the employee's own phone by WhatsApp only - never shown to a manager
        raise ApiError(409, "staff_link_not_copyable", text(conn, "קישור של עובד נשלח רק בוואטסאפ לטלפון שלו."))
    now = handler_links.now_utc()
    if handler_links.state(link_row, now) != "live":
        raise ApiError(409, "link_not_live", text(conn, "הקישור אינו פעיל. צרו קישור חדש."))
    contact = store_links.contact(conn, link_row["contact_id"]) or {}
    try:
        url = handler_links.handler_url(conn, link_row)
    except (links.PublicUrlError, ValueError):  # a ValueError: a prefix the listener refuses (TK255 review F1) - degrade, never a 500
        raise _unavailable(conn) from None
    except ModuleKeyError:
        raise ApiError(409, "module_key_missing", text(conn, "מפתח המודול חסר (שחזור ללא secrets/). שחזרו את התיקייה מהגיבוי.")) from None
    handler_links.mark_sent(conn, link_row["id"], "manual", now)
    store.insert_event(conn, seen.row["id"], "link_copied", actor_kind="user", actor_user_id=viewer.uid,
                       actor_name=store.display_name(conn, viewer.uid), assignment_id=link_row["assignment_id"])
    audit(conn, actor=viewer.principal, action="ticket.link.copy", decision="allowed", resource_type="ticket", resource_id=seen.row["id"], request_id=rid,
          details={"number": seen.row["number"], "link": link_row["id"][:6]})
    asg = store.assignment(conn, link_row["assignment_id"]) or {}
    return {"url": url, "text": render_message(conn, seen.row, contact, url, location_nav=bool(asg.get("location_nav")))}


def new_link(conn, viewer: Viewer, seen: Seen, rid: str | None = None) -> dict[str, Any]:
    """"קישור חדש" (also the one-tap way out of a code lock-out, review T5a): a new generation - the old token, its code sessions
    and its codes are dead; the code failure window starts clean."""
    _need(conn, viewer, seen, "ticket.link.new", rid, external=True)
    link_row = _current_link(conn, seen)
    if link_row.get("revoked_reason") == "contact_erased":
        raise _not_allowed(conn)
    contact = store_links.contact(conn, link_row["contact_id"])
    staff = link_row.get("kind") == "staff"
    if contact is None or contact.get("erased_at") or (contact.get("user_id") and not staff):
        raise _not_allowed(conn)
    if staff:
        from . import staff_links  # TKSTAFF1: a new staff link only while the user may still hold the ticket (R7)

        staff_links.check_new_generation(conn, seen.row, contact)
    if not access.public_ready(conn):
        raise _unavailable(conn)
    # slice 7, D6: a code-protected link is useful only if its code can still leave on a channel the rule allows - refused
    # BEFORE the generation moves (the old link keeps its state; the manager may revoke it or pick another contact)
    _code_check(conn, contact, bool(link_row.get("require_code")))
    now = handler_links.now_utc()
    try:
        fresh = handler_links.new_generation(conn, link_row, seen.row, now)
    except ModuleKeyError:
        raise ApiError(409, "module_key_missing", text(conn, "מפתח המודול חסר (שחזור ללא secrets/). שחזרו את התיקייה מהגיבוי.")) from None
    _reset_codes(conn, fresh, now)
    if seen.row.get("waiting_reason") in ("link_expired", "code_locked", "contact_changed") and seen.row["status"] in model.HANDLING:
        store.update_ticket(conn, seen.row["id"], {"waiting_on": "assignee", "waiting_reason": None}, bump=False)
    store.insert_event(conn, seen.row["id"], "link_new", actor_kind="user", actor_user_id=viewer.uid, actor_name=store.display_name(conn, viewer.uid),
                       assignment_id=fresh["assignment_id"], data={"generation": int(fresh["generation"])})
    # "שלח קישור חדש" (the one tap of the code-lock card): the new link leaves by the message channel when one exists; with
    # none (slice 4's manual dispatch) the manager copies it
    channel = DISPATCH.channel(conn, contact)
    sent = {"queued": False, "channel": "manual"}
    if channel != "manual":
        sent = DISPATCH.queue(conn, purpose="assign", ticket=seen.row, assignment_id=fresh["assignment_id"], link=fresh, contact=contact,
                              send_now=False, requested_by=viewer.uid)
    audit(conn, actor=viewer.principal, action="ticket.link.new", decision="allowed", resource_type="ticket", resource_id=seen.row["id"], request_id=rid,
          details={"number": seen.row["number"], "link": fresh["id"][:6], "generation": int(fresh["generation"]),
                   "queued": bool(sent.get("queued")), "channel": sent.get("channel") or channel, "kind": fresh.get("kind") or "external"})
    return {"generation": int(fresh["generation"]), "queued": bool(sent.get("queued")), "channel": sent.get("channel") or channel}


def _reset_codes(conn, link_row: dict[str, Any], now: dt.datetime) -> None:
    """W8, as CodeEngine.reset does - but inside THIS transaction (the engine's own store would wait for the write lock this
    request holds): the new generation's failure window is cleared, every live code of the link ends, and the running public
    app's limiter forgets the per-recipient code count a stranger holding the old message may have spent. Codes and their
    windows are generation-scoped anyway (code review V8); this is defence in depth."""
    store_links.clear_failures(conn, link_row["id"], int(link_row["generation"]))
    store_links.expire_link_codes(conn, link_row["id"], handler_links.iso(now))
    from .public_runtime import RUNTIME

    app = RUNTIME.app
    limiter = getattr(getattr(app, "deps", None), "limiter", None) if app is not None else None
    contact = store_links.contact(conn, link_row["contact_id"]) or {}
    if limiter is not None and contact.get("phone_key"):
        limiter.forget("cr:" + contact["phone_key"][:24])  # codes.CodeEngine's per-recipient key


def revoke_link(conn, viewer: Viewer, seen: Seen, rid: str | None = None) -> dict[str, Any]:
    _need(conn, viewer, seen, "ticket.link.revoke", rid, external=False)
    link_row = _current_link(conn, seen)
    now = handler_links.now_utc()
    if not handler_links.revoke(conn, link_row, "manual", now):
        raise ApiError(409, "link_not_live", text(conn, "הקישור כבר אינו פעיל."))
    store.insert_event(conn, seen.row["id"], "link_revoked", actor_kind="user", actor_user_id=viewer.uid, actor_name=store.display_name(conn, viewer.uid),
                       assignment_id=link_row["assignment_id"], data={"reason": "manual"})
    audit(conn, actor=viewer.principal, action="ticket.link.revoke", decision="allowed", resource_type="ticket", resource_id=seen.row["id"], request_id=rid,
          details={"number": seen.row["number"], "link": link_row["id"][:6]})
    return {"revoked": True}


def resend(conn, viewer: Viewer, seen: Seen, rid: str | None = None) -> dict[str, Any]:
    """Resend the current link (extends the sliding expiry) - needs a message channel (slice 5b)."""
    _need(conn, viewer, seen, "ticket.link.resend", rid, external=True)
    link_row = _current_link(conn, seen)
    now = handler_links.now_utc()
    if handler_links.state(link_row, now) != "live":
        raise ApiError(409, "link_not_live", text(conn, "הקישור אינו פעיל. צרו קישור חדש."))
    contact = store_links.contact(conn, link_row["contact_id"]) or {}
    if link_row.get("kind") == "staff":
        from . import staff_links  # 2.5.8 review F5: a resend honours the confirmed number and the user's own WhatsApp switch

        staff_links.check_new_generation(conn, seen.row, contact)
    if DISPATCH.channel(conn, contact) == "manual":
        raise ApiError(409, "channel_unavailable", text(conn, "אין ערוץ שליחה להודעות. העתיקו את הקישור ושלחו אותו בעצמכם."))
    result = DISPATCH.queue(conn, purpose="assign", ticket=seen.row, assignment_id=link_row["assignment_id"], link=link_row, contact=contact,
                            send_now=False, requested_by=viewer.uid)
    handler_links.extend(conn, link_row["id"], seen.row["department_id"], now)
    audit(conn, actor=viewer.principal, action="ticket.link.resend", decision="allowed", resource_type="ticket", resource_id=seen.row["id"], request_id=rid,
          details={"number": seen.row["number"], "link": link_row["id"][:6], "queued": bool(result.get("queued"))})
    return {"queued": bool(result.get("queued")), "channel": result.get("channel")}
