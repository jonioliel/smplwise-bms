"""Brand profiles of the media screens (CR-015 section 4, docs/architecture/MEDIA_API.md): DATA, versioned (PROFILES_VERSION).

A profile adds only the remote-KEY vocabulary of a brand (our `KeyId` -> the platform's code) and how the brand carries text
and apps. Capabilities (power, volume, sources, transport) always come from the live `supported_features` of the endpoints
(services/media_model.py); a profile never grants one.

Hard rules encoded here:
- A POWER key does not exist in any vocabulary (`KEY_POWER`, `KEY_POWEROFF`, `POWER` ...): power goes only through
  `media_player.turn_on` / `turn_off` (TV notes 1.5: on 2016+ Samsung KEY_POWEROFF toggles). `static_refusal` refuses every
  key code that is not in these tables, so an unknown or power code cannot be sent whatever the caller names.
- A key missing from a profile is not offered and is refused.
- The samsung blue key (`KEY_CYAN`) and the LG rewind / fast-forward keys stay OFF until verified on a real device (CR 4).

The bridge (custom_components/smplwise_bridge/media_policy.py) carries the same tables and re-checks them independently; the
drift test tests/test_bridge_media_policy.py keeps the two equal."""
from __future__ import annotations

import re
from typing import Any

PROFILES_VERSION = 1

# our KeyId vocabulary, in the order the client lists it (frontend/src/api/media-screens.ts KEY_IDS)
KEY_IDS: tuple[str, ...] = (
    "up", "down", "left", "right", "ok", "back", "home", "menu", "exit", "info", "guide", "source", "tools", "settings", "chlist", "prech",
    "volup", "voldown", "mute", "chup", "chdown", "n0", "n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8", "n9",
    "red", "green", "yellow", "blue", "play", "pause", "stop", "rew", "ff",
)

PROFILE_IDS: tuple[str, ...] = ("samsung_smart", "lg_webos", "android_tv", "generic")

_DIGITS = {f"n{i}": i for i in range(10)}


def _digits(fmt: str) -> dict[str, str]:
    return {k: fmt.format(v) for k, v in _DIGITS.items()}


# our key -> the code of the platform's own transport (TV notes section 6)
SAMSUNG_CODES: dict[str, str] = {
    "up": "KEY_UP", "down": "KEY_DOWN", "left": "KEY_LEFT", "right": "KEY_RIGHT", "ok": "KEY_ENTER",
    "back": "KEY_RETURN", "home": "KEY_HOME", "menu": "KEY_MENU", "exit": "KEY_EXIT", "info": "KEY_INFO", "guide": "KEY_GUIDE",
    "source": "KEY_SOURCE", "tools": "KEY_TOOLS", "chlist": "KEY_CH_LIST", "prech": "KEY_PRECH",
    "volup": "KEY_VOLUP", "voldown": "KEY_VOLDOWN", "mute": "KEY_MUTE", "chup": "KEY_CHUP", "chdown": "KEY_CHDOWN",
    **_digits("KEY_{}"),
    "red": "KEY_RED", "green": "KEY_GREEN", "yellow": "KEY_YELLOW",  # blue (KEY_CYAN) stays off until verified live
    "play": "KEY_PLAY", "pause": "KEY_PAUSE", "stop": "KEY_STOP", "rew": "KEY_REWIND", "ff": "KEY_FF",
}
LG_CODES: dict[str, str] = {
    "up": "UP", "down": "DOWN", "left": "LEFT", "right": "RIGHT", "ok": "ENTER",
    "back": "BACK", "home": "HOME", "menu": "MENU", "exit": "EXIT", "info": "INFO", "guide": "GUIDE",
    "volup": "VOLUMEUP", "voldown": "VOLUMEDOWN", "mute": "MUTE", "chup": "CHANNELUP", "chdown": "CHANNELDOWN",
    **_digits("{}"),
    "red": "RED", "green": "GREEN", "yellow": "YELLOW", "blue": "BLUE",
    "play": "PLAY", "pause": "PAUSE",  # stop goes through media_player.media_stop; rew / ff stay off until verified
}
ANDROID_CODES: dict[str, str] = {
    "up": "DPAD_UP", "down": "DPAD_DOWN", "left": "DPAD_LEFT", "right": "DPAD_RIGHT", "ok": "DPAD_CENTER",
    "back": "BACK", "home": "HOME", "menu": "MENU", "settings": "SETTINGS", "info": "INFO", "guide": "GUIDE", "source": "TV_INPUT",
    "volup": "VOLUME_UP", "voldown": "VOLUME_DOWN", "mute": "MUTE", "chup": "CHANNEL_UP", "chdown": "CHANNEL_DOWN",
    **_digits("{}"),
    "red": "PROG_RED", "green": "PROG_GREEN", "yellow": "PROG_YELLOW", "blue": "PROG_BLUE",
    "play": "MEDIA_PLAY", "pause": "MEDIA_PAUSE", "stop": "MEDIA_STOP", "rew": "MEDIA_REWIND", "ff": "MEDIA_FAST_FORWARD",
}

CODES: dict[str, dict[str, str]] = {"samsung_smart": SAMSUNG_CODES, "lg_webos": LG_CODES, "android_tv": ANDROID_CODES, "generic": {}}
# Keys that exist but are OFF until an administrator enables them for ONE screen ("model keys", never guessed): the Samsung blue key
# is `KEY_CYAN` on the models that have one (UNVERIFIED). They are sent only when the screen's `model_keys` names them.
MODEL_CODES: dict[str, dict[str, str]] = {"samsung_smart": {"blue": "KEY_CYAN"}, "lg_webos": {}, "android_tv": {}, "generic": {}}

# how each profile sends a key: (allow-listed action id, the argument that carries the code, the role of the endpoint that takes it)
TRANSPORT: dict[str, tuple[str, str, str] | None] = {
    "samsung_smart": ("media_player.play_media", "media_content_id", "vendor"),
    "lg_webos": ("webostv.button", "button", "vendor"),
    "android_tv": ("remote.send_command", "command", "remote"),
    "generic": None,
}
TEXT: dict[str, bool] = {"samsung_smart": True, "lg_webos": False, "android_tv": True, "generic": False}  # LG text entry UNVERIFIED -> off
APPS: dict[str, str] = {"samsung_smart": "source_list", "lg_webos": "source_list", "android_tv": "activities", "generic": "none"}
EXTRA_KEYS: tuple[str, ...] = ("exit", "info", "guide", "source", "tools", "settings", "chlist", "prech")  # the remote's "מקשים נוספים" section

# every platform that means "the TV's own integration" (a media_player of one of them is the `vendor` endpoint)
VENDOR_PLATFORMS: tuple[str, ...] = ("samsungtv_smart", "samsungtv", "webostv", "androidtv_remote", "androidtv", "braviatv", "philips_js")
# detection order when a device carries endpoints of several brands
DETECT: tuple[tuple[str, str], ...] = (("samsungtv_smart", "samsung_smart"), ("webostv", "lg_webos"), ("androidtv_remote", "android_tv"))

# LG's own sound-output values (TV notes 3.2; the full per-model list is UNVERIFIED, so only these documented ones are offered)
LG_SOUND_OUTPUTS: tuple[str, ...] = ("tv_speaker", "external_speaker", "external_optical", "external_arc", "headphone")

TEXT_MAX = 200
SOURCE_MAX = 120
_KEY_SAMSUNG_RE = re.compile(r"^KEY_[A-Z0-9_]{1,24}$")
_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")

ALL_SAMSUNG = frozenset(SAMSUNG_CODES.values()) | frozenset(MODEL_CODES["samsung_smart"].values())
ALL_LG = frozenset(LG_CODES.values()) | frozenset(MODEL_CODES["lg_webos"].values())
ALL_ANDROID = frozenset(ANDROID_CODES.values()) | frozenset(MODEL_CODES["android_tv"].values())


def detect(platforms: set[str] | frozenset[str]) -> str:
    """The profile of a device from the registry platforms of its endpoints; `generic` when none is a known brand."""
    for platform, profile in DETECT:
        if platform in platforms:
            return profile
    return "generic"


def keys_of(profile: str) -> list[str]:
    """The KeyIds a profile offers, in vocabulary order."""
    codes = CODES.get(profile, {})
    return [k for k in KEY_IDS if k in codes]


def code_of(profile: str, key: str, model_keys: list[str] | tuple[str, ...] = ()) -> str | None:
    """The platform code of `key` for `profile`: the profile's own table, or - only when `key` is one of the screen's enabled model
    keys - the model table."""
    code = CODES.get(profile, {}).get(key)
    if code is None and key in model_keys:
        code = MODEL_CODES.get(profile, {}).get(key)
    return code


def model_key_options(profile: str) -> list[str]:
    """The KeyIds an administrator may enable for a screen of this profile beyond its default vocabulary."""
    return [k for k in KEY_IDS if k in MODEL_CODES.get(profile, {}) and k not in CODES.get(profile, {})]


def has_text(profile: str) -> bool:
    return TEXT.get(profile, False)


def catalogue() -> dict[str, Any]:
    """`GET /multimedia/profiles`: vocabularies only (no service names, no codes)."""
    out = []
    for pid in PROFILE_IDS:
        keys = keys_of(pid)
        out.append({"id": pid, "keys": keys, "text": has_text(pid), "apps": APPS[pid], "extras": [k for k in EXTRA_KEYS if k in keys]})
    return {"version": PROFILES_VERSION, "profiles": out}


def has_control_chars(text: str) -> bool:
    return bool(_CONTROL_RE.search(text))


def text_problem(text: Any) -> str | None:
    """None when `text` may be typed on a screen: a string of 1..TEXT_MAX characters without control characters."""
    if not isinstance(text, str) or not 1 <= len(text) <= TEXT_MAX:
        return "length"
    if has_control_chars(text):
        return "control_characters"
    return None


def static_refusal(action_id: str, data: dict[str, Any]) -> str | None:
    """The add-on's own context-free check of a media action's arguments (services/ha_bridge.validate_action calls it for
    every `route: "media"` action; the bridge repeats it in media_policy.py): the key code is in a profile table - hence
    never a power key -, `send_key` codes have the KEY_ shape, typed text is short and plain, `remote.turn_on` names an
    activity. Returns a short reason or None. The live membership checks (a source in the entity's `source_list`, an
    activity in its `activity_list`) need the entity and are done by services/media_commands.py."""
    if action_id == "media_player.play_media":
        kind, content = data.get("media_content_type"), data.get("media_content_id")
        if kind == "send_key":
            return None if isinstance(content, str) and _KEY_SAMSUNG_RE.match(content) and content in ALL_SAMSUNG else "key_not_in_profile"
        if kind == "send_text":
            return text_problem(content)
        return "play_media_type"
    if action_id == "remote.send_command":
        command = data.get("command")
        if not isinstance(command, str):
            return "command"
        if command.startswith("text:"):
            return text_problem(command[5:])
        return None if command in ALL_ANDROID else "key_not_in_profile"
    if action_id == "webostv.button":
        return None if data.get("button") in ALL_LG else "key_not_in_profile"
    if action_id == "remote.turn_on":
        activity = data.get("activity")
        return None if isinstance(activity, str) and activity.strip() and not has_control_chars(activity) else "activity"
    if action_id == "webostv.select_sound_output":
        value = data.get("sound_output")
        return None if isinstance(value, str) and re.fullmatch(r"[a-z_]{1,40}", value) else "sound_output"
    if action_id == "media_player.select_source":
        value = data.get("source")
        return None if isinstance(value, str) and value.strip() and not has_control_chars(value) else "source"
    return None
