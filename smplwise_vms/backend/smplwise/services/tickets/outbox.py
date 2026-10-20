"""CR-038 9.2 / 9.5 / 9.9.4: the ticket outbox - states, idempotency, the paced worker, send hours, holds, retries and fallbacks.

Every outbound message is first WRITTEN (an outbox row; the wiring adds the timeline + audit rows in the same transaction), then
sent by one worker. If the row cannot be written, nothing is sent. Storage is behind `OutboxStore` (`MemoryOutboxStore` below is
the reference implementation the tests use; slice 5b implements it on `ticket_outbox`, migration 0081).

States (7.3): queued -> (held) -> sending -> sent | refused | unknown | not_sent; queued / held -> cancelled | superseded.
- `held` reasons: send_hours (D4; released by the window or by "send now", D29), channel_down (the account is disconnected /
  unknown / missing), account_unmapped (the use has no account), module_off. channel_down / account_unmapped last at most the
  account's `hold_when_down_min` (default 15), then the row ends `not_sent` and falls back. There is NO automatic switch to another
  account (a different sender number is a visible change and a separate budget).
- the ACCOUNT is resolved when the worker claims a row (queued -> sending) and recorded on it: queued and held rows leave from
  whatever account the use maps to at their turn (D27); a row in flight finishes on the account it was claimed with.
- `not_sent` (provably never left) is retried up to 3 times within 30 minutes, then falls back. `refused` falls back at once.
- `unknown` is FINAL: never retried, never re-routed, never a fallback. Only a person's "send again" (`resend`) creates a NEW row;
  the old row stays `unknown`. A row found `sending` after a restart becomes `unknown` (it may have left).
- a newer message of the same purpose for the same assignment supersedes a queued / held older one; a revoked link cancels its
  queued / held messages; nothing is re-sent on WhatsApp after a fallback succeeded (one delivery path per message).
- one message in flight per account (and one per e-mail channel); pacing per account through `messaging_accounts.PacingGate`.

Fallback order (9.5, D13, D6): WhatsApp -> e-mail (only for a contact with an address, with the e-mail fallback on and SMTP
configured; the e-mail carries the redeem link, never the fragment token; a code-protected link goes by e-mail only if the code can
still go by WhatsApp; a code goes by e-mail only if its link did NOT go by e-mail) -> nobody reachable: the ticket waits for the
manager (`send_failed`), whose "copy link" is the last resort. The managers are told in-app whenever WhatsApp could not carry a
message to a contact (`Hooks.send_failed` -> CR-018 `ticket.send_failed`).

Secrets: a verification code and a test target number are held IN MEMORY only (`TransientSecrets`) between the request and the
send - never in the row. After a restart such a row ends `not_sent` (`code_lost` / `target_lost`); the vendor asks for a new code.
"""
from __future__ import annotations

import contextlib
import datetime as dt
import logging
import secrets as _secrets
import threading
from dataclasses import dataclass, field, replace
from typing import Any, Callable, Iterable, Mapping, Protocol
from zoneinfo import ZoneInfo

from . import hours
from . import message_templates as templates  # renamed in slice 5b: slice 2 owns `templates.py` (ticket templates)
from .channel import (CLAIM_LINK_PURPOSES, CODE_PURPOSES, LINK_PURPOSES, NOT_SENT, PURPOSES, REFUSED, REPLY_PURPOSES, REPORT_PURPOSES, SENT, UNKNOWN,
                      AccountRef, OutboundMessage, Recipient, SendResult, TicketChannel, keyed_hash, phone_digits, priority_of)

log = logging.getLogger("smplwise.tickets.outbox")
UTC = dt.timezone.utc

STATES = ("queued", "held", "sending", "sent", "refused", "unknown", "not_sent", "cancelled", "superseded")
OPEN_STATES = frozenset({"queued", "held"})
TERMINAL_STATES = frozenset({"sent", "refused", "unknown", "not_sent", "cancelled", "superseded"})
HELD_REASONS = ("send_hours", "channel_down", "account_unmapped", "module_off")
TRANSITIONS: dict[str, frozenset[str]] = {
    "queued": frozenset({"held", "sending", "cancelled", "superseded", "not_sent"}),
    "held": frozenset({"queued", "held", "sending", "cancelled", "superseded", "not_sent"}),
    "sending": frozenset({"sent", "refused", "unknown", "not_sent", "queued"}),  # queued = a not_sent retry
}
MAX_ATTEMPTS = 4  # the first try + 3 retries
RETRY_DELAYS = (dt.timedelta(minutes=2), dt.timedelta(minutes=8), dt.timedelta(minutes=20))
RETRY_SPAN = dt.timedelta(minutes=30)
NON_RETRYABLE = frozenset({"no_phone", "no_address", "opted_out", "empty", "render_too_long", "template_missing", "code_lost",
                           "target_lost", "contact_missing", "link_not_live", "number_unverified",
                           "report_unavailable", "report_unsafe", "document_not_live"})  # CR-VENDORQ-294: a report's text / document
EMAIL_PER_HOUR = 10  # 9.5: a per-module counter, separate from CR-018's
DEFAULT_HOLD_MIN = 15
CODE_HOLD_MIN = 2  # a code expires in 10 minutes: it never waits 15 for a down account (recorded interpretation)
USE_MESSAGES, USE_CODES, USE_EMAIL = "tickets.messages", "tickets.codes", "email"


class OutboxError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def can_transition(a: str, b: str) -> bool:
    return b in TRANSITIONS.get(a, frozenset())


def ledger_kind(purpose: str) -> str:
    return "code" if purpose in CODE_PURPOSES else "test" if purpose == "test" else "message"


@dataclass(frozen=True)
class OutboxRow:
    id: str
    purpose: str
    channel: str
    use_key: str
    created_at: dt.datetime
    not_before: dt.datetime
    recipient_kind: str = "contact"  # contact | test
    contact_id: str | None = None
    ticket_id: str | None = None
    assignment_id: str | None = None
    link_id: str | None = None
    department_id: str | None = None
    params: Mapping[str, str] = field(default_factory=dict)  # never {link} / {code} / a phone
    template_id: str | None = None
    template_revision: int | None = None
    state: str = "queued"
    held_reason: str | None = None
    held_since: dt.datetime | None = None  # proposed 0081 column (hold timeout)
    attempts: int = 0
    first_attempt_at: dt.datetime | None = None  # proposed 0081 column (retry span)
    priority: int = 1
    outcome_code: str | None = None
    provider_message_id: str | None = None
    reply_nonce: str | None = None
    fallback_of: str | None = None
    resend_of: str | None = None  # proposed 0081 column ("send again" of an unknown / failed row)
    requested_by: str | None = None
    idempotency_key: str | None = None  # proposed 0081 column (UNIQUE)
    send_now: bool = False  # proposed 0081 column (D29: bypasses the send hours of `assign`)
    code_id: str | None = None  # 0081 (slice 5b): purpose 'code' - the ticket_link_codes row; the digits are derived at render time (W9)
    account_key: str | None = None  # written at claim time only
    sent_at: dt.datetime | None = None
    updated_at: dt.datetime | None = None
    rfq_id: str | None = None  # TKRFQ1 (0089): the request for quotation a vendor message belongs to (ticket_id is NULL then)
    # CR-VENDORQ-294 (0129, PROVISIONAL): purpose `report` - the module that builds the text at send time, its own row, an optional document
    source_module: str | None = None
    source_id: str | None = None
    document_id: str | None = None


# ---------------------------------------------------------------- ports

class OutboxStore(Protocol):
    def insert(self, row: OutboxRow) -> None: ...  # raises OutboxError('duplicate') on an id / nonce / idempotency clash

    def get(self, row_id: str) -> OutboxRow | None: ...

    def save(self, row: OutboxRow, *, expect_state: str) -> bool: ...  # compare-and-set on the state

    def open_rows(self) -> list[OutboxRow]: ...  # queued + held, ordered by (priority, not_before, created_at)

    def in_state(self, state: str) -> list[OutboxRow]: ...

    def by_idempotency_key(self, key: str) -> OutboxRow | None: ...

    def by_nonce(self, nonce: str) -> OutboxRow | None: ...

    def sent_times(self, channel: str, since: dt.datetime) -> list[dt.datetime]: ...  # sent + unknown rows of a channel


class Directory(Protocol):
    def recipient(self, contact_id: str) -> Recipient | None: ...  # read at SEND time (phone / e-mail never copied)


class Links(Protocol):
    # the handler URL with the fragment token; None when not live. `claim=True` (TK251, the cost messages): also while the link
    # serves only the CLAIM step (claim mode after close / a cannot-handle return, until the claim window ends)
    def url(self, link_id: str, *, claim: bool = False) -> str | None: ...

    def redeem_url(self, link_id: str, *, claim: bool = False) -> str | None: ...  # the e-mail form /t/r/<rid> (mints a redeem id)

    def sent_via(self, link_id: str) -> str | None: ...

    def requires_code(self, link_id: str) -> bool: ...

    def note_sent(self, link_id: str, via: str, purpose: str, at: dt.datetime) -> None: ...  # sent_via + sliding expiry


class Templates(Protocol):
    def pick(self, *, purpose: str, lang: str, department_id: str | None, template_id: str | None) -> templates.TemplateText | None: ...


class Context(Protocol):
    def module_on(self) -> bool: ...

    def time_zone(self) -> ZoneInfo: ...

    def send_window(self, department_id: str | None) -> hours.SendWindow: ...

    def display_name(self) -> Mapping[str, Any]: ...

    def email_fallback(self) -> bool: ...

    def email_configured(self) -> bool: ...


class Accounts(Protocol):
    def resolve(self, use_key: str, department_id: str | None = None) -> AccountRef | None: ...

    def ref(self, key: str) -> AccountRef | None: ...  # one named account (the per-account test send)

    def status(self, key: str) -> Any: ...  # .state / .sendable

    def pacing(self, key: str) -> Any: ...  # messaging_accounts.Pacing

    def note_result(self, key: str, result: SendResult) -> None: ...


class Hooks(Protocol):
    """What the wiring does around the outbox (timeline rows of D14, audit `ticket.message.send`, CR-018 signals)."""

    def queued(self, row: OutboxRow) -> None: ...

    def held(self, row: OutboxRow) -> None: ...

    def outcome(self, row: OutboxRow, result: SendResult, account: AccountRef | None) -> None: ...

    def cancelled(self, row: OutboxRow, reason: str) -> None: ...

    def send_failed(self, row: OutboxRow) -> None: ...  # managers in-app (`ticket.send_failed`)

    def fallback(self, row: OutboxRow, step: str, new_row: OutboxRow | None) -> None: ...  # email | nobody | code_unavailable

    def still_relevant(self, row: OutboxRow) -> bool: ...  # module re-enabled: a reminder for a closed ticket is not


class NullHooks:
    def queued(self, row: OutboxRow) -> None: ...
    def held(self, row: OutboxRow) -> None: ...
    def outcome(self, row: OutboxRow, result: SendResult, account: AccountRef | None) -> None: ...
    def cancelled(self, row: OutboxRow, reason: str) -> None: ...
    def send_failed(self, row: OutboxRow) -> None: ...
    def fallback(self, row: OutboxRow, step: str, new_row: OutboxRow | None) -> None: ...
    def still_relevant(self, row: OutboxRow) -> bool:
        return True


class TransientSecrets:
    """Codes and test targets, in memory only, keyed by outbox id; taken once the row is final."""

    def __init__(self) -> None:
        self._codes: dict[str, str] = {}
        self._targets: dict[str, str] = {}
        self._lock = threading.Lock()

    def __repr__(self) -> str:
        return f"TransientSecrets(codes={len(self._codes)}, targets={len(self._targets)})"

    def put_code(self, row_id: str, code: str) -> None:
        with self._lock:
            self._codes[row_id] = code

    def put_target(self, row_id: str, digits: str) -> None:
        with self._lock:
            self._targets[row_id] = digits

    def code(self, row_id: str) -> str | None:
        return self._codes.get(row_id)

    def target(self, row_id: str) -> str | None:
        return self._targets.get(row_id)

    def move(self, old: str, new: str) -> None:
        with self._lock:
            if old in self._codes:
                self._codes[new] = self._codes.pop(old)

    def drop(self, row_id: str) -> None:
        with self._lock:
            self._codes.pop(row_id, None)
            self._targets.pop(row_id, None)


# ---------------------------------------------------------------- the reference store

class MemoryOutboxStore:
    def __init__(self) -> None:
        self.rows: dict[str, OutboxRow] = {}
        self._lock = threading.Lock()

    def insert(self, row: OutboxRow) -> None:
        with self._lock:
            if row.id in self.rows:
                raise OutboxError("duplicate")
            for r in self.rows.values():
                if (row.reply_nonce and r.reply_nonce == row.reply_nonce) or (row.idempotency_key and r.idempotency_key == row.idempotency_key):
                    raise OutboxError("duplicate")
            self.rows[row.id] = row

    def get(self, row_id: str) -> OutboxRow | None:
        return self.rows.get(row_id)

    def save(self, row: OutboxRow, *, expect_state: str) -> bool:
        with self._lock:
            cur = self.rows.get(row.id)
            if cur is None or cur.state != expect_state:
                return False
            if cur.state != row.state and not can_transition(cur.state, row.state):
                raise OutboxError(f"illegal_transition:{cur.state}->{row.state}")
            self.rows[row.id] = row
            return True

    def open_rows(self) -> list[OutboxRow]:
        return sorted((r for r in self.rows.values() if r.state in OPEN_STATES), key=lambda r: (r.priority, r.not_before, r.created_at, r.id))

    def in_state(self, state: str) -> list[OutboxRow]:
        return [r for r in self.rows.values() if r.state == state]

    def by_idempotency_key(self, key: str) -> OutboxRow | None:
        return next((r for r in self.rows.values() if r.idempotency_key == key), None)

    def by_nonce(self, nonce: str) -> OutboxRow | None:
        return next((r for r in self.rows.values() if r.reply_nonce == nonce), None)

    def sent_times(self, channel: str, since: dt.datetime) -> list[dt.datetime]:
        return sorted(r.sent_at or r.updated_at for r in self.rows.values()
                      if r.channel == channel and r.state in (SENT, UNKNOWN) and (r.sent_at or r.updated_at) and (r.sent_at or r.updated_at) > since)


# ---------------------------------------------------------------- the D6 code-channel rule

def code_route(*, link_sent_via: str | None, whatsapp_ok: bool, email_ok: bool) -> str | None:
    """The channel a verification code may take (10.5 / D6): WhatsApp whenever it can carry it; e-mail only when the link itself
    did NOT go by e-mail; else None (`code/send` answers 503 `code_unavailable`)."""
    if whatsapp_ok:
        return "whatsapp"
    if email_ok and link_sent_via != "email":
        return "email"
    return None


def assignment_code_check(*, whatsapp_ok: bool, codes_whatsapp_ok: bool, email_ok: bool) -> bool:
    """Assign time (D6): would a code-protected assignment get its code on a channel the rules allow? The planned link channel is
    WhatsApp when it can carry it, else e-mail, else "copy link" (manual). False -> 409 `code_channel_unavailable`."""
    planned = "whatsapp" if whatsapp_ok else ("email" if email_ok else "manual")
    return code_route(link_sent_via=planned, whatsapp_ok=codes_whatsapp_ok, email_ok=email_ok) is not None


# ---------------------------------------------------------------- code requests per link (10.5) and timeline kinds (7.1 / D14)

CODE_LIMITS = ((dt.timedelta(seconds=60), 1, "code_wait"), (dt.timedelta(hours=1), 3, "code_hour"), (dt.timedelta(days=1), 6, "code_day"))


def code_request_check(previous: Iterable[dt.datetime], now: dt.datetime) -> tuple[bool, int | None, str | None]:
    """`POST /t/api/code/send` limits per LINK (10.5): 1 per 60 s, 3 per hour, 6 per day. (The 6-per-hour-per-recipient cap across
    links is the pacing gate's; codes never count against the per-recipient MESSAGE cap.) Returns (ok, retry_after_s, reason)."""
    now = now.astimezone(UTC)
    times = sorted(t.astimezone(UTC) for t in previous)
    for span, limit, reason in CODE_LIMITS:
        inside = [t for t in times if now - t < span]
        if len(inside) >= limit:
            wait = inside[len(inside) - limit] + span - now
            return False, max(1, int(wait.total_seconds() + 0.999)), reason
    return True, None, None


_SENT_KIND = {"assign": "link_sent", "reopened": "link_sent", "update": "update_sent", "reminder": "reminder", "code": "code_sent",
              "rfq_order": "link_sent"}  # TKRFQ4: the work order carries the new request's handler link


def timeline_kind(row: OutboxRow, *, fallback_step: str | None = None) -> str | None:
    """The `ticket_events.kind` a final row writes (the D14 lines are rendered from it by the UI): sent -> link_sent /
    update_sent / reminder / code_sent; unknown -> message_unknown ("ייתכן שנשלח"); not_sent / refused -> message_failed;
    a fallback step -> message_fallback. None for rows without a ticket line of their own (notices, tests, cost messages)."""
    if fallback_step:
        return "message_fallback"
    if row.ticket_id is None:
        return None
    if row.state == SENT:
        return _SENT_KIND.get(row.purpose)
    if row.state == UNKNOWN:
        return "message_unknown"
    if row.state in (NOT_SENT, REFUSED):
        return "message_failed"
    return None

# ---------------------------------------------------------------- the outbox

@dataclass
class Ports:
    store: OutboxStore
    directory: Directory
    links: Links
    templates: Templates
    context: Context
    accounts: Accounts
    channels: Mapping[str, TicketChannel]
    gate: Any  # messaging_accounts.PacingGate
    messaging_key: bytes = field(repr=False)  # k_messaging: recipient keys of the shared ledger
    hooks: Hooks = field(default_factory=NullHooks)
    secrets: TransientSecrets = field(default_factory=TransientSecrets)
    new_id: Callable[[], str] = lambda: _secrets.token_hex(8)
    new_nonce: Callable[[], str] = lambda: _secrets.token_hex(8)  # 64-bit, 16 hex (button ids 't:<nonce>:<action>')
    derive_code: Callable[[OutboxRow], str | None] | None = None  # slice 5b: the six digits of a `code_id` row (W9)
    # CR-VENDORQ-294: the text of a `report` row, built at send time by its module's provider -> (text, None) | (None, outcome code)
    report_text: Callable[[OutboxRow, Recipient], tuple[str | None, str | None]] | None = None


class Outbox:
    def __init__(self, ports: Ports) -> None:
        self.p = ports
        self._lock = threading.RLock()  # row state: enqueue / cancel / release / the decisions of a tick
        self._tick_lock = threading.Lock()  # one tick at a time: with the provider call outside `_lock`, this keeps one in flight per account

    # ------------------------------------------------------------ enqueue side

    def enqueue(self, *, purpose: str, now: dt.datetime, contact_id: str | None = None, ticket_id: str | None = None,
                assignment_id: str | None = None, link_id: str | None = None, department_id: str | None = None,
                params: Mapping[str, Any] | None = None, template_id: str | None = None, template_revision: int | None = None,
                channel: str = "whatsapp", requested_by: str | None = None, idempotency_key: str | None = None,
                send_now: bool = False, code: str | None = None, test_target: str | None = None,
                test_account_key: str | None = None, code_id: str | None = None, rfq_id: str | None = None,
                source_module: str | None = None, source_id: str | None = None, document_id: str | None = None,
                use_key: str | None = None) -> OutboxRow:
        """Write one message. Returns the existing row when `idempotency_key` was already used (no second message).
        A `test` row names its account at enqueue time (the per-account "שליחת בדיקה"); every other row gets its account when
        the worker claims it."""
        if purpose not in PURPOSES:
            raise OutboxError("purpose_unknown")
        if channel not in self.p.channels:
            raise OutboxError("channel_unknown")
        if (purpose in LINK_PURPOSES or purpose in CLAIM_LINK_PURPOSES) and not link_id:
            raise OutboxError("link_required")
        if purpose == "code" and (not code or not code.isdigit() or len(code) != 6 or not link_id):
            raise OutboxError("code_invalid")
        if purpose == "phone_verify" and (not code or not code.isdigit() or len(code) != 6 or not code_id or link_id or ticket_id
                                          or channel != "whatsapp"):
            raise OutboxError("code_invalid")  # TKNOTIFOTP: the number check goes to the number itself - WhatsApp only, never a fallback
        if purpose in REPORT_PURPOSES:
            # CR-VENDORQ-294: a report names its module and row, goes to a contact by WhatsApp, carries no link / code / ticket / RFQ
            if not source_module or not source_id or not contact_id or channel != "whatsapp" or link_id or code or code_id or ticket_id                     or rfq_id or assignment_id:
                raise OutboxError("report_invalid")
        elif source_module or source_id or document_id or use_key:
            raise OutboxError("source_not_allowed")
        if purpose == "test":
            if phone_digits(test_target or "") is None or channel != "whatsapp" or not test_account_key:
                raise OutboxError("test_target_invalid")
        elif not contact_id:
            raise OutboxError("contact_required")
        try:
            clean = templates.check_params(params or {})
        except templates.TemplateError as exc:
            raise OutboxError(exc.code) from exc
        with self._lock:
            if idempotency_key:
                existing = self.p.store.by_idempotency_key(idempotency_key)
                if existing is not None:
                    return existing
            now = now.astimezone(UTC)
            use = USE_EMAIL if channel == "email" else (USE_CODES if purpose in CODE_PURPOSES else (use_key or USE_MESSAGES))
            row = OutboxRow(
                id=self.p.new_id(), purpose=purpose, channel=channel, use_key=use, created_at=now, not_before=now, updated_at=now,
                recipient_kind="test" if purpose == "test" else "contact", contact_id=contact_id, ticket_id=ticket_id,
                assignment_id=assignment_id, link_id=link_id, department_id=department_id, params=clean, template_id=template_id,
                template_revision=template_revision, priority=priority_of(purpose), requested_by=requested_by,
                idempotency_key=idempotency_key, send_now=bool(send_now) and purpose == "assign",
                account_key=test_account_key if purpose == "test" else None, code_id=code_id if purpose in CODE_PURPOSES else None, rfq_id=rfq_id,
                source_module=source_module, source_id=source_id, document_id=document_id,
                reply_nonce=self.p.new_nonce() if channel == "whatsapp" and purpose in REPLY_PURPOSES else None)
            if assignment_id:
                for old in self.p.store.open_rows():
                    if old.assignment_id == assignment_id and old.purpose == purpose:
                        self._set(old, state="superseded", now=now, outcome_code="superseded")
                        self.p.secrets.drop(old.id)
                        self.p.hooks.cancelled(old, "superseded")
            self.p.store.insert(row)
            if code:
                self.p.secrets.put_code(row.id, code)
            if test_target:
                self.p.secrets.put_target(row.id, phone_digits(test_target) or "")
            self.p.hooks.queued(row)
            log.info("outbox queued id=%s purpose=%s channel=%s", row.id, purpose, channel)
            return row

    def send_now(self, row_id: str, now: dt.datetime) -> OutboxRow:
        """D29: release a message waiting for the send hours (the route checks `tickets.external` + visibility and audits
        `ticket.message.send_now`). Refused for any other state or hold reason."""
        with self._lock:
            row = self.p.store.get(row_id)
            if row is None:
                raise OutboxError("not_found")
            if not (row.state == "queued" or (row.state == "held" and row.held_reason == "send_hours")):
                raise OutboxError("not_held_by_hours")
            return self._set(row, state="queued", now=now, send_now=True, held_reason=None, held_since=None, not_before=now.astimezone(UTC))

    def resend(self, row_id: str, *, requested_by: str, now: dt.datetime) -> OutboxRow:
        """"שלח שוב": a NEW row on the current mapping; the old row keeps its state (an `unknown` stays `unknown`)."""
        with self._lock:
            old = self.p.store.get(row_id)
            if old is None:
                raise OutboxError("not_found")
            if old.state not in (UNKNOWN, NOT_SENT, REFUSED):
                raise OutboxError("not_resendable")
            if old.purpose in CODE_PURPOSES or old.purpose == "test":
                raise OutboxError("not_resendable")  # a code is asked for again by the vendor; a test is typed again
            now = now.astimezone(UTC)
            row = replace(old, id=self.p.new_id(), state="queued", held_reason=None, held_since=None, attempts=0, first_attempt_at=None,
                          outcome_code=None, provider_message_id=None, account_key=None, sent_at=None, created_at=now,
                          not_before=now, updated_at=now, requested_by=requested_by, idempotency_key=None, resend_of=old.id,
                          fallback_of=None, reply_nonce=self.p.new_nonce() if old.reply_nonce else None)
            self.p.store.insert(row)
            self.p.hooks.queued(row)
            return row

    def cancel_where(self, reason: str, now: dt.datetime, *, link_id: str | None = None, contact_id: str | None = None,
                     ticket_id: str | None = None, purposes: Iterable[str] | None = None) -> list[OutboxRow]:
        """A revoked link (reason 'link_revoked'), an erased contact ('contact_erased'), a closed ticket ... cancels its queued and
        held rows. Rows in flight or final are never touched."""
        if link_id is None and contact_id is None and ticket_id is None:
            raise OutboxError("filter_required")
        wanted = set(purposes) if purposes is not None else None
        out = []
        with self._lock:
            for row in self.p.store.open_rows():
                if link_id is not None and row.link_id != link_id:
                    continue
                if contact_id is not None and row.contact_id != contact_id:
                    continue
                if ticket_id is not None and row.ticket_id != ticket_id:
                    continue
                if wanted is not None and row.purpose not in wanted:
                    continue
                out.append(self._cancel(row, reason, now))
        return out

    def open_count(self, use_key: str, department_id: str | None = None) -> int:
        """The count the account screen shows before a use moves ("3 הודעות ממתינות יישלחו מהחשבון החדש", 9.9.3)."""
        return sum(1 for r in self.p.store.open_rows()
                   if r.use_key == use_key and (department_id is None or r.department_id == department_id))

    def recover_after_restart(self, now: dt.datetime) -> list[OutboxRow]:
        """A row still `sending` when the process starts may have left: it becomes `unknown` (and counts in the ledger)."""
        out = []
        with self._lock:
            for row in self.p.store.in_state("sending"):
                result = SendResult(UNKNOWN, "interrupted")
                if row.channel == "whatsapp" and row.account_key:
                    self.p.gate.record(account_key=row.account_key, use_key=row.use_key, recipient_key=self._recipient_key(row) or "unknown",
                                       kind=ledger_kind(row.purpose), now=now)
                done = self._set(row, state=UNKNOWN, now=now, outcome_code="interrupted")
                self.p.secrets.drop(row.id)
                self.p.hooks.outcome(done, result, None)
                out.append(done)
        return out

    # ------------------------------------------------------------ the worker

    def tick(self, now: dt.datetime) -> int:
        """One pass over the open rows; returns the number of provider calls made. Thread-safe; the worker thread calls it."""
        now = now.astimezone(UTC)
        calls = 0
        with self._tick_lock, self._lock:
            if not self.p.context.module_on():
                for row in self.p.store.open_rows():
                    if not (row.state == "held" and row.held_reason == "module_off"):
                        self._hold(row, "module_off", now)
                return 0
            busy: set[str] = set()
            for row in self.p.store.open_rows():
                try:
                    calls += self._step(row, now, busy)
                except OutboxError:
                    log.warning("outbox step refused id=%s", row.id)
        return calls

    def _step(self, row: OutboxRow, now: dt.datetime, busy: set[str]) -> int:
        if row.state == "held" and row.held_reason == "module_off":
            if not self.p.hooks.still_relevant(row):
                self._cancel(row, "stale", now)
                return 0
            row = self._set(row, state="queued", now=now, held_reason=None, held_since=None, not_before=now)
        if row.not_before > now and not (row.state == "held" and row.held_reason in ("channel_down", "account_unmapped")):
            return 0
        if row.link_id and (row.purpose in LINK_PURPOSES or row.purpose == "code") and self.p.links.url(row.link_id) is None:
            self._cancel(row, "link_not_live", now)
            return 0
        if row.purpose in CLAIM_LINK_PURPOSES and (not row.link_id or self.p.links.url(row.link_id, claim=True) is None):
            self._cancel(row, "link_not_live", now)  # TK251: a cost message never goes out with a link that opens nothing
            return 0
        if row.recipient_kind == "contact":
            tz = self.p.context.time_zone()
            decision = hours.decide(row.purpose, now, self.p.context.send_window(row.department_id), tz, send_now=row.send_now)
            if not decision.send:
                if not (row.state == "held" and row.held_reason == "send_hours" and row.not_before == decision.not_before):
                    self._hold(row, "send_hours", now, not_before=decision.not_before)
                return 0
        recipient, missing = self._recipient(row)
        if recipient is None:
            return self._fail_before_claim(row, missing, now)
        if row.channel == "email":
            return self._send_email(row, recipient, now, busy)
        if recipient.whatsapp_blocked and row.purpose not in ("test", "phone_verify"):
            # TKHARDEN (delta review N-3): verification was switched on after this message was queued or held. It must not leave for a
            # number nobody confirmed by code. Visible end state `not_sent` / `number_unverified` (e-mail fallback or the manual route
            # as for any other failed WhatsApp row); never silently dropped.
            log.info("outbox row id=%s purpose=%s stopped: number not verified", row.id, row.purpose)
            return self._fail_before_claim(row, "number_unverified", now)
        return self._send_whatsapp(row, recipient, now, busy)

    def _send_whatsapp(self, row: OutboxRow, recipient: Recipient, now: dt.datetime, busy: set[str]) -> int:
        if row.purpose == "test":
            account = self.p.accounts.ref(row.account_key or "")
            if account is None or not account.value or not self.p.accounts.status(account.key).sendable:
                return self._fail_before_claim(row, "channel_down", now)  # a test is never held: the administrator sees it at once
        else:
            account = self.p.accounts.resolve(row.use_key, row.department_id)
        if account is None:
            return self._hold_down(row, "account_unmapped", CODE_HOLD_MIN if row.purpose in CODE_PURPOSES else DEFAULT_HOLD_MIN, now)
        pacing = self.p.accounts.pacing(account.key)
        if not account.value or not self.p.accounts.status(account.key).sendable:
            hold = min(pacing.hold_when_down_min, CODE_HOLD_MIN) if row.purpose in CODE_PURPOSES else pacing.hold_when_down_min
            return self._hold_down(row, "channel_down", hold, now)
        if account.key in busy:
            return 0
        digits = phone_digits(recipient.phone or "")
        if digits is None:
            return self._fail_before_claim(row, "no_phone", now)
        rkey = keyed_hash(self.p.messaging_key, digits)
        decision = self.p.gate.check(account_key=account.key, pacing=pacing, recipient_key=rkey, kind=ledger_kind(row.purpose), now=now)
        if not decision.allowed:
            if row.state == "held" or row.not_before != decision.not_before:
                self._set(row, state="queued", now=now, held_reason=None, held_since=None, not_before=decision.not_before)
            return 0
        msg, problem = self._message(row, recipient, account, now)
        if msg is None:
            return self._fail_before_claim(row, problem or "render_too_long", now)
        claimed = self._claim(row, now, account.key)
        busy.add(account.key)
        channel = self.p.channels["whatsapp"]
        try:
            with self._outside_lock():  # the row is claimed (`sending`): enqueue / cancel need not wait for the provider
                result = channel.send(msg)
        except Exception:  # noqa: BLE001 - the adapter never raises for an outcome; anything else may have left
            result = SendResult(UNKNOWN, "adapter_error")
        if result.may_have_left:
            self.p.gate.record(account_key=account.key, use_key=row.use_key, recipient_key=rkey, kind=ledger_kind(row.purpose), now=now)
        self.p.accounts.note_result(account.key, result)
        self._finish(claimed, result, now, account)
        return 1

    def _send_email(self, row: OutboxRow, recipient: Recipient, now: dt.datetime, busy: set[str]) -> int:
        if "email" in busy:
            return 0
        if not recipient.email:
            return self._fail_before_claim(row, "no_address", now)
        sent = self.p.store.sent_times("email", now - dt.timedelta(hours=1))
        if len(sent) >= EMAIL_PER_HOUR:
            until = sent[len(sent) - EMAIL_PER_HOUR] + dt.timedelta(hours=1)
            if row.not_before != until:
                self._set(row, state="queued", now=now, held_reason=None, held_since=None, not_before=until)
            return 0
        msg, problem = self._message(row, recipient, None, now)
        if msg is None:
            return self._fail_before_claim(row, problem or "render_too_long", now)
        claimed = self._claim(row, now, None)
        busy.add("email")
        try:
            with self._outside_lock():
                result = self.p.channels["email"].send(msg)
        except Exception:  # noqa: BLE001
            result = SendResult(UNKNOWN, "adapter_error")
        self._finish(claimed, result, now, None)
        return 1

    # ------------------------------------------------------------ helpers

    @contextlib.contextmanager
    def _outside_lock(self):
        """Release the outbox lock around a provider call (up to 15 s) so request threads that enqueue, cancel or release rows
        never wait for WhatsApp. Only `tick` holds the lock here, exactly once. (The SQLite wiring does the same with the write
        transaction: commit the claim, call the provider under `db.unlocked`, then write the outcome.)"""
        self._lock.release()
        try:
            yield
        finally:
            self._lock.acquire()

    def _recipient(self, row: OutboxRow) -> tuple[Recipient | None, str]:
        if row.recipient_kind == "test":
            target = self.p.secrets.target(row.id)
            return (Recipient(contact_id=None, display_name="", phone=target), "") if target else (None, "target_lost")
        recipient = self.p.directory.recipient(row.contact_id or "")
        if recipient is None:
            return None, "contact_missing"
        if recipient.opted_out:
            return None, "opted_out"
        return recipient, ""

    def _recipient_key(self, row: OutboxRow) -> str | None:
        recipient, _ = self._recipient(row)
        digits = phone_digits((recipient.phone if recipient else None) or "")
        return keyed_hash(self.p.messaging_key, digits) if digits else None

    def _message(self, row: OutboxRow, recipient: Recipient, account: AccountRef | None, now: dt.datetime) -> tuple[OutboundMessage | None, str | None]:
        lang = recipient.lang if recipient.lang in templates.LANGS else templates.DEFAULT_LANG
        if row.purpose in REPORT_PURPOSES:  # CR-VENDORQ-294: the module's text, rebuilt now (the row never holds a text)
            if self.p.report_text is None:
                return None, "report_unavailable"
            text, problem = self.p.report_text(row, recipient)
            if not text:
                return None, problem or "report_unavailable"
            return OutboundMessage(outbox_id=row.id, channel=row.channel, purpose=row.purpose, recipient=recipient, text=text, account=account), None
        if row.purpose in templates.FIXED_PURPOSES:
            # TKNOTIFOTP: the code-owned text, whatever the template store holds (VPORTAL F2: or its code-owned variant the row names)
            tpl = templates.fixed_starter(row.purpose, row.template_id, lang)
        else:
            tpl = self.p.templates.pick(purpose=row.purpose, lang=lang, department_id=row.department_id, template_id=row.template_id) \
                or templates.starter(row.purpose, lang)
        if tpl is None:
            return None, "template_missing"
        secrets: dict[str, str] = {}
        if row.link_id and row.purpose in LINK_PURPOSES:
            url = self.p.links.redeem_url(row.link_id) if row.channel == "email" else self.p.links.url(row.link_id)
            if not url:
                return None, "link_not_live"
            secrets["link"] = url
        elif row.purpose in CLAIM_LINK_PURPOSES:
            claim_url = (self.p.links.redeem_url(row.link_id, claim=True) if row.channel == "email"
                         else self.p.links.url(row.link_id, claim=True)) if row.link_id else None
            if not claim_url:
                return None, "link_not_live"
            secrets["link"] = claim_url
        if row.purpose in CODE_PURPOSES:
            code = self.p.secrets.code(row.id)
            if not code and row.code_id and self.p.derive_code is not None:
                code = self.p.derive_code(row)  # slice 5b (W9): derived from the code row id at render time, never stored
            if not code:
                return None, "code_lost"
            secrets["code"] = code
        try:
            text = templates.render(tpl.body, row.params, lang=tpl.lang, display_name=self.p.context.display_name(), secrets=secrets)
        except templates.TemplateError:
            return None, "render_too_long"
        buttons: tuple = ()
        footer = ""
        if row.channel == "whatsapp" and row.reply_nonce and self.p.channels["whatsapp"].supports_buttons():
            buttons = templates.buttons_for(row.reply_nonce, tpl.lang)
            footer = templates.footer_for(row.params, lang=tpl.lang, display_name=self.p.context.display_name(), purpose=row.purpose,
                                              rfq=bool(row.rfq_id))
        return OutboundMessage(outbox_id=row.id, channel=row.channel, purpose=row.purpose, recipient=recipient, text=text,
                               account=account, buttons=buttons, footer=footer,
                               subject=templates.footer_for(row.params, lang=tpl.lang, display_name=self.p.context.display_name(),
                                                            purpose=row.purpose, rfq=bool(row.rfq_id))), None

    def _set(self, row: OutboxRow, *, state: str, now: dt.datetime, **changes: Any) -> OutboxRow:
        new = replace(row, state=state, updated_at=now.astimezone(UTC), **changes)
        if not self.p.store.save(new, expect_state=row.state):
            raise OutboxError("stale_row")
        return new

    def _claim(self, row: OutboxRow, now: dt.datetime, account_key: str | None) -> OutboxRow:
        return self._set(row, state="sending", now=now, account_key=account_key, attempts=row.attempts + 1,
                         first_attempt_at=row.first_attempt_at or now, held_reason=None, held_since=None)

    def _hold(self, row: OutboxRow, reason: str, now: dt.datetime, *, not_before: dt.datetime | None = None) -> OutboxRow:
        held = self._set(row, state="held", now=now, held_reason=reason,
                         held_since=row.held_since if row.state == "held" and row.held_reason == reason else now,
                         not_before=not_before or row.not_before)
        if not (row.state == "held" and row.held_reason == reason):
            self.p.hooks.held(held)
        return held

    def _hold_down(self, row: OutboxRow, reason: str, hold_min: int, now: dt.datetime) -> int:
        """channel_down / account_unmapped: held up to `hold_when_down_min`, then not_sent + fallback (no automatic switch)."""
        held = self._hold(row, reason, now) if not (row.state == "held" and row.held_reason == reason) else row
        if held.held_since is not None and now - held.held_since >= dt.timedelta(minutes=hold_min):
            final = self._set(held, state="not_sent", now=now, outcome_code=reason)
            self._final(final, SendResult(NOT_SENT, reason), None, now, fallback=True)
        return 0

    def _fail_before_claim(self, row: OutboxRow, code: str, now: dt.datetime) -> int:
        final = self._set(row, state="not_sent", now=now, outcome_code=code, held_reason=None, held_since=None)
        self._final(final, SendResult(NOT_SENT, code), None, now, fallback=code not in ("target_lost",))
        return 0

    def _cancel(self, row: OutboxRow, reason: str, now: dt.datetime) -> OutboxRow:
        done = self._set(row, state="cancelled", now=now, outcome_code=reason)
        self.p.secrets.drop(row.id)
        self.p.hooks.cancelled(done, reason)
        return done

    def _finish(self, row: OutboxRow, result: SendResult, now: dt.datetime, account: AccountRef | None) -> None:
        if result.outcome == SENT:
            done = self._set(row, state=SENT, now=now, sent_at=now, outcome_code=None, provider_message_id=result.provider_message_id)
            if row.link_id:
                self.p.links.note_sent(row.link_id, row.channel, row.purpose, now)
            self._final(done, result, account, now, fallback=False)
        elif result.outcome == UNKNOWN:
            done = self._set(row, state=UNKNOWN, now=now, outcome_code=result.outcome_code)
            if row.link_id:  # it may have arrived: the D6 rule must assume it did
                self.p.links.note_sent(row.link_id, row.channel, row.purpose, now)
            self._final(done, result, account, now, fallback=False)
        elif result.outcome == REFUSED:
            done = self._set(row, state=REFUSED, now=now, outcome_code=result.outcome_code)
            self._final(done, result, account, now, fallback=True)
        else:
            retry = (result.outcome_code not in NON_RETRYABLE and row.attempts < MAX_ATTEMPTS and row.first_attempt_at is not None
                     and now - row.first_attempt_at < RETRY_SPAN)
            if retry:
                self._set(row, state="queued", now=now, outcome_code=result.outcome_code,
                          not_before=now + RETRY_DELAYS[min(row.attempts, len(RETRY_DELAYS)) - 1])
                return
            done = self._set(row, state=NOT_SENT, now=now, outcome_code=result.outcome_code)
            self._final(done, result, account, now, fallback=True)

    def _final(self, row: OutboxRow, result: SendResult, account: AccountRef | None, now: dt.datetime, *, fallback: bool) -> None:
        self.p.hooks.outcome(row, result, account)
        log.info("outbox final id=%s purpose=%s channel=%s state=%s code=%s", row.id, row.purpose, row.channel, row.state, row.outcome_code)
        if fallback:
            self._fallback(row, now)
        self.p.secrets.drop(row.id)

    def _fallback(self, row: OutboxRow, now: dt.datetime) -> None:
        """9.5. Called only for not_sent / refused (never for unknown)."""
        if row.purpose in ("test", "phone_verify") or row.purpose in REPORT_PURPOSES:
            # TKNOTIFOTP: a number check proves the NUMBER - it never takes another channel (the person asks again).
            # CR-VENDORQ-294: a report has no e-mail fallback in this slice; its module learns the outcome through the hooks.
            return
        if row.channel == "whatsapp":
            self.p.hooks.send_failed(row)
        recipient, _ = self._recipient(row) if row.recipient_kind == "contact" else (None, "")
        ctx = self.p.context
        email_ok = bool(row.channel == "whatsapp" and recipient is not None and recipient.email and ctx.email_fallback()
                        and ctx.email_configured() and "email" in self.p.channels)
        if email_ok and row.link_id:
            if row.purpose == "code":
                if code_route(link_sent_via=self.p.links.sent_via(row.link_id), whatsapp_ok=False, email_ok=True) is None:
                    email_ok = False
            elif self.p.links.requires_code(row.link_id):
                codes = self.p.accounts.resolve(USE_CODES, row.department_id)
                codes_ok = codes is not None and bool(codes.value) and self.p.accounts.status(codes.key).sendable
                if not (codes_ok and phone_digits((recipient.phone if recipient else None) or "")):
                    email_ok = False
        if email_ok:
            new = replace(row, id=self.p.new_id(), channel="email", use_key=USE_EMAIL, state="queued", held_reason=None,
                          held_since=None, attempts=0, first_attempt_at=None, outcome_code=None, provider_message_id=None,
                          reply_nonce=None, fallback_of=row.id, idempotency_key=None, account_key=None, sent_at=None,
                          created_at=now, not_before=now, updated_at=now)
            self.p.store.insert(new)
            self.p.secrets.move(row.id, new.id)
            self.p.hooks.fallback(row, "email", new)
            return
        self.p.hooks.fallback(row, "code_unavailable" if row.purpose == "code" else "nobody", None)


class OutboxThread:
    """The `tickets-outbox` daemon thread: drains the inbound queue (so the websocket thread never writes) and ticks the outbox.
    Started from `_start_janitor`, stopped from `_stop_janitor` (main.py registration, slice 5b)."""

    def __init__(self, outbox: Outbox, *, clock: Callable[[], dt.datetime], interval_s: float = 2.0,
                 drain_inbound: Callable[[dt.datetime], None] | None = None) -> None:
        self._outbox = outbox
        self._clock = clock
        self._interval = interval_s
        self._drain = drain_inbound
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def run_once(self) -> None:
        now = self._clock()
        if self._drain is not None:
            try:
                self._drain(now)
            except Exception:  # noqa: BLE001
                log.exception("inbound drain failed")
        try:
            self._outbox.tick(now)
        except Exception:  # noqa: BLE001
            log.exception("outbox tick failed")

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        self._outbox.recover_after_restart(self._clock())
        self._thread = threading.Thread(target=self._loop, name="tickets-outbox", daemon=True)
        self._thread.start()

    def _loop(self) -> None:
        while not self._stop.wait(self._interval):
            self.run_once()

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout)
