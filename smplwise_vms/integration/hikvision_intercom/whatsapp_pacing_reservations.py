"""Internal injected Arx reservation adapter; no guessed wire/auth or send API.

The owner-approved Stage3a fake port exercises this local interface. A real port
must authenticate/bind these replies itself before composition. Nothing here
asserts global budget coverage; reconnect alone cannot establish that guarantee.
"""

from __future__ import annotations

import inspect
import weakref
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from .trusted_actions.validation import Refusal, reference

CLASSES = ("alert", "code", "ticket", "reminder")
OUTCOMES = ("accepted", "definitively_not_sent", "unknown")
_CLIENTS = weakref.WeakKeyDictionary()


class ReservationUnavailable(Exception):
    """No authenticated reservation answer; never evidence of a send."""


def utc(value):
    if type(value) is not datetime or value.tzinfo is not UTC:
        raise Refusal("invalid_fields")
    return value


def _class(value):
    if type(value) is not str or value not in CLASSES:
        raise Refusal("invalid_fields")
    return value


def _outcome(value):
    if type(value) is not str or value not in OUTCOMES:
        raise Refusal("invalid_fields")
    return value


def _function(port):
    return getattr(port, "__func__", port)


def _coroutine(port, *args):
    """Own an original coroutine, never adopt a returned foreign Task/Future."""
    function = _function(port)
    if not inspect.iscoroutinefunction(function):
        raise Refusal("binding_denied")
    value = port(*args)
    if not inspect.iscoroutine(value) or value.cr_code is not function.__code__:
        if inspect.iscoroutine(value):
            value.close()
        raise Refusal("binding_denied")
    return value


@dataclass(frozen=True)
class ReservationIdentity:
    request_id: str
    sender_ref: str
    message_class: str
    action_identity: str


def identity(value):
    if type(value) is not ReservationIdentity:
        raise Refusal("binding_denied")
    return (
        reference(value.request_id),
        reference(value.sender_ref),
        _class(value.message_class),
        reference(value.action_identity),
    )


@dataclass(frozen=True)
class ReserveReply:
    """Private adapter result, NOT a proposed external JSON/wire schema."""

    request_id: str
    sender_ref: str
    message_class: str
    approved: bool
    retry_after_s: int | None = None
    lease_ref: str | None = None
    lease_expires_at: datetime | None = None


@dataclass(frozen=True)
class ReservationDecision:
    identity: ReservationIdentity
    approved: bool
    retry_after_s: int | None
    lease_ref: str | None
    lease_expires_at: datetime | None


@dataclass(frozen=True)
class ReleaseReply:
    request_id: str
    outcome: str
    acknowledged: bool


@dataclass(repr=False)
class _ClientOwner:
    configuration: tuple
    bindings: dict
    released: dict


class ArxReservationClient:
    """Once-bound local identities, fake/injected port, no automatic retry.

    port.reserve(sender_ref,message_class,request_id) / release(request_id,outcome)
    are asynchronous internal ports. current() must refuse when the original
    authenticated transport/pairing/configuration is no longer current. Temporary
    unavailability uses ReservationUnavailable, not a fabricated approval.
    """

    def __init__(self, port, *, current, clock, max_identities=4096):
        if (
            not callable(current)
            or not callable(clock)
            or type(max_identities) is not int
            or not 1 <= max_identities <= 65_536
        ):
            raise Refusal("invalid_fields")
        reserve, release = port.reserve, port.release
        if any(not inspect.iscoroutinefunction(_function(p)) for p in (reserve, release)):
            raise Refusal("binding_denied")
        self.port, self.current, self.clock = port, current, clock
        self._configuration = port, reserve, release, current, clock, max_identities
        _CLIENTS[self] = _ClientOwner(self._configuration, {}, {})

    def _stable(self):
        owner = _CLIENTS.get(self)
        if (
            owner is None
            or self._configuration is not owner.configuration
            or self.port is not owner.configuration[0]
            or self.current is not owner.configuration[3]
            or self.clock is not owner.configuration[4]
            or _function(self.port.reserve) is not _function(owner.configuration[1])
            or _function(self.port.release) is not _function(owner.configuration[2])
            or getattr(self.port.reserve, "__self__", None)
            is not getattr(owner.configuration[1], "__self__", None)
            or getattr(self.port.release, "__self__", None)
            is not getattr(owner.configuration[2], "__self__", None)
        ):
            raise Refusal("binding_denied")
        current = owner.configuration[3]()
        if current is not None and current is not True:
            raise Refusal("binding_denied")
        return owner

    def _bind(self, value):
        owner = ArxReservationClient._stable(self)
        original = identity(value)
        old = owner.bindings.get(original[0])
        if old is not None and old != original:
            raise Refusal("operation_conflict")
        if old is None:
            if len(owner.bindings) >= owner.configuration[5]:
                raise Refusal("pacing_capacity")
            owner.bindings[original[0]] = original
        return owner, original

    async def reserve(self, value: ReservationIdentity):
        owner, original = ArxReservationClient._bind(self, value)
        # The original tuple is captured before awaiting any external port.
        try:
            reply = await _coroutine(owner.configuration[1], original[1], original[2], original[0])
        except (ReservationUnavailable, TimeoutError):
            ArxReservationClient._stable(self)
            if identity(value) != original:
                raise Refusal("binding_denied") from None
            raise
        ArxReservationClient._stable(self)
        if identity(value) != original or type(reply) is not ReserveReply:
            raise Refusal("binding_denied")
        if (
            (reference(reply.request_id), reference(reply.sender_ref), _class(reply.message_class))
            != original[:3]
            or type(reply.approved) is not bool
            or reply.retry_after_s is not None
            and (type(reply.retry_after_s) is not int or not 0 <= reply.retry_after_s <= 86400)
        ):
            raise Refusal("binding_denied")
        expires = reply.lease_expires_at
        if reply.approved:
            reference(reply.lease_ref)
            now = utc(owner.configuration[4]())
            if not timedelta(0) < utc(expires) - now <= timedelta(seconds=60):
                raise Refusal("pacing_lease_expired")
        elif reply.lease_ref is not None or expires is not None:
            raise Refusal("binding_denied")
        # Own a primitive copy. No pointers to a mutable external reply survive.
        owned = ReservationIdentity(*original)
        return ReservationDecision(
            owned,
            reply.approved,
            reply.retry_after_s,
            reply.lease_ref,
            expires,
        )

    async def release(self, value: ReservationIdentity, outcome: str):
        owner, original = ArxReservationClient._bind(self, value)
        outcome = _outcome(outcome)
        old = owner.released.get(original[0])
        if old == outcome:
            return True
        if old is not None and old != "unknown":
            raise Refusal("operation_conflict")
        try:
            reply = await _coroutine(owner.configuration[2], original[0], outcome)
        except (ReservationUnavailable, TimeoutError):
            ArxReservationClient._stable(self)
            if identity(value) != original:
                raise Refusal("binding_denied") from None
            raise
        ArxReservationClient._stable(self)
        if (
            identity(value) != original
            or type(reply) is not ReleaseReply
            or reference(reply.request_id) != original[0]
            or _outcome(reply.outcome) != outcome
            or type(reply.acknowledged) is not bool
        ):
            raise Refusal("binding_denied")
        if reply.acknowledged:
            latest = owner.released.get(original[0])
            if latest is not None and latest != outcome and latest != "unknown":
                raise Refusal("operation_conflict")
            owner.released[original[0]] = outcome
        return reply.acknowledged

    @property
    def shared_budget_guaranteed(self):
        ArxReservationClient._stable(self)
        # Stage3b requires actual wire/auth + union by request_id and complete
        # active-window reconciliation; connection/reservation alone is not it.
        return False
