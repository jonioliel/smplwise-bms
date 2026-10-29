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
    "installation/readiness_v1",
    "events/retention_policy_v1",
    "installation/retire_v1",
    "installation/request_restart_v1",
    "media/station_snapshot_v1",
    "installation/request_restart_v2",
    "installation/capability_preflight_v1",
    "installation/template_source_status_v1",
)
_REGISTERED = weakref.WeakKeyDictionary()


async def dispatch(hass, connection, message, command):
    try:
        principal = await host_for(hass).admit(connection, message, command)
        params = principal.parameters
        authority = hass.data[DOMAIN][AUTHORITY]
        if command != COMMANDS[7]:
            authority.grant(principal.owner_key[0].entry)
        if command in COMMANDS[5:]:
            if command not in {COMMANDS[9], COMMANDS[10]} and params:
                raise Refusal("invalid_fields")
            if command == COMMANDS[12]:
                from .existing_whatsapp_source import inspect as source_status

                result = await hass.async_add_executor_job(source_status, hass.config.config_dir)
            elif command == COMMANDS[11]:
                from .capability_preflight import inspect as preflight

                result = await hass.async_add_executor_job(preflight)
            elif command == COMMANDS[10]:
                from .installation_controller import execute_restart

                result = await execute_restart(hass, principal, params)
            elif command == COMMANDS[9]:
                from .station_snapshot import snapshot

                result = await snapshot(hass, principal, params)
            elif command == COMMANDS[8]:
                from .installation_readiness import request_restart

                result = await request_restart(hass, principal)
            elif command == COMMANDS[7]:
                result = await authority.retire(principal.owner_key[0].entry)
            elif command == COMMANDS[5]:
                from .installation_readiness import inspect
                from .trusted_actions.direct_bridge_origin import check_connection

                result = await hass.async_add_executor_job(inspect, hass)
                # This challenge belongs to the original currently authenticated
                # connection, not a caller-provided or stale handshake token.
                result["connection_ref"] = check_connection(connection).challenge
                result["bridge_entry_id"] = principal.owner_key[1]
                result["installation_id"] = authority.state["installation_id"]
                result["grant_ref"] = authority.grant(principal.owner_key[0].entry)
                result["cloud_resources_state"] = hass.data[DOMAIN][TEMPLATES].state
            else:
                manager = hass.data[DOMAIN]["events"]
                result = {
                    "contract": "wiskey-event-retention.v1",
                    "schema_version": 1,
                    "effective": {
                        "days": manager.cache.days,
                        "count": manager.cache.limit,
                        "bytes": manager.cache.maximum_bytes,
                    },
                    "order": "local_acceptance_sequence",
                    "delivery": "at_least_once",
                    "age_basis": "received_at",
                    "minimum_days_guaranteed": False,
                }
        else:
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
                result = await resources.jobs.enqueue(
                    principal, params["template"], params["ttl_s"]
                )
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
