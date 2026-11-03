"""Direct pairing-authenticated WebSocket over the original WisKey handlers."""

from __future__ import annotations

import asyncio
import inspect
import weakref
from dataclasses import dataclass
from datetime import timedelta
from types import MappingProxyType
from uuid import uuid4

from aiohttp import WSMsgType, web
from homeassistant.components import websocket_api
from homeassistant.components.http import KEY_HASS, HomeAssistantView
from homeassistant.const import EVENT_HOMEASSISTANT_STOP

from .access.models import AccessError
from .bridge_command_auth import BridgeCommandHost, host_for
from .const import DOMAIN
from .media_lifetime import join_owned
from .trusted_actions.direct_bridge_origin import (
    CONNECT_KIND,
    DIRECT_READ_COMMANDS,
    KEY,
    PATH,
    PROTOCOL,
    check_connection,
    forget_connection,
    issue_connection,
    retire_connection,
)
from .trusted_actions.envelope import thaw
from .trusted_actions.validation import Refusal, aware, strict_json

MAX_CONNECTIONS = 32
MAX_FRAME_BYTES = 1_048_576


def _registered_handlers(hass):
    """Retain the actual registered callables, not a parallel command registry."""
    from .arx_feature_api import registered_feature_commands
    from .audio_tts import registered_tts_commands
    from .bridge_subscriptions import registered_bridge_subscriptions
    from .capture_native_api import registered_native_capture_commands
    from .event_resume import registered as registered_resume
    from .name_reference_api import registered_name_references
    from .native_peer_write_api import registered_native_peer_writes
    from .native_service_write_api import registered_service_writes
    from .peer_bridge_api import registered_peer_commands
    from .station_media_api import registered_station_media
    from .websocket import registered_commands
    from .whatsapp_template_api_v2 import registered_template_commands_v2

    commands = set(registered_commands(hass))
    commands.update(registered_resume(hass))
    from .native_installation_api import registered as installed_commands

    commands.update(installed_commands(hass))
    for get in (
        registered_feature_commands,
        registered_tts_commands,
        registered_bridge_subscriptions,
        registered_name_references,
        registered_peer_commands,
        registered_station_media,
        registered_template_commands_v2,
    ):
        commands.update(get(hass))
    commands.update(registered_native_capture_commands(hass))
    commands.update(registered_native_peer_writes(hass))
    commands.update(registered_service_writes(hass))
    # Owner28: the installed local Arx sees every registered command. Native
    # request schemas and business approval requirements still decide effects.
    table = hass.data[websocket_api.DOMAIN]
    return {name: table[DOMAIN + "/" + name] for name in commands}


_SERVERS = weakref.WeakKeyDictionary()


@dataclass(frozen=True, repr=False)
class _Server:
    hass: object
    namespace: object
    commands: object
    implementations: object
    connections: dict
    opening: dict
    closed: list


def check_server(server, hass=None):
    owner = _SERVERS.get(server) if type(server) is DirectBridgeServer else None
    actual = owner.hass() if owner is not None else None
    if (
        owner is None
        or owner.closed[0]
        or actual is None
        or hass is not None
        and actual is not hass
        or server.hass is not actual
        or server.namespace is not owner.namespace
        or actual.data.get(DOMAIN) is not owner.namespace
        or owner.namespace.get(KEY) is not server
        or server.commands is not owner.commands
        or server.connections is not owner.connections
        or server.opening is not owner.opening
    ):
        raise Refusal("source_changed")
    return owner


class DirectBridgeServer:
    def __init__(self, hass):
        self.hass = hass
        self.namespace = hass.data[DOMAIN]
        self.commands = MappingProxyType(_registered_handlers(hass))
        implementations = MappingProxyType(
            {
                name: getattr(original[0], "__wrapped__", None)
                for name, original in self.commands.items()
            }
        )
        self.connections, self.opening = {}, {}
        self.namespace[KEY] = self
        _SERVERS[self] = _Server(
            weakref.ref(hass),
            self.namespace,
            self.commands,
            implementations,
            self.connections,
            self.opening,
            [False],
        )
        try:
            hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, self.stop)
        except BaseException:
            _SERVERS.pop(self)
            if self.namespace.get(KEY) is self:
                self.namespace.pop(KEY)
            raise

    @property
    def closed(self):
        owner = _SERVERS.get(self)
        return owner is None or owner.closed[0]

    async def stop(self, _event):
        owner = _SERVERS.get(self)
        if owner is None:
            return
        owner.closed[0] = True
        current = asyncio.current_task()
        active = tuple(owner.connections.items())
        tasks = set(owner.opening.values()) | {task for _connection, task in active}
        for connection, _task in active:
            retire_connection(connection)
        for task in tasks:
            if task is not current:
                task.cancel()
        try:
            await join_owned(
                asyncio.gather(
                    *(task for task in tasks if task is not current),
                    return_exceptions=True,
                )
            )
        finally:
            _SERVERS.pop(self, None)

    async def connect(self, connection, message):
        row = check_connection(connection, authenticated=False)
        if (
            type(message) is not dict
            or set(message) != {"id", "type", "bridge"}
            or type(message["id"]) is not int
            or message["id"] != 1
            or message["type"] != DOMAIN + "/direct/connect"
        ):
            raise Refusal("invalid_fields")
        host = host_for(self.hass)
        owner = BridgeCommandHost._owner(host)
        proof = await owner.auth.verify(message["bridge"], connection)
        body = proof.body
        if (
            set(body)
            != {"kind", "command", "query_owner_id", "issued_at", "expires_at", "parameters"}
            or body["kind"] != CONNECT_KIND
            or body["command"] != "direct/connect"
            or body["query_owner_id"] != "pairing"
            or thaw(body["parameters"]) != {"challenge": row.challenge}
        ):
            raise Refusal("Unauthorized")
        issued, expires = aware(body["issued_at"]), aware(body["expires_at"])

        def current():
            owner.auth.check(proof)
            now = owner.auth.clock().now
            if (
                BridgeCommandHost._owner(host) is not owner
                or not timedelta(0) < expires - issued <= timedelta(seconds=15)
                or issued > now + timedelta(seconds=2)
                or now >= expires
            ):
                raise Refusal("Unauthorized")

        current()
        await owner.journal.reserve(
            entry_id=proof.entry_id,
            user_id=proof.query_owner_id,
            nonce=message["bridge"]["nonce"],
            now=owner.auth.clock().now,
            guard=current,
        )
        current()
        row.connected = True
        connection.send_result(1, self.identity(connection))

    def identity(self, connection):
        row = check_connection(connection)
        registry = self.namespace.get("native_peer_registry")
        return {
            "protocol": PROTOCOL,
            "query_owner_id": row.subject.id,
            "principal_kind": "pairing_service",
            "connection_ref": row.challenge,
            "repository_id": registry.repository_id if registry is not None else None,
        }

    async def dispatch(self, connection, message):
        row = check_connection(connection)
        if not row.connected:
            raise Refusal("Unauthorized")
        if (
            type(message) is not dict
            or set(message) != {"id", "type", "bridge"}
            or type(message["id"]) is not int
            or not 1 <= message["id"] <= 2**53 - 1
            or type(message["type"]) is not str
            or not message["type"].startswith(DOMAIN + "/")
        ):
            raise Refusal("invalid_fields")
        command = message["type"][len(DOMAIN) + 1 :]
        if command in DIRECT_READ_COMMANDS:
            principal = await host_for(self.hass).admit(connection, message, command)
            if principal.parameters != {}:
                raise Refusal("invalid_fields")
            principal.check()
            if command == "peer_identity/get":
                result = self.identity(connection)
            else:
                from .direct_bridge_discovery import capabilities, server_time

                result = (
                    capabilities(self.hass, connection, version=2 if command.endswith("_v2") else 1)
                    if command in {"direct/capabilities", "direct/capabilities_v2"}
                    else server_time(self.hass)
                )
            principal.check()
            connection.send_result(message["id"], result)
            return
        owner = check_server(self, self.hass)
        original = owner.commands.get(command)
        current = self.hass.data.get(websocket_api.DOMAIN, {}).get(message["type"])
        if original is None or current is not original:
            raise Refusal("command_unavailable")
        signed = message.get("bridge")
        kind = signed.get("kind") if type(signed) is dict else None
        if kind not in {"wiskey-bridge-command.v1", "wiskey-peer-query.v1"}:
            raise Refusal("Unauthorized")
        if kind == "wiskey-peer-query.v1":
            # The existing peer readback implementation accepts its legacy
            # outer copies. Derive those copies only from the signed body.
            if command == "users/access_state_v2":
                from .peer_bridge_api import PeerQueryBridge

                bridge = self.namespace.get("peer_bridge")
                if type(bridge) is not PeerQueryBridge:
                    raise Refusal("binding_denied")
                params = signed.get("parameters")
                if type(params) is not dict:
                    raise Refusal("invalid_fields")
                result = await bridge.readback(
                    connection,
                    {
                        **message,
                        "user_id": params.get("user_id"),
                        "revision": params.get("revision"),
                    },
                )
                connection.send_result(message["id"], result)
                return
            if command not in {
                "peer_bindings/get",
                "peer_bindings/history",
                "peer_protocol/get",
                "peer_receipts/resolve",
            }:
                raise Refusal("Unauthorized")
        elif command.startswith(("peer_bindings/", "peer_receipts/", "peer_protocol/")):
            raise Refusal("Unauthorized")
        # async_response's only wrapper schedules this exact coroutine for HA.
        # Await the same original command directly so disconnect can join it.
        handler = original[0]
        implementation = owner.implementations.get(command)
        if (
            implementation is None
            or not inspect.iscoroutinefunction(implementation)
            or getattr(handler, "__wrapped__", None) is not implementation
        ):
            raise Refusal("command_unavailable")
        await implementation(self.hass, connection, message)


class DirectBridgeView(HomeAssistantView):
    url = PATH
    name = "api:hikvision_intercom:arx_bridge:v1:ws"
    requires_auth = False  # Authentication is the original pairing MAC, below.

    async def get(self, request):
        hass = request.app[KEY_HASS]
        server = hass.data.get(DOMAIN, {}).get(KEY)
        try:
            owner = check_server(server, hass)
        except Refusal:
            return web.json_response({"error": {"code": "direct_connection_capacity"}}, status=503)
        if request.query_string or len(owner.connections) + len(owner.opening) >= MAX_CONNECTIONS:
            return web.json_response({"error": {"code": "direct_connection_capacity"}}, status=503)
        task = asyncio.current_task()
        slot = object()
        # Reserve synchronously before prepare yields. Opening sockets count
        # against the same advertised bound and are joined by the original stop.
        owner.opening[slot] = task
        socket = web.WebSocketResponse(max_msg_size=MAX_FRAME_BYTES, heartbeat=None)
        try:
            await socket.prepare(request)
            check_server(server, hass)
            challenge = uuid4().hex
            connection = issue_connection(hass, server, request, socket, challenge)
            row = check_connection(connection, authenticated=False)
            owner.connections[connection] = task
        except BaseException:
            if socket.prepared:
                await join_owned(socket.close())
            raise
        finally:
            owner.opening.pop(slot, None)

        async def write():
            while True:
                frame = await row.queue.get()
                async with asyncio.timeout(3):
                    await socket.send_json(frame)

        async def watch():
            while True:
                await asyncio.sleep(0.25)
                try:
                    check_connection(connection, authenticated=row.connected)
                except Refusal:
                    task.cancel()
                    return

        writer = watcher = None
        try:
            await socket.send_json({"type": "hello", "protocol": PROTOCOL, "challenge": challenge})
            writer = hass.async_create_background_task(write(), "WisKey direct response writer")

            def writer_finished(child):
                if not child.cancelled() and child.exception() is not None and not task.done():
                    task.cancel()

            writer.add_done_callback(writer_finished)
            watcher = hass.async_create_background_task(watch(), "WisKey direct source lifetime")
            async with asyncio.timeout(10):
                first = await socket.receive()
                if first.type is not WSMsgType.TEXT or len(first.data.encode()) > 65_536:
                    raise Refusal("invalid_fields")
                await server.connect(connection, strict_json(first.data, limit=65_536))
            last_id = 1
            async for frame in socket:
                if frame.type is not WSMsgType.TEXT:
                    break
                message = strict_json(frame.data, limit=MAX_FRAME_BYTES)
                identifier = message.get("id") if type(message) is dict else None
                if type(identifier) is not int or not last_id < identifier <= 2**53 - 1:
                    raise Refusal("invalid_fields")
                last_id = identifier
                try:
                    # The original admission host grants one command per Task.
                    # Preserve that boundary on a serial direct socket too;
                    # a long-lived socket Task is never reused as command scope.
                    dispatch = hass.async_create_task(
                        server.dispatch(connection, message),
                        "WisKey original direct command",
                        eager_start=False,
                    )
                    await dispatch
                except (Refusal, AccessError) as error:
                    connection.send_error(identifier, error.code)
                except Exception:
                    connection.send_error(identifier, "bridge_outcome_unknown")
        except (Refusal, TimeoutError, ValueError, TypeError, KeyError):
            pass  # Never echo unauthenticated input, signatures or exception text.
        finally:
            retire_connection(connection)
            # Stop the lifetime monitor before joining. It must not repeatedly
            # cancel this same original owner while native cleanup is running.
            for child in (writer, watcher):
                if child is not None:
                    child.cancel()
            callbacks = tuple(row.subscriptions.values())
            for cancel in callbacks:
                try:
                    cancel()
                except Exception:
                    # Original native joins below retain their own failure
                    # quarantine. A callback failure never keeps authentication
                    # alive or turns a transport close into no_effect proof.
                    pass
            # Cancel ports perform native join; subscriptions do not confer new
            # authority. Await the original bound owners when they expose close.
            from .access.arx_feature_host import close_feature_connection

            closures = [close_feature_connection(hass, connection)]
            for cancel in callbacks:
                resource_owner = getattr(cancel, "__self__", None)
                close = getattr(resource_owner, "async_close", None)
                if close is not None:
                    closures.append(close())
            if closures:
                await join_owned(asyncio.gather(*closures, return_exceptions=True))
            row.subscriptions.clear()
            for child in (writer, watcher):
                if child is not None:
                    child.cancel()
            await join_owned(
                asyncio.gather(
                    *(child for child in (writer, watcher) if child is not None),
                    return_exceptions=True,
                )
            )
            try:
                await join_owned(socket.close())
            finally:
                owner.connections.pop(connection, None)
                forget_connection(connection)
        return socket


def register_direct_bridge(hass):
    DirectBridgeServer(hass)
    hass.http.register_view(DirectBridgeView())
