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
11. The service identity (0.9.0, USR2 phase 3): every signed service first passes service_identity.screen - the signature is verified there once, and
   a message carrying `on_behalf_of` (an Arx-only person) runs as the ONE non-administrator HA user an HA administrator configured in the options flow,
   only for the features / items of service_identity.SERVICE_FEATURES (devices, alarm, media, cast, schedules); automations, the area write and the
   stream source never. The person's id is attribution only. The configured id travels to the add-on with the directory push (its health check).
12. The extended mode (0.9.1, SVCIDENT2): the options-flow switch `local_identity_extended` (off by default). With it on, an Arx-only person may also
   open doors (`lock.unlock`), run `script.turn_on` / `scene.turn_on`, run / trigger / apply from the automations screen (`config_item` run ops
   only, never a write), arm with the bypass set, operate a zone's bypass control and read a camera's
   stream source (the administrator rule of that handler is waived for such a screened message only); the area write never. The add-on has its
   own copy of the switch - both must be on. The switch travels to the add-on with the directory push.
13. The run fences (0.9.2, SVCIDENT3 - the 2.7.0 security review S1 / S2; runnable.py): for a message screened on behalf of an Arx-only person,
   `execute` checks the service user's Home Assistant entity policy for every entity (literal entity ids only), and a script / scene /
   automation runs (`script.turn_on` / `scene.turn_on`, `config_item` `trigger` / `run_script` / `apply_scene`) only when its entity id is on the
   options-flow allowlist `local_identity_runnable` (empty by default) AND the impact check of its steps (one nested level) found no door, no
   disarm, no arming with the bypass set, no service outside the closed step list and no target the service user may not control. The list
   travels to the add-on with the directory push (the add-on has its own copy; both must list the item).
14. Default-policy refusal (0.9.6, EXTID-295 - CR-USR2 13.6, owner decision 3 of 2026-10-21): an item only the extended mode admits is refused
   (`service_identity_policy_default`, in service_identity.screen) while the service user's entity policy is the default one; the directory
   push reports `service_policy_restricted` (a boolean or null). The impact check refuses a step with more than one type key (V-01).
15. The capture lease (0.9.6, LEASEBR-295; docs/contracts/wiskey-capture-lease/): `smplwise_bridge.lease_event` and `smplwise_bridge.lease_request` (final names, const.py). Signed, closed, `supports_response: ONLY`, data exactly `{signed_message_json}`. The contract's stages 1-7 run in lease_contract.py with
   the key set (`KeySet.verify`); the immutable DTO goes to the WisKey consumer that registered itself (lease_service.py) and only a closed answer comes back
   (lease_answers.py). No consumer = the call fails and nothing is acknowledged. Nothing here decides about a card, a person or a door.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Context, HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError, Unauthorized
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store

from .cast_service import async_handle_cast_stream, note_origin
from .config_service import async_handle_config_item
from .const import (CONF_ADDON_URL, CONF_DELEGATED_AUTHORING, CONF_DELEGATED_CHANGED_AT, CONF_LOCAL_IDENTITY_EXTENDED, CONF_LOCAL_IDENTITY_RUNNABLE, CONF_PAIRING_CODE, CONF_SERVICE_USER_ID, CONF_WISKEY_AUTO_INSTALL, DIRECTORY_INTERVAL_S, DOMAIN, SERVICE_CAST_STREAM,
                    SERVICE_CONFIG_ITEM, SERVICE_EXECUTE, SERVICE_LEASE_EVENT, SERVICE_LEASE_REQUEST, SERVICE_MEDIA_QUERY, SERVICE_ROTATE, SERVICE_SCHEDULE, SERVICE_SET_AREA, SERVICE_STREAM_SOURCE, SERVICE_SYNC, VERSION)
from . import lease_service
# WKA-295: the documented public port of the capture lease for the WisKey consumer (docs/changes/WKA-295-LEASE-PORT.md), re-exported
# from the package root. These are lease_service's / lease_contract's own objects (no wrapper, no second registry); the submodule path
# `custom_components.smplwise_bridge.lease_service` stays valid and is the one that works on every bridge 0.9.6+.
from .lease_contract import LeaseDTO
from .lease_service import (LeaseCapability, LeaseConsumer, LeaseRegistration, LeaseUnavailable, async_get_capability, async_register_consumer,
                            is_bridge_capability)
from . import media_policy, runnable, service_identity
from .media_query_service import async_handle_media_query
from .schedule_service import async_handle_schedule, execute_refusal
from .keyset import CAPABILITY as ROTATION_CAPABILITY, KeySet, Persister as KeyPersister
from .stream_source_service import async_handle_stream_source

# WKA-295: the names above that make up the capture lease's public port (the root re-export). Nothing else of this module is part of it.
LEASE_PUBLIC_API = ("async_register_consumer", "async_get_capability", "is_bridge_capability", "LeaseCapability", "LeaseRegistration",
                    "LeaseConsumer", "LeaseUnavailable", "LeaseDTO")

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
        vol.Optional("kid"): cv.string,  # 0.9.5: the key id of a v2 signature (keyset.py); absent = the old kid-less recipe
    },
    extra=vol.ALLOW_EXTRA,
)

# 0.9.5 (HMACACT-295): the key-rotation control message of the add-on. protocol / op / rotation_id plus the v2 wire fields; every other field of the
# six ops is judged by keyset.handle_control (this schema only keeps a non-message away from it).
ROTATE_SCHEMA = vol.Schema(
    {
        vol.Required("protocol"): cv.string,
        vol.Required("op"): cv.string,
        vol.Required("rotation_id"): vol.All(cv.string, vol.Length(min=1, max=64)),  # HA-05: bounded before anything is verified
        vol.Required("kid"): cv.string,
        vol.Required("ts"): vol.Coerce(int),
        vol.Required("nonce"): cv.string,
        vol.Required("sig"): cv.string,
    },
    extra=vol.ALLOW_EXTRA,
)

# 0.9.6 (LEASEBR-295): the capture lease's two services take the call data as it comes - the closed `transport_shape` check (exactly
# `{signed_message_json: <str>}`) is stage 1 of lease_contract.validate, so a wrong shape gets the contract's closed `rejected` answer instead of a Home
# Assistant validation error, and no value is coerced (cv.string would turn a number into text before the contract could refuse it).
LEASE_SCHEMA = vol.Schema(dict)

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
        vol.Optional("kid"): cv.string,  # 0.9.5: the key id of a v2 signature (keyset.py); absent = the old kid-less recipe
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
        vol.Optional("kid"): cv.string,  # 0.9.5: the key id of a v2 signature (keyset.py); absent = the old kid-less recipe
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
        vol.Optional("kid"): cv.string,  # 0.9.5: the key id of a v2 signature (keyset.py); absent = the old kid-less recipe
        vol.Optional("on_behalf_of"): dict,  # 0.9.0 (USR2 P3): judged by service_identity.screen
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
        vol.Optional("kid"): cv.string,  # 0.9.5: the key id of a v2 signature (keyset.py); absent = the old kid-less recipe
        vol.Optional("on_behalf_of"): dict,  # 0.9.0 (USR2 P3): judged by service_identity.screen
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
        vol.Optional("kid"): cv.string,  # 0.9.5: the key id of a v2 signature (keyset.py); absent = the old kid-less recipe
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
        vol.Optional("kid"): cv.string,  # 0.9.5: the key id of a v2 signature (keyset.py); absent = the old kid-less recipe
        vol.Optional("on_behalf_of"): dict,  # 0.9.0 (USR2 P3): judged by service_identity.screen
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
    # 0.9.5 (HMACACT-295): the key set replaces the bare pairing secret. Its persisted part lives in a Store of its own (a config-entry update
    # would reload the entry); with no stored state (a bridge just updated) it signs and verifies exactly as 0.9.4 did, kid-less, with the
    # pairing secret, until the add-on starts a rotation. See keyset.py for the rules.
    store = Store(hass, 1, f"{DOMAIN}_keys_{entry.entry_id}")
    keyset = KeySet(entry.data.get(CONF_PAIRING_CODE) or "", await store.async_load())
    verifier = keyset
    session = async_get_clientsession(hass)

    def service_user_id() -> Any:
        """0.9.0 (USR2 P3): the service identity, read live from the options (an HA administrator sets it inside Home Assistant)."""
        return entry.options.get(CONF_SERVICE_USER_ID)

    def local_extended() -> bool:
        """0.9.1 (SVCIDENT2): the extended mode of the service identity, read live from the options (an HA administrator sets it; off by default)."""
        return entry.options.get(CONF_LOCAL_IDENTITY_EXTENDED, False) is True

    def runnable_ids() -> frozenset[str]:
        """0.9.2 (SVCIDENT3): the scripts / scenes / automations Arx-only users may run, read live from the options (empty by default; malformed = empty)."""
        return runnable.allowlist(entry.options.get(CONF_LOCAL_IDENTITY_RUNNABLE))

    def wipe_entry_code() -> None:
        """The first rotation completed: the pairing code is no longer a key - do not keep it in the entry either (HA-06)."""
        hass.config_entries.async_update_entry(entry, data={**entry.data, CONF_PAIRING_CODE: ""})

    def save_failed(exc: BaseException) -> None:
        _LOGGER.warning("bridge key state not saved (%s); retried", type(exc).__name__)

    saver = KeyPersister(keyset, store.async_save, lambda: entry.data.get(CONF_PAIRING_CODE) or "", wipe_entry_code, hass.async_create_task,
                         on_error=save_failed)
    saver.clean_entry()  # HA-06: a restart between the key save and the entry update left the retired code in the entry
    if keyset.repaired:  # K-02: a new pairing code arrived in this entry (discovery): the fresh key set replaces the stored one
        _LOGGER.info("bridge re-paired with a new pairing code; the previous key set is discarded")
        saver.save_soon()

    async def persist() -> None:
        """Save the key set when it changed (a rotation step, a retired key, a new high-water mark). Raises when the save fails."""
        await saver.persist()

    async def screened(name: str, call: ServiceCall) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        """Verify the signature once and judge the service-identity rules (service_identity.screen)."""
        try:
            return await service_identity.screen(hass, verifier, dict(call.data), name, service_user_id(), local_extended())
        finally:
            saver.save_soon()  # HA-04: a new high-water mark is saved soon, not on every message; clean only after the save succeeded

    async def execute(call: ServiceCall) -> ServiceResponse:
        on_behalf = "on_behalf_of" in call.data
        msg, refused = await screened(SERVICE_EXECUTE, call)
        if refused is not None or msg is None:
            return refused
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
        if on_behalf:
            # 0.9.2 (SVCIDENT3, review S2 / S1): the service user's own entity policy for every entity, then - a script / scene - the runnable
            # allowlist and the impact check of its steps (runnable.py); a Home Assistant user's own message is never judged here
            run_blocked = await runnable.execute_refusal(hass, user, domain, service, data, runnable_ids())
            if run_blocked:
                _LOGGER.warning("smplwise_bridge.execute %s.%s refused: %s", domain, service, run_blocked)
                return {"ok": False, "request_id": msg["request_id"], "error": run_blocked}
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
        msg, refused = await screened(SERVICE_SET_AREA, call)  # 0.9.0: never on behalf of a local identity (not in any feature)
        if refused is not None or msg is None:
            return refused
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
        on_behalf = "on_behalf_of" in call.data
        msg, refused = await screened(SERVICE_SCHEDULE, call)
        if refused is not None or msg is None:
            return refused
        # SCHEDIMPACT-295 (Fable review 4, V-02): a schedule written / copied / run / enabled on behalf of an Arx-only person runs nothing the
        # run fences would refuse to a direct run - the never-list, this bridge's runnable allowlist and the impact check (schedule_fence.py)
        local = SimpleNamespace(runnable=runnable_ids(), extended=local_extended()) if on_behalf else None
        return await async_handle_schedule(hass, service_identity.PREVERIFIED, msg, local=local)

    hass.services.async_register(DOMAIN, SERVICE_SCHEDULE, schedule, schema=SCHEDULE_SCHEMA, supports_response=SupportsResponse.ONLY)

    async def stream_source(call: ServiceCall) -> ServiceResponse:
        """0.3.1: a signed READ-ONLY answer - the stream source Home Assistant reports for one camera entity (see
        stream_source_service.py). The URL leaves only in this response; it is never logged."""
        on_behalf = "on_behalf_of" in call.data
        msg, refused = await screened(SERVICE_STREAM_SOURCE, call)
        if refused is not None or msg is None:
            return refused
        # 0.9.1 (SVCIDENT2): a message screened on behalf of an Arx-only person (the extended mode on, the configured non-administrator service
        # user) is read without the administrator rule - only then; every other caller still needs an active HA administrator
        return await async_handle_stream_source(hass, service_identity.PREVERIFIED, msg, admin_waived=on_behalf and local_extended())

    hass.services.async_register(DOMAIN, SERVICE_STREAM_SOURCE, stream_source, schema=STREAM_SOURCE_SCHEMA, supports_response=SupportsResponse.ONLY)

    async def media_query(call: ServiceCall) -> ServiceResponse:
        """0.5.0 (CR-016): a signed READ-ONLY answer about a speaker's music layer - its queue, or the library (see media_query_service.py). Trimmed; the
        Music Assistant config entry is found here and never a parameter."""
        msg, refused = await screened(SERVICE_MEDIA_QUERY, call)
        if refused is not None or msg is None:
            return refused
        return await async_handle_media_query(hass, service_identity.PREVERIFIED, msg)

    hass.services.async_register(DOMAIN, SERVICE_MEDIA_QUERY, media_query, schema=MEDIA_QUERY_SCHEMA, supports_response=SupportsResponse.ONLY)

    def _registry_platform(entity_id: str) -> Any:
        reg = er.async_get(hass).async_get(entity_id)
        return reg.platform if reg is not None else None

    async def cast_stream(call: ServiceCall) -> ServiceResponse:
        """0.7.0 (CR-028): play / stop / off on ONE Cast media_player as the VMS user (see cast_service.py and cast_policy.py)."""
        msg, refused = await screened(SERVICE_CAST_STREAM, call)
        if refused is not None or msg is None:
            return refused
        return await async_handle_cast_stream(hass, service_identity.PREVERIFIED, msg, _registry_platform)

    hass.services.async_register(DOMAIN, SERVICE_CAST_STREAM, cast_stream, schema=CAST_STREAM_SCHEMA, supports_response=SupportsResponse.ONLY)

    def delegated() -> bool:
        """The owner-approved switch (CR-017 section 8.3): read live from the options, so a change inside Home Assistant applies to the next call."""
        return bool(entry.options.get(CONF_DELEGATED_AUTHORING, False))

    async def config_item(call: ServiceCall) -> ServiceResponse:
        """0.6.0 (CR-017): a signed write to / run of an automation, script or scene as the VMS user (see config_service.py)."""
        on_behalf = "on_behalf_of" in call.data
        msg, refused = await screened(SERVICE_CONFIG_ITEM, call)  # 0.9.0: a local identity is refused here (automation_write_requires_ha_identity)
        if refused is not None or msg is None:
            return refused
        if on_behalf:
            # 0.9.2 (SVCIDENT3, review S1): a run op on behalf of an Arx-only person - the runnable allowlist and the impact check (runnable.py)
            run_blocked = await runnable.config_item_refusal(hass, await hass.auth.async_get_user(msg["user_id"]), msg, runnable_ids())
            if run_blocked:
                _LOGGER.warning("smplwise_bridge.config_item %s refused: %s", msg.get("op"), run_blocked)
                return {"ok": False, "request_id": msg.get("request_id"), "error": run_blocked}
        return await async_handle_config_item(hass, service_identity.PREVERIFIED, msg, delegated=delegated)

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
        # 0.9.6 (EXTID-295, CR-USR2 13.6): whether the configured service user is restricted - a boolean or null, never the policy itself
        sid = service_identity.configured_id(service_user_id())
        policy_restricted = service_identity.service_policy_restricted(await hass.auth.async_get_user(sid)) if sid else None
        try:
            async with session.post(f"{url}/api/v1/ha/bridge/directory", json=keyset.sign({"users": users, "rotation": ROTATION_CAPABILITY, "version": VERSION, "delegated_authoring": delegated(), "delegated_changed_at": entry.options.get(CONF_DELEGATED_CHANGED_AT) or None, "config_item": True,
                                                                                "schedule_fences": True,  # SCHEDIMPACT-295: this bridge judges a local person's schedules
                                                                                "service_identity": True, "service_user_id": service_identity.configured_id(service_user_id()),
                                                                                "local_identity_extended": local_extended(),
                                                                                "local_identity_runnable": sorted(runnable_ids()),
                                                                                "service_policy_restricted": policy_restricted}), timeout=10) as resp:
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

    async def rotate(call: ServiceCall) -> ServiceResponse:
        """0.9.5: one signed key-rotation control message from the add-on (begin / probe / commit / retire / abort / status) -> the signed
        answer. The new state is saved BEFORE the answer leaves (write-ahead); if the save fails the in-memory state goes back to the saved one."""
        saved = keyset.state()
        answer = keyset.handle_control(dict(call.data))
        try:
            await persist()
        except Exception:  # noqa: BLE001 - the step did not happen as far as the add-on can tell (it asks `status` and recovers)
            keyset.reload(saved)
            raise
        return answer

    hass.services.async_register(DOMAIN, SERVICE_ROTATE, rotate, schema=ROTATE_SCHEMA, supports_response=SupportsResponse.ONLY)

    async def lease(service_name: str, kind: str, call: ServiceCall) -> ServiceResponse:
        """0.9.6 (LEASEBR-295): one signed message of the capture lease -> the closed answer (see lease_service.py). The signature is judged by the key set
        (`KeySet.verify`), so a rotation in progress keeps working; a new high-water mark is saved soon, like for the other signed services."""
        try:
            return await lease_service.async_handle(hass, service_name, kind, dict(call.data), keyset)
        except lease_service.LeaseUnavailable as exc:
            raise HomeAssistantError(f"lease_unavailable: {exc.code}") from None  # a fixed token; Arx reads it as "no answer"
        finally:
            saver.save_soon()

    async def lease_event(call: ServiceCall) -> ServiceResponse:
        return await lease(SERVICE_LEASE_EVENT, "event", call)

    async def lease_request(call: ServiceCall) -> ServiceResponse:
        return await lease(SERVICE_LEASE_REQUEST, "request", call)

    hass.services.async_register(DOMAIN, SERVICE_LEASE_EVENT, lease_event, schema=LEASE_SCHEMA, supports_response=SupportsResponse.ONLY)
    hass.services.async_register(DOMAIN, SERVICE_LEASE_REQUEST, lease_request, schema=LEASE_SCHEMA, supports_response=SupportsResponse.ONLY)
    lease_service.async_attach_bridge(hass, entry.entry_id)  # LEASELIFE-295: the native capability now names this entry as its bridge

    async def housekeeping(_now: Any = None) -> None:
        """The peer's own 180 s cap and the saved high-water marks, without waiting for a message."""
        keyset.verifiable()
        try:
            await persist()
        except Exception as exc:  # noqa: BLE001
            _LOGGER.warning("bridge key state not saved (%s)", type(exc).__name__)

    entry.async_on_unload(async_track_time_interval(hass, housekeeping, timedelta(seconds=30)))
    entry.async_on_unload(async_track_time_interval(hass, push_directory, timedelta(seconds=DIRECTORY_INTERVAL_S)))

    async def options_updated(_hass: HomeAssistant, _entry: ConfigEntry) -> None:
        """The delegation switch changed inside Home Assistant: tell the add-on now instead of at the next minute (the switch is read live, nothing reloads)."""
        hass.async_create_task(push_directory())

    entry.async_on_unload(entry.add_update_listener(options_updated))
    hass.async_create_task(push_directory())
    if native_setup_wanted(hass, entry):
        hass.async_create_task(_async_setup_native(hass))  # review H4: never awaited - the bridge entry's setup does not wait on it
    return True


NATIVE_DOMAIN = "hikvision_intercom"


def native_setup_wanted(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Review H4: the bridge sets the native component up ONLY for an entry the add-on's automatic-install discovery created / updated
    (`wiskey_auto_install` in the entry data - written by no other path), and only when the component is not loaded already. Any other
    bridge entry (paired by hand or by the ordinary discovery) never starts it, staged folder or not."""
    if entry.data.get(CONF_WISKEY_AUTO_INSTALL) is not True:
        return False
    return NATIVE_DOMAIN not in hass.config.components


async def _async_setup_native(hass: HomeAssistant) -> bool:
    """0.10.x (WISKEY-ADOPT-2272, WisKey owner28 delivery): when the add-on staged the WisKey native integration next to the bridge, the
    bridge sets it up itself - no owner step, no form - for an automatic-install entry only (`native_setup_wanted`). The native setup is
    what writes WisKey's private installation manifest; the bridge never creates a grant. No staged component: nothing happens. A failed
    native setup is logged and never takes the bridge down (the delivery raised here; Arx keeps the bridge's own services available
    instead). Started as a task (review H4), never awaited by the entry setup."""
    try:
        manifest = Path(hass.config.path("custom_components", NATIVE_DOMAIN, "manifest.json"))
        if not await hass.async_add_executor_job(manifest.is_file):
            return False
        from homeassistant.setup import async_setup_component

        done = await async_setup_component(hass, NATIVE_DOMAIN, {})
    except Exception as exc:  # noqa: BLE001 - the bridge stays up; the add-on reads the native state from the manifest
        _LOGGER.warning("native intercom setup failed (%s)", type(exc).__name__)
        return False
    if not done:
        _LOGGER.warning("native intercom setup did not complete")
    return bool(done)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.services.async_remove(DOMAIN, SERVICE_EXECUTE)
    hass.services.async_remove(DOMAIN, SERVICE_SET_AREA)
    hass.services.async_remove(DOMAIN, SERVICE_SCHEDULE)
    hass.services.async_remove(DOMAIN, SERVICE_STREAM_SOURCE)
    hass.services.async_remove(DOMAIN, SERVICE_MEDIA_QUERY)
    hass.services.async_remove(DOMAIN, SERVICE_CONFIG_ITEM)
    hass.services.async_remove(DOMAIN, SERVICE_CAST_STREAM)
    hass.services.async_remove(DOMAIN, SERVICE_SYNC)
    hass.services.async_remove(DOMAIN, SERVICE_ROTATE)
    hass.services.async_remove(DOMAIN, SERVICE_LEASE_EVENT)
    hass.services.async_remove(DOMAIN, SERVICE_LEASE_REQUEST)
    lease_service.async_detach_bridge(hass, entry.entry_id)  # LEASELIFE-295: the consumer stays registered; in-flight answers are not relayed
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """K-06: the integration was deleted - its key store (the bridge keys in clear) goes with it, so later Home Assistant backups do not carry
    keys of a pairing that no longer exists. Best effort: a failed removal is logged without detail and never blocks the deletion."""
    try:
        await Store(hass, 1, f"{DOMAIN}_keys_{entry.entry_id}").async_remove()
    except Exception as exc:  # noqa: BLE001
        _LOGGER.warning("bridge key store not removed (%s)", type(exc).__name__)


# Import-time distribution observation only; decisions remain in Arx SQLite (WisKey R3 alignment: the loaded pair digest the
# native readiness reader compares with the installed and staged ones).
from pathlib import Path as _DistributionPath
from uuid import uuid4 as _distribution_uuid
from os import getpid as _distribution_pid
from .wiskey_distribution_digest import digest as _distribution_digest
LOADED_DISTRIBUTION = _distribution_digest(_DistributionPath(__file__).parent)
LOADED_BOOT_ID = _distribution_uuid().hex
LOADED_PROCESS_ID = _distribution_pid()
