"""Finite genuine bridge source for original OperationsCenter report jobs.

Only an original admitted command Task can bind a configured report. Actor IDs,
stored configuration and a copied context issue no permission. No proof body
or private filter values enter logs, audit or the numbered source status.
"""

from __future__ import annotations

import weakref
from asyncio import TimerHandle
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any

from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .native_checkpoint_owner import command_principal
from .operations_center import OperationsCenter
from .trusted_actions.envelope import freeze
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.validation import Refusal

if TYPE_CHECKING:
    from .bridge_command_auth import BridgeCommandHost, BridgeExecutionBinding

SOURCE_KIND = "wiskey-native-report-source.v1"
_GRANTS: weakref.WeakKeyDictionary[NativeReportGrant, _Owner] = weakref.WeakKeyDictionary()
_TABLES: weakref.WeakKeyDictionary[OperationsCenter, dict[str, NativeReportGrant]] = (
    weakref.WeakKeyDictionary()
)
_PORTS = ("_save", "mutate", "append", "save_record", "delete_record")


@dataclass(repr=False)
class _Owner:
    ops: weakref.ReferenceType[OperationsCenter]
    hass: weakref.ReferenceType[HomeAssistant]
    host: BridgeCommandHost
    binding: BridgeExecutionBinding
    binding_ports: tuple[Callable[[], Any], ...]
    table: dict[str, NativeReportGrant]
    identity: str
    actor: str
    values: Any
    ports: tuple[Callable[..., Any], ...]
    deadline: datetime
    timer: TimerHandle | None = None
    source_remove: Callable[[], None] | None = None


class NativeReportGrant:
    __slots__ = ("__weakref__",)

    def check(self) -> None:
        owner = _GRANTS.get(self) if type(self) is NativeReportGrant else None
        if owner is None:
            raise Refusal("report_source_unavailable")
        ops, hass = owner.ops(), owner.hass()

        def store_current() -> None:
            if (
                ops is None
                or hass is None
                or type(ops) is not OperationsCenter
                or _TABLES.get(ops) is not owner.table
                or owner.table.get(owner.identity) is not self
                or hass.data.get(DOMAIN, {}).get("operations_center") is not ops
                or not same_ports(owner.ports, tuple(getattr(ops, name) for name in _PORTS))
            ):
                raise Refusal("report_source_unavailable")
            row = ops.data["reports"].get(owner.identity)
            if (
                type(row) is not dict
                or row.get("actor") != owner.actor
                or freeze(row.get("values")) != owner.values
            ):
                raise Refusal("report_source_unavailable")

        store_current()
        if not same_ports(owner.binding_ports, (owner.binding.check,)):
            raise Refusal("report_source_unavailable")
        owner.binding_ports[0]()
        store_current()

    def close(self) -> None:
        owner = _GRANTS.pop(self, None)
        if owner is None:
            return
        if owner.table.get(owner.identity) is self:
            del owner.table[owner.identity]
        if owner.timer is not None:
            owner.timer.cancel()
            owner.timer = None
        remove, owner.source_remove = owner.source_remove, None
        if remove is not None:
            hass = owner.hass()
            if hass is not None and not hass.loop.is_closed():
                # HA entry updates may eagerly iterate the original listeners.
                hass.loop.call_soon(remove)
            else:
                remove()


def report_source(ops: OperationsCenter, identity: str) -> NativeReportGrant | None:
    grant = _TABLES.get(ops, {}).get(identity)
    return grant if type(grant) is NativeReportGrant else None


def close_report_source(ops: OperationsCenter, identity: str) -> None:
    if (grant := report_source(ops, identity)) is not None:
        NativeReportGrant.close(grant)


def close_report_sources(ops: OperationsCenter) -> None:
    for grant in tuple(_TABLES.get(ops, {}).values()):
        NativeReportGrant.close(grant)


def close_host_report_sources(hass: HomeAssistant, host: BridgeCommandHost) -> None:
    for grant, owner in tuple(_GRANTS.items()):
        if owner.hass() is hass and owner.host is host:
            NativeReportGrant.close(grant)


def bind_report_source(
    hass: HomeAssistant, ops: OperationsCenter, identity: str, actor: str
) -> dict[str, Any] | None:
    principal = command_principal(actor)
    if principal is None:
        return None
    from .bridge_command_auth import (
        _PRINCIPALS,
        BridgeCommandHost,
        retain_execution,
    )

    if (
        type(ops) is not OperationsCenter
        or principal.command != "platform/save"
        or hass.data[DOMAIN].get("operations_center") is not ops
    ):
        raise Refusal("report_source_unavailable")
    principal.check()
    row = ops.data["reports"].get(identity)
    if type(row) is not dict or row.get("actor") != actor:
        raise Refusal("report_source_unavailable")
    if not row["values"]["enabled"]:
        close_report_source(ops, identity)
        return {
            "source_kind": SOURCE_KIND,
            "schema_version": 1,
            "state": "disabled",
            "expires_at": None,
        }
    host = _PRINCIPALS[principal][0]
    source = BridgeCommandHost._owner(host)
    now = source.auth.clock().now
    deadline = now + timedelta(hours=24)
    binding = retain_execution(principal, deadline)
    epoch, _, _, _ = binding.owner_key
    table = _TABLES.setdefault(ops, {})
    grant = NativeReportGrant()
    owner = _Owner(
        weakref.ref(ops),
        weakref.ref(hass),
        host,
        binding,
        (binding.check,),
        table,
        identity,
        actor,
        freeze(row["values"]),
        tuple(getattr(ops, name) for name in _PORTS),
        deadline,
    )
    close_report_source(ops, identity)
    table[identity] = grant
    _GRANTS[grant] = owner
    try:
        owner.timer = hass.loop.call_later(
            (deadline - now).total_seconds(), NativeReportGrant.close, grant
        )

        async def changed(_hass: Any, _entry: Any) -> None:
            NativeReportGrant.close(grant)

        owner.source_remove = epoch.entry.add_update_listener(changed)
        principal.check()
        NativeReportGrant.check(grant)
    except BaseException:
        NativeReportGrant.close(grant)
        raise
    return {
        "source_kind": SOURCE_KIND,
        "schema_version": 1,
        "state": "active",
        "expires_at": deadline.isoformat(),
    }
