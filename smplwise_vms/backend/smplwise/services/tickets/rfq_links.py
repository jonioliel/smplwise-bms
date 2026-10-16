"""TKRFQ1 (docs/tickets/RFQ_BACKEND_CONTRACT.md section 4): the personal link of a vendor invited to a request for quotation - the
handler-link mechanism of slice 4 (links.py / handler_links.py), reused, on its own table `ticket_rfq_links`.

    token        links.derive_token(key, link_id, generation, domain="rfq") - derived, never stored; only sha256(token) is kept
                 (UNIQUE, the public listener's single indexed lookup in stage C2). The `rfq` domain means an RFQ token is never a
                 ticket token: the ticket listener's lookup cannot find it, and the same id never gives the same token twice
    mint         at the first message that carries it (never for a vendor reached by hand); expires = max(deadline, now) +
                 `rfq.link_keep_days`, capped at now + 180 days; a later deadline moves it
    end          close / cancel: read-only grace (`rfq.grace_hours`); removal, manual revoke, a new generation, key rotation and a
                 contact's phone / e-mail change or erase revoke at once
    state        handler_links.state (live | grace | expired | revoked) - the same rule as a ticket link
Nothing here logs, audits or returns a token or a URL."""
from __future__ import annotations

import datetime as dt
from typing import Any, Mapping

from . import handler_links, links, settings_doc, store_rfq
from .channel import LINK_PURPOSES
from .handler_links import iso, parse
from .keyring import KEYS

CAP_DAYS = 180
REDEEM_HOURS = 24


def keep_days(conn) -> int:
    return int(settings_doc.read(conn)["rfq"]["link_keep_days"])


def grace_hours(conn) -> int:
    return int(settings_doc.read(conn)["rfq"]["grace_hours"])


def expiry_for(conn, due_at: str | None, now: dt.datetime) -> str:
    due = parse(due_at) or now
    return iso(max(due, now) + dt.timedelta(days=keep_days(conn)))


def mint(conn, *, rfq: Mapping[str, Any], vendor: Mapping[str, Any], now: dt.datetime) -> dict[str, Any]:
    """A new link (generation 1) under the current module key (minted by the "module on" path - keyring.py, W12; a missing key here
    is ModuleKeyError, which the caller turns into 409 `public_link_unavailable`)."""
    key_id, key = KEYS.current(create=False)
    link_id = links.new_link_id()
    token = links.derive_token(key, link_id, 1, domain="rfq")
    cap = now + dt.timedelta(days=CAP_DAYS)
    expires = min(parse(expiry_for(conn, rfq.get("due_at"), now)) or cap, cap)
    row = {"id": link_id, "rfq_vendor_id": vendor["id"], "rfq_id": rfq["id"], "contact_id": vendor["contact_id"], "generation": 1,
           "key_id": key_id, "token_hash": links.token_hash(token), "require_code": 1 if vendor.get("require_code") else 0, "sent_via": None,
           "created_at": iso(now), "generation_at": iso(now), "expires_at": iso(expires), "cap_at": iso(cap), "open_count": 0}
    store_rfq.insert_link(conn, row)
    return store_rfq.link(conn, link_id) or row


def token_of(row: Mapping[str, Any]) -> str:
    """The token of a link row (stage C2's one-time copy and the tests) - never logged, never stored."""
    return links.derive_token(KEYS.get(row["key_id"]), row["id"], int(row["generation"]), domain="rfq")


def state(row: Mapping[str, Any] | None, now: dt.datetime) -> str:
    return handler_links.state(dict(row), now) if row else "none"


URL_MARK = "q."  # TKRFQVP (contract 15.1): `#q.<token>` - '.' is not a base64url character, so an RFQ fragment is never a ticket token


def rfq_url(base_url: str, token: str, prefix: str | None = None) -> str:
    """`<base>/<prefix>/#q.<token>`: the page reads the fragment (never sent to a server) and opens its RFQ mode."""
    if links.parse_token(token) is None:
        raise ValueError("not a link token")
    return links.public_url(base_url, f"#{URL_MARK}{token}", prefix)


def url(conn, row: Mapping[str, Any]) -> str:
    """The URL a WhatsApp message carries (the token in the fragment, marked `q.`; the TK255 public prefix like a ticket link)."""
    return rfq_url(handler_links.public_base_url(conn), token_of(row), handler_links.public_prefix(conn))


def url_of(conn, link_id: str, now: dt.datetime) -> str | None:
    row = store_rfq.link(conn, link_id)
    if row is None or state(row, now) != "live":
        return None
    try:
        return url(conn, row)
    except Exception:  # noqa: BLE001 - no public address, a missing key: the message cannot carry a link
        return None


def redeem_url(conn, link_id: str, now: dt.datetime) -> str | None:
    """The e-mail form: a fresh 128-bit redeem id stored as its hash (24 h); the e-mail never carries the fragment token."""
    row = store_rfq.link(conn, link_id)
    if row is None or state(row, now) != "live":
        return None
    base = handler_links.public_base_url(conn)
    if not base:
        return None
    rid = links.new_redeem_id()
    store_rfq.insert_redeem(conn, links.redeem_hash(rid), link_id, int(row["generation"]), iso(now), iso(now + dt.timedelta(hours=REDEEM_HOURS)))
    try:
        return links.redeem_url(base, rid, handler_links.public_prefix(conn))
    except ValueError:
        return None


def note_sent(conn, link_id: str, via: str, purpose: str, at: dt.datetime) -> None:
    if purpose in LINK_PURPOSES:
        store_rfq.mark_link_sent(conn, link_id, via, iso(at))


def revoke(conn, row: Mapping[str, Any] | None, reason: str, at: dt.datetime) -> bool:
    if not row:
        return False
    done = store_rfq.revoke_link(conn, row["id"], reason, iso(at))
    if done:
        store_rfq.cancel_open_outbox_of_link(conn, row["id"], iso(at))
    return done


def on_due_changed(conn, rfq: Mapping[str, Any], now: dt.datetime) -> None:
    store_rfq.set_live_link_expiry(conn, rfq["id"], expiry_for(conn, rfq.get("due_at"), now))


def on_end(conn, rfq_id: str, reason: str, at: dt.datetime) -> None:
    """Close / cancel: the live links turn read-only for `rfq.grace_hours` (0 = revoked at once)."""
    hours = grace_hours(conn)
    if hours > 0:
        store_rfq.set_grace(conn, rfq_id, iso(at + dt.timedelta(hours=hours)))
        return
    for row in store_rfq.links_of_rfq(conn, rfq_id):
        if not row.get("revoked_at"):
            revoke(conn, row, reason, at)


def revoke_contact_links(conn, contact_id: str, reason: str, at: dt.datetime) -> int:
    """A contact's phone / e-mail change (`contact_changed`) or erase (`contact_erased`): every live RFQ link of that contact dies at
    once, with a timeline row on its request."""
    n = 0
    for row in store_rfq.live_links_of_contact(conn, contact_id):
        if revoke(conn, row, reason, at):
            n += 1
            store_rfq.insert_event(conn, row["rfq_id"], "link_revoked", rfq_vendor_id=row["rfq_vendor_id"], data={"reason": reason}, at=iso(at))
    return n


def revoke_all_live(conn, reason: str, at: dt.datetime) -> int:
    """Key rotation (`module_key`): every live RFQ link, in the rotation's transaction."""
    return sum(1 for row in store_rfq.live_links(conn) if revoke(conn, row, reason, at))


def raise_code(conn, contact_ids: list[str]) -> int:
    return store_rfq.raise_code(conn, contact_ids)


def block(row: Mapping[str, Any] | None, now: dt.datetime) -> dict[str, Any]:
    """What the manager sees about a vendor's link - never the token or the URL."""
    if row is None:
        return {"state": "none"}
    return {"state": state(row, now), "generation": int(row["generation"]), "created_at": row["created_at"],
            "expires_at": min(row["expires_at"], row["cap_at"]), "grace_until": row.get("grace_until"), "revoked_at": row.get("revoked_at"),
            "revoked_reason": row.get("revoked_reason"), "sent_via": row.get("sent_via"), "sent_at": row.get("sent_at"),
            "first_opened_at": row.get("first_opened_at"), "open_count": int(row.get("open_count") or 0),
            "require_code": bool(row.get("require_code"))}
