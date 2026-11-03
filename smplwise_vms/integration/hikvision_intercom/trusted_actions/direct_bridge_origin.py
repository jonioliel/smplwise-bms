"""Original pairing service subjects on real direct request/socket resources.

These objects are neither HA Users nor ActiveConnections. Only the native HTTP
view can issue a connection; pairing verification subsequently seals its subject.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import weakref
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from aiohttp import web
from homeassistant.components.http import HomeAssistantRequest
from homeassistant.components.http.const import KEY_HASS
from homeassistant.config_entries import ConfigEntryState

from .source_bindings import same_ports
from .validation import Refusal

PATH = "/api/hikvision_intercom/arx_bridge/v1/ws"
PROTOCOL = "wiskey-direct-ws.v1"
CONNECT_KIND = "wiskey-direct-connect.v1"
REPLY_KIND = "wiskey-direct-reply.v1"
KEY = "direct_bridge"
_CONNECTIONS = weakref.WeakKeyDictionary()
_SUBJECTS = weakref.WeakKeyDictionary()
_ORIGINS = weakref.WeakKeyDictionary()


@dataclass(repr=False)
class _Connection:
    hass: object
    namespace: object
    server: object
    request: object
    transport: object
    socket: object
    challenge: str
    expires: datetime
    queue: object
    subscriptions: dict = field(default_factory=dict)
    subject: object = None
    entry: object = None
    data: object = None
    options: object = None
    runtime: object = None
    material: object = None
    connected: bool = False
    closing: bool = False
    ports: tuple = ()
    request_task: object = None


class PairingServiceSubject:
    """Server-issued original service identity; never an HA account."""

    __slots__ = ("__weakref__",)

    @property
    def id(self):
        connection = _SUBJECTS.get(self)
        row = check_connection(connection)
        if row.subject is not self:
            raise Refusal("Unauthorized")
        return "arx-service:" + row.entry.entry_id

    @property
    def is_active(self):
        try:
            _ = self.id
        except Refusal:
            return False
        return True

    @property
    def is_admin(self):
        return False

    @property
    def is_owner(self):
        return False

    @property
    def name(self):
        return "Arx"


class DirectBridgeOrigin:
    __slots__ = ("__weakref__",)


DIRECT_READ_COMMANDS = (
    "peer_identity/get",
    "direct/capabilities",
    "direct/capabilities_v2",
    "direct/time",
)


class DirectBridgeConnection:
    """Native handler transport, backed by the original aiohttp connection."""

    __slots__ = ("__weakref__",)

    @property
    def hass(self):
        # Existing native workers retain this original host via their actual
        # transport. Expose only the constructor-owned, still-current root.
        return check_connection(self).hass

    @property
    def user(self):
        row = _CONNECTIONS.get(self)
        return row.subject if row is not None else None

    @property
    def subscriptions(self):
        return _CONNECTIONS[self].subscriptions

    def send_message(self, message):
        from homeassistant.helpers.json import json_bytes

        row = check_connection(self)
        # Preserve the original HA wire codec (including finite measurements),
        # then sign that exact JSON tree. Command canonicalization stays strict:
        # this response path never admits a float or authority into a request.
        message = json.loads(json_bytes(message))
        body = {"connection_ref": row.challenge, "frame": message}
        encoded = json.dumps(
            body, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
        ).encode()
        signature = hmac.new(
            row.material.encode(),
            (REPLY_KIND + ".").encode() + encoded,
            hashlib.sha256,
        ).hexdigest()
        try:
            row.queue.put_nowait({"kind": REPLY_KIND, **body, "sig": signature})
        except asyncio.QueueFull:
            row.closing = True
            raise Refusal("direct_output_capacity") from None

    def send_result(self, message_id, result=None):
        self.send_message({"id": message_id, "type": "result", "success": True, "result": result})

    def send_event(self, message_id, event):
        self.send_message({"id": message_id, "type": "event", "event": event})

    def send_error(self, message_id, code, _message=None, **_translation):
        # Domain exception text and request parameters never enter the wire.
        self.send_message(
            {
                "id": message_id,
                "type": "result",
                "success": False,
                "error": {"code": code, "message": "Direct bridge request refused"},
            }
        )


def issue_connection(hass, server, request, socket, challenge):
    from ..const import DOMAIN

    if (
        type(request) is not HomeAssistantRequest
        or request.app.get(KEY_HASS) is not hass
        or request.method != "GET"
        or request.path != PATH
        or request.query_string
        or type(socket) is not web.WebSocketResponse
        or not socket.prepared
        or request.transport is None
        or request.transport.is_closing()
        or hass.data[DOMAIN].get(KEY) is not server
    ):
        raise Refusal("Unauthorized")
    connection = DirectBridgeConnection()
    row = _Connection(
        hass,
        hass.data[DOMAIN],
        server,
        request,
        request.transport,
        socket,
        challenge,
        datetime.now(UTC) + timedelta(hours=24),
        asyncio.Queue(maxsize=64),
    )
    row.request_task = asyncio.current_task()
    row.ports = (
        connection.send_message,
        connection.send_result,
        connection.send_event,
        connection.send_error,
    )
    _CONNECTIONS[connection] = row
    check_connection(connection, authenticated=False)
    return connection


def check_connection(connection, *, authenticated=True):
    from ..const import DOMAIN

    row = _CONNECTIONS.get(connection) if type(connection) is DirectBridgeConnection else None
    if row is None:
        raise Refusal("Unauthorized")
    from ..direct_bridge_api import check_server

    server = check_server(row.server, row.hass)
    if (row.connected or row.subject is not None) and server.connections.get(
        connection
    ) is not row.request_task:
        raise Refusal("Unauthorized")
    request = row.request
    if (
        row.closing
        or row.hass.is_stopping
        or row.hass.data.get(DOMAIN) is not row.namespace
        or row.namespace.get(KEY) is not row.server
        or row.server.closed
        or request.app.get(KEY_HASS) is not row.hass
        or request.path != PATH
        or request.query_string
        or request.method != "GET"
        or request.transport is not row.transport
        or row.transport.is_closing()
        or row.socket.closed
        or datetime.now(UTC) >= row.expires
        or not same_ports(
            row.ports,
            (
                connection.send_message,
                connection.send_result,
                connection.send_event,
                connection.send_error,
            ),
        )
    ):
        raise Refusal("Unauthorized")
    if authenticated and (
        row.subject is None
        or _SUBJECTS.get(row.subject) is not connection
        or row.hass.config_entries.async_get_entry(row.entry.entry_id) is not row.entry
        or row.entry.domain != "smplwise_bridge"
        or row.entry.state is not ConfigEntryState.LOADED
        or row.entry.data is not row.data
        or row.entry.options is not row.options
        or getattr(row.entry, "runtime_data", None) is not row.runtime
        or row.data.get("pairing_code") != row.material
    ):
        raise Refusal("Unauthorized")
    return row


def bind_pairing_origin(hass, connection, entry):
    """Called by the shared verifier only after the original pairing MAC matches."""
    row = check_connection(connection, authenticated=False)
    if row.hass is not hass:
        raise Refusal("Unauthorized")
    if row.subject is None:
        row.entry, row.data, row.options = entry, entry.data, entry.options
        row.runtime = getattr(entry, "runtime_data", None)
        row.material = row.data["pairing_code"]
        row.subject = PairingServiceSubject()
        _SUBJECTS[row.subject] = connection
    elif row.entry is not entry:
        raise Refusal("Unauthorized")
    check_connection(connection)
    origin = DirectBridgeOrigin()
    _ORIGINS[origin] = (connection, row, row.subject)
    return origin


def check_direct_origin(origin):
    record = _ORIGINS.get(origin) if type(origin) is DirectBridgeOrigin else None
    if record is None:
        raise Refusal("Unauthorized")
    connection, row, subject = record
    if check_connection(connection) is not row or row.subject is not subject:
        raise Refusal("Unauthorized")
    return subject, subject.id, None, "pairing_service"


def retire_connection(connection):
    row = _CONNECTIONS.get(connection)
    if row is not None:
        row.closing = True
        if row.subject is not None:
            _SUBJECTS.pop(row.subject, None)


def command_names(subject):
    """Current original routes for this exact authenticated direct socket."""
    from homeassistant.components import websocket_api

    from ..const import DOMAIN

    if type(subject) is not PairingServiceSubject:
        raise Refusal("Unauthorized")
    row = check_connection(_SUBJECTS.get(subject))
    table = row.hass.data[websocket_api.DOMAIN]
    names = {
        name
        for name, original in row.server.commands.items()
        if table.get(DOMAIN + "/" + name) is original
    }
    return tuple(sorted(names | set(DIRECT_READ_COMMANDS)))


def forget_connection(connection):
    """Release constructor-owned crypto roots after native cleanup/socket join."""
    row = _CONNECTIONS.pop(connection, None)
    if row is None:
        return
    row.closing = True
    if row.subject is not None:
        _SUBJECTS.pop(row.subject, None)
    for origin, record in tuple(_ORIGINS.items()):
        if record[0] is connection:
            _ORIGINS.pop(origin, None)
    row.ports = ()
