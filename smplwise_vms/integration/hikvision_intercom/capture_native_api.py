"""Signed transport adapter for the original bridge's capture services."""

from __future__ import annotations

import weakref

import voluptuous as vol
from homeassistant.components import websocket_api

from .bridge_command_auth import host_for, send_bridge_result
from .capture_native_composition import KEY, NativeCaptureComposition
from .const import DOMAIN
from .trusted_actions.validation import Refusal

COMMANDS = ("capture/lease_event", "capture/lease_request")
_REGISTERED = weakref.WeakKeyDictionary()


def _handler(command):
    @websocket_api.websocket_command(
        vol.All(vol.Schema({"type": DOMAIN + "/" + command}, extra=vol.ALLOW_EXTRA))
    )
    @websocket_api.async_response
    async def handle(hass, connection, message):
        try:
            principal = await host_for(hass).admit(connection, message, command)
            parameters = principal.parameters
            if (
                set(parameters) != {"signed_message_json"}
                or type(parameters["signed_message_json"]) is not str
                or len(parameters["signed_message_json"].encode()) > 8192
            ):
                raise Refusal("invalid_fields")
            composition = hass.data[DOMAIN][KEY].get("composition")
            if type(composition) is not NativeCaptureComposition:
                raise Refusal("capture_source_unavailable")
            composition.stable()
            pairing = hass.config_entries.async_get_entry(principal.owner_key[1])
            if not composition.source.matches(hass, pairing):
                raise Refusal("Unauthorized")
            principal.check()
            result = await hass.services.async_call(
                "smplwise_bridge",
                command.split("/")[1],
                parameters,
                blocking=True,
                return_response=True,
            )
            composition.stable()
            principal.check()
            send_bridge_result(connection, message["id"], result)
        except Refusal as error:
            connection.send_error(message["id"], error.code, "Capture source refused")
        except Exception:
            connection.send_error(
                message["id"], "capture_outcome_unknown", "Capture answer unavailable"
            )

    return handle


def register_native_capture_api(hass):
    for command in COMMANDS:
        websocket_api.async_register_command(hass, _handler(command))
    table = hass.data[websocket_api.DOMAIN]
    _REGISTERED[hass] = tuple((command, table[DOMAIN + "/" + command]) for command in COMMANDS)


def registered_native_capture_commands(hass):
    table = hass.data.get(websocket_api.DOMAIN, {})
    return tuple(
        command
        for command, original in _REGISTERED.get(hass, ())
        if table.get(DOMAIN + "/" + command) is original
    )
