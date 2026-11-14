"""Public authenticated peer reads using the already installed Arx pairing.

The ordinary panel/admin path is unchanged. This separate, explicit service
scope never constructs an HA user/connection and never invokes private dispatch.
Arx remains responsible for its actor RBAC before issuing a signed service read.
"""

from __future__ import annotations

import weakref
from copy import deepcopy
from datetime import timedelta
from uuid import UUID

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.components.http import HomeAssistantRequest
from homeassistant.core import HomeAssistant, callback

from . import arx_preview_features as features
from .access import native_peer_storage as storage
from .access.manager import AccessManager
from .access.models import AccessError
from .const import DOMAIN
from .trusted_actions.envelope import thaw
from .trusted_actions.existing_bridge_auth import ExistingBridgeAuthenticator, canonical_body
from .trusted_actions.native_peer_source import NativePeerRegistry
from .trusted_actions.peer_boundary import peer_revision
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.source_commit_guard import source_commit
from .trusted_actions.validation import Refusal, aware, reference, strict_json

BRIDGE_KIND = "wiskey-peer-query.v1"
READ_SCOPE = "central_capture_person_commit"
LOOKUP = "peer_bindings/get"
HISTORY = "peer_bindings/history"
RESOLVE = "peer_receipts/resolve"
READBACK = "users/access_state_v2"
PROTOCOL = "peer_protocol/get"
IDENTITY = "peer_identity/get"
HTTP_PROTOCOL = "wiskey-peer-http.v1"
HTTP_IDENTITY = "wiskey-peer-http-identity.v1"
_HOSTS = weakref.WeakKeyDictionary()
_REGISTERED = weakref.WeakKeyDictionary()


def repository_id(value):
    if type(value) is not str:
        raise Refusal("binding_denied")
    try:
        if str(UUID(value)) != value:
            raise ValueError
    except ValueError:
        raise Refusal("binding_denied") from None
    return value


class PeerQueryBridge:
    def __init__(self, hass: HomeAssistant, registry: NativePeerRegistry):
        if type(hass) is not HomeAssistant or type(registry) is not NativePeerRegistry:
            raise ValueError("actual Home Assistant and native registry required")
        namespace = hass.data[DOMAIN]
        manager = namespace["access"]
        if (
            type(manager) is not AccessManager
            or manager.repository is not registry.repository
            or namespace.get("peer_bridge") is not None
        ):
            raise ValueError("same original native access repository required")
        repository_id(registry.repository_id)
        authenticator = ExistingBridgeAuthenticator(hass)
        _HOSTS[self] = (
            hass,
            hass.data,
            namespace,
            manager,
            registry,
            registry.repository,
            registry._roots,
            registry.repository._lock,
            registry.repository._save,
            authenticator,
            (registry.lookup, registry.provision),
            (authenticator.verify, authenticator.check, authenticator.refresh, authenticator.clock),
        )
        namespace["peer_bridge"] = self

    def _owner(self):
        owner = _HOSTS.get(self)
        if owner is None:
            raise Refusal("Unauthorized")
        (
            hass,
            data,
            namespace,
            manager,
            registry,
            repo,
            roots,
            lock,
            save,
            auth,
            ports,
            auth_ports,
        ) = owner
        if (
            hass.data is not data
            or data.get(DOMAIN) is not namespace
            or namespace.get("peer_bridge") is not self
            or namespace.get("access") is not manager
            or manager.repository is not repo
            or getattr(manager, "_closed", True) is not False
            or registry.repository is not repo
            or registry._roots is not roots
            or repo._lock is not lock
            or repo._save is not save
            or not same_ports(ports, (registry.lookup, registry.provision))
            or not same_ports(auth_ports, (auth.verify, auth.check, auth.refresh, auth.clock))
        ):
            raise Refusal("binding_denied")
        NativePeerRegistry._stable(registry)
        return owner

    @property
    def authenticator(self):
        """Shared pairing authenticator, not an execution-policy/grant provider."""
        return PeerQueryBridge._owner(self)[9]

    def _guard(self, proof):
        owner = PeerQueryBridge._owner(self)
        owner[9].check(proof)
        body = proof.body
        if (
            set(body)
            != {"kind", "command", "query_owner_id", "issued_at", "expires_at", "parameters"}
            or body["kind"] != BRIDGE_KIND
            or body["query_owner_id"] != proof.query_owner_id
            or body["command"] not in {LOOKUP, HISTORY, RESOLVE, READBACK, PROTOCOL}
        ):
            raise Refusal("Unauthorized")
        issued, expires = aware(body["issued_at"]), aware(body["expires_at"])
        now = owner[9].clock().now
        if (
            not timedelta(0) < expires - issued <= timedelta(seconds=15)
            or not issued <= now + timedelta(seconds=2)
            or now >= expires
        ):
            raise Refusal("Unauthorized")
        PeerQueryBridge._owner(self)

    async def _admit(self, connection, msg, command):
        owner = PeerQueryBridge._owner(self)
        if type(msg) is not dict:
            raise Refusal("invalid_fields")
        proof = await owner[9].verify(msg.get("bridge"), connection)
        PeerQueryBridge._guard(self, proof)
        if proof.body["command"] != command:
            raise Refusal("Unauthorized")
        if (
            type(msg.get("id")) is not int
            or not 1 <= msg["id"] <= 2**53 - 1
            or msg.get("type") != f"{DOMAIN}/{command}"
        ):
            raise Refusal("invalid_fields")
        return proof

    @staticmethod
    def _binding_ref(proof):
        # This identifies the actual authenticated installed transport and user,
        # never the actor/request/op fields supplied by a caller.
        return reference(f"bridge:{proof.entry_id}:{proof.query_owner_id}")

    def _row(self, proof, ref, revision, *, active=False):
        PeerQueryBridge._guard(self, proof)
        registry = PeerQueryBridge._owner(self)[4]
        row = registry.lookup(ref, revision, query_owner_id=proof.query_owner_id)
        private = NativePeerRegistry._stable(registry)["versions"][ref][str(revision)]
        if (
            private.get("read_scope") != READ_SCOPE
            or private.get("transport_entry_id") != proof.entry_id
            or row["verified_peer_ref"] != f"smplwise_bridge:{proof.entry_id}"
            or active
            and row["state"] != "active"
        ):
            raise Refusal("binding_denied")
        repository_id(row["repository_id"])
        PeerQueryBridge._guard(self, proof)
        return row

    async def _execute(self, connection, msg, command):
        proof = await PeerQueryBridge._admit(self, connection, msg, command)
        method = {
            LOOKUP: PeerQueryBridge._lookup_body,
            HISTORY: PeerQueryBridge._history_body,
            PROTOCOL: PeerQueryBridge._protocol_body,
            READBACK: PeerQueryBridge._readback_body,
            RESOLVE: PeerQueryBridge._resolve_body,
        }[command]
        result = await method(self, proof, msg)
        PeerQueryBridge._guard(self, proof)
        return result, proof

    async def lookup(self, connection, msg):
        return (await PeerQueryBridge._execute(self, connection, msg, LOOKUP))[0]

    async def history(self, connection, msg):
        return (await PeerQueryBridge._execute(self, connection, msg, HISTORY))[0]

    async def protocol(self, connection, msg):
        return (await PeerQueryBridge._execute(self, connection, msg, PROTOCOL))[0]

    async def readback(self, connection, msg):
        return (await PeerQueryBridge._execute(self, connection, msg, READBACK))[0]

    async def resolve(self, connection, msg):
        return (await PeerQueryBridge._execute(self, connection, msg, RESOLVE))[0]

    async def _lookup_body(self, proof, msg):
        if set(msg) != {"id", "type", "bridge"}:
            raise Refusal("invalid_fields")
        params = thaw(proof.body["parameters"])
        owner = PeerQueryBridge._owner(self)
        registry, repo = owner[4:6]
        if (
            params == {"initialize": True, "expected_revision": 0}
            and type(params.get("expected_revision")) is int
            and params.get("initialize") is True
        ):
            ref = PeerQueryBridge._binding_ref(proof)
            table = NativePeerRegistry._stable(registry)
            head = table["heads"].get(ref)
            if head is None:

                def guard():
                    PeerQueryBridge._guard(self, proof)

                with source_commit(repo, guard):
                    await registry.provision(
                        ref,
                        expected_revision=0,
                        verified_peer_ref=f"smplwise_bridge:{proof.entry_id}",
                        query_owner_id=proof.query_owner_id,
                        active=True,
                        historical_read=True,
                        transport_entry_id=proof.entry_id,
                    )
                await owner[9].refresh(proof)
                head = 1
            # Bootstrap cannot silently adopt a rotated/revoked generation.
            if head != 1:
                raise Refusal("binding_denied")
            result = PeerQueryBridge._row(self, proof, ref, head, active=True)
        else:
            result = await PeerQueryBridge._lookup_existing(self, proof, params)
        PeerQueryBridge._guard(self, proof)
        return result

    async def _lookup_existing(self, proof, params, *, history=False):
        if type(params) is not dict or set(params) != {"peer_binding_ref", "peer_binding_revision"}:
            raise Refusal("invalid_fields")
        ref = reference(params["peer_binding_ref"])
        revision = peer_revision(params["peer_binding_revision"])
        owner = PeerQueryBridge._owner(self)
        async with owner[5]._lock:
            result = PeerQueryBridge._row(self, proof, ref, revision)
            snapshot = NativePeerRegistry._stable(owner[4])
            if history:
                previous = max(
                    (peer_revision(int(v)) for v in snapshot["versions"][ref] if int(v) < revision),
                    default=None,
                )
                result = {
                    "schema_version": 1,
                    "binding": result,
                    "predecessor": None
                    if previous is None
                    else {"peer_binding_ref": ref, "peer_binding_revision": previous},
                }
        await owner[9].refresh(proof)
        PeerQueryBridge._row(self, proof, ref, revision)
        if NativePeerRegistry._stable(owner[4]) is not snapshot:
            raise Refusal("binding_denied")
        return result

    async def _history_body(self, proof, msg):
        """Versioned explicit backlinks without extending the closed draft1 row."""
        if set(msg) != {"id", "type", "bridge"}:
            raise Refusal("invalid_fields")
        return await PeerQueryBridge._lookup_existing(
            self, proof, thaw(proof.body["parameters"]), history=True
        )

    async def _protocol_body(self, proof, msg):
        """Separate closed negotiation; no extension to the frozen v2 result."""
        if set(msg) != {"id", "type", "bridge"} or thaw(proof.body["parameters"]) != {}:
            raise Refusal("invalid_fields")
        from .access.person_readback import (
            V2_MAX_ENVELOPE_BYTES,
            V2_MAX_REVISION,
            V2_MAX_ROWS,
        )
        from .websocket import registered_commands

        owner = PeerQueryBridge._owner(self)
        hass = owner[0]
        commands = list(registered_peer_commands(hass))
        available = READBACK in registered_commands(hass) and features.enabled(READBACK)
        if available:
            commands.append(READBACK)
        result = {
            "schema_version": 1,
            "protocol": BRIDGE_KIND,
            "commands": sorted(commands),
            "readback_v2": {
                "schema_version": 2,
                "closed": True,
                "max_revision": V2_MAX_REVISION,
                "max_assignments": V2_MAX_ROWS,
                "max_queue_ids": V2_MAX_ROWS,
                "max_envelope_bytes": V2_MAX_ENVELOPE_BYTES,
            }
            if available
            else None,
        }
        PeerQueryBridge._guard(self, proof)
        return result

    async def _readback_body(self, proof, msg):
        if not {"id", "type", "bridge", "user_id", "revision"} <= set(msg) or set(msg) - {
            "id",
            "type",
            "bridge",
            "user_id",
            "revision",
            "api_contract",
        }:
            raise Refusal("invalid_fields")
        params = thaw(proof.body["parameters"])
        if (
            type(params) is not dict
            or set(params) != {"user_id", "revision", "peer_binding_ref", "peer_binding_revision"}
            or params["user_id"] != msg["user_id"]
            or type(params["revision"]) is not int
            or params["revision"] != msg["revision"]
        ):
            raise Refusal("invalid_fields")
        from .access.person_readback import validate_v2_envelope, validate_v2_request

        validate_v2_request(msg["user_id"], msg["revision"])
        ref, revision = (
            reference(params["peer_binding_ref"]),
            peer_revision(params["peer_binding_revision"]),
        )
        owner = PeerQueryBridge._owner(self)
        read = owner[5].async_person_access_state_v2
        snapshot = []

        def current():
            PeerQueryBridge._row(self, proof, ref, revision, active=True)
            if not features.enabled(READBACK) or not same_ports(
                (read,), (owner[5].async_person_access_state_v2,)
            ):
                raise AccessError("readback_unavailable")

        current()

        def read_guard():
            current()
            snapshot[:] = [owner[5]._state]

        result = await read(msg["user_id"], revision=msg["revision"], guard=read_guard)
        await owner[9].refresh(proof)
        current()
        if len(snapshot) != 1 or owner[5]._state is not snapshot[0]:
            raise AccessError("readback_unavailable")
        validate_v2_envelope({"id": msg["id"], "type": "result", "success": True, "result": result})
        current()
        return result

    async def _resolve_body(self, proof, msg):
        """Exact original receipt read only. UNKNOWN never submits a mutation."""
        if set(msg) != {"id", "type", "bridge"}:
            raise Refusal("invalid_fields")
        params = thaw(proof.body["parameters"])
        if type(params) is not dict or set(params) != {
            "peer_binding_ref",
            "peer_binding_revision",
            "original",
        }:
            raise Refusal("invalid_fields")
        ref, revision = (
            reference(params["peer_binding_ref"]),
            peer_revision(params["peer_binding_revision"]),
        )
        original = params["original"]
        storage.validate_original(original)
        peer_revision(original["peer_binding_revision"])
        owner = PeerQueryBridge._owner(self)
        async with owner[5]._lock:
            current = PeerQueryBridge._row(self, proof, ref, revision, active=True)
            table = NativePeerRegistry._stable(owner[4])
            history = (
                table["versions"]
                .get(original["peer_binding_ref"], {})
                .get(str(original["peer_binding_revision"]))
            )
            if (
                original["repository_id"] != current["repository_id"]
                or original["verified_peer_ref"] != current["verified_peer_ref"]
                or original["query_owner_id"] != proof.query_owner_id
                or history is None
                or history["historical_read"] is not True
                or history["verified_peer_ref"] != original["verified_peer_ref"]
                or history["query_owner_id"] != original["query_owner_id"]
            ):
                raise Refusal("binding_denied")
            result = deepcopy(storage.find(table, original))
        await owner[9].refresh(proof)
        PeerQueryBridge._row(self, proof, ref, revision, active=True)
        # A changed source during the auth await cannot publish the old result.
        if NativePeerRegistry._stable(owner[4]) is not table:
            raise Refusal("binding_denied")
        PeerQueryBridge._guard(self, proof)
        return {
            "schema_version": 1,
            "state": "found" if result is not None else "unknown",
            "receipt": result,
        }

    def _identity_guard(self, proof):
        owner = PeerQueryBridge._owner(self)
        ExistingBridgeAuthenticator.check(owner[9], proof)
        body = proof.body
        if (
            set(body) != {"kind", "command", "issued_at", "expires_at", "parameters"}
            or body["kind"] != HTTP_IDENTITY
            or body["command"] != IDENTITY
            or thaw(body["parameters"]) != {}
        ):
            raise Refusal("Unauthorized")
        issued, expires = aware(body["issued_at"]), aware(body["expires_at"])
        now = ExistingBridgeAuthenticator.clock(owner[9]).now
        if (
            not timedelta(0) < expires - issued <= timedelta(seconds=15)
            or not issued <= now + timedelta(seconds=2)
            or now >= expires
        ):
            raise Refusal("Unauthorized")

    async def http_query(self, request, msg):
        """Existing Supervisor/private HA HTTP, with a separately signed wrapper."""
        from .access.person_readback import validate_v2_envelope
        from .api_contract import validate_client

        if type(request) is not HomeAssistantRequest:
            raise Refusal("Unauthorized")
        original_message = msg
        original_bytes = canonical_body(msg)
        if len(original_bytes) > 65_536:
            raise Refusal("request_too_large")
        # Own a strict copy before authentication/storage awaits. No callback
        # can substitute the outer id/nonce of the original HTTP operation.
        msg = strict_json(original_bytes, limit=65_536)
        if (
            type(msg) is not dict
            or type(msg.get("type")) is not str
            or not msg["type"].startswith(DOMAIN + "/")
            or type(msg.get("id")) is not int
            or not 1 <= msg["id"] <= 2**53 - 1
            or type(msg.get("bridge")) is not dict
        ):
            raise Refusal("invalid_fields")
        command = msg["type"][len(DOMAIN) + 1 :]
        owner = PeerQueryBridge._owner(self)
        auth = owner[9]
        if command == IDENTITY:
            if set(msg) != {"id", "type", "bridge"}:
                raise Refusal("invalid_fields")
            proof = await ExistingBridgeAuthenticator.verify(auth, msg["bridge"], request)
            PeerQueryBridge._identity_guard(self, proof)
            result = {
                "schema_version": 1,
                "protocol": HTTP_PROTOCOL,
                "query_owner_id": proof.query_owner_id,
                "principal_kind": ExistingBridgeAuthenticator.origin_kind(auth, proof),
                "repository_id": repository_id(owner[4].repository_id),
            }
        elif command in {LOOKUP, HISTORY, PROTOCOL, READBACK, RESOLVE}:
            if command == READBACK:
                validate_client(msg.get("api_contract", 0), command=command)
            result, proof = await PeerQueryBridge._execute(self, request, msg, command)
        else:
            raise Refusal("invalid_fields")
        if ExistingBridgeAuthenticator.origin_kind(auth, proof) not in {
            "ha_http",
            "supervisor_http",
        }:
            raise Refusal("Unauthorized")
        # Domain-separated HMAC binds the unchanged HA frame to THIS original
        # request nonce. A proxy response cannot invent a query principal/frame.
        body = {
            "protocol": HTTP_PROTOCOL,
            "request_nonce": msg["bridge"]["nonce"],
            "frame": {"id": msg["id"], "type": "result", "success": True, "result": result},
        }
        if canonical_body(original_message) != original_bytes:
            raise Refusal("invalid_fields")
        signature = ExistingBridgeAuthenticator.sign_http_response(auth, proof, body)
        response = {**body, "signature": signature}
        validate_v2_envelope(response)  # includes actual entire HTTP wrapper bytes
        if command == IDENTITY:
            PeerQueryBridge._identity_guard(self, proof)
        else:
            PeerQueryBridge._guard(self, proof)
        if canonical_body(original_message) != original_bytes:
            raise Refusal("invalid_fields")
        return response

    def close(self):
        owner = _HOSTS.pop(self, None)
        if owner is not None:
            ExistingBridgeAuthenticator.close(owner[9])
            if owner[2].get("peer_bridge") is self:
                owner[2].pop("peer_bridge")


def install_peer_bridge(hass: HomeAssistant, registry: NativePeerRegistry | None = None):
    """Called by native host setup; bootstrap still needs genuine paired proof."""
    namespace = hass.data[DOMAIN]
    if namespace.get("peer_bridge") is not None:
        bridge = namespace["peer_bridge"]
        if type(bridge) is not PeerQueryBridge:
            raise ValueError("foreign peer bridge")
        PeerQueryBridge._owner(bridge)
        return bridge
    if registry is None:
        repo = namespace["access"].repository
        identity = repo._state.get("peer_source", {}).get("repository_id")
        if identity is None:
            raise ValueError("durable ECC repository identity is not configured")
        registry = NativePeerRegistry(repo, repository_id=repository_id(identity))
    return PeerQueryBridge(hass, registry)


async def dispatch_peer_readback(hass, connection, msg):
    bridge = hass.data[DOMAIN].get("peer_bridge")
    if type(bridge) is not PeerQueryBridge:
        raise AccessError("peer_bridge_unavailable")
    try:
        return await PeerQueryBridge.readback(bridge, connection, msg)
    except Refusal as err:
        raise AccessError("unauthorized" if err.code == "Unauthorized" else err.code) from None


@callback
def register_peer_bridge(hass: HomeAssistant):
    """Real public WebSocket routes, using the original authenticated connection."""
    for command in (LOOKUP, HISTORY, RESOLVE, PROTOCOL):

        def make_handler(selected):
            @websocket_api.websocket_command(
                {vol.Required("type"): f"{DOMAIN}/{selected}", vol.Required("bridge"): dict}
            )
            @websocket_api.async_response
            async def handle(hass, connection, msg):
                bridge = hass.data[DOMAIN].get("peer_bridge")
                try:
                    if type(bridge) is not PeerQueryBridge:
                        raise Refusal("binding_denied")
                    method = {
                        LOOKUP: PeerQueryBridge.lookup,
                        HISTORY: PeerQueryBridge.history,
                        RESOLVE: PeerQueryBridge.resolve,
                        PROTOCOL: PeerQueryBridge.protocol,
                    }[selected]
                    result = await method(bridge, connection, msg)
                    connection.send_result(msg["id"], result)
                except (Refusal, AccessError, ValueError, KeyError, TypeError):
                    connection.send_error(msg["id"], "binding_denied", "Peer read unavailable")

            return handle

        websocket_api.async_register_command(hass, make_handler(command))
    table = hass.data[websocket_api.DOMAIN]
    _REGISTERED[hass] = (
        id(table),
        tuple(
            (command, table[DOMAIN + "/" + command])
            for command in (LOOKUP, HISTORY, RESOLVE, PROTOCOL)
        ),
    )


def registered_peer_commands(hass):
    """Only original currently registered public peer protocol handlers."""
    registration = _REGISTERED.get(hass)
    table = hass.data.get(websocket_api.DOMAIN)
    if registration is None or id(table) != registration[0]:
        return ()
    return tuple(
        command
        for command, original in registration[1]
        if table.get(DOMAIN + "/" + command) is original
    )
