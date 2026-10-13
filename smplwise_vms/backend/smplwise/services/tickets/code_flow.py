"""CR-038 slice 7 (option B, spec 10.5 / D2 / D6): the verification code of a handler link, wired to the module.

The engine (codes.CodeEngine) decides; this module connects it to the store, the message channel and the ticket:

- `SqlCodeSender` - the public listener's CodeSender:
  * `channel_for(link)`: the D6 code-channel rule at SEND time (codes.code_channel): WhatsApp through the `tickets.codes`
    account whenever it can carry the code (the account is sendable and the contact has a phone); e-mail only when WhatsApp
    cannot AND the link itself did not leave by e-mail (it went by WhatsApp or was copied by the manager); otherwise None ->
    `code/send` answers 503 `code_unavailable`.
  * `send(link, code_id, channel)`: re-reads the link inside one write transaction (still serving, same generation), derives
    the six digits from the code row id (codes.derive_code) and hands them to the dispatcher's `queue_code` IN MEMORY - the
    outbox row keeps the code row id only, never the digits (code review W9; the msg-core outbox holds a code in
    TransientSecrets until the row is final). The code row learns its `outbox_id`. Audit `ticket.link.code_send` (channel only).
    Any failure answers False: the engine withdraws the code and the page shows "code unavailable".
- `SqlCodeEvents` - what the module records around `code/verify` (public_ports.CodeEvents):
  * a correct code: access row `code_ok`, the sliding expiry moves (spec 10.2: "a verified code" is an action of the handler),
    timeline `code_verified` (internal), audit; a ticket that waited for the manager because of a lock (`code_locked`) goes
    back to waiting for the assignee;
  * a wrong code: access row `code_bad`, audit (denied, `invalid`);
  * the guess that STARTS a lock: also access row `locked`, timeline `code_locked` (system - the guesser may be a stranger with a
    forwarded link, review T5a), and the ticket waits for the manager (`waiting_reason = code_locked`); the manager's card
    "נעילת קוד" offers the one-tap "שלח קישור חדש" (external.new_link: a new generation - every old code, lock and session is
    dead by construction, code review V8).
  Nothing here ever receives a code, a hash or a session value.

The dispatcher is `external.DISPATCH` (slice 4's seam; slice 5b plugs the outbox in). Until a dispatcher can carry a code
(`code_ready` answers (False, False) and `queue_code` queues nothing), a code-protected assignment is refused at assign time
(409 `code_channel_unavailable`) and `code/send` answers 503 - never a silent success."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Any, Callable

from ...db import Database
from . import codes as codes_mod
from . import handler_links, model, store, store_links
from .public_ports import LinkRecord
from .public_store import audit_link, fold

log = logging.getLogger("smplwise.tickets.codes")
UTC = dt.timezone.utc
NO_DEVICE = "-"  # the access row's device key when none could be derived (the column is NOT NULL)


def _dispatch():
    from . import external  # late: slice 5b replaces external.DISPATCH at start-up

    return external.DISPATCH


def code_channel_for(conn, contact: dict[str, Any] | None, *, link_sent_via: str | None, dispatch=None) -> str | None:
    """The D6 rule for one contact now: 'whatsapp' | 'email' | None (see the module docstring)."""
    if not contact or contact.get("erased_at"):
        return None
    d = dispatch or _dispatch()
    try:
        whatsapp_ok, email_ok = d.code_ready(conn, contact)
    except Exception as exc:  # noqa: BLE001 - a dispatcher that cannot answer carries no code
        log.warning("code channel check failed (%s)", type(exc).__name__)
        return None
    return codes_mod.code_channel(link_sent_via=link_sent_via, whatsapp_ready=bool(whatsapp_ok), has_phone=bool(contact.get("phone_e164")),
                                  email_ready=bool(email_ok), has_email=bool(contact.get("email")))


def _at(t: float) -> dt.datetime:
    return dt.datetime.fromtimestamp(float(t), UTC).replace(microsecond=0)


def _live(conn, link: LinkRecord, t: float) -> tuple[LinkRecord, dict[str, Any]] | None:
    """The link as it is NOW (inside the caller's transaction) when it still serves under the same generation, with its row."""
    row = store_links.link_by_id_joined(conn, link.link_id)
    rec = fold(row)
    if rec is None or row is None or rec.generation != link.generation or not rec.available(t):
        return None
    return rec, row


# ---------------------------------------------------------------- the sender


class SqlCodeSender:
    def __init__(self, db: Database, key: Callable[[], bytes], *, dispatch=None, clock: Callable[[], float] | None = None) -> None:
        self.db = db
        self._key = key
        self._dispatch = dispatch
        self._clock = clock or (lambda: dt.datetime.now(UTC).timestamp())

    def dispatch(self):
        return self._dispatch or _dispatch()

    def channel_for(self, link: LinkRecord) -> str | None:
        with self.db.connection(mode="read", label="tickets.public.code_channel") as conn:
            contact = store_links.contact(conn, link.contact_id)
            return code_channel_for(conn, contact, link_sent_via=link.sent_via, dispatch=self.dispatch())

    def send(self, link: LinkRecord, code_id: str, channel: str) -> bool:
        if channel not in codes_mod.CHANNELS:
            return False
        try:
            key = self._key()
            with self.db.connection(label="tickets.public.code_send") as conn:
                live = _live(conn, link, self._clock())
                if live is None:
                    return False
                rec, row = live
                contact = store_links.contact(conn, rec.contact_id)
                ticket = store_links.ticket_of_link(conn, rec.link_id)
                link_row = store_links.link(conn, rec.link_id)
                if contact is None or ticket is None or link_row is None:
                    return False
                if not channel_still_allowed(conn, contact, channel, link_sent_via=row.get("sent_via"), dispatch=self.dispatch()):
                    return False
                queue = getattr(self.dispatch(), "queue_code", None)
                if queue is None:
                    return False
                result = queue(conn, ticket=ticket, link=link_row, contact=contact, code=codes_mod.derive_code(key, code_id),
                               code_id=code_id, channel=channel, requested_by=f"contact:{rec.contact_id}")
                if not isinstance(result, dict) or not result.get("queued"):
                    return False
                outbox_id = result.get("outbox_id")
                if isinstance(outbox_id, str) and outbox_id:
                    store_links.set_code_outbox(conn, code_id, outbox_id)
                audit_link(conn, rec, "ticket.link.code_send", channel=channel)
                return True
        except Exception as exc:  # noqa: BLE001 - never a 500 for the vendor; the engine withdraws the code
            log.warning("verification code not queued (%s)", type(exc).__name__)
            return False


def channel_still_allowed(conn, contact: dict[str, Any], channel: str, *, link_sent_via: str | None, dispatch) -> bool:
    """D6 once more inside the send transaction, against the link's CURRENT `sent_via`: the channel chosen a moment ago must
    still be one the rule allows. WhatsApp: the codes account can carry it and the contact has a phone. E-mail: the link did
    NOT leave by e-mail (it went by WhatsApp or was copied) and e-mail can carry it - even if WhatsApp came back meanwhile (a
    different channel from the link's is all D6 asks)."""
    try:
        whatsapp_ok, email_ok = dispatch.code_ready(conn, contact)
    except Exception:  # noqa: BLE001
        return False
    if channel == "whatsapp":
        return bool(whatsapp_ok) and bool(contact.get("phone_e164"))
    if channel == "email":
        return link_sent_via in ("whatsapp", "manual") and bool(email_ok) and bool(contact.get("email"))
    return False


# ---------------------------------------------------------------- the events around code/verify


class SqlCodeEvents:
    def __init__(self, db: Database, *, clock: Callable[[], float] | None = None) -> None:
        self.db = db
        self._clock = clock or (lambda: dt.datetime.now(UTC).timestamp())

    def verified(self, link: LinkRecord, client_key: str) -> None:
        t = self._clock()
        now = _at(t)
        at = handler_links.iso(now)
        with self.db.connection(label="tickets.public.code_ok") as conn:
            live = _live(conn, link, t)
            if live is None:
                return
            rec, _row = live
            ticket = store_links.ticket_of_link(conn, rec.link_id)
            if ticket is None:
                return
            store_links.insert_access(conn, rec.link_id, at, "code_ok", client_key or NO_DEVICE)
            if not rec.read_only(t):
                handler_links.extend(conn, rec.link_id, ticket["department_id"], now)  # spec 10.2: a verified code extends
            asg = store.assignment(conn, rec.assignment_id) or {}
            store_links.insert_contact_event(conn, ticket["id"], "code_verified", contact_id=rec.contact_id,
                                             actor_name=asg.get("assignee_name") or "", assignment_id=rec.assignment_id, at=at,
                                             data={"generation": rec.generation}, visible_external=False)
            if (ticket.get("waiting_reason") == "code_locked" and ticket["status"] in model.HANDLING
                    and ticket.get("current_assignment_id") == rec.assignment_id):
                waiting_on, reason = model.waiting_for(ticket["status"])
                store.update_ticket(conn, ticket["id"], {"waiting_on": waiting_on, "waiting_reason": reason}, bump=False)
            audit_link(conn, rec, "ticket.link.code", result="ok")

    def refused(self, link: LinkRecord, reason: str, client_key: str, *, just_locked: bool, locked_until: float | None) -> None:
        t = self._clock()
        now = _at(t)
        at = handler_links.iso(now)
        with self.db.connection(label="tickets.public.code_bad") as conn:
            live = _live(conn, link, t)
            if live is None:
                return
            rec, _row = live
            store_links.insert_access(conn, rec.link_id, at, "code_bad", client_key or NO_DEVICE)
            if not just_locked:
                audit_link(conn, rec, "ticket.link.code", decision="denied", reason="invalid")
                return
            store_links.insert_access(conn, rec.link_id, at, "locked", client_key or NO_DEVICE)
            ticket = store_links.ticket_of_link(conn, rec.link_id)
            until = handler_links.iso(_at(locked_until)) if locked_until else None
            if ticket is not None:
                store.insert_event(conn, ticket["id"], "code_locked", actor_kind="system", assignment_id=rec.assignment_id, via="link",
                                   data={"generation": rec.generation, **({"until": until} if until else {})}, at=at)
                if ticket["status"] in model.HANDLING and ticket.get("current_assignment_id") == rec.assignment_id:
                    store.update_ticket(conn, ticket["id"], {"waiting_on": "manager", "waiting_reason": "code_locked"}, bump=False)
            audit_link(conn, rec, "ticket.link.code", decision="denied", reason="code_locked", **({"until": until} if until else {}))


def lock_state(conn, link_row: dict[str, Any] | None, now: dt.datetime) -> str | None:
    """The end of the code lock of the link's CURRENT generation (ISO) or None - for the manager's lock card."""
    if not link_row:
        return None
    fr = store_links.failures(conn, link_row["id"], int(link_row["generation"]))
    if not fr or not fr.get("locked_until"):
        return None
    return fr["locked_until"] if fr["locked_until"] > handler_links.iso(now) else None
