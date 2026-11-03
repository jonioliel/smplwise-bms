"""smplwise access control integration; Hikvision protocol tooling remains importable without HA."""

from __future__ import annotations

import os as _distribution_os
import uuid as _distribution_uuid
from importlib.util import find_spec
from pathlib import Path as _DistributionPath
from typing import TYPE_CHECKING

from .const import DOMAIN
from .installation_files import digest as _distribution_digest

LOADED_DISTRIBUTION = _distribution_digest(_DistributionPath(__file__).parent)
LOADED_BOOT_ID = _distribution_uuid.uuid4().hex
LOADED_PROCESS_ID = _distribution_os.getpid()

# Standalone protocol tools intentionally do not require installing HA.
if find_spec("homeassistant") is not None:
    import voluptuous as vol

    # Station onboarding remains the existing config-entry flow. The optional
    # native Cloud resource catalog may use HA !secret references in YAML.
    CONFIG_SCHEMA = vol.Schema(
        {
            vol.Optional(DOMAIN): vol.Schema(
                {
                    vol.Optional("native_whatsapp_templates_v1"): dict,
                }
            ),
        },
        extra=vol.ALLOW_EXTRA,
    )

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.typing import ConfigType

    from .runtime import IntercomConfigEntry


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register integration actions once, independent of individual station lifetimes."""
    from .access_runtime import async_setup_access
    from .arx_feature_api import register_feature_api
    from .arx_media_ingress import register_feature_media_ingress
    from .audio_api import register_audio
    from .audio_tts import register_tts_audio
    from .event_manager import async_setup_events
    from .issues import async_setup_repairs
    from .mse_api import register_mse
    from .name_reference_api import register_name_references
    from .panel import async_setup_panel
    from .peer_bridge_api import register_peer_bridge
    from .peer_bridge_http import register_peer_bridge_http
    from .rtc_api import register_rtc
    from .runtime import async_register_services
    from .station_media_api import async_setup_station_media
    from .websocket import async_register_websocket
    from .whatsapp_template_api_v2 import register_template_api_v2

    async_setup_repairs(hass)
    from .native_auto_installation import prepare_storage, setup_auto_installation

    await prepare_storage(hass)
    await async_setup_access(hass)
    from .bridge_command_auth import setup_bridge_commands

    await setup_bridge_commands(hass)
    from .arx_native_feature_runtime import async_setup_native_feature_runtime

    await async_setup_native_feature_runtime(hass)
    await async_setup_events(hass)
    async_register_websocket(hass)
    register_feature_api(hass)
    register_peer_bridge(hass)
    register_peer_bridge_http(hass)
    register_audio(hass)
    await async_setup_station_media(hass)
    register_name_references(hass)
    register_template_api_v2(hass)
    register_tts_audio(hass)
    register_mse(hass)
    register_feature_media_ingress(hass)
    register_rtc(hass)
    await async_setup_panel(hass)
    async_register_services(hass)
    from .capture_native_api import register_native_capture_api

    register_native_capture_api(hass)
    from .native_peer_write_api import setup_native_peer_writes

    setup_native_peer_writes(hass)
    from .native_service_write_api import setup_native_service_writes

    await setup_native_service_writes(hass)
    from .direct_bridge_api import register_direct_bridge
    from .event_resume import register as register_event_resume
    from .native_installation_api import register as register_installation_api

    register_event_resume(hass)
    register_installation_api(hass)
    register_direct_bridge(hass)
    from .capture_native_composition import setup_native_capture_composition

    setup_native_capture_composition(hass)
    from .native_template_installation import CONFIG_KEY, setup_native_template_installation
    from .native_template_resources import migrate_existing_configuration

    await migrate_existing_configuration(hass, config.get(DOMAIN, {}).get(CONFIG_KEY))
    setup_native_template_installation(hass, config.get(DOMAIN, {}).get(CONFIG_KEY))
    await setup_auto_installation(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: IntercomConfigEntry) -> bool:
    """Create and own the per-entry runtime."""
    from .capture_lease_runtime import async_setup_capture_entry
    from .runtime import async_setup_runtime

    result = await async_setup_runtime(hass, entry)
    if result:
        try:
            async_setup_capture_entry(hass, entry)
        except BaseException:
            from .runtime import IntercomRuntime

            await IntercomRuntime.async_close(entry.runtime_data)
            raise
    return result


async def async_unload_entry(hass: HomeAssistant, entry: IntercomConfigEntry) -> bool:
    """Unload platforms before closing their network resources."""
    import asyncio

    from .capture_lease_runtime import async_unload_capture_entry
    from .native_template_installation import detach_native_template_installation
    from .runtime import async_unload_runtime
    from .whatsapp_template_api_v1 import unbind_template_host_v1

    first, result = None, False
    for cleanup in (
        lambda: detach_native_template_installation(hass, entry),
        lambda: unbind_template_host_v1(hass, entry=entry),
        lambda: async_unload_capture_entry(hass, entry),
        lambda: async_unload_runtime(hass, entry),
    ):
        try:
            result = await cleanup()
        except (Exception, asyncio.CancelledError) as error:
            if first is None:
                first = error
    if first is not None:
        raise first
    return result


async def async_migrate_entry(hass: HomeAssistant, entry: IntercomConfigEntry) -> bool:
    """Validate old data before upgrading config-entry metadata."""
    from .migrations import async_migrate_entry as migrate

    return await migrate(hass, entry)
