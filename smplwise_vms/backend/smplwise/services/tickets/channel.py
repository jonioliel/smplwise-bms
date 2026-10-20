"""CR-038 9.1: the ticket message channel - the message model, the outcome words and the `TicketChannel` interface.

Every outbound ticket message (an assignment link, a reminder, a verification code, a status notice to the handler) and every
inbound reply goes through this interface; the outbox worker, the inbound handler and the settings page see nothing else. WhatsApp
(`ha-whatsapp`, `channel_whatsapp.py`) is the release-1 adapter; e-mail is the fallback adapter (wired in slice 5b); an official
WhatsApp Business API or SMS adapter (D13, 18A) implements the same five methods.

Outcome words (9.2 / 9.4) say what is KNOWN about one send, never more:
- `sent`      the provider accepted the message ("handed to WhatsApp"). Never "delivered" or "read": there are no receipts.
- `refused`   the provider answered with a refusal about this message; it did not leave. No retry; fallback.
- `not_sent`  it provably never left (HA unreachable before the request, service missing, account not found, no phone ...).
              Retried a few times, then fallback.
- `unknown`   it may have left (timeout after the request was written, a dropped connection, HTTP 500, a malformed answer).
              NEVER retried automatically and NEVER re-routed: a retry could duplicate a message that carries a working link.

Privacy rule for this whole package: a phone number, an e-mail address, a link token, a verification code and a message text are
never logged, never put into an exception message and never shown by `repr` (the fields below use `repr=False`).
"""
from __future__ import annotations

import hashlib
import hmac
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol, runtime_checkable

# ---------------------------------------------------------------- vocabulary

LANGS = ("he", "en", "ar", "ru")  # D26: per contact
RTL_LANGS = frozenset({"he", "ar"})
DEFAULT_LANG = "he"

# `ticket_outbox.purpose` (7.3). Cost-claim purposes belong to slice 9 (11A) - the model accepts them, no starter text ships here.
PURPOSES = ("assign", "reminder", "code", "closed", "reassigned", "reopened", "update",
            "cost_rejected", "cost_approved", "cost_reopened", "test",
            # TKRFQ1 (migration 0089): requests for quotation - the invitation, a reminder, "a new message about your quote", the
            # cancellation notice to vendors who quoted (owner decision 2) and the work order (stage C4)
            "rfq_invite", "rfq_reminder", "rfq_update", "rfq_cancelled", "rfq_order",
            "phone_verify",  # TKNOTIFOTP (folded into the 0089 outbox rebuild): the fixed number-verification code (no ticket, no link, WhatsApp only)
            "report")  # CR-VENDORQ-294 (migration 0128): a module's report to an external contact (contact_reports.py) - text built at send time
# CR-VENDORQ-294: the purposes whose text a registered module provider builds at send time (no template, no params, no reply buttons)
REPORT_PURPOSES = frozenset({"report"})
RFQ_PURPOSES = frozenset({"rfq_invite", "rfq_reminder", "rfq_update", "rfq_cancelled", "rfq_order"})
# the purposes whose message carries a six-digit code ({code} mandatory, rendered at send time only)
CODE_PURPOSES = frozenset({"code", "phone_verify"})

# The kinds of the brief (assignment link, reminder, verification code, status notice). "Escalation" is NOT a channel message:
# escalation goes to managers through CR-018 (13.3 step 2), never to the handler. A "status echo" is a notice the MANAGER's act
# causes (closed / reassigned / reopened / update); the channel never answers an inbound reply by itself (no automatic replies, Q14).
KIND_OF_PURPOSE = {
    "assign": "link", "reopened": "link", "update": "link",
    "reminder": "reminder",
    "code": "code",
    "closed": "status", "reassigned": "status", "cost_rejected": "status", "cost_approved": "status", "cost_reopened": "status",
    "test": "test",
    "rfq_invite": "link", "rfq_update": "link", "rfq_order": "link", "rfq_reminder": "reminder", "rfq_cancelled": "status",
    "phone_verify": "code",
    "report": "status",
}
# 7.3: 0 = code (sent first), 1 = assign / update / reopened, 2 = reminder / closed / reassigned (and the rest)
PRIORITY_OF_PURPOSE = {"code": 0, "phone_verify": 0, "test": 0, "assign": 1, "update": 1, "reopened": 1, "rfq_invite": 1, "rfq_update": 1, "rfq_order": 1}
LINK_PURPOSES = frozenset({"assign", "reminder", "reopened", "update",
                           "rfq_invite", "rfq_reminder", "rfq_update", "rfq_order"})  # {link} is mandatory in these templates (9.7)
# TK251 (11A.7: "sent back to the vendor ... with the link"): the cost messages that ask the vendor to act carry the handler link
# too - the link that opens the CLAIM step (claim mode, costs.claim_mode_ok), which keeps working after the ticket closed while the
# claim window is open. A row whose link serves neither the page nor the claim step is cancelled (`link_not_live`), never sent
# with a dead link. `cost_approved` asks nothing of the vendor and carries no link.
CLAIM_LINK_PURPOSES = frozenset({"cost_rejected", "cost_reopened"})
TEMPLATE_LINK_PURPOSES = LINK_PURPOSES | CLAIM_LINK_PURPOSES  # {link} is mandatory in these templates
REPLY_PURPOSES = frozenset({"assign", "reminder", "reopened", "update"})  # messages that invite "1 / 2" replies (carry a nonce)

CHANNELS = ("whatsapp", "email")  # the outbox CHECK; with the fallback order below the only places that name channels
FALLBACK_ORDER = ("whatsapp", "email")  # 9.5 / D13: then "copy link" by the manager (not a channel). SMS slots in later (18A).

SENT, REFUSED, UNKNOWN, NOT_SENT = "sent", "refused", "unknown", "not_sent"
OUTCOMES = (SENT, REFUSED, UNKNOWN, NOT_SENT)

# channel / account states (9.1, 9.9.1)
CONNECTED, DISCONNECTED, STATE_UNKNOWN, MISSING, NOT_CONFIGURED = "connected", "disconnected", "unknown", "missing", "not_configured"
# reach (9.1)
REACH_OK, REACH_NO_ADDRESS, REACH_OPTED_OUT, REACH_CHANNEL_DOWN = "ok", "no_address", "opted_out", "channel_down"


def priority_of(purpose: str) -> int:
    return PRIORITY_OF_PURPOSE.get(purpose, 2)


# ---------------------------------------------------------------- text and number hygiene

def strip_controls(text: str, *, multiline: bool = False) -> str:
    """Remove Unicode Cc and Cf characters (control, bidi overrides, zero-width - review T9). `multiline` keeps '\\n'."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    out = []
    for ch in text:
        if ch == "\n":
            out.append("\n" if multiline else " ")
        elif ch == "\t":
            out.append(" ")
        elif unicodedata.category(ch) not in ("Cc", "Cf", "Zl", "Zp"):
            out.append(ch)
    text = "".join(out)
    if multiline:
        text = "\n".join(line.rstrip() for line in text.split("\n"))
    return text


def one_line(text: Any, limit: int) -> str:
    """A placeholder value: one line, controls stripped, spaces collapsed, capped."""
    if text is None:
        return ""
    return " ".join(strip_controls(str(text)).split())[:limit]


_DIGITS = re.compile(r"\d+")


def phone_digits(raw: Any) -> str | None:
    """`ha-whatsapp` target form: country code + number, digits only, no '+' (8-15 digits, E.164 length). A WhatsApp JID
    (`<digits>@s.whatsapp.net`) yields its digits; an `@lid` identifier, a group (`@g.us`) or anything else yields None."""
    if not isinstance(raw, str):
        return None
    value = raw.strip()
    if "@" in value:
        local, _, server = value.partition("@")
        if server not in ("s.whatsapp.net", "c.us"):
            return None
        value = local.split(":", 1)[0]
    value = value.lstrip("+")
    compact = re.sub(r"[\s\-().]", "", value)
    if not compact.isdigit() or not 8 <= len(compact) <= 15:
        return None
    return compact


def keyed_hash(key: bytes, value: str) -> str:
    """HMAC-SHA256 hex: `phone_key`, `recipient_key`, `sender_key` (never the number itself)."""
    return hmac.new(key, value.encode("utf-8"), hashlib.sha256).hexdigest()


# ---------------------------------------------------------------- the message model

@dataclass(frozen=True)
class AccountRef:
    """One WhatsApp account as the channel needs it (9.9). `value` is what goes into the service's `account` field: the config
    entry id of a discovered account, or the typed value of a manual one (which may be a phone number: hidden from repr)."""

    key: str  # 'entry:<config_entry_id>' | 'manual:<id>'
    value: str = field(repr=False)
    label: str = ""


@dataclass(frozen=True)
class Recipient:
    """A recipient resolved from the directory AT SEND TIME (the outbox never copies a phone or an address)."""

    contact_id: str | None
    display_name: str = ""
    lang: str = DEFAULT_LANG
    phone: str | None = field(default=None, repr=False)  # digits, see phone_digits
    email: str | None = field(default=None, repr=False)
    user_id: str | None = None  # set when the directory row belongs to an internal user (9.6 step 7)
    opted_out: bool = False
    # TKHARDEN (delta review N-3): number verification is required for this row and its number was not confirmed by code - computed by
    # the directory AT SEND TIME, so switching verification on also stops what was queued or held before the switch.
    whatsapp_blocked: bool = False


@dataclass(frozen=True)
class Button:
    id: str  # 't:<reply_nonce>:<action>'
    text: str


@dataclass(frozen=True)
class OutboundMessage:
    outbox_id: str
    channel: str
    purpose: str
    recipient: Recipient
    text: str = field(repr=False)
    account: AccountRef | None = None  # WhatsApp: resolved when the worker claims the row (9.9.4)
    buttons: tuple[Button, ...] = ()
    footer: str = field(default="", repr=False)
    subject: str = field(default="", repr=False)  # e-mail


@dataclass(frozen=True)
class SendResult:
    outcome: str
    outcome_code: str | None = None
    provider_message_id: str | None = None

    def __post_init__(self) -> None:
        if self.outcome not in OUTCOMES:
            raise ValueError(f"unknown outcome {self.outcome!r}")

    @property
    def may_have_left(self) -> bool:
        """`sent` and `unknown` count against the pacing budget (9.2) - an `unknown` may have left."""
        return self.outcome in (SENT, UNKNOWN)


@dataclass(frozen=True)
class ChannelStatus:
    state: str  # connected | disconnected | unknown | missing | not_configured
    since: datetime | None = None
    last_ok_at: datetime | None = None
    last_error_code: str | None = None
    detail_for_admin: str | None = None  # Settings only, never an operator screen


@dataclass(frozen=True)
class InboundMessage:
    """One inbound event, normalised (9.6). Built by `inbound.normalise`; the raw event is never kept or logged."""

    event_type: str  # whatsapp_message_received | whatsapp_button_pressed
    msg_type: str | None
    sender_digits: str | None = field(repr=False)  # None for LID / group / unparseable senders
    sender_is_group: bool
    sender_name: str = field(repr=False)
    content: str = field(repr=False)
    selected_id: str | None = None  # button / list id ('t:<nonce>:<action>' when it is ours)
    provider_at: datetime | None = None
    entry_id: str | None = None  # [WA-SRC] only; UNVERIFIED on the installed version
    message_id: str | None = None  # whatsapp_button_pressed only [WA-DOC]
    content_too_long: bool = False

    @property
    def account_key(self) -> str | None:
        return f"entry:{self.entry_id}" if self.entry_id else None


# ---------------------------------------------------------------- the interface and the registry

@runtime_checkable
class TicketChannel(Protocol):
    key: str

    def status(self, account: AccountRef | None = None) -> ChannelStatus: ...

    def can_reach(self, recipient: Recipient, account: AccountRef | None = None) -> str: ...

    def send(self, msg: OutboundMessage) -> SendResult: ...  # never raises for an outcome

    def supports_buttons(self) -> bool: ...

    def parse_inbound(self, event: dict[str, Any]) -> InboundMessage | None: ...


class ChannelRegistry:
    """Maps a channel key to its adapter. Only keys of CHANNELS are accepted (the outbox CHECK)."""

    def __init__(self) -> None:
        self._by_key: dict[str, TicketChannel] = {}

    def register(self, adapter: TicketChannel) -> None:
        if adapter.key not in CHANNELS:
            raise ValueError(f"channel {adapter.key!r} is not one of {CHANNELS}")
        if not isinstance(adapter, TicketChannel):
            raise TypeError("adapter does not implement TicketChannel")
        self._by_key[adapter.key] = adapter

    def get(self, key: str) -> TicketChannel | None:
        return self._by_key.get(key)

    def keys(self) -> tuple[str, ...]:
        return tuple(k for k in CHANNELS if k in self._by_key)
