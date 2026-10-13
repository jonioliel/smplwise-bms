"""CR-038 section 10.5 (option B): the one-time verification code of a handler link.

Fixed rules (owner decision D2 and the spec - the length is NOT a setting, a 4-digit code is never offered):
- 6 decimal digits, uniform over 000000-999999; one live code per link (a new one invalidates the previous unconsumed code);
  valid `ttl` (default 10 minutes, `tickets.settings.code.ttl_min`); single use.
- Sending: at most 1 per 60 s, 3 per hour and 6 per day per link (counted over the code rows, so a restart does not reset
  them), and 6 per hour to one recipient across links (the `phone_key`, through the public limiter). Never held by send
  hours (the caller's outbox rule). Codes do NOT count against the per-recipient WhatsApp message cap (spec 9.2).
- Verifying: `hmac.compare_digest` of HMAC-SHA256(k_tickets, link_id | generation | code) against the stored hash; 5 wrong
  codes per link generation within 15 minutes lock the link's code entry for 30 minutes (`ticket_link_failures`, the
  second_factor._Failures pattern;
  `max_attempts` / `lock_min` are settings within safe bounds). A correct code returns a 256-bit session value
  (`X-Ticket-Session`, stored as its SHA-256, 12 hours, never past the link's expiry; a new generation kills it).

Lock-out as a DoS on the vendor (review T5a): anyone holding a forwarded link can ask for a code and type five wrong ones. The
spec accepts that with a fast way out, and this engine supplies the pieces: the refusal names the lock and its end, the
manager's one-tap "שלח קישור חדש" (new generation) calls `reset()` so the new link starts with a clean window, and two rules
keep the lever as small as it can be without weakening the brute-force bound:
- a value that is not a 6-digit code ("malformed") is not counted - it is not a guess;
- a guess while no code is live (none issued, consumed, expired, invalidated) is not counted - it can never succeed, so
  counting it would only let a stranger lock the vendor out before a code even exists.
The bound stays: at most 5 counted guesses per 15 minutes per link, against a code that lives 10 minutes and is replaced at
most 3 times an hour - about 5 / 10^6 per window (spec S10).

Where the six digits come from (a gap of the spec resolved here, safer reading): the spec keeps only the HMAC of a code and
forbids `{code}` in the outbox parameters (7.3), so a queued message could not know its code. The code is therefore DERIVED
like the link token: `derive_code(k_tickets, code_id)` with `code_id` 128 random bits. Without the key it is as unpredictable
as `secrets.randbelow(10**6)`; with it, the outbox worker renders the message from the code row id at send time and the
digits are never stored, queued or logged anywhere."""
from __future__ import annotations

import hashlib
import hmac
import secrets
import threading
import time
import unicodedata
from dataclasses import dataclass
from typing import Any, Callable, Mapping

from .links import is_link_id, new_session_value, parse_session, session_hash
from .public_ports import CodeRecord, CodeStore, FailureRecord, LinkRecord, SessionRecord
from .ratelimit import Limits, PublicLimits, ScopedRateLimiter

CODE_DIGITS = 6  # D2: fixed
CHANNELS = ("whatsapp", "email")
_SEPARATORS = frozenset({" ", "-", " ", " ", " ", "‐", "‑", "‒", "–"})


# ---------------------------------------------------------------- the code itself


def new_code_id() -> str:
    return secrets.token_hex(16)


def derive_code(key: bytes, code_id: str) -> str:
    """The six digits of the code row `code_id` (see the module docstring)."""
    if not is_link_id(code_id):
        raise ValueError("code_id must be 32 lowercase hex characters")
    mac = hmac.new(bytes(key), f"code|{code_id}".encode("ascii"), hashlib.sha256).digest()
    return f"{int.from_bytes(mac, 'big') % 10 ** CODE_DIGITS:0{CODE_DIGITS}d}"


def code_hash(key: bytes, link_id: str, code: str, *, generation: int) -> str:
    """`ticket_link_codes.code_hash`: HMAC-SHA256(k_tickets, link_id | generation | code) hex (spec 7.2, code review V8: the link
    GENERATION is part of the input, so a code issued for generation N can never match under N+1, with or without reset())."""
    if isinstance(generation, bool) or not isinstance(generation, int) or generation < 1:
        raise ValueError("generation must be a positive int")
    return hmac.new(bytes(key), f"{link_id}|{generation}|{code}".encode("ascii"), hashlib.sha256).hexdigest()


def parse_code(raw: object) -> str | None:
    """Six ASCII digits, or None. Accepts what people type from a message on any keyboard: surrounding whitespace, a single
    space or dash between digit groups, decimal digits of any script (Arabic-Indic ٠-٩ and ۰-۹, full-width ０-９ ...) mapped to
    ASCII. Anything else - letters, signs, 5 or 7 digits, doubled or trailing separators - is None. Never raises."""
    if not isinstance(raw, str) or len(raw) > 32:
        return None
    s = raw.strip()
    digits: list[str] = []
    after_sep = False
    for ch in s:
        if ch in _SEPARATORS:
            if not digits or after_sep:
                return None
            after_sep = True
            continue
        d = unicodedata.decimal(ch, None)
        if d is None:
            return None
        digits.append(str(d))
        after_sep = False
        if len(digits) > CODE_DIGITS:
            return None
    if after_sep or len(digits) != CODE_DIGITS:
        return None
    return "".join(digits)


# ---------------------------------------------------------------- the D6 code-channel rule (spec 10.5, review Q12)


def code_channel(*, link_sent_via: str | None, whatsapp_ready: bool, has_phone: bool, email_ready: bool, has_email: bool) -> str | None:
    """Which channel may carry a code now: 'whatsapp', 'email' or None (`code/send` answers 503 `code_unavailable`; at
    assignment time the assignment is refused with 409 `code_channel_unavailable`).

    The code goes by WhatsApp. Only when WhatsApp cannot carry it AND the link itself went by WhatsApp or was copied by the
    manager (`manual`) may it fall back to e-mail - a different channel from the link's. A link that went by the e-mail
    fallback needs the code on WhatsApp (two messages on one fallback channel are one factor). A link that has not left at
    all gets no fallback."""
    if whatsapp_ready and has_phone:
        return "whatsapp"
    if link_sent_via in ("whatsapp", "manual") and email_ready and has_email:
        return "email"
    return None


def effective_require_code(contact_requires: bool, assignment_requires: bool | None) -> bool:
    """What a new link snapshots (`ticket_links.require_code`): the contact's setting OR the assignment's - a manager can raise
    the requirement for one assignment, never lower the contact's (review T4)."""
    return bool(contact_requires) or bool(assignment_requires)


# ---------------------------------------------------------------- the engine


@dataclass(frozen=True)
class CodePolicy:
    ttl_s: float = 600.0
    max_attempts: int = 5
    fail_window_s: float = 900.0
    lock_s: float = 1800.0
    session_ttl_s: float = 43200.0
    send_limits: Limits = ((60.0, 1), (3600.0, 3), (86400.0, 6))

    # the `tickets.settings.code` keys and the bounds a value must fall in (out of range or the wrong type -> the default)
    BOUNDS = {"ttl_min": (1, 30), "max_attempts": (3, 10), "lock_min": (5, 240)}

    @classmethod
    def from_settings(cls, doc: Mapping[str, Any] | None) -> "CodePolicy":
        d = doc if isinstance(doc, Mapping) else {}

        def pick(name: str, default: int) -> int:
            lo, hi = cls.BOUNDS[name]
            v = d.get(name)
            return v if isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi else default

        return cls(ttl_s=60.0 * pick("ttl_min", 10), max_attempts=pick("max_attempts", 5), lock_s=60.0 * pick("lock_min", 30))


@dataclass(frozen=True)
class Issued:
    code_id: str
    channel: str
    expires_at: float


@dataclass(frozen=True)
class Verified:
    session: str
    expires_at: float


class CodeRefused(Exception):
    """`reason`: locked | rate_limited | malformed | no_code | expired | invalid. `retry_after_s` for locked / rate_limited,
    `attempts_left` for invalid / locked. `just_locked`: THIS guess started the lock (the caller then records the lock once:
    the ticket waits for the manager, slice 7). The message is the reason only - never a code or a hash."""

    def __init__(self, reason: str, *, retry_after_s: float = 0.0, attempts_left: int | None = None, just_locked: bool = False) -> None:
        super().__init__(reason)
        self.reason = reason
        self.retry_after_s = max(0.0, float(retry_after_s))
        self.attempts_left = attempts_left
        self.just_locked = just_locked


class CodeEngine:
    """Issue / verify / session checks over a CodeStore. Every operation on one link runs under that link's lock (a striped
    set of locks: bounded memory), so parallel requests of one link are counted exactly - two simultaneous sends cannot both
    pass the 1-per-minute cap, two simultaneous correct codes cannot both get a session."""

    STRIPES = 64

    def __init__(self, store: CodeStore, key: Callable[[], bytes], *, limiter: ScopedRateLimiter | None = None,
                 recipient_limits: Limits = PublicLimits().code_per_recipient,
                 policy: CodePolicy | Callable[[], CodePolicy] = CodePolicy(), clock: Callable[[], float] = time.time) -> None:
        self.store = store
        self._key = key
        self.limiter = limiter
        self.recipient_limits = recipient_limits
        self._policy = policy
        self.clock = clock
        self._stripes = [threading.Lock() for _ in range(self.STRIPES)]

    def policy(self) -> CodePolicy:
        return self._policy() if callable(self._policy) else self._policy

    def _lock(self, link_id: str) -> threading.Lock:
        return self._stripes[int(hashlib.sha256(link_id.encode("ascii")).hexdigest()[:8], 16) % self.STRIPES]

    @staticmethod
    def _locked(fr: FailureRecord | None, now: float) -> float:
        return fr.locked_until - now if fr is not None and fr.locked_until is not None and fr.locked_until > now else 0.0

    def locked_for(self, link: LinkRecord) -> float:
        """Seconds the code entry of the link's CURRENT generation stays locked (0.0 = not locked)."""
        return self._locked(self.store.failures(link.link_id, link.generation), self.clock())

    # ---------------------------------------------------------------- send

    def issue(self, link: LinkRecord, channel: str) -> Issued:
        """Create the link's next code (the caller then queues it: CodeSender.send(link, code_id, channel)). CodeRefused
        `locked` / `rate_limited` before anything is written. Codes, their send caps and the wrong-code window belong to the
        link's generation (code review V8): the manager's "new link" starts clean by construction."""
        if channel not in CHANNELS:
            raise ValueError("channel must be whatsapp or email")
        pol = self.policy()
        gen = link.generation
        with self._lock(link.link_id):
            now = self.clock()
            wait = self._locked(self.store.failures(link.link_id, gen), now)
            if wait > 0:
                raise CodeRefused("locked", retry_after_s=wait, attempts_left=0)
            longest = max(w for w, _ in pol.send_limits)
            times = sorted(self.store.code_times_since(link.link_id, gen, now - longest))
            for window, cap in pol.send_limits:
                inside = [t for t in times if now - t < window]
                if len(inside) >= cap:
                    wait = max(wait, inside[len(inside) - cap] + window - now)
            if wait > 0:
                raise CodeRefused("rate_limited", retry_after_s=wait)
            if self.limiter is not None and link.recipient_key:
                rk = "cr:" + link.recipient_key[:24]
                if not self.limiter.hit(rk, self.recipient_limits):
                    raise CodeRefused("rate_limited", retry_after_s=self.limiter.check(rk, self.recipient_limits))
            key = self._key()
            code_id = new_code_id()
            record = CodeRecord(id=code_id, link_id=link.link_id,
                                code_hash=code_hash(key, link.link_id, derive_code(key, code_id), generation=gen),
                                channel=channel, created_at=now, expires_at=now + pol.ttl_s, generation=gen)
            self.store.replace_code(record, now)
            return Issued(code_id, channel, record.expires_at)

    def withdraw(self, link: LinkRecord, code_id: str) -> None:
        """The issued code could not be queued: it stops being valid (it keeps counting against the send caps)."""
        with self._lock(link.link_id):
            self.store.expire_code(code_id, self.clock())

    # ---------------------------------------------------------------- verify

    def verify(self, link: LinkRecord, presented: object) -> Verified:
        code = parse_code(presented)
        if code is None:
            raise CodeRefused("malformed")
        pol = self.policy()
        gen = link.generation
        with self._lock(link.link_id):
            now = self.clock()
            fr = self.store.failures(link.link_id, gen)
            wait = self._locked(fr, now)
            if wait > 0:
                raise CodeRefused("locked", retry_after_s=wait, attempts_left=0)
            latest = self.store.latest_code(link.link_id, gen)
            if latest is None or latest.consumed_at is not None or latest.generation != gen:
                raise CodeRefused("no_code")
            if latest.expires_at <= now or latest.attempts >= pol.max_attempts:
                raise CodeRefused("expired")
            key = self._key()
            if not hmac.compare_digest(code_hash(key, link.link_id, code, generation=gen), latest.code_hash):
                self.store.add_attempt(latest.id)
                if fr is None or fr.locked_until is not None or now - fr.window_start > pol.fail_window_s:
                    start, n = now, 0
                else:
                    start, n = fr.window_start, fr.failures
                n += 1
                if n >= pol.max_attempts:
                    self.store.put_failures(link.link_id, gen, FailureRecord(now, 0, now + pol.lock_s))
                    self.store.expire_code(latest.id, now)
                    raise CodeRefused("locked", retry_after_s=pol.lock_s, attempts_left=0, just_locked=True)
                self.store.put_failures(link.link_id, gen, FailureRecord(start, n, None))
                raise CodeRefused("invalid", attempts_left=pol.max_attempts - n)
            if not self.store.consume(latest.id, now):
                raise CodeRefused("no_code")
            value = new_session_value()
            expires = min(now + pol.session_ttl_s, link.expires_at)
            self.store.put_session(SessionRecord(session_hash(value), link.link_id, gen, now, expires))
            self.store.clear_failures(link.link_id, gen)
            return Verified(value, expires)

    def session_ok(self, link: LinkRecord, value: object) -> bool:
        """A code session of THIS link and generation, not expired (and the link itself not expired)."""
        v = parse_session(value)
        if v is None:
            return False
        rec = self.store.session(session_hash(v))
        now = self.clock()
        return (rec is not None and rec.link_id == link.link_id and rec.generation == link.generation
                and now < rec.expires_at and now < link.expires_at)

    def reset(self, link_id: str, generation: int) -> None:
        """Defence in depth for the manager's "שלח קישור חדש" (new generation): a clean failure window of `generation` and no
        live code of it. Codes and windows are generation-scoped anyway (V8), so a new generation never needs this to be safe."""
        with self._lock(link_id):
            now = self.clock()
            self.store.clear_failures(link_id, generation)
            latest = self.store.latest_code(link_id, generation)
            if latest is not None and latest.consumed_at is None and latest.expires_at > now:
                self.store.expire_code(latest.id, now)
