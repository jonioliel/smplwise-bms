"""SMPLWISE Bridge — the thin Home Assistant integration next to the SMPLWISE VMS add-on (ADR-012).

It does two things and nothing else:
1. `smplwise_bridge.execute`: runs an allow-listed service call that the add-on signed with the pairing
   secret, using `Context(user_id=<the VMS user's HA id>)`, so Home Assistant's own per-user entity
   permissions decide. The add-on's Supervisor token never acts as a person by itself.
2. Pushes the Home Assistant user directory (id, name, username, active, admin, groups) to the add-on
   every minute, signed the same way, so the VMS can assign roles to HA users without touching HA.
3. Serves the Lovelace card `custom:smplwise-card` (www/smplwise-card.js) and registers it as a dashboard
   resource, so a dashboard can embed a VMS screen through the add-on's Ingress page — the person's own HA
   identity, the VMS's own roles, no secret in YAML, no entities (T056).
"""
from __future__ import annotations

import logging
from datetime import timedelta
from pathlib import Path
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Context, HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.exceptions import Unauthorized
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_interval

from .const import CONF_ADDON_URL, CONF_PAIRING_CODE, DIRECTORY_INTERVAL_S, DOMAIN, SERVICE_EXECUTE, SERVICE_SYNC, VERSION
from .signing import Verifier, sign

_LOGGER = logging.getLogger(__name__)

EXECUTE_SCHEMA = vol.Schema(
    {
        vol.Required("user_id"): cv.string,
        vol.Required("domain"): cv.string,
        vol.Required("service"): cv.string,
        vol.Required("data"): dict,
        vol.Required("request_id"): cv.string,
        vol.Required("ts"): vol.Coerce(int),
        vol.Required("nonce"): cv.string,
        vol.Required("sig"): cv.string,
    },
    extra=vol.ALLOW_EXTRA,
)

# Only these may ever be executed, whatever the add-on asks for (defence in depth: the add-on has the same list).
ALLOWED_SERVICES = {
    ("light", "turn_on"), ("light", "turn_off"), ("switch", "turn_on"), ("switch", "turn_off"), ("fan", "turn_on"), ("fan", "turn_off"),
    ("cover", "open_cover"), ("cover", "close_cover"), ("cover", "stop_cover"), ("lock", "lock"), ("lock", "unlock"),
    ("button", "press"), ("script", "turn_on"), ("scene", "turn_on"),
}


CARD_URL = "/smplwise_bridge/smplwise-card.js"


async def _async_register_card(hass: HomeAssistant) -> None:
    """Serve the Lovelace card (www/smplwise-card.js) next to the integration and register it as a dashboard
    resource once. Best effort: in YAML-mode dashboards or on an older core the person adds the resource by hand,
    and the log says so — nothing is retried in a loop, nothing is registered twice."""
    flag = f"{DOMAIN}_card_registered"
    if hass.data.get(flag):
        return
    hass.data[flag] = True
    path = Path(__file__).parent / "www" / "smplwise-card.js"
    if not path.is_file():
        _LOGGER.warning("smplwise-card.js is missing next to the integration; the Lovelace card is unavailable")
        return
    try:
        try:
            from homeassistant.components.http import StaticPathConfig

            await hass.http.async_register_static_paths([StaticPathConfig(CARD_URL, str(path), False)])
        except ImportError:  # cores before 2024.7
            hass.http.register_static_path(CARD_URL, str(path), cache_headers=False)
    except Exception as exc:  # noqa: BLE001
        _LOGGER.warning("could not serve the Lovelace card at %s: %s", CARD_URL, type(exc).__name__)
        return
    url = f"{CARD_URL}?v={VERSION}"
    try:
        lovelace = hass.data.get("lovelace")
        resources = None
        if lovelace is not None:
            resources = getattr(lovelace, "resources", None)
            if resources is None and isinstance(lovelace, dict):
                resources = lovelace.get("resources")
        if resources is None or not hasattr(resources, "async_create_item"):
            _LOGGER.info("Lovelace resources are not managed here (YAML mode?): add %s as a module resource by hand", url)
            return
        if hasattr(resources, "loaded") and not resources.loaded:
            await resources.async_load()
        existing = [r for r in resources.async_items() if str(r.get("url", "")).split("?")[0] == CARD_URL]
        if existing:
            if existing[0].get("url") != url:
                await resources.async_update_item(existing[0]["id"], {"url": url})
                _LOGGER.info("Lovelace resource updated to %s", url)
            return
        await resources.async_create_item({"res_type": "module", "url": url})
        _LOGGER.info("Lovelace resource %s registered; add 'custom:smplwise-card' to a dashboard", url)
    except Exception as exc:  # noqa: BLE001
        _LOGGER.warning("Lovelace resource not registered (%s): add %s as a module resource by hand", type(exc).__name__, url)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    await _async_register_card(hass)
    url = entry.data[CONF_ADDON_URL].rstrip("/")
    secret = entry.data[CONF_PAIRING_CODE]
    verifier = Verifier(secret)
    session = async_get_clientsession(hass)

    async def execute(call: ServiceCall) -> ServiceResponse:
        msg = dict(call.data)
        reason = verifier.verify(msg)
        if reason:
            _LOGGER.warning("smplwise_bridge.execute refused: %s", reason)
            return {"ok": False, "error": reason}
        domain, service = msg["domain"], msg["service"]
        if (domain, service) not in ALLOWED_SERVICES:
            return {"ok": False, "error": "service_not_allowed"}
        user = await hass.auth.async_get_user(msg["user_id"])
        if user is None or not user.is_active:
            return {"ok": False, "error": "unknown_user"}
        data = dict(msg["data"])
        if not data.get("entity_id"):
            return {"ok": False, "error": "entity_required"}
        context = Context(user_id=user.id)
        try:
            await hass.services.async_call(domain, service, data, blocking=True, context=context)
        except Unauthorized:
            return {"ok": False, "error": "unauthorized"}
        except Exception as exc:  # noqa: BLE001
            _LOGGER.warning("smplwise_bridge.execute %s.%s failed: %s", domain, service, type(exc).__name__)
            return {"ok": False, "error": type(exc).__name__}
        return {"ok": True, "context_id": context.id, "request_id": msg["request_id"]}

    hass.services.async_register(DOMAIN, SERVICE_EXECUTE, execute, schema=EXECUTE_SCHEMA, supports_response=SupportsResponse.ONLY)

    async def push_directory(_now: Any = None) -> int:
        users = []
        for u in await hass.auth.async_get_users():
            if u.system_generated:
                continue
            username = None
            for cred in u.credentials:
                if cred.auth_provider_type == "homeassistant":
                    username = cred.data.get("username")
                    break
            users.append({"id": u.id, "name": u.name, "username": username, "is_active": u.is_active, "is_admin": u.is_admin, "group_ids": [g.id for g in u.groups]})
        try:
            async with session.post(f"{url}/api/v1/ha/bridge/directory", json=sign(secret, {"users": users, "version": VERSION}), timeout=10) as resp:
                if resp.status != 200:
                    _LOGGER.debug("directory push answered %s", resp.status)
                    return 0
        except Exception as exc:  # noqa: BLE001
            _LOGGER.debug("directory push failed: %s", type(exc).__name__)
            return 0
        return len(users)

    async def sync_directory(call: ServiceCall) -> ServiceResponse:
        """Push the user directory now (the add-on's 'sync users' button)."""
        return {"users": await push_directory()}

    hass.services.async_register(DOMAIN, SERVICE_SYNC, sync_directory, supports_response=SupportsResponse.OPTIONAL)
    entry.async_on_unload(async_track_time_interval(hass, push_directory, timedelta(seconds=DIRECTORY_INTERVAL_S)))
    hass.async_create_task(push_directory())
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.services.async_remove(DOMAIN, SERVICE_EXECUTE)
    hass.services.async_remove(DOMAIN, SERVICE_SYNC)
    return True
