"""CR-038 public surface: the interfaces (ports) the public listener needs from the rest of the module.

The public-core branch builds the listener, its hardening, the rate limits, the token / code / upload machinery as library
code that does not touch the ticket tables. Slice 4 ("public page + links + directory", spec section 20) implements the
Protocols below over its migration 0080 (`ticket_links`, `ticket_link_sessions`, `ticket_link_codes`, `ticket_link_failures`,
`ticket_link_redeems`) and 0079 (`ticket_requests`, `ticket_attachments`); tests use in-memory fakes
(tests/tickets_public_fakes.py) that follow the same contracts.

Contract rules every implementation keeps:
- Times are epoch seconds (float, UTC). The SQL layer converts to / from the `...Z` ISO text of the tables.
- Nothing here ever receives or returns a token, a code, a session value, a redeem id or a phone number in clear: only their
  hashes (`links.token_hash`, `codes.code_hash`, `links.session_hash`, `links.redeem_hash`) and the `phone_key`.
- `LinkStore.lookup` is ONE indexed read by `ticket_links.token_hash` (and joins it needs), called only after the rate gate
  (spec 10.1 / review T2). It returns the row whatever its state; the listener decides "unavailable" uniformly.
- `ModuleSwitch.module_on` is answered from memory (no database read per request); see CachedSwitch.
- Every write method is one short transaction of its own (the normal write gate; never held across image work)."""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, Protocol, runtime_checkable


# ---------------------------------------------------------------- links


@dataclass(frozen=True)
class LinkRecord:
    """The part of a `ticket_links` row (+ its contact's `phone_key`) the listener needs to decide about a request.

    `revoked`: `revoked_at` is set (reassign, return / "לא שלי", manual, key rotation, contact change / erase, new generation,
    module key) OR the assignment is no longer the ticket's current one - slice 4 folds both into this flag.
    `grace_until`: set at close / cancel (spec 10.2, D5): until then the page is read-only; afterwards the link is unavailable.
    `recipient_key`: the contact's `phone_key` (per-recipient code caps across links), None when the contact has no phone."""

    link_id: str
    generation: int
    ticket_id: str
    assignment_id: str
    contact_id: str
    require_code: bool
    expires_at: float
    grace_until: float | None = None
    revoked: bool = False
    recipient_key: str | None = None
    sent_via: str | None = None  # 'whatsapp' | 'email' | 'manual' (D6 code-channel rule)
    ticket_number: int | None = None

    def available(self, now: float) -> bool:
        """Serves at all: not revoked, not past its (sliding / capped) expiry, not past the read-only grace. A grace never
        brings an already expired link back."""
        if self.revoked or now >= self.expires_at:
            return False
        return self.grace_until is None or now < self.grace_until

    def read_only(self, now: float) -> bool:
        """Inside the read-only grace after close / cancel: reads answer, every write is refused (409 `read_only`)."""
        return self.grace_until is not None and now < self.grace_until


@runtime_checkable
class LinkStore(Protocol):
    def lookup(self, token_hash: str) -> LinkRecord | None:
        """The link whose `token_hash` (sha256 of the CURRENT generation's token) this is, in any state; None when unknown or
        the ticket was purged. One indexed read."""

    def by_id(self, link_id: str) -> LinkRecord | None:
        """The link by id (the e-mail redeem path)."""


@runtime_checkable
class ModuleSwitch(Protocol):
    def module_on(self) -> bool:
        """`tickets.enabled`, answered from memory. False -> every request answers the uniform 404."""


class CachedSwitch:
    """A ModuleSwitch fed from outside (push), never reading on a request: `refresh()` calls `read()` (a settings read) and is
    meant for the janitor tick and the settings route that turns the module on / off (wiring checklist in the notes). Until
    the first successful refresh the module counts as OFF (fail closed); a failing read keeps the last known value."""

    def __init__(self, read: Callable[[], bool]) -> None:
        self._read = read
        self._on = False
        self._at: float | None = None
        self._lock = threading.Lock()

    def refresh(self) -> bool:
        try:
            value = bool(self._read())
        except Exception:  # noqa: BLE001 - a settings read that fails keeps the last known value
            with self._lock:
                return self._on
        with self._lock:
            self._on, self._at = value, time.time()
            return value

    def set(self, value: bool) -> None:
        with self._lock:
            self._on, self._at = bool(value), time.time()

    def module_on(self) -> bool:
        return self._on

    @property
    def refreshed_at(self) -> float | None:
        return self._at


# ---------------------------------------------------------------- e-mail redeem ids


@runtime_checkable
class RedeemStore(Protocol):
    def release(self, rid_hash: str, now: float, max_uses: int) -> tuple[str, int] | None:
        """Atomically: when the redeem row exists, `now < expires_at` and `uses < max_uses`, increment `uses` and return its
        (link_id, generation); otherwise None (and nothing changes)."""


# ---------------------------------------------------------------- idempotency (`ticket_requests`, spec 7.1 / review T22)


@dataclass(frozen=True)
class StoredResponse:
    route: str
    status: int
    body: Mapping[str, Any]


@runtime_checkable
class RequestLog(Protocol):
    def get(self, scope: str, client_request_id: str) -> StoredResponse | None:
        """The first answer stored for (scope, client_request_id) within 24 h, else None."""

    def put(self, scope: str, client_request_id: str, route: str, status: int, body: Mapping[str, Any]) -> bool:
        """Store the first answer; False when a row already existed (another request won). Slice 4 SHOULD write this row in the
        same transaction as the effect it describes, so a crash between the two cannot record one without the other."""


# ---------------------------------------------------------------- verification codes (option B, spec 10.5)


@dataclass(frozen=True)
class CodeRecord:
    id: str
    link_id: str
    code_hash: str
    channel: str  # 'whatsapp' | 'email'
    created_at: float
    expires_at: float
    attempts: int = 0
    consumed_at: float | None = None


@dataclass(frozen=True)
class FailureRecord:
    """`ticket_link_failures`: the wrong-code window of a link (the second_factor._Failures pattern)."""

    window_start: float
    failures: int
    locked_until: float | None = None


@dataclass(frozen=True)
class SessionRecord:
    id_hash: str
    link_id: str
    generation: int
    created_at: float
    expires_at: float


@runtime_checkable
class CodeStore(Protocol):
    def latest_code(self, link_id: str) -> CodeRecord | None:
        """The newest code of the link in any state (consumed, expired, invalidated by a newer one)."""

    def code_times_since(self, link_id: str, since: float) -> list[float]:
        """`created_at` of every code of the link created at or after `since`, ascending (the per-link send caps)."""

    def replace_code(self, record: CodeRecord, now: float) -> None:
        """Insert `record`; every older unconsumed code of the same link stops being valid at `now` (expires_at = now)."""

    def expire_code(self, code_id: str, now: float) -> None:
        """The code could not be handed to a channel: it stops being valid (it still counts against the send caps)."""

    def add_attempt(self, code_id: str) -> int:
        """Count one wrong attempt on this code; returns the new count."""

    def consume(self, code_id: str, now: float) -> bool:
        """Mark the code used; True only for the first caller (compare-and-set on `consumed_at IS NULL`)."""

    def failures(self, link_id: str) -> FailureRecord | None:
        ...

    def put_failures(self, link_id: str, record: FailureRecord) -> None:
        ...

    def clear_failures(self, link_id: str) -> None:
        ...

    def put_session(self, record: SessionRecord) -> None:
        ...

    def session(self, id_hash: str) -> SessionRecord | None:
        ...


@runtime_checkable
class CodeSender(Protocol):
    """The code's way out (slice 5b / 7: the outbox, purpose `code`, priority 0, never held by send hours)."""

    def channel_for(self, link: LinkRecord) -> str | None:
        """'whatsapp' | 'email' per the D6 rule (codes.code_channel), None when no channel may carry it now."""

    def send(self, link: LinkRecord, code_id: str, channel: str) -> bool:
        """Queue the code message (the `code` template: no link, no title) for the code row `code_id`. False = it could not be
        queued. The code itself is never stored, queued or logged: the outbox row keeps `code_id` only and the worker derives
        the six digits at render time with `codes.derive_code(k_tickets, code_id)` - exactly as it derives the link URL from
        (link_id, generation). (Spec gap resolved here: 7.3 forbids `{code}` in `params_json` and 10.5 stores only an HMAC.)"""


# ---------------------------------------------------------------- photos (spec 10.6) and their quotas


@dataclass(frozen=True)
class PhotoCounts:
    assignment: int  # photos uploaded through this assignment (all time)
    ticket: int  # photos of the ticket from every source


@dataclass(frozen=True)
class StoredImage:
    """A re-encoded image written under the attachments root (image_intake.store_image)."""

    rel_path: str
    sha256: str
    bytes: int
    width: int
    height: int


@dataclass(frozen=True)
class PhotoFile:
    path: Path  # absolute, already confined under the attachments root
    ticket_number: int


@runtime_checkable
class PhotoSink(Protocol):
    def counts(self, link: LinkRecord) -> PhotoCounts:
        ...

    def record(self, link: LinkRecord, image: StoredImage, client_request_id: str) -> Mapping[str, Any]:
        """Write the `ticket_attachments` row (`visible_external = 1`: the assignee's own upload), the `photo` timeline row,
        the audit row, extend the sliding expiry; return the public answer (e.g. {"id", "width", "height"}). Raising here makes
        the caller delete the stored file. It SHOULD also write the `ticket_requests` row (scope `link:<link_id>`, this
        client_request_id, route `/t/api/photo`, 201, the answer) in the SAME transaction: the app's own RequestLog.put after it
        is then a no-op (False), and a crash between the two can never let a retry store the photo twice."""

    def open(self, link: LinkRecord, attachment_id: str) -> PhotoFile | None:
        """A photo of the link's ticket that is `visible_external` and not deleted, else None."""
