"""Pairing-native W1 producer over the existing person/CAS/receipt engine.

The service principal is original. Arx's current actor decision is an attestation
inside that authenticated command, never a JSON-created service or HA User.
Only public descriptor references enter the original durable peer receipt.
"""

from __future__ import annotations

import json
import weakref
from dataclasses import dataclass
from uuid import uuid4

import voluptuous as vol
from homeassistant.components import websocket_api

from .access import native_peer_storage as storage
from .bridge_command_auth import VerifiedBridgePrincipal, host_for, send_bridge_result
from .const import DOMAIN
from .trusted_actions.envelope import Request, thaw
from .trusted_actions.native_peer_source import NativePeerRegistry
from .trusted_actions.peer_boundary import PeerBoundary, TransportVerification
from .trusted_actions.producer import AuthenticatedDescriptor
from .trusted_actions.source_commit_guard import source_commit
from .trusted_actions.validation import Refusal, reference

KEY = "native_peer_writes"
COMMAND = "peer_writes/source_v1"
CONTRACT = "wiskey-native-bridge-write.v1"
ACTIONS = frozenset(
    {
        "users/create",
        "users/update",
        "users/set_active",
        "users/archive",
        "users/unarchive",
        "users/temporary_cancel",
        "users/delete",
        "cards/add",
        "cards/remove",
    }
)
_REGISTERED = weakref.WeakKeyDictionary()


@dataclass(eq=False, repr=False)
class _Record:
    principal: object
    descriptor: object
    binding: dict
    encoded: str
    human_active: bool
    create_origin: str | None
    verified: object = None
    message: object = None
    metadata: object = None
    attached: bool = False
    closed: bool = False


class NativeWriteBoundary(PeerBoundary):
    def __init__(self, source):
        self.source = source
        super().__init__(
            verify=source.verify,
            is_current=source.is_current,
            clock=source.clock,
            repository_id=source.registry.repository_id,
        )

    def _user(self, connection):
        return self.source.subject(connection)

    def _stable(self):
        super()._stable()
        if type(self.source) is not NativePeerWriteSource or self.source.boundary is not self:
            raise Refusal("Unauthorized")
        self.source.stable()


class NativePeerWriteSource:
    def __init__(self, hass, registry):
        if type(registry) is not NativePeerRegistry:
            raise ValueError("Original selected native registry required")
        self.hass, self.namespace, self.bridge = hass, hass.data[DOMAIN], host_for(hass)
        if self.namespace.get(KEY) is not None:
            raise ValueError("Original native write source already installed")
        self.registry, self.manager = registry, self.namespace["access"]
        self.repository = self.manager.repository
        self.bindings, self.pending = {}, {}
        self.issued = weakref.WeakKeyDictionary()
        self.boundary = NativeWriteBoundary(self)
        self.roots = (
            self.registry,
            self.manager,
            self.repository,
            self.bridge,
            self.bindings,
            self.pending,
            self.issued,
            self.boundary,
        )
        self.namespace[KEY] = self

    def stable(self):
        if (
            self.hass.is_stopping
            or self.hass.data.get(DOMAIN) is not self.namespace
            or self.namespace.get(KEY) is not self
            or self.namespace.get("native_peer_registry") is not self.registry
            or self.namespace.get("access") is not self.manager
            or self.manager.repository is not self.repository
            or self.manager._closed
            or self.registry.repository is not self.repository
            or host_for(self.hass) is not self.bridge
            or self.boundary.source is not self
            or any(
                left is not right
                for left, right in zip(
                    self.roots,
                    (
                        self.registry,
                        self.manager,
                        self.repository,
                        self.bridge,
                        self.bindings,
                        self.pending,
                        self.issued,
                        self.boundary,
                    ),
                    strict=True,
                )
            )
        ):
            raise Refusal("native_write_source_unavailable")
        NativePeerRegistry._stable(self.registry)

    def clock(self):
        from .bridge_command_auth import BridgeCommandHost

        self.stable()
        return BridgeCommandHost._owner(self.bridge).auth.clock()

    async def source(self, principal):
        self.stable()
        if type(principal) is not VerifiedBridgePrincipal:
            raise Refusal("Unauthorized")
        principal.check()
        if principal.command != COMMAND or principal.parameters != {}:
            raise Refusal("invalid_fields")
        epoch, entry_id, subject, _connection = principal.owner_key
        ref = "arx-write:" + entry_id + ":" + subject.id
        old = self.bindings.get(ref)
        if old is None or old[0] is not epoch:
            head = NativePeerRegistry._stable(self.registry)["heads"].get(ref, 0)
            with source_commit(self.repository, principal.check):
                revision = await self.registry.provision(
                    ref,
                    expected_revision=head,
                    verified_peer_ref="smplwise_bridge:" + entry_id,
                    query_owner_id=subject.id,
                    active=True,
                    historical_read=True,
                )
            principal.check()
            self.stable()
            old = (
                epoch,
                {
                    "repository_id": self.registry.repository_id,
                    "verified_peer_ref": "smplwise_bridge:" + entry_id,
                    "peer_binding_ref": ref,
                    "peer_binding_revision": revision,
                    "query_owner_id": subject.id,
                    "descriptor_epoch": principal.descriptor_epoch,
                },
            )
            self.bindings[ref] = old
        principal.check()
        return {
            "schema_version": 1,
            "contract": CONTRACT,
            **old[1],
            "commands": sorted(ACTIONS),
            "request_schema_prefix": "urn:wiskey:native-bridge:",
            "request_schema_revision": "1",
            "delete_person_revision": "last_native_revision",
            "replay_available": False,
        }

    def subject(self, connection):
        self.stable()
        for row in (*self.pending.values(), *self.issued.values()):
            try:
                if not row.closed and row.principal.owner_key[3] is connection:
                    row.principal.check()
                    return row.principal.owner_key[2]
            except Refusal:
                continue
        raise Refusal("Unauthorized")

    def current(self, row):
        self.stable()
        if row.closed:
            raise Refusal("binding_denied")
        row.principal.check()
        epoch, entry_id, subject, _connection = row.principal.owner_key
        ref = row.binding["peer_binding_ref"]
        own = self.bindings.get(ref)
        if (
            own is None
            or own[0] is not epoch
            or own[1] != row.binding
            or row.binding["descriptor_epoch"] != row.principal.descriptor_epoch
            or row.binding["query_owner_id"] != subject.id
            or row.binding["verified_peer_ref"] != "smplwise_bridge:" + entry_id
        ):
            raise Refusal("binding_denied")
        table = NativePeerRegistry._stable(self.registry)
        revision = row.binding["peer_binding_revision"]
        stored = table["versions"].get(ref, {}).get(str(revision))
        if (
            table["heads"].get(ref) != revision
            or stored is None
            or stored["active"] is not True
            or "read_scope" in stored
            or stored["verified_peer_ref"] != row.binding["verified_peer_ref"]
            or stored["query_owner_id"] != subject.id
        ):
            raise Refusal("binding_denied")
        row.descriptor.recheck(self.clock().now, frozenset({"rev1"}))

    async def verify(self, token, connection):
        row = self.pending.pop(token, None)
        if row is None or row.principal.owner_key[3] is not connection:
            raise Refusal("Unauthorized")
        self.current(row)
        descriptor = AuthenticatedDescriptor(
            row.encoded, row.binding["descriptor_epoch"], row.human_active
        )
        verified = TransportVerification(
            descriptor,
            self.registry.repository_id,
            row.binding["verified_peer_ref"],
            row.binding["peer_binding_ref"],
            row.binding["peer_binding_revision"],
        )
        self.issued[verified] = row
        row.verified = weakref.ref(verified)
        return verified

    def is_current(self, connection, verified):
        row = self.issued.get(verified)
        if (
            row is None
            or row.verified() is not verified
            or row.principal.owner_key[3] is not connection
        ):
            return False
        try:
            self.current(row)
        except Refusal:
            return False
        return True

    async def stage(self, principal, metadata, parameters):
        self.stable()
        if type(principal) is not VerifiedBridgePrincipal or principal.command not in ACTIONS:
            raise Refusal("native_write_action_unsupported")
        principal.check()
        original_parameters = principal.parameters
        if (
            metadata != original_parameters.pop("peer_write", None)
            or parameters != original_parameters
        ):
            raise Refusal("Unauthorized")
        if (
            type(metadata) is not dict
            or set(metadata)
            != {
                "schema_version",
                "descriptor_epoch",
                "peer_binding_ref",
                "peer_binding_revision",
                "descriptor",
                "actor_session_active",
                "create_origin_ref",
            }
            or type(metadata["schema_version"]) is not int
            or metadata["schema_version"] != 1
            or type(metadata["peer_binding_revision"]) is not int
            or type(metadata["actor_session_active"]) is not bool
        ):
            raise Refusal("invalid_fields")
        ref = reference(metadata["peer_binding_ref"])
        own = self.bindings.get(ref)
        if own is None:
            raise Refusal("native_write_source_not_observed")
        if (
            metadata["descriptor_epoch"] != own[1]["descriptor_epoch"]
            or metadata["peer_binding_revision"] != own[1]["peer_binding_revision"]
        ):
            raise Refusal("binding_denied")
        encoded = json.dumps(
            metadata["descriptor"],
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            allow_nan=False,
        )
        request = Request.parse(encoded, self.clock().now)
        actor = thaw(request.get("actor"))
        asserted_actor = principal.parameters.get("actor")
        actor_id = actor["user_id"] if actor["kind"] == "human" else actor["automation_id"]
        origin = metadata["create_origin_ref"]
        target = origin if principal.command == "users/create" else parameters.get("user_id")
        operation = request.get("operation")
        if (
            request.get("action") != principal.command
            or type(asserted_actor) is not dict
            or asserted_actor.get("id") != actor_id
            or actor["kind"] == "human"
            and metadata["actor_session_active"] is not True
            or request.get("target")["logical_target_id"] != target
            or request.get("target")["binding_revision"] != own[1]["peer_binding_revision"]
            or operation["request_schema_id"]
            != "urn:wiskey:native-bridge:" + principal.command.replace("/", ":")
            or operation["request_schema_revision"] != "1"
            or operation["parameter_transport"] != "agreed_sensitive_opaque_reference"
            or principal.command != "users/create"
            and origin is not None
        ):
            raise Refusal("binding_denied")
        if principal.command == "users/create":
            reference(origin)
        row = _Record(
            principal, request, dict(own[1]), encoded, metadata["actor_session_active"], origin
        )
        self.current(row)
        token = uuid4().hex
        self.pending[token] = row
        try:
            message = await self.boundary.verify(token, principal.owner_key[3])
        finally:
            self.pending.pop(token, None)
        row.message = message
        row.metadata = storage.original(message)
        return row

    def attach(self, row, before, candidate, result):
        self.current(row)
        row.message.check()
        self.registry.check(row.message)
        if row.attached:
            raise Refusal("native_write_multiple_commits")
        storage.attach(
            before,
            candidate,
            result,
            metadata=row.metadata,
            source_epoch=row.binding["descriptor_epoch"],
            create_origin=row.create_origin,
        )
        row.attached = True
        self.current(row)

    def receipt(self, row):
        self.current(row)
        row.message.check()
        if not row.attached:
            raise Refusal("native_commit_not_observed")
        result = storage.find(NativePeerRegistry._stable(self.registry), row.metadata)
        if result is None:
            raise Refusal("native_commit_not_observed")
        self.current(row)
        return result

    def release(self, row):
        row.closed = True
        if row.verified is not None:
            verified = row.verified()
            if verified is not None:
                self.issued.pop(verified, None)
        row.message = None


def source_for(hass):
    source = hass.data[DOMAIN].get(KEY)
    if type(source) is not NativePeerWriteSource:
        raise Refusal("native_write_source_unavailable")
    source.stable()
    return source


@websocket_api.websocket_command(
    vol.All(vol.Schema({"type": DOMAIN + "/" + COMMAND}, extra=vol.ALLOW_EXTRA))
)
@websocket_api.async_response
async def source_handler(hass, connection, message):
    try:
        principal = await host_for(hass).admit(connection, message, COMMAND)
        result = await source_for(hass).source(principal)
        principal.check()
        send_bridge_result(connection, message["id"], result)
    except Refusal as error:
        connection.send_error(message["id"], error.code, "Native write source refused")


def setup_native_peer_writes(hass):
    registry = hass.data[DOMAIN].get("native_peer_registry")
    if type(registry) is NativePeerRegistry:
        NativePeerWriteSource(hass, registry)
    websocket_api.async_register_command(hass, source_handler)
    _REGISTERED[hass] = hass.data[websocket_api.DOMAIN][DOMAIN + "/" + COMMAND]


def registered_native_peer_writes(hass):
    original = _REGISTERED.get(hass)
    return (
        (COMMAND,)
        if original is not None
        and hass.data.get(websocket_api.DOMAIN, {}).get(DOMAIN + "/" + COMMAND) is original
        else ()
    )
