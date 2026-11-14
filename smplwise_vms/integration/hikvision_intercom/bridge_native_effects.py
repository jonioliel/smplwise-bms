"""Extra source refusal for legacy bridge native HTTP; never an effect grant.

Existing fixed-path native handlers remain the writers. Capture actual station,
runtime and session at admission; recheck at every transport attempt and chunk,
including Digest and queue waits. Private settings stay only in memory.
"""

from __future__ import annotations

import asyncio
from dataclasses import astuple, dataclass
from typing import TYPE_CHECKING, Any

import httpx

from .bridge_command_scope import _SCOPE
from .const import DOMAIN
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.validation import Refusal

_PORTS = ("async_confirm_identity", "_get", "_request", "async_unlock")


if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant


@dataclass(frozen=True, repr=False)
class _Origin:
    entries: object
    entry: ConfigEntry[Any]
    runtime: object
    client: object
    session: object
    transport: object
    delegate: object
    settings: object
    configuration: tuple
    identity: object
    profile: object
    locks: object
    enabled: object
    mapping: tuple
    ports: tuple
    entry_port: object
    base: object


def bind_native_origins(principal):
    from homeassistant.config_entries import ConfigEntryState

    from .bridge_command_auth import _PRINCIPALS, BridgeCommandHost, VerifiedBridgePrincipal
    from .client.client import HikvisionClient
    from .client.transport import LimitedTransport
    from .runtime import IntercomRuntime

    if type(principal) is not VerifiedBridgePrincipal:
        raise Refusal("Unauthorized")
    principal.check()
    owner = BridgeCommandHost._owner(_PRINCIPALS[principal][0])
    entries = owner.hass.config_entries
    result = []
    for entry in entries.async_entries(DOMAIN):
        runtime = getattr(entry, "runtime_data", None)
        if entry.state is not ConfigEntryState.LOADED or runtime is None:
            continue
        if (
            type(runtime) is not IntercomRuntime
            or runtime.hass is not owner.hass
            or runtime.station_id != entry.entry_id
            or runtime.is_closed
            or type(runtime.client) is not HikvisionClient
            or runtime.client._session is not runtime.session
            or type(runtime.session._transport) is not LimitedTransport
        ):
            # A broken/closing station gets no native origin. It must not
            # disable unrelated owner CRUD or another independent station.
            # Any attempt on an unbound transport still refuses below.
            continue
        client = runtime.client
        result.append(
            _Origin(
                entries,
                entry,
                runtime,
                client,
                runtime.session,
                runtime.session._transport,
                runtime.session._transport._transport,
                client.settings,
                astuple(client.settings),
                client._expected_identity,
                runtime.profile,
                runtime.locks,
                client.enabled_doors,
                tuple(sorted(client.physical_doors.items())),
                tuple(getattr(client, name) for name in _PORTS),
                entries.async_get_entry,
                httpx.URL(client.settings.base_url),
            )
        )
    principal.check()
    return tuple(result)


def check_native_origin(hass: HomeAssistant, origin: _Origin) -> None:
    """Extra refusal for the exact native origin captured at admission.

    This does not admit a command or an effect. Retained native job composition
    must separately present its genuine finite source and exact request rules.
    """
    from homeassistant.config_entries import ConfigEntryState

    if type(origin) is not _Origin:
        raise Refusal("binding_denied")
    o = origin
    r, c = o.runtime, o.client
    if (
        hass.config_entries is not o.entries
        or not same_ports((o.entry_port,), (o.entries.async_get_entry,))
        or o.entries.async_get_entry(o.entry.entry_id) is not o.entry
        or o.entry.state is not ConfigEntryState.LOADED
        or o.entry.runtime_data is not r
        or r.hass is not hass
        or r.station_id != o.entry.entry_id
        or r.is_closed
        or r.client is not c
        or r.session is not o.session
        or c._session is not o.session
        or o.session.is_closed
        or o.session._transport is not o.transport
        or o.transport._transport is not o.delegate
        or c.settings is not o.settings
        or astuple(c.settings) != o.configuration
        or c._expected_identity != o.identity
        or r.profile is not o.profile
        or r.locks is not o.locks
        or c.enabled_doors is not o.enabled
        or tuple(sorted(c.physical_doors.items())) != o.mapping
        or not same_ports(o.ports, tuple(getattr(c, name) for name in _PORTS))
    ):
        raise Refusal("binding_denied")


def check_native_request(request, transport):
    scope = _SCOPE.get()
    if scope is None:
        return
    from .bridge_command_auth import _PRINCIPALS, BridgeCommandHost, _CommandScope

    if (
        type(scope) is not _CommandScope
        or not scope.active
        or scope.task is not asyncio.current_task()
    ):
        raise Refusal("binding_denied")
    scope.principal.check()
    owner = BridgeCommandHost._owner(_PRINCIPALS[scope.principal][0])
    matches = [origin for origin in scope.native_origins if origin.transport is transport]
    if len(matches) != 1:
        raise Refusal("binding_denied")
    o = matches[0]
    check_native_origin(owner.hass, o)
    if (request.url.scheme, request.url.host, request.url.port) != (
        o.base.scheme,
        o.base.host,
        o.base.port,
    ):
        raise Refusal("binding_denied")
    scope.principal.check()
    if _SCOPE.get() is not scope or not scope.active:
        raise Refusal("binding_denied")
    if scope.task.cancelling():
        raise asyncio.CancelledError
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        # Conservative possible dispatch, never delivery or proof of not_sent.
        scope.native_attempted = True
