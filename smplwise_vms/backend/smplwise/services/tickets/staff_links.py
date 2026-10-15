"""TKSTAFF1 (owner 2026-10-16): the no-login STAFF link - an internal employee WITH an account who is assigned a ticket gets a
WhatsApp message with a personal link to update the status, add a note or a photo without signing in.

Security design (private/planning/TKSTAFF1_LINK_SECURITY_DESIGN_2026-10-16.md, a Fable review, GO with conditions). The staff link is
built as exactly what a vendor link already is - a bearer of the EXTERNAL-HANDLER scope over ONE assignment - and never as a stand-in
for the user's session:
- R1 / R3: the page is handler_actions.view() unchanged and every write is the link actor (`actor_kind = 'contact'`, `via = 'link'`,
  audit actor `contact:<id>`, source `ticket_link`) - never the user's principal, never `actor_user_id`;
- R2: no cost-claim surface (`ticket_links.kind = 'staff'`: public_app.link_context(claim_surface=True), public_claims, the view);
- R5: `ticket_links.kind`; the link is bound to the user's CURRENT assignment and to the user's directory row
  (`ticket_contacts.user_id`, which holds the mobile, its `phone_key` and language). The assignment's `contact_id` is set to that row
  so the inbound matcher (text replies, button nonces) and the page's "since first assigned" rule work unchanged;
- R6: `staff_links.*` settings (the design's `links.staff.*`) for the durations (sliding 3 days, cap 14 days, grace 1 hour) - handler_links.durations(kind='staff');
- R7: revoked when the user is deactivated, leaves the department or loses tickets.view there (`recheck`: the HA directory push, the
  member routes and the SLA monitor's tick call it; reason `user_inactive`), when the directory row is deactivated or its mobile
  changes (contacts.update / `set_mobile`: `contact_changed`); every revocation cancels the link's queued messages (handler_links);
- R8: a verification code is required by default (`staff_links.require_code`, raise only: the row's own `require_code` still raises
  it); the code goes to the same phone (codes.py);
- R11: a token link exists only for the CURRENT ASSIGNEE of a current assignment; "new request" notices to the department's
  `notify_new` managers go through the notification engine with a signed-in deep link (notify_bridge), never through this module;
- R12: the user's own "WhatsApp for my assignments" switch (`ticket_contacts.notify_whatsapp`, default on, meaningful with a mobile).
Staff links go by WhatsApp only (no e-mail redeem, no "copy link"). The outgoing text is the staff starter of message_templates
(`starter:staff_assign[_code]:<lang>`, he / ar / ru / en): one URL, and no quick-reply line when a code is required.
Nothing here logs, audits or stores a phone number, a token, a code or a message text."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Any

from ...audit import audit
from ...errors import ApiError
from ...rbac import INSTALLATION, require
from . import access, codes as codes_mod, handler_links, model, notify_bridge, settings_doc, store, store_links
from .access import Viewer, text
from .module_key import ModuleKeyError

log = logging.getLogger("smplwise.tickets.staff")
LANGS = ("he", "en", "ar", "ru")


# ---------------------------------------------------------------- who gets a staff link


def directory_row(conn, user_id: str | None) -> dict[str, Any] | None:
    """The user's directory row (`ticket_contacts.user_id`, not erased) - where the mobile, its key and the language live."""
    return store_links.contact_by_user(conn, user_id) if user_id else None


def recipient(conn, user_id: str | None) -> dict[str, Any] | None:
    """The row a staff link may be sent to: active, not erased, with a mobile, the user's own WhatsApp switch on (R12)."""
    row = directory_row(conn, user_id)
    if row is None or not row["active"] or row.get("erased_at") or not row.get("phone_e164") or not row.get("notify_whatsapp", 1):
        return None
    return row


def require_code(conn, contact: dict[str, Any]) -> bool:
    """R8: the installation's staff default OR the row's own flag - raise only."""
    return bool(settings_doc.read(conn)["staff_links"]["require_code"]) or bool(contact.get("require_code"))


def _code_can_leave(conn, contact: dict[str, Any]) -> bool:
    """The D6 rule for a staff link (it always leaves by WhatsApp): the code must be able to reach the same phone now."""
    from .external import DISPATCH

    whatsapp_ok, email_ok = DISPATCH.code_ready(conn, contact)
    return codes_mod.code_channel(link_sent_via="whatsapp", whatsapp_ready=whatsapp_ok, has_phone=bool(contact.get("phone_e164")),
                                  email_ready=email_ok, has_email=bool(contact.get("email"))) is not None


def still_holds(conn, ticket: dict[str, Any], user_id: str | None) -> bool:
    """Whether the user may still hold the ticket: active, a member of its department and tickets.view where it lies (spec 8 D15 -
    assignability is membership; service.eligible_assignees is the one rule)."""
    from .service import eligible_assignees

    if not user_id or not store.user_is_active(conn, user_id):
        return False
    return any(u["id"] == user_id for u in eligible_assignees(conn, ticket["department_id"], ticket))


# ---------------------------------------------------------------- minting at assignment time


def on_user_assigned(conn, viewer: Viewer, ticket: dict[str, Any], assignment_id: str, user_id: str, *, send_now: bool = False,
                     rid: str | None = None) -> dict[str, Any] | None:
    """Called by service.assign inside the assignment's transaction, after the assignment row exists. Mints a staff link and queues
    the WhatsApp message when every condition holds; otherwise does nothing (the user is told in the app as before - the WhatsApp
    message is an additional channel, never a replacement). Never raises for a missing condition: the assignment itself stands.
    `ticket` is the row as it was BEFORE the assignment (a reopened ticket sends the `reopened` text, like a vendor's)."""
    from .external import DISPATCH

    if user_id == viewer.uid:
        return None  # a manager who takes the ticket themself is in the app already
    contact = recipient(conn, user_id)
    if contact is None or not access.public_ready(conn):
        return None
    if DISPATCH.channel(conn, contact) != "whatsapp":
        return None  # staff links go by WhatsApp only (no e-mail redeem, never "copy link")
    req = require_code(conn, contact)
    if req and not _code_can_leave(conn, contact):
        audit(conn, actor=viewer.principal, action="ticket.link.mint", decision="denied", resource_type="ticket", resource_id=ticket["id"],
              reason="code_channel_unavailable", request_id=rid, details={"number": ticket["number"], "kind": "staff"})
        return None
    now = handler_links.now_utc()
    store.update_assignment(conn, assignment_id, {"contact_id": contact["id"], "require_code": 1 if req else 0})
    try:
        link_row = handler_links.mint(conn, ticket=ticket, assignment_id=assignment_id, contact_id=contact["id"], require_code=req, now=now,
                                      kind="staff")
    except ModuleKeyError:
        log.warning("staff link not minted: module key missing")
        store.update_assignment(conn, assignment_id, {"contact_id": None})
        return None
    store_links.touch_contact_assigned(conn, contact["id"], handler_links.iso(now))
    sent = DISPATCH.queue(conn, purpose="assign", ticket=ticket, assignment_id=assignment_id, link=link_row, contact=contact,
                          send_now=bool(send_now), requested_by=viewer.uid)
    audit(conn, actor=viewer.principal, action="ticket.link.mint", decision="allowed", resource_type="ticket", resource_id=ticket["id"],
          request_id=rid, details={"number": ticket["number"], "link": link_row["id"][:6], "generation": 1, "kind": "staff",
                                   "require_code": req, "queued": bool(sent.get("queued"))})
    return link_row


def check_new_generation(conn, ticket: dict[str, Any], contact: dict[str, Any]) -> None:
    """The manager's "new link" on a staff link: only while the user may still hold the ticket and the row can still receive it."""
    from .external import _not_allowed

    if not contact["active"] or not contact.get("phone_e164") or not still_holds(conn, ticket, ticket.get("asg_user_id")):
        raise _not_allowed(conn)


# ---------------------------------------------------------------- revocation (R7)


def _revoke_one(conn, link_row: dict[str, Any], reason: str, now: dt.datetime) -> bool:
    if not handler_links.revoke(conn, link_row, reason, now):
        return False
    ticket_id = link_row["ticket_id"]
    t = store_links.ticket_of_link(conn, link_row["id"]) or {}
    if t.get("status") not in model.FINAL and t.get("current_assignment_id") == link_row["assignment_id"]:
        store.update_ticket(conn, ticket_id, {"waiting_on": "manager", "waiting_reason": reason}, bump=False)
    store.insert_event(conn, ticket_id, reason, actor_kind="system", assignment_id=link_row["assignment_id"], data={"reason": reason})
    notify_bridge.contact_changed(conn, ticket_id)  # the managers' signal: the handler can no longer be reached by the link
    return True


def recheck(conn, now: dt.datetime | None = None) -> int:
    """R7 (a) / (b): every live staff link whose user is no longer active, no longer a member of the ticket's department or no
    longer holds tickets.view there is revoked at once (`user_inactive`), the ticket waits for the manager and the timeline says so.
    Cheap when there is nothing to do (one indexed read of the live staff links). Returns how many links it revoked."""
    now = now or handler_links.now_utc()
    n = 0
    for row in store_links.live_staff_links(conn):
        if row.get("asg_ended_at"):
            continue  # the lookup already folds an ended assignment into "revoked"
        ticket = store_links.ticket_of_link(conn, row["id"])
        if ticket is None or ticket["status"] in model.FINAL:
            continue
        if still_holds(conn, ticket, row.get("asg_user_id")):
            continue
        if _revoke_one(conn, row, "user_inactive", now):
            n += 1
    if n:
        audit(conn, actor=None, action="ticket.link.revoke", decision="allowed", resource_type="installation", resource_id="tickets",
              reason="user_inactive", details={"kind": "staff", "links_revoked": n})
    return n


def safe_recheck(conn) -> int:
    """`recheck` for the callers outside the module (the HA directory push, the member routes): never fails their transaction's
    main act; nothing at all while the module is off."""
    try:
        if not access.module_on(conn):
            return 0
        return recheck(conn)
    except Exception:  # noqa: BLE001 - a housekeeping step never fails the caller
        log.warning("staff link recheck failed", exc_info=True)
        return 0


# ---------------------------------------------------------------- the mobile field (Handlers & Vendors › handlers › with an account)


def view(conn, user_id: str) -> dict[str, Any]:
    """The staff member's mobile settings for the members card (a tickets.configure screen: the full number is shown)."""
    from .contacts import display_phone

    row = directory_row(conn, user_id)
    phone = (row or {}).get("phone_e164")
    return {"user_id": user_id, "contact_id": (row or {}).get("id"), "phone": display_phone(phone), "has_phone": bool(phone),
            "notify_whatsapp": bool((row or {}).get("notify_whatsapp", 1)), "lang": (row or {}).get("lang") or "he",
            "active": bool((row or {}).get("active", 1)),
            "live_links": len(store_links.live_links_of_contact(conn, row["id"])) if row else 0}


def set_mobile(conn, viewer: Viewer, user_id: str, body: dict[str, Any], rid: str | None = None) -> dict[str, Any]:
    """`PUT /tickets/admin/staff/{user_id}`: the mobile (E.164, validated like every directory phone), the language of the messages
    and the user's WhatsApp switch, on the user's directory row (created on first use). `tickets.configure` at the installation -
    the same authority that edits every directory phone (contacts.py, spec 8; review T19-4). A changed number revokes the row's live
    links at once and cancels their queued messages (R7 d); the audit names the fields and the count, never the number."""
    from . import contacts

    require(conn, viewer.principal, access.CONFIGURE, INSTALLATION)
    if user_id not in store.active_user_ids(conn):
        raise ApiError(404, "user_unknown", text(conn, "המשתמש לא נמצא או אינו פעיל."))
    fields: dict[str, Any] = {}
    try:
        if "phone" in body:
            fields["phone_e164"] = contacts.normalize_phone(body.get("phone"))
        if "lang" in body:
            if body["lang"] not in LANGS:
                raise contacts.ContactInvalid("lang", "choice")
            fields["lang"] = body["lang"]
        if "notify_whatsapp" in body:
            if not isinstance(body["notify_whatsapp"], bool):
                raise contacts.ContactInvalid("notify_whatsapp", "type")
            fields["notify_whatsapp"] = 1 if body["notify_whatsapp"] else 0
    except contacts.ContactInvalid as exc:
        raise contacts.invalid(conn, exc.field, exc.code) from None
    row = directory_row(conn, user_id)
    if row is None:
        if not fields.get("phone_e164"):
            return view(conn, user_id)  # nothing to keep: no row is made for an empty number
        new = {"kind": "person", "employee": 0, "user_id": user_id, "display_name": store.display_name(conn, user_id) or user_id,
               "preferred_channel": "whatsapp", "lang": "he", **fields}
        contacts._keyed(conn, new)
        cid = store_links.insert_contact(conn, new, viewer.uid)
        audit(conn, actor=viewer.principal, action="ticket.contact.create", decision="allowed", resource_type="ticket_contact", resource_id=cid,
              request_id=rid, details={"kind": "person", "user_linked": True, "has_phone": True, "fields": sorted(k if k != "phone_e164" else "phone" for k in fields)})
        return view(conn, user_id)
    phone_changed = "phone_e164" in fields and fields["phone_e164"] != row.get("phone_e164")
    if phone_changed:
        contacts._keyed(conn, fields)
    else:
        fields.pop("phone_e164", None)
    changed = sorted(("phone" if k == "phone_e164" else k) for k, v in fields.items() if k not in ("phone_key", "phone_key_id") and row.get(k) != v)
    if not changed:
        return view(conn, user_id)
    store_links.update_contact(conn, row["id"], fields, None)
    revoked = 0
    if phone_changed:
        revoked = contacts.revoke_contact_links(conn, row["id"], "contact_changed", handler_links.now_utc(), rid=rid)
    audit(conn, actor=viewer.principal, action="ticket.contact.update", decision="allowed", resource_type="ticket_contact", resource_id=row["id"],
          request_id=rid, details={"fields": changed, "links_revoked": revoked, "user_linked": True})
    return view(conn, user_id)
