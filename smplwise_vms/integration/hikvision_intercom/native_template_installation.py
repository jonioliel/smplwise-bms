"""HA setup/config/unload caller for the original native template resources.

Private configuration stays in memory; only field names and state are public.
The existing Cloud provider, host pacing queue, ledger and PIN policy do all work.
"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from dataclasses import dataclass, field

from homeassistant.config_entries import SIGNAL_CONFIG_ENTRY_CHANGED, ConfigEntryState
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .access.models import SecretValue
from .access.pin_quarantine import NativePinDeliveryPolicy, selected
from .const import DOMAIN
from .media_lifetime import join_owned
from .trusted_actions.validation import Refusal, reference
from .whatsapp_cloud_templates import ApprovedTextTemplate, CloudAccount, CloudTemplateProvider
from .whatsapp_pacing_queue import PacingQueue
from .whatsapp_pacing_runtime import issue_native_pacing_port, native_queue_sender
from .whatsapp_template_composition import (
    close_native_template_composition,
    install_native_template_composition,
)

CONFIG_KEY = "native_whatsapp_templates_v1"
KEY = "native_template_installation"
_CONFIG_FIELDS = {"schema_version", "station_id", "bridge_entry_id", "accounts", "templates"}


@dataclass(frozen=True, repr=False)
class _Configuration:
    station: str
    bridge: str
    accounts: tuple
    templates: tuple


def configuration(value):
    """Closed owner configuration; errors never include a value or secret."""
    if not isinstance(value, Mapping) or set(value) != _CONFIG_FIELDS:
        raise ValueError("native_template_configuration_invalid")
    if type(value["schema_version"]) is not int or value["schema_version"] != 1:
        raise ValueError("native_template_configuration_invalid")
    reference(value["station_id"])
    reference(value["bridge_entry_id"])
    for name in ("accounts", "templates"):
        if not isinstance(value[name], list) or not 1 <= len(value[name]) <= 128:
            raise ValueError("native_template_configuration_invalid")
    accounts, templates = [], []
    for row in value["accounts"]:
        if not isinstance(row, Mapping) or set(row) != {
            "account",
            "api_version",
            "business_id",
            "phone_number_id",
            "token",
        }:
            raise ValueError("native_template_configuration_invalid")
        accounts.append(
            CloudAccount(
                row["account"],
                row["api_version"],
                row["business_id"],
                row["phone_number_id"],
                SecretValue(row["token"]),
            )
        )
    for row in value["templates"]:
        if not isinstance(row, Mapping) or set(row) != {
            "reference",
            "revision",
            "account",
            "ui_language",
            "template_id",
            "name",
            "language",
            "body",
            "parameter_fields",
        }:
            raise ValueError("native_template_configuration_invalid")
        if not isinstance(row["parameter_fields"], list):
            raise ValueError("native_template_configuration_invalid")
        templates.append(
            ApprovedTextTemplate(**{**row, "parameter_fields": tuple(row["parameter_fields"])})
        )
    if len({account.account for account in accounts}) != len(accounts):
        raise ValueError("native_template_configuration_invalid")
    if len({item.reference for item in templates}) != len(templates) or any(
        item.account not in {account.account for account in accounts} for item in templates
    ):
        raise ValueError("native_template_configuration_invalid")
    return _Configuration(
        value["station_id"], value["bridge_entry_id"], tuple(accounts), tuple(templates)
    )


@dataclass(repr=False)
class _Resources:
    entry: object
    bridge: object
    runtime: object
    configuration: object
    providers: list = field(default_factory=list)
    queue: object = None
    composition: object = None
    port: object = None
    jobs: object = None


class _ImmediateTemplateQueueSource:
    """Scheduler ownership only: no unauthenticated durable job can be prepared.

    Immediate sends get their exact EngineContext from the original template host
    and claim_template. A queued generic job needs its own original private producer;
    an arbitrary queue row never supplies that authority or a replacement payload.
    """

    def __init__(self, installer, port):
        self.installer, self.port = installer, port

    def sender(self, _row):
        self.installer.current()
        return native_queue_sender(self.port)

    def check(self, _row):
        self.installer.current()
        raise Refusal("queued_template_source_required")

    async def prepare(self, row):
        self.check(row)


class NativeTemplateInstallation:
    def __init__(self, hass, value):
        namespace = hass.data[DOMAIN]
        # Refuse before allocating locks/tasks, parsing configuration or
        # replacing the incumbent's ownership key. Even a retired/unknown key
        # belongs to its original owner until that lifecycle removes it.
        if KEY in namespace:
            raise Refusal("native_template_owner_exists")
        self.hass, self.namespace = hass, namespace
        self.lock, self.tasks = asyncio.Lock(), set()
        self.resources, self.stopping = None, False
        self.poll_timer = None
        self.state, self.config = "discovering_original_resources", None
        self.automatic = value is None
        self.remove = lambda: None
        self.namespace[KEY] = self
        if value is not None:
            try:
                self.config = configuration(value)
            except Exception:
                self.state = "configuration_invalid"
            else:
                self.state = "waiting_for_original_entries"

    def __repr__(self):
        return "NativeTemplateInstallation()"

    def status(self):
        return {
            "schema_version": 1,
            "state": self.state,
            "configuration_key": CONFIG_KEY if not self.automatic else None,
            "required_fields": sorted(_CONFIG_FIELDS) if not self.automatic else [],
            "discovery": "original_installer_private_resources_v1"
            if self.automatic
            else "legacy_existing_configuration",
            "owner_steps_required": False,
            "provider_tokens_exposed": False,
            "configured_accounts": len(self.config.accounts) if self.config else 0,
            "configured_templates": len(self.config.templates) if self.config else 0,
        }

    def current(self):
        if (
            self.stopping
            or self.hass.is_stopping
            or self.hass.data.get(DOMAIN) is not self.namespace
            or self.namespace.get(KEY) is not self
            or self.resources is None
        ):
            raise Refusal("template_source_not_installed")
        resources = self.resources
        if (
            self.hass.config_entries.async_get_entry(resources.entry.entry_id)
            is not resources.entry
            or self.hass.config_entries.async_get_entry(resources.bridge.entry_id)
            is not resources.bridge
            or resources.entry.state is not ConfigEntryState.LOADED
            or resources.bridge.state is not ConfigEntryState.LOADED
            or resources.entry.runtime_data is not resources.runtime
            or resources.runtime.is_closed
            or resources.configuration is not self.config
        ):
            raise Refusal("template_source_not_installed")

    async def _close_resources(self):
        resources = self.resources
        if resources is None:
            return
        # Join the original host first. A failure retains all roots and blocks
        # rebind; borrowed resources cannot be closed underneath a live POST.
        try:
            if resources.jobs is not None:
                await resources.jobs.close()
            if resources.composition is not None:
                await close_native_template_composition(self.hass, resources.composition)
            if resources.queue is not None:
                await resources.queue.async_close()
            for provider in resources.providers:
                await provider.close()
        except BaseException:
            self.state = "cleanup_failed"
            raise
        self.resources = None

    async def reconcile(self):
        async with self.lock:
            if self.automatic:
                from .native_template_resources import discover

                configured, state = await discover(self.hass)
                if configured != self.config:
                    self.config = configured
                    await self._close_resources()
                    self.state = state
                elif self.resources is None:
                    self.state = state
            if self.stopping or self.config is None or self.state == "cleanup_failed":
                return
            if self.resources is not None:
                try:
                    self.current()
                    self.resources.composition.stable()
                except Exception:
                    await self._close_resources()
                else:
                    return
            entry = self.hass.config_entries.async_get_entry(self.config.station)
            bridge = self.hass.config_entries.async_get_entry(self.config.bridge)
            from .runtime import IntercomRuntime

            if (
                entry is None
                or entry.domain != DOMAIN
                or entry.state is not ConfigEntryState.LOADED
                or type(getattr(entry, "runtime_data", None)) is not IntercomRuntime
                or entry.runtime_data.is_closed
                or bridge is None
                or bridge.domain != "smplwise_bridge"
                or bridge.state is not ConfigEntryState.LOADED
            ):
                self.state = "waiting_for_original_entries"
                return
            self.resources = resources = _Resources(entry, bridge, entry.runtime_data, self.config)
            self.state = "composing_original_resources"
            try:
                self.current()
                for account in self.config.accounts:
                    resources.providers.append(CloudTemplateProvider(account, enabled=True))
                resources.port = issue_native_pacing_port(self.hass)
                resources.queue = await PacingQueue.from_host(
                    resources.port, source=_ImmediateTemplateQueueSource(self, resources.port)
                )
                self.current()
                repository = resources.runtime.access_manager.repository
                pin_policy = (
                    NativePinDeliveryPolicy(repository)
                    if selected(repository) is not None
                    else None
                )
                resources.composition = await install_native_template_composition(
                    self.hass,
                    entry=entry,
                    bridge_entry=bridge,
                    providers=tuple(resources.providers),
                    templates=self.config.templates,
                    queue=resources.queue,
                    pin_delivery_policy=pin_policy,
                )
                self.current()
                resources.composition.stable()
                from .native_template_jobs import NativeTemplateJobs

                resources.jobs = await NativeTemplateJobs.open(self)
                resources.jobs.start()
                self.state = "installed_native_source"
            except BaseException:
                await join_owned(self._close_resources())
                if self.state != "cleanup_failed":
                    self.state = "native_composition_unavailable"
                raise

    def schedule(self):
        if self.stopping or self.hass.is_stopping:
            return

        if self.poll_timer is not None:
            self.poll_timer.cancel()
        if self.automatic:
            self.poll_timer = self.hass.loop.call_later(5, self.schedule)
        if any(not task.done() for task in self.tasks):
            return

        async def run():
            try:
                await self.reconcile()
            except Exception:
                if self.state != "cleanup_failed":
                    self.state = "native_composition_unavailable"

        task = self.hass.async_create_task(run(), "WisKey original template installation")
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)

    async def detach(self, entry):
        if self.resources is not None and entry in (self.resources.entry, self.resources.bridge):
            async with self.lock:
                await self._close_resources()
                self.state = "waiting_for_original_entries"

    async def close(self):
        self.stopping = True
        if self.poll_timer is not None:
            self.poll_timer.cancel()
            self.poll_timer = None
        self.remove()
        tasks = tuple(task for task in self.tasks if task is not asyncio.current_task())
        for task in tasks:
            task.cancel()
        if tasks:
            await join_owned(asyncio.gather(*tasks, return_exceptions=True))
        async with self.lock:
            await self._close_resources()
            self.state = "closed"


def setup_native_template_installation(hass, value):
    installer = NativeTemplateInstallation(hass, value)

    @callback
    def changed(_change, entry):
        if entry.domain in (DOMAIN, "smplwise_bridge"):
            installer.schedule()

    installer.remove = async_dispatcher_connect(hass, SIGNAL_CONFIG_ENTRY_CHANGED, changed)

    async def stop(_event):
        await installer.close()

    hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stop)
    installer.schedule()
    return installer


async def detach_native_template_installation(hass, entry):
    installer = hass.data.get(DOMAIN, {}).get(KEY)
    if type(installer) is NativeTemplateInstallation:
        await installer.detach(entry)


async def close_native_template_installation(hass):
    installer = hass.data.get(DOMAIN, {}).get(KEY)
    if type(installer) is NativeTemplateInstallation:
        await installer.close()
