"""Registered closed template route; absent native composition refuses explicitly."""

from __future__ import annotations

import asyncio
import weakref

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import callback

from .bridge_command_auth import host_for, send_bridge_result
from .const import DOMAIN
from .media_lifetime import join_owned
from .trusted_actions.bridge_transport_origin import bind_origin, check_origin
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.validation import Refusal
from .whatsapp_template_runtime_v1 import (
    COMMAND,
    KEY,
    NativeTemplateSendHostV1,
    _encoded,
    descriptor,
)

_REGISTERED = weakref.WeakKeyDictionary()
_BOUND = weakref.WeakKeyDictionary()
_FAILED = weakref.WeakKeyDictionary()


def _host(hass):
    bound = _BOUND.get(hass)
    if bound is None:
        raise Refusal("template_source_not_installed")
    _check_bound(hass, bound)
    host = bound[0]
    NativeTemplateSendHostV1.stable(host)
    _check_bound(hass, bound)
    return host


def _check_bound(hass, bound):
    host, namespace, _, entry, runtime = bound[:5]
    if (
        type(host) is not NativeTemplateSendHostV1
        or _BOUND.get(hass) is not bound
        or hass.data is not bound[6]
        or hass.data.get(DOMAIN) is not namespace
        or namespace.get(KEY) is not host
        or namespace.get("access") is not bound[9]
        or host.manager is not bound[9]
        or hass.config_entries is not bound[7]
        or not same_ports((bound[8],), (hass.config_entries.async_get_entry,))
        or bound[8](entry.entry_id) is not entry
        or entry.runtime_data is not runtime
        or runtime.access_manager is not bound[9]
        or runtime.hass is not hass
        or runtime.is_closed
    ):
        raise Refusal("template_source_not_installed")


def bind_template_host_v1(hass, host, *, entry):
    """Trusted native composition only; no JSON or service installer exists."""
    if (
        type(host) is not NativeTemplateSendHostV1
        or hass in _BOUND
        or hass in _FAILED
        or hass.is_stopping
    ):
        raise Refusal("template_source_not_installed")
    from .runtime import IntercomRuntime

    original_runtime = entry.runtime_data
    original_data, original_config = hass.data, hass.config_entries
    original_get_entry = hass.config_entries.async_get_entry
    original_namespace = hass.data.get(DOMAIN)
    if (
        hass.config_entries.async_get_entry(entry.entry_id) is not entry
        or entry.domain != DOMAIN
        or type(entry.runtime_data) is not IntercomRuntime
        or entry.runtime_data.access_manager is not host.manager
        or entry.runtime_data.is_closed
    ):
        raise Refusal("template_source_not_installed")
    NativeTemplateSendHostV1.stable(host)
    namespace = original_namespace
    if (
        type(namespace) is not dict
        or hass.data is not original_data
        or hass.data.get(DOMAIN) is not namespace
        or hass.config_entries is not original_config
        or not same_ports((original_get_entry,), (hass.config_entries.async_get_entry,))
        or entry.runtime_data is not original_runtime
        or namespace.get(KEY) is not None
        or namespace.get("access") is not host.manager
    ):
        raise Refusal("template_source_not_installed")
    namespace[KEY] = host
    stop_task = [None]
    listener_consumed = [False]
    original_binding = [None]

    async def finish():
        try:
            await NativeTemplateSendHostV1.close(host)
            from .whatsapp_template_composition import retire_native_template_composition

            retire_native_template_composition(hass, host)
        except Exception:
            namespace[KEY + "_blocker"] = "cleanup_failed"
            _FAILED[hass] = original_binding[0]
            raise

    @callback
    def stopping(_event):
        listener_consumed[0] = True
        NativeTemplateSendHostV1.stop(host)
        if stop_task[0] is None:
            stop_task[0] = hass.async_create_task(finish(), "wiskey-template-v1-stop")

    unsubscribe = hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stopping)
    _BOUND[hass] = (
        host,
        namespace,
        unsubscribe,
        entry,
        original_runtime,
        stop_task,
        original_data,
        original_config,
        original_get_entry,
        host.manager,
        listener_consumed,
    )
    original_binding[0] = _BOUND[hass]
    _check_bound(hass, _BOUND[hass])


async def unbind_template_host_v1(hass, *, entry=None, host=None):
    original = _FAILED.get(hass) or _BOUND.get(hass)
    if original is None:
        return
    if entry is not None and original[3] is not entry:
        return
    if host is not None and original[0] is not host:
        return
    host, namespace, unsubscribe = original[:3]
    if not original[10][0]:
        original[10][0] = True
        unsubscribe()
    NativeTemplateSendHostV1.stop(host)
    cancelled = False
    try:
        if original[5][0] is not None:
            _, cancelled = await join_owned(original[5][0])
        await NativeTemplateSendHostV1.close(host)
        from .whatsapp_template_composition import retire_native_template_composition

        retire_native_template_composition(hass, host)
        if cancelled:
            raise asyncio.CancelledError
    except Exception:
        namespace[KEY + "_blocker"] = "cleanup_failed"
        _FAILED[hass] = original
        raise
    finally:
        if _FAILED.get(hass) is not original:
            if namespace.get(KEY) is host:
                namespace.pop(KEY)
            if _BOUND.get(hass) is original:
                _BOUND.pop(hass)


@websocket_api.websocket_command(
    vol.All(vol.Schema({"type": DOMAIN + "/" + COMMAND}, extra=vol.ALLOW_EXTRA))
)
@websocket_api.async_response
async def _handle(hass, connection, msg):
    try:
        if isinstance(msg.get("bridge"), dict) and msg["bridge"].get("kind") == (
            "wiskey-bridge-command.v1"
        ):
            principal = await host_for(hass).admit(connection, msg, COMMAND)
            request = descriptor(principal.parameters)
            host = _host(hass)

            def bridge_current():
                principal.check()
                if _host(hass) is not host:
                    raise Refusal("template_source_not_installed")
                NativeTemplateSendHostV1.stable(host)

            bridge_current()
            result = await NativeTemplateSendHostV1.send_bridge(
                host,
                connection,
                request,
                principal,
                bridge_current,
                request_identity=_encoded(request),
            )
            bridge_current()
            send_bridge_result(connection, msg["id"], result)
            return
        origin = bind_origin(hass, connection)
        if set(msg) != {"id", "type", "template"} or type(msg["id"]) is not int or msg["id"] < 1:
            raise Refusal("invalid_fields")
        request = descriptor(msg["template"])
        host = _host(hass)

        def current():
            check_origin(origin)
            if _host(hass) is not host:
                raise Refusal("template_source_not_installed")

        result = await NativeTemplateSendHostV1.send(host, connection, request, current)
        current()
    except Refusal as error:
        code = (
            error.code
            if error.code
            in {
                "Unauthorized",
                "invalid_fields",
                "operation_conflict",
                "template_source_not_installed",
                "template_source_unavailable",
                "template_capacity_reached",
            }
            else "template_source_unavailable"
        )
        connection.send_error(msg["id"], code, "Template action unavailable")
    except asyncio.CancelledError:
        raise
    except Exception:
        connection.send_error(
            msg["id"], "template_source_unavailable", "Template action unavailable"
        )
    else:
        connection.send_result(msg["id"], result)


@callback
def register_template_api_v1(hass):
    websocket_api.async_register_command(hass, _handle)
    table = hass.data[websocket_api.DOMAIN]
    _REGISTERED[hass] = table, table[DOMAIN + "/" + COMMAND]


def registered_template_commands_v1(hass):
    original = _REGISTERED.get(hass)
    table = hass.data.get(websocket_api.DOMAIN)
    if (
        original is None
        or table is not original[0]
        or table.get(DOMAIN + "/" + COMMAND) is not original[1]
    ):
        return ()
    return (COMMAND,)
