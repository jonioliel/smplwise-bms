"""Config flow: either discovered through the Supervisor (the add-on announces itself with the pairing code,
the user only confirms) or entered by hand (add-on address + pairing code from the add-on's settings)."""
from __future__ import annotations

import datetime as dt
from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.service_info.hassio import HassioServiceInfo

from .const import CONF_ADDON_URL, CONF_DELEGATED_AUTHORING, CONF_DELEGATED_CHANGED_AT, CONF_LOCAL_IDENTITY_EXTENDED, CONF_LOCAL_IDENTITY_RUNNABLE, CONF_PAIRING_CODE, CONF_SERVICE_USER_ID, DEFAULT_ADDON_URL, DOMAIN, VERSION
from .runnable import RUNNABLE_DOMAINS, parse_runnable, selector_value
from .service_identity import options_error
from .signing import sign


class SmplwiseBridgeConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self) -> None:
        self._discovered: dict[str, str] | None = None
        self._addon_name = "SmplWise Arx"

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry) -> config_entries.OptionsFlow:
        """0.6.0 (CR-017): the options of the bridge - today one switch, the owner-approved delegation of saving automations (section 8.3)."""
        return SmplwiseBridgeOptionsFlow(config_entry)

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
        if cfg.get("wiskey_auto_install") is True:
            # 0.10.x (WISKEY-ADOPT-2272, owner28): the add-on's own authenticated Supervisor discovery asks for the automatic
            # installation - the entry is created after a successful signed ping, without the confirmation form
            err = await self._try_pair(url, code)
            if err is not None:
                return self.async_abort(reason=err)
            return self.async_create_entry(title="SMPLWISE Bridge", data=self._discovered)
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


class SmplwiseBridgeOptionsFlow(config_entries.OptionsFlow):
    """The delegation switch (CR-017 section 8.3, the owner's approval of 2026-10-01): "let Arx save automations, scenes and scripts for users who are not
    administrators" - simple-builder content only, off by default. It lives HERE, inside Home Assistant, because only a Home Assistant administrator may open
    this form: the product itself can neither turn it on nor change it. The bridge reads it live on every call; the add-on only shows it, read-only."""

    def __init__(self, config_entry: config_entries.ConfigEntry | None = None) -> None:
        # newer cores provide `self.config_entry` themselves (and forbid setting it); older ones need the entry handed in
        self._entry_arg = config_entry

    def _entry(self) -> config_entries.ConfigEntry | None:
        try:
            return self.config_entry
        except Exception:  # noqa: BLE001 - an older core without the property
            return self._entry_arg

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        entry = self._entry()
        options = dict(entry.options) if entry is not None else {}
        current = bool(options.get(CONF_DELEGATED_AUTHORING, False))
        service_user = str(options.get(CONF_SERVICE_USER_ID) or "")
        extended = bool(options.get(CONF_LOCAL_IDENTITY_EXTENDED, False))
        runnable_list = selector_value(options.get(CONF_LOCAL_IDENTITY_RUNNABLE))
        errors: dict[str, str] = {}
        if user_input is not None:
            new = bool(user_input.get(CONF_DELEGATED_AUTHORING, False))
            # 0.9.1 (SVCIDENT2): the extended mode of the service identity - off by default; the add-on has its own copy (both must be on)
            extended = user_input.get(CONF_LOCAL_IDENTITY_EXTENDED, False) is True
            # 0.9.0 (USR2 P3): the service identity for Arx-only users - ONE existing, active, NON-administrator HA user (32-hex id), or empty
            typed = str(user_input.get(CONF_SERVICE_USER_ID) or "").strip().lower()
            err = await options_error(self.hass, typed)
            # 0.9.2 (SVCIDENT3, review S1): the scripts / scenes / automations Arx-only users may run - entity ids, empty by default.
            # 0.9.4 (EXTID-295, CR-USR2 12.4 item 4): picked from a list instead of typed; the list is judged exactly as the text was
            # (domains, format, at most 100) and a cleared picker (key absent) stores an empty list
            runnable_ids, runnable_err = parse_runnable(user_input.get(CONF_LOCAL_IDENTITY_RUNNABLE))
            if runnable_err:
                errors[CONF_LOCAL_IDENTITY_RUNNABLE] = runnable_err
            else:
                runnable_list = sorted(runnable_ids or ())
            if err:
                errors[CONF_SERVICE_USER_ID] = err
            service_user = typed  # shown again as typed when the form returns with an error
            if not errors:
                changed_at = options.get(CONF_DELEGATED_CHANGED_AT)
                if new != current:
                    changed_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
                return self.async_create_entry(title="", data={**options, CONF_DELEGATED_AUTHORING: new, CONF_DELEGATED_CHANGED_AT: changed_at, CONF_SERVICE_USER_ID: typed or None,
                                                             CONF_LOCAL_IDENTITY_EXTENDED: extended, CONF_LOCAL_IDENTITY_RUNNABLE: sorted(runnable_ids or ())})
        schema = vol.Schema({vol.Optional(CONF_DELEGATED_AUTHORING, default=current): bool, vol.Optional(CONF_SERVICE_USER_ID, default=service_user): str,
                             vol.Optional(CONF_LOCAL_IDENTITY_EXTENDED, default=extended): bool,
                             # suggested_value, not default: with a default, clearing every item would bring the old list back
                             vol.Optional(CONF_LOCAL_IDENTITY_RUNNABLE, description={"suggested_value": runnable_list}):
                                 selector.EntitySelector(selector.EntitySelectorConfig(domain=list(RUNNABLE_DOMAINS), multiple=True))})
        return self.async_show_form(step_id="init", data_schema=schema, errors=errors)
