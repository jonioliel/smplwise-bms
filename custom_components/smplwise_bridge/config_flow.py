"""Config flow: one step — the add-on address and the pairing code shown by the add-on."""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_ADDON_URL, CONF_PAIRING_CODE, DEFAULT_ADDON_URL, DOMAIN, VERSION
from .signing import sign


class SmplwiseBridgeConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        errors: dict[str, str] = {}
        if user_input is not None:
            url = user_input[CONF_ADDON_URL].rstrip("/")
            code = user_input[CONF_PAIRING_CODE].strip()
            session = async_get_clientsession(self.hass)
            try:
                async with session.post(f"{url}/api/v1/ha/bridge/ping", json=sign(code, {"version": VERSION}), timeout=10) as resp:
                    if resp.status == 200:
                        return self.async_create_entry(title="SMPLWISE Bridge", data={CONF_ADDON_URL: url, CONF_PAIRING_CODE: code})
                    errors["base"] = "invalid_auth" if resp.status == 401 else "unknown"
            except Exception:  # noqa: BLE001 - the flow reports connectivity, not exception types
                errors["base"] = "cannot_connect"
        schema = vol.Schema({vol.Required(CONF_ADDON_URL, default=DEFAULT_ADDON_URL): str, vol.Required(CONF_PAIRING_CODE): str})
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)
