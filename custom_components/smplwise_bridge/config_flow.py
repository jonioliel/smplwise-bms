"""Config flow: either discovered through the Supervisor (the add-on announces itself with the pairing code,
the user only confirms) or entered by hand (add-on address + pairing code from the add-on's settings).

0.9.1 (CR-040): every accepted pairing code that is NEW gets a fresh random `pairing_id` and trust epoch 1 - a re-pair starts the
trust epoch again (trust.reconcile). A discovery that carries the key the bridge already holds (the add-on announces its current key
at every start, also after a rotation) changes nothing and reloads nothing; only a different code is a re-pair."""
from __future__ import annotations

import datetime as dt
import hmac
import secrets
from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.service_info.hassio import HassioServiceInfo

from .const import CONF_ADDON_URL, CONF_DELEGATED_AUTHORING, CONF_DELEGATED_CHANGED_AT, CONF_PAIRING_CODE, CONF_PAIRING_ID, CONF_SERVICE_USER_ID, CONF_TRUST_EPOCH, DEFAULT_ADDON_URL, DOMAIN, VERSION
from .service_identity import options_error
from .signing import sign
from .trust_service import current_key_of


def new_pairing(code: str) -> dict[str, Any]:
    """The config entry fields of a NEW pairing (0.9.1): the code, a fresh random pairing id (never derived from the code), epoch 1."""
    return {CONF_PAIRING_CODE: code, CONF_PAIRING_ID: secrets.token_hex(8), CONF_TRUST_EPOCH: 1}


def same_pairing(code: str, entry_code: Any, running_key: Any) -> bool:
    """Whether a discovered code is the key this bridge already holds (the running one, or the config entry's). Constant time."""
    return any(isinstance(k, str) and k and hmac.compare_digest(k.encode("utf-8"), code.encode("utf-8")) for k in (running_key, entry_code))


class SmplwiseBridgeConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self) -> None:
        self._discovered: dict[str, Any] | None = None
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
                return self.async_create_entry(title="SMPLWISE Bridge", data={CONF_ADDON_URL: url, **new_pairing(code)})
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
        # An existing entry takes a (regenerated) DIFFERENT pairing code as a re-pair - a new pairing id and epoch 1 - and reloads;
        # the key it already holds changes nothing (0.9.1: the add-on re-announces its current key, also after a rotation). Nothing is duplicated.
        updates: dict[str, Any] = {CONF_ADDON_URL: url}
        existing = next(iter(self._async_current_entries()), None)
        if existing is not None:
            if not same_pairing(code, existing.data.get(CONF_PAIRING_CODE), current_key_of(self.hass)):
                updates.update(new_pairing(code))
        self._abort_if_unique_id_configured(updates=updates)
        self._discovered = {CONF_ADDON_URL: url, **new_pairing(code)}
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
        errors: dict[str, str] = {}
        if user_input is not None:
            new = bool(user_input.get(CONF_DELEGATED_AUTHORING, False))
            # 0.9.0 (USR2 P3): the service identity for Arx-only users - ONE existing, active, NON-administrator HA user (32-hex id), or empty
            typed = str(user_input.get(CONF_SERVICE_USER_ID) or "").strip().lower()
            err = await options_error(self.hass, typed)
            if err:
                errors[CONF_SERVICE_USER_ID] = err
                service_user = typed
            else:
                changed_at = options.get(CONF_DELEGATED_CHANGED_AT)
                if new != current:
                    changed_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
                return self.async_create_entry(title="", data={**options, CONF_DELEGATED_AUTHORING: new, CONF_DELEGATED_CHANGED_AT: changed_at, CONF_SERVICE_USER_ID: typed or None})
        schema = vol.Schema({vol.Optional(CONF_DELEGATED_AUTHORING, default=current): bool, vol.Optional(CONF_SERVICE_USER_ID, default=service_user): str})
        return self.async_show_form(step_id="init", data_schema=schema, errors=errors)
