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
4. `smplwise_bridge.schedule` (0.3.0, CR-014): signed writes to the Scheduler component (add / edit / remove / copy /
   run / enable / disable), independently re-validated by schedule_policy.py and schedule_service.py.
5. `smplwise_bridge.stream_source` (0.3.1): a signed READ-ONLY answer - the stream source Home Assistant reports for ONE
   camera entity the owner chose to show as live video (stream_source_service.py). The URL may carry credentials: it is
   returned only to the add-on and never logged.
6. `smplwise_bridge.execute` grows the media services of the multimedia area (0.4.0, CR-015): volume steps, play / pause, next /
   previous, `select_source`, `play_media` (send_key / send_text only), `remote.send_command`, `remote.turn_on` with an activity,
   `webostv.button`, `webostv.select_sound_output` - each independently re-checked by media_policy.py (no power key anywhere, a source
   or activity only from the entity's current lists, no extra arguments, never `remote.turn_off` or `webostv.command`).
7. `smplwise_bridge.execute` grows the speaker / player / receiver services (0.5.0, CR-016): `media_seek`, `shuffle_set`, `repeat_set`, `select_sound_mode`,
   `join` / `unjoin`, `music_assistant.play_media` (an MA library / provider URI only - never a URL) and `music_assistant.transfer_queue` - again each
   re-checked by media_policy.py; announcements, `heos.sign_in`, `sonos.update_alarm`, helper-group management and the `jellyfin` domain never.
8. `smplwise_bridge.media_query` (0.5.0): a signed READ-ONLY answer - a speaker's queue, or the music library - through Music Assistant's response services
   (media_query_service.py); the config entry is found inside the bridge and never a parameter.
9. `smplwise_bridge.config_item` (0.6.0, CR-017): signed writes to the automations, scripts and scenes of the installation - the same files and the same format the
   Home Assistant editor writes (`automations.yaml`, `scripts.yaml`, `scenes.yaml`) - and the runtime ops on them (enable / disable / trigger / run / stop / apply a scene,
   all with the caller's own Context). `upsert` and `delete` are judged again here, independently of the add-on, by config_policy.py (closed block schemas, the builder
   service allow-list, no code or secret anywhere that is authored, every block outside the schemas byte-identical to a stored one, the sensitive flag), written by
   config_store.py (compare-and-set against the revision the user edited, a ring of 10 backups, an atomic write that is read back) and followed by a reload of ONLY the
   changed item (config_service.py). An HA administrator may always write; anyone else only when the options-flow switch "delegated authoring" is on (off by default;
   changed only inside Home Assistant) and only for simple-builder content (profile `builder`) - an HA administrator is always needed for the `code` profile.
   Never called from here: a reload of anything else, `homeassistant.*`, `hassio.*`, the user directory, an item that calls this bridge. The switch state and its change
   time travel to the add-on with the user directory push.
10. `smplwise_bridge.cast_stream` (0.7.0, CR-028 phase 1): play the add-on's cast-relay URL on ONE Google Cast media_player, stop it, or switch it off - as the
   caller's own HA user. cast_policy.py decides independently of the add-on: the target's registry platform is `cast`, the URL is exactly
   `http://<host>:<port>/cast/<32 hex>/index.m3u8`, `<host>:<port>` is the origin the paired add-on announced (a signed `cast` block in its answer to the
   user-directory push) and the host is an address of THIS machine. `execute` still refuses every other `play_media` URL (media_policy.py, unchanged).
"""
from __future__ import annotations

import logging
from datetime import timedelta
from pathlib import Path
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Context, HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.exceptions import ServiceValidationError, Unauthorized
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_interval

from .cast_service import async_handle_cast_stream, note_origin
from .config_service import async_handle_config_item
from .const import (CONF_ADDON_URL, CONF_DELEGATED_AUTHORING, CONF_DELEGATED_CHANGED_AT, CONF_PAIRING_CODE, DIRECTORY_INTERVAL_S, DOMAIN, SERVICE_CAST_STREAM, SERVICE_CONFIG_ITEM,
                    SERVICE_EXECUTE, SERVICE_MEDIA_QUERY, SERVICE_SCHEDULE, SERVICE_SET_AREA, SERVICE_STREAM_SOURCE, SERVICE_SYNC, VERSION)
from . import media_policy
from .media_query_service import async_handle_media_query
from .schedule_service import async_handle_schedule, execute_refusal
from .signing import Verifier, sign
from .stream_source_service import async_handle_stream_source

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

# 0.2.5 (CR-007 slice 4, tightened on review NIT 8): the one registry write this bridge ever performs - move an
# entity to a NAMED HA area. area_id is a non-empty string, never null: the product only ever assigns an entity to
# an area today, and clearing one is not an approved flow, so the schema does not accept it until it is. Never
# name, icon, aliases, disabled_by or anything else: the allow-list is exactly this one field of this one registry.
SET_AREA_SCHEMA = vol.Schema(
    {
        vol.Required("user_id"): cv.string,
        vol.Required("entity_id"): cv.string,
        vol.Required("area_id"): vol.All(cv.string, vol.Length(min=1)),
        vol.Required("request_id"): cv.string,
        vol.Required("ts"): vol.Coerce(int),
        vol.Required("nonce"): cv.string,
        vol.Required("sig"): cv.string,
    },
    extra=vol.ALLOW_EXTRA,
)

# 0.3.0 (CR-014): the schedule service. NO defaults here: Home Assistant would add the defaulted keys to call.data after
# the add-on signed it, and the signature (over every key but ts / nonce / sig) would no longer match. Optional keys
# are absent or null exactly as signed; schedule_policy.py checks every value and refuses unknown keys.
SCHEDULE_SCHEMA = vol.Schema(
    {
        vol.Required("user_id"): cv.string,
        vol.Required("op"): cv.string,
        vol.Required("request_id"): cv.string,
        vol.Optional("schedule_id"): vol.Any(None, str),
        vol.Optional("schedule_entity_id"): vol.Any(None, str),
        vol.Optional("payload"): vol.Any(None, dict),
        vol.Optional("name"): vol.Any(None, str),
        vol.Optional("time"): vol.Any(None, str),
        vol.Optional("skip_conditions"): bool,
        vol.Optional("sensitive"): bool,
        vol.Required("ts"): vol.Coerce(int),
        vol.Required("nonce"): cv.string,
        vol.Required("sig"): cv.string,
    },
    extra=vol.ALLOW_EXTRA,
)

# 0.3.1: the stream-source question. Exactly these keys, no defaults and no extras (the signature covers every key but
# ts / nonce / sig): one camera entity id, asked on behalf of one HA user.
STREAM_SOURCE_SCHEMA = vol.Schema(
    {
        vol.Required("user_id"): cv.string,
        vol.Required("entity_id"): cv.string,
        vol.Required("request_id"): cv.string,
        vol.Required("ts"): vol.Coerce(int),
        vol.Required("nonce"): cv.string,
        vol.Required("sig"): cv.string,
    },
    extra=vol.PREVENT_EXTRA,
)

# 0.5.0 (CR-016): the music-layer question. Exactly these keys and no extras; the arguments of each query are the closed sets of
# media_policy.query_refusal. NO defaults (the signature covers every key but ts / nonce / sig). Never a config entry id.
MEDIA_QUERY_SCHEMA = vol.Schema(
    {
        vol.Required("user_id"): cv.string,
        vol.Required("query"): cv.string,
        vol.Optional("entity_id"): cv.string,
        vol.Optional("media_type"): cv.string,
        vol.Optional("favorite"): bool,
        vol.Optional("limit"): int,
        vol.Optional("offset"): int,
        vol.Optional("order_by"): cv.string,
        vol.Required("request_id"): cv.string,
        vol.Required("ts"): vol.Coerce(int),
        vol.Required("nonce"): cv.string,
        vol.Required("sig"): cv.string,
    },
    extra=vol.PREVENT_EXTRA,
)

# 0.6.0 (CR-017): the automations service. NO defaults (the signature covers every key but ts / nonce / sig); config_policy.validate_message refuses a key outside the op's own set
# and every value is judged there. `config` is the item exactly as it is to be stored; `preserved` the fingerprints of the blocks kept byte for byte.
CONFIG_ITEM_SCHEMA = vol.Schema(
    {
        vol.Required("user_id"): cv.string,
        vol.Required("op"): cv.string,
        vol.Required("request_id"): cv.string,
        vol.Optional("kind"): vol.Any(None, str),
        vol.Optional("item_id"): vol.Any(None, str),
        vol.Optional("base_revision"): vol.Any(None, str),
        vol.Optional("profile"): vol.Any(None, str),
        vol.Optional("config"): vol.Any(None, dict),
        vol.Optional("preserved"): vol.Any(None, list),
        vol.Optional("sensitive"): bool,
        vol.Optional("variables"): vol.Any(None, dict),
        vol.Optional("skip_condition"): vol.Any(None, bool),
        vol.Optional("entity_id"): vol.Any(None, str),
        vol.Required("ts"): vol.Coerce(int),
        vol.Required("nonce"): cv.string,
        vol.Required("sig"): cv.string,
    },
    extra=vol.ALLOW_EXTRA,
)

# 0.7.0 (CR-028): the cast service. Exactly these keys, no defaults and no extras (the signature covers every key but ts / nonce / sig); cast_policy.py
# refuses a key outside the op's own set and judges every value.
CAST_STREAM_SCHEMA = vol.Schema(
    {
        vol.Required("user_id"): cv.string,
        vol.Required("op"): cv.string,
        vol.Required("entity_id"): cv.string,
        vol.Optional("url"): cv.string,
        vol.Optional("title"): cv.string,
        vol.Required("request_id"): cv.string,
        vol.Required("ts"): vol.Coerce(int),
        vol.Required("nonce"): cv.string,
        vol.Required("sig"): cv.string,
    },
    extra=vol.PREVENT_EXTRA,
)

# Only these may ever be executed, whatever the add-on asks for (defence in depth: the add-on has the same list).
ALLOWED_SERVICES = {
    ("light", "turn_on"), ("light", "turn_off"), ("switch", "turn_on"), ("switch", "turn_off"), ("fan", "turn_on"), ("fan", "turn_off"),
    ("cover", "open_cover"), ("cover", "close_cover"), ("cover", "stop_cover"), ("lock", "lock"), ("lock", "unlock"),
    ("button", "press"), ("script", "turn_on"), ("scene", "turn_on"),
    # 0.2.1 (T040): more adapters — the add-on validates the arguments, Home Assistant decides per user
    ("climate", "set_hvac_mode"), ("climate", "set_temperature"),
    ("media_player", "media_play"), ("media_player", "media_pause"), ("media_player", "media_stop"), ("media_player", "volume_set"),
    ("number", "set_value"), ("input_number", "set_value"), ("select", "select_option"), ("input_select", "select_option"),
    ("input_boolean", "turn_on"), ("input_boolean", "turn_off"), ("vacuum", "start"), ("vacuum", "return_to_base"),
    ("siren", "turn_on"), ("siren", "turn_off"),
    ("alarm_control_panel", "alarm_arm_home"), ("alarm_control_panel", "alarm_arm_away"), ("alarm_control_panel", "alarm_disarm"),
    # 0.2.4 (CR-007 slice 2): the devices area's single-entity controls
    ("fan", "set_percentage"), ("cover", "set_cover_position"), ("climate", "set_fan_mode"), ("climate", "turn_off"),
    ("media_player", "turn_on"), ("media_player", "turn_off"), ("media_player", "volume_mute"),
    # 0.2.5 (CR-007 slice 4): climate/covers in full
    ("climate", "set_preset_mode"), ("climate", "set_swing_mode"), ("climate", "set_humidity"),
    ("humidifier", "set_humidity"), ("humidifier", "set_mode"),
    ("cover", "open_cover_tilt"), ("cover", "close_cover_tilt"), ("cover", "stop_cover_tilt"), ("cover", "set_cover_tilt_position"),
    # 0.2.6 (CR-010, the alarm section): the other arm modes a panel may offer. Never alarm_trigger.
    ("alarm_control_panel", "alarm_arm_night"), ("alarm_control_panel", "alarm_arm_vacation"), ("alarm_control_panel", "alarm_arm_custom_bypass"),
    # 0.4.0 (CR-015, the multimedia area): what the remote needs. Each is re-validated by media_policy.py before it runs - no power key,
    # no free-form play_media, no list a caller could smuggle a command through.
    ("media_player", "volume_up"), ("media_player", "volume_down"), ("media_player", "media_play_pause"), ("media_player", "media_next_track"),
    ("media_player", "media_previous_track"), ("media_player", "select_source"), ("media_player", "play_media"),
    ("remote", "send_command"), ("remote", "turn_on"), ("webostv", "button"), ("webostv", "select_sound_output"),
    # 0.5.0 (CR-016, speakers / players / receivers): re-validated by media_policy.py - an MA library URI only (never a URL), a join between players of ONE
    # grouping layer that all report GROUPING now, a transfer between two Music Assistant players, no announcement, no account or alarm service.
    ("media_player", "media_seek"), ("media_player", "shuffle_set"), ("media_player", "repeat_set"), ("media_player", "select_sound_mode"),
    ("media_player", "join"), ("media_player", "unjoin"), ("music_assistant", "play_media"), ("music_assistant", "transfer_queue"),
    # CARD1 (2026-10-07, the equipment cards of the activity window): a robot vacuum's pause, a valve's open / close, a water heater's on / off.
    # Home Assistant still decides per user; the add-on validates the (argument-less) calls and asks for a confirmation grant on valve.open_valve.
    ("vacuum", "pause"), ("valve", "open_valve"), ("valve", "close_valve"), ("water_heater", "turn_on"), ("water_heater", "turn_off"),
}

# 0.2.6 (CR-010): Home Assistant's own translation keys for a refused alarm code (alarm_control_panel and the
# integrations that follow it). The answer names the refusal, never the code: the error text is not forwarded.
CODE_REFUSALS = {"invalid_code": "invalid_code", "invalid_code_format": "invalid_code", "code_arm_required": "code_required"}


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
        # 0.3.0 (CR-014 review): a schedule's own switch is never operated through here (only the add-on refused it before)
        blocked = execute_refusal(hass, data)
        if blocked:
            _LOGGER.warning("smplwise_bridge.execute %s.%s refused: %s", domain, service, blocked)
            return {"ok": False, "error": blocked}
        if media_policy.is_media(domain, service):
            # 0.4.0 (CR-015): the media services are judged here independently of the add-on (media_policy.py); the answer names the refusal only
            def _attributes(entity_id: str) -> Any:
                state = hass.states.get(entity_id)
                return dict(state.attributes) if state is not None else None

            def _platform(entity_id: str) -> Any:  # the registry's platform of the entity (None when it is not registered)
                entry = er.async_get(hass).async_get(entity_id)
                return entry.platform if entry is not None else None

            media_blocked = media_policy.refusal(domain, service, data, _attributes, _platform)
            if media_blocked:
                _LOGGER.warning("smplwise_bridge.execute %s.%s refused: %s", domain, service, media_blocked)
                return {"ok": False, "error": media_blocked}
        context = Context(user_id=user.id)
        try:
            await hass.services.async_call(domain, service, data, blocking=True, context=context)
        except Unauthorized:
            return {"ok": False, "error": "unauthorized"}
        except ServiceValidationError as exc:
            # 0.2.6 (CR-010): a refused alarm code is its own answer (the add-on shows "the code was refused"); the
            # exception text is never returned or logged - only its class or translation key
            refusal = CODE_REFUSALS.get(str(getattr(exc, "translation_key", "") or ""))
            if refusal:
                return {"ok": False, "error": refusal}
            _LOGGER.warning("smplwise_bridge.execute %s.%s refused: %s", domain, service, type(exc).__name__)
            return {"ok": False, "error": type(exc).__name__}
        except Exception as exc:  # noqa: BLE001
            _LOGGER.warning("smplwise_bridge.execute %s.%s failed: %s", domain, service, type(exc).__name__)
            return {"ok": False, "error": type(exc).__name__}
        return {"ok": True, "context_id": context.id, "request_id": msg["request_id"]}

    hass.services.async_register(DOMAIN, SERVICE_EXECUTE, execute, schema=EXECUTE_SCHEMA, supports_response=SupportsResponse.ONLY)

    async def set_entity_area(call: ServiceCall) -> ServiceResponse:
        """0.2.5 (CR-007 slice 4): the one registry write this bridge performs - move an entity to an HA area. Not a
        domain service call (entity_registry.async_update_entity, not hass.services.async_call), so there is no
        per-user Context to check against; the VMS gates this itself (system.configure) and audits under the real
        actor before this is ever called - the signature and the fixed schema (area_id, and nothing else writable)
        are this side's own defence in depth."""
        msg = dict(call.data)
        reason = verifier.verify(msg)
        if reason:
            _LOGGER.warning("smplwise_bridge.set_entity_area refused: %s", reason)
            return {"ok": False, "error": reason}
        user = await hass.auth.async_get_user(msg["user_id"])
        if user is None or not user.is_active:
            return {"ok": False, "error": "unknown_user"}
        entity_id = msg["entity_id"]
        area_id = msg["area_id"]
        ent_reg = er.async_get(hass)
        if ent_reg.async_get(entity_id) is None:
            return {"ok": False, "error": "entity_not_found"}
        if ar.async_get(hass).async_get_area(area_id) is None:
            return {"ok": False, "error": "area_not_found"}
        try:
            ent_reg.async_update_entity(entity_id, area_id=area_id)
        except Exception as exc:  # noqa: BLE001
            _LOGGER.warning("smplwise_bridge.set_entity_area %s failed: %s", entity_id, type(exc).__name__)
            return {"ok": False, "error": type(exc).__name__}
        return {"ok": True, "context_id": None, "request_id": msg["request_id"]}

    hass.services.async_register(DOMAIN, SERVICE_SET_AREA, set_entity_area, schema=SET_AREA_SCHEMA, supports_response=SupportsResponse.ONLY)

    async def schedule(call: ServiceCall) -> ServiceResponse:
        """0.3.0 (CR-014): a signed write to the Scheduler component as the VMS user (see schedule_service.py)."""
        return await async_handle_schedule(hass, verifier, dict(call.data))

    hass.services.async_register(DOMAIN, SERVICE_SCHEDULE, schedule, schema=SCHEDULE_SCHEMA, supports_response=SupportsResponse.ONLY)

    async def stream_source(call: ServiceCall) -> ServiceResponse:
        """0.3.1: a signed READ-ONLY answer - the stream source Home Assistant reports for one camera entity (see
        stream_source_service.py). The URL leaves only in this response; it is never logged."""
        return await async_handle_stream_source(hass, verifier, dict(call.data))

    hass.services.async_register(DOMAIN, SERVICE_STREAM_SOURCE, stream_source, schema=STREAM_SOURCE_SCHEMA, supports_response=SupportsResponse.ONLY)

    async def media_query(call: ServiceCall) -> ServiceResponse:
        """0.5.0 (CR-016): a signed READ-ONLY answer about a speaker's music layer - its queue, or the library (see media_query_service.py). Trimmed; the
        Music Assistant config entry is found here and never a parameter."""
        return await async_handle_media_query(hass, verifier, dict(call.data))

    hass.services.async_register(DOMAIN, SERVICE_MEDIA_QUERY, media_query, schema=MEDIA_QUERY_SCHEMA, supports_response=SupportsResponse.ONLY)

    def _registry_platform(entity_id: str) -> Any:
        reg = er.async_get(hass).async_get(entity_id)
        return reg.platform if reg is not None else None

    async def cast_stream(call: ServiceCall) -> ServiceResponse:
        """0.7.0 (CR-028): play / stop / off on ONE Cast media_player as the VMS user (see cast_service.py and cast_policy.py)."""
        return await async_handle_cast_stream(hass, verifier, dict(call.data), _registry_platform)

    hass.services.async_register(DOMAIN, SERVICE_CAST_STREAM, cast_stream, schema=CAST_STREAM_SCHEMA, supports_response=SupportsResponse.ONLY)

    def delegated() -> bool:
        """The owner-approved switch (CR-017 section 8.3): read live from the options, so a change inside Home Assistant applies to the next call."""
        return bool(entry.options.get(CONF_DELEGATED_AUTHORING, False))

    async def config_item(call: ServiceCall) -> ServiceResponse:
        """0.6.0 (CR-017): a signed write to / run of an automation, script or scene as the VMS user (see config_service.py)."""
        return await async_handle_config_item(hass, verifier, dict(call.data), delegated=delegated)

    hass.services.async_register(DOMAIN, SERVICE_CONFIG_ITEM, config_item, schema=CONFIG_ITEM_SCHEMA, supports_response=SupportsResponse.ONLY)

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
            async with session.post(f"{url}/api/v1/ha/bridge/directory", json=sign(secret, {"users": users, "version": VERSION, "delegated_authoring": delegated(), "delegated_changed_at": entry.options.get(CONF_DELEGATED_CHANGED_AT) or None, "config_item": True}), timeout=10) as resp:
                if resp.status != 200:
                    _LOGGER.debug("directory push answered %s", resp.status)
                    return 0
                try:  # 0.7.0 (CR-028): the add-on's signed cast origin (or null) - verified with the pairing secret in cast_service.note_origin
                    answer = await resp.json(content_type=None)
                    note_origin(verifier, answer.get("cast") if isinstance(answer, dict) else None)
                except Exception:  # noqa: BLE001 - an older add-on answers without it: the origin stays unknown and no cast is played
                    pass
        except Exception as exc:  # noqa: BLE001
            _LOGGER.debug("directory push failed: %s", type(exc).__name__)
            return 0
        return len(users)

    async def sync_directory(call: ServiceCall) -> ServiceResponse:
        """Push the user directory now (the add-on's 'sync users' button)."""
        return {"users": await push_directory()}

    hass.services.async_register(DOMAIN, SERVICE_SYNC, sync_directory, supports_response=SupportsResponse.OPTIONAL)
    entry.async_on_unload(async_track_time_interval(hass, push_directory, timedelta(seconds=DIRECTORY_INTERVAL_S)))

    async def options_updated(_hass: HomeAssistant, _entry: ConfigEntry) -> None:
        """The delegation switch changed inside Home Assistant: tell the add-on now instead of at the next minute (the switch is read live, nothing reloads)."""
        hass.async_create_task(push_directory())

    entry.async_on_unload(entry.add_update_listener(options_updated))
    hass.async_create_task(push_directory())
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.services.async_remove(DOMAIN, SERVICE_EXECUTE)
    hass.services.async_remove(DOMAIN, SERVICE_SET_AREA)
    hass.services.async_remove(DOMAIN, SERVICE_SCHEDULE)
    hass.services.async_remove(DOMAIN, SERVICE_STREAM_SOURCE)
    hass.services.async_remove(DOMAIN, SERVICE_MEDIA_QUERY)
    hass.services.async_remove(DOMAIN, SERVICE_CONFIG_ITEM)
    hass.services.async_remove(DOMAIN, SERVICE_CAST_STREAM)
    hass.services.async_remove(DOMAIN, SERVICE_SYNC)
    return True
