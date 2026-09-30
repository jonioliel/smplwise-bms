"""Media policy for `smplwise_bridge.execute` (CR-015, bridge 0.4.0): what the bridge accepts for the media services, decided WITHOUT
trusting the add-on. Dependency-free (standard library only) so the same function runs inside Home Assistant Core and in plain unit
tests, like `schedule_policy.py` and `signing.py`.

The add-on validates the same rules first (services/ha_bridge.py `route: "media"` actions, services/media_profiles.py, services/
media_commands.py); this module is the independent second check. It refuses, whatever the signature says:

- a POWER key at any position: a key code must be in the closed tables below, and no table has one (`KEY_POWER`, `KEY_POWEROFF`,
  `POWER` ... do not exist); a `command` that is not one plain string (HA accepts a list: a list could smuggle one) is refused;
- any argument beyond the service's own (`num_repeats`, `hold_secs`, `delay_secs`, `device`, a target list ...);
- a `play_media` of any type but `send_key` (a Samsung key) and `send_text` (typed text): never a URL, a channel, an app or a stream;
- `remote.turn_off`, `remote.turn_on` without an `activity`, `webostv.command` and every service not listed here;
- a `source` that is not in the entity's CURRENT `source_list` and an `activity` that is not in its CURRENT `activity_list` (the
  caller supplies the entity's attributes; an entity that cannot be read is a refusal);
- typed text longer than 200 characters or carrying control characters.

Pure functions: they never read Home Assistant state themselves."""
from __future__ import annotations

import re
from typing import Any, Callable, Mapping

# (domain, service) of every media service this bridge accepts in addition to the older allow-list (mirrored in __init__.ALLOWED_SERVICES)
MEDIA_SERVICES = frozenset({
    ("media_player", "volume_up"), ("media_player", "volume_down"), ("media_player", "media_play_pause"), ("media_player", "media_next_track"),
    ("media_player", "media_previous_track"), ("media_player", "select_source"), ("media_player", "play_media"),
    ("remote", "send_command"), ("remote", "turn_on"), ("webostv", "button"), ("webostv", "select_sound_output"),
})
# refused by name even if someone adds them to another list: they switch power or run free-form commands
NEVER_SERVICES = frozenset({("remote", "turn_off"), ("remote", "toggle"), ("webostv", "command"), ("media_player", "toggle"), ("remote", "learn_command"), ("remote", "delete_command")})

# the closed key tables (kept equal to services/media_profiles.py by tests/test_bridge_media_policy.py); no power key in any
SAMSUNG_KEYS = frozenset({
    "KEY_UP", "KEY_DOWN", "KEY_LEFT", "KEY_RIGHT", "KEY_ENTER", "KEY_RETURN", "KEY_HOME", "KEY_MENU", "KEY_EXIT", "KEY_INFO", "KEY_GUIDE",
    "KEY_SOURCE", "KEY_TOOLS", "KEY_CH_LIST", "KEY_PRECH", "KEY_VOLUP", "KEY_VOLDOWN", "KEY_MUTE", "KEY_CHUP", "KEY_CHDOWN",
    "KEY_0", "KEY_1", "KEY_2", "KEY_3", "KEY_4", "KEY_5", "KEY_6", "KEY_7", "KEY_8", "KEY_9",
    "KEY_RED", "KEY_GREEN", "KEY_YELLOW", "KEY_CYAN", "KEY_PLAY", "KEY_PAUSE", "KEY_STOP", "KEY_REWIND", "KEY_FF",
})
LG_BUTTONS = frozenset({
    "UP", "DOWN", "LEFT", "RIGHT", "ENTER", "BACK", "HOME", "MENU", "EXIT", "INFO", "GUIDE", "VOLUMEUP", "VOLUMEDOWN", "MUTE", "CHANNELUP", "CHANNELDOWN",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "RED", "GREEN", "YELLOW", "BLUE", "PLAY", "PAUSE",
})
ANDROID_KEYS = frozenset({
    "DPAD_UP", "DPAD_DOWN", "DPAD_LEFT", "DPAD_RIGHT", "DPAD_CENTER", "BACK", "HOME", "MENU", "SETTINGS", "INFO", "GUIDE", "TV_INPUT",
    "VOLUME_UP", "VOLUME_DOWN", "MUTE", "CHANNEL_UP", "CHANNEL_DOWN", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
    "PROG_RED", "PROG_GREEN", "PROG_YELLOW", "PROG_BLUE", "MEDIA_PLAY", "MEDIA_PAUSE", "MEDIA_STOP", "MEDIA_REWIND", "MEDIA_FAST_FORWARD",
})

TEXT_MAX = 200
SOURCE_MAX = 120
ACTIVITY_MAX = 200
SOUND_OUTPUT_RE = re.compile(r"^[a-z_]{1,40}$")
_PLAIN_ENTITY = re.compile(r"^(media_player|remote)\.[a-z0-9_]{1,200}$")
_CONTROL = re.compile(r"[\x00-\x1f\x7f]")

# the arguments each service may carry besides `entity_id`; anything else is refused
ALLOWED_ARGS: dict[tuple[str, str], frozenset[str]] = {
    ("media_player", "volume_up"): frozenset(), ("media_player", "volume_down"): frozenset(), ("media_player", "media_play_pause"): frozenset(),
    ("media_player", "media_next_track"): frozenset(), ("media_player", "media_previous_track"): frozenset(),
    ("media_player", "select_source"): frozenset({"source"}), ("media_player", "play_media"): frozenset({"media_content_type", "media_content_id"}),
    ("remote", "send_command"): frozenset({"command"}), ("remote", "turn_on"): frozenset({"activity"}),
    ("webostv", "button"): frozenset({"button"}), ("webostv", "select_sound_output"): frozenset({"sound_output"}),
}
# the entity domain each service's target must have (webostv.* targets a media_player)
TARGET_DOMAIN: dict[str, str] = {"media_player": "media_player", "remote": "remote", "webostv": "media_player"}

Attrs = Callable[[str], "Mapping[str, Any] | None"]


def _text_problem(text: Any) -> bool:
    return not isinstance(text, str) or not 1 <= len(text) <= TEXT_MAX or bool(_CONTROL.search(text))


def _listed(value: Any, attrs: Mapping[str, Any] | None, key: str, longest: int) -> bool:
    items = (attrs or {}).get(key)
    return isinstance(value, str) and 0 < len(value) <= longest and isinstance(items, (list, tuple)) and value in items


def refusal(domain: str, service: str, data: Any, attributes_of: Attrs) -> str | None:
    """None when a media call may go on, else a fixed refusal code. `data` is the service data of the signed call (with `entity_id`);
    `attributes_of(entity_id)` returns that entity's CURRENT state attributes (None when it cannot be read). Services outside the media
    set are not judged here (returns None): the caller checks `is_media` first."""
    pair = (domain, service)
    if pair in NEVER_SERVICES:
        return "media_service_refused"
    if pair not in MEDIA_SERVICES:
        return None
    if not isinstance(data, Mapping):
        return "media_arguments"
    entity_id = data.get("entity_id")
    if not isinstance(entity_id, str) or not _PLAIN_ENTITY.match(entity_id) or entity_id.split(".", 1)[0] != TARGET_DOMAIN[domain]:
        return "media_entity"
    allowed = ALLOWED_ARGS[pair] | {"entity_id"}
    if set(map(str, data)) - allowed:
        return "media_arguments"
    if pair == ("media_player", "play_media"):
        kind, content = data.get("media_content_type"), data.get("media_content_id")
        if kind == "send_key":
            return None if isinstance(content, str) and content in SAMSUNG_KEYS else "media_key_refused"
        if kind == "send_text":
            return "media_text_refused" if _text_problem(content) else None
        return "media_play_media_type"
    if pair == ("remote", "send_command"):
        command = data.get("command")
        if not isinstance(command, str):  # a list of commands could carry a power key
            return "media_key_refused"
        if command.startswith("text:"):
            return "media_text_refused" if _text_problem(command[5:]) else None
        return None if command in ANDROID_KEYS else "media_key_refused"
    if pair == ("webostv", "button"):
        return None if isinstance(data.get("button"), str) and data["button"] in LG_BUTTONS else "media_key_refused"
    if pair == ("webostv", "select_sound_output"):
        value = data.get("sound_output")
        return None if isinstance(value, str) and SOUND_OUTPUT_RE.match(value) else "media_arguments"
    if pair == ("media_player", "select_source"):
        return None if _listed(data.get("source"), attributes_of(entity_id), "source_list", SOURCE_MAX) else "media_source_not_listed"
    if pair == ("remote", "turn_on"):
        if "activity" not in data:
            return "media_arguments"  # a bare remote.turn_on is a power-on of the device: never through this service
        return None if _listed(data.get("activity"), attributes_of(entity_id), "activity_list", ACTIVITY_MAX) else "media_activity_not_listed"
    return None  # the argument-free steps (volume_up / down, play_pause, next, previous)


def is_media(domain: str, service: str) -> bool:
    return (domain, service) in MEDIA_SERVICES or (domain, service) in NEVER_SERVICES
