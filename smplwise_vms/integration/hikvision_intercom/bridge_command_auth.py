"""Native owner delegation for the already paired bridge, never an HA admin.

Only a genuine pairing proof on its original HA transport can issue a principal.
The calling Task receives a bounded command scope; copied/retired scopes refuse.
Private command parameters are never included in repr, audit, or errors here.
"""

from __future__ import annotations

import asyncio
import weakref
from collections.abc import Callable
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import HomeAssistant, callback

from .access.manager import AccessManager
from .access.models import AccessError
from .access.repository import AccessRepository
from .bridge_command_journal import BridgeCommandJournal
from .bridge_command_scope import _SCOPE
from .const import DOMAIN
from .storage import AccessStore
from .trusted_actions.envelope import thaw
from .trusted_actions.existing_bridge_auth import ExistingBridgeAuthenticator
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.validation import Refusal, aware

KIND = "wiskey-bridge-command.v1"
_HOSTS: weakref.WeakKeyDictionary[BridgeCommandHost, _Host] = weakref.WeakKeyDictionary()
_PRINCIPALS = weakref.WeakKeyDictionary()
_EXECUTIONS = weakref.WeakKeyDictionary()


class BridgeExecutionBinding:
    """Opaque origin of one admitted operation, never command admission scope."""

    __slots__ = ("__weakref__",)

    def check(self) -> AccessRepository:
        self.check_terminal_origin()
        host, _origin, _ports, _epoch, _user, _connection, deadline = _EXECUTIONS[self]
        owner = BridgeCommandHost._owner(host)
        if owner.auth.clock().now >= deadline:
            raise Refusal("Unauthorized")
        return owner.repository

    def check_terminal_origin(self):
        """Identity for one terminal notification; grants no execution authority.

        The signed operation deadline deliberately does not apply to reporting
        its completion. Pairing, user, transport and original source still do.
        This returns only an identity key, never a repository or command scope.
        """
        record = _EXECUTIONS.get(self)
        if record is None:
            raise Refusal("Unauthorized")
        host, origin, ports, epoch, user, connection, _deadline = record
        owner = BridgeCommandHost._owner(host)
        if not same_ports(ports, (owner.auth.retain_origin, owner.auth.check_retained)):
            raise Refusal("Unauthorized")
        owner.auth.check_retained(origin)
        if (
            connection.user is not user
            or owner.pairings.get(epoch.entry.entry_id) is not epoch
            or epoch.entry.data is not epoch.data
            or epoch.entry.options is not epoch.options
            or getattr(epoch.entry, "runtime_data", None) is not epoch.runtime
        ):
            raise Refusal("Unauthorized")
        if BridgeCommandHost._owner(host) is not owner:
            raise Refusal("Unauthorized")
        return epoch, epoch.entry.entry_id, user, connection

    @property
    def owner_key(self) -> tuple[_PairingEpoch, str, Any, Any]:
        self.check()
        _host, _origin, _ports, epoch, user, connection, _deadline = _EXECUTIONS[self]
        return epoch, epoch.entry.entry_id, user, connection

    @property
    def repository(self) -> AccessRepository:
        self.check()
        return BridgeCommandHost._owner(_EXECUTIONS[self][0]).repository


def retain_execution(
    principal: VerifiedBridgePrincipal, deadline: datetime
) -> BridgeExecutionBinding:
    """Separate finite lifetime after genuine command admission, at most24h.

    Only native composition calls this after validating the signed operation and
    policy deadlines. It does not extend the command proof or enter its scope.
    """
    if type(principal) is not VerifiedBridgePrincipal:
        raise Refusal("Unauthorized")
    principal.check()
    host, proof, _command, _issued, _expires, user, connection, epoch = _PRINCIPALS[principal]
    owner = BridgeCommandHost._owner(host)
    now = owner.auth.clock().now
    if (
        not isinstance(deadline, datetime)
        or deadline.utcoffset() is None
        or not now < deadline <= now + timedelta(hours=24)
    ):
        raise Refusal("invalid_execution_deadline")
    execution = BridgeExecutionBinding()
    _EXECUTIONS[execution] = (
        host,
        owner.auth.retain_origin(proof),
        (owner.auth.retain_origin, owner.auth.check_retained),
        epoch,
        user,
        connection,
        deadline,
    )
    execution.check()
    principal.check()
    return execution


def completion_query_repository(principal, execution):
    """Read-only completion query on a still-current original origin.

    This never renews execution.check(), enters command/effect scope or issues
    an execution binding. A fresh features/result principal is mandatory.
    """
    if type(principal) is not VerifiedBridgePrincipal or principal.command != "features/result":
        raise Refusal("Unauthorized")
    principal.check()
    record = _EXECUTIONS.get(execution) if type(execution) is BridgeExecutionBinding else None
    if record is None:
        raise Refusal("Unauthorized")
    host, origin, ports, epoch, user, connection, _deadline = record
    owner = BridgeCommandHost._owner(host)
    if (
        _PRINCIPALS[principal][0] is not host
        or not same_ports(ports, (owner.auth.retain_origin, owner.auth.check_retained))
        or principal.owner_key[0] is not epoch
        or principal.owner_key[2] is not user
        or principal.owner_key[3] is not connection
        or principal.repository is not owner.repository
    ):
        raise Refusal("Unauthorized")
    owner.auth.check_retained(origin)
    principal.check()
    return owner.repository


class VerifiedBridgePrincipal:
    """Opaque identity; constructing a label does not create authority."""

    __slots__ = ("__weakref__",)

    def check(self) -> None:
        record = _PRINCIPALS.get(self)
        if record is None:
            raise Refusal("Unauthorized")
        host, proof, command, issued, expires, _user, _connection, epoch = record
        owner = BridgeCommandHost._owner(host)
        owner.auth.check(proof)
        now = owner.auth.clock().now
        if (
            proof.body["kind"] != KIND
            or proof.body["command"] != command
            or proof.body["query_owner_id"] != proof.query_owner_id
            or not issued <= now + timedelta(seconds=2)
            or now >= expires
            or _connection.user is not _user
            or owner.pairings.get(proof.entry_id) is not epoch
            or epoch.entry.data is not epoch.data
            or epoch.entry.options is not epoch.options
            or getattr(epoch.entry, "runtime_data", None) is not epoch.runtime
        ):
            raise Refusal("Unauthorized")
        BridgeCommandHost._owner(host)

    @property
    def owner_key(self):
        self.check()
        _host, proof, _command, _issued, _expires, user, connection, epoch = _PRINCIPALS[self]
        return epoch, proof.entry_id, user, connection

    @property
    def repository(self):
        self.check()
        return BridgeCommandHost._owner(_PRINCIPALS[self][0]).repository

    @property
    def command(self):
        self.check()
        return _PRINCIPALS[self][2]

    @property
    def descriptor_epoch(self):
        """Original host generation, never a client/writer counter or read ref."""
        self.check()
        return _PRINCIPALS[self][7].descriptor_epoch

    @property
    def parameters(self):
        self.check()
        return thaw(_PRINCIPALS[self][1].body["parameters"])

    @property
    def actor_id(self):
        self.check()
        proof = _PRINCIPALS[self][1]
        actor = proof.body["parameters"].get("actor")
        if actor is not None:
            if (
                not hasattr(actor, "items")
                or set(actor) != {"id", "display_name"}
                or type(actor["id"]) is not str
                or not 1 <= len(actor["id"]) <= 128
                or any(ord(c) < 32 or ord(c) == 127 for c in actor["id"])
                or type(actor["display_name"]) is not str
            ):
                raise Refusal("invalid_fields")
            if len(actor["id"]) <= 124:
                return "arx:" + actor["id"]
            # Native audit identifiers are bounded to128 characters; preserve
            # an opaque stable source ID without ever hashing a private value.
            import hashlib

            return "arx-id-sha256:" + hashlib.sha256(actor["id"].encode()).hexdigest()
        return "arx:" + proof.entry_id + ":" + proof.query_owner_id


@dataclass(frozen=True, repr=False)
class _PairingEpoch:
    entry: ConfigEntry[Any]
    data: object
    options: object
    runtime: object
    descriptor_epoch: str = field(default_factory=lambda: uuid4().hex)


@dataclass(frozen=True, repr=False)
class _Host:
    hass: HomeAssistant
    data: Any
    namespace: dict[str, Any]
    manager: AccessManager
    repository: AccessRepository
    auth: ExistingBridgeAuthenticator
    ports: tuple[Callable[..., Any], ...]
    journal: BridgeCommandJournal
    owns_auth: bool
    delegation: object = field(default_factory=object)
    retired: list[bool] = field(default_factory=lambda: [False])
    inflight: set[Any] = field(default_factory=set)
    pairings: dict[str, _PairingEpoch] = field(default_factory=dict)


class BridgeCommandHost:
    def __init__(self, hass, journal):
        if type(hass) is not HomeAssistant:
            raise ValueError("Original Home Assistant required")
        namespace = hass.data[DOMAIN]
        manager = namespace.get("access")
        if type(manager) is not AccessManager or namespace.get("bridge_commands") is not None:
            raise ValueError("Original native manager and unique command owner required")
        peer = namespace.get("peer_bridge")
        auth = peer.authenticator if peer is not None else ExistingBridgeAuthenticator(hass)
        _HOSTS[self] = _Host(
            hass,
            hass.data,
            namespace,
            manager,
            manager.repository,
            auth,
            (
                auth.verify,
                auth.check,
                auth.refresh,
                auth.clock,
                manager.repository._save,
                manager.repository._commit,
                manager.repository.get,
            ),
            journal,
            peer is None,
        )
        namespace["bridge_commands"] = self

    def _owner(self) -> _Host:
        owner = _HOSTS.get(self)
        if (
            owner is None
            or owner.retired[0]
            or owner.hass.is_stopping
            or owner.hass.data is not owner.data
            or owner.data.get(DOMAIN) is not owner.namespace
            or owner.namespace.get("bridge_commands") is not self
            or owner.namespace.get("access") is not owner.manager
            or owner.manager.repository is not owner.repository
            or owner.manager._closed
            or not same_ports(
                owner.ports,
                (
                    owner.auth.verify,
                    owner.auth.check,
                    owner.auth.refresh,
                    owner.auth.clock,
                    owner.repository._save,
                    owner.repository._commit,
                    owner.repository.get,
                ),
            )
        ):
            raise Refusal("Unauthorized")
        return owner

    async def admit(self, connection, message, command):
        owner = BridgeCommandHost._owner(self)
        task = asyncio.current_task()
        if task is None or task in owner.inflight or len(owner.inflight) >= 32:
            raise Refusal("bridge_command_capacity")
        owner.inflight.add(task)
        task.add_done_callback(owner.inflight.discard)
        if (
            type(message) is not dict
            or set(message) != {"id", "type", "bridge"}
            or type(message["id"]) is not int
            or not 1 <= message["id"] <= 2**53 - 1
            or message["type"] != f"{DOMAIN}/{command}"
        ):
            raise Refusal("invalid_fields")
        proof = await owner.auth.verify(message["bridge"], connection)
        if BridgeCommandHost._owner(self) is not owner:
            raise Refusal("Unauthorized")
        body = proof.body
        if (
            set(body)
            != {"kind", "command", "query_owner_id", "issued_at", "expires_at", "parameters"}
            or body["kind"] != KIND
            or body["command"] != command
            or body["query_owner_id"] != proof.query_owner_id
            or not hasattr(body["parameters"], "items")
        ):
            raise Refusal("Unauthorized")
        issued, expires = aware(body["issued_at"]), aware(body["expires_at"])
        if not timedelta(0) < expires - issued <= timedelta(seconds=15):
            raise Refusal("Unauthorized")
        entry = owner.hass.config_entries.async_get_entry(proof.entry_id)
        epoch = owner.pairings.get(proof.entry_id)
        if (
            epoch is None
            or epoch.entry is not entry
            or epoch.data is not entry.data
            or epoch.options is not entry.options
            or epoch.runtime is not getattr(entry, "runtime_data", None)
        ):
            epoch = _PairingEpoch(
                entry, entry.data, entry.options, getattr(entry, "runtime_data", None)
            )
            owner.pairings[proof.entry_id] = epoch
        principal = VerifiedBridgePrincipal()
        _PRINCIPALS[principal] = (
            self,
            proof,
            command,
            issued,
            expires,
            connection.user,
            connection,
            epoch,
        )
        principal.check()
        # The bounded audio frame plane has its own live lease/strict sequence;
        # recording every batch in durable desired-state storage is unnecessary.
        # No ordinary command can opt out with a JSON flag.
        if command != "media/talk_frame":
            await owner.journal.reserve(
                entry_id=proof.entry_id,
                user_id=proof.query_owner_id,
                nonce=message["bridge"]["nonce"],
                now=owner.auth.clock().now,
                guard=principal.check,
            )
        principal.check()
        return principal

    def close(self):
        owner = _HOSTS.pop(self, None)
        if owner is not None:
            from .bridge_subscriptions import close_bridge_subscriptions
            from .native_maintenance_owner import close_host_maintenance_sources
            from .native_report_owner import close_host_report_sources

            close_bridge_subscriptions(owner.hass, self)
            close_host_report_sources(owner.hass, self)
            close_host_maintenance_sources(owner.hass, self)
            owner.retired[0] = True
            if owner.owns_auth:
                owner.auth.close()


@dataclass(repr=False)
class _CommandScope:
    principal: VerifiedBridgePrincipal
    task: asyncio.Task[Any] | None
    native_origins: tuple[Any, ...]
    active: bool = True
    native_attempted: bool = False


@contextmanager
def command_scope(principal):
    from .bridge_native_effects import bind_native_origins

    principal.check()
    if type(principal) is not VerifiedBridgePrincipal or _SCOPE.get() is not None:
        raise Refusal("Unauthorized")
    scope = _CommandScope(principal, asyncio.current_task(), bind_native_origins(principal))
    marker = _SCOPE.set(scope)
    try:
        yield scope
    finally:
        scope.active = False
        _SCOPE.reset(marker)


def bridge_authorized(hass=None, user=None, *, permissions=None):
    """Explicit native delegated policy, not user.is_admin or a caller role."""
    scope = _SCOPE.get()
    if scope is None:
        return False
    if not scope.active or scope.task is not asyncio.current_task():
        raise AccessError("unauthorized")
    try:
        scope.principal.check()
        host, _proof, _command, _issued, _expires, actual_user, _connection, _epoch = _PRINCIPALS[
            scope.principal
        ]
        owner = BridgeCommandHost._owner(host)
        if (
            user is not None
            and user is not actual_user
            or hass is not None
            and hass is not owner.hass
            or permissions is not None
            and permissions is not owner.namespace.get("panel_permissions")
        ):
            raise Refusal("Unauthorized")
    except Refusal:
        raise AccessError("unauthorized") from None
    return True


def host_for(hass):
    host = hass.data[DOMAIN].get("bridge_commands")
    if type(host) is not BridgeCommandHost:
        raise Refusal("authenticated_bridge_source_not_installed")
    BridgeCommandHost._owner(host)
    return host


def send_bridge_result(connection, message_id, result):
    # The outer transport marker permits HA's serialized debug-log filter to
    # redact private results too, without changing each command's result shape.
    connection.send_message(
        {
            "id": message_id,
            "type": "result",
            "success": True,
            "bridge_schema": KIND,
            "result": result,
        }
    )


async def dispatch_legacy_bridge(hass, connection, message, command, schema, fields):
    """Enter the original native handlers with their actual authenticated subject."""
    principal = await host_for(hass).admit(connection, message, command)
    parameters = principal.parameters
    if "service_write" in parameters:
        from .native_service_write_api import dispatch_service

        metadata = parameters.pop("service_write")
        if {"id", "type", "bridge"} & set(parameters):
            raise Refusal("invalid_fields")
        # The existing native schema is checked before the durable intent.
        # This new contract cannot carry a competing human/W1 attribution.
        try:
            schema({"id": message["id"], "type": message["type"], **parameters})
        except Exception:
            raise Refusal("invalid_fields") from None

        async def execute():
            return await _dispatch_bridge_principal(
                hass, connection, message, command, schema, fields,
                principal, parameters, None, None
            )

        return await dispatch_service(hass, principal, metadata, parameters, execute)
    source = row = None
    if "peer_write" in parameters:
        from .native_peer_write_api import source_for

        metadata = parameters.pop("peer_write")
        source = source_for(hass)
        row = await source.stage(principal, metadata, parameters)
    try:
        return await _dispatch_bridge_principal(
            hass, connection, message, command, schema, fields, principal, parameters, source, row
        )
    finally:
        if row is not None:
            source.release(row)


async def _dispatch_bridge_principal(
    hass, connection, message, command, schema, fields, principal, parameters, peer_source, peer_row
):
    import json

    import voluptuous as vol

    from .trusted_actions.source_commit_guard import source_commit
    from .websocket import _dispatch

    if command == "platform/maintenance_resume_v1" and "api_contract" in parameters:
        # This numbered native continuation has its own closed input contract.
        raise Refusal("invalid_fields")
    actor = principal.actor_id
    # Optional signed Arx actor metadata is separate from HA transport identity.
    if "actor" not in fields:
        parameters.pop("actor", None)
    payload = {"id": message["id"], "type": message["type"], **parameters}
    if {"id", "type", "bridge"} & set(parameters):
        raise Refusal("invalid_fields")
    try:
        payload = schema(payload)
    except vol.Invalid:
        raise Refusal("invalid_fields") from None
    for key, kind in fields.items():
        if kind in {int, bool} and type(payload[key]) is not kind:
            raise Refusal("invalid_fields")
    maximum = (
        1_048_576
        if command
        in {
            "users/csv_preview",
            "users/csv_apply",
            "users/csv_inspect",
            "jobs/csv_create",
            "backups/preview",
        }
        else 65_536
    )
    if len(json.dumps(payload, ensure_ascii=False).encode()) > maximum:
        raise Refusal("request_too_large")
    owner = BridgeCommandHost._owner(_PRINCIPALS[principal][0])
    user = connection.user
    attachment = (
        None
        if peer_row is None
        else (
            lambda before, candidate, result: peer_source.attach(
                peer_row, before, candidate, result
            )
        )
    )
    with (
        command_scope(principal) as scope,
        source_commit(owner.repository, principal.check, attachment=attachment),
    ):
        principal.check()
        try:
            if command.startswith("security/"):
                from .panel_security import PanelSecurity, get_security
                from .trusted_actions.direct_bridge_origin import DirectBridgeConnection

                # Panel credential flows cannot authenticate a pairing service.
                # This is never a prerequisite for other native bridge commands.
                if type(connection) is DirectBridgeConnection and command in {
                    "security/reauth_start",
                    "security/reauth_step",
                }:
                    raise Refusal("pairing_reconnect_required")
                security = get_security(hass)
                if type(security) is not PanelSecurity or security.hass is not hass:
                    raise Refusal("security_unavailable")
                result = await PanelSecurity.dispatch(security, connection, command, payload)
                principal.check()
                if get_security(hass) is not security:
                    raise Refusal("source_changed")
            else:
                result = await _dispatch(
                    hass, command, payload, actor=actor, user=user, readback_guard=principal.check
                )
        except Exception:
            if scope.native_attempted:
                raise Refusal("bridge_outcome_unknown") from None
            raise
        try:
            principal.check()
        except Refusal:
            raise Refusal("bridge_outcome_unknown") from None
    if peer_row is not None:
        try:
            receipt = peer_source.receipt(peer_row)
        except Refusal:
            raise Refusal("bridge_outcome_unknown") from None
        return {
            "schema_version": 1,
            "contract": "wiskey-native-bridge-write.v1",
            "result": result,
            "receipt": receipt,
            "replay_available": False,
        }
    return result


async def setup_bridge_commands(hass):
    if hass.data[DOMAIN].get("bridge_commands") is not None:
        raise ValueError("Bridge command source already installed")
    store = AccessStore(hass, key=f"{DOMAIN}.bridge_command_admission")
    journal = BridgeCommandJournal(store, await store.async_load())
    host = BridgeCommandHost(hass, journal)

    @callback
    def stopping(_event):
        host.close()

    hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stopping)
