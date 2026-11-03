"""Finite original-source refresh subscriptions, independent of panel roles."""

from __future__ import annotations

import weakref
from dataclasses import dataclass

from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .access_runtime import SIGNAL_ACCESS_CHANGED
from .bridge_command_auth import (
    BridgeExecutionBinding,
    host_for,
    retain_execution,
    send_bridge_result,
)
from .trusted_actions.validation import Refusal, aware

KIND = "wiskey-bridge-subscription.v1"
MAX_PER_CONNECTION = 4
_ACTIVE = weakref.WeakSet()
_REGISTERED = weakref.WeakKeyDictionary()


@dataclass(eq=False, repr=False)
class _Owner:
    binding: object
    connection: object
    subscriptions: dict
    message_id: int
    hass: object = None
    host: object = None
    closed: bool = False
    timer: object = None
    expiry: object = None
    stop: object = None
    unsub: object = None
    cancel: object = None
    source_remove: object = None


def record_registration(hass, original):
    _REGISTERED[hass] = original


def close_bridge_subscriptions(hass, host):
    """Close only subscriptions issued by this exact original command host."""
    for row in tuple(_ACTIVE):
        if row.host is host and row.hass() is hass:
            row.cancel()


def registered_bridge_subscriptions(hass):
    from homeassistant.components import websocket_api

    from .const import DOMAIN

    original = _REGISTERED.get(hass)
    return (
        ("subscribe",)
        if original is not None
        and (hass.data.get(websocket_api.DOMAIN, {}).get(DOMAIN + "/subscribe") is original)
        else ()
    )


async def admit_subscription(hass, connection, message):
    principal = await host_for(hass).admit(connection, message, "subscribe")
    parameters = principal.parameters
    if set(parameters) != {"expires_at"}:
        raise Refusal("invalid_fields")
    deadline = aware(parameters["expires_at"])
    binding = retain_execution(principal, deadline)
    table = connection.subscriptions
    if (
        sum(not row.closed and row.connection is connection for row in _ACTIVE)
        >= MAX_PER_CONNECTION
    ):
        raise Refusal("subscription_capacity")
    if type(table) is not dict or message["id"] in table:
        raise Refusal("invalid_fields")
    # The retained source owns the clock. This is a finite operation lease,
    # never a renewed command proof, User or inherited command_scope.
    from .bridge_command_auth import _EXECUTIONS, BridgeCommandHost

    original_host = _EXECUTIONS[binding][0]
    source_entry = _EXECUTIONS[binding][3].entry
    source = BridgeCommandHost._owner(original_host)
    seconds = (deadline - source.auth.clock().now).total_seconds()
    if seconds <= 0:
        raise Refusal("invalid_execution_deadline")
    row = _Owner(binding, connection, table, message["id"])
    row.hass, row.host = weakref.ref(hass), original_host

    @callback
    def cancel():
        if row.closed:
            return
        row.closed = True
        for timer in (row.timer, row.expiry):
            if timer is not None:
                timer.cancel()
        row.timer = row.expiry = None
        if row.unsub is not None:
            row.unsub()
            row.unsub = None
        if row.stop is not None:
            row.stop()
            row.stop = None

        @callback
        def detach():
            if row.source_remove is not None:
                row.source_remove()
                row.source_remove = None
            if row.subscriptions.get(row.message_id) is cancel:
                row.subscriptions.pop(row.message_id)

        # HA iterates subscriptions.values() synchronously on disconnect.
        # Release owned listeners/timers now; mutate its table on the next
        # loop turn, after HA finishes that original iteration/clear. Source
        # entry listeners also run eagerly while HA iterates their list.
        if not hass.loop.is_closed():
            hass.loop.call_soon(detach)
        _ACTIVE.discard(row)

    def current():
        if (
            row.closed
            or row.connection.subscriptions is not row.subscriptions
            or row.subscriptions.get(row.message_id) is not cancel
        ):
            raise Refusal("binding_denied")
        BridgeExecutionBinding.check(row.binding)

    @callback
    def send():
        row.timer = None
        try:
            current()
        except Exception:
            cancel()
            return
        connection.send_event(row.message_id, {"kind": "refresh"})

    @callback
    def changed():
        try:
            current()
        except Exception:
            cancel()
            return
        if row.timer is None:
            row.timer = hass.loop.call_later(0.25, send)

    @callback
    def stop(_event):
        row.stop = None  # Original listen_once already removed itself.
        cancel()

    async def source_updated(updated_hass, updated_entry):
        if updated_hass is hass and updated_entry is source_entry:
            cancel()

    row.cancel = cancel
    try:
        row.unsub = async_dispatcher_connect(hass, SIGNAL_ACCESS_CHANGED, changed)
        row.stop = hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stop)
        row.source_remove = source_entry.add_update_listener(source_updated)
        row.expiry = hass.loop.call_later(seconds, cancel)
        table[row.message_id] = cancel
        _ACTIVE.add(row)
        principal.check()
        current()
        send_bridge_result(
            connection,
            message["id"],
            {"kind": KIND, "schema_version": 1, "expires_at": deadline.isoformat()},
        )
    except BaseException:
        cancel()
        raise
