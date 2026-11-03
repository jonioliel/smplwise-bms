"""Bind the installed original bridge's public capture API, without its keys.

This adapter retains the actual modules, HA entry/services, capability and
registration. It adds the capability's protocol to the native DTO9 projection;
it never constructs a DTO, signature, digest, actor grant or cleanup receipt.
The collector and current actor/policy ports still require their own original
sources. No configuration flag or discovery metadata installs those sources.
"""

from __future__ import annotations

import sys
from collections.abc import Callable
from dataclasses import dataclass, field
from types import FunctionType, ModuleType
from typing import TYPE_CHECKING
from weakref import ReferenceType, WeakKeyDictionary
from weakref import ref as weakref_ref

from homeassistant.config_entries import ConfigEntries, ConfigEntry, ConfigEntryState
from homeassistant.core import HomeAssistant, Service, ServiceRegistry, SupportsResponse

from .trusted_actions.capture_lease_host import CaptureLeaseHost
from .trusted_actions.envelope import ClockSample, freeze
from .trusted_actions.lease_experimental import LeaseAuthority, LeaseRejected
from .trusted_actions.source_bindings import same_identities, same_ports

if TYPE_CHECKING:
    from .capture_lease_runtime import CaptureLeaseConsumer

_BRIDGE = "custom_components.smplwise_bridge"
_OWNER = "wiskey_capture"
_PROTOCOL = "wiskey-capture-lease-v1"
_SERVICES = ("lease_event", "lease_request")
_DTO_FIELDS = frozenset(
    {
        "action",
        "actor",
        "station",
        "params",
        "request_id",
        "nonce",
        "issued_at",
        "expires_at",
        "body_sha256",
    }
)


@dataclass(frozen=True)
class _ServiceOwner:
    service: Service
    job: object
    handler: FunctionType
    schema: object


@dataclass
class _BridgeOwner:
    hass: HomeAssistant
    entry: ConfigEntry
    registry: ServiceRegistry
    entry_registry: ConfigEntries
    modules: tuple[tuple[str, ModuleType], ...]
    module_ports: tuple[object, ...]
    class_ports: tuple[object, ...]
    capability: object
    capability_type: type
    registration_type: type
    dto_type: type
    get_capability: Callable[..., object]
    owns: Callable[..., object]
    verify_dto: Callable[..., object]
    as_json: Callable[..., object]
    services: tuple[_ServiceOwner, ...]
    registration: object = None
    pending: bool = True
    retired: bool = False
    consumer: object = None
    ports: tuple[object, ...] = field(default_factory=tuple)


_OWNERS: WeakKeyDictionary[NativeCaptureBridgeSource, ReferenceType[_BridgeOwner]] = (
    WeakKeyDictionary()
)


def _owner(source: NativeCaptureBridgeSource) -> _BridgeOwner | None:
    reference = _OWNERS.get(source)
    owner = reference() if reference is not None else None
    return owner if owner is not None and source._owner is owner else None


def _module_ports(service: ModuleType, contract: ModuleType) -> tuple[object, ...]:
    return (
        tuple(
            getattr(service, name, None)
            for name in (
                "async_get_capability",
                "is_bridge_capability",
                "async_register_consumer",
                "LeaseCapability",
                "LeaseRegistration",
                "LeaseDTO",
            )
        )
        + (getattr(contract, "LeaseDTO", None), getattr(contract, "PROTOCOL", None))
        + tuple(
            getattr(service, name, None)
            for name in (
                "async_handle",
                "async_attach_bridge",
                "async_detach_bridge",
                "validate",
                "_dispatch",
            )
        )
        + tuple(
            getattr(contract, name, None)
            for name in ("validate", "check_schema", "loads", "_verify")
        )
    )


def _class_ports(capability: type, registration: type, dto: type) -> tuple[object, ...]:
    return (
        tuple(
            vars(capability).get(name)
            for name in (
                "owns",
                "verify_dto",
                "bridge_entry_id",
                "registration",
                "owner",
                "domain",
                "protocol",
                "services",
                "_issue",
                "_drop",
            )
        )
        + tuple(
            vars(registration).get(name)
            for name in (
                "capability",
                "owner",
                "state",
                "active",
                "async_unload",
                "remove",
                "__call__",
            )
        )
        + tuple(vars(dto).get(name) for name in ("as_json", "intact"))
    )


class NativeCaptureBridgeSource:
    """The original installed capture source; no authority from actor JSON."""

    __slots__ = ("_owner", "__weakref__")

    def __init__(self, hass: HomeAssistant, bridge_entry: ConfigEntry) -> None:
        names = (_BRIDGE, _BRIDGE + ".lease_service", _BRIDGE + ".lease_contract")
        modules = tuple(sys.modules.get(name) for name in names)
        if type(hass) is not HomeAssistant or any(
            type(module) is not ModuleType for module in modules
        ):
            raise LeaseRejected("state", "unverified")
        root, service, contract = modules
        assert (
            isinstance(root, ModuleType)
            and isinstance(service, ModuleType)
            and isinstance(contract, ModuleType)
        )
        ports = _module_ports(service, contract)
        (
            get_capability,
            is_capability,
            registrar,
            cap_type,
            reg_type,
            dto_type,
            dto_export,
            protocol,
        ) = ports[:8]
        if (
            not callable(get_capability)
            or not callable(is_capability)
            or not callable(registrar)
            or type(cap_type) is not type
            or type(reg_type) is not type
            or type(dto_type) is not type
            or dto_type is not dto_export
            or protocol != _PROTOCOL
            or cap_type.__module__ != service.__name__
            or reg_type.__module__ != service.__name__
            or dto_type.__module__ != contract.__name__
            or not same_identities((getattr(root, "lease_service", None),), (service,))
        ):
            raise LeaseRejected("state", "unverified")
        capability = get_capability(hass)
        if type(capability) is not cap_type or is_capability(capability) is not True:
            raise LeaseRejected("state", "unverified")
        owns = getattr(capability, "owns", None)
        verify_dto = getattr(capability, "verify_dto", None)
        as_json = getattr(dto_type, "as_json", None)
        setup = getattr(root, "async_setup_entry", None)
        if (
            not callable(owns)
            or not callable(verify_dto)
            or not callable(as_json)
            or type(setup) is not FunctionType
        ):
            raise LeaseRejected("state", "unverified")
        handlers = hass.services.async_services_for_domain("smplwise_bridge")
        services = []
        for name in _SERVICES:
            native = handlers.get(name)
            handler = native.job.target if type(native) is Service else None
            if (
                type(native) is not Service
                or type(handler) is not FunctionType
                or handler.__globals__ is not root.__dict__
                or not any(handler.__code__ is code for code in setup.__code__.co_consts)
                or native.supports_response is not SupportsResponse.ONLY
            ):
                raise LeaseRejected("state", "unverified")
            services.append(_ServiceOwner(native, native.job, handler, native.schema))
        owner = _BridgeOwner(
            hass,
            bridge_entry,
            hass.services,
            hass.config_entries,
            ((names[0], root), (names[1], service), (names[2], contract)),
            ports,
            _class_ports(cap_type, reg_type, dto_type),
            capability,
            cap_type,
            reg_type,
            dto_type,
            get_capability,
            owns,
            verify_dto,
            as_json,
            tuple(services),
        )
        owner.ports = (
            self.current,
            self.owns_dto,
            self.project_dto,
            self.bind_registration,
            self.matches,
            self.registration_retired,
            self.release_registration,
        )
        self._owner = owner
        _OWNERS[self] = weakref_ref(owner)
        if not self.current():
            del _OWNERS[self]
            raise LeaseRejected("state", "unverified")

    def current(self) -> bool:
        """Synchronous current-source check; no I/O, keys or actor decisions."""
        owner = _owner(self)
        if owner is None or owner.retired:
            return False
        try:
            hass, entry = owner.hass, owner.entry
            if (
                hass.services is not owner.registry
                or hass.config_entries is not owner.entry_registry
                or hass.config_entries.async_get_entry(entry.entry_id) is not entry
                or entry.domain != "smplwise_bridge"
                or entry.state is not ConfigEntryState.LOADED
                or not same_ports(
                    owner.ports,
                    (
                        self.current,
                        self.owns_dto,
                        self.project_dto,
                        self.bind_registration,
                        self.matches,
                        self.registration_retired,
                        self.release_registration,
                    ),
                )
                or any(
                    sys.modules.get(name) is not module or module.__name__ != name
                    for name, module in owner.modules
                )
            ):
                return False
            root, service, contract = (module for _, module in owner.modules)
            if (
                getattr(root, "lease_service", None) is not service
                or not same_ports(owner.module_ports, _module_ports(service, contract))
                or not same_ports(
                    owner.class_ports,
                    _class_ports(owner.capability_type, owner.registration_type, owner.dto_type),
                )
                or owner.get_capability(hass) is not owner.capability
                or getattr(owner.capability, "domain", None) != "smplwise_bridge"
                or getattr(owner.capability, "protocol", None) != _PROTOCOL
                or getattr(owner.capability, "services", None) != _SERVICES
                or getattr(owner.capability, "bridge_entry_id", None) != entry.entry_id
            ):
                return False
            handlers = hass.services.async_services_for_domain("smplwise_bridge")
            for name, expected in zip(_SERVICES, owner.services, strict=True):
                native = handlers.get(name)
                if (
                    native is not expected.service
                    or native.job is not expected.job
                    or getattr(native.job, "target", None) is not expected.handler
                    or native.schema is not expected.schema
                    or native.supports_response is not SupportsResponse.ONLY
                ):
                    return False
            registration = owner.registration
            if owner.pending:
                return (
                    registration is None and getattr(owner.capability, "registration", None) is None
                )
            return (
                type(registration) is owner.registration_type
                and owner.owns(registration) is True
                and getattr(registration, "capability", None) is owner.capability
                and getattr(registration, "owner", None) == _OWNER
                and getattr(registration, "_consumer", None) is owner.consumer
            )
        except Exception:
            return False

    def bind_registration(self, registration: object, consumer: object) -> None:
        """Adopt exactly the original synchronous registrar's returned receipt."""
        owner = _owner(self)
        if (
            owner is None
            or not owner.pending
            or owner.registration is not None
            or type(registration) is not owner.registration_type
            or owner.owns(registration) is not True
            or getattr(registration, "capability", None) is not owner.capability
            or getattr(registration, "owner", None) != _OWNER
            or getattr(registration, "_consumer", None) is not consumer
        ):
            raise LeaseRejected("state", "unverified")
        owner.registration, owner.consumer, owner.pending = registration, consumer, False
        if not self.current():
            raise LeaseRejected("state", "unverified")

    def owns_dto(self, dto: object) -> bool:
        owner = _owner(self)
        return bool(
            owner is not None
            and not owner.pending
            and self.current()
            and type(dto) is owner.dto_type
            and owner.verify_dto(dto) is True
            and self.current()
        )

    def project_dto(self, dto: object) -> object:
        if not self.owns_dto(dto):
            raise LeaseRejected("state", "unverified")
        owner = _owner(self)
        if owner is None:
            raise LeaseRejected("state", "unverified")
        body = owner.as_json(dto)
        protocol = getattr(owner.capability, "protocol", None)
        if (
            type(body) is not dict
            or set(body) != _DTO_FIELDS
            or protocol != _PROTOCOL
            or not self.owns_dto(dto)
        ):
            raise LeaseRejected("state", "unverified")
        # Protocol comes from the original capability/contract; digest is the
        # original DTO seal. No wire kid or second digest is manufactured.
        return freeze({"protocol": protocol, **body})

    def matches(self, hass: object, bridge_entry: object) -> bool:
        owner = _owner(self)
        return bool(
            owner is not None
            and owner.hass is hass
            and owner.entry is bridge_entry
            and self.current()
        )

    def registration_retired(self, registration: object) -> bool:
        """Check the original receipt after unload, independent of live source."""
        owner = _owner(self)
        return bool(
            owner is not None
            and not owner.pending
            and owner.registration is registration
            and same_ports(
                owner.class_ports,
                _class_ports(owner.capability_type, owner.registration_type, owner.dto_type),
            )
            and getattr(registration, "state", None) == "removed"
            and owner.owns(registration) is False
        )

    def release_registration(self, registration: object) -> None:
        """Drop the retired receipt graph only after the native host joined.

        The receipt holds its consumer. Keeping it in a global weak-key value
        would keep that very key alive indefinitely. Failed joins never call
        this method and retain the exact original receipt/resources instead.
        """
        if not self.registration_retired(registration):
            raise LeaseRejected("state", "unverified")
        owner = _owner(self)
        if owner is None:
            raise LeaseRejected("state", "unverified")
        owner.retired = True
        owner.registration, owner.consumer = None, None


async def async_bind_native_capture_lease(
    hass: HomeAssistant,
    entry: ConfigEntry,
    bridge_entry: ConfigEntry,
    *,
    installation_id: str | None,
    current: Callable[[object], LeaseAuthority],
    actor_current: Callable[[object, LeaseAuthority], bool],
    collector: object,
    clock: Callable[[], ClockSample],
    bridge_source: NativeCaptureBridgeSource | None = None,
    installation_actor_current: Callable[[object], bool] | None = None,
) -> CaptureLeaseConsumer:
    """Compose existing keyless host with an already-installed original bridge.

    Required policy/actor/collector ports retain their existing source contracts.
    This function does not install an Arx peer, pair a bridge or create a User.
    """
    from .capture_lease_runtime import async_bind_capture_lease

    source = bridge_source or NativeCaptureBridgeSource(hass, bridge_entry)
    if type(source) is not NativeCaptureBridgeSource or not source.matches(hass, bridge_entry):
        raise LeaseRejected("state", "unverified")
    host = CaptureLeaseHost(
        installation_id=installation_id,
        owns_dto=source.owns_dto,
        project_dto=source.project_dto,
        source_current=source.current,
        current=current,
        actor_current=actor_current,
        collector=collector,
        clock=clock,
        installation_actor_current=installation_actor_current,
    )
    try:
        return await async_bind_capture_lease(hass, entry, bridge_entry, host, bridge_source=source)
    except BaseException:
        await host.close()
        raise
