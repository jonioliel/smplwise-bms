"""Typed transport seam for peer evidence; no peer is derived from action JSON.

The transport's joint verifier and liveness port must be supplied by the trusted
bridge. This module has no key, token, network client or default authenticator.
An injected verifier in a unit test proves only the seam, never a real Arx peer.
"""

from __future__ import annotations

import weakref
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from .envelope import ClockSample, Request
from .producer import AuthenticatedDescriptor
from .source_bindings import same_ports
from .validation import Refusal, reference

if TYPE_CHECKING:
    from ..access.arx_feature_execution_contract import FeatureRequest

MAX_COUNTER = 2**63 - 1
MAX_PEER_REVISION = 2**53 - 1


def counter(value: Any, *, zero: bool = False) -> int:
    if type(value) is not int or not (0 if zero else 1) <= value <= MAX_COUNTER:
        raise Refusal("invalid_fields")
    return value


def peer_revision(value: Any, *, zero: bool = False) -> int:
    """The interoperable registry revision; legacy local counters stay unchanged."""
    if type(value) is not int or not (0 if zero else 1) <= value <= MAX_PEER_REVISION:
        raise Refusal("invalid_fields")
    return value


@dataclass(frozen=True, repr=False)
class TransportVerification:
    """Internal result of one authenticated transport/message verification.

    The bridge obtains peer and binding identities from its authenticated
    transport registry, never from actor, request_id, operation_id or signature
    text. Its is_current port must bind this exact result to the exact connection.
    """

    descriptor: AuthenticatedDescriptor
    repository_id: str
    verified_peer_ref: str
    peer_binding_ref: str
    peer_binding_revision: int

    def __post_init__(self) -> None:
        if type(self.descriptor) is not AuthenticatedDescriptor:
            raise Refusal("Unauthorized")
        for value in (self.repository_id, self.verified_peer_ref, self.peer_binding_ref):
            reference(value)
        peer_revision(self.peer_binding_revision)


@dataclass(frozen=True, repr=False)
class PeerMessage:
    """Process-local sealed result; never a wire DTO or a serializable credential."""

    verification: TransportVerification
    request: Request | FeatureRequest
    query_owner_id: str
    _boundary: Any
    _connection: Any
    _user: Any
    _seal: object

    def check(self) -> None:
        self._boundary.check(self)


class PeerBoundary:
    def __init__(
        self,
        *,
        verify: Callable[[str, Any], Awaitable[TransportVerification]],
        is_current: Callable[[Any, TransportVerification], bool],
        clock: Callable[[], ClockSample],
        repository_id: str,
        enabled_selections: frozenset[str] = frozenset({"rev1"}),
    ) -> None:
        if not all(callable(port) for port in (verify, is_current, clock)):
            raise ValueError("explicit trusted transport and clock ports required")
        reference(repository_id)
        self.verify_transport, self.is_current, self.clock = verify, is_current, clock
        self.repository_id, self.enabled_selections = repository_id, enabled_selections
        self._ports = (verify, is_current, clock, self._parse)
        self._configuration = (repository_id, enabled_selections)
        self._seal = object()
        self._issued: dict[int, tuple[Any, ...]] = {}
        self.closed = False

    def _stable(self) -> None:
        if (
            self.closed
            or not same_ports(
                self._ports, (self.verify_transport, self.is_current, self.clock, self._parse)
            )
            or self._configuration != (self.repository_id, self.enabled_selections)
        ):
            raise Refusal("Unauthorized")

    @staticmethod
    def _user(connection: Any) -> Any:
        user = getattr(connection, "user", None)
        if (
            user is None
            or getattr(user, "is_active", None) is not True
            or getattr(user, "is_admin", None) is not True
        ):
            raise Refusal("Unauthorized")
        reference(getattr(user, "id", None))
        return user

    def _parse(self, public_json: str, now):
        return Request.parse(public_json, now, self.enabled_selections)

    async def verify(self, encoded: str, connection: Any) -> PeerMessage:
        self._stable()
        user = self._user(connection)
        owner_id = user.id
        if type(encoded) is not str or not 1 <= len(encoded.encode("utf-8")) <= 1_048_576:
            raise Refusal("Unauthorized")
        verified = await self.verify_transport(encoded, connection)
        self._stable()
        if (
            type(verified) is not TransportVerification
            or connection.user is not user
            or verified.repository_id != self.repository_id
        ):
            raise Refusal("Unauthorized")
        sample = self.clock()
        if type(sample) is not ClockSample:
            raise Refusal("Unauthorized")
        sample.check()
        request = self._parse(verified.descriptor.public_json, sample.now)
        if len(self._issued) >= 4096:
            raise Refusal("Unauthorized")
        message = PeerMessage(verified, request, owner_id, self, connection, user, self._seal)
        key = id(message)
        self._issued[key] = (
            weakref.ref(message, lambda _dead: self._issued.pop(key, None)),
            verified,
            request,
            connection,
            user,
            owner_id,
            (
                verified.repository_id,
                verified.verified_peer_ref,
                verified.peer_binding_ref,
                verified.peer_binding_revision,
                verified.descriptor,
            ),
        )
        self.check(message)
        return message

    def check(self, message: PeerMessage) -> None:
        self._stable()
        self._issued_current(message)
        if (
            message._boundary is not self
            or message._seal is not self._seal
            or message._connection.user is not message._user
            or self._user(message._connection) is not message._user
            or message._user.id != message.query_owner_id
            or message.verification.repository_id != self.repository_id
        ):
            raise Refusal("Unauthorized")
        if self.is_current(message._connection, message.verification) is not True:
            raise Refusal("Unauthorized")
        self._stable()
        sample = self.clock()
        if type(sample) is not ClockSample:
            raise Refusal("Unauthorized")
        sample.check()
        message.request.recheck(sample.now, self.enabled_selections)
        if (
            message.request.get("actor")["kind"] == "human"
            and message.verification.descriptor.human_session_active is not True
        ):
            raise Refusal("Unauthorized")
        if self.is_current(message._connection, message.verification) is not True:
            raise Refusal("Unauthorized")
        self._stable()
        self._issued_current(message)
        if (
            self._user(message._connection) is not message._user
            or message._user.id != message.query_owner_id
        ):
            raise Refusal("Unauthorized")

    def _issued_current(self, message: PeerMessage) -> None:
        if type(message) is not PeerMessage:
            raise Refusal("Unauthorized")
        issued = self._issued.get(id(message))
        if (
            issued is None
            or issued[0]() is not message
            or message.verification is not issued[1]
            or message.request is not issued[2]
            or message._connection is not issued[3]
            or message._user is not issued[4]
            or message.query_owner_id != issued[5]
            or issued[6]
            != (
                message.verification.repository_id,
                message.verification.verified_peer_ref,
                message.verification.peer_binding_ref,
                message.verification.peer_binding_revision,
                message.verification.descriptor,
            )
        ):
            raise Refusal("Unauthorized")

    def close(self) -> None:
        self.closed = True
        self._issued.clear()
