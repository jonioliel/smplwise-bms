"""Actual HA registration for the current-source native execution host.

The message contains a signed descriptor, never an authority/policy object.
Native coordinators retain transport admission, per-effect current checks and
their own durable attempts. A missing installed bridge is an explicit error.
"""

from __future__ import annotations

import asyncio
import json
import weakref

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import callback

from .access.arx_feature_host import KEY, NativeFeatureHost, feature_host_status
from .access.models import AccessError
from .bridge_command_auth import host_for, send_bridge_result
from .const import DOMAIN
from .trusted_actions.validation import Refusal

COMMANDS = (
    "features/status",
    "features/start",
    "features/result",
    "features/cancel",
    "features/prepare_media",
    "features/people_csv_preview",
)
_REGISTERED = weakref.WeakKeyDictionary()


async def _user(hass, connection):
    from .trusted_actions.direct_bridge_origin import DirectBridgeConnection, check_connection

    if type(connection) is DirectBridgeConnection:
        row = check_connection(connection)
        if row.hass is not hass:
            raise Refusal("Unauthorized")
        return row.subject
    if not isinstance(connection, websocket_api.ActiveConnection):
        raise Refusal("Unauthorized")
    user = connection.user
    if user is None or user.is_active is not True:
        raise Refusal("Unauthorized")
    current = await hass.auth.async_get_user(user.id)
    if current is not user or connection.user is not user or current.is_active is not True:
        raise Refusal("Unauthorized")
    return user


def _host(hass):
    host = hass.data.get(DOMAIN, {}).get(KEY)
    if type(host) is not NativeFeatureHost:
        raise Refusal("authenticated_current_source_not_installed")
    NativeFeatureHost._stable(host)
    return host


async def _bridge_message(hass, connection, msg, command):
    """Normalize only after original HMAC admission; no ordinary user elevation."""
    if "bridge" not in msg:
        return None, msg, None, None
    from .arx_native_feature_source import KEY as SOURCE_KEY
    from .arx_native_feature_source import NativeBridgeFeatureSource

    principal = await host_for(hass).admit(connection, msg, command)
    parameters = principal.parameters
    normalized = {"id": msg["id"], "type": msg["type"]}
    if command in {"features/start", "features/prepare_media", "features/people_csv_preview"}:
        if (
            not {"request", "policy_snapshot"} <= set(parameters)
            or set(parameters) - {"request", "policy_snapshot", "subscription"}
            or "subscription" in parameters
            and (
                type(parameters["subscription"]) is not int
                or not 1 <= parameters["subscription"] <= 2**53 - 1
            )
        ):
            raise Refusal("invalid_fields")
        source = hass.data[DOMAIN].get(SOURCE_KEY)
        if type(source) is not NativeBridgeFeatureSource:
            raise Refusal("authenticated_current_source_not_installed")
        _host(hass)
        token = await NativeBridgeFeatureSource.stage(source, principal, parameters, connection)
        normalized["signed_message_json"] = token
        if "subscription" in parameters:
            normalized["subscription"] = parameters["subscription"]
        return principal, normalized, source, token
    expected = set() if command == "features/status" else {"operation_ref"}
    if set(parameters) != expected:
        raise Refusal("invalid_fields")
    return principal, {**normalized, **parameters}, None, None


def _handler(command):
    fields = {
        vol.Required("id"): vol.All(int, vol.Range(min=1)),
        vol.Required("type"): DOMAIN + "/" + command,
    }
    if command in {"features/start", "features/prepare_media", "features/people_csv_preview"}:
        fields[vol.Required("signed_message_json")] = str
        fields[vol.Optional("subscription")] = int
    elif command in {"features/result", "features/cancel"}:
        fields[vol.Required("operation_ref")] = str
    schema = vol.Schema(fields)

    @websocket_api.websocket_command(
        vol.All(vol.Schema({"type": DOMAIN + "/" + command}, extra=vol.ALLOW_EXTRA))
    )
    @websocket_api.async_response
    async def handle(hass, connection, msg):
        principal = source = token = None
        try:
            principal, msg, source, token = await _bridge_message(hass, connection, msg, command)
            user = await _user(hass, connection)
            if principal is not None:
                principal.check()
            schema(msg)
            if (
                type(msg["id"]) is not int
                or len(json.dumps(msg, ensure_ascii=True).encode()) > 1_100_000
            ):
                raise Refusal("invalid_fields")
            if command == "features/status":
                # This public operational overview never returns targets or people.
                if principal is None and user.is_admin is not True:
                    raise Refusal("Unauthorized")
                result = feature_host_status(hass)
            else:
                host = _host(hass)
                if command == "features/people_csv_preview":
                    from .arx_native_feature_source import NativeBridgeFeatureSource

                    if principal is None or source is None:
                        raise Refusal("Unauthorized")
                    result = NativeBridgeFeatureSource.preview_publication(source, token)
                elif command == "features/prepare_media":
                    from .arx_media_ingress import INGRESS_KEY, FeatureMediaIngress

                    ingress = hass.data[DOMAIN].get(INGRESS_KEY)
                    if type(ingress) is not FeatureMediaIngress:
                        raise Refusal("native_media_ingress_unavailable")
                    result, prepared_lease = await FeatureMediaIngress.prepare(
                        ingress,
                        host,
                        msg["signed_message_json"],
                        connection,
                        msg["id"],
                        msg.get("subscription"),
                    )
                    reference = result["preparation_ref"]
                elif command == "features/start":
                    if (
                        msg.get("subscription") == msg["id"]
                        or msg["id"] in connection.subscriptions
                    ):
                        raise Refusal("invalid_fields")
                    reference = await NativeFeatureHost.start(
                        host,
                        msg["signed_message_json"],
                        connection,
                        subscription=msg.get("subscription"),
                    )
                    try:
                        NativeFeatureHost.own_connection(host, reference, connection, msg["id"])
                    except BaseException:
                        await NativeFeatureHost.cancel(host, reference, connection)
                        raise
                    result = {
                        "schema_version": 1,
                        "operation_ref": reference,
                        "state": "admitted",
                        "execution_result": "pending",
                        "replay_available": False,
                    }
                elif command == "features/result":
                    result = NativeFeatureHost.result(
                        host, msg["operation_ref"], connection, principal=principal
                    )
                else:
                    result = await NativeFeatureHost.cancel(host, msg["operation_ref"], connection)
                if _host(hass) is not host:
                    raise Refusal("binding_denied")
            # A user revoked while a coordinator joined cleanup receives no data.
            if await _user(hass, connection) is not user:
                raise Refusal("Unauthorized")
            # No more awaits before publication. Authority and original host
            # ownership can change while the real HA auth store is awaited.
            if command == "features/status":
                if principal is None and user.is_admin is not True:
                    raise Refusal("Unauthorized")
                result = feature_host_status(hass)
            else:
                if _host(hass) is not host:
                    raise Refusal("binding_denied")
                if command == "features/people_csv_preview":
                    result = NativeBridgeFeatureSource.preview_publication(source, token)
                elif command == "features/prepare_media":
                    result = FeatureMediaIngress.publication(
                        ingress, reference, prepared_lease, host, connection
                    )
                elif command == "features/result":
                    result = NativeFeatureHost.result(
                        host, msg["operation_ref"], connection, principal=principal
                    )
                else:
                    NativeFeatureHost.check_publication(
                        host,
                        reference if command == "features/start" else msg["operation_ref"],
                        connection,
                        cleanup=command == "features/cancel",
                    )
            if principal is not None:
                principal.check()
        except vol.Invalid:
            connection.send_error(msg["id"], "invalid_fields", "Invalid feature fields")
        except (Refusal, AccessError) as error:
            connection.send_error(msg["id"], error.code, "Native feature action unavailable")
        except asyncio.CancelledError:
            raise
        except Exception:
            # Provider exception text or private policy must never leave this route.
            connection.send_error(
                msg["id"], "feature_action_failed", "Native feature action failed"
            )
        else:
            if principal is not None:
                send_bridge_result(connection, msg["id"], result)
            else:
                connection.send_result(msg["id"], result)
        finally:
            if source is not None:
                from .arx_native_feature_source import NativeBridgeFeatureSource

                NativeBridgeFeatureSource.discard(source, token)

    return handle


@callback
def register_feature_api(hass):
    """Register real public HA commands even before a source is installed."""
    for command in COMMANDS:
        websocket_api.async_register_command(hass, _handler(command))
    table = hass.data[websocket_api.DOMAIN]
    _REGISTERED[hass] = (
        id(table),
        tuple((command, table[DOMAIN + "/" + command]) for command in COMMANDS),
    )


def registered_feature_commands(hass):
    """Report only the original actual public handlers, never a ready marker."""
    registration = _REGISTERED.get(hass)
    table = hass.data.get(websocket_api.DOMAIN)
    if registration is None or type(table) is not dict or id(table) != registration[0]:
        return ()
    return tuple(
        command
        for command, handler in registration[1]
        if table.get(DOMAIN + "/" + command) is handler
    )
