"""TKRFQ5 (docs/tickets/RFQ_BACKEND_CONTRACT.md section 16.2): a vendor's WhatsApp TEXT reply to an RFQ message (invitation, reminder,
"there is a new message") becomes a clarification message in HIS private thread of that request - stored text only, direction vendor ->
manager, and the RFQ managers' `rfq.question` notification. Before this, such a reply went through the ticket matcher and usually ended
as `unknown_sender`.

The same trust boundary as the ticket matcher (inbound.py 9.6): a Home Assistant event is not authenticated by WhatsApp, so the message
is marked "via WhatsApp (unverified sender)" on the manager's side, it never moves a state (no quote, no decline, no withdrawal can come
from a WhatsApp text) and it is NOT shown on the vendor's public page (a forged event must not put words in the vendor's own thread
there). Nothing is ever sent back (no automatic reply).

A request is a candidate for a sender only while the vendor could ask on his page himself (the page's `ask` rule): the contact's
keyed number is the sender's, the link is live (not revoked, not expired, no read-only grace, contact not erased / staff), the request
is `sent` / `collecting` before its deadline, the vendor row is neither removed nor decided and no award on him is pending, and an RFQ
message went to him by WhatsApp over that link within the reply window. Everything else reads exactly like a stranger
(`unknown_sender`), so a reply discloses nothing about requests, other vendors or states.

This module reads candidates (for inbound.InboundProcessor through messaging.DbMatchDirectory) and applies a matched decision (for
messaging.apply_decision, inside the worker's transaction, after re-checking everything)."""
from __future__ import annotations

import datetime as dt
from typing import Any, Mapping

from ...audit import audit
from . import rfq, rfq_notify, store_rfq
from .inbound import RfqCandidate
from .text_hygiene import clean_text

VIA_PREFIX = "whatsapp:"  # ticket_rfq_messages.source_id of a message that came by a WhatsApp reply (`whatsapp:<inbound id>`)
MESSAGES_PER_VENDOR = 30  # the page's cap (rfq_vendor.MESSAGES_PER_VENDOR), shared: a WhatsApp flood cannot grow a thread without bound


def _iso(at: dt.datetime) -> str:
    return at.astimezone(dt.timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def _open(conn, joined: Mapping[str, Any] | None, now: dt.datetime) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """The request and the vendor row when this vendor could ask a question on his page right now (None otherwise)."""
    from .public_rfq import fold

    link = fold(dict(joined) if joined else None)
    t = now.timestamp()
    if link is None or not link.available(t) or link.read_only(t):
        return None
    row = rfq.system_row(conn, link.rfq_id)
    v = store_rfq.vendor(conn, link.rfq_vendor_id)
    if row is None or v is None or v["rfq_id"] != row["id"]:
        return None
    if row["state"] not in ("sent", "collecting") or rfq._due_passed(row, now):
        return None
    if v["state"] in ("draft", "removed", "awarded", "not_awarded") or rfq._award_live_of_vendor(conn, v["id"]):
        return None
    return row, v


def candidates(conn, sender_key: str, *, since: dt.datetime, now: dt.datetime) -> list[RfqCandidate]:
    out: list[RfqCandidate] = []
    from .outbox_store import iso as outbox_iso  # the outbox's own time format (milliseconds, Z): sent_at compares as text

    for r in store_rfq.inbound_links(conn, sender_key, outbox_iso(since)):
        if not r.get("o_id") or not r.get("o_sent_at"):
            continue  # nothing went to him by WhatsApp for this request within the reply window
        opened = _open(conn, r, now)
        if opened is None:
            continue
        row, v = opened
        sent = dt.datetime.fromisoformat(str(r["o_sent_at"]).replace("Z", "+00:00"))
        out.append(RfqCandidate(rfq_id=row["id"], rfq_number=int(row["number"]), department_id=row["department_id"], rfq_vendor_id=v["id"],
                                contact_id=v["contact_id"], outbox_id=r["o_id"], last_sent_at=sent, account_key=r.get("o_account_key")))
    return out


def apply(conn, d: Any, inbound_id: str, now: dt.datetime) -> str | None:
    """Store the matched reply in the vendor's thread (re-checked inside the worker's transaction). Returns None when stored, else the
    reason it was not (the caller records the inbound row as `ignored` with that reason - envelope only, no text)."""
    opened = _open(conn, store_rfq.link_of_vendor_joined(conn, d.rfq_vendor_id or ""), now)
    if opened is None or opened[0]["id"] != d.rfq_id:
        return "rfq_closed"  # the request / the vendor / the link changed since the match
    row, v = opened
    if store_rfq.inbound_message_count(conn, v["id"]) >= MESSAGES_PER_VENDOR:
        return "rfq_message_limit"
    body = clean_text(d.note or "", multiline=True)[: rfq.MESSAGE_MAX]
    if not body:
        return "empty"
    at = _iso(now)
    mid = store_rfq.insert_message(conn, {"rfq_id": row["id"], "rfq_vendor_id": v["id"], "direction": "in", "body": body, "author_kind": "contact",
                                          "author_id": v["contact_id"], "source_kind": "clarify", "source_id": f"{VIA_PREFIX}{inbound_id}",
                                          "created_at": at})
    store_rfq.update_rfq(conn, row["id"], {"updated_at": at}, bump=False)  # a system write: the managers' copies stay valid
    store_rfq.insert_event(conn, row["id"], "vendor_message", actor_kind="contact", actor_name=_name(conn, v), rfq_vendor_id=v["id"],
                           data={"message_id": mid, "via": "whatsapp", "unverified": True}, at=at)
    audit(conn, actor=None, action="ticket.rfq.vendor_message", decision="allowed", resource_type="ticket_rfq", resource_id=row["id"],
          details={"source": "whatsapp", "number": row["number"], "vendor_id": v["id"], "message_id": mid, "inbound_id": inbound_id})
    rfq_notify.question(conn, row, v["id"], mid, via="whatsapp")
    return None


def _name(conn, v: Mapping[str, Any]) -> str:
    from . import store_links

    c = store_links.contact(conn, v["contact_id"]) or {}
    return "" if c.get("erased_at") else (c.get("display_name") or "")


def is_whatsapp(message: Mapping[str, Any]) -> bool:
    return str(message.get("source_id") or "").startswith(VIA_PREFIX)

