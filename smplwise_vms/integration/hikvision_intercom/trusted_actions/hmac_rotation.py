"""Bounded HMAC rotation behind an explicit owner-provisioned secret store.

This verifies bytes supplied by the existing bridge, without changing its signed
wire format or minting a peer, actor, lease or execution permission. No key is
generated, loaded from environment variables or registered with a live service.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import re
import weakref
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta

from .envelope import ClockSample
from .lifetime import shielded_commit
from .peer_boundary import counter
from .source_bindings import same_ports
from .validation import Refusal, reference

MAX_OVERLAP = timedelta(seconds=17)  # Existing request TTL15 + future skew2.


@dataclass(frozen=True, repr=False)
class HmacSecret:
    key_ref: str
    revision: int
    key: bytes

    def __post_init__(self) -> None:
        reference(self.key_ref)
        counter(self.revision)
        if type(self.key) is not bytes or not 32 <= len(self.key) <= 64:
            raise Refusal("invalid_fields")


@dataclass(frozen=True, repr=False)
class RotationState:
    revision: int
    current: HmacSecret
    retiring: HmacSecret | None
    retiring_until: datetime | None
    changed_at: datetime

    def __post_init__(self) -> None:
        counter(self.revision)
        if type(self.current) is not HmacSecret or self.current.revision != self.revision:
            raise Refusal("invalid_fields")
        if type(self.changed_at) is not datetime or self.changed_at.utcoffset() is None:
            raise Refusal("invalid_fields")
        if self.retiring is None:
            if self.retiring_until is not None:
                raise Refusal("invalid_fields")
        elif (
            type(self.retiring) is not HmacSecret
            or self.retiring.revision >= self.revision
            or self.retiring.key_ref == self.current.key_ref
            or hmac.compare_digest(self.retiring.key, self.current.key)
            or type(self.retiring_until) is not datetime
            or self.retiring_until.utcoffset() is None
            or not self.changed_at <= self.retiring_until <= self.changed_at + MAX_OVERLAP
        ):
            raise Refusal("invalid_fields")


@dataclass(frozen=True, repr=False)
class VerifiedHmac:
    """Signature result only; callers must still validate freshness/replay/RBAC."""

    key_ref: str
    key_revision: int
    ring_revision: int
    _issuer: object


class HmacRotation:
    def __init__(
        self,
        state: RotationState,
        *,
        persist: Callable[[RotationState], Awaitable[None]],
        clock: Callable[[], ClockSample],
    ) -> None:
        if type(state) is not RotationState or not callable(persist) or not callable(clock):
            raise ValueError(
                "explicit validated secret state, atomic secret persistence and clock required"
            )
        self._state, self.persist, self.clock = state, persist, clock
        self._ports = (persist, clock)
        self._issuer = object()
        self._issued: dict[int, tuple] = {}
        self._lock = asyncio.Lock()
        self._last_observed = state.changed_at
        self.closed = False

    def _sample(self) -> datetime:
        if self.closed or not same_ports(self._ports, (self.persist, self.clock)):
            raise Refusal("Unauthorized")
        sample = self.clock()
        if type(sample) is not ClockSample:
            raise Refusal("Unauthorized")
        sample.check()
        if (
            self.closed
            or not same_ports(self._ports, (self.persist, self.clock))
            or sample.now < self._last_observed
        ):
            raise Refusal("Unauthorized")
        self._last_observed = sample.now
        return sample.now

    def verify(self, signed_bytes: bytes, signature_hex: str) -> VerifiedHmac:
        now = self._sample()
        if (
            type(signed_bytes) is not bytes
            or len(signed_bytes) > 1_048_576
            or type(signature_hex) is not str
            or re.fullmatch("[0-9a-f]{64}", signature_hex) is None
        ):
            raise Refusal("Unauthorized")
        state = self._state
        matches = []
        # Always evaluate both retained keys. The wire does not gain a key-id
        # field and no error discloses which key was tried or why it refused.
        for secret in (state.current, state.retiring):
            if secret is None:
                continue
            expected = hmac.new(secret.key, signed_bytes, hashlib.sha256).hexdigest()
            matched = hmac.compare_digest(expected, signature_hex)
            permitted = secret is state.current or now < state.retiring_until
            if matched and permitted:
                matches.append(secret)
        self._sample()
        if self._state is not state or len(matches) != 1:
            raise Refusal("Unauthorized")
        if len(self._issued) >= 4096:
            raise Refusal("Unauthorized")
        result = VerifiedHmac(matches[0].key_ref, matches[0].revision, state.revision, self._issuer)
        key = id(result)
        self._issued[key] = (
            weakref.ref(result, lambda _dead: self._issued.pop(key, None)),
            result.key_ref,
            result.key_revision,
            result.ring_revision,
            hashlib.sha256(signed_bytes).digest(),
        )
        self.require_current(result)
        return result

    def require_current(self, result: VerifiedHmac, *, signed_bytes: bytes | None = None) -> None:
        now = self._sample()
        if type(result) is not VerifiedHmac or result._issuer is not self._issuer:
            raise Refusal("Unauthorized")
        original = self._issued.get(id(result))
        if (
            original is None
            or original[0]() is not result
            or original[1:4] != (result.key_ref, result.key_revision, result.ring_revision)
            or signed_bytes is not None
            and (
                type(signed_bytes) is not bytes
                or not hmac.compare_digest(original[4], hashlib.sha256(signed_bytes).digest())
            )
        ):
            raise Refusal("Unauthorized")
        state = self._state
        if result.ring_revision != state.revision:
            raise Refusal("Unauthorized")
        for secret in (state.current, state.retiring):
            if (
                secret is not None
                and secret.key_ref == result.key_ref
                and secret.revision == result.key_revision
                and (secret is state.current or now < state.retiring_until)
            ):
                return
        raise Refusal("Unauthorized")

    async def _persist_transition(self, persist, candidate) -> None:
        # A provider may fail after its durable write. Neither continuing with
        # the old RAM key nor guessing the new generation is safe; reload the
        # original secret store before this ring can authenticate again.
        try:
            result = await persist(candidate)
            if result is not None:
                raise Refusal("storage_write_failed")
        except asyncio.CancelledError:
            self.closed = True
            raise
        except Exception:
            self.closed = True
            raise Refusal("storage_write_failed") from None

    async def rotate(
        self, secret: HmacSecret, *, expected_revision: int, overlap: timedelta = MAX_OVERLAP
    ) -> int:
        counter(expected_revision)
        if (
            type(secret) is not HmacSecret
            or type(overlap) is not timedelta
            or not timedelta() <= overlap <= MAX_OVERLAP
        ):
            raise Refusal("invalid_fields")
        async with self._lock:
            now = self._sample()
            old = self._state
            if (
                old.revision != expected_revision
                or secret.revision != counter(expected_revision + 1)
                or secret.key_ref == old.current.key_ref
                or hmac.compare_digest(secret.key, old.current.key)
                or old.retiring is not None
                and (
                    secret.key_ref == old.retiring.key_ref
                    or hmac.compare_digest(secret.key, old.retiring.key)
                )
            ):
                raise Refusal("binding_denied")
            candidate = RotationState(secret.revision, secret, old.current, now + overlap, now)
            persist = self.persist

            async def saving() -> None:
                self._sample()
                if self._state is not old or not same_ports((persist,), (self.persist,)):
                    raise Refusal("Unauthorized")
                await self._persist_transition(persist, candidate)

            # Publish a successfully persisted secret transition even when the
            # caller is cancelled. Never roll RAM back to an older key generation.
            await shielded_commit(saving, lambda: setattr(self, "_state", candidate))
            self._sample()
            return candidate.revision

    async def revoke_retiring(self, *, expected_revision: int) -> None:
        counter(expected_revision)
        async with self._lock:
            now = self._sample()
            old = self._state
            if old.revision != expected_revision:
                raise Refusal("binding_denied")
            candidate = RotationState(old.revision, old.current, None, None, now)
            persist = self.persist

            async def saving() -> None:
                self._sample()
                if self._state is not old or not same_ports((persist,), (self.persist,)):
                    raise Refusal("Unauthorized")
                await self._persist_transition(persist, candidate)

            await shielded_commit(saving, lambda: setattr(self, "_state", candidate))
            self._sample()

    def close(self) -> None:
        self.closed = True
        self._issued.clear()
