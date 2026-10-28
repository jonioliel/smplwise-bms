"""Original native lifetime for existing HA hold programs; cleanup adds no grant."""

from __future__ import annotations

import weakref
from contextlib import contextmanager
from dataclasses import astuple, dataclass, field

import httpx
from homeassistant.config_entries import ConfigEntryState

from .access.hold_programs import HoldPrograms, detached_hold_scope
from .access.models import AccessError
from .client.client import HikvisionClient
from .client.effect_scope import (
    RequestRule,
    _legacy_owned_cleanup_scope,
    native_effect_scope,
)
from .client.technical import hold_command
from .client.transport import LimitedTransport
from .const import DOMAIN
from .trusted_actions.source_bindings import same_ports

_HOSTS = weakref.WeakKeyDictionary()
_ISSUED = weakref.WeakKeyDictionary()
_RUNTIMES = {}


@dataclass(eq=False)
class _Owner:
    hass: object
    programs: HoldPrograms
    entries: object
    lookup: object
    runtimes: dict = field(default_factory=dict)
    bindings: dict = field(default_factory=dict)
    sessions: dict = field(default_factory=dict)


class _Binding:
    def __init__(self, hass, runtime, item):
        self.hass, self.entries = hass, hass.config_entries
        self.runtime, self.client, self.session = runtime, runtime.client, runtime.session
        self.entry = self.entries.async_get_entry(item["station_id"])
        self.values = item["station_id"], item["door"], item["api_id"], item["identity"]
        self.settings, self.connection = self.client.settings, astuple(self.client.settings)
        self.transport = self.session._transport
        self.locks = runtime.locks
        self.mapping = tuple(sorted(self.client.physical_doors.items()))
        self.enabled = self.client.enabled_doors
        self.ports = (
            self.entries.async_get_entry,
            self.client.async_confirm_identity,
            self.client._get,
            self.client._request,
        )
        _Binding.check(self, cleanup=True)

    def check(self, *, cleanup):
        from .runtime import IntercomRuntime

        sid, physical, api, identity = self.values
        r, c, session = self.runtime, self.client, self.session
        if self.hass.config_entries is not self.entries or not same_ports(
            self.ports,
            (self.entries.async_get_entry, c.async_confirm_identity, c._get, c._request),
        ):
            raise AccessError("station_unloaded")
        if (
            type(r) is not IntercomRuntime
            or type(c) is not HikvisionClient
            or type(session) is not httpx.AsyncClient
            or type(self.transport) is not LimitedTransport
            or self.hass.config_entries is not self.entries
            or self.entry is None
            or self.ports[0](sid) is not self.entry
            or self.entry.domain != DOMAIN
            or self.entry.unique_id != identity
            or self.entry.state
            not in (
                {ConfigEntryState.LOADED, ConfigEntryState.UNLOAD_IN_PROGRESS}
                if cleanup
                else {ConfigEntryState.LOADED}
            )
            or getattr(self.entry, "runtime_data", None) is not r
            or r.hass is not self.hass
            or r.station_id != sid
            or r.client is not c
            or r.session is not session
            or c._session is not session
            or session.is_closed
            or (not cleanup and r.is_closed)
            or c._session._transport is not self.transport
            or c.settings is not self.settings
            or astuple(c.settings) != self.connection
            or c._expected_identity != identity
            or r.profile.unique_id != identity
            or r.locks is not self.locks
            or not any(lock.physical_index == physical and lock.api_id == api for lock in r.locks)
            or c.enabled_doors is not self.enabled
            or api not in self.enabled
            or tuple(sorted(c.physical_doors.items())) != self.mapping
            or c.physical_doors.get(physical) != api
            or not same_ports(
                self.ports,
                (
                    self.entries.async_get_entry,
                    c.async_confirm_identity,
                    c._get,
                    c._request,
                ),
            )
        ):
            raise AccessError("station_unloaded")

    async def send(self, command, current):
        if command not in {"alwaysOpen", "close"}:
            raise AccessError("operation_unsupported")
        cleanup = command == "close"

        def guard():
            current()
            _Binding.check(self, cleanup=cleanup)

        base = self.settings.base_url
        body = (
            '<RemoteControlDoor version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">'
            f"<cmd>{command}</cmd></RemoteControlDoor>"
        ).encode()
        rules = (
            RequestRule("GET", httpx.URL(base + "/ISAPI/System/deviceInfo")),
            RequestRule(
                "GET", httpx.URL(base + "/ISAPI/AccessControl/RemoteControl/door/capabilities")
            ),
            RequestRule(
                "PUT",
                httpx.URL(base + f"/ISAPI/AccessControl/RemoteControl/door/{self.values[2]}"),
                body,
            ),
        )
        guard()
        with native_effect_scope(self.client, guard, rules):
            await hold_command(self.client, self.values[2], command, commissioned=True)
        guard()


class LegacyHoldRuntime:
    def __init__(self, hass, programs):
        if type(programs) is not HoldPrograms or _HOSTS.get(hass) is not None:
            raise AccessError("station_unloaded")
        owner = _Owner(
            weakref.ref(hass), programs, hass.config_entries, hass.config_entries.async_get_entry
        )
        self._keep_owner = lambda: owner
        _ISSUED[self] = weakref.ref(owner)
        _HOSTS[hass] = weakref.ref(self)

    def _owner(self):
        ref = _ISSUED.get(self)
        owner = ref() if ref is not None else None
        hass = owner.hass() if owner is not None else None
        registered = _HOSTS.get(hass) if hass is not None else None
        if type(owner) is not _Owner or registered is None or registered() is not self:
            raise AccessError("station_unloaded")
        return owner

    def attach(self, runtime):
        from .runtime import IntercomRuntime

        owner = LegacyHoldRuntime._owner(self)
        hass, sid = owner.hass(), runtime.station_id
        LegacyHoldRuntime._registry_current(owner)
        entry = owner.lookup(sid)
        if (
            type(runtime) is not IntercomRuntime
            or runtime.hass is not hass
            or entry is None
            or entry.domain != DOMAIN
            or getattr(entry, "runtime_data", None) is not runtime
            or type(runtime.client) is not HikvisionClient
            or type(runtime.session) is not httpx.AsyncClient
            or runtime.client._session is not runtime.session
            or type(runtime.session._transport) is not LimitedTransport
            or runtime.client._expected_identity != entry.unique_id
            or runtime.profile.unique_id != entry.unique_id
        ):
            raise AccessError("station_unloaded")
        previous = owner.runtimes.get(sid)
        if previous is not None and previous is not runtime:
            original = owner.sessions.get(id(previous))
            if original is None or original[0] is not previous or not original[2].is_closed:
                raise AccessError("station_unloaded")
            HoldPrograms.reopen_station(owner.programs, sid)
            for key in tuple(owner.bindings):
                if key.startswith(sid + "/"):
                    owner.bindings.pop(key)
        elif previous is None and HoldPrograms.is_frozen(owner.programs, sid):
            HoldPrograms.reopen_station(owner.programs, sid)
        owner.runtimes[sid] = runtime
        owner.sessions[id(runtime)] = runtime, sid, runtime.session, runtime.session.aclose
        key = id(runtime)

        def retire_host(ref):
            if _RUNTIMES.get(key) is ref:
                _RUNTIMES.pop(key)

        # The native slotted runtime is not weak-referenceable. This primitive
        # index retains only a weak host; its private record verifies the exact
        # original runtime. No global value roots the runtime or HA graph.
        _RUNTIMES[key] = weakref.ref(self, retire_host)

    def original_session_close(self, runtime):
        row = LegacyHoldRuntime._owner(self).sessions.get(id(runtime))
        return row[3] if row is not None and row[0] is runtime else None

    @staticmethod
    def _registry_current(owner):
        hass = owner.hass()
        if (
            hass is None
            or hass.config_entries is not owner.entries
            or not same_ports((owner.lookup,), (owner.entries.async_get_entry,))
        ):
            raise AccessError("station_unloaded")

    def retire_runtime(self, runtime):
        owner = LegacyHoldRuntime._owner(self)
        row = owner.sessions.get(id(runtime))
        if row is None or row[0] is not runtime or not row[2].is_closed:
            return
        sid = row[1]
        if owner.runtimes.get(sid) is runtime:
            owner.runtimes.pop(sid)
        owner.sessions.pop(id(runtime))
        for key, binding in tuple(owner.bindings.items()):
            if binding.runtime is runtime:
                owner.bindings.pop(key)
        issued = _RUNTIMES.get(id(runtime))
        if issued is not None and issued() is self:
            _RUNTIMES.pop(id(runtime))

    async def send(self, item, command):
        owner = LegacyHoldRuntime._owner(self)
        LegacyHoldRuntime._registry_current(owner)
        sid = item["station_id"]
        runtime = owner.runtimes.get(sid)
        if runtime is None:
            raise AccessError("station_unloaded")
        key = f"{sid}/{item['door']}"
        if key not in owner.bindings:
            owner.bindings[key] = _Binding(owner.hass(), runtime, item)
        binding = owner.bindings[key]
        if binding.values != (sid, item["door"], item["api_id"], item["identity"]):
            raise AccessError("station_unloaded")

        def current():
            if (
                LegacyHoldRuntime._owner(self) is not owner
                or owner.runtimes.get(sid) is not runtime
            ):
                raise AccessError("station_unloaded")
            if command == "alwaysOpen" and HoldPrograms.is_frozen(owner.programs, sid):
                raise AccessError("station_unloaded")

        if command == "close" and HoldPrograms.is_cleanup_task(owner.programs, key):
            with _legacy_owned_cleanup_scope(owner.programs, key):
                await _Binding.send(binding, command, current)
        else:
            await _Binding.send(binding, command, current)

    def freeze(self, runtime=None):
        owner = LegacyHoldRuntime._owner(self)
        row = owner.sessions.get(id(runtime)) if runtime is not None else None
        if runtime is not None and (row is None or row[0] is not runtime):
            return
        HoldPrograms.freeze(owner.programs, row[1] if row is not None else None)

    def owns_current(self):
        return HoldPrograms.owns_current(LegacyHoldRuntime._owner(self).programs)

    async def close(self, runtime=None):
        owner = LegacyHoldRuntime._owner(self)
        row = owner.sessions.get(id(runtime)) if runtime is not None else None
        if runtime is not None and (row is None or row[0] is not runtime):
            return
        await HoldPrograms.close(owner.programs, row[1] if row is not None else None)

    async def retire_failed_setup(self):
        """Release an original unattached lifetime after failed component setup.

        An attached station or failed close retains ownership; this cannot retire
        another runtime or infer that an unknown physical hold has ended.
        """
        owner = LegacyHoldRuntime._owner(self)
        if owner.runtimes or owner.sessions or owner.bindings:
            raise AccessError("station_unloaded")
        LegacyHoldRuntime.freeze(self)
        with LegacyHoldRuntime.detached(self):
            await LegacyHoldRuntime.close(self)
        hass = owner.hass()
        registered = _HOSTS.get(hass)
        if registered is not None and registered() is self:
            del _HOSTS[hass]

    @contextmanager
    def detached(self):
        with detached_hold_scope(LegacyHoldRuntime._owner(self).programs):
            yield


def original_legacy_holds(hass, runtime=None):
    if runtime is not None:
        ref = _RUNTIMES.get(id(runtime))
        host = ref() if ref is not None else None
        if host is not None:
            owner = LegacyHoldRuntime._owner(host)
            row = owner.sessions.get(id(runtime))
            if row is not None and row[0] is runtime:
                return host
    registered = _HOSTS.get(hass)
    return registered() if registered is not None else None
