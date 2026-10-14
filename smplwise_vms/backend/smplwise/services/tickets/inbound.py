"""CR-038 9.6: inbound WhatsApp replies - normalise the two `ha-whatsapp` events, filter by account, check freshness and
duplicates, and match a reply to a ticket by nonce (button taps) or by the sender's keyed number (text replies).

Trust boundary (stated plainly, 9.6): an HA event is not authenticated by WhatsApp - any HA administrator, automation or script can
fire `whatsapp_message_received` with any `sender_number`. Inbound messages are therefore ADVISORY: they can only move a ticket
forward to `acknowledged` (from `assigned`) or `in_progress` (from `assigned` / `acknowledged`), or add a note marked "via WhatsApp
(unverified sender)". They never set done / waiting_part, never return, close or change an ETA, and never change the status of a
ticket whose live link requires a code (such a reply becomes a note).

This module DECIDES; it writes nothing. The wiring slice (5b) applies an `InboundDecision`: one `ticket_inbound` row
(`decision.record`), the timeline row (`actor_kind = 'inbound'`, `via = 'whatsapp'`), the advisory status change, "waiting for
manager" (`late_reply` / `reply`), the CR-018 `ticket.reply_unmatched` signal and the audit row `ticket.inbound`
(`decision.audit()` - result, ticket, outbox id; never a number or content).

Rules kept here:
- the raw event is never logged and never stored; `media_url` is never read, let alone fetched (a rule, review T11-3);
- `sender_key = HMAC(k_tickets, digits)` when the number yields 8-15 digits, else NULL (`@lid` addressing, review T12b) - the
  nonce path works without a number;
- freshness (review T12a): more than 2 minutes in the future or older than `reply_window_h` -> `stale`; older than 10 minutes ->
  `late` (a flagged note, never a status change); an event WITHOUT a usable timestamp is treated as late (UNVERIFIED shape);
- dedupe 24 h on sha256(account | sender | provider_at | type | selected_id | content) (the received event has no message id);
- no automatic replies (Q14).
"""
from __future__ import annotations

import collections
import datetime as dt
import hashlib
import logging
import re
import threading
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Mapping, Protocol

from .channel import InboundMessage, keyed_hash, phone_digits, strip_controls

log = logging.getLogger("smplwise.tickets.inbound")
UTC = dt.timezone.utc

EVENT_RECEIVED = "whatsapp_message_received"
EVENT_BUTTON = "whatsapp_button_pressed"
TICKET_EVENTS = (EVENT_RECEIVED, EVENT_BUTTON)  # the subscription tuple for ha_sync (next to AUTOMATION_EVENTS)
TEXT_TYPES = frozenset({"chat", "text", "button_reply", "list_reply"})
CONTENT_MAX = 1000
FUTURE_SKEW = dt.timedelta(minutes=2)
LATE_AFTER = dt.timedelta(minutes=10)
DEDUPE_FOR = dt.timedelta(hours=24)
DEFAULT_REPLY_WINDOW_H = 72
QUEUE_MAX = 200

NONCE_ID = re.compile(r"^t:([0-9a-f]{16}):(ack|wip)$")
ACTION_STATUS = {"ack": "acknowledged", "wip": "in_progress"}

RESULTS = ("status", "note", "late", "ignored", "ambiguous", "unknown_sender", "stale", "duplicate", "refused")

# Whole-reply action words (normalised: lower case, punctuation trimmed, digits folded to ASCII). Anything else is a note.
ACK_WORDS = frozenset({"1", "התקבל", "קיבלתי", "received", "ok", "okay", "got it", "تم الاستلام", "استلمت", "получено", "принято", "ок"})
WIP_WORDS = frozenset({"2", "בטיפול", "מטפל", "in progress", "working on it", "قيد المعالجة", "в работе"})


# ---------------------------------------------------------------- normalising

def _str(v: Any, limit: int = 200) -> str | None:
    return v[:limit] if isinstance(v, str) and v else None


def parse_timestamp(value: Any) -> dt.datetime | None:
    """The event's own time. UNVERIFIED shape: epoch seconds, epoch milliseconds, a numeric string or ISO-8601 are accepted."""
    if isinstance(value, bool) or value is None:
        return None
    try:
        if isinstance(value, (int, float)) or (isinstance(value, str) and re.fullmatch(r"\d{9,14}(\.\d+)?", value.strip())):
            num = float(value)
            if num > 1e12:
                num /= 1000.0
            return dt.datetime.fromtimestamp(num, UTC)
        if isinstance(value, str):
            parsed = dt.datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
            return parsed.astimezone(UTC) if parsed.tzinfo else None
    except (ValueError, OverflowError, OSError):
        return None
    return None


def normalise(event: Mapping[str, Any]) -> InboundMessage | None:
    """An HA event (`{"event_type", "data", "time_fired", ...}` or the websocket frame `{"type": "event", "event": {...}}`) ->
    InboundMessage; None when it is not one of the two ticket events. `media_url` is deliberately not read."""
    if not isinstance(event, Mapping):
        return None
    if event.get("type") == "event" and isinstance(event.get("event"), Mapping):
        event = event["event"]
    etype = event.get("event_type")
    if etype not in TICKET_EVENTS:
        return None
    data = event.get("data") if isinstance(event.get("data"), Mapping) else {}
    sender = _str(data.get("sender")) or ""
    number = _str(data.get("sender_number")) or ""
    group = any(s.endswith("@g.us") for s in (sender, number))
    digits = None if group else (phone_digits(number) if number else phone_digits(sender))
    raw = data.get("content")
    if etype == EVENT_BUTTON:
        selected = _str(data.get("button_id"), 80)
        raw = data.get("button_text") if raw is None else raw
        msg_type = "button_reply"
    else:
        selected = _str(data.get("selected_id"), 80)
        msg_type = _str(data.get("type"), 40)
    content = strip_controls(raw, multiline=True).strip() if isinstance(raw, str) else ""
    too_long = len(content) > CONTENT_MAX
    entry = data.get("entry_id")
    return InboundMessage(
        event_type=etype, msg_type=msg_type, sender_digits=digits, sender_is_group=group,
        sender_name=strip_controls(_str(data.get("sender_name"), 80) or "").strip(),
        content=content[:CONTENT_MAX], selected_id=selected, provider_at=parse_timestamp(data.get("timestamp")),
        entry_id=entry if isinstance(entry, str) and re.fullmatch(r"[A-Za-z0-9_\-]{1,64}", entry) else None,
        message_id=_str(data.get("message_id"), 128), content_too_long=too_long)


def _fold(text: str) -> str:
    out = []
    for ch in text:
        d = unicodedata.digit(ch, None) if ch.isdigit() else None
        out.append(str(d) if d is not None else ch)
    return "".join(out)


def parse_reply(content: str) -> tuple[frozenset[int], str | None]:
    """(ticket references, action) of a text reply. References: '#<n>' anywhere; in a reply made only of numbers, every number
    other than the one action digit. Action: 'ack' / 'wip' only when the WHOLE reply (minus references) is an action word or
    digit - "ok I'll come tomorrow" is a note, never a status."""
    text = _fold(content).strip()
    refs = {int(m) for m in re.findall(r"#\s?(\d{1,7})\b", text)}
    rest = re.sub(r"#\s?\d{1,7}\b", " ", text)
    words = re.sub(r"[\s.,!?;:\-–—'\"()\[\]،؟]+", " ", rest).strip().lower()
    action = None
    if words in ACK_WORDS:
        action = "ack"
    elif words in WIP_WORDS:
        action = "wip"
    elif words and all(re.fullmatch(r"\d{1,7}", w) for w in words.split()):
        nums = words.split()
        acts = [w for w in nums if w in ("1", "2")]
        if len(acts) == 1 and len(nums) > 1:
            action = "ack" if acts[0] == "1" else "wip"
            refs |= {int(w) for w in nums if w != acts[0]}
        elif not acts:
            refs |= {int(w) for w in nums}
    return frozenset(refs), action


def advisory_status(current: str, action: str | None) -> str | None:
    """11.2, the "Inbound WhatsApp" column: assigned -> acknowledged; assigned / acknowledged -> in_progress. Nothing else."""
    if action == "ack" and current == "assigned":
        return "acknowledged"
    if action == "wip" and current in ("assigned", "acknowledged"):
        return "in_progress"
    return None


# ---------------------------------------------------------------- ports

@dataclass(frozen=True)
class NonceTarget:
    """The outbox row a button nonce names, with what the matcher needs (from ticket_outbox + links + assignments + contacts)."""

    outbox_id: str
    ticket_id: str
    ticket_number: int
    department_id: str
    assignment_id: str
    contact_id: str
    contact_phone_key: str | None = field(repr=False)
    account_key: str | None
    link_live: bool
    assignment_current: bool
    requires_code: bool
    ticket_status: str
    provider_message_id: str | None = None


@dataclass(frozen=True)
class Candidate:
    """A live assignment of a contact whose `phone_key` equals the sender key, with its last `sent` outbox row."""

    ticket_id: str
    ticket_number: int
    department_id: str
    assignment_id: str
    contact_id: str
    outbox_id: str
    last_sent_at: dt.datetime
    account_key: str | None
    ticket_status: str
    requires_code: bool


class MatchDirectory(Protocol):
    def by_nonce(self, nonce: str) -> NonceTarget | None: ...

    def candidates(self, sender_key: str, *, since: dt.datetime, account_key: str | None) -> list[Candidate]: ...


class DedupeStore(Protocol):
    def seen(self, key: str, now: dt.datetime) -> bool: ...  # True when seen within 24 h; records the key otherwise


class AccountFilter(Protocol):
    def accepts(self, account_key: str, now: dt.datetime) -> bool: ...


class TicketAccountFilter:
    """9.6 first step: an event carrying `entry_id` is processed only when that account is mapped to a ticket use now, or sent a
    ticket outbox row within the reply window (`recent_keys(since)`). Everything else (the owner's other numbers, the intercom,
    private chats) is dropped before any row is written."""

    def __init__(self, mapped_keys: Callable[[], Iterable[str]], recent_keys: Callable[[dt.datetime], Iterable[str]],
                 reply_window_h: Callable[[], int] = lambda: DEFAULT_REPLY_WINDOW_H) -> None:
        self._mapped, self._recent, self._window = mapped_keys, recent_keys, reply_window_h

    def accepts(self, account_key: str, now: dt.datetime) -> bool:
        if account_key in set(self._mapped()):
            return True
        return account_key in set(self._recent(now - dt.timedelta(hours=self._window())))

    def account_count(self, now: dt.datetime) -> int:
        """How many accounts the module listens to now (mapped to a ticket use, or sent within the reply window)."""
        return len(set(self._mapped()) | set(self._recent(now - dt.timedelta(hours=self._window()))))


class MemoryDedupe:
    def __init__(self) -> None:
        self._at: dict[str, dt.datetime] = {}

    def seen(self, key: str, now: dt.datetime) -> bool:
        for k in [k for k, at in self._at.items() if now - at > DEDUPE_FOR]:
            del self._at[k]
        if key in self._at:
            return True
        self._at[key] = now
        return False


# ---------------------------------------------------------------- the decision

@dataclass(frozen=True)
class InboundDecision:
    result: str  # one of RESULTS, or 'dropped' (account filter: no row at all)
    record: bool  # write a ticket_inbound row
    event_type: str
    msg_type: str | None
    provider_at: dt.datetime | None
    sender_key: str | None = field(default=None, repr=False)
    account_key: str | None = None
    dedupe_key: str | None = None
    ticket_id: str | None = None
    outbox_id: str | None = None
    contact_id: str | None = None
    assignment_id: str | None = None
    action: str | None = None  # the status to apply: acknowledged | in_progress (result 'status' only)
    note: str | None = field(default=None, repr=False)  # the note text (results note / late)
    content: str | None = field(default=None, repr=False)  # ticket_inbound.content: ONLY for ambiguous / note / late
    waiting_reason: str | None = None  # late_reply (late) | reply (ambiguous)
    candidate_ticket_ids: tuple[str, ...] = ()
    candidate_department_ids: tuple[str, ...] = ()
    reason: str | None = None  # why ignored / refused / stale / a note instead of a status
    sender_display: str | None = field(default=None, repr=False)  # shown to managers for ambiguous replies (name only)

    def audit(self) -> dict[str, Any]:
        """The `ticket.inbound` audit details: envelope only (never a number, a key or content)."""
        return {"result": self.result, "ticket_id": self.ticket_id, "outbox_id": self.outbox_id, "reason": self.reason,
                "action": self.action, "event_type": self.event_type}


def dedupe_key(msg: InboundMessage, sender_key: str | None) -> str:
    parts = [msg.account_key or "", sender_key or "", msg.provider_at.isoformat() if msg.provider_at else "", msg.msg_type or "",
             msg.event_type, msg.selected_id or "", msg.content]
    return hashlib.sha256("\x1f".join(parts).encode("utf-8")).hexdigest()


class InboundProcessor:
    def __init__(self, *, key: bytes, directory: MatchDirectory, dedupe: DedupeStore, account_filter: AccountFilter | None = None,
                 reply_window_h: Callable[[], int] = lambda: DEFAULT_REPLY_WINDOW_H) -> None:
        self._key = key
        self._dir = directory
        self._dedupe = dedupe
        self._filter = account_filter
        self._window = reply_window_h
        self.counters: collections.Counter[str] = collections.Counter()

    def process(self, event: Mapping[str, Any] | InboundMessage, now: dt.datetime) -> InboundDecision | None:
        msg = event if isinstance(event, InboundMessage) else normalise(event)
        if msg is None:
            return None
        now = now.astimezone(UTC)
        decision = self._decide(msg, now)
        self.counters[decision.result] += 1
        log.info("inbound result=%s reason=%s ticket=%s outbox=%s", decision.result, decision.reason, decision.ticket_id, decision.outbox_id)
        return decision

    def _decide(self, msg: InboundMessage, now: dt.datetime) -> InboundDecision:
        base = dict(event_type=msg.event_type, msg_type=msg.msg_type, provider_at=msg.provider_at, account_key=msg.account_key)
        # 1. account filter (only when the event names its account)
        if msg.account_key and self._filter is not None and not self._filter.accepts(msg.account_key, now):
            return InboundDecision("dropped", False, **base, reason="account_not_ticket")
        sender_key = keyed_hash(self._key, msg.sender_digits) if msg.sender_digits else None
        base["sender_key"] = sender_key
        # 2. what is ours at all
        if msg.event_type == EVENT_RECEIVED and (msg.msg_type or "") not in TEXT_TYPES:
            return InboundDecision("ignored", True, **base, reason="type")
        if msg.sender_is_group:
            return InboundDecision("ignored", True, **base, reason="group")
        nonce_match = NONCE_ID.match(msg.selected_id or "")
        # security review 2026-10-14 (2.5.1): a reply WITHOUT entry_id cannot be told apart when more than one account is linked -
        # fail closed: an ignored row with the reason only (no content), never matched by sender. A button carries its own nonce
        # (bound to one outbox row and its recipient), so it stays matchable.
        if not nonce_match and not msg.account_key and self._filter is not None:
            count = getattr(self._filter, "account_count", None)
            if count is not None and count(now) > 1:
                return InboundDecision("ignored", True, **{**base, "sender_key": None}, reason="account_unknown")
        if msg.content_too_long:
            return InboundDecision("ignored", True, **base, reason="too_long")
        if not msg.content and not nonce_match:
            return InboundDecision("ignored", True, **base, reason="empty")
        # 3. freshness, then dedupe
        window = dt.timedelta(hours=self._window())
        late = msg.provider_at is None or now - msg.provider_at > LATE_AFTER
        if msg.provider_at is not None and (msg.provider_at - now > FUTURE_SKEW or now - msg.provider_at > window):
            return InboundDecision("stale", True, **base, reason="future" if msg.provider_at > now else "old")
        key = dedupe_key(msg, sender_key)
        base["dedupe_key"] = key
        if self._dedupe.seen(key, now):
            return InboundDecision("duplicate", True, **base)
        # 4. button tap / list pick carrying our nonce
        if nonce_match:
            return self._by_nonce(msg, nonce_match[1], nonce_match[2], late, base)
        # 5. text reply
        return self._by_sender(msg, sender_key, late, now - window, base)

    def _by_nonce(self, msg: InboundMessage, nonce: str, action: str, late: bool, base: dict[str, Any]) -> InboundDecision:
        target = self._dir.by_nonce(nonce)
        if target is None:
            return InboundDecision("ignored", True, **base, reason="nonce_unknown")
        ids = dict(ticket_id=target.ticket_id, outbox_id=target.outbox_id, contact_id=target.contact_id, assignment_id=target.assignment_id)
        if msg.account_key and target.account_key and msg.account_key != target.account_key:
            return InboundDecision("refused", True, **base, **ids, reason="account_mismatch")
        if base["sender_key"] is not None and base["sender_key"] != target.contact_phone_key:
            return InboundDecision("refused", True, **base, **ids, reason="sender_mismatch")
        if msg.message_id and target.provider_message_id and msg.message_id != target.provider_message_id:
            return InboundDecision("refused", True, **base, **ids, reason="message_mismatch")
        if not (target.link_live and target.assignment_current):
            return InboundDecision("ignored", True, **base, **ids, reason="assignment_ended")
        word = msg.content or action
        if late:
            return InboundDecision("late", True, **base, **ids, note=word, content=word, waiting_reason="late_reply", reason="late")
        if target.requires_code:
            return InboundDecision("note", True, **base, **ids, note=word, content=word, reason="code_protected")
        to = advisory_status(target.ticket_status, action)
        if to is None:
            return InboundDecision("note", True, **base, **ids, note=word, content=word, reason="not_forward")
        return InboundDecision("status", True, **base, **ids, action=to)

    def _by_sender(self, msg: InboundMessage, sender_key: str | None, late: bool, since: dt.datetime, base: dict[str, Any]) -> InboundDecision:
        if sender_key is None:
            return InboundDecision("unknown_sender", True, **base, reason="no_number")
        found = self._dir.candidates(sender_key, since=since, account_key=msg.account_key)
        if msg.account_key:
            found = [c for c in found if c.account_key in (None, msg.account_key)]
        if not found:
            return InboundDecision("unknown_sender", True, **base)
        refs, action = parse_reply(msg.content)
        if refs:
            narrowed = [c for c in found if c.ticket_number in refs]
            # a reference that names none of the sender's live tickets is never guessed away: a manager looks at it
            found = narrowed if narrowed else found
            if not narrowed:
                return self._ambiguous(msg, found, base, reason="reference_unknown")
        if len(found) > 1:
            return self._ambiguous(msg, found, base, reason="several")
        c = found[0]
        ids = dict(ticket_id=c.ticket_id, outbox_id=c.outbox_id, contact_id=c.contact_id, assignment_id=c.assignment_id)
        if late:
            return InboundDecision("late", True, **base, **ids, note=msg.content, content=msg.content, waiting_reason="late_reply", reason="late")
        to = advisory_status(c.ticket_status, action) if action and not c.requires_code else None
        if to is not None:
            return InboundDecision("status", True, **base, **ids, action=to)
        reason = "code_protected" if action and c.requires_code else ("not_forward" if action else None)
        return InboundDecision("note", True, **base, **ids, note=msg.content, content=msg.content, reason=reason)

    @staticmethod
    def _ambiguous(msg: InboundMessage, found: list[Candidate], base: dict[str, Any], *, reason: str) -> InboundDecision:
        return InboundDecision("ambiguous", True, **base, content=msg.content, waiting_reason="reply", reason=reason,
                               candidate_ticket_ids=tuple(sorted({c.ticket_id for c in found})),
                               candidate_department_ids=tuple(sorted({c.department_id for c in found})),
                               sender_display=msg.sender_name or None)


# ---------------------------------------------------------------- the bounded hand-off queue (websocket thread -> worker)

class InboundQueue:
    """`inbound.submit(event)` from the `ha_sync` websocket thread: a bounded queue (200; overflow dropped and counted), drained
    by the outbox thread, so the websocket thread never writes."""

    def __init__(self, maxlen: int = QUEUE_MAX) -> None:
        self._q: collections.deque[Mapping[str, Any]] = collections.deque()
        self._max = maxlen
        self._lock = threading.Lock()
        self.overflow = 0

    def submit(self, event: Mapping[str, Any]) -> bool:
        with self._lock:
            if len(self._q) >= self._max:
                self.overflow += 1
                return False
            self._q.append(event)
            return True

    def drain(self, limit: int = 50) -> list[Mapping[str, Any]]:
        with self._lock:
            out = []
            while self._q and len(out) < limit:
                out.append(self._q.popleft())
            return out

    def __len__(self) -> int:
        with self._lock:
            return len(self._q)
