"""Trusted native installation of existing template, queue and accounting roots.

No configuration, provider, queue, credential or consent is invented here. The
existing private installer supplies actual configured objects. Without those
resources the registered API continues to return NOT_INSTALLED.
"""

from __future__ import annotations

import weakref
from dataclasses import dataclass
from uuid import uuid4

from homeassistant.config_entries import ConfigEntryState

from .const import DOMAIN
from .native_whatsapp_accounting import NativeWhatsAppAccounting
from .trusted_actions.adapters import EngineContext
from .trusted_actions.validation import Refusal
from .whatsapp_pacing_queue import native_template_queue_port
from .whatsapp_template_runtime_v1 import (
    ArxTemplateConsentPolicyV1,
    NativeTemplateSendHostV1,
    TemplateExecutionSourceV1,
)

KEY = "native_template_composition"
_OWNERS = weakref.WeakKeyDictionary()
_COMPOSITIONS = weakref.WeakKeyDictionary()


@dataclass(repr=False)
class _Owner:
    hass: object
    namespace: object
    entry: object
    runtime: object
    bridge: object
    bridge_data: object
    bridge_options: object
    bridge_runtime: object
    queue: object
    providers: tuple
    templates: tuple
    accounting: object
    host: object = None
    initializing: bool = True
    closed: bool = False


class NativeTemplateComposition:
    """Original in-memory source owner; no public JSON installer exists."""

    __slots__ = ("__weakref__",)

    def stable(self):
        owner = _OWNERS.get(self) if type(self) is NativeTemplateComposition else None
        if owner is None or owner.closed:
            raise Refusal("template_source_not_installed")
        hass, entry, bridge = owner.hass, owner.entry, owner.bridge
        if (
            hass.is_stopping
            or hass.data.get(DOMAIN) is not owner.namespace
            or owner.namespace.get(KEY) is not self
            or _COMPOSITIONS.get(hass) is not self
            or hass.config_entries.async_get_entry(entry.entry_id) is not entry
            or entry.domain != DOMAIN
            or entry.state is not ConfigEntryState.LOADED
            or entry.runtime_data is not owner.runtime
            or owner.runtime.is_closed
            or owner.runtime.access_manager is not owner.namespace.get("access")
            or hass.config_entries.async_get_entry(bridge.entry_id) is not bridge
            or bridge.domain != "smplwise_bridge"
            or bridge.state is not ConfigEntryState.LOADED
            or bridge.data is not owner.bridge_data
            or bridge.options is not owner.bridge_options
            or getattr(bridge, "runtime_data", None) is not owner.bridge_runtime
        ):
            raise Refusal("template_source_not_installed")
        if native_template_queue_port(hass, owner.queue) is not owner.accounting.port:
            raise Refusal("template_source_not_installed")
        if NativeWhatsAppAccounting.check(owner.accounting).providers is not owner.providers:
            raise Refusal("template_source_not_installed")
        if not owner.initializing and owner.namespace.get("arx_template_send_v1") is not owner.host:
            raise Refusal("template_source_not_installed")
        return owner

    def check_principal(self, principal, connection):
        from .bridge_command_auth import VerifiedBridgePrincipal

        owner = self.stable()
        if type(principal) is not VerifiedBridgePrincipal:
            raise Refusal("Unauthorized")
        principal.check()
        epoch, entry_id, _subject, actual_connection = principal.owner_key
        if (
            entry_id != owner.bridge.entry_id
            or epoch.entry is not owner.bridge
            or actual_connection is not connection
            or principal.repository is not owner.runtime.access_manager.repository
        ):
            raise Refusal("Unauthorized")

    async def admit(self, _connection, _parameters):
        from .native_template_jobs import InstalledTemplateDispatch
        if type(_connection) is InstalledTemplateDispatch:
            return _connection.admit(self, _parameters)
        # This unsigned legacy input cannot supply an original pairing proof.
        # NativeTemplateSendHostV1.send_bridge receives the actual verified one.
        self.stable()
        raise Refusal("pairing_command_required")

    def check(self, _connection, context):
        self.stable()
        if type(context) is not EngineContext:
            raise Refusal("Unauthorized")
        context.check()
        return True

    def is_current(self, root):
        if root is not self:
            return False
        try:
            self.stable()
        except Exception:
            return False
        return True


async def install_native_template_composition(
    hass,
    *,
    entry,
    bridge_entry,
    providers,
    templates,
    queue,
    pin_delivery_policy=None,
):
    """Use actual configured resources from the original private native installer.

    Providers and queue remain borrowed; this composition owns its accounting
    adapter and host. The existing API binder owns stop/unload and quarantine.
    This entry point does not enable installation/auto or discover credentials.
    """
    from .runtime import IntercomRuntime
    from .whatsapp_template_api_v1 import bind_template_host_v1

    namespace = hass.data[DOMAIN]
    if (
        hass in _COMPOSITIONS
        or namespace.get(KEY) is not None
        or namespace.get("arx_template_send_v1") is not None
        or type(getattr(entry, "runtime_data", None)) is not IntercomRuntime
    ):
        raise Refusal("template_source_not_installed")
    port = native_template_queue_port(hass, queue)
    accounting = NativeWhatsAppAccounting(port, providers=providers)
    handle = NativeTemplateComposition()
    owner = _Owner(
        hass,
        namespace,
        entry,
        entry.runtime_data,
        bridge_entry,
        bridge_entry.data,
        bridge_entry.options,
        getattr(bridge_entry, "runtime_data", None),
        queue,
        providers,
        templates,
        accounting,
    )
    _OWNERS[handle] = owner
    _COMPOSITIONS[hass] = namespace[KEY] = handle
    try:
        handle.stable()
        source = TemplateExecutionSourceV1(
            handle,
            admit=handle.admit,
            check=handle.check,
            is_current=handle.is_current,
        )
        owner.host = NativeTemplateSendHostV1(
            owner.runtime.access_manager,
            source,
            providers=providers,
            templates=templates,
            accounting=accounting,
            claim_queue=queue.claim_template,
            policy=ArxTemplateConsentPolicyV1(),
            epoch=uuid4().hex,
            pin_delivery_policy=pin_delivery_policy,
        )
        bind_template_host_v1(hass, owner.host, entry=entry)
        owner.initializing = False
        handle.stable()
        return handle
    except BaseException:
        # No borrowed provider/queue is closed on a failed local bind.
        if owner.host is not None:
            await NativeTemplateSendHostV1.close(owner.host)
        accounting.close()
        owner.closed = True
        if namespace.get(KEY) is handle:
            namespace.pop(KEY)
        if _COMPOSITIONS.get(hass) is handle:
            _COMPOSITIONS.pop(hass)
        _OWNERS.pop(handle, None)
        raise


async def close_native_template_composition(hass, handle):
    """Join only the exact native host issued for this original composition.

    Cleanup remains possible after source invalidation. A failed competing
    installer has no handle and cannot unbind a host merely by station entry.
    """
    if type(handle) is not NativeTemplateComposition:
        raise Refusal("template_source_not_installed")
    owner = _OWNERS.get(handle)
    if owner is None:
        return  # Only original joined retirement removes the issued owner.
    if owner.hass is not hass or owner.host is None:
        raise Refusal("template_source_not_installed")
    from .whatsapp_template_api_v1 import unbind_template_host_v1

    await unbind_template_host_v1(hass, entry=owner.entry, host=owner.host)


def retire_native_template_composition(hass, host):
    """Called only after the original binder has joined that exact native host."""
    handle = _COMPOSITIONS.get(hass)
    owner = _OWNERS.get(handle) if handle is not None else None
    if owner is None or owner.host is not host:
        return
    # If accounting still owns an active send, retain the original roots and
    # propagate failure into the existing binder's cleanup quarantine.
    owner.accounting.close()
    owner.closed = True
    if owner.namespace.get(KEY) is handle:
        owner.namespace.pop(KEY)
    _COMPOSITIONS.pop(hass, None)
    _OWNERS.pop(handle, None)
