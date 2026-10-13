"""Fakes for the CR-038 message-channel core tests: a fake clock and in-memory stand-ins for the ports the wiring slices implement
on the ticket tables (directory, links, templates, context, hooks, e-mail channel). Test values only - the phone numbers are
fake and the "link tokens" are random-looking strings made up here."""
from __future__ import annotations

import datetime as dt
import random
from collections import deque
from dataclasses import dataclass, field
from typing import Any
from zoneinfo import ZoneInfo

from fake_ha_whatsapp import FakeHaWhatsapp, FakeMirror, PairedAccount

from smplwise.services import messaging_accounts as ma
from smplwise.services.tickets import hours
from smplwise.services.tickets import message_templates as templates
from smplwise.services.tickets.channel import NOT_SENT, SENT, UNKNOWN, Recipient, SendResult
from smplwise.services.tickets.channel_whatsapp import WhatsAppChannel
from smplwise.services.tickets.outbox import MemoryOutboxStore, Outbox, OutboxRow, Ports

UTC = dt.timezone.utc
TZ = ZoneInfo("Asia/Jerusalem")
T0 = dt.datetime(2026, 10, 13, 8, 0, tzinfo=UTC)  # 11:00 in Jerusalem (IDT, +3): inside 07:00-21:00
ENTRY_A, ENTRY_B = "01JFAKEENTRYA", "01JFAKEENTRYB"
KEY_A, KEY_B = f"entry:{ENTRY_A}", f"entry:{ENTRY_B}"
PHONE_VENDOR = "15555550101"  # fake
PHONE_OTHER = "15555550102"  # fake
TICKETS_KEY = b"k_tickets-test-key-0123456789abc"
MESSAGING_KEY = b"k_messaging-test-key-0123456789a"


class FakeClock:
    def __init__(self, start: dt.datetime = T0) -> None:
        self.t = start

    def now(self) -> dt.datetime:
        return self.t

    def advance(self, **kw: float) -> dt.datetime:
        self.t = self.t + dt.timedelta(**kw)
        return self.t


class FakeDirectory:
    def __init__(self) -> None:
        self.contacts: dict[str, Recipient] = {}

    def add(self, contact_id: str, *, phone: str | None = PHONE_VENDOR, email: str | None = None, lang: str = "he",
            name: str = "דני הספק") -> Recipient:
        r = Recipient(contact_id=contact_id, display_name=name, lang=lang, phone=phone, email=email)
        self.contacts[contact_id] = r
        return r

    def recipient(self, contact_id: str) -> Recipient | None:
        return self.contacts.get(contact_id)


class FakeLinks:
    def __init__(self) -> None:
        self.tokens: dict[str, str] = {}
        self.revoked: set[str] = set()
        self.via: dict[str, str] = {}
        self.code_links: set[str] = set()
        self.notes: list[tuple[str, str, str]] = []
        self.redeems = 0

    def mint(self, link_id: str, *, requires_code: bool = False) -> str:
        token = "".join(random.Random(link_id).choice("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789_-") for _ in range(32))
        self.tokens[link_id] = token
        if requires_code:
            self.code_links.add(link_id)
        return token

    def url(self, link_id: str) -> str | None:
        if link_id in self.revoked or link_id not in self.tokens:
            return None
        return f"https://t-demo.example.test/t/#{self.tokens[link_id]}"

    def redeem_url(self, link_id: str) -> str | None:
        if self.url(link_id) is None:
            return None
        self.redeems += 1
        return f"https://t-demo.example.test/t/r/RID{self.redeems:04d}{self.tokens[link_id][:8]}"

    def sent_via(self, link_id: str) -> str | None:
        return self.via.get(link_id)

    def requires_code(self, link_id: str) -> bool:
        return link_id in self.code_links

    def note_sent(self, link_id: str, via: str, purpose: str, at: dt.datetime) -> None:
        self.via[link_id] = via
        self.notes.append((link_id, via, purpose))


class FakeTemplates:
    def __init__(self) -> None:
        self.items: list[templates.TemplateText] = []

    def pick(self, *, purpose: str, lang: str, department_id: str | None, template_id: str | None) -> templates.TemplateText | None:
        return templates.choose(self.items, purpose=purpose, lang=lang, department_id=department_id)


@dataclass
class FakeContext:
    on: bool = True
    window: dict[str, str] = field(default_factory=lambda: {"from": "07:00", "to": "21:00"})
    dept_windows: dict[str, Any] = field(default_factory=dict)
    names: dict[str, Any] = field(default_factory=dict)
    email_on: bool = True
    smtp: bool = True

    def module_on(self) -> bool:
        return self.on

    def time_zone(self) -> ZoneInfo:
        return TZ

    def send_window(self, department_id: str | None) -> hours.SendWindow:
        return hours.effective_window(self.window, self.dept_windows.get(department_id or ""))

    def display_name(self) -> dict[str, Any]:
        return self.names

    def email_fallback(self) -> bool:
        return self.email_on

    def email_configured(self) -> bool:
        return self.smtp


class RecordingHooks:
    def __init__(self) -> None:
        self.events: list[tuple[str, str, Any]] = []
        self.relevant = lambda row: True

    def kinds(self, row_id: str | None = None) -> list[str]:
        return [k for k, rid, _ in self.events if row_id is None or rid == row_id]

    def queued(self, row: OutboxRow) -> None:
        self.events.append(("queued", row.id, row.purpose))

    def held(self, row: OutboxRow) -> None:
        self.events.append(("held", row.id, row.held_reason))

    def outcome(self, row: OutboxRow, result: SendResult, account: Any) -> None:
        self.events.append(("outcome", row.id, (result.outcome, result.outcome_code, account.key if account else None,
                                                account.label if account else None)))

    def cancelled(self, row: OutboxRow, reason: str) -> None:
        self.events.append(("cancelled", row.id, reason))

    def send_failed(self, row: OutboxRow) -> None:
        self.events.append(("send_failed", row.id, row.ticket_id))

    def fallback(self, row: OutboxRow, step: str, new_row: OutboxRow | None) -> None:
        self.events.append(("fallback", row.id, (step, new_row.id if new_row else None)))

    def still_relevant(self, row: OutboxRow) -> bool:
        return self.relevant(row)


class FakeEmailChannel:
    key = "email"

    def __init__(self) -> None:
        self.sent: list[Any] = []
        self.script: deque[str] = deque()

    def status(self, account: Any = None) -> Any:
        return None

    def can_reach(self, recipient: Recipient, account: Any = None) -> str:
        return "ok" if recipient.email else "no_address"

    def supports_buttons(self) -> bool:
        return False

    def parse_inbound(self, event: dict[str, Any]) -> None:
        return None

    def send(self, msg: Any) -> SendResult:
        self.sent.append(msg)
        outcome = self.script.popleft() if self.script else "sent"
        return {"sent": SendResult(SENT), "unknown": SendResult(UNKNOWN, "timeout"), "not_sent": SendResult(NOT_SENT, "smtp_down")}[outcome]


def default_doc(**uses: str | None) -> ma.MappingDoc:
    mapping = {"tickets.messages": KEY_A, "tickets.codes": None}
    mapping.update({k.replace("__", "@dept:"): v for k, v in uses.items()})
    return ma.MappingDoc(revision=1, accounts=(ma.Account(KEY_A, "discovered", "שירות ····0001", "0001", pacing=ma.Pacing()),
                                               ma.Account(KEY_B, "discovered", "שני ····0002", "0002", pacing=ma.Pacing())),
                         uses=mapping)


@dataclass
class Env:
    clock: FakeClock
    fake: FakeHaWhatsapp
    mirror: FakeMirror
    doc: list[ma.MappingDoc]
    accounts: ma.AccountsService
    ledger: ma.MemorySendLedger
    gate: ma.PacingGate
    store: MemoryOutboxStore
    directory: FakeDirectory
    links: FakeLinks
    tpl: FakeTemplates
    ctx: FakeContext
    hooks: RecordingHooks
    email: FakeEmailChannel
    whatsapp: WhatsAppChannel
    outbox: Outbox
    module_on: list[bool]

    def tick(self, **advance: float) -> int:
        if advance:
            self.clock.advance(**advance)
        return self.outbox.tick(self.clock.now())

    def drain(self, *, step_s: float = 30, limit: int = 400) -> None:
        """Tick with time passing until nothing is open or the limit is reached."""
        for _ in range(limit):
            if not self.store.open_rows():
                return
            self.tick(seconds=step_s)

    def row(self, row_id: str) -> OutboxRow:
        r = self.store.get(row_id)
        assert r is not None
        return r


def make_env(*, accounts: list[PairedAccount] | None = None, doc: ma.MappingDoc | None = None, use_buttons: bool = False,
             seed: int = 7, start: dt.datetime = T0) -> Env:
    clock = FakeClock(start)
    fake = FakeHaWhatsapp(accounts if accounts is not None else [PairedAccount(ENTRY_A, "15555550191"), PairedAccount(ENTRY_B, "15555550192")])
    mirror = FakeMirror(fake)
    holder = [doc or default_doc()]
    module_on = [True]
    registry = ma.UseRegistry(ma.tickets_uses(lambda: module_on[0]))
    service = ma.AccountsService(load_doc=lambda: holder[0], reader=mirror, registry=registry)
    ledger = ma.MemorySendLedger()
    gate = ma.PacingGate(ledger, random.Random(seed))
    store = MemoryOutboxStore()
    directory, links, tpl, ctx, hooks, email = FakeDirectory(), FakeLinks(), FakeTemplates(), FakeContext(), RecordingHooks(), FakeEmailChannel()
    whatsapp = WhatsAppChannel(fake, service, use_buttons=lambda: use_buttons)
    counter = iter(range(1, 10**6))
    nonces = random.Random(seed + 1)
    ports = Ports(store=store, directory=directory, links=links, templates=tpl, context=ctx, accounts=service,
                  channels={"whatsapp": whatsapp, "email": email}, gate=gate, messaging_key=MESSAGING_KEY, hooks=hooks,
                  new_id=lambda: f"ob{next(counter):05d}", new_nonce=lambda: f"{nonces.getrandbits(64):016x}")
    return Env(clock, fake, mirror, holder, service, ledger, gate, store, directory, links, tpl, ctx, hooks, email, whatsapp,
               Outbox(ports), module_on)


def assign(env: Env, *, contact: str = "c1", link: str = "L1", assignment: str = "A1", ticket: str = "T1", dept: str | None = "D1",
           purpose: str = "assign", **kw: Any) -> OutboxRow:
    if link not in env.links.tokens:
        env.links.mint(link)
    if contact not in env.directory.contacts:
        env.directory.add(contact)
    params = kw.pop("params", {"name": "דני", "number": "1042", "department": "אחזקה", "title": "מזגן לא מקרר", "place": "קומה 1 · חדר 102"})
    return env.outbox.enqueue(purpose=purpose, now=env.clock.now(), contact_id=contact, ticket_id=ticket, assignment_id=assignment,
                              link_id=link, department_id=dept, params=params, requested_by="u-manager", **kw)
