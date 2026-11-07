"""Config flow: either discovered through the Supervisor (the add-on announces itself with the pairing code,
the user only confirms) or entered by hand (add-on address + pairing code from the add-on's settings)."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.service_info.hassio import HassioServiceInfo

from .const import CONF_ADDON_URL, CONF_DELEGATED_AUTHORING, CONF_DELEGATED_CHANGED_AT, CONF_LOCAL_IDENTITY_EXTENDED, CONF_LOCAL_IDENTITY_RUNNABLE, CONF_PAIRING_CODE, CONF_SERVICE_USER_ID, CONF_WISKEY_AUTO_INSTALL, CONF_WISKEY_EXECUTE_POLICY, DEFAULT_ADDON_URL, DOMAIN, VERSION
from .runnable import RUNNABLE_DOMAINS, parse_runnable, selector_value
from .service_identity import options_error
from .signing import sign
from .wiskey_door_block import POLICIES as DOOR_POLICIES, policy as door_policy

_LOGGER = logging.getLogger(__name__)


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
        auto = cfg.get("wiskey_auto_install") is True
        existing = await self.async_set_unique_id(DOMAIN)
        if existing is not None:
            return await self._discovered_for_existing(existing, url, code, auto)
        self._abort_if_unique_id_configured()
        self._discovered = {CONF_ADDON_URL: url, CONF_PAIRING_CODE: code}
        self._addon_name = discovery_info.name or self._addon_name
        self.context["title_placeholders"] = {"addon": self._addon_name}
        if auto:
            # 0.10.x (WISKEY-ADOPT-2272, owner28): the add-on's own authenticated Supervisor discovery asks for the automatic
            # installation - the entry is created after a successful signed ping, without the confirmation form
            err = await self._try_pair(url, code)
            if err is not None:
                return self.async_abort(reason=err)
            return self.async_create_entry(title="SMPLWISE Bridge", data={**self._discovered, CONF_WISKEY_AUTO_INSTALL: True})
        return await self.async_step_hassio_confirm()

    async def _discovered_for_existing(self, entry: config_entries.ConfigEntry, url: str, code: str, auto: bool):
        """0.10.3 (BRIDGE-STALE-DISCOVERY-2383): an existing entry takes a discovered (regenerated) pairing code ONLY when the add-on accepts it.

        Home Assistant replays every Supervisor discovery message at each start, and a message the add-on posted once stays until it is
        deleted - so a discovery may carry an OLD code. Applying it blindly wrote that code into the entry, the reload threw the working key
        set away (keyset.KeySet K-02 "repaired") and every signed push was refused. Now: nothing to change -> abort without a call; else one
        signed ping with the discovered code (the same `_try_pair` as a first install); accepted -> the entry is updated and reloaded as before
        (the K-02 re-pair path); refused or unreachable -> abort `already_configured` WITHOUT updates. Never logs a code. Review H4: only the
        automatic-install discovery adds the entry flag that lets the bridge set up the native intercom component.

        0.10.4 (BRIDGE-UPDATE-LISTENER-2401): the accepted update reloads the entry exactly once, and never as a flow reload on top of an
        update listener (deprecated in Home Assistant 2026.6, refused from 2026.12). A loaded bridge listens to its entry and schedules that
        reload itself (`entry_updated` in __init__.py), so the flow passes `reload_on_update=False`; an entry without a listener (not loaded,
        or waiting for a setup retry) keeps the flow's own reload, which Home Assistant performs only for a loaded or retrying entry."""
        updates = {CONF_ADDON_URL: url, CONF_PAIRING_CODE: code, **({CONF_WISKEY_AUTO_INSTALL: True} if auto else {})}
        data = dict(getattr(entry, "data", None) or {})
        if getattr(entry, "source", None) == config_entries.SOURCE_IGNORE or all(data.get(k) == v for k, v in updates.items()):
            self._abort_if_unique_id_configured()
            return self.async_abort(reason="already_configured")
        err = await self._try_pair(url, code)
        if err is None:
            self._abort_if_unique_id_configured(updates=updates, reload_on_update=not getattr(entry, "update_listeners", None))
            return self.async_abort(reason="already_configured")  # not reached: the call above aborts the flow after updating the entry
        _LOGGER.info("SMPLWISE Bridge: a discovery offered a pairing code the add-on did not accept (%s); the existing entry is kept unchanged", err)
        return self.async_abort(reason="already_configured")

    def _entry_to_reconfigure(self) -> config_entries.ConfigEntry | None:
        """The entry a Reconfigure flow was opened for (Home Assistant's own helper where the core has it, else the context's entry id)."""
        getter = getattr(self, "_get_reconfigure_entry", None)
        if getter is not None:
            try:
                return getter()
            except Exception:  # noqa: BLE001 - an older core: fall back to the context
                pass
        entry_id = (self.context or {}).get("entry_id")
        return self.hass.config_entries.async_get_entry(entry_id) if entry_id else None

    async def async_step_reconfigure(self, user_input: dict[str, Any] | None = None):
        """0.10.6 (WXH4-EMERGENCY-REVOKE-2407): the manual re-pair - the fallback when the add-on's new pairing code cannot reach this
        entry by itself (after an emergency revocation of the bridge key in the add-on, with the automatic discovery path closed).

        An administrator types the add-on address and the NEW pairing code the add-on shows (after its own re-authentication). The code is
        taken only when the add-on accepts it - one signed ping with that code, the same `_try_pair` as a first install and as the discovery
        re-pair path (0.10.3); a refused or unreachable code changes nothing and the form says why. Accepted -> the entry's data is updated;
        the loaded entry's update listener (0.10.4, `entry_updated`) schedules its one reload, which takes the K-02 re-pair path (a fresh key
        set from the new code; the old key is never used again). An entry without a listener (not loaded / waiting for a retry) is reloaded
        here through the core's scheduler - never a flow reload on top of an update listener (refused from Home Assistant 2026.12). The
        options (service identity, delegation, runnable list, WisKey door block) are kept. Never logs a code."""
        entry = self._entry_to_reconfigure()
        if entry is None:
            return self.async_abort(reason="reconfigure_missing")
        data = dict(getattr(entry, "data", None) or {})
        errors: dict[str, str] = {}
        url_now = str(data.get(CONF_ADDON_URL) or DEFAULT_ADDON_URL)
        if user_input is not None:
            url = str(user_input.get(CONF_ADDON_URL) or "").strip().rstrip("/") or url_now.rstrip("/")
            code = str(user_input.get(CONF_PAIRING_CODE) or "").strip()
            url_now = url
            err = "invalid_auth" if not code else await self._try_pair(url, code)
            if err is None:
                self.hass.config_entries.async_update_entry(entry, data={**data, CONF_ADDON_URL: url, CONF_PAIRING_CODE: code})
                if not getattr(entry, "update_listeners", None):
                    schedule = getattr(self.hass.config_entries, "async_schedule_reload", None)
                    if schedule is not None:
                        schedule(entry.entry_id)
                _LOGGER.info("SMPLWISE Bridge: re-paired by hand with a pairing code the add-on accepted")
                return self.async_abort(reason="reconfigure_successful")
            _LOGGER.info("SMPLWISE Bridge: a pairing code typed in Reconfigure was not accepted by the add-on (%s); the entry is unchanged", err)
            errors["base"] = err
        schema = vol.Schema({vol.Required(CONF_ADDON_URL, default=url_now): str, vol.Required(CONF_PAIRING_CODE): str})
        return self.async_show_form(step_id="reconfigure", data_schema=schema, errors=errors)

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
        # 0.10.5 (DOOR-BRIDGE-BLOCK-2404, CR-033 D5a): the WisKey door block - `blocked` unless an administrator chose `allowed` here
        door_now = door_policy(options)
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
            door_now = door_policy({CONF_WISKEY_EXECUTE_POLICY: user_input.get(CONF_WISKEY_EXECUTE_POLICY, door_now)})  # anything but `allowed` = blocked
            if not errors:
                changed_at = options.get(CONF_DELEGATED_CHANGED_AT)
                if new != current:
                    changed_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
                return self.async_create_entry(title="", data={**options, CONF_DELEGATED_AUTHORING: new, CONF_DELEGATED_CHANGED_AT: changed_at, CONF_SERVICE_USER_ID: typed or None,
                                                             CONF_LOCAL_IDENTITY_EXTENDED: extended, CONF_LOCAL_IDENTITY_RUNNABLE: sorted(runnable_ids or ()),
                                                             CONF_WISKEY_EXECUTE_POLICY: door_now})
        schema = vol.Schema({vol.Optional(CONF_DELEGATED_AUTHORING, default=current): bool, vol.Optional(CONF_SERVICE_USER_ID, default=service_user): str,
                             vol.Optional(CONF_LOCAL_IDENTITY_EXTENDED, default=extended): bool,
                             # suggested_value, not default: with a default, clearing every item would bring the old list back
                             vol.Optional(CONF_LOCAL_IDENTITY_RUNNABLE, description={"suggested_value": runnable_list}):
                                 selector.EntitySelector(selector.EntitySelectorConfig(domain=list(RUNNABLE_DOMAINS), multiple=True)),
                             vol.Optional(CONF_WISKEY_EXECUTE_POLICY, default=door_now):
                                 selector.SelectSelector(selector.SelectSelectorConfig(options=list(DOOR_POLICIES), translation_key=CONF_WISKEY_EXECUTE_POLICY,
                                                                                       mode=selector.SelectSelectorMode.DROPDOWN))})
        return self.async_show_form(step_id="init", data_schema=schema, errors=errors)
