"""Versioned installed registry/queue commands on original signed transport."""

import weakref

import voluptuous as vol
from homeassistant.components import websocket_api

from .access.models import AccessError
from .bridge_command_auth import host_for, send_bridge_result
from .const import DOMAIN
from .native_auto_installation import KEY as AUTHORITY
from .native_template_installation import KEY as TEMPLATES
from .trusted_actions.validation import Refusal, reference

COMMANDS = (
    "whatsapp/template_registry_v1",
    "whatsapp/template_enqueue_v1",
    "whatsapp/template_job_v1",
    "whatsapp/template_cancel_v1",
    "whatsapp/template_send_v3",
)
_REGISTERED = weakref.WeakKeyDictionary()


async def dispatch(hass, connection, message, command):
    try:
        principal = await host_for(hass).admit(connection, message, command)
        params = principal.parameters
        authority = hass.data[DOMAIN][AUTHORITY]
        authority.grant(principal.owner_key[0].entry)
        installation = hass.data[DOMAIN][TEMPLATES]
        installation.current()
        resources = installation.resources
        if command == COMMANDS[4]:
            from .whatsapp_template_api_v2 import send_v3

            result = await send_v3(hass, connection, principal, params)
        elif command == COMMANDS[0]:
            if params:
                raise Refusal("invalid_fields")
            host = resources.composition.stable().host
            result = {
                "schema_version": 1,
                "state": "ready",
                "templates": [
                    {
                        "account": t.account,
                        "template_ref": t.reference,
                        "expected_template_revision": t.revision,
                        "template_name": t.name,
                        "language": t.language,
                    }
                    for t in host.templates
                ],
            }
        elif command == COMMANDS[1]:
            if set(params) != {"template", "ttl_s"}:
                raise Refusal("invalid_fields")
            result = await resources.jobs.enqueue(principal, params["template"], params["ttl_s"])
        else:
            if set(params) != {"operation_id"}:
                raise Refusal("invalid_fields")
            operation = reference(params["operation_id"])
            row = resources.jobs.state["jobs"].get(operation)
            if row is not None and row["entry_id"] != principal.owner_key[1]:
                raise Refusal("Unauthorized")
            result = (
                await resources.jobs.cancel(operation)
                if command == COMMANDS[3]
                else resources.jobs.public(operation)
            )
        principal.check()
        send_bridge_result(connection, message["id"], result)
    except (Refusal, AccessError) as error:
        connection.send_error(message["id"], error.code, "Installed template request refused")


def register(hass):
    originals = {}
    for command in COMMANDS:

        def handler_for(name):
            @websocket_api.websocket_command(
                vol.All(vol.Schema({"type": DOMAIN + "/" + name}, extra=vol.ALLOW_EXTRA))
            )
            @websocket_api.async_response
            async def handler(hass, connection, message):
                await dispatch(hass, connection, message, name)

            return handler

        websocket_api.async_register_command(hass, handler_for(command))
        originals[command] = hass.data[websocket_api.DOMAIN][DOMAIN + "/" + command]
    _REGISTERED[hass] = originals


def registered(hass):
    return tuple(
        name
        for name, original in _REGISTERED.get(hass, {}).items()
        if hass.data[websocket_api.DOMAIN].get(DOMAIN + "/" + name) is original
    )
