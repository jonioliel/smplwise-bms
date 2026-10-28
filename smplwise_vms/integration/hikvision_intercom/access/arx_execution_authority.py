"""Explicit current Arx source and owner-provisioned peer registry for features.

No runtime route installs these ports. Production must compose the actual joint
transport verifier, owner registry and current Arx source. Test doubles establish
only WisKey behavior. Policy objects and JSON are never themselves credentials.
"""

from __future__ import annotations

import inspect
import threading
import weakref
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from ..trusted_actions.envelope import freeze
from ..trusted_actions.peer_boundary import PeerMessage, counter
from ..trusted_actions.source_bindings import same_ports
from ..trusted_actions.validation import Refusal, reference
from .arx_feature_execution_contract import FeatureRequest

if TYPE_CHECKING:
    from ..trusted_actions.native_peer_source import NativePeerRegistry


class FeaturePeerRegistry:
    """Active owner configuration; initially empty, never provisioned by a peer.

    It is intentionally separate from person data. A host must durably provision
    this registry from its owner configuration before enabling an adapter. There
    is no automatic import or write to a real configuration in this candidate.
    Historical receipt access remains the separate versioned-store protocol.
    """

    def __init__(self, repository_id: str):
        self.repository_id = reference(repository_id)
        self._repository_id = repository_id
        self._lock = threading.RLock()
        self._heads: dict[str, tuple[int, str, str, bool]] = {}

    def provision(
        self,
        binding_ref: str,
        *,
        expected_revision: int,
        verified_peer_ref: str,
        query_owner_id: str,
        active: bool,
    ) -> int:
        reference(binding_ref)
        reference(verified_peer_ref)
        reference(query_owner_id)
        counter(expected_revision, zero=True)
        if type(active) is not bool:
            raise Refusal()
        revision = counter(expected_revision + 1)
        with self._lock:
            prior = self._heads.get(binding_ref)
            if (prior[0] if prior else 0) != expected_revision:
                raise Refusal("binding_denied")
            self._heads[binding_ref] = revision, verified_peer_ref, query_owner_id, active
        return revision

    def check(self, message: PeerMessage) -> None:
        if type(message) is not PeerMessage:
            raise Refusal("Unauthorized")
        message.check()
        peer = message.verification
        with self._lock:
            if (
                self.repository_id != self._repository_id
                or peer.repository_id != self._repository_id
                or self._heads.get(peer.peer_binding_ref)
                != (
                    peer.peer_binding_revision,
                    peer.verified_peer_ref,
                    message.query_owner_id,
                    True,
                )
            ):
                raise Refusal("binding_denied")


class DurableFeaturePeerRegistry:
    """Read the same committed native owner registry used by W1 mutations.

    Provisioning/rotation remains NativePeerRegistry's single native commit.
    This adapter grants no peer and stores no duplicate head or allow verdict.
    Native immutable image publication permits bounded synchronous CPU reads.
    """

    def __init__(self, registry: NativePeerRegistry) -> None:
        from ..trusted_actions.native_peer_source import NativePeerRegistry

        if type(registry) is not NativePeerRegistry:
            raise ValueError("original durable native peer registry required")
        registry._stable()
        self.registry = registry
        self._origin = registry, registry._stable, registry.repository, registry.repository_id

    def _table(self) -> dict[str, Any]:
        registry, stable, repository, identity = self._origin
        if (
            self.registry is not registry
            or registry.repository is not repository
            or registry.repository_id != identity
            or not same_ports((stable,), (registry._stable,))
        ):
            raise Refusal("binding_denied")
        return stable()

    def check(self, message: PeerMessage) -> None:
        if type(message) is not PeerMessage or type(message.request) is not FeatureRequest:
            raise Refusal("Unauthorized")
        message.check()
        table = DurableFeaturePeerRegistry._table(self)
        peer = message.verification
        version = (
            table["versions"].get(peer.peer_binding_ref, {}).get(str(peer.peer_binding_revision))
        )
        if (
            peer.repository_id != self._origin[3]
            or table["repository_id"] != self._origin[3]
            or table["heads"].get(peer.peer_binding_ref) != peer.peer_binding_revision
            or version is None
            # Authenticated query bootstrap is explicitly read-only. It cannot
            # become an execution principal through this separate adapter.
            or "read_scope" in version
            or version["active"] is not True
            or version["verified_peer_ref"] != peer.verified_peer_ref
            or version["query_owner_id"] != message.query_owner_id
        ):
            raise Refusal("binding_denied")
        message.check()
        if DurableFeaturePeerRegistry._table(self) is not table:
            raise Refusal("binding_denied")


@dataclass(frozen=True, repr=False)
class StationGrant:
    station_id: str
    api_relay: int
    physical_relay: int
    mapping_revision: int

    def __post_init__(self) -> None:
        reference(self.station_id)
        counter(self.mapping_revision)
        if any(
            type(v) is not int or v not in {1, 2} for v in (self.api_relay, self.physical_relay)
        ):
            raise Refusal()


@dataclass(frozen=True, repr=False)
class RowGrant:
    source_line: int
    user_id: str | None
    revision: int | None
    origin_ref: str
    change_digest: str

    def __post_init__(self) -> None:
        if type(self.source_line) is not int or not 1 <= self.source_line <= 10000:
            raise Refusal()
        reference(self.origin_ref)
        if self.user_id is None:
            if self.revision is not None:
                raise Refusal()
        else:
            reference(self.user_id)
            counter(self.revision)
        if (
            type(self.change_digest) is not str
            or len(self.change_digest) != 64
            or any(c not in "0123456789abcdef" for c in self.change_digest)
        ):
            raise Refusal()


@dataclass(frozen=True, repr=False)
class FeaturePolicy:
    """Internal authenticated source result. Never decoded from action JSON.

    The source current port must bind this exact result, message, private input,
    revisions, complete scope and track consents to current Arx authority.
    """

    message: PeerMessage
    source_epoch: str
    complete: bool
    permissions: frozenset[str]
    stations: tuple[StationGrant, ...] = ()
    rows: tuple[RowGrant, ...] = ()
    private_input: Any = None


@dataclass(frozen=True, repr=False)
class FeatureLease:
    policy: FeaturePolicy
    private_input: Any
    _source: Any

    @property
    def message(self) -> PeerMessage:
        return self.policy.message

    def check(self) -> None:
        self._source.check(self)

    def require(self, permission: str) -> None:
        self.check()
        if permission not in self.policy.permissions:
            raise Refusal("Unauthorized")


class FeatureAuthoritySource:
    """Pins the real transport/source ports and rechecks them after every wait.

    Both `is_current` and registry checks must be safe synchronous reads from
    native CPU preparation threads. They must not call async APIs or block on IO.
    No cached allow verdict is retained in a lease.
    """

    def __init__(
        self,
        registry: FeaturePeerRegistry | DurableFeaturePeerRegistry,
        *,
        resolve: Callable[[PeerMessage], Awaitable[FeaturePolicy]],
        is_current: Callable[[PeerMessage, FeaturePolicy], bool],
    ) -> None:
        if (
            type(registry) not in {FeaturePeerRegistry, DurableFeaturePeerRegistry}
            or not callable(resolve)
            or not callable(is_current)
            or inspect.iscoroutinefunction(is_current)
        ):
            raise ValueError("explicit registry and current Arx source ports required")
        self.registry, self.resolve_policy, self.is_current = registry, resolve, is_current
        self._ports = registry, registry.check, resolve, is_current
        self._issued: dict[int, tuple[Any, ...]] = {}
        self.closed = False

    def _stable(self) -> None:
        if self.closed or not same_ports(
            self._ports, (self.registry, self.registry.check, self.resolve_policy, self.is_current)
        ):
            raise Refusal("Unauthorized")

    @staticmethod
    def _snapshot(policy: FeaturePolicy) -> tuple[Any, ...]:
        return (
            policy.message,
            policy.source_epoch,
            policy.complete,
            policy.permissions,
            tuple(
                (s.station_id, s.api_relay, s.physical_relay, s.mapping_revision)
                for s in policy.stations
            ),
            tuple(
                (r.source_line, r.user_id, r.revision, r.origin_ref, r.change_digest)
                for r in policy.rows
            ),
            freeze(policy.private_input),
        )

    async def admit(self, message: PeerMessage) -> FeatureLease:
        self._stable()
        if type(message) is not PeerMessage or type(message.request) is not FeatureRequest:
            raise Refusal("Unauthorized")
        self.registry.check(message)
        policy = await self.resolve_policy(message)
        self._stable()
        self.registry.check(message)
        if (
            type(policy) is not FeaturePolicy
            or policy.message is not message
            or policy.complete is not True
            or type(policy.permissions) is not frozenset
            or not policy.permissions
            or any(type(p) is not str for p in policy.permissions)
            or type(policy.stations) is not tuple
            or any(type(p) is not StationGrant for p in policy.stations)
            or len(set(policy.stations)) != len(policy.stations)
            or type(policy.rows) is not tuple
            or len(policy.rows) > 2000
            or any(type(p) is not RowGrant for p in policy.rows)
            or len({p.source_line for p in policy.rows}) != len(policy.rows)
            or len({p.change_digest for p in policy.rows}) != len(policy.rows)
        ):
            raise Refusal("Unauthorized")
        reference(policy.source_epoch)
        if len(self._issued) >= 4096:
            raise Refusal("Unauthorized")
        private = freeze(policy.private_input)
        lease = FeatureLease(policy, private, self)
        key = id(lease)
        self._issued[key] = (
            weakref.ref(lease, lambda _dead: self._issued.pop(key, None)),
            policy,
            private,
            self._snapshot(policy),
        )
        lease.check()
        return lease

    def check_owned(self, lease: FeatureLease) -> FeaturePolicy:
        """Original issuance/snapshot only; this grants no current permission."""
        self._stable()
        issued = self._issued.get(id(lease))
        if (
            type(lease) is not FeatureLease
            or issued is None
            or issued[0]() is not lease
            or lease._source is not self
            or lease.policy is not issued[1]
            or lease.private_input is not issued[2]
        ):
            raise Refusal("Unauthorized")
        policy = issued[1]

        def stable() -> None:
            if issued[3] != self._snapshot(policy):
                raise Refusal("Unauthorized")

        stable()
        return policy

    def check(self, lease: FeatureLease) -> None:
        policy = FeatureAuthoritySource.check_owned(self, lease)
        self.registry.check(policy.message)
        if self.is_current(policy.message, policy) is not True:
            raise Refusal("Unauthorized")
        self._stable()
        if FeatureAuthoritySource.check_owned(self, lease) is not policy:
            raise Refusal("Unauthorized")
        self.registry.check(policy.message)
