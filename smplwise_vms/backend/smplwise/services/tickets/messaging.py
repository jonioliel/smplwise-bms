"""CR-038 slice 5b: the ticket message channel wired into the product (spec section 9, D13 / D14 / D26 / D27 / D29, 9.9.4).

The message core (channel.py, channel_whatsapp.py, outbox.py, inbound.py, hours.py, message_templates.py) decides; this module gives
it the real ports and connects it to the rest of the module:

- the outbox's ports on the database (outbox_store.py: ticket_outbox, the shared ledger on the SAME transaction), the directory
  (ticket_contacts, read at send time), the handler links (URL derived at send time; the e-mail form mints a redeem id), the message
  templates (ticket_templates kind 'message', per department and language, D26), the context (module switch, time zone, the send
  window D4, the module's name D33, the e-mail fallback) and the hooks (D14 timeline rows, audit `ticket.message.send`, "waiting for
  manager" when nobody could be reached, the CR-018 signals of slice 6 when they exist);
- `DbOutbox`: the core's Outbox with the lock order of the database (the write gate first, then the outbox lock; the provider call
  runs with NEITHER held - the claim is committed first, the outcome written after);
- the channels: WhatsApp through `ha-whatsapp` (only `whatsapp.send_message` / `whatsapp.send_buttons`, `account` always sent) and
  e-mail through the product's SMTP (the redeem link, never the fragment token);
- `OutboxDispatch` = services/tickets/external.DISPATCH: the channel an assignment takes (the contact's preferred channel, the
  master WhatsApp switch, the fallbacks of D13), the queued assignment message (in the assignment's own transaction), the D6
  readiness check and the assign preview's extra lines (the exact text, the account, the send-hours line, "send now");
- `OutboxCodeSender` = the public page's CodeSender (purpose `code`, the code ROW id only - the six digits are derived at render
  time, W9);
- the inbound side: `submit_inbound` (from the ha_sync websocket thread: a bounded queue, never a write, never a log of the event),
  the matcher's ports (nonce, candidates, dedupe, the account filter) and `apply_decision` (advisory status, notes, late notes,
  the claim-before-reveal queue of ambiguous replies);
- the registrations other slices left for this one: slice 5a's QUEUED_COUNTER / TEST_SENDER, slice 6's EXTERNAL_REMINDER and
  notify_bridge signals (when present), slice 4's DISPATCH and code sender, the closed / reassigned notices.

The master WhatsApp switch (`tickets.settings.whatsapp.enabled`) is OFF by default: until an administrator turns it on, nothing is
sent on WhatsApp and no inbound subscription is made. Nothing here calls Home Assistant except the two send services (and only from
the worker), and nothing here ever logs a number, a token, a code, a redeem id or a message text."""
from __future__ import annotations

import collections
import contextlib
import dataclasses
import datetime as dt
import difflib
import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any, Callable, Iterator, Mapping
from zoneinfo import ZoneInfo

from ...audit import audit
from ...db import Database, get_setting, unlocked
from .. import messaging_accounts as ma
from .. import messaging_runtime as mr
from .. import wa_pacing
from . import access, handler_links, hours, model, naming, notify_bridge, outbox_store as obs, settings_doc, sla, store, store_links
from . import org_locations  # CR-ORG-LOCATIONS: the {location} value
from . import rfq_links, store_rfq  # TKRFQ1: request-for-quotation vendor links and their outbox rows
from . import codes as codes_mod
from . import inbound as inbound_mod
from . import links as links_mod
from . import message_templates as mt
from .channel import CLAIM_LINK_PURPOSES, LANGS, LINK_PURPOSES, SENT, AccountRef, Recipient, SendResult, phone_digits
from .channel_email import EmailChannel, mail_config
from .channel_whatsapp import HaServiceTransport, WhatsAppChannel
from .keyring import KEYS
from .outbox import Outbox, OutboxError, OutboxRow, OutboxThread, Ports, timeline_kind

log = logging.getLogger("smplwise.tickets.messaging")
UTC = dt.timezone.utc

ENV_THREAD = "SW_TICKETS_OUTBOX"  # "0" keeps the worker thread off (tests drive `run_once` with explicit instants)
OUTBOX_KEEP = dt.timedelta(days=90)  # 15.1
INBOUND_KEEP = dt.timedelta(days=30)  # 15.1
JANITOR_EVERY_S = 3600.0
STATE_WATCH_EVERY_S = 60.0
FULL_TICK_EVERY_S = 60.0
DEFAULT_TZ = "Asia/Jerusalem"
REPLY_WINDOW_RANGE = (1, 336)
NOTICE_PURPOSES = ("closed", "reassigned")
SAMPLE = {"name": "דני", "number": "1042", "department": "אחזקה", "title": "מזגן לא מקרר", "place": "קומה 1 · חדר 102",
          "device": "מזגן חדר 102", "priority": "רגילה", "organization": "", "manager": "", "eta": "", "location": "מטה ראשי · הרצל 5, תל אביב"}
LINK_PLACEHOLDER = {"he": "[קישור]", "en": "[link]", "ar": "[رابط]", "ru": "[ссылка]"}
CODE_PLACEHOLDER = "123456"


def utcnow() -> dt.datetime:
    """The module's clock (tests replace it)."""
    return dt.datetime.now(UTC)


# ---------------------------------------------------------------- settings of the channel (tickets.settings, section 14.1)

def channel_settings(conn) -> dict[str, Any]:
    doc = settings_doc.read(conn)
    wa = doc.get("whatsapp") if isinstance(doc.get("whatsapp"), dict) else {}
    return {"revision": doc["revision"],
            "whatsapp": {"enabled": bool(wa.get("enabled", False)), "use_buttons": bool(wa.get("use_buttons", False)),
                         "reply_window_h": int(wa.get("reply_window_h", inbound_mod.DEFAULT_REPLY_WINDOW_H))},
            "email_fallback": bool(doc.get("email_fallback", True)),
            # TKNOTIFOTP: verify every WhatsApp number with a one-time code (optional, OFF by default)
            "phone_verify": {"required": bool((doc.get("phone_verify") or {}).get("required", False))}}


def time_zone(conn) -> ZoneInfo:
    name = get_setting(conn, "time.zone", DEFAULT_TZ) or DEFAULT_TZ
    try:
        return ZoneInfo(name)
    except Exception:  # noqa: BLE001 - an unknown zone name reads as the default
        return ZoneInfo(DEFAULT_TZ)


def send_window(conn, department_id: str | None) -> hours.SendWindow:
    """D4: the department's window (slice 2's `send_hours_json`), else the installation's (`tickets.settings.send_hours`, read
    tolerant: the key's editor is slice 2's), else 07:00-21:00. A corrupt value never opens the window wider than the default."""
    stored = settings_doc._stored(conn)
    dept = obs.department_send_hours(conn, department_id) if department_id else None
    return hours.effective_window(stored.get("send_hours"), dept)


def display_names(conn) -> dict[str, dict[str, str]]:
    """D33: the module's configured name in the four languages (slice 1's `tickets.name`), in the message core's shape."""
    return {lang: dict(naming.names_for(conn, lang)) for lang in LANGS}


def email_configured(conn, data_dir: Path | None) -> bool:
    return mail_config(conn, data_dir) is not None


# ---------------------------------------------------------------- the outbox's ports on the database

class DbDirectory:
    def __init__(self, io: obs.Access) -> None:
        self.io = io

    def recipient(self, contact_id: str) -> Recipient | None:
        with self.io.read() as conn:
            row = store_links.contact(conn, contact_id)
        if row is None or row.get("erased_at"):
            return None
        lang = row.get("lang") if row.get("lang") in LANGS else "he"
        with self.io.read() as conn:
            blocked = not _verified_for_whatsapp(conn, row)  # N-3: re-checked at send time, not only when the message was planned
        return Recipient(contact_id=row["id"], display_name=row.get("display_name") or "", lang=lang, phone=row.get("phone_e164"),
                         email=row.get("email") or None, user_id=row.get("user_id"), opted_out=False, whatsapp_blocked=blocked)


class DbLinks:
    def __init__(self, io: obs.Access, clock: Callable[[], dt.datetime]) -> None:
        self.io = io
        self.clock = clock

    @staticmethod
    def _serves(conn, row: Mapping[str, Any] | None, now: dt.datetime, claim: bool) -> bool:
        """The link opens the page now - or, for a cost message (`claim`, TK251), at least the claim step (claim mode)."""
        if row is None:
            return False
        if handler_links.state(dict(row), now) == "live":
            return True
        if not claim:
            return False
        from . import costs

        return costs.claim_mode_ok(conn, row["id"], int(row["generation"]), now) is not None

    def url(self, link_id: str, *, claim: bool = False) -> str | None:
        with self.io.read() as conn:
            row = store_links.link(conn, link_id)
            if row is None:  # TKRFQ1: a request-for-quotation vendor link (its own table and token domain)
                return rfq_links.url_of(conn, link_id, self.clock())
            if not self._serves(conn, row, self.clock(), claim):
                return None
            try:
                return handler_links.handler_url(conn, row)
            except Exception:  # noqa: BLE001 - no public address, a missing key: the message cannot carry a link
                return None

    def redeem_url(self, link_id: str, *, claim: bool = False) -> str | None:
        """The e-mail form (10.2): a fresh 128-bit redeem id, stored as its hash for 24 h (3 releases)."""
        conn = self.io.write()
        row = store_links.link(conn, link_id)
        now = self.clock()
        if row is None:  # TKRFQ1: the e-mail form of an RFQ vendor link (ticket_rfq_link_redeems)
            return rfq_links.redeem_url(conn, link_id, now)
        if row.get("kind") == "staff" or not self._serves(conn, row, now, claim):
            return None  # TKSTAFF1: a staff link never takes the e-mail redeem path (security design 2)
        base = handler_links.public_base_url(conn)
        if not base:
            return None
        rid = links_mod.new_redeem_id()
        store_links.insert_redeem(conn, links_mod.redeem_hash(rid), link_id, int(row["generation"]), handler_links.iso(now),
                                  handler_links.iso(now + dt.timedelta(hours=24)))
        try:
            return links_mod.redeem_url(base, rid, handler_links.public_prefix(conn))
        except ValueError:
            return None

    def sent_via(self, link_id: str) -> str | None:
        with self.io.read() as conn:
            row = store_links.link(conn, link_id) or store_rfq.link(conn, link_id)
        return row.get("sent_via") if row else None

    def requires_code(self, link_id: str) -> bool:
        with self.io.read() as conn:
            row = store_links.link(conn, link_id) or store_rfq.link(conn, link_id)
        return bool(row and row["require_code"])

    def note_sent(self, link_id: str, via: str, purpose: str, at: dt.datetime) -> None:
        """How the link left (`sent_via` / `sent_at` through slice 4's `mark_sent`: the first send time of the generation stays and
        'email' is sticky - the D6 rule) and the sliding expiry: a reminder and a manager's update are activity on the link (10.2);
        the first message is not (the mint set the first expiry)."""
        conn = self.io.write()
        row = store_links.link(conn, link_id)
        if row is None:
            if store_rfq.link(conn, link_id) is not None:  # TKRFQ1: how an RFQ vendor link left (sent_via / sent_at, 'email' sticky)
                rfq_links.note_sent(conn, link_id, via, purpose, at)
            return
        if purpose in LINK_PURPOSES or purpose in CLAIM_LINK_PURPOSES:  # TK251: a cost message carries the link too (D6)
            handler_links.mark_sent(conn, link_id, via, at)
        if purpose in ("reminder", "update"):
            t = obs.ticket_for_worker(conn, row["ticket_id"])
            if t is not None:
                handler_links.extend(conn, link_id, t["department_id"], at)


def message_template_rows(conn, *, purpose: str | None = None, department_id: str | None = None, include_all_departments: bool = False,
                          include_inactive: bool = False) -> list[dict[str, Any]]:
    return obs.message_templates(conn, purpose=purpose, department_id=department_id, include_all_departments=include_all_departments,
                                 include_inactive=include_inactive)


def template_text(r: Mapping[str, Any]) -> mt.TemplateText:
    lang = r.get("lang") if r.get("lang") in LANGS else "he"
    return mt.TemplateText(id=r["id"], purpose=r.get("purpose") or "", lang=lang, body=r.get("body") or "", department_id=r.get("department_id"),
                           revision=r.get("revision"), active=bool(r.get("active", 1)))


class DbTemplates:
    def __init__(self, io: obs.Access) -> None:
        self.io = io

    def pick(self, *, purpose: str, lang: str, department_id: str | None, template_id: str | None) -> mt.TemplateText | None:
        staff = mt.staff_starter_by_id(template_id)  # TKSTAFF1: the code-owned staff texts (the row names one; never editable)
        if staff is not None:
            return staff
        variant = mt.variant_by_id(template_id, purpose)  # CR-AWARD-NOTICE: a code-owned variant the row names (never a stored text)
        if variant is not None:
            return variant
        with self.io.read() as conn:
            cands = [template_text(r) for r in message_template_rows(conn, purpose=purpose, department_id=department_id)]
        if template_id:
            hit = next((t for t in cands if t.id == template_id), None)
            if hit is not None:
                return hit
        return mt.choose(cands, purpose=purpose, lang=lang, department_id=department_id)


class DbContext:
    def __init__(self, io: obs.Access, data_dir: Callable[[], Path | None]) -> None:
        self.io = io
        self._data_dir = data_dir

    def module_on(self) -> bool:
        with self.io.read() as conn:
            return access.module_on(conn)

    def time_zone(self) -> ZoneInfo:
        with self.io.read() as conn:
            return time_zone(conn)

    def send_window(self, department_id: str | None) -> hours.SendWindow:
        with self.io.read() as conn:
            return send_window(conn, department_id)

    def display_name(self) -> Mapping[str, Any]:
        with self.io.read() as conn:
            return display_names(conn)

    def email_fallback(self) -> bool:
        with self.io.read() as conn:
            return channel_settings(conn)["email_fallback"]

    def email_configured(self) -> bool:
        with self.io.read() as conn:
            return email_configured(conn, self._data_dir())


def _notify(name: str, conn, *args: Any, **kw: Any) -> None:
    """A CR-018 signal of slice 6's notify bridge when that slice is present (a no-op before it lands)."""
    fn = getattr(notify_bridge, name, None)
    if fn is None:
        return
    try:
        fn(conn, *args, **kw)
    except Exception:  # noqa: BLE001 - a notification never fails a send or an inbound reply
        log.warning("tickets notify %s failed", name, exc_info=True)


class DbHooks:
    """The outbox's side effects inside the SAME transaction as the outbox row (the bound connection): the D14 timeline rows, the
    audit envelope, "waiting for the manager" when nobody could be reached, the managers' in-app signal (slice 6)."""

    def __init__(self, runtime: "MessagingRuntime") -> None:
        self.rt = runtime

    def _conn(self):
        return obs.current()

    def queued(self, row: OutboxRow) -> None:
        return None

    def held(self, row: OutboxRow) -> None:
        return None

    def cancelled(self, row: OutboxRow, reason: str) -> None:
        log.info("outbox cancelled id=%s purpose=%s reason=%s", row.id, row.purpose, reason)
        conn = self._conn()
        if conn is not None and row.source_module:  # CR-VENDORQ-294: the report's module hears the end too
            from . import contact_reports

            contact_reports.on_outcome(conn, row)

    def outcome(self, row: OutboxRow, result: SendResult, account: AccountRef | None) -> None:
        conn = self._conn()
        if conn is None:
            return
        now = self.rt.clock()
        kind = timeline_kind(row)
        ticket = obs.ticket_for_worker(conn, row.ticket_id) if row.ticket_id else None
        if ticket is not None and kind:
            store.insert_event(conn, ticket["id"], kind, actor_kind="system", actor_name="", assignment_id=row.assignment_id,
                               data={"outbox_id": row.id, "purpose": row.purpose, "channel": row.channel, "state": row.state,
                                     "code": None if row.state == SENT else row.outcome_code, "account": account.label if account else None,
                                     **({"fallback_of": row.fallback_of} if row.fallback_of else {}),
                                     **({"resend_of": row.resend_of} if row.resend_of else {})},
                               via="whatsapp" if row.channel == "whatsapp" else "email", at=obs.iso_s(now))
        if row.rfq_id:  # TKRFQ1: the request's own timeline (ids and states only)
            from . import rfq as rfq_mod

            rfq_mod.on_outbox_outcome(conn, row, row.state, row.outcome_code, obs.iso_s(now))
        if row.source_module:  # CR-VENDORQ-294: a report's module mirrors the final state (ids and states only)
            from . import contact_reports

            contact_reports.on_outcome(conn, row)
        audit(conn, actor=None, action="ticket.message.send", decision="allowed",
              resource_type="ticket" if row.ticket_id else "ticket_rfq" if row.rfq_id else "contact_report" if row.source_module else "installation",
              resource_id=row.ticket_id or row.rfq_id or row.source_id or "tickets",
              details={"outbox_id": row.id, "channel": row.channel, "purpose": row.purpose, "outcome": result.outcome,
                       "code": result.outcome_code, "account": account.key if account else row.account_key,
                       **({"number": ticket["number"]} if ticket else {}),
                       **({"module": row.source_module, "document": bool(row.document_id)} if row.source_module else {})})
        if result.outcome == SENT and ticket is not None and row.purpose in LINK_PURPOSES:
            if ticket.get("waiting_reason") == "send_failed" and ticket.get("current_assignment_id") == row.assignment_id \
                    and ticket["status"] not in model.FINAL:
                waiting_on, reason = model.waiting_for(ticket["status"])
                store.update_ticket(conn, ticket["id"], {"waiting_on": waiting_on, "waiting_reason": reason}, bump=False)
            _notify("send_failed", conn, ticket["id"], resolved=True)

    def send_failed(self, row: OutboxRow) -> None:
        conn = self._conn()
        if conn is not None and row.ticket_id:
            _notify("send_failed", conn, row.ticket_id)

    def fallback(self, row: OutboxRow, step: str, new_row: OutboxRow | None) -> None:
        conn = self._conn()
        if conn is not None and row.rfq_id and not row.ticket_id:  # TKRFQ1
            from . import rfq as rfq_mod

            rfq_mod.on_outbox_fallback(conn, row, step, new_row.id if new_row else None, obs.iso_s(self.rt.clock()))
            return
        if conn is None or not row.ticket_id:
            return
        ticket = obs.ticket_for_worker(conn, row.ticket_id)
        if ticket is None:
            return
        store.insert_event(conn, ticket["id"], "message_fallback", actor_kind="system", actor_name="", assignment_id=row.assignment_id,
                           data={"outbox_id": row.id, "step": step, "purpose": row.purpose, "channel": row.channel, "code": row.outcome_code,
                                 "new_outbox_id": new_row.id if new_row else None},
                           via="system", at=obs.iso_s(self.rt.clock()))
        link = store_links.link(conn, row.link_id) if row.link_id else None
        staff = bool(link) and link.get("kind") == "staff"  # TKSTAFF1: the WhatsApp is an extra channel - the user still has the app
        if step in ("nobody", "code_unavailable") and ticket["status"] not in model.FINAL and not staff \
                and (row.assignment_id is None or ticket.get("current_assignment_id") == row.assignment_id):
            store.update_ticket(conn, ticket["id"], {"waiting_on": "manager", "waiting_reason": "send_failed"}, bump=False)
            _notify("send_failed", conn, ticket["id"])

    def still_relevant(self, row: OutboxRow) -> bool:
        """After the module was off: a reminder or a link for a ticket that was closed, or an assignment that ended, is not sent."""
        conn = self._conn()
        if conn is not None and row.source_module:  # CR-VENDORQ-294: the report's module decides (e.g. a deleted schedule)
            from . import contact_reports

            return contact_reports.still_relevant(conn, row)
        if conn is not None and row.rfq_id and not row.ticket_id:  # TKRFQ1: a request that ended sends only its cancellation notice
            from . import rfq as rfq_mod

            return rfq_mod.outbox_still_relevant(conn, row)
        if conn is None or not row.ticket_id:
            return True
        ticket = obs.ticket_for_worker(conn, row.ticket_id)
        if ticket is None:
            return False
        if row.purpose in NOTICE_PURPOSES:
            return True
        if ticket["status"] in model.FINAL:
            return False
        if row.assignment_id and ticket.get("current_assignment_id") != row.assignment_id:
            return False
        return True


class DbOutbox(Outbox):
    """The message core's Outbox with the database's lock order (outbox_store's module note): `tick` and `recover_after_restart`
    take ONE write connection first (the gate) and bind it; the provider call commits the claim and runs with neither the gate nor
    the outbox lock held, then takes both back (gate first)."""

    def __init__(self, ports: Ports, db: Database) -> None:
        super().__init__(ports)
        self._db = db

    def tick(self, now: dt.datetime) -> int:
        with self._db.connection(label="tickets.outbox.tick") as conn, obs.bound(conn):
            return super().tick(now)

    def recover_after_restart(self, now: dt.datetime) -> list[OutboxRow]:
        with self._db.connection(label="tickets.outbox.recover") as conn, obs.bound(conn):
            return super().recover_after_restart(now)

    @contextlib.contextmanager
    def _outside_lock(self) -> Iterator[None]:
        conn = obs.current()
        with super()._outside_lock():
            if conn is not None and conn.in_transaction:
                with unlocked(conn):  # the claim (`sending`) is committed before the provider is called
                    yield
            else:
                yield


# ---------------------------------------------------------------- the runtime

class MessagingRuntime:
    def __init__(self) -> None:
        self.db: Database | None = None
        self.settings: Any = None
        self.data_dir: Path | None = None
        self.outbox: DbOutbox | None = None
        self.thread: OutboxThread | None = None
        self.queue = inbound_mod.InboundQueue()
        self.clock: Callable[[], dt.datetime] = utcnow
        self.transport: Any = None  # tests pass the fake ha-whatsapp here (set_transport)
        self.email_sender: Callable[[Any, str, Any], None] | None = None  # tests pass a fake SMTP
        self.counters: collections.Counter[str] = collections.Counter()
        self.inbound_wanted = False  # read by the ha_sync websocket thread: no database read there
        self._sub_want: bool | None = None  # what the reply subscription was last told (follow_subscription)
        self._accounts: ma.AccountsService | None = None
        self._whatsapp: WhatsAppChannel | None = None
        self._last_full = 0.0
        self._last_watch = 0.0
        self._janitor_at = 0.0
        self._states: dict[str, ma.AccountStatus] = {}
        self._lock = threading.Lock()
        self.started = False

    # ------------------------------------------------------------ configuration (create_app) / start / stop (the janitor events)

    def configure(self, settings: Any, db: Database, *, transport: Any = None) -> None:
        self.stop()
        self.db, self.settings = db, settings
        self.data_dir = Path(settings.data_dir) if getattr(settings, "data_dir", None) else None
        self.transport = transport
        self._accounts = None
        self._states = {}
        io = obs.Access(db)
        gate = ma.PacingGate(obs.BoundSendLedger(db))
        pacer = self._build_pacer(io, db)
        self._whatsapp = WhatsAppChannel(self._transport(), _LazyAccounts(self), use_buttons=self._use_buttons)
        email = EmailChannel(self._mail_config, sender=self._send_mail)
        ports = Ports(store=obs.SqliteOutboxStore(db), directory=DbDirectory(io), links=DbLinks(io, self.clock), templates=DbTemplates(io),
                      context=DbContext(io, lambda: self.data_dir), accounts=_LazyAccounts(self), channels={"whatsapp": self._whatsapp, "email": email},
                      gate=gate, messaging_key=b"", hooks=DbHooks(self), derive_code=self._derive_code, report_text=self._report_text,
                      pacer=pacer)
        ports.messaging_key = self._messaging_key()
        self.outbox = DbOutbox(ports, db)
        self.queue = inbound_mod.InboundQueue()
        self.counters = collections.Counter()
        self._register()

    @staticmethod
    def _build_pacer(io: Any, db: Database) -> wa_pacing.WaPacer:
        """CR-WA-PACING-295: the shared send budget on the worker's bound connection (writes) and short reads (settings, WisKey's record)."""
        store = wa_pacing.SqlitePacerStore(lambda: io.read("messaging.pacing"), io.write)

        def config() -> wa_pacing.PacerConfig:
            with io.read("messaging.pacing") as conn:
                return wa_pacing.load_config(conn)

        def foreign(since: dt.datetime) -> list[dt.datetime]:
            with io.read("messaging.pacing") as conn:
                return wa_pacing.wiskey_foreign_use(conn)(since)

        return wa_pacing.WaPacer(obs.BoundSendLedger(db), store, config=config, foreign=foreign, wiskey=mr.wiskey_pacing)

    def _transport(self) -> Any:
        if self.transport is not None:
            return self.transport
        return HaServiceTransport(self.settings)

    def set_transport(self, transport: Any) -> None:
        """Tests: the fake ha-whatsapp (records every call; never a network)."""
        self.transport = transport
        if self.outbox is not None and self._whatsapp is not None:
            self._whatsapp._transport = transport

    def _messaging_key(self) -> bytes:
        if self.data_dir is None:
            return b"\0" * 32
        try:
            return mr.messaging_key(self.data_dir) or b"\0" * 32
        except Exception:  # noqa: BLE001 - a damaged key file: the ledger keys are still per process, never a number
            log.error("messaging key unreadable; recipient keys use a process key")
            return os.urandom(32)

    def accounts(self) -> ma.AccountsService:
        if self._accounts is None:
            assert self.db is not None
            self._accounts = mr.accounts_service(self.db)
        return self._accounts

    def _use_buttons(self) -> bool:
        if self.db is None:
            return False
        with obs.Access(self.db).read() as conn:
            return channel_settings(conn)["whatsapp"]["use_buttons"]

    def _mail_config(self) -> Any | None:
        if self.db is None:
            return None
        with obs.Access(self.db).read() as conn:
            return mail_config(conn, self.data_dir)

    def _send_mail(self, cfg: Any, to: str, rendered: Any) -> None:
        if self.email_sender is not None:
            self.email_sender(cfg, to, rendered)
            return
        from .. import notify_email

        notify_email.smtp_send(cfg, to, rendered)

    def _derive_code(self, row: OutboxRow) -> str | None:
        """W9: the six digits of a code row, derived from its id under the link's key at render time."""
        if row.purpose == "phone_verify":  # TKNOTIFOTP: the verification row names its own key
            from . import phone_verify

            with obs.Access(self.db).read() as conn:
                return phone_verify.derive_for_outbox(conn, row.code_id, row.contact_id)
        if not row.code_id or not row.link_id:
            return None
        with obs.Access(self.db).read() as conn:
            link = store_links.link(conn, row.link_id) or store_rfq.link(conn, row.link_id)  # TKRFQVP: an RFQ vendor link's code
        if link is None:
            return None
        try:
            return codes_mod.derive_code(KEYS.get(link.get("key_id")), row.code_id)
        except Exception:  # noqa: BLE001 - a missing key: the code is lost (the vendor asks again)
            return None

    def _report_text(self, row: OutboxRow, recipient: Recipient) -> tuple[str | None, str | None]:
        """CR-VENDORQ-294: the text of a `report` row, built now from its module's data (on the worker's bound connection)."""
        from . import contact_reports

        with obs.Access(self.db).read("tickets.reports.render") as conn:
            return contact_reports.render(conn, row, recipient, self.clock())

    def _register(self) -> None:
        """The hooks other slices left for this one (each a plain module attribute; tests reset them)."""
        from . import external

        external.DISPATCH = OutboxDispatch(self)
        mr.QUEUED_COUNTER = lambda conn, use, dept: obs.open_count(conn, use, dept)
        mr.TEST_SENDER = self.test_send
        try:
            from . import monitor  # slice 6 (the SLA monitor): the outside reminder through the channel

            monitor.EXTERNAL_REMINDER = self.external_reminder
        except ImportError:
            pass
        from . import visits  # CR-SVC215 (3.4): the vendor's message on a missed visit - used only while visits.notify_vendor_on_miss is on

        visits.VENDOR_MISS_MESSAGE = self.visit_missed_message
        handler_links.NOTICE = self.notice
        handler_links.CHANNEL_OK = self.channel_ok
        # The public page's CodeSender is slice 7's code_flow.SqlCodeSender (wired in public_runtime): it reaches the outbox through
        # `external.DISPATCH.queue_code` (OutboxDispatch), so no CODE_SENDER hook is registered (OutboxCodeSender stays unused).

    def channel_ok(self, conn, link_row: dict[str, Any]) -> bool:
        contact = store_links.contact(conn, link_row.get("contact_id"))
        return contact is not None and not contact.get("erased_at") and plan_channel(conn, contact, self.data_dir) != "manual"

    def start(self) -> bool:
        """`_start_janitor`: the `tickets-outbox` thread (it recovers rows left `sending` first). Off with SW_TICKETS_OUTBOX=0."""
        if self.outbox is None or os.environ.get(ENV_THREAD, "1") == "0":
            return False
        # every pass goes through run_once (inbound drain, state watch, the outbox when something is due)
        self.thread = OutboxThread(_GuardedOutbox(self), clock=lambda: self.clock(), interval_s=2.0, drain_inbound=None)  # type: ignore[arg-type]
        self.thread.start()
        self.started = True
        return True

    def stop(self) -> None:
        thread, self.thread = self.thread, None
        if thread is not None:
            thread.stop()
        self.started = False

    # ------------------------------------------------------------ one pass of the worker (the thread calls it every 2 s)

    def run_once(self, now: dt.datetime | None = None, *, force: bool = False) -> int:
        """Drain the inbound queue, watch the account states (every minute), then tick the outbox when something is due."""
        if self.outbox is None or self.db is None:
            return 0
        now = now or self.clock()
        try:
            self.drain_inbound(now)
        except Exception:  # noqa: BLE001
            log.exception("ticket inbound drain failed")
        mono = time.monotonic()
        if force or mono - self._last_watch >= STATE_WATCH_EVERY_S:
            self._last_watch = mono
            try:
                self.watch_states()
            except Exception:  # noqa: BLE001
                log.warning("ticket channel state watch failed", exc_info=True)
        if not force:
            due, open_rows = self._work(now)
            if not open_rows:
                return 0  # an idle installation never takes the write lock
            if not due and mono - self._last_full < FULL_TICK_EVERY_S:
                return 0
        self._last_full = mono
        return self.outbox.tick(now)

    def _work(self, now: dt.datetime) -> tuple[bool, bool]:
        """(something is due now, any row is still open) - one short read."""
        with obs.Access(self.db).read("tickets.outbox.due") as conn:
            return obs.due(conn, now, access.module_on(conn)), obs.any_open(conn)

    # ------------------------------------------------------------ account states -> CR-018 `ticket.channel_down` (slice 6)

    def watch_states(self) -> None:
        if self.db is None:
            return
        with obs.Access(self.db).read() as conn:
            if not access.module_on(conn) or not channel_settings(conn)["whatsapp"]["enabled"]:
                self.follow_subscription(False)
                return
        svc = self.accounts()
        mapped = svc.mapped_keys("tickets")
        after = svc.statuses()
        moves = ma.state_transitions(self._states, after, mapped)
        self._states = after
        self.follow_subscription(bool(mapped))
        if not (moves["down"] or moves["up"]):
            return
        doc = svc.doc()
        with self.db.connection(label="tickets.channel.state") as conn:
            for key in moves["down"]:
                acc = doc.account(key)
                _notify("channel_state", conn, key, (acc.label if acc else "") or key, down=True)
            for key in moves["up"]:
                acc = doc.account(key)
                _notify("channel_state", conn, key, (acc.label if acc else "") or key, down=False)

    def follow_subscription(self, want: bool) -> None:
        """The ha_sync reply subscription follows the module switch, the WhatsApp master switch and the ticket uses' account mapping -
        each may change on another screen (Settings › the module, Settings › ערוץ ההודעות): the worker's minute watch and the
        channel route call this; on the live session it is idempotent, and a new session's on_ready subscribes from the database."""
        self.inbound_wanted = want
        if want == self._sub_want:
            return
        self._sub_want = want
        try:
            from .. import ha_sync

            ha_sync.SYNC.tickets_inbound_switched(want)
        except Exception:  # noqa: BLE001 - the next session subscribes from the database anyway
            log.warning("ticket reply subscription follow failed", exc_info=True)

    # ------------------------------------------------------------ inbound (9.6)

    def wants_inbound(self, db: Database | None = None) -> bool:
        """The ha_sync subscription is made only when the module is on, WhatsApp is enabled and a ticket use has an account."""
        db = db or self.db
        if db is None:
            return False
        with db.connection(mode="read", label="tickets.inbound.wanted") as conn:
            return wants_inbound_conn(conn)

    def submit_inbound(self, event: Mapping[str, Any]) -> bool:
        """From the ha_sync websocket thread: never a write, never a log of the event (it holds a number and a text)."""
        ok = self.queue.submit(event)
        if not ok:
            self.counters["queue_overflow"] += 1
        return ok

    def processor(self, conn) -> inbound_mod.InboundProcessor | None:
        try:
            _kid, key = KEYS.current(create=False)
        except Exception:  # noqa: BLE001 - no module key yet: no contact has a phone key, nothing can match
            return None
        window = channel_settings(conn)["whatsapp"]["reply_window_h"]
        svc = self.accounts()
        io = obs.Access(self.db)

        def recent(since: dt.datetime) -> set[str]:
            with io.read() as c:
                return obs.recent_account_keys(c, since)

        return inbound_mod.InboundProcessor(key=key, directory=DbMatchDirectory(io, self.clock), dedupe=DbDedupe(io),
                                            account_filter=inbound_mod.TicketAccountFilter(lambda: svc.mapped_keys("tickets"), recent, lambda: window,
                                                                                           visible_keys=svc.all_keys),
                                            reply_window_h=lambda: window)

    def drain_inbound(self, now: dt.datetime) -> int:
        events = self.queue.drain()
        if not events or self.db is None:
            return 0
        done = 0
        for event in events:
            # deep review B1: the batch is already off the queue - one event that raises (a shape surprise, a database error)
            # must not take the rest of the batch with it. Its transaction rolls back; the log line names the exception type
            # only (never the frame, the text, a number or the exception message, which may quote the text).
            try:
                done += self._drain_one(event, now)
            except Exception as exc:  # noqa: BLE001
                self.counters["event_failed"] += 1
                log.warning("ticket inbound event failed (%s)", type(exc).__name__)
        return done

    def _drain_one(self, event: Mapping[str, Any], now: dt.datetime) -> int:
        assert self.db is not None
        with self.db.connection(label="tickets.inbound") as conn, obs.bound(conn):
            if not access.module_on(conn) or not channel_settings(conn)["whatsapp"]["enabled"]:
                self.counters["dropped_off"] += 1
                return 0
            proc = self.processor(conn)
            if proc is None:
                self.counters["dropped_no_key"] += 1
                return 0
            decision = proc.process(event, now)
            if decision is None:
                return 0
            iid = apply_decision(conn, decision, now)
            self.counters[decision.result] += 1
            if iid and decision.result == "unknown_sender" and decision.reason is None:
                self._intake(conn, event, iid, now)
            return 1

    def _intake(self, conn, event: Mapping[str, Any], inbound_id: str, now: dt.datetime) -> None:
        """CR-INTAKE99: a text that matched no ticket and no RFQ reaches the free-text intake (known numbers only, owner 146). The
        envelope row keeps `unknown_sender` and gets the intake reason (and the draft id). A failure never loses the envelope."""
        from . import intake

        msg = inbound_mod.normalise(event)
        if msg is None or msg.event_type != inbound_mod.EVENT_RECEIVED or (msg.msg_type or "") not in inbound_mod.TEXT_TYPES:
            return
        try:
            _kid, key = KEYS.current(create=False)
            reason, draft_id = intake.accept(conn, key=key, digits=msg.sender_digits, content=msg.content, account_key=msg.account_key, now=now, rt=self)
        except Exception as exc:  # noqa: BLE001 - never the text, a number or the exception message
            self.counters["intake_failed"] += 1
            log.warning("intake failed (%s)", type(exc).__name__)
            return
        if reason == "intake_off":  # the module / switch is off (the default): the envelope stays exactly as before the intake existed
            return
        conn.execute("UPDATE ticket_inbound SET reason = ?, intake_draft_id = ? WHERE id = ?", (reason, draft_id, inbound_id))
        self.counters[reason] += 1

    # ------------------------------------------------------------ enqueue helpers (called inside a request's transaction)

    def enqueue(self, conn, **kw: Any) -> OutboxRow:
        assert self.outbox is not None
        with obs.bound(conn):
            return self.outbox.enqueue(now=self.clock(), **kw)

    def test_send(self, conn, ref: AccountRef, digits: str, requested_by: str) -> dict[str, Any]:
        """Slice 5a's per-account "שליחת בדיקה" (gated there by SW_MESSAGING_TEST_SEND=1 - each live use is an owner-approved
        action): one fixed text to a typed number; the number lives in memory only (outbox TransientSecrets)."""
        row = self.enqueue(conn, purpose="test", test_target=digits, test_account_key=ref.key, requested_by=requested_by, channel="whatsapp")
        return {"id": row.id, "state": row.state}

    def external_reminder(self, conn, ticket: dict[str, Any], number: int, now: dt.datetime) -> bool:
        """Slice 6's SLA monitor: a reminder to the current OUTSIDE assignee through the channel (held by the send hours, paced,
        it extends the link's sliding expiry when it leaves). False when no message channel can carry it (the managers are
        alerted instead)."""
        asg = store.assignment(conn, ticket.get("current_assignment_id"))
        if asg is None or asg.get("assignee_kind") != "contact" or asg.get("ended_at"):
            return False
        link = store_links.link_for_assignment(conn, asg["id"])
        contact = store_links.contact(conn, asg.get("contact_id"))
        if link is None or contact is None or handler_links.state(link, now) != "live":
            return False
        channel = plan_channel(conn, contact, self.data_dir)
        if channel == "manual":
            return False
        self.enqueue(conn, purpose="reminder", contact_id=contact["id"], ticket_id=ticket["id"], assignment_id=asg["id"], link_id=link["id"],
                     department_id=ticket["department_id"], params=message_params(conn, ticket, contact, assignment_id=asg["id"]), channel=channel, requested_by="system",
                     idempotency_key=f"reminder:{asg['id']}:{int(number)}")
        return True

    def visit_missed_message(self, conn, ticket_id: str, visit: dict[str, Any], now: dt.datetime) -> bool:
        """CR-SVC215 (3.4): the vendor of a missed visit is reminded through his live link - the existing `reminder` purpose (held by the
        send hours, paced, one per visit by its idempotency key). False when no channel can carry it. The dedicated catalogue text of the
        CR ("לא נרשמה הגעה...") is a follow-up of the message catalogue; until then the reminder text goes."""
        asg = store.assignment(conn, visit.get("assignment_id"))
        if asg is None or asg.get("assignee_kind") != "contact" or asg.get("ended_at") or asg.get("ticket_id") != ticket_id:
            return False
        ticket = obs.ticket_for_worker(conn, ticket_id)
        link = store_links.link_for_assignment(conn, asg["id"])
        contact = store_links.contact(conn, asg.get("contact_id"))
        if ticket is None or link is None or contact is None or contact.get("erased_at") or handler_links.state(link, now) != "live":
            return False
        channel = plan_channel(conn, contact, self.data_dir)
        if channel == "manual":
            return False
        self.enqueue(conn, purpose="reminder", contact_id=contact["id"], ticket_id=ticket_id, assignment_id=asg["id"], link_id=link["id"],
                     department_id=ticket["department_id"], params=message_params(conn, ticket, contact, assignment_id=asg["id"]), channel=channel,
                     requested_by="system", idempotency_key=f"visitmiss:{visit['id']}")
        return True

    def notice(self, conn, link_row: dict[str, Any], purpose: str, at: dt.datetime) -> None:
        """handler_links: a status notice to the contact whose link a manager's act ended - "closed" (the read-only grace starts) or
        "reassigned" (revoked). Only when the link actually left by a channel (a copied link is the manager's own message), and only
        while WhatsApp or e-mail can carry it; held by the send hours like every non-urgent vendor message."""
        if purpose not in NOTICE_PURPOSES or self.outbox is None:
            return
        if link_row.get("sent_via") not in ("whatsapp", "email"):
            return
        contact = store_links.contact(conn, link_row.get("contact_id"))
        ticket = obs.ticket_for_worker(conn, link_row["ticket_id"])
        if contact is None or contact.get("erased_at") or ticket is None:
            return
        channel = plan_channel(conn, contact, self.data_dir)
        if channel == "manual":
            return
        try:
            self.enqueue(conn, purpose=purpose, contact_id=contact["id"], ticket_id=ticket["id"], assignment_id=link_row.get("assignment_id"),
                         link_id=link_row["id"], department_id=ticket["department_id"],
                         params=message_params(conn, ticket, contact, assignment_id=link_row.get("assignment_id")),
                         channel=channel, requested_by="system", idempotency_key=f"{purpose}:{link_row['id']}:{int(link_row.get('generation') or 1)}")
        except OutboxError:
            log.warning("ticket notice not queued purpose=%s", purpose)

    # ------------------------------------------------------------ janitor (retention, hourly)

    def janitor(self, db: Database, *, force: bool = False) -> int:
        mono = time.monotonic()
        if not force and mono - self._janitor_at < JANITOR_EVERY_S:
            return 0
        self._janitor_at = mono
        now = self.clock()
        with db.connection(label="tickets.messaging.retention") as conn:
            n = obs.prune(conn, outbox_before=now - OUTBOX_KEEP, inbound_before=now - INBOUND_KEEP)
            from . import out_documents  # CR-VENDORQ-294: a document's bytes go at expiry / revocation, its row 90 days later

            n += out_documents.purge(conn, now)
            n += out_documents.revoke_for_inactive_users_safe(conn, now)  # TEMPLINK-2320: the safety net behind the deactivation hooks
            from . import intake  # CR-INTAKE99: expire / purge drafts, the daily summary of unlisted attempts

            n += intake.janitor(conn, now)
            n += wa_pacing.SqlitePacerStore(lambda: contextlib.nullcontext(conn), lambda: conn).prune(now - wa_pacing.COUNTER_KEEP)  # CR-WA-PACING-295
        if n:
            log.info("tickets messaging retention rows=%d", n)
        return n

    # ------------------------------------------------------------ health (spec 17)

    def health(self, conn) -> dict[str, Any]:
        now = self.clock()
        return {
            "worker": {"running": bool(self.thread is not None and self.started), "inbound_wanted": self.inbound_wanted},
            "outbox": obs.health_counts(conn, now),
            "inbound": {"last_24h": obs.inbound_counts(conn, now), "queue": len(self.queue), "queue_overflow": self.queue.overflow,
                        "counters": dict(self.counters)},
        }


class _GuardedOutbox:
    """What the OutboxThread ticks: the runtime's full pass (inbound drain, state watch, the outbox when something is due)."""

    def __init__(self, rt: MessagingRuntime) -> None:
        self.rt = rt

    def tick(self, now: dt.datetime) -> int:
        return self.rt.run_once(now)

    def recover_after_restart(self, now: dt.datetime) -> list[OutboxRow]:
        assert self.rt.outbox is not None
        return self.rt.outbox.recover_after_restart(now)


class _LazyAccounts:
    """The account service of the worker, built on first use (after the migrations ran). While the master WhatsApp switch is OFF no
    ticket use resolves to an account: rows queued before the switch went off are held (`account_unmapped`) and then fall back (D13) -
    nothing leaves on WhatsApp. A per-account test send (`ref`) is the administrator's own act and is not affected."""

    def __init__(self, rt: MessagingRuntime) -> None:
        self.rt = rt

    def resolve(self, use_key: str, department_id: str | None = None) -> AccountRef | None:
        if self.rt.db is not None:
            with obs.Access(self.rt.db).read() as conn:
                if not channel_settings(conn)["whatsapp"]["enabled"]:
                    return None
        return self.rt.accounts().resolve(use_key, department_id)

    def __getattr__(self, name: str) -> Any:
        return getattr(self.rt.accounts(), name)


RUNTIME = MessagingRuntime()


def wants_inbound_conn(conn) -> bool:
    if not access.module_on(conn) or not channel_settings(conn)["whatsapp"]["enabled"]:
        return False
    return bool(ma.keys_for_module(mr.load_doc(conn), mr.registry(conn), "tickets"))


def account_labels(conn) -> dict[str, str]:
    doc = mr.load_doc(conn)
    return {a.key: a.label for a in doc.accounts if a.label}


def ticket_messages(conn, viewer: Any, seen: Any, limit: int = 20) -> list[dict[str, Any]]:
    """The ticket page's delivery lines (D14) and their actions, for managers and holders of `tickets.external` only: purpose,
    channel, state (held with its reason and the time it will leave, sent, "maybe sent", not sent), the account label it left from
    (D27), "send now" (D29: a message held by the send hours, `tickets.external`) and "send again" (an unknown / failed message,
    a manager with `tickets.external`; a NEW row - the old one keeps its state)."""
    external = viewer.holds(access.EXTERNAL, seen.row)
    if not (seen.manager or external):
        return []
    rows = obs.rows_of_ticket(conn, seen.row["id"], limit)
    if not rows:
        return []
    labels = account_labels(conn)
    current = seen.row.get("current_assignment_id") if not seen.row.get("asg_ended_at") else None
    resent = {r.resend_of for r in rows if r.resend_of} | {r.fallback_of for r in rows if r.fallback_of}
    out = []
    for r in rows:
        if r.state in ("superseded", "cancelled"):
            continue
        is_current = bool(r.assignment_id) and r.assignment_id == current
        out.append({
            "id": r.id, "purpose": r.purpose, "channel": r.channel, "state": r.state, "held_reason": r.held_reason,
            "not_before": obs.iso_s(r.not_before) if r.state in ("queued", "held") else None,
            "created_at": obs.iso_s(r.created_at), "sent_at": obs.iso_s(r.sent_at) if r.sent_at else None,
            "attempts": r.attempts, "code": r.outcome_code if r.state not in ("sent", "queued") else None,
            "account": labels.get(r.account_key or "", None) if r.account_key else None,
            "fallback_of": r.fallback_of, "resend_of": r.resend_of, "current": is_current,
            "can": {
                "send_now": bool(external and r.state == "held" and r.held_reason == "send_hours"),
                "resend": bool(seen.manager and external and r.state in ("unknown", "not_sent", "refused") and r.purpose not in ("code", "test")
                               and is_current and r.id not in resent and seen.row["status"] not in model.FINAL),
            },
        })
    return out


def submit_inbound(event: Mapping[str, Any]) -> bool:
    """ha_sync's hand-off (the websocket thread). Events are taken only while the subscription is wanted."""
    if not RUNTIME.inbound_wanted:
        RUNTIME.counters["dropped_not_wanted"] += 1
        return False
    return RUNTIME.submit_inbound(event)


# ---------------------------------------------------------------- the channel an assignment takes (D13) and the message's values

def plan_channel(conn, contact: Mapping[str, Any], data_dir: Path | None) -> str:
    """'whatsapp' | 'email' | 'manual' for a message to this contact now: the contact's preferred channel, WhatsApp only while the
    master switch is on (and the contact has a number), e-mail only with an address and a configured SMTP (and, when WhatsApp was
    preferred, only with the e-mail fallback on); otherwise the manager copies the link. The account's state is NOT checked here:
    a WhatsApp row of a disconnected account is held, then falls back (9.2 / 9.9.4)."""
    cs = channel_settings(conn)
    preferred = contact.get("preferred_channel") or "whatsapp"
    has_phone = phone_digits(contact.get("phone_e164") or "") is not None
    has_email = bool(contact.get("email"))
    mail_ok = has_email and email_configured(conn, data_dir)
    if preferred == "manual":
        return "manual"
    if preferred == "email":
        return "email" if mail_ok else "manual"
    if cs["whatsapp"]["enabled"] and has_phone and _verified_for_whatsapp(conn, contact):
        return "whatsapp"
    if cs["email_fallback"] and mail_ok:
        return "email"
    return "manual"


def _verified_for_whatsapp(conn, contact: Mapping[str, Any]) -> bool:
    """TKNOTIFOTP: while number verification is on for this contact (the installation switch or the row's own), nothing goes to its
    WhatsApp number until the code sent to that number was typed back. Off (the default): unchanged."""
    from . import phone_verify

    return phone_verify.whatsapp_allowed(conn, contact)


def assignment_location_nav(conn, ticket: Mapping[str, Any], assignment_id: str | None = None) -> bool:
    """CR-ORG-LOCATIONS: the navigation-link choice stored on the assignment (the named one, else the ticket's current one). It
    counts only while the ticket's location still has coordinates in its snapshot."""
    asg = store.assignment(conn, assignment_id or ticket.get("current_assignment_id"))
    return bool(asg and asg.get("location_nav") and org_locations.has_coordinates(org_locations.parse_snapshot(ticket.get("location_snapshot"))))


def message_params(conn, ticket: Mapping[str, Any], contact: Mapping[str, Any], *, assignment_id: str | None = None,
                   location_nav: bool | None = None) -> dict[str, str]:
    """The placeholders of 9.7 (never {link} / {code}, never a phone or an address): the contact's name, the number with the
    department next to it, the title, the place line (device, place - "air conditioner, floor 1, room 102" reaches the handler),
    the priority, the organisation, the assigning manager and the ETA in the installation's zone."""
    dept = store.department_any(conn, ticket["department_id"]) or {}
    prio = store.priority(conn, ticket["priority_id"]) if ticket.get("priority_id") else None
    device = ticket.get("device_name") or ""
    # CR-ORG-LOCATIONS: the request's own location (its snapshot) - only in a message of the request that names it
    # the map link only when the assignment's manager switched it on (default off): `location_nav` is the preview's choice, else the stored one
    nav = assignment_location_nav(conn, ticket, assignment_id) if location_nav is None else bool(location_nav)
    snap = org_locations.parse_snapshot(ticket.get("location_snapshot"))
    location = org_locations.message_text(snap, nav=nav and org_locations.has_coordinates(snap))
    place = ", ".join(p for p in (device, ticket.get("place_text") or location) if p)
    eta = ""
    if ticket.get("eta_at"):
        when = obs.parse(ticket["eta_at"])
        if when is not None:
            eta = when.astimezone(time_zone(conn)).strftime("%d/%m %H:%M")
    manager = store.display_name(conn, ticket.get("assigner_user_id")) if ticket.get("assigner_user_id") else ""
    doc = settings_doc.read(conn)
    return {"name": contact.get("display_name") or "", "number": str(ticket["number"]), "department": dept.get("name") or "",
            "title": ticket.get("title") or "", "place": place, "device": device, "priority": (prio or {}).get("name") or "",
            "organization": doc.get("organization_name") or "", "manager": manager, "eta": eta, **({"location": location} if location else {})}


def render_preview(conn, *, purpose: str, contact: Mapping[str, Any], ticket: Mapping[str, Any], template_id: str | None = None,
                   link_text: str | None = None, location_nav: bool | None = None) -> dict[str, Any]:
    """The EXACT text the outbox will render for this contact (template per language D26, the module's name D33), with the link
    shown as a placeholder (review T13-3) - or with `link_text` (the manager's "copy link" message)."""
    lang = contact.get("lang") if contact.get("lang") in LANGS else "he"
    cands = [template_text(r) for r in message_template_rows(conn, purpose=purpose, department_id=ticket.get("department_id"))]
    tpl = next((t for t in cands if template_id and t.id == template_id), None) or mt.choose(cands, purpose=purpose, lang=lang,
                                                                                               department_id=ticket.get("department_id"))
    if tpl is None:
        return {"text": "", "lang": lang, "template_id": None}
    try:
        text = mt.render(tpl.body, message_params(conn, ticket, contact, location_nav=location_nav), lang=tpl.lang, display_name=display_names(conn),
                         secrets={"link": link_text or LINK_PLACEHOLDER.get(tpl.lang, "[link]")}, check_length=False)
    except mt.TemplateError:
        text = ""
    return {"text": text, "lang": tpl.lang, "template_id": None if tpl.is_starter else tpl.id}


# ---------------------------------------------------------------- external.DISPATCH

class OutboxDispatch:
    """services/tickets/external.LinkDispatch on the outbox (slice 4 left the seam; slice 5b plugs in here)."""

    def __init__(self, rt: MessagingRuntime) -> None:
        self.rt = rt

    def channel(self, conn, contact: dict[str, Any]) -> str:
        return plan_channel(conn, contact, self.rt.data_dir)

    def queue(self, conn, *, purpose: str, ticket: dict[str, Any], assignment_id: str, link: dict[str, Any], contact: dict[str, Any],
              send_now: bool, requested_by: str) -> dict[str, Any]:
        """Write the outbox row inside the caller's (the assignment's) transaction - never a send inline. A reassignment of a
        reopened ticket sends the `reopened` text (11.2)."""
        ch = self.channel(conn, contact)
        if ch == "manual" or self.rt.outbox is None:
            return {"queued": False, "channel": "manual"}
        if purpose == "assign" and ticket.get("status") == "closed":
            purpose = "reopened"
        template_id = None
        if link.get("kind") == "staff":  # TKSTAFF1: the staff text (one URL; no quick-reply line when a code is required)
            if ch != "whatsapp":
                return {"queued": False, "channel": "manual"}  # a staff link leaves by WhatsApp only
            template_id = mt.staff_template_id(bool(link.get("require_code")), contact.get("lang") or "he")
        row = self.rt.enqueue(conn, purpose=purpose, contact_id=contact["id"], ticket_id=ticket["id"], assignment_id=assignment_id,
                              link_id=link["id"], department_id=ticket["department_id"], params=message_params(conn, ticket, contact, assignment_id=assignment_id),
                              channel=ch, send_now=send_now, requested_by=requested_by, template_id=template_id)
        held = hours.decide(row.purpose, self.rt.clock(), send_window(conn, ticket["department_id"]), time_zone(conn), send_now=row.send_now)
        return {"queued": True, "channel": ch, "outbox_id": row.id, "held_until": None if held.send else obs.iso_s(held.not_before)}

    def queue_arrival_cancelled(self, conn, *, ticket: dict[str, Any], assignment_id: str, link: dict[str, Any], contact: dict[str, Any],
                                requested_by: str, token: str) -> dict[str, Any]:
        """PHYSENTRY070-295: the vendor notice "the entry request was cancelled" (purpose `update`, the code-owned variant
        `arrival_cancelled`), inside the caller's transaction, never inline. Nothing is queued for a staff link or when no channel can carry it.
        `token` (the instant of the cancel) makes one cancel one message."""
        ch = self.channel(conn, contact)
        if ch == "manual" or self.rt.outbox is None or link.get("kind") == "staff":
            return {"queued": False, "channel": "manual"}
        lang = contact.get("lang") if contact.get("lang") in mt.LANGS else mt.DEFAULT_LANG
        try:
            row = self.rt.enqueue(conn, purpose="update", contact_id=contact["id"], ticket_id=ticket["id"], assignment_id=assignment_id,
                                  link_id=link["id"], department_id=ticket["department_id"],
                                  params=message_params(conn, ticket, contact, assignment_id=assignment_id), channel=ch, requested_by=requested_by,
                                  idempotency_key=f"arrcancel:{assignment_id}:{token}", template_id=mt.variant_template_id(mt.ARRIVAL_CANCELLED, lang))
        except OutboxError:
            log.warning("arrival-cancel notice not queued")
            return {"queued": False, "channel": ch}
        return {"queued": True, "channel": ch, "outbox_id": row.id}

    def code_ready(self, conn, contact: dict[str, Any]) -> tuple[bool, bool]:
        """(WhatsApp can carry a code now, e-mail can carry a code now) for the D6 rule at assignment time."""
        return code_channels(conn, contact, self.rt)

    def queue_code(self, conn, *, ticket: dict[str, Any], link: dict[str, Any], contact: dict[str, Any], code: str, code_id: str,
                   channel: str, requested_by: str) -> dict[str, Any]:
        """Slice 7's seam (external.LinkDispatch.queue_code): the verification-code message - purpose `code`, priority 0, never held
        by the send hours, the `code` template (no link, no title) - written inside the caller's transaction. The six digits stay
        IN MEMORY (outbox TransientSecrets) and the row keeps the code ROW id only (W9: after a restart they are derived again from
        it). The code row learns its outbox id."""
        if self.rt.outbox is None or channel not in ("whatsapp", "email"):
            return {"queued": False}
        row = self.rt.enqueue(conn, purpose="code", contact_id=contact["id"], ticket_id=ticket["id"], assignment_id=link["assignment_id"],
                              link_id=link["id"], department_id=ticket["department_id"], params={"number": str(ticket["number"])},
                              channel=channel, requested_by=requested_by, code=code, code_id=code_id)
        store_links.set_code_outbox(conn, code_id, row.id)
        return {"queued": True, "outbox_id": row.id, "channel": channel}

    def preview_extra(self, conn, ticket: dict[str, Any], contact: dict[str, Any], *, location_nav: bool = False) -> dict[str, Any]:
        """The assign dialog's lines (review T13-3): the exact text, the channel, the account it would leave from, the send-hours
        line ("יישלח ב-07:00") and the "send now" default (preselected for critical priorities, D29)."""
        ch = self.channel(conn, contact)
        out: dict[str, Any] = {"channel": ch}
        rendered = render_preview(conn, purpose="reopened" if ticket.get("status") == "closed" else "assign", contact=contact, ticket=ticket,
                                  location_nav=location_nav)
        if ch != "manual":
            out["text"] = rendered["text"]
            out["lang"] = rendered["lang"]
        now = self.rt.clock()
        window = send_window(conn, ticket["department_id"])
        decision = hours.decide("assign", now, window, time_zone(conn))
        prio = store.priority(conn, ticket["priority_id"]) if ticket.get("priority_id") else None
        out["send_hours"] = {"window": window.as_doc(), "open_now": decision.send, "next_opening": None if decision.send else obs.iso_s(decision.not_before),
                             "send_now_default": hours.default_send_now((prio or {}).get("notify_severity") or "")}
        account = None
        if ch == "whatsapp":
            try:
                ref = self.rt.accounts().resolve("tickets.messages", ticket["department_id"])
                if ref is not None:
                    st = self.rt.accounts().status(ref.key)
                    account = {"key": ref.key, "label": ref.label, "state": st.state, "sendable": bool(ref.value) and st.sendable}
            except Exception:  # noqa: BLE001 - a preview never fails on the account lookup
                account = None
        out["account"] = account
        out["fallback"] = fallback_plan(conn, contact, self.rt.data_dir) if ch == "whatsapp" else None
        return out
    # The manager's "copy link" text stays slice 4's own (external.render_message): the configured templates invite a numbered reply
    # ("1 = התקבל") that only the ticket account can read - a message the manager pastes from his own phone must not promise that.


def fallback_plan(conn, contact: Mapping[str, Any], data_dir: Path | None) -> str:
    """What happens when WhatsApp cannot carry the message (D13): 'email' or 'manual' (copy link)."""
    cs = channel_settings(conn)
    if cs["email_fallback"] and contact.get("email") and email_configured(conn, data_dir):
        return "email"
    return "manual"


def whatsapp_code_ready(conn, contact: Mapping[str, Any], rt: MessagingRuntime) -> bool:
    """WhatsApp can carry a code to this contact's number now: the master switch, a number, and a sendable `tickets.codes` account."""
    cs = channel_settings(conn)
    if not cs["whatsapp"]["enabled"] or phone_digits(contact.get("phone_e164") or "") is None:
        return False
    try:
        ref = rt.accounts().resolve("tickets.codes")
        return ref is not None and bool(ref.value) and rt.accounts().status(ref.key).sendable
    except Exception:  # noqa: BLE001
        return False


def code_channels(conn, contact: Mapping[str, Any], rt: MessagingRuntime) -> tuple[bool, bool]:
    cs = channel_settings(conn)
    # TKNOTIFOTP: a link code never goes to a number that verification still holds back (the number check has its own message)
    whatsapp_ok = whatsapp_code_ready(conn, contact, rt) and _verified_for_whatsapp(conn, contact)
    email_ok = bool(contact.get("email")) and cs["email_fallback"] and email_configured(conn, rt.data_dir)
    return whatsapp_ok, email_ok


# ---------------------------------------------------------------- the public page's CodeSender (public_ports.CodeSender)

class OutboxCodeSender:
    """`channel_for` = the D6 rule over the live state; `send` queues ONE `code` row with the code ROW id (W9: the six digits are
    derived from it at render time - never in the row, never in a log). Called from the public listener's threads, which hold no
    database connection: the row is written in a short transaction of its own (gate first, then the outbox lock)."""

    def __init__(self, rt: MessagingRuntime) -> None:
        self.rt = rt

    def channel_for(self, link: Any) -> str | None:
        db = self.rt.db
        if db is None:
            return None
        with db.connection(mode="read", label="tickets.code.channel") as conn:
            row = store_links.link(conn, link.link_id)
            contact = store_links.contact(conn, row["contact_id"]) if row else None
            if row is None or contact is None or contact.get("erased_at"):
                return None
            whatsapp_ok, email_ok = code_channels(conn, contact, self.rt)
            return codes_mod.code_channel(link_sent_via=row.get("sent_via"), whatsapp_ready=whatsapp_ok,
                                          has_phone=phone_digits(contact.get("phone_e164") or "") is not None,
                                          email_ready=email_ok, has_email=bool(contact.get("email")))

    def send(self, link: Any, code_id: str, channel: str) -> bool:
        db = self.rt.db
        if db is None or self.rt.outbox is None or channel not in ("whatsapp", "email"):
            return False
        try:
            with db.connection(label="tickets.code.queue") as conn:
                row = store_links.link(conn, link.link_id)
                contact = store_links.contact(conn, row["contact_id"]) if row else None
                ticket = obs.ticket_for_worker(conn, row["ticket_id"]) if row else None
                if row is None or contact is None or ticket is None:
                    return False
                digits = codes_mod.derive_code(KEYS.get(row.get("key_id")), code_id)
                result = OutboxDispatch(self.rt).queue_code(conn, ticket=ticket, link=row, contact=contact, code=digits, code_id=code_id,
                                                            channel=channel, requested_by=f"link:{row['id'][:6]}")
            return bool(result.get("queued"))
        except Exception:  # noqa: BLE001 - the code route answers 503 code_unavailable; nothing about the code is logged
            log.warning("verification code not queued")
            return False


# ---------------------------------------------------------------- the inbound matcher's ports (inbound.MatchDirectory / DedupeStore)

def _link_state(r: Mapping[str, Any], now: dt.datetime) -> str:
    if r.get("expires_at") is None:
        return "none"
    return handler_links.state({"revoked_at": r.get("revoked_at"), "expires_at": r["expires_at"], "cap_at": r.get("cap_at") or r["expires_at"],
                                "grace_until": r.get("grace_until")}, now)


class DbMatchDirectory:
    def __init__(self, io: obs.Access, clock: Callable[[], dt.datetime]) -> None:
        self.io = io
        self.clock = clock

    def by_nonce(self, nonce: str) -> inbound_mod.NonceTarget | None:
        with self.io.read() as conn:
            r = obs.nonce_row(conn, nonce)
        if r is None or not r.get("ticket_id") or not r.get("assignment_id"):
            return None
        return inbound_mod.NonceTarget(
            outbox_id=r["outbox_id"], ticket_id=r["ticket_id"], ticket_number=int(r["number"]), department_id=r["department_id"],
            assignment_id=r["assignment_id"], contact_id=r.get("contact_id") or "", contact_phone_key=r.get("phone_key"), account_key=r.get("account_key"),
            link_live=_link_state(r, self.clock()) == "live", assignment_current=r.get("current_assignment_id") == r["assignment_id"] and not r.get("asg_ended_at"),
            requires_code=bool(r.get("require_code")), ticket_status=r["status"], provider_message_id=r.get("provider_message_id"),
            # deep review B3: the button acts only for the generation its message carried (NULL never matches - see 0086)
            generation_current=r.get("link_generation") is not None and r.get("link_generation") == r.get("link_current_generation"))

    def candidates(self, sender_key: str, *, since: dt.datetime, account_key: str | None) -> list[inbound_mod.Candidate]:
        with self.io.read() as conn:
            rows = obs.inbound_candidates(conn, sender_key, since)
        out = []
        for r in rows:
            sent_at = obs.parse(r.get("sent_at"))
            if not r.get("outbox_id") or sent_at is None:
                continue  # nothing went to that contact for this ticket within the reply window
            if _link_state(r, self.clock()) not in ("live", "none"):
                continue
            out.append(inbound_mod.Candidate(ticket_id=r["ticket_id"], ticket_number=int(r["number"]), department_id=r["department_id"],
                                             assignment_id=r["assignment_id"], contact_id=r["contact_id"], outbox_id=r["outbox_id"],
                                             last_sent_at=sent_at, account_key=r.get("account_key"), ticket_status=r["status"],
                                             requires_code=bool(r.get("require_code"))))
        return out

    def rfq_candidates(self, sender_key: str, *, since: dt.datetime, account_key: str | None) -> list[inbound_mod.RfqCandidate]:
        """TKRFQ5: the sender's OPEN requests (services/tickets/rfq_inbound.py)."""
        from . import rfq_inbound

        with self.io.read() as conn:
            return rfq_inbound.candidates(conn, sender_key, since=since, now=self.clock())


class DbDedupe:
    def __init__(self, io: obs.Access) -> None:
        self.io = io

    def seen(self, key: str, now: dt.datetime) -> bool:
        with self.io.read() as conn:
            return obs.seen_recently(conn, key, now, inbound_mod.DEDUPE_FOR)


# ---------------------------------------------------------------- applying a decision (9.6 steps 3-6)

UNVERIFIED_MARK = {"unverified": True}


def apply_decision(conn, decision: inbound_mod.InboundDecision, now: dt.datetime) -> str | None:
    """Write what an InboundDecision says, in the worker's transaction: the envelope row (`content` only for ambiguous / note /
    late), the advisory status (forward only, re-checked here), a note "via WhatsApp (unverified sender)", a late note and
    "waiting for the manager", the CR-018 signals, the audit envelope. Returns the inbound row id (None for `dropped`)."""
    if decision.result == "dropped" or not decision.record:
        return None
    contact_id = decision.contact_id
    if decision.result == "ambiguous" and not contact_id and decision.candidate_ticket_ids:
        first = obs.ticket_for_worker(conn, decision.candidate_ticket_ids[0])
        asg = store.assignment(conn, first.get("current_assignment_id")) if first else None
        contact_id = (asg or {}).get("contact_id")
    rfq_reason = None
    if decision.result == "note" and decision.rfq_vendor_id:
        # TKRFQ5: a reply matched to an RFQ vendor thread - re-checked and stored there by rfq_inbound.apply; the inbound row keeps the
        # envelope only (the text lives in the vendor's thread, or nowhere when the request closed meanwhile)
        from . import rfq_inbound

        iid = obs.new_inbound_id()
        rfq_reason = rfq_inbound.apply(conn, decision, iid, now)
        decision = dataclasses.replace(decision, content=None, **({"result": "ignored", "reason": rfq_reason} if rfq_reason else {}))
    keep = decision.result in ("ambiguous", "note", "late") and not decision.rfq_vendor_id
    candidates = {"tickets": list(decision.candidate_ticket_ids), "departments": list(decision.candidate_department_ids)} \
        if decision.result == "ambiguous" else {}
    iid = obs.insert_inbound(conn, {
        **({"id": iid} if decision.rfq_vendor_id else {}),
        "received_at": obs.iso(now), "provider_at": obs.iso(decision.provider_at) if decision.provider_at else None,
        "event_type": decision.event_type, "msg_type": decision.msg_type, "sender_key": decision.sender_key, "account_key": decision.account_key,
        "dedupe_key": decision.dedupe_key or obs.new_inbound_id(), "contact_id": contact_id, "ticket_id": decision.ticket_id,
        "assignment_id": decision.assignment_id, "outbox_id": decision.outbox_id, "result": decision.result, "reason": decision.reason,
        "action": decision.action, "content": (decision.content or "")[:inbound_mod.CONTENT_MAX] if keep else None,
        "candidates_json": json.dumps(candidates, separators=(",", ":"))})
    if decision.rfq_vendor_id:
        pass  # TKRFQ5: done above (the thread, the timeline row, the notification)
    elif decision.result == "status":
        _apply_status(conn, decision, iid, now)
    elif decision.result in ("note", "late"):
        _apply_note(conn, decision, iid, now, late=decision.result == "late")
    elif decision.result == "ambiguous":
        _notify("reply_unmatched", conn, iid, list(decision.candidate_ticket_ids))
    audit(conn, actor=None, action="ticket.inbound", decision="allowed",
          resource_type="ticket" if decision.ticket_id else "ticket_rfq" if decision.rfq_id else "installation",
          resource_id=decision.ticket_id or decision.rfq_id or "tickets", details={**decision.audit(), "inbound_id": iid})
    return iid


def _assignee_name(conn, assignment_id: str | None) -> str:
    asg = store.assignment(conn, assignment_id)
    return (asg or {}).get("assignee_name") or ""


def _apply_status(conn, d: inbound_mod.InboundDecision, iid: str, now: dt.datetime) -> None:
    t = obs.ticket_for_worker(conn, d.ticket_id or "")
    if t is None:
        return
    frm, to = t["status"], d.action
    action = "ack" if to == "acknowledged" else "wip"
    if to is None or t.get("current_assignment_id") != d.assignment_id or inbound_mod.advisory_status(frm, action) != to:
        _apply_note(conn, d, iid, now, late=False, text=d.note or ("1" if action == "ack" else "2"))  # the ticket moved meanwhile
        return
    at = obs.iso_s(now)
    fields: dict[str, Any] = {"status": to, "last_activity_at": at, "last_external_activity_at": at}
    fields["waiting_on"], fields["waiting_reason"] = model.waiting_for(to)
    asg = store.assignment(conn, d.assignment_id)
    if asg is not None:
        upd = {"last_update_at": at}
        if not asg.get("acknowledged_at"):
            upd["acknowledged_at"] = at
        store.update_assignment(conn, asg["id"], upd)
    store.update_ticket(conn, t["id"], fields)
    store.insert_event(conn, t["id"], "status", actor_kind="inbound", actor_name=_assignee_name(conn, d.assignment_id), assignment_id=d.assignment_id,
                       from_status=frm, to_status=to, data={"inbound_id": iid, "outbox_id": d.outbox_id, **UNVERIFIED_MARK}, via="whatsapp", at=at)
    sla.refresh(conn, t["id"])  # slice 2: the dues follow every change (an acknowledgement stops the first-response clock)
    notify_bridge.ticket_status(conn, t["id"], frm, to, actor="assignee")


def _apply_note(conn, d: inbound_mod.InboundDecision, iid: str, now: dt.datetime, *, late: bool, text: str | None = None) -> None:
    t = obs.ticket_for_worker(conn, d.ticket_id or "")
    if t is None:
        return
    body = (text if text is not None else d.note) or ""
    at = obs.iso_s(now)
    store.insert_event(conn, t["id"], "late_reply" if late else "inbound", actor_kind="inbound", actor_name=_assignee_name(conn, d.assignment_id),
                       assignment_id=d.assignment_id, body=body[:model.NOTE_MAX] or None,
                       data={"inbound_id": iid, "outbox_id": d.outbox_id, "reason": d.reason, **UNVERIFIED_MARK}, via="whatsapp", at=at)
    fields: dict[str, Any] = {"last_activity_at": at, "last_external_activity_at": at}
    if late and t["status"] not in model.FINAL:
        fields.update({"waiting_on": "manager", "waiting_reason": "late_reply"})
    store.update_ticket(conn, t["id"], fields, bump=False)
    sla.refresh(conn, t["id"])  # the handler's activity moves the "stuck" clock
    if late:
        _notify("reply_unmatched", conn, iid, [t["id"]])


# ---------------------------------------------------------------- message templates (D26) - validation, diff, sample rendering

def template_problems(purpose: str, body: Any) -> list[dict[str, str]]:
    return mt.problems(purpose, body)


def template_diff(before: Mapping[str, Any] | None, after: Mapping[str, Any] | None) -> str:
    """The audit row's before / after diff of a message template (8: template edits reach outsiders - audited with a diff)."""
    def lines(t: Mapping[str, Any] | None) -> list[str]:
        if not t:
            return []
        return [f"{t.get('purpose')}/{t.get('lang')}/{t.get('department_id') or '*'}"] + [f"body: {ln}" for ln in (t.get("body") or "").split("\n")]

    diff = "\n".join(difflib.unified_diff(lines(before), lines(after), "before", "after", lineterm="", n=1))
    return diff if len(diff) <= 4000 else diff[:3999] + "…"


def sample_render(conn, *, purpose: str, lang: str, body: str) -> str:
    """The settings editor's live preview: the template with sample values and the module's configured name."""
    secrets = {"link": LINK_PLACEHOLDER.get(lang, "[link]"), "code": CODE_PLACEHOLDER}
    try:
        return mt.render(body, SAMPLE, lang=lang if lang in LANGS else "he", display_name=display_names(conn), secrets=secrets, check_length=False)
    except mt.TemplateError:
        return ""
