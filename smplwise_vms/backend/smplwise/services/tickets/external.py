"""CR-038 slice 4, spec 8.1 / 10 / 11.2: sending a ticket to an outside contact or vendor, and the manager's link actions.

Assignment to a contact (`POST /tickets/{id}/assign {assignee: {kind: contact}}`), in this order - every refusal before anything is
written:
1. manager rights in the ticket's department (`seen.manager`) AND `tickets.external` where the ticket lies (D25) - audited 403s;
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
from . import access, codes as codes_mod, handler_links, links, model, naming, notify_bridge, store, store_links
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
        """(WhatsApp can carry a code now, e-mail can carry a code now) for the D6 rule."""


class ManualDispatch:
    """Slice 4: no message channel exists (slice 5b). Nothing is queued and nothing is sent: the manager copies the link."""

    def channel(self, conn, contact: dict[str, Any]) -> str:
        return "manual"

    def queue(self, conn, **_kw: Any) -> dict[str, Any]:
        return {"queued": False, "channel": "manual"}

    def code_ready(self, conn, contact: dict[str, Any]) -> tuple[bool, bool]:
        return False, False


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


def render_message(conn, ticket: dict[str, Any], contact: dict[str, Any], link_text: str) -> str:
    lang = contact.get("lang") if contact.get("lang") in STARTERS else "he"
    dept = store.department_any(conn, ticket["department_id"]) or {}
    place = ticket.get("place_text") or ""
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


def preview(conn, viewer: Viewer, seen: Seen, contact_id: str, *, require_code: bool = False) -> dict[str, Any]:
    """`POST /tickets/{id}/assign/preview`: the exact outgoing text (the link shown as a placeholder), the channel, what the link
    will do and every refusal the assignment would meet - no side effect (review T13-3)."""
    row = seen.row
    if not seen.manager:
        raise _refuse(conn, viewer, "ticket.assign", row, "not_manager", None)
    if not viewer.holds(access.EXTERNAL, row):
        raise _refuse(conn, viewer, "ticket.assign", row, "external_permission_missing", None, permission=access.EXTERNAL)
    contact, vendor = contact_for(conn, row, contact_id)
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
    return {
        "channel": DISPATCH.channel(conn, contact),
        "lang": lang,
        "text": render_message(conn, row, contact, LINK_PLACEHOLDER[lang]),
        "require_code": req,
        "require_code_locked": contact_req,
        "code_to_contact_phone": req,
        "share_history": history_option(conn, row, contact, vendor),
        "link": {"sliding_days": d.sliding_days, "cap_days": d.cap_days, "grace_hours": d.grace_hours,
                 "expires_at": handler_links.iso(expires), "cap_at": handler_links.iso(cap)},
        "refusals": refusals,
    }


def assign_contact(conn, viewer: Viewer, seen: Seen, contact_id: str, *, note: str | None, note_external: bool, require_code: bool | None,
                   share_history: bool | None, send_now: bool, revision: int, rid: str | None = None) -> str:
    row = seen.row
    if not seen.manager:
        raise _refuse(conn, viewer, "ticket.assign", row, "not_manager", rid)
    if not viewer.holds(access.EXTERNAL, row):
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
    req = codes_mod.effective_require_code(contact_requires_code(contact, vendor), require_code)
    _code_check(conn, contact, req)
    hist = history_option(conn, row, contact, vendor)
    if share_history and not hist["available"]:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "share_history", "code": "not_allowed"}]})
    share = hist["default"] if share_history is None else bool(share_history)
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
                                         "share_history": 1 if share else 0, "require_code": 1 if req else 0})
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
                       data={"assignee": name, "assignee_kind": "contact", "contact_kind": contact["kind"], "channel": channel,
                             "require_code": req, **({"previous": previous} if previous else {})})
    if note_text:
        store.insert_event(conn, row["id"], "note", actor_kind="user", actor_user_id=viewer.uid, actor_name=who, assignment_id=aid, body=note_text,
                           visible_external=bool(note_external))
    store_links.touch_contact_assigned(conn, contact_id, now)
    dispatched = DISPATCH.queue(conn, purpose="assign", ticket=row, assignment_id=aid, link=link_row, contact=contact,
                                send_now=bool(send_now), requested_by=viewer.uid)
    audit(conn, actor=viewer.principal, action="ticket.assign", decision="allowed", resource_type="ticket", resource_id=row["id"], request_id=rid,
          details={"number": row["number"], "assignee_kind": "contact", "contact_id": contact_id, "reassign": bool(current), "reopened": reopened,
                   "require_code": req, "share_history": share, "channel": channel, "queued": bool(dispatched.get("queued"))})
    audit(conn, actor=viewer.principal, action="ticket.link.mint", decision="allowed", resource_type="ticket", resource_id=row["id"], request_id=rid,
          details={"number": row["number"], "link": link_row["id"][:6], "generation": 1})
    notify_bridge.ticket_assigned(conn, row["id"], aid)
    return aid


# ---------------------------------------------------------------- the manager's link actions


def _current_link(conn, seen: Seen) -> dict[str, Any]:
    row = seen.row
    current = row["current_assignment_id"] if row.get("current_assignment_id") and not row.get("asg_ended_at") else None
    link_row = store_links.link_for_assignment(conn, current) if current and row.get("asg_kind") == "contact" else None
    if link_row is None:
        raise ApiError(409, "no_link", text(conn, "אין קישור פעיל של מטפל חיצוני."))
    return link_row


def _need(conn, viewer: Viewer, seen: Seen, action: str, rid: str | None, *, external: bool) -> None:
    if not seen.manager:
        raise _refuse(conn, viewer, action, seen.row, "not_manager", rid)
    if external and not viewer.holds(access.EXTERNAL, seen.row):
        raise _refuse(conn, viewer, action, seen.row, "external_permission_missing", rid, permission=access.EXTERNAL)


def copy_link(conn, viewer: Viewer, seen: Seen, rid: str | None = None) -> dict[str, Any]:
    """The handler URL once (the only place a link is shown), and the message to paste with it. Audited; `sent_via = manual`."""
    _need(conn, viewer, seen, "ticket.link.copy", rid, external=True)
    link_row = _current_link(conn, seen)
    now = handler_links.now_utc()
    if handler_links.state(link_row, now) != "live":
        raise ApiError(409, "link_not_live", text(conn, "הקישור אינו פעיל. צרו קישור חדש."))
    contact = store_links.contact(conn, link_row["contact_id"]) or {}
    try:
        url = handler_links.handler_url(conn, link_row)
    except links.PublicUrlError:
        raise _unavailable(conn) from None
    except ModuleKeyError:
        raise ApiError(409, "module_key_missing", text(conn, "מפתח המודול חסר (שחזור ללא secrets/). שחזרו את התיקייה מהגיבוי.")) from None
    store_links.update_link(conn, link_row["id"], {"sent_via": "manual"})
    store.insert_event(conn, seen.row["id"], "link_copied", actor_kind="user", actor_user_id=viewer.uid,
                       actor_name=store.display_name(conn, viewer.uid), assignment_id=link_row["assignment_id"])
    audit(conn, actor=viewer.principal, action="ticket.link.copy", decision="allowed", resource_type="ticket", resource_id=seen.row["id"], request_id=rid,
          details={"number": seen.row["number"], "link": link_row["id"][:6]})
    return {"url": url, "text": render_message(conn, seen.row, contact, url)}


def new_link(conn, viewer: Viewer, seen: Seen, rid: str | None = None) -> dict[str, Any]:
    """"קישור חדש" (also the one-tap way out of a code lock-out, review T5a): a new generation - the old token, its code sessions
    and its codes are dead; the code failure window starts clean."""
    _need(conn, viewer, seen, "ticket.link.new", rid, external=True)
    link_row = _current_link(conn, seen)
    if link_row.get("revoked_reason") == "contact_erased":
        raise _not_allowed(conn)
    contact = store_links.contact(conn, link_row["contact_id"])
    if contact is None or contact.get("erased_at") or contact.get("user_id"):
        raise _not_allowed(conn)
    if not access.public_ready(conn):
        raise _unavailable(conn)
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
    audit(conn, actor=viewer.principal, action="ticket.link.new", decision="allowed", resource_type="ticket", resource_id=seen.row["id"], request_id=rid,
          details={"number": seen.row["number"], "link": fresh["id"][:6], "generation": int(fresh["generation"])})
    return {"generation": int(fresh["generation"])}


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
    if DISPATCH.channel(conn, contact) == "manual":
        raise ApiError(409, "channel_unavailable", text(conn, "אין ערוץ שליחה להודעות. העתיקו את הקישור ושלחו אותו בעצמכם."))
    result = DISPATCH.queue(conn, purpose="assign", ticket=seen.row, assignment_id=link_row["assignment_id"], link=link_row, contact=contact,
                            send_now=False, requested_by=viewer.uid)
    handler_links.extend(conn, link_row["id"], seen.row["department_id"], now)
    audit(conn, actor=viewer.principal, action="ticket.link.resend", decision="allowed", resource_type="ticket", resource_id=seen.row["id"], request_id=rid,
          details={"number": seen.row["number"], "link": link_row["id"][:6], "queued": bool(result.get("queued"))})
    return {"queued": bool(result.get("queued")), "channel": result.get("channel")}
