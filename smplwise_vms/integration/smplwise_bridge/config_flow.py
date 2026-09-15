"""Config flow: either discovered through the Supervisor (the add-on announces itself with the pairing code,
the user only confirms) or entered by hand (add-on address + pairing code from the add-on's settings)."""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.service_info.hassio import HassioServiceInfo

from .const import CONF_ADDON_URL, CONF_PAIRING_CODE, DEFAULT_ADDON_URL, DOMAIN, VERSION
from .signing import sign


class SmplwiseBridgeConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self) -> None:
        self._discovered: dict[str, str] | None = None
        self._addon_name = "SMPLWISE VMS"

    async def _try_pair(self, url: str, code: str) -> str | None:
        """Ping the add-on with a signed message; returns an error key or None when paired."""
        session = async_get_clientsession(self.hass)
        try:
            async with session.post(f"{url}/api/v1/ha/bridge/ping", json=sign(code, {"version": VERSION}), timeout=10) as resp:
                if resp.status == 200:
                    return None
                return "invalid_auth" if resp.status == 401 else "unknown"
        except Exception:  # noqa: BLE001 - the flow reports connectivity, not exception types
            return "cannot_connect"

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        errors: dict[str, str] = {}
        if user_input is not None:
            url = user_input[CONF_ADDON_URL].rstrip("/")
            code = user_input[CONF_PAIRING_CODE].strip()
            err = await self._try_pair(url, code)
            if err is None:
                return self.async_create_entry(title="SMPLWISE Bridge", data={CONF_ADDON_URL: url, CONF_PAIRING_CODE: code})
            errors["base"] = err
        schema = vol.Schema({vol.Required(CONF_ADDON_URL, default=DEFAULT_ADDON_URL): str, vol.Required(CONF_PAIRING_CODE): str})
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    async def async_step_hassio(self, discovery_info: HassioServiceInfo):
        """Discovery message posted by the add-on: {addon_url, pairing_code}."""
        cfg = dict(discovery_info.config or {})
        url = str(cfg.get("addon_url") or DEFAULT_ADDON_URL).rstrip("/")
        code = str(cfg.get("pairing_code") or "").strip()
        if not code:
            return self.async_abort(reason="invalid_discovery")
        await self.async_set_unique_id(DOMAIN)
        # An existing entry takes the (possibly regenerated) pairing code and reloads; nothing is duplicated.
        self._abort_if_unique_id_configured(updates={CONF_ADDON_URL: url, CONF_PAIRING_CODE: code})
        self._discovered = {CONF_ADDON_URL: url, CONF_PAIRING_CODE: code}
        self._addon_name = discovery_info.name or self._addon_name
        self.context["title_placeholders"] = {"addon": self._addon_name}
        return await self.async_step_hassio_confirm()

    async def async_step_hassio_confirm(self, user_input: dict[str, Any] | None = None):
        assert self._discovered is not None
        errors: dict[str, str] = {}
        if user_input is not None:
            err = await self._try_pair(self._discovered[CONF_ADDON_URL], self._discovered[CONF_PAIRING_CODE])
            if err is None:
                return self.async_create_entry(title="SMPLWISE Bridge", data=self._discovered)
            errors["base"] = err
        return self.async_show_form(step_id="hassio_confirm", data_schema=vol.Schema({}), errors=errors, description_placeholders={"addon": self._addon_name})
