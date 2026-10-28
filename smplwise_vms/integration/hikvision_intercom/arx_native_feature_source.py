"""Original paired command -> native feature transport and current Arx policy.

Only VerifiedBridgePrincipal can stage signed data. Owner delegation provisions
a separate execution binding in the original durable registry; read pins are
never reused. resolve is async; all current checks are synchronous memory reads.
No default policy/consent, HA admin, fake User, relay map or external SDK exists.
"""

from __future__ import annotations

import asyncio
import json
import weakref
from dataclasses import dataclass, field
from uuid import uuid4

from homeassistant.core import HomeAssistant

from .access.arx_execution_authority import FeaturePolicy
from .access.arx_feature_execution_contract import FeatureRequest
from .access.arx_policy_snapshot import parse_snapshot
from .arx_policy_heads import NativePolicyHeads
from .bridge_command_auth import (
    BridgeCommandHost,
    VerifiedBridgePrincipal,
    completion_query_repository,
    host_for,
    retain_execution,
)
from .const import DOMAIN
from .trusted_actions.envelope import thaw
from .trusted_actions.peer_boundary import TransportVerification
from .trusted_actions.producer import AuthenticatedDescriptor
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.source_commit_guard import source_commit
from .trusted_actions.validation import Refusal

KEY = "arx_native_feature_source"
MAX_ACTIVE = 128
_OWNERS = weakref.WeakKeyDictionary()


@dataclass(eq=False, repr=False)
class _Record:
    binding: object
    snapshot: object
    encoded: str
    connection: object
    user: object
    peer: str
    binding_ref: str
    binding_revision: int
    feature: str
    execution_end: object
    descriptor: object = None
    verification: object = None
    policy: object = None
    preview: object = None


@dataclass(repr=False)
class _Owner:
    hass: object
    data: object
    namespace: dict
    manager: object
    registry: object
    repository: object
    bridge: object
    heads: object
    ports: tuple
    lock: object = field(default_factory=asyncio.Lock)
    active: dict = field(default_factory=dict)
    registry_owners: dict = field(default_factory=dict)
    pending: dict = field(default_factory=dict)
    issued: object = field(default_factory=weakref.WeakKeyDictionary)
    closed: bool = False


class NativeBridgeFeatureSource:
    def __init__(self, hass, registry, heads):
        from .trusted_actions.native_peer_source import NativePeerRegistry

        namespace = hass.data.get(DOMAIN)
        if (
            type(hass) is not HomeAssistant
            or type(namespace) is not dict
            or namespace.get(KEY) is not None
            or type(registry) is not NativePeerRegistry
            or type(heads) is not NativePolicyHeads
            or namespace.get("native_peer_registry") is not registry
        ):
            raise Refusal("authenticated_current_source_not_installed")
        bridge = host_for(hass)
        bridge_owner = BridgeCommandHost._owner(bridge)
        manager = namespace.get("access")
        if manager is not bridge_owner.manager or registry.repository is not manager.repository:
            raise Refusal("policy_binding_denied")
        registry._stable()
        NativePolicyHeads._owner(heads)
        _OWNERS[self] = _Owner(
            hass,
            hass.data,
            namespace,
            manager,
            registry,
            registry.repository,
            bridge,
            heads,
            (
                registry._stable,
                registry.provision,
                heads.head,
                heads.advance,
                bridge_owner.auth.clock,
                self.user,
                self.verify,
                self.is_current,
                self.clock,
                self.resolve,
                self.policy_current,
            ),
        )
        namespace[KEY] = self

    def _owner(self):
        owner = _OWNERS.get(self)
        if (
            owner is None
            or owner.closed
            or owner.hass.is_stopping
            or owner.hass.data is not owner.data
            or owner.data.get(DOMAIN) is not owner.namespace
            or owner.namespace.get(KEY) is not self
            or owner.namespace.get("access") is not owner.manager
            or owner.namespace.get("native_peer_registry") is not owner.registry
            or owner.manager.repository is not owner.repository
            or owner.manager._closed
            or owner.registry.repository is not owner.repository
            or host_for(owner.hass) is not owner.bridge
            or not same_ports(
                owner.ports,
                (
                    owner.registry._stable,
                    owner.registry.provision,
                    owner.heads.head,
                    owner.heads.advance,
                    BridgeCommandHost._owner(owner.bridge).auth.clock,
                    self.user,
                    self.verify,
                    self.is_current,
                    self.clock,
                    self.resolve,
                    self.policy_current,
                ),
            )
        ):
            raise Refusal("policy_binding_denied")
        owner.registry._stable()
        NativePolicyHeads._owner(owner.heads)
        return owner

    def clock(self):
        return NativeBridgeFeatureSource._owner(self).ports[4]()

    def _current(self, record, *, completion_query=None):
        owner = NativeBridgeFeatureSource._owner(self)
        repository = (
            record.binding.check()
            if completion_query is None
            else completion_query_repository(completion_query, record.binding)
        )
        snapshot = record.snapshot
        row = owner.registry._stable()
        version = row["versions"].get(record.binding_ref, {}).get(str(record.binding_revision))
        if (
            record.connection.user is not record.user
            or repository is not owner.repository
            or owner.active.get(snapshot.key) is not snapshot
            or owner.heads.head(snapshot.key) != snapshot.revision
            or NativeBridgeFeatureSource.clock(self).now >= snapshot.expires_at
            or row["heads"].get(record.binding_ref) != record.binding_revision
            or version is None
            or "read_scope" in version
            or version["active"] is not True
            or version["verified_peer_ref"] != record.peer
            or version["query_owner_id"] != record.user.id
        ):
            raise Refusal("policy_binding_denied")
        return owner

    async def stage(self, principal, parameters, connection):
        if type(principal) is not VerifiedBridgePrincipal:
            raise Refusal("Unauthorized")
        principal.check()
        if principal.command not in {
            "features/start",
            "features/prepare_media",
            "features/people_csv_preview",
        }:
            raise Refusal("policy_binding_denied")
        owner = NativeBridgeFeatureSource._owner(self)
        epoch, entry_id, user, actual_connection = principal.owner_key
        if (
            actual_connection is not connection
            or principal.repository is not owner.repository
            or type(parameters) is not dict
            or not {"request", "policy_snapshot"} <= set(parameters)
            or set(parameters) - {"request", "policy_snapshot", "subscription"}
            or parameters != principal.parameters
            or type(parameters["request"]) is not dict
            or "subscription" in parameters
            and (
                type(parameters["subscription"]) is not int
                or not 1 <= parameters["subscription"] <= 2**53 - 1
            )
        ):
            raise Refusal("policy_binding_denied")
        encoded = json.dumps(parameters["request"], ensure_ascii=False, allow_nan=False)
        now = NativeBridgeFeatureSource.clock(self).now
        request = FeatureRequest.parse(encoded, now)
        snapshot = parse_snapshot(
            parameters["policy_snapshot"],
            request=request,
            repository_id=owner.registry.repository_id,
            entry_id=entry_id,
            query_owner_id=user.id,
            now=now,
        )
        preview = None
        if principal.command == "features/people_csv_preview":
            from .access.arx_people_preview import prepare_people_csv

            def guard_preview():
                principal.check()
                FeatureRequest.parse(encoded, NativeBridgeFeatureSource.clock(self).now)
                if (
                    NativeBridgeFeatureSource._owner(self) is not owner
                    or owner.heads.head(snapshot.key) > snapshot.revision
                    or NativeBridgeFeatureSource.clock(self).now >= snapshot.expires_at
                ):
                    raise Refusal("policy_binding_denied")

            preview = await prepare_people_csv(owner.manager, request, snapshot, guard_preview)
            guard_preview()
            snapshot = parse_snapshot(
                preview["start"]["policy_snapshot"],
                request=request,
                repository_id=owner.registry.repository_id,
                entry_id=entry_id,
                query_owner_id=user.id,
                now=NativeBridgeFeatureSource.clock(self).now,
            )
        binding = retain_execution(principal, request._original().execution_end)
        peer, binding_ref = "arx-bridge:" + entry_id, "arx-execution:" + entry_id + ":" + user.id
        owner_key = epoch, entry_id, user, connection
        async with owner.lock:
            principal.check()
            NativeBridgeFeatureSource._owner(self)
            # Expiry already invalidates these policies. Free only the active
            # in-memory slots; durable revision heads and issued/owned leases
            # remain independently fenced, including failed native cleanup.
            current_time = NativeBridgeFeatureSource.clock(self).now
            for key, previous in tuple(owner.active.items()):
                if current_time >= previous.expires_at:
                    owner.active.pop(key)
            for pending_token, previous in tuple(owner.pending.items()):
                if current_time >= previous.execution_end:
                    owner.pending.pop(pending_token)
            current = owner.active.get(snapshot.key)
            if current is not None and current.revision == snapshot.revision:
                if current.payload != snapshot.payload:
                    raise Refusal("policy_revision_conflict")
                snapshot = current
            else:
                if snapshot.key not in owner.active and len(owner.active) >= MAX_ACTIVE:
                    raise Refusal("policy_source_capacity")
                await owner.heads.advance(snapshot, now=now, guard=principal.check)
                principal.check()
                NativeBridgeFeatureSource._owner(self)
            table = owner.registry._stable()
            head = table["heads"].get(binding_ref, 0)
            if owner.registry_owners.get(binding_ref) != owner_key:
                # Genuine native owner delegation, distinct from the read-only
                # bootstrap. No transport_entry_id/read_scope is provisioned.
                with source_commit(owner.repository, principal.check):
                    head = await owner.registry.provision(
                        binding_ref,
                        expected_revision=head,
                        verified_peer_ref=peer,
                        query_owner_id=user.id,
                        active=True,
                    )
                principal.check()
                NativeBridgeFeatureSource._owner(self)
                owner.registry_owners[binding_ref] = owner_key
            if snapshot.payload["active"] is not True:
                owner.active.pop(snapshot.key, None)
                raise Refusal("policy_revoked")
            owner.active[snapshot.key] = snapshot
            # Expired issued DTOs may still be retained by original cleanup
            # owners. Keep their identity seals while counting only finite
            # executions still within their original validated deadline.
            live_issued = sum(
                current_time < previous.execution_end for previous in owner.issued.values()
            )
            if len(owner.pending) + live_issued >= MAX_ACTIVE:
                raise Refusal("policy_source_capacity")
            record = _Record(
                binding,
                snapshot,
                encoded,
                connection,
                user,
                peer,
                binding_ref,
                head,
                request.get("feature"),
                request._original().execution_end,
                preview=preview,
            )
            NativeBridgeFeatureSource._current(self, record)
            token = uuid4().hex
            owner.pending[token] = record
            return token

    def preview_publication(self, token):
        """Recheck original current source immediately before returning data."""
        owner = NativeBridgeFeatureSource._owner(self)
        record = owner.pending.get(token)
        if record is None or record.preview is None:
            raise Refusal("policy_binding_denied")
        NativeBridgeFeatureSource._current(self, record)
        FeatureRequest.parse(record.encoded, NativeBridgeFeatureSource.clock(self).now)
        if owner.repository.bulk_stamp() != record.preview["review_stamp"] or (
            owner.manager.bulk.rules_stamp() != record.preview["rules_stamp"]
        ):
            raise Refusal("bulk_review_stale")
        return record.preview

    def discard(self, token):
        owner = _OWNERS.get(self)
        if owner is not None:
            owner.pending.pop(token, None)

    def user(self, connection):
        owner = NativeBridgeFeatureSource._owner(self)
        # Select the original subject only. verify/is_current perform the full
        # origin/policy/registry checks before admission and after every wait.
        # Do not recursively repeat those checks just to read the same subject.
        # This does not cache an allow verdict or confer execution authority.
        for record in (*owner.pending.values(), *owner.issued.values()):
            if (
                record.connection is connection
                and connection.user is record.user
                and record.user.is_active is True
            ):
                return record.user
        raise Refusal("Unauthorized")

    async def verify(self, token, connection):
        owner = NativeBridgeFeatureSource._owner(self)
        record = owner.pending.pop(token, None) if type(token) is str else None
        if record is None or record.connection is not connection:
            raise Refusal("Unauthorized")
        NativeBridgeFeatureSource._current(self, record)
        descriptor = AuthenticatedDescriptor(
            record.encoded,
            record.snapshot.payload["source_epoch"],
            record.snapshot.payload["actor_session_active"],
        )
        verified = TransportVerification(
            descriptor,
            owner.registry.repository_id,
            record.peer,
            record.binding_ref,
            record.binding_revision,
        )
        record.descriptor, record.verification = descriptor, weakref.ref(verified)
        owner.issued[verified] = record
        return verified

    def is_current(self, connection, verified):
        record = NativeBridgeFeatureSource._owner(self).issued.get(verified)
        if (
            record is None
            or record.verification() is not verified
            or record.connection is not connection
            or verified.descriptor is not record.descriptor
            or (
                verified.repository_id,
                verified.verified_peer_ref,
                verified.peer_binding_ref,
                verified.peer_binding_revision,
            )
            != (
                NativeBridgeFeatureSource._owner(self).registry.repository_id,
                record.peer,
                record.binding_ref,
                record.binding_revision,
            )
        ):
            return False
        NativeBridgeFeatureSource._current(self, record)
        return True

    def check_completion(self, lease, principal):
        """Current original policy and fresh query, without an effect lease."""
        from . import arx_preview_features
        from .access.arx_execution_authority import FeatureAuthoritySource, FeatureLease

        if type(lease) is not FeatureLease or type(lease._source) is not FeatureAuthoritySource:
            raise Refusal("Unauthorized")
        policy = FeatureAuthoritySource.check_owned(lease._source, lease)
        owner = NativeBridgeFeatureSource._owner(self)
        message = policy.message
        record = owner.issued.get(message.verification)
        if (
            record is None
            or record.policy is None
            or record.policy() is not policy
            or record.verification() is not message.verification
            or message.verification.descriptor is not record.descriptor
            or message._connection is not record.connection
            or thaw(message.request.descriptor) != json.loads(record.encoded)
            or message.request._original().gate_owner is not arx_preview_features.PLAN_FLAGS
            or arx_preview_features.PLAN_FLAGS.get(record.feature) is not True
        ):
            raise Refusal("policy_binding_denied")
        NativeBridgeFeatureSource._current(self, record, completion_query=principal)
        FeatureAuthoritySource.check_owned(lease._source, lease)

    async def resolve(self, message):
        record = NativeBridgeFeatureSource._owner(self).issued.get(message.verification)
        if record is None or not self.is_current(message._connection, message.verification):
            raise Refusal("Unauthorized")
        policy = FeaturePolicy(
            message,
            record.snapshot.payload["source_epoch"],
            True,
            record.snapshot.permissions,
            record.snapshot.stations,
            record.snapshot.rows,
            thaw(record.snapshot.payload["private_input"]),
        )
        record.policy = weakref.ref(policy)
        NativeBridgeFeatureSource._current(self, record)
        return policy

    def policy_current(self, message, policy):
        record = NativeBridgeFeatureSource._owner(self).issued.get(message.verification)
        return bool(
            record is not None
            and record.policy is not None
            and record.policy() is policy
            and policy.message is message
            and self.is_current(message._connection, message.verification)
        )

    def close(self):
        owner = _OWNERS.get(self)
        if owner is not None:
            owner.closed = True
            owner.pending.clear()
            owner.issued.clear()
            owner.active.clear()
            owner.registry_owners.clear()
            owner.heads.retire()
            if owner.namespace.get(KEY) is self:
                owner.namespace.pop(KEY)
            _OWNERS.pop(self, None)

    def current_features(self) -> frozenset[str]:
        """Current admitted source observations, not a build/installed marker."""
        owner = NativeBridgeFeatureSource._owner(self)
        current = set()
        for record in (*owner.pending.values(), *owner.issued.values()):
            try:
                NativeBridgeFeatureSource._current(self, record)
            except Refusal:
                continue
            current.add(record.feature)
        return frozenset(current)
