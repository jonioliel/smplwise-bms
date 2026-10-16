"""0.9.0 (USR2 phase 3): the SERVICE IDENTITY - how an Arx-only (local) user acts in Home Assistant without being a Home Assistant user.

An Arx-only identity (`l_` + 26 Crockford base32 characters, docs/changes/CR-USR2-ARX-ONLY-IDENTITY.md) has no Home Assistant account. When the
add-on acts for one, the signed message names ONE configured, non-administrator Home Assistant user - the service identity - in `user_id`,
and the person in `on_behalf_of`:

    {"user_id": "<service HA user id>", "on_behalf_of": {"kind": "local", "user_id": "l_...", "feature": "<feature key>"}, ...}

This bridge decides independently of the add-on (the add-on has the same table: smplwise_vms/backend/smplwise/services/service_identity.py,
compared by a drift test):
- `on_behalf_of` present: `user_id` MUST equal the service identity configured HERE, in the options flow (the add-on can never pick another
  Home Assistant user); that user must exist, be active, not be system-generated and NOT be an administrator; the feature must be in
  SERVICE_FEATURES, the bridge service must be one of the feature's, and the item (a (domain, service) pair, an op, a query) must be in its list.
- `on_behalf_of` absent: a message naming the service identity in `user_id` is refused (the service identity never acts as itself, so it can
  never bypass the allow-list), and a message naming an `l_` id is refused (a local id is never a Home Assistant user).
- `on_behalf_of.user_id` is ATTRIBUTION ONLY: nothing here authorises by it. Home Assistant runs the call with `Context(user_id=<service id>)`.
  That does NOT bound the entities the call may touch: the `execute` handler performs no per-entity check and an in-process service call
  does not apply a user's entity policy, so "non-administrator" only keeps administrator-only services out. The entity guard for an Arx-only
  person is Arx's own scope (`ha_scope`) alone (security review F5, recorded in CR-USR2 section 9). The add-on links the answer's context id
  to the person for the activity log.
- NEVER_LOCAL (zone-bypass arming, doors, scripts, scenes) is refused for a local identity before any feature table is consulted.
- Automation / script / scene writes and runs (`config_item`) are never available to a local identity (`automation_write_requires_ha_identity`),
  nor is the area registry write (`set_entity_area`) or the camera stream source (`stream_source`).

Dependency-free (no Home Assistant import), so the same functions run in plain unit tests. Refusals log the code only.
"""
from __future__ import annotations

import logging
import re
from typing import Any

_LOGGER = logging.getLogger(__name__)

LOCAL_ID_RE = re.compile(r"l_[0-9A-HJKMNP-TV-Z]{26}")
HA_USER_ID_RE = re.compile(r"[0-9a-f]{32}")
OBO_KEYS = frozenset({"kind", "user_id", "feature"})

# Never for a local identity, whatever a feature table says (an explicit rule, checked before the tables - security review F1 / F2,
# 2026-10-16; owner default: every open question stays refused until answered):
# - `alarm_arm_custom_bypass`: arms with the integration's bypass set - a zone bypass (open question 2);
# - `lock.unlock` / `lock.open`: a door (open question 1);
# - `script.turn_on` / `scene.turn_on`: a script or scene may unlock a door, disarm or press an intercom button under the service user's
#   authority (open question 5).
NEVER_LOCAL = frozenset({
    ("alarm_control_panel", "alarm_arm_custom_bypass"), ("lock", "unlock"), ("lock", "open"), ("script", "turn_on"), ("scene", "turn_on"),
})

ALARM_PAIRS = frozenset({
    ("alarm_control_panel", "alarm_arm_home"), ("alarm_control_panel", "alarm_arm_away"), ("alarm_control_panel", "alarm_arm_night"),
    ("alarm_control_panel", "alarm_arm_vacation"), ("alarm_control_panel", "alarm_disarm"),
})

# The execute allow-list (ALLOWED_SERVICES in __init__.py) minus the alarm panel (its own feature, owner answer Q4) and minus NEVER_LOCAL
# (doors, scripts, scenes: refused to local identities until the owner decides otherwise - USR2-P3 open questions 1 and 5).
DEVICE_PAIRS = frozenset({
    ("light", "turn_on"), ("light", "turn_off"), ("switch", "turn_on"), ("switch", "turn_off"), ("fan", "turn_on"), ("fan", "turn_off"),
    ("cover", "open_cover"), ("cover", "close_cover"), ("cover", "stop_cover"), ("lock", "lock"),
    ("button", "press"),
    ("climate", "set_hvac_mode"), ("climate", "set_temperature"),
    ("media_player", "media_play"), ("media_player", "media_pause"), ("media_player", "media_stop"), ("media_player", "volume_set"),
    ("number", "set_value"), ("input_number", "set_value"), ("select", "select_option"), ("input_select", "select_option"),
    ("input_boolean", "turn_on"), ("input_boolean", "turn_off"), ("vacuum", "start"), ("vacuum", "return_to_base"),
    ("siren", "turn_on"), ("siren", "turn_off"),
    ("fan", "set_percentage"), ("cover", "set_cover_position"), ("climate", "set_fan_mode"), ("climate", "turn_off"),
    ("media_player", "turn_on"), ("media_player", "turn_off"), ("media_player", "volume_mute"),
    ("climate", "set_preset_mode"), ("climate", "set_swing_mode"), ("climate", "set_humidity"),
    ("humidifier", "set_humidity"), ("humidifier", "set_mode"),
    ("cover", "open_cover_tilt"), ("cover", "close_cover_tilt"), ("cover", "stop_cover_tilt"), ("cover", "set_cover_tilt_position"),
    ("media_player", "volume_up"), ("media_player", "volume_down"), ("media_player", "media_play_pause"), ("media_player", "media_next_track"),
    ("media_player", "media_previous_track"), ("media_player", "select_source"), ("media_player", "play_media"),
    ("remote", "send_command"), ("remote", "turn_on"), ("webostv", "button"), ("webostv", "select_sound_output"),
    ("media_player", "media_seek"), ("media_player", "shuffle_set"), ("media_player", "repeat_set"), ("media_player", "select_sound_mode"),
    ("media_player", "join"), ("media_player", "unjoin"), ("music_assistant", "play_media"), ("music_assistant", "transfer_queue"),
    ("vacuum", "pause"), ("valve", "open_valve"), ("valve", "close_valve"), ("water_heater", "turn_on"), ("water_heater", "turn_off"),
})

MEDIA_DOMAINS = frozenset({"media_player", "remote", "webostv", "music_assistant"})
MEDIA_PAIRS = frozenset(p for p in DEVICE_PAIRS if p[0] in MEDIA_DOMAINS)

# feature key -> bridge service -> the items allowed. An item is a (domain, service) pair for `execute`, an op for `cast_stream` / `schedule`,
# a query kind for `media_query`. Anything not named here is refused: `set_entity_area` (the spec's `devices.area`, off by default),
# `config_item` (automations, never) and `stream_source` are deliberately absent.
SERVICE_FEATURES: dict[str, dict[str, frozenset[Any]]] = {
    "devices.control": {"execute": DEVICE_PAIRS},
    "alarm": {"execute": ALARM_PAIRS},
    "media": {"execute": MEDIA_PAIRS, "media_query": frozenset({"queue", "library"})},
    "cast": {"cast_stream": frozenset({"play", "stop", "off"})},
    "schedules": {"schedule": frozenset({"add", "edit", "remove", "copy", "run", "enable", "disable"})},
}


class _Preverified:
    """Handed to a service handler after screen() verified the signature itself: the nonce is already spent, so a second
    verification would answer `replay`."""

    @staticmethod
    def verify(_message: dict[str, Any], now: float | None = None) -> None:  # noqa: ARG004
        return None


PREVERIFIED = _Preverified()


def item_of(bridge_service: str, msg: dict[str, Any]) -> Any:
    """The allow-list item a message names for its bridge service."""
    if bridge_service == "execute":
        return (msg.get("domain"), msg.get("service"))
    if bridge_service in ("cast_stream", "schedule", "config_item"):
        return msg.get("op")
    if bridge_service == "media_query":
        return msg.get("query")
    return None


def obo_refusal(obo: Any, bridge_service: str, item: Any) -> str | None:
    """The shape and allow-list judgement of an `on_behalf_of` block (no Home Assistant needed). None = allowed."""
    if not isinstance(obo, dict) or set(obo) != OBO_KEYS:
        return "service_identity_refused"
    if obo.get("kind") != "local" or not isinstance(obo.get("user_id"), str) or not LOCAL_ID_RE.fullmatch(obo["user_id"]):
        return "service_identity_refused"
    if bridge_service == "config_item":
        return "automation_write_requires_ha_identity"
    try:
        if bridge_service == "execute" and item in NEVER_LOCAL:
            return "service_identity_refused"
    except TypeError:
        return "service_identity_refused"
    feature = obo.get("feature")
    services = SERVICE_FEATURES.get(feature) if isinstance(feature, str) else None
    if not services or bridge_service not in services:
        return "service_identity_refused"
    try:
        allowed = item in services[bridge_service]
    except TypeError:  # an unhashable item (a list smuggled into `op`)
        allowed = False
    return None if allowed else "service_identity_refused"


def configured_id(value: Any) -> str | None:
    """The service identity of the options flow, or None when unset / malformed (then every local request is refused)."""
    return value if isinstance(value, str) and HA_USER_ID_RE.fullmatch(value) else None


def user_refusal(user: Any) -> str | None:
    """The service Home Assistant user must exist, be active, not be system-generated and never be an administrator."""
    if user is None or not getattr(user, "is_active", False) or getattr(user, "system_generated", False):
        return "service_identity_unknown_user"
    if getattr(user, "is_admin", True):
        return "service_identity_admin"
    return None


def _refuse(msg: dict[str, Any], bridge_service: str, error: str) -> dict[str, Any]:
    _LOGGER.warning("smplwise_bridge.%s refused: %s", bridge_service, error)
    return {"ok": False, "request_id": msg.get("request_id"), "error": error}


async def screen(hass: Any, verifier: Any, msg: dict[str, Any], bridge_service: str, service_user_id: Any) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """Verify the signature once and judge the service-identity rules. (message to hand on WITHOUT `on_behalf_of`, None) to proceed - the handler
    then gets PREVERIFIED - or (None, refusal answer)."""
    msg = dict(msg)
    reason = verifier.verify(msg)
    if reason:
        return None, _refuse(msg, bridge_service, reason)
    service_id = configured_id(service_user_id)
    obo = msg.pop("on_behalf_of", None)
    user_id = msg.get("user_id")
    if obo is None:
        if isinstance(user_id, str) and (user_id.startswith("l_") or (service_id is not None and user_id == service_id)):
            # the service identity never acts as itself; a local id is never a Home Assistant user
            return None, _refuse(msg, bridge_service, "service_identity_refused")
        return msg, None
    why = obo_refusal(obo, bridge_service, item_of(bridge_service, msg))
    if why:
        return None, _refuse(msg, bridge_service, why)
    if service_id is None:
        return None, _refuse(msg, bridge_service, "service_identity_unconfigured")
    if user_id != service_id:
        return None, _refuse(msg, bridge_service, "service_identity_refused")
    why = user_refusal(await hass.auth.async_get_user(service_id))
    if why:
        return None, _refuse(msg, bridge_service, why)
    return msg, None


async def options_error(hass: Any, value: Any) -> str | None:
    """The options flow's check of a typed service identity: None (accepted, or empty = unset) or an error key of strings.json."""
    if value in (None, ""):
        return None
    if configured_id(value) is None:
        return "service_user_format"
    why = user_refusal(await hass.auth.async_get_user(value))
    return {"service_identity_admin": "service_user_admin"}.get(why or "", "service_user_unknown") if why else None
