"""Explicit owner startup binding for durable native emergency refusals only.

No wire input, discovery, peer admission, command or automatic configuration is
provided. An absent registration leaves ordinary startup unchanged.
"""

from __future__ import annotations

import weakref
from dataclasses import astuple, dataclass

import httpx
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.core import HomeAssistant

from ..client.client import ConnectionSettings, HikvisionClient
from ..client.emergency_fence import (
    EmergencyDoorFence,
    _retain_mapping_claim,
    _retain_mapping_failure,
)
from ..client.transport import LimitedTransport
from ..configuration import managed_locks
from ..const import DOMAIN
from ..trusted_actions.source_bindings import same_ports
from ..trusted_actions.validation import Refusal
from .arx_execution_authority import StationGrant
from .arx_execution_journal import FeatureExecutionJournal

_KEY = "native_emergency_recovery"
_REGISTERED = weakref.WeakKeyDictionary()
_OWNERS = weakref.WeakKeyDictionary()


@dataclass(frozen=True, eq=False, repr=False)
class RecoveryStation:
    """Owner-selected actual entry, expected identity and complete relay grants."""

    entry: ConfigEntry
    identity: str
    grants: tuple[StationGrant, ...]

    def __post_init__(self):
        if (
            not isinstance(self.entry, ConfigEntry)
            or self.entry.domain != DOMAIN
            or type(self.identity) is not str
            or not 1 <= len(self.identity) <= 256
            or self.entry.unique_id != self.identity
            or type(self.grants) is not tuple
            or not 1 <= len(self.grants) <= 2
            or any(type(g) is not StationGrant for g in self.grants)
            or any(g.station_id != self.entry.entry_id for g in self.grants)
            or len({g.api_relay for g in self.grants}) != len(self.grants)
            or len({g.physical_relay for g in self.grants}) != len(self.grants)
        ):
            raise Refusal("binding_denied")
        for grant in self.grants:
            StationGrant.__post_init__(grant)


@dataclass(frozen=True, repr=False)
class _Station:
    binding: weakref.ReferenceType
    entry: weakref.ReferenceType
    identity: str
    grants: tuple
    grant_values: tuple
    connection: tuple
    mapping: tuple


@dataclass(frozen=True, repr=False)
class _Owner:
    hass: weakref.ReferenceType
    entries: weakref.ReferenceType
    journal: FeatureExecutionJournal
    ports: tuple
    stations: tuple[_Station, ...]
    domain_id: int


def _issue(owner):
    """Keep only weak objects and original primitive metadata in module state."""
    return (
        weakref.ref(owner),
        owner.hass,
        owner.entries,
        weakref.ref(owner.journal),
        tuple((weakref.ref(port.__self__), port.__func__) for port in owner.ports),
        tuple(
            (
                weakref.ref(station),
                station.binding,
                station.entry,
                station.identity,
                (id(station.grants), tuple(weakref.ref(grant) for grant in station.grants)),
                station.grant_values,
                station.connection,
                station.mapping,
            )
            for station in owner.stations
        ),
        owner.domain_id,
    )


def _issued(config):
    issued = _OWNERS.get(config)
    owner = issued[0]() if issued is not None else None
    if (
        owner is None
        or getattr(config, "_owner", None) is not owner
        or owner.hass is not issued[1]
        or owner.entries is not issued[2]
        or owner.journal is not issued[3]()
        or owner.domain_id != issued[6]
        or type(owner.ports) is not tuple
        or len(owner.ports) != len(issued[4])
        or type(owner.stations) is not tuple
        or len(owner.stations) != len(issued[5])
    ):
        raise Refusal("binding_denied")
    for port, (original, function) in zip(owner.ports, issued[4], strict=True):
        if (
            getattr(port, "__self__", None) is not original()
            or getattr(port, "__func__", None) is not function
        ):
            raise Refusal("binding_denied")
    for station, values in zip(owner.stations, issued[5], strict=True):
        if (
            station is not values[0]()
            or station.binding is not values[1]
            or station.entry is not values[2]
            or station.identity != values[3]
            or id(station.grants) != values[4][0]
            or len(station.grants) != len(values[4][1])
            or any(
                grant is not ref() for grant, ref in zip(station.grants, values[4][1], strict=True)
            )
            or station.grant_values != values[5]
            or station.connection != values[6]
            or station.mapping != values[7]
        ):
            raise Refusal("binding_denied")
    return owner


class NativeEmergencyRecovery:
    """Register once from explicit owner configuration before station setup.

    The host retains the original object in HA data. Deleting/replacing that
    alias does not turn a configured installation into an unconfigured one.
    The original journal remains independently host-owned and is never closed
    or rewritten here. Normal fresh authorized emergency release stays separate.
    """

    def __init__(
        self, hass, journal: FeatureExecutionJournal, stations: tuple[RecoveryStation, ...]
    ):
        if (
            type(hass) is not HomeAssistant
            or type(journal) is not FeatureExecutionJournal
            or type(stations) is not tuple
            or not 1 <= len(stations) <= 200
            or any(type(s) is not RecoveryStation for s in stations)
            or len({s.entry.entry_id for s in stations}) != len(stations)
            or hass in _REGISTERED
        ):
            raise Refusal("binding_denied")
        records = []
        for station in stations:
            RecoveryStation.__post_init__(station)
            entry = station.entry
            mapping = tuple(
                (lock.physical_index, lock.api_id) for lock in managed_locks(entry.data)
            )
            if (
                hass.config_entries.async_get_entry(entry.entry_id) is not entry
                or entry.state is not ConfigEntryState.NOT_LOADED
                or getattr(entry, "runtime_data", None) is not None
                or set(mapping) != {(g.physical_relay, g.api_relay) for g in station.grants}
            ):
                raise Refusal("binding_denied")
            records.append(
                _Station(
                    weakref.ref(station),
                    weakref.ref(entry),
                    station.identity,
                    station.grants,
                    tuple(astuple(grant) for grant in station.grants),
                    astuple(ConnectionSettings.from_mapping(entry.data)),
                    mapping,
                )
            )
        domain = hass.data.setdefault(DOMAIN, {})
        if _KEY in domain:
            raise Refusal("binding_denied")
        self.journal, self.stations = journal, stations
        owner = _Owner(
            weakref.ref(hass),
            weakref.ref(hass.config_entries),
            journal,
            (journal.pending_secure_claims, hass.config_entries.async_get_entry),
            tuple(records),
            id(domain),
        )
        # The host/config owns this graph. Module issuance retains only weak
        # references, so original journals/leases/HA registry ports cannot root
        # the entire HA installation globally through its configuration alias.
        self._owner = owner
        _OWNERS[self] = _issue(owner)
        NativeEmergencyRecovery._current(self, owner, registered=False)
        # Original owner/station validation has established a configured
        # installation. Keep a deny-only tombstone even if full journal/claim
        # validation fails and this constructor/object is subsequently ignored
        # or collected. Failure can never restore the unconfigured default.
        _REGISTERED[hass] = weakref.ref(self)
        # Validate the complete original journal against all exact configured
        # station grants before publication. Otherwise a fresh config flow can
        # reach mapping before an original station runtime installs its fence.
        # Unbound/corrupt claims refuse registration, never a partial allow.
        try:
            claims = NativeEmergencyRecovery._claims(self, owner)
            NativeEmergencyRecovery._current(self, owner, registered=False)
            for item in claims:
                _retain_mapping_claim(item["claim"], item["target_signature"])
        except BaseException:
            _retain_mapping_failure(hass)
            raise
        # Every station setup still rechecks the original source. Retained
        # primitive claims grant nothing and survive missing-close transport GC.
        domain[_KEY] = self
        _REGISTERED[hass] = weakref.ref(self)

    def _current(self, owner, *, registered=True):
        hass, entries = owner.hass(), owner.entries()
        if (
            _issued(self) is not owner
            or hass is None
            or entries is None
            or hass.config_entries is not entries
            or self.journal is not owner.journal
            or type(self.stations) is not tuple
            or len(self.stations) != len(owner.stations)
            or id(hass.data.get(DOMAIN)) != owner.domain_id
            or not same_ports(
                owner.ports, (owner.journal.pending_secure_claims, entries.async_get_entry)
            )
            or (
                registered
                and (
                    _REGISTERED.get(hass) is None
                    or _REGISTERED[hass]() is not self
                    or hass.data[DOMAIN].get(_KEY) is not self
                )
            )
            or (not registered and _KEY in hass.data[DOMAIN])
        ):
            raise Refusal("binding_denied")
        for public, station in zip(self.stations, owner.stations, strict=True):
            entry = station.entry()
            if (
                public is not station.binding()
                or entry is None
                or public.entry is not entry
                or public.identity != station.identity
                or public.grants is not station.grants
                or tuple(astuple(grant) for grant in public.grants) != station.grant_values
                or entries.async_get_entry(entry.entry_id) is not entry
                or entry.unique_id != station.identity
                or astuple(ConnectionSettings.from_mapping(entry.data)) != station.connection
                or tuple((lock.physical_index, lock.api_id) for lock in managed_locks(entry.data))
                != station.mapping
            ):
                raise Refusal("binding_denied")

    def _claims(self, owner):
        claims = owner.ports[0]()
        expected = {
            (
                grant[0],
                grant[1],
                grant[2],
                grant[3],
                station.identity,
            )
            for station in owner.stations
            for grant in station.grant_values
        }
        if any(item["target_signature"] not in expected for item in claims):
            raise Refusal("emergency_recovery_unbound")
        return claims


def restore_startup_refusals(hass, entry: ConfigEntry, runtime) -> None:
    """Run synchronously before the new original runtime is published."""
    registered = _REGISTERED.get(hass)
    if registered is None:
        return
    config = registered()
    if config is None:
        raise Refusal("binding_denied")
    owner = _issued(config)
    NativeEmergencyRecovery._current(config, owner)
    from ..runtime import IntercomRuntime

    station = next((s for s in owner.stations if s.entry() is entry), None)
    client = runtime.client
    session = runtime.session
    if (
        station is None
        or type(runtime) is not IntercomRuntime
        or type(client) is not HikvisionClient
        or type(session) is not httpx.AsyncClient
        or type(session._transport) is not LimitedTransport
        or client._session is not session
        or runtime.hass is not hass
        or runtime.station_id != entry.entry_id
        or runtime.is_closed
        or entry.state is not ConfigEntryState.SETUP_IN_PROGRESS
        or getattr(entry, "runtime_data", None) is runtime
        or client._expected_identity != station.identity
        or runtime.profile.unique_id != station.identity
        or astuple(client.settings) != station.connection
        or tuple((lock.physical_index, lock.api_id) for lock in runtime.locks) != station.mapping
        or tuple(sorted(client.physical_doors.items())) != tuple(sorted(station.mapping))
        or client.enabled_doors != frozenset(api for _, api in station.mapping)
    ):
        raise Refusal("binding_denied")
    transport = session._transport
    for item in NativeEmergencyRecovery._claims(config, owner):
        sid, api, _physical, _revision, _identity = item["target_signature"]
        if sid != entry.entry_id:
            # Other explicitly bound entries may not yet be loaded. Their
            # obligations remain durable until their own original setup hook.
            continue
        url = httpx.URL(client.settings.base_url + f"/ISAPI/AccessControl/RemoteControl/door/{api}")
        fence = EmergencyDoorFence.existing(transport, url)
        if fence is None:
            EmergencyDoorFence(transport, url, item["claim"], item["target_signature"])
        elif fence.claim != item["claim"] or fence.target_signature != item["target_signature"]:
            raise Refusal("emergency_claim_conflict")
        else:
            fence.check()
    NativeEmergencyRecovery._current(config, owner)
