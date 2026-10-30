"""Finite genuine bridge source for original journalled maintenance jobs.

Stored owner IDs are matching data, never permission. Only a fresh original
command Task can bind the original job, connection, source and native targets.
No command scope, fake admin, approval record or alternative write queue exists.
"""

from __future__ import annotations

import weakref
from asyncio import TimerHandle
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any

import httpx
from homeassistant.core import HomeAssistant

from .access.models import AccessError
from .bridge_command_scope import _SCOPE
from .bridge_native_effects import _Origin, check_native_origin
from .client.effect_scope import RequestRule, native_effect_scope
from .client.technical import door_update_body
from .const import DOMAIN
from .maintenance_jobs import MaintenanceJobs, moment
from .native_checkpoint_owner import command_principal, origin
from .operations_center import OperationsCenter
from .trusted_actions.envelope import freeze
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.validation import Refusal

if TYPE_CHECKING:
    from .bridge_command_auth import BridgeCommandHost, BridgeExecutionBinding

SOURCE_KIND = "wiskey-native-maintenance-source.v1"
_PORTS = ("get", "run", "enqueue", "mutate", "_row", "_save", "cancel", "decide")
_OPS_PORTS = ("_save", "mutate", "save_record", "delete_record")
_GRANTS: weakref.WeakKeyDictionary[NativeMaintenanceGrant, _Owner] = weakref.WeakKeyDictionary()
_TABLES: weakref.WeakKeyDictionary[MaintenanceJobs, dict[str, NativeMaintenanceGrant]] = (
    weakref.WeakKeyDictionary()
)


def _configuration(job: dict[str, Any]) -> Any:
    return freeze(
        {
            key: [{k: v for k, v in row.items() if k not in {"state", "code"}} for row in value]
            if key == "rows"
            else value
            for key, value in job.items()
            if key != "state"
        }
    )


def native_job(job: dict[str, Any]) -> bool:
    # Historical actor labels without original owner metadata still cannot
    # fall through to an HA user lookup or reconstruct an execution grant.
    return "bridge_owner" in job or job["actor"].startswith(("arx:", "arx-id-sha256:"))


@dataclass(repr=False)
class _Owner:
    jobs: weakref.ReferenceType[MaintenanceJobs]
    hass: weakref.ReferenceType[HomeAssistant]
    ops: weakref.ReferenceType[OperationsCenter]
    ops_ports: tuple[Callable[..., Any], ...]
    business_ports: tuple[Callable[..., Any], ...]
    host: BridgeCommandHost
    binding: BridgeExecutionBinding
    binding_port: Callable[[], Any]
    table: dict[str, NativeMaintenanceGrant]
    identity: str
    configuration: Any
    ports: tuple[Callable[..., Any], ...]
    origins: tuple[_Origin, ...]
    deadline: datetime
    timer: TimerHandle | None = None
    source_remove: Callable[[], None] | None = None


class NativeMaintenanceGrant:
    __slots__ = ("__weakref__",)

    def _owner(self) -> _Owner:
        owner = _GRANTS.get(self) if type(self) is NativeMaintenanceGrant else None
        if owner is None:
            raise AccessError("native_source_unavailable")
        jobs, hass, ops = owner.jobs(), owner.hass(), owner.ops()
        from . import operations_api, technical_api

        if (
            jobs is None
            or hass is None
            or type(jobs) is not MaintenanceJobs
            or _TABLES.get(jobs) is not owner.table
            or owner.table.get(owner.identity) is not self
            or hass.data.get(DOMAIN, {}).get("maintenance_jobs") is not jobs
            or ops is None
            or hass.data.get(DOMAIN, {}).get("operations_center") is not ops
            or not same_ports(owner.ops_ports, tuple(getattr(ops, name) for name in _OPS_PORTS))
            or not same_ports(owner.ports, tuple(getattr(jobs, name) for name in _PORTS))
            or not same_ports((owner.binding_port,), (owner.binding.check,))
            or not same_ports(
                owner.business_ports,
                (operations_api.read_configuration, technical_api.dispatch_technical),
            )
        ):
            raise AccessError("native_source_unavailable")
        return owner

    def check(self, row: dict[str, Any] | None = None) -> None:
        owner = NativeMaintenanceGrant._owner(self)
        try:
            owner.binding_port()
            job = owner.ports[0](owner.identity)
            if _configuration(job) != owner.configuration:
                raise Refusal("binding_denied")
            if row is not None:
                matching = [item for item in job["rows"] if item["station_id"] == row["station_id"]]
                if len(matching) != 1 or freeze(
                    {k: v for k, v in matching[0].items() if k not in {"state", "code"}}
                ) != freeze({k: v for k, v in row.items() if k not in {"state", "code"}}):
                    raise Refusal("binding_denied")
                targets = [o for o in owner.origins if o.entry.entry_id == row["station_id"]]
                if len(targets) != 1:
                    raise Refusal("binding_denied")
                check_native_origin(owner.hass(), targets[0])
                from .access.station_lifecycle_jobs import frozen_sources
                from .access_runtime import get_manager
                from .maintenance_api import current_window

                hass = owner.hass()
                manager = get_manager(hass)
                if (
                    manager.lifecycle_lock.locked()
                    or row["station_id"] in frozen_sources(manager.repository.snapshot())
                    or freeze(current_window(hass, row["station_id"])) != freeze(row["window"])
                ):
                    raise Refusal("binding_denied")
            owner.binding_port()
            NativeMaintenanceGrant._owner(self)
        except Refusal:
            raise AccessError("native_source_unavailable") from None

    @contextmanager
    def execution(self, row: dict[str, Any], *, write: bool = False) -> Iterator[None]:
        NativeMaintenanceGrant.check(self, row)
        owner = NativeMaintenanceGrant._owner(self)
        target = next(o for o in owner.origins if o.entry.entry_id == row["station_id"])
        base = str(target.base).rstrip("/")
        path = f"/ISAPI/AccessControl/Door/param/{row['door']}"
        rules: tuple[RequestRule, ...] = (
            RequestRule("GET", httpx.URL(base + "/ISAPI/System/deviceInfo")),
            RequestRule("GET", httpx.URL(base + path + "/capabilities")),
            RequestRule("GET", httpx.URL(base + path)),
        )
        if write:
            rules += (RequestRule("PUT", httpx.URL(base + path), door_update_body(row["changes"])),)

        def current() -> None:
            NativeMaintenanceGrant.check(self, row)

        # The original effect scope pins this exact worker Task and every native
        # attempt/chunk/Digest exchange. A copied context gets no write lane.
        with native_effect_scope(target.client, current, rules):
            yield
            current()

    def close(self) -> None:
        owner = _GRANTS.pop(self, None)
        if owner is None:
            return
        if owner.table.get(owner.identity) is self:
            del owner.table[owner.identity]
        if owner.timer is not None:
            owner.timer.cancel()
        remove, owner.source_remove = owner.source_remove, None
        if remove is not None:
            hass = owner.hass()
            if hass is not None and not hass.loop.is_closed():
                hass.loop.call_soon(remove)
            else:
                remove()


def maintenance_source(jobs: MaintenanceJobs, identity: str) -> NativeMaintenanceGrant | None:
    value = _TABLES.get(jobs, {}).get(identity)
    return value if type(value) is NativeMaintenanceGrant else None


def close_maintenance_sources(jobs: MaintenanceJobs) -> None:
    for grant in tuple(_TABLES.get(jobs, {}).values()):
        NativeMaintenanceGrant.close(grant)


def close_host_maintenance_sources(hass: HomeAssistant, host: BridgeCommandHost) -> None:
    for grant, owner in tuple(_GRANTS.items()):
        if owner.hass() is hass and owner.host is host:
            NativeMaintenanceGrant.close(grant)


def admitted(jobs: MaintenanceJobs, job: dict[str, Any]) -> bool:
    if not native_job(job):
        return True
    grant = maintenance_source(jobs, job["id"])
    if grant is None:
        return False
    try:
        NativeMaintenanceGrant.check(grant)
    except AccessError:
        NativeMaintenanceGrant.close(grant)
        return False
    return True


def source_status(jobs: MaintenanceJobs, job: dict[str, Any]) -> dict[str, Any] | None:
    if not native_job(job):
        return None
    active = admitted(jobs, job)
    grant = maintenance_source(jobs, job["id"])
    owner = _GRANTS.get(grant) if grant is not None else None
    return {
        "source_kind": SOURCE_KIND,
        "schema_version": 1,
        "state": "active" if active else "paused",
        "expires_at": owner.deadline.isoformat() if owner is not None else None,
    }


def bind_maintenance_source(
    hass: HomeAssistant, jobs: MaintenanceJobs, identity: str, actor: str
) -> dict[str, Any]:
    principal = command_principal(actor)
    if principal is None:
        raise AccessError("unauthorized")
    from .bridge_command_auth import _PRINCIPALS, BridgeCommandHost, retain_execution

    scope = _SCOPE.get()
    ops = hass.data[DOMAIN].get("operations_center")
    if (
        type(jobs) is not MaintenanceJobs
        or scope is None
        or scope.principal is not principal
        or type(ops) is not OperationsCenter
        or hass.data[DOMAIN].get("maintenance_jobs") is not jobs
        or principal.command
        not in {"platform/maintenance_enqueue", "platform/maintenance_resume_v1"}
    ):
        raise AccessError("unauthorized")
    principal.check()
    from . import operations_api, technical_api

    job = jobs.get(identity)
    if job.get("bridge_owner") != origin(principal) or job["actor"] != actor:
        raise AccessError("unauthorized")
    if job["state"] != "queued" and not any(row["state"] == "writing" for row in job["rows"]):
        raise AccessError("review_expired")
    host = _PRINCIPALS[principal][0]
    now = BridgeCommandHost._owner(host).auth.clock().now
    deadline = min(moment(job["expires_at"]), now + timedelta(hours=24))
    if deadline <= now:
        raise AccessError("review_expired")
    binding = retain_execution(principal, deadline)
    epoch, _, _, _ = binding.owner_key
    table = _TABLES.setdefault(jobs, {})
    grant = NativeMaintenanceGrant()
    owner = _Owner(
        weakref.ref(jobs),
        weakref.ref(hass),
        weakref.ref(ops),
        tuple(getattr(ops, name) for name in _OPS_PORTS),
        (operations_api.read_configuration, technical_api.dispatch_technical),
        host,
        binding,
        binding.check,
        table,
        identity,
        _configuration(job),
        tuple(getattr(jobs, name) for name in _PORTS),
        scope.native_origins,
        deadline,
    )
    if (previous := maintenance_source(jobs, identity)) is not None:
        NativeMaintenanceGrant.close(previous)
    table[identity], _GRANTS[grant] = grant, owner
    try:
        owner.timer = hass.loop.call_later(
            (deadline - now).total_seconds(), NativeMaintenanceGrant.close, grant
        )

        async def changed(_hass: HomeAssistant, _entry: Any) -> None:
            NativeMaintenanceGrant.close(grant)

        owner.source_remove = epoch.entry.add_update_listener(changed)
        principal.check()
        NativeMaintenanceGrant.check(grant)
    except BaseException:
        NativeMaintenanceGrant.close(grant)
        raise
    return source_status(jobs, job) or {}
